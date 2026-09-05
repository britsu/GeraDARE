const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { app } = require('../src/server');

async function runEndpointTests() {
  console.log('--- Testando Endpoints do Servidor Express ---');
  
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  function request(method, pathUrl, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(pathUrl, baseUrl);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, text: data });
          }
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  try {
    // 1. Test /api/open-folder with local directory
    console.log('[TEST] POST /api/open-folder com diretório local...');
    const localDir = path.join(__dirname, '..');
    const resOpen = await request('POST', '/api/open-folder', { folderPath: localDir });
    assert.strictEqual(resOpen.status, 200);
    assert.strictEqual(resOpen.data.success, true);
    assert.strictEqual(resOpen.data.opened, path.resolve(localDir));
    // 1b. Test /api/open-folder without parameters (fallback)
    console.log('[TEST] POST /api/open-folder sem parâmetros...');
    const resOpenEmpty = await request('POST', '/api/open-folder', {});
    assert.strictEqual(resOpenEmpty.status, 200);
    assert.strictEqual(resOpenEmpty.data.success, true);
    assert(resOpenEmpty.data.opened, 'Deve retornar o caminho aberto');
    console.log('[PASS] POST /api/open-folder sem parâmetros resolveu e abriu diretório padrão.');

    // 1c. Test /api/validate-batch
    console.log('[TEST] POST /api/validate-batch...');
    const testDir = 'Z:\\DOCUMENTOS TEMPORÁRIOS\\LUIS HENRICK\\DARE\\09-2026\\S A MENDANHA LTDA - ME (2)';
    if (fs.existsSync(testDir)) {
      const resVal = await request('POST', '/api/validate-batch', {
        targetDir: testDir,
        clientInfo: { ie: '295613181', razaoSocial: 'S A MENDANHA LTDA' },
        invoices: [{ nf: '25101', valorGuia: 118.86, items: [{ mva: { str: '26,5%' } }] }]
      });
      assert.strictEqual(resVal.status, 200);
      assert.strictEqual(resVal.data.success, true);
      assert.strictEqual(resVal.data.results[0].validation.valid, true);
      console.log('[PASS] POST /api/validate-batch validou com sucesso.');
    }

    // 2. Test /api/preview without default company hardcoded
    console.log('[TEST] POST /api/preview sem IE...');
    const resPreview = await request('POST', '/api/preview', { dueDate: '09/09/2026' });
    assert.strictEqual(resPreview.status, 200);
    assert(resPreview.data.summary, 'Deve retornar summary');
    assert.strictEqual(resPreview.data.summary.totalInvoices, 10);
    assert(Array.isArray(resPreview.data.distinctCompanies), 'Deve listar distinctCompanies');
    assert(resPreview.data.distinctCompanies.length > 0, 'Deve identificar empresas');
    console.log(`[PASS] POST /api/preview identificou ${resPreview.data.distinctCompanies.length} empresas distintas dinamicamente.`);

    // 3. Test /api/analyze-date
    console.log('[TEST] POST /api/analyze-date...');
    const resDate = await request('POST', '/api/analyze-date', { dateStr: '09/09/2026' });
    assert.strictEqual(resDate.status, 200);
    assert.strictEqual(resDate.data.competencia, '08/2026');
    assert.strictEqual(resDate.data.isNonBusinessDay, false);
    console.log('[PASS] POST /api/analyze-date analisou vencimento e competência com sucesso.');

    console.log('\nTodos os testes de endpoints passaram!');
  } finally {
    server.close();
  }
}

runEndpointTests().catch(err => {
  console.error('Erro nos testes de endpoints:', err);
  process.exit(1);
});
