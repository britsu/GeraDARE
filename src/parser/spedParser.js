const XLSX = require('xlsx');
const config = require('../config');

/**
 * Formats CNPJ: 38598341000183 -> 38.598.341/0001-83
 */
function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formats IE: 295062843 -> 29.506.284-3
 */
function formatIE(ie) {
  if (!ie) return '';
  const clean = ie.replace(/\D/g, '');
  if (clean.length === 9) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{1})$/, '$1.$2.$3-$4');
  }
  return ie;
}

/**
 * Parses BRL number string: '196,01' -> 196.01
 */
function parseBRL(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = val.toString().trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Formats date from SPED DDMMYYYY to DD/MM/YYYY
 */
function formatSpedDate(d) {
  if (!d) return '';
  const clean = d.toString().replace(/\D/g, '');
  if (clean.length === 8) {
    return `${clean.substring(0, 2)}/${clean.substring(2, 4)}/${clean.substring(4, 8)}`;
  }
  return d;
}

/**
 * Formats competence from SPED MMYYYY to MM/YYYY
 */
function formatSpedCompetence(c) {
  if (!c) return '';
  const clean = c.toString().replace(/\D/g, '');
  if (clean.length === 6) {
    return `${clean.substring(0, 2)}/${clean.substring(2, 6)}`;
  }
  return c;
}

/**
 * Parses SPED EFD ICMS/IPI text file.
 * Extracts:
 * - Header 0000: Company metadata, CNPJ, IE, Competence
 * - E115: Incentives, FDE (Cód. 643)
 * - E250: ICMS ST Debts (Cód. 130 / Subcódigo b)
 * - E116: ICMS Normal Debts (if present)
 */
function parseSped(fileBufferOrContent) {
  let content = '';
  if (Buffer.isBuffer(fileBufferOrContent)) {
    // Try utf8 first, if replacement chars exist or latin1 chars present, handle cleanly
    content = fileBufferOrContent.toString('latin1');
  } else {
    content = String(fileBufferOrContent);
  }

  const lines = content.split(/\r?\n/);
  
  let company = {
    razaoSocial: '',
    cnpj: '',
    cnpjFormatado: '',
    ie: '',
    ieFormatada: '',
    uf: 'TO',
    codMun: '',
    dtIni: '',
    dtFin: '',
    competencia: '',
    competenciaFolder: ''
  };

  const debits = [];
  let defaultDueDate = '';

  // First pass: extract 0000 header and find default due dates
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    const parts = line.split('|');
    const reg = parts[1];

    if (reg === '0000') {
      // |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|CPF|UF|IE|COD_MUN|IM|SUFRAMA|IND_PERFIL|IND_ATIV|
      const dtIniRaw = parts[4] || '';
      const dtFinRaw = parts[5] || '';
      const nome = (parts[6] || '').trim();
      const cnpjRaw = (parts[7] || '').trim();
      const uf = (parts[9] || 'TO').trim();
      const ieRaw = (parts[10] || '').trim();
      const codMun = (parts[11] || '').trim();

      let comp = '';
      if (dtFinRaw.length === 8) {
        comp = `${dtFinRaw.substring(2, 4)}/${dtFinRaw.substring(4, 8)}`;
      } else if (dtIniRaw.length === 8) {
        comp = `${dtIniRaw.substring(2, 4)}/${dtIniRaw.substring(4, 8)}`;
      }

      company = {
        razaoSocial: nome,
        cnpj: cnpjRaw,
        cnpjFormatado: formatCNPJ(cnpjRaw),
        ie: ieRaw.replace(/\D/g, ''),
        ieFormatada: formatIE(ieRaw),
        uf,
        codMun,
        dtIni: formatSpedDate(dtIniRaw),
        dtFin: formatSpedDate(dtFinRaw),
        competencia: comp,
        competenciaFolder: comp ? comp.replace('/', '-') : ''
      };
    } else if (reg === 'E250') {
      // Look for due date in E250 to reuse for FDE if needed
      const dtVctoRaw = parts[4] || '';
      if (dtVctoRaw && !defaultDueDate) {
        defaultDueDate = formatSpedDate(dtVctoRaw);
      }
    } else if (reg === 'E116') {
      const dtVctoRaw = parts[4] || '';
      if (dtVctoRaw && !defaultDueDate) {
        defaultDueDate = formatSpedDate(dtVctoRaw);
      }
    }
  }

  // Fallback due date if not found in registers (09 of next month)
  if (!defaultDueDate && company.competencia) {
    const [mes, ano] = company.competencia.split('/').map(Number);
    let nextMonth = mes + 1;
    let nextYear = ano;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    defaultDueDate = `09/${String(nextMonth).padStart(2, '0')}/${nextYear}`;
  }

  // Second pass: extract debts
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    const parts = line.split('|');
    const reg = parts[1];

    // 1. E115: Informações Adicionais da Apuração - FDE (Cód. 643)
    if (reg === 'E115') {
      // |E115|COD_INF_ADIC|VL_INF_ADIC|DESCR_COMPL_AJ|
      const codInfAdic = (parts[2] || '').trim();
      const valRaw = parts[3] || '0';
      const descr = (parts[4] || '').trim();
      const valor = parseBRL(valRaw);

      const isFde = codInfAdic.toUpperCase().includes('TO45') ||
                    descr.toUpperCase().includes('FDE') ||
                    descr.toUpperCase().includes('CUSTEIO');

      if (isFde && valor > 0) {
        debits.push({
          id: `FDE-${company.competenciaFolder || 'SPED'}`,
          nf: `FDE ${company.competencia || ''}`.trim(),
          tipo: 'FDE',
          tributo: 'FDE - Fundo de Desenvolvimento Econômico',
          codigoReceita: '643',
          codigoReceitaDesc: config.revenueCodes['643']?.description || 'FUNDO DE DESENVOLVIMENTO ECONÔMICO',
          subCodigo: '0',
          subCodigoDesc: 'Sem subcódigo',
          documentType: 'OUTROS A ESPECIFICAR',
          documentTypeValue: '5',
          competencia: company.competencia,
          competenciaFolder: company.competenciaFolder,
          dataVencimento: defaultDueDate,
          valorGuia: valor,
          valor: valor,
          valorFormatado: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          observation: descr,
          registroOrigem: 'E115',
          codigoAjuste: codInfAdic,
          razaoSocial: company.razaoSocial,
          destinatario: company.razaoSocial,
          cnpj: company.cnpj,
          ie: company.ie
        });
      }
    }

    // 2. E250: Obrigações do ICMS ST a Recolher (Cód. 130)
    if (reg === 'E250') {
      // |E250|COD_OR|VL_OR|DT_VCTO|COD_REC|NUM_PROC|IND_PROC|PROC|TXT_COMPL|MES_REF|
      const codOr = (parts[2] || '').trim();
      const valRaw = parts[3] || '0';
      const dtVctoRaw = (parts[4] || '').trim();
      const rawCodRecE250 = (parts[5] || '').trim();
      const codRec = (['130', '002'].includes(rawCodRecE250)) ? rawCodRecE250 : '130';
      const txtCompl = (parts[9] || '').trim();
      const mesRefRaw = (parts[10] || '').trim();

      const valor = parseBRL(valRaw);
      const vcto = formatSpedDate(dtVctoRaw) || defaultDueDate;
      const comp = formatSpedCompetence(mesRefRaw) || company.competencia;

      debits.push({
        id: `ST-APURACAO-${company.competenciaFolder || 'SPED'}`,
        nf: `ICMS ST APURAÇÃO ${comp}`.trim(),
        tipo: 'ICMS_ST_APURACAO',
        tributo: 'ICMS ST - Saídas Internas por Apuração',
        codigoReceita: codRec || '130',
        codigoReceitaDesc: config.revenueCodes[codRec]?.description || 'ICMS SUBSTITUIÇÃO SAÍDA - OPERAÇÕES INTERNAS',
        subCodigo: '1', // 'b - ICMS SUBSTITUIÇÃO TRIB. SAIDAS INTERNAS POR APURAÇÃO'
        subCodigoDesc: 'b - ICMS SUBSTITUIÇÃO TRIB. SAIDAS INTERNAS POR APURAÇÃO',
        documentType: 'OUTROS A ESPECIFICAR',
        documentTypeValue: '5',
        competencia: comp,
        competenciaFolder: comp.replace('/', '-'),
        dataVencimento: vcto,
        valorGuia: valor,
        valor: valor,
        valorFormatado: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        observation: txtCompl,
        registroOrigem: 'E250',
        codigoObrigacao: codOr,
        razaoSocial: company.razaoSocial,
        destinatario: company.razaoSocial,
        cnpj: company.cnpj,
        ie: company.ie
      });
    }

    // 3. E116: Obrigações do ICMS recolhido ou a recolher - Operações Próprias
    if (reg === 'E116') {
      // |E116|COD_OR|VL_OR|DT_VCTO|COD_REC|NUM_PROC|IND_PROC|PROC|TXT_COMPL|MES_REF|
      const codOr = (parts[2] || '').trim();
      const valRaw = parts[3] || '0';
      const dtVctoRaw = (parts[4] || '').trim();
      const rawCodRec = (parts[5] || '').trim();
      const codRec = (rawCodRec && rawCodRec !== '000' && rawCodRec !== '101') ? rawCodRec : '110';
      const txtCompl = (parts[9] || '').trim();
      const mesRefRaw = (parts[10] || '').trim();

      const valor = parseBRL(valRaw);
      if (valor > 0) {
        const vcto = formatSpedDate(dtVctoRaw) || defaultDueDate;
        const comp = formatSpedCompetence(mesRefRaw) || company.competencia;

        debits.push({
          id: `ICMS-NORMAL-${company.competenciaFolder || 'SPED'}`,
          nf: `ICMS NORMAL ${comp}`.trim(),
          tipo: 'ICMS_NORMAL',
          tributo: 'ICMS - Operações Próprias por Apuração',
          codigoReceita: codRec,
          codigoReceitaDesc: config.revenueCodes[codRec]?.description || 'ICMS NORMAL - OPERAÇÕES PRÓPRIAS POR APURAÇÃO',
          subCodigo: '1', // 'b- - ICMS NORMAL POR APURAÇÃO'
          subCodigoDesc: 'b- - ICMS NORMAL POR APURAÇÃO',
          documentType: 'OUTROS A ESPECIFICAR',
          documentTypeValue: '5',
          competencia: comp,
          competenciaFolder: comp.replace('/', '-'),
          dataVencimento: vcto,
          valorGuia: valor,
          valor: valor,
          valorFormatado: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          observation: txtCompl,
          registroOrigem: 'E116',
          codigoObrigacao: codOr,
          razaoSocial: company.razaoSocial,
          destinatario: company.razaoSocial,
          cnpj: company.cnpj,
          ie: company.ie
        });
      }
    }
  }

  const grandTotal = Math.round(debits.reduce((sum, d) => sum + d.valorGuia, 0) * 100) / 100;

  return {
    isSped: true,
    company,
    debits,
    summary: {
      totalDebits: debits.length,
      grandTotalCalculated: grandTotal,
      grandTotalRaw: grandTotal,
      defaultDueDate,
      competencia: company.competencia
    }
  };
}

/**
 * Generates an Excel spreadsheet (.xlsx) from parsed SPED debts data.
 * Returns a Buffer ready for download or saving.
 */
function generateDebitsSpreadsheet(spedResult) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Débitos Fiscais
  const headers = [
    'CNPJ',
    'Inscrição Estadual',
    'Razão Social',
    'Tributo / Obrigação',
    'Código Receita SEFAZ',
    'Subcódigo',
    'Competência',
    'Data de Vencimento',
    'Valor a Recolher (R$)',
    'Registro SPED',
    'Informações Complementares / Fundamentação Legal'
  ];

  const rows = spedResult.debits.map(d => [
    spedResult.company.cnpjFormatado || spedResult.company.cnpj,
    spedResult.company.ieFormatada || spedResult.company.ie,
    spedResult.company.razaoSocial,
    d.tributo,
    d.codigoReceita,
    d.subCodigoDesc || d.subCodigo,
    d.competencia,
    d.dataVencimento,
    d.valorGuia,
    d.registroOrigem,
    d.observation
  ]);

  // Append Total row
  rows.push([
    '',
    '',
    '',
    'TOTAL GERAL A RECOLHER',
    '',
    '',
    '',
    '',
    spedResult.summary.grandTotalCalculated,
    '',
    ''
  ]);

  const wsData = [headers, ...rows];
  const wsDebits = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  wsDebits['!cols'] = [
    { wch: 20 }, // CNPJ
    { wch: 16 }, // IE
    { wch: 45 }, // Razão Social
    { wch: 35 }, // Tributo
    { wch: 22 }, // Cód Receita
    { wch: 30 }, // Subcódigo
    { wch: 14 }, // Competência
    { wch: 18 }, // Vencimento
    { wch: 22 }, // Valor
    { wch: 15 }, // Registro
    { wch: 75 }  // Informações Complementares
  ];

  XLSX.utils.book_append_sheet(wb, wsDebits, 'Débitos Fiscais');

  // 2. Sheet: Resumo SPED
  const wsSummaryData = [
    ['CAMPO', 'VALOR'],
    ['Razão Social', spedResult.company.razaoSocial],
    ['CNPJ', spedResult.company.cnpjFormatado || spedResult.company.cnpj],
    ['Inscrição Estadual', spedResult.company.ieFormatada || spedResult.company.ie],
    ['UF', spedResult.company.uf],
    ['Código IBGE Município', spedResult.company.codMun],
    ['Período Inicial (DT_INI)', spedResult.company.dtIni],
    ['Período Final (DT_FIN)', spedResult.company.dtFin],
    ['Competência Fiscal', spedResult.company.competencia],
    ['Data Vencimento Padrão', spedResult.summary.defaultDueDate],
    ['Quantidade de Débitos Identificados', spedResult.summary.totalDebits],
    ['Total Geral Apurado (R$)', spedResult.summary.grandTotalCalculated],
    ['Data de Geração pelo GeraDARE', new Date().toLocaleString('pt-BR')]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(wsSummaryData);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo da Declaração');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  parseSped,
  generateDebitsSpreadsheet,
  formatCNPJ,
  formatIE,
  parseBRL,
  formatSpedDate,
  formatSpedCompetence
};
