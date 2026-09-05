const SefazClient = require('../src/portal/sefazClient');
async function test() {
  const client = new SefazClient({ headless: false });
  await client.init();
  console.log('Browser created with headless:', client.headless);
  setTimeout(() => client.close(), 5000);
}
test();
