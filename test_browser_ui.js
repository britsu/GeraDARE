const { chromium } = require('playwright');
const path = require('path');
const { app } = require('./src/server');

(async () => {
  const server = app.listen(3458);
  console.log('Test server running on port 3458');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });

  try {
    await page.goto('http://localhost:3458', { waitUntil: 'networkidle' });
    console.log('Page loaded');

    // Set file input
    const fileInput = await page.$('#inputFile');
    await fileInput.setInputFiles(path.join(__dirname, 'ICMS ST MATRIZ.xlsx'));
    console.log('File set: ICMS ST MATRIZ.xlsx');

    // Fill IE
    await page.fill('#inputIE', '29.515.340-7');

    // Click Generate Preview
    await page.click('#btnGeneratePreview');
    // Wait for preview response (SEFAZ IE consultation takes a few seconds)
    await page.waitForFunction(() => {
      const btn = document.getElementById('btnGeneratePreview');
      return btn && !btn.disabled && !btn.innerText.includes('Carregando');
    }, { timeout: 30000 });

    // Verify FECOEP Banner is visible
    const bannerVisible = await page.$eval('#bannerFecoepDetected', el => !el.classList.contains('hidden'));
    console.log('Banner FECOEP visible:', bannerVisible);
    if (!bannerVisible) throw new Error('Banner FECOEP should be visible!');

    const countBadge = await page.$eval('#fecoepCountBadge', el => el.innerText);
    const totalBadge = await page.$eval('#fecoepTotalBadge', el => el.innerText);
    console.log('FECOEP badge count:', countBadge, 'total:', totalBadge);

    // Click Switch to FECOEP
    await page.click('#btnSwitchToFecoep');
    await page.waitForTimeout(500);

    // Verify metrics in FECOEP mode
    const totalNFs = await page.$eval('#metricTotalNFs', el => el.innerText);
    const totalST = await page.$eval('#metricTotalST', el => el.innerText);
    console.log('FECOEP mode - NFs:', totalNFs, 'Total:', totalST);

    // Verify rows in table
    const rowCount = await page.$$eval('#tableInvoicesBody tr', rows => rows.length);
    console.log('FECOEP table row count:', rowCount);

    // Test Itens Modal in FECOEP mode
    await page.click('#tableInvoicesBody tr:first-child button');
    await page.waitForTimeout(300);
    const modalTitle = await page.$eval('#modalTitle', el => el.innerText);
    console.log('Modal title in FECOEP mode:', modalTitle);
    if (!modalTitle.includes('FECOEP: R$ 4,78')) {
      throw new Error(`Modal title should include FECOEP: R$ 4,78, got: ${modalTitle}`);
    }
    await page.click('#btnCloseModal');
    await page.waitForTimeout(200);

    // Take screenshot of FECOEP UI
    await page.screenshot({ path: 'test_fecoep_ui.png', fullPage: true });
    console.log('Screenshot test_fecoep_ui.png saved successfully');

    // Test switching back to ST mode
    await page.click('#btnModeST');
    await page.waitForTimeout(500);
    const totalNFsST = await page.$eval('#metricTotalNFs', el => el.innerText);
    const totalSTval = await page.$eval('#metricTotalST', el => el.innerText);
    console.log('ST mode - NFs:', totalNFsST, 'Total:', totalSTval);

    console.log('UI Browser verification completed successfully!');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(err => {
  console.error('Browser UI Test Error:', err);
  process.exit(1);
});
