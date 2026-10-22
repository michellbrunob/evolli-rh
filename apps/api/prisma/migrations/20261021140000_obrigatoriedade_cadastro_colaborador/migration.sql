-- ---------------------------------------------------------------------------
-- T179 — Obrigatoriedade do cadastro de colaborador.
--
-- Decisão da proprietária de 2026-10-21
-- (docs/decisions/t179-obrigatoriedade-cadastro-colaborador.md): na Nova
-- admissão, a MATRÍCULA e os três CONTATOS (e-mail pessoal, celular e
-- telefone) passam a ser opcionais. O banco os exigia (NOT NULL); esta
-- migration só retira essa exigência — é o mínimo indispensável para aceitar
-- uma admissão sem eles.
--
-- O que NÃO muda:
--   - os CHECKs de formato de e-mail, celular e telefone continuam: valem
--     sempre que o valor existe (um CHECK sobre NULL não reprova);
--   - a matrícula informada continua única na empresa
--     (`vinculo_funcional_empresa_id_matricula_key`) e o e-mail pessoal
--     informado também (`contato_colaborador_empresa_id_email_pessoal_key`):
--     o índice único do PostgreSQL não compara NULLs entre si;
--   - nenhum valor já gravado é alterado, apagado ou inventado;
--   - privilégios e triggers, inalterados.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "vinculo_funcional" ALTER COLUMN "matricula" DROP NOT NULL;

-- AlterTable
ALTER TABLE "contato_colaborador" ALTER COLUMN "email_pessoal" DROP NOT NULL,
ALTER COLUMN "celular" DROP NOT NULL,
ALTER COLUMN "telefone" DROP NOT NULL;
