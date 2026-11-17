-- T209 — Novo colaborador, etapa 1 (dados básicos). Migration aditiva.
--
-- * `data_nascimento` deixa de ser obrigatória (decisão de 2026-11-17); a
--   borda inferior (CHECK de 1900-01-01) continua valendo quando há valor.
-- * Perfil pessoal ganha CPF (só os 11 dígitos; dígitos verificadores
--   conferidos no servidor), RG, gênero em lista fechada e o contato de
--   emergência (nome e telefone em +55 + DDD + número).
-- * CPF único na empresa: o mesmo CPF em outra empresa é outro perfil.
-- * Trilha: cinco nomes de campo novos em "CampoDadosPessoais" (nunca valores).

ALTER TYPE "CampoDadosPessoais" ADD VALUE IF NOT EXISTS 'cpf';
ALTER TYPE "CampoDadosPessoais" ADD VALUE IF NOT EXISTS 'rg';
ALTER TYPE "CampoDadosPessoais" ADD VALUE IF NOT EXISTS 'genero';
ALTER TYPE "CampoDadosPessoais" ADD VALUE IF NOT EXISTS 'contato_emergencia_nome';
ALTER TYPE "CampoDadosPessoais" ADD VALUE IF NOT EXISTS 'contato_emergencia_telefone';

ALTER TABLE "perfil_pessoal_colaborador"
  ALTER COLUMN "data_nascimento" DROP NOT NULL,
  ADD COLUMN "cpf" TEXT,
  ADD COLUMN "rg" TEXT,
  ADD COLUMN "genero" TEXT,
  ADD COLUMN "contato_emergencia_nome" TEXT,
  ADD COLUMN "contato_emergencia_telefone" TEXT;

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_cpf_check"
  CHECK ("cpf" IS NULL OR "cpf" ~ '^[0-9]{11}$');

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_rg_check"
  CHECK ("rg" IS NULL OR (char_length("rg") BETWEEN 1 AND 20 AND "rg" !~ '[[:cntrl:]]'));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_genero_check"
  CHECK ("genero" IS NULL OR "genero" IN ('feminino', 'masculino', 'outro', 'prefiro_nao_informar'));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_contato_emergencia_check"
  CHECK (
    ("contato_emergencia_nome" IS NULL OR (char_length("contato_emergencia_nome") BETWEEN 1 AND 150 AND "contato_emergencia_nome" !~ '[[:cntrl:]]'))
    AND ("contato_emergencia_telefone" IS NULL OR "contato_emergencia_telefone" ~ '^\+55[1-9]{2}(9[0-9]{8}|[2-5][0-9]{7})$')
  );

CREATE UNIQUE INDEX "perfil_pessoal_colaborador_empresa_id_cpf_key"
  ON "perfil_pessoal_colaborador" ("empresa_id", "cpf");
