const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Unescapes literal PDF string characters.
 */
function unescapePdfString(str) {
  if (!str) return '';
  return str
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

/**
 * Extracts all text strings from a PDF buffer (specifically handles FlateDecode streams and escaped characters).
 */
function extractPdfText(pdfBuffer) {
  const str = pdfBuffer.toString('latin1');
  const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  const chunks = [];
  while ((m = regex.exec(str)) !== null) {
    try {
      const un = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
      // Tj text matching escaped characters: \(, \), \\, etc.
      const tjRegex = /\(((?:[^\\()]|\\[\s\S])*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(un)) !== null) {
        chunks.push(unescapePdfString(tjMatch[1]));
      }
      // TJ array text
      const tjArray = [...un.matchAll(/\[(.*?)\]\s*TJ/g)];
      for (const arr of tjArray) {
        const innerRegex = /\(((?:[^\\()]|\\[\s\S])*)\)/g;
        let innerMatch;
        const innerParts = [];
        while ((innerMatch = innerRegex.exec(arr[1])) !== null) {
          innerParts.push(unescapePdfString(innerMatch[1]));
        }
        if (innerParts.length > 0) chunks.push(innerParts.join(''));
      }
    } catch (e) {
      // Not a compressed stream or different compression
    }
  }
  return chunks;
}

/**
 * Parses fields from SEFAZ/TO DARE PDF.
 */
function parseDarePdf(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    return { success: false, error: `Arquivo PDF não encontrado: ${pdfPath}` };
  }

  const buffer = fs.readFileSync(pdfPath);
  const chunks = extractPdfText(buffer);

  // Inscrição Estadual: format 29.xxx.xxx-x
  const ieMatches = chunks.filter(c => /^\d{2}\.\d{3}\.\d{3}-\d$/.test(c.trim()));
  const ie = ieMatches.length > 0 ? ieMatches[0].trim() : null;

  // CNPJ: format xx.xxx.xxx/xxxx-xx
  const cnpjMatches = chunks.filter(c => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(c.trim()));
  const cnpj = cnpjMatches.length > 0 ? cnpjMatches[0].trim() : null;

  // Values: R$ X.XXX,XX
  const values = chunks.filter(c => /^R\$\s*[\d.,]+$/.test(c.trim())).map(c => {
    const cleanStr = c.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    return { raw: c, num };
  }).filter(v => !isNaN(v.num) && v.num > 0);

  const totalValue = values.length > 0 ? values[values.length - 1].num : null;
  const allValues = values.map(v => v.num);

  // Chave de acesso
  const chaveMatch = chunks.find(c => c.includes('CHAVE DE ACESSO DA NFE:'));
  const chaveAcesso = chaveMatch ? chaveMatch.replace('CHAVE DE ACESSO DA NFE:', '').trim() : '';

  // Razão Social (occurs in the taxpayer section, often right before the IE or in chunks)
  let razaoSocial = null;
  if (ie) {
    const ieIndex = chunks.findIndex(c => c.trim() === ie);
    if (ieIndex > 0 && chunks[ieIndex - 1] && !chunks[ieIndex - 1].startsWith('0') && chunks[ieIndex - 1].length > 3) {
      razaoSocial = chunks[ieIndex - 1].trim();
    }
  }

  // Observação / Informações complementares (handles multi-line wrapped text from SEFAZ)
  const obsChunks = chunks.filter(c => 
    c.includes('DARE ICMS ST') || 
    c.includes('DARE ICMS FECOEP') ||
    c.includes('DARE FECOEP') ||
    c.includes('FECOEP') ||
    c.includes('REF. COMPRA') ||
    c.includes('(MVA ') || 
    c.includes('NA NF ') ||
    c.includes('REF COMPRA DE')
  );
  const uniqueObsChunks = Array.from(new Set(obsChunks.map(c => c.trim()).filter(Boolean)));
  let observation = uniqueObsChunks.join(' ').replace(/\s+/g, ' ').trim();

  return {
    success: true,
    pdfPath,
    ie,
    cnpj,
    totalValue,
    allValues,
    chaveAcesso,
    razaoSocial,
    observation,
    allChunks: chunks
  };
}

/**
 * Normalizes an IE string by removing dots and dashes.
 */
function normalizeIE(ie) {
  return (ie || '').toString().replace(/\D/g, '');
}

/**
 * Validates a generated DARE PDF against the spreadsheet invoice and taxpayer info.
 * Confirms:
 * 1. Inscrição Estadual
 * 2. Total Value (ICMS ST)
 * 3. Informações Complementares (Observation)
 */
function validateDareAgainstInvoice(pdfPath, invoice, clientInfo) {
  const parsed = parseDarePdf(pdfPath);
  if (!parsed.success) {
    return {
      valid: false,
      pdfPath,
      errors: [parsed.error],
      checks: { ieMatch: false, valorMatch: false, obsMatch: false }
    };
  }

  const errors = [];
  const checks = {
    ieMatch: false,
    valorMatch: false,
    obsMatch: false
  };

  // 1. Inscrição Estadual validation
  const rawExpectedIE = clientInfo.ie || clientInfo.inscricaoEstadual || '';
  const expectedIE = normalizeIE(rawExpectedIE);
  const pdfIE = normalizeIE(parsed.ie);

  if (expectedIE && pdfIE && expectedIE === pdfIE) {
    checks.ieMatch = true;
  } else {
    // Decoded stream text check (never search raw binary compressed buffer)
    const decodedDigits = parsed.allChunks.join(' ').replace(/\D/g, '');
    if (expectedIE && decodedDigits.includes(expectedIE)) {
      checks.ieMatch = true;
    } else {
      errors.push(`Inscrição Estadual divergente: Esperado '${rawExpectedIE}' vs PDF '${parsed.ie || 'não identificada'}'`);
    }
  }

  // 2. Valor Guia (ICMS ST) validation
  const expectedValue = Math.round(invoice.valorGuia * 100) / 100;
  const matchedValue = (parsed.allValues || []).find(v => Math.abs(v - expectedValue) <= 0.05);

  if (matchedValue !== undefined || (parsed.totalValue !== null && Math.abs(parsed.totalValue - expectedValue) <= 0.05)) {
    checks.valorMatch = true;
  } else if (parsed.totalValue !== null) {
    errors.push(`Valor divergente: Planilha R$ ${expectedValue.toFixed(2)} vs PDF R$ ${parsed.totalValue.toFixed(2)}`);
  } else {
    errors.push(`Valor total não encontrado no PDF.`);
  }

  // 3. Informações Complementares validation
  const rawChunksText = parsed.allChunks.join(' ');
  const codeStr = String(invoice.codigoReceita || '');
  const isSpedDebt = codeStr === '643' || codeStr === '130' || codeStr === '110' || invoice.tipo === 'FDE' || invoice.tipo === 'ICMS_ST_APURACAO' || invoice.tipo === 'ICMS_NORMAL';

  if (isSpedDebt) {
    const isFde = codeStr === '643' || invoice.tipo === 'FDE';
    const isIcmsNormal = codeStr === '110' || invoice.tipo === 'ICMS_NORMAL';
    let debtMatched = false;
    if (isFde) {
      debtMatched = rawChunksText.toUpperCase().includes('FDE') || 
                    rawChunksText.toUpperCase().includes('CUSTEIO') || 
                    rawChunksText.includes('643');
    } else if (isIcmsNormal) {
      debtMatched = rawChunksText.toUpperCase().includes('NORMAL') || 
                    rawChunksText.toUpperCase().includes('OPERAÇÕES PRÓPRIAS') || 
                    rawChunksText.toUpperCase().includes('OPERACOES PROPRIAS') || 
                    rawChunksText.includes('110');

      if (rawChunksText.toUpperCase().includes('POR OPERAÇÃO') || rawChunksText.toUpperCase().includes('POR OPERACAO')) {
        errors.push('Sub-código incorreto no DARE: ICMS Normal foi gerado por OPERAÇÃO, mas é devido à APURAÇÃO do mês.');
        debtMatched = false;
      }
    } else {
      debtMatched = rawChunksText.toUpperCase().includes('SUBSTITUIÇÃO') || 
                    rawChunksText.toUpperCase().includes('SUBSTITUICAO') || 
                    rawChunksText.includes('130') || 
                    rawChunksText.toUpperCase().includes('TARE');
    }
    checks.obsMatch = debtMatched;
    if (!debtMatched) {
      const debtLabel = isFde ? 'FDE' : (isIcmsNormal ? 'ICMS NORMAL' : 'ICMS ST');
      errors.push(`Informações complementares do débito SPED (${debtLabel}) não encontradas no PDF.`);
    }
  } else {
    // Must verify that NF number and all distinct MVAs from the invoice are present in the PDF text
    const hasNF = rawChunksText.includes(invoice.nf);
    
    // Extract all distinct MVAs for this invoice
    const expectedMVAs = Array.isArray(invoice.items) 
      ? Array.from(new Set(invoice.items.map(it => it.mva ? it.mva.str : '').filter(Boolean)))
      : [];

    const mvasFound = expectedMVAs.length === 0 || expectedMVAs.every(mva => {
      const cleanMva = String(mva).trim();
      const numPart = cleanMva.replace('%', '').trim();
      const escDot = numPart.replace(',', '.').replace('.', '\\.');
      const escComma = numPart.replace('.', ',').replace(',', '\\,');
      // Match either "MVA 26,5", "MVA 26.5" or "26,5%", "26.5%"
      const pattern = new RegExp(`(?:MVA\\s*[:=]?\\s*(?:${escDot}|${escComma})|(?:${escDot}|${escComma})\\s*%)`, 'i');
      return pattern.test(rawChunksText);
    });

    // Check if primary product name or observation prefix is present
    const hasObsPrefix = rawChunksText.includes('DARE ICMS ST') || 
                         rawChunksText.includes('DARE ICMS FECOEP') || 
                         rawChunksText.includes('DARE FECOEP') || 
                         rawChunksText.includes('FECOEP') || 
                         rawChunksText.includes('REF COMPRA') ||
                         rawChunksText.includes('REF. COMPRA');

    const isFecoep = String(invoice.codigoReceita) === '119' || invoice.tipoGuia === 'FECOEP';
    let chaveMatch = true;
    if (isFecoep && invoice.chaveAcesso) {
      chaveMatch = rawChunksText.includes(invoice.chaveAcesso) || rawChunksText.replace(/\D/g, '').includes(invoice.chaveAcesso);
    }

    if (hasNF && mvasFound && chaveMatch && (expectedMVAs.length === 0 || hasObsPrefix)) {
      checks.obsMatch = true;
    } else {
      const missing = [];
      if (!hasNF) missing.push(`NF ${invoice.nf}`);
      if (!mvasFound) missing.push(`MVA (${expectedMVAs.join(', ')})`);
      if (!hasObsPrefix) missing.push('cabeçalho DARE');
      if (!chaveMatch) missing.push('Chave NFe');
      errors.push(`Informações complementares divergentes no PDF. Não encontrado: ${missing.join('; ')}`);
    }
  }

  const valid = checks.ieMatch && checks.valorMatch && checks.obsMatch && errors.length === 0;

  return {
    valid,
    pdfPath,
    checks,
    extracted: {
      ie: parsed.ie,
      cnpj: parsed.cnpj,
      valor: matchedValue !== undefined ? matchedValue : parsed.totalValue,
      allValues: parsed.allValues,
      chaveAcesso: parsed.chaveAcesso,
      observation: parsed.observation
    },
    expected: {
      ie: rawExpectedIE,
      valor: expectedValue,
      nf: invoice.nf
    },
    errors
  };
}

module.exports = {
  extractPdfText,
  parseDarePdf,
  validateDareAgainstInvoice,
  normalizeIE,
  unescapePdfString
};

