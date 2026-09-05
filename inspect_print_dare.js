const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('dialog', d => d.accept());

  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded' });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null),
    page.click('input[name="BUTTON1"]')
  ]);
  await page.waitForTimeout(1000);

  // Fill form
  await page.evaluate(() => {
    document.getElementById('vDRECDGMUN').value = '1701051';
    gx.evt.onchange(document.getElementById('vDRECDGMUN'));
  });
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    document.getElementById('vDRECDGRCT').value = '140';
    gx.evt.onchange(document.getElementById('vDRECDGRCT'));
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.getElementById('vSUBCDGRCT').value = '2';
    gx.evt.onchange(document.getElementById('vSUBCDGRCT'));
  });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    document.getElementById('vDREDOCORI').value = '25101';
    document.getElementById('vDRENFECHV').value = '21260803995515021083550020000251011000251020';
    document.getElementById('vDREDTAVEN').value = '09/09/2026';
    gx.date.valid_date(document.getElementById('vDREDTAVEN'), 10, 'DMY', 0, 24, 'por', false, 0);
    document.getElementById('vDREREFCHAR').value = '08/2026';
    document.getElementById('vDREVLRPRI').value = '118,86';
    document.getElementById('vDREINFCOM').value = 'DARE ICMS ST REF COMPRA DE CAFE M MOIDO AVAC PCT 250G NA NF 25101 (MVA 26,5%)';
  });

  // Atualizar Valores
  await page.evaluate(() => document.querySelector('input[value="Atualizar Valores"]').click());
  await page.waitForTimeout(2000);

  // Confirmar
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('input[name="BTN_ENTER"]')
  ]);

  console.log('Chegou na tela de pagamento/impressão:', page.url());

  // Dump all clickable elements (images, buttons, links, text)
  const items = await page.$$eval('img, a, input, table, span', els => {
    return els.filter(e => {
      const txt = (e.innerText || e.alt || e.title || e.id || e.src || '').toLowerCase();
      return txt.includes('imprimir') || txt.includes('dare') || txt.includes('pix');
    }).map(e => ({
      tag: e.tagName,
      id: e.id,
      name: e.name,
      src: e.src,
      alt: e.alt,
      onclick: e.getAttribute('onclick'),
      text: e.innerText
    }));
  });

  console.log('Elementos de impressão encontrados:', JSON.stringify(items, null, 2));

  // Now test clicking "Imprimir DARE"
  console.log('Testando clique em Imprimir DARE...');
  const [downloadOrPopup] = await Promise.all([
    context.waitForEvent('page').catch(() => null),
    page.click('text="Imprimir DARE"')
  ]);

  if (downloadOrPopup) {
    console.log('Popup aberta! URL:', downloadOrPopup.url());
    await downloadOrPopup.waitForTimeout(3000);
    await downloadOrPopup.screenshot({ path: 'test_sefaz_pdf_popup.png' });
    console.log('Screenshot salva em test_sefaz_pdf_popup.png');
  } else {
    console.log('Nenhuma popup aberta diretamente, verificando se baixou algo ou abriu iframe...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test_sefaz_after_click_print.png', fullPage: true });
  }

  await browser.close();
})();
