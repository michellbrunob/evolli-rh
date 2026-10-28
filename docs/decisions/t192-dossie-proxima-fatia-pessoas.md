# T192 — Dossiê: próxima fatia de Gestão de Pessoas

Status: **dossiê de preparação de decisão.** Nada aqui decide, aprova ou
autoriza implementação: a escolha é da proprietária.
Data: 2026-10-28. Tarefa: T192.
Fontes, e só elas: `.specify`, as decisões em `docs/decisions` (em especial
[T188](t188-dossie-proxima-fatia-pessoas.md),
[T189](t189-seletor-empresa-ativa.md),
[T190](t190-dossie-proxima-fatia-pessoas.md) e
[T191](t191-dossie-proxima-fatia-pessoas.md)), e o código e os testes de
`main` em `1a7daf4`, só como evidência.

## 1. Onde a área está — as observações da T191

A T191 tirou o teto de 100 da tabela de vínculos do **Horário de trabalho**:
cada vínculo traz o nome do colaborador, a tabela pagina de 20 em 20 e há
filtros por colaborador e por jornada. A revisão final aprovou a entrega e
deixou observações não bloqueantes. Conferidas no código de `main`
(`apps/web/src/screens/pessoas/PessoasHorarioScreen.tsx`):

- **Foco no filtro de colaborador.** Os quatro comandos do filtro trocam o
  próprio controle por outro: "Filtrar por colaborador" vira a busca (linha
  544), "Cancelar filtro por colaborador" volta ao botão (536), escolher um
  nome vira o resumo do filtro (531) e "Remover" volta ao botão (518). Em
  nenhum dos quatro a tela leva o foco a algum lugar: ele cai no `<body>`, e
  o leitor de tela não ouve o que mudou. A tela de Colaboradores já resolve o
  mesmo caso ("Limpar busca" devolve o foco ao campo, T178).
- **Foco e anúncio ao paginar.** Enquanto a página carrega, a tela troca a
  tabela **e a paginação** por "Carregando vínculos de horário…" (linha 568).
  O botão "Próxima" ou "Anterior" acionado deixa de existir, e o foco se
  perde. O "Página X de Y" é uma região viva (`PaginacaoSimples`,
  `aria-live="polite"`), mas é recriada junto com a paginação — região viva
  recém-inserida costuma não ser anunciada. O componente aceita
  `carregando` para manter os botões à vista e desabilitados; a tela não usa.
- **Falha do apoio esconde a tabela.** A tela carrega à parte o "apoio":
  quantos ativos (T188) e o catálogo de jornadas, numa página de 100
  (`carregarApoio`, linha 191). Se ele falha, a tela troca a tabela inteira
  pela mensagem "Não foi possível carregar os vínculos de horário" (linha 471) — embora os vínculos tenham carregado e a tabela não dependa mais do
  catálogo desde a T191. A mensagem fica imprecisa, e esse caminho não tem
  teste web.
- **Nova tentativa repete a página errada.** "Tentar novamente" (linha 216)
  pede a página guardada no estado, que só muda quando uma leitura dá certo.
  Se a falha foi ao pedir a página 3, a nova tentativa pede a 2.
- **Rótulos ambíguos no `master_tecnico` global.** Sem empresa ativa, o
  master lê o escopo global: o catálogo de jornadas do filtro, a busca de
  colaborador (T188) e os catálogos de Departamento e Cargo dos filtros de
  Colaboradores (T190) misturam empresas, e dois itens com o mesmo nome
  aparecem iguais. Os catálogos já trazem `empresaId` (o colaborador, em
  cada vínculo funcional); o nome da empresa, não. A
  lista de empresas que o ator pode escolher já existe
  (`GET /v1/auth/contexto/empresas`, T163/T189, só `id`, `codigo` e `nome`).

**Outras pendências registradas:** lacunas pequenas de E2E da T191 (perfis
negados testados só na lista, não no detalhe; master com empresa ativa fora
do bloco da T191); o catálogo de jornadas numa página de 100 no filtro e no
formulário; a linha do tempo do vínculo funcional sem desempate por `id`;
o limite de 100 itens dos catálogos de Departamento e Cargo (T190), que não
têm busca no contrato — as jornadas têm (`busca` em `GET /v1/horarios`,
T182); a falha de catálogo de lotação sem região viva (T190).

## 2. Opções

### A — Horário de trabalho: foco, paginação, falha do apoio e nova tentativa (só web)

- **Problema e valor:** fecha as quatro observações de uso da T191 na tela
  mais operada do Horário. Quem navega por teclado ou leitor de tela deixa de
  perder o lugar a cada filtro ou página; uma falha no catálogo deixa de
  esconder a tabela que carregou; a nova tentativa pede o que a pessoa pediu.
- **Contratos e telas:** nenhum contrato muda. Só a aba Horário de trabalho
  (`PessoasHorarioScreen`):
  - foco levado ao campo de busca ao abrir o filtro, ao resumo do filtro ao
    escolher, e de volta a "Filtrar por colaborador" ao cancelar ou remover;
  - paginação e tabela à vista durante a carga, com os botões desabilitados
    (`carregando`), e o "Página X de Y" numa região viva estável;
  - falha do apoio separada da falha dos vínculos: a tabela segue à vista, o
    filtro de jornada e o "Novo vínculo" avisam a falha (com anúncio) e têm a
    própria nova tentativa;
  - "Tentar novamente" repete a página pedida;
  - testes web para cada caso e, se a proprietária quiser, os dois E2E que
    faltaram na T191 (detalhe negado aos outros perfis; master com empresa
    ativa), só testes.
- **Dependências:** nenhuma de gate. Sem API, schema, migration, RBAC,
  auditoria, seed ou dependência.
- **Risco e escopo:** baixo, escopo pequeno e numa tela só. O cuidado é não
  roubar o foco em cargas que a pessoa não pediu (troca de empresa, carga
  inicial).
- **Decisões necessárias:** (1) para onde vai o foco depois de paginar — no
  botão acionado, que fica à vista (recomendado), ou no título da tabela;
  (2) incluir os dois E2E que faltaram (recomendado: sim, são só testes).

### B — Rótulos sem ambiguidade para o `master_tecnico` global

- **Problema e valor:** o master sem empresa ativa deixa de ver, nos filtros,
  dois itens iguais que pertencem a empresas diferentes — e de filtrar pela
  empresa errada sem perceber. Fecha a observação aberta desde a T190.
- **Contratos e telas:** sem contrato novo. A tela lê as empresas que o
  master pode escolher (`GET /v1/auth/contexto/empresas`, já usado pelo
  seletor da T189) e acrescenta a empresa ao rótulo **só** no escopo global:
  - jornada no filtro do Horário de trabalho;
  - colaborador na busca da T188 (Horário de trabalho, Histórico funcional e
    Dados contratuais);
  - Departamento e Cargo nos filtros de Colaboradores (T190).

  RH, DP e o master com empresa ativa não veem diferença.

- **Dependências:** departamentos, cargos e jornadas já trazem `empresaId`;
  o colaborador listado o traz em cada vínculo funcional
  (`ColaboradorListadoApi.vinculos`). Decidir a forma do rótulo.
- **Risco e escopo:** baixo-médio, escopo médio: toca três telas e o seletor
  compartilhado da T188. Se a lista de empresas falhar, o rótulo fica como
  hoje — não pode bloquear a tela.
- **Decisões necessárias:** (1) forma do rótulo — "Nome · Empresa" ou só o
  código da empresa; (2) se a mesma regra vale para a coluna das tabelas
  (Horário de trabalho e Colaboradores) no escopo global, além dos filtros.

### C — Catálogos acima de 100 itens nos filtros e formulários

- **Problema e valor:** numa empresa com mais de 100 jornadas, departamentos
  ou cargos, parte deles não aparece como opção de filtro ou de vínculo. Fecha
  os limites registrados na T190 e na T191 para empresas grandes.
- **Contratos e telas:** jornadas já têm busca no contrato (`busca` em
  `GET /v1/horarios`): o filtro e o formulário do Horário passam a
  escolher a jornada por busca paginada, como o colaborador (T188).
  Departamentos e cargos **não** têm busca: exigem estender
  `GET /v1/departamentos` e `GET /v1/cargos` com `busca` (aditivo), ou ler
  todas as páginas na tela.
- **Dependências:** decisão sobre a extensão de contrato de departamentos e
  cargos; E2E com PostgreSQL real acima de 100 itens.
- **Risco e escopo:** médio, escopo médio: muda a forma de dois filtros
  conhecidos (select vira busca) e toca a API de Organização. Valor só
  aparece em empresas grandes, que hoje a base de demonstração não tem.
- **Decisões necessárias:** (1) busca no servidor ou leitura de todas as
  páginas; (2) se o select simples continua quando o catálogo cabe em uma
  página.

## 3. Comparação

| Opção | Valor no dia a dia                                         | Risco       | Contratos                        | Gate   | Decisões           |
| ----- | ---------------------------------------------------------- | ----------- | -------------------------------- | ------ | ------------------ |
| A     | Alto para teclado e leitor de tela; falha não esconde nada | Baixo       | Nenhum                           | Nenhum | Produto (2 pontos) |
| B     | Médio, só para o `master_tecnico` global                   | Baixo-médio | Existentes                       | Nenhum | Produto (2 pontos) |
| C     | Alto só em empresas com mais de 100 itens no catálogo      | Médio       | Departamentos e cargos (aditivo) | Nenhum | Produto (2 pontos) |

## 4. Recomendação

**Opção A — foco, paginação, falha do apoio e nova tentativa no Horário de
trabalho.** São as quatro observações de uso da revisão final da T191, todas
na mesma tela, sem contrato novo e com risco baixo. Corrigem perdas reais de
lugar para quem usa teclado e leitor de tela e uma mensagem de erro que
esconde dados carregados. A opção B é útil, mas só para o master global e
toca três telas; pode vir em seguida. A opção C resolve um limite que a base
atual não exercita e exige decidir uma extensão de contrato.

Para seguir com A, a proprietária precisa decidir:

1. **Foco depois de paginar:** no botão acionado, que fica à vista
   (recomendado), ou no título da tabela.
2. **Incluir os dois E2E que faltaram na T191** — detalhe negado aos outros
   perfis e master com empresa ativa (recomendado: sim; só testes).
3. **Incluir os rótulos do master global (opção B)** na mesma entrega
   (opcional; recomendado: não, para manter a fatia numa tela).
