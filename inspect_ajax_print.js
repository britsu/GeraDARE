const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('dialog', d => d.accept());

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('hnetccwkdapg') || url.includes('dare') || url.includes('report') || url.includes('relat') || url.includes('pdf')) {
      const ct = res.headers()['content-type'] || '';
      console.log(`[HTTP RESPONSE] ${res.status()} ${url} (${ct})`);
      if (ct.includes('json') || ct.includes('text') || ct.includes('javascript')) {
        const text = await res.text().catch(() => '');
        console.log(`[RESPONSE BODY] ${text.substring(0, 500)}`);
      }
    }
  });

  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded' });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
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

  await page.evaluate(() => document.querySelector('input[value="Atualizar Valores"]').click());
  await page.waitForTimeout(2000);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('input[name="BTN_ENTER"]')
  ]);

  console.log('Chegou em hnetccwkdapg!');
  await page.waitForTimeout(1500);

  // Click IMGIMPDARE
  console.log('Clicando em #IMGIMPDARE...');
  await page.click('#IMGIMPDARE');

  // Wait for response
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'test_sefaz_after_imgimpdare.png', fullPage: true });

  await browser.close();
})();
