# ADR 0005 — Escopo interno e evolução multitenant

- Status: aceito (com Emenda 1, 2026-08-06 — ver seção "Emenda 1" ao final)
- Data: 2026-08-06
- Relacionado: [docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md), [ADR 0002](0002-papeis-postgres-e-migrations.md), [ADR 0003](0003-identidade-sessao-e-autorizacao.md), [ADR 0004](0004-auditoria-formal-e-integridade.md), [decisão aprovada — escopo de autorização interna](../decisions/etapa1-escopo-autorizacao-interna-pendente.md)

## Contexto

A Etapa 1 introduz a estrutura organizacional que todos os módulos
seguintes (Colaboradores, Portal do Gestor, Documentos, Ponto, Dashboard)
irão referenciar. Antes de especificá-la, era necessário fechar uma
decisão que, se errada, é cara nos dois sentidos: construir multitenancy
cedo demais custa complexidade permanente; construí-la tarde demais custa
migration retroativa sobre dado real.

O produto definiu o cenário de uso: **o Evolli RH será utilizado
inicialmente apenas pelo escritório**. A comercialização para múltiplas
empresas clientes é evolução futura desejada, **não requisito de
implementação agora**.

A fundação já entregue (Etapa 0) é coerente com esse cenário: a ADR 0003
estabeleceu `company_id`/`unit_id`/`team_id` em `access_user` como escopo
de autorização, sem nenhuma camada acima de empresa, e o avaliador
RBAC/ABAC (`rbac.evaluator.ts`) trata a empresa como maior granularidade
de escopo. Não existe hoje nenhuma noção de cliente comercial no schema,
na autorização ou na trilha de auditoria.

Uma versão anterior da especificação da Etapa 1 assumia multitenancy
técnica (entidade `tenant`, coluna `tenant_id` desnormalizada, Row-Level
Security, backfill e migration retroativa sobre `access_user` e
`audit_event`). Esta ADR substitui aquela direção.

## Decisão

### 1. O deployment atual é single-tenant, para uso interno do escritório

A implantação corrente atende exclusivamente o escritório. **"Single-tenant"
descreve a implantação atual, não uma limitação de produto** — não é uma
declaração de que o Evolli RH nunca será comercializado, nem um
impedimento arquitetural a isso (ver decisão 5 e "Gatilho de
reavaliação").

### 2. Nenhuma multitenancy técnica nesta fatia

Não são criados, nesta fatia: entidade `tenant`, coluna `tenant_id`,
políticas de Row-Level Security multitenant, plano de backfill ou
migration retroativa sobre tabelas já mergeadas.

Consequência direta: `access_user` e `audit_event` **não são alterados**
para acomodar multitenancy.

### 3. `company_id` é o maior limite organizacional e de autorização

A empresa é a raiz do escopo. Abaixo dela existem unidade,
área/departamento, equipe, cargo/função e centro de custo opcional.

Isso preserva — não substitui — o modelo de escopo já implementado na
Fatia 3: o avaliador RBAC/ABAC continua com a empresa como fronteira, sem
introduzir um segundo modelo de escopo paralelo.

### 4. Acesso amplo interno é explícito, mínimo e auditado

`admin_tecnico`, `auditor` e `dpo` **só podem acessar empresas para as
quais tenham escopo autorizado**. Quando um acesso amplo interno for
realmente necessário, ele deve ser:

- **explícito** — concedido deliberadamente, nunca herdado por ser "o
  papel técnico" nem implícito no código;
- **mínimo** — restrito ao conjunto de empresas efetivamente necessário;
- **auditado** — cada uso gera evento na trilha formal (ADR 0004).

**Esta decisão altera comportamento hoje implementado e mergeado.** Em
`rbac.evaluator.ts`, `evaluateAccessLog` concede leitura da trilha a
`admin_tecnico`/`auditor`/`dpo` sem qualquer checagem de empresa, e
`evaluateOtherAccount` trata `admin_tecnico` como "escopo: instância
inteira". O ajuste é trabalho da fase Implementar da Fatia 1 — nenhuma
alteração de código foi feita ao registrar esta ADR. A forma exata de
representar o escopo autorizado desses papéis permanece decisão pendente
(spec §12, DP-7) e precisa ser resolvida **antes** da implementação, por
ser mudança de autorização em produção.

### 5. A comercialização futura exige etapa própria, não antecipação

Quando a comercialização for aprovada, ela exige uma etapa dedicada, com:
ADR específica de multitenancy; modelagem de tenant; migration aditiva
(nunca destrutiva); plano de backfill; testes de isolamento com prova
negativa real; revisão de segurança e LGPD específica; e reavaliação do
escopo dos papéis diante da nova fronteira.

Nada disso é iniciado agora.

### 6. A Etapa 1 atual é a Fatia 1 — Núcleo Organizacional Interno

A entidade de colaborador e seus vínculos permanecem no escopo da Etapa 1
do roadmap, porém em **fatia posterior**. `docs/ROADMAP.md` não é
alterado: o fatiamento interno da etapa é detalhamento de execução, não
renumeração de roadmap.

### 7. O PRD do Notion permanece fonte complementar obrigatória

O PRD não estar versionado no repositório **não reduz sua autoridade** —
apenas impede a confrontação automática no checkout. Nenhum requisito é
inventado na sua ausência: onde o PRD decidiria, a questão vira decisão
pendente explícita. A rastreabilidade requisito ↔ spec ↔ teste é pendência
da próxima fatia funcional, quando requisitos de negócio passarem a ser
derivados diretamente do PRD.

### 8. MFA TOTP: decisão inalterada

MFA continua adiado **apenas da demonstração inicial** e **obrigatório
antes de qualquer piloto com dados reais ou produção** (ADR 0003,
decisão 3). Esta ADR não altera nem enfraquece essa condição.

## Alternativas descartadas

| Alternativa                                                                      | Por que foi descartada                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multitenancy completa já nesta fatia (`tenant` + `tenant_id` + RLS + backfill)   | Introduz complexidade permanente — em toda query, em toda migration futura, em todo teste — por um requisito comercial que ainda não existe. Contradiz o princípio de dependência mínima seguido nas ADRs 0001–0004 ("não introduzir infraestrutura antes de necessidade real comprovada"). Descartada. |
| `tenant_id` desnormalizado "só por precaução", sem enforcement                   | Custo de manutenção e risco de inconsistência (um campo que existe para prevenir vazamento vira ele mesmo fonte de divergência) sem entregar a garantia que justificaria o custo. Meia-medida pior que qualquer um dos extremos. Descartada.                                                            |
| Schema ou banco por cliente já agora                                             | Multiplicaria migrations e custo operacional para um único ocupante real. Desproporcional. Descartada.                                                                                                                                                                                                  |
| Manter `admin_tecnico`/`auditor`/`dpo` com acesso irrestrito a todas as empresas | Acesso amplo implícito contraria menor privilégio e negação por padrão (ADR 0002/0003) e torna a trilha de auditoria menos significativa — se todo papel técnico vê tudo por padrão, o registro de acesso perde poder de prestação de contas. Descartada em favor da decisão 4.                         |
| Declarar a análise de LGPD concluída para uso comercial futuro                   | A base legal, a finalidade e a retenção de dado de cliente terceiro são distintas das de dado interno do escritório. Declarar conformidade agora seria afirmar o que não foi analisado. Descartada — ver "Limites".                                                                                     |

## Consequências

- A implementação da Fatia 1 fica substancialmente mais simples: sem
  discriminador de tenant, sem RLS, sem backfill, sem migration retroativa
  em tabelas já em uso.
- O modelo de escopo permanece **um só** (empresa), já implementado e
  testado na Fatia 3 — não há dois mecanismos de isolamento convivendo.
- A decisão 4 **exige alterar autorização já mergeada** durante a
  implementação da Fatia 1, com risco real de regressão sobre o bootstrap
  administrativo e sobre a leitura da trilha de auditoria da Fatia 4.
  Mitigação exigida: decisão prévia de DP-7 e teste de regressão explícito
  (spec §11).
- A comercialização futura custará migration aditiva e backfill sobre dado
  já existente. **Risco aceito conscientemente**: o custo de adiar é
  pontual e conhecido; o custo de antecipar seria permanente e diluído em
  todo o sistema.
- Enquanto o deployment for interno, "acesso entre clientes" não é um vetor
  existente — o que reduz a superfície de risco desta fatia, mas **não**
  autoriza relaxar o escopo por empresa (decisão 4 continua valendo dentro
  do deployment interno).
- Nenhuma tabela existente é tocada por esta decisão; a Fatia 1 só
  acrescenta tabelas organizacionais novas e estende enums de auditoria de
  forma aditiva.

## Limites

- Esta ADR **não declara conformidade LGPD concluída**. Ela registra que a
  Fatia 1 não introduz dado pessoal de colaborador (spec §7), com as bordas
  conhecidas em aberto (CNPJ de MEI, nome de entidade contendo nome de
  pessoa). A **futura multitenancy exigirá revisão de LGPD específica** —
  dado de cliente terceiro tem base legal, finalidade e retenção próprias,
  e nada dessa análise está feito.
- Não define a modelagem organizacional fina (departamento por empresa ou
  por unidade; equipe sob departamento ou unidade; catálogo de cargos
  compartilhado ou não) — permanecem decisões pendentes da spec, a resolver
  com produto/RH, nunca por suposição.
- Não define a forma técnica do escopo autorizado de
  `admin_tecnico`/`auditor`/`dpo` (DP-7) — só o princípio (explícito,
  mínimo, auditado).
- Não altera `docs/ROADMAP.md` nem renumera etapas.
- Não introduz colaborador, folha, ponto, benefício, nem qualquer dado
  trabalhista, legal, fiscal ou financeiro.

## Gatilho de reavaliação

Esta decisão deve ser reaberta — com ADR nova, não com emenda informal —
quando **qualquer** um destes ocorrer:

1. Decisão comercial de vender o Evolli RH para empresa cliente externa ao
   escritório.
2. Necessidade de operar, no mesmo deployment, dados de organizações com
   fronteira de confiança distinta (ex.: cliente que não pode ver dado de
   outro cliente, mesmo que ambos sejam atendidos pelo escritório).
3. Exigência contratual, regulatória ou de auditoria externa de isolamento
   de dados por cliente.
4. Constatação de que o modelo de escopo por empresa deixou de ser
   suficiente para atender uma necessidade real de segregação — observada,
   não hipotética.

Até que um desses ocorra, a arquitetura permanece single-tenant por decisão
deliberada, e não por omissão.

## Responsabilidades

- **Time de desenvolvimento (código):** implementar a Fatia 1 sem
  introduzir `tenant_id`, RLS multitenant ou migration retroativa; aplicar
  a decisão 4 no avaliador RBAC/ABAC com teste de regressão explícito;
  manter a extensão de `AuthorizationResource` e `AuditAction` sempre
  aditiva.
- **Produto:** resolver as decisões pendentes de modelagem e a forma do
  escopo autorizado (DP-7) antes do início da implementação; acionar o
  gatilho de reavaliação quando a comercialização entrar em pauta.
- **TI/Segurança:** revisar a mudança de escopo dos papéis técnicos
  (decisão 4) antes do merge, por tocar autorização em produção.
- **DPO/jurídico:** confirmar que a Fatia 1 não introduz dado pessoal de
  colaborador, incluindo a borda de CNPJ; conduzir revisão específica de
  LGPD quando a multitenancy comercial for aprovada.
- **Revisor de PR:** bloquear merge que introduza `tenant_id`, RLS
  multitenant ou backfill nesta fatia; que conceda acesso amplo implícito a
  papel técnico; ou que declare conformidade LGPD para uso comercial sem a
  revisão específica.

---

## Emenda 1 (2026-08-06)

**Esta seção é um aditivo — não reescreve nem apaga a decisão original
acima.** A decisão 4 original ("Acesso amplo interno é explícito, mínimo e
auditado", incluindo a afirmação de que `admin_tecnico`, `auditor` e `dpo`
"só podem acessar empresas para as quais tenham escopo autorizado")
permanece registrada tal como foi aceita. Esta emenda concede uma
**exceção temporária, explícita e com prazo**, para o `admin_tecnico`, no
contexto de uso exclusivamente interno.

### Contexto da emenda

O levantamento de fatos em
[docs/decisions/etapa1-escopo-autorizacao-interna-pendente.md](../decisions/etapa1-escopo-autorizacao-interna-pendente.md)
mostrou que a decisão 4 original, aplicada literalmente, contradiz o
comportamento hoje implementado e necessário para o próprio bootstrap do
sistema: o primeiro `admin_tecnico` é criado sem empresa atribuída
(`companyId: null`) e, sem escopo global, não conseguiria criar a primeira
empresa nem atribuir escopo a ninguém. O produto e a segurança avaliaram
três alternativas (A, B e C, detalhadas no documento de decisão) e
aprovaram a Alternativa A para o momento atual, com condições.

### Decisão da emenda

1. **`admin_tecnico` mantém acesso global ao ambiente interno**, como
   exceção temporária à decisão 4 original, enquanto o uso for
   exclusivamente interno ao escritório.
2. **Condições obrigatórias desta exceção** (detalhadas no documento de
   decisão, seção "Decisão aprovada"):
   - ao menos duas contas administrativas nominativas;
   - contas `admin_tecnico` separadas de contas de uso rotineiro, usadas
     só para administração excepcional;
   - toda ação relevante continua auditada (ADR 0004, inalterado);
   - reavaliação obrigatória em até 90 dias, ou antes da comercialização
     para terceiros — o que ocorrer primeiro (ver "Gatilho de
     reavaliação", atualizado abaixo).
3. **`auditor` e `dpo` não são cobertos por esta exceção.** Seu
   comportamento de leitura ampla da trilha de auditoria, hoje presente no
   código (`evaluateAccessLog`), permanece como **capacidade técnica não
   validada por uso real** — não há usuário interno com esses papéis, e
   nenhuma decisão foi tomada sobre seu escopo. Antes do primeiro
   provisionamento de `auditor` ou `dpo`, o escopo de acesso deles precisa
   ser deliberado explicitamente, em ciclo de decisão próprio.
4. **A evolução comercial multitenant continua inteiramente fora de
   escopo** desta emenda e da ADR original — nenhuma das decisões 1, 2, 5
   e 6 da seção "Decisão" acima é alterada.

### Diferenciação explícita (para não confundir os três temas)

| Tema                                                | Status após esta emenda                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Acesso global interno temporário de `admin_tecnico` | Aprovado, com condições e prazo (itens 1–2 acima)                                     |
| Acesso futuro de `auditor` e `dpo`                  | **Não aprovado, não decidido** — pendente de deliberação futura antes do primeiro uso |
| Evolução comercial multitenant                      | **Fora de escopo**, inalterada — decisão 5 da ADR original permanece integral         |

### Gatilho de reavaliação (específico desta emenda)

Esta exceção deve ser reavaliada — obrigatoriamente, não só "quando
conveniente" — no que ocorrer primeiro:

1. **90 dias corridos** a partir de 2026-08-06 (ou seja, até
   2026-11-04); ou
2. **Início de qualquer processo de comercialização para terceiros**,
   mesmo que preliminar.

O gatilho de reavaliação geral da ADR original (seção "Gatilho de
reavaliação" acima) continua valendo, sem alteração, para a decisão de
multitenancy como um todo.

### O que esta emenda não faz

- Não declara MFA implementado — continua adiado só da demonstração
  inicial e obrigatório antes de piloto com dados reais ou produção
  (ADR 0003, decisão 3, inalterada).
- Não decide o escopo de `auditor`/`dpo`.
- Não introduz `tenant_id`, RLS multitenant, backfill ou qualquer
  artefato de multitenancy técnica.
- Não altera código, testes, schema, migration, endpoint, dependência ou
  infraestrutura — é registro de decisão; a implementação correspondente é
  trabalho posterior, com critério de aceite próprio.
- Não torna a exceção permanente por omissão — o prazo do item anterior é
  vinculante.
