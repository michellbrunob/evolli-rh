# Painel Administrativo Web V1 — especificação

- Status: **Baseline V1 aprovada** (2026-08-10) para framework, topologia de
  origem e contrato do endpoint futuro de CSRF — fase **Registrar decisão
  aprovada**. Nenhuma fase Implementar foi aberta ou autorizada por esta
  atualização.
- Fase do SDD: Registrar decisão aprovada. Nenhuma aplicação, componente,
  dependência, endpoint, migration ou integração criada nesta fase.
- Escopo: primeira interface administrativa visual do Evolli RH, consumindo
  **exclusivamente** APIs já implementadas e **exclusivamente** dados
  sintéticos.
- Decisão de produto: [Baseline V1 do Painel Administrativo Web](../decisions/painel-administrativo-web-v1-baseline.md)
  (3 decisões aprovadas, 2026-08-10) e [ADR 0009](../adr/0009-painel-administrativo-web-v1.md)
  (formalização arquitetural correspondente).
- Relacionado: [README.md](../../README.md), [docs/ARCHITECTURE.md](../ARCHITECTURE.md),
  [docs/ROADMAP.md](../ROADMAP.md), [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md),
  [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md),
  [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md).

## 0. Estado verificado e observações registradas

Esta seção separa **o que foi verificado no repositório** do que é
recomendação ou pendência. Nada aqui é decisão de produto.

### O1 — Não existe frontend algum hoje

Verificado: `apps/web/` contém **apenas** `README.md`. Não há `package.json`,
build, componente, rota ou aplicação — o diretório não é sequer um pacote
efetivo do workspace, embora `pnpm-workspace.yaml` inclua `apps/*`. O mesmo
vale para `packages/contracts`, `packages/database`, `packages/domain` e
`packages/ui`: todos contêm somente `README.md`.

Consequência para a leitura desta spec: **nenhuma tela, autenticação web,
hospedagem ou design system existe**. Tudo descrito adiante é proposta a
construir, não descrição de algo em funcionamento.

O `apps/web/README.md` atual diz que a aplicação "será inicializada na etapa 0,
após a definição do design system e do contrato de autenticação". O contrato de
autenticação **já existe** (ADR 0003, implementado); o design system **não**
(§4, DP-W-03).

**(Baseline V1, Decisão 1, 2026-08-10)**: o framework está aprovado — **React

- Vite + TypeScript**. Isso resolve **DP-W-01**. Nenhum projeto é inicializado
  por essa decisão; `apps/web/` continua contendo só `README.md` até a fase
  Implementar ser autorizada.

### O2 — A API não tem CORS configurado. Isto é a restrição estrutural mais importante desta fatia

Verificado em `apps/api/src/main.ts`: o bootstrap aplica `helmet`,
`cookie-parser`, `ValidationPipe`, filtro de exceção, versionamento e OpenAPI —
e **não chama `app.enableCors(...)`**. Nenhuma origem é liberada.

Consequência objetiva: **um frontend servido de outra origem não consegue
chamar esta API pelo navegador.** Não é preferência arquitetural nem
otimização; é o comportamento atual. Some-se a isso o cookie de sessão com
`sameSite: "lax"` (O3), que não acompanha requisição `POST` cross-site mesmo se
o CORS fosse liberado.

Portanto, das duas uma — e a escolha é decisão pendente (§4, DP-W-02), não algo
que esta spec resolva:

1. **Mesma origem** (painel e API atrás do mesmo host/porta, via reverse proxy
   ou servindo o build estático pela própria API). Não exige alteração na API.
2. **Origens distintas**, o que **exige alterar a API** — habilitar CORS com
   `credentials`, lista de origens explícita e reavaliação do `sameSite`. Isso
   é mudança de backend e de superfície de segurança, com ADR própria.

**Recomendação técnica:** opção 1. Ela mantém o desenho atual intacto, evita
ampliar a superfície de CSRF e é a única que não exige tocar em código já
mergeado e auditado. Registrada como recomendação — a decisão é do produto/TI.

**(Baseline V1, Decisão 2, 2026-08-10)**: a recomendação foi adotada — **mesma
origem, com proxy reverso**, sem CORS nesta V1. Isso resolve a parte de
topologia de **DP-W-02**. Provedor, domínio e ferramenta de proxy **não** são
decididos por essa decisão — permanecem responsabilidade futura de
infraestrutura (**DP-W-02, infraestrutura**), não bloqueante para a fase
Implementar do painel. Enquanto CORS não for configurado, nenhuma topologia
de origens distintas funciona no navegador — não é detalhe de configuração a
ajustar depois, é consequência direta desta decisão de arquitetura.

### O3 — Contrato de sessão e CSRF, como implementado

Verificado no código, não inferido:

| Item               | Valor implementado              | Fonte                    |
| ------------------ | ------------------------------- | ------------------------ |
| Cookie de sessão   | `evolli_session`                | `session.constants.ts`   |
| `httpOnly`         | `true`                          | `session-cookie.util.ts` |
| `sameSite`         | `lax`                           | `session-cookie.util.ts` |
| `secure`           | dependente de ambiente          | `session-cookie.util.ts` |
| TTL absoluto       | 8 horas                         | `session.constants.ts`   |
| TTL de inatividade | 30 minutos                      | `session.constants.ts`   |
| Header CSRF        | `x-csrf-token`                  | `csrf.constants.ts`      |
| Resposta do login  | `200` com corpo `{ csrfToken }` | `auth.controller.ts`     |
| Resposta do logout | `204`, sem corpo                | `auth.controller.ts`     |

O token de sessão é opaco e o banco guarda só o hash (ADR 0003, decisão 5). O
CSRF é synchronizer token vinculado à sessão (decisão 6), validado com
comparação de tempo constante.

### O4 — Lacuna bloqueante: não há como recuperar o token CSRF após recarregar a página

**Esta é a lacuna mais séria encontrada, e ela impede o V1 de funcionar como
SPA sem uma decisão explícita.**

O token CSRF é devolvido **uma única vez**, no corpo da resposta de
`POST /v1/auth/login`. Não existe nenhuma rota que o devolva depois —
verificado em todo `auth.controller.ts`.

O efeito prático: o cookie de sessão é `HttpOnly`, então sobrevive a um
_reload_ e continua autenticando leituras. O token CSRF, não: ele vive apenas
na memória da aba. Ao recarregar a página (F5, navegação direta, restauração de
aba, abertura de segunda aba), o usuário **continua autenticado mas fica
incapaz de executar qualquer mutação**, porque toda rota de escrita exige
`CsrfGuard`.

Guardar o token em `localStorage`/`sessionStorage` **não é solução aceitável**:
contraria a exigência de não persistir credencial em armazenamento acessível a
script (§3) e reintroduz exatamente o vetor que o cookie `HttpOnly` elimina.

Caminhos possíveis (**nenhum decidido aqui**, ver §4 DP-W-08 e §5 "Lacunas"):

- **(a)** Adicionar à API uma rota autenticada que devolva um token CSRF para a
  sessão corrente. É **alteração de backend**, fora do escopo desta fase.
- **(b)** Emitir também um cookie de CSRF legível por script (padrão
  _double-submit_), coexistindo com o synchronizer atual. Também é alteração de
  backend, e muda a superfície de segurança — exigiria revisão e provavelmente
  emenda à ADR 0003.
- **(c)** Manter como está e aceitar que qualquer _reload_ obrigue novo login
  antes de mutar. Não exige mudar a API, mas é degradação de usabilidade
  relevante e precisa ser aceita explicitamente por produto.

Esta spec **não escolhe** entre (a), (b) e (c) — e explicitamente **não
inventa** o endpoint de (a). Registrar a lacuna é o entregável; resolvê-la é
decisão que antecede a fase Implementar do painel.

**(Baseline V1, Decisão 3, 2026-08-10)**: o caminho **(a)** foi escolhido —
será criado, em fase própria futura, o endpoint autenticado `GET
/v1/auth/csrf`, com contrato fechado: exige sessão válida; devolve **somente**
o token CSRF da sessão; não é mutação de domínio; resposta com `Cache-Control:
no-store`; **não** usa cookie double-submit (o synchronizer token da ADR 0003
permanece o mecanismo); o token nunca é gravado em armazenamento persistente
do navegador; responde **401** sem detalhe interno para sessão ausente/
expirada; não expõe credencial, dado pessoal ou informação de autorização.
Isso resolve **DP-W-08** quanto ao mecanismo. **Esta decisão não cria o
endpoint** — nenhuma rota, controller ou linha de código existe ainda. Detalhe
técnico não resolvido pela decisão: como o banco guarda só o hash do token
CSRF (nunca o valor bruto — ADR 0003, decisão 5), a implementação futura
precisará decidir entre rotacionar o token a cada chamada ou outra estratégia
compatível — decisão de implementação, não desta Baseline. Ver
[Baseline V1](../decisions/painel-administrativo-web-v1-baseline.md) e
[ADR 0009](../adr/0009-painel-administrativo-web-v1.md) para o contrato
completo.

### O5 — `admin_tecnico` enxerga muito pouco do painel, e isso é intencional

Verificado em `rbac.evaluator.ts`: `admin_tecnico` tem acesso amplo à
**estrutura organizacional** (exceção da Emenda 1 da ADR 0005), mas é
**negado** em todo o domínio de Pessoas (ADR 0007, Baseline V1 item 8) e em
todo o domínio de Ponto (ADR 0008, decisão 6).

Consequência de produto que o design precisa absorver: o papel "mais
administrativo" do sistema, ao entrar no painel, **não vê colaborador nem
ponto**. Um menu que liste esses módulos para ele levaria a uma sequência de
403 — o que é comportamento correto da API, mas péssima experiência e um sinal
desnecessário sobre o que existe do outro lado.

A navegação deve, portanto, refletir capacidade real (§3, "autorização"),
lembrando que isso é **conveniência de interface, nunca fonte de verdade**.

### O6 — Papéis provisionáveis vs. papéis com acesso

`ACCESS_ROLES` tem oito valores: `admin_tecnico`, `rh`, `dp`, `gestor`,
`financeiro`, `colaborador`, `auditor`, `dpo`. Mas, nos módulos já
implementados:

- `gestor` é negado em Organização, Pessoas e Ponto (escopo pendente, DP-8);
- `colaborador` é negado em tudo (o Portal do Colaborador não existe);
- `auditor` e `dpo` só têm `access_log`;
- `financeiro` só tem leitura de `centro_custo`.

Ou seja: **quatro dos oito papéis, hoje, teriam um painel praticamente vazio.**
Isso não é defeito a corrigir na interface — é o estado da autorização
aprovada. A interface não pode "compensar" isso mostrando dados.

### O7 — OpenAPI existe, mas não descreve a autenticação

Verificado em `openapi/openapi.ts`: há documento Swagger em `/docs`, montado
com `DocumentBuilder`, com título, descrição, versão e as tags `health` e
`organizacao`. **Não há `addCookieAuth`/`addSecurity`** declarado, e as tags de
`pessoas` e `ponto` não estão registradas no builder (embora os controllers
usem `@ApiTags`).

Consequência: um cliente tipado gerado hoje a partir desse documento
descreveria caminhos e formatos, mas **não** o esquema de autenticação. Isso é
observação factual — completar o documento é alteração de backend, fora desta
fase (§4, DP-W-11).

### O8 — Baseline V1 aprovada: o que muda, o que não muda

**Aditivo — não reescreve O1 a O7.** Em 2026-08-10, o produto avaliou três
das lacunas registradas acima e aprovou 3 decisões, registradas em
[docs/decisions/painel-administrativo-web-v1-baseline.md](../decisions/painel-administrativo-web-v1-baseline.md)
e formalizadas em
[ADR 0009](../adr/0009-painel-administrativo-web-v1.md). As observações O1,
O2 e O4 foram atualizadas para refletir essa Baseline — cada atualização está
marcada com "(Baseline V1, Decisão N)".

**O que a Baseline resolve:** framework (React + Vite + TypeScript, O1);
topologia de origem (mesma origem com proxy reverso, sem CORS nesta V1, O2);
contrato do futuro `GET /v1/auth/csrf` para recuperar o token CSRF após
_reload_ (O4).

**O que a Baseline não resolve — permanece pendente, sem inferência:** design
system (DP-W-03), identidade visual (DP-W-04), layout e navegação (DP-W-05),
métricas (DP-W-06), acessibilidade e navegadores-alvo (DP-W-07), provedor/
domínio/ferramenta de proxy reverso (DP-W-02, infraestrutura), telemetria
(DP-W-09), testes visuais/e2e (DP-W-10), exposição de OpenAPI/cliente tipado
(DP-W-11), e todas as lacunas de API do §5.2 exceto o CSRF. **Nenhum papel
ganha acesso novo** por esta Baseline — a autorização visual continua sendo
reflexo do que a API já decide.

**O que a Baseline não autoriza:** nenhum código React, endpoint, proxy,
CORS, migration, dependência ou infraestrutura. Ela resolve decisões de
arquitetura que uma futura fase Implementar exigiria — não abre essa fase.

## 1. Escopo visual V1

Tudo abaixo é **proposta**. Nada existe.

### 1.1 Tela de login

Formulário de e-mail e senha, submetendo a `POST /v1/auth/login`. Em sucesso, o
navegador recebe o cookie `evolli_session` e a aplicação guarda o `csrfToken`
**apenas em memória** (§3). Em seguida, `GET /v1/users/me` resolve identidade e
papel.

Mensagem de erro **única e genérica** para credencial inválida, conta
desabilitada ou bloqueio por tentativas — a API já é deliberadamente
indistinguível nesses casos, e a interface não pode desfazer isso reportando o
motivo real.

Sem "lembrar-me", sem cadastro público, sem provedor externo. Recuperação de
senha existe na API (`POST /v1/auth/password/forgot` e `/reset`); se entra no
V1 visual é decisão de escopo (§4, DP-W-05).

### 1.2 Navegação administrativa

Estrutura persistente com identificação do usuário (e-mail e papel, vindos de
`/v1/users/me`), acesso aos módulos e ação de sair (`POST /v1/auth/logout`, que
exige CSRF).

Itens de menu aparecem conforme a capacidade real do papel (O5). **A ocultação
é conveniência, não controle**: a API continua sendo a autoridade, e uma rota
digitada diretamente deve terminar em 403/404 vindo do servidor, nunca em
dado exibido por engano.

### 1.3 Visão inicial de módulos

Tela de entrada listando os módulos disponíveis **ao papel autenticado**, cada
um com uma frase do que faz e o estado "disponível" / "sem acesso" / "não
implementado".

**Não é dashboard.** Sem indicador, contagem, gráfico ou métrica agregada — não
existe endpoint de agregação, e criar um é alteração de backend (§2, §4
DP-W-06). Se a visão inicial precisar de números, eles teriam de vir de
contagens já devolvidas pelas listagens paginadas (campo `total`), o que é
possível mas ainda assim é decisão de produto.

### 1.4 Estrutura organizacional

Listagem e detalhe das sete entidades já implementadas: empresa, unidade
organizacional, departamento, área, equipe, cargo e centro de custo.

Criação, renomeação, inativação e reativação onde o papel tiver permissão. A
regra "inativação bloqueia, nunca cascateia" (ADR 0006, decisão 7) precisa
aparecer como recusa compreensível — a API responde erro de conflito sem
identificar o dependente, e a interface **não pode** tentar descobrir e exibir
qual é.

### 1.5 Colaboradores, vínculos e alocações

Listagem paginada de colaboradores com os filtros que a API já aceita
(`empresaId`, `situacao`, `situacaoVinculo`), detalhe do colaborador, vínculos,
histórico de alocações, linha do tempo de movimentações e consulta de situação
numa data de referência.

Admissão (que é **atômica** — cria colaborador, vínculo e, quando o vínculo já
nasce ativo, a alocação; ADR 0007, Emenda 2) e registro/efetivação/cancelamento
/retificação de movimentação, conforme permissão.

Somente os quatro dados aprovados (nome, matrícula, situação, vínculo) e as
referências organizacionais. **Nenhum campo novo de dado pessoal** é exibido,
solicitado ou inventado pela interface.

### 1.6 Consulta e registro manual de ponto

Consulta de marcações por vínculo e por competência (`YYYY-MM`), com o **valor
efetivo** de cada evento (original + ajustes aplicados) e o histórico de
ajustes.

Registro manual dos quatro tipos aprovados (`entrada`, `saida`, `inicio_pausa`,
`fim_pausa`) e criação de ajuste com motivo codificado.

Três características do domínio que a interface **precisa** tornar visíveis, em
vez de esconder:

- o evento original **nunca** é alterado — a tela deve mostrar original e
  efetivo como coisas distintas, não substituir um pelo outro;
- **não há edição nem exclusão**; a única correção é o ajuste. Não deve existir
  botão "editar" ou "excluir" em marcação — não existe rota para isso;
- a **anulação é terminal**: um evento anulado não aceita novo ajuste, e a API
  responde 409.

Nenhum cálculo. Nenhum saldo, hora extra, banco de horas, adicional ou jornada
esperada é exibido, somado ou inferido no cliente (§2).

### 1.7 Estados de carregamento, vazio, erro e acesso negado

Cada tela precisa de quatro estados explícitos, além do estado com dados:

| Estado        | Comportamento esperado                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Carregando    | Indicação clara; sem deixar dado antigo na tela como se fosse atual                                                   |
| Vazio         | Distinguir "nenhum registro existe" de "nenhum registro no seu escopo" **sem** revelar que algo existe fora do escopo |
| Erro          | Mensagem genérica + `request_id` da resposta, para suporte correlacionar com o log estruturado                        |
| Acesso negado | Mensagem neutra, sem detalhar qual permissão falta nem qual recurso existe                                            |

O caso "vazio" merece atenção: a API responde **página vazia** (não erro)
quando o filtro pede empresa fora do escopo — comportamento anti-enumeração
deliberado. A interface não pode transformar isso em "você não tem permissão
para a empresa X", porque isso reintroduziria exatamente a confirmação de
existência que a API evita.

## 2. Fora de escopo desta fatia

| Fora de escopo                                            | Razão                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Portal do colaborador                                     | Não existe e o papel `colaborador` é negado em todos os módulos (O6)                       |
| Documentos e upload                                       | Etapa 2 é especificação estrutural; nenhuma API existe                                     |
| Biometria, geolocalização, TXT, folha, cálculo de jornada | Fora da Baseline Jornada V1 (ADR 0008, decisões 3 e 6); sem API e sem decisão              |
| Dashboard executivo com métricas novas                    | Exigiria endpoint de agregação inexistente — criar um é alteração de backend               |
| Dados reais                                               | Bloqueados por MFA, validação jurídica/DPO e política de retenção (§6)                     |
| Novos papéis, permissões ou endpoints de negócio          | A interface consome o que existe; ampliar autorização é decisão de produto com ADR própria |

Acrescente-se, por consequência direta do que foi verificado:

- **Nenhuma tela de administração de usuários com listagem.** A API tem
  `POST /v1/users`, `PATCH /v1/users/:id/role`, `POST /v1/users/:id/disable` e
  `GET /v1/users/me` — **não existe** rota que liste usuários. Uma tela de
  gestão de acessos sem listagem é de utilidade duvidosa; construir a listagem
  exigiria endpoint novo (§5, "Lacunas").
- **Nenhuma tela de trilha de auditoria** no V1. A API existe
  (`GET /v1/audit/events`), mas o acesso é de `admin_tecnico`, `auditor` e
  `dpo` — e exibir trilha é superfície própria, que merece decisão de escopo
  própria (§4, DP-W-05).

## 3. Segurança obrigatória

Não são recomendações. São condições para o painel existir.

### 3.1 Sessão

- Autenticação **exclusivamente** pelo cookie `evolli_session` (`HttpOnly`),
  emitido pela API. O cliente **nunca** lê, escreve ou copia esse cookie.
- **Nenhum token em `localStorage` ou `sessionStorage`** — nem o de sessão, nem
  o CSRF, nem qualquer derivado. O token CSRF vive **apenas em memória** do
  processo da aba, e a consequência disso está registrada em O4.
- Requisições autenticadas usam o envio automático de cookie de mesma origem
  (`credentials: "same-origin"`), coerente com O2.

### 3.2 CSRF

- **Toda** mutação (`POST`, `PATCH`, `DELETE`) envia o header `x-csrf-token`.
  Isso inclui o próprio `POST /v1/auth/logout`, que também exige CSRF.
- Requisições de leitura não enviam o header, e a ausência dele numa leitura
  não é erro.
- Falha de CSRF chega como **403**. A interface trata como sessão inutilizável
  para escrita (ver O4), nunca reenviando automaticamente nem tentando
  adivinhar o token.

### 3.3 Projeção de dados

- A interface exibe **apenas** o que a API devolve. Não deriva, completa,
  enriquece nem infere campo ausente.
- **Não faz junção de dados entre módulos para exibir mais do que qualquer
  chamada isolada devolveria.** Exemplo concreto: o módulo de Ponto devolve
  `vinculoId`, e deliberadamente **não** devolve nome ou matrícula. Buscar o
  nome no módulo de Pessoas para "melhorar" a tela de ponto contornaria uma
  decisão de minimização tomada de propósito (ADR 0008; projeção mínima). Se
  essa correlação for desejável, é **decisão de produto**, não conveniência de
  interface.

### 3.4 Tratamento de resposta de erro

| Código  | Comportamento obrigatório                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **401** | Sessão ausente/expirada: encerrar estado local e levar ao login. Não reenviar credencial, não tentar renovar em silêncio                                                                    |
| **403** | Mensagem neutra de acesso negado. **Não** revelar qual permissão falta                                                                                                                      |
| **404** | Tratar como "não encontrado", **sem** sugerir que o recurso possa existir em outro escopo. A API usa 404 (em vez de 403) para não confirmar existência — a interface não pode desfazer isso |
| **500** | Mensagem genérica + `request_id`. **Nunca** renderizar corpo de erro, stack, mensagem interna ou detalhe técnico                                                                            |

O `AllExceptionsFilter` já devolve corpo estável (`status_code`, `message`,
`request_id`, `timestamp`) sem stack trace. A interface **exibe apenas
`request_id`** como referência de suporte, e trata `message` como texto fixo do
servidor — nunca como conteúdo a interpretar ou desdobrar.

### 3.5 Logs, console e telemetria

- **Nenhum dado pessoal** em `console`, telemetria, analytics, monitor de erro
  ou relatório de crash. Isso inclui nome, matrícula, e-mail, horário de
  marcação e qualquer identificador de pessoa.
- Se ferramenta de observabilidade de frontend for adotada (decisão pendente,
  §4 DP-W-09), ela precisa entrar com política de redação **antes** de qualquer
  dado real — e dado real já está bloqueado por outros gates (§6).
- `request_id` **pode** ser registrado: é identificador técnico de requisição,
  não dado de pessoa.

### 3.6 Autorização

- A API é a **única fonte de verdade**. A interface **não reimplementa** o
  avaliador RBAC/ABAC.
- Ocultar item de menu ou botão conforme o papel é **conveniência de
  usabilidade**, e precisa ser tratada como tal: nenhuma decisão de segurança
  pode depender dela. Toda rota é protegida no servidor, e uma URL digitada
  diretamente termina em resposta autoritativa da API.
- A interface **não** guarda uma cópia da matriz de permissões. No máximo,
  deriva visibilidade do papel devolvido por `/v1/users/me` — sabendo que essa
  derivação pode divergir da avaliação real (que também considera escopo de
  empresa e estado da entidade) e que, em caso de divergência, **quem vale é a
  API**.

## 4. Decisões pendentes

**(Baseline V1, 2026-08-10)**: das 11 decisões abaixo, 3 foram resolvidas
para o escopo desta V1 — cada uma marcada com o efeito exato da Baseline. As
demais permanecem pendentes, sem resolução por inferência. Nenhuma resolução
aqui equivale a autorizar código — ver
[Baseline V1](../decisions/painel-administrativo-web-v1-baseline.md) e
[ADR 0009](../adr/0009-painel-administrativo-web-v1.md).

| ID      | Decisão pendente                                                                                                                  | Quem decide                     | Status após Baseline V1                                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DP-W-01 | Framework concreto do frontend (o `README.md` cita React/TSX como intenção; nada foi inicializado — O1)                           | Produto, Arquitetura            | **Resolvida** (Decisão 1: React + Vite + TypeScript)                                                                                                                                                          |
| DP-W-02 | Hospedagem e topologia de origem: mesma origem/proxy **ou** habilitar CORS na API (esta segunda **exige alterar o backend** — O2) | Arquitetura, TI                 | **Topologia resolvida** (Decisão 2: mesma origem, sem CORS); provedor/domínio/ferramenta de proxy seguem pendentes como DP-W-02 (infraestrutura)                                                              |
| DP-W-03 | Design system: adotar existente ou construir `packages/ui` (hoje só `README.md`)                                                  | Produto, Design                 | Pendente                                                                                                                                                                                                      |
| DP-W-04 | Identidade visual (marca, cor, tipografia, tom)                                                                                   | Produto, Design                 | Pendente                                                                                                                                                                                                      |
| DP-W-05 | Layout, navegação e quais módulos entram no V1 visual (inclui recuperação de senha e trilha de auditoria)                         | Produto, Design                 | Pendente                                                                                                                                                                                                      |
| DP-W-06 | Se a visão inicial terá números e, em caso positivo, de onde vêm — não há endpoint de agregação                                   | Produto                         | Pendente                                                                                                                                                                                                      |
| DP-W-07 | Acessibilidade (nível-alvo) e navegadores suportados                                                                              | Produto, Design                 | Pendente                                                                                                                                                                                                      |
| DP-W-08 | Tratamento de sessão expirada **e** recuperação do token CSRF após _reload_ — ver O4, que era bloqueante                          | Produto, Segurança, Arquitetura | **Mecanismo resolvido** (Decisão 3: endpoint `GET /v1/auth/csrf` dedicado, contrato fechado); endpoint ainda não implementado, e a estratégia interna de emissão do token segue como detalhe de implementação |
| DP-W-09 | Política de logs e telemetria do cliente, com regra de redação                                                                    | Produto, DPO, Segurança         | Pendente                                                                                                                                                                                                      |
| DP-W-10 | Estratégia de testes visuais e e2e do painel (ferramenta, profundidade, execução em CI)                                           | Arquitetura, QA                 | Pendente                                                                                                                                                                                                      |
| DP-W-11 | Como expor OpenAPI e gerar cliente tipado; inclui completar o documento com o esquema de autenticação (O7)                        | Arquitetura                     | Pendente                                                                                                                                                                                                      |

## 5. Matriz de telas

Coluna "papel" indica quem **poderá** acessar **somente porque já está
autorizado no backend hoje** — não é concessão nova. Todas as rotas são
prefixadas por `/v1`.

### 5.1 Telas propostas

| Tela                                            | API existente que a atende                                                | Papéis já autorizados hoje                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Login                                           | `POST /auth/login`                                                        | Público (não autenticado)                                            |
| Sair                                            | `POST /auth/logout` (CSRF)                                                | Qualquer sessão válida                                               |
| Identidade do usuário                           | `GET /users/me`                                                           | Qualquer sessão válida                                               |
| Minhas sessões / revogar                        | `GET /auth/sessions`, `DELETE /auth/sessions/:id`                         | Qualquer sessão válida                                               |
| Empresas (lista/detalhe)                        | `GET /empresas`, `GET /empresas/:id`                                      | `admin_tecnico`, `rh`, `dp` (leitura)                                |
| Empresa (criar)                                 | `POST /empresas`                                                          | `admin_tecnico` apenas — `rh` é explicitamente negado na criação     |
| Empresa (alterar/inativar/reativar)             | `PATCH /empresas/:id`, `POST /empresas/:id/inativar`, `.../reativar`      | `admin_tecnico`, `rh`                                                |
| Unidades, departamentos, áreas, equipes, cargos | `GET/POST/PATCH` + `inativar`/`reativar` nos respectivos recursos         | Leitura: `admin_tecnico`, `rh`, `dp`. Escrita: `admin_tecnico`, `rh` |
| Centros de custo                                | idem, em `/centros-de-custo`                                              | Leitura: acima **e** `financeiro`. Escrita: `admin_tecnico`, `rh`    |
| Colaboradores (lista)                           | `GET /colaboradores` (filtros `empresaId`, `situacao`, `situacaoVinculo`) | `rh`, `dp`                                                           |
| Colaborador (detalhe)                           | `GET /colaboradores/:id`                                                  | `rh`, `dp`                                                           |
| Admissão (atômica)                              | `POST /colaboradores`                                                     | `rh`, `dp`                                                           |
| Colaborador (retificar)                         | `PATCH /colaboradores/:id`                                                | `rh`, `dp`                                                           |
| Vínculos do colaborador                         | `GET /colaboradores/:id/vinculos`                                         | `rh`, `dp`                                                           |
| Novo vínculo (readmissão)                       | `POST /vinculos`                                                          | `rh`, `dp`                                                           |
| Alocações do vínculo                            | `GET /vinculos/:id/alocacoes`                                             | `rh`, `dp`                                                           |
| Situação em data de referência                  | `GET /vinculos/:id/situacao`                                              | `rh`, `dp`                                                           |
| Linha do tempo do vínculo                       | `GET /vinculos/:id/linha-do-tempo`                                        | `rh`, `dp`                                                           |
| Movimentações (lista)                           | `GET /movimentacoes` (filtros `empresaId`, `vinculoId`, `tipo`)           | `rh`, `dp`                                                           |
| Registrar movimentação                          | `POST /movimentacoes`                                                     | `rh`, `dp`                                                           |
| Efetivar / cancelar / retificar                 | `POST /movimentacoes/:id/{efetivar,cancelar,retificar}`                   | `rh`, `dp`                                                           |
| Ponto (lista/filtro por competência)            | `GET /pontos` (filtros `vinculoId`, `competencia`, `tipo`)                | `rh`, `dp`                                                           |
| Ponto do vínculo                                | `GET /vinculos/:id/pontos`                                                | `rh`, `dp`                                                           |
| Marcação (detalhe + efetivo + ajustes)          | `GET /pontos/:id`, `GET /pontos/:id/ajustes`                              | `rh`, `dp`                                                           |
| Registrar marcação                              | `POST /pontos`                                                            | `rh`, `dp`                                                           |
| Registrar ajuste                                | `POST /pontos/:id/ajustes`                                                | `rh`, `dp`                                                           |

### 5.2 Lacunas de API — não podem ser resolvidas inventando endpoint

**(Baseline V1, 2026-08-10)**: as duas primeiras linhas desta tabela foram
resolvidas por decisão de produto — ver
[Baseline V1](../decisions/painel-administrativo-web-v1-baseline.md). Nenhuma
das duas já está implementada; a resolução é de arquitetura/contrato, não de
código.

| Lacuna                                                                       | Efeito na interface                                                                                 | Encaminhamento                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sem rota para obter o token CSRF de uma sessão já autenticada** (O4)       | Após _reload_, o usuário segue autenticado mas **não consegue mutar nada**. Bloqueava o V1 como SPA | **(Baseline V1, Decisão 3)** resolvida por decisão: será criado `GET /v1/auth/csrf`, contrato fechado. **Endpoint ainda não existe** — continua bloqueante até ser implementado                              |
| **Sem CORS** (O2)                                                            | Frontend em origem distinta não funciona                                                            | **(Baseline V1, Decisão 2)** resolvida por decisão: mesma origem, sem CORS nesta V1. CORS continua **não configurado** — topologia de origens distintas seguirá não funcionando, por decisão, não por lacuna |
| **Sem rota de listagem de usuários**                                         | Não há tela de gestão de acessos com listagem; só criação e ações sobre um id já conhecido          | Endpoint novo seria alteração de backend — fora desta fase                                                                                                                                                   |
| **Sem `GET /movimentacoes/:id`**                                             | Detalhe de movimentação só via listagem filtrada ou linha do tempo do vínculo                       | Contornável hoje; endpoint novo exigiria decisão                                                                                                                                                             |
| **Sem `GET /vinculos/:id`**                                                  | Não há detalhe direto do vínculo; só sub-recursos e a lista dentro do colaborador                   | Contornável hoje                                                                                                                                                                                             |
| **Sem endpoint de agregação/métrica**                                        | Visão inicial não pode exibir indicador sem inventar API                                            | DP-W-06                                                                                                                                                                                                      |
| **OpenAPI sem esquema de autenticação e sem tags de `pessoas`/`ponto`** (O7) | Cliente tipado gerado hoje não descreve autenticação                                                | DP-W-11                                                                                                                                                                                                      |
| **Ponto não devolve nome/matrícula** (decisão de minimização)                | Telas de ponto identificam por `vinculoId`                                                          | **Não é lacuna a corrigir na interface.** Correlacionar exige decisão de produto (§3.3)                                                                                                                      |

## 6. Critérios de aceite futuros

Para a futura fase Implementar do painel. Nenhum é satisfeito hoje.

1. **Login e logout reais** contra a API, com sessão por cookie `HttpOnly` e
   **nenhum** token em `localStorage`/`sessionStorage` — verificável por
   inspeção automatizada do armazenamento após autenticar.
2. **CSRF em toda mutação**, incluindo logout, com teste que comprove que uma
   mutação sem o header é recusada — e com DP-W-08 resolvida antes disso, sob
   pena de a aplicação não funcionar após _reload_.
3. **Navegação acessível**: operável por teclado, com foco visível, rótulos
   associados e contraste adequado, no nível que DP-W-07 definir.
4. **Consumo tipado da API**, derivado do contrato e não de tipos escritos à
   mão em paralelo — com DP-W-11 resolvida.
5. **Testes de autorização e de estados de erro**: para cada tela, um caso
   negativo comprovando que 401, 403, 404 e 500 produzem o comportamento de
   §3.4 — em particular, que 404 não é apresentado como "sem permissão" e que
   corpo de erro interno nunca é renderizado.
6. **Nenhum dado real**, em nenhum ambiente, até que os gates já registrados
   sejam cumpridos: MFA obrigatório (ADR 0003, decisão 3), validação
   jurídica/DPO e política de retenção (ADR 0008, decisão 8; DP-3J-11). O
   painel **não relaxa** nenhum desses gates — ele acrescenta superfície e, com
   isso, torna-os mais relevantes.
7. **Revisão humana de segurança antes de publicar**, cobrindo no mínimo:
   armazenamento de credencial, cobertura de CSRF, tratamento de erro, ausência
   de dado pessoal em log/telemetria e confirmação de que nenhuma decisão de
   autorização foi movida para o cliente.

**Esta especificação não declara conformidade LGPD, aprovação jurídica nem
prontidão para dado real.** Ela descreve uma interface a construir sobre APIs
que já existem, e registra — sem contorná-las — as lacunas que precisam de
decisão antes de a construção começar.
