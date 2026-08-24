# Etapa 2 — Documentos privados, V1 de metadados: convergência (T027)

> **Nota de convergência (T032; [glossário Reserva Fiscal](glossario-reserva-fiscal.md)).**
> As linhas abaixo que listam **"Reserva Fiscal" como módulo/fatia (T020+)** são
> um **equívoco** já cancelado: **"Reserva Fiscal" é o nome da empresa/projeto**,
> **não** um módulo, produto, serviço ou escopo fiscal. Não existe módulo
> fiscal/reserva no repositório, e as tarefas T020–T023 (antiga "fatia fiscal")
> estão **canceladas**. O texto abaixo é preservado como história — não
> reescrito.

- Status: **Convergida e integrada** (2026-08-14). Fatia 2 (Documentos, V1 de
  metadados) fechada; upload/conteúdo permanecem bloqueados (Nível 2).
- Data: 2026-08-14
- Relacionado:
  [ADR 0011 (Aceito)](../adr/0011-documentos-privados-e-admissao-digital.md),
  [especificação estrutural Etapa 2](../modules/etapa2-documentos-admissao-digital-estrutural.md),
  [aprovações pendentes (Nível 2)](etapa2-documentos-admissao-aprovacoes-pendentes.md),
  [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md),
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md).
- Constituição: v1.3.0 (Princípios I, II, III, V; "Mandatory Architecture and
  Data Constraints"; "Delivery Workflow and Quality Gates" — item 6,
  `/speckit.converge`).
- PRD: `Sistema RH - Reserva Fiscal - PRD` (Notion `dceacf66-ba47-834d-b3fc-014cc2835594`).
- Integração: [PR #20](https://github.com/michellbrunob/evolli-rh/pull/20)
  (**MERGED** 2026-08-14T19:52:51Z), squash **`cdf4a71`** em `main`.

## 1. Escopo real entregue

Três entidades de **metadado, sem conteúdo** — nenhuma coluna de bytes,
base64, path, URL, bucket, chave, hash, tamanho, MIME ou nome de arquivo em
nenhuma tabela (verificado por inspeção da migration e pelo E2E que lê
`information_schema.columns`):

| Entidade               | Papel na V1                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TipoDocumento`        | Catálogo por empresa; inicia e permanece `restrito`; criar/alterar só RH, com referência de aprovação de DPO registrada (Emenda 1 da ADR 0011).        |
| `DocumentoMetadado`    | O documento como conceito; sujeito é `Colaborador`; `empresa_id` explícito; substituição preserva histórico (novo registro; anterior → `substituido`). |
| `SolicitacaoDocumento` | Pedido de documento; permanece `pendente` (atender exige conteúdo, Nível 2).                                                                           |

Estado de ciclo de vida alcançável do metadado: **`upload_desabilitado`** —
estado **sem transição de saída** para conteúdo (ADR 0011, decisão 2). Não há
controller/serviço/rota de upload, download, versão de conteúdo ou storage.

## 2. Aderência (Constituição, Spec, Plan, Tasks, ADR 0011 ↔ código integrado)

| Exigência                                                              | Fonte                                        | Verificação no código integrado                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Negação por padrão; RBAC/ABAC por empresa, objeto e papel, no servidor | Constituição II; ADR 0011 decisões 4–6       | `rbac.evaluator.ts` (ramo `evaluateDocumentos`, duas fases); `admin_tecnico`/gestor/colaborador/financeiro/auditor/dpo negados; RH/DP na própria empresa; catálogo só RH. Coberto por `rbac.evaluator.documentos.spec.ts` (matriz célula a célula). |
| Fora do escopo → 404 anti-enumeração (nunca 403)                       | ADR 0011 decisão 5; O3                       | `documentos-auditoria.service.ts#negarAcesso` responde 404; E2E cobre IDOR/BOLA e página vazia.                                                                                                                                                     |
| Metadado/conteúdo em permissões distintas; conteúdo inexistente        | ADR 0011 decisão 4, decisão 1                | Sem recurso de conteúdo no `permission.types.ts`; sem coluna/rota de conteúdo.                                                                                                                                                                      |
| Auditoria append-only, ponto único; leitura de metadado **fail-safe**  | Constituição V; ADR 0004; ADR 0011 decisão 7 | `documentos-auditoria.service.ts#registrarLeitura` usa `recordOrThrow`; mutações transacionais; trilha nunca carrega rótulo/tipo documental (DP-2E-12).                                                                                             |
| Integridade `empresa_id` ↔ `colaborador_id` garantida pelo banco       | Constituição I/III; correção P1              | 3 `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` na migration `20260814120000_documentos_metadados_v1`.                                                                                                                                       |
| Migrations aditivas, papéis segregados, sem drift                      | ADR 0002; Plan §7                            | Sem `GRANT` novo; job Migration Smoke verde (drift check + `btree_gist`).                                                                                                                                                                           |
| TypeScript estrito, camadas, `/v1`, DTO validado                       | Constituição III; Plan §3                    | Módulo `apps/api/src/documentos/`; controllers com guards + `@RequirePermission`; DTOs `class-validator`.                                                                                                                                           |
| Sem regra trabalhista/fiscal inferida; sem dado real                   | Constituição I; ADR 0011                     | Dados sintéticos nos testes; `dpo` como referência registrada, não workflow inventado (DP-7 pendente).                                                                                                                                              |

## 3. Evidências verificadas (PR #20, commit integrado `cd9e8a7`)

- **Quality gates:** pass (format, lint, typecheck, build, unit).
- **E2E (PostgreSQL real via Testcontainers):** pass — inclui `documentos.e2e-spec.ts`
  com os **cinco cenários de integridade** (quatro negativos: INSERT cruzado em
  `documento_metadado` e em `solicitacao_documento`, reapontar e remover o
  vínculo sustentador; um positivo: swap legítimo de vínculo do mesmo par em
  uma transação **conclui**), além de RBAC, 404 anti-enumeração e ausência de
  coluna de conteúdo.
- **Migration smoke (banco vazio, papéis segregados):** pass.
- **Unit:** 248/248 (inclui a matriz de acesso de Documentos e o teste
  fail-safe de leitura).

## 4. Bloqueios preservados (nada disto foi habilitado)

| Bloqueio                                                                                                                                                       | Estado           | Gate                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Nível 2** da ADR 0011 (upload, download/visualização de conteúdo, storage, URL temporária, quarentena/antimalware operante, retenção que alcance o conteúdo) | **Bloqueado**    | [aprovações pendentes](etapa2-documentos-admissao-aprovacoes-pendentes.md) (DP-2E-03/04/05/06/09/10/11/13-conteúdo/14/15) |
| **MFA** obrigatório antes de dado real/produção                                                                                                                | **Bloqueado**    | ADR 0003, decisão 3                                                                                                       |
| **Ponto TXT** (importação/apuração)                                                                                                                            | **Não iniciado** | T009+; RH fornece TXT/REP e regras homologadas                                                                            |
| **Folha**                                                                                                                                                      | **Não iniciado** | T016+; rubricas/regras/alçadas aprovadas                                                                                  |
| **Reserva Fiscal**                                                                                                                                             | **Não iniciado** | T020+; política/fórmula/contas aprovadas                                                                                  |
| **Relatórios**                                                                                                                                                 | **Não iniciado** | T024+; fórmulas/fontes/agregação aprovadas                                                                                |

O verbo "publicação/visualização/download" do objetivo original da T008
(`.specify/tasks.md`) pertence ao **Nível 2** — não foi entregue e permanece
bloqueado.

## 5. Divergências encontradas e resolvidas nesta convergência

1. **ADR 0011 com linguagem pré-promoção** (seção "Por que Proposta e não
   Aceito" e o parágrafo "Esta ADR não autoriza início de código") descrevia a
   ADR como não-aceita e sem autorização de código — **estado anterior** à
   aprovação de Nível 1. **Resolvido:** adicionada Nota de convergência no topo
   e marcadas as duas passagens como **históricas**; a decisão registrada é
   preservada (ADR não reescreve história).
2. **Especificação estrutural (§15 "Proposta de ADR futura")** dizia
   "ADR 0011, status Proposta" e "a ser redigida/promovida" — **defasado**.
   **Resolvido:** corrigido para **Aceito, integrada**, com nota de convergência
   no topo marcando o Status ("nenhuma implementação existe") e a §15 como
   históricos da fase Especificar.
3. **`.specify/tasks.md` (T007/T008)** descrevia o escopo **completo** (com
   "visualização/download"), que é Nível 2. **Resolvido:** T007 e T008 marcadas
   concluídas com o **escopo real do V1** (metadados sem conteúdo) e o
   download/publicação explicitamente identificados como Nível 2 adiado.
4. **Nome do módulo:** tasks/ADR previam `apps/api/src/documents/` (inglês); o
   módulo real é `apps/api/src/documentos/` (português, coerente com
   `organizacao`/`pessoas`). **Registrado** como divergência de nomenclatura
   sem impacto funcional.
5. **`.specify/` não é versionado** no repositório (scaffold local do
   Spec-Kit). A rastreabilidade **versionada** vive em `docs/` — este relatório
   e os documentos atualizados de `docs/adr` e `docs/modules`. A atualização de
   `.specify/tasks.md` reflete o estado local do Spec-Kit.

## 6. Recomendação — próximo trabalho permitido

**Fatia 2 (Documentos, V1 de metadados) está fechada e integrada.** O próximo
trabalho permitido, sem esbarrar em bloqueio, é a **sequência de Jornada/Ponto
V1 (T009–T015)** — a próxima fatia funcional recomendada pelo Plan — **desde
que** satisfeitas suas pré-condições reais: RH fornecer o **TXT anonimizado**,
a documentação do **REP/fornecedor** e as **regras de jornada/escala/feriados/
fechamento homologadas** (T009). Sem esses insumos, T009+ permanece bloqueada
por dependência externa, não por código.

**Não liberado:** habilitar upload/conteúdo de documento (Nível 2 + MFA),
Folha (T016+), Reserva Fiscal (T020+) e Relatórios (T024+) — todos dependem de
decisões de negócio/fiscal/DPO ainda não registradas.

Esta convergência **não** implementou código funcional, migration, upload,
storage ou conteúdo, e **não** relaxou nenhum gate de Nível 2, MFA ou LGPD.
