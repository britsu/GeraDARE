const server = require('../src/server');
const batchWorker = require('../src/worker/batchWorker');
const SefazClient = require('../src/portal/sefazClient');

console.log('Testing startBatch with visualize: true');
try {
  batchWorker.startBatch({
    clientInfo: { ie: '123', codMunOrigem: '1' },
    groupedData: { invoices: [] },
    dueDateInfo: { dateStr: '01/01/2026' },
    visualize: true
  }).catch(e => console.log('Error in startBatch:', e.message));

  console.log('SefazClient headless:', batchWorker.sefazClient.headless);
} catch(e) {
  console.log('Exception:', e.message);
}
