const SefazClient = require('../src/portal/sefazClient');

async function testConsultIE() {
  const client = new SefazClient({ headless: true });
  console.log('Testing consultIE...');
  try {
    const info = await client.consultIE('295062843');
    console.log('Success:', info);
  } catch(e) {
    console.log('Error:', e.message);
  } finally {
    await client.close();
  }
}
testConsultIE();
