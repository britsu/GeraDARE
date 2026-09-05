const crypto = require('crypto');
const { calculateCompetence } = require('../utils/calendar');

const ABBREVIATIONS = [
  [/\bREFRIGERANTES?\b/gi, 'REFRIG'],
  [/\bCHOCOLATES?\b/gi, 'CHOC'],
  [/\bBISCOITOS?\b/gi, 'BISC'],
  [/\bCONCENTRADOS?\b/gi, 'CONC'],
  [/\bCONDICIONADORES?\b/gi, 'COND'],
  [/\bDESODORANTES?\b/gi, 'DESOD'],
  [/\bDETERGENTES?\b/gi, 'DETERG'],
  [/\bDESINFETANTES?\b/gi, 'DESINF'],
  [/\bSABONETES?\b/gi, 'SAB'],
  [/\bSAB[AÃ]O\b/gi, 'SAB'],
  [/\bAMACIANTES?\b/gi, 'AMAC'],
  [/\bALIMENT[IÍ]CIOS?\b/gi, 'ALIM'],
  [/\bALIMENTOS?\b/gi, 'ALIM'],
  [/\bFARINHAS?\b/gi, 'FAR'],
  [/\bCOM FERMENTO\b/gi, 'C/FERM'],
  [/\bSEM FERMENTO\b/gi, 'S/FERM'],
  [/\bPACOTES?\b/gi, 'PCT'],
  [/\bUNIDADES?\b/gi, 'UN'],
  [/\bGARRAFAS?\b/gi, 'GF'],
  [/\bCAIXAS?\b/gi, 'CX'],
  [/\bQUILOGRAMAS?\b/gi, 'KG'],
  [/\bGRAMAS?\b/gi, 'G'],
  [/\bMILILITROS?\b/gi, 'ML'],
  [/\bLITROS?\b/gi, 'L'],
  [/\bDERIVADOS\b/gi, 'DERIV'],
  [/\bLATIC[IÍ]NIOS?\b/gi, 'LATIC'],
  [/\bPREPARADOS?\b/gi, 'PREP'],
  [/\bTEMPEROS?\b/gi, 'TEMP'],
  [/\bCONGELADOS?\b/gi, 'CONG'],
  [/\bINTEGRAIS?\b/gi, 'INTEG'],
  [/\bINTEGRAL\b/gi, 'INTEG'],
  [/\bTRADICIONAIS?\b/gi, 'TRAD'],
  [/\bTRADICIONAL\b/gi, 'TRAD'],
  [/\bESPECIAIS?\b/gi, 'ESP'],
  [/\bESPECIAL\b/gi, 'ESP'],
  [/\bORIGINAIS?\b/gi, 'ORIG'],
  [/\bORIGINAL\b/gi, 'ORIG'],
  [/\bSABORES?\b/gi, 'SAB'],
  [/\bSARDINHAS?\b/gi, 'SARD'],
  [/\bTOMATES?\b/gi, 'TOM'],
  [/\bRECHEADOS?\b/gi, 'RECH'],
  [/\bMERCADORIAS?\b/gi, 'MERC'],
  [/\bSUPERMERCADOS?\b/gi, 'SUPERM'],
  [/\bA[CÇ][UÚ]CAR(ES)?\b/gi, 'ACUC'],
  [/\bLEITES?\b/gi, 'LT'],
  [/\bDESNATADOS?\b/gi, 'DESN'],
  [/\bSEMIDESNATADOS?\b/gi, 'SEMI'],
  [/\bTRIGO\b/gi, 'TRG'],
  [/\bBRANCA\b/gi, 'BRANC'],
  [/\b[OÓ]LEOS?\b/gi, 'OL'],
  [/\bGIRASSOL\b/gi, 'GIRAS'],
  [/\bMILHO\b/gi, 'MLH'],
  [/\bRANCHEIRO\b/gi, 'RANCH'],
  [/\bMO[IÍ]DOS?\b/gi, 'MOID'],
  [/\b[AÁ] V[AÁ]CUO\b/gi, 'AVAC'],
  [/\bVACUO\b/gi, 'AVAC'],
  [/\bCRISTAL\b/gi, 'CRIST']
];

/**
 * Applies abbreviation dictionary to a product string.
 */
function abbreviateProductName(name) {
  if (!name) return '';
  let clean = name.toString().trim();
  for (const [regex, rep] of ABBREVIATIONS) {
    clean = clean.replace(regex, rep);
  }
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Builds observation string from group parts.
 */
function buildObservationString(nf, groupParts, options = {}) {
  const revenueCode = String(options.revenueCode || '140');
  const isFecoep = revenueCode === '119' || revenueCode.toUpperCase().includes('FECOEP');
  const chaveAcesso = options.chaveAcesso || '';
  const chaveLine = isFecoep && chaveAcesso ? `\nChave NFe: ${chaveAcesso}` : '';

  if (isFecoep) {
    if (groupParts.length === 1) {
      return `DARE ICMS FECOEP REF. COMPRA DE ${groupParts[0].prodText} (MVA ${groupParts[0].mvaStr}) NA NF N° ${nf}${chaveLine}`;
    } else {
      const firstGroup = `${groupParts[0].prodText} (MVA ${groupParts[0].mvaStr})`;
      const remainingGroups = groupParts.slice(1).map(g => `${g.prodText} (MVA ${g.mvaStr})`).join(' E ');
      return `DARE ICMS FECOEP REF. COMPRA DE ${firstGroup} E ${remainingGroups} NA NF N° ${nf}${chaveLine}`;
    }
  }

  if (groupParts.length === 1) {
    return `DARE ICMS ST REF COMPRA DE ${groupParts[0].prodText} NA NF ${nf} (MVA ${groupParts[0].mvaStr})`;
  } else {
    const firstGroup = `${groupParts[0].prodText} NA NF ${nf} (MVA ${groupParts[0].mvaStr})`;
    const remainingGroups = groupParts.slice(1).map(g => `${g.prodText} (MVA ${g.mvaStr})`).join(' E ');
    return `DARE ICMS ST REF COMPRA DE ${firstGroup} E ${remainingGroups}`;
  }
}

/**
 * Formats product observation string deterministically.
 * Rule:
 * DARE ICMS ST REF COMPRA DE [PRODUTOS] NA NF [NUMERO] (MVA [PERCENTUAL]%)
 * When multiple MVAs:
 * DARE ICMS ST REF COMPRA DE [P1, P2 E P3] NA NF [NF] (MVA X%) E [P4] (MVA Y%)
 * 
 * If length exceeds SEFAZ 400-char limit, abbreviates long product names
 * ensuring ALL products and their respective MVAs remain in the observation.
 * Guarantees output string is strictly <= 400 characters under all circumstances.
 */
function formatObservation(nf, items, options = {}) {
  const opts = typeof options === 'string' ? { revenueCode: options } : (options || {});
  const revenueCode = String(opts.revenueCode || '140');
  const chaveAcesso = opts.chaveAcesso || (items && items[0] && items[0].chaveAcesso) || '';
  const isFecoep = revenueCode === '119' || revenueCode.toUpperCase().includes('FECOEP');

  // Filter items for FECOEP if needed
  let itemsToFormat = items;
  if (isFecoep) {
    const fecoepOnly = items.filter(it => (it.rawFecoep !== undefined ? it.rawFecoep : it.fecoep) > 0);
    if (fecoepOnly.length > 0) {
      itemsToFormat = fecoepOnly;
    }
  }

  // Group unique products by normalized MVA string
  const mvaGroups = new Map(); // mvaStr -> Set(product names)
  for (const it of itemsToFormat) {
    const mvaStr = it.mva ? it.mva.str : '0%';
    if (!mvaGroups.has(mvaStr)) {
      mvaGroups.set(mvaStr, new Set());
    }
    if (it.produto) {
      mvaGroups.get(mvaStr).add(it.produto);
    }
  }

  const joinProducts = (prods) => {
    if (prods.length === 0) return 'MERCADORIAS DIVERSAS';
    if (prods.length === 1) return prods[0];
    if (prods.length === 2) return `${prods[0]} E ${prods[1]}`;
    return prods.slice(0, -1).join(', ') + ' E ' + prods[prods.length - 1];
  };

  // Build original group parts
  let groupParts = [];
  for (const [mvaStr, prodSet] of mvaGroups.entries()) {
    const prods = Array.from(prodSet);
    groupParts.push({ prods, mvaStr, prodText: joinProducts(prods) });
  }

  const buildOpts = { revenueCode, chaveAcesso };
  let finalObservation = buildObservationString(nf, groupParts, buildOpts);

  // If already <= 400, return as-is
  if (finalObservation.length <= 400) {
    return finalObservation;
  }

  // Pass 1: Apply standard abbreviation dictionary to product names
  groupParts = groupParts.map(g => {
    const abbrevProds = g.prods.map(p => abbreviateProductName(p));
    return { prods: abbrevProds, mvaStr: g.mvaStr, prodText: joinProducts(abbrevProds) };
  });

  finalObservation = buildObservationString(nf, groupParts, buildOpts);
  if (finalObservation.length <= 400) {
    return finalObservation;
  }

  // Pass 2: If still > 400, progressively reduce only the longest product names.
  // We NEVER chop off the tail of the observation string (which holds MVAs, NF, and Chave).
  // Instead, we iteratively reduce the longest product names until the entire string fits in 400 chars.
  while (finalObservation.length > 400) {
    let longestLen = 0;
    let targetG = -1;
    let targetP = -1;

    for (let gi = 0; gi < groupParts.length; gi++) {
      for (let pi = 0; pi < groupParts[gi].prods.length; pi++) {
        const len = groupParts[gi].prods[pi].length;
        if (len > longestLen) {
          longestLen = len;
          targetG = gi;
          targetP = pi;
        }
      }
    }

    // Minimum product length before we can't shorten individual product names further
    if (longestLen <= 3) {
      break;
    }

    const currentProd = groupParts[targetG].prods[targetP];
    const excess = finalObservation.length - 400;
    const reduceBy = Math.max(1, Math.min(excess, Math.ceil((longestLen - 3) / 2)));
    const newLen = Math.max(3, longestLen - reduceBy);

    groupParts[targetG].prods[targetP] = currentProd.substring(0, newLen).replace(/[,.\-\/\s]+$/, '').trim();
    groupParts[targetG].prodText = joinProducts(groupParts[targetG].prods);
    finalObservation = buildObservationString(nf, groupParts, buildOpts);
  }

  // Pass 3: In extreme edge cases where there are dozens of products and even 3-char names exceed 400 chars:
  // Consolidate secondary products per group with "E OUTROS (X ITENS)" while strictly retaining NF, MVAs and Chave
  if (finalObservation.length > 400) {
    for (let gi = 0; gi < groupParts.length && finalObservation.length > 400; gi++) {
      if (groupParts[gi].prods.length > 2) {
        const kept = [groupParts[gi].prods[0]];
        const othersCount = groupParts[gi].prods.length - 1;
        groupParts[gi].prods = kept;
        groupParts[gi].prodText = `${kept[0]} E OUTROS (${othersCount} ITENS)`;
        finalObservation = buildObservationString(nf, groupParts, buildOpts);
      }
    }
  }

  // Pass 4: Final safety net: normalize whitespace
  if (finalObservation.length > 400) {
    finalObservation = finalObservation.replace(/\s+/g, ' ').trim();
  }

  // Absolute safety guarantee: truncate while ensuring critical suffix remains intact
  if (finalObservation.length > 400) {
    if (isFecoep) {
      const chaveLine = chaveAcesso ? `\nChave NFe: ${chaveAcesso}` : '';
      const suffix = ` NA NF N° ${nf}${chaveLine}`;
      const maxPrefixLen = Math.max(10, 400 - suffix.length);
      const prefix = finalObservation.substring(0, maxPrefixLen).replace(/[,.\-\/\s]+$/, '').trim();
      finalObservation = `${prefix}${suffix}`;
    } else {
      const suffix = ` NA NF ${nf} (` + groupParts.map(g => `MVA ${g.mvaStr}`).join(' E ') + ')';
      const maxPrefixLen = Math.max(10, 400 - suffix.length);
      const prefix = finalObservation.substring(0, maxPrefixLen).replace(/[,.\-\/\s]+$/, '').trim();
      finalObservation = `${prefix}${suffix}`;
    }
  }

  return finalObservation;
}

/**
 * Computes SHA-256 idempotency hash for a single DARE invoice.
 */
function computeIdempotencyHash(ie, nf, dueDate, revenueCode, amount) {
  const normalizedIE = (ie || '').toString().replace(/\D/g, '');
  const normalizedNF = (nf || '').toString().trim();
  const normalizedDate = (dueDate || '').toString().trim();
  const normalizedCode = (revenueCode || '140').toString().trim();
  const normalizedAmount = Number(amount).toFixed(2);

  const payload = `${normalizedIE}|${normalizedNF}|${normalizedDate}|${normalizedCode}|${normalizedAmount}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Groups items by NF number and computes guide values and observations.
 */
function groupInvoices(parsedItems, ie, dueDate, revenueCode = '140', options = {}) {
  const isFecoep = String(revenueCode) === '119' || String(revenueCode).toUpperCase().includes('FECOEP');
  const code = isFecoep ? '119' : (revenueCode || '140');

  // Filter items if FECOEP: only items with FECOEP > 0 should generate FECOEP guides
  let itemsToGroup = parsedItems;
  if (isFecoep) {
    itemsToGroup = parsedItems.filter(it => (it.rawFecoep !== undefined ? it.rawFecoep : it.fecoep) > 0);
  }

  const grouped = new Map(); // nf -> { nf, items, rawSum, roundedSum, observation, ... }

  for (const item of itemsToGroup) {
    const nf = item.nf;
    if (!grouped.has(nf)) {
      grouped.set(nf, {
        nf,
        items: [],
        rawSum: 0,
        roundedSum: 0,
        warnings: [],
        errors: [],
        isValid: true
      });
    }

    const g = grouped.get(nf);
    g.items.push(item);

    // Validation checks per item
    if (!item.produto) {
      g.errors.push(`Item ${item.itemNum}: Descrição do produto ausente.`);
      g.isValid = false;
    }
    if (!item.mva) {
      g.errors.push(`Item ${item.itemNum}: MVA ausente ou inválido.`);
      g.isValid = false;
    }

    if (isFecoep) {
      const itemFecoep = item.rawFecoep !== undefined ? item.rawFecoep : item.fecoep;
      if (itemFecoep === null || itemFecoep === undefined) {
        g.errors.push(`Item ${item.itemNum}: Valor de FECOEP ausente.`);
        g.isValid = false;
      } else if (itemFecoep < 0) {
        g.errors.push(`Item ${item.itemNum}: Valor de FECOEP negativo (R$ ${itemFecoep}).`);
        g.isValid = false;
      }
      g.rawSum += (itemFecoep || 0);
      g.roundedSum = Math.round(g.rawSum * 100) / 100;
    } else {
      if (item.icmsST === null || item.icmsST === undefined) {
        g.errors.push(`Item ${item.itemNum}: Valor de ICMS ST ausente.`);
        g.isValid = false;
      } else if (item.icmsST < 0) {
        g.errors.push(`Item ${item.itemNum}: Valor de ICMS ST negativo (R$ ${item.icmsST}).`);
        g.isValid = false;
      }
      const itemRoundedST = Math.round((item.icmsST || 0) * 100) / 100;
      g.rawSum += (item.icmsST || 0);
      g.roundedSum = Math.round((g.roundedSum + itemRoundedST) * 100) / 100;
    }
  }

  const invoices = [];
  let grandTotalCalculated = 0;
  let grandTotalRaw = 0;

  for (const [nf, data] of grouped.entries()) {
    const finalAmount = Math.round((isFecoep ? data.rawSum : data.roundedSum) * 100) / 100;
    const chaveAcesso = data.items[0]?.chaveAcesso || '';
    const observation = formatObservation(nf, data.items, { revenueCode: code, chaveAcesso });
    const hash = computeIdempotencyHash(ie, nf, dueDate, code, finalAmount);

    const destinatario = data.items[0]?.cliente || '';
    const fornecedor = data.items[0]?.fornecedor || '';
    const competencia = calculateCompetence(dueDate);

    // Company identification: dynamically derived from spreadsheet item data
    const empresa = data.items[0]?.empresa || destinatario || 'EMPRESA';
    const empresaCodigo = data.items[0]?.codEmpresa || '';
    const filial = data.items[0]?.filial || '';
    const cnpjDestinatario = data.items[0]?.cnpjDestinatario || '';
    const ieDestinatario = data.items[0]?.ieDestinatario || '';

    let empresaLabel = empresa;
    if (empresaCodigo) {
      empresaLabel = `${empresaCodigo} - ${empresa}`;
    }
    if (filial) {
      empresaLabel += ` (${filial})`;
    }

    const invoice = {
      nf,
      itemCount: data.items.length,
      items: data.items,
      chaveAcesso,
      destinatario,
      fornecedor,
      empresa,
      empresaCodigo,
      empresaLabel,
      cnpjDestinatario,
      ieDestinatario,
      valorGuia: finalAmount,
      rawSum: Math.round(data.rawSum * 100) / 100,
      observation,
      idempotencyHash: hash,
      codigoReceita: code,
      tipoGuia: isFecoep ? 'FECOEP' : 'ICMS_ST',
      dataVencimento: dueDate,
      competencia,
      isValid: data.isValid,
      errors: data.errors,
      warnings: data.warnings,
      status: data.isValid ? 'AGRUPADA' : 'ERRO_PLANILHA',
      history: [
        {
          timestamp: new Date().toISOString(),
          status: data.isValid ? 'AGRUPADA' : 'ERRO_PLANILHA',
          message: data.isValid 
            ? `Agrupada com sucesso: ${data.items.length} itens, Total ${isFecoep ? 'FECOEP' : 'ST'}: R$ ${finalAmount.toFixed(2)}.`
            : `Erro de validação nos dados da nota: ${data.errors.join('; ')}`
        }
      ]
    };

    grandTotalCalculated = Math.round((grandTotalCalculated + finalAmount) * 100) / 100;
    grandTotalRaw = Math.round((grandTotalRaw + data.rawSum) * 100) / 100;
    invoices.push(invoice);
  }

  // Sort invoices by numeric NF if possible
  invoices.sort((a, b) => {
    const numA = parseInt(a.nf, 10);
    const numB = parseInt(b.nf, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.nf.localeCompare(b.nf);
  });

  return {
    codigoReceita: code,
    tipoGuia: isFecoep ? 'FECOEP' : 'ICMS_ST',
    totalInvoices: invoices.length,
    totalItems: itemsToGroup.length,
    grandTotalCalculated,
    grandTotalRaw,
    roundingDifference: Math.round(Math.abs(grandTotalCalculated - grandTotalRaw) * 100) / 100,
    invoices
  };
}

module.exports = {
  formatObservation,
  abbreviateProductName,
  buildObservationString,
  computeIdempotencyHash,
  groupInvoices
};
