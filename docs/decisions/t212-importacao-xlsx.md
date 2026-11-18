# T212 — Importação de colaboradores por planilha `.xlsx`

- **Estado:** aberta em 2026-11-18, em implementação local. Branch `codex/t212-importacao-xlsx`, a
  partir do squash da T211 em `main` (`255a886`, PR #204). Sem push, PR, Ready ou merge.
- **Pedido da proprietária:** importar colaboradores por `.xlsx`, mantendo o CSV atual, e tornar o
  modelo `.xlsx` o download principal.

## 1. Escopo

- **Modelo `.xlsx`:** gerado no navegador a partir da mesma definição de colunas do importador;
  nenhum binário versionado.
- **Importação:** aceita `.xlsx` e `.csv` UTF-8 de até 1 MB. O `.xlsx` é lido só no navegador e
  passa pela mesma conferência, idempotência e envio individual do CSV (T209, Bloco C).
- **Interface:** o painel "Adicionar colaborador" guia a importação em três passos (baixar o
  modelo, preencher, escolher o arquivo); a página de importação aceita os dois formatos.
- **Fora desta entrega:** API, migration, RBAC, auditoria e regra de admissão (nada muda); CPF,
  salário, RG, contatos, endereço e foto na planilha; Documentos (T213, não iniciada).

## 2. Decisões

- **X1 — Sem dependência nova:**
  - o `.xlsx` (um ZIP de XML) é montado por código próprio, sem compressão, com CRC32;
  - a leitura descompacta com a API nativa `DecompressionStream("deflate-raw")`, presente nos
    navegadores atuais e no Node dos testes;
  - o XML é lido com `DOMParser`.
- **X2 — Abas do modelo:**
  - **Colaboradores:** a primeira linha é o cabeçalho técnico exato — `nome`, `tipo_vinculo`,
    `data_admissao`, `data_nascimento`, `departamento_codigo`, `cargo_codigo`, `matricula`,
    `unidade_codigo` —, sem título antes; a segunda é a linha sintética oficial, que o sistema
    reconhece e recusa ("apague esta linha");
  - **Exemplos:** só linhas fictícias, nos mesmos 8 campos;
  - **Instruções:** códigos ativos, dados obrigatórios, tipos permitidos, datas, limite de 200
    linhas e 1 MB, e como usar no Excel e no Google Planilhas.
- **X3 — Preenchimento:** as colunas da aba Colaboradores são de texto (a data digitada não vira
  número), o cabeçalho fica congelado e `tipo_vinculo` oferece a lista dos tipos aceitos.
- **X4 — Leitura:** só a aba **Colaboradores**. O cabeçalho tem de ser exatamente o do modelo, na
  mesma ordem. As linhas viram a mesma estrutura do CSV e seguem para a conferência de sempre.
- **X5 — Recusas do arquivo inteiro:**
  - protegido por senha (ou `.xls` antigo);
  - com macro;
  - estrutura que não é de planilha `.xlsx`, ou sem a aba Colaboradores;
  - cabeçalho alterado;
  - conteúdo fora das 8 colunas;
  - fórmula;
  - mais de 200 linhas;
  - mais de 1 MB.
- **X6 — Datas:** texto `DD/MM/AAAA` ou `AAAA-MM-DD`; se a planilha guardar a data como número de
  data do Excel, ela é convertida (inclusive no sistema de datas de 1904).
- **X7 — Referências:** Departamento, Cargo e Unidade continuam resolvidos só por códigos ativos
  da empresa selecionada.
- **X8 — Privacidade:** como no CSV, o arquivo não vai ao servidor e não fica salvo; a conferência
  mostra campo e motivo, nunca o valor.

## 3. Plano de testes

- **Modelo:** abas e ordem; cabeçalho exato; linha sintética reconhecida e recusada; exemplos
  fictícios nos 8 campos; instruções; nenhuma coluna extra; ida e volta (gerar e ler).
- **Leitura:** cabeçalho alterado, coluna extra, fórmula, mais de 200 linhas, arquivo inválido,
  senha/`.xls`, macro, aba ausente, datas como número, matrícula numérica, linhas vazias.
- **Importação:** `.xlsx` e `.csv` legado pelo mesmo caminho; erro por linha; idempotência e
  reenvio.
- **E2E (PostgreSQL real):** a admissão por linha para RH e DP, reenvio da mesma chave sem
  duplicar; demais papéis recusados.
- **Navegador:** RH e DP, desktop e 375 px — baixar o modelo, importar um arquivo sintético válido
  e conferir erro controlado.
