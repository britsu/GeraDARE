const path = require('path');
const fs = require('fs');
const { parseExcel } = require('../src/parser/excelParser');
const { groupInvoices } = require('../src/engine/grouper');
const { analyzeDueDate } = require('../src/utils/calendar');
const SefazClient = require('../src/portal/sefazClient');
const batchWorker = require('../src/worker/batchWorker');
const config = require('../src/config');

async function testDryRun() {
  console.log('=== TESTANDO LOTE EM MODO DRY-RUN ===');

  // 1. Parse Excel
  const excelPath = path.join(__dirname, '..', 'ICMS ST.xlsx');
  const parsed = parseExcel(excelPath);
  console.log(`Planilha lida: ${parsed.totalItems} itens válidos.`);

  // 2. Group Invoices
  const dueDateInfo = analyzeDueDate('09/09/2026');
  const ie = '29.515.340-7';
  const grouped = groupInvoices(parsed.items, ie, dueDateInfo.dateStr, config.defaultRevenueCode);
  console.log(`Agrupadas: ${grouped.totalInvoices} notas. Total ICMS ST: R$ ${grouped.grandTotalCalculated.toFixed(2)}`);

  // 3. Consult IE on SEFAZ
  console.log('Consultando IE na SEFAZ...');
  const sefaz = new SefazClient({ headless: true });
  const clientInfo = await sefaz.consultIE(ie);
  await sefaz.close();
  console.log(`Contribuinte: ${clientInfo.razaoSocial} | Município: ${clientInfo.nomeMunOrigem} (${clientInfo.codMunOrigem})`);

  // Test with first 2 invoices for fast verification
  const testGrouped = {
    ...grouped,
    invoices: grouped.invoices.slice(0, 2)
  };

  // Listen to events
  batchWorker.on('log', e => console.log(`[WORKER LOG] ${e.message}`));
  batchWorker.on('progress', p => console.log(`[PROGRESS] ${p.current}/${p.total} (${p.percentage}%) - NF ${p.currentNF}`));

  return new Promise((resolve, reject) => {
    batchWorker.on('batchCompleted', (res) => {
      console.log('\n=== LOTE CONCLUÍDO COM SUCESSO! ===');
      console.log('Diretório do lote:', res.batchDir);
      console.log('Arquivo JSON:', res.jsonPath);
      console.log('Arquivo CSV:', res.csvPath);

      if (fs.existsSync(res.jsonPath) && fs.existsSync(res.csvPath)) {
        console.log('Arquivos de auditoria gerados e confirmados!');
        const jsonContent = JSON.parse(fs.readFileSync(res.jsonPath, 'utf8'));
        console.log('Resumo do processamento:', JSON.stringify(jsonContent.resumo, null, 2));
      }
      resolve(res);
    });

    batchWorker.on('batchError', (err) => {
      reject(err);
    });

    batchWorker.startBatch({
      clientInfo,
      groupedData: testGrouped,
      dueDateInfo,
      mode: 'dry-run',
      baseOutputDir: config.defaultOutputDir
    });
  });
}

testDryRun().catch(err => {
  console.error('Erro no teste de lote:', err);
  process.exit(1);
});
