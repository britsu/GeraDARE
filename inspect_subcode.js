const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await page.click('input[name="BUTTON1"]');
  await page.waitForTimeout(2000);

  page.on('request', r => console.log('REQ:', r.url()));
  page.on('response', r => console.log('RES:', r.url(), r.status()));
  console.log('Selecionando código 140...');
  await page.evaluate(() => {
    const el = document.getElementById('vDRECDGRCT');
    el.value = '140';
    if (typeof gx !== 'undefined') gx.evt.onchange(el);
  });
  await page.waitForTimeout(2500);

  const subOptions = await page.$$eval('#vSUBCDGRCT option', opts => opts.map(o => ({ value: o.value, text: o.text })));
  console.log('Opções de Sub Código para 140:', JSON.stringify(subOptions, null, 2));

  console.log('Selecionando subcódigo 2...');
  await page.evaluate(() => {
    const el = document.getElementById('vSUBCDGRCT');
    el.value = '2';
    if (typeof gx !== 'undefined') gx.evt.onchange(el);
  });
  await page.waitForTimeout(2500);

  await browser.close();
})();
