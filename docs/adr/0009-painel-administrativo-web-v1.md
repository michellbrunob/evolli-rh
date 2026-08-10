# ADR 0009 — Painel Administrativo Web: Baseline V1

- Status: **Aceito**
- Data: 2026-08-10
- Relacionado: [docs/modules/painel-administrativo-web-v1.md](../modules/painel-administrativo-web-v1.md),
  [docs/decisions/painel-administrativo-web-v1-baseline.md](../decisions/painel-administrativo-web-v1-baseline.md)
  (decisão de produto que esta ADR formaliza),
  [ADR 0003](0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](0004-auditoria-formal-e-integridade.md),
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md),
  [ADR 0008](0008-jornada-ponto-rastreavel-baseline-v1.md)

## Contexto

A [ADR 0003](0003-identidade-sessao-e-autorizacao.md) fixou sessão de
servidor em cookie `HttpOnly`, `sameSite: "lax"`, e CSRF por synchronizer
token — desenhado, desde o início, para consumo por um cliente que ainda
não existia. Com Organização (ADR 0006), Colaboradores e Vida Funcional
(ADR 0007) e Jornada e Ponto (ADR 0008) implementados, a API tem
superfície suficiente para justificar a primeira interface administrativa
visual.

Uma especificação estrutural foi produzida (2026-08-10),
[docs/modules/painel-administrativo-web-v1.md](../modules/painel-administrativo-web-v1.md),
verificando por inspeção direta de código — não por suposição — que:
nenhum frontend existe (`apps/web/` contém só `README.md`); a API não
configura CORS; o token CSRF é devolvido uma única vez, no login, sem
nenhuma rota para recuperá-lo depois (lacuna registrada como O4,
bloqueante); e quatro dos oito papéis de acesso teriam painel praticamente
vazio, dado o estado atual da matriz de autorização.

O produto avaliou o levantamento e aprovou, em 2026-08-10, 3 decisões — a
**Baseline V1** — registradas em
[docs/decisions/painel-administrativo-web-v1-baseline.md](../decisions/painel-administrativo-web-v1-baseline.md).
Esta ADR formaliza a decisão arquitetural correspondente.

**Esta ADR não autoriza, por si só, o início de código React, do endpoint
`GET /v1/auth/csrf`, de proxy reverso ou de qualquer infraestrutura.** Ela
formaliza três decisões de arquitetura e contrato que uma futura fase
Implementar exigiria — a decisão de efetivamente iniciar essa fase,
inclusive a implementação do endpoint, é ato separado.

## Decisão

A Baseline V1 é aceita como arquitetura do Painel Administrativo Web desta
fatia, com as quatro decisões a seguir.

### 1. Framework: React + Vite + TypeScript

O painel será construído em React, com Vite como ferramenta de build, em
TypeScript — consistente com o restante do monorepo, que já é TypeScript
em toda a `apps/api`. Nenhum projeto é inicializado por esta ADR; nenhuma
dependência é adicionada ao `package.json` de `apps/web` (que hoje não
existe).

### 2. Topologia de mesma origem, sem CORS nesta V1

Painel e API operam na **mesma origem**. O navegador acessa a API por
`/v1/...`, roteado por proxy reverso até o processo da API. **CORS
permanece não configurado** — decisão que preserva o desenho atual de
`main.ts` intacto, sem ampliar a superfície de CSRF que uma lista de
origens confiáveis exigiria administrar.

Provedor, domínio e ferramenta de proxy reverso **não são decididos por
esta ADR** — são responsabilidade futura de infraestrutura, tratada em
execução operacional própria, não em decisão de arquitetura de produto.

**Consequência estrutural, não apenas de infraestrutura:** enquanto CORS
não for configurado, **nenhuma topologia de origens distintas funciona no
navegador** para este painel — não é limitação de infraestrutura a
contornar com configuração de proxy futuro; é dependência direta desta
decisão de arquitetura. Reverter isso exige nova ADR, porque significa
alterar `main.ts` (`app.enableCors(...)`) e reavaliar `sameSite` do cookie
de sessão — ambos código já mergeado e auditado.

### 3. Endpoint futuro `GET /v1/auth/csrf`

Será criado, em fase própria e futura, um endpoint autenticado que
resolve a lacuna O4 da especificação: recuperar o token CSRF associado à
sessão corrente sem exigir novo login e sem usar `localStorage` ou
`sessionStorage`.

**Contrato aprovado, a ser respeitado quando o endpoint for implementado:**

| Propriedade               | Requisito                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Autenticação              | Exige sessão válida — mesmo `SessionGuard` já usado em toda rota autenticada da API                                     |
| Corpo da resposta         | Somente o token CSRF associado à sessão; nenhum outro campo                                                             |
| Natureza da operação      | Leitura — não é mutação de domínio, não altera estado de nenhuma entidade de negócio                                    |
| Cache                     | `Cache-Control: no-store` na resposta, sem exceção                                                                      |
| Mecanismo CSRF            | Preserva o synchronizer token já aprovado (ADR 0003, decisão 6) — **não** introduz cookie de CSRF do tipo double-submit |
| Armazenamento no cliente  | O token nunca é gravado em armazenamento persistente do navegador pelo painel — vive só em memória (spec original, §3)  |
| Sessão ausente/expirada   | Responde **401**, sem detalhe interno — mesmo padrão de erro genérico de toda a API                                     |
| Superfície exposta        | Nenhuma credencial, dado pessoal ou informação de autorização além do próprio token CSRF                                |
| Autoridade de autorização | A API permanece única fonte de verdade — este endpoint não introduz mecanismo paralelo de decisão de acesso             |

**Estratégia interna de emissão, na ocasião não fechada:** o banco guarda
hoje só `csrf_token_hash` (mesmo padrão hash-only de `token_hash` da
sessão, ADR 0003 decisão 5) — nunca o valor bruto do token. Um endpoint
que "recupera" o token CSRF, portanto, não pode ler um valor já
persistido. A decisão 4, abaixo, fecha esse ponto.

**Esta ADR não cria o endpoint.** Nenhuma rota, controller, service,
migration ou dependência é adicionada aqui.

### 4. Estratégia de emissão: rotação, hash-only, invalidação do token anterior

A cada chamada autenticada a `GET /v1/auth/csrf`, a API **gera um novo
token CSRF aleatório**, persiste **somente seu hash** na sessão
(substituindo o hash anterior) e **invalida o token CSRF anterior** dessa
sessão. É rotação, não leitura — resolve o impasse da decisão 3 sem exigir
guardar ou recuperar o valor bruto do token, preservando integralmente o
padrão hash-only já aprovado para toda credencial de sessão (ADR 0003,
decisão 5).

**Garantias fixadas por esta decisão, sem exceção:**

| Propriedade                 | Requisito                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistência do token bruto | **Nunca** — nem banco, nem cookie, nem log, nem evento de auditoria, nem `localStorage`, nem `sessionStorage`. Só o hash existe no servidor; o valor bruto só em memória no cliente |
| Autenticação                | Exige sessão válida — mesmo `SessionGuard` de toda rota autenticada                                                                                                                 |
| Corpo da resposta           | Somente o token CSRF, com `Cache-Control: no-store`                                                                                                                                 |
| Token anterior da sessão    | Invalidado imediatamente após a rotação — uma mutação que ainda carregue o token antigo é recusada pelo `CsrfGuard` com 403, mesmo com sessão válida                                |
| Sessão ausente/expirada     | 401 genérico, sem detalhe interno                                                                                                                                                   |
| Escopo de domínio           | O endpoint **não concede autorização nem altera domínio de RH** — é puramente técnico, sobre o mecanismo de CSRF da própria sessão                                                  |
| Armazenamento no cliente    | O frontend guarda o token só em memória — nunca em armazenamento persistente do navegador                                                                                           |
| Mecanismo CSRF              | Segue sem cookie double-submit — o synchronizer token da ADR 0003 (decisão 6) permanece o mecanismo; a rotação afeta só o hash já guardado na sessão existente                      |

**Impacto conhecido, registrado e não contornado — concorrência entre
abas.** Como o token anterior é invalidado a cada rotação, duas abas
autenticadas na mesma sessão competem pelo mesmo token CSRF: se a aba A
chama o endpoint e obtém um token novo, o token que a aba B tinha em
memória passa a ser inválido, e a próxima mutação da aba B falha com 403.
A aplicação deve buscar um token novo antes da próxima mutação nesse
cenário, **mas nunca deve reenviar automaticamente uma mutação que já foi
despachada** — reenvio automático arrisca duplicar uma operação (ex.:
registrar um evento de ponto duas vezes), o que é pior do que pedir nova
tentativa ao usuário. Este comportamento é consequência aceita do desenho
(nunca guardar o token em claro em lugar nenhum), não defeito a esconder.

**Esta decisão não cria o endpoint, não implementa a rotação em código, e
não declara o endpoint implementado.** Não altera a decisão 2 (mesma
origem/proxy reverso), SSO futuro (fora de escopo desta ADR, ver "Itens
fora de escopo") nem MFA obrigatório antes de dado real (ADR 0003, decisão
3, inalterada).

## Alternativas descartadas

| Alternativa                                                                                    | Por que foi descartada                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework diferente de React (Vue, Svelte, Angular)                                            | `apps/web/README.md` já registrava React/TSX como intenção desde a fundação do monorepo; trocar exigiria justificativa nova sem ganho identificado. Descartado por falta de motivo para desviar da intenção já registrada.                                                                                                                                                     |
| CRA (Create React App) ou outro bundler no lugar de Vite                                       | Vite é a ferramenta de build mais adotada atualmente para React+TypeScript, com tempo de inicialização e HMR superiores às alternativas legadas. Descartado em favor da opção mais madura hoje.                                                                                                                                                                                |
| CORS com lista de origens confiáveis, já nesta V1                                              | Exigiria alterar `main.ts`, reavaliar `sameSite` do cookie de sessão e ampliar a superfície de CSRF administrada — mudança de backend com impacto de segurança, desproporcional para viabilizar uma topologia (origens distintas) sem necessidade comprovada ainda. Descartado; mesma origem resolve o V1 sem tocar em código já auditado.                                     |
| Cookie de CSRF do tipo double-submit, substituindo o synchronizer atual                        | Mudaria o desenho de CSRF já aprovado e testado pela ADR 0003 (decisão 6) só para resolver um problema de UX de reload — trocaria um mecanismo funcionando por outro, sem necessidade que justifique o risco de regressão. Descartado em favor de manter o synchronizer e resolver o reload com um endpoint de leitura.                                                        |
| Aceitar que todo _reload_ exija novo login (opção "c" da spec original)                        | Resolveria a lacuna O4 sem tocar em backend, mas é degradação de usabilidade que o produto não considerou aceitável para um painel administrativo de uso diário. Descartado em favor do endpoint dedicado.                                                                                                                                                                     |
| Guardar o token CSRF em `localStorage`/`sessionStorage`                                        | Contraria diretamente a exigência de não persistir credencial em armazenamento acessível a script, reintroduzindo exatamente o vetor que o cookie `HttpOnly` da sessão foi desenhado para eliminar. Descartado sem ressalva — nunca foi opção real, mas precisa constar como descartada explicitamente porque é a "solução óbvia" que alguém sem o contexto completo tentaria. |
| Definir agora o provedor/ferramenta de proxy reverso                                           | Provisionamento de infraestrutura é decisão operacional, não arquitetural de produto — antecipá-la sem que a fase Implementar do painel exista ainda seria decidir sem informação (requisitos de deploy, ambiente-alvo) que só aparece mais perto da execução. Descartado; fica como responsabilidade futura registrada.                                                       |
| Guardar o token CSRF bruto (não só o hash) para permitir leitura direta em `GET /v1/auth/csrf` | Quebraria o padrão hash-only já aprovado para toda credencial de sessão (ADR 0003, decisão 5) — um vazamento do banco exporia diretamente tokens CSRF válidos, sem precisar do cookie do cliente. Descartado; rotação resolve o mesmo problema sem esse risco.                                                                                                                 |
| Manter o token CSRF válido indefinidamente após emitir um novo, para não invalidar outras abas | Elimina o problema de concorrência entre abas, mas mantém tokens antigos válidos por tempo indeterminado, ampliando a janela de uso de um token potencialmente exposto. Descartado; o impacto de multi-aba é aceito como consequência conhecida, não contornado enfraquecendo a rotação.                                                                                       |

## Consequências

- A especificação
  ([docs/modules/painel-administrativo-web-v1.md](../modules/painel-administrativo-web-v1.md))
  é atualizada para refletir esta Baseline V1: O1 (framework), O2 (mesma
  origem, sem CORS) e O4 (contrato do endpoint futuro **e** estratégia de
  emissão) passam de observação/lacuna para decisão registrada, sem que
  nenhuma delas passe a autorizar código, endpoint ou infraestrutura.
- Uma futura fase Implementar do painel, se e quando autorizada
  separadamente, terá resolvido: qual framework usar, qual topologia de
  origem assumir, que o mecanismo de recuperação de CSRF será um endpoint
  dedicado com contrato já fechado, e que a estratégia interna de emissão
  será rotação com invalidação do token anterior — sem precisar decidir
  nenhum desses quatro pontos durante a implementação.
- **A implementação futura precisará tratar a concorrência entre abas**
  descrita na decisão 4: rotação invalida o token de qualquer outra aba da
  mesma sessão que ainda não o buscou de novo. Isso é consequência aceita
  do desenho, registrada aqui para que a fase Implementar não a trate como
  bug a corrigir silenciosamente contornando a invalidação.
- **`main.ts` continua sem CORS até nova ADR.** Qualquer necessidade
  futura de servir o painel de origem distinta da API exige reabrir esta
  decisão, não apenas configurar infraestrutura.
- **Nenhuma tabela, migration, endpoint, dependência ou linha de código é
  criada, alterada ou comprometida por esta ADR.** O contrato do
  `GET /v1/auth/csrf` é especificação para quando ele for implementado, não
  implementação.
- DP-W-03 a DP-W-07, DP-W-09, DP-W-10 e DP-W-11, e todas as lacunas de API
  já registradas na especificação original (ausência de listagem de
  usuários, de `GET` por id de vínculo/movimentação, de endpoint de
  agregação), permanecem pendentes, sem resolução por inferência desta
  ADR.

## Controles de segurança

- **Menor privilégio inalterado:** nenhuma decisão desta ADR concede
  acesso de painel a papel que hoje não tem acesso ao domínio
  correspondente na API. A matriz de autorização de Organização, Pessoas e
  Ponto permanece exatamente como está.
- **Sem token bruto persistido em lugar nenhum:** decisão 4 fixa que nem o
  banco, nem cookie, nem log, nem auditoria guardam o valor bruto do token
  — só o hash, do lado do servidor, e só memória, do lado do cliente.
- **Sem token em armazenamento persistente do navegador:** reafirmado como
  requisito do contrato do `GET /v1/auth/csrf` (decisão 3) e da spec
  original (§3) — nenhuma decisão desta ADR relaxa essa exigência.
- **CSRF preservado, não substituído:** o synchronizer token da ADR 0003
  (decisão 6) continua sendo o mecanismo; o endpoint futuro só resolve
  _como recuperar_ o token existente, não _como validá-lo_.
- **Token anterior sempre invalidado na rotação:** nenhuma janela em que
  dois tokens CSRF válidos coexistem para a mesma sessão — reduz o tempo
  de vida útil de um token potencialmente exposto.
- **Sem ampliação de superfície de CORS:** manter CORS desligado nesta V1
  é, em si, um controle — reduz a superfície que precisaria ser validada
  contra origem cruzada.

## Itens fora de escopo desta ADR

- **Código React, Vite, endpoint, proxy reverso, CORS, migration,
  dependência ou infraestrutura** — nada disso é criado, alterado ou
  autorizado por esta ADR.
- **SSO** — evolução futura, sujeita às mesmas condições já registradas na
  ADR 0003 (decisão 2: interface de autenticação isolada e trocável).
- **MFA** — regido integralmente pela ADR 0003, decisão 3, inalterada.
  Continua obrigatório antes de qualquer piloto com dado real ou produção;
  esta ADR, ao formalizar arquitetura de painel administrativo, torna essa
  condição mais relevante, não menos.
- **Gestão de usuários, métricas, telemetria, identidade visual,
  acessibilidade detalhada** — todas permanecem pendentes (DP-W-04,
  DP-W-06, DP-W-07, DP-W-09), sem endereçamento por esta ADR.
- **Lacunas de API** já registradas na especificação original, além do
  contrato do `GET /v1/auth/csrf` — não resolvidas.

**Esta ADR não declara CORS seguro, hospedagem existente, conformidade
LGPD ou qualquer endpoint desta fatia como já implementado.** Ela trata
exclusivamente de quatro decisões de arquitetura e contrato para o núcleo
do painel administrativo; validade legal, retenção e MFA seguem regidos
pelas ADRs já aceitas, sem alteração.

## Gatilhos de reavaliação

Esta decisão deve ser reaberta — com ADR nova ou emenda formal — quando
**qualquer** um destes ocorrer:

1. Necessidade real de servir o painel de origem distinta da API — exige
   reabrir a decisão 2, com desenho explícito de CORS e reavaliação de
   `sameSite`.
2. O endpoint `GET /v1/auth/csrf` for efetivamente implementado — a
   implementação da rotação (decisão 4) deve ser documentada como
   evidência de implementação, no mesmo padrão já usado nas Emendas das
   ADRs 0006 a 0008.
3. SSO for avaliado como necessidade real — decisão de autenticação nova,
   não consequência automática desta ADR.
4. Qualquer decisão pendente (DP-W-03 a DP-W-11) for resolvida pelo
   produto — não invalida esta ADR, mas pode gerar emenda ou ADR
   complementar conforme o escopo da decisão.

## Responsabilidades

- **Time de desenvolvimento (código):** ao iniciar, se e quando
  autorizada, a fase Implementar do painel, respeitar as quatro decisões
  desta Baseline sem ampliar escopo por conveniência — em particular, não
  introduzir CORS, não usar cookie double-submit, não gravar token CSRF em
  armazenamento persistente do navegador, e implementar a rotação (decisão 4) exatamente como especificada, sem reintroduzir reenvio automático de
  mutação já despachada.
- **Produto:** resolver DP-W-03 a DP-W-07, DP-W-09, DP-W-10 e DP-W-11
  conforme a necessidade surgir; nenhuma delas é bloqueante para o núcleo
  já aprovado desta Baseline.
- **TI/Infraestrutura:** definir, quando a fase Implementar for
  autorizada, o provedor, domínio e ferramenta de proxy reverso que
  garantam mesma origem entre painel e API — pré-condição para a decisão 2
  funcionar como especificado.
- **TI/Segurança:** revisar, antes de qualquer implementação do
  `GET /v1/auth/csrf`, que o contrato desta ADR foi seguido integralmente —
  em particular `Cache-Control: no-store`, ausência de mutação de domínio
  e resposta 401 sem detalhe interno.
- **Revisor de PR (quando houver código futuro):** bloquear merge que
  introduza CORS sem nova ADR, que implemente cookie double-submit para
  CSRF, que grave token CSRF em `localStorage`/`sessionStorage`, ou que
  conceda acesso de painel a papel sem autorização correspondente já
  aprovada na API.

## Limitações

- Esta ADR **não autoriza início de código, endpoint, proxy, dependência
  ou infraestrutura** — nenhuma fase Implementar é aberta por este
  documento.
- Não resolve DP-W-03 (design system), DP-W-04 (identidade visual),
  DP-W-05 (layout e navegação), DP-W-06 (métricas), DP-W-07
  (acessibilidade e navegadores-alvo), DP-W-09 (telemetria), DP-W-10
  (testes visuais/e2e) nem DP-W-11 (OpenAPI/cliente tipado) — todas seguem
  pendentes.
- A estratégia interna de emissão do token no futuro `GET /v1/auth/csrf`
  está definida (decisão 4: rotação, hash-only, invalidação do anterior) —
  o que falta é só a implementação em código, não a decisão.
- Não resolve como a implementação futura tratará, na prática de UX, a
  concorrência entre abas descrita na decisão 4 — o comportamento correto
  ("buscar novo token, nunca reenviar mutação já despachada") está
  definido; o desenho de interface para comunicar isso ao usuário não.
- Não estende nem relaxa MFA (ADR 0003) ou o modelo de auditoria
  (ADR 0004) — ambos permanecem integralmente aplicáveis.
- Não introduz nenhuma tabela, campo pessoal, enum de banco, rota real ou
  configuração de infraestrutura — os itens desta Baseline continuam
  sendo especificação, não implementação.
