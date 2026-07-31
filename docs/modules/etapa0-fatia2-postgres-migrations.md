# Etapa 0 — Fatia 2: PostgreSQL operacional, migrations e confiabilidade de dados

Status: **especificação aprovada — decisões fechadas, implementação ainda não iniciada**

Decisão arquitetural registrada em [docs/adr/0002-papeis-postgres-e-migrations.md](../adr/0002-papeis-postgres-e-migrations.md).

## 1. Objetivo e escopo

### Objetivo

Tornar o PostgreSQL uma dependência operacional real da `apps/api` — conexão
validada em runtime, migrations versionadas e aplicáveis de forma repetível, e
um health check de banco seguro — sem introduzir nenhum modelo de domínio de RH.

### Escopo — entra

- Estrutura de migrations Prisma (`prisma/migrations/`), com a primeira migration
  vazia/técnica (extensões básicas, se necessárias) — **sem tabelas de domínio**.
- Separação de usuário de banco de aplicação (DML) vs. usuário de migração (DDL),
  com privilégios mínimos documentados.
- Estratégia de conexão por ambiente (local/homologação/produção) via variável de
  ambiente, sem segredo versionado.
- Nova rota `GET /v1/health/ready`, verificando prontidão do banco. `GET /v1/health`
  permanece só de aplicação (ver §6).
- `docker-compose.yml` de desenvolvimento local com PostgreSQL (ver §4).
- Scripts futuros de provisionamento dos papéis de banco em `infra/postgres/`
  (ver §3).
- Estratégia de teste de integração com banco efêmero via Testcontainers (ver §7).
- Backup/restauração local documentado e testado com `pg_dump`/`pg_restore`,
  e estratégia de evidência mínima de recuperação (ver §8).
- Runbook de rollback de migration.

### Escopo — não entra

- Qualquer tabela/model de domínio (colaborador, empresa, cargo, folha, ponto etc.).
- Autenticação, MFA, RBAC/ABAC, auditoria.
- Provisionamento real de infraestrutura (RDS, Cloud SQL, container de produção) —
  esta fatia especifica e prepara o código; a criação do banco gerenciado é decisão
  de infraestrutura fora do escopo de código.
- Backup gerenciado/criptografado de homologação/produção — depende do provedor,
  ainda pendente (§9).
- Execução de `prisma migrate deploy`/`db push` em qualquer ambiente compartilhado.
- Instalação de dependências ou alteração de `package.json`/lockfile.
- Redis, filas, object storage.

## 2. Dados pessoais tratados

**Nenhum.** Nenhuma tabela de domínio é criada nesta fatia. O schema Prisma segue
sem `model`; migrations desta fatia são técnicas (ex.: extensões, schema de
auditoria técnica de migration do próprio Prisma). Testes de integração usam dados
sintéticos não pessoais (ex.: tabela de smoke test descartável, se necessária).

## 3. Arquitetura proposta — PostgreSQL + Prisma

### Separação de usuários e privilégios mínimos (decisão fechada)

Dois papéis de banco distintos, nunca um usuário administrador único usado pela
aplicação:

| Papel             | Uso                                                      | Privilégios                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `evolli_migrator` | Rodar `prisma migrate deploy` (CI/CD ou operador humano) | `CREATE`, `ALTER`, `DROP` no schema da aplicação; **sem** acesso a outros bancos/schemas                                                                                       |
| `evolli_app`      | Usado pela API em runtime (`DATABASE_URL` da aplicação)  | Somente DML necessário (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) nas tabelas do schema da aplicação; **sem** `CREATE`, `ALTER`, `DROP` e sem qualquer privilégio administrativo |

- Nenhum dos dois é o usuário `postgres`/superusuário.
- `DATABASE_URL` da aplicação (runtime) usa `evolli_app`. Uma variável separada
  (`MIGRATE_DATABASE_URL`, usada só no passo de migration) usa `evolli_migrator`.
- Isso limita o raio de dano de uma falha/exploit na API: mesmo com RCE na
  aplicação, não é possível alterar schema, criar tabela oculta ou dropar dados.
- Scripts futuros de criação/gestão desses papéis ficam em `infra/postgres/`
  (SQL de provisionamento de role/grant, versionado). **Credenciais nunca entram
  no Git** — os scripts parametrizam usuário/senha via variável de ambiente no
  momento da execução, nunca com valor embutido.

### Prisma

- `schema.prisma` continua sem `model` nesta fatia.
- `datasource db` passa a apontar para `DATABASE_URL` (runtime/app) explicitamente;
  o comando de migration usa `--url` ou variável dedicada apontando para o usuário
  migrator (Prisma permite `directUrl`/env separada para isso).
- Client Prisma (`@prisma/client`) gerado em build (`prisma generate`), não em
  runtime.

## 4. Estratégia de ambiente (local / homologação / produção)

- **Local:** `docker-compose.yml` exclusivo para desenvolvimento (decisão
  fechada), com:
  - serviço PostgreSQL;
  - volume persistente (dados sobrevivem a `docker compose restart`/`stop`);
  - health check do container (`pg_isready` ou equivalente);
  - porta publicada vinculada a `127.0.0.1` (nunca `0.0.0.0`), evitando exposição
    do banco local na rede.
  - Nenhuma credencial real no arquivo; usa `.env` local ignorado pelo git, com
    placeholders em `.env.example` (já é o padrão hoje).
- **Homologação/produção:** instância gerenciada (fora do escopo de código desta
  fatia). API recebe `DATABASE_URL`/`MIGRATE_DATABASE_URL` via variável de
  ambiente/cofre de segredos da plataforma (GitHub Environments, conforme já
  registrado em `PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`), nunca em arquivo no
  repositório.
- **Nenhum segredo real versionado** em nenhum ambiente — `.env.example` só com
  placeholders, `.gitignore` já cobre `.env`/`.env.*`.
- SSL/TLS: `sslmode=require` (ou equivalente) obrigatório em homologação e
  produção; opcional em local. Validado no `env.validation.ts` por ambiente.

## 5. Estratégia de migrations reversíveis/revisáveis

- Uso de `prisma migrate dev` (local, gera migration a partir de diff do schema)
  e `prisma migrate deploy` (CI/CD e ambientes compartilhados, aplica migrations
  já commitadas, nunca gera novas).
- Toda migration é um diretório versionado em `prisma/migrations/<timestamp>_nome/`
  com `migration.sql` revisável em PR — nenhuma migration aplicada sem revisão de
  código.
- Migrations são **aditivas por padrão** (evitar `DROP COLUMN`/`DROP TABLE`
  destrutivo em um único passo); mudanças destrutivas seguem padrão _expand/contract_
  (adicionar → migrar dado → remover em migration separada, em release posterior).
- Rollback: Prisma não gera "down migration" automática. Estratégia adotada:
  (a) toda migration destrutiva exige script de rollback manual documentado no
  próprio PR: um `rollback.sql` associado registrado dentro de docs, revisado; e
  (b) para o caso comum, preferir _forward-fix_ (nova migration corrigindo) em vez
  de reverter, já que reverter uma migration já aplicada em produção com dados
  reais é mais arriscado que uma migration corretiva.
- CI valida migrations pendentes (`prisma migrate status` / `prisma migrate diff`)
  para impedir schema drift entre código e banco de homologação.

## 6. Health checks — sem vazar detalhe interno (decisão fechada)

- `GET /v1/health` **permanece público e verifica somente a aplicação**
  (status do processo, versão, timestamp — como já implementado na Fatia 1).
  Não passa a consultar o banco.
- Nova rota `GET /v1/health/ready` verifica prontidão do banco (`SELECT 1` com
  timeout curto):
  - retorna **503** quando o banco está indisponível;
  - **nunca** inclui na resposta: host, porta, nome do banco, usuário, string de
    conexão, versão do PostgreSQL, mensagem de erro do driver/SQL — mesmo padrão
    já aplicado no `AllExceptionsFilter` (ADR 0001);
  - detalhe técnico da falha vai só para o log estruturado (correlacionado por
    `request_id`), nunca para o corpo HTTP;
  - em homologação e produção, o **acesso a `/v1/health/ready` é restrito ao
    orquestrador pela infraestrutura** (rede interna/proxy), não pela aplicação —
    a rota em si continua sem autenticação a nível de código, a restrição é de
    borda de rede.
- Falha de banco não derruba o processo Node; o endpoint responde 503 sem stack
  trace, sem detalhe interno.

## 7. Testes de integração com banco efêmero (decisão fechada)

- Testcontainers com PostgreSQL: cada execução de teste de integração sobe um
  container PostgreSQL descartável, isolado, destruído ao final da execução.
- Nenhum teste roda contra banco de homologação/produção.
- `test/setup-env.ts` (já existente) passa a apontar `DATABASE_URL` para o
  container efêmero provisionado pelo Testcontainers durante `test:e2e`.
- Cada execução de teste roda migrations do zero contra o banco efêmero
  (`prisma migrate deploy`) antes dos testes, garantindo teste do schema real, não
  de um mock.
- Testes cobrem: aplicação de migrations do zero sem erro, `GET /v1/health/ready`
  retornando prontidão com banco disponível, `GET /v1/health/ready` retornando 503
  com banco indisponível (ex.: container parado/porta fechada), sem detalhe interno
  vazado em nenhum dos dois casos.
- CI precisa suportar execução de container Docker dentro do runner (Docker-in-Docker
  ou runner com Docker disponível) — ver risco em §9.

## 8. Backup, restauração e evidências mínimas de recuperação (decisão fechada para local)

- **Local:** backup e restauração documentados e testados com `pg_dump`/`pg_restore`
  contra o banco do `docker-compose.yml` de desenvolvimento. O runbook inclui:
  comando de dump, comando de restore em banco vazio, e verificação pós-restore
  (contagem de tabelas, `prisma migrate status` consistente). Evidência da execução
  (log do dump/restore) anexada ao PR de implementação desta fatia.
- **Homologação/produção:** política de backup gerenciado e criptografado em
  repouso **continua pendente**, dependente da escolha do provedor de PostgreSQL
  gerenciado (decisão de infraestrutura fora do escopo desta fatia — já registrada
  no plano mestre).
- Runbook de rollback de migration (script + passos) documentado junto de cada
  migration destrutiva, conforme §5.

## 9. Riscos, decisões pendentes e critérios de aceite

### Riscos

- Sem infraestrutura de banco gerenciado definida ainda, ambiente de homologação
  real não pode ser validado nesta fatia — só local/efêmero.
- Ausência de "down migration" automática do Prisma exige disciplina de revisão
  humana em toda migration destrutiva; risco de erro operacional se o runbook não
  for seguido.
- Testcontainers exige Docker disponível no runner de CI; se o runner usado não
  suportar Docker-in-Docker, os testes de integração falham — precisa validação
  do ambiente de CI antes da implementação.
- Restrição de acesso a `GET /v1/health/ready` em homologação/produção depende de
  configuração de infraestrutura (rede/proxy) externa ao código; se essa
  configuração não for aplicada, a rota fica acessível publicamente (sem vazar
  dado sensível, mas expondo sinal de disponibilidade de banco).
- Backup gerenciado de homologação/produção segue pendente do provedor — enquanto
  isso, não há cobertura de recuperação de desastre real fora do ambiente local.

### Decisões pendentes (aguardando definição futura)

1. Provedor de PostgreSQL gerenciado para homologação/produção — segue como
   pendência já registrada no plano mestre (`PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`,
   §7); esta fatia não decide isso, apenas assume "algum Postgres com SSL".
2. Política de backup gerenciado/criptografado para homologação/produção —
   depende da decisão 1.
3. Mecanismo exato de restrição de rede a `GET /v1/health/ready` em homologação/
   produção (proxy reverso, security group, service mesh) — decisão de
   infraestrutura, fora do escopo de código.

### Critérios de aceite

- [ ] `prisma migrate deploy` aplica do zero em banco vazio sem erro, de forma
      idempotente (reexecução não falha).
- [ ] Aplicação recusa subir com `DATABASE_URL` ausente/inválida (já garantido
      hoje por `env.validation.ts`; estende-se a `MIGRATE_DATABASE_URL` se
      adotada).
- [ ] Usuário de runtime (`evolli_app`) comprovadamente não consegue `CREATE`/
      `DROP`/`ALTER` (teste manual ou automatizado de permissão negada).
- [ ] `GET /v1/health` continua respondendo sem consultar banco (não regressão da
      Fatia 1).
- [ ] `GET /v1/health/ready` retorna prontidão com banco disponível e **503** com
      banco indisponível, sem expor host/porta/credencial/SQL em nenhum cenário —
      validado por teste automatizado.
- [ ] Testes de integração rodam contra banco efêmero via Testcontainers,
      isolados, e passam em CI.
- [ ] Nenhuma migration destrutiva é mesclada sem `rollback.sql`/runbook associado.
- [ ] Backup e restauração local (`pg_dump`/`pg_restore`) documentados, testados e
      com evidência anexada ao PR de implementação.
- [ ] `docker-compose.yml` de desenvolvimento usa volume persistente, health check
      e porta vinculada a `127.0.0.1`.
- [ ] Scripts de provisionamento dos papéis de banco em `infra/postgres/` não
      contêm nenhuma credencial real.
- [ ] Nenhum segredo real aparece em `.env.example`, código, teste, log ou
      `infra/postgres/`.
- [ ] Revisão de segurança confirma menor privilégio antes de considerar a fatia
      concluída (conforme rito do §6 do plano mestre).

## 10. Arquivos que seriam alterados na implementação posterior

```text
apps/api/prisma/schema.prisma                  # datasource + eventual configuração de directUrl
apps/api/prisma/migrations/<timestamp>_init/    # primeira migration técnica (sem domínio)
apps/api/.env.example                           # novas variáveis: MIGRATE_DATABASE_URL, sslmode
apps/api/src/config/env.validation.ts           # validação das novas variáveis, por ambiente
apps/api/src/health/health.service.ts           # novo método de prontidão de banco (SELECT 1)
apps/api/src/health/health.controller.ts        # nova rota GET /v1/health/ready
apps/api/src/health/dto/health-ready-response.dto.ts  # novo DTO de prontidão, para OpenAPI
apps/api/test/health.e2e-spec.ts                # cenários ok/indisponível de /v1/health/ready
apps/api/test/                                  # setup de Testcontainers para testes de integração
docker-compose.yml                              # Postgres local: volume, health check, bind 127.0.0.1
infra/postgres/                                 # scripts de provisionamento de evolli_migrator/evolli_app
docs/adr/0002-papeis-postgres-e-migrations.md   # ADR desta decisão
docs/modules/etapa0-fatia2-postgres-migrations.md  # este documento, atualizado para "implementado" ao final
.github/workflows/ci.yml                        # suporte a Docker/Testcontainers no job de testes
```
