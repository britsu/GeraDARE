const EventEmitter = require('events');
const SefazClient = require('../portal/sefazClient');
const AuditManager = require('../audit/auditManager');
const { resolveBatchDirectory, checkInvoiceIdempotency } = require('../storage/pathManager');
const { validateDareAgainstInvoice } = require('../audit/dareValidator');
const config = require('../config');

class BatchWorker extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.isPaused = false;
    this.isCancelled = false;
    this.currentBatch = null;
    this.sefazClient = null;
    this.auditManager = null;
  }

  log(message, type = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message
    };
    this.emit('log', entry);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  updateProgress(current, total, currentNF = '') {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    this.emit('progress', {
      current,
      total,
      percentage: pct,
      currentNF,
      status: this.isPaused ? 'PAUSADO' : (this.isRunning ? 'PROCESSANDO' : 'CONCLUIDO')
    });
  }

  pause() {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      this.log('Processamento pausado pelo usuário.', 'warn');
      this.emit('status', { status: 'PAUSED' });
    }
  }

  resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.log('Processamento retomado pelo usuário.', 'info');
      this.emit('status', { status: 'RUNNING' });
    }
  }

  cancel() {
    if (this.isRunning) {
      this.isCancelled = true;
      this.isRunning = false;
      this.log('Processamento cancelado pelo usuário.', 'warn');
      this.emit('status', { status: 'CANCELLED' });
    }
  }

  /**
   * Starts processing a batch of invoices.
   */
  async startBatch({ clientInfo, groupedData, dueDateInfo, mode = config.defaultMode, baseOutputDir, overridePath, selectedNFs = null, visualize = false }) {
    if (this.isRunning) {
      throw new Error('Já existe um lote em processamento.');
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;

    this.sefazClient = new SefazClient({ headless: !visualize });

    try {
      // Filter invoices if selectedNFs is provided
      const allInvoices = groupedData.invoices || [];
      const invoicesToProcess = selectedNFs && Array.isArray(selectedNFs) && selectedNFs.length > 0
        ? allInvoices.filter(inv => selectedNFs.includes(inv.nf))
        : allInvoices;

      this.log(`Iniciando lote: ${invoicesToProcess.length} de ${allInvoices.length} notas selecionadas, empresa '${clientInfo.razaoSocial || clientInfo.ie}', modo '${mode}'.`);
      this.emit('status', { status: 'RUNNING' });
      this.emit('batchStarted', { totalInvoices: invoicesToProcess.length });

      // 1. Resolve output directory (Mês da competência tem prioridade estrita)
      const batchDir = resolveBatchDirectory({
        baseDir: baseOutputDir || config.defaultOutputDir,
        competenceMonthYear: dueDateInfo.competenceMonthYearFolder || dueDateInfo.competencia?.replace('/', '-'),
        dueDateMonthYear: dueDateInfo.monthYearFolder,
        razaoSocial: clientInfo.razaoSocial,
        cnpj: clientInfo.cnpj,
        createIfMissing: true,
        overridePath
      });

      this.log(`Diretório do lote definido: ${batchDir.targetPath}`);
      this.emit('batchDir', { path: batchDir.targetPath });

      // 2. Initialize Audit Manager
      const batchRevenueCode = groupedData.codigoReceita || (invoicesToProcess[0] && invoicesToProcess[0].codigoReceita) || config.defaultRevenueCode;
      this.auditManager = new AuditManager({
        targetDir: batchDir.targetPath,
        sourceFileName: groupedData.sourceFileName || 'planilha.xlsx',
        ie: clientInfo.ie,
        dueDate: dueDateInfo.dateStr,
        municipioOrigem: clientInfo.nomeMunOrigem,
        codigoMunicipioOrigem: clientInfo.codMunOrigem,
        codigoReceita: batchRevenueCode,
        mode
      });

      let processedCount = 0;

      // 3. Process each selected invoice sequentially
      for (let i = 0; i < invoicesToProcess.length; i++) {
        // Check cancellation
        if (this.isCancelled) {
          this.log('Lote interrompido devido ao cancelamento.', 'warn');
          break;
        }

        // Check pause loop
        while (this.isPaused && !this.isCancelled) {
          await new Promise(r => setTimeout(r, 500));
        }
        if (this.isCancelled) break;

        const invoice = invoicesToProcess[i];
        this.updateProgress(i + 1, invoicesToProcess.length, invoice.nf);
        this.log(`[${i + 1}/${invoicesToProcess.length}] Processando NF ${invoice.nf} (R$ ${invoice.valorGuia.toFixed(2)})...`);

        // Check if invoice had pre-existing parsing error
        if (!invoice.isValid) {
          invoice.status = 'ERRO_PLANILHA';
          invoice.history.push({
            timestamp: new Date().toISOString(),
            status: 'ERRO_PLANILHA',
            message: `Nota não processada devido a erros na planilha: ${(invoice.errors || []).join('; ')}`
          });
          this.emit('invoiceUpdated', invoice);
          this.auditManager.saveAuditJson(allInvoices);
          this.auditManager.saveAuditCsv(allInvoices);
          continue;
        }

        // Check Idempotency: is it already processed in this batch folder?
        const idemp = checkInvoiceIdempotency(batchDir.targetPath, invoice.nf, invoice.idempotencyHash, clientInfo.razaoSocial, invoice.codigoReceita);
        if (idemp.isAlreadyProcessed) {
          invoice.status = 'JA_PROCESSADA';
          invoice.arquivoFinal = idemp.pdfPath;

          // Run post-generation validation on existing PDF
          const validation = validateDareAgainstInvoice(idemp.pdfPath, invoice, clientInfo);
          invoice.validacaoPdf = validation;

          invoice.history.push({
            timestamp: new Date().toISOString(),
            status: 'JA_PROCESSADA',
            message: `Guia já existente e auditada (${idemp.pdfName}). Validação PDF: ${validation.valid ? '100% Conforme' : 'Divergência detectada'}.`
          });
          this.log(`NF ${invoice.nf} já processada anteriormente (${idemp.pdfName}). Validação PDF: ${validation.valid ? 'OK' : 'Falha'}.`);
          this.emit('step', {
            nf: invoice.nf,
            step: 'VALIDANDO_PDF',
            index: 6,
            total: 6,
            label: `Guia já existente e auditada (${idemp.pdfName})`,
            invoiceIndex: i + 1,
            totalInvoices: invoicesToProcess.length,
            globalStep: (i + 1) * 6,
            totalGlobalSteps: invoicesToProcess.length * 6,
            fractionalProgress: Math.min(100, Math.round((((i + 1) * 6) / (invoicesToProcess.length * 6)) * 1000) / 10)
          });
          this.emit('invoiceUpdated', invoice);
          this.auditManager.saveAuditJson(allInvoices);
          this.auditManager.saveAuditCsv(allInvoices);
          processedCount++;
          continue;
        }

        // Process on SEFAZ portal
        invoice.status = 'PREENCHIDA';
        this.emit('invoiceUpdated', invoice);

        const result = await this.sefazClient.processInvoice(invoice, clientInfo, {
          mode,
          downloadDir: batchDir.targetPath,
          onStep: (stepInfo) => {
            const enriched = {
              ...stepInfo,
              invoiceIndex: i + 1,
              totalInvoices: invoicesToProcess.length,
              globalStep: (i * 6) + stepInfo.index,
              totalGlobalSteps: invoicesToProcess.length * 6,
              fractionalProgress: Math.min(99.5, Math.round(((((i * 6) + stepInfo.index) / (invoicesToProcess.length * 6)) * 100) * 10) / 10)
            };
            this.emit('step', enriched);
          }
        });

        invoice.status = result.status;
        invoice.valorRetornadoPortal = result.valorRetornadoPortal;
        if (result.arquivoFinal) {
          invoice.arquivoFinal = result.arquivoFinal;
        }

        invoice.history.push({
          timestamp: new Date().toISOString(),
          status: result.status,
          message: result.message || (result.error ? `Erro: ${result.error}` : 'Processado.')
        });

        // Post-generation validation: cross-check PDF against spreadsheet
        if (result.status === 'SUCESSO' && result.arquivoFinal) {
          const validation = validateDareAgainstInvoice(result.arquivoFinal, invoice, clientInfo);
          invoice.validacaoPdf = validation;

          this.emit('step', {
            nf: invoice.nf,
            step: 'VALIDANDO_PDF',
            index: 6,
            total: 6,
            label: `Auditando conformidade do PDF oficial (NF ${invoice.nf})...`,
            invoiceIndex: i + 1,
            totalInvoices: invoicesToProcess.length,
            globalStep: (i + 1) * 6,
            totalGlobalSteps: invoicesToProcess.length * 6,
            fractionalProgress: Math.min(100, Math.round((((i + 1) * 6) / (invoicesToProcess.length * 6)) * 1000) / 10)
          });

          if (validation.valid) {
            this.log(`NF ${invoice.nf} validada no PDF oficial com 100% de conformidade (IE ${validation.extracted.ie}, R$ ${validation.extracted.valor.toFixed(2)}, Observação OK).`, 'success');
            invoice.history.push({
              timestamp: new Date().toISOString(),
              status: 'VALIDADO_PDF',
              message: `Auditoria do PDF: IE, Valor e Observação 100% conferidos com a planilha.`
            });
          } else {
            this.log(`NF ${invoice.nf} alerta de divergência na auditoria do PDF: ${(validation.errors || []).join('; ')}`, 'warn');
            invoice.history.push({
              timestamp: new Date().toISOString(),
              status: 'DIVERGENCIA_PDF',
              message: `Divergência na auditoria pós-geração: ${(validation.errors || []).join('; ')}`
            });
          }
        }

        if (result.status === 'SUCESSO' || result.status === 'VALOR_CONCILIADO') {
          this.log(`NF ${invoice.nf} concluída com sucesso: ${result.message}`, 'success');
        } else {
          this.log(`NF ${invoice.nf} status: ${result.status}. ${result.message || ''}`, 'warn');
        }

        this.emit('invoiceUpdated', invoice);

        // Progressively persist audit files after each invoice
        this.auditManager.saveAuditJson(allInvoices);
        this.auditManager.saveAuditCsv(allInvoices);
        processedCount++;

        // Brief delay between portal calls
        await new Promise(r => setTimeout(r, config.browser.actionDelayMs));
      }

      this.log(`Lote finalizado. Total processadas: ${processedCount}/${invoicesToProcess.length}.`);
      this.emit('batchCompleted', {
        batchDir: batchDir.targetPath,
        totalInvoices: invoicesToProcess.length,
        processedCount,
        jsonPath: batchDir.processamentoJsonPath,
        csvPath: batchDir.resultadoCsvPath
      });

    } catch (err) {
      this.log(`Erro crítico no processamento do lote: ${err.message}`, 'error');
      this.emit('batchError', err);
    } finally {
      this.isRunning = false;
      this.isPaused = false;
      if (this.sefazClient) {
        await this.sefazClient.close();
      }
      this.emit('status', { status: 'IDLE' });
    }
  }
}

const instance = new BatchWorker();
module.exports = instance;
module.exports.batchWorker = instance;
module.exports.BatchWorker = BatchWorker;
