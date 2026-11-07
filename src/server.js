const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

const config = require('./config');
const { parseExcel } = require('./parser/excelParser');
const { parseSped, generateDebitsSpreadsheet } = require('./parser/spedParser');
const { groupInvoices, computeIdempotencyHash } = require('./engine/grouper');
const { analyzeDueDate, getDefaultDueDate } = require('./utils/calendar');
const SefazClient = require('./portal/sefazClient');
const batchWorker = require('./worker/batchWorker');
const { resolveBatchDirectory, sanitizeFileName } = require('./storage/pathManager');
const { validateDareAgainstInvoice } = require('./audit/dareValidator');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Multer in-memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Server-Sent Events clients for live streaming
let sseClients = [];
let lastGeneratedSpedExcel = null;

function sendSseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

// Connect batchWorker events to SSE
batchWorker.on('log', entry => sendSseEvent('log', entry));
batchWorker.on('progress', data => sendSseEvent('progress', data));
batchWorker.on('status', status => sendSseEvent('status', status));
batchWorker.on('step', step => sendSseEvent('step', step));
batchWorker.on('batchStarted', data => sendSseEvent('batchStarted', data));
batchWorker.on('batchDir', dir => sendSseEvent('batchDir', dir));
batchWorker.on('invoiceUpdated', inv => sendSseEvent('invoiceUpdated', inv));
batchWorker.on('batchCompleted', res => sendSseEvent('batchCompleted', res));
batchWorker.on('batchError', err => sendSseEvent('batchError', { message: err.message }));

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// GET /api/status
app.get('/api/status', (req, res) => {
  res.json({
    version: config.version,
    appName: config.appName,
    isRunning: batchWorker.isRunning,
    isPaused: batchWorker.isPaused,
    isCancelled: batchWorker.isCancelled,
    defaultOutputDir: config.defaultOutputDir,
    defaultDueDate: getDefaultDueDate()
  });
});

// POST /api/analyze-date
app.post('/api/analyze-date', (req, res) => {
  const { dateStr } = req.body;
  const analysis = analyzeDueDate(dateStr || getDefaultDueDate());
  res.json(analysis);
});

// POST /api/consult-ie
app.post('/api/consult-ie', async (req, res) => {
  const { ie } = req.body;
  if (!ie) {
    return res.status(400).json({ error: 'Inscrição Estadual é obrigatória.' });
  }

  const client = new SefazClient({ headless: true });
  try {
    const result = await client.consultIE(ie);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// POST /api/preview
// Accepts multipart/form-data with file or defaults to local ICMS ST.xlsx
// POST /api/preview
// Accepts multipart/form-data with file or defaults to local ICMS ST.xlsx
app.post('/api/preview', upload.single('file'), async (req, res) => {
  try {
    const { ie, dueDate, revenueCode: requestedRevenueCode, difalMode } = req.body;
    let fileBuffer = req.file ? req.file.buffer : null;
    let fileName = req.file ? req.file.originalname : 'ICMS ST.xlsx';

    if (!fileBuffer) {
      // Fallback to local default file
      const defaultFilePath = path.join(__dirname, '..', 'ICMS ST.xlsx');
      if (fs.existsSync(defaultFilePath)) {
        fileBuffer = fs.readFileSync(defaultFilePath);
        fileName = 'ICMS ST.xlsx';
      } else {
        return res.status(400).json({ error: 'Nenhuma planilha foi enviada e o arquivo padrão não foi encontrado.' });
      }
    }

    const isSpedFile = fileName.toLowerCase().endsWith('.txt') || 
                       fileName.toLowerCase().endsWith('.sped') || 
                       (fileBuffer && fileBuffer.toString('latin1', 0, 10).startsWith('|0000|'));

    if (isSpedFile) {
      const selectedDifalMode = (difalMode === 'operacao') ? 'operacao' : 'apuracao';
      const spedResult = parseSped(fileBuffer, { difalMode: selectedDifalMode });
      const excelBuffer = generateDebitsSpreadsheet(spedResult);
      
      const cleanCompany = sanitizeFileName(spedResult.company.razaoSocial);
      const generatedFileName = `Debitos_SPED_${cleanCompany}_${spedResult.company.competenciaFolder}.xlsx`;
      lastGeneratedSpedExcel = {
        buffer: excelBuffer,
        fileName: generatedFileName
      };

      const dueDateAnalysis = analyzeDueDate(spedResult.summary.defaultDueDate || dueDate);

      // Construct clientInfo from SPED
      let clientInfo = {
        ie: spedResult.company.ie,
        inscricaoEstadual: spedResult.company.ieFormatada,
        razaoSocial: spedResult.company.razaoSocial,
        cnpj: spedResult.company.cnpj,
        uf: spedResult.company.uf,
        codMunOrigem: spedResult.company.codMun,
        nomeMunOrigem: 'ARAGUAÍNA'
      };

      // Consult IE on SEFAZ if requested or to get live taxpayer name/municipio
      const queryIE = ie || spedResult.company.ie;
      let ieError = null;
      if (queryIE && queryIE.trim().length > 0) {
        const sefaz = new SefazClient({ headless: true });
        try {
          const liveInfo = await sefaz.consultIE(queryIE);
          if (liveInfo && liveInfo.razaoSocial) {
            clientInfo = liveInfo;
          }
        } catch (err) {
          ieError = err.message;
        } finally {
          await sefaz.close();
        }
      }

      // Resolve expected output directory for the preview and save spreadsheet
      let expectedBatchDir = null;
      try {
        const resolved = resolveBatchDirectory({
          baseDir: config.defaultOutputDir,
          competenceMonthYear: spedResult.company.competenciaFolder,
          dueDateMonthYear: dueDateAnalysis.monthYearFolder,
          razaoSocial: clientInfo.razaoSocial,
          cnpj: clientInfo.cnpj,
          createIfMissing: true
        });
        expectedBatchDir = resolved.targetPath;

        const savedExcelPath = path.join(resolved.targetPath, generatedFileName);
        try {
          fs.writeFileSync(savedExcelPath, excelBuffer);
        } catch {}
      } catch {}

      // Helper to map debit into invoice object compatible with batch processing and table view
      const mapDebitToInvoice = (debit) => ({
        nf: debit.nf,
        destinatario: clientInfo.razaoSocial,
        empresa: clientInfo.razaoSocial,
        empresaCodigo: '',
        empresaLabel: clientInfo.razaoSocial,
        cnpj: clientInfo.cnpj,
        ie: clientInfo.ie,
        itemCount: 1,
        items: [{
          descricao: debit.tributo,
          codigo: debit.codigoReceita,
          valor: debit.valorGuia,
          mva: { str: '', num: 0 },
          aliquota: 0,
          chaveAcesso: debit.chaveAcesso || ''
        }],
        chaveAcesso: debit.chaveAcesso || '',
        fornecedor: debit.fornecedor || '',
        totalValorContabil: debit.valorGuia,
        totalBaseCalculo: 0,
        totalIcmsNormal: debit.codigoReceita === '110' ? debit.valorGuia : 0,
        totalIcmsSt: debit.codigoReceita === '130' ? debit.valorGuia : 0,
        totalDifal: debit.codigoReceita === '150' ? debit.valorGuia : 0,
        valorGuia: debit.valorGuia,
        dataVencimento: debit.dataVencimento || dueDateAnalysis.dateStr,
        competencia: debit.competencia || spedResult.company.competencia,
        codigoReceita: debit.codigoReceita,
        codigoReceitaDesc: debit.codigoReceitaDesc,
        subCodigo: debit.subCodigo,
        subCodigoDesc: debit.subCodigoDesc,
        documentType: debit.documentType,
        tipoGuia: debit.tipoGuia || (debit.codigoReceita === '150' ? 'DIFAL' : debit.tipo),
        tipo: debit.tipo,
        observation: debit.observation,
        registroOrigem: debit.registroOrigem,
        idempotencyHash: computeIdempotencyHash(clientInfo.ie, debit.nf, debit.dataVencimento || dueDateAnalysis.dateStr, debit.codigoReceita, debit.valorGuia),
        errors: [],
        isValid: true,
        status: 'PENDENTE',
        history: [{
          timestamp: new Date().toISOString(),
          status: 'PENDENTE',
          message: `Débito fiscal identificado no SPED Fiscal (${debit.registroOrigem} - Cód. ${debit.codigoReceita}${debit.subCodigoDesc ? ` - ${debit.subCodigoDesc}` : ''}).`
        }]
      });

      const invoices = spedResult.debits.map(mapDebitToInvoice);
      const difalApuracaoInvoices = (spedResult.difalDebits?.apuracao || []).map(mapDebitToInvoice);
      const difalOperacaoInvoices = (spedResult.difalDebits?.operacao || []).map(mapDebitToInvoice);
      const nonDifalInvoices = [
        ...spedResult.fdeDebits,
        ...spedResult.stApuracaoDebits,
        ...spedResult.icmsNormalDebits
      ].map(mapDebitToInvoice);

      const grandTotal = spedResult.summary.grandTotalCalculated;

      return res.json({
        success: true,
        isSped: true,
        sourceFileName: fileName,
        spedDetails: {
          company: spedResult.company,
          summary: spedResult.summary
        },
        downloadXlsxUrl: '/api/sped/download-xlsx',
        downloadXlsxName: generatedFileName,
        dueDateAnalysis,
        clientInfo,
        ieError,
        hasFecoep: false,
        totalGrossFECOEP: 0,
        totalGrossST: grandTotal,
        hasDifal: spedResult.hasDifal,
        activeDifalMode: spedResult.activeDifalMode,
        difalOptions: {
          hasDifal: spedResult.hasDifal,
          activeMode: spedResult.activeDifalMode,
          totalApuracao: spedResult.difalDebits.totalApuracao,
          totalOperacao: spedResult.difalDebits.totalOperacao,
          apuracaoInvoices: difalApuracaoInvoices,
          operacaoInvoices: difalOperacaoInvoices,
          nonDifalInvoices
        },
        activeRevenueCode: invoices[0]?.codigoReceita || '150',
        distinctDestinatarios: [clientInfo.razaoSocial],
        distinctCompanies: [{
          label: clientInfo.razaoSocial,
          destinatario: clientInfo.razaoSocial,
          empresa: clientInfo.razaoSocial,
          empresaCodigo: '',
          invoiceCount: invoices.length,
          itemCount: invoices.length,
          totalST: grandTotal,
          nfs: invoices.map(i => i.nf)
        }],
        expectedBatchDir,
        summary: {
          totalInvoices: invoices.length,
          totalItems: invoices.length,
          grandTotalCalculated: grandTotal,
          grandTotalRaw: grandTotal,
          roundingDifference: 0,
          codigoReceita: 'SPED',
          codigoReceitaDesc: 'Débitos Apurados SPED Fiscal',
          taxTypeName: 'SPED Fiscal'
        },
        invoices,
        groupings: {
          'SPED': {
            code: 'SPED',
            name: 'Débitos SPED Fiscal',
            description: 'Apuração Mensal SPED Fiscal EFD ICMS/IPI',
            summary: {
              totalInvoices: invoices.length,
              totalItems: invoices.length,
              grandTotalCalculated: grandTotal,
              grandTotalRaw: grandTotal,
              roundingDifference: 0,
              codigoReceita: 'SPED',
              codigoReceitaDesc: 'Débitos Apurados SPED Fiscal',
              taxTypeName: 'SPED Fiscal'
            },
            invoices,
            distinctCompanies: [{
              label: clientInfo.razaoSocial,
              destinatario: clientInfo.razaoSocial,
              empresa: clientInfo.razaoSocial,
              empresaCodigo: '',
              invoiceCount: invoices.length,
              itemCount: invoices.length,
              totalST: grandTotal,
              nfs: invoices.map(i => i.nf)
            }]
          }
        }
      });
    }

    // 1. Analyze Date
    const dueDateAnalysis = analyzeDueDate(dueDate || getDefaultDueDate());
    if (!dueDateAnalysis.isValid) {
      return res.status(400).json({ error: dueDateAnalysis.error });
    }

    // 2. Parse Excel
    const parsedExcel = parseExcel(fileBuffer);

    // Auto-detect IE from spreadsheet if not explicitly provided in req.body
    const excelIE = (parsedExcel.taxpayer?.ie || parsedExcel.items.find(i => i.ieDestinatario)?.ieDestinatario || '').replace(/\D/g, '');
    const cleanReqIE = (ie || '').toString().replace(/\D/g, '');
    const effectiveIE = cleanReqIE.length > 0 ? cleanReqIE : excelIE;

    // 3. Group Invoices for both ICMS ST and FECOEP (if present)
    const activeCode = (requestedRevenueCode === '119' || String(requestedRevenueCode).toUpperCase().includes('FECOEP')) ? '119' : '140';

    const groupedST = groupInvoices(parsedExcel.items, effectiveIE, dueDateAnalysis.dateStr, '140');
    groupedST.sourceFileName = fileName;

    let groupedFECOEP = null;
    if (parsedExcel.hasFecoepItems) {
      groupedFECOEP = groupInvoices(parsedExcel.items, effectiveIE, dueDateAnalysis.dateStr, '119');
      groupedFECOEP.sourceFileName = fileName;
    }

    const activeGrouped = (activeCode === '119' && groupedFECOEP) ? groupedFECOEP : groupedST;

    // Helper to summarize distinct companies / destinatários from spreadsheet invoices
    const summarizeCompanies = (invList) => {
      const companiesMap = new Map();
      invList.forEach(inv => {
        const key = inv.empresaLabel || inv.destinatario || 'EMPRESA';
        if (!companiesMap.has(key)) {
          companiesMap.set(key, {
            label: key,
            destinatario: inv.destinatario,
            empresa: inv.empresa,
            empresaCodigo: inv.empresaCodigo,
            invoiceCount: 0,
            itemCount: 0,
            totalST: 0,
            nfs: []
          });
        }
        const c = companiesMap.get(key);
        c.invoiceCount++;
        c.itemCount += inv.itemCount;
        c.totalST = Math.round((c.totalST + inv.valorGuia) * 100) / 100;
        c.nfs.push(inv.nf);
      });
      return Array.from(companiesMap.values());
    };

    // 4. Consult IE if provided or auto-detected from spreadsheet
    let clientInfo = null;
    let ieError = null;
    if (effectiveIE && effectiveIE.length > 0) {
      const sefaz = new SefazClient({ headless: true });
      try {
        clientInfo = await sefaz.consultIE(effectiveIE);
      } catch (err) {
        ieError = err.message;
      } finally {
        await sefaz.close();
      }
    }

    // Fallback if SEFAZ was offline or not reached, but we have taxpayer info from spreadsheet:
    if (!clientInfo && (effectiveIE || parsedExcel.taxpayer?.cnpj || parsedExcel.taxpayer?.razaoSocial)) {
      const foundRazao = parsedExcel.taxpayer?.razaoSocial || parsedExcel.items[0]?.cliente || 'CONTRIBUINTE';
      const foundCnpj = parsedExcel.taxpayer?.cnpj || parsedExcel.items[0]?.cnpjDestinatario || '';
      clientInfo = {
        ie: effectiveIE || parsedExcel.taxpayer?.ie || '',
        inscricaoEstadual: effectiveIE || parsedExcel.taxpayer?.ie || '',
        razaoSocial: foundRazao,
        cnpj: foundCnpj,
        uf: parsedExcel.taxpayer?.uf || 'TO',
        codMunOrigem: parsedExcel.taxpayer?.codMun || '1702109',
        nomeMunOrigem: parsedExcel.taxpayer?.nomeMun || 'ARAGUAÍNA'
      };
    }

    const distinctDestinatarios = Array.from(new Set(activeGrouped.invoices.map(i => i.destinatario).filter(Boolean)));
    const distinctCompanies = summarizeCompanies(activeGrouped.invoices);

    // Resolve expected output directory for the preview
    let expectedBatchDir = null;
    try {
      const resolved = resolveBatchDirectory({
        baseDir: config.defaultOutputDir,
        competenceMonthYear: dueDateAnalysis.competenceMonthYearFolder || dueDateAnalysis.competencia?.replace('/', '-'),
        dueDateMonthYear: dueDateAnalysis.monthYearFolder,
        razaoSocial: clientInfo ? clientInfo.razaoSocial : (activeGrouped.invoices[0]?.destinatario || 'CLIENTE'),
        cnpj: clientInfo ? clientInfo.cnpj : '',
        createIfMissing: false
      });
      expectedBatchDir = resolved.targetPath;
    } catch {}

    const revenueConfig = config.revenueCodes[activeCode] || {
      code: activeCode,
      name: activeCode === '119' ? 'FECOEP' : 'ICMS ST',
      description: activeCode === '119' ? 'ICMS FUNDO ESTADUAL DE COMBATE A POBREZA POR APURAÇÃO' : config.revenueCodeDescription
    };

    res.json({
      success: true,
      sourceFileName: fileName,
      dueDateAnalysis,
      clientInfo,
      taxpayer: parsedExcel.taxpayer,
      ieError,
      hasFecoep: parsedExcel.hasFecoepItems,
      totalGrossFECOEP: parsedExcel.totalGrossFECOEP || 0,
      totalGrossST: parsedExcel.totalGrossST || 0,
      activeRevenueCode: activeCode,
      distinctDestinatarios,
      distinctCompanies,
      expectedBatchDir,
      summary: {
        totalInvoices: activeGrouped.totalInvoices,
        totalItems: activeGrouped.totalItems,
        grandTotalCalculated: activeGrouped.grandTotalCalculated,
        grandTotalRaw: activeGrouped.grandTotalRaw,
        roundingDifference: activeGrouped.roundingDifference,
        codigoReceita: activeCode,
        codigoReceitaDesc: revenueConfig.description,
        taxTypeName: revenueConfig.name
      },
      invoices: activeGrouped.invoices,
      groupings: {
        '140': {
          code: '140',
          name: 'ICMS ST',
          description: config.revenueCodes['140']?.description || config.revenueCodeDescription,
          summary: {
            totalInvoices: groupedST.totalInvoices,
            totalItems: groupedST.totalItems,
            grandTotalCalculated: groupedST.grandTotalCalculated,
            grandTotalRaw: groupedST.grandTotalRaw,
            roundingDifference: groupedST.roundingDifference,
            codigoReceita: '140',
            codigoReceitaDesc: config.revenueCodes['140']?.description || config.revenueCodeDescription,
            taxTypeName: 'ICMS ST'
          },
          invoices: groupedST.invoices,
          distinctCompanies: summarizeCompanies(groupedST.invoices)
        },
        '119': groupedFECOEP ? {
          code: '119',
          name: 'FECOEP',
          description: config.revenueCodes['119']?.description || 'ICMS FUNDO ESTADUAL DE COMBATE A POBREZA POR APURAÇÃO',
          summary: {
            totalInvoices: groupedFECOEP.totalInvoices,
            totalItems: groupedFECOEP.totalItems,
            grandTotalCalculated: groupedFECOEP.grandTotalCalculated,
            grandTotalRaw: groupedFECOEP.grandTotalRaw,
            roundingDifference: groupedFECOEP.roundingDifference,
            codigoReceita: '119',
            codigoReceitaDesc: config.revenueCodes['119']?.description || 'ICMS FUNDO ESTADUAL DE COMBATE A POBREZA POR APURAÇÃO',
            taxTypeName: 'FECOEP'
          },
          invoices: groupedFECOEP.invoices,
          distinctCompanies: summarizeCompanies(groupedFECOEP.invoices)
        } : null
      },
      warnings: parsedExcel.warnings
    });

  } catch (err) {
    console.error('Erro na prévia:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sped/download-xlsx
app.get('/api/sped/download-xlsx', (req, res) => {
  if (!lastGeneratedSpedExcel || !lastGeneratedSpedExcel.buffer) {
    return res.status(404).json({ error: 'Nenhuma planilha gerada a partir do SPED disponível para download no momento.' });
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${lastGeneratedSpedExcel.fileName}"`);
  res.send(lastGeneratedSpedExcel.buffer);
});

// POST /api/start-batch
app.post('/api/start-batch', async (req, res) => {
  try {
    const { clientInfo, groupedData, dueDateInfo, mode, baseOutputDir, selectedNFs, visualize } = req.body;

    if (!clientInfo || !clientInfo.ie || !clientInfo.codMunOrigem) {
      return res.status(400).json({ error: 'Dados do contribuinte incompletos ou consulta de IE pendente.' });
    }
    if (!groupedData || !Array.isArray(groupedData.invoices)) {
      return res.status(400).json({ error: 'Dados das notas ausentes para processamento.' });
    }
    if (!dueDateInfo || !dueDateInfo.dateStr) {
      return res.status(400).json({ error: 'Data de vencimento ausente.' });
    }

    // Launch worker asynchronously
    batchWorker.startBatch({
      clientInfo,
      groupedData,
      dueDateInfo,
      mode: mode || config.defaultMode,
      baseOutputDir: baseOutputDir || config.defaultOutputDir,
      overridePath: req.body.overridePath || null,
      selectedNFs: selectedNFs || null,
      visualize: !!visualize
    }).catch(err => {
      console.error('Erro no worker:', err);
    });

    res.json({ success: true, message: 'Lote iniciado com sucesso em segundo plano.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pause
app.post('/api/pause', (req, res) => {
  batchWorker.pause();
  res.json({ success: true, status: 'PAUSED' });
});

// POST /api/resume
app.post('/api/resume', (req, res) => {
  batchWorker.resume();
  res.json({ success: true, status: 'RUNNING' });
});

// POST /api/cancel
app.post('/api/cancel', (req, res) => {
  batchWorker.cancel();
  res.json({ success: true, status: 'CANCELLED' });
});

// GET /api/pdf/:nf
app.get('/api/pdf/:nf', (req, res) => {
  const nf = req.params.nf;
  const targetDir = req.query.dir || (batchWorker.auditManager && batchWorker.auditManager.targetDir);
  if (!targetDir) {
    return res.status(400).send('Diretório do lote não informado.');
  }

  if (!fs.existsSync(targetDir)) {
    return res.status(404).send(`Diretório do lote não encontrado: ${targetDir}`);
  }

  // Find file matching new standard "DARE ICMS ST NF ${nf} - *.pdf", "DARE FECOEP NF ${nf} - *.pdf" or legacy
  let matchedPdfPath = null;
  let matchedFileName = null;

  try {
    const files = fs.readdirSync(targetDir);
    const requestedCode = req.query.revenueCode || req.query.code;
    const isDifal = requestedCode === '150' || (req.query.tipo && req.query.tipo.toUpperCase().includes('DIFAL')) || String(nf).toUpperCase().includes('DIFAL');
    const isFecoep = requestedCode === '119' || (req.query.tipo && req.query.tipo.toUpperCase().includes('FECOEP'));
    const isFde = requestedCode === '643' || (req.query.tipo && req.query.tipo.toUpperCase().includes('FDE')) || String(nf).toUpperCase().includes('FDE');
    const isStApuracao = requestedCode === '130' || String(nf).toUpperCase().includes('APURAÇÃO') || String(nf).toUpperCase().includes('APURACAO');
    const isIcmsNormal = requestedCode === '110' || String(nf).toUpperCase().includes('NORMAL');

    let match = null;
    if (isDifal) {
      match = files.find(f => {
        const up = f.toUpperCase();
        if (!up.endsWith('.pdf') || !up.includes('DIFAL')) return false;
        if (String(nf).toUpperCase().includes('APUR')) {
          return up.includes('APURACAO') || up.includes('APURAÇÃO');
        }
        return up.includes(`NF ${nf} `) || up.includes(`NF_${nf}.`) || up.includes(`NF ${nf}.`) || up.includes(String(nf));
      });
    } else if (isFde) {
      match = files.find(f => f.toUpperCase().startsWith('DARE FDE') && f.endsWith('.pdf'));
    } else if (isStApuracao) {
      match = files.find(f => f.toUpperCase().includes('DARE ICMS ST APURACAO') && f.endsWith('.pdf'));
    } else if (isIcmsNormal) {
      match = files.find(f => f.toUpperCase().includes('DARE ICMS NORMAL') && f.endsWith('.pdf'));
    } else if (isFecoep) {
      match = files.find(f => 
        f.startsWith(`DARE FECOEP NF ${nf} - `) ||
        f === `DARE FECOEP NF ${nf}.pdf` ||
        f.startsWith(`DARE ICMS FECOEP NF ${nf} - `) ||
        f === `DARE ICMS FECOEP NF ${nf}.pdf`
      );
      if (!match) {
        match = files.find(f => 
          f.toUpperCase().includes('FECOEP') && (f.includes(`NF ${nf} `) || f.includes(`NF_${nf}.`) || f.includes(`NF ${nf}.`))
        );
      }
    } else if (requestedCode === '140') {
      match = files.find(f => 
        f.startsWith(`DARE ICMS ST NF ${nf} - `) ||
        f === `DARE ICMS ST NF ${nf}.pdf` ||
        f === `DARE_NF_${nf}.pdf`
      );
      if (!match) {
        match = files.find(f => 
          !f.toUpperCase().includes('FECOEP') && !f.toUpperCase().includes('FDE') && !f.toUpperCase().includes('APURACAO') && !f.toUpperCase().includes('NORMAL') && !f.toUpperCase().includes('DIFAL') && (f.includes(`NF ${nf} `) || f.includes(`NF_${nf}.`) || f.includes(`NF ${nf}.`))
        );
      }
    } else {
      match = files.find(f => 
        (f.toUpperCase().includes('DARE ICMS DIFAL') && f.endsWith('.pdf')) ||
        f.startsWith(`DARE FECOEP NF ${nf} - `) ||
        f === `DARE FECOEP NF ${nf}.pdf` ||
        f.startsWith(`DARE ICMS FECOEP NF ${nf} - `) ||
        f === `DARE ICMS FECOEP NF ${nf}.pdf` ||
        f.startsWith(`DARE ICMS ST NF ${nf} - `) ||
        f === `DARE ICMS ST NF ${nf}.pdf` ||
        f === `DARE_NF_${nf}.pdf` ||
        (f.toUpperCase().startsWith('DARE FDE') && f.endsWith('.pdf')) ||
        (f.toUpperCase().includes('DARE ICMS ST APURACAO') && f.endsWith('.pdf')) ||
        f.includes(`NF ${nf} `) ||
        f.includes(`NF_${nf}.`)
      );
    }

    if (match) {
      matchedFileName = match;
      matchedPdfPath = path.join(targetDir, match);
    }
  } catch (err) {
    return res.status(500).send(`Erro ao ler pasta: ${err.message}`);
  }

  if (matchedPdfPath && fs.existsSync(matchedPdfPath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${matchedFileName}"`);
    res.sendFile(matchedPdfPath);
  } else {
    res.status(404).send(`Arquivo PDF da NF ${nf} não encontrado em ${targetDir}.`);
  }
});

// POST /api/open-folder
app.post('/api/open-folder', (req, res) => {
  try {
    const { folderPath } = req.body;
    let target = folderPath || (batchWorker.auditManager && batchWorker.auditManager.targetDir) || config.defaultOutputDir;

    // Resolve target and normalize slashes for Windows
    let resolvedTarget = path.normalize(path.resolve(target));

    if (!fs.existsSync(resolvedTarget)) {
      try {
        fs.mkdirSync(resolvedTarget, { recursive: true });
      } catch {
        // If creating fails (e.g. drive letter not mapped), search upwards
        let current = resolvedTarget;
        while (current && !fs.existsSync(current)) {
          const parent = path.dirname(current);
          if (parent === current) break;
          current = parent;
        }
        if (fs.existsSync(current)) {
          resolvedTarget = current;
        } else {
          resolvedTarget = config.fallbackOutputDir;
          if (!fs.existsSync(resolvedTarget)) {
            fs.mkdirSync(resolvedTarget, { recursive: true });
          }
        }
      }
    }

    // Launch explorer reliably on Windows using direct spawn
    try {
      const child = spawn('explorer.exe', [resolvedTarget], { detached: true, stdio: 'ignore' });
      child.unref();
      child.on('error', () => {
        // Fallback to powershell Start-Process
        const psCmd = `powershell -NoProfile -Command "Start-Process explorer.exe -ArgumentList @('${resolvedTarget.replace(/'/g, "''")}')"`;
        exec(psCmd, () => {});
      });
    } catch {
      const psCmd = `powershell -NoProfile -Command "Start-Process explorer.exe -ArgumentList @('${resolvedTarget.replace(/'/g, "''")}')"`;
      exec(psCmd, () => {});
    }

    res.json({ success: true, opened: resolvedTarget });
  } catch (err) {
    res.status(500).json({ error: `Erro ao abrir pasta: ${err.message}` });
  }
});

// POST /api/validate-batch
// Validates all PDFs in a directory against expected invoices
app.post('/api/validate-batch', (req, res) => {
  try {
    const { targetDir, clientInfo, invoices } = req.body;
    const dir = targetDir || (batchWorker.auditManager && batchWorker.auditManager.targetDir);
    if (!dir || !fs.existsSync(dir)) {
      return res.status(400).json({ error: 'Diretório informado não existe.' });
    }

    const results = [];
    const files = fs.readdirSync(dir);

    for (const inv of invoices || []) {
      const isFecoep = String(inv.codigoReceita) === '119' || inv.tipoGuia === 'FECOEP';
      let match = null;

      if (isFecoep) {
        match = files.find(f => 
          f.startsWith(`DARE FECOEP NF ${inv.nf} - `) ||
          f === `DARE FECOEP NF ${inv.nf}.pdf` ||
          f.startsWith(`DARE ICMS FECOEP NF ${inv.nf} - `) ||
          f === `DARE ICMS FECOEP NF ${inv.nf}.pdf`
        );
        if (!match) {
          match = files.find(f => 
            f.toUpperCase().includes('FECOEP') && (f.includes(`NF ${inv.nf} `) || f.includes(`NF_${inv.nf}.`) || f.includes(`NF ${inv.nf}.`))
          );
        }
      } else {
        match = files.find(f => 
          f.startsWith(`DARE ICMS ST NF ${inv.nf} - `) ||
          f === `DARE ICMS ST NF ${inv.nf}.pdf` ||
          f === `DARE_NF_${inv.nf}.pdf`
        );
        if (!match) {
          match = files.find(f => 
            !f.toUpperCase().includes('FECOEP') && (f.includes(`NF ${inv.nf} `) || f.includes(`NF_${inv.nf}.`) || f.includes(`NF ${inv.nf}.`))
          );
        }
      }

      if (match) {
        const fullPath = path.join(dir, match);
        const val = validateDareAgainstInvoice(fullPath, inv, clientInfo || {});
        results.push({ nf: inv.nf, fileName: match, validation: val });
      } else {
        results.push({
          nf: inv.nf,
          fileName: null,
          validation: { valid: false, errors: ['Arquivo PDF não encontrado na pasta'] }
        });
      }
    }

    res.json({
      success: true,
      targetDir: dir,
      totalChecked: results.length,
      allValid: results.every(r => r.validation.valid),
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function startServer(port = config.port) {
  return app.listen(port, () => {
    console.log(`====================================================`);
    console.log(` GeraDARE SEFAZ/TO - Servidor ativo na porta ${port}`);
    console.log(` Interface Web Desktop: http://localhost:${port}`);
    console.log(`====================================================`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
