# Etapa 0 — Fatia 1: Fundação da API

## Objetivo

Inicializar `apps/api` (Node.js + TypeScript) com arquitetura modular, pronta para
PostgreSQL e API REST versionada, sem qualquer módulo funcional de RH.

## Escopo — entra

- Bootstrap NestJS + TypeScript estrito.
- Endpoint público `GET /v1/health` (status, versão, timestamp UTC).
- Validação de ambiente (`.env.example`, sem segredo padrão).
- Tratamento centralizado de erro com `request_id`, sem stack trace na resposta.
- Logs estruturados sem dado pessoal, token, senha ou corpo de requisição.
- Base OpenAPI (`/docs`) incluindo `/v1/health`.
- Testes automatizados (e2e) do `/health` e do tratamento de erro.
- Schema Prisma vazio, só com `datasource` PostgreSQL (sem models).

## Escopo — não entra

- Autenticação, MFA, sessão, RBAC/ABAC.
- Auditoria.
- Qualquer módulo de RH/DP (colaboradores, folha, ponto, etc.).
- Dados pessoais reais ou fictícios de colaborador.
- Integrações externas.
- Filas assíncronas.

## Dados pessoais tratados

Nenhum. Endpoint de saúde não recebe nem retorna dado de colaborador.

## Atores / permissões

`GET /v1/health` é público (sem autenticação) — usado por orquestrador/monitoramento.

## Modelo de dados

Nenhum modelo de domínio. `prisma/schema.prisma` define apenas `datasource`.

## APIs

| Método | Rota         | Descrição                     | Autenticação |
| ------ | ------------ | ----------------------------- | ------------ |
| GET    | `/v1/health` | status, versão, timestamp UTC | pública      |

## Estratégia de teste

- `test/health.e2e-spec.ts`: valida contrato de resposta, ausência de dado sensível,
  presença de `x-request-id`.
- `test/error-handling.e2e-spec.ts`: valida corpo de erro estruturado, ausência de
  stack trace, propagação de `request_id`.

## Riscos

- Sem Postgres real disponível em CI/local, testes desta fatia não dependem de
  conexão ativa (schema Prisma sem models, endpoint de saúde não consulta banco).
  Validação de conectividade real fica para fatia seguinte (health check de banco).

## Critérios de aceite

- [x] `pnpm --filter @evolli/api build` conclui sem erro.
- [x] `pnpm --filter @evolli/api typecheck` sem erro.
- [x] `pnpm --filter @evolli/api test:e2e` verde.
- [x] Resposta de erro nunca contém stack trace ou path de arquivo.
- [x] Nenhum log ou teste contém dado pessoal real.
