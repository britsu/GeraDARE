const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testEmitSingleDARE() {
  console.log('=== TESTE DE EMISSÃO REAL E DOWNLOAD DE PDF NA SEFAZ/TO ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR'
  });
  const page = await context.newPage();

  let downloadCaptured = null;
  let popupPageCaptured = null;

  // Listen for popup windows
  context.on('page', (p) => {
    console.log(`[POPUP DETECTADA] URL: ${p.url()}`);
    popupPageCaptured = p;
  });

  // Listen for downloads
  page.on('download', (d) => {
    console.log(`[DOWNLOAD DETECTADO] Arquivo sugerido: ${d.suggestedFilename()}`);
    downloadCaptured = d;
  });

  try {
    console.log('1. Acessando portal SEFAZ...');
    await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded' });
    await page.fill('#vINSCRICAOESTADUAL', '295153407');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null),
      page.click('input[name="BUTTON1"]')
    ]);
    await page.waitForTimeout(1500);

    // Seleciona Município da Receita: 1701051
    console.log('2. Preenchendo Município da Receita: 1701051');
    await page.evaluate(() => {
      const el = document.getElementById('vDRECDGMUN');
      el.value = '1701051';
      if (typeof gx !== 'undefined') gx.evt.onchange(el);
    });
    await page.waitForTimeout(400);

    // Seleciona Código da Receita: 140
    console.log('3. Selecionando Código da Receita: 140');
    await page.evaluate(() => {
      const el = document.getElementById('vDRECDGRCT');
      el.value = '140';
      if (typeof gx !== 'undefined') gx.evt.onchange(el);
    });
    await page.waitForTimeout(600);

    // Seleciona Sub Código: 2 (a - ICMS SUBSTITUIÇÃO TRIB.ENTRADAS EXTERNAS POR OPERAÇÃO)
    console.log('3b. Selecionando Sub Código: 2 (Por Operação)');
    await page.evaluate(() => {
      const elSub = document.getElementById('vSUBCDGRCT');
      if (elSub) {
        elSub.value = '2';
        if (typeof gx !== 'undefined') gx.evt.onchange(elSub);
      }
    });
    await page.waitForTimeout(400);

    // Preenche Nº Documento: 25101
    console.log('4. Preenchendo Nº Documento: 25101');
    await page.evaluate(() => {
      const el = document.getElementById('vDREDOCORI');
      el.value = '25101';
      if (typeof gx !== 'undefined') gx.evt.onchange(el);
    });

    // Preenche Chave da NFe (obrigatória para subcódigo 2)
    const chaveNFe = '21260803995515021083550020000251011000251020';
    console.log(`4b. Preenchendo Chave da NFe: ${chaveNFe}`);
    await page.evaluate((key) => {
      const elKey = document.getElementById('vDRENFECHV');
      if (elKey) {
        elKey.value = key;
        if (typeof gx !== 'undefined') gx.evt.onchange(elKey);
      }
    }, chaveNFe);

    // Preenche Data Vencimento: 09/09/2026 e Competência: 08/2026 (um mês antes!)
    console.log('5. Preenchendo Vencimento (09/09/2026) e Competência (08/2026)...');
    await page.evaluate(() => {
      const elDate = document.getElementById('vDREDTAVEN');
      elDate.value = '09/09/2026';
      if (typeof gx !== 'undefined') {
        gx.date.valid_date(elDate, 10, 'DMY', 0, 24, 'por', false, 0);
        gx.evt.onchange(elDate);
      }

      const elRef = document.getElementById('vDREREFCHAR');
      if (elRef) {
        elRef.value = '08/2026';
        if (typeof gx !== 'undefined') gx.evt.onchange(elRef);
      }
    });

    // Preenche Valor da Receita: 118,86
    console.log('6. Preenchendo Valor: 118,86');
    await page.evaluate(() => {
      const el = document.getElementById('vDREVLRPRI');
      el.value = '118,86';
      if (typeof gx !== 'undefined') gx.evt.onchange(el);
    });

    // Preenche Observação
    const obs = 'DARE ICMS ST REF COMPRA DE CAFE M MOIDO AVAC PCT 250G NA NF 25101 (MVA 26,5%)';
    console.log(`7. Preenchendo Observação: ${obs}`);
    await page.evaluate((text) => {
      const el = document.getElementById('vDREINFCOM');
      el.value = text;
      if (typeof gx !== 'undefined') gx.evt.onchange(el);
    }, obs);

    // Clica em Atualizar Valores
    console.log('8. Clicando em Atualizar Valores...');
    await page.evaluate(() => {
      const btn = document.querySelector('input[value="Atualizar Valores"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);

    const valTotal = await page.$eval('#vDREVLRTOT', el => el.value || el.innerText);
    console.log(`-> Valor Total após Atualizar Valores: ${valTotal}`);

    // Accept browser confirmation dialog: "Confirmar geração do DARE?"
    page.on('dialog', async (dialog) => {
      console.log(`[DIALOG ACEITO] Tipo: ${dialog.type()}, Mensagem: "${dialog.message()}"`);
      await dialog.accept();
    });

    // Agora clica em "Confirmar" para emitir a guia!
    console.log('9. Clicando em CONFIRMAR (BTN_ENTER)...');

    // Setup wait for navigation, download, or popup
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => null),
      page.click('input[name="BTN_ENTER"]')
    ]);

    await page.waitForTimeout(4000);

    console.log(`URL da página após Confirmar: ${page.url()}`);
    await page.screenshot({ path: 'test_sefaz_after_confirm_dialog.png', fullPage: true });
    console.log('Screenshot salva em test_sefaz_after_confirm_dialog.png');

    // Check if download occurred
    if (downloadCaptured) {
      const targetPdf = path.join(__dirname, 'DARE_NF_25101.pdf');
      await downloadCaptured.saveAs(targetPdf);
      console.log(`[SUCESSO] PDF baixado com sucesso via evento download: ${targetPdf}`);
    } else if (popupPageCaptured) {
      console.log(`Popup detectada com URL: ${popupPageCaptured.url()}`);
      await popupPageCaptured.waitForTimeout(3000);
      await popupPageCaptured.screenshot({ path: 'test_sefaz_popup.png' });
      // If it's a PDF URL or servlet, download its content
      const popupUrl = popupPageCaptured.url();
      if (popupUrl.includes('.pdf') || popupUrl.includes('report') || popupUrl.includes('servlet')) {
        const pdfBuffer = await popupPageCaptured.pdf().catch(() => null);
        if (pdfBuffer) {
          fs.writeFileSync(path.join(__dirname, 'DARE_NF_25101.pdf'), pdfBuffer);
          console.log('[SUCESSO] PDF salvo da popup.');
        }
      }
    } else {
      // Check if page contains links to PDF or embedded objects/iframes
      const pdfLinks = await page.$$eval('a, embed, iframe, object', els => {
        return els.map(e => ({ tag: e.tagName, src: e.src, href: e.href, text: e.innerText }));
      });
      console.log('Links / Embeds encontrados na página:', JSON.stringify(pdfLinks, null, 2));

      // Dump body text to see what confirmation message was presented
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Texto da página de confirmação:\n', bodyText.substring(0, 500));
    }

  } catch (err) {
    console.error('Erro durante teste de emissão:', err);
  } finally {
    await browser.close();
  }
}

testEmitSingleDARE();
