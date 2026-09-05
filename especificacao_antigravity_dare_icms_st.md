# Especificação de implementação para o Antigravity

## 1. Objetivo do aplicativo

Construir um aplicativo desktop para automatizar a geração de **DARE de ICMS ST**, recebendo somente três entradas do usuário: **uma planilha XLSX**, **uma data de vencimento** e **uma inscrição estadual**.

O aplicativo deve consultar a inscrição estadual no portal DARE Avulso da SEFAZ/TO, identificar o contribuinte e o município de origem, processar a planilha, gerar **uma guia para cada nota fiscal**, somar os valores da coluna `ICMS ST` dos itens daquela nota, preencher o código de receita `140`, montar as informações complementares no campo de observações e baixar cada guia na pasta de destino definida.

O processamento deve ocorrer em segundo plano, sem assumir o controle da janela principal do computador e sem interferir no uso normal do usuário.

> Importante: o aplicativo deve automatizar o preenchimento e a geração somente dentro do fluxo permitido pelo portal. Se surgir CAPTCHA, bloqueio, autenticação adicional ou qualquer mecanismo de segurança, o processamento daquela guia deve ser interrompido e encaminhado para revisão manual; o sistema não deve tentar contornar esse mecanismo.

## 2. Entradas obrigatórias da interface

A tela inicial deve conter exatamente estes campos funcionais:

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| Planilha de entrada | Upload/seleção de arquivo `.xlsx` | Sim | Deve aceitar o modelo `ICMSST.xlsx` ou arquivo compatível com o mesmo cabeçalho |
| Data de vencimento | Data no formato brasileiro `DD/MM/AAAA` | Sim | Aplicada a todas as notas do lote |
| Inscrição estadual | Texto | Sim | Aceitar com ou sem pontuação; normalizar para consulta |

A interface deve mostrar uma prévia antes do processamento: IE, razão social, CNPJ, município de origem, quantidade de notas, quantidade de itens, valor total de ICMS ST e a data de vencimento que será usada.

Não solicitar CNPJ, razão social, município ou valores ao usuário. Esses dados devem ser obtidos da consulta da IE e da planilha. O município da receita deve ser preenchido automaticamente com o município de origem retornado pelo portal.

## 3. Modelo exato da planilha

A planilha de referência possui uma aba chamada `Planilha1` e as seguintes 24 colunas:

| Ordem | Cabeçalho | Uso no aplicativo |
|---:|---|---|
| 1 | `Nº Nota` | Chave de agrupamento; uma guia por nota |
| 2 | `Nº Item` | Rastreabilidade do item |
| 3 | `Operação` | Validação e auditoria |
| 4 | `Emissão` | Auditoria |
| 5 | `Data Ent/Sai` | Referência da operação; não substituir a data de vencimento informada |
| 6 | `Emitente (Fornecedor)` | Auditoria e texto auxiliar, se necessário |
| 7 | `Destinatário (Cliente)` | Auditoria |
| 8 | `UF Parceiro` | Validação da operação interestadual |
| 9 | `Cód. Produto` | Auditoria |
| 10 | `Descrição do Produto` | Texto das informações complementares |
| 11 | `NCM` | Validação e auditoria |
| 12 | `Qtd.` | Auditoria |
| 13 | `CFOP` | Validação da operação |
| 14 | `CST/CSOSN` | Validação e auditoria |
| 15 | `Valor Contábil` | Não usar como valor da guia; somente conferência |
| 16 | `Base ICMS` | Auditoria e conferência |
| 17 | `% ICMS` | Auditoria e conferência |
| 18 | `Valor ICMS` | Auditoria e conferência |
| 19 | `%BC ICMS` | Auditoria e conferência |
| 20 | `%MVA` | Texto das informações complementares e auditoria |
| 21 | `Base ST` | Auditoria e conferência |
| 22 | `ICMS ST` | **Valor usado na guia; somar por nota fiscal** |
| 23 | `Valor IPI` | Auditoria e conferência |
| 24 | `Chave de Acesso Vinculada` | Auditoria e rastreabilidade |

O importador deve localizar as colunas pelo nome do cabeçalho, e não apenas pela posição. Deve aceitar pequenas variações de espaços e acentos, mas deve rejeitar o arquivo se faltar qualquer coluna essencial: `Nº Nota`, `Descrição do Produto`, `%MVA` e `ICMS ST`.

A planilha pode conter fórmulas. O aplicativo deve ler o valor calculado armazenado no XLSX quando disponível e validar células sem resultado. Não deve recalcular silenciosamente regras tributárias que não estejam especificadas no projeto.

Linhas em que `Nº Nota` seja `TOTAIS`, `TOTAL`, vazio ou não represente uma nota devem ser excluídas do agrupamento. Linhas totalmente vazias também devem ser ignoradas. O arquivo de teste contém linhas auxiliares de totalização; elas não podem gerar guias.

## 4. Regra de processamento por nota fiscal

O aplicativo deve agrupar todas as linhas pelo valor normalizado da coluna `Nº Nota`. Para cada grupo, deve criar exatamente um registro de guia.

O valor da guia deve ser calculado desta forma:

```text
valor_guia(nota) = arredondar_para_2_casas(
    soma(arredondar_para_2_casas(ICMS_ST_de_cada_item))
)
```

A implementação deve registrar tanto a soma bruta quanto a soma arredondada e deixar explícito no relatório qual regra foi usada. A coluna `Valor Contábil` jamais deve ser usada como `Valor da Receita`.

A soma dos valores de cada nota deve ser preservada no relatório. O aplicativo deve bloquear a guia se houver `ICMS ST` vazio, texto não numérico, valor negativo inesperado ou divergência entre o valor calculado e o valor exibido pelo portal após a atualização dos valores.

O código de receita padrão deve ser `140`, cuja descrição apresentada no portal é `ICMS SUBSTITUIÇÃO ENTRADA - OPERAÇÕES EXTERNAS`. O código deve ser uma configuração visível e validada, não um texto escondido no código-fonte. Qualquer mudança futura de código deverá exigir alteração de configuração e teste.

A consulta oficial nº 024/2022 da Diretoria de Tributação da SEFAZ/TO evidencia que a escolha de códigos 130 e 140 depende da natureza da operação [1]. Portanto, o MVP pode usar o código 140 conforme requisito do usuário, mas deve exibir um aviso para validação do responsável fiscal antes da emissão.

## 5. Data de vencimento

O usuário informa uma única data de vencimento, aplicada a todas as notas do lote.

O comportamento do aplicativo deve ser:

1. aceitar a data informada explicitamente;
2. verificar se ela cai em sábado, domingo ou feriado cadastrado;
3. mostrar um alerta quando houver possível postergação;
4. sugerir o próximo dia útil;
5. não alterar automaticamente a data sem registrar a decisão do usuário.

A regra padrão operacional é o dia 9 de cada mês, mas a aplicação não deve presumir o mês ou alterar a data informada sem confirmação. O calendário de feriados deve ser configurável e versionado. Como a incidência de juros e multa depende da regra fiscal vigente, a aplicação deve tratar a postergação como **sugestão sujeita à confirmação do responsável fiscal**, não como uma conclusão tributária automática.

## 6. Consulta da inscrição estadual e município

Ao iniciar um lote, o aplicativo deve consultar a IE no portal DARE Avulso da SEFAZ/TO. No teste realizado, a IE `29.515.340-7` retornou a empresa `S A MENDANHA LTDA - ME`, CNPJ `43.037.906/0001-93`, e município de origem `ANGICO`, código `1701051` [2].

O aplicativo deve extrair e exibir:

| Dado | Origem | Uso |
|---|---|---|
| Razão social | Consulta da IE | Nome da pasta e relatório |
| CNPJ/CPF | Consulta da IE | Identificação de filial e auditoria |
| IE | Entrada/consulta | Identificação do contribuinte |
| Município de origem | Consulta da IE | Deve ser copiado para Município da Receita |
| Código do município | Consulta da IE | Deve ser usado no campo correspondente |

Regra obrigatória:

```text
municipio_receita = municipio_origem
codigo_municipio_receita = codigo_municipio_origem
```

Se o portal não retornar município de origem, o aplicativo deve interromper o lote. Não permitir que o usuário escolha outro município manualmente no MVP.

## 7. Informações complementares no campo de observações

Para cada nota, gerar uma única informação complementar no campo de observações, no seguinte padrão:

```text
DARE ICMS ST REF COMPRA DE [PRODUTOS] NA NF [NUMERO] (MVA [PERCENTUAL]%)
```

Quando houver produtos com MVAs diferentes, cada grupo deve conservar seu MVA. Exemplo:

```text
DARE ICMS ST REF COMPRA DE FAR TRIGO D BENTA CFER 1KG, FAR TRIGO D BENTA SFERM 1KG E FAR TRIGO ROSA BRANCA SFERM 1KG NA NF 25105 (MVA 76%) E SARDINHA 88 TOM 125G (MVA 65%)
```

Regras de geração:

| Situação | Comportamento |
|---|---|
| Um produto e um MVA | Informar produto e MVA |
| Vários produtos com o mesmo MVA | Listar os produtos no mesmo grupo e informar o MVA uma vez |
| Vários produtos com MVAs diferentes | Separar grupos por MVA |
| Descrição repetida | Consolidar somente se produto e MVA forem equivalentes |
| MVA em decimal `0.265` | Exibir como `26,5%` |
| MVA em percentual `26.5` | Normalizar para `26,5%`, sem multiplicar indevidamente |
| Texto acima do limite do portal | Abreviar de forma determinística e registrar o texto original no log |
| Produto ou MVA ausente | Bloquear a nota para revisão |

O Gemini 3.8 Flash pode ser usado somente para normalizar abreviações e pontuação, desde que receba os dados estruturados e devolva JSON validado. Ele não pode determinar o valor do MVA, inventar produtos, escolher o código da receita, alterar valores ou decidir vencimento. A versão segura do MVP deve gerar o texto por código determinístico e usar o Gemini apenas em etapa opcional de melhoria textual.

## 8. Integração com o portal

O portal observado é uma aplicação web legada com campos identificáveis, incluindo município da receita, tipo de documento, código de receita, subcódigo, data de vencimento, valores, observação e os botões `Atualizar Valores` e `Confirmar` [2].

O adaptador deve:

1. abrir um Chromium separado, com perfil isolado;
2. preferir execução headless ou uma janela minimizada e independente;
3. nunca usar a janela principal do usuário;
4. localizar campos por `id` ou `name`, não por coordenadas;
5. consultar a IE;
6. preencher o município de receita com o município de origem;
7. selecionar o tipo de documento padrão definido na configuração;
8. selecionar o código `140`;
9. preencher a data de vencimento;
10. preencher o valor total da guia com a soma de `ICMS ST` da nota;
11. preencher o campo de observações;
12. acionar `Atualizar Valores`;
13. ler o valor total retornado;
14. comparar o valor retornado com o valor esperado;
15. baixar o PDF/arquivo somente depois da validação;
16. clicar em `Confirmar` apenas quando a política de emissão estiver habilitada e o lote tiver sido aprovado.

O projeto deve ter três modos:

| Modo | Comportamento |
|---|---|
| `dry-run` | Lê a planilha, consulta a IE e gera prévias; não atualiza valores nem confirma emissão |
| `preencher-e-revisar` | Preenche, atualiza valores e baixa somente após revisão/aceite explícito do usuário |
| `emitir-lote-aprovado` | Processa as notas aprovadas e confirma uma por uma, registrando cada emissão |

O modo padrão de desenvolvimento deve ser `dry-run`. O botão `Confirmar` deve ser protegido por uma confirmação adicional no aplicativo e nunca ser acionado durante testes automatizados.

## 9. Execução sem interferência no computador

Usar um worker separado do processo da interface. A interface deve permanecer responsiva enquanto o worker processa a fila.

Componentes recomendados:

| Componente | Responsabilidade |
|---|---|
| Interface desktop | Seleção dos três inputs, prévia, início, pausa, cancelamento e logs |
| Worker de lote | Processamento sequencial das notas e controle de estados |
| Leitor XLSX | Importação, normalização e validação |
| Motor de agrupamento | Uma guia por NF e soma da coluna `ICMS ST` |
| Gerador de observação | Texto determinístico por produtos e MVA |
| Cliente do portal | Consulta, preenchimento, atualização e download |
| Gerenciador de arquivos | Criação de pastas sem sobrescrita |
| Auditoria | Registro JSON/CSV por guia e por etapa |

O worker deve ter fila sequencial no MVP para evitar concorrência no mesmo portal ou na mesma sessão. A interface deve permitir pausar entre notas, cancelar de forma segura e retomar sem duplicar arquivos.

## 10. Estrutura de pastas e nomes

A raiz de saída é fixa:

```text
Z:\DOCUMENTOS TEMPORÁRIOS\LUIS HENRICK\DARE\MM-AAAA\NOME_CLIENTE
```

Exemplo para agosto de 2026:

```text
Z:\DOCUMENTOS TEMPORÁRIOS\LUIS HENRICK\DARE\08-2026\S A MENDANHA
```

A pasta mensal deve ser derivada da data de vencimento informada, no formato `MM-AAAA`, e não da data de emissão da nota.

A pasta do cliente deve usar a razão social retornada pelo portal, higienizada para nomes de diretório do Windows. Remover ou substituir caracteres inválidos (`\ / : * ? " < > |`), espaços finais e pontos finais.

Se a pasta do cliente já existir, não sobrescrever e não misturar arquivos. Criar a primeira pasta disponível nesta sequência:

```text
S A MENDANHA
S A MENDANHA (1)
S A MENDANHA (2)
...
```

Quando o CNPJ não terminar em `/0001-XX`, identificar a filial no nome da pasta, preferencialmente:

```text
NOME_CLIENTE - FILIAL CNPJ 430379060002XX
```

O algoritmo deve reservar/criar a pasta de forma atômica antes de iniciar o download, evitando colisão entre duas execuções simultâneas.

Dentro da pasta do lote, salvar:

```text
DARE_NF_25101.pdf
DARE_NF_25102.pdf
...
processamento.json
resultado.csv
```

Se o portal fornecer outro formato, preservar a extensão original e registrar o nome no relatório.

## 11. Não sobrescrita e idempotência

Cada guia deve possuir uma chave de idempotência:

```text
hash(IE normalizada + número da NF + data de vencimento + código da receita + valor ICMS ST)
```

Antes de processar uma nota, verificar:

1. se a chave já existe em `processamento.json`;
2. se existe arquivo correspondente;
3. se o arquivo possui tamanho maior que zero;
4. se a execução anterior terminou como `SUCESSO`.

Se todos esses itens forem verdadeiros, marcar a nota como `JÁ PROCESSADA` e não gerar novamente. Se houver arquivo parcial ou status de erro, criar novo nome controlado ou retomar somente após validação.

Nunca apagar ou sobrescrever PDF, relatório ou pasta existentes.

## 12. Estados da fila

Cada nota deve seguir uma máquina de estados:

```text
IMPORTADA
  -> VALIDADA
  -> IE_CONSULTADA
  -> AGRUPADA
  -> PREVIA_GERADA
  -> PREENCHIDA
  -> VALORES_ATUALIZADOS
  -> VALOR_CONCILIADO
  -> CONFIRMADA
  -> BAIXADA
  -> SUCESSO
```

Estados de exceção:

```text
ERRO_PLANILHA
ERRO_IE
ERRO_MUNICIPIO
ERRO_PORTAL
ERRO_CAPTCHA
ERRO_VALOR
ERRO_DOWNLOAD
REVISAO_MANUAL
CANCELADA
```

Cada transição deve registrar data/hora, mensagem, nota, valor esperado, valor retornado, URL/etapa e caminho do arquivo quando aplicável.

## 13. Auditoria e privacidade

Salvar um `processamento.json` com:

```json
{
  "versao_aplicativo": "x.y.z",
  "arquivo_origem": "ICMSST.xlsx",
  "ie": "295153407",
  "data_vencimento": "09/09/2026",
  "municipio_origem": "ANGICO",
  "codigo_municipio_origem": "1701051",
  "codigo_receita": "140",
  "modo": "dry-run",
  "notas": []
}
```

Cada item em `notas` deve conter número da NF, itens de origem, produtos, MVAs, valor por item, soma de ICMS ST, observação gerada, status, mensagens e arquivo final.

Na interface, mascarar parcialmente CNPJ e IE quando possível. Não enviar a planilha ou dados fiscais para serviços externos sem autorização explícita. Se o Gemini for usado, enviar apenas os campos estritamente necessários para normalização textual e não usar o modelo para cálculo ou decisão fiscal.

## 14. Testes obrigatórios

### Testes do importador

Testar a planilha de referência e confirmar que as linhas `TOTAIS` e vazias não geram guias. O resultado esperado do arquivo de referência é identificar 10 notas fiscais reais e 16 itens, sem contar linhas auxiliares.

Testar também cabeçalho com colunas em ordem diferente, valores decimais brasileiros, fórmulas, células vazias, MVA em decimal e MVA em percentual.

### Testes do agrupamento

Testar uma NF com um item, uma NF com vários itens e uma NF com produtos de MVAs diferentes. Para a NF 25105, confirmar que os produtos de farinha recebem MVA de 76% e a sardinha recebe MVA de 65%, mantendo os grupos separados.

### Testes de valores

Confirmar que o valor da guia é a soma de `ICMS ST`, e não `Valor Contábil`. Para a planilha de referência, o total de conferência dos itens é aproximadamente R$ 1.151,57, sujeito ao arredondamento definido por nota.

### Testes da IE e município

Usar a IE `29.515.340-7` e validar razão social, CNPJ e `ANGICO / 1701051`. Verificar que o campo Município da Receita recebe exatamente o município de origem.

### Testes de pasta

Executar o lote duas vezes e confirmar que a segunda execução não sobrescreve arquivos. Criar previamente a pasta do cliente e validar a criação de `(1)`. Testar filial com CNPJ diferente de `/0001-XX`.

### Testes de não interferência

Enquanto o worker processa, abrir e usar outro navegador, editor e planilha. Confirmar que o aplicativo não move o mouse, não digita na janela ativa, não rouba foco e não bloqueia a interface.

### Testes do portal

Executar inicialmente somente em `dry-run`. Depois testar preenchimento até antes de `Confirmar`. Validar que divergência de valor, timeout, CAPTCHA, sessão expirada ou alteração de seletor gera `REVISAO_MANUAL` e não continua automaticamente.

## 15. Critérios de aceite

O MVP será aceito quando:

| Critério | Condição de aceite |
|---|---|
| Entradas | O usuário precisa informar somente XLSX, vencimento e IE |
| Uma guia por NF | Cada NF válida gera exatamente uma guia |
| Valor | O DARE usa a soma de `ICMS ST`, nunca `Valor Contábil` |
| Código | O código 140 é preenchido e exibido na prévia |
| Município | Município da Receita é idêntico ao Município de Origem |
| Observação | Contém NF, produtos e MVA correto por grupo |
| Data | Uma data informada é aplicada ao lote, com alerta para não dias úteis |
| Pastas | O caminho mensal segue `MM-AAAA` e a razão social do cliente |
| Não sobrescrita | Pastas e arquivos existentes permanecem intactos |
| Segundo plano | O usuário pode continuar usando o computador |
| Segurança | O modo seco nunca clica em `Confirmar` |
| Auditoria | Cada nota tem status, valor, observação e arquivo rastreáveis |
| Recuperação | Reinício não duplica guia concluída |

## 16. Sequência de desenvolvimento no Antigravity

### Sprint 1 — Estrutura e importação

Criar o projeto desktop, a tela de três entradas, o leitor XLSX, o validador de cabeçalhos e a visualização da prévia. Implementar testes unitários para o modelo da planilha.

### Sprint 2 — Agrupamento e valores

Implementar agrupamento por NF, soma de `ICMS ST`, arredondamento, validações e relatório de conferência. Implementar exclusão de `TOTAIS` e linhas vazias.

### Sprint 3 — Observações

Implementar agrupamento por MVA, formatação percentual brasileira e geração determinística do campo de observações. Adicionar limite configurável de caracteres e testes para a NF 25105.

### Sprint 4 — Consulta da IE

Implementar consulta da IE, extração de razão social, CNPJ e município, e regra de cópia do município de origem para município da receita. Bloquear o lote se a consulta não for conclusiva.

### Sprint 5 — Navegador isolado

Implementar o worker, perfil isolado do Chromium, seletores por `id`/`name`, fila sequencial, timeouts, downloads e modo `dry-run`. Não implementar clique em `Confirmar` nesta etapa.

### Sprint 6 — Pastas e auditoria

Implementar criação atômica de pastas, sufixos `(1)`, identificação de filial por CNPJ, nomes de arquivo, `processamento.json`, `resultado.csv` e máquina de estados.

### Sprint 7 — Conciliação e revisão

Implementar `Atualizar Valores`, leitura do total retornado, comparação com valor esperado, pausa em divergências e tela de revisão por nota.

### Sprint 8 — Homologação controlada

Executar a planilha de referência em modo seco, depois preencher uma única nota sem confirmar, revisar manualmente e somente então habilitar emissão controlada. A ativação de lotes automáticos deve depender da aprovação do responsável fiscal.

## 17. Prompt operacional para iniciar o Antigravity

> Construa um aplicativo desktop para Windows que receba somente um arquivo XLSX, uma data de vencimento e uma inscrição estadual. Use o arquivo `ICMSST.xlsx` como modelo de entrada. A planilha possui uma aba `Planilha1` e as colunas `Nº Nota`, `Nº Item`, `Operação`, `Emissão`, `Data Ent/Sai`, `Emitente (Fornecedor)`, `Destinatário (Cliente)`, `UF Parceiro`, `Cód. Produto`, `Descrição do Produto`, `NCM`, `Qtd.`, `CFOP`, `CST/CSOSN`, `Valor Contábil`, `Base ICMS`, `% ICMS`, `Valor ICMS`, `%BC ICMS`, `%MVA`, `Base ST`, `ICMS ST`, `Valor IPI` e `Chave de Acesso Vinculada`. Ignore linhas `TOTAIS`, `TOTAL` e linhas vazias. Agrupe por `Nº Nota` e gere uma guia por nota. O valor da guia deve ser a soma da coluna `ICMS ST` dos itens da nota, arredondada para duas casas; nunca use `Valor Contábil` como valor da guia. Consulte a IE no portal DARE Avulso da SEFAZ/TO, use o município de origem retornado e preencha o município da receita com exatamente o mesmo município e código. Use o código de receita 140. A data de vencimento informada deve ser aplicada a todas as notas. Gere a observação no padrão `DARE ICMS ST REF COMPRA DE [produtos] NA NF [número] (MVA [percentual]%)`, separando grupos com MVAs diferentes e agrupando produtos com o mesmo MVA. Execute o navegador em perfil isolado/headless ou processo separado, sem mover mouse, roubar foco ou interferir na janela ativa do usuário. Salve os arquivos em `Z:\DOCUMENTOS TEMPORÁRIOS\LUIS HENRICK\DARE\MM-AAAA\NOME_CLIENTE`, usando o mês e ano da data de vencimento. Nunca sobrescreva pasta ou arquivo existente; crie `(1)`, `(2)` etc., ou identifique filial pelo CNPJ quando não for `/0001-XX`. Implemente modo `dry-run` como padrão, logs, auditoria, idempotência, pausa em CAPTCHA/erro/divergência e testes automatizados. Não use Gemini para decidir MVA, valor, código, município ou vencimento; se usar Gemini 3.8 Flash, limite-o à normalização textual com saída estruturada validada. Não clique em `Confirmar` no modo seco.

## 18. Ponto que deve ser confirmado antes de codificar a regra de vencimento

A especificação assume que a data digitada pelo usuário é a data final a ser usada e que o aplicativo apenas sugere o próximo dia útil quando houver fim de semana ou feriado. Se você quiser que o aplicativo **altere automaticamente** a data do dia 9 para o próximo dia útil, essa decisão precisa ser confirmada pelo responsável fiscal e implementada como regra configurável, pois a ausência de juros e multa não deve ser inferida somente pelo calendário civil.

## Referências

[1]: https://dtri.sefaz.to.gov.br/legislacao/consultas/2022/Consulta24.2022.htm "Consulta nº 024/2022 — Diretoria de Tributação da SEFAZ/TO"

[2]: https://www.sefaz.to.gov.br/dare/servlet/hnetccwkda "DARE Avulso — SEFAZ/TO"
