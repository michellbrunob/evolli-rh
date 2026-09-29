# Roadmap do Evolli RH

## Regra de entrega

Cada etapa exige especificação aprovada, testes automatizados, revisão de segurança/LGPD, homologação com a área responsável e evidências de aceite antes da próxima.

| Etapa | Módulo/resultado                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| 0     | Fundação: monorepo, CI, PostgreSQL, identidade, MFA, RBAC/ABAC, auditoria, documentos seguros, backup e LGPD |
| 1     | Core organizacional: empresas, unidades, cargos, vínculos e colaboradores                                    |
| 2     | Documentos e admissão digital                                                                                |
| 3     | Jornada e ponto rastreável, com importação TXT e fechamento                                                  |
| 4     | Folha e DP: rubricas, férias, 13º, afastamentos, rescisão e provisões                                        |
| 5     | Pagamentos, aprovações e integrações financeiras/contábeis                                                   |
| 6     | Treinamentos e compliance                                                                                    |
| 7     | ATS e recrutamento                                                                                           |
| 8     | People Analytics executivo                                                                                   |
| 9     | Clima anônimo e planos de ação                                                                               |
| 10    | Portal, integrações e IA governada                                                                           |

> **Nota de convergência (T032).** A Etapa 0 lista a Fundação de forma
> agregada, mas nem tudo que ela cita está **entregue** — parte são **gates
> pendentes**, que bloqueiam qualquer uso com dado real:
>
> - **Entregue e integrado:** monorepo, CI, PostgreSQL/Prisma, identidade e
>   sessão, RBAC/ABAC, auditoria formal append-only, documentos V1 de metadados
>   (sem conteúdo).
> - **MFA TOTP implementado e opcional no lançamento inicial:** `MFA_ENABLED=false` conforme T132;
>   ativação futura depende de cofre/chave, evidências `DS-SEC-*` e decisão de rollout. Fator já ativo
>   nunca é rebaixado para autenticação apenas por senha.
> - **Pendente conforme gates próprios:** decisões operacionais da **T004** (cofre de segredos,
>   **backup/restauração testada**); **runbook de
>   provisionamento do primeiro `master_tecnico`**; definições de **retenção,
>   base legal e RIPD/DPIA** por módulo (RH + Jurídico). Ver
>   [decisões de segurança operacional (T004)](decisions/etapa0-seguranca-operacional-pendente.md)
>   e [convergência de governança e perfis](decisions/convergencia-governanca-perfis-pendente.md).
>
> As etapas 4–10 estão **planejadas**, sem especificação aprovada; o conteúdo de
> cada uma é decisão de Produto/RH. "Reserva Fiscal" é o **nome da empresa**, não
> uma etapa/módulo (ver [glossário](decisions/glossario-reserva-fiscal.md)).

> **Nota de convergência Spec Kit (T138, 29/09/2026).** O estado integrado chega à T136;
> `PD-SOL-01..05` estão aprovadas e a ADR 0013 define o Cloudflare R2 como provedor privado futuro,
> sem habilitar upload. T137 não foi iniciada e foi substituída pela T139, próxima fundação backend
> após a integração da T138. O ledger versionado está em
> [`.specify/execution-status.md`](../.specify/execution-status.md).
