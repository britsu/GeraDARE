# GeraDARE - Automação SEFAZ/TO DARE ICMS ST

Aplicativo desktop completo para automação da geração e conciliação de guias **DARE de ICMS ST** (Código da Receita `140` - Operações Externas) no portal da SEFAZ/TO, operando em segundo plano sem assumir o controle do mouse ou teclado e sem interferir no uso normal do computador.

Desenvolvido estritamente com base na especificação técnica [`especificacao_antigravity_dare_icms_st.md`](./especificacao_antigravity_dare_icms_st.md) e homologado com a planilha de referência [`ICMS ST.xlsx`](./ICMS%20ST.xlsx).

---

## 1. Como Iniciar o Aplicativo

### Opção 1: Atalho Windows
Dê um duplo clique no arquivo:
```text
start_geradare.bat
```
O servidor local será iniciado na porta `3456` e a interface desktop será aberta em modo janela de aplicativo (App Mode).

### Opção 2: Linha de Comando (Terminal)
```bash
npm start
```
Acesse no navegador: [http://localhost:3456](http://localhost:3456)

---

## 2. As Três Entradas Obrigatórias

O aplicativo exige somente 3 parâmetros do usuário:

1. **Planilha XLSX**: Aceita o modelo de referência `ICMS ST.xlsx` ou compatível (aba `Planilha1`, 24 colunas). O sistema carrega o modelo por padrão se nenhum arquivo for anexado.
2. **Data de Vencimento**: Formato brasileiro `DD/MM/AAAA`. O sistema possui calendário integrado de feriados nacionais e do Estado do Tocantins (Lei Estadual de Criação do TO, etc.) e finais de semana. Alerta instantaneamente em caso de dias não úteis e oferece botão para adotar o próximo dia útil sugerido com 1 clique.
3. **Inscrição Estadual**: Aceita com ou sem pontuação (ex: `29.515.340-7` ou `295153407`). O aplicativo consulta a IE diretamente no portal DARE Avulso da SEFAZ/TO e extrai automaticamente:
   - Razão Social
   - CNPJ (com detecção de Matriz vs Filial)
   - Município de Origem (`ANGICO - 1701051`)
   - Município da Receita (atribuído identicamente ao Município de Origem)

---

## 3. Regras de Negócio e Cálculo Implementadas

1. **Exclusão de Linhas Auxiliares**: Linhas `TOTAIS`, `TOTAL` ou vazias são rigorosamente descartadas. Na planilha modelo, são identificados exatamente **10 notas fiscais reais** e **16 itens**.
2. **Agrupamento por Nota Fiscal**: Uma única guia por NF. O valor da guia é a soma dos itens de ICMS ST arredondados para duas casas:
   $$\text{valor\_guia} = \text{round}\left(\sum \text{round}(\text{ICMS\_ST}_{\text{item}}, 2), 2\right)$$
   *O `Valor Contábil` jamais é utilizado como valor da guia.*
3. **Informações Complementares (Observação)**:
   - Formato determinístico: `DARE ICMS ST REF COMPRA DE [PRODUTOS] NA NF [NUMERO] (MVA [PERCENTUAL]%)`
   - Separação de grupos quando houver múltiplos MVAs.
   - Exemplo (NF 25105):
     `DARE ICMS ST REF COMPRA DE FAR TRIGO D BENTA CFER 1KG, FAR TRIGO D BENTA SFERM 1KG E FAR TRIGO ROSA BRANCA SFERM 1KG NA NF 25105 (MVA 76%) E SARDINHA 88 TOM 125G (MVA 65%)`
   - Truncamento seguro caso ultrapasse o limite de 400 caracteres do portal.
4. **Estrutura de Pastas e Não Sobrescrita**:
   - Destino fixo: `Z:\DOCUMENTOS TEMPORÁRIOS\LUIS HENRICK\DARE\MM-AAAA\NOME_CLIENTE` (com fallback local caso Z: não esteja montado).
   - Pasta mensal derivada da Data de Vencimento informada.
   - Criação atômica sequencial: se a pasta do cliente já existir, cria `(1)`, `(2)`, etc. Nunca sobrescreve arquivos existentes.
   - Identificação de filial quando CNPJ for diferente de `/0001-XX`.
5. **Idempotência**:
   - Hash SHA-256 único: `hash(IE + NF + Data + Código + Valor ST)`.
   - Se o DARE já tiver sido emitido com sucesso na pasta, pula automaticamente com status `JA_PROCESSADA`.
6. **Modos de Operação**:
   - `dry-run` (Padrão): Consulta a IE, valida a planilha, preenche os campos e simula a conciliação no portal sem confirmar a emissão.
   - `preencher-e-revisar`: Preenche, clica em "Atualizar Valores", valida o retorno e aguarda liberação.
   - `emitir-lote-aprovado`: Confirma a emissão real de cada guia e baixa o PDF como `DARE_NF_[NUMERO].pdf`.

---

## 4. Testes Automatizados

O projeto conta com suite completa de testes unitários e de integração cobrindo os 14 requisitos obrigatórios:

```bash
npm test
```

Resultado dos testes:
- Importador XLSX: 100% aprovado
- Agrupamento e valores: 100% aprovado
- Normalização de MVA e observação composta: 100% aprovado
- Calendário e feriados estaduais: 100% aprovado
- Idempotência e diretórios atômicos: 100% aprovado

---

## 5. Auditoria e Rastreabilidade

A cada lote processado, são gerados e mantidos em tempo real:
- `processamento.json`: Registro estruturado detalhado com dados fiscais, itens, hashes, histórico de estados e conciliações.
- `resultado.csv`: Tabela com separador brasileiro `;` para conferência contábil e importação em ERPs.
