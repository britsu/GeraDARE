const fs = require('fs');
const path = require('path');
const { parseSped } = require('../src/parser/spedParser');
async function run() {
  const filePath = path.join(__dirname, 'SpedEFD-38598341000183-295062843-Remessa de arquivo original-ago.2026.txt');
  const fileBuffer = fs.readFileSync(filePath);
  console.log('--- Calling parseSped directly ---');
  const result = parseSped(fileBuffer);
  console.log('Empresa:', result.company.razaoSocial);
  console.log('Total Débitos:', result.debits.length);
  console.log('Totais (Calculado):', result.summary.grandTotalCalculated);
  console.log('\\n--- Calling POST /api/preview ---');
  const form = new FormData();
  const blob = new Blob([fileBuffer]);
  form.append('file', blob, path.basename(filePath));
  const response = await fetch('http://localhost:3456/api/preview', {
    method: 'POST',
    body: form
  });
  const data = await response.json();
  console.log('isSped:', data.isSped);
  console.log('invoices count:', data.invoices ? data.invoices.length : 0);
  if (data.isSped && data.invoices && data.invoices.length > 0) {
    console.log('TEST PASSED');
  } else {
    console.log('TEST FAILED');
  }
}
run().catch(console.error);
