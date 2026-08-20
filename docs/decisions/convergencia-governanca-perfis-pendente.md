# Convergência de governança e perfis globais — tarefas pendentes

- Status: **pendente** (planejamento; nenhuma implementação nesta entrega)
- Data: 2026-08-20
- Formaliza: [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
- Relacionado: [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md)
  (Emenda 1, prazo 2026-11-04),
  [ADR 0010](../adr/0010-preparacao-multiempresa-interna.md),
  [ADR 0011](../adr/0011-documentos-privados-e-admissao-digital.md),
  [DP-7 (escopo autorização interna)](etapa1-escopo-autorizacao-interna-pendente.md),
  [segurança operacional T004](etapa0-seguranca-operacional-pendente.md).

Este documento **não decide** nem implementa nada além do já aprovado na
ADR 0012; **registra as tarefas posteriores**, para que sejam executadas com
critério de aceite próprio, sem inferência. Cada tarefa que altere autorização
em produção exige ADR/critério próprio antes da implementação.

## 0. Pré-condições vinculantes (herdadas)

- **MFA** obrigatório antes de dado real/produção (ADR 0003 decisão 3). Gate duro.
- **T004** — cofre de segredos, backup/restauração testada, gate-mestre
  `DS-OPS-01`. Nenhum dado real antes disso.
- Nenhuma dessas tarefas provisiona usuário real, cria credencial ou declara
  conformidade legal.

## 1. Mudanças de RBAC para restringir `admin_tecnico`

- **CG-RBAC-01 — IMPLEMENTADA** (restrição de `admin_tecnico`). O
  `admin_tecnico` deixou de ter acesso operacional global: negado em
  `evaluateOrganizacao` (estrutura), `evaluateOtherAccount` (contas),
  `evaluateUserRole` (atribuição de papéis) e `evaluateAccessLog` (trilha); a
  auto-cunhagem foi removida — nenhuma rota comum cria/atribui/promove
  `admin_tecnico` (bloqueio universal, ao lado de `master_tecnico`). O escopo
  global de organização foi retirado do `resolverEscopo` (só `master_tecnico`).
  A negação a alvo de outra empresa passa a ser 404 anti-enumeração também para
  o `admin_tecnico`, agora não-global. Testes unitários e E2E atualizados
  (setup e operações globais migrados para `master_tecnico` semeado; provas de
  negação do `admin_tecnico`). **Não** alterou schema/migration; `admin_tecnico`
  permanece no enum e no histórico.
- **CG-RBAC-02 — coberta pela CG-RBAC-01**: o uso standing global do
  `admin_tecnico` (contas, estrutura, trilha) foi migrado para `master_tecnico`.
  Resta apenas confirmar o mecanismo de bootstrap definitivo (ver CG-PROV).
- **CG-RBAC-03 — respeitada**: `admin_tecnico` **não** foi removido do enum;
  permanece por bootstrap e por integridade do histórico de auditoria
  (`actor_role`). Nenhuma remoção destrutiva.
- **Gate de decisão:** **2026-11-04** (prazo da Emenda 1 da ADR 0005) — mantido
  para a formalização e para o provisionamento do primeiro Master.

## 2. Provisionamento controlado do primeiro `master_tecnico`

- **CG-PROV-01** — Redigir **runbook nominativo**: conta nominativa, sujeita a
  **MFA**, com pelo menos **duas contas administrativas** separadas de uso
  rotineiro; provisionamento fora de rota comum (bootstrap/CLI ou processo
  controlado), com registro em auditoria. Responsável: TI/Segurança.
- **CG-PROV-02** — Avaliar se o `bootstrap` passa a provisionar o primeiro
  `master_tecnico` (em vez de `admin_tecnico`). Responsável: Segurança +
  Desenvolvimento. Depende de MFA (CG-PROV-01) e T004.
- **Pré-requisito:** MFA e T004 satisfeitos. **Não executar antes.**

## 3. Papel `dpo` (e `auditor`): depreciação e remoção só por expand/contract

- **CG-DPO-01 — IMPLEMENTADA** (proibição de provisionamento do `dpo`). O
  avaliador (`evaluateUserRole`) recusa qualquer criação/alteração de usuário
  cujo papel-alvo seja `dpo`, por **qualquer ator e qualquer rota** — ao lado
  do bloqueio já existente de `admin_tecnico`/`master_tecnico`. A recusa é um
  erro seguro genérico (403, "Acesso negado."), sem vazamento. O valor
  permanece **no enum, no schema, nas migrations e no histórico** — nada
  removido/renomeado (fora de escopo). `dpo` continua marcado como depreciado
  em comentários de código. Testes unitários e E2E provam o bloqueio; a
  capacidade latente de leitura da trilha (`evaluateAccessLog`) permanece
  inalterada (exercitada em teste por semeadura direta, não por rota).
  `auditor` **não** foi habilitado por esta mudança (ver CG-DPO-03).
- **CG-DPO-02** — **Remoção futura** do valor de enum `dpo` **somente por
  expand/contract**, após verificar que **nenhum** `audit_event.actor_role`
  referencia `dpo` (hoje não há — nunca provisionado). Nunca destrutivo.
  Responsável: Desenvolvimento + Segurança.
- **CG-DPO-03** — `auditor`: escopo segue **pendente (DP-7)**; hoje ainda é
  provisionável por rota (não faz parte da CG-DPO-01) — bloqueá-lo por rota,
  com o mesmo mecanismo, é tarefa própria; não provisionar; mesmo tratamento
  não destrutivo se um dia for retirado.

## 4. Renomeação futura dos campos de aprovação documental

- **CG-DOC-01** — Migração **expand/contract** de `dpo_aprovacao_referencia` /
  `dpo_aprovado_em` (`TipoDocumento`) para **nomenclatura neutra** (ex.:
  `aprovacao_referencia` / `aprovado_em`): coluna nova + backfill + descontinuação
  da antiga, **preservando integralmente o histórico**. Responsável:
  Desenvolvimento. **Não fazer agora** (ADR 0012 decisão 5).
- **CG-DOC-02** — Atualizar contrato/DTO (`aprovacaoDpoReferencia`) e serviço
  para o rótulo neutro **na mesma migração** expand/contract; redefinir na
  documentação que a aprovação é de **RH + Jurídico**.
- Escopo de código de Documentos permanece **congelado** até esta tarefa ser
  aprovada.

## 5. Governança de privacidade (RH + Jurídico)

- **CG-GOV-01** — Reatribuir formalmente a "DPO/jurídico" → **RH + Jurídico**
  nos gates pendentes, sem alterar conteúdo/status: DP-14/DP-15 (Pessoas),
  DP-3J-09/DP-3J-11 (Ponto), DP-2E-14/DP-2E-15 (Documentos), retenção de
  `audit_event` (ADR 0004), DS-BKP-05 (Backups). Responsável: RH + Jurídico.
- **CG-GOV-02** — Designação formal de **encarregado (DPO)**: decisão **do
  Jurídico**, futura; não pressuposta.

## 6. Testes e critérios de aceite (quando as tarefas de código forem aprovadas)

- **Aceite CG-RBAC:** testes provando que `admin_tecnico` **não** cria/promove
  `admin_tecnico`; que a operação global standing é de `master_tecnico`; e que a
  matriz de isolamento (T028) e a de `master_tecnico` (T030) **continuam
  passando** sem regressão.
- **Aceite CG-DPO:** testes confirmando que `dpo`/`auditor` não são
  provisionáveis por nenhuma rota; se removido o enum, migração reproduzível de
  banco vazio e verificação de ausência de `actor_role = 'dpo'`.
- **Aceite CG-DOC:** migração expand/contract reproduzível, backfill correto,
  histórico preservado, contrato/serviço atualizados, sem perda de evidência.
- **Aceite CG-PROV:** runbook revisado por Segurança; provisionamento auditado;
  MFA ativo; nenhum dado real antes dos gates.
- **Transversal:** nenhum teste ou migração declara conformidade LGPD; toda
  alteração de autorização em produção acompanha ADR e evidência.

## Nota de rastreabilidade

O scaffold local `.specify/` (constitution/plan/spec/tasks) reflete estas
decisões e tarefas localmente, mas **não é versionado** — a rastreabilidade
versionada é esta pasta `docs/` (ADR 0012 + este documento).
