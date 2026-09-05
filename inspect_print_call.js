const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('dialog', d => d.accept());

  // Listen to all network requests & responses
  page.on('request', req => console.log(`[REQ] ${req.method()} ${req.url()}`));
  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('pdf') || url.includes('pdf') || url.includes('relat') || url.includes('report') || url.includes('dare')) {
      console.log(`[RESP] ${res.status()} ${url} (${ct})`);
    }
  });

  // Listen to popups
  context.on('page', async p => {
    console.log(`[CONTEXT POPUP] ${p.url()}`);
    await p.waitForTimeout(3000);
    console.log(`[POPUP TITLE] ${await p.title()} URL: ${p.url()}`);
    const buf = await p.pdf().catch(() => null);
    if (buf) {
      fs.writeFileSync('popup_saved.pdf', buf);
      console.log('Salvo popup_saved.pdf!');
    }
  });

  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded' });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('input[name="BUTTON1"]')
  ]);
  await page.waitForTimeout(1000);

  // Fill form
  await page.evaluate(() => {
    document.getElementById('vDRECDGMUN').value = '1701051';
    gx.evt.onchange(document.getElementById('vDRECDGMUN'));
  });
  await page.waitForTimeout(300);

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
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('input[name="BTN_ENTER"]')
  ]);

  console.log('Chegou em hnetccwkdapg!');

  // Intercept window.open before clicking
  await page.evaluate(() => {
    window._openedUrls = [];
    const origOpen = window.open;
    window.open = function(url, name, specs) {
      window._openedUrls.push(url);
      return origOpen ? origOpen.apply(this, arguments) : null;
    };
  });

  // Click on IMGIMPDARE
  console.log('Clicando em #IMGIMPDARE...');
  await page.click('#IMGIMPDARE');
  await page.waitForTimeout(4000);

  const openedUrls = await page.evaluate(() => window._openedUrls || []);
  console.log('URLs interceptadas via window.open:', openedUrls);

  // Check if any links or iframes were added
  const iframes = await page.$$eval('iframe', ifs => ifs.map(f => f.src));
  console.log('IFRAMES na página:', iframes);

  await browser.close();
})();
