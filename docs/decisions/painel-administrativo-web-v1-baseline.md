# Baseline V1 do Painel Administrativo Web — decisão aprovada

Status: **DECISÃO APROVADA** (2026-08-10)

Relacionado:
[docs/modules/painel-administrativo-web-v1.md](../modules/painel-administrativo-web-v1.md)
(spec atualizada para refletir esta decisão),
[ADR 0009](../adr/0009-painel-administrativo-web-v1.md)
(formalização arquitetural), e — pelo padrão já usado nas Fatias 1, 2 e 3 —
[docs/decisions/etapa3-jornada-ponto-baseline-v1.md](etapa3-jornada-ponto-baseline-v1.md)
como precedente de formato para este tipo de registro.

## 0. Escopo e limites deste documento

Este documento registra **o que o produto decidiu** em 2026-08-10 para o
Painel Administrativo Web V1: três decisões que resolvem parte do que a
especificação estrutural (2026-08-10) deixava pendente — framework do
frontend, topologia de origem entre painel e API, e o mecanismo futuro de
recuperação do token CSRF após recarregar a página (a lacuna bloqueante
identificada na spec original, O4).

**O que este documento não faz:**

- Não implementa nada — nenhum código React, componente, dependência,
  configuração de build, endpoint, proxy ou middleware é criado aqui.
- Não cria o endpoint `GET /v1/auth/csrf` — apenas aprova sua existência
  futura e fixa o contrato que ele precisará respeitar quando for
  implementado, em fase própria.
- Não configura CORS, nem declara que mesma origem é "segura" em algum
  sentido absoluto — apenas fixa que é a topologia adotada nesta V1,
  evitando a alteração de superfície que CORS exigiria (spec original, O2).
- Não altera nenhuma ADR anterior (0001 a 0008) — apenas referencia, onde
  aplicável, e prepara uma emenda futura possível à ADR 0003 caso o
  contrato do CSRF avance (§2).
- Não resolve gestão de usuários, métricas, telemetria, identidade visual,
  acessibilidade detalhada ou as demais lacunas de API já registradas na
  spec original — todas seguem pendentes, sem decisão por inferência (§2).
- Não declara CORS seguro, hospedagem existente, conformidade LGPD ou
  qualquer endpoint desta fatia como já implementado.
- Não concede acesso de painel a nenhum papel que hoje não tem acesso ao
  domínio correspondente na API — a autorização visual continua sendo
  reflexo do que o backend já decide, nunca uma concessão nova.

## 1. As 3 decisões aprovadas

Cada decisão preserva, como histórico, o que a especificação estrutural
original (2026-08-10) deixava como pendência — referenciado abaixo, não
duplicado.

### Decisão 1 — Framework do frontend

**Aprovado:** o painel administrativo será construído em **React + Vite +
TypeScript**.

**Contexto preservado (spec original, DP-W-01):** a especificação
registrava como pendente o framework concreto, notando que
`apps/web/README.md` já citava React/TSX como intenção, sem nada
inicializado (O1). Esta decisão fecha a escolha de framework e ferramenta
de build — **não inicializa o projeto**. Nenhum `package.json`,
dependência ou arquivo de configuração é criado por esta decisão; isso
permanece tarefa da futura fase Implementar, quando autorizada
separadamente.

**Efeito na especificação:** resolve **DP-W-01**.

### Decisão 2 — Mesma origem, com proxy reverso

**Aprovado:** painel e API operam na **mesma origem** nesta V1. O
navegador acessa a API por `/v1/...`, através de proxy reverso. **CORS não
é configurado nesta V1.**

**Contexto preservado (spec original, O2, DP-W-02):** a especificação já
havia verificado, por inspeção de `main.ts`, que a API não configura CORS
e que o cookie de sessão usa `sameSite: "lax"` — e recomendava
tecnicamente a opção de mesma origem, exatamente por não exigir alteração
em código já mergeado e auditado, nem ampliar a superfície de CSRF. Esta
decisão adota essa recomendação como decisão de produto.

**O que fica de fora, deliberadamente:** o **provedor**, o **domínio**, a
**ferramenta de proxy reverso** (nginx, Caddy, API gateway, CDN com
roteamento de origem, ou qualquer outra) e a **topologia de deploy** (mesmo
processo servindo o build estático, containers separados atrás de um
proxy comum, etc.) **não são decididos aqui**. Isso é responsabilidade
**futura de infraestrutura**, tratada em fase própria — provisionamento de
ambiente é execução operacional, não decisão de produto.

**Consequência técnica direta:** como a API não terá CORS configurado
nesta V1, **qualquer topologia de deploy que sirva o painel de origem
diferente da API deixa de funcionar no navegador**, até que essa decisão
seja revista com uma ADR própria. A responsabilidade de infraestrutura
mencionada acima precisa garantir mesma origem — não é uma opção entre
várias, é pré-condição para o painel funcionar como especificado.

**Efeito na especificação:** resolve a parte de topologia de **DP-W-02**
(mesma origem, sem CORS). Provedor, domínio e ferramenta de proxy
permanecem pendentes, como **DP-W-02 (infraestrutura)** — não bloqueante
para a fase Implementar do painel, que pode prosseguir assumindo mesma
origem sem precisar saber qual proxy a servirá.

### Decisão 3 — Endpoint futuro `GET /v1/auth/csrf`

**Aprovado:** será criado, em fase própria e futura, um endpoint
autenticado `GET /v1/auth/csrf` para recuperar o token CSRF associado à
sessão corrente após recarregar a página — sem exigir novo login e sem uso
de `localStorage` ou `sessionStorage`.

**Contexto preservado (spec original, O4, DP-W-08):** a especificação
identificou esta como a lacuna mais séria do V1 visual: o token CSRF é
devolvido só uma vez, no corpo do login; como o cookie de sessão é
`HttpOnly` e sobrevive a um _reload_, mas o token CSRF vive só na memória
da aba, o usuário ficava autenticado e incapaz de mutar após recarregar a
página. A spec registrou três caminhos possíveis sem escolher nenhum — (a)
rota nova, (b) cookie de CSRF legível por script (_double-submit_), (c)
aceitar novo login a cada _reload_. Esta decisão escolhe explicitamente o
caminho **(a)**, e rejeita **(b)** e **(c)**.

**Contrato aprovado para quando o endpoint for implementado** (ver
detalhamento completo na [ADR 0009](../adr/0009-painel-administrativo-web-v1.md)):

- exige sessão válida (mesmo `SessionGuard` já usado em toda rota
  autenticada);
- retorna **somente** o token CSRF associado à sessão — nenhum outro
  campo;
- **não é mutação de domínio** — não altera estado de nenhuma entidade de
  negócio;
- resposta com `Cache-Control: no-store` — o token nunca deve ser
  reutilizável a partir de um cache de navegador, proxy ou CDN;
- **não usa cookie de CSRF do tipo double-submit** — o mecanismo
  synchronizer token já aprovado (ADR 0003, decisão 6) é preservado sem
  alteração de desenho;
- **não grava o token em nenhum armazenamento persistente do navegador** —
  a responsabilidade de mantê-lo só em memória, do lado do cliente, é do
  painel (spec original, §3);
- responde **401** para sessão ausente ou expirada, sem detalhe interno —
  mesmo padrão de erro genérico já usado em toda a API;
- **não expõe credencial, dado pessoal ou informação de autorização** — a
  resposta é só o token, nada além disso;
- a API continua sendo a **única fonte de verdade** de autorização — este
  endpoint não introduz nenhum mecanismo paralelo de decisão de acesso.

**Detalhe técnico que a implementação futura precisará resolver, não
decidido aqui:** o banco guarda hoje só o **hash** do token CSRF
(`csrf_token_hash`, mesmo padrão de `token_hash` da sessão — ADR 0003,
decisão 5), nunca o valor bruto. Isso significa que "recuperar o token
CSRF associado à sessão" não pode ser uma leitura simples de um valor já
persistido — a implementação real precisará decidir entre (i) emitir um
**novo** token CSRF a cada chamada a este endpoint, substituindo o hash
armazenado (rotação), ou (ii) alguma outra estratégia compatível com o
padrão hash-only. Esta decisão **aprova a existência e o contrato externo
do endpoint**, não a estratégia interna de emissão — que é decisão de
implementação, revisada quando o endpoint for codificado.

**O que esta decisão não faz:** não cria o endpoint, não altera
`schema.prisma`, `session.service.ts`, `csrf.guard.ts` ou qualquer rota já
mergeada. Nenhuma migration, dependência ou linha de código é adicionada
por esta decisão.

**Efeito na especificação:** resolve **DP-W-08** quanto ao mecanismo
escolhido (endpoint dedicado); a estratégia interna de emissão do token
permanece detalhe de implementação, não bloqueante para esta decisão.

## 2. O que permanece pendente, sem resolução por inferência

Nenhuma das 3 decisões acima resolve os itens abaixo. Permanecem
exatamente como estavam na especificação original:

- **SSO** continua evolução futura — nenhuma decisão desta Baseline
  antecipa ou descarta integração com provedor de identidade externo. Seu
  eventual desenho segue as mesmas condições já registradas na ADR 0003
  (decisão 2: interface de autenticação isolada, trocável sem reescrever
  sessão/autorização).
- **MFA continua obrigatório antes de qualquer piloto com dados reais ou
  produção** (ADR 0003, decisão 3) — esta Baseline não relaxa essa
  condição em nenhum grau. O painel, ao acrescentar superfície de acesso
  visual, torna essa condição mais relevante, não menos.
- **DP-W-03** (design system), **DP-W-04** (identidade visual), **DP-W-05**
  (layout, navegação, escopo exato de telas), **DP-W-06** (métricas),
  **DP-W-07** (acessibilidade detalhada e navegadores-alvo), **DP-W-09**
  (telemetria), **DP-W-10** (estratégia de testes visuais/e2e) e
  **DP-W-11** (exposição de OpenAPI/cliente tipado) seguem pendentes, sem
  alteração.
- As **lacunas de API** já registradas na spec original — ausência de
  listagem de usuários, de `GET` por id de movimentação e de vínculo, de
  endpoint de agregação para métricas, e de esquema de autenticação
  descrito no OpenAPI — continuam sem solução. Nenhuma é resolvida por
  esta Baseline, e nenhum endpoint novo além do `GET /v1/auth/csrf`
  (Decisão 3) é aprovado.
- **Nenhum papel ganha acesso novo.** As três decisões desta Baseline são
  de arquitetura de frontend e de contrato de um endpoint técnico de
  sessão — nenhuma delas concede, amplia ou reinterpreta a matriz de
  autorização já implementada nos domínios de Organização, Pessoas e
  Ponto. Um papel sem acesso a um domínio na API continua sem acesso à
  tela correspondente no painel.

### Declaração explícita

**Esta decisão não declara CORS seguro, hospedagem existente, conformidade
LGPD ou qualquer endpoint desta fatia como já implementado.** Ela resolve
três decisões de arquitetura e contrato para o V1 do painel — nada além
disso. Início de código, dependência, endpoint ou infraestrutura depende
de autorização própria, separada deste documento.

## 3. Rastreabilidade

| Item da tarefa (enunciado original)      | Decisão nesta Baseline | Seção da spec atualizada |
| ---------------------------------------- | ---------------------- | ------------------------ |
| 1. Framework (React + Vite + TypeScript) | Decisão 1              | O1, §4 (DP-W-01)         |
| 2. Mesma origem, com proxy reverso       | Decisão 2              | O2, §4 (DP-W-02)         |
| 3. Endpoint futuro `GET /v1/auth/csrf`   | Decisão 3              | O4, §4 (DP-W-08), §5     |
