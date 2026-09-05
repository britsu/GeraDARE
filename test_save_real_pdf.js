const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testSaveRealPDF() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('dialog', d => d.accept());

  console.log('1. Navegando para SEFAZ...');
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
    // Competência é um mês antes da data de vencimento: 08/2026
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

  console.log('2. Confirmado! Chegou na tela de pagamento. Clicando em Imprimir DARE...');
  await page.waitForTimeout(1000);

  // Click #IMGIMPDARE
  await page.click('#IMGIMPDARE');
  await page.waitForTimeout(2000);

  // Fetch the PDF using context.request with the same session cookies
  console.log('3. Baixando PDF diretamente via context.request...');
  const pdfResponse = await context.request.get('https://www.sefaz.to.gov.br/dare/servlet/arccrlda');
  console.log('Status da requisição PDF:', pdfResponse.status());
  const pdfBuffer = await pdfResponse.body();

  const targetPdf = path.join(__dirname, 'DARE_NF_25101.pdf');
  fs.writeFileSync(targetPdf, pdfBuffer);
  console.log(`[SUCESSO ABSOLUTO] PDF baixado e salvo em ${targetPdf}! Tamanho: ${pdfBuffer.length} bytes.`);

  // Verify header is %PDF
  const header = pdfBuffer.slice(0, 5).toString('ascii');
  console.log(`Cabeçalho do arquivo: ${header}`);

  // Also copy to destination folder Z:\DOCUMENTOS TEMPORÁRIOS\LUIS HENRICK\DARE\09-2026\S A MENDANHA LTDA - ME (2)
  const zFolder = 'Z:\\DOCUMENTOS TEMPORÁRIOS\\LUIS HENRICK\\DARE\\09-2026\\S A MENDANHA LTDA - ME (2)';
  if (fs.existsSync(zFolder)) {
    fs.copyFileSync(targetPdf, path.join(zFolder, 'DARE_NF_25101.pdf'));
    console.log(`[SUCESSO] Copiado para a pasta de destino: ${path.join(zFolder, 'DARE_NF_25101.pdf')}`);
  }

  await browser.close();
}

testSaveRealPDF();
