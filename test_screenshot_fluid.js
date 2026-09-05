const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:3456', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    // Start ETAEngine with 8 notes
    ETAEngine.start(8);

    // Simulate note 4, step 2 (as in user screenshot)
    const totalInvoices = 8;
    const invoiceIndex = 4;
    const subStepIndex = 2;
    const totalGlobalSteps = totalInvoices * 6;
    const currentGlobalStep = ((invoiceIndex - 1) * 6) + subStepIndex;
    const fluidPct = Math.min(99.5, Math.max(1, Math.round(((currentGlobalStep / totalGlobalSteps) * 100) * 10) / 10));

    const pBar = document.getElementById('progressBar');
    const pPct = document.getElementById('progressPercentage');
    const pTxt = document.getElementById('progressText');
    const bSub = document.getElementById('badgeSubStepPill');
    const sSub = document.getElementById('progressSubStepText');

    pBar.style.width = `${fluidPct}%`;
    pPct.innerText = `${fluidPct.toFixed(1)}%`;
    pTxt.innerText = 'Processando: 4 de 8 (NF 25243)';
    if (bSub) {
      bSub.classList.remove('hidden');
      bSub.innerText = 'Passo 2/6';
    }
    if (sSub) {
      sSub.innerHTML = '<i class="fa-solid fa-layer-group text-indigo-500 mr-1"></i>Passo 2/6: <strong>Preenchendo campos fiscais (NF 25243, R$ 669.79)...</strong>';
    }

    updateVisualStepper(2, '25243', 'Preenchendo campos fiscais (NF 25243, R$ 669.79)...');
    ETAEngine.updateStep(2, 4, 8);
  });

  await page.waitForTimeout(1500);
  const stepperSection = await page.$('#sectionLiveStepper');
  if (stepperSection) {
    const outPath = path.join(__dirname, 'test_fluid_progress_stepper.png');
    await stepperSection.screenshot({ path: outPath });
    console.log('Screenshot salva com sucesso em:', outPath);
  }
  await browser.close();
})();
