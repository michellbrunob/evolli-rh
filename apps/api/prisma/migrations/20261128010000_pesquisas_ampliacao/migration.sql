-- T216 — ampliação das Pesquisas (27/11/2026): a anônima pode separar as
-- respostas por grupo (até 2 campos que quem responde escolhe), e a
-- confidencial passa a gravar também o centro de custo e a unidade da
-- lotação no envio, para os recortes. A identificada não grava grupo: o
-- recorte usa a lotação vigente.
--
-- PRIVILÉGIOS: nenhum GRANT novo (colunas em tabelas existentes).

-- AlterTable
ALTER TABLE "pesquisa" ADD COLUMN     "separar_por" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "pesquisa_resposta" ADD COLUMN     "centro_custo_id" TEXT,
ADD COLUMN     "unidade_id" TEXT;

-- Os campos de separação: lista fechada, no máximo 2.
ALTER TABLE "pesquisa"
  ADD CONSTRAINT "pesquisa_separar_por_check"
    CHECK (
      "separar_por" IS NULL OR (
        "separar_por" <@ ARRAY['departamento', 'centroCusto', 'unidade']::text[]
        AND cardinality("separar_por") <= 2
      )
    );

-- A resposta só guarda a pessoa na identificada; os grupos (departamento,
-- centro de custo e unidade), só na confidencial e na anônima.
CREATE OR REPLACE FUNCTION "app"."assert_pesquisa_resposta_sem_identidade"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  modo text;
BEGIN
  SELECT p."identificacao"::text INTO modo
    FROM "app"."pesquisa" p
   WHERE p."id" = NEW."pesquisa_id";

  IF modo IS DISTINCT FROM 'identificada' AND NEW."colaborador_id" IS NOT NULL THEN
    RAISE EXCEPTION 'resposta de pesquisa nao identificada com colaborador'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF modo = 'identificada' AND (
       NEW."departamento_id" IS NOT NULL
       OR NEW."centro_custo_id" IS NOT NULL
       OR NEW."unidade_id" IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'grupo gravado so na resposta confidencial ou anonima'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;
