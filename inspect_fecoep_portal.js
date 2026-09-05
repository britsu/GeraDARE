const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('Navigating to SEFAZ portal...');
  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('input[name="BUTTON1"]')
  ]);
  await page.waitForTimeout(1500);

  // Select 119
  console.log('Selecting revenue code 119...');
  await page.evaluate(() => {
    const el = document.getElementById('vDRECDGRCT');
    el.value = '119';
    if (typeof gx !== 'undefined') gx.evt.onchange(el);
  });

  // Wait for subcodes
  await page.waitForFunction(() => {
    const elSub = document.getElementById('vSUBCDGRCT');
    return elSub && elSub.options && elSub.options.length > 1;
  }, { timeout: 10000 });

  // Select subcode 5
  console.log('Selecting subcode 5...');
  await page.evaluate(() => {
    const el = document.getElementById('vSUBCDGRCT');
    el.value = '5';
    if (typeof gx !== 'undefined') gx.evt.onchange(el);
  });
  await page.waitForTimeout(1500);

  // Check vDRETDCORI options
  const docTypes = await page.$$eval('#vDRETDCORI option', opts => opts.map(o => ({ value: o.value, text: o.text })));
  console.log('vDRETDCORI options:', JSON.stringify(docTypes, null, 2));

  const currentDocType = await page.$eval('#vDRETDCORI', el => ({ value: el.value, text: el.options[el.selectedIndex]?.text }));
  console.log('Current selected document type:', currentDocType);

  // Now let's test filling the fields as given in the user example:
  // Data Vencimento: 09/09/2026
  // Competência: 08/2026
  // Valor da Receita: 4,78
  // Município: ARAGUAÍNA (1702109)
  // Observação:
  // DARE ICMS FECOEP REF. COMPRA DE VINHO PERGOLA TTO SUAVE (MVA 55,55%) NA NF N° 25168
  // Chave NFe: 21260803995515021083550020000251681000251690

  const obsText = `DARE ICMS FECOEP REF. COMPRA DE VINHO PERGOLA TTO SUAVE (MVA 55,55%) NA NF N° 25168\nChave NFe: 21260803995515021083550020000251681000251690`;

  await page.evaluate(({ obsText }) => {
    // Município: ARAGUAÍNA (1702109)
    const elMun = document.getElementById('vDRECDGMUN');
    if (elMun) {
      elMun.value = '1702109';
      if (typeof gx !== 'undefined' && gx.O) gx.O.AV10DreCdgMun = 1702109;
    }

    // Data Vencimento
    const elDate = document.getElementById('vDREDTAVEN');
    if (elDate) {
      elDate.value = '09/09/2026';
      if (typeof gx !== 'undefined') {
        if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREDTAVEN', '09/09/2026', 0);
        if (gx.date && gx.date.valid_date) gx.date.valid_date(elDate, 10, 'DMY', 0, 24, 'por', false, 0);
        if (gx.O) gx.O.AV20DreDtaVen = '09/09/2026';
      }
    }

    // Competência
    const elRef = document.getElementById('vDREREFCHAR');
    if (elRef) {
      elRef.value = '08/2026';
      if (typeof gx !== 'undefined') {
        if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREREFCHAR', '08/2026', 0);
        if (gx.O) gx.O.AV84DreRefChar = '08/2026';
      }
    }

    // Valor Receita
    const elVal = document.getElementById('vDREVLRPRI');
    if (elVal) {
      elVal.value = '4,78';
      if (typeof gx !== 'undefined') {
        if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREVLRPRI', '4,78', 0);
        if (gx.O) gx.O.AV39DreVlrPri = 4.78;
      }
    }

    // Observações
    const elObs = document.getElementById('vDREINFCOM');
    if (elObs) {
      elObs.value = obsText;
      if (typeof gx !== 'undefined') {
        if (gx.fn && gx.fn.setControlValue) gx.fn.setControlValue('vDREINFCOM', obsText, 0);
        if (gx.O) gx.O.AV23DreInfCom = obsText;
      }
    }
  }, { obsText });

  console.log('Fields populated. Clicking Atualizar Valores...');
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

  const valTotal = await page.$eval('#vDREVLRTOT', el => el.value || el.innerText);
  console.log('Valor Total retornado após Atualizar Valores:', valTotal);

  const errorViewer = await page.$eval('#gxErrorViewer', el => el ? el.innerText.trim() : '').catch(() => '');
  console.log('Error viewer content:', errorViewer || '(None)');

  await page.screenshot({ path: 'test_fecoep_updated.png', fullPage: true });

  await browser.close();
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
