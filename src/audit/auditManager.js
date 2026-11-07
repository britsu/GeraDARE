const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * AuditManager generates and updates processamento.json and resultado.csv
 */
class AuditManager {
  constructor({ targetDir, sourceFileName, ie, dueDate, municipioOrigem, codigoMunicipioOrigem, codigoReceita, mode }) {
    this.targetDir = targetDir;
    this.sourceFileName = sourceFileName;
    this.ie = (ie || '').toString().replace(/\D/g, '');
    this.dueDate = dueDate;
    this.municipioOrigem = municipioOrigem;
    this.codigoMunicipioOrigem = codigoMunicipioOrigem;
    this.codigoReceita = codigoReceita || '140';
    this.mode = mode || config.defaultMode;

    this.jsonPath = path.join(targetDir, 'processamento.json');
    this.csvPath = path.join(targetDir, 'resultado.csv');
  }

  /**
   * Generates full audit JSON object and writes to disk.
   */
  saveAuditJson(invoices, metadata = {}) {
    let existingNotas = [];
    if (fs.existsSync(this.jsonPath)) {
      try {
        const raw = fs.readFileSync(this.jsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.notas)) {
          existingNotas = parsed.notas;
        }
      } catch {}
    }

    const resolveTipoGuia = (inv) => {
      const code = String(inv.codigoReceita || this.codigoReceita || '140');
      if (inv.tipoGuia) return inv.tipoGuia;
      if (inv.tipo) {
        if (inv.tipo.startsWith('DIFAL')) return 'DIFAL';
        if (inv.tipo === 'ICMS_NORMAL') return 'ICMS_NORMAL';
        if (inv.tipo === 'ICMS_ST_APURACAO') return 'ICMS_ST_APURACAO';
        if (inv.tipo === 'FDE') return 'FDE';
        return inv.tipo;
      }
      if (code === '119') return 'FECOEP';
      if (code === '150') return 'DIFAL';
      if (code === '110') return 'ICMS_NORMAL';
      if (code === '130') return 'ICMS_ST_APURACAO';
      if (code === '643') return 'FDE';
      return 'ICMS_ST';
    };

    const currentMapped = invoices.map(inv => ({
      nf: inv.nf,
      itemCount: inv.itemCount,
      valor_guia_calculado: inv.valorGuia,
      valor_bruto_itens: inv.rawSum,
      codigo_receita: inv.codigoReceita || this.codigoReceita,
      tipo_guia: resolveTipoGuia(inv),
      data_vencimento: inv.dataVencimento || this.dueDate,
      idempotency_hash: inv.idempotencyHash,
      status: inv.status,
      observacao_gerada: inv.observation,
      valor_retornado_portal: inv.valorRetornadoPortal || null,
      arquivo_final: inv.arquivoFinal || null,
      validacao_pdf: inv.validacaoPdf || null,
      destinatario: inv.destinatario || null,
      produtos: Array.from(new Set(inv.items ? inv.items.map(it => it.produto) : [])),
      mvas: Array.from(new Set(inv.items ? inv.items.map(it => it.mva ? it.mva.str : '') : [])),
      itens_origem: inv.items ? inv.items.map(it => ({
        itemNum: it.itemNum,
        produto: it.produto,
        mva: it.mva ? it.mva.str : null,
        icmsST: it.icmsST,
        fecoep: it.fecoep,
        rawFecoep: it.rawFecoep,
        cfop: it.cfop,
        ncm: it.ncm
      })) : [],
      historico: inv.history || []
    }));

    // Merge: preserve existing notes from other revenue codes or other notes
    const currentKeys = new Set(currentMapped.map(n => `${n.nf}|${n.codigo_receita}`));
    const preservedNotas = existingNotas.filter(n => !currentKeys.has(`${n.nf}|${n.codigo_receita}`));
    const allMergedNotas = [...preservedNotas, ...currentMapped];

    const totalGuias = Math.round(allMergedNotas.reduce((acc, n) => acc + (n.valor_guia_calculado || 0), 0) * 100) / 100;
    const totalST = Math.round(allMergedNotas.filter(n => String(n.codigo_receita) === '140' || n.tipo_guia === 'ICMS_ST').reduce((acc, n) => acc + (n.valor_guia_calculado || 0), 0) * 100) / 100;
    const totalFecoep = Math.round(allMergedNotas.filter(n => String(n.codigo_receita) === '119' || n.tipo_guia === 'FECOEP').reduce((acc, n) => acc + (n.valor_guia_calculado || 0), 0) * 100) / 100;
    const totalDifal = Math.round(allMergedNotas.filter(n => String(n.codigo_receita) === '150' || n.tipo_guia === 'DIFAL').reduce((acc, n) => acc + (n.valor_guia_calculado || 0), 0) * 100) / 100;

    const auditData = {
      versao_aplicativo: config.version,
      gerado_em: new Date().toISOString(),
      arquivo_origem: this.sourceFileName,
      ie: this.ie,
      data_vencimento: this.dueDate,
      municipio_origem: this.municipioOrigem,
      codigo_municipio_origem: this.codigoMunicipioOrigem,
      codigo_receita: this.codigoReceita,
      modo: this.mode,
      resumo: {
        total_notas: allMergedNotas.length,
        total_itens: allMergedNotas.reduce((acc, n) => acc + (n.itemCount || 0), 0),
        valor_total_guias: totalGuias,
        valor_total_icms_st: totalST,
        valor_total_fecoep: totalFecoep,
        valor_total_difal: totalDifal,
        notas_sucesso: allMergedNotas.filter(n => n.status === 'SUCESSO' || n.status === 'BAIXADA').length,
        notas_validadas_pdf: allMergedNotas.filter(n => n.validacao_pdf && n.validacao_pdf.valid).length,
        notas_erro: allMergedNotas.filter(n => n.status.startsWith('ERRO')).length,
        notas_revisao: allMergedNotas.filter(n => n.status === 'REVISAO_MANUAL').length,
        notas_ja_processadas: allMergedNotas.filter(n => n.status === 'JA_PROCESSADA').length,
      },
      ...metadata,
      notas: allMergedNotas
    };

    fs.writeFileSync(this.jsonPath, JSON.stringify(auditData, null, 2), 'utf8');
    return auditData;
  }

  /**
   * Generates summary CSV and writes to disk, exporting all merged notes.
   */
  saveAuditCsv(invoices) {
    let notesToExport = [];
    if (fs.existsSync(this.jsonPath)) {
      try {
        const raw = fs.readFileSync(this.jsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.notas) && parsed.notas.length > 0) {
          notesToExport = parsed.notas;
        }
      } catch {}
    }

    if (notesToExport.length === 0) {
      notesToExport = invoices.map(inv => ({
        nf: inv.nf,
        destinatario: inv.destinatario,
        tipo_guia: inv.tipoGuia || (String(inv.codigoReceita) === '150' ? 'DIFAL' : ((String(inv.codigoReceita) === '119') ? 'FECOEP' : 'ICMS_ST')),
        itemCount: inv.itemCount,
        valor_guia_calculado: inv.valorGuia,
        valor_bruto_itens: inv.rawSum,
        data_vencimento: inv.dataVencimento || this.dueDate,
        codigo_receita: inv.codigoReceita || this.codigoReceita,
        status: inv.status,
        validacao_pdf: inv.validacaoPdf,
        idempotency_hash: inv.idempotencyHash,
        arquivo_final: inv.arquivoFinal,
        observacao_gerada: inv.observation,
        historico: inv.history
      }));
    }

    const headers = [
      'NF',
      'Destinatario',
      'Tipo Guia',
      'Codigo Receita',
      'Qtd Itens',
      'Valor Guia (R$)',
      'Valor Bruto (R$)',
      'Data Vencimento',
      'Status',
      'Validacao PDF (IE, R$, Obs)',
      'Hash Idempotencia',
      'Arquivo',
      'Observacao',
      'Mensagem'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      let str = val.toString().replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.join(';')];

    for (const n of notesToExport) {
      const lastMsg = n.historico && n.historico.length > 0 
        ? n.historico[n.historico.length - 1].message 
        : '';

      let validacaoStatus = 'PENDENTE';
      if (n.validacao_pdf) {
        validacaoStatus = n.validacao_pdf.valid ? '100% CONFORME' : `DIVERGENCIA: ${n.validacao_pdf.errors.join(', ')}`;
      }

      const row = [
        escapeCsv(n.nf),
        escapeCsv(n.destinatario || ''),
        escapeCsv(n.tipo_guia || (String(n.codigo_receita) === '119' ? 'FECOEP' : 'ICMS_ST')),
        escapeCsv(n.codigo_receita || this.codigoReceita),
        escapeCsv(n.itemCount),
        escapeCsv((n.valor_guia_calculado || 0).toFixed(2).replace('.', ',')),
        escapeCsv((n.valor_bruto_itens || 0).toFixed(2).replace('.', ',')),
        escapeCsv(n.data_vencimento || this.dueDate),
        escapeCsv(n.status),
        escapeCsv(validacaoStatus),
        escapeCsv(n.idempotency_hash),
        escapeCsv(n.arquivo_final || ''),
        escapeCsv(n.observacao_gerada || ''),
        escapeCsv(lastMsg)
      ];
      rows.push(row.join(';'));
    }

    fs.writeFileSync(this.csvPath, rows.join('\r\n'), 'utf8');
    return this.csvPath;
  }
}

module.exports = AuditManager;
