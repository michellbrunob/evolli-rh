-- ---------------------------------------------------------------------------
-- T177 — Cadastro de colaborador, Modulo 1: dados pessoais e endereco.
--
-- Cria DOIS agregados proprios, por colaborador E empresa, fora de
-- `colaborador` (ADR 0016, decisao 3), no mesmo desenho dos contatos da T169:
--
--   1. `perfil_pessoal_colaborador` — data de nascimento, sexo, saudacao, estado civil, nacionalidade, naturalidade,
--      escolaridade, curso, nome do pai e nome da mae.
--   2. `endereco_colaborador` — pais, CEP, logradouro, numero, complemento,
--      bairro, cidade e estado.
--
-- e a trilha de tratamento `dados_pessoais_colaborador_evento` (categoria,
-- acao, resultado e NOMES dos campos, nunca os valores), porque `audit_event`
-- nao tem coluna de detalhe (ADR 0004 §5).
--
-- TODOS OS CAMPOS SAO OPCIONAIS E EM TEXTO CONTROLADO. Nao ha catalogo
-- canonico no sistema para sexo, saudacao, estado civil,
-- escolaridade, pais, UF ou municipio; esta migration nao inventa taxonomia.
-- O servidor apara, colapsa espacos e grava vazio como NULL; os CHECKs abaixo
-- sao a rede de seguranca contra qualquer outro caminho.
--
-- FICHA DE TRATAMENTO: estas categorias sao A2 na ADR 0016 e dependem de
-- ficha aprovada (decisao 5.4). A ficha e redigida na mesma PR, e o merge
-- depende da aprovacao da proprietaria.
--
-- PRIVILEGIOS: as tabelas nascem com SELECT/INSERT/UPDATE/DELETE para
-- `evolli_app` via ALTER DEFAULT PRIVILEGES; esta migration so RETIRA:
--   perfil_pessoal_colaborador         DELETE
--   endereco_colaborador               DELETE
--   dados_pessoais_colaborador_evento  UPDATE, DELETE  (append-only)
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "CategoriaDadosPessoais" AS ENUM ('perfil_pessoal', 'endereco');

-- CreateEnum
CREATE TYPE "AcaoDadosPessoais" AS ENUM ('criacao', 'leitura', 'edicao');

-- CreateEnum
CREATE TYPE "ResultadoEventoDadosPessoais" AS ENUM ('gravado', 'valores_devolvidos', 'sem_alteracao', 'sem_registro', 'bloqueado');

-- CreateEnum
CREATE TYPE "CampoDadosPessoais" AS ENUM ('data_nascimento', 'sexo', 'saudacao', 'estado_civil', 'nacionalidade', 'naturalidade', 'escolaridade', 'curso', 'nome_pai', 'nome_mae', 'pais', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado');

-- AlterEnum (PostgreSQL 12+: ADD VALUE na transacao; nenhum valor novo e
-- usado nesta mesma migration)
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.dados_pessoais.criados';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.dados_pessoais.atualizados';
ALTER TYPE "AuditAction" ADD VALUE 'pessoas.dados_pessoais.consultados';

-- CreateTable
CREATE TABLE "perfil_pessoal_colaborador" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "data_nascimento" DATE,
    "sexo" TEXT,
    "saudacao" TEXT,
    "estado_civil" TEXT,
    "nacionalidade" TEXT,
    "naturalidade" TEXT,
    "escolaridade" TEXT,
    "curso" TEXT,
    "nome_pai" TEXT,
    "nome_mae" TEXT,
    "criado_por_user_id" TEXT NOT NULL,
    "atualizado_por_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_pessoal_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endereco_colaborador" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "pais" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "criado_por_user_id" TEXT NOT NULL,
    "atualizado_por_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endereco_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dados_pessoais_colaborador_evento" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "categoria" "CategoriaDadosPessoais" NOT NULL,
    "perfil_id" TEXT,
    "endereco_id" TEXT,
    "acao" "AcaoDadosPessoais" NOT NULL,
    "resultado" "ResultadoEventoDadosPessoais" NOT NULL,
    "campos" "CampoDadosPessoais"[],
    "ator_user_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dados_pessoais_colaborador_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perfil_pessoal_colaborador_empresa_id_idx" ON "perfil_pessoal_colaborador"("empresa_id");

-- CreateIndex
CREATE INDEX "perfil_pessoal_colaborador_criado_por_user_id_idx" ON "perfil_pessoal_colaborador"("criado_por_user_id");

-- CreateIndex
CREATE INDEX "perfil_pessoal_colaborador_atualizado_por_user_id_idx" ON "perfil_pessoal_colaborador"("atualizado_por_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_pessoal_colaborador_colaborador_id_empresa_id_key" ON "perfil_pessoal_colaborador"("colaborador_id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_pessoal_colaborador_id_empresa_id_colaborador_id_key" ON "perfil_pessoal_colaborador"("id", "empresa_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "endereco_colaborador_empresa_id_idx" ON "endereco_colaborador"("empresa_id");

-- CreateIndex
CREATE INDEX "endereco_colaborador_criado_por_user_id_idx" ON "endereco_colaborador"("criado_por_user_id");

-- CreateIndex
CREATE INDEX "endereco_colaborador_atualizado_por_user_id_idx" ON "endereco_colaborador"("atualizado_por_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "endereco_colaborador_colaborador_id_empresa_id_key" ON "endereco_colaborador"("colaborador_id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "endereco_colaborador_id_empresa_id_colaborador_id_key" ON "endereco_colaborador"("id", "empresa_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "dados_pessoais_colaborador_evento_colaborador_id_ocorrido_e_idx" ON "dados_pessoais_colaborador_evento"("colaborador_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "dados_pessoais_colaborador_evento_empresa_id_ocorrido_em_idx" ON "dados_pessoais_colaborador_evento"("empresa_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "dados_pessoais_colaborador_evento_ator_user_id_idx" ON "dados_pessoais_colaborador_evento"("ator_user_id");

-- AddForeignKey
ALTER TABLE "perfil_pessoal_colaborador" ADD CONSTRAINT "perfil_pessoal_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_pessoal_colaborador" ADD CONSTRAINT "perfil_pessoal_colaborador_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_pessoal_colaborador" ADD CONSTRAINT "perfil_pessoal_colaborador_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_pessoal_colaborador" ADD CONSTRAINT "perfil_pessoal_colaborador_atualizado_por_user_id_fkey" FOREIGN KEY ("atualizado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endereco_colaborador" ADD CONSTRAINT "endereco_colaborador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endereco_colaborador" ADD CONSTRAINT "endereco_colaborador_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endereco_colaborador" ADD CONSTRAINT "endereco_colaborador_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endereco_colaborador" ADD CONSTRAINT "endereco_colaborador_atualizado_por_user_id_fkey" FOREIGN KEY ("atualizado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_pessoais_colaborador_evento" ADD CONSTRAINT "dados_pessoais_colaborador_evento_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_pessoais_colaborador_evento" ADD CONSTRAINT "dados_pessoais_colaborador_evento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_pessoais_colaborador_evento" ADD CONSTRAINT "dados_pessoais_colaborador_evento_perfil_id_empresa_id_col_fkey" FOREIGN KEY ("perfil_id", "empresa_id", "colaborador_id") REFERENCES "perfil_pessoal_colaborador"("id", "empresa_id", "colaborador_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_pessoais_colaborador_evento" ADD CONSTRAINT "dados_pessoais_colaborador_evento_endereco_id_empresa_id_c_fkey" FOREIGN KEY ("endereco_id", "empresa_id", "colaborador_id") REFERENCES "endereco_colaborador"("id", "empresa_id", "colaborador_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_pessoais_colaborador_evento" ADD CONSTRAINT "dados_pessoais_colaborador_evento_ator_user_id_fkey" FOREIGN KEY ("ator_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Rede de seguranca do texto: aparado, dentro do limite, sem caractere de
-- controle. A normalizacao (aparar, colapsar espacos, vazio -> NULL) e do
-- servidor; o banco recusa o que nao a seguiu.
-- ---------------------------------------------------------------------------
ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_sexo_texto_check"
  CHECK ("sexo" IS NULL OR (
    "sexo" = btrim("sexo")
    AND char_length("sexo") BETWEEN 1 AND 60
    AND "sexo" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_saudacao_texto_check"
  CHECK ("saudacao" IS NULL OR (
    "saudacao" = btrim("saudacao")
    AND char_length("saudacao") BETWEEN 1 AND 40
    AND "saudacao" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_estado_civil_texto_check"
  CHECK ("estado_civil" IS NULL OR (
    "estado_civil" = btrim("estado_civil")
    AND char_length("estado_civil") BETWEEN 1 AND 60
    AND "estado_civil" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_nacionalidade_texto_check"
  CHECK ("nacionalidade" IS NULL OR (
    "nacionalidade" = btrim("nacionalidade")
    AND char_length("nacionalidade") BETWEEN 1 AND 80
    AND "nacionalidade" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_naturalidade_texto_check"
  CHECK ("naturalidade" IS NULL OR (
    "naturalidade" = btrim("naturalidade")
    AND char_length("naturalidade") BETWEEN 1 AND 120
    AND "naturalidade" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_escolaridade_texto_check"
  CHECK ("escolaridade" IS NULL OR (
    "escolaridade" = btrim("escolaridade")
    AND char_length("escolaridade") BETWEEN 1 AND 80
    AND "escolaridade" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_curso_texto_check"
  CHECK ("curso" IS NULL OR (
    "curso" = btrim("curso")
    AND char_length("curso") BETWEEN 1 AND 160
    AND "curso" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_nome_pai_texto_check"
  CHECK ("nome_pai" IS NULL OR (
    "nome_pai" = btrim("nome_pai")
    AND char_length("nome_pai") BETWEEN 1 AND 160
    AND "nome_pai" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_nome_mae_texto_check"
  CHECK ("nome_mae" IS NULL OR (
    "nome_mae" = btrim("nome_mae")
    AND char_length("nome_mae") BETWEEN 1 AND 160
    AND "nome_mae" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "perfil_pessoal_colaborador"
  ADD CONSTRAINT "perfil_pessoal_colaborador_data_nascimento_check"
  CHECK ("data_nascimento" IS NULL OR "data_nascimento" >= DATE '1900-01-01');

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_pais_texto_check"
  CHECK ("pais" IS NULL OR (
    "pais" = btrim("pais")
    AND char_length("pais") BETWEEN 1 AND 80
    AND "pais" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_cep_texto_check"
  CHECK ("cep" IS NULL OR (
    "cep" = btrim("cep")
    AND char_length("cep") BETWEEN 1 AND 12
    AND "cep" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_logradouro_texto_check"
  CHECK ("logradouro" IS NULL OR (
    "logradouro" = btrim("logradouro")
    AND char_length("logradouro") BETWEEN 1 AND 200
    AND "logradouro" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_numero_texto_check"
  CHECK ("numero" IS NULL OR (
    "numero" = btrim("numero")
    AND char_length("numero") BETWEEN 1 AND 20
    AND "numero" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_complemento_texto_check"
  CHECK ("complemento" IS NULL OR (
    "complemento" = btrim("complemento")
    AND char_length("complemento") BETWEEN 1 AND 120
    AND "complemento" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_bairro_texto_check"
  CHECK ("bairro" IS NULL OR (
    "bairro" = btrim("bairro")
    AND char_length("bairro") BETWEEN 1 AND 120
    AND "bairro" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_cidade_texto_check"
  CHECK ("cidade" IS NULL OR (
    "cidade" = btrim("cidade")
    AND char_length("cidade") BETWEEN 1 AND 120
    AND "cidade" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_estado_texto_check"
  CHECK ("estado" IS NULL OR (
    "estado" = btrim("estado")
    AND char_length("estado") BETWEEN 1 AND 80
    AND "estado" !~ '[[:cntrl:]]'
  ));

ALTER TABLE "endereco_colaborador"
  ADD CONSTRAINT "endereco_colaborador_cep_forma_check"
  CHECK ("cep" IS NULL OR "cep" ~ '^[A-Za-z0-9 -]{3,12}$');

-- ---------------------------------------------------------------------------
-- Coerencia do evento: categoria x registro x resultado x campos.
-- ---------------------------------------------------------------------------
ALTER TABLE "dados_pessoais_colaborador_evento"
  ADD CONSTRAINT "dados_pessoais_colaborador_evento_registro_da_categoria_check"
  CHECK (
    ("categoria" = 'perfil_pessoal' AND "endereco_id" IS NULL)
    OR ("categoria" = 'endereco' AND "perfil_id" IS NULL)
  );

ALTER TABLE "dados_pessoais_colaborador_evento"
  ADD CONSTRAINT "dados_pessoais_colaborador_evento_resultado_check"
  CHECK (
    "campos" IS NOT NULL
    AND (
      ("resultado" IN ('gravado', 'valores_devolvidos', 'sem_alteracao')
        AND cardinality("campos") >= 1
        AND num_nonnulls("perfil_id", "endereco_id") = 1)
      OR ("resultado" = 'sem_registro'
        AND cardinality("campos") = 0
        AND num_nonnulls("perfil_id", "endereco_id") = 0)
      OR ("resultado" = 'bloqueado'
        AND cardinality("campos") = 0)
    )
  );

-- ---------------------------------------------------------------------------
-- Integridade empresa<->colaborador, nas DUAS portas, como os contatos.
-- Funcoes PROPRIAS: reescrever as dos contatos mudaria outro modulo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "app"."assert_dados_pessoais_com_vinculo_na_empresa"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."colaborador_id" IS NOT DISTINCT FROM OLD."colaborador_id"
     AND NEW."empresa_id" IS NOT DISTINCT FROM OLD."empresa_id" THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v
     WHERE v."colaborador_id" = NEW."colaborador_id"
       AND v."empresa_id" = NEW."empresa_id"
  ) THEN
    RAISE EXCEPTION
      'dado pessoal referencia colaborador sem vinculo na mesma empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "perfil_pessoal_colaborador_exige_vinculo_na_empresa"
  AFTER INSERT OR UPDATE ON "perfil_pessoal_colaborador"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_dados_pessoais_com_vinculo_na_empresa"();

CREATE CONSTRAINT TRIGGER "endereco_colaborador_exige_vinculo_na_empresa"
  AFTER INSERT OR UPDATE ON "endereco_colaborador"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_dados_pessoais_com_vinculo_na_empresa"();

CREATE OR REPLACE FUNCTION "app"."assert_vinculo_nao_orfana_dados_pessoais"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."colaborador_id" IS NOT DISTINCT FROM OLD."colaborador_id"
     AND NEW."empresa_id" IS NOT DISTINCT FROM OLD."empresa_id" THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "app"."vinculo_funcional" v
     WHERE v."colaborador_id" = OLD."colaborador_id"
       AND v."empresa_id" = OLD."empresa_id"
  ) AND (
    EXISTS (
      SELECT 1 FROM "app"."perfil_pessoal_colaborador" p
       WHERE p."colaborador_id" = OLD."colaborador_id"
         AND p."empresa_id" = OLD."empresa_id"
    ) OR EXISTS (
      SELECT 1 FROM "app"."endereco_colaborador" e
       WHERE e."colaborador_id" = OLD."colaborador_id"
         AND e."empresa_id" = OLD."empresa_id"
    )
  ) THEN
    RAISE EXCEPTION
      'vinculo sustenta dados pessoais do colaborador: remover ou reapontar os orfanaria'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "vinculo_sustenta_dados_pessoais_da_empresa"
  AFTER UPDATE OR DELETE ON "vinculo_funcional"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_vinculo_nao_orfana_dados_pessoais"();

-- ---------------------------------------------------------------------------
-- Privilegios: so retirada.
-- ---------------------------------------------------------------------------
REVOKE DELETE ON TABLE "perfil_pessoal_colaborador" FROM evolli_app;
REVOKE DELETE ON TABLE "endereco_colaborador" FROM evolli_app;
REVOKE UPDATE, DELETE ON TABLE "dados_pessoais_colaborador_evento" FROM evolli_app;
