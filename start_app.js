const { startServer } = require('./src/server');
const { exec } = require('child_process');
const fs = require('fs');

const PORT = 3456;
const APP_URL = `http://localhost:${PORT}`;

const server = startServer(PORT);

// Launch in Desktop App Window mode
setTimeout(() => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  if (fs.existsSync(edgePath)) {
    console.log(`Iniciando interface desktop no Microsoft Edge App Mode...`);
    exec(`"${edgePath}" --app=${APP_URL} --window-size=1280,900`);
  } else if (fs.existsSync(chromePath)) {
    console.log(`Iniciando interface desktop no Google Chrome App Mode...`);
    exec(`"${chromePath}" --app=${APP_URL} --window-size=1280,900`);
  } else {
    console.log(`Iniciando no navegador padrão...`);
    exec(`start ${APP_URL}`);
  }
}, 1000);
