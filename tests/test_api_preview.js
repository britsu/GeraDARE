const fs = require('fs');
const path = require('path');

async function testApi() {
  const filePath = path.join(__dirname, 'SpedEFD-38598341000183-295062843-Remessa de arquivo original-ago.2026.txt');
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer]);

  const formData = new FormData();
  formData.append('file', blob, 'SpedEFD-38598341000183-295062843-Remessa de arquivo original-ago.2026.txt');
  formData.append('dueDate', '09/09/2026');
  formData.append('revenueCode', '140');

  const res = await fetch('http://localhost:3456/api/preview', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  console.log('Preview API Response Keys:', Object.keys(data));
  if(data.error) console.log('Error:', data.error);
  else {
    console.log('Invoices count:', data.invoices?.length);
    console.log('Is SPED:', data.isSped);
  }
}
testApi();
