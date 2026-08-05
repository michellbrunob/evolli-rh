# ADR 0004 — Auditoria formal e integridade

- Status: aceito
- Data: 2026-08-05
- Relacionado: [docs/modules/etapa0-fatia4-auditoria-formal.md](../modules/etapa0-fatia4-auditoria-formal.md), [ADR 0001](0001-fundacao-api.md), [ADR 0002](0002-papeis-postgres-e-migrations.md), [ADR 0003](0003-identidade-sessao-e-autorizacao.md)

## Contexto

A Etapa 0 — Fatia 4 implementa a trilha de auditoria formal especificada em
`docs/modules/etapa0-fatia4-auditoria-formal.md`, distinta do log técnico de
observabilidade já existente (`nestjs-pino`, ADR 0001). A especificação foi
aprovada (PR #12, mergeada em `main`) com a Fatia 3 (identidade, sessão e
autorização, PR #11) já integrada — esta ADR fecha, para a primeira versão
implementada, as decisões que a especificação deixava como opção a avaliar
(§8) ou dependente de aprovação (§11): o que entra nesta primeira versão e o
que fica deliberadamente fora.

## Decisão

### 1. Armazenamento: PostgreSQL append-only, mesmo isolamento de privilégio da ADR 0002

- Evento de auditoria vive em tabela própria (`audit_event`) no schema `app`,
  criada só por `evolli_migrator` (DDL), mesmo padrão de toda tabela desde a
  Fatia 2.
- `evolli_app` (papel de runtime da API) recebe **apenas `INSERT` e
  `SELECT`** em `audit_event` — nunca `UPDATE` nem `DELETE`. Isso é reforço
  além do privilégio padrão já concedido a outras tabelas (`SELECT`,
  `INSERT`, `UPDATE`, `DELETE` via `ALTER DEFAULT PRIVILEGES`, ADR 0002): o
  `REVOKE UPDATE, DELETE` é parte da **própria migration**
  (`20260805120000_auditoria_formal/migration.sql`), no mesmo `prisma
migrate deploy` que cria a tabela — um banco provisionado do zero já
  nasce append-only, sem depender de rodar um script manual separado depois.
  `infra/postgres/03_audit_grants.sql` existe só como runbook idempotente
  auxiliar para reaplicar o privilégio manualmente em caso excepcional
  (nunca a única garantia). Comprovado por teste real (não só documentado),
  contra um banco criado exclusivamente por `prisma migrate deploy`.
- Nenhum papel de runtime tem privilégio de alterar ou apagar um evento já
  gravado — a única forma de "corrigir" um evento é gravar um novo evento
  complementar (ver decisão 3).

### 2. Escrita exclusiva via `AuditService.record()`

- Nenhum módulo escreve diretamente em `audit_event` — todo evento passa por
  `AuditService.record()`, único ponto de escrita no código da aplicação.
- `AuditService.record()` nunca aceita `dado_anterior`/`dado_novo` nem
  qualquer campo de conteúdo livre — só os metadados fechados definidos na
  decisão 5.
- Ações sensíveis bem-sucedidas que alteram estado protegido (criação de
  usuário, alteração de papel/escopo, desativação de conta, conclusão de
  redefinição de senha) persistem a alteração e o evento de auditoria **na
  mesma transação de banco** — se um dos dois falhar, nenhum dos dois é
  persistido (nunca alteração "órfã" sem evento correspondente).
- Para as demais ações (login, logout, negação de autorização, bloqueio de
  rate limit, expiração de sessão, consulta à trilha), a escrita do evento é
  best-effort: se a persistência do evento falhar (ex.: banco indisponível),
  a ação de negócio já decidida (permitir, negar, expirar) **não é revertida
  nem bloqueada** por essa falha — o erro técnico é registrado no log
  estruturado (`nestjs-pino`) sem nenhum segredo, e a aplicação segue. Isso é
  particularmente importante para negação de autorização: uma negação
  continua negada mesmo que o evento de auditoria correspondente não possa
  ser gravado.

### 3. Correção por evento complementar, nunca edição do original

- Confirma a estratégia já registrada na especificação (§8): não há rota,
  método de serviço ou privilégio de banco que permita alterar um evento já
  gravado. Um registro incorreto é corrigido por um novo evento, nunca por
  edição do original.
- Esta primeira versão **não implementa** um mecanismo formal de
  "referência ao evento corrigido" (ex.: campo `evento_corrigido_id`) — não
  há, ainda, nenhum fluxo de correção de evento em uso. Fica registrado como
  extensão futura, não como lacuna: adicionar esse campo é uma migration
  aditiva simples quando o primeiro caso de uso real aparecer.

### 4. Sem hash encadeado, WORM, storage externo, exportação, job de retenção ou descarte nesta versão

Das opções que a especificação (§8) deixava "a avaliar", nenhuma é adotada
nesta primeira versão:

- **Hash encadeado** (tamper-evident chain): não implementado. Avaliar como
  evolução futura se uma ameaça específica justificar o custo operacional.
- **Storage WORM externo**: não implementado. Depende de decisão de
  TI/infraestrutura sobre provedor, fora do escopo desta fatia.
- **Exportação de trilha de auditoria**: não implementada — nenhum endpoint
  `POST /v1/audit/exports` nesta versão. Só os endpoints de consulta (`GET
/v1/audit/events`, `GET /v1/audit/events/:id`) existem.
- **Job de retenção/expurgo automático**: não implementado. Nenhum evento é
  descartado nesta versão — retenção fica configurável em fatia futura,
  quando o prazo jurídico for definido por DPO/jurídico (ver Fatia 3 §11
  desta especificação); até lá, todo evento persiste indefinidamente.
- Cada uma dessas opções permanece registrada como pendência explícita
  (decisão pendente, não descartada), reavaliável quando houver necessidade
  real e/ou aprovação formal — mesmo princípio de dependência mínima já
  seguido nas ADRs 0001–0003.

### 5. Modelo de evento: metadados seguros, sem valores antes/depois

Campos persistidos em `audit_event` nesta primeira versão (ver schema
Prisma para o contrato completo):

- Identificador (UUID), gerado no servidor.
- Data/hora em UTC (`occurred_at`), gerada no servidor no momento do
  evento — nunca aceita do cliente.
- Ator: `actor_type` (`user` | `system`) — `actor_user_id` quando o ator é
  um usuário autenticado; `actor_system_id` (identificador técnico fixo, ex.
  `"auth-service:login"`) quando não há usuário resolvido (ex.: tentativa de
  login com e-mail inexistente) — nunca um "nulo silencioso" sem
  identificação de origem.
- `actor_role`: papel do ator no momento da ação (snapshot; `null` quando
  `actor_type = system`).
- `company_id`/`unit_id`/`team_id`: escopo organizacional, quando aplicável.
- `action`: enum fechado no banco (lista em `schema.prisma`) — nunca texto
  livre.
- `resource`/`resource_id`: tipo e identificador do recurso afetado —
  `resource` é validado por união de tipos no código (extensível por módulo
  futuro sem migration), não é enum de banco.
- `ip`/`user_agent`: minimizados — mesmo par já usado em
  `SessionRequestMetadata` (Fatia 3), sem cabeçalho ou fingerprint adicional;
  `user_agent` truncado defensivamente.
- `result`: enum fechado (`success` | `failure` | `denied`).
- `request_id`: correlação com o log técnico estruturado (ADR 0001).
- `correlation_id`: opcional, para uso futuro de correlação entre múltiplas
  requisições de um mesmo fluxo lógico — não populado nesta primeira versão
  (nenhum fluxo atual precisa dele; a correlação por requisição já é
  garantida por `request_id`).
- `created_at`: timestamp de inserção no banco (`@default(now())`).
- **Nenhum campo `dado_anterior`/`dado_novo`** — decisão fechada desta
  versão (spec §11, decisão pendente 2, permanece não implementada). Quando
  um evento precisa expressar "o que mudou" (ex.: alteração de papel), o
  próprio `action` (`user_role_changed`) e o `resource_id` já bastam; nenhum
  valor de campo, sensível ou não, é persistido.

### 6. Leitura restrita a Admin técnico, Auditor e DPO

- `GET /v1/audit/events` e `GET /v1/audit/events/:id` exigem sessão válida
  (`SessionGuard`) e autorização explícita (`AuthorizationGuard` +
  `RequirePermission("access_log", "read")`) — reaproveita o recurso
  `access_log` já definido no avaliador RBAC/ABAC da Fatia 3
  (`rbac.evaluator.ts`), que já restringia esse recurso a `admin_tecnico`,
  `auditor` e `dpo`. Nenhuma mudança no avaliador foi necessária.
- RH, DP, gestor, financeiro e colaborador recebem 403 — confirmado por
  teste automatizado (negação por padrão, sem exceção).
- Toda consulta bem-sucedida à trilha (lista ou detalhe) gera, ela mesma, um
  novo evento de auditoria (`audit_log_read`) — consulta a dado sensível é
  ação auditável.

## Alternativas descartadas

| Alternativa                                                                                              | Por que foi descartada                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementar hash encadeado já nesta versão                                                               | Complexidade operacional (recalcular cadeia em reprocessamento) sem ameaça específica identificada que justifique o custo agora — mesmo princípio de dependência mínima das ADRs anteriores. Fica como evolução futura.                                                                           |
| Implementar exportação (`POST /v1/audit/exports`) já nesta versão                                        | Fora do escopo desta fatia (decisão explícita do usuário/produto) — exportação formal depende de processo definido por DPO/jurídico (quem pode solicitar, para qual finalidade), não decidido ainda.                                                                                              |
| Job de retenção/descarte automático já nesta versão                                                      | Depende de prazo jurídico ainda não definido por DPO/jurídico (spec §5, §11) — implementar um job de descarte sem prazo aprovado arriscaria apagar evidência antes da hora. Reter tudo indefinidamente é a opção segura até a decisão formal.                                                     |
| Permitir RH/DP ler a trilha do próprio escopo                                                            | Divergiria da decisão já registrada na especificação (§7): "ver o que outros fizeram" é privilégio de nível diferente de "gerenciar a própria conta de terceiro". Não alterado nesta ADR — seguiria exigindo decisão de produto/segurança explícita separada.                                     |
| Popular `dado_anterior`/`dado_novo` já nesta versão, mesmo que só com nome de campo alterado (sem valor) | Ainda que só o nome do campo (não o valor) fosse exposto, isso adicionaria uma superfície de decisão de mascaramento (o que é "campo sensível" varia por módulo futuro) sem necessidade imediata — mais simples e mais seguro não implementar esses campos agora do que implementar parcialmente. |

## Consequências

- `evolli_app` grava e lê `audit_event`, mas uma eventual falha de segurança
  na API (RCE, injeção) não permite apagar nem alterar histórico já
  gravado — mitigação real, não só documental, comprovada por teste de
  privilégio de banco.
- Sem job de retenção, o volume de `audit_event` cresce indefinidamente
  enquanto a fatia de retenção configurável não for implementada — risco já
  registrado na especificação (§11), aceito conscientemente nesta primeira
  versão (medir antes de otimizar por antecipação, mesmo princípio já usado
  para a decisão de sessão em Postgres vs. Redis na ADR 0003).
- Sem exportação, qualquer necessidade de extrair a trilha para fora da API
  (ex.: para autoridade externa) depende, por ora, de acesso direto ao banco
  por operador autorizado (fora da aplicação) — aceitável para esta fatia,
  não para operação real com dado de RH/produção.
- Ações sensíveis bem-sucedidas (criação/alteração/desativação de usuário,
  conclusão de redefinição de senha) nunca deixam o sistema em estado onde a
  alteração aconteceu mas o evento de auditoria correspondente sumiu — a
  transação garante os dois juntos ou nenhum.
- Ações não-transacionais (login, logout, negação, bloqueio de rate limit,
  expiração de sessão, consulta à trilha) podem, em tese, ocorrer sem o
  evento de auditoria correspondente se o banco estiver indisponível no
  exato momento da escrita do evento — trade-off deliberado: a
  disponibilidade da ação principal (ex.: negar acesso) nunca depende da
  disponibilidade da escrita de auditoria.

## Responsabilidades

- **Time de desenvolvimento (código):** garantir que todo novo módulo de
  domínio futuro escreva eventos de auditoria só via `AuditService.record()`
  (nunca `prisma.auditEvent.create()` direto); manter `evolli_app` sem
  `UPDATE`/`DELETE` em `audit_event` em qualquer migration futura que toque
  privilégios; nunca adicionar campo de conteúdo livre/antes-depois sem nova
  decisão explícita.
- **TI/Segurança:** avaliar, quando houver necessidade real, hash encadeado
  ou storage WORM externo (decisão 4); acompanhar volume de `audit_event`
  como sinal de quando a fatia de retenção se torna urgente.
- **DPO/jurídico:** definir prazo de retenção por classe de evento e
  processo de exportação formal antes de qualquer piloto com dado real de
  RH ou produção (já registrado na especificação, reforçado aqui).
- **Revisor de PR:** bloquear merge que grave `audit_event` fora de
  `AuditService.record()`, que conceda `UPDATE`/`DELETE` a `evolli_app`
  nessa tabela, ou que introduza campo de valor sensível em claro no evento.

## Limitações

- Esta ADR não define prazo de retenção, mecanismo de descarte, exportação
  formal, nem proteção adicional contra alteração indevida além do privilégio
  de banco (hash encadeado/WORM) — todos permanecem decisão pendente,
  registrados na especificação (§11) e na decisão 4 acima.
- Não estende MFA nem altera o risco aceito já registrado na ADR 0003 — MFA
  permanece obrigatório antes de qualquer piloto com dado real de RH ou
  produção, independente do avanço desta fatia.
- Não introduz nenhum modelo de domínio de RH/DP — a trilha de auditoria
  desta versão cobre só os eventos já existentes na Fatia 3 (identidade,
  sessão, autorização).
