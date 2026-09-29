# Tasks: Fundação backend da Central de Solicitações de Pessoas (T139)

**Branch**: `codex/t139-backend-solicitacoes-pessoas` · **Spec**: [spec.md](spec.md) ·
**Plan**: [plan.md](plan.md)

Ordem obrigatória: cada bloco só começa quando o anterior está completo. Commits pequenos por bloco.

## Bloco A — Reconciliar o núcleo puro (T066)

- [ ] A1 `solicitacoes.types.ts`: catálogo sem `documento`, com `atestado` e `beneficios`.
- [ ] A2 `solicitacoes.types.ts`: ação `reabrir`; motivos de decisão + `outro_controlado`.
- [ ] A3 `solicitacoes.ts`: remover `aguardando_informacao → cancelada`; adicionar `reabrir` a partir
      de `encaminhada_para_operacao_rh` e `recusada` para `em_revisao_rh`; `cancelada` sem saída.
- [ ] A4 `solicitacoes.fixtures.ts` + `solicitacoes.spec.ts`: atualizar e cobrir o novo desenho,
      inclusive rejeição explícita de cancelar em `aguardando_informacao` e de reabrir `cancelada`.

## Bloco B — Autorização e auditoria (registro transversal)

- [ ] B1 `permission.types.ts`: recurso `solicitacao_pessoa` + guard de tipo + união.
- [ ] B2 `rbac.evaluator.ts`: `evaluateSolicitacoesPessoas` + despacho.
- [ ] B3 `authorization.guard.ts`: `toAuditResource` auto-identifica o recurso.
- [ ] B4 `audit.types.ts`: `AuditResource` + 10 ações novas em `AUDIT_ACTIONS`.
- [ ] B5 `rbac.evaluator.solicitacoes-pessoas.spec.ts`: permitir/negar por papel, ação e fase.

## Bloco C — Persistência

- [ ] C1 `schema.prisma`: 4 enums + 2 models + 10 valores em `AuditAction`.
- [ ] C2 Migration `20260929120000_central_solicitacoes_pessoas`: enums, tabelas, índices, FKs
      compostas e REVOKEs. Aditiva, reproduzível em banco vazio.
- [ ] C3 Conferir ausência de drift (`prisma migrate diff` no smoke da CI).

## Bloco D — Módulo NestJS

- [ ] D1 `solicitacoes-pessoas.types.ts` + `escopo-solicitacoes-pessoas.util.ts`.
- [ ] D2 `dto/solicitacoes-pessoas.dto.ts`: criação, filtros paginados, transição.
- [ ] D3 `solicitacoes-pessoas-auditoria.service.ts`.
- [ ] D4 `solicitacao-pessoa.service.ts`: criar, listar, detalhar, transicionar, histórico.
- [ ] D5 `solicitacao-pessoa.controller.ts` com guards e permissões por rota.
- [ ] D6 `solicitacoes-pessoas.module.ts` + registro em `app.module.ts` + tag OpenAPI.
- [ ] D7 `solicitacao-pessoa.service.spec.ts`.

## Bloco E — E2E (Testcontainers, dados sintéticos)

- [ ] E1 Bootstrap: duas empresas, colaboradores/vínculos, papéis `rh`/`dp`/`gestor`/`colaborador`/
      `master_tecnico` nas duas empresas.
- [ ] E2 Criação e releitura; listagem, detalhe, filtros e paginação.
- [ ] E3 Ciclo completo das transições válidas; rejeição das inválidas.
- [ ] E4 Cancelamento só antes de `em_revisao_rh`; `cancelada` não reabre.
- [ ] E5 Reabertura pelo RH de `recusada` e `encaminhada_para_operacao_rh`, com motivo obrigatório.
- [ ] E6 Preservação do histórico (nenhum evento sumiu; ordem preservada).
- [ ] E7 CSRF ausente → 403 em todas as mutações.
- [ ] E8 RBAC deny-by-default por papel; `master_tecnico` lê mas não muta.
- [ ] E9 IDOR/BOLA entre empresas → 404; listagem com `empresaId` alheio → página vazia.
- [ ] E10 Corpo de resposta sem campo clínico/anexo/conteúdo; auditoria sem dado sensível.

## Bloco F — Validação e convergência

- [ ] F1 `typecheck`, `lint`, `test`, `test:e2e`, `build`, `format:check`, `spec:check`,
      `git diff --check`, varredura de `.only`/`.skip`/`fit`/`fdescribe`/`xit`/`xdescribe` e de
      segredos/PII.
- [ ] F2 `/speckit.converge`: atualizar `.specify/tasks.md`, `execution-status.md`, `sync-state.json`
      (T138 integrada, T139 implementada, `lastIntegratedTask: 138`), Spec e Plan quando aplicável.
- [ ] F3 Commits pequenos, push, PR Draft única para `main`, CI até os 3 checks concluírem.

## Fora desta tarefa (não fazer)

Anexo/upload/R2; ESS do colaborador (`DP-23`); notificação; cronômetro de SLA; efeito automático em
ponto/férias/cadastro/benefícios/Banco de Horas/Folha/fechamento; alteração de `apps/web`; alteração
de `solicitacoes-documento` ou `ajuste_ponto`; dependência nova.
