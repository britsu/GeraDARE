const fs = require('fs');
const path = require('path');
const { parseSped } = require('../src/parser/spedParser');
const { resolveBatchDirectory, getStandardPdfName } = require('../src/storage/pathManager');

async function run() {
  console.log('=== TESTE DE VALIDAÇÃO DIFAL NO SPED FISCAL ===');
  const spedPath = 'Z:\\TROCA GVX\\CLIENTES\\F S MARQUES LTDA\\FISCAL\\OBRIGAÇÕES ACESSÓRIAS\\SPED FISCAL\\2026\\2026-09\\SpedEFD-10674931000129-294137785-Remessa de arquivo original-set.2026.txt';
  
  if (!fs.existsSync(spedPath)) {
    console.error('Arquivo SPED não encontrado:', spedPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(spedPath);

  // 1. Test Apuracao Mode
  console.log('\n--- 1. Testando Modo: DIFAL POR APURAÇÃO ---');
  const spedApuracao = parseSped(buffer, { difalMode: 'apuracao' });
  console.log('Empresa:', spedApuracao.company.razaoSocial, '| IE:', spedApuracao.company.ie, '| CNPJ:', spedApuracao.company.cnpj);
  console.log('Competência:', spedApuracao.company.competencia);
  console.log('Débitos encontrados:', spedApuracao.debits.length);
  spedApuracao.debits.forEach(d => {
    console.log(`- [${d.registroOrigem}] Cód: ${d.codigoReceita} (Subcód: ${d.subCodigo}) | Tipo: ${d.tipo} | NF/Identificador: ${d.nf} | Valor: R$ ${d.valorGuia.toFixed(2)} | Obs: ${d.observation}`);
    const pdfName = getStandardPdfName(d.nf, spedApuracao.company.razaoSocial, d.codigoReceita);
    console.log(`  -> Nome do PDF: "${pdfName}"`);
  });

  // Verify assertions for apuração
  const difalApDebit = spedApuracao.debits.find(d => d.codigoReceita === '150');
  if (!difalApDebit) throw new Error('Débito DIFAL Cód. 150 não encontrado no modo apuração!');
  if (difalApDebit.subCodigo !== '1') throw new Error(`Subcódigo incorreto para apuração: ${difalApDebit.subCodigo} (esperado: 1)`);
  if (difalApDebit.tipo !== 'DIFAL_APURACAO') throw new Error(`Tipo incorreto: ${difalApDebit.tipo}`);
  console.log('✓ Modo Apuração validado com sucesso!');

  // 2. Test Operacao Mode
  console.log('\n--- 2. Testando Modo: DIFAL POR OPERAÇÃO ---');
  const spedOperacao = parseSped(buffer, { difalMode: 'operacao' });
  console.log('Débitos encontrados:', spedOperacao.debits.length);
  spedOperacao.debits.forEach(d => {
    console.log(`- [${d.registroOrigem}] Cód: ${d.codigoReceita} (Subcód: ${d.subCodigo}) | Tipo: ${d.tipo} | NF/Identificador: ${d.nf} | Fornecedor: ${d.destinatario} | Chave: ${d.chaveAcesso} | Valor: R$ ${d.valorGuia.toFixed(2)}`);
    const pdfName = getStandardPdfName(d.nf, spedOperacao.company.razaoSocial, d.codigoReceita);
    console.log(`  -> Nome do PDF: "${pdfName}"`);
  });

  const difalOpDebit = spedOperacao.debits.find(d => d.codigoReceita === '150');
  if (!difalOpDebit) throw new Error('Débito DIFAL Cód. 150 não encontrado no modo operação!');
  if (difalOpDebit.subCodigo !== '2') throw new Error(`Subcódigo incorreto para operação: ${difalOpDebit.subCodigo} (esperado: 2)`);
  if (difalOpDebit.tipo !== 'DIFAL_OPERACAO') throw new Error(`Tipo incorreto: ${difalOpDebit.tipo}`);
  if (difalOpDebit.nf !== '231796') throw new Error(`Número da NF incorreto: ${difalOpDebit.nf} (esperado: 231796)`);
  if (!difalOpDebit.chaveAcesso || difalOpDebit.chaveAcesso.length !== 44) throw new Error(`Chave de acesso inválida ou ausente: ${difalOpDebit.chaveAcesso}`);
  console.log('✓ Modo Operação validado com sucesso!');

  // 3. Test Directory Resolution
  console.log('\n--- 3. Testando Resolução de Diretório ---');
  const dir = resolveBatchDirectory({
    baseDir: 'Z:\\DOCUMENTOS TEMPORÁRIOS\\LUIS HENRICK\\DARE',
    competenceMonthYear: '09-2026',
    razaoSocial: spedApuracao.company.razaoSocial,
    cnpj: spedApuracao.company.cnpj,
    createIfMissing: false
  });
  console.log('Diretório resolvido:', dir.targetPath);
  console.log('✓ Resolução de diretório validada com sucesso!');

  console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
}

run().catch(err => {
  console.error('FALHA NO TESTE:', err);
  process.exit(1);
});
