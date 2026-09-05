const { parseExcel } = require('./src/parser/excelParser');
const { groupInvoices } = require('./src/engine/grouper');
const { analyzeDueDate } = require('./src/utils/calendar');
const { batchWorker } = require('./src/worker/batchWorker');
const { SefazClient } = require('./src/portal/sefazClient');
const path = require('path');
const fs = require('fs');

async function runEmissionBatch() {
  console.log('================================================================');
  console.log(' GERADARE - EMISSÃO OFICIAL E DOWNLOAD DE PDFS (SEFAZ/TO)');
  console.log('================================================================');

  const excelPath = path.join(__dirname, 'ICMS ST.xlsx');
  const ie = process.argv[2] || '';
  const dataVencimento = process.argv[3] || '09/09/2026';
  const targetDir = process.argv[4] || null;

  if (!ie) {
    console.error('ERRO: Nenhuma Inscrição Estadual informada por padrão para evitar conflito com a empresa errada.');
    console.error('USO: node emit_all_dares.js <IE_SEFAZ> [DATA_VENCIMENTO] [PASTA_DESTINO]');
    console.error('Exemplos:');
    console.error('  Filial: node emit_all_dares.js 295613181 09/09/2026');
    console.error('  Matriz: node emit_all_dares.js 295153407 09/09/2026');
    process.exit(1);
  }

  console.log(`Planilha: ${excelPath}`);
  console.log(`Inscrição Estadual: ${ie}`);
  console.log(`Data de Vencimento: ${dataVencimento}`);
  console.log(`Diretório de Destino: ${targetDir || 'Calculado dinamicamente conforme empresa'}`);

  // 1. Validar e analisar data
  const dateAnalysis = analyzeDueDate(dataVencimento);
  console.log(`Competência calculada: ${dateAnalysis.competencia} (1 mês antes do vencimento)`);

  // 2. Parsear planilha
  const parsed = parseExcel(excelPath);
  console.log(`Itens válidos na planilha: ${parsed.totalItems}`);

  // 3. Agrupar notas
  const grouped = groupInvoices(parsed.items, ie, dateAnalysis.dateStr);
  console.log(`Total de notas para emissão: ${grouped.totalInvoices}. Total ST: R$ ${grouped.grandTotalCalculated.toFixed(2)}`);

  // 4. Consultar contribuinte
  console.log('Consultando contribuinte na SEFAZ...');
  const sefaz = new SefazClient({ headless: true });
  const clientInfo = await sefaz.consultIE(ie);
  await sefaz.close();
  console.log(`Contribuinte: ${clientInfo.razaoSocial} | Município: ${clientInfo.nomeMunOrigem}`);

  // 5. Configurar listeners de progresso
  batchWorker.on('log', entry => {
    console.log(`[LOG] ${entry.message}`);
  });

  batchWorker.on('progress', data => {
    console.log(`>>> Progresso: ${data.processed}/${data.total} (${data.percent}%) - NF ${data.currentNF}`);
  });

  batchWorker.on('step', step => {
    console.log(`   [ETAPA ${step.index}/${step.total}] NF ${step.nf}: ${step.label}`);
  });

  batchWorker.on('invoiceUpdated', inv => {
    if (inv.status === 'SUCESSO') {
      console.log(`*** [SUCESSO] NF ${inv.nf} EMITIDA! Arquivo: ${inv.arquivoFinal} ***`);
    } else if (inv.status === 'JA_PROCESSADA') {
      console.log(`*** [JÁ PROCESSADA] NF ${inv.nf} já existe na pasta: ${inv.arquivoFinal} ***`);
    }
  });

  // 6. Iniciar lote oficial de emissão com overridePath para a pasta (2)
  console.log('\nIniciando emissão em modo "emitir-lote-aprovado"...');
  await batchWorker.startBatch({
    clientInfo,
    groupedData: grouped,
    dueDateInfo: dateAnalysis,
    mode: 'emitir-lote-aprovado',
    overridePath: targetDir
  });

  console.log('\n================================================================');
  console.log(' LOTE DE EMISSÃO FINALIZADO COM SUCESSO!');
  console.log(` Arquivos salvos em: ${targetDir}`);
  console.log('================================================================');

  // List all files in target folder
  if (fs.existsSync(targetDir)) {
    const files = fs.readdirSync(targetDir);
    console.log(`\nArquivos encontrados em ${targetDir}:`);
    files.forEach(f => {
      const stats = fs.statSync(path.join(targetDir, f));
      console.log(` - ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
    });
  }
}

runEmissionBatch().catch(err => {
  console.error('Erro na emissão do lote:', err);
  process.exit(1);
});
