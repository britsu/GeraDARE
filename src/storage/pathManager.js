const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Sanitizes a directory/file name for Windows filesystem:
 * Removes / \ : * ? " < > | and trims trailing dots and spaces.
 */
function sanitizeFileName(name) {
  if (!name) return 'INDEFINIDO';
  let clean = name.toString()
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Remove trailing dots
  clean = clean.replace(/\.+$/, '');
  return clean || 'INDEFINIDO';
}

/**
 * Standard PDF filename generator:
 * For ICMS ST: "DARE ICMS ST NF 12345 - NOME DA EMPRESA.pdf"
 * For FECOEP: "DARE FECOEP NF 12345 - NOME DA EMPRESA.pdf"
 */
function getStandardPdfName(nf, razaoSocial, revenueCode = '140') {
  const cleanEmpresa = sanitizeFileName(razaoSocial || '').trim();
  const codeStr = String(revenueCode);
  
  let prefix = 'DARE ICMS ST NF';
  let cleanNf = String(nf || '').replace('/', '-').trim();

  if (codeStr === '119' || codeStr.toUpperCase().includes('FECOEP')) {
    prefix = 'DARE FECOEP NF';
  } else if (codeStr === '643' || codeStr.toUpperCase().includes('FDE')) {
    prefix = 'DARE FDE';
    cleanNf = cleanNf.replace(/^FDE\s*/i, '').trim();
  } else if (codeStr === '130') {
    prefix = 'DARE ICMS ST APURACAO';
    cleanNf = cleanNf.replace(/^(ICMS\s*ST\s*APURA[CÇ][AÃ]O|ST-APURACAO)\s*/i, '').trim();
  } else if (codeStr === '110') {
    prefix = 'DARE ICMS NORMAL';
    cleanNf = cleanNf.replace(/^(ICMS\s*NORMAL)\s*/i, '').trim();
  }

  const label = cleanNf ? ` ${cleanNf}` : '';

  if (cleanEmpresa && cleanEmpresa !== 'INDEFINIDO') {
    return `${prefix}${label} - ${cleanEmpresa}.pdf`;
  }
  return `${prefix}${label}.pdf`;
}

/**
 * Checks if CNPJ is a branch (filial), i.e., doesn't end in /0001-XX or 0001XX.
 */
function isFilial(cnpj) {
  if (!cnpj) return false;
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) {
    const branchPart = digits.substring(8, 12);
    return branchPart !== '0001';
  }
  return false;
}

/**
 * Gets or creates the output directory for the batch run without overwriting existing folders.
 */
function resolveBatchDirectory({ baseDir, dueDateMonthYear, competenceMonthYear, monthYearFolder, razaoSocial, cnpj, createIfMissing = true, overridePath = null }) {
  if (overridePath) {
    const cleanOverride = path.resolve(overridePath);
    if (createIfMissing && !fs.existsSync(cleanOverride)) {
      fs.mkdirSync(cleanOverride, { recursive: true });
    }
    return {
      rootPath: path.dirname(path.dirname(cleanOverride)),
      monthYearPath: path.dirname(cleanOverride),
      targetPath: cleanOverride,
      clientFolderName: path.basename(cleanOverride),
      processamentoJsonPath: path.join(cleanOverride, 'processamento.json'),
      resultadoCsvPath: path.join(cleanOverride, 'resultado.csv')
    };
  }

  let root = baseDir || config.defaultOutputDir;
  try {
    if (!fs.existsSync(root)) {
      // If network drive Z: is not accessible, fallback to local directory
      root = config.fallbackOutputDir;
      if (!fs.existsSync(root) && createIfMissing) {
        fs.mkdirSync(root, { recursive: true });
      }
    }
  } catch {
    root = config.fallbackOutputDir;
    if (!fs.existsSync(root) && createIfMissing) {
      fs.mkdirSync(root, { recursive: true });
    }
  }

  // Monthly directory: MM-AAAA (Mês da competência tem prioridade estrita conforme regra de negócio)
  const targetMonthFolder = sanitizeFileName(competenceMonthYear || monthYearFolder || dueDateMonthYear || '00-0000').replace('/', '-');
  const monthYearPath = path.join(root, targetMonthFolder);
  if (createIfMissing && !fs.existsSync(monthYearPath)) {
    fs.mkdirSync(monthYearPath, { recursive: true });
  }

  // Client folder name
  let clientFolderName = sanitizeFileName(razaoSocial || 'CLIENTE');
  if (isFilial(cnpj)) {
    const digitsOnly = cnpj.replace(/\D/g, '');
    clientFolderName += ` - FILIAL CNPJ ${digitsOnly}`;
  }

  // Resolve directory ensuring non-overwrite
  let targetPath = path.join(monthYearPath, clientFolderName);

  // Check if directory exists and has completed processamento.json
  // If we want a new batch directory, check sequential (1), (2), etc.
  if (createIfMissing) {
    if (fs.existsSync(targetPath)) {
      // Check if this directory is already used and we need a new sequential folder
      const procJsonPath = path.join(targetPath, 'processamento.json');
      if (fs.existsSync(procJsonPath)) {
        let counter = 1;
        while (true) {
          const candidateName = `${clientFolderName} (${counter})`;
          const candidatePath = path.join(monthYearPath, candidateName);
          if (!fs.existsSync(candidatePath)) {
            targetPath = candidatePath;
            break;
          }
          // If candidate exists without processamento.json, it may be an empty folder we can use
          if (!fs.existsSync(path.join(candidatePath, 'processamento.json'))) {
            targetPath = candidatePath;
            break;
          }
          counter++;
        }
      }
    }

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
  }

  return {
    rootPath: root,
    monthYearPath,
    targetPath,
    clientFolderName: path.basename(targetPath),
    processamentoJsonPath: path.join(targetPath, 'processamento.json'),
    resultadoCsvPath: path.join(targetPath, 'resultado.csv')
  };
}

/**
 * Checks idempotency for a single invoice in a target folder.
 * Supports both standard "DARE ICMS ST NF [NUMERO] - [EMPRESA].pdf",
 * "DARE FECOEP NF [NUMERO] - [EMPRESA].pdf", and legacy names.
 */
function checkInvoiceIdempotency(targetDir, nf, expectedHash, razaoSocial = '', revenueCode = '140') {
  const stdName = getStandardPdfName(nf, razaoSocial, revenueCode);
  let resolvedPdfName = stdName;
  let resolvedPdfPath = path.join(targetDir, stdName);

  let fileExists = false;
  let hasValidSize = false;

  if (fs.existsSync(resolvedPdfPath)) {
    const stats = fs.statSync(resolvedPdfPath);
    fileExists = true;
    hasValidSize = stats.size > 0;
  } else if (fs.existsSync(targetDir)) {
    // Check if any matching PDF for this NF exists in directory
    try {
      const existingFiles = fs.readdirSync(targetDir);
      const codeStr = String(revenueCode);
      const isFecoep = codeStr === '119' || codeStr.toUpperCase().includes('FECOEP');
      const isFde = codeStr === '643' || codeStr.toUpperCase().includes('FDE');
      const isStApuracao = codeStr === '130';
      const isIcmsNormal = codeStr === '110';

      let match = null;
      if (isFde) {
        match = existingFiles.find(f => f.toUpperCase().startsWith('DARE FDE') && f.endsWith('.pdf'));
      } else if (isStApuracao) {
        match = existingFiles.find(f => f.toUpperCase().includes('DARE ICMS ST APURACAO') && f.endsWith('.pdf'));
      } else if (isIcmsNormal) {
        match = existingFiles.find(f => f.toUpperCase().includes('DARE ICMS NORMAL') && f.endsWith('.pdf'));
      } else if (isFecoep) {
        match = existingFiles.find(f => 
          f.startsWith(`DARE FECOEP NF ${nf} - `) ||
          f === `DARE FECOEP NF ${nf}.pdf` ||
          f.startsWith(`DARE ICMS FECOEP NF ${nf} - `) ||
          f === `DARE ICMS FECOEP NF ${nf}.pdf`
        );
        if (!match) {
          match = existingFiles.find(f => 
            f.toUpperCase().includes('FECOEP') && (f.includes(`NF ${nf} `) || f.includes(`NF_${nf}.`) || f.includes(`NF ${nf}.`))
          );
        }
      } else {
        match = existingFiles.find(f => 
          f.startsWith(`DARE ICMS ST NF ${nf} - `) ||
          f === `DARE ICMS ST NF ${nf}.pdf` ||
          f === `DARE_NF_${nf}.pdf`
        );
        if (!match) {
          match = existingFiles.find(f => 
            !f.toUpperCase().includes('FECOEP') && !f.toUpperCase().includes('FDE') && !f.toUpperCase().includes('APURACAO') && !f.toUpperCase().includes('NORMAL') && (f.includes(`NF ${nf} `) || f.includes(`NF_${nf}.`) || f.includes(`NF ${nf}.`))
          );
        }
      }

      if (match) {
        resolvedPdfName = match;
        resolvedPdfPath = path.join(targetDir, match);
        const stats = fs.statSync(resolvedPdfPath);
        fileExists = true;
        hasValidSize = stats.size > 0;
      }
    } catch {
      // Directory read error
    }
  }

  const procJsonPath = path.join(targetDir, 'processamento.json');
  let recordExists = false;
  let recordedSuccess = false;

  if (fs.existsSync(procJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(procJsonPath, 'utf8'));
      if (data && Array.isArray(data.notas)) {
        const found = data.notas.find(n => n.nf === nf && n.idempotencyHash === expectedHash);
        if (found) {
          recordExists = true;
          recordedSuccess = found.status === 'SUCESSO' || found.status === 'BAIXADA';
        }
      }
    } catch {
      // JSON read/parse failure
    }
  }

  const isAlreadyProcessed = fileExists && hasValidSize && recordedSuccess;

  return {
    isAlreadyProcessed,
    pdfPath: resolvedPdfPath,
    pdfName: resolvedPdfName,
    fileExists,
    hasValidSize,
    recordedSuccess
  };
}

module.exports = {
  sanitizeFileName,
  getStandardPdfName,
  isFilial,
  resolveBatchDirectory,
  checkInvoiceIdempotency
};
