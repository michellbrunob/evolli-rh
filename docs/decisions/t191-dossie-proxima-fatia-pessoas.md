# T191 — Dossiê: próxima fatia de Gestão de Pessoas

Status: **dossiê de preparação de decisão.** Nada aqui decide, aprova ou
autoriza implementação: a escolha é da proprietária.
Data: 2026-10-27. Tarefa: T191.
Fontes, e só elas: `.specify`, as decisões em `docs/decisions` (em especial
[T183](t183-jornada-colaborador.md),
[T188](t188-dossie-proxima-fatia-pessoas.md) e
[T190](t190-dossie-proxima-fatia-pessoas.md)), e o código e os testes de
`main` em `e148a61`, só como evidência.

## 1. Onde a área está — o Horário de trabalho

A aba **Horário de trabalho** de Pessoas lista os vínculos de jornada
(colaborador ↔ jornada, com vigência) e é onde o RH atribui, troca e encerra
a jornada de um colaborador; o DP consulta (T182/T183). Desde a T188, o
**formulário** escolhe o colaborador por busca paginada. A **tabela** de
vínculos, não:

- **Nomes até o centésimo colaborador (O1 da T188).** A tela lê
  `GET /v1/colaboradores?tamanhoPagina=100` só para montar um dicionário de
  nomes (`apps/web/src/screens/pessoas/PessoasHorarioScreen.tsx:119-120`). O
  vínculo de quem está além da primeira página de 100, em ordem alfabética,
  aparece como `Colaborador 1a2b3c4d` — o começo do identificador técnico
  (`nomeColaborador`, linha 159).
- **Achado desta preparação — vínculos além do centésimo nem aparecem.** A
  tabela pede **uma** página de 100 vínculos
  (`listarVinculosHorario({ tamanhoPagina: 100 })`) e não pagina: numa
  empresa com mais de 100 vínculos de jornada (vigentes e históricos), os
  demais não aparecem, sem nada na tela indicando que existem.
- **Nome da jornada por dicionário.** A tabela resolve o nome da jornada por
  uma página de 100 tabelas (`nomeTabela`), embora cada vínculo **já traga**
  a jornada na resposta (`tabela: { id, codigo, nome, ativo }`,
  `COM_JORNADA` em `vinculo-horario.service.ts`).

**O que o contrato já oferece** (`GET /v1/horarios/vinculos`): paginação
(`pagina`, `tamanhoPagina` até 100), filtros por `colaboradorId` e
`tabelaHorarioId`, ordem estável (`[vigenciaInicio desc, id asc]`), a jornada
de cada vínculo e auditoria de cada consulta (`horarios_consultado`). Não
traz o **nome** do colaborador — só `colaboradorId`.

**Quem lê:** RH e DP da própria empresa e `master_tecnico` só leitura
(`evaluateHorarios`) — o mesmo conjunto que lê colaboradores. Mostrar o nome
de quem tem vínculo de jornada não amplia a exposição a nenhum papel.

**Outras pendências registradas:** a linha do tempo do vínculo funcional sem
desempate por `id` (`vinculo/vinculo.service.ts:294`), a falha de carregamento
dos catálogos de lotação sem região viva e os rótulos repetidos do
`master_tecnico` sem empresa ativa (T190); o limite de 100 itens dos catálogos
de Departamento e Cargo (T190).

## 2. Opções

### A — Horário paginado, com nomes da página resolvidos na tela (só web)

- **Problema e valor:** acaba com os vínculos escondidos e com os nomes
  técnicos, sem tocar a API.
- **Contratos e telas:** a tabela passa a paginar pelo contrato existente
  (20 por página, componente de paginação da T188) e ganha um filtro por
  colaborador (o seletor por busca da T188, via `colaboradorId`). O nome da
  jornada sai do próprio vínculo. Os nomes dos colaboradores **da página**
  são lidos um a um em `GET /v1/colaboradores/:id` (até 20 leituras por
  página, guardadas na tela). Some o dicionário de 100.
- **Dependências:** nenhuma de gate. Sem API, schema, migration ou RBAC.
- **Risco e escopo:** baixo-médio, escopo pequeno. Pontos fracos: N leituras
  por página; para o `master_tecnico` sem empresa ativa, **cada nome**
  resolvido gera um evento de consulta global na auditoria (o detalhe do
  colaborador já audita a leitura global); falha numa leitura deixa um rótulo
  neutro naquela linha.
- **Decisões necessárias:** tamanho da página; filtro por jornada junto ou não.

### B — Nome do colaborador na resposta dos vínculos de horário, com paginação e filtro

- **Problema e valor:** o mesmo resultado operacional de A — todos os
  vínculos, todos os nomes, em empresa de qualquer tamanho — com **uma**
  leitura por página e sem eventos de auditoria a mais.
- **Contratos e telas:** `GET /v1/horarios/vinculos` (e o detalhe do vínculo)
  passa a trazer `colaborador: { id, nome }`, pela relação que já existe no
  banco (`vinculo_horario.colaborador_id`), na mesma consulta e no mesmo
  escopo: o nome só vem junto do vínculo que o papel já pode ler. Extensão
  aditiva, sem mudar os campos atuais. Na tela: paginação de 20 em 20, filtro
  por colaborador (seletor da T188, via `colaboradorId`) e, opcionalmente, por
  jornada (`tabelaHorarioId`, também já existente); o nome da jornada sai do
  vínculo. Some o dicionário de colaboradores de 100.
- **Dependências:** nenhuma de gate. Sem schema nem migration; RBAC e
  auditoria inalterados (uma consulta `horarios_consultado` por página, como
  hoje por carga). Dado pessoal novo: nenhum — o nome já é exibido nesta tela.
- **Risco e escopo:** baixo-médio, escopo pequeno a médio. A API muda de
  forma aditiva no domínio de Horários, que passa a ler o nome do colaborador
  — exige E2E de isolamento (nome de outra empresa nunca aparece) e de que
  só RH, DP e master leem.
- **Decisões necessárias:** (1) incluir o filtro por jornada; (2) tamanho da
  página; (3) o detalhe do vínculo também traz o nome (recomendado, para não
  depender do dicionário em nenhum lugar).

### C — Consistência e acessibilidade pendentes, fora do Horário

- **Problema e valor:** fecha três pendências pequenas já registradas: a linha
  do tempo do vínculo com `id` como desempate (ordem total, como a lista
  paginada da T190); a falha de carregamento dos catálogos de lotação anunciada
  ao leitor de tela; e rótulos sem ambiguidade para o `master_tecnico` sem
  empresa ativa nos filtros de lotação.
- **Contratos e telas:** só a ordem da linha do tempo (`GET
/v1/vinculos/:id/linha-do-tempo`, sem mudar o formato) e a tela de
  Colaboradores.
- **Dependências:** nenhuma. Rótulos do master podem exigir a empresa de cada
  departamento/cargo, que o catálogo já traz (`empresaId`), mas não o nome da
  empresa — decidir se basta o código da referência.
- **Risco e escopo:** baixo, escopo pequeno. **Não resolve** a pendência do
  Horário, que é a de maior impacto operacional.
- **Decisões necessárias:** forma do rótulo do master.

## 3. Comparação

| Opção | Valor no dia a dia                                    | Risco       | Contratos                                | Gate   | Decisões           |
| ----- | ----------------------------------------------------- | ----------- | ---------------------------------------- | ------ | ------------------ |
| A     | Alto: todos os vínculos e nomes no Horário            | Baixo-médio | Existentes (N leituras por página)       | Nenhum | Produto (2 pontos) |
| B     | Alto: o mesmo, com uma leitura e sem auditoria a mais | Baixo-médio | Vínculos de horário estendidos (aditivo) | Nenhum | Produto (3 pontos) |
| C     | Médio-baixo: consistência e acessibilidade            | Baixo       | Ordem da linha do tempo; tela            | Nenhum | Produto (1 ponto)  |

## 4. Recomendação

**Opção B — nome do colaborador na resposta dos vínculos de horário, com
paginação e filtro na tela.** Corrige as duas falhas do Horário de trabalho —
nomes além do centésimo (O1 da T188) e vínculos além do centésimo, achado
desta preparação — com uma leitura por página, sem eventos de auditoria a
mais, sem schema, migration ou RBAC novos e sem dado pessoal novo: o nome só
acompanha o vínculo que o papel já pode ler. A opção A chega ao mesmo
resultado sem tocar a API, mas troca uma extensão aditiva por N leituras por
página e, para o master global, um evento de auditoria por nome. A opção C é
pequena e pode vir depois; a ordem da linha do tempo, se a proprietária
preferir, cabe junto de B com risco baixo.

Para seguir com B, a proprietária precisa decidir:

1. **Filtro por jornada** junto do filtro por colaborador (recomendado: sim,
   o contrato já o oferece).
2. **Tamanho da página** da tabela (recomendado: 20, como as demais listas de
   Pessoas).
3. **Detalhe do vínculo com o nome** também (recomendado: sim).
4. **Incluir o desempate por `id` da linha do tempo** (pendência da T190) na
   mesma entrega (opcional).
