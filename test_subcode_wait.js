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

  // Set revenue code 140
  console.log('Selecionando código 140...');
  await page.evaluate(() => {
    const el = document.getElementById('vDRECDGRCT');
    el.value = '140';
    gx.evt.onchange(el);
  });

  // Explicitly wait for subcode options to populate!
  console.log('Aguardando opções de subcódigo...');
  await page.waitForFunction(() => {
    const elSub = document.getElementById('vSUBCDGRCT');
    return elSub && elSub.options && elSub.options.length > 1;
  }, { timeout: 10000 });

  const opts = await page.$$eval('#vSUBCDGRCT option', o => o.map(x => ({ value: x.value, text: x.text })));
  console.log('Subcode options loaded successfully:', opts);

  // Now set subcode 2
  console.log('Selecionando subcódigo 2...');
  await page.evaluate(() => {
    const elSub = document.getElementById('vSUBCDGRCT');
    elSub.value = '2';
    gx.evt.onchange(elSub);
  });
  await page.waitForTimeout(500);

  // Fill NF 25102
  console.log('Preenchendo campos da NF 25102...');
  await page.evaluate(() => {
    document.getElementById('vDRECDGMUN').value = '1701051';
    gx.evt.onchange(document.getElementById('vDRECDGMUN'));

    document.getElementById('vDREDOCORI').value = '25102';
    gx.evt.onchange(document.getElementById('vDREDOCORI'));

    document.getElementById('vDRENFECHV').value = '21260803995515021083550020000251021000251035';
    gx.evt.onchange(document.getElementById('vDRENFECHV'));

    document.getElementById('vDREDTAVEN').value = '09/09/2026';
    gx.date.valid_date(document.getElementById('vDREDTAVEN'), 10, 'DMY', 0, 24, 'por', false, 0);
    gx.evt.onchange(document.getElementById('vDREDTAVEN'));

    document.getElementById('vDREREFCHAR').value = '08/2026';
    gx.evt.onchange(document.getElementById('vDREREFCHAR'));

    document.getElementById('vDREVLRPRI').value = '113,14';
    gx.evt.onchange(document.getElementById('vDREVLRPRI'));

    document.getElementById('vDREINFCOM').value = 'DARE ICMS ST REF COMPRA DE FRANGO NA NF 25102 (MVA 48,5%)';
    gx.evt.onchange(document.getElementById('vDREINFCOM'));
  });

  console.log('Clicando em Atualizar Valores...');
  await page.evaluate(() => document.querySelector('input[value="Atualizar Valores"]').click());
  await page.waitForTimeout(3000);

  const errorMsg = await page.$eval('#gxErrorViewer', el => el ? el.innerText.trim() : '').catch(() => '');
  console.log('Mensagem de erro após Atualizar Valores:', errorMsg || '(Nenhum erro!)');

  const valTotal = await page.$eval('#vDREVLRTOT', el => el.value || el.innerText);
  console.log('Valor Total retornado:', valTotal);

  // Accept dialog
  page.on('dialog', d => d.accept());

  console.log('Testando clique em Confirmar (BTN_ENTER)...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
    page.click('input[name="BTN_ENTER"]')
  ]);

  await page.waitForTimeout(2000);
  console.log('URL após Confirmar:', page.url());

  const imgPrint = await page.$('#IMGIMPDARE');
  if (imgPrint) {
    console.log('[SUCESSO!] Botão Imprimir DARE está disponível!');
    await page.click('#IMGIMPDARE');
    await page.waitForTimeout(2000);
    const pdfRes = await page.context().request.get('https://www.sefaz.to.gov.br/dare/servlet/arccrlda');
    console.log('Status PDF:', pdfRes.status());
    const buf = await pdfRes.body();
    console.log(`[DOWNLOAD SUCESSO] Tamanho do PDF da NF 25102: ${buf.length} bytes!`);
    const fs = require('fs');
    const zDir = 'Z:\\DOCUMENTOS TEMPORÁRIOS\\LUIS HENRICK\\DARE\\09-2026\\S A MENDANHA LTDA - ME (2)';
    fs.writeFileSync(require('path').join(zDir, 'DARE_NF_25102.pdf'), buf);
    console.log('Salvo DARE_NF_25102.pdf em', zDir);
  } else {
    console.log('[FALHA] Não foi para a tela de impressão. Texto da tela:', await page.evaluate(() => document.body.innerText.substring(0, 300)));
  }

  await browser.close();
})();
