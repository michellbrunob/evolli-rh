# ADR 0006 — Modelo organizacional interno, Baseline V1

- Status: aceito (com Emenda 1 — nomenclatura — e Emenda 2 — implementação V1, ambas 2026-08-06; ver seções ao final)
- Data: 2026-08-06
- Relacionado: [docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md), [docs/decisions/etapa1-modelagem-organizacional-pendente.md](../decisions/etapa1-modelagem-organizacional-pendente.md), [ADR 0002](0002-papeis-postgres-e-migrations.md), [ADR 0003](0003-identidade-sessao-e-autorizacao.md), [ADR 0004](0004-auditoria-formal-e-integridade.md), [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md)

## Contexto

A [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md) fixou o
cenário de implantação (single-tenant, uso interno do escritório) e o
maior limite de autorização (`company_id`). Ela deliberadamente **não**
fechou a modelagem fina da estrutura organizacional abaixo da empresa —
departamento, área, equipe, cargo e centro de custo — deixando-a como
decisões pendentes da spec da Fatia 1
([docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md)).

Essas decisões foram levantadas, com alternativas objetivas e avaliação
de impacto, em
[docs/decisions/etapa1-modelagem-organizacional-pendente.md](../decisions/etapa1-modelagem-organizacional-pendente.md)
(8 decisões de modelagem D1–D8, mais uma questão transversal QT-1 sobre
vigência). Nenhuma escolha foi feita nesse levantamento — ele apresentou
alternativas e recomendações técnicas, sem decidir por suposição.

O produto avaliou o levantamento e aprovou, em 2026-08-06, um conjunto
único de 9 decisões — **Baseline V1** — que resolve D1–D8 e QT-1. Esta
ADR formaliza essa decisão arquitetural. Ela é **complementar** à
ADR 0005: onde a 0005 trata da fronteira de autorização e do cenário de
implantação, esta trata da forma da estrutura organizacional abaixo
dessa fronteira — as duas questões são relacionadas, mas distintas (ver
"Estrutura organizacional vs. escopo de autorização", abaixo).

## Decisão

A Baseline V1 é aceita como modelo organizacional desta fatia, com as
9 decisões a seguir.

### 1. Departamento e área são entidades distintas

Departamento é o nível organizacional principal, pertencente à empresa
(`company_id`), atravessando unidades. Área é uma subdivisão **opcional**
do departamento — nunca da unidade, nunca da empresa diretamente.

### 2. Departamento e área não são novas fronteiras de autorização nesta fatia

`company_id` permanece como maior limite de autorização (ADR 0005,
decisão 3, inalterada). Unidade e equipe mantêm os escopos organizacionais
já previstos, sem alteração. **`department_id` não é introduzido** em
`AuthorizationSubject`, no avaliador RBAC/ABAC, em `access_user` ou em
`audit_event`, nesta fase.

### 3. Equipe pertence obrigatoriamente a um departamento

Vínculo a uma unidade é opcional. Uma equipe nunca existe sem
departamento; pode, ou não, estar associada a uma unidade específica.

### 4. Nesta fatia existe apenas cargo

Função — entendida como atribuição distinta de posição formal — fica
para a futura vida funcional do colaborador. Nenhuma entidade, campo ou
regra de função é criada agora.

### 5. O catálogo de cargos é por empresa

Cada empresa tem seu próprio catálogo de `job_role`, com código
padronizável (mesmo `code` reutilizável entre catálogos de empresas
diferentes) para viabilizar consolidação futura, sem que isso implique
compartilhamento de linha entre empresas.

### 6. Centro de custo é cadastrado por empresa, sem associação estrutural

`cost_center` nesta fatia é só cadastro — sem associação a unidade,
departamento, área ou equipe. Continua sem integração financeira,
contábil ou orçamentária (herdado da especificação original).

### 7. Inativação bloqueia; nunca cascata

Inativar um nó organizacional com elementos ativos vinculados é **sempre
recusado**. Não há inativação em cascata, em nenhuma hipótese. Transferir
ou reclassificar um elemento para outro pai, como alternativa à recusa,
é fluxo **futuro**, fora desta fatia.

### 8. Hierarquia organizacional fixa nesta versão

Nenhuma árvore recursiva de profundidade arbitrária é criada. Nenhuma
relação de gestor, subordinado ou organograma de colaboradores é
antecipada — nem estruturalmente. Nenhum nó organizacional é tratado como
ponto de ancoragem previsto para uma futura FK de responsável/gestor; essa
decisão é inteiramente da fatia futura de Colaboradores, com o contexto
completo daquela entidade em mãos.

### 9. Vigência não se aplica aos nós organizacionais agora

Nenhum campo de vigência (`vigente_de`/`vigente_ate` ou equivalente) é
introduzido em `department`, `area`, `team`, `job_role` ou `cost_center`
nesta fatia. Vigência será tratada futuramente nas associações do
colaborador (cargo, equipe, gestor, centro de custo), quando essa
entidade existir.

## Estrutura organizacional vs. escopo de autorização

Esta ADR resolve **o que existe e como se relaciona** (estrutura). A
ADR 0005 resolve **quem pode acessar o quê** (autorização). As duas não
são a mesma pergunta:

- Um departamento e uma área existem como dados estruturais, navegáveis
  e consultáveis, mas **não filtram nem restringem acesso** — o filtro de
  acesso continua sendo `company_id`, ponto (decisão 2 acima, reafirmando
  ADR 0005 decisão 3).
- Se, no futuro, departamento ou área precisarem virar fronteira de
  autorização (por exemplo, um `gestor` restrito a ver só o próprio
  departamento), essa é uma decisão de autorização nova, com sua própria
  migration e sua própria ADR ou emenda — não uma consequência automática
  de departamento existir como estrutura.

## Alternativas consideradas

O levantamento completo de alternativas, com tabelas de impacto e
recomendação técnica por decisão, está preservado como histórico em
[docs/decisions/etapa1-modelagem-organizacional-pendente.md](../decisions/etapa1-modelagem-organizacional-pendente.md).
Resumo das alternativas descartadas mais relevantes:

| Alternativa descartada                                                      | Por que foi descartada                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Departamento por unidade, ou híbrido (unidade opcional)                     | Complica unicidade e escopo de acesso sem benefício claro no cenário single-tenant interno atual; departamento por empresa é mais simples e suficiente                                                     |
| Equipe com departamento **opcional** (só unidade)                           | Deixaria equipes "órfãs" de departamento, dificultando relatórios e futura associação de cargo/centro de custo por linha organizacional                                                                    |
| Catálogo de cargos compartilhado entre empresas                             | Conflita com `company_id` como fronteira central (ADR 0005) e exigiria regra de exceção só para `job_role`                                                                                                 |
| Centro de custo associado à estrutura já nesta fatia                        | Associação é aditiva depois; antecipá-la sem caso de uso real seria modelagem especulativa                                                                                                                 |
| Inativação com cascata confirmada (opção B do levantamento original)        | Cascata em estrutura organizacional é operação de alto risco (efeito difícil de prever/reverter); bloquear e exigir fluxo de transferência futuro é mais seguro                                            |
| Hierarquia recursiva com evolução planejada (preparar campos para o futuro) | Preparar campo especulativo para uma entidade (gestor) que ainda não existe é mesmo padrão já rejeitado na Fatia 3 (`access_user` desacoplado de colaborador); a fatia futura decide com contexto completo |
| Vigência aplicada aos nós organizacionais desde já                          | Sem colaborador, não há caso de uso real para vigência de nó; adicionar o campo agora seria especulação sobre a modelagem da fatia seguinte                                                                |

## Consequências

- A spec da Fatia 1
  ([docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md))
  é atualizada para refletir esta Baseline V1: modelo conceitual (§3),
  cardinalidades e inativação (§4), princípio de autorização (§5),
  unicidade (§6), classificação LGPD (§7), matriz de acesso (§8), eventos
  de auditoria (§9) e a lista de decisões pendentes (§12) — nenhuma delas
  mais bloqueia a fase Implementar quanto à modelagem.
- A fase Implementar pode iniciar sem decisão de modelagem pendente para
  departamento, área, equipe, cargo, centro de custo, inativação ou
  hierarquia. A pendência residual é DP-4 (CNPJ, decisão de produto/DPO
  à parte). DP-9 (nomenclatura) foi resolvida em 2026-08-06 — ver
  "Emenda 1" ao final desta ADR.
- `area` é uma entidade nova, não prevista na primeira versão do
  levantamento — sua introdução não altera nenhuma tabela já mergeada.
- Nenhuma tabela já mergeada (`access_user`, `audit_event`) é alterada por
  esta decisão — `department_id`/`area_id` explicitamente não entram
  nelas (decisão 2).
- A hierarquia fixa (decisão 8) é **mais conservadora** que a recomendação
  técnica original do levantamento (que sugeria preparar certas
  propriedades para uso futuro de gestor); o produto optou por não
  antecipar nada, nem estruturalmente.

## Controles de segurança

- **Menor privilégio inalterado:** nenhuma decisão desta ADR concede
  novo acesso amplo; `company_id` continua a única fronteira de
  autorização (ADR 0002, ADR 0003, ADR 0005).
- **Negação por padrão:** departamento e área, por não serem fronteira de
  autorização, não introduzem novo caminho de checagem — logo não há novo
  ponto de decisão de acesso a testar além do que já existe para
  `company_id`.
- **Sem exclusão física:** inativação (decisão 7) segue o mesmo padrão já
  estabelecido para as demais entidades organizacionais (R-INA-1, spec
  §4) — nenhuma rota `DELETE`.
- **Auditoria:** toda criação, alteração e inativação de `department`,
  `area`, `team`, `job_role` e `cost_center` gera evento via
  `AuditService.record()` (ADR 0004 §2), atômico com a mutação. Nenhum
  evento carrega valor antes/depois (ADR 0004 §5, inalterado).

## Impacto em auditoria

- `AuditResource` (união de tipos no código) recebe os novos recursos
  organizacionais **sem migration** (ADR 0004 §5).
- `AuditAction` (enum de banco fechado) recebe os novos verbos por
  **migration aditiva**, com o teste de sincronia entre enum de banco e
  array runtime já em vigor desde a Fatia 4.
- `audit_event` **não** recebe `department_id`/`area_id` (decisão 2) —
  eventos sobre departamento/área usam `resource`/`resource_id` e o
  escopo de empresa/unidade/equipe já existente.

## Itens fora de escopo desta ADR

- **Colaborador, gestor, função, salário, vínculo, folha, ponto,
  documentos, benefícios e dados pessoais** — nenhum entra nesta fatia,
  em nenhuma forma, nem estrutural.
- **Multitenancy comercial** — inteiramente fora de escopo, tratada pela
  ADR 0005, decisão 5 e "Gatilho de reavaliação", inalterada por esta ADR.
- **CNPJ em `company`** — decisão pendente separada (DP-4), não
  endereçada pela Baseline V1.
- **Escopo de acesso de `auditor`/`dpo`** — decisão pendente separada
  (DP-7), tratada pela Emenda 1 da ADR 0005, não endereçada aqui.
- **Escopo do papel `gestor`** — princípio de não antecipação está
  resolvido (decisão 8); a pergunta "o escopo tende a ser por equipe?"
  permanece genuinamente futura, dependente da entidade colaborador.

**Esta ADR não declara conformidade LGPD concluída.** Ela trata
exclusivamente de estrutura organizacional; a classificação de dados e as
bordas em aberto (CNPJ de MEI, nome de entidade contendo nome de pessoa)
continuam registradas na spec (§7) e nos limites da ADR 0005, inalteradas.

## Gatilhos de reavaliação

Esta decisão deve ser reaberta — com ADR nova ou emenda formal — quando
**qualquer** um destes ocorrer:

1. A entidade Colaborador for especificada e exigir decidir, com contexto
   completo, como a relação de gestor se ancora na estrutura
   organizacional (decisão 8 revisitada).
2. Departamento ou área precisarem virar fronteira de autorização (por
   exemplo, escopo de `gestor` por departamento) — decisão de autorização
   nova, não consequência automática desta ADR.
3. O bloqueio de inativação (decisão 7) se mostrar operacionalmente
   inviável em uso real, exigindo desenhar o fluxo de
   transferência/reclassificação hoje deferido.
4. A comercialização multitenant for aprovada (gatilho já registrado na
   ADR 0005) — a modelagem aqui descrita precisará ser revisada quanto a
   isolamento entre clientes.

## Responsabilidades

- **Time de desenvolvimento (código):** implementar o schema conforme as
  9 decisões desta ADR, sem introduzir campo, entidade ou regra além do
  que está aqui descrito; manter a extensão de `AuditAction` sempre
  aditiva.
- **Produto:** resolver DP-4 (CNPJ) antes ou durante a implementação,
  conforme a necessidade surgir; não é bloqueante para o início da fase
  Implementar quanto à modelagem em si. DP-9 (nomenclatura) já resolvida
  — ver Emenda 1.
- **TI/Segurança:** revisar, antes do merge da implementação, que
  nenhuma checagem de autorização passou a depender de
  `department_id`/`area_id` (decisão 2).
- **DPO/jurídico:** seguem as mesmas responsabilidades já registradas na
  ADR 0005 quanto à confirmação de ausência de dado pessoal de
  colaborador nesta fatia.
- **Revisor de PR:** bloquear merge que introduza `department_id` em
  `access_user`/`audit_event`, que implemente inativação em cascata, ou
  que antecipe estruturalmente relação de gestor/colaborador.

---

## Emenda 1 (2026-08-06)

**Esta seção é um aditivo — não reescreve nem apaga a decisão original
acima.** As 9 decisões de modelagem permanecem tal como aceitas. Esta
emenda formaliza uma decisão complementar, tomada na mesma data: a
**nomenclatura** do Núcleo Organizacional, resolvendo **DP-9**.

### Contexto da emenda

A decisão original (§"Itens fora de escopo") deixou a nomenclatura final
de tabelas e colunas como decisão de implementação, não endereçada. O
produto avaliou e aprovou, em ciclo próprio, a nomenclatura de negócio,
código, banco, APIs, eventos e documentação técnica do Núcleo
Organizacional.

### Decisão da emenda

1. **Nomenclatura em português** para tudo que o Núcleo Organizacional
   ainda vai criar: negócio, código, banco, APIs, eventos e documentação
   técnica. Identificadores técnicos **não usam** acento, espaço, hífen
   interno nem caractere especial.
2. **Nomes de entidade aprovados:**

   | Conceito        | Tipo/model (PascalCase) | Tabela futura (snake_case) |
   | --------------- | ----------------------- | -------------------------- |
   | Empresa         | `Empresa`               | `empresa`                  |
   | Unidade         | `UnidadeOrganizacional` | `unidade_organizacional`   |
   | Departamento    | `Departamento`          | `departamento`             |
   | Área            | `Area`                  | `area`                     |
   | Equipe          | `Equipe`                | `equipe`                   |
   | Cargo           | `Cargo`                 | `cargo`                    |
   | Centro de custo | `CentroCusto`           | `centro_custo`             |

3. **Convenções de forma aprovadas:**
   - Tipos/classes/models: PascalCase em português (ex.:
     `UnidadeOrganizacional`).
   - Campos e variáveis: camelCase em português (ex.: `empresaId`,
     `centroCustoId`).
   - Tabelas e colunas físicas futuras: snake_case em português (ex.:
     `unidade_organizacional`, `empresa_id`).
   - Rotas futuras: português, minúsculas, plurais (ex.: `/v1/empresas`,
     `/v1/unidades-organizacionais`, `/v1/centros-de-custo`).
   - Eventos de auditoria futuros: português, minúsculas, separados por
     ponto (ex.: `organizacao.empresa.criada`).
   - **`Cargo`, nunca `Role`** — o domínio de autorização já usa "papel"
     (`AuthorizationSubject.role`) para outro conceito; usar "Role" para
     cargo colidiria com esse vocabulário já implementado.
4. **Nada já implementado é renomeado.** `access_user`, `audit_event`,
   `company_id`/`unit_id`/`team_id`, `AuthorizationSubject`,
   `rbac.evaluator.ts`, `AuditAction`/`AuditResource` — tudo já mergeado
   nas Fatias 3 e 4 permanece em inglês, exatamente como está.
5. **Convivência de dois padrões de evento é aceita conscientemente:**
   os verbos de auditoria já implementados (Fatias 3/4) seguem
   snake_case em inglês (ex.: `login_succeeded`); os novos, do Núcleo
   Organizacional, seguem português separado por ponto (ex.:
   `organizacao.empresa.criada`). Não é inconsistência não percebida —
   é decisão explícita desta emenda, registrada para que revisões
   futuras não a tratem como erro.

### O que esta emenda não faz

- Não cria tabela, migration, endpoint, model Prisma ou qualquer artefato
  real — as tabelas/colunas do item 2 são convenção para a fase
  Implementar, não schema fechado.
- Não altera nenhuma das 9 decisões de modelagem da ADR original.
- Não renomeia código, teste, schema, migration, endpoint, dependência ou
  infraestrutura já existente.
- Não resolve DP-4 (CNPJ) nem DP-7 (escopo `auditor`/`dpo`) — seguem
  pendentes, sem relação com esta emenda.

### Diferenciação explícita

| Tema                                           | Status após esta emenda                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| Nomenclatura do Núcleo Organizacional (futuro) | Aprovada em português (itens 1–3 acima)               |
| Nomenclatura já implementada (Fatias 3/4)      | **Inalterada**, permanece em inglês                   |
| Nomenclatura de evento (auditoria)             | Dois padrões coexistem por decisão explícita (item 5) |

---

## Emenda 2 (2026-08-06) — registro da implementação V1

**Aditivo.** Nenhuma das 9 decisões de modelagem nem a Emenda 1
(nomenclatura) é alterada, reinterpretada ou revogada. Esta seção registra
**como** a decisão foi implementada e, com o mesmo peso, **o que ficou de
fora**.

Evidência detalhada (arquivos, endpoints, contagem de testes) em
[docs/modules/etapa1-nucleo-organizacional.md §14](../modules/etapa1-nucleo-organizacional.md).

### O que a implementação confirma

- As 7 entidades existem com a nomenclatura aprovada e as cardinalidades da
  Baseline V1. Migration **aditiva**: nenhuma tabela já mergeada foi
  alterada.
- **Decisão 2 sustentada no código, não só no texto:** não existe
  `department_id`/`area_id` em `access_user`, em `audit_event` nem no
  sujeito de autorização. `empresa_id` continua a única fronteira, e há
  teste que falha se isso mudar.
- **Decisão 7 sustentada:** inativação bloqueia com filho ativo, e o filho
  permanece ativo — não há caminho de código que inative em cascata.
- **Decisões 4, 8 e 9 sustentadas por ausência:** nenhuma entidade,
  campo ou rota de função, gestor, subordinado, organograma ou vigência foi
  criada.

### Decisões de implementação tomadas dentro do que já estava aprovado

Registradas por serem escolhas visíveis, ainda que não ampliem escopo:

1. **Autorização organizacional avaliada em duas fases** — capacidade do
   papel no `AuthorizationGuard`, escopo de empresa no service, com a
   entidade carregada. Consequência de o guard resolver apenas `AccessUser`
   como alvo. O isolamento é estrutural: toda consulta carrega o filtro de
   empresa derivado da sessão.
2. **`equipe` usa FK composta com `empresa_id`** para que o **banco** —
   não só a aplicação — recuse referência cruzando empresas (spec R5).
3. **Consulta de escopo amplo é auditada de forma fail-safe**; leitura
   dentro da própria empresa não gera evento. Auditar tudo transformaria a
   trilha em log de tráfego; não auditar o acesso amplo removeria
   exatamente o controle que torna a exceção do `admin_tecnico` aceitável.
4. **Tentativa fora de escopo responde 404 e registra `denied`.** As duas
   coisas ao mesmo tempo: a resposta não confirma existência, a trilha
   permite detectar varredura depois.

### Restrições aplicadas onde a matriz era ambígua

A matriz da spec §8 não era inequívoca em três pontos. Em todos, foi
aplicada **negação por padrão**, sem decidir a pendência por conta própria:

| Papel            | Ambiguidade                                | O que foi feito                                                         |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `gestor`         | "leitura restrita", escopo pendente (DP-8) | Negado na estrutura organizacional até DP-8 ser decidida                |
| `auditor`, `dpo` | "leitura", escopo pendente (DP-7)          | Negados na estrutura; leitura da trilha (`access_log`) **inalterada**   |
| `financeiro`     | "`centro_custo` e estrutura mínima"        | Concedido só `centro_custo`; "estrutura mínima" indefinida ficou negada |

Ampliar qualquer um desses exige decisão de produto/segurança registrada —
não é ajuste de implementação.

### Correção posterior: R-INA-5 (reativação)

A primeira versão desta emenda registrava a reativação como "não
implementada", tratando-a como limitação de escopo. **Isso estava errado:**
R-INA-5 ("reativação é operação explícita e auditada") é requisito da spec
aprovada, e a estratégia de testes cobre R-INA-1 a R-INA-5. Uma seção de
evidência de implementação não pode rebaixar requisito aprovado — só o
produto pode, por decisão registrada.

A reativação foi implementada para as sete entidades, com:

- rota `POST /v1/<recurso>/:<recurso>Id/reativar`, exigindo sessão, CSRF e
  autorização `manage` — mesma matriz da inativação;
- **validação de pais ativos**, para que a reativação não recrie pela porta
  dos fundos o estado que R-INA-3 proíbe na criação (filho ativo sob pai
  inativo). Basta o pai direto: a cadeia acima já é garantida por
  invariante, porque a inativação é bloqueada enquanto houver filho ativo;
- **404** para alvo fora do escopo (com evento `denied`) e **409** para
  entidade já ativa;
- **nenhuma reclassificação**: só `status` é tocado — código, empresa e
  relações permanecem imutáveis;
- **atomicidade** com a auditoria, comprovada por rollback real.

Sete verbos novos no enum fechado — `organizacao.<entidade>.reativada` —,
seguindo o mesmo padrão da Emenda 1: valor persistido em português separado
por ponto, identificador Prisma com `_`. A migration organizacional foi
**ajustada e regenerada** (não duplicada), por ainda não estar mergeada.

### O que esta emenda não faz

- Não implementa árvore organizacional, transferência ou reclassificação —
  todos permanecem futuros.
- Não introduz CNPJ (DP-4), colaborador, gestor, função, vigência ou
  multitenancy.
- Não altera o comportamento de autorização já mergeado da Etapa 0: os
  quatro recursos originais mantêm as regras, e o avaliador foi estendido
  por ramo novo.
- **Não declara conformidade LGPD concluída.** A confirmação de DPO segue
  pendente, com as bordas conhecidas em aberto.
- Não altera os gatilhos de reavaliação da ADR original nem os da Emenda 1
  da ADR 0005 (prazo de 90 dias do `admin_tecnico` continua correndo).
