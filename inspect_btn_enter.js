const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda');
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await page.click('input[name="BUTTON1"]');
  await page.waitForTimeout(2000);
  
  const btn = await page.$eval('input[name="BTN_ENTER"]', el => ({
    outerHTML: el.outerHTML,
    onclick: el.getAttribute('onclick'),
    disabled: el.disabled
  }));
  console.log('BTN_ENTER:', JSON.stringify(btn, null, 2));

  // Also check all form attributes and scripts
  const formAction = await page.$eval('form', f => ({
    action: f.action,
    method: f.method,
    name: f.name,
    id: f.id,
    target: f.target
  }));
  console.log('FORM:', JSON.stringify(formAction, null, 2));

  await browser.close();
})();
