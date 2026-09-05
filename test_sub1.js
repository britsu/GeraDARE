const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded' });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('input[name="BUTTON1"]')]);
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    document.getElementById('vDRECDGMUN').value = '1701051';
    gx.evt.onchange(document.getElementById('vDRECDGMUN'));
    document.getElementById('vDRECDGRCT').value = '140';
    gx.evt.onchange(document.getElementById('vDRECDGRCT'));
  });

  await page.waitForFunction(() => {
    const el = document.getElementById('vSUBCDGRCT');
    return el && el.options && el.options.length > 1;
  });

  // Select subcode 1: por apuração
  await page.evaluate(() => {
    const el = document.getElementById('vSUBCDGRCT');
    el.value = '1';
    gx.evt.onchange(el);

    document.getElementById('vDREDOCORI').value = '25102';
    document.getElementById('vDREDTAVEN').value = '09/09/2026';
    gx.date.valid_date(document.getElementById('vDREDTAVEN'), 10, 'DMY', 0, 24, 'por', false, 0);
    gx.evt.onchange(document.getElementById('vDREDTAVEN'));

    document.getElementById('vDREREFCHAR').value = '08/2026';
    document.getElementById('vDREVLRPRI').value = '113,14';
    document.getElementById('vDREINFCOM').value = 'DARE ICMS ST REF COMPRA DE FRANGO NA NF 25102 (MVA 48,5%)';
  });

  await page.evaluate(() => document.querySelector('input[value="Atualizar Valores"]').click());
  await page.waitForTimeout(2000);

  const errorMsg = await page.$eval('#gxErrorViewer', el => el ? el.innerText.trim() : '').catch(() => '');
  console.log('Subcódigo 1 - Erro:', errorMsg || '(Nenhum erro!)');
  const val = await page.$eval('#vDREVLRTOT', el => el.value || el.innerText);
  console.log('Subcódigo 1 - Total:', val);

  await browser.close();
})();
