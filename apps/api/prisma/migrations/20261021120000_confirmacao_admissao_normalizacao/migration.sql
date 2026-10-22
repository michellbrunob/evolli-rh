-- ---------------------------------------------------------------------------
-- T179 — Confirmacao da Nova admissao, duplicidade e normalizacao.
--
-- Decisoes da proprietaria de 2026-10-21
-- (docs/decisions/t179-confirmacao-admissao-duplicidade-telefones.md):
--
--   1. E-MAIL PESSOAL UNICO NA MESMA EMPRESA: indice unico
--      (empresa_id, email_pessoal) em `contato_colaborador`. Pode repetir em
--      empresa diferente. A restricao e a garantia: nao ha consulta previa da
--      qual dependa, entao nao ha condicao de corrida.
--   2. IDEMPOTENCIA DO ENVIO DA ADMISSAO: `idempotencia_admissao`, unica por
--      (ator, empresa, chave). Guarda so a chave, quem enviou, a empresa e os
--      ids do que a admissao criou — NENHUM dado pessoal e nenhum resumo do
--      conteudo.
--   3. TELEFONE SO BRASILEIRO, em `+55` + DDD + numero. Os ja gravados sao
--      convertidos aqui, so quando a forma e inequivoca.
--   4. O que nao tiver forma inequivoca NAO RECEBE CHUTE: fica como esta e
--      entra em `revisao_normalizacao_cadastro` com o registro e o NOME do
--      campo — nunca o valor. O mesmo vale para o CEP brasileiro (8 digitos).
--
-- E-MAIL JA REPETIDO: se a base ja tiver e-mail pessoal repetido na mesma
-- empresa, esta migration PARA, informando so a quantidade de grupos. A
-- restricao nao pode nascer sobre duplicidade, e escolher qual manter seria
-- chute. Nenhum valor sai na mensagem.
--
-- CONVERSAO DE FORMATO: muda so a forma de escrever o MESMO numero ou CEP
-- (ex.: 10 digitos nacionais -> `+55` + os mesmos 10 digitos). Nao e edicao de
-- conteudo: `atualizado_em`, `atualizado_por` e a trilha de tratamento nao
-- mudam, e nenhum valor e escrito em log ou auditoria.
--
-- PRIVILEGIOS: as tabelas novas nascem com SELECT/INSERT/UPDATE/DELETE para
-- `evolli_app` via ALTER DEFAULT PRIVILEGES; esta migration so RETIRA:
--   idempotencia_admissao           UPDATE, DELETE          (append-only)
--   revisao_normalizacao_cadastro   INSERT, UPDATE, DELETE  (so a migration
--                                                            escreve)
-- ---------------------------------------------------------------------------

-- 1. Pre-condicao do e-mail unico: nada repetido na mesma empresa.
DO $$
DECLARE
  grupos integer;
BEGIN
  SELECT count(*) INTO grupos
    FROM (
      SELECT 1
        FROM "contato_colaborador"
       GROUP BY "empresa_id", "email_pessoal"
      HAVING count(*) > 1
    ) repetidos;
  IF grupos > 0 THEN
    RAISE EXCEPTION
      'T179: % grupo(s) de e-mail pessoal repetido na mesma empresa. Revise esses contatos antes de aplicar a migration; ela nao escolhe qual manter.',
      grupos;
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "EntidadeRevisaoNormalizacao" AS ENUM ('contato_colaborador', 'endereco_colaborador');

-- CreateEnum
CREATE TYPE "CampoRevisaoNormalizacao" AS ENUM ('celular', 'telefone', 'cep');

-- CreateEnum
CREATE TYPE "MotivoRevisaoNormalizacao" AS ENUM ('forma_nao_inequivoca');

-- CreateTable
CREATE TABLE "idempotencia_admissao" (
    "id" TEXT NOT NULL,
    "chave" UUID NOT NULL,
    "ator_user_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "movimentacao_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotencia_admissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisao_normalizacao_cadastro" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "entidade" "EntidadeRevisaoNormalizacao" NOT NULL,
    "registro_id" TEXT NOT NULL,
    "campo" "CampoRevisaoNormalizacao" NOT NULL,
    "motivo" "MotivoRevisaoNormalizacao" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisao_normalizacao_cadastro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idempotencia_admissao_empresa_id_idx" ON "idempotencia_admissao"("empresa_id");

-- CreateIndex
CREATE INDEX "idempotencia_admissao_colaborador_id_idx" ON "idempotencia_admissao"("colaborador_id");

-- CreateIndex
CREATE INDEX "idempotencia_admissao_vinculo_id_empresa_id_idx" ON "idempotencia_admissao"("vinculo_id", "empresa_id");

-- CreateIndex
CREATE INDEX "idempotencia_admissao_movimentacao_id_idx" ON "idempotencia_admissao"("movimentacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotencia_admissao_ator_user_id_empresa_id_chave_key" ON "idempotencia_admissao"("ator_user_id", "empresa_id", "chave");

-- CreateIndex
CREATE INDEX "revisao_normalizacao_cadastro_empresa_id_idx" ON "revisao_normalizacao_cadastro"("empresa_id");

-- CreateIndex
CREATE INDEX "revisao_normalizacao_cadastro_colaborador_id_idx" ON "revisao_normalizacao_cadastro"("colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "revisao_normalizacao_cadastro_entidade_registro_id_campo_key" ON "revisao_normalizacao_cadastro"("entidade", "registro_id", "campo");

-- CreateIndex — e-mail pessoal unico na mesma empresa (decisao 1).
CREATE UNIQUE INDEX "contato_colaborador_empresa_id_email_pessoal_key" ON "contato_colaborador"("empresa_id", "email_pessoal");

-- AddForeignKey
ALTER TABLE "idempotencia_admissao" ADD CONSTRAINT "idempotencia_admissao_ator_user_id_fkey" FOREIGN KEY ("ator_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotencia_admissao" ADD CONSTRAINT "idempotencia_admissao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotencia_admissao" ADD CONSTRAINT "idempotencia_admissao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotencia_admissao" ADD CONSTRAINT "idempotencia_admissao_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotencia_admissao" ADD CONSTRAINT "idempotencia_admissao_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "movimentacao_funcional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisao_normalizacao_cadastro" ADD CONSTRAINT "revisao_normalizacao_cadastro_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisao_normalizacao_cadastro" ADD CONSTRAINT "revisao_normalizacao_cadastro_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Telefones ja gravados -> `+55` + DDD + numero, so quando inequivoco.
--
-- Forma gravada antes da T179: so digitos, com `+` opcional no inicio.
-- Leitura nacional (os digitos sem o 55 do pais):
--   `+55` + 10 ou 11 digitos       -> os 10 ou 11 digitos;
--   `+` de outro pais               -> nenhuma (revisao);
--   10 ou 11 digitos sem `+`        -> eles mesmos (numero nacional);
--   12 ou 13 digitos iniciados em 55 -> sem o 55 (pais sem o `+`);
--   qualquer outro comprimento      -> nenhuma (revisao).
-- A leitura so vale se for DDD de 1 a 9 nos dois digitos e celular com 9
-- digitos iniciado por 9 ou fixo com 8 digitos iniciado por 2 a 5 — a mesma
-- regra do servidor. Zero de tronco (0xx) NAO e retirado: seria chute.
CREATE TEMPORARY TABLE "t179_telefone" ON COMMIT DROP AS
SELECT
  t."id",
  t."empresa_id",
  t."colaborador_id",
  t."campo",
  t."valor",
  CASE
    WHEN t."nacional" ~ '^[1-9]{2}(9[0-9]{8}|[2-5][0-9]{7})$'
      THEN '+55' || t."nacional"
  END AS "novo"
FROM (
  SELECT
    b.*,
    CASE
      WHEN b."valor" ~ '^\+55[0-9]{10,11}$' THEN substr(b."digitos", 3)
      WHEN b."valor" ~ '^\+' THEN NULL
      WHEN length(b."digitos") IN (10, 11) THEN b."digitos"
      WHEN length(b."digitos") IN (12, 13) AND b."digitos" LIKE '55%'
        THEN substr(b."digitos", 3)
    END AS "nacional"
  FROM (
    SELECT c."id", c."empresa_id", c."colaborador_id", 'celular' AS "campo",
           c."celular" AS "valor",
           regexp_replace(c."celular", '[^0-9]', '', 'g') AS "digitos"
      FROM "contato_colaborador" c
    UNION ALL
    SELECT c."id", c."empresa_id", c."colaborador_id", 'telefone' AS "campo",
           c."telefone" AS "valor",
           regexp_replace(c."telefone", '[^0-9]', '', 'g') AS "digitos"
      FROM "contato_colaborador" c
  ) b
) t;

UPDATE "contato_colaborador" c
   SET "celular" = t."novo"
  FROM "t179_telefone" t
 WHERE t."id" = c."id"
   AND t."campo" = 'celular'
   AND t."novo" IS NOT NULL
   AND t."novo" <> t."valor";

UPDATE "contato_colaborador" c
   SET "telefone" = t."novo"
  FROM "t179_telefone" t
 WHERE t."id" = c."id"
   AND t."campo" = 'telefone'
   AND t."novo" IS NOT NULL
   AND t."novo" <> t."valor";

INSERT INTO "revisao_normalizacao_cadastro"
  ("id", "empresa_id", "colaborador_id", "entidade", "registro_id", "campo", "motivo")
SELECT gen_random_uuid()::text, t."empresa_id", t."colaborador_id",
       'contato_colaborador', t."id",
       t."campo"::"CampoRevisaoNormalizacao", 'forma_nao_inequivoca'
  FROM "t179_telefone" t
 WHERE t."novo" IS NULL;

-- 3. CEP brasileiro ja gravado -> 8 digitos, so quando inequivoco.
--
-- So com pais Brasil (mesma comparacao do servidor, sem caixa e sem espaco
-- nas pontas). `00000-000` vira `00000000`; `00000000` fica; qualquer outra
-- forma fica como esta e vai para a revisao. Outro pais nao muda.
UPDATE "endereco_colaborador"
   SET "cep" = replace("cep", '-', '')
 WHERE lower(btrim("pais")) = 'brasil'
   AND "cep" ~ '^[0-9]{5}-[0-9]{3}$';

INSERT INTO "revisao_normalizacao_cadastro"
  ("id", "empresa_id", "colaborador_id", "entidade", "registro_id", "campo", "motivo")
SELECT gen_random_uuid()::text, e."empresa_id", e."colaborador_id",
       'endereco_colaborador', e."id", 'cep', 'forma_nao_inequivoca'
  FROM "endereco_colaborador" e
 WHERE lower(btrim(e."pais")) = 'brasil'
   AND e."cep" IS NOT NULL
   AND e."cep" !~ '^[0-9]{8}$';

-- 4. Privilegios.
REVOKE UPDATE, DELETE ON TABLE "idempotencia_admissao" FROM evolli_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE "revisao_normalizacao_cadastro" FROM evolli_app;
