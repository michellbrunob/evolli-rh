# Etapa 1 — Fatia 1: Núcleo Organizacional Interno

Status: **modelagem organizacional aprovada (Baseline V1, 2026-08-06)** —
nenhum código, migration, schema, endpoint, dependência ou infraestrutura
criado nesta fase; a fase Implementar ainda não foi iniciada.

Fase do rito SDD: **Especificar** (com decisões de modelagem já
**Aprovadas**). Este documento cobre o passo Especificar de
Especificar → Aprovar → Implementar → Verificar → Registrar; a modelagem
organizacional já percorreu Aprovar (Baseline V1) e aguarda o início de
Implementar.

Decisão arquitetural desta fatia registrada em
[ADR 0005 — Escopo interno e evolução multitenant](../adr/0005-escopo-interno-e-evolucao-multitenant.md)
e em
[ADR 0006 — Modelo organizacional interno, Baseline V1](../adr/0006-modelo-organizacional-interno-baseline-v1.md).
Histórico completo de alternativas e a decisão aprovada em
[docs/decisions/etapa1-modelagem-organizacional-pendente.md](../decisions/etapa1-modelagem-organizacional-pendente.md).

Depende de: [Etapa 0 — Fatia 3 (identidade, sessão e autorização)](etapa0-fatia3-identidade-acesso.md),
[Etapa 0 — Fatia 4 (auditoria formal)](etapa0-fatia4-auditoria-formal.md),
[ADR 0001](../adr/0001-fundacao-api.md), [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md),
[ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
[ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) — todas já
integradas em `main`.

## 0. Contexto decisório e observações registradas

O Evolli RH será utilizado **inicialmente apenas pelo escritório**. A
comercialização para múltiplas empresas clientes é evolução futura, não
requisito de implementação agora (ADR 0005). Esta especificação foi
ajustada a esse contexto: entrega a estrutura organizacional interna, sem
introduzir multitenancy técnica.

As observações abaixo foram **registradas, não resolvidas por suposição**.

### O1 — PRD do Notion é fonte complementar obrigatória, não versionada

O PRD "Sistema RH - Reserva Fiscal" vive no Notion e **não está versionado
no repositório** — uma busca no checkout não encontra nenhum arquivo
correspondente. Isso é uma característica conhecida do fluxo de trabalho,
**não um bloqueio de aceite desta fatia**.

Consequências práticas, aplicadas neste documento:

- Nenhum requisito foi inferido, inventado ou atribuído ao PRD. Tudo aqui
  vem do contexto decisório aprovado (acima) e das fontes técnicas
  versionadas (`PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`, ROADMAP,
  ADRs 0001–0004, specs das Fatias 3 e 4).
- Onde o PRD normalmente decidiria uma questão de modelagem
  (cardinalidade, catálogo de cargos, identificadores fiscais), a questão
  está em **decisões pendentes** (§12), com alternativas objetivas.
- **Dependência de rastreabilidade registrada:** a próxima fatia funcional
  (colaboradores e vínculos) precisa de rastreabilidade explícita entre os
  requisitos do PRD e a especificação — seja versionando um extrato do PRD
  no repositório, seja mantendo uma matriz de rastreabilidade
  requisito ↔ spec ↔ teste. Pendência da próxima fatia, não desta.

### O2 — Interpretação de "Fatia 1" perante o roadmap

O roadmap vigente descreve a Etapa 1 de forma mais ampla — "Core
organizacional: empresas, unidades, cargos, vínculos e colaboradores"
(`docs/ROADMAP.md`); o plano mestre §5 acrescenta "pessoas, vínculos
CLT/estágio/PJ, colaboradores, perfis e dados cadastrais".

**Interpretação registrada (decisão aprovada 6):** esta especificação é a
**Fatia 1 — Núcleo Organizacional Interno** da Etapa 1. Colaboradores e
seus vínculos permanecem no escopo da Etapa 1 do roadmap, porém em
**fatia posterior**.

`docs/ROADMAP.md` **não é alterado** por esta tarefa — o fatiamento interno
da etapa é detalhamento de execução, não renumeração do roadmap.

### O3 — Divergência resolvida: `admin_tecnico` mantém acesso global (exceção temporária aprovada)

A decisão aprovada 4 da ADR 0005 ("`admin_tecnico`, `auditor` e `dpo` só
podem acessar empresas para as quais tenham escopo autorizado") divergia
do comportamento então implementado e mergeado em `rbac.evaluator.ts`
(`evaluateAccessLog`, `evaluateOtherAccount`) — ambos concedem acesso
global sem checagem de empresa para esses papéis.

**Esta divergência foi levantada, decidida e registrada** em
[docs/decisions/etapa1-escopo-autorizacao-interna-pendente.md](../decisions/etapa1-escopo-autorizacao-interna-pendente.md)
e formalizada como **Emenda 1** da
[ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md#emenda-1-2026-08-06)
(2026-08-06):

- **`admin_tecnico`** mantém acesso global ao ambiente interno como
  **exceção temporária e condicionada** (ao menos duas contas nominativas;
  uso só para administração excepcional, separado de conta de uso
  rotineiro; toda ação auditada; reavaliação obrigatória em até 90 dias ou
  antes da comercialização a terceiros). O comportamento hoje implementado
  em `rbac.evaluator.ts` **já está alinhado** a esta decisão — nenhuma
  mudança de autorização é exigida para `admin_tecnico` na implementação
  desta fatia.
- **`auditor` e `dpo` continuam fora dessa exceção.** Eles não são
  provisionados no cenário interno atual, e o comportamento hoje presente
  no código (leitura ampla, sem checagem de empresa) permanece **capacidade
  técnica não validada por uso real** — não uma decisão aprovada. O escopo
  deles precisa ser deliberado explicitamente antes do primeiro
  provisionamento (ver §5, matriz).

**O que ainda é trabalho da fase Implementar:** garantir, na implementação
do Núcleo Organizacional, que o bootstrap administrativo continue
funcionando e que todo acesso administrativo amplo gere evento de
auditoria com o escopo efetivo utilizado (ver RI-2, §12, atualizado).

## 1. Objetivo, escopo e fora de escopo

### Objetivo

Especificar o núcleo organizacional **interno** do Evolli RH — empresa,
unidade, departamento, área (subdivisão opcional do departamento), equipe,
cargo e centro de custo opcional — com regras de integridade, limites de
autorização por empresa e auditoria desde o primeiro CRUD, de forma que
Colaboradores, Portal do Gestor, Documentos, Ponto, Dashboard e demais
módulos futuros tenham um esqueleto organizacional estável para
referenciar.

A preparação conceitual para a evolução comercial é preservada (§13), mas
**nenhuma multitenancy técnica é introduzida nesta fatia**.

### Escopo — entra (nesta especificação)

- Modelo conceitual das entidades organizacionais internas, sem migration (§3).
- Definições, cardinalidades e regras de inativação (§4).
- Escopo organizacional e limites de autorização, tendo `company_id` como
  maior limite atual (§5).
- Regras de integridade: código, nome, unicidade, status, referências,
  proibição de exclusão física (§6).
- Classificação de dados e confirmação LGPD (§7).
- Matriz de acesso por papel, escopo e ação, compatível com o RBAC/ABAC já
  implementado (§8).
- Eventos obrigatórios de auditoria (§9).
- Contratos de API futuros, sem criar endpoint (§10).
- Estratégia de testes (§11).
- Critérios de aceite, riscos, dependências, decisões pendentes e arquivos
  previstos (§12).
- Gates da evolução comercial futura, sem desenho de implementação (§13).

### Escopo — não entra

- **Nenhum artefato de implementação**: código, migration, `schema.prisma`,
  endpoint, DTO, guard, dependência, infraestrutura, interface, PR ou
  merge. Esta fase é só documento.
- **Nenhuma multitenancy técnica** (decisão aprovada 2): sem entidade
  `tenant`, sem coluna `tenant_id`, sem Row-Level Security multitenant,
  sem backfill e sem migration retroativa nesta fatia.
- **Nenhuma entidade de colaborador, pessoa ou vínculo** (CLT, estágio,
  PJ) — a relação gestor/subordinado **não é antecipada de nenhuma
  forma** (§3.6, Baseline V1 item 8), sem entidade que a materialize
  nesta fatia (decisão aprovada 6).
- **Nenhuma entidade, campo ou regra de "função"** distinta de cargo
  (Baseline V1, item 4) — fica para a futura vida funcional do
  colaborador.
- **Nenhum campo de vigência** nos nós organizacionais (Baseline V1, item 9) — vigência será tratada futuramente nas associações do colaborador
  (cargo, equipe, gestor, centro de custo).
- **Nenhuma inativação em cascata**, em nenhuma hipótese (Baseline V1,
  item 7) — inativação bloqueia quando há elementos ativos vinculados;
  transferência/reclassificação é fluxo futuro.
- **Nenhum dado trabalhista, legal, fiscal, financeiro ou de benefício** —
  centro de custo entra como rótulo organizacional, explicitamente **sem**
  integração financeira, contábil ou orçamentária, e sem associação a
  unidade, departamento, área ou equipe (§3.5, Baseline V1 item 6).
- **Nenhum requisito ausente das fontes disponíveis** (O1).
- **MFA TOTP** — decisão vigente inalterada (decisão aprovada 8): adiado
  apenas da demonstração inicial, **obrigatório antes de piloto com dados
  reais ou produção** (ADR 0003, decisão 3). Esta fatia não implementa nem
  altera isso; herda a obrigação como pré-condição de piloto.
- Hierarquia organizacional recursiva de profundidade arbitrária —
  hierarquia é fixa nesta versão, sem árvore recursiva (Baseline V1,
  item 8).
- **Colaborador, gestor, função, salário, vínculo, folha, ponto,
  documentos, benefícios e dados pessoais** — nenhum destes entra nesta
  fatia, em nenhuma forma, nem estrutural.

## 2. Relação com o PRD e com o roadmap

- **PRD "Sistema RH - Reserva Fiscal" (Notion)**: fonte **complementar e
  obrigatória** de requisitos funcionais, de segurança, de LGPD e de
  critérios de aceite. Não é documento acessório nem de prioridade menor
  que o roadmap técnico. Não estar versionado no repositório não reduz sua
  autoridade — só impede a confrontação automática no checkout (O1).
- **Roadmap do Evolli RH**: define a **ordem técnica de implementação** por
  dependência. Não sobrepõe nem rebaixa requisito registrado no PRD.
- **Conflitos são registrados como decisão explícita**, nunca resolvidos
  por suposição nem rebaixados silenciosamente: quem decidiu, por quê, o
  que foi priorizado e o que ficou para depois. As observações desta fatia
  estão em §0.
- **Rastreabilidade PRD ↔ spec ↔ teste** é pendência da **próxima fatia
  funcional** (colaboradores/vínculos), quando requisitos de negócio
  passarem a ser derivados diretamente do PRD (O1).

## 3. Modelo conceitual (sem migration)

Rascunho conceitual, para revisão — **nenhuma migration, nenhum model
Prisma criado nesta fase**. Nomes de entidade e de campo são propostas de
trabalho, não contrato fechado (DP-9).

Convenção: `[PK]` chave; `[FK]` referência; `[U]` participa de restrição de
unicidade (§6); `?` opcional.

**`company` é a raiz do escopo organizacional** — não existe entidade
acima dela nesta fatia (decisão aprovada 3).

### 3.1 `company` — empresa

```text
company
  id            [PK]  identificador não sequencial previsível (mesmo padrão
                      de UUID já usado desde a Fatia 3)
  code          [U]   código curto, estável, imutável após criação
  name                razão social/nome
  status              enum fechado: active | inactive
  created_at / updated_at
```

Maior limite organizacional e de autorização atual. No deployment interno,
representa a(s) empresa(s) do próprio escritório.

**Identificador fiscal (CNPJ) não está incluído** — decisão pendente DP-4:
(a) não há requisito versionado que o exija (O1); (b) CNPJ de
MEI/empresário individual pode ser associável a pessoa física, o que
mudaria a classificação LGPD desta fatia (§7).

### 3.2 `unit` — unidade

```text
unit
  id            [PK]
  company_id    [FK] -> company
  code          [U] (único dentro da empresa)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

Estabelecimento/filial/local de uma empresa.

### 3.3 `department` — departamento e `area` — subdivisão opcional

Departamento e área são entidades **distintas** (Baseline V1, item 1):
departamento é o nível organizacional principal; área é uma subdivisão
**opcional** do departamento — nunca da unidade, nunca da empresa
diretamente.

```text
department
  id            [PK]
  company_id    [FK] -> company
  code          [U] (único dentro da empresa)
  name
  status              enum fechado: active | inactive
  created_at / updated_at

area                                 -- opcional, subdivisão de department
  id            [PK]
  department_id [FK] -> department
  code          [U] (único dentro do departamento)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

**Resolvido (Baseline V1, itens 1 e 2):**

- Departamento pertence **à empresa**, atravessando unidades — não à
  unidade, não em modelagem híbrida. Unicidade de `code` por empresa.
- Área é subdivisão opcional do departamento, com `code` único dentro do
  departamento a que pertence.
- **Departamento e área não são fronteira de autorização.** `company_id`
  continua o maior limite de autorização (§5); nenhuma checagem de escopo
  usa `department_id`/`area_id`.
- **`department_id` não é introduzido em `access_user` nem em
  `audit_event`** (Baseline V1, item 2) — sem alteração retroativa das
  tabelas já mergeadas.

Histórico completo de alternativas em
[docs/decisions/etapa1-modelagem-organizacional-pendente.md — D1](../decisions/etapa1-modelagem-organizacional-pendente.md).

### 3.4 `team` — equipe

```text
team
  id            [PK]
  company_id    [FK] -> company
  department_id [FK] -> department       (obrigatório)
  unit_id       [FK] -> unit ?           (opcional)
  code          [U] (único dentro do departamento)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

**Resolvido (Baseline V1, item 3):** equipe pertence **obrigatoriamente**
a um departamento e pode, **opcionalmente**, ser vinculada a uma unidade.
Unicidade de `code` no escopo do departamento.

Histórico completo de alternativas em
[docs/decisions/etapa1-modelagem-organizacional-pendente.md — D2](../decisions/etapa1-modelagem-organizacional-pendente.md).

### 3.5 `job_role` — cargo e `cost_center` — centro de custo

```text
job_role
  id            [PK]
  company_id    [FK] -> company          (obrigatório)
  code          [U] (único dentro da empresa)
  name
  status              enum fechado: active | inactive
  created_at / updated_at

cost_center                          -- opcional
  id            [PK]
  company_id    [FK] -> company
  code          [U] (único dentro da empresa)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

`job_role` é catálogo de **cargo**. **Sem** faixa salarial, CBO, jornada,
requisito legal ou qualquer atributo trabalhista/fiscal — todos fora de
escopo (§1).

**Resolvido (Baseline V1, itens 4 e 5):**

- Nesta fatia existe apenas **cargo**. **Função** fica para a futura vida
  funcional do colaborador — nenhuma entidade, campo ou regra de função é
  criada agora.
- O catálogo de cargos é **por empresa**, com código padronizável para
  futura consolidação (ex.: mesmo `code` em catálogos de empresas
  diferentes, sem que isso implique compartilhamento de linha).

`cost_center` é rótulo organizacional **opcional**, sem integração
financeira, contábil ou orçamentária nesta fatia (restrição §1). Nenhum
valor monetário, rateio, plano de contas ou vínculo com sistema financeiro
externo entra aqui.

**Resolvido (Baseline V1, item 6):** centro de custo é cadastrado **por
empresa**, **sem associação** a unidade, departamento, área ou equipe
nesta fatia.

Histórico completo de alternativas em
[docs/decisions/etapa1-modelagem-organizacional-pendente.md — D3 e D4](../decisions/etapa1-modelagem-organizacional-pendente.md).

### 3.6 Relação gestor ↔ subordinado — não antecipada

**Nenhuma entidade de colaborador é criada nesta fatia** (restrição §1,
decisão aprovada 6). **Resolvido (Baseline V1, item 8):** a relação
gestor/subordinado **não é antecipada de nenhuma forma nesta fatia**, nem
mesmo estruturalmente:

- Nenhum nó organizacional (`unit`, `department`, `area`, `team`) é
  tratado como ponto de ancoragem previsto para uma futura referência de
  responsável/gestor. Não há propriedade, comentário de schema ou
  convenção de nomenclatura reservada para esse fim.
- Quando Colaboradores for especificado, a relação de gestor — e o
  julgamento de como ela se ancora na estrutura organizacional — é
  decisão **daquela fatia**, tomada com o contexto completo da entidade
  colaborador em mãos.
- Consequência aceita: **nesta fatia não é possível responder "quem é o
  gestor desta equipe"**, e o desenho atual **não pressupõe sequer que a
  resposta virá por uma FK direta em `team`**. Isso é esperado, não uma
  lacuna.
- O escopo de leitura do papel `gestor` na matriz de acesso (§8) segue
  como pendência genuinamente futura (DP-8, restrita à pergunta "o
  escopo do gestor tende a ser por equipe?"), pois depende da entidade
  colaborador.

Histórico completo em
[docs/decisions/etapa1-modelagem-organizacional-pendente.md — D8](../decisions/etapa1-modelagem-organizacional-pendente.md).

## 4. Definições, cardinalidades e regras de inativação

### Cardinalidades (Baseline V1)

| Relação               | Cardinalidade  | Observação                                                       |
| --------------------- | -------------- | ---------------------------------------------------------------- |
| company → unit        | 1:N            | Unidade pertence a exatamente uma empresa                        |
| company → department  | 1:N            | Departamento pertence à empresa (item 1)                         |
| department → area     | 1:N (opcional) | Área é subdivisão opcional do departamento (item 1)              |
| department → team     | 1:N            | Equipe pertence obrigatoriamente a um departamento (item 3)      |
| unit → team           | 1:N (opcional) | Equipe pode, opcionalmente, vincular-se a uma unidade (item 3)   |
| company → job_role    | 1:N            | Catálogo por empresa (item 5)                                    |
| company → cost_center | 1:N            | Cadastro por empresa, sem associação a outras entidades (item 6) |

Nenhuma relação N:N é proposta nesta fatia. Uma entidade organizacional
**nunca** pertence a dois pais do mesmo tipo.

### Regras de inativação

- **R-INA-1 — Inativação, nunca exclusão física.** Toda entidade tem
  `status` (`active` | `inactive`). "Remover" é sempre transição para
  `inactive` (§6, R6).
- **R-INA-2 — Inativação bloqueia quando há elementos ativos vinculados;
  nenhuma cascata.** (Resolvido, Baseline V1 item 7.) Inativar uma
  empresa/departamento/área/unidade/equipe com filhos ativos é **sempre
  recusado** — não há inativação em cascata, em nenhuma hipótese.
  Transferência ou reclassificação de um elemento para outro pai, como
  alternativa à recusa, é fluxo **futuro**, fora desta fatia.
- **R-INA-3 — Entidade inativa não aceita novos vínculos.** Criar uma
  unidade sob empresa inativa, ou vincular algo a um nó inativo, é
  rejeitado.
- **R-INA-4 — Vínculos preexistentes sobrevivem à inativação.** Inativar não
  quebra referências já criadas — o histórico continua legível e auditável.
- **R-INA-5 — Reativação é operação explícita e auditada**, sujeita às
  mesmas regras de integridade da criação (ex.: unicidade de código ainda
  válida no escopo).

## 5. Escopo organizacional e limites de autorização

### Princípio

**`company_id` é o maior limite organizacional e de autorização atual**
(decisão aprovada 3, reafirmada pela Baseline V1 item 2). Abaixo dele
existem unidade, departamento, área, equipe, cargo e centro de custo
opcional. Não existe camada acima da empresa nesta fatia.

**Resolvido (Baseline V1, item 2): departamento e área não são novas
fronteiras de autorização nesta fatia.** `unidade` e `equipe` mantêm os
escopos organizacionais já previstos (informativos, não filtros de
acesso); `department_id`/`area_id` **não são introduzidos** em
`AuthorizationSubject`, no avaliador RBAC/ABAC, nem em `access_user` ou
`audit_event` — nenhuma checagem de escopo, nenhum filtro de consulta e
nenhum campo de evento de auditoria usa departamento ou área. Se um dia
essa fronteira for necessária, é decisão explícita de uma fatia futura,
com sua própria migration.

O escopo é avaliado com **negação por padrão**, extensão direta do que já
vigora desde a ADR 0002 (menor privilégio no banco) e a ADR 0003
(RBAC/ABAC deny-by-default). Reaproveita o mecanismo já implementado
(`isSameCompany` em `rbac.evaluator.ts`), sem introduzir um segundo modelo
de escopo paralelo.

### Acesso amplo interno: explícito, mínimo e auditado — com exceção temporária para `admin_tecnico`

Princípio geral (ADR 0005, decisão 4): acesso amplo interno deve ser
**explícito** (concedido deliberadamente, nunca herdado por ser "o papel
técnico"), **mínimo** e **auditado** (cada uso gera evento, §9).

**Decisão resolvida (O3, Emenda 1 da ADR 0005, 2026-08-06):**
`admin_tecnico` mantém acesso global ao ambiente interno como **exceção
temporária e condicionada** a esse princípio — não uma violação dele, mas
uma exceção aprovada explicitamente, com prazo. Condições: ao menos duas
contas administrativas nominativas; uso restrito a administração
excepcional, separado de conta de uso rotineiro; toda ação auditada;
reavaliação obrigatória em até 90 dias ou antes da comercialização a
terceiros, o que ocorrer primeiro. Detalhe completo em
[docs/decisions/etapa1-escopo-autorizacao-interna-pendente.md](../decisions/etapa1-escopo-autorizacao-interna-pendente.md).

**`auditor` e `dpo` não são cobertos por essa exceção.** Eles não são
provisionados no cenário interno atual (contexto validado pelo produto), e
seu escopo de acesso — hoje idêntico ao do `admin_tecnico` no código —
**não foi aprovado nem decidido**. Continua como decisão pendente, a
resolver antes do primeiro provimento desses papéis (DP-7, restrita a esse
escopo).

### Sem multitenancy técnica

Não há `tenant`, `tenant_id`, Row-Level Security multitenant, backfill nem
migration retroativa nesta fatia (decisão aprovada 2, ADR 0005). Nenhuma
tabela já mergeada (`access_user`, `audit_event`) é alterada para
acomodar multitenancy. A evolução comercial futura tem gates próprios
(§13).

## 6. Regras de integridade

- **R1 — Código obrigatório, estável e imutável.** Toda entidade tem `code`
  curto, obrigatório, imutável após a criação. Renomear é operação de
  `name`, nunca de `code` — código é o identificador estável para
  integrações e referências futuras.
- **R2 — Unicidade sempre no escopo correto.** `company.code` é único no
  deployment; `unit.code` e `department.code` são únicos **dentro da
  empresa**; `area.code` é único **dentro do departamento**; `team.code`
  é único **dentro do departamento**; `job_role.code` é único **dentro da
  empresa** (Baseline V1).
- **R3 — Nome obrigatório, não único.** Dois departamentos podem se chamar
  "Financeiro" em unidades diferentes; a distinção é por `code` e escopo.
- **R4 — Status por enum fechado**, nunca texto livre — mesmo padrão de
  `AccessUserStatus` (Fatia 3) e `AuditAction`/`AuditResult` (Fatia 4).
- **R5 — Toda referência aponta para entidade da mesma empresa.** Uma equipe
  nunca referencia departamento de outra empresa. Garantido por restrição
  de banco, não só por validação de aplicação.
- **R6 — Proibição de exclusão física quando houver vínculo.** Nenhum
  `DELETE` é exposto por API. Mesmo sem vínculos atuais, entidades
  organizacionais são referenciadas por eventos de auditoria já gravados
  (append-only, ADR 0004) — apagar a entidade tornaria a trilha
  ininterpretável. "Remoção" é sempre inativação (§4).
- **R7 — Empresa de uma entidade é imutável.** Uma unidade nunca migra de
  empresa. Movimentação entre empresas, se um dia necessária, é processo
  próprio com trilha dedicada — não um `UPDATE`.
- **R8 — Hierarquia acíclica e de profundidade fixa.** Nenhuma entidade é
  ancestral de si mesma. Profundidade recursiva arbitrária está fora de
  escopo (DP-10).

## 7. Classificação de dados e LGPD

### Confirmação

**Esta fatia não introduz dado pessoal de colaborador.** Todas as entidades
especificadas (§3) são estrutura organizacional: identificadores técnicos,
códigos, nomes de empresa/unidade/departamento/equipe/cargo e status.
Nenhum CPF, nome de pessoa física, endereço, contato pessoal, dado de
saúde, salário, documento ou dado de dependente entra aqui.

| Dado                                                         | Classificação   | Observação                                             |
| ------------------------------------------------------------ | --------------- | ------------------------------------------------------ |
| `company.name`                                               | Pessoa jurídica | Salvo o caso de MEI/empresário individual (ver bordas) |
| `unit.name`                                                  | Organizacional  | —                                                      |
| `department.name`, `area.name`, `team.name`, `job_role.name` | Organizacional  | —                                                      |
| `cost_center.name`/`code`                                    | Organizacional  | Sem valor monetário (§3.5)                             |
| `status`, `code`, timestamps                                 | Técnico         | —                                                      |

### Bordas registradas (não resolvidas)

- **CNPJ (DP-4):** não incluído. Se vier a ser incluído, o caso de
  MEI/empresário individual torna o identificador potencialmente associável
  a pessoa física — o que mudaria a afirmação acima e exigiria revisão de
  DPO. Por isso a inclusão é decisão pendente, não omissão.
- **Nome de entidade contendo nome de pessoa:** nada impede
  operacionalmente que alguém nomeie uma equipe como "Equipe do João". Não é
  campo de dado pessoal por desenho, e não há validação de conteúdo
  prevista — registrado como risco residual (RI-4), não como controle.
- **Auditoria organizacional (§9)** registra ator (`access_user`) e IP —
  dado pessoal já tratado e classificado na Fatia 3 §2 e na ADR 0004. Esta
  fatia não amplia esse tratamento, só gera mais eventos do mesmo tipo já
  aprovado.
- **Evolução comercial futura** exigirá revisão de LGPD específica (§13,
  ADR 0005) — dado de cliente terceiro tem base legal e finalidade
  distintas de dado interno do escritório. Nada disso é declarado
  concluído aqui.

### Herança de controles

Continuam valendo, sem alteração: minimização; proibição de senha, hash,
token, cookie, CSRF, CPF completo, salário e conteúdo de documento em claro
em qualquer log ou evento (ADR 0004 §5/§6); `AllExceptionsFilter` sem
vazamento de detalhe interno (ADR 0001).

## 8. Matriz inicial de acesso

Compatível com o RBAC/ABAC já implementado (`evaluatePermission` +
`AuthorizationGuard` + `@RequirePermission`, Fatia 3): os recursos abaixo
**estendem** a união `AuthorizationResource`, sem reduzir nada do que já
existe. As ações reaproveitam o vocabulário atual (`read`, `manage`,
`alter`, `create`).

### Recursos propostos

`organization_structure` (leitura da árvore organizacional), `company`,
`unit`, `department`, `area`, `team`, `job_role`, `cost_center`.

### Matriz

| Papel           | Ler estrutura | Criar/alterar/inativar | Escopo                                                                                                                      |
| --------------- | ------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `admin_tecnico` | ✅            | ✅                     | Instância inteira — exceção temporária aprovada (Emenda 1, ADR 0005, prazo 90 dias)                                         |
| `rh`            | ✅            | ✅                     | Própria empresa                                                                                                             |
| `dp`            | ✅            | ❌                     | Leitura na própria empresa                                                                                                  |
| `gestor`        | ✅ (restrita) | ❌                     | Escopo exato ainda pendente (DP-8) — depende de colaborador; nenhuma preparação estrutural antecipada (Baseline V1, item 8) |
| `financeiro`    | ✅ (restrita) | ❌                     | Leitura de `cost_center` e estrutura mínima                                                                                 |
| `colaborador`   | ❌            | ❌                     | Sem acesso à estrutura nesta fatia                                                                                          |
| `auditor`       | ✅ (leitura)  | ❌                     | **Não provisionado atualmente** — escopo pendente de deliberação futura (DP-7)                                              |
| `dpo`           | ✅ (leitura)  | ❌                     | **Não provisionado atualmente** — escopo pendente de deliberação futura (DP-7)                                              |

### Regras invioláveis

- **A1 — Escopo de empresa antes de papel.** A checagem de escopo precede
  qualquer regra de papel. Nenhum papel atravessa empresa sem autorização
  explícita (decisão 4).
- **A2 — Negação por padrão.** Ação não listada é negada. Recurso novo
  criado por módulo futuro nasce negado até ser adicionado à matriz.
- **A3 — Nenhuma escrita direta na trilha de auditoria** por nenhum papel —
  mantém a ADR 0004 §2 (escrita só via `AuditService`).
- **A4 — Ninguém amplia o próprio escopo organizacional.** Mesma proteção
  contra autoelevação já implementada na Fatia 3 para papel: um ator não
  move a si mesmo para um escopo mais amplo.

## 9. Eventos obrigatórios de auditoria

Toda ação sensível desta fatia é auditada via `AuditService.record()` —
**ponto único de escrita** (ADR 0004 §2), nunca `prisma.auditEvent.create()`
direto.

| Evento                             | Quando                                                                                                  | `result`  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- | --------- |
| Criação de entidade organizacional | Empresa, unidade, departamento, área, equipe, cargo, centro de custo criados                            | `success` |
| Alteração de entidade              | Mudança de `name` ou de referência estrutural                                                           | `success` |
| Inativação / reativação            | Transição de `status`, **um evento por entidade afetada** em caso de cascata (R-INA-2)                  | `success` |
| Tentativa negada                   | 403 do `AuthorizationGuard` sobre recurso organizacional, incluindo tentativa fora do escopo de empresa | `denied`  |
| Consulta relevante                 | Leitura da estrutura completa de uma empresa e qualquer consulta de escopo amplo (§5)                   | `success` |

### Garantias herdadas da Fatia 4 (aplicam-se sem exceção)

- **Atomicidade:** criação, alteração e inativação persistem a mudança e o
  evento **na mesma transação** — ou os dois, ou nenhum (ADR 0004 §2).
- **Best-effort na negação:** uma tentativa negada continua negada mesmo se
  o evento não puder ser gravado; só o log técnico registra a falha, sem
  segredo.
- **Sem valores antes/depois:** o evento registra `action` +
  `resource`/`resource_id`, nunca o valor de campo alterado (ADR 0004 §5,
  decisão inalterada).
- **Append-only:** garantido por privilégio de banco na própria migration
  (ADR 0004 §1) — vale automaticamente para os eventos novos.

### Impacto técnico a considerar na implementação

- `AuditAction` é **enum de banco fechado** (ADR 0004 §5): cada verbo novo
  (ex.: `company_created`) exige **migration aditiva** para estender o enum
  e atualização do array runtime `AUDIT_ACTIONS`. Existe teste de sincronia
  entre os dois — a divergência falha o build, por desenho.
- `AuditResource` é **união de tipos no código**: os recursos
  organizacionais entram **sem migration**.
- `audit_event` já possui `company_id`/`unit_id`/`team_id` — suficiente
  para o escopo desta fatia, **sem alteração retroativa**.
- **Resolvido (Baseline V1, item 2): `department_id`/`area_id` não são
  adicionados a `audit_event`.** Eventos sobre departamento/área usam
  `resource`/`resource_id` (já suportados por `AuditResource`, sem
  migration) e o escopo de empresa/unidade/equipe já existente — nunca um
  novo campo de escopo por departamento ou área.

## 10. Contratos de API futuros (sem criar endpoint)

Propostos, **não implementados**. Nenhum endpoint, DTO ou controller é
criado nesta fase.

| Método         | Rota (proposta, sob `/v1`)                                                         | Descrição                                  | Autorização                           |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| GET            | `/v1/org/companies`                                                                | Lista empresas do escopo do ator, paginado | `read` sobre `company`                |
| GET            | `/v1/org/companies/:companyId`                                                     | Detalhe                                    | Idem                                  |
| POST           | `/v1/org/companies`                                                                | Cria empresa                               | `create`                              |
| PATCH          | `/v1/org/companies/:companyId`                                                     | Altera `name` (nunca `code`)               | `alter`                               |
| POST           | `/v1/org/companies/:companyId/deactivate`                                          | Inativa (nunca exclui)                     | `manage`                              |
| GET/POST/PATCH | `/v1/org/units`, `/departments`, `/areas`, `/teams`, `/job-roles`, `/cost-centers` | Mesmo padrão                               | Conforme §8                           |
| GET            | `/v1/org/tree`                                                                     | Árvore organizacional do escopo do ator    | `read` sobre `organization_structure` |

### Regras de contrato

- **Nenhuma rota `DELETE`** em entidade organizacional (R6).
- **Escopo nunca vem do cliente** — a empresa acessível é sempre derivada
  da sessão autenticada e do escopo autorizado do ator. Aceitá-la do
  corpo/query seria vetor direto de acesso fora de escopo.
- Toda rota de mutação exige CSRF (padrão da Fatia 3) e gera evento de
  auditoria atômico (§9).
- Recurso fora do escopo do ator responde **404 genérico**, nunca 403 — 403
  confirmaria a existência do recurso e permitiria enumeração. Mesmo
  princípio anti-enumeração da Fatia 3 §6. O evento de auditoria interno
  registra `denied`; a resposta pública é 404.
- Parâmetro de rota **não** nomeado `id` quando o alvo não for um
  `AccessUser` — o `AuthorizationGuard` resolve `request.params.id` como
  usuário-alvo; usar `:companyId`/`:unitId` evita esse acoplamento (lição
  já registrada na implementação da Fatia 4).

## 11. Estratégia de testes

- **Unidade:** avaliador RBAC/ABAC estendido (cada célula da matriz §8,
  positiva e negativa); regras de unicidade por escopo; regras de
  inativação (R-INA-1..5); imutabilidade de `code` e de `company`.
- **Integração (Testcontainers, padrão das Fatias 2–4):** CRUD real contra
  PostgreSQL efêmero; unicidade no escopo correto; recusa de referência
  cruzando empresa (R5); ausência de rota de exclusão.
- **Autorização (prova negativa real):**
  - Para cada papel fora da matriz, prova de 403 — inclusive `colaborador`
    (sem acesso) e `dp`/`gestor`/`financeiro` (sem escrita).
  - Ator de uma empresa não lê, não altera e não inativa entidade de outra
    empresa, em **toda** rota que aceita identificador; resposta **404**,
    nunca 403 nem 200.
  - **Bootstrap administrativo (obrigatória):** prova de que o
    `admin_tecnico` de bootstrap (sem empresa atribuída) continua
    conseguindo criar a primeira empresa e atribuir o primeiro escopo,
    exercendo a exceção temporária aprovada (O3, Emenda 1 da ADR 0005) —
    e que cada uso desse acesso amplo gera evento de auditoria com escopo
    efetivo.
  - `auditor` e `dpo` **não** são provisionados nesta fatia (O3, §5) — sem
    teste de escopo para esses papéis até que DP-7 seja resolvida.
  - Tentativa fora de escopo gera evento `denied` na trilha.
- **Auditoria:** cada evento do §9 é gerado com ator, escopo e `request_id`
  corretos; atomicidade comprovada por **rollback real** (criação/alteração/
  inativação revertem por completo quando a persistência do evento falha) —
  mesmo padrão já implementado na Fatia 4.
- **Vazamento:** nenhuma resposta de erro do módulo contém stack trace, SQL,
  nome de tabela ou detalhe interno.
- **Dados:** exclusivamente técnicos/sintéticos. Nenhum dado real de RH em
  teste, em nenhuma hipótese.

## 12. Aceite, riscos, dependências, decisões pendentes e arquivos previstos

### Critérios objetivos de aceite (desta especificação)

- [x] Decisões de modelagem (D1-D8/QT-1, antigas DP-1, DP-2, DP-3, DP-5,
      DP-6, DP-10) resolvidas com o produto — **Baseline V1, aprovada em
      2026-08-06**. Registro completo em
      [docs/decisions/etapa1-modelagem-organizacional-pendente.md](../decisions/etapa1-modelagem-organizacional-pendente.md)
      e em [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md).
- [x] Escopo de `admin_tecnico` decidido (O3) — exceção temporária
      aprovada em 2026-08-06 (Emenda 1, ADR 0005). O escopo de `auditor` e
      `dpo` **permanece pendente** (DP-7, restrita a esses dois papéis) e
      bloqueia o primeiro provisionamento deles, não a implementação da
      estrutura organizacional em si.
- [ ] Revisão de segurança confirma que nenhum campo do modelo (§3), se
      implementado literalmente, permite acesso fora do escopo de empresa
      ou introduz dado pessoal não declarado.
- [ ] Confirmação de DPO de que esta fatia não introduz dado pessoal de
      colaborador (§7), incluindo a borda de CNPJ (DP-4, ainda pendente —
      fora da Baseline V1).

### Critérios de aceite (da futura implementação, para registro)

- [ ] Nenhuma rota `DELETE` em entidade organizacional.
- [ ] Teste automatizado prova que o bootstrap administrativo continua
      funcionando com a exceção temporária de `admin_tecnico` (O3, Emenda 1
      da ADR 0005), e que cada uso do acesso amplo gera evento de auditoria
      com escopo efetivo.
- [ ] Teste automatizado prova negação fora de escopo em toda rota com
      identificador, com resposta 404 — para os papéis sujeitos a escopo de
      empresa (`rh`, `dp`, `gestor`, `financeiro`).
- [ ] `auditor` e `dpo` não são provisionáveis por nenhum fluxo desta fatia
      até que DP-7 seja resolvida.
- [ ] Teste automatizado prova que inativação com filhos ativos é sempre
      recusada, nunca em cascata (Baseline V1, item 7).
- [ ] Teste automatizado prova ausência de `department_id`/`area_id` em
      `AuthorizationSubject` e em `audit_event` (Baseline V1, item 2).
- [ ] Toda mutação organizacional é atômica com seu evento de auditoria,
      com rollback comprovado.
- [ ] Nenhuma coluna `tenant_id`, política de RLS multitenant ou migration
      retroativa foi introduzida (decisão aprovada 2).
- [ ] MFA implementado antes de qualquer piloto com dados reais ou produção
      (ADR 0003, inalterado).

### Riscos

- **RI-1 — Retrabalho por modelagem decidida por suposição.** (Resolvido)
  A modelagem (departamento, área, equipe, cargo, centro de custo,
  hierarquia) foi aprovada como Baseline V1 (2026-08-06), antes de
  qualquer commit de schema — o risco de reverter migração cara depois de
  dado real não se materializa mais para essas decisões. Risco
  remanescente, menor: nomenclatura final de tabelas/colunas (DP-9) ainda
  não fechada, mas não é destrutiva de reverter (renomear coluna é
  migration simples, não redesenho de relação).
- **RI-2 — Implementação futura precisa preservar o bootstrap
  administrativo e auditar todo acesso amplo.** A exceção temporária de
  `admin_tecnico` (O3, Emenda 1 da ADR 0005) elimina o risco de regressão
  de autorização sobre esse papel — o comportamento hoje mergeado já está
  alinhado à decisão aprovada, nenhuma mudança é exigida nele. O risco
  remanescente é de **implementação**, não de autorização já decidida: a
  Etapa 1 precisa (a) preservar o funcionamento do bootstrap administrativo
  tal como existe hoje (`admin_tecnico` sem empresa atribuída, capaz de
  criar a primeira empresa e atribuir o primeiro escopo) e (b) garantir que
  todo uso do acesso administrativo amplo — inclusive sobre as novas
  entidades organizacionais — gere evento de auditoria com o escopo efetivo
  utilizado (§9). Mitigação: teste de regressão que prove que o bootstrap
  continua funcionando após a implementação (§11), e que cada ação de
  `admin_tecnico` sobre estrutura organizacional é auditada. O escopo de
  `auditor`/`dpo` permanece risco separado, coberto pela pendência DP-7,
  restrita a esses dois papéis — não bloqueia a implementação da estrutura
  organizacional em si, mas bloqueia o primeiro provisionamento deles.
- **RI-3 — Retrabalho na evolução comercial.** Não introduzir multitenancy
  agora significa que a comercialização futura exigirá migration aditiva e
  backfill. Risco **aceito conscientemente** (ADR 0005): antecipar
  multitenancy custaria complexidade permanente para um requisito que ainda
  não existe. Gates registrados em §13.
- **RI-4 — Nome de entidade contendo dado pessoal** por decisão operacional
  (§7). Risco residual aceito; não há validação de conteúdo prevista.
- **RI-5 — MFA continua adiado.** Risco aceito já registrado (ADR 0003);
  esta fatia não o altera nem o agrava. Obrigatório antes de piloto com
  dados reais ou produção.

### Dependências

- Fatias 3 e 4 mergeadas em `main` — **satisfeita**.
- Decisão de escopo de `admin_tecnico` (O3) — **satisfeita** em 2026-08-06
  (Emenda 1, ADR 0005).
- Decisões de modelagem (D1-D8/QT-1) — **satisfeitas** em 2026-08-06
  (Baseline V1). Não bloqueiam mais a fase Implementar.
- DP-4 (CNPJ) e DP-9 (nomenclatura final) — pendências residuais, não
  bloqueantes da estrutura em si; DP-4 bloqueia especificamente a inclusão
  de identificador fiscal em `company`.
- DP-7 (escopo de `auditor`/`dpo`) bloqueia só o primeiro provisionamento
  desses dois papéis, não a implementação da estrutura organizacional.
- Extensão do enum `AuditAction` por migration aditiva (§9) — dependência
  técnica da implementação.
- Rastreabilidade com o PRD do Notion — pendência da **próxima fatia
  funcional** (O1), não desta.

### Decisões pendentes

Decisões de modelagem D1-D8/QT-1 (antigas DP-1, DP-2, DP-3, DP-5, DP-6,
DP-10) foram **resolvidas pela Baseline V1** (2026-08-06) e removidas
desta tabela como bloqueio — ver
[docs/decisions/etapa1-modelagem-organizacional-pendente.md](../decisions/etapa1-modelagem-organizacional-pendente.md)
para o registro completo. Restam:

| ID   | Decisão                                                                                                                                                                                                                                              | Responsável             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| DP-4 | Incluir CNPJ em `company` — e impacto LGPD (MEI) (§7)                                                                                                                                                                                                | DPO + jurídico          |
| DP-7 | Escopo de acesso de `auditor`/`dpo` quando forem provisionados (O3) — `admin_tecnico` resolvido em 2026-08-06, ver Emenda 1 da ADR 0005; bloqueia o **primeiro provisionamento** desses dois papéis, não a implementação da estrutura organizacional | Produto + Segurança     |
| DP-8 | Escopo exato de leitura do `gestor` sem entidade de colaborador (§8) — princípio de não antecipação já resolvido (Baseline V1, item 8); resta só a pergunta "escopo por equipe?"                                                                     | Produto (fatia futura)  |
| DP-9 | Nomenclatura final de entidades e campos (pt-BR vs. en); conceitos já resolvidos (Baseline V1)                                                                                                                                                       | Time de desenvolvimento |

### Arquivos previstos para a fase Implementar (não criados agora)

```text
apps/api/prisma/schema.prisma                          # models organizacionais
apps/api/prisma/migrations/<timestamp>_nucleo_organizacional/
apps/api/src/organization/organization.module.ts
apps/api/src/organization/company/                     # service, controller, dto
apps/api/src/organization/unit/
apps/api/src/organization/department/
apps/api/src/organization/area/
apps/api/src/organization/team/
apps/api/src/organization/job-role/
apps/api/src/organization/cost-center/
apps/api/src/auth/authorization/permission.types.ts    # (alteração) novos recursos
apps/api/src/auth/authorization/rbac.evaluator.ts      # (alteração) escopo de empresa p/ admin_tecnico/auditor/dpo (decisão 4)
apps/api/src/audit/audit.types.ts                      # (alteração) novos AuditResource/AUDIT_ACTIONS
apps/api/test/organization.e2e-spec.ts
apps/api/test/organization-scope.e2e-spec.ts           # prova negativa de escopo de empresa
```

## 13. Evolução comercial futura

A comercialização para múltiplas empresas clientes **não é requisito de
implementação agora** (ADR 0005). O desenho desta fatia preserva a
possibilidade — `company` já é a raiz do escopo, e a estrutura abaixo dela
não pressupõe deployment de cliente único — mas **nenhuma implementação é
antecipada**.

Quando a comercialização for aprovada, ela exige **etapa própria**, com
estes gates (sem desenho detalhado aqui):

1. **ADR específica** de multitenancy, com alternativas de isolamento e
   trade-offs avaliados.
2. **Modelagem de tenant** e definição do discriminador de isolamento.
3. **Migration aditiva**, nunca destrutiva, sobre as tabelas existentes.
4. **Plano de backfill** para dados já existentes.
5. **Testes de isolamento** entre tenants, com prova negativa real.
6. **Revisão de segurança e LGPD específica** — dado de cliente terceiro
   tem base legal, finalidade e retenção distintas de dado interno; nada
   dessa análise está concluído nesta fatia.
7. **Reavaliação do escopo dos papéis** `admin_tecnico`/`auditor`/`dpo`
   diante da fronteira de tenant.

Nenhum desses itens é iniciado nesta fatia. Antecipá-los introduziria
complexidade permanente por um requisito que ainda não existe.
