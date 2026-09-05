const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded' });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('input[name="BUTTON1"]')
  ]);
  await page.waitForTimeout(1000);

  // Fill form for NF 25102
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

  const nf = '25102';
  const chave = '21260803995515021083550020000251021000251035';
  console.log(`Testando NF ${nf} com chave ${chave} (tamanho: ${chave.length})...`);

  await page.evaluate(({ nf, chave }) => {
    document.getElementById('vDREDOCORI').value = nf;
    document.getElementById('vDRENFECHV').value = chave;
    document.getElementById('vDREDTAVEN').value = '09/09/2026';
    gx.date.valid_date(document.getElementById('vDREDTAVEN'), 10, 'DMY', 0, 24, 'por', false, 0);
    document.getElementById('vDREREFCHAR').value = '08/2026';
    document.getElementById('vDREVLRPRI').value = '113,14';
    document.getElementById('vDREINFCOM').value = 'DARE ICMS ST REF COMPRA DE FRANGO NA NF 25102 (MVA 48,5%)';
  }, { nf, chave });

  await page.evaluate(() => document.querySelector('input[value="Atualizar Valores"]').click());
  await page.waitForTimeout(3000);

  const errorText = await page.$eval('#gxErrorViewer', el => el ? el.innerText.trim() : '').catch(() => '');
  console.log('Erro retornado:', errorText);

  const valTotal = await page.$eval('#vDREVLRTOT', el => el.value || el.innerText);
  console.log('Valor total retornado:', valTotal);

  await page.screenshot({ path: 'test_nf_25102_error.png', fullPage: true });

  await browser.close();
})();
