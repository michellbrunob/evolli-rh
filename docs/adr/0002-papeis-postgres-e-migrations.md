# ADR 0002 — Papéis de PostgreSQL e estratégia de migrations

- Status: aceito
- Data: 2026-07-31
- Relacionado: [docs/modules/etapa0-fatia2-postgres-migrations.md](../modules/etapa0-fatia2-postgres-migrations.md), [ADR 0001](0001-fundacao-api.md)

## Contexto

A Etapa 0 — Fatia 1 entregou a fundação de `apps/api` sem PostgreSQL operacional:
schema Prisma sem `model`, sem conexão validada em runtime, sem migrations. A
Fatia 2 torna o banco uma dependência real. Antes de qualquer implementação, era
necessário decidir: quantos papéis de banco a aplicação usa, como health check
expõe (ou não expõe) prontidão de banco, e como testes de integração acessam um
banco real sem depender de infraestrutura compartilhada.

O produto trata dados de RH/DP, potencialmente sensíveis (LGPD). O princípio de
menor privilégio e negação por padrão, já registrado no plano mestre
(`PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`, §3), se aplica também ao acesso da
aplicação ao próprio banco: um exploit na API não deve conseguir alterar schema
ou escalar privilégio a nível de banco.

## Decisão

### 1. Dois papéis de banco, nunca um usuário administrador único

- `evolli_migrator`: único papel autorizado a `CREATE`/`ALTER`/`DROP` no schema
  da aplicação. Usado apenas para rodar `prisma migrate deploy`, em CI/CD ou por
  operador humano — nunca pela API em runtime.
- `evolli_app`: usado pela API em runtime, via `DATABASE_URL`. Restrito a DML
  necessário (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) nas tabelas do schema da
  aplicação. Sem `CREATE`, `ALTER`, `DROP` e sem qualquer privilégio
  administrativo.
- Nenhum dos dois é o usuário `postgres`/superusuário do cluster.
- Scripts de provisionamento (criação de role, grants) ficam versionados em
  `infra/postgres/`, parametrizados por variável de ambiente no momento da
  execução. Nenhuma credencial real entra no Git em nenhuma hipótese.

### 2. Prisma Migrate como ferramenta de migration, sem down automática

- `prisma migrate dev` gera migrations localmente a partir do diff do schema;
  `prisma migrate deploy` aplica migrations já commitadas em CI/CD e ambientes
  compartilhados, sem gerar novas.
- Toda migration é um diretório versionado com `migration.sql` revisável em PR.
- Migrations preferencialmente aditivas; mudanças destrutivas seguem padrão
  expand/contract (adicionar → migrar dado → remover em release posterior).
- Prisma não gera rollback automático. Reversão é tratada por **forward-fix**
  (nova migration corretiva) como caminho preferencial, com `rollback.sql` e
  runbook manual documentado como alternativa para os casos em que reverter é
  necessário.

### 3. Health checks separados: `/v1/health` (app) e `/v1/health/ready` (banco)

- `GET /v1/health` continua público e verifica somente a aplicação (sem
  regressão da Fatia 1).
- Nova rota `GET /v1/health/ready` verifica prontidão do banco (`SELECT 1`),
  retornando `503` em indisponibilidade, sem jamais expor host, porta, SQL,
  credenciais ou qualquer detalhe interno na resposta.
- Em homologação e produção, o acesso a `/v1/health/ready` é restrito ao
  orquestrador por controle de infraestrutura (rede/proxy), não por lógica de
  autenticação na aplicação.

### 4. Testes de integração com Testcontainers

- Testes de integração sobem PostgreSQL efêmero via Testcontainers, isolado por
  execução, nunca contra banco de homologação/produção.
- Cada execução aplica migrations do zero antes dos testes, validando o schema
  real.

## Alternativas descartadas

| Alternativa                                                           | Por que foi descartada                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Um único usuário de banco (aplicação = migração)                      | Viola menor privilégio: um exploit de RCE na API poderia alterar schema, dropar tabela ou criar backdoor de dados. Rejeitado.                                                                                                                |
| Usuário `postgres`/superusuário para a aplicação                      | Mesmo risco acima, agravado — acesso a todo o cluster, não só ao schema da aplicação. Rejeitado.                                                                                                                                             |
| Banco de testes compartilhado (fixo, persistente) em vez de efêmero   | Testes ficariam acoplados a estado residual entre execuções, mascarando bugs de isolamento; exigiria coordenação manual de reset. Rejeitado em favor de Testcontainers.                                                                      |
| Serviço `postgres:` nativo do GitHub Actions em vez de Testcontainers | Mais simples em CI, mas não roda igual em desenvolvimento local sem duplicar configuração; Testcontainers funciona igual em CI e local, com a mesma API de código. Descartado a favor de portabilidade.                                      |
| Expor status de banco em `GET /v1/health` (endpoint único)            | Mistura liveness (processo vivo) com readiness (dependência externa disponível); um orquestrador não consegue diferenciar "app travada" de "banco fora" para decidir reiniciar container vs. tirar de load balancer. Separado em duas rotas. |
| Restringir `/v1/health/ready` por autenticação na aplicação           | Adiciona complexidade de auth para um endpoint técnico de infraestrutura; a prática comum é restringir por rede/borda, não por credencial de aplicação. Descartado nesta fatia.                                                              |
| Migration com rollback automático gerado pela ferramenta              | Prisma Migrate não oferece isso nativamente; construir tooling próprio de down-migration é escopo desproporcional para a fatia. Optado por forward-fix + runbook manual.                                                                     |

## Consequências

- A aplicação nunca consegue alterar o próprio schema em runtime — qualquer
  mudança de schema exige rodar migration explicitamente com `evolli_migrator`,
  fora do processo da API.
- Times precisam manter duas connection strings por ambiente
  (`DATABASE_URL` e `MIGRATE_DATABASE_URL`), aumentando levemente a superfície de
  configuração, em troca de isolamento de privilégio.
- CI precisa de Docker disponível para rodar Testcontainers — runners sem suporte
  a isso quebram o pipeline de testes de integração (risco já registrado na
  especificação da fatia).
- `GET /v1/health/ready` sem restrição de acesso a nível de aplicação depende de
  infraestrutura para não ficar publicamente acessível em produção — se a
  configuração de rede não for aplicada, o endpoint fica exposto (sem vazar dado
  sensível, mas revelando sinal de disponibilidade de banco a qualquer chamador).
- Toda migration destrutiva exige revisão humana e runbook associado antes de
  merge — aumenta a barreira de PR para esse tipo de mudança, deliberadamente.

## Responsabilidades

- **Time de desenvolvimento (código):** manter `infra/postgres/` sem credencial,
  garantir que `evolli_app` nunca receba privilégio de DDL nas migrations, manter
  `/v1/health/ready` sem vazamento de detalhe interno, escrever runbook de
  rollback em toda migration destrutiva.
- **TI/Infraestrutura:** provisionar o PostgreSQL gerenciado de homologação/
  produção, aplicar a restrição de rede a `/v1/health/ready`, definir e operar a
  política de backup gerenciado/criptografado (pendente do provedor).
- **Revisor de PR:** bloquear merge de migration destrutiva sem `rollback.sql`/
  runbook, e de qualquer script em `infra/postgres/` que contenha valor que
  pareça credencial real.

## Limitações

- Esta ADR não escolhe o provedor de PostgreSQL gerenciado de homologação/
  produção — permanece pendência do plano mestre.
- Não cobre backup/restauração gerenciados de homologação/produção — só o
  procedimento local com `pg_dump`/`pg_restore`, documentado na especificação da
  fatia.
- Não define o mecanismo exato (proxy, security group, service mesh) de restrição
  de rede a `/v1/health/ready` — fica a cargo da infraestrutura de cada ambiente.
- Não introduz nenhum modelo de domínio, autenticação, RBAC ou auditoria — fora
  de escopo desta fatia e desta ADR.
