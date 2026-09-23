<!--
Sync Impact Report
- Version change: 1.3.0 -> 1.4.0
- Modified principles: II. Security, Privacy, and Least Privilege by Default; IV. Evidence-Based
  Quality and Safe Change.
- Modified sections: Mandatory Architecture and Data Constraints; Delivery Workflow and Quality
  Gates; Governance.
- Added controls: Spec Kit artifacts versioned in Git, mandatory per-task synchronization manifest,
  and convergence before Ready for review.
- Removed sections: none.
- Follow-up TODOs: validate fiscal retention, legal bases, export process, point-TXT sample/layout,
  REP rules, dashboard formulas, climate-survey threshold, and approval matrices with the appropriate
  RH, fiscal, legal and security owners before implementation of each affected module. The project has
  no DPO role currently provisioned; any formal designation of an encarregado is a Legal decision.
- Convergence note (ADR 0012, docs/adr/0012-*): RH + Jurídico are the accountable privacy/LGPD
  governance function; the technical `dpo` role is formally deprecated (kept in enum/history,
  non-destructive, never provisioned); `master_tecnico` is the sole standing global exception and
  `admin_tecnico` converges to bootstrap/history. This is governance, not a compliance declaration.
- Convergence note (T131/T132): MFA TOTP exists but starts disabled by server configuration for the
  initial release. Universal MFA remains the target; activation requires the approved operational
  gates. An account that already has an active factor is never silently downgraded while MFA is off.
-->

# Evolli RH - Reserva Fiscal Constitution

## Core Principles

### I. Domain Integrity and Traceability First

Every change MUST have an approved specification, business owner, acceptance criteria, and
traceability to a PRD requirement, ADR, or recorded decision. The system MUST preserve origin,
effective period, author, approval state, and audit trail of HR, payroll, fiscal-reserve, and
integration records. Legal, tax, labor, or payroll rules MUST be parameterized, versioned,
effective-dated, testable, and approved by the accountable business/legal function; developers
MUST NOT invent them.

### II. Security, Privacy, and Least Privilege by Default

Security, privacy, and applicable legal/fiscal controls are non-functional acceptance requirements
for every feature.
Access MUST be denied by default and granted only through explicit RBAC/ABAC permissions scoped by
company, unit, team, and resource where applicable. Sensitive data MUST be minimized, classified,
encrypted in transit and at rest where applicable, redacted from logs and audit payloads, and never
stored in source code, URLs, test fixtures, or client state without authorization. The initial
release uses `MFA_ENABLED=false` under the explicit product risk acceptance recorded by T132. MFA
TOTP is implemented and remains the universal target, but may only be activated with
`MFA_ENABLED=true`, a valid `MFA_TOTP_ENCRYPTION_KEY` provisioned through the approved secret
management process, the applicable `DS-SEC-*` evidence, and an approved rollout decision. While MFA
is disabled, an account with an active factor MUST fail closed rather than receive a password-only
session.

Special-category, employment, financial, identification, authentication, and fiscal data MUST be
processed only for an approved purpose and by authorized roles. Technical logs MUST contain only the
minimum metadata needed for operations and correlation; they MUST redact credentials, session tokens,
CPF, salary, health information, document content, and payloads containing personal data. Formal
auditing is distinct from observability and MUST provide accountable, append-only evidence of access,
exports, approvals, sensitive changes, integration calls, and authorization denials when applicable.
Authorization by object MUST be enforced by the server for every read, update, download, export,
attachment, approval, and status transition. Client filters and unguessable identifiers are defense in
depth only, never authorization. The system MUST prevent BOLA/IDOR, enumeration, session hijacking,
brute force, cache exposure, and leakage of a protected resource's existence or metadata.

The initial operation covers exactly two internal legal companies. Each operational access user is
assigned to one company scope only and MUST NOT read, search, export, approve, alter, or infer
resources of the other company. The sole permitted exception is the `master_tecnico` access role,
assigned only to named accounts formally authorized for development and ecosystem support. Its global
scope is subject to the approved operational release decision and compensating controls while MFA is
disabled; its every access and configuration action is audited, it is not used for routine HR work,
and it does not bypass approved business workflows for sensitive mutations. High-impact mutations require
an explicit server-side permission and the applicable approved workflow; when the approval rule is not
yet modeled, the operation is denied rather than inferred.

### III. Contract-First, Layered, and Evolvable Architecture

The canonical stack is TypeScript strict mode, React, NestJS, PostgreSQL with Prisma migrations,
Redis/queues only when a measured need justifies them, and OpenAPI contracts. Features MUST separate
presentation, application/use-case, domain, and infrastructure concerns. API, event, import/export,
and integration contracts MUST be versioned and backward-compatible or carry an approved migration
and deprecation plan. New dependencies, external providers, multitenancy, and material architecture
changes require an ADR before implementation.

Domain rules and calculations MUST live in the domain/application boundary, independent of HTTP,
Prisma, queues, UI components, and external-provider SDKs. Controllers, React components, and job
handlers MUST orchestrate use cases rather than embed fiscal or labor logic. Infrastructure adapters
MUST implement interfaces defined by the application/domain layer, keeping persistence and external
providers replaceable and testable. Cross-module data access MUST occur through explicit contracts,
not direct access to another module's internal persistence model.

Documents, uploads, imports, and generated exports MUST be treated as protected assets. They MUST be
stored outside source control, authorized per object, validated for type, size, and content, protected
in transit and at rest, and recorded with safe metadata. Download links MUST be authenticated or
short-lived and non-public. Import flows MUST retain source provenance, protected original file,
layout/version, content hash, operator, timestamps, validation errors, and confirmation state.

### IV. Evidence-Based Quality and Safe Change

All behavior changes MUST have automated unit, integration, contract, and authorization tests at the
appropriate boundaries. Authorization tests MUST prove both allowed and denied paths. Migrations MUST
be reviewed, additive by default, reproducible from an empty database, and tested against isolated
PostgreSQL instances. Destructive schema changes MUST use expand/contract with a documented
forward-fix or rollback runbook. A task is not complete without reproducible evidence of tests,
security review, migration impact, and acceptance criteria.

Labor, payroll, tax, reserve, and effective-date validations MUST have deterministic test cases that
cover the approved rule, invalid input, boundary dates, rounding/precision, authorization scope, and
reprocessing/idempotency where applicable. Approved reference scenarios and expected results MUST be
provided by the accountable HR, fiscal, or legal owner; no generated code or test may turn an
unconfirmed interpretation into a production rule.

For timekeeping, the system MUST retain raw punch events, not only source totals; use approved
employee/clock identifiers rather than names; preview, validate, and confirm imports; prevent
duplicate effective imports by idempotency controls; preserve original events; and require justified,
approved, auditable adjustments. Official point, payroll, fiscal, and labor calculations require
homologated source rules and human validation before operational release.

### V. Auditability, Observability, and Operational Resilience

The system MUST emit structured, correlation-aware technical logs without sensitive values and
formal audit events for security-relevant and business-sensitive actions. Audit events MUST be
append-only, written only through `AuditService.record()`, and never contain free text or before/
after sensitive values without an approved ADR. State changes requiring audit MUST be transactional
with their audit event. Background work, imports, exports, and integrations MUST be idempotent where
retries are possible, expose safe status/error handling, and retain investigation evidence.

Sensitive operations MUST use segregation of duties and explicit approvals when appropriate: a
requester, executor, and approver MUST not be treated as interchangeable by default. High-impact
actions, including payroll/salary changes, terminations, sensitive-document operations, inventory
adjustments, and exceptional approvals, MUST require justification, immutable evidence, and
confirmation or reauthentication according to a documented risk assessment. Climate-survey results
MUST remain aggregate-only, separate eligibility from response data, apply an approved minimum group
threshold, and suppress slices that allow reidentification.

## Mandatory Architecture and Data Constraints

- The deployment is internal and single-tenant. `company_id` is the highest organizational and
  authorization boundary. No `tenant_id`, multitenant RLS, or tenant backfill may be introduced
  without an approved ADR and LGPD review (ADR 0005).
- Runtime database access MUST use `evolli_app` with DML-only permissions. Schema changes MUST use
  `evolli_migrator`; runtime MUST never receive DDL or privileged access.
- `audit_event` is append-only: runtime has `INSERT` and `SELECT`, never `UPDATE` or `DELETE`.
  Corrections are additional events, never edits of history.
- Personal, employment, financial, and fiscal data MUST have documented purpose, legal basis,
  classification, access policy, retention owner, and disposal/export rule before real processing.
  Retention and official-reporting obligations require Legal or fiscal approval, never inference.
- Secrets MUST use environment configuration or an approved vault. Production data, credentials,
  tokens, documents, and real identifiers MUST not be committed or reused from a legacy system.
- External integrations MUST use least-privilege credentials, timeout/retry and idempotency controls,
  contract validation, audit logging, and documented reconciliation. Official integrations require
  source validation and accountable-business approval before release.
- No functionality may be exposed externally without an approved release decision. A module with
  real data may enter pilot or production only after its mandatory gates are closed or an explicit,
  scoped and dated risk acceptance records the open gate, compensating controls, owner and exit
  condition. T132 is the current exception only for mandatory MFA at the initial release; it does not
  close or waive any other `DS-SEC-*`, privacy, retention, backup, infrastructure or operational gate.
  Residual critical risk MUST be zero and the required independent security evidence MUST be
  available. Backups MUST be segregated, protected and restore-tested with documented recovery
  objectives.
- Each module MUST maintain its privacy treatment inventory: data subjects and categories, purpose,
  legal basis, source, recipients, retention, disposal, responsible owner, and need for a RIPD/DPIA.
  The absence of this information is a release blocker for real-data processing.

## Delivery Workflow and Quality Gates

1. `/speckit.constitution` governs durable project rules and is updated before changes to governance,
   security posture, architecture policy, or delivery rules.
2. `/speckit.specify` creates an outcome-focused feature specification covering scope, exclusions,
   data classification, permissions, compliance, acceptance scenarios, open decisions, and PRD/ADR
   traceability.
3. `/speckit.plan` converts an approved specification into architecture, data model, contracts,
   migrations, integrations, test strategy, security/LGPD controls, sequencing, and approval gates.
4. `/speckit.tasks` creates small, ordered, dependency-aware tasks with expected module/files,
   acceptance evidence, tests, and security impact, so Claude Code does not invent requirements.
5. `/speckit.implement` is executed by Claude Code only after approved spec and plan, in a dedicated
   branch and within task scope, yielding PR evidence for changed files, migrations, tests, security,
   LGPD, risks, and decisions.
6. `/speckit.converge` reconciles the implementation with the approved specification, plan,
   constitution, ADRs, tests, and documentation; it resolves drift or records an amendment before
   merge.
7. Each day ends with a Notion caderno diário entry: intent, decisions, artifacts, completed work,
   evidence, risks/blockers, and next action, with references to spec, plan, task IDs, ADRs, and PRs.
8. `.specify/memory/constitution.md`, `.specify/spec.md`, `.specify/plan.md`,
   `.specify/tasks.md`, `.specify/execution-status.md`, `.specify/sync-state.json`, templates,
   scripts and reusable Spec Kit commands MUST be versioned in Git. Only machine-local pointers and
   extension configuration listed in `.specify/.gitignore` remain unversioned.
9. Every task MUST update its entry or execution state in the Spec Kit before the implementation PR
   becomes Ready for review. A task may be recorded as investigated, blocked, implemented, integrated
   or cancelled; absence from the ledger is not permitted.
10. `/speckit.converge` is a required pre-Ready gate. It MUST reconcile the task with the
    Constitution, Spec, Plan, execution ledger, ADRs, decisions, tests and PR evidence. Drift is fixed
    in the same task or explicitly recorded as a blocker; it is never deferred silently.

## Prompt Engineering Protocol for Claude Code

Prompts sent to Claude Code are engineering artifacts, not informal requests. Every implementation
prompt MUST state: the role and bounded mission; relevant repository and source context; explicit
scope and exclusions; constraints from this Constitution and relevant ADRs; expected output/artifacts;
acceptance criteria; validation commands or evidence expected; and a stop-and-escalate rule for missing
business, fiscal, legal, LGPD, or security decisions. It MUST instruct Claude Code not to infer or
invent rules outside the approved specification.

Prompts MUST favor clear, precise, unambiguous instructions over broad requests. Provide representative
examples, existing interfaces, or file references when these materially constrain the result. Split
complex work into spec, plan, and small ordered tasks rather than one broad implementation prompt.
Before reuse, prompts MUST be reviewed through representative and edge-case scenarios; after execution,
their output MUST be assessed against objective acceptance criteria and refined iteratively when needed.
The repository is the canonical shared prompt bank: reusable templates and approved handoff prompts
MUST be versioned with their intended purpose, inputs, expected outputs, limitations, and revision date.
The model and reasoning effort are execution metadata and MUST stay outside the copy-and-paste task
content, as decided by the product owner; task prompts contain only the bounded delivery contract.

Claude Code MUST interpret each task as a bounded delivery contract: perform only the stated work and
dependencies; inspect the specified source context before changing anything; preserve unrelated
worktree changes; stop and report rather than broaden scope when acceptance criteria, source rules, or
data/compliance decisions are absent; and return the requested evidence. Completion requires both the
implementation and the stated validation, not merely code that compiles. A task does not authorize
production release, data migration with real personal data, or a change to fiscal/legal policy.

## Governance

This Constitution supersedes conflicting implementation conventions. The PRD, approved ADRs, and
later dated approved product/RH/Legal/Security decisions remain authoritative for business, privacy,
fiscal, labor and operational requirements; unknowns MUST be recorded as pending decisions, never
silently assumed. When an ADR is intentionally revised by a later approved decision, the Spec Kit
MUST point to that decision and preserve the historical ADR rather than silently rewriting history.

The authoritative PRD is the Notion page
`Sistema RH - Reserva Fiscal - PRD` (`dceacf66-ba47-834d-b3fc-014cc2835594`). Its requirements,
updates, and dated change log MUST be traced into each specification and plan. The local repository
may hold derived artifacts, but a mismatch with the approved PRD MUST be resolved through an explicit
PRD update or documented decision before implementation.

Every specification, plan, task list, PR review, and convergence review MUST check this
Constitution. Reviewers MUST block work that violates access scope, logs sensitive information,
bypasses audit controls, changes legal/fiscal rules without approval, introduces unapproved external
integrations, or releases real-data functionality without the required security and LGPD gates.

Amendments require a documented rationale, impact assessment, applicable ADR references, review by
the relevant owners (engineering, product, security, RH/Legal, and fiscal where applicable), and an
implementation/migration plan if existing behavior changes. Versioning is semantic: MAJOR for
incompatible governance redefinitions, MINOR for material additions, and PATCH for clarifications.

Claude Code MUST read `README.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, this Constitution,
the applicable spec/plan/tasks, `.specify/execution-status.md`, and relevant ADRs/decisions before
implementing. It MUST follow `docs/CLAUDE_HANDOFF.md`, update the Spec Kit within the task and must not
modify code or configuration outside approved task scope.

**Version**: 1.4.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-09-23
