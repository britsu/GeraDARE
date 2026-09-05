const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda', { waitUntil: 'domcontentloaded' });
  await page.fill('#vINSCRICAOESTADUAL', '295153407');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('input[name="BUTTON1"]')
  ]);
  await page.waitForTimeout(1000);

  const munOrigemVal = await page.$eval('#vMUNCDGORI', el => el.value);
  const munOrigemText = await page.$eval('#vMUNCDGORI', el => el.options[el.selectedIndex]?.text);
  const munReceitaVal = await page.$eval('#vDRECDGMUN', el => el.value);
  const munReceitaText = await page.$eval('#vDRECDGMUN', el => el.options[el.selectedIndex]?.text);
  console.log('Mun Origem:', munOrigemVal, munOrigemText);
  console.log('Mun Receita (default):', munReceitaVal, munReceitaText);

  // Check if Araguaína is in vDRECDGMUN
  const munOptions = await page.$$eval('#vDRECDGMUN option', opts => opts.map(o => ({ value: o.value, text: o.text })));
  console.log('Total mun options in vDRECDGMUN:', munOptions.length);
  const araguaina = munOptions.find(o => o.text.includes('ARAGUAINA') || o.text.includes('ARAGUAÍNA'));
  console.log('Araguaína option:', araguaina);

  await browser.close();
})();
