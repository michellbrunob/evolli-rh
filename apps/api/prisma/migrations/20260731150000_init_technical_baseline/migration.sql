-- Migration técnica de baseline (Etapa 0, Fatia 2).
-- Nenhuma tabela, coluna ou dado de domínio de RH é criado aqui.
--
-- O schema "app" já é criado antes desta migration rodar, por
-- infra/postgres/02_schema_and_grants.sql (executado pelo usuário admin,
-- com AUTHORIZATION evolli_migrator) — ver infra/postgres/README.md. Esta
-- migration só estabelece o baseline de histórico do Prisma Migrate (a
-- tabela de controle _prisma_migrations, criada automaticamente pelo
-- próprio Prisma dentro do schema "app").
SELECT 1;
