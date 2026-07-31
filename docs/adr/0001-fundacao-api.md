# ADR 0001 — Fundação da API (`apps/api`)

- Status: aceito
- Data: 2026-07-31

## Contexto

Início do produto novo (Evolli RH), conforme `PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`.
Etapa 0 exige fundação segura antes de qualquer módulo de domínio. Esta ADR cobre
apenas a primeira fatia: bootstrap da API, sem autenticação, sem RBAC, sem dado real.

## Decisão

- Framework: **NestJS** (preferência já registrada no plano, DI e padrões corporativos).
- Banco: **PostgreSQL** via **Prisma** (schema ainda sem modelos de domínio).
- API **versionada por URI** (`/v1/...`) desde o primeiro endpoint.
- Configuração de ambiente validada com `zod` no bootstrap; aplicação não sobe com
  env inválido.
- Logs estruturados com `nestjs-pino`, com `redact` de campos sensíveis
  (senha, token, cpf, salário, headers de autenticação/cookie).
- Erro tratado por filtro global único (`AllExceptionsFilter`), retornando
  `status_code`, `message` genérica, `request_id` e `timestamp`; nunca stack trace
  ou detalhe interno na resposta HTTP.
- `request_id` gerado (ou propagado do header `x-request-id` do cliente) por
  middleware, presente em toda resposta e em todo log da requisição.
- Documentação OpenAPI via `@nestjs/swagger`, servida em `/docs`.

## Fora de escopo nesta fatia

Autenticação, MFA, RBAC/ABAC, auditoria, gestão de documentos, filas assíncronas,
qualquer módulo de RH/DP, dados reais ou de exemplo pessoal.

## Consequências

- Próxima fatia da Etapa 0 (autenticação/MFA/RBAC/auditoria) parte deste esqueleto.
- Modelos Prisma de domínio só entram a partir da Etapa 1 (core organizacional).
