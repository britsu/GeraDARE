const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  await page.goto('http://localhost:3456', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\169b075a-4fbc-4add-bce0-d2d63b9ed75a';
  const outPath = path.join(artifactDir, 'geradare_enhanced_visualization.png');
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('Screenshot salvo em:', outPath);

  await browser.close();
})();
