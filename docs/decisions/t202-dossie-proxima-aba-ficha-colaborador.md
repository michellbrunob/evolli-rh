# T202 — Dossiê: próxima aba funcional da ficha do colaborador

**Situação:** decisões P-1 a P-5 aprovadas pela proprietária em 2026-11-04;
a aba Registros de ponto foi implementada e validada localmente — ver a seção 10. Sem API, schema, migration, RBAC, auditoria, seed ou dependência nova.

**Base:** `main` em `8e1c7e9` (T201 integrada, PR #194). A ficha individual
tem cinco abas reais: Dados do colaborador, Vida funcional, Dados contratuais,
Jornada de trabalho e Documentos
([dossiê da T201](t201-dossie-ficha-colaborador-funcional.md)).

**Decisões que já valem** (T201, seção 9):

- Solicitações, quando entrar na ficha, some para o DP (F-6);
- Ponto, quando entrar, é só consulta, com a competência na rota (F-7);
- Vida funcional segue sem operações (F-8);
- nada de aba decorativa.

## 1. Resumo e recomendação

**Qual "Solicitações".** As solicitações **de documento** já estão na aba
Documentos (T201). A candidata aqui é a **Central de Solicitações de Pessoas**
(T139/T140): ajuste de ponto, ausência, férias, atualização cadastral,
atestado e benefícios. É ela que o servidor nega ao DP, o que dá sentido à
decisão F-6.

**Recomendação: Ponto, só consulta, com o mês na URL.** É a fatia mais segura
e a única que fica completa sem decisão de produto grande:

- os três perfis que abrem a ficha (RH, DP e `master_tecnico`) já leem ponto
  no servidor, então nenhuma aba some por perfil;
- sem escrita, não há formulário, guarda de saída nem permissão de escrita a
  conferir;
- F-7 já fixou o escopo (consulta, registro e ajuste seguem no módulo de
  Ponto);
- os contratos existem e só falta uma função no cliente web.

Solicitações rende mais para o RH, mas pede decisões que ainda não existem
(seção 4.3) e, para "agir", um fluxo de oito transições dentro da ficha. Fica
como a próxima candidata, sem número reservado.

## 2. Estado atual (evidência)

### 2.1 Solicitações de Pessoas

| Item             | Evidência                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotas            | `GET /solicitacoes-pessoas`, `GET /:solicitacaoId`, `GET /:solicitacaoId/historico`, `POST /`, `POST /:solicitacaoId/transicoes` (`apps/api/src/solicitacoes-pessoas/solicitacao-pessoa.controller.ts:39-128`). Sem PATCH nem DELETE                                |
| Filtros da lista | `empresaId`, `vinculoId`, `tipo`, `situacao`, `pagina`, `tamanhoPagina` até 100 (`dto/solicitacoes-pessoas.dto.ts:142-158`). **Sem `colaboradorId` e sem período**; parâmetro desconhecido dá 400 (`apps/api/src/main.ts:26-28`, `forbidNonWhitelisted`)            |
| Ordem            | Fixa, `criadoEm desc, id` (`solicitacao-pessoa.service.ts:323`)                                                                                                                                                                                                     |
| Forma do item    | `id`, `empresaId`, `vinculoId`, `tipo`, `motivo` (catálogo fechado), `situacao`, `periodoReferencia`, `registradoPorUserId`, datas (`apps/api/prisma/schema.prisma:1796-1841`). Sem `colaboradorId`, sem nome, sem texto livre, sem anexo                           |
| Transições       | `enviar`, `cancelar`, `iniciar_revisao`, `aguardar_informacao`, `retomar_revisao`, `encaminhar_para_operacao`, `recusar`, `reabrir`; `motivo` obrigatório para recusar e reabrir (`dto/solicitacoes-pessoas.dto.ts:61-70`; `solicitacao-pessoa.service.ts:177-182`) |
| RBAC             | `rh` cria, lê e altera na própria empresa; `master_tecnico` só lê; **`dp` negado em tudo**, assim como gestor, colaborador e os demais (`apps/api/src/auth/authorization/rbac.evaluator.ts:602-630`)                                                                |
| Escopo           | Empresa da sessão; `master_tecnico` sem empresa lê **todas** as empresas; com empresa, só a dela; fora do escopo dá 404 (`escopo-solicitacoes-pessoas.util.ts:55-87`)                                                                                               |
| Auditoria        | Toda leitura (lista, detalhe, histórico) grava `pessoas_solicitacao_consultada`, e a leitura falha se a auditoria falhar; escrita na mesma transação (`solicitacoes-pessoas-auditoria.service.ts:35-87`)                                                            |
| Tela atual       | `SolicitacoesScreen` em Pessoas: escolhe pessoa e **um** vínculo, lista, detalhe com histórico; ações só para `rh` com empresa (`apps/web/src/screens/pessoas/SolicitacoesScreen.tsx:113-125`); guarda com o rótulo "Solicitações" (`:188-195`)                     |
| Cliente web      | `listarSolicitacoesPessoas`, `detalharSolicitacaoPessoa`, `historicoSolicitacaoPessoa`, `registrarSolicitacaoPessoa`, `transicionarSolicitacaoPessoa` (`apps/web/src/api/solicitacoesPessoasClient.ts:251-316`)                                                     |
| Testes           | E2E completo do domínio (`apps/api/test/solicitacoes-pessoas.e2e-spec.ts`), RBAC, serviço, cliente e tela. **Sem teste do `master_tecnico` com empresa ativa neste domínio**                                                                                        |

### 2.2 Ponto

| Item             | Evidência                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotas            | `GET /vinculos/:vinculoId/pontos?competencia=` (só leitura, `apps/api/src/ponto/evento/vinculo-ponto.controller.ts:39-55`); `GET/POST /pontos`, `GET /pontos/:pontoId`, `GET/POST /pontos/:pontoId/ajustes` (`evento-ponto.controller.ts:43-131`). Sem PATCH, PUT ou DELETE                    |
| Filtros          | `competencia` (`AAAA-MM`), `tipo`, `pagina`, `tamanhoPagina` até 100 (`dto/ponto.dto.ts:120-141`; `ponto.types.ts:18-19`). **Sem `colaboradorId` e sem intervalo de datas**                                                                                                                    |
| Ordem            | `momento` original desc, `id` (`evento-ponto.service.ts:416`)                                                                                                                                                                                                                                  |
| Forma do item    | `id`, `vinculoId`, `empresaId`, `tipo` (entrada, saída, início e fim de pausa), `momento`, `competencia`, `registradoPorUserId`, `registradoEm` e `efetivo {tipo, momento, anulado, totalAjustes}` (`evento-ponto.service.ts:47-57`; `ponto.types.ts:30-37`)                                   |
| O que não existe | Total, saldo, hora extra, jornada esperada, espelho, fechamento, inconsistência; foto, biometria e geolocalização (`evento-ponto.service.ts:75-76`; `schema.prisma:1276-1287`). Os motores puros de apuração não estão ligados a rota nenhuma (`apps/api/src/ponto/apuracao/apuracao.ts:1-18`) |
| Regra de produto | ADR 0008 §7 e decisão 6 do Baseline: a competência só agrupa, sem cálculo (`docs/adr/0008-jornada-ponto-rastreavel-baseline-v1.md:122-129`). Dados só sintéticos até o gate de dados reais (`:141-155`)                                                                                        |
| RBAC             | `rh` e `dp` criam e leem na própria empresa; `master_tecnico` só lê; gestor, colaborador e os demais negados (`rbac.evaluator.ts:512-553`)                                                                                                                                                     |
| Escopo           | Empresa da sessão; `master_tecnico` sem empresa lê **todas**; com empresa, só a dela; fora do escopo dá 404 (`apps/api/src/ponto/escopo-ponto.util.ts:58-94`)                                                                                                                                  |
| Auditoria        | Toda leitura grava `ponto.consultado` (uma linha por página lida), sem horário nem dado pessoal no registro (`ponto-auditoria.service.ts:11-16,62-95`)                                                                                                                                         |
| Tela atual       | "Visão do período" (`apps/web/src/screens/ponto/VisaoPeriodoScreen.tsx`): lista a empresa toda, filtro de vínculo, competência e tipo em estado local (sem URL), registra e ajusta; as outras sete abas do Ponto são demonstrativas                                                            |
| Cliente web      | `listarPontos`, `buscarPonto`, `registrarPonto`, `registrarAjustePonto` (`apps/web/src/api/pontoClient.ts:128-173`). **Falta** a função de `GET /vinculos/:vinculoId/pontos`                                                                                                                   |
| Testes           | E2E do domínio (`apps/api/test/ponto.e2e-spec.ts`). **Sem teste positivo de `GET /vinculos/:vinculoId/pontos`** (só como negação) e **sem teste do `master_tecnico` com empresa ativa no ponto**                                                                                               |
| Dados de prévia  | O seed de demonstração não cria marcação (`apps/api/src/seed/demo-seed.ts`); a prévia precisa registrar marcações sintéticas pela Visão do período                                                                                                                                             |

### 2.3 Ficha

- Abas em `ABAS_DA_FICHA` (`apps/web/src/app/rotasDoShell.ts:64-70`); a rota
  tem no máximo dois segmentos depois do prefixo (`fichaDaRota`, `:87-95`).
- A guarda conta edições pela área `ficha` ("Ficha do colaborador"), com as
  seções avisando por `onAlteradoChange` e `onSalvandoChange`.
- A aba Documentos fixou o padrão de empresa ativa: sem ela, a aba orienta e
  não lê (F-4, `DocumentosColaboradorSecao.tsx:19-23`).
- A ficha já tem "Jornada de trabalho" (a escala); o menu do Ponto se chama
  "Jornada". O nome da aba nova precisa evitar a confusão.

## 3. Comparação objetiva

| Critério                        | Solicitações de Pessoas                                                       | Ponto (só consulta)                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dados e ações existentes        | Lista, detalhe, histórico; registrar e 8 transições (só RH)                   | Marcações da competência com valor efetivo e contagem de ajustes; nenhuma escrita na ficha |
| Filtro por pessoa               | Não há: uma consulta por vínculo (`vinculoId`)                                | Não há: uma consulta por vínculo (`/vinculos/:vinculoId/pontos`)                           |
| Filtro por período              | Não há (só `periodoReferencia` no item)                                       | `competencia` obrigatória na proposta, já aceita pelo servidor                             |
| Quem vê na ficha                | RH e `master_tecnico`; **DP não** (aba some, F-6)                             | RH, DP e `master_tecnico`, iguais à ficha                                                  |
| Quem age                        | RH com empresa (decidir se age na ficha)                                      | Ninguém (F-7)                                                                              |
| `master_tecnico` sem empresa    | Leitura global: misturaria empresas (decidir)                                 | Leitura global: misturaria empresas (decidir)                                              |
| URL                             | `…/solicitacoes`                                                              | `…/ponto/AAAA-MM` (extensão da rota da ficha)                                              |
| Guarda global de saída          | Necessária se houver registro ou transição                                    | Não se aplica (sem formulário)                                                             |
| Paginação                       | Por vínculo, 100 no máximo; não dá para juntar páginas de vínculos diferentes | Por vínculo, 100 no máximo; um mês pode passar de 100 marcações (4 por dia × 31 = 124)     |
| Auditoria por abertura          | Uma linha por vínculo e página, mais detalhe e histórico                      | Uma linha por vínculo e página                                                             |
| Conteúdo sensível               | Tipo "atestado" (já visível na tela de Pessoas, mesma permissão)              | Horários de marcação (já visíveis na Visão do período, mesma permissão)                    |
| Lacunas que exigem API ou regra | Nenhuma para ler; filtro por pessoa seria contrato novo                       | Totais, saldo ou espelho exigiriam API nova e emenda à ADR 0008 (fora)                     |
| Tamanho da fatia completa       | Médio a grande (com ações) ou incompleta (só leitura, ações em outra tela)    | Pequeno e completo por definição (F-7)                                                     |

## 4. Proposta da primeira fatia: aba Ponto, só consulta

### 4.1 Escopo

- **Aba nova `ponto`** em `ABAS_DA_FICHA`, depois de `documentos`, com rótulo
  **"Registros de ponto"** (evita confundir com "Jornada de trabalho").
- **Rota com a competência:** `#/pessoas/colaboradores/:colaboradorId/ponto/AAAA-MM`.
  - `fichaDaRota` passa a aceitar o terceiro segmento só para `ponto`, com o
    formato do servidor (`^[0-9]{4}-(0[1-9]|1[0-2])$`); fora dele, não é rota.
  - `…/ponto` sem mês abre a competência do dia civil do navegador e corrige a
    URL no lugar, como "rota sem aba vale dados" (P-4).
  - Trocar de mês empilha uma entrada no histórico: voltar e avançar percorrem
    os meses.
- **Seletor de competência** (mês anterior, próximo e campo de mês) com rótulo
  visível; a competência escolhida aparece no título do bloco.
- **Conteúdo:** as marcações da competência de cada vínculo da pessoa na
  empresa ativa (P-3), um bloco por vínculo, o principal primeiro:
  - agrupadas por dia civil no fuso de São Paulo (o mesmo do servidor), em
    ordem do momento **efetivo**;
  - cada marcação: horário efetivo, tipo efetivo e situação ("Ajustada",
    com o registro original quando o ajuste mudou horário ou tipo, ou
    "Anulada"); nenhuma contagem;
  - anuladas aparecem marcadas, nunca somem (P-5);
  - quem registrou não aparece (o contrato traz só o id da conta).
- **Aviso fixo:** a aba mostra as marcações registradas, sem total, saldo,
  horas trabalhadas ou comparação com a jornada (ADR 0008 §7); registrar e
  ajustar seguem em Jornada › Visão do período.
- **Sem empresa ativa** (`master_tecnico` global): a aba orienta a escolher a
  empresa e não lê nada (P-2, mesmo padrão de F-4).
- **Paginação:** a aba lê todas as páginas da competência de cada vínculo
  (100 por página, guiada por `total`) antes de mostrar o bloco, para nunca
  exibir um mês truncado; a falha em qualquer página de qualquer vínculo
  vira falha do mês, com nova tentativa que relê tudo.

### 4.2 Contratos

- **Reaproveitados, sem mudança:**
  - `GET /v1/users/me` — empresa ativa da sessão;
  - `GET /v1/colaboradores/:colaboradorId/vinculos` — vínculos no escopo;
  - `GET /v1/vinculos/:vinculoId/pontos?competencia=&pagina=&tamanhoPagina=100`.
- **Mudança só no web:** função nova no `pontoClient` para a rota por vínculo.
- **Não usados:** `GET /pontos/:pontoId/ajustes` (uma chamada por marcação,
  cada uma auditada); o item já traz o valor efetivo e a contagem de ajustes.

### 4.3 O que não entra

- Registrar marcação, registrar ajuste ou ver o detalhe dos ajustes.
- Total, saldo, horas trabalhadas, espelho, fechamento, inconsistência e
  comparação com a jornada esperada.
- Mudança na Visão do período, no menu Jornada ou nas demais abas.
- Solicitações de Pessoas na ficha.

### 4.4 Se a escolha for Solicitações

Exigiria, antes de implementar:

- decidir se a ficha só lê (lista, detalhe e histórico) ou também registra e
  transiciona; agir na ficha traz as oito transições, o motivo obrigatório e
  a escolha explícita de vínculo para registrar;
- aplicar F-6 (a aba some para o DP) e o padrão de F-4 para o
  `master_tecnico` sem empresa;
- decidir como paginar com vários vínculos (um bloco por vínculo, como no
  Ponto, ou um contrato novo filtrado por pessoa);
- extrair da `SolicitacoesScreen` uma seção sem título próprio, sem seletor de
  pessoa e ligada à guarda da área `ficha`.

## 5. Riscos

| Risco                     | Cuidado na implementação                                                                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolamento entre empresas | Vínculos e marcações vêm só do escopo da sessão; a aba descarta item cujo `vinculoId` ou `empresaId` não seja do bloco. URL de outra pessoa dá "não encontrado". A troca de empresa remonta a árvore (T163)                                                                                              |
| Respostas atrasadas       | Geração por leitura (pessoa, competência, vínculo): resposta de outro mês ou de outra pessoa nunca substitui a tela                                                                                                                                                                                      |
| Mês truncado              | Ler todas as páginas pelo `total`; nunca mostrar só as 100 primeiras                                                                                                                                                                                                                                     |
| Regra de negócio nova     | Nenhum cálculo: agrupar por dia e ordenar é apresentação; somar ou parear entrada e saída é proibido pela ADR 0008 §7                                                                                                                                                                                    |
| Fuso                      | Agrupar pelo dia civil de São Paulo, como o servidor; nunca pelo fuso do navegador                                                                                                                                                                                                                       |
| Auditoria                 | Cada abertura grava uma linha por vínculo e página; ler só a aba visitada e não reler ao voltar a ela                                                                                                                                                                                                    |
| Foco e anúncios           | Rota direta: foco no título da ficha. Troca de aba: foco na aba. Troca de mês: foco no controle usado; um só nó de status anuncia a carga e o resultado ("Registros de ponto de novembro de 2026 carregados" ou "Nenhuma marcação em novembro de 2026"), sem contagem. Falha com nova tentativa no lugar |
| 375 px                    | Seis abas na grade de duas colunas (três linhas, sem aba sozinha). Seletor de mês empilhado; tabelas rolam no próprio quadro posicionado (T201); controles com 44 px                                                                                                                                     |
| Prévia vazia              | O seed não cria marcação: registrar marcações sintéticas pela Visão do período antes da validação                                                                                                                                                                                                        |
| Nome                      | "Registros de ponto", e não "Jornada" nem "Ponto" sozinho, para não confundir com "Jornada de trabalho"                                                                                                                                                                                                  |

## 6. Critérios de aceite

1. A aba "Registros de ponto" aparece para RH, DP e `master_tecnico`; os
   perfis sem ficha seguem sem ela. Nenhum perfil vê controle de escrita.
2. `…/ponto/AAAA-MM` abre a ficha na aba e no mês; recarregar mantém; trocar
   de mês muda a URL e voltar e avançar percorrem os meses; mês inválido não
   é rota; sem mês, vale o mês corrente, corrigido na URL.
3. Só aparecem marcações da pessoa, na empresa ativa, na competência da URL,
   de todos os vínculos dela nessa empresa, um bloco por vínculo.
4. `master_tecnico` sem empresa ativa vê a orientação, sem consulta; com
   empresa, lê só aquela empresa.
5. O mês com mais de 100 marcações aparece inteiro.
6. Ajustadas e anuladas são marcadas; nada de total, saldo ou comparação.
7. Estados de carga, vazio ("Nenhuma marcação em novembro de 2026"), falha e
   nova tentativa, com foco e um anúncio por evento.
8. A 375 px não há rolagem horizontal da página.

## 7. Plano de testes

- **Unidade (web):**
  - `fichaDaRota` e `rotaDaFicha` com a competência (válida, inválida, sem
    mês);
  - seção: um bloco por vínculo, filtro por pessoa e empresa, todas as
    páginas, agrupamento por dia em São Paulo, ordem efetiva, ajustada e
    anulada, sem empresa, perfis, carga, vazio, falha, nova tentativa,
    respostas atrasadas (troca de mês e de pessoa), foco e anúncios;
  - ausência de controle de escrita e de qualquer total.
- **Shell (`App.ficha.test.tsx`):** rota direta com mês, recarga, troca de
  mês com histórico, mês inválido, perfis negados, troca de empresa.
- **API (só testes, sem mudar código):** caso positivo de
  `GET /v1/vinculos/:vinculoId/pontos` e `master_tecnico` com empresa ativa
  no ponto, as duas lacunas achadas.
- **Prova de falha:** cada teste novo falha sem a mudança correspondente.
- **Localhost com dados sintéticos:** marcações registradas pela Visão do
  período em dois meses e em dois vínculos; RH, DP, `master_tecnico` com e
  sem empresa, gestor; teclado; 375 px.
- **Bateria completa:** web, API unitária, E2E com PostgreSQL real
  (`--runInBand`), scripts, lint, typecheck, build, Prettier, `spec:check`,
  prévia do squash e `git diff --check`.

## 8. Decisões (aprovadas em 2026-11-04)

Todas aprovadas como recomendado.

| Id  | Pergunta                                                              | Recomendação                                                                                                                      |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | Qual é a próxima aba: Ponto (só consulta) ou Solicitações de Pessoas? | **Ponto**: todos os perfis da ficha leem, sem escrita, escopo já fixado por F-7, só uma função nova no cliente                    |
| P-2 | `master_tecnico` sem empresa ativa na aba de ponto                    | **Pedir empresa ativa**, sem consulta (mesmo padrão de F-4), para não misturar marcações de empresas diferentes                   |
| P-3 | Quais vínculos mostrar                                                | **Todos os da pessoa na empresa ativa**, um bloco por vínculo, o principal primeiro, inclusive encerrados (o mês pode ser antigo) |
| P-4 | Mês quando a URL não traz                                             | **Mês corrente do navegador**, corrigido na URL no lugar                                                                          |
| P-5 | Marcações anuladas                                                    | **Mostrar, marcadas como anuladas**: a ficha mostra o que foi registrado, com o efeito dos ajustes                                |

## 9. Limites e fora de escopo

- **Na etapa de preparação (histórico):** nenhum código de produto, API,
  schema, migration, RBAC, auditoria, Docker, seed, dependências, lockfile ou
  workflow; sem push e sem PR. Isso valeu só para a preparação.
- **Na entrega:** sem API, schema, migration, RBAC, auditoria, Docker, seed,
  dependências, lockfile ou workflow; os testes de API novos só exercitam o
  contrato existente.
- **Na primeira fatia:** só a aba de ponto (seção 4). Ficam de fora registro e
  ajuste na ficha, totais e saldo, espelho e fechamento, comparação com a
  jornada, dados reais ou integração de relógio, acesso do gestor e do
  colaborador, e Solicitações de Pessoas.
- **Sempre:** nada de aba decorativa nem aviso de "em breve".

## 10. Entrega da primeira fatia

### 10.1 O que foi feito

- **Aba `ponto`** em `ABAS_DA_FICHA`, depois de `documentos`, rótulo
  "Registros de ponto" e ícone próprio. Rota
  `#/pessoas/colaboradores/:colaboradorId/ponto/AAAA-MM`:
  - `fichaDaRota` aceita o terceiro segmento só na aba de ponto e só no
    formato do servidor; mês inválido, mês em outra aba ou segmento a mais não
    é rota;
  - `…/ponto` sem mês abre o mês corrente do navegador, e a URL é corrigida no
    lugar (sem entrada nova);
  - trocar de mês empilha uma entrada; voltar e avançar percorrem os meses;
  - trocar de aba e voltar à de ponto reabre o último mês visto nesta ficha.
- **Seção nova `RegistrosPontoColaboradorSecao`**:
  - empresa ativa da sessão por `GET /v1/users/me`; sem ela, orientação e
    nenhuma consulta (P-2);
  - os vínculos vêm da ficha, filtrados pela pessoa e pela empresa da sessão,
    o principal primeiro, encerrados incluídos (P-3);
  - `GET /v1/vinculos/:vinculoId/pontos?competencia=` por vínculo, todas as
    páginas de 100 pelo `total`, sem repetir marcação entre páginas e
    descartando o que não for do vínculo, da empresa ou do mês;
  - marcações agrupadas pelo dia civil de São Paulo e ordenadas pelo horário
    efetivo; "Ajustada" (com o registro original quando mudou) e "Anulada"
    (marcada, nunca some — P-5); quem registrou não aparece;
  - controle de mês com "Mês anterior", campo de mês e "Próximo mês"; só um
    mês válido vira rota;
  - um só nó de status do começo ao fim (sessão e marcações), falha com alerta
    e "Tentar de novo" que fica focado com `aria-disabled` durante a nova
    leitura; sucesso leva o foco ao título da aba;
  - resposta atrasada de outro mês, de outra pessoa ou de uma montagem
    anterior não substitui a tela;
  - sem formulário: nenhuma edição pendente, a guarda da T200 não pergunta
    ao sair nem na troca de empresa.
- **Cliente web:** `listarPontosDoVinculo` em `pontoClient.ts`, para a rota que
  já existia.
- **Sem escrita e sem cálculo:** nenhum botão além do controle de mês; nada de
  total, saldo, horas trabalhadas ou contagem.
- **375 px:** seis abas em três linhas de duas; controle de mês que quebra
  linha; listas por dia em vez de tabela; campo de mês com 44 px.

### 10.2 Diferenças em relação à proposta

- A falha é do mês inteiro (todos os vínculos), e não de um bloco: uma
  nova tentativa relê tudo, e a tela nunca mostra parte de um mês.
- O anúncio de resultado não traz número de marcações, e a situação
  "Ajustada" não traz a contagem de ajustes: a ficha não exibe nenhuma métrica
  derivada. Quando o ajuste mudou horário ou tipo, aparece o registro original.

### 10.3 Testes e validação

- **Web:**
  - `RegistrosPontoColaboradorSecao.test.tsx` (25 casos): vínculos, pessoa,
    empresa e competência; master sem e com empresa; perfis sem escrita; dia
    em São Paulo e ordem efetiva; ajustada e anulada; nenhum cálculo; mês com
    130 marcações em duas páginas; repetição entre páginas; falha numa página
    seguinte; um só nó de status; vazio; falha e nova tentativa; troca de mês,
    virada de ano, campo de mês, resposta atrasada e desmontagem; 375 px;
  - `App.ficha.test.tsx`: rota com competência (válida, sem mês, inválida),
    competência vizinha, rota direta, recarga, URL sem mês corrigida no lugar,
    mês inválido, troca de mês com voltar e avançar, troca de aba com o último
    mês, outra pessoa pela URL, fora da empresa, perfis negados e saída sem
    pergunta;
  - `AutenticacaoApp.test.tsx`: troca de empresa com a leitura de ponto em
    curso;
  - `pontoClient.test.ts`: rota, query, sem CSRF, 404;
  - `FichaColaboradorScreen.test.tsx`: seis abas e teclado.
- **API (só testes, `ponto.e2e-spec.ts`):** leitura por vínculo para RH e DP,
  paginação pelo total, recusas 400, isolamento 404 nos dois sentidos, perfis
  negados, master global, master com empresa ativa (só a empresa; a outra é
  404; continua sem escrita) e auditoria `ponto.consultado` por leitura.
- **Prova de falha:** onze mutações do código, cada uma derrubando ao menos um
  teste:
  - filtro defensivo de item;
  - master sem empresa consultando;
  - só a primeira página;
  - sem deduplicar;
  - sem geração de leitura;
  - ordem pelo momento original;
  - principal fora do primeiro lugar;
  - vínculo de outra empresa;
  - anulada sem marca;
  - rota aceitando mês inválido;
  - troca de aba sem guardar o último mês.
- **Localhost** (banco isolado, dados sintéticos; pessoas pela API de
  Pessoas e marcações, ajuste e anulação pela tela Jornada › Visão do
  período):
  - uma pessoa com vínculo de estágio encerrado (7 marcações em junho, uma
    ajustada e uma anulada) e vínculo CLT ativo (112 marcações em outubro e 2
    em novembro);
  - RH: rota direta, 112 marcações em duas páginas, junho com ajustada e
    anulada e o 23:30 no dia certo, voltar e avançar, URL sem mês corrigida,
    "Mês anterior" pelo teclado com o foco no botão;
  - DP: só leitura;
  - `master_tecnico`: sem empresa, orientação e nenhuma consulta de ponto;
    com a Alfa, só leitura; trocando para a Beta, volta à listagem e a pessoa
    da Alfa dá "não encontrado";
  - gestor: sem ficha e sem requisição;
  - 375 px sem rolagem horizontal.
