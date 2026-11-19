# T212 — Importação de colaboradores por planilha `.xlsx`

- **Estado:** aberta e implementada em 2026-11-18; **aprovação visual da proprietária recebida
  em 18/11/2026**. Branch local `codex/t212-importacao-xlsx`, a partir do squash da T211 em
  `main` (`255a886`, PR #204). Sem push, PR, Ready ou merge; publicação só com ordem.
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

## 4. Painel "Adicionar colaborador" (ajuste visual da proprietária)

- Escolhida a planilha, o próprio cartão se abre nos três passos, numerados e ligados por uma
  linha vertical; a divisória fica dentro do cartão, recuada dos dois lados.
- **Passo 1:** botão "Baixar modelo (.xlsx)" com ícone.
- **Passo 2:** "Preencha no Excel ou no Google Planilhas", com os seis dados obrigatórios em
  etiquetas (o asterisco é só visual).
- **Passo 3:** área tracejada com "Escolher arquivo" (campo nativo oculto, aberto pelo botão) e
  arrastar e soltar; mostra o nome do arquivo e recusa ali mesmo o que não é `.xlsx` nem `.csv`.
- **Rodapé:** "Iniciar importação" fica desabilitado, com o motivo, até haver arquivo; com ele,
  fecha o painel e abre a página de importação já na conferência. O arquivo fica só em memória,
  nesta aba, e é esquecido ao fechar o painel.
- **Foco:** o anel aparece só pelo teclado, dentro da caixa; com o cartão aberto, contorna o
  bloco inteiro (cartão e passos).
- O modelo em CSV continua na página de importação, não no painel.

## 5. Resultados comprovados

- **Testes web:** suíte completa com 160 arquivos e 4436 testes verdes. Inclui 29 testes do
  módulo `.xlsx` (modelo, leitura, recusas, entradas comprimidas como o Excel grava, entrada
  corrompida), a página de importação
  com `.xlsx` e CSV (mesma conferência, mesmo corpo e mesma chave nos dois formatos, reenvio), o
  painel em três passos e o shell (arquivo do painel abre a página na conferência; sem arquivo,
  nada abre).
- **E2E (PostgreSQL real, `test/importacao-planilha.e2e-spec.ts`):** 14 de 14. A suíte envia o
  corpo e a chave da página, linha a linha:
  - RH e DP admitem (201) na própria empresa, com e sem matrícula e unidade;
  - reenviar a mesma linha responde com `Idempotent-Replayed: true` e não cria nada;
  - a mesma pessoa com outros dados (mesma chave) é 422, sem gravar;
  - gestor, financeiro, colaborador, auditor, dpo, admin_tecnico e master_tecnico recebem 403,
    sem gravar;
  - RH de outra empresa recebe 404, sem gravar.
- **Excel de verdade:** o modelo gerado abre no Excel com as três abas, cabeçalho exato, colunas
  em texto, lista de tipos e cabeçalho congelado. Preenchido e salvo pelo próprio Excel
  (entradas comprimidas e textos compartilhados), é lido pela página; uma data gravada como data
  do Excel é convertida.
- **Navegador (banco isolado da prévia, dados sintéticos):**
  - **RH, desktop:** pelo painel, `.xlsx` com 3 linhas — 2 prontas e 1 com erro controlado
    (departamento inexistente) —, 2 admitidas;
  - **RH, 375 px:** reenvio do mesmo `.xlsx` — "Nenhuma admitida, 2 já importadas antes";
    CSV com 1 linha válida e 1 com data impossível — 1 admitida; sem rolagem horizontal;
  - **DP, 375 px:** pelo painel, `.xlsx` com 1 linha válida (data de nascimento como data do
    Excel) e 1 com tipo inválido — 1 admitida;
  - **DP, desktop:** reenvio do `.xlsx` — "1 já importada antes"; CSV — 1 admitida;
  - contagem por nome no banco da prévia: cada pessoa válida uma vez, nenhuma linha com erro
    gravada;
  - **gestor:** a rota da importação não abre (vai para "Minha equipe"), sem campo de arquivo
    nem "Adicionar colaborador".
- **Qualidade:** lint, typecheck e build do monorepo sem erro.

## 6. Aprovação visual

- **Recebida em 18/11/2026**, da proprietária, sobre a prévia em funcionamento e a planilha gerada.
- **Cenários validados** (seção 5): RH e DP, desktop e 375 px — painel em três passos, `.xlsx`
  salvo pelo próprio Excel com linhas válidas e com erro controlado, reenvio sem duplicar, CSV
  legado e recusa ao gestor.
- **Aceita com o limite conhecido** da seção 7 (reenvio entre contas sem matrícula).

## 7. Limites conhecidos

- **Chave por pessoa da conta:** a idempotência continua por ator e empresa (regra da T179, sem
  mudança aqui). O mesmo arquivo reenviado por outra conta (por exemplo, RH e depois DP) admite de
  novo as linhas sem matrícula; com matrícula, a duplicidade é recusada pelo banco (409).
- **Planilhas fora do modelo:** só a aba Colaboradores é lida; arquivos `.xls`, protegidos por
  senha, com macro ou com fórmula são recusados por inteiro, e a pessoa recebe a orientação.
- **Formatação do Excel:** só os valores importam; estilos e validações que a pessoa acrescentar
  são ignorados.
