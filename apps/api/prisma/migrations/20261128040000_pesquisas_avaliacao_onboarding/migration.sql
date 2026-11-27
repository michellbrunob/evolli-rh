-- T216 — Avaliação 90°/180° (quem avalia quem) e o Onboarding com envio
-- automático (convites por pessoa e rodada).

-- Configuração própria do modelo (conferida pela aplicação).
ALTER TABLE "pesquisa" ADD COLUMN "config_modelo" JSONB;

-- A rodada do onboarding (0 = envio único e as demais pesquisas). A unicidade
-- da resposta identificada passa a ser por pessoa e rodada: nas demais
-- pesquisas, a rodada é sempre 0 e nada muda.
ALTER TABLE "pesquisa_resposta" ADD COLUMN "rodada" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "pesquisa_resposta_pesquisa_id_colaborador_id_key";
CREATE UNIQUE INDEX "pesquisa_resposta_pesquisa_id_colaborador_id_rodada_key" ON "pesquisa_resposta"("pesquisa_id", "colaborador_id", "rodada");

-- CreateTable
CREATE TABLE "pesquisa_avaliacao_par" (
    "id" TEXT NOT NULL,
    "pesquisa_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "avaliador_id" TEXT NOT NULL,
    "avaliado_id" TEXT NOT NULL,
    "papel" VARCHAR(20) NOT NULL,
    "resposta_id" TEXT,
    "respondida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesquisa_avaliacao_par_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa_envio" (
    "id" TEXT NOT NULL,
    "pesquisa_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "rodada" INTEGER NOT NULL,
    "data_prevista" DATE NOT NULL,
    "situacao" VARCHAR(20) NOT NULL DEFAULT 'agendado',
    "enviado_em" TIMESTAMP(3),
    "lembrete_em" TIMESTAMP(3),
    "respondido_em" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesquisa_envio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_avaliacao_par_resposta_id_key" ON "pesquisa_avaliacao_par"("resposta_id");

-- CreateIndex
CREATE INDEX "pesquisa_avaliacao_par_avaliador_id_idx" ON "pesquisa_avaliacao_par"("avaliador_id");

-- CreateIndex
CREATE INDEX "pesquisa_avaliacao_par_avaliado_id_idx" ON "pesquisa_avaliacao_par"("avaliado_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_avaliacao_par_pesquisa_id_avaliado_id_papel_key" ON "pesquisa_avaliacao_par"("pesquisa_id", "avaliado_id", "papel");

-- CreateIndex
CREATE INDEX "pesquisa_envio_colaborador_id_idx" ON "pesquisa_envio"("colaborador_id");

-- CreateIndex
CREATE INDEX "pesquisa_envio_situacao_data_prevista_idx" ON "pesquisa_envio"("situacao", "data_prevista");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_envio_pesquisa_id_colaborador_id_rodada_key" ON "pesquisa_envio"("pesquisa_id", "colaborador_id", "rodada");

-- AddForeignKey
ALTER TABLE "pesquisa_avaliacao_par" ADD CONSTRAINT "pesquisa_avaliacao_par_pesquisa_id_empresa_id_fkey" FOREIGN KEY ("pesquisa_id", "empresa_id") REFERENCES "pesquisa"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_avaliacao_par" ADD CONSTRAINT "pesquisa_avaliacao_par_avaliador_id_fkey" FOREIGN KEY ("avaliador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_avaliacao_par" ADD CONSTRAINT "pesquisa_avaliacao_par_avaliado_id_fkey" FOREIGN KEY ("avaliado_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_avaliacao_par" ADD CONSTRAINT "pesquisa_avaliacao_par_resposta_id_fkey" FOREIGN KEY ("resposta_id") REFERENCES "pesquisa_resposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_envio" ADD CONSTRAINT "pesquisa_envio_pesquisa_id_empresa_id_fkey" FOREIGN KEY ("pesquisa_id", "empresa_id") REFERENCES "pesquisa"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_envio" ADD CONSTRAINT "pesquisa_envio_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECKs: os valores que a aplicação usa, repetidos no banco.
ALTER TABLE "pesquisa"
  ADD CONSTRAINT "pesquisa_config_modelo_check"
    CHECK ("config_modelo" IS NULL OR jsonb_typeof("config_modelo") = 'object');

ALTER TABLE "pesquisa_resposta"
  ADD CONSTRAINT "pesquisa_resposta_rodada_check"
    CHECK ("rodada" IN (0, 30, 60, 90));

ALTER TABLE "pesquisa_avaliacao_par"
  ADD CONSTRAINT "pesquisa_avaliacao_par_papel_check"
    CHECK ("papel" IN ('gestor', 'autoavaliacao')),
  -- Só a autoavaliação tem a mesma pessoa dos dois lados.
  ADD CONSTRAINT "pesquisa_avaliacao_par_pessoas_check"
    CHECK (("papel" = 'autoavaliacao') = ("avaliador_id" = "avaliado_id")),
  ADD CONSTRAINT "pesquisa_avaliacao_par_respondida_check"
    CHECK (("resposta_id" IS NULL) = ("respondida_em" IS NULL));

ALTER TABLE "pesquisa_envio"
  ADD CONSTRAINT "pesquisa_envio_rodada_check"
    CHECK ("rodada" BETWEEN 0 AND 90),
  ADD CONSTRAINT "pesquisa_envio_situacao_check"
    CHECK ("situacao" IN ('agendado', 'aguardando_email', 'enviado', 'sem_email', 'respondido', 'pulado'));
