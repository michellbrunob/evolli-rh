# T188 — Dossiê: próxima fatia de Gestão de Pessoas

Status: **decidido pela proprietária em 2026-10-27: opção A completa**
(seção 5). As seções 1 a 4 registram o dossiê como foi apresentado.
Data: 2026-10-27. Tarefa: T188.
Fontes, e só elas: `.specify`, as decisões em `docs/decisions` (em especial
[T174](t174-dossie-decisoes-fatia-0.md) e [T187](t187-dossie-proxima-fatia-colaboradores.md)),
a ADR 0017, e o código e os testes de `main` em `00a94df`, só como evidência.

## 1. Onde a área está

- **Colaboradores** (T178 a T187): listagem com busca e paginação no servidor,
  filtros de situação, colunas de lotação e jornada; ficha com dados pessoais,
  contatos, jornada e, desde a T187, a "Vida funcional" (só leitura) com atalho
  para o Histórico funcional.
- **Abas operacionais de Pessoas** — Histórico funcional (T115), Dados
  contratuais (T134) e Horário de trabalho (T183): é nelas que RH e DP
  **operam** movimentações e jornadas e consultam o vínculo. As três escolhem o
  colaborador num seletor montado com **uma única página de 100**
  (`listarColaboradores({ tamanhoPagina: 100 })`, o teto do servidor):
  `HistoricoFuncionalScreen.tsx:273`, `DadosContratuaisScreen.tsx:214`,
  `PessoasHorarioScreen.tsx:91`. Em empresa com mais de 100 colaboradores,
  quem passa do centésimo, em ordem alfabética, **não aparece** para ser
  escolhido. A lista de movimentações do Histórico funcional também pede uma
  página de 100 e não pagina (`HistoricoFuncionalScreen.tsx:301`), e a aba
  ainda estoura a largura da página (pendência T115 registrada).
- **Gates abertos que limitam a área** (T174): `DP-FLX-04` (processo
  admissional), `DP-FLX-11` (movimentações ampliadas e correção), `DP-FLX-12`
  (desligamento), `DP-FLX-05` (CPF), `DP-FLX-14` (documentos por vínculo),
  `DP-FLX-16` (bancário, sindical, dependentes), entre outros. Resolvidos:
  `DP-FLX-01`, `-21` e `-22`.
- **Observação O1 (T186):** o E2E da listagem não cobre `situacaoVinculo`.

## 2. Opções

### A — Abas operacionais sem o teto de 100 colaboradores

- **Objetivo e resultado:** em Histórico funcional, Dados contratuais e Horário
  de trabalho, escolher **qualquer** colaborador da empresa ativa por busca
  (nome ou matrícula) com resultados paginados no servidor, e ver **todas** as
  movimentações do filtro com paginação. Junto, a aba Histórico funcional para
  de estourar a largura da página (pendência T115).
- **Valor para RH/DP:** corrige uma falha operacional real — hoje, numa
  empresa com mais de 100 pessoas, parte do quadro não pode ter movimentação
  registrada, contrato consultado ou jornada atribuída por essas abas. É também
  o destino do atalho da T187.
- **Reutiliza:** `GET /v1/colaboradores` com `busca`, `pagina` e
  `tamanhoPagina` (T178), `GET /v1/colaboradores/:id/vinculos`,
  `GET /v1/movimentacoes` com `pagina` (T115) e as telas existentes.
  **Sem mudança de API, schema, migration ou RBAC.**
- **Dependências:** nenhuma de gate.
- **Dados pessoais:** nenhum novo; nome e matrícula, que as abas já mostram.
- **Riscos:** baixos a médios — três telas mudam o modo de escolher o
  colaborador; regressão em fluxos que hoje funcionam (mitigar com testes de
  cada aba e E2E de busca já existentes).
- **Decisões necessárias:** só de produto: busca com resultados (recomendado)
  ou seletor paginado; as três abas juntas ou uma por vez.
- **Fora do escopo:** catálogos organizacionais acima de 100 itens
  (departamentos, cargos etc. continuam numa página de 100 — limite registrado,
  menos provável), qualquer operação nova, API e permissões.

### B — Transferência e mudança de cargo pela ficha (operação)

- **Objetivo e resultado:** registrar e efetivar transferência organizacional
  e mudança de cargo na própria ficha, com reflexo em Cargo e Departamento da
  listagem (T184) e na "Vida funcional" (T187).
- **Valor para RH/DP:** a alteração de lotação, rotina frequente, sai do lugar
  onde a pessoa já está.
- **Reutiliza:** `POST /v1/movimentacoes` e `.../efetivar` (RH e DP, na
  própria empresa) e a seção "Vida funcional". Sem schema ou migration.
- **Dependências:** `DP-FLX-11` não bloqueia os dois tipos existentes, mas
  justificativa em texto livre, valores antes/depois ou correção ampliada caem
  nele; **desligamento fica fora** enquanto `DP-FLX-12` estiver aberto. Com o
  teto de 100 da opção A, o cargo e o departamento de destino ainda vêm de
  catálogos de uma página.
- **Dados pessoais:** nenhum novo.
- **Riscos:** médios — duas portas para a mesma operação (ficha e Histórico
  funcional), vigência futura e efetivação, alçada RH × DP sem aprovação
  distinta (BV1, itens 7 e 12).
- **Decisões necessárias:** produto e RH/DP — quem opera pela ficha; se a
  efetivação imediata é oferecida ali; como a ficha mostra o que ficou
  programado.
- **Fora do escopo:** desligamento, retificação e cancelamento pela ficha,
  aprovação, texto livre.

### C — Filtros por Departamento e Cargo na listagem

- **Objetivo e resultado:** filtrar a listagem de Colaboradores pela lotação
  vigente (Departamento e/ou Cargo), combinável com busca e situação, e fechar
  a O1 com o E2E de `situacaoVinculo`.
- **Valor para RH/DP:** achar rapidamente quem está numa área ou cargo; ganha
  valor com o tamanho da empresa.
- **Reutiliza:** a listagem e as colunas da T184 e os catálogos de estrutura
  (DP já lê a estrutura, matriz §8).
- **Dependências:** nenhuma de gate; **exige estender** `GET /v1/colaboradores`
  com parâmetros novos (filtro no banco, antes da paginação, pela alocação
  aberta). Sem schema, migration ou RBAC.
- **Dados pessoais:** nenhum novo.
- **Riscos:** baixos a médios — mudança de contrato da API e a semântica de
  previsto e encerrado, que não têm lotação vigente.
- **Decisões necessárias:** produto — semântica do filtro, catálogo de
  referências (ativas, inativas) e se a O1 entra junto.
- **Fora do escopo:** filtros por unidade, área, equipe ou centro de custo,
  exportação.

## 3. Comparação

| Opção | Valor operacional RH/DP                      | Risco       | Contratos prontos   | Gate que bloqueia           | Decisão necessária |
| ----- | -------------------------------------------- | ----------- | ------------------- | --------------------------- | ------------------ |
| A     | Alto: corrige quem hoje não pode ser operado | Baixo-médio | Sim, integralmente  | Nenhum                      | Produto (2 pontos) |
| B     | Alto: conveniência na ficha                  | Médio       | Sim (servidor)      | Parcial (`-11`; `-12` fora) | Produto e RH/DP    |
| C     | Médio-alto: localização                      | Baixo-médio | Não (API estendida) | Nenhum                      | Produto            |

## 4. Recomendação

**Opção A — abas operacionais sem o teto de 100 colaboradores.** É a única das
três que corrige uma falha: hoje, acima de 100 pessoas, parte do quadro fica
fora das telas onde RH e DP operam movimentações, contrato e jornada. Usa só
contratos aprovados, não toca API, schema, migration nem RBAC, não depende de
gate aberto, não envolve dado pessoal novo e deixa a opção B sobre uma base que
funciona em qualquer tamanho de empresa. A O1 da T186 continua como
observação.

Para seguir com A, a proprietária precisa decidir:

1. **Como escolher o colaborador:** campo de busca por nome ou matrícula com
   resultados paginados do servidor (recomendado), ou seletor que pagina a
   lista inteira.
2. **Alcance:** as três abas na mesma entrega — Histórico funcional, Dados
   contratuais e Horário de trabalho (recomendado) — ou só o Histórico
   funcional agora; e se a correção da largura da aba Histórico funcional
   (pendência T115) entra junto (recomendado).

## 5. Decisão da proprietária (2026-10-27)

**Opção A aprovada, completa**, com as respostas recomendadas:

1. **Busca por nome ou matrícula com resultados paginados pelo servidor** no
   lugar do seletor de uma página de 100.
2. **As três abas** — Histórico funcional, Dados contratuais e Horário de
   trabalho — na mesma entrega, **com a lista de movimentações paginada** e a
   **correção da largura** do Histórico funcional.

Escopo final:

- **Contratos:** só os existentes — `GET /v1/colaboradores` (`busca`,
  `pagina`, `tamanhoPagina` e, no Horário, `situacao=ativo`),
  `GET /v1/colaboradores/:id` (nome da seleção vinda da ficha, T187) e
  `GET /v1/movimentacoes` (`pagina`, `tamanhoPagina`). A empresa é sempre a
  da sessão; ninguém de outra empresa aparece.
- **Seleção:** a escolha continua à vista ("Selecionado") quando a busca muda;
  desfazê-la é explícito. Seleção vinda da ficha que o servidor recusa não
  seleciona ninguém. Troca de empresa remonta a tela, e nada fica.
- **Regras preservadas:** com um só colaborador no escopo (Dados contratuais)
  ou um só ativo (Horário), ele é escolhido sozinho, como antes; buscar nunca
  escolhe por conta própria. O Horário passa a contar os ativos no servidor
  (`situacao=ativo`, regra da T178) em vez de na página de 100.
- **Largura:** a causa medida era o texto só para leitor de tela (`.sr-only`,
  `position: absolute`) da coluna Ações escapar do quadro rolável da tabela;
  o quadro passa a ser posicionado e só ele rola.
- **Permissões:** inalteradas — RH e DP conforme os contratos; o
  `master_tecnico` no alcance já autorizado; gestor, colaborador, financeiro e
  demais negados pelo servidor.
- **Fora:** opções B e C, O1 da T186, catálogos organizacionais acima de 100
  itens e a tabela de vínculos de horário (que segue numa página de 100 e
  resolve nomes pela primeira página), formulários e regras dos módulos,
  qualquer escrita, papel ou permissão nova, dado pessoal novo.
