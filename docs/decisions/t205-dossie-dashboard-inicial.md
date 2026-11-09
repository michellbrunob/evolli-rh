# T205 — Dossiê: Dashboard inicial pós-login

**Situação:** em implementação, validada localmente. Decisões D-1 a D-12
(seção 12) aprovadas pela proprietária em 2026-11-09, como recomendado, e
implementadas sem ampliar o escopo (seção 15). Só web e testes; nenhuma API
nova, banco, schema, migration, RBAC, auditoria, Docker, seed, dependência,
lockfile ou workflow; sem push e sem PR.

**Base:** `main` em `f51c21d` (T204 integrada, PR #197).

**Diretrizes que já valem:**

- o Dashboard é a página inicial depois do login e funciona como visão
  executiva operacional de RH, não como tela decorativa;
- cada cartão, filtro, gráfico, aba ou ação tem fonte de dado real e
  comportamento funcional; o que não tiver contrato, dado confiável, cálculo
  aprovado ou permissão definida fica fora, com critério de entrada;
- o módulo é fechado por completo antes de outro módulo começar;
- a identidade visual é a do Evolli, sem ativo de marca novo.

## 1. Resumo e recomendação

**Hoje não existe Dashboard real.** Depois do login, todo papel cai no Hub
"Seu acesso" (conta, empresa ativa e os produtos liberados). A "Visão geral"
do menu é uma superfície de demonstração com números de exemplo. O único
painel com dados reais é o de Colaboradores (T199): totais e ativos por tipo
de vínculo, dentro da listagem de Pessoas.

**Recomendação para a primeira fatia: "Visão geral do ano", só com dados que
o Evolli já tem e contratos que já existem**, para RH, DP e `master_tecnico`
com empresa ativa, em cinco elementos (E-1 a E-5, seção 6.2):

- **período:** um ano civil, o corrente por padrão, até hoje, na URL;
- **resumo:** ativos hoje, em admissão hoje, admissões e desligamentos
  efetivados no período e a diferença entre eles, com uma frase-resumo legível;
- **ativos por tipo de vínculo;**
- **admissões e desligamentos por mês** do período (barras e tabela);
- **momento da leitura** e "Atualizar".

Tudo sai de duas leituras existentes — `GET /v1/colaboradores` (contadores
do escopo) e `GET /v1/movimentacoes` (admissões e desligamentos efetivados) —
sem endpoint novo, sem auditoria extra para RH e DP e sem biblioteca nova.

Por quê:

- é o maior conjunto útil que os contratos atuais sustentam sem cálculo
  proibido (ADR 0008) nem dado sensível (ADR 0007, ADR 0011, ADR 0015);
- não cria aba, gráfico ou indicador sem fonte: o que exige dado ou decisão
  que ainda não existe (turnover, série histórica mês a mês, pendências,
  ponto, custo, ausência) fica fora com critério de entrada (seção 8);
- reaproveita padrões já provados: contadores da T199, competência na URL
  (T202), período em São Paulo, barra em CSS com legenda em texto.

## 2. Estado atual (evidência)

### 2.1 O que abre depois do login

- **Sempre o Hub "Seu acesso"**, para todos os papéis: sem rota no endereço,
  `destinoAberto` é `null` e o Hub é montado
  (`apps/web/src/app/AutenticacaoApp.tsx:161-163` e `:587-599`). O shell só
  monta quando a pessoa escolhe um produto (`:600-626`). Antes do Hub:
  sessão (`GET /v1/auth/csrf`) e ator (`GET /v1/users/me`) (`:212-268`).
- **O Hub não tem endereço.** Só três destinos têm rota: Colaboradores, Nova
  admissão e Jornadas de trabalho, além da ficha e da listagem com parâmetros
  (`apps/web/src/app/rotasDoShell.ts:44-50` e `:305-312`). Recarregar numa
  rota conhecida reabre o shell direto; nas demais telas, volta ao Hub
  (`apps/web/src/app/App.tsx:665-686`).
- **Destino padrão por papel**, usado quando o shell monta sem destino ou
  recusa um destino (`apps/web/src/app/mapaNavegacao.ts:433-443`):
  `rh`, `dp` e `master_tecnico` → Pessoas; `gestor` → Minha equipe; os
  demais → "Visão geral" demonstrativa.
- **Produtos do Hub por papel** (`mapaNavegacao.ts:507-536`): RH 8, DP 6,
  `master_tecnico` 5, gestor só a equipe, demais nenhum
  (`apps/web/src/app/HubPosLogin.tsx:247-252`).
- **Empresa ativa:** RH e `master_tecnico` trocam de empresa
  (`apps/api/src/auth/session/contexto-empresarial.ts:57`); o
  `master_tecnico` sem empresa aparece como acesso global
  (`apps/web/src/app/SeletorEmpresaAtiva.tsx:173`). A troca recria a árvore
  inteira (`AutenticacaoApp.tsx:584`).
- **Volta ao Hub** pelo topo do shell (`App.tsx:629-632`).

### 2.2 Telas parecidas com um painel

| Tela                                                            | Dados                                                   | Observação                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hub "Seu acesso" (`HubPosLogin.tsx`)                            | Sessão real (ator, empresa, produtos)                   | Não é operacional: não mostra nenhum número do negócio                                                   |
| "Visão geral" (`screens/inicio/InicioVisaoGeralScreen.tsx`)     | **Exemplo fixo** (`inicioVisaoGeral.fixtures.ts:20-58`) | Selo "Versão demonstrativa"; teste proíbe chamada ao servidor (`InicioVisaoGeralScreen.test.tsx:98-103`) |
| Colaboradores (T199, `screens/pessoas/ColaboradoresScreen.tsx`) | **Real**: `GET /v1/colaboradores` com `contadores`      | Totais (ativos, em admissão, desligados, total) e ativos por tipo, com barra em CSS (`:1141-1241`)       |

O painel de Colaboradores já tem os estados certos (carregando, erro com
nova tentativa, falha só dos totais, vazio), anúncios em `role="status"`,
abas acessíveis e grade que cabe em 375 px (`ColaboradoresScreen.tsx:1141-1287`,
`ColaboradoresScreen.css:78-83` e `:343-370`).

### 2.3 Shell

- **Menu:** grupos em `mapaNavegacao.ts:204-361`; Demonstração no pé da barra
  (`PainelNavigation.tsx:276-285`), com a regra "nada aqui consulta o
  servidor" (`mapaNavegacao.ts:15-22` e `:308-309`).
- **Guarda de saída (T200):** vale para Hub, Sair, menu e voltar/avançar
  (`apps/web/src/app/guardaDeSaida.tsx:1-35`). Um painel só de leitura não
  cria edição pendente.
- **Responsivo:** a barra lateral vira gaveta abaixo de 834 px
  (`App.tsx:254`).

### 2.4 Período e URL já usados

- Competência `AAAA-MM` validada e corrigida no lugar
  (`rotasDoShell.ts:98-163`); navegador de mês com "anterior/próximo" e
  `<input type="month">`
  (`screens/pessoas/RegistrosPontoColaboradorSecao.tsx:455-483`).
- Estado da listagem na URL com `URLSearchParams`, valor inválido corrigido
  para o padrão e nunca dado pessoal na URL (`rotasDoShell.ts:186-297`). A
  listagem aceita `aba` (`ativos`, `em-admissao`, `desligados`…) e `tipo` de
  vínculo (`:170-173`, `:261-282`) — destino pronto para os cliques do
  Dashboard.

### 2.5 Componentes visuais

- `apps/web/package.json`: só `react` e `react-dom` em produção — **sem
  biblioteca de gráficos**.
- O único "gráfico" é a barra proporcional em CSS, com `aria-hidden` e
  legenda em texto (`ColaboradoresScreen.tsx:1211-1235`).
- Não há componente de cartão de indicador; há `Surface`, `StatusBadge`,
  `PageHeader`, `EmptyState`, `DataTable` e `Button`
  (`apps/web/src/components/index.ts`).

## 3. Dados reais disponíveis

| Fonte (`/v1`)                                       | Quem lê                      | Limites                                                                                                               | Auditoria da leitura                                                                                       | Uso possível                                                                    |
| --------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /colaboradores` → `contadores`                 | RH, DP, `master_tecnico`     | Uma chamada; contadores do escopo inteiro, sem filtros (`pessoas.types.ts:23-39`; `colaborador.service.ts:1244-1314`) | Nenhuma para RH/DP; `master_consulta_global` só no master sem empresa (`colaborador.service.ts:1316-1319`) | Ativos, em admissão, desligados, total e ativos por tipo de vínculo **hoje**    |
| `GET /colaboradores?departamentoId=` / `cargoId=`   | Idem                         | Uma chamada por nó (só `total`)                                                                                       | Idem                                                                                                       | Ativos por departamento ou cargo                                                |
| `GET /movimentacoes?tipo=&status=`                  | Idem                         | 100 por página; **sem filtro de período**; ordem `vigenciaInicio desc` (`movimentacao.service.ts:62-63`, `:159-177`)  | Idem                                                                                                       | Admissões e desligamentos efetivados por mês, paginando até o início do período |
| `GET /departamentos`, `/cargos`, demais referências | RH, DP, `master_tecnico`     | 100 por página                                                                                                        | Só leitura global                                                                                          | Rótulos para agrupar                                                            |
| `GET /solicitacoes-documento`                       | RH, DP, `master_tecnico`     | `total` = pendentes (estado único)                                                                                    | Só leitura global                                                                                          | Pendências de documento                                                         |
| `GET /solicitacoes-pessoas?situacao=`               | **Só RH e `master_tecnico`** | Uma chamada por situação                                                                                              | **Toda leitura grava, fail-closed** (`solicitacoes-pessoas-auditoria.service.ts:60-79`)                    | Pendências da Central                                                           |
| `GET /pontos?competencia=`                          | RH, DP, `master_tecnico`     | `total` de marcações                                                                                                  | **Toda leitura grava** `ponto_consultado`                                                                  | Volume de marcações (sem significado de gestão; ver ADR 0008)                   |
| `GET /horarios`                                     | RH, DP, `master_tecnico`     | Lista                                                                                                                 | **Toda leitura grava**                                                                                     | Número de jornadas ativas                                                       |

**Não existe** endpoint de resumo, estatística ou indicador além dos
`contadores` de Colaboradores; não há listagem de vínculos da empresa inteira
nem "situação da empresa numa data passada" (a situação numa data existe só
por vínculo, `vinculo.controller.ts:49-89`).

**Datas:** `dataAdmissao`, `dataDesligamento` e `vigenciaInicio` são datas
civis (`@db.Date`); agrupar por mês é fatiar `AAAA-MM` da própria string. O
"hoje" e o ano corrente precisam ser os de São Paulo: a web tem o fuso de
negócio (`apps/web/src/format/data.ts:62`), mas não um "hoje em São Paulo"
(o `hojeUtc` de `screens/pessoas/dadosPessoais.ts:192` usa UTC).

**Retificação:** a movimentação original fica `retificada` e a correção nasce
como movimentação nova, que só conta depois de efetivada
(`movimentacao.service.ts:395-402`). Contar só `efetivada` evita dupla
contagem.

## 4. Restrições das ADRs

- **ADR 0008 (ponto):** "apuração" é só agrupar por mês; não há hora extra,
  banco de horas, adicional, DSR, jornada legal, aprovação nem fechamento.
  Nenhum indicador de horas, saldo, atraso ou "folhas a conferir" é
  permitido.
- **ADR 0015 (gestor):** escopo só da equipe atribuída, projeção fechada;
  resumo de jornada e andamento de solicitações ficaram fora porque tipo e
  motivo revelam saúde. O gestor não recebe painel de empresa.
- **ADR 0007 / ADR 0011 / PD-SOL-05:** sem dado de saúde ou salário nesta
  versão; existência e tipo de documento podem revelar categoria sensível;
  nenhum agregado por "atestado".
- **ADR 0009:** métricas do domínio ainda pendentes de decisão.
- **ADR 0004:** sem retenção definida, a auditoria cresce sem limite — painel
  que grava auditoria a cada visita tem custo.

## 5. Papéis e isolamento

| Papel                              | Dashboard na 1ª fatia                                    | Por quê                                                                                                            |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `rh` (com empresa)                 | Sim, da empresa ativa                                    | Lê colaboradores e movimentações da própria empresa, sem auditoria por leitura                                     |
| `dp` (com empresa)                 | Sim, igual ao RH                                         | Mesmas leituras; nada da Central (negada ao DP) entra nesta fatia                                                  |
| `master_tecnico` com empresa ativa | Sim, só leitura, da empresa escolhida                    | O servidor restringe à empresa escolhida                                                                           |
| `master_tecnico` sem empresa ativa | Orientação para escolher a empresa, **nenhuma consulta** | Leitura global misturaria empresas e grava `master_consulta_global` a cada chamada; mesmo padrão de F-4, P-2 e S-2 |
| `gestor`                           | Não (continua em Minha equipe)                           | ADR 0015: nunca a empresa inteira                                                                                  |
| demais                             | Não (continuam no Hub)                                   | Sem permissão de leitura de Pessoas                                                                                |

Uma visão comum para RH, DP e `master_tecnico` com empresa é possível porque
todos os dados da 1ª fatia vêm de leituras que os três já fazem; não há
variação de conteúdo por papel nesta fatia.

## 6. Proposta da primeira fatia

### 6.1 Entrada

- **Rota própria** `#/dashboard`, primeiro item do menu.
- **Página inicial depois do login** para RH, DP e `master_tecnico`; gestor
  segue em Minha equipe e os demais no Hub (D-2). O Hub continua acessível
  pelo topo do shell.
- Recarregar e voltar/avançar funcionam como nas demais rotas do shell.

### 6.2 Elementos

**E-1 — Período**

- **Dado:** ano civil; o corrente (São Paulo) por padrão, "até hoje"; anos
  anteriores completos.
- **URL:** `#/dashboard?ano=AAAA`; sem parâmetro, o ano corrente; ano
  inválido ou futuro é corrigido no lugar (`replace`), sem entrada nova.
- **Controle:** "Ano anterior", "Próximo ano" (desabilitado no corrente) e
  seletor de ano; mudar o ano é entrada nova no histórico.
- **Permissões, estados e testes:** como os demais elementos; teste de rota,
  correção e histórico.

**E-2 — Resumo (cartões e frase)**

- **Dados e contratos:**
  - _Ativos hoje_ = `contadores.ativos` (pessoas com vínculo ativo);
  - _Em admissão hoje_ = `contadores.emAdmissao`;
  - _Admissões no período_ = movimentações `tipo=admissao`,
    `status=efetivada`, `vigenciaInicio` no ano e até hoje (vínculos);
  - _Desligamentos no período_ = idem com `tipo=desligamento`;
  - _Diferença_ = admissões − desligamentos.
- **Frase-resumo:** uma linha com os mesmos números (ex.: quantos ativos hoje,
  quantas admissões e desligamentos no ano), para leitura rápida e leitor de
  tela.
- **Clique:** Ativos → `#/pessoas/colaboradores?aba=ativos`; Em admissão →
  `?aba=em-admissao`. Admissões e desligamentos **não têm clique** nesta fatia
  (não há listagem por período para onde ir).
- **Estados:** carregando (o mesmo nó de status do começo ao fim); erro com
  "Tentar de novo" por bloco; zero é zero, nunca traço.
- **Acessibilidade / 375 px:** `<dl>` com rótulos; cartões em grade que
  encolhe para uma coluna; alvos de 44 px.
- **Testes:** valores a partir de respostas sintéticas; cliques; falha de
  cada fonte isolada.

**E-3 — Ativos por tipo de vínculo**

- **Dado:** `contadores.ativosPorTipo` (CLT, estágio, PJ, temporário, outro
  controlado), hoje.
- **Visual:** barra proporcional em CSS (`aria-hidden`) + lista com número e
  percentual em texto.
- **Clique:** cada tipo → `#/pessoas/colaboradores?aba=ativos&tipo=…`.
- **Vazio:** "Nenhum colaborador ativo".
- **Testes:** proporções, rótulos, cliques e ausência de tipo sem ninguém.

**E-4 — Admissões e desligamentos por mês**

- **Dado:** as mesmas duas séries de movimentações, agrupadas por
  `AAAA-MM` de `vigenciaInicio`, de janeiro ao mês corrente (ou dezembro, em
  ano passado).
- **Visual:** barras em CSS por mês (`aria-hidden`) e **tabela** com mês,
  admissões, desligamentos e diferença como forma principal de leitura.
- **Vazio:** "Nenhuma admissão ou desligamento efetivado em AAAA".
- **Limite:** paginação de 100 em ordem decrescente até passar do início do
  ano; acima do teto (D-7), aviso de período grande demais e nenhum número
  parcial.
- **375 px:** tabela rola dentro do próprio quadro; barras empilhadas.
- **Testes:** agrupamento por mês, fronteira de ano, exclusão de
  `retificada`/`cancelada`/`programada`, paginação, teto e respostas
  atrasadas ao trocar de ano.

**E-5 — Momento da leitura**

- **Dado:** a hora em que as leituras terminaram (São Paulo), "Lido às
  hh:mm"; botão "Atualizar" relê tudo; sem atualização automática.
- **Testes:** releitura, anúncio único, foco estável.

### 6.3 Comportamento comum

- **Leituras:** duas fontes, em paralelo; geração por leitura e descarte de
  resposta atrasada ou de componente desmontado; troca de empresa remonta.
- **Isolamento:** a empresa vem da sessão; o servidor restringe; o
  `master_tecnico` sem empresa não consulta.
- **Acessibilidade:** um título por bloco, um nó de status, alertas só para
  falha, foco no título da página ao abrir pela rota, nunca no `body`.
- **Sem edição pendente:** a guarda T200 não participa.
- **Sem dependência nova** e sem endpoint novo.

## 7. Custo e limites de consulta

- `contadores`: uma chamada por visita, custo do servidor já existente.
- Movimentações: duas séries, `ceil(n/100)` páginas cada, onde `n` são as
  movimentações efetivadas do tipo desde o início do ano consultado até hoje
  (a ordem é decrescente e não há filtro de período). Ano passado custa mais
  que o corrente, porque as páginas do ano corrente vêm antes.
- Sem auditoria por leitura para RH, DP e `master_tecnico` com empresa.
- Teto recomendado: 20 páginas por série (2.000 movimentações), D-7.

## 8. Fora da primeira fatia

| Item                                                                    | Motivo                                                                                                                                       | Critério de entrada                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Turnover                                                                | Cálculo não aprovado (base e fórmula)                                                                                                        | Fórmula aprovada e fonte da média de ativos                             |
| Série de ativos ao fim de cada mês                                      | Não há "situação da empresa numa data"; reconstruir no cliente a partir das movimentações é frágil (retificações, transferências, previstos) | Endpoint agregado aprovado ou regra de reconstrução aprovada e testada  |
| Ativos por departamento ou cargo                                        | Uma chamada por nó; sem agregado                                                                                                             | Agregado no servidor ou teto aprovado de nós                            |
| Pendências (movimentações solicitadas/programadas, documentos, Central) | Decisão de produto; a Central grava auditoria a cada leitura (fail-closed) e é negada ao DP                                                  | Decisão sobre quais pendências e para quem, e custo de auditoria aceito |
| Tempo até o primeiro retorno do RH                                      | Dado existe, sem endpoint                                                                                                                    | Agregado aprovado (PD-SOL-04)                                           |
| Qualquer indicador de ponto (horas, saldo, atrasos, folhas)             | ADR 0008                                                                                                                                     | Revisão da ADR 0008                                                     |
| Absenteísmo, ausências, férias                                          | Sem dado nem contrato                                                                                                                        | Módulos próprios fechados                                               |
| Custo por pessoa, salário, folha, benefícios                            | Sem dado (ADR 0007)                                                                                                                          | Módulo de remuneração                                                   |
| Clima, saúde, atestado                                                  | Sensível; sem dado                                                                                                                           | Decisão jurídica e módulo próprio                                       |
| Painel do gestor                                                        | ADR 0015                                                                                                                                     | Revisão da ADR 0015                                                     |
| Abas temáticas                                                          | Sem conteúdo real por aba ainda                                                                                                              | Cada aba com pelo menos um bloco real aprovado                          |
| Exportação, comparativos entre anos, metas                              | Decisão de produto pendente                                                                                                                  | Decisão aprovada                                                        |

## 9. Riscos

| Risco                                      | Cuidado                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Unidades diferentes (pessoas × vínculos)   | Rótulos explícitos: "ativos" são pessoas; admissões e desligamentos são de vínculos (D-4) |
| "Hoje" errado perto da meia-noite          | Data e ano de São Paulo, não UTC                                                          |
| Dupla contagem por retificação             | Só `efetivada` conta                                                                      |
| Custo em empresa grande                    | Teto por série e aviso sem número parcial (D-7)                                           |
| Mistura de empresas                        | `master_tecnico` sem empresa não consulta; troca de empresa remonta                       |
| Indicador decorativo                       | Só os elementos da seção 6; nada sem fonte                                                |
| Confusão com a "Visão geral" demonstrativa | Nome e posição distintos (D-9, D-11)                                                      |
| Acessibilidade de gráfico                  | Tabela como leitura principal; barras ocultas ao leitor de tela                           |

## 10. Critérios de aceite

1. Depois do login, RH, DP e `master_tecnico` abrem o Dashboard; gestor e
   demais papéis seguem como hoje.
2. `#/dashboard?ano=AAAA` abre o ano pedido; ano inválido é corrigido no
   lugar; recarregar e voltar/avançar funcionam.
3. Os números batem com os contadores e com as movimentações efetivadas do
   período, só da empresa ativa.
4. `master_tecnico` sem empresa vê a orientação, sem nenhuma consulta.
5. Cliques levam à listagem de Colaboradores com a aba e o tipo certos.
6. Carregando, vazio, erro e nova tentativa por bloco, com um anúncio por
   evento e foco nunca no `body`.
7. A 375 px, sem rolagem horizontal; controles com 44 px.
8. Nenhum elemento sem fonte de dado real.

## 11. Plano de testes

- **Unidade (web):** cálculo das séries (fronteiras de mês e ano, exclusões,
  paginação, teto); período e URL; papéis (RH, DP, `master_tecnico` com e
  sem empresa, gestor, demais); estados; respostas atrasadas e desmontagem;
  cliques; anúncios e foco; 375 px (CSS).
- **Shell:** página inicial por papel depois do login; rota, recarga e
  histórico; troca de empresa; volta ao Hub.
- **API (só testes do contrato existente):** filtro `tipo` + `status` e
  ordem de `GET /movimentacoes`; contadores por empresa; isolamento.
- **Prova de falha** para cada proteção.
- **Localhost** com dados sintéticos: admissões e desligamentos efetivados
  em meses diferentes, retificação, empresa sem movimentação, os perfis,
  teclado e 375 px.
- **Bateria completa** como nas tarefas anteriores.

## 12. Decisões (aprovadas em 2026-11-09)

D-1 a D-12 aprovadas como recomendado.

| Id   | Pergunta                           | Recomendação                                                                                                                                                                                                                    |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | Escopo da 1ª fatia                 | **Cinco elementos, E-1 a E-5** (período, resumo, ativos por tipo, admissões e desligamentos por mês, momento da leitura), só com contratos existentes; os cliques (D-5) são comportamento de E-2 e E-3, não um elemento à parte |
| D-2  | Página inicial depois do login     | **Dashboard para RH, DP e `master_tecnico`**; gestor em Minha equipe; demais no Hub; Hub acessível pelo topo                                                                                                                    |
| D-3  | Período e URL                      | **Ano civil** em `#/dashboard?ano=AAAA`, o corrente por padrão e "até hoje"; meses dentro do ano; ano inválido ou futuro corrigido no lugar                                                                                     |
| D-4  | Unidade das contagens              | **Ativos e em admissão em pessoas** (contadores); **admissões e desligamentos em vínculos** (movimentações efetivadas), com rótulos explícitos                                                                                  |
| D-5  | Navegação a partir dos indicadores | **Ativos, em admissão e cada tipo** abrem a listagem filtrada; admissões e desligamentos sem clique nesta fatia                                                                                                                 |
| D-6  | `master_tecnico` sem empresa       | **Orientação para escolher a empresa, sem consulta**                                                                                                                                                                            |
| D-7  | Limite de consulta                 | **20 páginas por série** (2.000 movimentações no período); acima disso, aviso sem números parciais                                                                                                                              |
| D-8  | Dados insuficientes                | **Zero real mostra 0**; série vazia com frase própria; indicador sem fonte não aparece                                                                                                                                          |
| D-9  | Nome e posição                     | **"Dashboard"**, primeiro item do menu                                                                                                                                                                                          |
| D-10 | Gráficos                           | **Barras em CSS + tabela acessível**, sem biblioteca nova                                                                                                                                                                       |
| D-11 | Telas existentes                   | **Hub mantido** (papéis sem Dashboard e botão do topo); **"Visão geral" demonstrativa intacta** na Demonstração; painel de Colaboradores intacto                                                                                |
| D-12 | Atualização                        | **Leitura ao entrar e botão "Atualizar"** com o horário da leitura; sem atualização automática                                                                                                                                  |

## 13. Observações fora desta tarefa

- **O-1:** comentário desatualizado em `App.tsx:510-512` (diz que os demais
  papéis caem em "cadastros"; a tabela atual os manda para "inicio").
- **O-2:** os atalhos da "Visão geral" demonstrativa navegam sem passar pela
  validação de destino (`App.tsx:372-378`); um papel sem permissão pode abrir
  uma tela funcional que responde 403.
- **O-3:** não há um "hoje em São Paulo" compartilhado na web; o `hojeUtc`
  de `dadosPessoais.ts:192` usa UTC.
- **O-4:** o comentário da auditoria da Central diz "fail-safe", mas a
  gravação é fail-closed (`solicitacoes-pessoas-auditoria.service.ts:60-79`).

## 14. Limites

- **Nesta preparação:** nenhum código de produto, API, banco, schema,
  migration, RBAC, auditoria, Docker, seed, dependências, lockfile ou
  workflow; sem push e sem PR.
- **Na fatia recomendada:** só web (rota, tela, cálculo das séries e testes)
  mais testes de API do contrato existente; sem endpoint novo.

## 15. Entrega

### 15.1 Comportamento entregue

- **Entrada (D-2, D-9):** depois do login, RH, DP e `master_tecnico` abrem o
  Dashboard; o gestor abre Minha equipe direto; os demais papéis ficam no Hub.
  A tela de aterrissagem recebe o foco no título. O Dashboard é o primeiro
  item do menu para quem o abre, e o Hub ganhou o cartão "Dashboard" para os
  mesmos papéis. Voltar ao Hub pelo topo não aterrissa de novo. A rota do
  Dashboard aberta por quem não tem o destino é corrigida para o destino do
  papel, sem leitura.
- **Rota e período (D-3, E-1):** `#/dashboard?ano=AAAA`. Sem ano, ou com ano
  inválido, futuro ou anterior a 2000, vale o ano corrente e a URL é
  corrigida no lugar, sem entrada nova. Trocar de ano ("Ano anterior",
  seletor "Ano", "Próximo ano") empilha uma entrada; voltar e avançar
  percorrem os anos; recarregar mantém o ano. No limite, o botão fica
  indisponível sem perder o foco. Ano corrente vai de 1º de janeiro até hoje;
  anos anteriores, o ano inteiro.
- **Resumo (D-4, E-2):** pessoas ativas hoje e pessoas em admissão hoje (com
  atalho para a listagem), admissões e desligamentos efetivados no ano (com a
  nota "Vínculos") e a diferença, mais uma frase com exatamente os mesmos
  números e as duas unidades distintas.
- **Ativos por tipo (E-3):** só os tipos com alguém, com número e percentual
  em texto e barra em CSS oculta ao leitor; cada tipo abre a listagem de
  Colaboradores na aba Ativos com o filtro do tipo.
- **Série mensal (D-10, E-4):** barras em CSS ocultas ao leitor e tabela
  equivalente (mês, admissões, desligamentos, diferença e total), com rolagem
  dentro do próprio quadro. Série vazia tem frase própria; zero aparece como 0.
- **Leitura (D-12, E-5):** momento da leitura e "Atualizar", sem atualização
  automática; clique repetido durante a leitura é ignorado; um único nó de
  status anuncia o carregamento e o resultado de cada leitura.
- **Falhas:** contadores e série falham separadamente, cada um com alerta e
  "Tentar de novo"; o sucesso leva o foco ao título do bloco. Sem a série, o
  resumo não mostra admissões, desligamentos, diferença nem a frase.
- **Teto (D-7):** acima de 20 páginas (2.000 movimentações) numa série, aviso
  claro e nenhum número de admissões ou desligamentos, nem parcial.
- **Sem empresa (D-6):** `master_tecnico` sem empresa ativa vê só a
  orientação para escolher a empresa, sem controles e sem nenhuma consulta.
- **Troca de empresa:** a tela é recriada no estado inicial seguro, como nas
  demais telas desde a T189: o Dashboard reabre no ano corrente da empresa
  nova, relê tudo e põe o foco no título.
- **Atrasos e desmontagem:** cada leitura tem geração própria; resposta de
  ano ou leitura anterior é descartada, e a paginação da série obsoleta (ou
  de tela desmontada) para sem pedir as páginas seguintes.
- **Telas preservadas (D-11):** Hub, "Visão geral" demonstrativa e painel de
  Colaboradores sem mudança além da rota, do menu, do cartão no Hub e da
  aterrissagem.

### 15.2 Contratos reutilizados

- `GET /v1/colaboradores?tamanhoPagina=1`, só pelos `contadores` (ativos, em
  admissão e ativos por tipo, do escopo inteiro da empresa).
- `GET /v1/movimentacoes?tipo=…&status=efetivada&pagina=…&tamanhoPagina=100`,
  uma série por tipo, de trás para frente pela ordem decrescente de vigência,
  parando ao passar do início do ano, em página incompleta ou ao atingir o
  total. Registro repetido entre páginas conta uma vez; outro tipo ou status
  é descartado também no cliente.
- Listagem de Colaboradores (T199) como destino dos atalhos, no formato de
  URL que ela já aceita.
- Nenhum endpoint, campo, permissão ou dependência nova.

### 15.3 Notas de implementação

- O ano e o dia de "hoje" vêm do relógio do navegador (hora local), não de
  UTC; num navegador fora do fuso de São Paulo, "hoje" segue esse fuso. Não
  há utilitário compartilhado de "hoje em São Paulo" na web (O-3).
- O menor ano consultável é 2000.
- Ativos abre a listagem na aba padrão (Ativos), cuja URL canônica não leva
  `aba`.

### 15.4 Testes e provas de falha

- **Web:** dados (período, série, paginação, teto, deduplicação,
  abandono da paginação, frase); rota (ano padrão, inválido, futuro,
  mínimo); tela (sem empresa, resumo, unidades, tipos e atalhos, série, ano
  passado, teto, falhas e nova tentativa, troca de ano, "Atualizar",
  respostas atrasadas, desmontagem, foco, anúncios, CSS a 375 px); shell
  (rota, correção no lugar, recarga, histórico, papéis, menu, atalhos com
  volta e foco); autenticação (aterrissagem por papel e foco, volta ao Hub,
  troca de empresa com o Dashboard aberto).
- **API (contrato existente):** filtro `tipo` + `status=efetivada` igual ao
  recorte da lista inteira, em vigência decrescente, só da empresa do ator;
  DP lê o mesmo; isolamento entre empresas; página acima de 100 recusada.
- **Mutações (todas detectadas):** gestor com o Dashboard; gestor
  aterrissando no Dashboard; leitura sem empresa ativa; teto de 21 páginas;
  teto devolvendo número parcial; frase sem "vínculos"; contagem de não
  efetivadas; fim do período sempre em 31/12; ano futuro aceito; série,
  leitura e desmontagem sem geração; paginação ignorando a validade. A falta
  do foco na aterrissagem do gestor foi achada na validação local e tem teste
  que falha sem a correção.

### 15.5 Validação local

Dados sintéticos, navegador real, desktop e 375 px: RH e DP aterrissam no
Dashboard com o foco no título, e os números conferem com a API;
`master_tecnico` sem empresa vê a orientação sem nenhuma consulta e, ao
escolher a empresa, lê os números dela; troca de empresa isola os números e
reabre no ano corrente; gestor aterrissa em Minha equipe com o foco no título
e a rota do Dashboard é corrigida; troca de ano empilha e voltar retorna;
série vazia com frase própria; "Atualizar" anuncia carregamento e leitura;
atalho para Colaboradores e volta; falha simulada da série com alerta, sem
números, e recuperação com o foco no bloco; a 375 px, sem rolagem horizontal
e com alvos de 44 px.

### 15.6 Limites

Os da seção 8 continuam fora: nada de turnover, ativos históricos,
departamento ou cargo, pendências, ponto, custo, absenteísmo, painel do
gestor, abas, exportação ou endpoint novo.

### 15.7 Comportamentos aprovados (2026-11-09)

A proprietária aprovou, como entregues:

1. **Troca de empresa:** o Dashboard reabre no ano corrente da empresa nova
   (estado inicial seguro, como nas demais telas desde a T189).
2. **"Hoje":** o ano e o dia vêm do relógio do navegador, não de UTC.
3. **Menor ano consultável:** 2000.
4. **Gestor:** aterrissa direto em Minha equipe depois do login, sem passar
   pelo Hub.
5. **Foco no Hub:** quem aterrissa no Hub depois do login (papéis sem
   Dashboard nem Minha equipe) continua com o foco no `body`, como antes
   desta tarefa; fica como observação fora do escopo da T205.
