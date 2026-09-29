# Implementation Plan: Fundação backend da Central de Solicitações de Pessoas (T139)

**Branch**: `codex/t139-backend-solicitacoes-pessoas` · **Data**: 2026-09-29 · **Spec**: [spec.md](spec.md)

**Entradas**: Constituição v1.4.0; `PD-SOL-01..05`; contrato T065; núcleo puro T066;
padrões reais de `documentos/`, `horarios/`, `pessoas/`, `audit/` e `auth/authorization/`.

## 1. Estratégia

Reaproveitar o núcleo puro T066 como **única** máquina de estados, reconciliando-o com as decisões
aprovadas, e conectá-lo a NestJS/Prisma por um módulo novo que segue integralmente as convenções já
provadas do repositório. Nenhuma segunda máquina de estados é criada.

## 2. Reconciliação do núcleo puro (`apps/api/src/solicitacoes/`)

| Mudança                                                          | Razão                                     |
| ---------------------------------------------------------------- | ----------------------------------------- |
| Catálogo: remover `documento`; incluir `atestado`, `beneficios`  | `PD-SOL-01`                               |
| Remover transição `aguardando_informacao → cancelada`            | `PD-SOL-03` (só antes de `em_revisao_rh`) |
| Incluir ação `reabrir`: `encaminhada_para_operacao_rh`/`recusada` → `em_revisao_rh` | `PD-SOL-03`         |
| `cancelada` permanece terminal absoluto (sem `reabrir`)          | `PD-SOL-03`                               |
| Motivo: remover `segunda_via_documento`; incluir motivos de decisão e `outro_controlado` | catálogo fechado, sem texto livre |
| `reabrir` exige motivo obrigatório na camada de aplicação        | "justificativa auditada"                  |

O núcleo continua **puro**: sem NestJS, Prisma, I/O, relógio ou geração de id.

## 3. Modelagem Prisma (aditiva)

Enums novos (nomes distintos dos existentes — já há `EstadoSolicitacao` de `SolicitacaoDocumento`):
`TipoSolicitacaoPessoa`, `SituacaoSolicitacaoPessoa`, `MotivoSolicitacaoPessoa`,
`AcaoSolicitacaoPessoa`.

`SolicitacaoPessoa` (`solicitacao_pessoa`): `id`, `empresaId`, `vinculoId`, `tipo`,
`periodoReferencia DateTime? @db.Date`, `motivo`, `situacao @default(rascunho)`,
`registradoPorUserId`, `enviadaEm?`, `primeiraRevisaoEm?`, `criadoEm`, `atualizadoEm`.

- **FK composta** `(vinculoId, empresaId) → VinculoFuncional(id, empresaId)`: o banco garante que o
  vínculo pertence à empresa da solicitação — isolamento não depende só da aplicação.
- Índices: `[empresaId, vinculoId]`, `[empresaId, situacao]`, `[empresaId, tipo]`,
  `[registradoPorUserId]`, e `@@unique([id, empresaId])` como alvo da FK composta do evento.

`SolicitacaoPessoaEvento` (`solicitacao_pessoa_evento`): `id`, `solicitacaoId`, `empresaId`, `acao`,
`situacaoDe`, `situacaoPara`, `motivo?`, `registradoPorUserId`, `requestId`, `ocorridoEm`.
FK composta `(solicitacaoId, empresaId)`. `requestId` correlaciona com `audit_event`.

Privilégios (só REVOKE, nunca GRANT — padrão `evento_ponto`/`audit_event`):

```sql
REVOKE DELETE ON TABLE "solicitacao_pessoa" FROM evolli_app;          -- sem exclusão física
REVOKE UPDATE, DELETE ON TABLE "solicitacao_pessoa_evento" FROM evolli_app;  -- histórico aditivo
```

Migration: `apps/api/prisma/migrations/20260929120000_central_solicitacoes_pessoas/migration.sql`,
começando por `ALTER TYPE "AuditAction" ADD VALUE ...`, depois enums, tabelas, índices, FKs, REVOKEs.

## 4. Módulo NestJS (`apps/api/src/solicitacoes-pessoas/`)

```
solicitacoes-pessoas.module.ts
solicitacoes-pessoas.types.ts            ResultadoPaginado, contexto de auditoria, mapeamentos
solicitacoes-pessoas-auditoria.service.ts   ponte com AuditService (mutação/leitura/negação)
escopo-solicitacoes-pessoas.util.ts      escopo por sessão, filtro de leitura, deslocamento
dto/solicitacoes-pessoas.dto.ts          criação, filtros paginados, transição
solicitacao-pessoa.controller.ts
solicitacao-pessoa.service.ts
```

Endpoints (`@Controller("solicitacoes-pessoas")`, versionamento URI global `/v1`):

| Método | Rota                                | Guards                          | Permissão                  |
| ------ | ----------------------------------- | ------------------------------- | -------------------------- |
| POST   | `/`                                 | Session + Csrf + Authorization  | `solicitacao_pessoa:create` |
| GET    | `/`                                 | Session + Authorization         | `solicitacao_pessoa:read`   |
| GET    | `/:solicitacaoId`                   | Session + Authorization         | `solicitacao_pessoa:read`   |
| POST   | `/:solicitacaoId/transicoes`        | Session + Csrf + Authorization  | `solicitacao_pessoa:alter`  |
| GET    | `/:solicitacaoId/historico`         | Session + Authorization         | `solicitacao_pessoa:read`   |

Parâmetro nomeado `:solicitacaoId` (nunca `:id`, que dispara a busca de `AccessUser` no guard).

## 5. RBAC (4 pontos de registro)

1. `permission.types.ts`: `SOLICITACOES_PESSOAS_RESOURCES = ["solicitacao_pessoa"]` + tipo +
   `isSolicitacoesPessoasResource()` + união `AuthorizationResource`.
2. `rbac.evaluator.ts`: despacho no `default:` + `evaluateSolicitacoesPessoas`.
3. `authorization.guard.ts`: `toAuditResource` passa a auto-identificar o recurso.
4. `audit.types.ts`: `AuditResource | "solicitacao_pessoa"` e novas ações em `AUDIT_ACTIONS`.

Matriz: `rh` → create/read/alter na própria empresa; `master_tecnico` → **somente read** (global,
auditado); todos os demais (`dp`, `gestor`, `colaborador`, `financeiro`, `admin_tecnico`, `auditor`,
`dpo`, `admin` legado) → negados por padrão.

## 6. Auditoria

Ações novas em `AuditAction` (convenção pontilhada de Pessoas): `pessoas.solicitacao.criada`,
`.enviada`, `.cancelada`, `.revisao_iniciada`, `.informacao_solicitada`, `.revisao_retomada`,
`.encaminhada`, `.recusada`, `.reaberta`, `.consultada`.

- Mutações: `auditService.record(..., tx)` **dentro** da transação — falha da auditoria aborta a
  mutação.
- Leituras: `recordOrThrow` (fail-safe), padrão de `documentos`.
- Negações em service: `negarAcesso(...)` → `authorization_denied`/`denied` + `NotFoundException`.
- Evento carrega ator, papel, empresa, ação, id técnico e metadado da requisição — nunca vínculo do
  colaborador como dado pessoal, nunca motivo em texto, nunca conteúdo.

## 7. Transação de mutação

```
$transaction:
  1. carregar solicitação no escopo (ou negar → 404)
  2. transicionarSolicitacao(...) no núcleo puro (fail-closed)
  3. update de situacao + marcos de acompanhamento
  4. create do evento de histórico (append-only)
  5. auditService.record(..., tx)
```

## 8. Testes

- Unitários: `solicitacoes.spec.ts` reconciliado; `rbac.evaluator.solicitacoes-pessoas.spec.ts`;
  `solicitacao-pessoa.service.spec.ts`.
- E2E `apps/api/test/solicitacoes-pessoas.e2e-spec.ts` (Testcontainers), cobrindo os 14 itens
  exigidos pela tarefa, com duas empresas sintéticas e todos os papéis.

## 9. Validações

`pnpm spec:check`, `format:check`, `lint`, `typecheck`, `build`, `test`, `test:e2e`, migration smoke,
`git diff --check`, varredura de testes desabilitados e de segredos/PII.

## 10. Riscos e mitigação

| Risco                                        | Mitigação                                                          |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Duas máquinas de estado divergentes          | Núcleo puro é a única fonte; o service não reimplementa transições |
| Vazamento entre empresas                     | FK composta no banco + escopo por sessão + 404 anti-enumeração     |
| Conteúdo sensível entrar por texto livre     | Nenhum campo de texto; todo motivo é enum fechado                  |
| Auditoria órfã                               | `record(..., tx)` na mesma transação                               |
| Efeito colateral em outro módulo             | Service escreve só nas 2 tabelas próprias + `audit_event`          |
