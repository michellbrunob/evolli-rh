-- ---------------------------------------------------------------------------
-- T208 — Configurações › Meu perfil: nome de exibição da própria conta.
-- Migration ADITIVA, aprovada em 2026-11-12 (decisões MPA-1 e MPA-10,
-- docs/decisions/t208-dossie-configuracoes-meu-perfil.md, seções 21 e 22).
--
-- - `nome_exibicao`: ANULÁVEL. As contas existentes não recebem valor
--   inventado; sem nome, a interface usa o e-mail. Quando presente, de 2 a 80
--   caracteres e sem espaço nas extremidades (CHECK; o servidor normaliza e
--   valida antes, o banco é a rede).
-- - `perfil_atualizado_em`: ANULÁVEL. Muda só quando a própria pessoa salva o
--   perfil (não com senha, papel ou desativação, que mexem em `updated_at`), e
--   é a versão da concorrência otimista de `PATCH /v1/users/me`.
-- - Nova ação de auditoria, sem conteúdo do nome. Nenhum privilégio muda: o
--   `evolli_app` já atualiza `access_user`.
-- ---------------------------------------------------------------------------

-- AlterEnum (PostgreSQL 12+: ADD VALUE na transacao; nenhum valor novo e
-- usado nesta mesma migration)
ALTER TYPE "AuditAction" ADD VALUE 'conta.perfil.atualizado';

-- AlterTable
ALTER TABLE "access_user" ADD COLUMN "nome_exibicao" VARCHAR(80),
ADD COLUMN "perfil_atualizado_em" TIMESTAMP(3);

ALTER TABLE "access_user"
  ADD CONSTRAINT "access_user_nome_exibicao_formato_check"
  CHECK (
    "nome_exibicao" IS NULL
    OR (
      char_length("nome_exibicao") BETWEEN 2 AND 80
      AND "nome_exibicao" = btrim("nome_exibicao")
    )
  );
