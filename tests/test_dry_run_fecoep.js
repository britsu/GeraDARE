const path = require('path');
const fs = require('fs');
const os = require('os');
const { parseExcel } = require('../src/parser/excelParser');
const { groupInvoices } = require('../src/engine/grouper');
const { analyzeDueDate } = require('../src/utils/calendar');
const SefazClient = require('../src/portal/sefazClient');
const batchWorker = require('../src/worker/batchWorker');

async function testDryRunFecoep() {
  console.log('=== TESTANDO LOTE FECOEP EM MODO DRY-RUN ===');

  const excelPath = path.join(__dirname, '..', 'ICMS ST MATRIZ.xlsx');
  const parsed = parseExcel(excelPath);
  console.log(`Planilha lida: ${parsed.totalItems} itens, hasFecoep: ${parsed.hasFecoepItems}`);

  const dueDateInfo = analyzeDueDate('09/09/2026');
  const ie = '29.515.340-7';
  const groupedFecoep = groupInvoices(parsed.items, ie, dueDateInfo.dateStr, '119');
  console.log(`Notas FECOEP agrupadas: ${groupedFecoep.totalInvoices}. Total FECOEP: R$ ${groupedFecoep.grandTotalCalculated.toFixed(2)}`);

  console.log('Consultando IE na SEFAZ...');
  const sefaz = new SefazClient({ headless: true });
  const clientInfo = await sefaz.consultIE(ie);
  await sefaz.close();
  console.log(`Contribuinte: ${clientInfo.razaoSocial} | Município: ${clientInfo.nomeMunOrigem}`);

  // Test with first invoice for quick dry-run
  const testGrouped = {
    ...groupedFecoep,
    invoices: groupedFecoep.invoices.slice(0, 1)
  };

  const tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geradare-fecoep-dry-'));

  return new Promise((resolve, reject) => {
    batchWorker.on('log', e => console.log(`[FECOEP LOG] ${e.message}`));
    batchWorker.on('progress', p => console.log(`[FECOEP PROGRESS] ${p.current}/${p.total} - NF ${p.currentNF}`));

    batchWorker.on('batchCompleted', (res) => {
      console.log('\n=== LOTE FECOEP CONCLUÍDO COM SUCESSO! ===');
      console.log('Diretório:', res.batchDir);
      console.log('JSON:', res.jsonPath);
      console.log('CSV:', res.csvPath);

      if (fs.existsSync(res.jsonPath) && fs.existsSync(res.csvPath)) {
        const jsonContent = JSON.parse(fs.readFileSync(res.jsonPath, 'utf8'));
        console.log('Resumo FECOEP:', JSON.stringify(jsonContent.resumo, null, 2));
        fs.rmSync(tmpOutputDir, { recursive: true, force: true });
        resolve(res);
      } else {
        reject(new Error('Arquivos de auditoria não foram gerados'));
      }
    });

    batchWorker.on('batchError', (err) => {
      reject(err);
    });

    batchWorker.startBatch({
      clientInfo,
      groupedData: testGrouped,
      dueDateInfo,
      mode: 'dry-run',
      baseOutputDir: tmpOutputDir
    });
  });
}

testDryRunFecoep().catch(err => {
  console.error('Erro no teste dry-run FECOEP:', err);
  process.exit(1);
});
