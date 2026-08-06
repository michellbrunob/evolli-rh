# Etapa 1 — Núcleo Organizacional Multitenant

Status: **especificação — aguardando aprovação** (nenhum código, migration,
schema, endpoint, dependência ou infraestrutura criado nesta fase)

Fase do rito SDD: **Especificar**. Este documento cobre apenas o primeiro
passo de Especificar → Aprovar → Implementar → Verificar → Registrar.

Depende de: [Etapa 0 — Fatia 3 (identidade, sessão e autorização)](etapa0-fatia3-identidade-acesso.md),
[Etapa 0 — Fatia 4 (auditoria formal)](etapa0-fatia4-auditoria-formal.md),
[ADR 0001](../adr/0001-fundacao-api.md), [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md),
[ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
[ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) — todas já
integradas em `main`.

## 0. Divergências e bloqueios identificados antes de especificar

Estas divergências foram **encontradas, não resolvidas**. Nenhuma foi
decidida por suposição — cada uma exige decisão explícita antes da fase
Implementar (ver §12, decisões pendentes).

### D1 — PRD "Sistema RH - Reserva Fiscal" não está no repositório

O PRD foi declarado fonte **complementar e obrigatória** de requisitos
(§2). Uma busca no repositório não encontrou nenhum arquivo de PRD:

```text
$ find . -iname "*PRD*" -o -iname "*Reserva*Fiscal*"   # (excluindo node_modules)
(nenhum resultado)
```

**Consequência:** esta especificação foi escrita a partir das fontes
técnicas disponíveis (`PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`, ROADMAP,
ADRs 0001–0004, specs das Fatias 3 e 4). Nenhum requisito foi inferido,
inventado ou atribuído ao PRD. Onde o PRD normalmente decidiria uma
questão de modelagem (cardinalidade, catálogo por empresa vs. por tenant,
identificadores fiscais), a questão está registrada como **decisão
pendente**, com alternativas objetivas — nunca preenchida por suposição.

**Bloqueio de aceite:** esta especificação não pode ser considerada
completa até que o PRD seja disponibilizado no repositório e confrontado
com as decisões pendentes do §12.

### D2 — Escopo da Etapa 1 diverge do roadmap vigente

O roadmap oficial define a Etapa 1 de forma mais ampla do que o escopo
solicitado para esta especificação:

| Fonte                                      | Escopo declarado da Etapa 1                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `docs/ROADMAP.md` (linha 10)               | "Core organizacional: empresas, unidades, cargos, vínculos **e colaboradores**"                                      |
| `PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md` §5 | "empresa/unidade/departamento/cargo, **pessoas, vínculos CLT/estágio/PJ, colaboradores, perfis e dados cadastrais**" |
| Escopo desta especificação                 | Só estrutura organizacional — **sem** colaborador, pessoa, vínculo ou dado cadastral pessoal                         |

**Registro da divergência:** o escopo desta especificação é
deliberadamente **menor** que o da Etapa 1 do roadmap. Colaboradores,
pessoas e vínculos permanecem previstos, mas fora desta especificação.

**Alternativas objetivas** (a decidir, §12):

- **(a)** Tratar esta spec como "Etapa 1 — Fatia 1 (estrutura
  organizacional)", com colaboradores/vínculos em uma Fatia 2 própria da
  mesma etapa. Mantém o roadmap intacto; só detalha o fatiamento interno.
- **(b)** Atualizar `docs/ROADMAP.md` para refletir o novo recorte,
  movendo colaboradores/vínculos para uma etapa própria.

Nenhuma das duas foi aplicada aqui — alterar `docs/ROADMAP.md` está fora
do escopo desta entrega (restrição: nenhum arquivo além deste markdown).
A recomendação técnica é **(a)**, por não exigir renumeração do roadmap.

### D3 — "Multiempresa" (fontes vigentes) vs. "multitenant" (escopo pedido)

Toda a fundação já entregue trata isolamento como **multiempresa**
(`company_id`), não multitenant:

- `PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md` §1: "multiempresa e modular".
- ADR 0003 §8: `company_id`/`unit_id`/`team_id` em `access_user`, sem
  camada acima de empresa.
- `rbac.evaluator.ts`: `isSameCompany(subject, target)` — a maior
  granularidade de escopo hoje é a empresa; `admin_tecnico` tem escopo
  "instância inteira".
- `audit_event`: `company_id`/`unit_id`/`team_id`, sem `tenant_id`.

Introduzir um **tenant acima de empresa** (cliente comercial que agrupa
várias empresas) é uma **mudança arquitetural nova**, não uma
continuação. Ela é o objeto central da proposta de ADR 0005 (§13) e tem
impacto retroativo em duas tabelas já mergeadas (`access_user`,
`audit_event`) e no avaliador RBAC/ABAC — ver §5 e §12.

### D4 — Escopo cross-tenant de `admin_tecnico`, `auditor` e `dpo`

Consequência direta de D3, com impacto de segurança:

| Papel           | Escopo hoje (Fatias 3/4, em produção)        | Pergunta aberta em multitenant                                        |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| `admin_tecnico` | Instância inteira                            | Operador da plataforma (vê todos os tenants) ou escopado a um tenant? |
| `auditor`       | Trilha de auditoria de **todas as empresas** | Todos os tenants, ou só o próprio tenant?                             |
| `dpo`           | Trilha de auditoria de **todas as empresas** | Todos os tenants, ou só o próprio tenant?                             |

Se `auditor`/`dpo` permanecerem com o escopo literal de hoje ("todas as
empresas"), em multitenant isso passa a significar **leitura cross-tenant
da trilha de auditoria** — provavelmente indesejado, e uma regressão de
isolamento introduzida sem decisão explícita. Registrado como decisão
pendente prioritária (§12, DP-1). Esta especificação **não** altera a
matriz das Fatias 3/4 por conta própria.

## 1. Objetivo, escopo e fora de escopo

### Objetivo

Especificar o núcleo organizacional multitenant do Evolli RH: as
entidades de estrutura (tenant, empresa, unidade, departamento, equipe,
cargo, centro de custo), suas regras de integridade, o modelo de
isolamento entre tenants e a matriz de autorização correspondente — de
forma que Colaboradores, Portal do Gestor, Documentos, Ponto, Dashboard e
demais módulos futuros tenham um esqueleto organizacional estável para
referenciar, com isolamento e auditoria garantidos desde o primeiro CRUD.

### Escopo — entra (nesta especificação)

- Modelo conceitual das entidades organizacionais, sem migration (§3).
- Definições, cardinalidades e regras de inativação (§4).
- Estratégia de isolamento multitenant, com alternativas e trade-offs (§5).
- Regras de integridade: código, nome, unicidade, status, referências,
  proibição de exclusão física (§6).
- Classificação de dados e confirmação LGPD (§7).
- Matriz de acesso por papel, escopo e ação, compatível com o RBAC/ABAC
  já implementado (§8).
- Eventos obrigatórios de auditoria (§9).
- Contratos de API futuros, sem criar endpoint (§10).
- Estratégia de testes (§11).
- Critérios de aceite, riscos, dependências, decisões pendentes e
  arquivos previstos (§12).
- Proposta de ADR 0005, descrita dentro deste documento, **sem criar o
  arquivo da ADR** (§13).

### Escopo — não entra

- **Nenhum artefato de implementação**: código, migration, `schema.prisma`,
  endpoint, DTO, guard, dependência, infraestrutura, interface, PR ou
  merge. Esta fase é só documento.
- **Nenhuma entidade de colaborador, pessoa ou vínculo** (CLT, estágio,
  PJ) — a relação gestor/subordinado é apenas _prevista_ (§3.8), sem
  entidade que a materialize nesta etapa.
- **Nenhum dado trabalhista, legal, fiscal, financeiro ou de benefício** —
  centro de custo entra como rótulo organizacional, explicitamente **sem**
  integração financeira, contábil ou orçamentária (§3.7).
- **Nenhum requisito ausente das fontes disponíveis** — ver D1.
- **Nenhuma alteração da matriz de acesso das Fatias 3/4** — só extensão
  para os recursos novos (§8); mudanças no escopo de papéis existentes
  ficam como decisão pendente (D4/DP-1).
- **MFA TOTP** — decisão vigente inalterada: adiado da demonstração, mas
  **obrigatório antes de qualquer piloto com dados reais ou produção**
  (ADR 0003 decisão 3). Esta etapa não implementa nem altera isso; herda
  a obrigação como pré-condição de piloto.
- Hierarquia organizacional recursiva de profundidade arbitrária (ex.:
  departamento dentro de departamento, N níveis) — ver DP-4.

## 2. Relação com o PRD e com o roadmap

- **PRD "Sistema RH - Reserva Fiscal"**: fonte **complementar e
  obrigatória** de requisitos funcionais, de segurança, de LGPD e de
  critérios de aceite. Não é documento acessório nem de prioridade menor
  que o roadmap técnico.
- **Roadmap do Evolli RH** (`docs/ROADMAP.md`, plano mestre §5): define a
  **ordem técnica de implementação** por dependência — não sobrepõe nem
  rebaixa requisito registrado no PRD.
- **Conflitos são registrados como decisão explícita**, nunca resolvidos
  por suposição nem rebaixados silenciosamente: quem decidiu, por quê, o
  que foi priorizado e o que ficou para depois. As divergências já
  encontradas estão em §0 (D1–D4) e §12.
- **Estado atual desta relação:** o PRD não está disponível no
  repositório (D1). Portanto **nenhum requisito desta especificação foi
  derivado do PRD** — todos vêm das fontes técnicas versionadas. A
  confrontação spec × PRD é um item de aceite pendente (§12), não uma
  etapa já cumprida.

## 3. Modelo conceitual (sem migration)

Rascunho conceitual, para revisão — **nenhuma migration, nenhum model
Prisma criado nesta fase**. Nomes de entidade e de campo são propostas de
trabalho, não contrato fechado (ver DP-8).

Convenção: `[PK]` chave; `[FK]` referência; `[U]` participa de restrição
de unicidade (§6); `?` opcional.

### 3.1 `tenant` — cliente comercial

```text
tenant
  id            [PK]  identificador não sequencial previsível (mesmo padrão
                      de UUID já usado desde a Fatia 3)
  code          [U]   código curto, estável, imutável após criação
  name                razão social/nome comercial do cliente
  status              enum fechado: active | suspended | inactive
  created_at / updated_at
```

Raiz do isolamento. **Todo** dado organizacional (e, em etapas futuras,
todo dado de RH) pertence a exatamente um tenant, direta ou
transitivamente (§5).

### 3.2 `company` — empresa

```text
company
  id            [PK]
  tenant_id     [FK] -> tenant
  code          [U] (único dentro do tenant)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

Pessoa jurídica do cliente. Um tenant pode ter várias empresas (grupo
econômico); uma empresa pertence a exatamente um tenant e **nunca** é
movida entre tenants (§6, R7).

**Identificador fiscal (CNPJ) não está incluído** — decisão pendente
DP-6, por dois motivos: (a) não há requisito de PRD que o exija (D1);
(b) CNPJ de MEI/empresário individual pode ser associável a pessoa
física, o que muda a classificação LGPD desta etapa (§7).

### 3.3 `unit` — unidade

```text
unit
  id            [PK]
  tenant_id     [FK] -> tenant        (desnormalizado, ver §5)
  company_id    [FK] -> company
  code          [U] (único dentro da empresa)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

Estabelecimento/filial/local de uma empresa.

### 3.4 `department` — departamento ou área

```text
department
  id            [PK]
  tenant_id     [FK] -> tenant        (desnormalizado, ver §5)
  company_id    [FK] -> company
  unit_id       [FK] -> unit  ?       (ver DP-2)
  code          [U] (escopo de unicidade depende de DP-2)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

**DP-2 (decisão pendente):** departamento pertence à **empresa**
(atravessando unidades) ou à **unidade**? As duas modelagens são comuns e
não equivalentes:

- **(a) Departamento por empresa** (`unit_id` ausente): "Financeiro" é um
  só, presente em várias unidades. Unicidade de `code` por empresa.
- **(b) Departamento por unidade** (`unit_id` obrigatório): cada unidade
  tem seu próprio "Financeiro". Unicidade de `code` por unidade.
- **(c) Híbrido** (`unit_id` opcional, como acima): departamento
  corporativo quando nulo, local quando preenchido. Mais flexível, mas
  torna a regra de unicidade e a de escopo de acesso mais complexas.

Não decidido aqui — depende do PRD/RH. O rascunho acima registra a opção
(c) apenas para tornar a ambiguidade visível, **não** como escolha.

### 3.5 `team` — equipe

```text
team
  id            [PK]
  tenant_id     [FK] -> tenant        (desnormalizado, ver §5)
  company_id    [FK] -> company
  department_id [FK] -> department ?  (ver DP-3)
  unit_id       [FK] -> unit ?        (ver DP-3)
  code          [U] (escopo de unicidade depende de DP-3)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

**DP-3 (decisão pendente):** equipe pertence a departamento, a unidade,
ou a ambos? Mesma natureza de ambiguidade da DP-2, não decidida aqui.

### 3.6 `job_role` — cargo/função

```text
job_role
  id            [PK]
  tenant_id     [FK] -> tenant
  company_id    [FK] -> company ?     (ver DP-5)
  code          [U] (escopo de unicidade depende de DP-5)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

Catálogo de cargos/funções. **Sem** faixa salarial, CBO, jornada,
requisito legal ou qualquer atributo trabalhista/fiscal — todos fora de
escopo (§1).

**DP-5 (decisão pendente):** o catálogo de cargos é **por tenant**
(compartilhado entre as empresas do grupo) ou **por empresa**? Impacta
unicidade e reuso.

### 3.7 `cost_center` — centro de custo (opcional)

```text
cost_center
  id            [PK]
  tenant_id     [FK] -> tenant
  company_id    [FK] -> company
  code          [U] (único dentro da empresa)
  name
  status              enum fechado: active | inactive
  created_at / updated_at
```

Rótulo organizacional **opcional**, sem integração financeira, contábil
ou orçamentária nesta etapa (restrição explícita §1). Nenhum valor
monetário, rateio, plano de contas ou vínculo com sistema financeiro
externo entra aqui. A associação entre centro de custo e as demais
entidades organizacionais é decisão pendente (DP-7).

### 3.8 Relação gestor ↔ subordinado (prevista, não materializada)

**Nenhuma entidade de colaborador é criada nesta etapa** (restrição §1).
A relação gestor/subordinado é apenas _antecipada no desenho_, para que a
estrutura organizacional não precise ser redesenhada quando
Colaboradores existir:

- Cada nó organizacional (`unit`, `department`, `team`) é o **ponto de
  ancoragem previsto** para uma futura referência de responsável/gestor.
- Essa referência **não existe como campo nesta etapa** — seria uma FK
  para uma entidade (colaborador/pessoa) que ainda não foi especificada,
  e criá-la agora seria especular sobre a modelagem da etapa seguinte
  (mesmo princípio que a ADR 0003 §8 já aplicou ao manter
  `access_user` desacoplado de colaborador).
- Quando Colaboradores for especificado, a ligação entra por migration
  aditiva própria, revisada naquele momento.
- Consequência aceita: **nesta etapa não é possível responder "quem é o
  gestor desta equipe"** — a estrutura existe, o responsável não. Isso é
  esperado, não uma lacuna.

## 4. Definições, cardinalidades e regras de inativação

### Cardinalidades propostas

| Relação                   | Cardinalidade | Observação                                             |
| ------------------------- | ------------- | ------------------------------------------------------ |
| tenant → company          | 1:N           | Empresa pertence a exatamente um tenant, imutável (R7) |
| company → unit            | 1:N           | Unidade pertence a exatamente uma empresa              |
| company → department      | 1:N           | Sujeito a DP-2                                         |
| unit → department         | 1:N ou N/A    | Depende de DP-2                                        |
| department → team         | 1:N ou N/A    | Depende de DP-3                                        |
| company/tenant → job_role | 1:N           | Depende de DP-5                                        |
| company → cost_center     | 1:N           | Associação a outras entidades: DP-7                    |

Nenhuma relação N:N é proposta nesta etapa. Uma entidade organizacional
**nunca** pertence a dois pais do mesmo tipo.

### Regras de inativação

- **R-INA-1 — Inativação, nunca exclusão física.** Toda entidade
  organizacional tem `status` (`active` | `inactive`; `tenant` também
  admite `suspended`). "Remover" é sempre transição para `inactive`
  (§6, R6).
- **R-INA-2 — Inativação em cascata é explícita, nunca implícita.**
  Inativar uma empresa **não** inativa silenciosamente suas unidades. A
  operação deve ou (a) recusar enquanto houver filhos ativos, ou (b)
  exigir confirmação explícita de cascata que gera evento de auditoria
  **por entidade afetada** (§9). A escolha entre (a) e (b) é DP-9.
- **R-INA-3 — Entidade inativa não aceita novos vínculos.** Criar uma
  unidade sob empresa inativa, ou vincular algo a um nó inativo, é
  rejeitado.
- **R-INA-4 — Vínculos preexistentes sobrevivem à inativação.**
  Inativar não quebra referências já criadas — o histórico continua
  legível e auditável.
- **R-INA-5 — Reativação é operação explícita e auditada**, sujeita às
  mesmas regras de integridade da criação (ex.: unicidade de código
  ainda válida no escopo).
- **R-INA-6 — Tenant suspenso bloqueia escrita, preserva leitura.**
  `suspended` (suspensão comercial) impede operações de escrita no
  tenant, sem apagar nem ocultar dado — distinto de `inactive`.
  Semântica exata e efeitos sobre sessões ativas: DP-10.

## 5. Estratégia de isolamento multitenant

### Princípio

**Todo dado organizacional pertence a um tenant. Acesso entre tenants é
negado por padrão** — extensão direta do princípio de negação por padrão
já vigente desde a ADR 0002 (menor privilégio no banco) e a ADR 0003
(RBAC/ABAC deny-by-default).

O isolamento é avaliado **antes** de qualquer regra de papel: um ator do
tenant A nunca alcança dado do tenant B, **independentemente do papel**
— inclusive papéis hoje descritos como "todas as empresas" (D4/DP-1).

### `tenant_id` desnormalizado em toda entidade

Toda entidade organizacional carrega `tenant_id` diretamente, mesmo
quando ele seria derivável por join (`unit → company → tenant`). Motivos:

- Permite filtro de isolamento **na própria consulta**, sem depender de
  join correto em cada query nova — reduz a chance de um `WHERE`
  esquecido virar vazamento cross-tenant.
- É pré-requisito de qualquer política de Row-Level Security (opção B
  abaixo), que precisa do discriminador na própria linha.
- Custo: `tenant_id` precisa ser mantido consistente com o pai — exige
  restrição de integridade que o impeça de divergir (ver R8, §6).

### Alternativas de enforcement (a decidir — ADR 0005)

| Opção                                       | Como funciona                                                                                     | A favor                                                                          | Contra                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Filtro na aplicação**                 | Toda query inclui `tenant_id` do ator; repositório/serviço central garante                        | Simples; sem infraestrutura nova; direto no Prisma                               | Garantia só no código — uma query nova sem filtro vaza; contradiz o precedente da ADR 0004 (append-only garantido no banco, não só no código) |
| **B — PostgreSQL Row-Level Security (RLS)** | Política `USING (tenant_id = current_setting('app.tenant_id'))`; sessão de banco carrega o tenant | Garantia **no banco**: uma query esquecida não vaza; mesma filosofia da ADR 0004 | Exige `SET LOCAL` por transação; interação não trivial com pooling do Prisma; custo operacional e de teste real                               |
| **C — Schema por tenant**                   | Um schema PostgreSQL por cliente                                                                  | Isolamento forte                                                                 | Migrations multiplicadas por tenant; operacionalmente pesado; conflita com "dependência mínima"                                               |
| **D — Banco por tenant**                    | Uma instância/base por cliente                                                                    | Isolamento máximo                                                                | Custo e complexidade desproporcionais para a escala atual                                                                                     |

**Recomendação técnica desta especificação: A + B combinados** — filtro na
aplicação como caminho normal, RLS como rede de segurança que torna o
vazamento impossível mesmo com erro de código. É a opção mais coerente
com o precedente já aceito na ADR 0004 §1 (o `REVOKE UPDATE/DELETE` de
`audit_event` foi colocado na própria migration justamente para que a
garantia não dependesse de disciplina de código nem de etapa manual).

**Não decidido aqui.** C e D ficam descartados por desproporção, mas a
escolha entre A isolado e A+B é objeto da ADR 0005 (§13) — depende de
validação de custo operacional com TI e de prova de compatibilidade com o
pooling do Prisma.

### Impacto retroativo em tabelas já mergeadas

Consequência de D3, a tratar na fase Implementar:

| Tabela                 | Situação hoje                                                                              | Impacto                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `access_user`          | `company_id`/`unit_id`/`team_id` como texto, **sem FK** (ADR 0003 §8), **sem `tenant_id`** | Precisa de `tenant_id`; o escopo do ator passa a ser resolvido contra entidades reais             |
| `audit_event`          | `company_id`/`unit_id`/`team_id`, **sem `tenant_id`**                                      | Precisa de `tenant_id` para que a trilha seja consultável e isolada por tenant                    |
| `AuthorizationSubject` | `{ userId, role, companyId }`                                                              | Precisa de `tenantId` (e provavelmente `unitId`/`departmentId`/`teamId`) para ABAC organizacional |
| `rbac.evaluator.ts`    | `isSameCompany()` é a maior granularidade                                                  | Precisa de checagem de tenant **antes** da de empresa                                             |

Migrations sobre `access_user`/`audit_event` são **aditivas**; nenhuma
coluna existente é removida ou renomeada. Estratégia de preenchimento do
`tenant_id` para linhas preexistentes (backfill) é DP-11.

## 6. Regras de integridade

- **R1 — Código obrigatório, estável e imutável.** Toda entidade tem
  `code` curto, obrigatório, imutável após a criação. Renomear é operação
  de `name`, nunca de `code` — código é o identificador estável para
  integrações e referências futuras.
- **R2 — Unicidade sempre no escopo correto, nunca global.**
  `tenant.code` é único globalmente; `company.code` é único **dentro do
  tenant**; `unit.code` dentro da empresa; demais escopos dependem de
  DP-2/DP-3/DP-5. Unicidade global de código de empresa seria vazamento
  de informação entre tenants (permitiria inferir a existência de um
  cliente por colisão de código).
- **R3 — Nome obrigatório, não único.** Dois departamentos podem se
  chamar "Financeiro" em unidades diferentes; a distinção é por `code` e
  escopo.
- **R4 — Status por enum fechado**, nunca texto livre — mesmo padrão de
  `AccessUserStatus` (Fatia 3) e `AuditAction`/`AuditResult` (Fatia 4).
- **R5 — Toda referência aponta para entidade do mesmo tenant.** Uma
  unidade nunca referencia empresa de outro tenant. Deve ser garantido
  por restrição de banco, não só por validação de aplicação (ver R8).
- **R6 — Proibição de exclusão física quando houver vínculo.** Nenhum
  `DELETE` é exposto por API. Mesmo sem vínculos atuais, entidades
  organizacionais são referenciadas por eventos de auditoria já gravados
  (append-only, ADR 0004) — apagar a entidade tornaria a trilha
  ininterpretável. A operação de "remoção" é sempre inativação (§4).
- **R7 — Tenant de uma entidade é imutável.** Uma empresa nunca migra de
  tenant. Movimentação entre clientes comerciais, se um dia necessária, é
  processo próprio com ADR e trilha dedicada — não um `UPDATE`.
- **R8 — Consistência do `tenant_id` desnormalizado.** O `tenant_id` de
  uma entidade filha deve ser sempre igual ao do pai. Precisa ser
  garantido estruturalmente (ex.: FK composta `(id, tenant_id)` no pai e
  `(company_id, tenant_id)` na filha), não por validação de aplicação —
  caso contrário o campo que existe para prevenir vazamento vira ele
  mesmo uma fonte de inconsistência. Técnica exata: DP-12.
- **R9 — Hierarquia acíclica e de profundidade fixa.** Nenhuma entidade
  é ancestral de si mesma. Profundidade recursiva arbitrária está fora de
  escopo (DP-4).

## 7. Classificação de dados e LGPD

### Confirmação

**Esta etapa não introduz dado pessoal de colaborador.** Todas as
entidades especificadas (§3) são estrutura organizacional: identificadores
técnicos, códigos, nomes de unidade/departamento/equipe/cargo e status.
Nenhum CPF, nome de pessoa física, endereço, contato pessoal, dado de
saúde, salário, documento ou dado de dependente entra aqui.

| Dado                                            | Classificação                    | Observação                                                                 |
| ----------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `tenant.name` (razão social do cliente)         | Dado de pessoa jurídica          | Não é dado pessoal, salvo o caso de MEI/empresário individual (ver bordas) |
| `company.name`, `unit.name`                     | Pessoa jurídica / organizacional | —                                                                          |
| `department.name`, `team.name`, `job_role.name` | Organizacional                   | —                                                                          |
| `cost_center.name`/`code`                       | Organizacional                   | Sem valor monetário (§3.7)                                                 |
| `status`, `code`, timestamps                    | Técnico                          | —                                                                          |

### Bordas registradas (não resolvidas)

- **CNPJ (DP-6):** não incluído nesta especificação. Se vier a ser
  incluído, o caso de MEI/empresário individual torna o identificador
  potencialmente associável a pessoa física — o que mudaria a afirmação
  acima e exigiria revisão de DPO. Por isso a inclusão é decisão
  pendente, não omissão.
- **Nome de entidade contendo nome de pessoa:** nada impede
  operacionalmente que um cliente nomeie uma equipe como "Equipe do
  João". Isso não é um campo de dado pessoal por desenho, e a
  especificação não prevê validação de conteúdo — registrado como risco
  residual (§12, RI-5), não como controle.
- **Auditoria organizacional (§9)** registra ator (`access_user`) e IP —
  dado pessoal já tratado e classificado na Fatia 3 §2 e na ADR 0004;
  esta etapa não amplia esse tratamento, só gera mais eventos do mesmo
  tipo já aprovado.

### Herança de controles

Continuam valendo, sem alteração: minimização; proibição de senha, hash,
token, cookie, CSRF, CPF completo, salário e conteúdo de documento em
claro em qualquer log ou evento (ADR 0004 §5/§6); `AllExceptionsFilter`
sem vazamento de detalhe interno (ADR 0001).

## 8. Matriz inicial de acesso

Compatível com o RBAC/ABAC já implementado (`evaluatePermission` +
`AuthorizationGuard` + `@RequirePermission`, Fatia 3): os recursos abaixo
**estendem** a união `AuthorizationResource`, sem reduzir nada do que já
existe. As ações reaproveitam o vocabulário atual (`read`, `manage`,
`alter`, `create`).

### Recursos propostos

`organization_structure` (leitura da árvore organizacional),
`company`, `unit`, `department`, `team`, `job_role`, `cost_center`.

### Matriz

| Papel           | Ler estrutura | Criar/alterar/inativar | Escopo                                      |
| --------------- | ------------- | ---------------------- | ------------------------------------------- |
| `admin_tecnico` | ✅            | ✅                     | Ver DP-1 (plataforma vs. tenant)            |
| `rh`            | ✅            | ✅                     | Própria empresa, dentro do próprio tenant   |
| `dp`            | ✅            | ❌                     | Leitura na própria empresa                  |
| `gestor`        | ✅ (restrita) | ❌                     | Só os nós do próprio escopo — ver DP-13     |
| `financeiro`    | ✅ (restrita) | ❌                     | Leitura de `cost_center` e estrutura mínima |
| `colaborador`   | ❌            | ❌                     | Sem acesso à estrutura nesta etapa          |
| `auditor`       | ✅ (leitura)  | ❌                     | Ver DP-1                                    |
| `dpo`           | ✅ (leitura)  | ❌                     | Ver DP-1                                    |

### Regras invioláveis

- **A1 — Isolamento antes de papel.** A checagem de tenant precede
  qualquer regra de papel. Nenhum papel, incluindo os de leitura ampla,
  atravessa tenant sem decisão explícita (D4/DP-1).
- **A2 — Negação por padrão.** Ação não listada é negada. Recurso novo
  criado por módulo futuro nasce negado até ser adicionado à matriz.
- **A3 — Nenhuma escrita direta na trilha de auditoria** por nenhum
  papel — mantém a ADR 0004 §2 (escrita só via `AuditService`).
- **A4 — Ninguém amplia o próprio escopo organizacional.** Mesma
  proteção contra autoelevação já implementada na Fatia 3 para papel:
  um ator não move a si mesmo para um escopo mais amplo.

## 9. Eventos obrigatórios de auditoria

Toda ação sensível desta etapa é auditada via `AuditService.record()` —
**ponto único de escrita** (ADR 0004 §2), nunca `prisma.auditEvent.create()`
direto.

| Evento                             | Quando                                                                                              | `result`  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- | --------- |
| Criação de entidade organizacional | Tenant, empresa, unidade, departamento, equipe, cargo, centro de custo criados                      | `success` |
| Alteração de entidade              | Mudança de `name` ou de referência estrutural                                                       | `success` |
| Inativação / reativação            | Transição de `status`, **um evento por entidade afetada** em caso de cascata (R-INA-2)              | `success` |
| Tentativa negada                   | 403 do `AuthorizationGuard` sobre recurso organizacional, incluindo **toda** tentativa cross-tenant | `denied`  |
| Consulta relevante                 | Leitura da estrutura completa de um tenant/empresa e qualquer consulta de escopo amplo              | `success` |

### Garantias herdadas da Fatia 4 (aplicam-se sem exceção)

- **Atomicidade:** criação, alteração e inativação persistem a mudança e
  o evento **na mesma transação** — ou os dois, ou nenhum (ADR 0004 §2).
- **Best-effort na negação:** uma tentativa negada continua negada mesmo
  se o evento não puder ser gravado; só o log técnico registra a falha,
  sem segredo.
- **Sem valores antes/depois:** o evento registra `action` +
  `resource`/`resource_id`, nunca o valor de campo alterado (ADR 0004 §5,
  decisão inalterada). "O que mudou" é expresso pelo verbo da ação.
- **Append-only:** garantido por privilégio de banco na própria migration
  (ADR 0004 §1) — vale automaticamente para os eventos novos.

### Impacto técnico a considerar na implementação

- `AuditAction` é **enum de banco fechado** (ADR 0004 §5): cada verbo
  novo (ex.: `company_created`) exige **migration** para estender o enum,
  e atualização do array runtime `AUDIT_ACTIONS`. Existe teste de
  sincronia entre os dois — a divergência falha o build, por desenho.
- `AuditResource` é **união de tipos no código**: os recursos
  organizacionais entram **sem migration**.
- `audit_event` precisa de `tenant_id` para que a trilha seja isolável
  por tenant (§5) — hoje só tem `company_id`/`unit_id`/`team_id`.

## 10. Contratos de API futuros (sem criar endpoint)

Propostos, **não implementados**. Nenhum endpoint, DTO ou controller é
criado nesta fase.

| Método         | Rota (proposta, sob `/v1`)                                               | Descrição                                    | Autorização                           |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------- |
| GET            | `/v1/org/companies`                                                      | Lista empresas do tenant do ator, paginado   | `read` sobre `company`                |
| GET            | `/v1/org/companies/:companyId`                                           | Detalhe                                      | Idem                                  |
| POST           | `/v1/org/companies`                                                      | Cria empresa                                 | `create`                              |
| PATCH          | `/v1/org/companies/:companyId`                                           | Altera `name` (nunca `code`, nunca `tenant`) | `alter`                               |
| POST           | `/v1/org/companies/:companyId/deactivate`                                | Inativa (nunca exclui)                       | `manage`                              |
| GET/POST/PATCH | `/v1/org/units`, `/departments`, `/teams`, `/job-roles`, `/cost-centers` | Mesmo padrão                                 | Conforme §8                           |
| GET            | `/v1/org/tree`                                                           | Árvore organizacional do escopo do ator      | `read` sobre `organization_structure` |

### Regras de contrato

- **Nenhuma rota `DELETE`** em entidade organizacional (R6).
- **`tenant_id` nunca vem do cliente** — é sempre derivado da sessão
  autenticada. Aceitá-lo do corpo/query seria vetor direto de acesso
  cross-tenant.
- Toda rota de mutação exige CSRF (padrão da Fatia 3) e gera evento de
  auditoria atômico (§9).
- Recurso de outro tenant responde **404 genérico**, nunca 403 — 403
  confirmaria a existência do recurso e permitiria enumeração
  cross-tenant. Mesmo princípio anti-enumeração da Fatia 3 §6.
  (O evento de auditoria interno registra `denied`; a resposta pública é
  404.)
- Parâmetro de rota **não** nomeado `id` quando o alvo não for um
  `AccessUser` — o `AuthorizationGuard` resolve `request.params.id` como
  usuário-alvo; usar `:companyId`/`:unitId` evita esse acoplamento
  (lição já registrada na implementação da Fatia 4).

## 11. Estratégia de testes

- **Unidade:** avaliador RBAC/ABAC estendido (cada célula da matriz §8,
  positiva e negativa); regras de unicidade por escopo; regras de
  inativação (R-INA-1..6); imutabilidade de `code` e de `tenant`.
- **Integração (Testcontainers, padrão das Fatias 2–4):** CRUD real
  contra PostgreSQL efêmero; unicidade no escopo correto; recusa de
  referência cruzando tenant (R5/R8); ausência de rota de exclusão.
- **Autorização:** para cada papel fora da matriz, prova de 403 —
  inclusive `colaborador` (sem acesso) e `dp`/`gestor`/`financeiro` (sem
  escrita).
- **Isolamento entre tenants (obrigatório, prova negativa real):**
  - Ator do tenant A não lê, não altera e não inativa entidade do tenant
    B — em **toda** rota que aceita identificador.
  - Resposta é **404**, nunca 403 nem 200 (anti-enumeração, §10).
  - Se RLS for adotado (§5, opção B): prova a **nível de banco** de que
    uma query sem filtro de tenant não retorna linha de outro tenant —
    mesmo padrão de "prova negativa no banco" já usado na Fatia 2
    (`evolli_app` sem DDL) e na Fatia 4 (append-only).
  - Tentativa cross-tenant gera evento `denied` na trilha.
- **Auditoria:** cada evento do §9 é gerado com ator, escopo e
  `request_id` corretos; atomicidade comprovada por **rollback real**
  (criação/alteração/inativação revertem por completo quando a
  persistência do evento falha) — mesmo padrão já implementado na
  Fatia 4.
- **Vazamento:** nenhuma resposta de erro do módulo contém stack trace,
  SQL, nome de tabela ou detalhe interno.
- **Dados:** exclusivamente técnicos/sintéticos. Nenhum dado real de
  cliente ou de RH em teste, em nenhuma hipótese.

## 12. Aceite, riscos, dependências, decisões pendentes e arquivos previstos

### Critérios objetivos de aceite (desta especificação)

- [ ] PRD disponibilizado no repositório e confrontado com esta spec (D1).
- [ ] Divergência de escopo da Etapa 1 decidida — alternativa (a) ou (b) do D2.
- [ ] Introdução da camada `tenant` aprovada como decisão arquitetural (D3), com ADR 0005 criada.
- [ ] Escopo cross-tenant de `admin_tecnico`/`auditor`/`dpo` decidido (D4/DP-1) **antes** de qualquer implementação.
- [ ] Estratégia de enforcement de isolamento escolhida (§5: A ou A+B), com custo operacional validado por TI.
- [ ] Decisões pendentes de modelagem (DP-2, DP-3, DP-5, DP-6, DP-7) resolvidas com RH/DPO — nunca por suposição.
- [ ] Revisão de segurança confirma que nenhum campo do modelo (§3), se implementado literalmente, permite acesso cross-tenant ou introduz dado pessoal não declarado.
- [ ] Confirmação de DPO de que esta etapa não introduz dado pessoal de colaborador (§7), incluindo a borda de CNPJ (DP-6).

### Critérios de aceite (da futura implementação, para registro)

- [ ] Nenhuma rota `DELETE` em entidade organizacional.
- [ ] Teste automatizado prova isolamento cross-tenant em toda rota com identificador, com resposta 404.
- [ ] Toda mutação organizacional é atômica com seu evento de auditoria, com rollback comprovado.
- [ ] MFA implementado antes de qualquer piloto com dados reais ou produção (ADR 0003, inalterado).

### Riscos

- **RI-1 — Vazamento cross-tenant é a falha mais grave possível deste
  módulo.** Um `WHERE` esquecido expõe dado de um cliente a outro.
  Mitigação proposta: `tenant_id` desnormalizado + enforcement no banco
  (§5, opção B) + prova negativa automatizada (§11).
- **RI-2 — Escopo cross-tenant herdado de `auditor`/`dpo`** (D4) pode
  virar regressão silenciosa de isolamento se a matriz das Fatias 3/4 for
  aplicada literalmente em multitenant. Mitigação: decisão explícita
  antes de implementar (DP-1).
- **RI-3 — Modelagem decidida por suposição** (DP-2/DP-3/DP-5) seria cara
  de reverter depois que houver dado real e módulos dependentes.
  Mitigação: bloquear implementação até decisão do PRD/RH.
- **RI-4 — Migration retroativa em `access_user`/`audit_event`** toca
  tabelas já em uso. Mitigação: migrations aditivas, backfill explícito
  (DP-11), nenhuma coluna removida ou renomeada.
- **RI-5 — Nome de entidade contendo dado pessoal** por decisão
  operacional do cliente (§7). Risco residual aceito; não há validação de
  conteúdo prevista.
- **RI-6 — MFA continua adiado.** Risco aceito já registrado (ADR 0003);
  esta etapa não o altera nem o agrava, mas a chegada de estrutura
  multitenant aumenta o impacto potencial de uma conta comprometida —
  reforça a obrigatoriedade de MFA antes de piloto com dado real.

### Dependências

- Fatias 3 e 4 mergeadas em `main` — **satisfeita**.
- PRD disponível — **não satisfeita** (D1), bloqueia o aceite.
- Decisões DP-1 a DP-13 — bloqueiam a fase Implementar, não a Especificar.
- Extensão do enum `AuditAction` por migration (§9) — dependência técnica
  da implementação.

### Decisões pendentes

| ID    | Decisão                                                                         | Responsável             |
| ----- | ------------------------------------------------------------------------------- | ----------------------- |
| DP-1  | Escopo de `admin_tecnico`/`auditor`/`dpo` em multitenant (D4) — **prioritária** | Produto + Segurança     |
| DP-2  | Departamento pertence a empresa, unidade ou híbrido (§3.4)                      | PRD/RH                  |
| DP-3  | Equipe pertence a departamento, unidade ou ambos (§3.5)                         | PRD/RH                  |
| DP-4  | Hierarquia recursiva de profundidade arbitrária: necessária?                    | PRD/RH                  |
| DP-5  | Catálogo de cargos por tenant ou por empresa (§3.6)                             | PRD/RH                  |
| DP-6  | Incluir CNPJ em `company`/`tenant` — e impacto LGPD (MEI)                       | DPO + jurídico          |
| DP-7  | A que entidades o centro de custo se associa (§3.7)                             | PRD/RH                  |
| DP-8  | Nomenclatura final de entidades e campos (pt-BR vs. en)                         | Time de desenvolvimento |
| DP-9  | Inativação com filhos ativos: recusar ou cascata confirmada (R-INA-2)           | Produto                 |
| DP-10 | Semântica de `tenant.suspended` e efeito sobre sessões ativas (R-INA-6)         | Produto + Segurança     |
| DP-11 | Backfill de `tenant_id` em `access_user`/`audit_event` (§5)                     | Time de desenvolvimento |
| DP-12 | Técnica de garantia de consistência do `tenant_id` (R8)                         | Time de desenvolvimento |
| DP-13 | Escopo exato de leitura do `gestor` sem entidade de colaborador (§8)            | Produto                 |

### Arquivos previstos para a fase Implementar (não criados agora)

```text
apps/api/prisma/schema.prisma                          # models organizacionais
apps/api/prisma/migrations/<timestamp>_nucleo_organizacional/
apps/api/src/organization/organization.module.ts
apps/api/src/organization/company/                     # service, controller, dto
apps/api/src/organization/unit/
apps/api/src/organization/department/
apps/api/src/organization/team/
apps/api/src/organization/job-role/
apps/api/src/organization/cost-center/
apps/api/src/organization/tenant-scope/                # resolução e enforcement do tenant do ator
apps/api/src/auth/authorization/permission.types.ts    # (alteração) novos recursos
apps/api/src/auth/authorization/rbac.evaluator.ts      # (alteração) checagem de tenant antes de papel
apps/api/src/audit/audit.types.ts                      # (alteração) novos AuditResource/AUDIT_ACTIONS
apps/api/test/organization.e2e-spec.ts
apps/api/test/tenant-isolation.e2e-spec.ts             # prova negativa cross-tenant
docs/adr/0005-nucleo-organizacional-multitenant.md     # só após aprovação (§13)
```

## 13. Proposta de ADR 0005 (descrita — arquivo não criado)

Conteúdo proposto para `docs/adr/0005-nucleo-organizacional-multitenant.md`.
**A ADR não é criada nesta fase**: as decisões abaixo ainda não foram
tomadas, e registrar uma ADR de decisão não tomada seria falsear o
histórico arquitetural. O mesmo procedimento foi adotado na Fatia 4, onde
a proposta ficou dentro da spec até a aprovação.

> ### ADR 0005 — Núcleo organizacional multitenant (proposta)
>
> - Status: **proposto, não aceito**
> - Relacionado: este documento, ADR 0002, ADR 0003, ADR 0004
>
> **Contexto (proposto):** a Etapa 1 introduz a estrutura organizacional
> que todos os módulos seguintes referenciam. A fundação atual é
> multiempresa (`company_id`), não multitenant — introduzir um cliente
> comercial acima de empresa é mudança arquitetural com impacto
> retroativo em identidade e auditoria (D3).
>
> **Decisões a fechar quando aprovada:**
>
> 1. Adoção da camada `tenant` como raiz de isolamento, acima de empresa.
> 2. `tenant_id` desnormalizado em toda entidade organizacional, com
>    consistência garantida estruturalmente (R8/DP-12).
> 3. Estratégia de enforcement do isolamento: filtro na aplicação isolado
>    ou combinado com RLS no banco (§5) — recomendação: combinado, pelo
>    precedente da ADR 0004 §1.
> 4. Escopo de `admin_tecnico`, `auditor` e `dpo` em multitenant (DP-1),
>    incluindo se a leitura ampla da trilha de auditoria passa a ser
>    limitada ao tenant.
> 5. Proibição de exclusão física e de troca de tenant (R6/R7).
> 6. Extensão — nunca redução — da união `AuthorizationResource` e do
>    enum `AuditAction`, mantendo negação por padrão.
> 7. Resposta 404 (não 403) para recurso de outro tenant, como controle
>    anti-enumeração cross-tenant.
>
> **Esta ADR não é aceita até que:** o PRD esteja disponível e
> confrontado (D1); as decisões pendentes DP-1 a DP-13 estejam
> resolvidas; e esta especificação esteja aprovada no rito
> Especificar → Aprovar.
