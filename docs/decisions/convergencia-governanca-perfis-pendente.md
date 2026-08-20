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

- **CG-RBAC-01** — Remover a auto-cunhagem: `admin_tecnico` deixa de poder
  **criar/promover** `admin_tecnico` (`evaluateUserRole`). Responsável:
  Segurança + Desenvolvimento. **Altera autorização** → exige ADR/aceite próprio.
- **CG-RBAC-02** — Restringir o uso standing de `admin_tecnico` à operação de
  **bootstrap**; migrar a operação técnica global contínua (contas, estrutura,
  trilha) para `master_tecnico`. Avaliar se `admin_tecnico` deve perder o acesso
  global em `evaluateOrganizacao`/`other_account`/`access_log` após o primeiro
  `master_tecnico` existir. Responsável: Segurança + Produto.
- **CG-RBAC-03** — **Não remover** `admin_tecnico` do enum: permanece por
  bootstrap e por integridade do histórico de auditoria (`actor_role`).
- **Gate de decisão:** **2026-11-04** (prazo da Emenda 1 da ADR 0005).

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

- **CG-DPO-01** — Marcar `dpo` como **depreciado** na documentação e nos
  comentários de código (sem remover do enum). Proibição de provisionamento já
  vigente (ADR 0010 decisão 4; ADR 0012 decisão 2).
- **CG-DPO-02** — **Remoção futura** do valor de enum `dpo` **somente por
  expand/contract**, após verificar que **nenhum** `audit_event.actor_role`
  referencia `dpo` (hoje não há — nunca provisionado). Nunca destrutivo.
  Responsável: Desenvolvimento + Segurança.
- **CG-DPO-03** — `auditor`: escopo segue **pendente (DP-7)**; não provisionar;
  mesmo tratamento não destrutivo se um dia for retirado.

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
