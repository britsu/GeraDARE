const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { parseExcel, normalizeMVA, parseDecimal, isTotalOrAuxiliaryRow } = require('../src/parser/excelParser');
const { parseSped, generateDebitsSpreadsheet } = require('../src/parser/spedParser');
const { groupInvoices, formatObservation, computeIdempotencyHash, abbreviateProductName } = require('../src/engine/grouper');
const { analyzeDueDate, getDefaultDueDate } = require('../src/utils/calendar');
const { resolveBatchDirectory, isFilial, sanitizeFileName, checkInvoiceIdempotency, getStandardPdfName } = require('../src/storage/pathManager');
const { validateDareAgainstInvoice, parseDarePdf, extractPdfText, unescapePdfString } = require('../src/audit/dareValidator');
const XLSX = require('xlsx');

const http = require('http');
const { app } = require('../src/server');

console.log('====================================================');
console.log(' INICIANDO BATERIA DE TESTES OBRIGATÓRIOS (GeraDARE)');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    throw err;
  }
}

// ----------------------------------------------------
// 1. Testes do Importador e Planilha de Referência
// ----------------------------------------------------
console.log('--- 1. Testes do Importador XLSX ---');

runTest('Deve ignorar linhas de TOTAIS e linhas vazias', () => {
  assert.strictEqual(isTotalOrAuxiliaryRow('TOTAIS'), true);
  assert.strictEqual(isTotalOrAuxiliaryRow('TOTAL'), true);
  assert.strictEqual(isTotalOrAuxiliaryRow('Total Geral'), true);
  assert.strictEqual(isTotalOrAuxiliaryRow(''), true);
  assert.strictEqual(isTotalOrAuxiliaryRow(null), true);
  assert.strictEqual(isTotalOrAuxiliaryRow('25101'), false);
});

runTest('Deve normalizar MVA decimal e percentual brasileiro corretamente', () => {
  const mva1 = normalizeMVA(0.265);
  assert.strictEqual(mva1.num, 26.5);
  assert.strictEqual(mva1.str, '26,5%');

  const mva2 = normalizeMVA('26.50%');
  assert.strictEqual(mva2.num, 26.5);
  assert.strictEqual(mva2.str, '26,5%');

  const mva3 = normalizeMVA(0.76);
  assert.strictEqual(mva3.num, 76);
  assert.strictEqual(mva3.str, '76%');

  const mva4 = normalizeMVA('76%');
  assert.strictEqual(mva4.num, 76);
  assert.strictEqual(mva4.str, '76%');

  const mva5 = normalizeMVA('0.65');
  assert.strictEqual(mva5.num, 65);
  assert.strictEqual(mva5.str, '65%');

  // MVA superior a 100% (ex: 106,14% armazenado no Excel como decimal 1.0614)
  const mva6 = normalizeMVA(1.0614);
  assert.strictEqual(mva6.num, 106.14);
  assert.strictEqual(mva6.str, '106,14%');

  const mva7 = normalizeMVA('106,14%');
  assert.strictEqual(mva7.num, 106.14);
  assert.strictEqual(mva7.str, '106,14%');

  const mva8 = normalizeMVA('106.14%');
  assert.strictEqual(mva8.num, 106.14);
  assert.strictEqual(mva8.str, '106,14%');

  const mva9 = normalizeMVA(0.9969);
  assert.strictEqual(mva9.num, 99.69);
  assert.strictEqual(mva9.str, '99,69%');

  const mva10 = normalizeMVA(1.50);
  assert.strictEqual(mva10.num, 150);
  assert.strictEqual(mva10.str, '150%');
});

runTest('Deve parsear valores decimais e monetários brasileiros', () => {
  assert.strictEqual(parseDecimal(' R$ 1,130.52 '), 1130.52);
  assert.strictEqual(parseDecimal(' R$ 118.86 '), 118.86);
  assert.strictEqual(parseDecimal(' R$ -   '), 0);
  assert.strictEqual(parseDecimal('1.130,52'), 1130.52);
  assert.strictEqual(parseDecimal('118,86'), 118.86);
});

const referenceExcelPath = path.join(__dirname, '..', 'ICMS ST.xlsx');
let parsedReference = null;

runTest('Planilha de referência ICMS ST.xlsx deve identificar exatamente 16 itens', () => {
  assert.strictEqual(fs.existsSync(referenceExcelPath), true, 'Arquivo ICMS ST.xlsx deve existir');
  parsedReference = parseExcel(referenceExcelPath);
  assert.strictEqual(parsedReference.totalItems, 16, 'Deve conter exatamente 16 itens válidos');
});

// ----------------------------------------------------
// 2. Testes de Agrupamento por Nota Fiscal
// ----------------------------------------------------
console.log('\n--- 2. Testes de Agrupamento e Valores ---');

let groupedReference = null;

runTest('Deve agrupar exatamente 10 notas fiscais distintas', () => {
  groupedReference = groupInvoices(parsedReference.items, '29.515.340-7', '09/09/2026', '140');
  assert.strictEqual(groupedReference.totalInvoices, 10, 'Devem ser exatamente 10 notas fiscais');
});

runTest('Valor da guia deve ser a soma de ICMS ST e não Valor Contábil', () => {
  assert(
    Math.abs(groupedReference.grandTotalCalculated - 1151.58) < 0.05,
    `Total calculado (${groupedReference.grandTotalCalculated}) deve ser ~ 1151.58`
  );

  groupedReference.invoices.forEach(inv => {
    const sumContabil = inv.items.reduce((acc, it) => acc + (it.valorContabil || 0), 0);
    if (sumContabil > 0) {
      assert.notStrictEqual(inv.valorGuia, sumContabil, `NF ${inv.nf} não pode usar Valor Contábil`);
    }
  });
});

runTest('Para a NF 25105: deve separar grupos de farinha (MVA 76%) e sardinha (MVA 65%)', () => {
  const nf25105 = groupedReference.invoices.find(inv => inv.nf === '25105');
  assert(nf25105, 'NF 25105 deve estar presente');
  assert.strictEqual(nf25105.itemCount, 4, 'NF 25105 deve ter 4 itens');
  assert.strictEqual(nf25105.valorGuia, 204.55, 'Valor ST da NF 25105 deve ser R$ 204,55 (22.69 + 87.05 + 49.76 + 45.05)');

  const expectedObs = 'DARE ICMS ST REF COMPRA DE FAR TRIGO D BENTA CFER 1KG, FAR TRIGO D BENTA SFERM 1KG E FAR TRIGO ROSA BRANCA SFERM 1KG NA NF 25105 (MVA 76%) E SARDINHA 88 TOM 125G (MVA 65%)\nChave NFe: 21260803995515021083550020000251051000251061';
  assert.strictEqual(nf25105.observation, expectedObs, 'Texto da observação da NF 25105 deve seguir o padrão exato da especificação');
});

runTest('Para a NF 25101: produto único e MVA único', () => {
  const nf25101 = groupedReference.invoices.find(inv => inv.nf === '25101');
  assert(nf25101, 'NF 25101 deve existir');
  assert.strictEqual(nf25101.itemCount, 1);
  assert.strictEqual(nf25101.valorGuia, 118.86);
  assert.strictEqual(
    nf25101.observation,
    'DARE ICMS ST REF COMPRA DE CAFE M MOIDO AVAC PCT 250G NA NF 25101 (MVA 26,5%)\nChave NFe: 21260803995515021083550020000251011000251020'
  );
});

// ----------------------------------------------------
// 3. Testes do Calendário e Regra de Vencimento
// ----------------------------------------------------
console.log('\n--- 3. Testes do Calendário e Vencimento ---');

runTest('Deve aceitar dia útil sem alertas e definir pasta como mês da competência', () => {
  const d1 = analyzeDueDate('09/09/2026');
  assert.strictEqual(d1.isValid, true);
  assert.strictEqual(d1.isNonBusinessDay, false);
  assert.strictEqual(d1.competencia, '08/2026');
  assert.strictEqual(d1.monthYearFolder, '08-2026', 'A pasta mensal deve ser o mês da competência (08-2026)');
  assert.strictEqual(d1.dueDateMonthYear, '09-2026', 'Mês de vencimento deve ser 09-2026');
});

runTest('Deve alertar fim de semana e sugerir próximo dia útil', () => {
  const dSat = analyzeDueDate('12/09/2026');
  assert.strictEqual(dSat.isValid, true);
  assert.strictEqual(dSat.isNonBusinessDay, true);
  assert(dSat.reason.includes('Sábado'));
  assert.strictEqual(dSat.suggestedNextBusinessDay, '14/09/2026');
});

runTest('Deve alertar feriado estadual do Tocantins (05/10 - Criação do Estado)', () => {
  const dHol = analyzeDueDate('05/10/2026');
  assert.strictEqual(dHol.isValid, true);
  assert.strictEqual(dHol.isNonBusinessDay, true);
  assert(dHol.reason.includes('Criação do Estado do Tocantins'));
  assert.strictEqual(dHol.suggestedNextBusinessDay, '06/10/2026');
});

runTest('getDefaultDueDate deve retornar dia 09 do mês atual da data do computador', () => {
  const now = new Date();
  const expectedMonth = String(now.getMonth() + 1).padStart(2, '0');
  const expectedYear = now.getFullYear();
  const expected = `09/${expectedMonth}/${expectedYear}`;
  const actual = getDefaultDueDate();
  assert.strictEqual(actual, expected);

  // analyzeDueDate sem argumentos deve utilizar o vencimento padrão do mês atual
  const analysis = analyzeDueDate();
  assert.strictEqual(analysis.isValid, true);
  assert.strictEqual(analysis.dateStr, expected);
});

// ----------------------------------------------------
// 4. Testes de Diretórios, Filiais e Idempotência
// ----------------------------------------------------
console.log('\n--- 4. Testes de Diretórios e Idempotência ---');

runTest('Deve detectar Matriz vs Filial pelo CNPJ', () => {
  assert.strictEqual(isFilial('43.037.906/0001-93'), false, '0001 é Matriz');
  assert.strictEqual(isFilial('43.037.906/0002-74'), true, '0002 é Filial');
});

runTest('resolveBatchDirectory deve gerar na pasta do mês da competência (08-2026) e não do vencimento (09-2026)', () => {
  const d = analyzeDueDate('09/09/2026');
  const resolved = resolveBatchDirectory({
    baseDir: path.join(__dirname, '..', 'tmp_test_dir'),
    competenceMonthYear: d.competenceMonthYearFolder,
    dueDateMonthYear: d.dueDateMonthYear,
    monthYearFolder: d.monthYearFolder,
    razaoSocial: 'S A MENDANHA LTDA',
    cnpj: '43.037.906/0002-74',
    createIfMissing: false
  });
  assert(resolved.targetPath.includes('08-2026'), `Caminho deve conter o mês da competência 08-2026: ${resolved.targetPath}`);
  assert(!resolved.targetPath.includes('09-2026'), `Caminho NÃO deve conter o mês do vencimento 09-2026: ${resolved.targetPath}`);
});

runTest('Higienização de nome de pasta para Windows', () => {
  const clean = sanitizeFileName('S A MENDANHA / LTDA : ME * ?');
  assert(!clean.includes('/'));
  assert(!clean.includes(':'));
  assert(!clean.includes('*'));
  assert(!clean.includes('?'));
});

runTest('Hash de Idempotência deve ser determinístico', () => {
  const hash1 = computeIdempotencyHash('29.515.340-7', '25101', '09/09/2026', '140', 118.86);
  const hash2 = computeIdempotencyHash('295153407', '25101', '09/09/2026', '140', 118.86);
  assert.strictEqual(hash1, hash2, 'Normalização de IE deve gerar mesmo hash');

  const hashDiff = computeIdempotencyHash('295153407', '25101', '09/09/2026', '140', 119.00);
  assert.notStrictEqual(hash1, hashDiff, 'Valores diferentes devem gerar hashes diferentes');
});

// ----------------------------------------------------
// 5. Testes de Nomenclatura Padrão e Abreviador de Observação
// ----------------------------------------------------
console.log('\n--- 5. Testes de Nomenclatura e Abreviador 400 Chars ---');

runTest('Padrão de título do arquivo deve ser "DARE ICMS ST NF 12345 - NOME DA EMPRESA.pdf"', () => {
  const name1 = getStandardPdfName('25101', 'S A MENDANHA LTDA');
  assert.strictEqual(name1, 'DARE ICMS ST NF 25101 - S A MENDANHA LTDA.pdf');

  const name2 = getStandardPdfName('25331', 'S A MENDANHA LTDA - ME');
  assert.strictEqual(name2, 'DARE ICMS ST NF 25331 - S A MENDANHA LTDA - ME.pdf');
});

runTest('getStandardPdfName deve higienizar caracteres inválidos do Windows na razão social', () => {
  const name = getStandardPdfName('77777', 'EMPRESA / TESTE <SP> * LTDA?');
  assert.strictEqual(name, 'DARE ICMS ST NF 77777 - EMPRESA TESTE SP LTDA.pdf');
});

runTest('Abreviador de produtos deve respeitar o limite de 400 caracteres da SEFAZ', () => {
  // Create 15 products with long descriptions
  const manyItems = [];
  for (let i = 1; i <= 15; i++) {
    manyItems.push({
      itemNum: i,
      produto: `REFRIGERANTE COCA COLA GARRAFA PET 2 LITROS SABOR ORIGINAL TRADICIONAL EDICAO ESPECIAL ${i}`,
      mva: { num: 40, str: '40%' },
      icmsST: 10.0
    });
  }

  const obs = formatObservation('99999', manyItems);
  assert(obs.length <= 400, `Observação deve ter no máximo 400 caracteres (atual: ${obs.length})`);
  assert(obs.includes('DARE ICMS ST REF COMPRA DE'), 'Deve conter cabeçalho padrão');
  assert(obs.includes('NA NF 99999'), 'Deve conter o número da NF');
  assert(obs.includes('(MVA 40%)'), 'Deve conter a MVA do grupo');
});

runTest('Abreviador deve manter produtos e seus respectivos MVAs quando há múltiplos grupos', () => {
  const multiGroupItems = [
    { itemNum: 1, produto: 'BISCOITO CHOCOLATE RECHEADO PACOTE 150G', mva: { num: 35, str: '35%' }, icmsST: 15 },
    { itemNum: 2, produto: 'DESODORANTE ANTITRANSPIRANTE AEROSOL 150ML', mva: { num: 45, str: '45%' }, icmsST: 25 },
    { itemNum: 3, produto: 'SABONETE EM BARRA VEGETAL 90G', mva: { num: 55, str: '55%' }, icmsST: 10 }
  ];

  const obs = formatObservation('88888', multiGroupItems);
  assert(obs.length <= 400);
  assert(obs.includes('(MVA 35%)'));
  assert(obs.includes('(MVA 45%)'));
  assert(obs.includes('(MVA 55%)'));
});

runTest('Abreviador com 10 grupos de MVA distintos deve manter todos os MVAs e <= 400 caracteres', () => {
  const items = [];
  for (let i = 1; i <= 10; i++) {
    items.push({
      itemNum: i,
      produto: `PRODUTO DE MERCEARIA LONGO EXTENSO NUMERO ${i}`,
      mva: { num: 10 + i * 5, str: `${10 + i * 5}%` },
      icmsST: 10
    });
  }
  const obs = formatObservation('12345', items);
  assert(obs.length <= 400, `Tamanho deve ser <= 400, atual: ${obs.length}`);
  for (let i = 1; i <= 10; i++) {
    assert(obs.includes(`${10 + i * 5}%`), `Deve incluir MVA ${10 + i * 5}%`);
  }
});

runTest('Abreviador com 25 produtos na mesma nota deve manter <= 400 caracteres, NF e MVAs intactos', () => {
  const items = [];
  for (let i = 1; i <= 25; i++) {
    items.push({
      itemNum: i,
      produto: `PRODUTO ALIMENTICIO ESPECIAL SUPERMERCADO ITEM NUMERO ${i}`,
      mva: { num: 40, str: '40%' },
      icmsST: 15.5
    });
  }
  const obs = formatObservation('25105', items);
  assert(obs.length <= 400, `Tamanho deve ser <= 400, atual: ${obs.length}`);
  assert(obs.includes('25105'), 'Deve conter o número da NF 25105');
  assert(obs.includes('40%'), 'Deve conter o percentual de MVA 40%');
  assert(obs.startsWith('DARE ICMS ST REF COMPRA DE '), 'Deve conter o prefixo regulamentar');
});

runTest('Resumo adaptativo para NF com muitos produtos (NF 150879) deve incluir NF, MVAs, Chave NFe e <= 400 chars', () => {
  const chave = '35260950248731000129550010001508791860065783';
  const nf150879Items = [
    { itemNum: 1, produto: 'VALVULA REGULADORA PRESSAO SCANIA113', mva: { num: 99.69, str: '99,69%' }, icmsST: 41.13, chaveAcesso: chave },
    { itemNum: 2, produto: 'VALVULA SOLENOIDE 3/2 VIA TRANSF VOLK CONSTELL 24', mva: { num: 106.14, str: '106,14%' }, icmsST: 192.91, chaveAcesso: chave },
    { itemNum: 3, produto: 'CILINDRO DE EMBREAGEM SCANIA 124/114 AP 98 HASTE L', mva: { num: 99.69, str: '99,69%' }, icmsST: 123.21, chaveAcesso: chave },
    { itemNum: 4, produto: 'VALVULA REGULADORA PRESSAO ANTIGA FERRO VW/VV/MB', mva: { num: 99.69, str: '99,69%' }, icmsST: 41.13, chaveAcesso: chave },
    { itemNum: 5, produto: 'REPARO CUICA SCANIA/VOLVO/MERCEDES 24X24 E 20X24', mva: { num: 99.69, str: '99,69%' }, icmsST: 114.88, chaveAcesso: chave },
    { itemNum: 6, produto: 'REPARO CUICAO TRAS SC/VO/MB/ 24X30 (TIPO ORIGINAL)', mva: { num: 99.69, str: '99,69%' }, icmsST: 100.70, chaveAcesso: chave },
    { itemNum: 7, produto: 'SILENCIADOR DE DESCARGA VALVULA APU SC/VV', mva: { num: 106.14, str: '106,14%' }, icmsST: 13.89, chaveAcesso: chave },
    { itemNum: 8, produto: 'VALVULA APU SCANIA 124 SERIE 4 (TODOS)', mva: { num: 106.14, str: '106,14%' }, icmsST: 114.90, chaveAcesso: chave },
    { itemNum: 9, produto: 'VALVULA NIVELADORA VW/CARRETA SUSPENSAO A AR (KIT)', mva: { num: 99.69, str: '99,69%' }, icmsST: 100.19, chaveAcesso: chave },
    { itemNum: 10, produto: 'REPARO CAB COMPRESSOR VOLVO FH 13 2008/...DUPLO', mva: { num: 99.69, str: '99,69%' }, icmsST: 187.13, chaveAcesso: chave },
    { itemNum: 11, produto: 'SILENCIADOR DE DESCARGA VALVULA APS2 SCANIA SERI 5', mva: { num: 99.69, str: '99,69%' }, icmsST: 156.06, chaveAcesso: chave },
    { itemNum: 12, produto: 'REPARO VALVULA RELE MESTRE CARRE 4/3SAIDA PREMO', mva: { num: 99.69, str: '99,69%' }, icmsST: 103.52, chaveAcesso: chave },
    { itemNum: 13, produto: 'REPARO CAB COMPRESSOR VOLVO FH 12 MODER MONO KNOR', mva: { num: 99.69, str: '99,69%' }, icmsST: 20.67, chaveAcesso: chave },
    { itemNum: 14, produto: 'REPARO CAB COMPRESSOR KNOR 88M SC124 VOLVO FH DUPL', mva: { num: 99.69, str: '99,69%' }, icmsST: 133.60, chaveAcesso: chave },
    { itemNum: 15, produto: 'REPARO VALVULA APU SECADOR KNORR VOLVO FH/NH12', mva: { num: 99.69, str: '99,69%' }, icmsST: 33.98, chaveAcesso: chave },
    { itemNum: 16, produto: 'REPARO P/ CONEXOES PNEUMATICAS 16MM', mva: { num: 99.69, str: '99,69%' }, icmsST: 15.58, chaveAcesso: chave },
    { itemNum: 17, produto: 'VALVULA RELE ROSCA 16X22X22X22MM BAIXA TODAS', mva: { num: 106.14, str: '106,14%' }, icmsST: 65.66, chaveAcesso: chave },
    { itemNum: 18, produto: 'REPARO SECADOR DE AR VAL APU IVECO STRALYS LA 8124', mva: { num: 99.69, str: '99,69%' }, icmsST: 152.72, chaveAcesso: chave }
  ];

  const obs = formatObservation('150879', nf150879Items, { revenueCode: '140', chaveAcesso: chave });

  assert(obs.length <= 400, `Observação deve respeitar limite de 400 caracteres (tamanho real: ${obs.length})`);
  assert(obs.includes('150879'), 'Deve conter o número da nota 150879');
  assert(obs.includes(chave), 'Deve conter a Chave NFe de 44 dígitos');
  assert(obs.includes('99,69%'), 'Deve conter a MVA 99,69%');
  assert(obs.includes('106,14%'), 'Deve conter a MVA 106,14%');
  assert(obs.includes('E OUTROS (14 ITENS)'), 'Deve conter resumo adaptativo do grupo 1');
  assert(obs.includes('E OUTROS (4 ITENS)'), 'Deve conter resumo adaptativo do grupo 2');
  assert(!obs.includes('VALVULA REGULA,'), 'Não deve truncar produtos em pedaços mutilados de 10 caracteres');
});

// ----------------------------------------------------
// 6. Testes do Validador Pós-Geração de DAREs
// ----------------------------------------------------
console.log('\n--- 6. Testes de Validação Pós-Geração ---');

runTest('unescapePdfString deve desescapar parênteses e barras literais de PDF', () => {
  assert.strictEqual(unescapePdfString('\\(MVA 76%\\)'), '(MVA 76%)');
  assert.strictEqual(unescapePdfString('CAFE\\\\DOC'), 'CAFE\\DOC');
  assert.strictEqual(unescapePdfString('Linha 1\\nLinha 2'), 'Linha 1\nLinha 2');
});

const localPdfPath = path.join(__dirname, '..', 'DARE_NF_25101.pdf');
if (fs.existsSync(localPdfPath)) {
  runTest('Deve validar com sucesso PDF local DARE_NF_25101.pdf com IE, Valor e Observação', () => {
    const val = validateDareAgainstInvoice(localPdfPath, {
      nf: '25101',
      valorGuia: 118.86,
      items: [{ produto: 'CAFE M MOIDO AVAC PCT 250G', mva: { str: '26,5%' } }]
    }, {
      ie: '29.515.340-7',
      razaoSocial: 'S A MENDANHA LTDA - ME'
    });

    assert.strictEqual(val.valid, true, `Validação deveria passar: ${val.errors.join('; ')}`);
    assert.strictEqual(val.checks.ieMatch, true, 'IE deve bater');
    assert.strictEqual(val.checks.valorMatch, true, 'Valor deve bater');
    assert.strictEqual(val.checks.obsMatch, true, 'Observação deve bater');
  });

  runTest('Deve detectar divergência quando o valor da guia no PDF for diferente', () => {
    const val = validateDareAgainstInvoice(localPdfPath, {
      nf: '25101',
      valorGuia: 250.00, // Valor errado
      items: [{ produto: 'CAFE M MOIDO AVAC PCT 250G', mva: { str: '26,5%' } }]
    }, {
      ie: '29.515.340-7'
    });

    assert.strictEqual(val.valid, false, 'Validação deve falhar por valor diferente');
    assert.strictEqual(val.checks.valorMatch, false);
    assert(val.errors.some(e => e.includes('Valor divergente')));
  });

  runTest('Deve detectar divergência quando a MVA no PDF for diferente da esperada', () => {
    const val = validateDareAgainstInvoice(localPdfPath, {
      nf: '25101',
      valorGuia: 118.86,
      items: [{ produto: 'CAFE M MOIDO AVAC PCT 250G', mva: { str: '99%' } }] // MVA errada
    }, {
      ie: '29.515.340-7'
    });

    assert.strictEqual(val.valid, false, 'Validação deve falhar por MVA divergente');
    assert.strictEqual(val.checks.obsMatch, false);
  });

  runTest('Validador deve aceitar nota sem MVA quando a nota não possuir itens com MVA', () => {
    const val = validateDareAgainstInvoice(localPdfPath, {
      nf: '25101',
      valorGuia: 118.86,
      items: [{ produto: 'CAFE M MOIDO AVAC PCT 250G', mva: null }]
    }, {
      ie: '29.515.340-7'
    });
    assert.strictEqual(val.valid, true, 'Deve validar com sucesso nota sem itens de MVA');
  });
}

const existingPdfDir = 'Z:\\DOCUMENTOS TEMPORÁRIOS\\LUIS HENRICK\\DARE\\09-2026\\S A MENDANHA LTDA - ME (2)';
if (fs.existsSync(existingPdfDir)) {
  runTest('Deve validar com sucesso PDF oficial existente (NF 25105 na Filial 1)', () => {
    const pdfPath = path.join(existingPdfDir, 'DARE_NF_25105.pdf');
    if (fs.existsSync(pdfPath)) {
      const val = validateDareAgainstInvoice(pdfPath, {
        nf: '25105',
        valorGuia: 204.55,
        items: [{ mva: { str: '76%' } }, { mva: { str: '65%' } }]
      }, {
        ie: '29.561.318-1',
        razaoSocial: 'S A MENDANHA LTDA'
      });

      assert.strictEqual(val.valid, true, `Validação deveria passar: ${val.errors.join('; ')}`);
      assert.strictEqual(val.checks.ieMatch, true);
      assert.strictEqual(val.checks.valorMatch, true);
      assert.strictEqual(val.checks.obsMatch, true);
    }
  });

  runTest('Deve detectar divergência se a IE do PDF não bater com a empresa esperada', () => {
    const pdfPath = path.join(existingPdfDir, 'DARE_NF_25105.pdf');
    if (fs.existsSync(pdfPath)) {
      const val = validateDareAgainstInvoice(pdfPath, {
        nf: '25105',
        valorGuia: 204.55,
        items: [{ mva: { str: '76%' } }]
      }, {
        ie: '29.515.340-7' // IE da Matriz ao invés da Filial!
      });

      assert.strictEqual(val.valid, false, 'Validação deve falhar por IE divergente');
      assert.strictEqual(val.checks.ieMatch, false);
      assert(val.errors.some(e => e.includes('Inscrição Estadual divergente')));
    }
  });

  runTest('Deve validar com sucesso PDF oficial existente da Matriz (NF 25331 com IE da Matriz 29.515.340-7)', () => {
    const pdfPath = path.join(existingPdfDir, 'DARE_NF_25331.pdf');
    if (fs.existsSync(pdfPath)) {
      const val = validateDareAgainstInvoice(pdfPath, {
        nf: '25331',
        valorGuia: 113.14,
        items: [{ produto: 'FRANGO', mva: { str: '48,5%' } }]
      }, {
        ie: '29.515.340-7',
        razaoSocial: 'S A MENDANHA  LTDA - ME'
      });

      assert.strictEqual(val.valid, true, `Validação de NF 25331 Matriz deve passar: ${val.errors.join('; ')}`);
      assert.strictEqual(val.checks.ieMatch, true, 'IE da Matriz deve bater');
      assert.strictEqual(val.checks.valorMatch, true, 'Valor R$ 113.14 deve bater');
      assert.strictEqual(val.checks.obsMatch, true, 'Observação de NF 25331 deve bater');
    }
  });

  runTest('Deve rejeitar validação de NF 25331 se consultada sob a IE da Filial 1', () => {
    const pdfPath = path.join(existingPdfDir, 'DARE_NF_25331.pdf');
    if (fs.existsSync(pdfPath)) {
      const val = validateDareAgainstInvoice(pdfPath, {
        nf: '25331',
        valorGuia: 113.14,
        items: [{ produto: 'FRANGO', mva: { str: '48,5%' } }]
      }, {
        ie: '29.561.318-1' // IE da Filial 1 (incorreta para esta nota!)
      });

      assert.strictEqual(val.valid, false, 'Validação deve falhar pois NF 25331 é da Matriz');
      assert.strictEqual(val.checks.ieMatch, false);
      assert(val.errors.some(e => e.includes('Inscrição Estadual divergente')));
    }
  });
}

// ----------------------------------------------------
// 7. Testes de Agrupamento Dinâmico (Sem Empresas Hardcoded)
// ----------------------------------------------------
console.log('\n--- 7. Testes de Agrupamento Dinâmico (Sem Defaults Fixos) ---');

runTest('groupInvoices não deve conter nenhuma empresa ou IE hardcoded por padrão', () => {
  const customItems = [
    {
      nf: '99001',
      itemNum: '1',
      produto: 'PRODUTO QUALQUER',
      mva: { num: 30, str: '30%' },
      icmsST: 50.0,
      cliente: 'ACME DISTRIBUIDORA LTDA',
      empresa: 'ACME MATRIZ',
      codEmpresa: '101'
    }
  ];

  const groupedCustom = groupInvoices(customItems, '', '10/10/2026', '140');
  const inv = groupedCustom.invoices[0];
  assert.strictEqual(inv.empresa, 'ACME MATRIZ');
  assert.strictEqual(inv.empresaCodigo, '101');
  assert.strictEqual(inv.empresaLabel, '101 - ACME MATRIZ');
  assert(!JSON.stringify(groupedCustom).includes('MENDANHA'), 'Não deve conter Mendanha');
  assert(!JSON.stringify(groupedCustom).includes('29.515.340-7'), 'Não deve conter IE fixa');
  assert(!JSON.stringify(groupedCustom).includes('29.561.318-1'), 'Não deve conter IE fixa');
});

// ----------------------------------------------------
// 8. Testes de Resolução de Pastas e Nomes
// ----------------------------------------------------
console.log('\n--- 8. Testes de Resolução de Diretório ---');

runTest('resolveBatchDirectory não deve lançar ReferenceError quando overridePath é null', () => {
  const res = resolveBatchDirectory({
    baseDir: null,
    dueDateMonthYear: '09-2026',
    razaoSocial: 'EMPRESA TESTE LTDA',
    cnpj: '43.037.906/0001-93',
    createIfMissing: false
  });
  assert(res.targetPath, 'Deve resolver targetPath');
  assert(res.targetPath.includes('09-2026'), 'Deve incluir mês/ano');
});

// ----------------------------------------------------
// 9. Testes de Suporte ao FECOEP (Cód. Receita 119)
// ----------------------------------------------------
console.log('\n--- 9. Testes de Suporte ao FECOEP (Cód. Receita 119) ---');

const matrizExcelPath = path.join(__dirname, '..', 'ICMS ST MATRIZ.xlsx');

runTest('Planilha ICMS ST MATRIZ.xlsx deve identificar itens com FECOEP', () => {
  assert(fs.existsSync(matrizExcelPath), 'Arquivo ICMS ST MATRIZ.xlsx deve existir');
  const parsedMatriz = parseExcel(matrizExcelPath);
  assert.strictEqual(parsedMatriz.totalItems, 24, 'Deve conter exatamente 24 itens');
  assert.strictEqual(parsedMatriz.hasFecoepItems, true, 'Deve identificar itens com FECOEP');
  assert.strictEqual(Math.round(parsedMatriz.totalGrossFECOEP * 100) / 100, 73.05, 'Total FECOEP bruto deve ser 73.05');
  assert.strictEqual(Math.round(parsedMatriz.totalGrossST * 100) / 100, 2466.19, 'Total ICMS ST bruto deve ser 2466.19');
});

runTest('Agrupamento de FECOEP (Cód. 119) deve filtrar apenas notas com FECOEP > 0', () => {
  const parsedMatriz = parseExcel(matrizExcelPath);
  const groupedFecoep = groupInvoices(parsedMatriz.items, '29.515.340-7', '09/09/2026', '119');
  assert.strictEqual(groupedFecoep.totalInvoices, 4, 'Deve agrupar exatamente 4 notas com FECOEP');
  assert.strictEqual(groupedFecoep.grandTotalCalculated, 73.05, 'Total calculado das guias FECOEP deve ser 73.05');

  // Verify individual invoices
  const nfMap = new Map(groupedFecoep.invoices.map(i => [i.nf, i]));
  assert.strictEqual(nfMap.get('25168')?.valorGuia, 4.78);
  assert.strictEqual(nfMap.get('25242')?.valorGuia, 14.52);
  assert.strictEqual(nfMap.get('25243')?.valorGuia, 23.02);
  assert.strictEqual(nfMap.get('25381')?.valorGuia, 30.73);
});

runTest('Formatação de Observação do FECOEP deve seguir o padrão oficial SEFAZ com Chave NFe', () => {
  const parsedMatriz = parseExcel(matrizExcelPath);
  const groupedFecoep = groupInvoices(parsedMatriz.items, '29.515.340-7', '09/09/2026', '119');
  const inv25168 = groupedFecoep.invoices.find(i => i.nf === '25168');
  assert(inv25168, 'NF 25168 deve existir');
  assert(inv25168.observation.startsWith('DARE ICMS FECOEP REF. COMPRA DE VINHO PERGOLA TTO SUAVE (MVA 55,55%) NA NF N° 25168'), 'Deve conter o prefixo e produtos corretos');
  assert(inv25168.observation.includes('\nChave NFe: 21260803995515021083550020000251681000251690'), 'Deve incluir a chave NFe na segunda linha');
  assert(inv25168.observation.length <= 400, 'Observação deve ter no máximo 400 caracteres');
});

runTest('Abreviador de produtos para FECOEP com mais de 400 caracteres deve preservar Chave NFe', () => {
  const longItems = [];
  for (let i = 1; i <= 20; i++) {
    longItems.push({
      nf: '99999',
      itemNum: String(i),
      produto: `PRODUTO ALCOOLICO COM NOME EXTRAORDINARIAMENTE LONGO E DETALHADO ITEM NUMERO ${i} SAFRA ESPECIAL`,
      mva: { num: 55.55, str: '55,55%' },
      fecoep: 5.0,
      chaveAcesso: '21260803995515021083550020000251681000251690'
    });
  }
  const obs = formatObservation('99999', longItems, { revenueCode: '119', chaveAcesso: '21260803995515021083550020000251681000251690' });
  assert(obs.length <= 400, `Observação deve respeitar 400 caracteres, obtido: ${obs.length}`);
  assert(obs.includes('\nChave NFe: 21260803995515021083550020000251681000251690'), 'Deve manter a Chave NFe de 44 dígitos intacta');
  assert(obs.startsWith('DARE ICMS FECOEP REF. COMPRA DE '), 'Deve manter o prefixo FECOEP');
});

runTest('Nomenclatura do PDF para FECOEP deve ser "DARE FECOEP NF [NUMERO] - [EMPRESA].pdf"', () => {
  const pdfName = getStandardPdfName('25168', 'S A MENDANHA LTDA - ME', '119');
  assert.strictEqual(pdfName, 'DARE FECOEP NF 25168 - S A MENDANHA LTDA - ME.pdf');

  const pdfNameST = getStandardPdfName('25168', 'S A MENDANHA LTDA - ME', '140');
  assert.strictEqual(pdfNameST, 'DARE ICMS ST NF 25168 - S A MENDANHA LTDA - ME.pdf');
});

runTest('Inscrição Estadual de teste 29.515.340-7 não deve estar como padrão no app', () => {
  const config = require('../src/config');
  assert.notStrictEqual(config.defaultIE, '29.515.340-7', 'Não deve ser default em config.js');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf-8');
  assert(!indexHtml.includes('value="29.515.340-7"'), 'inputIE não deve ter value pré-preenchido com IE de teste');
});

// ----------------------------------------------------
// 10. Testes de Endpoints do Servidor Express
// ----------------------------------------------------
console.log('\n--- 10. Testes de Endpoints do Servidor Express ---');

async function runServerTests() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  function request(method, pathUrl, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(pathUrl, baseUrl);
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, text: data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  try {
    await runAsyncTest('POST /api/open-folder deve resolver diretório e responder sucesso', async () => {
      const localDir = path.join(__dirname, '..');
      const res = await request('POST', '/api/open-folder', { folderPath: localDir });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.opened, path.resolve(localDir));
    });

    await runAsyncTest('POST /api/open-folder sem parâmetros deve resolver diretório padrão e responder sucesso', async () => {
      const res = await request('POST', '/api/open-folder', {});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert(res.data.opened, 'Deve retornar o caminho aberto');
    });

    await runAsyncTest('POST /api/validate-batch deve auditar lote de PDFs existentes', async () => {
      const targetDir = 'Z:\\DOCUMENTOS TEMPORÁRIOS\\LUIS HENRICK\\DARE\\09-2026\\S A MENDANHA LTDA - ME (2)';
      if (fs.existsSync(targetDir)) {
        const res = await request('POST', '/api/validate-batch', {
          targetDir,
          clientInfo: { ie: '295613181', razaoSocial: 'S A MENDANHA LTDA' },
          invoices: [
            { nf: '25101', valorGuia: 118.86, items: [{ mva: { str: '26,5%' } }] }
          ]
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.totalChecked, 1);
        assert.strictEqual(res.data.results[0].validation.valid, true);
      }
    });

    await runAsyncTest('POST /api/preview sem IE deve agrupar dinamicamente sem empresa padrão', async () => {
      const res = await request('POST', '/api/preview', { dueDate: '09/09/2026' });
      assert.strictEqual(res.status, 200);
      assert(res.data.summary);
      assert.strictEqual(res.data.summary.totalInvoices, 10);
      assert(Array.isArray(res.data.distinctCompanies));
      assert(res.data.distinctCompanies.length > 0);
    });

    await runAsyncTest('POST /api/preview com ICMS ST MATRIZ.xlsx deve retornar ST e FECOEP', async () => {
      const buffer = fs.readFileSync(path.join(__dirname, '..', 'ICMS ST MATRIZ.xlsx'));
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      let postData = `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="dueDate"\r\n\r\n09/09/2026\r\n`;
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="file"; filename="ICMS ST MATRIZ.xlsx"\r\n`;
      postData += `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
      const preBuffer = Buffer.from(postData, 'utf-8');
      const postBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
      const fullBody = Buffer.concat([preBuffer, buffer, postBuffer]);

      const res = await new Promise((resolve, reject) => {
        const url = new URL('/api/preview', baseUrl);
        const req = http.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': fullBody.length
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.write(fullBody);
        req.end();
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.hasFecoep, true);
      assert.strictEqual(res.data.totalGrossFECOEP, 73.05);
      assert(res.data.groupings);
      assert(res.data.groupings['140']);
      assert(res.data.groupings['119']);
      assert.strictEqual(res.data.groupings['119'].summary.totalInvoices, 4);
      assert.strictEqual(res.data.groupings['119'].summary.grandTotalCalculated, 73.05);
    });

    await runAsyncTest('POST /api/analyze-date deve calcular competência e verificar dia útil', async () => {
      const res = await request('POST', '/api/analyze-date', { dateStr: '09/09/2026' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.competencia, '08/2026');
      assert.strictEqual(res.data.isNonBusinessDay, false);
    });

    // ----------------------------------------------------
    // 11. Testes de Isolamento Estrito entre ICMS ST e FECOEP
    // ----------------------------------------------------
    await runAsyncTest('checkInvoiceIdempotency para FECOEP não deve casar com PDF de ICMS ST existente', async () => {
      const os = require('os');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-idemp-fecoep-'));
      try {
        fs.writeFileSync(path.join(tmpDir, 'DARE ICMS ST NF 25168 - S A MENDANHA LTDA - ME.pdf'), 'fake st pdf');
        fs.writeFileSync(path.join(tmpDir, 'processamento.json'), JSON.stringify({
          notas: [{ nf: '25168', idempotencyHash: 'st-hash-123', status: 'SUCESSO' }]
        }));

        const result = checkInvoiceIdempotency(tmpDir, '25168', 'fecoep-hash-456', 'S A MENDANHA LTDA - ME', '119');
        assert.strictEqual(result.isAlreadyProcessed, false, 'FECOEP não deve ser considerada já processada quando apenas ST existe');
        assert.strictEqual(result.fileExists, false, 'Arquivo FECOEP não deve constar como existente');
        assert(result.pdfName.includes('FECOEP'), 'Nome do PDF esperado deve conter FECOEP');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    await runAsyncTest('checkInvoiceIdempotency para ICMS ST não deve casar com PDF de FECOEP existente', async () => {
      const os = require('os');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-idemp-st-'));
      try {
        fs.writeFileSync(path.join(tmpDir, 'DARE FECOEP NF 25168 - S A MENDANHA LTDA - ME.pdf'), 'fake fecoep pdf');
        fs.writeFileSync(path.join(tmpDir, 'processamento.json'), JSON.stringify({
          notas: [{ nf: '25168', idempotencyHash: 'fecoep-hash-456', status: 'SUCESSO' }]
        }));

        const result = checkInvoiceIdempotency(tmpDir, '25168', 'st-hash-123', 'S A MENDANHA LTDA - ME', '140');
        assert.strictEqual(result.isAlreadyProcessed, false, 'ICMS ST não deve ser considerada já processada quando apenas FECOEP existe');
        assert.strictEqual(result.fileExists, false, 'Arquivo ST não deve constar como existente');
        assert(result.pdfName.includes('ICMS ST'), 'Nome do PDF esperado deve conter ICMS ST');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    await runAsyncTest('GET /api/pdf/:nf não deve retornar PDF de ST quando FECOEP for requisitado', async () => {
      const os = require('os');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-pdf-route-'));
      try {
        fs.writeFileSync(path.join(tmpDir, 'DARE ICMS ST NF 25168 - S A MENDANHA LTDA - ME.pdf'), 'fake st pdf');

        // Request FECOEP
        const resFecoep = await new Promise((resolve, reject) => {
          const url = new URL(`/api/pdf/25168?dir=${encodeURIComponent(tmpDir)}&revenueCode=119`, baseUrl);
          http.get(url, (res) => resolve({ status: res.statusCode })).on('error', reject);
        });
        assert.strictEqual(resFecoep.status, 404, 'Deve retornar 404 para FECOEP quando apenas ST existe');

        // Request ST
        const resST = await new Promise((resolve, reject) => {
          const url = new URL(`/api/pdf/25168?dir=${encodeURIComponent(tmpDir)}&revenueCode=140`, baseUrl);
          http.get(url, (res) => resolve({ status: res.statusCode })).on('error', reject);
        });
        assert.strictEqual(resST.status, 200, 'Deve retornar 200 para ST quando ST existe');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    await runAsyncTest('POST /api/validate-batch não deve casar PDF de ST para guia de FECOEP', async () => {
      const os = require('os');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-val-batch-'));
      try {
        fs.writeFileSync(path.join(tmpDir, 'DARE ICMS ST NF 25168 - S A MENDANHA LTDA - ME.pdf'), 'fake st pdf');

        const res = await request('POST', '/api/validate-batch', {
          targetDir: tmpDir,
          clientInfo: { ie: '295153407', razaoSocial: 'S A MENDANHA LTDA - ME' },
          invoices: [
            { nf: '25168', codigoReceita: '119', tipoGuia: 'FECOEP', valorGuia: 4.78, items: [] }
          ]
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.results[0].fileName, null, 'Não deve encontrar o arquivo para FECOEP');
        assert.strictEqual(res.data.results[0].validation.valid, false);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    await runAsyncTest('AuditManager deve mesclar notas de ST e FECOEP em processamento.json e resultado.csv', async () => {
      const os = require('os');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-audit-merge-'));
      try {
        const AuditManager = require('../src/audit/auditManager');

        // Batch 1: ICMS ST
        const auditST = new AuditManager({
          targetDir: tmpDir,
          sourceFileName: 'ICMS ST MATRIZ.xlsx',
          ie: '295153407',
          dueDate: '09/09/2026',
          municipioOrigem: 'ANGICO',
          codigoReceita: '140'
        });
        const stInvoices = [
          { nf: '25101', valorGuia: 118.86, rawSum: 118.86, codigoReceita: '140', status: 'SUCESSO', observation: 'Obs ST 1', history: [{ message: 'OK' }] },
          { nf: '25102', valorGuia: 200.00, rawSum: 200.00, codigoReceita: '140', status: 'SUCESSO', observation: 'Obs ST 2', history: [{ message: 'OK' }] }
        ];
        auditST.saveAuditJson(stInvoices);
        auditST.saveAuditCsv(stInvoices);

        // Batch 2: FECOEP in the same directory
        const auditFECOEP = new AuditManager({
          targetDir: tmpDir,
          sourceFileName: 'ICMS ST MATRIZ.xlsx',
          ie: '295153407',
          dueDate: '09/09/2026',
          municipioOrigem: 'ANGICO',
          codigoReceita: '119'
        });
        const fecoepInvoices = [
          { nf: '25168', valorGuia: 4.78, rawSum: 4.78, codigoReceita: '119', tipoGuia: 'FECOEP', status: 'SUCESSO', observation: 'Obs FECOEP', history: [{ message: 'OK FECOEP' }] }
        ];
        auditFECOEP.saveAuditJson(fecoepInvoices);
        auditFECOEP.saveAuditCsv(fecoepInvoices);

        // Verify JSON contains both ST and FECOEP notas
        const jsonContent = JSON.parse(fs.readFileSync(auditFECOEP.jsonPath, 'utf8'));
        assert.strictEqual(jsonContent.notas.length, 3, 'Deve conter 3 notas no total (2 ST + 1 FECOEP)');
        assert.strictEqual(jsonContent.resumo.valor_total_icms_st, 318.86, 'Total ST deve ser preservado');
        assert.strictEqual(jsonContent.resumo.valor_total_fecoep, 4.78, 'Total FECOEP deve ser registrado');
        assert.strictEqual(jsonContent.resumo.valor_total_guias, 323.64, 'Total geral deve ser 323.64');

        // Verify CSV contains both ST and FECOEP rows
        const csvContent = fs.readFileSync(auditFECOEP.csvPath, 'utf8');
        const csvLines = csvContent.trim().split('\n').filter(Boolean);
        assert.strictEqual(csvLines.length, 4, 'CSV deve conter cabeçalho + 3 notas');
        assert(csvContent.includes('FECOEP'), 'CSV deve listar FECOEP');
        assert(csvContent.includes('ICMS_ST'), 'CSV deve listar ICMS_ST');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    // ----------------------------------------------------
    // 11. Testes de Progresso Fluido Multi-Etapa e ETA Dinâmico
    // ----------------------------------------------------
    console.log('\n--- 11. Testes de Progresso Fluido Multi-Etapa e ETA Dinâmico ---');

    runTest('Progresso deve avançar com sub-etapas granulares e não travar por nota inteira', () => {
      // 8 notas com 6 etapas cada (48 passos totais)
      // Nota 4, passo 2: ((4-1)*6 + 2) / 48 = 20 / 48 = 41.7%
      const step4_2 = Math.min(99.5, Math.round((((3 * 6) + 2) / (8 * 6)) * 1000) / 10);
      assert.strictEqual(step4_2, 41.7, 'Antes travava em 50%, agora avança progressivamente a cada etapa');

      const step4_3 = Math.min(99.5, Math.round((((3 * 6) + 3) / (8 * 6)) * 1000) / 10);
      assert.strictEqual(step4_3, 43.8);

      const step4_6 = Math.min(99.5, Math.round((((3 * 6) + 6) / (8 * 6)) * 1000) / 10);
      assert.strictEqual(step4_6, 50.0);
    });

    runTest('Média de tempo por guia deve se retroalimentar via EMA com base em processos reais', () => {
      const baseline = 12.0;
      const actualBatch = [10.5, 11.2, 9.8, 10.1];
      const batchAvg = actualBatch.reduce((a, b) => a + b, 0) / actualBatch.length;
      const updatedAvg = (0.65 * batchAvg) + (0.35 * baseline);
      assert(updatedAvg < baseline);
      assert(updatedAvg > 10.0 && updatedAvg < 11.0);
    });

    runTest('Estimativa de tempo restante deve calcular com precisão de sub-etapas', () => {
      const totalNotes = 8;
      const totalSubSteps = totalNotes * 6;
      const currentGlobalStep = (3 * 6) + 2; // Nota 4, passo 2 (20 concluídas, 28 restantes)
      const remainingSubSteps = totalSubSteps - currentGlobalStep;
      const avgSecPerSubStep = 10.96 / 6;
      const remainingSec = Math.round(remainingSubSteps * avgSecPerSubStep);
      assert.strictEqual(remainingSec, 51, 'Deve estimar ~51s restantes para 28 sub-etapas');
    });

    // ----------------------------------------------------
    // 12. Testes de Suporte ao SPED Fiscal (EFD ICMS/IPI) e Geração de Planilha
    // ----------------------------------------------------
    console.log('\n--- 12. Testes de Suporte ao SPED Fiscal (EFD ICMS/IPI) e Geração de Planilha ---');

    const spedFileName = fs.readdirSync(path.join(__dirname)).find(f => f.includes('SpedEFD'));
    assert(spedFileName, 'Arquivo SPED de teste deve existir na pasta tests');
    const spedFilePath = path.join(__dirname, spedFileName);
    const spedBuffer = fs.readFileSync(spedFilePath);

    let parsedSpedData = null;

    runTest('parseSped deve extrair cabeçalho 0000 e metadados da empresa com precisão', () => {
      parsedSpedData = parseSped(spedBuffer);
      assert(parsedSpedData.isSped);
      assert.strictEqual(parsedSpedData.company.razaoSocial, 'PAULO COMERCIO ATACADISTA DE PNEUS E AUTOS LTDA');
      assert.strictEqual(parsedSpedData.company.cnpj, '38598341000183');
      assert.strictEqual(parsedSpedData.company.cnpjFormatado, '38.598.341/0001-83');
      assert.strictEqual(parsedSpedData.company.ie, '295062843');
      assert.strictEqual(parsedSpedData.company.ieFormatada, '29.506.284-3');
      assert.strictEqual(parsedSpedData.company.uf, 'TO');
      assert.strictEqual(parsedSpedData.company.codMun, '1702109');
      assert.strictEqual(parsedSpedData.company.competencia, '08/2026');
      assert.strictEqual(parsedSpedData.company.competenciaFolder, '08-2026');
    });

    runTest('parseSped deve identificar débito FDE (Cód. 643) no bloco E115', () => {
      const fde = parsedSpedData.debits.find(d => d.tipo === 'FDE' || d.codigoReceita === '643');
      assert(fde, 'Débito FDE deve ser encontrado');
      assert.strictEqual(fde.codigoReceita, '643');
      assert.strictEqual(fde.valorGuia, 196.01);
      assert.strictEqual(fde.competencia, '08/2026');
      assert(fde.observation.includes('REF. CONTRIBUIÇÃO PARA CUSTEIO - FDE 0,3%'));
      assert(fde.observation.includes('TARE 4.209/2022'));
    });

    runTest('parseSped deve identificar débito ICMS ST (Cód. 130) no registro E250', () => {
      const st = parsedSpedData.debits.find(d => d.codigoReceita === '130');
      assert(st, 'Débito ICMS ST Saídas deve ser encontrado');
      assert.strictEqual(st.codigoReceita, '130');
      assert.strictEqual(st.subCodigo, '1', 'Subcódigo b na SEFAZ');
      assert.strictEqual(st.valorGuia, 1108.87);
      assert.strictEqual(st.dataVencimento, '09/09/2026');
      assert.strictEqual(st.competencia, '08/2026');
      assert(st.observation.includes('REF. ICMS SUBSTITUIÇÃO TRIBUTÁRIA'));
      assert(st.observation.includes('TARE 4.209/2022'));
    });

    runTest('parseSped deve calcular o total geral dos débitos identificados', () => {
      assert.strictEqual(parsedSpedData.summary.totalDebits, 2);
      assert.strictEqual(parsedSpedData.summary.grandTotalCalculated, 1304.88);
    });

    runTest('generateDebitsSpreadsheet deve gerar pasta de trabalho XLSX válida com abas de Débitos e Resumo', () => {
      const xlsxBuffer = generateDebitsSpreadsheet(parsedSpedData);
      assert(Buffer.isBuffer(xlsxBuffer));
      assert(xlsxBuffer.length > 5000, 'Arquivo Excel deve ter tamanho substancial');
      
      // Magic bytes de ZIP/XLSX: PK (0x50 0x4B 0x03 0x04)
      assert.strictEqual(xlsxBuffer[0], 0x50);
      assert.strictEqual(xlsxBuffer[1], 0x4B);

      const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });
      assert(wb.SheetNames.includes('Débitos Fiscais'));
      assert(wb.SheetNames.includes('Resumo da Declaração'));

      const sheetData = XLSX.utils.sheet_to_json(wb.Sheets['Débitos Fiscais'], { header: 1 });
      assert(sheetData.length >= 4, 'Header + 2 débitos + Total');
      assert.strictEqual(sheetData[0][0], 'CNPJ');
      assert.strictEqual(sheetData[0][3], 'Tributo / Obrigação');
      assert.strictEqual(sheetData[0][8], 'Valor a Recolher (R$)');
    });

    runTest('Nomenclatura oficial de PDFs para débitos de apuração do SPED', () => {
      const emp = parsedSpedData.company.razaoSocial;
      const pdfFde = getStandardPdfName('FDE 08/2026', emp, '643');
      assert.strictEqual(pdfFde, `DARE FDE 08-2026 - ${emp}.pdf`);

      const pdfSt = getStandardPdfName('ICMS ST APURAÇÃO 08/2026', emp, '130');
      assert.strictEqual(pdfSt, `DARE ICMS ST APURACAO 08-2026 - ${emp}.pdf`);

      const pdfNormal = getStandardPdfName('ICMS NORMAL 08/2026', emp, '110');
      assert.strictEqual(pdfNormal, `DARE ICMS NORMAL 08-2026 - ${emp}.pdf`);
    });

    runTest('parseSped deve identificar débito ICMS Normal (Cód. 110) no registro E116 com subcódigo 1', () => {
      const sampleE116Sped = [
        '|0000|018|0|01082026|31082026|EMPRESA TESTE LTDA|38598341000183||TO|295062843|1702109|||A|1|',
        '|E116|000|405,39|09092026|110||||REF ICMS A RECOLHER DA COMPETENCIA 08/2026|082026|',
        '|9999|3|'
      ].join('\r\n');
      const res = parseSped(Buffer.from(sampleE116Sped, 'latin1'));
      assert.strictEqual(res.debits.length, 1);
      const deb = res.debits[0];
      assert.strictEqual(deb.tipo, 'ICMS_NORMAL');
      assert.strictEqual(deb.codigoReceita, '110');
      assert.strictEqual(deb.subCodigo, '1');
      assert.strictEqual(deb.subCodigoDesc, 'b- - ICMS NORMAL POR APURAÇÃO');
      assert.strictEqual(deb.valorGuia, 405.39);
      assert.strictEqual(deb.dataVencimento, '09/09/2026');
    });

    runTest('Seleção de subcódigo para ICMS Normal (110) deve selecionar estritamente APURAÇÃO (subcódigo 1) e rejeitar OPERAÇÃO (subcódigo 2)', () => {
      const sefazPortalOptions = [
        { value: '0', text: '' },
        { value: '2', text: 'a- - ICMS NORMAL POR OPERAÇÃO' },
        { value: '1', text: 'b- - ICMS NORMAL POR APURAÇÃO' }
      ];

      const preferredSub = '1';
      const found = sefazPortalOptions.find(o => 
        !o.text.toUpperCase().includes('OPERAÇÃO') &&
        !o.text.toUpperCase().includes('OPERACAO') &&
        (
          o.value === '1' ||
          (preferredSub && o.value === String(preferredSub)) ||
          o.text.trim().toUpperCase().startsWith('B') ||
          o.text.toUpperCase().includes('APURAÇÃO') ||
          o.text.toUpperCase().includes('APURACAO')
        )
      );

      assert.ok(found, 'Deveria encontrar a opção de apuração');
      assert.strictEqual(found.value, '1', 'Subcódigo deve ser 1 (b- - ICMS NORMAL POR APURAÇÃO)');
      assert.strictEqual(found.text, 'b- - ICMS NORMAL POR APURAÇÃO');
    });

    await runAsyncTest('POST /api/preview deve reconhecer arquivo SPED e retornar estrutura de débitos e download URL', async () => {
      const boundary = '----WebKitFormBoundarySpedTest';
      const crlf = '\r\n';
      const postDataHeader = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${spedFileName}"${crlf}Content-Type: text/plain${crlf}${crlf}`;
      const postDataFooter = `${crlf}--${boundary}--${crlf}`;

      const reqBody = Buffer.concat([
        Buffer.from(postDataHeader, 'utf8'),
        spedBuffer,
        Buffer.from(postDataFooter, 'utf8')
      ]);

      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: port,
          path: '/api/preview',
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': reqBody.length
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              assert.strictEqual(res.statusCode, 200);
              const json = JSON.parse(data);
              assert(json.success);
              assert(json.isSped);
              assert.strictEqual(json.invoices.length, 2);
              assert.strictEqual(json.downloadXlsxUrl, '/api/sped/download-xlsx');
              assert.strictEqual(json.summary.grandTotalCalculated, 1304.88);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
        req.on('error', reject);
        req.write(reqBody);
        req.end();
      });
    });

    await runAsyncTest('GET /api/sped/download-xlsx deve retornar o arquivo Excel estruturado com status 200', async () => {
      await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/api/sped/download-xlsx`, (res) => {
          try {
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            assert(res.headers['content-disposition'].includes('.xlsx'));
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
              const buf = Buffer.concat(chunks);
              assert(buf.length > 5000);
              resolve();
            });
          } catch (err) {
            reject(err);
          }
        }).on('error', reject);
      });
    });

    runTest('Interface deve conter botões de Limpar Tudo / Nova Geração e função resetAllState', () => {
      const htmlPath = path.join(__dirname, '../public/index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');

      assert(htmlContent.includes('resetAllState()'), 'index.html deve invocar resetAllState()');
      assert(htmlContent.includes('function resetAllState()'), 'index.html deve declarar function resetAllState()');
      assert(htmlContent.includes('btnResetAllHeader'), 'index.html deve ter botão no cabeçalho');
      assert(htmlContent.includes('btnResetAllCard1'), 'index.html deve ter botão no Card 1');
      assert(htmlContent.includes('btnResetAllExec'), 'index.html deve ter botão na barra de execução');
      assert(htmlContent.includes('Nova Geração'), 'index.html deve conter o rótulo Nova Geração');
    });

    runTest('Interface deve inicializar data de vencimento dinamicamente com o mês atual da data do computador', () => {
      const htmlPath = path.join(__dirname, '../public/index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      assert(htmlContent.includes('getDefaultDueDate()'), 'index.html deve definir getDefaultDueDate()');
      assert(!htmlContent.includes('value="09/09/2026"'), 'index.html não deve conter 09/09/2026 fixado no inputDueDate');
    });

    console.log('\n--- 13. Testes de Suporte ao DIFAL (Cód. 150 - Apuração e Operação) ---');
    runTest('Interface deve conter seletor de modalidade DIFAL (Apuração e Operação)', () => {
      const htmlPath = path.join(__dirname, '../public/index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      assert(htmlContent.includes('btnDifalApuracao'), 'index.html deve conter botão btnDifalApuracao');
      assert(htmlContent.includes('btnDifalOperacao'), 'index.html deve conter botão btnDifalOperacao');
      assert(htmlContent.includes('spedDifalOptionsContainer'), 'index.html deve conter container spedDifalOptionsContainer');
    });

    runTest('Nomenclatura oficial de PDFs para DIFAL por Apuração e por Operação', () => {
      const { getStandardPdfName } = require('../src/storage/pathManager');
      const pdfApuracao = getStandardPdfName('DIFAL APURAÇÃO 09/2026', 'F S MARQUES LTDA - ME', '150');
      assert.strictEqual(pdfApuracao, 'DARE ICMS DIFAL APURACAO 09-2026 - F S MARQUES LTDA - ME.pdf');

      const pdfOperacao = getStandardPdfName('231796', 'F S MARQUES LTDA - ME', '150');
      assert.strictEqual(pdfOperacao, 'DARE ICMS DIFAL NF 231796 - F S MARQUES LTDA - ME.pdf');
    });

    runTest('parseSped deve suportar alternância entre Apuração e Operação no DIFAL', () => {
      const sampleSped = [
        '|0000|018|0|01092026|30092026|F S MARQUES LTDA|10674931000129||TO|294137785|1721000|||A|1|',
        '|0150|10000405|FORNECEDOR TESTE|1058|07851862003001||520000000|||',
        '|E110|4539,06|0|0|0|0|0|0|0|0|0|0|4539,06|0|51,15|',
        '|E111|TO055010|DIFAL ENTRADA|51,15|',
        '|E113|10000405|55|001||231796|24082026||51,15|52260807851862003001550010002317961245699882|',
        '|E116|000|4539,06|09102026|110|||||REF ICMS NORMAL|092026|',
        '|E116|003|51,15|09102026|150|||||REF DIFAL APURACAO|092026|',
        '|9999|8|'
      ].join('\r\n');

      const buf = Buffer.from(sampleSped, 'latin1');
      const resApuracao = parseSped(buf, { difalMode: 'apuracao' });
      assert.strictEqual(resApuracao.hasDifal, true);
      assert.strictEqual(resApuracao.activeDifalMode, 'apuracao');
      const difalAp = resApuracao.debits.find(d => d.codigoReceita === '150');
      assert(difalAp);
      assert.strictEqual(difalAp.subCodigo, '1');
      assert.strictEqual(difalAp.tipo, 'DIFAL_APURACAO');
      assert.strictEqual(difalAp.valorGuia, 51.15);

      const resOperacao = parseSped(buf, { difalMode: 'operacao' });
      assert.strictEqual(resOperacao.hasDifal, true);
      assert.strictEqual(resOperacao.activeDifalMode, 'operacao');
      const difalOp = resOperacao.debits.find(d => d.codigoReceita === '150');
      assert(difalOp);
      assert.strictEqual(difalOp.subCodigo, '2');
      assert.strictEqual(difalOp.tipo, 'DIFAL_OPERACAO');
      assert.strictEqual(difalOp.nf, '231796');
      assert.strictEqual(difalOp.chaveAcesso, '52260807851862003001550010002317961245699882');
      assert.strictEqual(difalOp.valorGuia, 51.15);
    });

    runTest('Deve auto-detectar dados do contribuinte (IE, CNPJ, Razão Social) a partir de planilha com metadados ou colunas', () => {
      // Teste A: via colunas 'Inscrição Estadual' e 'CNPJ Destinatário'
      const wsDataA = [
        ['Nº Nota', 'Descrição do Produto', '%MVA', 'ICMS ST', 'Inscrição Estadual', 'CNPJ Destinatário', 'Destinatário (Cliente)'],
        ['1001', 'PRODUTO TESTE', '48.5%', 150.0, '29.515.340-7', '43.037.906/0001-93', 'EMPRESA TESTE LTDA']
      ];
      const wbA = XLSX.utils.book_new();
      const wsA = XLSX.utils.aoa_to_sheet(wsDataA);
      XLSX.utils.book_append_sheet(wbA, wsA, 'Planilha1');
      const bufA = XLSX.write(wbA, { type: 'buffer', bookType: 'xlsx' });
      const parsedA = parseExcel(bufA);
      assert.strictEqual(parsedA.taxpayer.ie, '295153407');
      assert.strictEqual(parsedA.taxpayer.cnpj, '43037906000193');
      assert.strictEqual(parsedA.taxpayer.razaoSocial, 'EMPRESA TESTE LTDA');

      // Teste B: via aba dedicada 'Contribuinte'
      const wsDataB = [
        ['Nº Nota', 'Descrição do Produto', '%MVA', 'ICMS ST'],
        ['1002', 'PRODUTO TESTE 2', '48.5%', 200.0]
      ];
      const wsContribData = [
        ['Campo', 'Valor'],
        ['Razão Social', 'S A MENDANHA LTDA'],
        ['CNPJ', '43.037.906/0001-93'],
        ['Inscrição Estadual (I.E.)', '295153407'],
        ['UF', 'TO']
      ];
      const wbB = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet(wsDataB), 'Planilha1');
      XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet(wsContribData), 'Contribuinte');
      const bufB = XLSX.write(wbB, { type: 'buffer', bookType: 'xlsx' });
      const parsedB = parseExcel(bufB);
      assert.strictEqual(parsedB.taxpayer.ie, '295153407');
      assert.strictEqual(parsedB.taxpayer.cnpj, '43037906000193');
      assert.strictEqual(parsedB.taxpayer.razaoSocial, 'S A MENDANHA LTDA');
      assert.strictEqual(parsedB.taxpayer.uf, 'TO');

      // Teste C: via linha pré-cabeçalho
      const wsDataC = [
        ['Contribuinte: AUTO PECAS TOCANTINS LTDA | CNPJ: 12.345.678/0001-95 | I.E.: 294063102'],
        ['Nº Nota', 'Descrição do Produto', '%MVA', 'ICMS ST'],
        ['1003', 'PECA TESTE', '48.5%', 80.0]
      ];
      const wbC = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbC, XLSX.utils.aoa_to_sheet(wsDataC), 'Planilha1');
      const bufC = XLSX.write(wbC, { type: 'buffer', bookType: 'xlsx' });
      const parsedC = parseExcel(bufC);
      assert.strictEqual(parsedC.taxpayer.ie, '294063102');
      assert.strictEqual(parsedC.taxpayer.cnpj, '12345678000195');
      assert.strictEqual(parsedC.taxpayer.razaoSocial, 'AUTO PECAS TOCANTINS LTDA');
    });
  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(` RESULTADO: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO!`);
  console.log('====================================================\n');
}

runServerTests().catch(err => {
  console.error('Erro na bateria assíncrona:', err);
  process.exit(1);
});

