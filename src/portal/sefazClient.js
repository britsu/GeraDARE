const { chromium } = require('playwright');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const { calculateCompetence } = require('../utils/calendar');
const { getStandardPdfName } = require('../storage/pathManager');
const { formatObservation } = require('../engine/grouper');

class SefazClient {
  constructor(options = {}) {
    this.headless = options.headless !== undefined ? options.headless : config.browser.headless;
    this.browser = null;
    this.context = null;
  }

  async init() {
    if (!this.browser) {
      const launchArgs = this.headless
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : ['--start-maximized', '--no-first-run', '--disable-infobars'];
      
      this.browser = await chromium.launch({
        headless: this.headless,
        slowMo: this.headless ? 0 : 200,
        args: launchArgs
      });
      this.context = await this.browser.newContext({
        locale: 'pt-BR',
        acceptDownloads: true,
        viewport: this.headless ? { width: 1280, height: 900 } : null
      });
    }
  }

  /**
   * Queries State Registration (IE) on SEFAZ portal.
   * Returns taxpayer info: { razaoSocial, cnpj, inscricaoEstadual, codMunOrigem, nomeMunOrigem, uf }
   */
  async consultIE(ie) {
    await this.init();
    const page = await this.context.newPage();

    try {
      const cleanIE = (ie || '').toString().replace(/\D/g, '');
      if (!cleanIE) {
        throw new Error('Inscrição Estadual vazia.');
      }

      await page.goto(config.portalUrl, {
        waitUntil: 'domcontentloaded',
        timeout: config.browser.timeoutMs
      });

      // Check if blocked or captcha
      const pageText = await page.textContent('body');
      if (pageText.toLowerCase().includes('captcha') || pageText.toLowerCase().includes('bloqueio')) {
        throw new Error('Mecanismo de segurança ou CAPTCHA detectado na página inicial.');
      }

      await page.fill('#vINSCRICAOESTADUAL', cleanIE);

      // Click Consultar
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: config.browser.timeoutMs }).catch(() => null),
        page.click('input[name="BUTTON1"]')
      ]);

      // Wait for either the form to load (taxpayer data) or error message to appear
      await page.waitForFunction(() => {
        const err = document.getElementById('gxErrorViewer');
        if (err && err.innerText.trim()) return true;
        const rz = document.getElementById('vDRERAZSOC');
        const mun = document.getElementById('vMUNCDGORI');
        return (rz && rz.value && rz.value.trim().length > 0) || (mun && mun.value && mun.value !== '0');
      }, { timeout: 15000 }).catch(() => null);

      await page.waitForTimeout(500);

      // Check if error message appeared
      const errorMsg = await page.$eval('#gxErrorViewer', el => el ? el.innerText.trim() : '').catch(() => '');
      if (errorMsg) {
        throw new Error(`Erro retornado pela SEFAZ: ${errorMsg}`);
      }

      // Extract fields
      const razaoSocial = await page.$eval('#vDRERAZSOC', el => el.value.trim()).catch(() => '');
      const inscricaoEstadual = await page.$eval('#vDREINSEST', el => el.value.trim()).catch(() => cleanIE);
      const uf = await page.$eval('#vUFCDGORI', el => el.value.trim()).catch(() => 'TO');
      const codMunOrigem = await page.$eval('#vMUNCDGORI', el => el.value.trim()).catch(() => '');
      const nomeMunOrigem = await page.$eval('#vMUNCDGORI', el => {
        return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text.trim() : '';
      }).catch(() => '');

      // Extract CNPJ from input, span, or GXState
      let cnpj = await page.$eval('#vCECPFCNPJ', el => el.value ? el.value.trim() : '').catch(() => '');
      if (!cnpj) {
        cnpj = await page.$eval('#span_vCECPFCNPJ', el => el ? el.innerText.trim() : '').catch(() => '');
      }
      if (!cnpj) {
        const gxStateRaw = await page.$eval('#GXState', el => el ? el.value : '').catch(() => '');
        if (gxStateRaw) {
          try {
            const parsed = JSON.parse(gxStateRaw);
            if (parsed.vCECPFCNPJ) cnpj = parsed.vCECPFCNPJ.trim();
          } catch {}
        }
      }

      if (!razaoSocial || !codMunOrigem || codMunOrigem === '0') {
        throw new Error('Consulta de IE não retornou razão social ou município de origem.');
      }

      return {
        success: true,
        ie: cleanIE,
        inscricaoEstadual,
        razaoSocial,
        cnpj,
        uf,
        codMunOrigem,
        nomeMunOrigem
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Processes a single invoice DARE on the portal.
   * Mode: 'dry-run', 'preencher-e-revisar', 'emitir-lote-aprovado'
   */
  async processInvoice(invoice, clientInfo, options = {}) {
    await this.init();
    const page = await this.context.newPage();
    const mode = options.mode || config.defaultMode;
    const downloadDir = options.downloadDir;
    const onStep = options.onStep || (() => {});

    try {
      onStep({ nf: invoice.nf, step: 'ACESSANDO_PORTAL', index: 1, total: 6, label: 'Conectando ao portal SEFAZ/TO...' });
      const cleanIE = clientInfo.ie;
      await page.goto(config.portalUrl, {
        waitUntil: 'domcontentloaded',
        timeout: config.browser.timeoutMs
      });

      await page.fill('#vINSCRICAOESTADUAL', cleanIE);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: config.browser.timeoutMs }).catch(() => null),
        page.click('input[name="BUTTON1"]')
      ]);

      // Wait for either the form to load (taxpayer data) or error message to appear
      await page.waitForFunction(() => {
        const err = document.getElementById('gxErrorViewer');
        if (err && err.innerText.trim()) return true;
        const rz = document.getElementById('vDRERAZSOC');
        const mun = document.getElementById('vMUNCDGORI');
        return (rz && rz.value && rz.value.trim().length > 0) || (mun && mun.value && mun.value !== '0');
      }, { timeout: 20000 }).catch(() => null);

      await page.waitForTimeout(500);

      // Check for errors or CAPTCHA
      const pageHtml = await page.content();
      if (pageHtml.toLowerCase().includes('captcha') || pageHtml.toLowerCase().includes('bloqueio')) {
        throw new Error('CAPTCHA ou bloqueio de segurança detectado.');
      }

      const errorMsg = await page.$eval('#gxErrorViewer', el => el ? el.innerText.trim() : '').catch(() => '');
      if (errorMsg) {
        throw new Error(`Erro na consulta SEFAZ: ${errorMsg}`);
      }

      onStep({ 
        nf: invoice.nf, 
        step: 'PREENCHENDO_CAMPOS', 
        index: 2, 
        total: 6, 
        label: `Preenchendo campos fiscais (NF ${invoice.nf}, R$ ${invoice.valorGuia.toFixed(2)})...`,
        revenueCode: String(invoice.codigoReceita || config.defaultRevenueCode)
      });

      // 1. Select Revenue Code (140, 119, 130, 643, or 110)
      const revenueCode = String(invoice.codigoReceita || config.defaultRevenueCode);
      const isFecoep = revenueCode === '119' || revenueCode.toUpperCase().includes('FECOEP');
      const isFde = revenueCode === '643' || revenueCode.toUpperCase().includes('FDE');
      const isStApuracao = revenueCode === '130';
      const isIcmsNormal = revenueCode === '110' || revenueCode.toUpperCase().includes('NORMAL');
      const isStEntrada = !isFecoep && !isFde && !isStApuracao && !isIcmsNormal;

      let targetRevenueCode = '140';
      if (isFecoep) targetRevenueCode = '119';
      else if (isFde) targetRevenueCode = '643';
      else if (isStApuracao) targetRevenueCode = '130';
      else if (isIcmsNormal) targetRevenueCode = '110';

      await page.evaluate((val) => {
        const el = document.getElementById('vDRECDGRCT');
        if (el) {
          el.value = val;
          if (typeof gx !== 'undefined') gx.evt.onchange(el);
        }
      }, targetRevenueCode);

      // Determine subcode value:
      // For 140: '2' (ICMS SUBSTITUIÇÃO TRIB. ENTRADAS EXTERNAS POR OPERAÇÃO)
      // For 119: '5' (III - ICMS SUBSTITUIÇÃO ENTRADA - OPERAÇÕES EXTERNAS - ADICIONAL DO FUNDO ES)
      // For 130: '1' (b - ICMS SUBSTITUIÇÃO TRIB. SAIDAS INTERNAS POR APURAÇÃO)
      // For 110: '1' (b- - ICMS NORMAL POR APURAÇÃO)
      // For 643: '0' (sem subcódigo)
      let targetSubcode = '2';
      if (isFde) {
        targetSubcode = '0';
      } else if (isIcmsNormal || isStApuracao) {
        targetSubcode = '1';
      } else if (isFecoep) {
        targetSubcode = '5';
      } else if (invoice.subCodigo) {
        targetSubcode = String(invoice.subCodigo);
      }

      if (!isFde) {
        // Explicitly wait for subcode options to populate from server AJAX
        await page.waitForFunction(() => {
          const elSub = document.getElementById('vSUBCDGRCT');
          return elSub && elSub.options && elSub.options.length > 1;
        }, { timeout: 15000 }).catch(() => null);

        if (isFecoep) {
          targetSubcode = await page.evaluate(() => {
            const elSub = document.getElementById('vSUBCDGRCT');
            if (!elSub || !elSub.options) return '5';
            const opts = Array.from(elSub.options);
            const found = opts.find(o => 
              o.text.trim().toUpperCase().startsWith('III') ||
              o.text.toUpperCase().includes('III -') ||
              o.value === '5' || 
              o.value === 'III' || 
              o.text.toUpperCase().includes('SUBSTITUIÇÃO ENTRADA') ||
              o.text.toUpperCase().includes('SUBSTITU')
            );
            return found ? found.value : '5';
          });
        } else if (isStApuracao) {
          targetSubcode = await page.evaluate(() => {
            const elSub = document.getElementById('vSUBCDGRCT');
            if (!elSub || !elSub.options) return '1';
            const opts = Array.from(elSub.options);
            const found = opts.find(o => 
              o.text.trim().toUpperCase().startsWith('B') ||
              o.text.toUpperCase().includes('APURAÇÃO') ||
              o.text.toUpperCase().includes('APURACAO') ||
              o.value === '1'
            );
            return found ? found.value : '1';
          });
        } else if (isIcmsNormal) {
          targetSubcode = await page.evaluate((preferredSub) => {
            const elSub = document.getElementById('vSUBCDGRCT');
            if (!elSub || !elSub.options) return preferredSub || '1';
            const opts = Array.from(elSub.options);
            // IMPORTANTE: Para ICMS Normal (110), o débito é devido à APURAÇÃO do mês (subcódigo 1 / letra b).
            // NUNCA selecionar POR OPERAÇÃO (subcódigo 2 / letra a).
            const found = opts.find(o => 
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
            return found ? found.value : (preferredSub || '1');
          }, invoice.subCodigo);
        }
      }

      if (targetSubcode !== '0') {
        // GeneXus fires an AJAX request to hdrewp02 when vSUBCDGRCT changes!
        const subAjaxPromise = page.waitForResponse(
          res => res.url().includes('hdrewp02') && res.status() === 200,
          { timeout: 12000 }
        ).catch(() => null);

        await page.evaluate((subVal) => {
          const elSub = document.getElementById('vSUBCDGRCT');
          if (elSub) {
            elSub.value = subVal;
            if (typeof gx !== 'undefined') gx.evt.onchange(elSub);
          }
        }, targetSubcode);

        // Wait for the AJAX response from hdrewp02
        await subAjaxPromise;
      }

      if (isStEntrada) {
        // Wait for GeneXus to render the Chave da NFe field (#vDRENFECHV) for code 140
        await page.waitForFunction(() => {
          const elKey = document.getElementById('vDRENFECHV');
          const elSub = document.getElementById('vSUBCDGRCT');
          return elKey !== null && elSub && elSub.value === '2';
        }, { timeout: 15000 }).catch(() => null);
        await page.waitForTimeout(600);
      } else {
        await page.waitForTimeout(600);
      }

      // 3. Prepare values for form fields
      const codMun = clientInfo.codMunReceita || clientInfo.codMunOrigem;
      const refPeriod = invoice.competencia || calculateCompetence(invoice.dataVencimento);
      const chaveNFe = invoice.chaveAcesso || (invoice.items && invoice.items[0] && invoice.items[0].chaveAcesso) || '';
      const valorStr = invoice.valorGuia.toFixed(2).replace('.', ',');

      let obs = invoice.observation;
      if (!obs || obs.length > 400) {
        if (isFde || isStApuracao || isIcmsNormal) {
          obs = (invoice.observation || '').substring(0, 400);
        } else {
          obs = formatObservation(invoice.nf, invoice.items || [], { revenueCode: targetRevenueCode, chaveAcesso: chaveNFe });
        }
      }
      let obsTruncated = obs.length > 400;
      if (obsTruncated) {
        obs = obs.substring(0, 400);
      }

      // Helper function to fill all fields safely without triggering unawaited server AJAX calls
      const populateAllFields = async () => {
        return await page.evaluate(({ targetRevenueCode, targetSubcode, isFecoep, isFde, isStApuracao, isIcmsNormal, isStEntrada, codMun, nfVal, chaveNFe, dueDate, refPeriod, valorStr, obs }) => {
          // Revenue code - do not fire server event here
          const elRct = document.getElementById('vDRECDGRCT');
          if (elRct && elRct.value !== targetRevenueCode) {
            elRct.value = targetRevenueCode;
          }

          // Sub-code - do not fire server event here (already awaited earlier)
          const elSub = document.getElementById('vSUBCDGRCT');
          if (elSub && elSub.value !== targetSubcode) {
            elSub.value = targetSubcode;
          }

          // Document Type (vDRETDCORI) for FECOEP, FDE, ST Apuração, and ICMS Normal
          if (isFecoep || isFde || isStApuracao || isIcmsNormal) {
            const elTdc = document.getElementById('vDRETDCORI');
            if (elTdc) {
              elTdc.value = '5'; // OUTROS A ESPECIFICAR
              if (typeof gx !== 'undefined') {
                if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDRETDCORI', '5', 0);
                if (gx.O) gx.O.AV32DreTdcOri = 5;
              }
            }
          }

          // Município da Receita
          const elMun = document.getElementById('vDRECDGMUN');
          if (elMun && codMun) {
            let matchedCode = String(codMun).trim();
            if (elMun.options && elMun.options.length > 0) {
              const searchStr = matchedCode.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              for (let i = 0; i < elMun.options.length; i++) {
                const opt = elMun.options[i];
                const optTextNorm = opt.text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (opt.value === matchedCode || optTextNorm.includes(searchStr)) {
                  matchedCode = opt.value;
                  break;
                }
              }
            }
            elMun.value = matchedCode;
            if (typeof gx !== 'undefined') {
              if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDRECDGMUN', matchedCode, 0);
              if (gx.O) gx.O.AV10DreCdgMun = parseInt(matchedCode, 10) || 0;
            }
          }

          // Nº Documento (NF) - filled only for code 140 (entradas); left blank for 119, 643, 130
          const elDoc = document.getElementById('vDREDOCORI');
          if (elDoc) {
            if (isStEntrada) {
              elDoc.value = nfVal;
              if (typeof gx !== 'undefined') {
                if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREDOCORI', nfVal, 0);
                if (gx.O) gx.O.AV15DreDocOri = nfVal;
              }
            } else {
              elDoc.value = '';
            }
          }

          // Chave da NFe - filled only for code 140 when present
          if (chaveNFe && isStEntrada) {
            const elKey = document.getElementById('vDRENFECHV');
            if (elKey) {
              elKey.value = chaveNFe;
              if (typeof gx !== 'undefined') {
                if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDRENFECHV', chaveNFe, 0);
                if (gx.O) gx.O.AV132DreNfeChv = chaveNFe;
              }
            }
          }

          // Data Vencimento
          const elDate = document.getElementById('vDREDTAVEN');
          if (elDate) {
            elDate.value = dueDate;
            if (typeof gx !== 'undefined') {
              if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREDTAVEN', dueDate, 0);
              if (gx.date && gx.date.valid_date) {
                gx.date.valid_date(elDate, 10, 'DMY', 0, 24, 'por', false, 0);
              }
              if (gx.O) gx.O.AV20DreDtaVen = dueDate;
            }
          }

          // Competência / Período de Referência (MM/AAAA)
          const elRef = document.getElementById('vDREREFCHAR');
          if (elRef && refPeriod) {
            elRef.value = refPeriod;
            if (typeof gx !== 'undefined') {
              if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREREFCHAR', refPeriod, 0);
              if (gx.O) gx.O.AV84DreRefChar = refPeriod;
            }
          }

          // Valor da Receita
          const elVal = document.getElementById('vDREVLRPRI');
          if (elVal) {
            elVal.value = valorStr;
            if (typeof gx !== 'undefined') {
              if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREVLRPRI', valorStr, 0);
              if (gx.O) gx.O.AV39DreVlrPri = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;
            }
          }

          // Observações Complementares
          const elObs = document.getElementById('vDREINFCOM');
          if (elObs) {
            elObs.value = obs;
            if (typeof gx !== 'undefined') {
              if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREINFCOM', obs, 0);
              if (gx.O) gx.O.AV23DreInfCom = obs;
            }
          }
        }, {
          targetRevenueCode,
          targetSubcode,
          isFecoep,
          isFde,
          isStApuracao,
          isIcmsNormal,
          isStEntrada,
          codMun,
          nfVal: invoice.nf,
          chaveNFe,
          dueDate: invoice.dataVencimento,
          refPeriod,
          valorStr,
          obs
        });
      };

      await populateAllFields();
      await page.waitForTimeout(500);

      // Verify fields retained values; if reset, repopulate
      const verifyFields = async () => {
        return await page.evaluate(({ valorStr, nfVal, targetRevenueCode, targetSubcode, isFecoep, isFde, isStApuracao, isIcmsNormal, isStEntrada }) => {
          const elVal = document.getElementById('vDREVLRPRI');
          const elDoc = document.getElementById('vDREDOCORI');
          const elSub = document.getElementById('vSUBCDGRCT');
          const elRct = document.getElementById('vDRECDGRCT');
          const elTdc = document.getElementById('vDRETDCORI');
          const valOk = elVal && elVal.value === valorStr;
          const rctOk = elRct && elRct.value === targetRevenueCode;
          const subOk = elSub && elSub.value === targetSubcode;
          const docOk = !isStEntrada || !elDoc || elDoc.value === nfVal;
          const tdcOk = isStEntrada || !elTdc || elTdc.value === '5';
          return valOk && rctOk && subOk && docOk && tdcOk;
        }, { valorStr, nfVal: invoice.nf, targetRevenueCode, targetSubcode, isFecoep, isFde, isStApuracao, isIcmsNormal, isStEntrada });
      };

      let isFieldValid = await verifyFields();
      if (!isFieldValid) {
        await page.waitForTimeout(400);
        await populateAllFields();
        await page.waitForTimeout(500);
      }

      // 8. Click "Atualizar Valores" with retry and response wait
      onStep({ nf: invoice.nf, step: 'ATUALIZANDO_VALORES', index: 3, total: 6, label: `Atualizando valores (R$ ${invoice.valorGuia.toFixed(2)})...`, revenueCode: targetRevenueCode });

      let cleanRetornado = 0;
      const expectedAmount = invoice.valorGuia;
      let attempts = 0;

      while (attempts < 3) {
        attempts++;

        // Ensure vDREVLRPRI is filled before clicking Atualizar Valores
        const currentVlr = await page.$eval('#vDREVLRPRI', el => el.value).catch(() => '');
        if (!currentVlr || currentVlr === '0,00' || currentVlr === '') {
          await populateAllFields();
          await page.waitForTimeout(600);
        }

        const updateAjaxPromise = page.waitForResponse(
          res => res.url().includes('hdrewp02') && res.status() === 200,
          { timeout: 12000 }
        ).catch(() => null);

        await page.evaluate(() => {
          const btn = document.querySelector('input[value="Atualizar Valores"]');
          if (btn) btn.click();
        });

        await updateAjaxPromise;
        await page.waitForTimeout(1000);

        const valorRetornadoStr = await page.$eval('#vDREVLRTOT', el => el.value || el.innerText || '0,00').catch(() => '0,00');
        cleanRetornado = parseFloat(valorRetornadoStr.replace(/\./g, '').replace(',', '.')) || 0;

        if (Math.abs(cleanRetornado - expectedAmount) <= 0.05) {
          break; // Successfully reconciled
        }

        // If returned 0.00 while expecting > 0, re-fill fields and retry
        if (cleanRetornado === 0 && expectedAmount > 0 && attempts < 3) {
          await page.waitForTimeout(500);
          await populateAllFields();
          await page.waitForTimeout(800);
        }
      }

      const diff = Math.abs(cleanRetornado - expectedAmount);
      if (diff > 0.05) {
        const portalError = await page.evaluate(() => {
          const gxErr = document.getElementById('gxErrorViewer')?.innerText?.trim();
          if (gxErr) return gxErr;
          const spans = Array.from(document.querySelectorAll('span.gx-warning-message, span.gx-feedback-message, .gx-error-message'));
          const spanText = spans.map(s => s.innerText.trim()).filter(Boolean).join('; ');
          if (spanText) return spanText;
          return '';
        }).catch(() => '');

        await page.screenshot({ path: `debug_diff_nf_${invoice.nf}.png`, fullPage: true });
        throw new Error(
          `Divergência de valores: Calculado R$ ${expectedAmount.toFixed(2)} vs Retornado pelo portal R$ ${cleanRetornado.toFixed(2)}.${portalError ? ' Mensagem SEFAZ: "' + portalError + '"' : ''}`
        );
      }

      // 9. Handle modes
      if (mode === 'dry-run') {
        onStep({ nf: invoice.nf, step: 'CONCLUIDO', index: 6, total: 6, label: `Simulação concluída! Valor conciliado: R$ ${cleanRetornado.toFixed(2)}` });
        return {
          status: 'VALOR_CONCILIADO',
          valorRetornadoPortal: cleanRetornado,
          message: `Simulação concluída com sucesso (dry-run). Valor conciliado: R$ ${cleanRetornado.toFixed(2)}.`,
          obsTruncated
        };
      }

      if (mode === 'preencher-e-revisar') {
        onStep({ nf: invoice.nf, step: 'CONCLUIDO', index: 6, total: 6, label: `Preenchida e atualizada! Aguardando aprovação.` });
        return {
          status: 'PREENCHIDA',
          valorRetornadoPortal: cleanRetornado,
          message: `Guia preenchida e valores atualizados com sucesso (R$ ${cleanRetornado.toFixed(2)}). Aguardando aprovação para emissão.`,
          obsTruncated
        };
      }

      if (mode === 'emitir-lote-aprovado') {
        if (!downloadDir || !fs.existsSync(downloadDir)) {
          throw new Error('Pasta de destino para download não foi encontrada ou não foi criada.');
        }

        // Standard PDF filename: "DARE ICMS ST NF [NUMERO] - [NOME DA EMPRESA].pdf" or "DARE FECOEP NF [NUMERO] - [NOME DA EMPRESA].pdf"
        const companyNameForPdf = (clientInfo && clientInfo.razaoSocial) || invoice.empresa || invoice.destinatario || '';
        const pdfFileName = getStandardPdfName(invoice.nf, companyNameForPdf, invoice.codigoReceita);
        const pdfFilePath = path.join(downloadDir, pdfFileName);

        onStep({ nf: invoice.nf, step: 'CONFIRMANDO_EMISSAO', index: 4, total: 6, label: `Confirmando emissão oficial do DARE (NF ${invoice.nf})...` });

        // Auto-accept browser dialog: "Confirmar geração do DARE?"
        page.on('dialog', async (dialog) => {
          await dialog.accept();
        });

        // Click "Confirmar" (BTN_ENTER) and wait for navigation to payment page (hnetccwkdapg)
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
          page.click('input[name="BTN_ENTER"]')
        ]);

        await page.waitForTimeout(1500);

        // On payment page (hnetccwkdapg), click "Imprimir DARE" (#IMGIMPDARE)
        const imgPrint = await page.$('#IMGIMPDARE');
        if (!imgPrint) {
          const errText = await page.evaluate(() => document.body.innerText);
          throw new Error(`Botão Imprimir DARE não encontrado. Mensagem do portal: ${errText.substring(0, 300)}`);
        }

        onStep({ nf: invoice.nf, step: 'BAIXANDO_PDF', index: 5, total: 6, label: `Baixando PDF oficial (${pdfFileName})...` });

        await page.click('#IMGIMPDARE');
        await page.waitForTimeout(2000);

        // Fetch PDF directly using context.request with current session cookies
        const pdfResponse = await page.context().request.get('https://www.sefaz.to.gov.br/dare/servlet/arccrlda');
        if (pdfResponse.status() !== 200) {
          throw new Error(`Falha ao obter PDF do DARE. Status HTTP retornado: ${pdfResponse.status()}`);
        }

        const pdfBuffer = await pdfResponse.body();
        if (!pdfBuffer || pdfBuffer.length < 500) {
          throw new Error('Arquivo PDF recebido está vazio ou corrompido.');
        }

        fs.writeFileSync(pdfFilePath, pdfBuffer);

        onStep({ nf: invoice.nf, step: 'CONCLUIDO', index: 6, total: 6, label: `PDF oficial salvo: ${pdfFileName} (${(pdfBuffer.length / 1024).toFixed(1)} KB)` });

        return {
          status: 'SUCESSO',
          valorRetornadoPortal: cleanRetornado,
          arquivoFinal: pdfFilePath,
          nomeArquivo: pdfFileName,
          message: `Guia emitida e PDF oficial baixado com sucesso: ${pdfFileName} (${(pdfBuffer.length / 1024).toFixed(1)} KB).`,
          obsTruncated
        };
      }

      return {
        status: 'VALOR_CONCILIADO',
        valorRetornadoPortal: cleanRetornado
      };

    } catch (err) {
      return {
        status: 'REVISAO_MANUAL',
        error: err.message,
        message: `Falha no processamento da NF ${invoice.nf}: ${err.message}`
      };
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.context) {
      await this.context.close().catch(() => null);
    }
    if (this.browser) {
      await this.browser.close().catch(() => null);
    }
    this.browser = null;
    this.context = null;
  }
}

module.exports = SefazClient;
module.exports.SefazClient = SefazClient;
