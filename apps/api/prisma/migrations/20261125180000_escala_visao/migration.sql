-- ---------------------------------------------------------------------------
-- T215 — Visões salvas do quadro da escala. Migration ADITIVA (2026-11-25):
-- nada existente muda.
--
-- - escala_visao: os filtros do quadro com um nome, de uma conta numa
--   empresa ("Só você vê"). Nome único por conta e empresa.
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "escala_visao" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "filtros" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escala_visao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escala_visao_empresa_id_user_id_nome_key" ON "escala_visao"("empresa_id", "user_id", "nome");

-- AddForeignKey
ALTER TABLE "escala_visao" ADD CONSTRAINT "escala_visao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_visao" ADD CONSTRAINT "escala_visao_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Formas aceitas.
ALTER TABLE "escala_visao"
  ADD CONSTRAINT "escala_visao_forma_check"
  CHECK (
    length(btrim("nome")) > 0
    AND jsonb_typeof("filtros") = 'object'
  );
