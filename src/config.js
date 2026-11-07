const path = require('path');

const config = {
  // Application metadata
  version: '1.0.0',
  appName: 'GeraDARE - Automação DARE ICMS ST SEFAZ/TO',

  // SEFAZ/TO Portal URL
  portalUrl: 'https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda',

  // Tax / Revenue Code Configurations
  revenueCodes: {
    '140': {
      code: '140',
      name: 'ICMS ST',
      description: 'ICMS SUBSTITUIÇÃO ENTRADA - OPERAÇÕES EXTERNAS',
      subCode: '2',
      documentType: 'Nota Fiscal',
      pdfPrefix: 'DARE ICMS ST NF'
    },
    '119': {
      code: '119',
      name: 'FECOEP',
      description: 'ICMS FUNDO ESTADUAL DE COMBATE A POBREZA POR APURAÇÃO',
      subCode: '5',
      documentType: 'OUTROS A ESPECIFICAR',
      documentTypeValue: '5',
      pdfPrefix: 'DARE FECOEP NF'
    },
    '130': {
      code: '130',
      name: 'ICMS ST APURAÇÃO',
      description: 'ICMS SUBSTITUIÇÃO SAÍDA - OPERAÇÕES INTERNAS',
      subCode: '1', // 'b - ICMS SUBSTITUIÇÃO TRIB. SAIDAS INTERNAS POR APURAÇÃO'
      documentType: 'OUTROS A ESPECIFICAR',
      documentTypeValue: '5',
      pdfPrefix: 'DARE ICMS ST APURACAO'
    },
    '643': {
      code: '643',
      name: 'FDE',
      description: 'FUNDO DE DESENVOLVIMENTO ECONÔMICO',
      subCode: '0',
      documentType: 'OUTROS A ESPECIFICAR',
      documentTypeValue: '5',
      pdfPrefix: 'DARE FDE'
    },
    '110': {
      code: '110',
      name: 'ICMS NORMAL',
      description: 'ICMS NORMAL - OPERAÇÕES PRÓPRIAS POR APURAÇÃO',
      subCode: '1', // 'b- - ICMS NORMAL POR APURAÇÃO'
      documentType: 'OUTROS A ESPECIFICAR',
      documentTypeValue: '5',
      pdfPrefix: 'DARE ICMS NORMAL'
    },
    '150': {
      code: '150',
      name: 'ICMS DIFAL',
      description: 'ICMS DIFERENCIAL DE ALÍQUOTA',
      subCode: '1', // '1' = Apuração, '2' = Operação
      documentType: 'OUTROS A ESPECIFICAR',
      documentTypeValue: '5',
      pdfPrefix: 'DARE ICMS DIFAL'
    }
  },

  // Default Tax / Revenue Settings
  defaultRevenueCode: '140',
  revenueCodeDescription: 'ICMS SUBSTITUIÇÃO ENTRADA - OPERAÇÕES EXTERNAS',
  defaultDocumentType: 'Nota Fiscal',

  // Storage / Output directory
  // Primary network directory specified in section 10 of spec
  defaultOutputDir: 'Z:\\DOCUMENTOS TEMPORÁRIOS\\LUIS HENRICK\\DARE',
  // Local fallback if Z: is inaccessible
  fallbackOutputDir: path.join(__dirname, '..', 'output', 'DARE'),

  // Processing modes: 'dry-run', 'preencher-e-revisar', 'emitir-lote-aprovado'
  defaultMode: 'dry-run',

  // Server port
  port: 3456,

  // Browser automation settings
  browser: {
    headless: true, // headless Chromium isolated in background
    timeoutMs: 30000,
    actionDelayMs: 300,
  }
};

module.exports = config;
