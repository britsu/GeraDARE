const fs = require('fs');
const path = require('path');
const { parseSped, generateDebitsSpreadsheet } = require('../src/parser/spedParser');

const filePath = path.join(__dirname, 'SpedEFD-38598341000183-295062843-Remessa de arquivo original-ago.2026.txt');
const buffer = fs.readFileSync(filePath);
console.log('File size:', buffer.length);
const result = parseSped(buffer);
console.log(JSON.stringify(result, null, 2));

try {
  const excel = generateDebitsSpreadsheet(result);
  console.log('Excel generated, size:', excel.length);
} catch(e) {
  console.error('ERROR GENERATING EXCEL:', e);
}
