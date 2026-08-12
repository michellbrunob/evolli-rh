STATUS: PENDENTE DE APROVAÇÃO DO PRODUTO — NÃO IMPLEMENTAR

# Painel Administrativo Web V1 — experiência visual mínima (proposta)

- Fase do SDD: **Especificar**. Nenhuma aplicação, componente, dependência,
  endpoint, migration, proxy ou infraestrutura é criada por este documento.
- Data: 2026-08-12
- Base verificada: `main` no commit
  `c5129ff4b233c9c14d28c78f0598af0110229fdf`
- Resolve, se aprovado: **DP-W-05** (layout, navegação e quais módulos entram
  no V1 visual, incluindo recuperação de senha e trilha de auditoria) e
  propõe encaminhamento para **DP-W-07** (acessibilidade e navegadores-alvo).
- Relacionado:
  [docs/modules/painel-administrativo-web-v1.md](../modules/painel-administrativo-web-v1.md)
  (especificação estrutural aprovada),
  [Baseline V1](painel-administrativo-web-v1-baseline.md),
  [ADR 0009](../adr/0009-painel-administrativo-web-v1.md),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md),
  [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md),
  [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md),
  [ADR 0010](../adr/0010-preparacao-multiempresa-interna.md).

## 0. O que este documento é e o que não é

**É** uma proposta de experiência visual mínima, para o produto aprovar,
rejeitar ou emendar. Cada tela proposta é acompanhada do endpoint que
**já existe** e do papel que **já está autorizado** — nenhuma tela depende
de rota, campo, permissão ou papel novo.

**Não é** autorização para implementar. Não cria `apps/web`, componente,
dependência, endpoint, migration, CI, proxy, CORS ou infraestrutura. Não
altera nenhuma ADR, baseline ou especificação já aprovada. Não decide
identidade visual, design system nem telemetria.

**Não declara conformidade** de acessibilidade, LGPD, segurança ou
hospedagem. As propostas de acessibilidade (§8) são critérios a perseguir,
não conformidade atingida.

**Nenhuma decisão aqui amplia autorização.** Onde este documento diz que um
papel "vê" algo, é porque o avaliador RBAC/ABAC já concede — verificado em
`rbac.evaluator.ts` no commit acima, não presumido.

## 1. Objetivo do primeiro painel visual interno

Dar ao escritório uma **interface administrativa interna** que substitua o
uso direto da API por cliente HTTP, para as operações que a API já suporta:
manter a estrutura organizacional, cadastrar e acompanhar colaboradores e
vínculos, e registrar e consultar ponto — com sessão real, autorização real
e trilha de auditoria real por trás.

O objetivo **não** é impressionar, medir nem consolidar. É tornar operável,
por pessoa não técnica do escritório, o que hoje só é operável por quem sabe
montar uma requisição autenticada com header CSRF.

Três limites decorrem direto disso:

1. **A interface não é fonte de verdade de nada.** Não calcula, não agrega,
   não deriva, não completa campo ausente. Exibe o que a API devolve
   (spec §3.3).
2. **A interface não amplia alcance.** Se um papel não vê um módulo na API,
   não vê no painel — e o painel não "compensa" isso (spec O6).
3. **Sem dado real até os gates.** MFA, validação DPO/jurídica e política de
   retenção continuam obrigatórios antes de qualquer dado real
   (ADR 0003 decisão 3; spec §6). O V1 opera com **dados sintéticos**.

## 2. Base de autorização verificada

Verificado em `rbac.evaluator.ts`, `permission.types.ts` e nas quatro suítes
`rbac.evaluator*.spec.ts`. Esta tabela é o insumo do mapa de navegação — não
uma proposta.

| Papel           | Organização                                          | Pessoas    | Ponto                 | Auditoria (`access_log`) | Contas                                    |
| --------------- | ---------------------------------------------------- | ---------- | --------------------- | ------------------------ | ----------------------------------------- |
| `admin_tecnico` | **Total** nos 7 recursos, qualquer empresa           | **Negado** | **Negado**            | Leitura global           | Gerencia outras contas; cria/altera papel |
| `rh`            | Total nos 7, **exceto criar empresa**; mesma empresa | Total      | Registrar e consultar | Negado                   | Mesma empresa; nunca `admin_tecnico`      |
| `dp`            | **Somente leitura**, mesma empresa                   | Total      | Registrar e consultar | Negado                   | Gerencia contas da mesma empresa          |
| `financeiro`    | **Somente `centro_custo`, leitura**, mesma empresa   | Negado     | Negado                | Negado                   | Negado                                    |
| `gestor`        | Negado                                               | Negado     | Negado                | Negado                   | Negado                                    |
| `colaborador`   | Negado                                               | Negado     | Negado                | Negado                   | Negado                                    |
| `auditor`       | Negado                                               | Negado     | Negado                | Leitura global           | Negado                                    |
| `dpo`           | Negado                                               | Negado     | Negado                | Leitura global           | Negado                                    |

Todos os oito papéis têm `own_account` (ler e gerenciar **a própria** conta).

Fatos que a interface precisa absorver, não contornar:

- **`admin_tecnico` não vê colaborador nem ponto.** É deliberado e definitivo
  (ADR 0007 decisão 8; ADR 0008 decisão 6), não omissão a corrigir.
- **`dp` é leitura pura em Organização**, mas escreve em Pessoas e Ponto.
  Botões de escrita organizacional não devem existir para `dp`.
- **Ponto só aceita `create` e `read`.** `alter` e `manage` não existem no
  domínio — nenhum botão "editar", "excluir", "aprovar" ou "fechar" pode
  existir, porque não há rota para eles.
- **`gestor` e `colaborador` teriam painel vazio** além da própria conta.
- A autorização é avaliada em **duas fases**: capacidade (o papel pode, em
  tese?) e escopo (a entidade é da empresa dele?). Um papel pode passar na
  primeira e falhar na segunda — logo, **menu visível nunca garante sucesso**,
  o que reforça spec §3.6.

## 3. Mapa de navegação mínimo por papel

Proposta: **menu derivado do papel devolvido por `GET /v1/users/me`**,
tratado como conveniência de usabilidade e nunca como controle (spec §3.6).
Rota digitada diretamente sempre termina em resposta autoritativa da API.

| Papel           | Itens de menu propostos                                              |
| --------------- | -------------------------------------------------------------------- |
| `admin_tecnico` | Início · Organização · Auditoria¹ · Minha conta                      |
| `rh`            | Início · Organização · Colaboradores · Ponto · Minha conta           |
| `dp`            | Início · Organização (leitura) · Colaboradores · Ponto · Minha conta |
| `financeiro`    | Início · Centros de custo (leitura) · Minha conta                    |
| `auditor`       | Início · Auditoria¹ · Minha conta                                    |
| `dpo`           | Início · Auditoria¹ · Minha conta                                    |
| `gestor`        | Início · Minha conta                                                 |
| `colaborador`   | Início · Minha conta                                                 |

¹ Auditoria depende de decisão bloqueante **DB-3** (§10). Se não aprovada,
o item não existe para ninguém nesta V1.

**"Minha conta"** existe para todos os oito papéis, porque `own_account` e
`GET /v1/auth/sessions` são acessíveis a qualquer sessão válida. É o que
impede o painel de `gestor` e `colaborador` de ser uma tela em branco —
sem inventar acesso.

Para `gestor` e `colaborador` a proposta é que a tela inicial diga
explicitamente que **nenhum módulo está disponível para o papel**, em vez de
mostrar módulos que resultariam em 403. Isso é honestidade de interface, não
revelação: não informa o que existe do outro lado, apenas que o papel não
opera nada aqui.

## 4. Telas candidatas

Formato por tela: papel autorizado · endpoint existente · dados permitidos ·
dados deliberadamente não exibidos · estados obrigatórios.

Nos estados, **404 anti-enumeração** significa: tratar como "não encontrado"
sem sugerir que o recurso exista em outro escopo. A API responde 404 (em vez
de 403) justamente para não confirmar existência — a interface não pode
desfazer isso (spec §3.4).

### 4.1 Login

| Item                | Definição                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Papel autorizado    | Público (não autenticado)                                                                                                                             |
| Endpoint existente  | `POST /v1/auth/login` → em sucesso, `GET /v1/users/me`                                                                                                |
| Dados permitidos    | Campos de e-mail e senha; após sucesso, `email` e `role` de `/users/me`                                                                               |
| Não exibidos        | Motivo real da falha; existência da conta; estado de bloqueio; contagem de tentativas restantes; qualquer campo de `/users/me` além de e-mail e papel |
| Vazio               | Não se aplica                                                                                                                                         |
| Carregando          | Botão em estado de envio, campos bloqueados, sem duplo envio                                                                                          |
| 401                 | Mensagem **única e genérica** de credencial inválida — idêntica para senha errada, e-mail inexistente, conta desabilitada e bloqueio por tentativas   |
| 403                 | Não se aplica (rota não exige CSRF)                                                                                                                   |
| 404 anti-enumeração | Não se aplica                                                                                                                                         |

A API é deliberadamente indistinguível nesses casos. A interface **não pode**
desfazer isso reportando o motivo real, nem por mensagem, nem por tempo de
resposta perceptível, nem por foco de campo.

**Recuperação de senha:** a API tem `POST /v1/auth/password/forgot` e
`/reset`. Entrar ou não no V1 visual é decisão **DB-2** (§10). Se entrar, a
resposta é sempre genérica (`202`), nunca confirmando se o e-mail existe.

### 4.2 Sessão expirada

Não é uma tela de menu — é um **comportamento global** disparado por qualquer
`401` recebido em qualquer chamada.

| Item               | Definição                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Papel autorizado   | Qualquer sessão que expirou, foi revogada ou cujo usuário foi desativado                                                                  |
| Endpoint existente | Nenhum novo — é a reação ao `401` de qualquer rota                                                                                        |
| Dados permitidos   | Aviso neutro de sessão encerrada; `request_id` da resposta                                                                                |
| Não exibidos       | **Se a sessão expirou, foi revogada ou a conta foi desativada** — a API responde `401` genérico para os três, e a interface não distingue |
| Carregando         | Não se aplica                                                                                                                             |
| Comportamento      | Descartar **todo** estado em memória, inclusive o token CSRF; levar ao login                                                              |

Regras obrigatórias, herdadas de spec §3.4:

- **Não reenviar credencial** e **não tentar renovar sessão em silêncio.**
- **Não preservar** dados de formulário em andamento que contenham dado de
  pessoa — descartar junto com o estado.
- Se o `401` ocorreu durante uma **mutação**, a interface não pode afirmar que
  a operação falhou nem que teve efeito; deve dizer que a sessão terminou e
  que o usuário precisa **verificar o estado após reautenticar**. Presumir
  qualquer um dos dois é errado.

### 4.3 Recuperação de CSRF pós-reload

Também não é tela de menu — é comportamento de infraestrutura da aplicação,
visível ao usuário só quando falha. Detalhado em §5.

| Item               | Definição                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Papel autorizado   | Qualquer sessão válida                                                                         |
| Endpoint existente | `GET /v1/auth/csrf` (implementado, commit `c5129ff`)                                           |
| Dados permitidos   | O token CSRF, **apenas em memória**                                                            |
| Não exibidos       | **O token nunca é exibido, logado, copiado para a URL, nem gravado em qualquer armazenamento** |
| Carregando         | Bloqueio discreto de ações de escrita até o token existir; leituras seguem normalmente         |
| 401                | Trata como §4.2 — sessão encerrada                                                             |
| 403                | Ver §5: token corrente inválido; obter novo e **nunca reenviar automaticamente**               |

### 4.4 Organização

| Item                | Definição                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Papel autorizado    | Leitura: `admin_tecnico`, `rh`, `dp`. Escrita: `admin_tecnico`, `rh` (`rh` **não** cria empresa). `financeiro`: **somente centro de custo, leitura**                                                            |
| Endpoint existente  | `GET`/`POST`/`PATCH` + `inativar`/`reativar` em `/v1/empresas`, `/v1/unidades-organizacionais`, `/v1/departamentos`, `/v1/areas`, `/v1/equipes`, `/v1/cargos`, `/v1/centros-de-custo`                           |
| Dados permitidos    | Os campos que cada entidade devolve: `id`, `codigo`, `nome`, `status`, `criadoEm`, `atualizadoEm`, mais as referências de pai (`empresaId`, `departamentoId`, `unidadeOrganizacionalId`) onde a entidade as tem |
| Não exibidos        | Contagem de dependentes; qual entidade bloqueou uma inativação; qualquer dado de outra empresa; qualquer campo derivado ou calculado no cliente                                                                 |
| Vazio               | "Nenhum registro no seu escopo" — **sem** sugerir que exista algo fora dele                                                                                                                                     |
| Carregando          | Indicação clara; não manter lista anterior visível como se fosse atual                                                                                                                                          |
| 401                 | §4.2                                                                                                                                                                                                            |
| 403                 | Mensagem neutra de acesso negado, sem dizer qual permissão falta                                                                                                                                                |
| 404 anti-enumeração | "Não encontrado", sem sugerir existência em outro escopo                                                                                                                                                        |

**Inativação bloqueia, nunca cascateia** (ADR 0006 decisão 7). A API recusa
com conflito **sem identificar o dependente**. A interface precisa exibir a
recusa de forma compreensível e **não pode** varrer outros endpoints para
descobrir e exibir qual é o dependente — isso reconstruiria uma informação
que a API escolheu não dar.

Para `financeiro`, o menu propõe apenas **Centros de custo**, em leitura.
Mostrar as outras seis entidades geraria 403 em sequência.

Para `dp`, a tela é idêntica à de `rh` **sem nenhum controle de escrita** —
não desabilitado com aparência de disponível, e sim ausente.

Restrições da API que a tela precisa respeitar, não contornar:

- **Não existe busca textual nem ordenação escolhida pelo cliente.** As
  listagens aceitam só `pagina`, `tamanhoPagina`, `status` e a referência de
  pai; a ordenação é fixa por `codigo` no servidor. A tela **não** deve
  oferecer campo de busca livre nem cabeçalho de coluna ordenável — nenhum
  dos dois é suportado, e simulá-los no cliente ordenaria apenas a página
  carregada, o que engana o operador.
- **Não existe `DELETE`** em nenhuma entidade organizacional. Só inativar e
  reativar.
- `POST .../inativar` e `.../reativar` respondem **201**, não 200 — a tela não
  deve tratar 201 como anomalia.

### 4.5 Colaboradores

| Item                | Definição                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Papel autorizado    | `rh` e `dp` **apenas**. `admin_tecnico` é negado — o módulo não aparece no menu dele                                                                                                                                                                                          |
| Endpoint existente  | `GET`/`POST`/`PATCH` `/v1/colaboradores`, `GET /v1/colaboradores/:id/vinculos`, `POST /v1/vinculos`, `GET /v1/vinculos/:id/alocacoes`, `.../situacao`, `.../linha-do-tempo`, `GET`/`POST` `/v1/movimentacoes` e `efetivar`/`cancelar`/`retificar`                             |
| Dados permitidos    | Colaborador: `nome`, `situacao`. Vínculo: `matricula`, `tipo`, `situacao`, `dataAdmissao`, `dataDesligamento`. Alocação: referências organizacionais e vigência. Movimentação: `tipo`, `status`, `motivoCodigo`, vigência, destinos e identificadores de solicitante/executor |
| Não exibidos        | **CPF, RG, endereço, telefone, e-mail pessoal, data de nascimento, nome social, salário, remuneração, benefício, dado familiar, médico ou sensível** — nenhum existe no schema (ADR 0007 decisão 5) e nenhum pode ser solicitado, inferido ou adicionado pela tela            |
| Vazio               | "Nenhum colaborador no seu escopo", sem revelar existência fora dele                                                                                                                                                                                                          |
| Carregando          | Indicação clara por lista e por detalhe                                                                                                                                                                                                                                       |
| 401                 | §4.2                                                                                                                                                                                                                                                                          |
| 403                 | Mensagem neutra                                                                                                                                                                                                                                                               |
| 404 anti-enumeração | "Não encontrado" — inclusive ao abrir um id de outra empresa                                                                                                                                                                                                                  |

Pontos do domínio que a interface **precisa** tornar visíveis:

- **Admissão é atômica** — cria colaborador, vínculo e, quando o vínculo já
  nasce ativo, a alocação. É uma operação, não três telas encadeadas.
- **Movimentação efetivada é imutável**; correção é **retificação**, que gera
  evento novo referenciando o original — que permanece visível na linha do
  tempo (ADR 0007 decisão 7). Nenhum botão "editar" deve existir.
- **Situação do colaborador é derivada dos vínculos**, nunca editável direto.

O campo de filtro por empresa deve deixar claro que resultado vazio significa
"nada no seu escopo", jamais "você não tem permissão para a empresa X" — a
API responde página vazia de propósito (spec §1.7).

Restrições da API que moldam a navegação — e que a tela não pode contornar:

- **Não existe busca por nome ou matrícula.** `GET /v1/colaboradores` aceita
  só `pagina`, `tamanhoPagina`, `empresaId`, `situacao` e `situacaoVinculo`,
  com ordenação fixa por nome. Localizar alguém é **navegar e paginar**, não
  pesquisar. Um campo de busca que filtrasse no cliente veria só a página
  carregada e daria a impressão falsa de "não existe".
- **Não existe `GET` de vínculo por id nem listagem geral de vínculos.** O
  vínculo só é alcançável por `GET /v1/colaboradores/:id/vinculos`. Logo, a
  navegação natural é **Colaborador → Vínculo → (alocações, linha do tempo,
  ponto)**, e o `vinculoId` chega por navegação, nunca digitado.
- **Não existe `GET` de movimentação por id.** O detalhe vem da listagem ou
  da linha do tempo do vínculo.
- **A admissão devolve apenas o colaborador criado** — o vínculo e a
  movimentação nascidos na mesma transação **não vêm na resposta**. A tela
  precisa buscar os vínculos em seguida para exibir o resultado, e não pode
  presumir os identificadores.
- **Efetivar uma movimentação devolve apenas a movimentação atualizada** — a
  alocação criada/encerrada e a mudança de situação do vínculo **não vêm na
  resposta**. A tela deve recarregar o que precisa exibir, nunca deduzir.
- **Retificar devolve a linha nova**, não a original; a original permanece
  visível na linha do tempo e a tela precisa mostrar as duas.
- Não existe `PATCH`/`DELETE` de vínculo ou movimentação; as únicas transições
  são `efetivar`, `cancelar` e `retificar`, e todas respondem **201**.
- `GET /v1/vinculos/:id/situacao` **exige** `dataReferencia` — a tela precisa
  oferecer a data como entrada obrigatória, sem inventar um padrão silencioso.

### 4.6 Jornada e Ponto

| Item                | Definição                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Papel autorizado    | `rh` e `dp` **apenas**, e somente **registrar** e **consultar**                                                                                                                                                                        |
| Endpoint existente  | `GET`/`POST` `/v1/pontos`, `GET /v1/vinculos/:id/pontos`, `GET /v1/pontos/:id`, `GET /v1/pontos/:id/ajustes`, `POST /v1/pontos/:id/ajustes`                                                                                            |
| Dados permitidos    | `vinculoId`, `tipo`, `momento`, `competencia` (`YYYY-MM`), `registradoPorUserId`, `registradoEm`, e o objeto `efetivo` (`tipo`, `momento`, `anulado`, `totalAjustes`); ajustes com `motivoCodigo`, `anula`, correções e quem registrou |
| Não exibidos        | **Nome e matrícula do colaborador** — o módulo devolve `vinculoId` de propósito (minimização, ADR 0008). Buscar o nome em Pessoas para "melhorar" a tela é **proibido** (spec §3.3)                                                    |
| Não exibidos        | Saldo, hora extra, banco de horas, adicional, jornada esperada, atraso — **nenhum cálculo**, nem no servidor nem no cliente                                                                                                            |
| Vazio               | "Nenhuma marcação para o filtro", sem revelar existência fora do escopo                                                                                                                                                                |
| Carregando          | Indicação clara                                                                                                                                                                                                                        |
| 401                 | §4.2                                                                                                                                                                                                                                   |
| 403                 | Mensagem neutra                                                                                                                                                                                                                        |
| 404 anti-enumeração | "Não encontrado"                                                                                                                                                                                                                       |

Três características do domínio que a tela **precisa** expor, em vez de
esconder (ADR 0008 decisão 5):

1. **O evento original nunca é alterado.** A tela mostra original **e**
   efetivo como coisas distintas, não substitui um pelo outro.
2. **Não há edição nem exclusão.** A única correção é o ajuste. Não pode
   existir botão "editar" ou "excluir" — não existe rota.
3. **A anulação é terminal.** Evento anulado não aceita novo ajuste; a API
   responde 409, e a tela precisa comunicar isso como regra, não como erro.

Os quatro tipos aprovados são `entrada`, `saida`, `inicio_pausa`, `fim_pausa`
— catálogo fechado. O ajuste **não aceita texto livre**: só motivo codificado.

Restrições da API que moldam a tela:

- **O `vinculoId` chega por navegação, não por digitação.** Como não existe
  busca de vínculo nem `GET` de vínculo por id (§4.5), a entrada natural em
  Ponto é a partir do vínculo já aberto em Colaboradores. Uma tela de Ponto
  que peça o `vinculoId` digitado é inoperável na prática para quem não tem
  o identificador em mãos — e resolver isso buscando o nome em Pessoas é
  **proibido** (spec §3.3). Consequência: **Ponto é acessível a partir do
  vínculo**, e a listagem geral `GET /v1/pontos` serve para filtro por
  competência dentro desse contexto.
- **Toda consulta de ponto é auditada** (`ponto.consultado`). A tela deve
  deixar claro ao operador que consultar deixa rastro — e, por isso, não deve
  disparar consultas especulativas, em segundo plano ou por prefetch.
- Registrar marcação e registrar ajuste respondem **201**.
- Não existe `GET` de ajuste por id — ajustes só existem sob um evento.

### 4.7 Auditoria

**Esta tela depende da decisão bloqueante DB-3 (§10) e não deve ser
construída sem ela.**

| Item                | Definição                                                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Papel autorizado    | `admin_tecnico`, `auditor`, `dpo` — leitura de `access_log`, **sem escopo de empresa**: é leitura global no avaliador atual, e o servidor **não** aplica filtro de empresa (o parâmetro `companyId` é apenas filtro opcional do cliente)                          |
| Endpoint existente  | `GET /v1/audit/events` (`page`, `pageSize`, `occurredFrom`, `occurredTo`, `actorUserId`, `action`, `resource`, `companyId`), `GET /v1/audit/events/:eventId`                                                                                                      |
| Dados devolvidos    | **A entidade `AuditEvent` inteira, sem projeção**: `occurredAt`, `actorType`, `actorUserId`, `actorSystemId`, `actorRole`, `companyId`, `unitId`, `teamId`, `action`, `resource`, `resourceId`, **`ip`**, **`userAgent`**, `result`, `requestId`, `correlationId` |
| Não exibidos        | Qualquer enriquecimento por junção com outros módulos — em especial **resolver `actorUserId` ou `resourceId` para nome de pessoa**, o que reconstruiria dado pessoal que a trilha deliberadamente guarda como identificador                                       |
| Vazio               | "Nenhum evento para o filtro"                                                                                                                                                                                                                                     |
| Carregando          | Indicação clara                                                                                                                                                                                                                                                   |
| 401                 | §4.2                                                                                                                                                                                                                                                              |
| 403                 | Mensagem neutra                                                                                                                                                                                                                                                   |
| 404 anti-enumeração | "Não encontrado"                                                                                                                                                                                                                                                  |

Atenção ao envelope: esta é a **única** listagem da API com chaves em inglês
(`items`, `page`, `pageSize`, `total`), enquanto todo o resto usa `itens`,
`pagina`, `tamanhoPagina`, `total`.

**Por que é bloqueante.** Três razões independentes, todas verificadas:

1. A especificação aprovada colocou a trilha de auditoria **fora do V1**,
   remetendo a decisão a DP-W-05 — que é exatamente o que este documento
   propõe. Incluir a tela é, portanto, legítimo, mas é **mudança de escopo
   que exige aprovação explícita**, não consequência automática.
2. A **Emenda 1 da ADR 0005** registra que `auditor` e `dpo` são
   **capacidade técnica não validada por uso real** — não há usuário interno
   com esses papéis, e o escopo de acesso deles **precisa ser deliberado
   explicitamente antes do primeiro provisionamento**. Hoje o avaliador lhes
   dá leitura **global** da trilha, sem fronteira de empresa. Construir a tela
   antes dessa deliberação materializaria em interface um alcance que a
   própria ADR marcou como pendente.
3. O endpoint devolve a entidade **sem projeção**, incluindo `ip` e
   `userAgent` de cada ator. É a **maior superfície de dado pessoal exposta
   pela API** — hoje alcançável apenas por quem sabe montar a requisição.
   Uma tela transforma esse alcance em consulta rotineira de operador. Isso
   merece decisão consciente do produto **e do DPO**, não decorrência de um
   item de menu.

Consultar a trilha também é ação auditada (`audit_log_read`) — a tela precisa
deixar claro ao operador que **a própria consulta fica registrada**. Se a
consulta de auditoria falhar ao ser auditada, a API responde erro em vez de
devolver dado: comportamento correto, e a tela deve tratá-lo como erro
genérico, sem sugerir contorno.

## 5. Comportamento visual da rotação de CSRF

Contrato implementado (ADR 0009 decisões 3 e 4; commit `c5129ff`): cada
chamada a `GET /v1/auth/csrf` **emite um token novo e invalida o anterior**
da mesma sessão. Não é leitura.

### 5.1 Ciclo de vida proposto

| Momento                                   | Comportamento                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Login bem-sucedido                        | Guardar o `csrfToken` devolvido pelo próprio login. **Não** chamar `/auth/csrf` em seguida |
| Carga inicial ou _reload_ com sessão viva | Chamar `GET /v1/auth/csrf` **uma vez** e guardar o token em memória                        |
| Navegação interna (sem recarregar)        | Reutilizar o token em memória. **Não** rotacionar por tela, por rota ou por mutação        |
| Falha de CSRF (`403`) numa mutação        | Ver §5.2                                                                                   |
| `401` em qualquer chamada                 | Descartar o token junto com todo o estado (§4.2)                                           |
| Logout                                    | Enviar o header CSRF (o logout exige) e descartar o token                                  |

**Rotacionar o mínimo necessário é requisito, não otimização:** como cada
chamada invalida o token anterior, rotacionar sem necessidade transforma o
próprio painel na causa de falhas de CSRF em outras abas.

### 5.2 Falha de CSRF — comportamento obrigatório

Ao receber `403` numa mutação:

1. **Informar o usuário** que a ação não foi concluída porque a credencial de
   segurança do formulário expirou — em linguagem neutra, sem detalhe técnico
   e **sem** revelar qual permissão ou token falhou.
2. **Obter um token novo** com `GET /v1/auth/csrf`.
3. **Nunca reenviar automaticamente** a mutação já despachada. O reenvio é
   sempre ato explícito do usuário.
4. Se a nova tentativa também falhar com `403`, tratar como acesso negado
   (pode não ser CSRF, e sim autorização) e **não** entrar em laço de
   retentativa.

O item 3 é o mais importante e o mais fácil de violar por conveniência: a
requisição original **pode ter sido processada** antes do 403, ou pode não
ter sido — a interface não tem como saber. Reenviar arrisca duplicar a
operação (registrar um ponto duas vezes, efetivar uma movimentação duas
vezes), o que é pior do que pedir nova tentativa ao usuário
(ADR 0009 decisão 4).

### 5.3 Concorrência entre abas

Consequência aceita do desenho, **não defeito a contornar**: duas abas na
mesma sessão competem pelo mesmo token. Se a aba A rotaciona, o token da
aba B fica inválido e a próxima mutação dela falha com 403.

Proposta de tratamento: a aba B segue o fluxo de §5.2 — informa, busca token
novo, e aguarda ação explícita. **Nenhum mecanismo de sincronização entre
abas** (`BroadcastChannel`, `storage` event, `SharedWorker`) é proposto: o
primeiro exigiria compartilhar o token entre contextos, o segundo exigiria
gravá-lo em armazenamento — ambos proibidos por ADR 0009 e spec §3.1.

### 5.4 Armazenamento — inegociável

- O token vive **apenas em memória** do processo da aba.
- **Nunca** em `localStorage`, `sessionStorage`, cookie, IndexedDB, URL,
  query string, atributo de DOM, título de página ou log de console.
- **Nunca** exibido na interface, nem parcialmente, nem mascarado.
- O cookie de sessão é `HttpOnly`: o cliente **nunca** o lê, escreve ou copia.

## 6. Dashboard com indicadores — fora da V1

**Permanece fora**, e a proposta é mantê-lo fora, enquanto **ambos** não
existirem:

1. um **endpoint de agregação** na API — hoje não existe, e criá-lo é
   alteração de backend com decisão própria;
2. uma **fórmula aprovada** pelo produto para cada indicador — o que se conta,
   em que recorte, com que fronteira de empresa e em que momento.

A tela inicial proposta (§8.1) é uma **lista de módulos**, não um dashboard:
sem indicador, contagem, gráfico, tendência ou métrica agregada.

Registrado explicitamente: mesmo que uma listagem paginada devolva um campo
de total, **usá-lo como indicador na tela inicial é decisão de produto**, não
conveniência de interface — porque um total filtrado por escopo é um número
que significa coisas diferentes para papéis diferentes, e exibi-lo sem
fórmula aprovada seria inventar semântica. **DP-W-06 permanece pendente.**

## 7. Gestão de usuários — sem tela de listagem

A API tem `POST /v1/users`, `PATCH /v1/users/:id/role`,
`POST /v1/users/:id/disable` e `GET /v1/users/me`. **Não existe rota que
liste usuários** — verificado nos controllers.

Portanto, a proposta é: **nenhuma tela de gestão de acessos com listagem no
V1.** Uma tela que exija digitar um identificador que não se tem como
descobrir é de utilidade duvidosa, e construir a listagem exigiria endpoint
novo — alteração de backend, fora desta fase.

O que a proposta **mantém** é a tela **"Minha conta"**, que não depende de
listagem:

| Item                | Definição                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Papel autorizado    | Qualquer sessão válida (os oito papéis)                                                                                                 |
| Endpoint existente  | `GET /v1/users/me`, `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/:id`, `POST /v1/auth/logout`                                     |
| Dados permitidos    | E-mail, papel e situação da própria conta; lista das próprias sessões ativas com data de criação, último acesso, expiração, IP e agente |
| Não exibidos        | Hash de senha; token de sessão; token CSRF; qualquer dado de conta de terceiro                                                          |
| Vazio               | Não se aplica (sempre há ao menos a sessão corrente)                                                                                    |
| Carregando          | Indicação clara                                                                                                                         |
| 401                 | §4.2                                                                                                                                    |
| 403                 | Revogação de sessão exige CSRF — tratar por §5.2                                                                                        |
| 404 anti-enumeração | Revogar sessão inexistente responde "não encontrado", sem confirmar existência                                                          |

A revogação da **própria sessão corrente** derruba o acesso imediatamente —
a tela precisa avisar antes, não depois.

## 8. Wireframes textuais

Estrutura e hierarquia apenas. **Sem** identidade visual, cor, tipografia,
espaçamento ou componente — DP-W-03 e DP-W-04 seguem pendentes.

### 8.1 Estrutura persistente e tela inicial

```
┌───────────────────────────────────────────────────────────────┐
│ Evolli RH                       usuario@escritorio · rh  [Sair]│
├──────────────┬────────────────────────────────────────────────┤
│ Início       │  Módulos disponíveis                           │
│ Organização  │                                                │
│ Colaboradores│  ┌──────────────────────────────────────────┐  │
│ Ponto        │  │ Organização            [disponível]      │  │
│ Minha conta  │  │ Empresa, unidade, departamento, área,    │  │
│              │  │ equipe, cargo e centro de custo.         │  │
│              │  └──────────────────────────────────────────┘  │
│              │  ┌──────────────────────────────────────────┐  │
│              │  │ Colaboradores          [disponível]      │  │
│              │  │ Cadastro, vínculos, alocações e          │  │
│              │  │ movimentações.                           │  │
│              │  └──────────────────────────────────────────┘  │
│              │  ┌──────────────────────────────────────────┐  │
│              │  │ Ponto                  [disponível]      │  │
│              │  │ Registro manual e consulta de marcações. │  │
│              │  └──────────────────────────────────────────┘  │
│              │                                                │
│              │  Sem indicadores nesta versão.                 │
└──────────────┴────────────────────────────────────────────────┘
```

Para `gestor` e `colaborador`, a mesma estrutura, com o corpo dizendo:
"Nenhum módulo está disponível para o seu papel." — e o menu contendo apenas
Início e Minha conta.

### 8.2 Listagem organizacional (exemplo: departamentos)

```
Organização › Departamentos                        [Novo departamento]
                                                    (ausente para dp)
┌────────────────────────────────────────────────────────────────┐
│ Empresa: [ Escritório ▾ ]     Situação: [ Ativos ▾ ]           │
├──────────────┬───────────┬──────────┬──────────────────────────┤
│ Nome         │ Código    │ Situação │ Ações                    │
├──────────────┼───────────┼──────────┼──────────────────────────┤
│ Financeiro   │ FIN       │ Ativo    │ Editar · Inativar        │
│ Operações    │ OPS       │ Ativo    │ Editar · Inativar        │
└──────────────┴───────────┴──────────┴──────────────────────────┘

Vazio:       "Nenhum departamento no seu escopo."
Carregando:  "Carregando departamentos…" (lista anterior não fica visível)
403:         "Você não tem acesso a este recurso."
404:         "Não encontrado."
Conflito ao inativar:
             "Não é possível inativar: existem elementos ativos
              vinculados a este departamento."
             (a interface NÃO descobre nem lista quais são)
```

### 8.3 Consulta de ponto

Alcançada a partir de um vínculo já aberto em Colaboradores — o `vinculoId`
vem por navegação, nunca digitado (§4.6).

```
Colaboradores › Ana Souza › Vínculo 00123 (Escritório) › Ponto
┌────────────────────────────────────────────────────────────────┐
│ Competência: [ 2026-08 ]   Tipo: [ Todos ▾ ]          [Buscar] │
└────────────────────────────────────────────────────────────────┘
                                                  [Registrar marcação]
┌───────────────┬──────────┬───────────────┬─────────────────────┐
│ Momento       │ Tipo     │ Efetivo       │                     │
│ (original)    │          │ (com ajustes) │                     │
├───────────────┼──────────┼───────────────┼─────────────────────┤
│ 12/08 08:00   │ entrada  │ 12/08 08:05   │ Ver ajustes (1)     │
│ 12/08 12:00   │ saida    │ 12/08 12:00   │ Ver ajustes (0)     │
│ 12/08 13:00   │ entrada  │ — (anulado)   │ Ver ajustes (1)     │
└───────────────┴──────────┴───────────────┴─────────────────────┘

O nome e a matrícula no rastro de navegação vêm do contexto já aberto
em Colaboradores — NÃO de uma consulta de Pessoas feita pela tela de
Ponto para enriquecer a listagem, que é proibida (spec §3.3).
As linhas da tabela identificam por evento, não por pessoa.

Sem botão editar. Sem botão excluir. Sem total, saldo ou hora extra.
Sem busca textual e sem ordenação por coluna — a API não suporta.
Evento anulado: correção recusada (409) — comunicada como regra.
Cada busca aqui grava um evento de auditoria (ponto.consultado).
```

### 8.4 Falha de CSRF durante uma mutação

```
┌────────────────────────────────────────────────────────────────┐
│ A ação não foi concluída.                                      │
│                                                                │
│ A credencial de segurança do formulário expirou. Isso pode     │
│ acontecer se você usou o sistema em outra aba.                 │
│                                                                │
│ Verifique se a operação foi registrada antes de tentar de      │
│ novo.                                                          │
│                                                                │
│                                   [Fechar]  [Tentar novamente] │
└────────────────────────────────────────────────────────────────┘

"Tentar novamente" reenvia SOMENTE por clique explícito do usuário.
Nenhum reenvio automático, em nenhuma hipótese.
Token novo já foi obtido em segundo plano antes de habilitar o botão.
```

### 8.5 Sessão expirada

```
┌────────────────────────────────────────────────────────────────┐
│ Sua sessão foi encerrada.                                      │
│                                                                │
│ Entre novamente para continuar.                                │
│                                                                │
│ Se você estava salvando algo, verifique o resultado após       │
│ entrar.                                                        │
│                                                                │
│ Referência: 3f9c1a7e-…                          [Ir para entrar]│
└────────────────────────────────────────────────────────────────┘

Não informa se expirou, foi revogada ou se a conta foi desativada.
Todo o estado em memória — inclusive o token CSRF — já foi descartado.
```

## 9. Acessibilidade e navegadores — critérios propostos

**Proposta, não conformidade declarada.** Nenhuma auditoria foi feita e
nenhum nível é atingido por este documento. Encaminhamento de **DP-W-07**.

### 9.1 Critérios de acessibilidade propostos

| Critério             | Proposta                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Operação por teclado | Toda ação alcançável e executável por teclado, em ordem de foco previsível, sem armadilha de foco  |
| Foco visível         | Indicador de foco sempre perceptível, nunca removido por estilo                                    |
| Rótulos              | Todo campo com rótulo programaticamente associado; nenhum campo identificado só por posição ou cor |
| Erro de formulário   | Associado ao campo, anunciado a leitor de tela, com texto — nunca só cor ou ícone                  |
| Contraste            | Alvo mínimo a fixar junto com a identidade visual (DP-W-04), não antes dela                        |
| Estados assíncronos  | Carregando, vazio e erro anunciados a tecnologia assistiva, não só visualmente                     |
| Estrutura            | Hierarquia de cabeçalhos coerente e regiões nomeadas para navegação por marcos                     |
| Movimento            | Nenhuma animação essencial à compreensão; respeitar preferência de redução de movimento            |

**Nível-alvo formal (ex.: WCAG 2.2 AA) é decisão de produto — DB-4 (§10).**
Os critérios acima são compatíveis com esse alvo, mas afirmá-lo exige
auditoria que não foi feita.

### 9.2 Navegadores propostos

Proposta: **duas versões estáveis mais recentes** de Chrome, Edge e Firefox
no desktop, por ser painel administrativo interno de uso em estação de
trabalho.

- **Sem suporte a navegador legado** sem decisão explícita.
- **Sem otimização para dispositivo móvel** nesta V1 — o layout não deve
  quebrar em tela estreita, mas fluxo móvel não é objetivo.
- A lista real precisa ser confirmada contra o parque de máquinas do
  escritório, que este documento não conhece — **DB-5 (§10)**.

## 10. Decisões bloqueantes

Sem estas, a fase Implementar **não deve** começar.

| ID       | Decisão                                                                                                                                                      | Quem decide             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| **DB-1** | Aprovar (ou emendar) o **escopo de módulos** do V1 visual: Organização, Colaboradores, Ponto e Minha conta                                                   | Produto                 |
| **DB-2** | **Recuperação de senha entra no V1 visual?** A API existe; incluir amplia superfície pública da interface                                                    | Produto, Segurança      |
| **DB-3** | **Tela de auditoria entra no V1?** Se sim, exige antes a deliberação de escopo de `auditor`/`dpo` pendente na Emenda 1 da ADR 0005 — hoje a leitura é global | Produto, Segurança, DPO |
| **DB-4** | **Nível-alvo de acessibilidade** (§9.1)                                                                                                                      | Produto, Design         |
| **DB-5** | **Lista real de navegadores suportados** (§9.2)                                                                                                              | Produto, TI             |
| **DB-6** | **Design system e identidade visual** (DP-W-03, DP-W-04) — sem eles não há como construir tela final, apenas estrutura                                       | Produto, Design         |
| **DB-7** | **Provedor, domínio e ferramenta de proxy reverso** (DP-W-02, infraestrutura) — pré-condição da mesma origem, sem a qual o painel não funciona no navegador  | TI/Infraestrutura       |

**Observação factual para DB-7, registrada sem propor mudança.** O documento
OpenAPI é servido em `GET /docs` e `GET /docs-json`, **sem guarda de sessão e
fora do versionamento `/v1`**. Como a Baseline V1 coloca painel e API na mesma
origem, essas duas rotas passariam a responder no mesmo domínio do painel. Se
esse domínio for alcançável além da rede interna, o desenho do proxy precisa
tratar esse caso deliberadamente. Isto é levantamento de fato, não proposta:
alterar exposição de `/docs` é decisão de backend/infraestrutura, fora desta
fase.

## 11. Decisões postergáveis

Podem ser resolvidas durante ou depois da fase Implementar, sem bloqueá-la.

| ID       | Decisão                                                                             | Observação                                                                 |
| -------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **DP-1** | Indicadores na tela inicial (DP-W-06)                                               | Depende de endpoint de agregação **e** fórmula aprovada (§6)               |
| **DP-2** | Tela de gestão de usuários com listagem                                             | Depende de endpoint de listagem inexistente (§7)                           |
| **DP-3** | Telemetria e observabilidade de frontend (DP-W-09)                                  | Exige política de redação antes de qualquer dado real                      |
| **DP-4** | Estratégia de testes visuais e e2e do painel (DP-W-10)                              | Não bloqueia o desenho; bloqueia o critério de aceite                      |
| **DP-5** | Cliente tipado a partir do OpenAPI e esquema de autenticação no documento (DP-W-11) | O painel pode começar com tipos escritos à mão                             |
| **DP-6** | Correlacionar `vinculoId` a nome/matrícula na tela de Ponto                         | É **decisão de produto** sobre minimização, não conveniência (spec §3.3)   |
| **DP-7** | Exibir contagem de dependentes ao recusar inativação                                | Exigiria endpoint novo e reabriria a decisão de não identificar dependente |
| **DP-8** | Suporte a dispositivo móvel                                                         | Fora do objetivo do V1 (§9.2)                                              |

## 12. O que este documento não autoriza

- **Não cria `apps/web`**, projeto React, Vite, componente, dependência ou
  configuração de build.
- **Não cria** endpoint, migration, schema, CI, proxy, CORS ou qualquer
  infraestrutura.
- **Não altera** nenhuma ADR, baseline ou especificação aprovada.
- **Não concede** acesso de painel a papel sem autorização correspondente já
  aprovada na API — a tabela do §2 é leitura do código, não concessão.
- **Não declara** conformidade de acessibilidade, LGPD, segurança ou
  hospedagem.
- **Não libera dado real.** MFA continua obrigatório antes de qualquer piloto
  com dado real ou produção (ADR 0003 decisão 3, inalterada), e as validações
  de DPO/jurídico e retenção continuam pré-requisito.
- **Não ativa multitenancy.** `company_id` segue como fronteira organizacional
  e de autorização (ADR 0005 decisão 3; ADR 0010 decisão 3). Nenhuma tela
  proposta introduz noção de cliente externo.
