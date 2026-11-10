const XLSX = require('xlsx');

// Essential columns that MUST be present in the spreadsheet
const ESSENTIAL_COLUMNS = [
  'Nº Nota',
  'Descrição do Produto',
  '%MVA',
  'ICMS ST'
];

/**
 * Normalizes header string for comparison: removes accents, symbols, spaces, lowercase.
 */
function normalizeHeaderName(name) {
  if (!name) return '';
  return name
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9]/g, '')    // keep only alphanumeric
    .toLowerCase();
}

/**
 * Normalizes MVA values:
 * Decimal representations:
 * 0.265  -> { num: 26.5,   str: '26,5%' }
 * 0.76   -> { num: 76,     str: '76%' }
 * 0.9969 -> { num: 99.69,  str: '99,69%' }
 * 1.0614 -> { num: 106.14, str: '106,14%' }
 * 1.50   -> { num: 150,    str: '150%' }
 * Percentage representations:
 * '26.50%' -> { num: 26.5,   str: '26,5%' }
 * '76%'    -> { num: 76,     str: '76%' }
 * '106,14%'-> { num: 106.14, str: '106,14%' }
 * 26.5     -> { num: 26.5,   str: '26,5%' }
 * 76       -> { num: 76,     str: '76%' }
 * 106.14   -> { num: 106.14, str: '106,14%' }
 */
function normalizeMVA(val) {
  if (val === null || val === undefined || val === '') return null;
  const rawStr = val.toString().trim();
  const hasPercent = rawStr.includes('%');
  const cleanStr = rawStr.replace('%', '').trim().replace(',', '.');
  let num = parseFloat(cleanStr);
  if (isNaN(num)) return null;

  // If the input already contains '%', num is already the percentage value (e.g. '106,14%' -> 106.14).
  // If no '%', numbers in decimal format (e.g. 0.265 = 26.5%, 0.9969 = 99.69%, 1.0614 = 106.14%, 2.0 = 200%)
  // must be multiplied by 100.
  // In Brazilian ICMS ST, MVA is a markup margin that is never a single-digit percentage (e.g. 1% or 2%).
  // Values entered as whole percentages without '%' are >= 10 (e.g. 26.5, 40, 76, 99.69, 106.14).
  // Any value < 10.0 without '%' represents a decimal ratio (e.g. 0.265 for 26.5%, 1.0614 for 106.14%).
  if (!hasPercent) {
    if (num > 0 && num < 10.0) {
      num = num * 100;
    }
  }

  num = Math.round(num * 100) / 100;
  let strVal = num.toString().replace('.', ',');
  return {
    num,
    str: `${strVal}%`
  };
}

/**
 * Parses numeric currency / decimal values:
 * Handles ' R$ 1,130.52 ', '1130.52', '1.130,52', etc.
 */
function parseDecimal(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Math.round(val * 100) / 100;

  let str = val.toString().trim();
  // Remove currency symbol and whitespace
  str = str.replace(/R\$/gi, '').replace(/\s/g, '');

  if (str === '' || str === '-') return 0.0;

  // Check if Brazilian format: has comma as decimal separator
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Brazilian format: 1.130,52 -> 1130.52
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,130.52 -> 1130.52
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 1130,52 -> 1130.52
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

/**
 * Extrai dados do contribuinte (I.E., CNPJ, Razão Social) a partir da planilha.
 * Suporta metadados no topo, aba 'Contribuinte' / 'Metadados', e colunas por item.
 */
function extractTaxpayerFromWorkbook(wb, rawRows, headerRowIndex, items) {
  let ie = '';
  let cnpj = '';
  let razaoSocial = '';
  let uf = 'TO';
  let codMun = '';
  let nomeMun = '';
  let competencia = '';

  // 1. Procurar em aba dedicada 'Contribuinte' ou 'Dados do Contribuinte' ou 'Metadados'
  if (wb && wb.SheetNames) {
    const contribSheetName = wb.SheetNames.find(n =>
      /contribuinte|metadado|empresa/i.test(n)
    );
    if (contribSheetName && wb.Sheets[contribSheetName]) {
      const cRows = XLSX.utils.sheet_to_json(wb.Sheets[contribSheetName], { header: 1, defval: '' });
      for (const row of cRows) {
        if (!row || row.length === 0) continue;
        const key = (row[0] || '').toString().toLowerCase().trim();
        const val = (row[1] || row[2] || '').toString().trim();
        if (/inscri[cç][aã]o|i\.?e\.?/i.test(key) && !ie && val) {
          ie = val.replace(/\D/g, '');
        } else if (/cnpj|cpf/i.test(key) && !cnpj && val) {
          cnpj = val.replace(/\D/g, '');
        } else if (/raz[aã]o|nome|contribuinte/i.test(key) && !razaoSocial && val) {
          razaoSocial = val;
        } else if (/^uf$/i.test(key) && val) {
          uf = val.toUpperCase().trim();
        } else if (/munic[ií]pio|c[oó]d.*mun/i.test(key) && val) {
          if (/^\d+$/.test(val)) codMun = val;
          else nomeMun = val;
        } else if (/compet[eê]ncia|per[ií]odo/i.test(key) && !competencia && val) {
          competencia = val;
        }
      }
    }
  }

  // 2. Procurar em linhas de cabeçalho / metadados pré-tabela (linhas 0 até headerRowIndex)
  if (rawRows && headerRowIndex >= 0) {
    for (let r = 0; r <= headerRowIndex; r++) {
      const row = rawRows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const text = (row[c] || '').toString().trim();
        if (!text) continue;

        // IE pattern: IE: 295153407 ou Inscrição Estadual: 29.515.340-7
        if (!ie) {
          const ieMatch = text.match(/(?:inscri[cç][aã]o\s*estadual|i\.?e\.?)\s*[:=]?\s*([0-9.\-/]{7,20})/i);
          if (ieMatch) ie = ieMatch[1].replace(/\D/g, '');
        }
        // CNPJ pattern: CNPJ: 43.037.906/0001-93 ou CNPJ: 43037906000193
        if (!cnpj) {
          const cnpjMatch = text.match(/(?:cnpj|cpf)\s*[:=]?\s*([0-9.\-/]{11,20})/i);
          if (cnpjMatch) cnpj = cnpjMatch[1].replace(/\D/g, '');
        }
        // Razão Social pattern: Contribuinte: ... ou Razão Social: ...
        if (!razaoSocial) {
          const rzMatch = text.match(/(?:contribuinte|raz[aã]o\s*social|empresa)\s*[:=]?\s*([^|\r\n;]+)/i);
          if (rzMatch) razaoSocial = rzMatch[1].trim();
        }
      }
    }
  }

  // 3. Prioridade concreta: se os itens da planilha tiverem colunas de Destinatário / CNPJ / IE,
  // eles representam as notas fiscais autênticas do lote e prevalecem sobre metadados legados.
  if (items && items.length > 0) {
    const itemWithCnpj = items.find(i => i.cnpjDestinatario && i.cnpjDestinatario.replace(/\D/g, '').length >= 11);
    if (itemWithCnpj) cnpj = itemWithCnpj.cnpjDestinatario.replace(/\D/g, '');

    const itemWithIE = items.find(i => i.ieDestinatario && i.ieDestinatario.replace(/\D/g, '').length >= 7);
    if (itemWithIE) ie = itemWithIE.ieDestinatario.replace(/\D/g, '');

    const itemWithClient = items.find(i => (i.empresa || i.cliente) && (i.empresa || i.cliente).trim() !== 'EMPRESA APURADA');
    if (itemWithClient) razaoSocial = (itemWithClient.empresa || itemWithClient.cliente).trim();

    if (!competencia) {
      const itemWithDate = items.find(i => i.emissao || i.data);
      if (itemWithDate) {
        const rawDate = (itemWithDate.emissao || itemWithDate.data || '').toString();
        const matchBR = rawDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchBR) {
          competencia = `${matchBR[2]}/${matchBR[3]}`;
        }
      }
    }
  }

  // 4. Fallback em propriedades do workbook (se houver subject ou comment estruturado)
  if (!ie && wb && wb.Props && wb.Props.Subject) {
    const subMatch = wb.Props.Subject.match(/IE:(\d+)/i);
    if (subMatch) ie = subMatch[1];
    const cnpjMatch = wb.Props.Subject.match(/CNPJ:(\d+)/i);
    if (cnpjMatch && !cnpj) cnpj = cnpjMatch[1];
  }

  return {
    ie: ie || '',
    inscricaoEstadual: ie || '',
    cnpj: cnpj || '',
    razaoSocial: razaoSocial || '',
    uf: uf || 'TO',
    codMun: codMun || '',
    nomeMun: nomeMun || '',
    competencia: competencia || ''
  };
}

/**
 * Checks if a row is a summary or total row that must be excluded.
 */
function isTotalOrAuxiliaryRow(nfValue) {
  if (!nfValue) return true;
  const str = nfValue.toString().trim().toUpperCase();
  if (str === '') return true;
  if (str === 'TOTAIS' || str === 'TOTAL' || str.startsWith('TOTAL ') || str.startsWith('TOTAIS ')) {
    return true;
  }
  return false;
}

/**
 * Reads and parses an XLSX buffer or file path.
 */
function parseExcel(input) {
  let wb;
  if (typeof input === 'string') {
    wb = XLSX.readFile(input);
  } else if (Buffer.isBuffer(input)) {
    wb = XLSX.read(input, { type: 'buffer' });
  } else {
    throw new Error('Entrada inválida para leitura de planilha.');
  }

  const sheetNames = wb.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('A planilha está vazia (sem abas).');
  }

  // Find Planilha1 or use first sheet
  const targetSheetName = sheetNames.includes('Planilha1') ? 'Planilha1' : sheetNames[0];
  const ws = wb.Sheets[targetSheetName];

  // Convert to array of arrays to find header row
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rawRows || rawRows.length < 2) {
    throw new Error('A planilha não contém linhas de dados suficientes.');
  }

  // Find header row (the row containing "Nº Nota" or similar)
  let headerRowIndex = -1;
  let headerMap = {}; // normalizedName -> columnIndex

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    const map = {};
    for (let c = 0; c < row.length; c++) {
      const cellText = (row[c] || '').toString().trim();
      if (cellText) {
        map[normalizeHeaderName(cellText)] = c;
      }
    }

    // Check if essential columns are present
    const hasAllEssentials = ESSENTIAL_COLUMNS.every(col => {
      return map[normalizeHeaderName(col)] !== undefined;
    });

    if (hasAllEssentials) {
      headerRowIndex = r;
      headerMap = map;
      break;
    }
  }

  if (headerRowIndex === -1) {
    const missing = ESSENTIAL_COLUMNS.filter(col => headerMap[normalizeHeaderName(col)] === undefined);
    throw new Error(
      `Cabeçalho inválido na planilha. As seguintes colunas essenciais não foram encontradas: ${missing.join(', ')}.`
    );
  }

  // Column index helpers
  const colIndex = (colName) => {
    const idx = headerMap[normalizeHeaderName(colName)];
    return idx !== undefined ? idx : -1;
  };

  const getCell = (row, ...colNames) => {
    for (const name of colNames) {
      const idx = colIndex(name);
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
        return row[idx];
      }
    }
    return '';
  };

  const getCellWithFormat = (row, r, ...colNames) => {
    for (const name of colNames) {
      const idx = colIndex(name);
      if (idx !== -1) {
        if (ws) {
          const cell = ws[XLSX.utils.encode_cell({ r, c: idx })];
          if (cell && cell.w && cell.w.includes('%')) {
            return cell.w;
          }
        }
        if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
          return row[idx];
        }
      }
    }
    return '';
  };

  const parsedItems = [];
  const warnings = [];
  let rowCount = 0;
  let totalGrossST = 0;
  let totalGrossFECOEP = 0;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawNF = getCell(row, 'Nº Nota', 'Numero Nota', 'Nota Fiscal', 'NF');
    if (isTotalOrAuxiliaryRow(rawNF)) {
      continue;
    }

    rowCount++;
    const nf = rawNF.toString().trim();

    const itemNum = (getCell(row, 'Nº Item', 'Item') || rowCount).toString().trim();
    const produto = getCell(row, 'Descrição do Produto', 'Descricao do Produto', 'Produto', 'Mercadoria').toString().trim();
    const rawMVA = getCellWithFormat(row, r, '%MVA', 'MVA', '% MVA', 'Aliquota MVA');
    const rawST = getCell(row, 'ICMS ST', 'Valor ICMS ST', 'ICMS-ST', 'ST');

    if (!produto) {
      warnings.push(`Linha ${r + 1}: Produto vazio para a NF ${nf}.`);
    }

    const mva = normalizeMVA(rawMVA);
    if (!mva) {
      warnings.push(`Linha ${r + 1}: MVA inválido ou ausente ('${rawMVA}') para a NF ${nf}.`);
    }

    const stVal = parseDecimal(rawST);
    if (stVal === null) {
      warnings.push(`Linha ${r + 1}: Valor de ICMS ST inválido ('${rawST}') para a NF ${nf}.`);
    } else if (stVal < 0) {
      warnings.push(`Linha ${r + 1}: Valor de ICMS ST negativo (R$ ${stVal}) para a NF ${nf}.`);
    }

    // Optional company / establishment columns detection
    const optEmpresa = getCell(row, 'Empresa', 'Nome da Empresa', 'Razão Social', 'Razao Social', 'Estabelecimento', 'Loja').toString().trim();
    const optCodEmpresa = getCell(row, 'Cód. Empresa', 'Código Empresa', 'Cod. Empresa', 'Código', 'Cod Empresa').toString().trim();
    const optFilial = getCell(row, 'Filial', 'Nome Filial', 'Cód. Filial', 'Cod Filial', 'Unidade').toString().trim();
    const optCnpj = getCell(row, 'CNPJ Destinatário', 'CNPJ Cliente', 'CNPJ', 'CPF/CNPJ', 'CPF CNPJ').toString().trim();
    const optIE = getCell(row, 'Inscrição Estadual', 'Insc. Estadual', 'IE Destinatário', 'IE Cliente', 'IE').toString().trim();

    const rawFecoep = getCell(row, 'FECOEP', 'ICMS FECOEP', 'Valor FECOEP', 'Fundo de Pobreza', 'VALOR DO FECOEP', 'ADICIONAL FECOEP', 'FECP', 'ICMS FECP');
    const fecoepVal = parseDecimal(rawFecoep);
    const rawFecoepNum = typeof rawFecoep === 'number' ? rawFecoep : (fecoepVal || 0);
    const cliente = (getCell(row, 'Destinatário (Cliente)', 'Destinatario (Cliente)', 'Destinatário', 'Destinatario') || optEmpresa || '').toString().trim();

    const item = {
      rowIndex: r + 1,
      nf,
      itemNum,
      operacao: getCell(row, 'Operação', 'Operacao').toString().trim(),
      emissao: getCell(row, 'Emissão', 'Emissao').toString().trim(),
      dataEntSai: getCell(row, 'Data Ent/Sai', 'Data Entrada/Saida').toString().trim(),
      fornecedor: getCell(row, 'Emitente (Fornecedor)', 'Emitente', 'Fornecedor').toString().trim(),
      cliente,
      empresa: (optEmpresa || cliente).toString().trim(),
      codEmpresa: optCodEmpresa,
      filial: optFilial,
      cnpjDestinatario: optCnpj,
      ieDestinatario: optIE,
      ufParceiro: getCell(row, 'UF Parceiro', 'UF').toString().trim(),
      codProduto: getCell(row, 'Cód. Produto', 'Cod. Produto', 'Codigo Produto').toString().trim(),
      produto,
      ncm: getCell(row, 'NCM').toString().trim(),
      qtd: getCell(row, 'Qtd.', 'Quantidade', 'Qtd'),
      cfop: getCell(row, 'CFOP').toString().trim(),
      cst: getCell(row, 'CST/CSOSN', 'CST', 'CSOSN').toString().trim(),
      valorContabil: parseDecimal(getCell(row, 'Valor Contábil', 'Valor Contabil')),
      baseICMS: parseDecimal(getCell(row, 'Base ICMS')),
      aliqICMS: getCell(row, '% ICMS', 'Aliq ICMS'),
      valorICMS: parseDecimal(getCell(row, 'Valor ICMS')),
      mva,
      baseST: parseDecimal(getCell(row, 'Base ST')),
      icmsST: stVal || 0,
      fecoep: fecoepVal !== null && fecoepVal > 0 ? fecoepVal : 0,
      rawFecoep: rawFecoepNum > 0 ? rawFecoepNum : 0,
      hasFecoep: rawFecoepNum > 0,
      chaveAcesso: getCell(row, 'Chave de Acesso Vinculada', 'Chave de Acesso', 'Chave NFe', 'Chave NFe Vinculada', 'Chave').toString().trim()
    };

    totalGrossST += (stVal || 0);
    if (rawFecoepNum > 0) {
      totalGrossFECOEP += rawFecoepNum;
    }
    parsedItems.push(item);
  }

  const taxpayer = extractTaxpayerFromWorkbook(wb, rawRows, headerRowIndex, parsedItems);

  return {
    sheetName: targetSheetName,
    headerRowIndex: headerRowIndex + 1,
    totalItems: parsedItems.length,
    totalGrossST: Math.round(totalGrossST * 100) / 100,
    totalGrossFECOEP: Math.round(totalGrossFECOEP * 100) / 100,
    hasFecoepItems: parsedItems.some(it => (it.fecoep || 0) > 0),
    items: parsedItems,
    taxpayer,
    warnings
  };
}

module.exports = {
  normalizeHeaderName,
  normalizeMVA,
  parseDecimal,
  isTotalOrAuxiliaryRow,
  extractTaxpayerFromWorkbook,
  parseExcel,
  ESSENTIAL_COLUMNS
};
