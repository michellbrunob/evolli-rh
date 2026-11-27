-- ---------------------------------------------------------------------------
-- T215 — Turnos da escala (2026-11-25). Migration ADITIVA: a jornada
-- (tabela_horario) ganha o que o Turno do quadro precisa. As jornadas que já
-- existem ficam cinza, "por dia", sem intervalo extra, tolerância ou mínimo.
--
-- - cor: uma de 12 cores do quadro;
-- - sigla: 1 ou 2 letras (visão do mês);
-- - unidade_organizacional_id: nula = todas as unidades (a aplicação confere
--   que a unidade é da mesma empresa);
-- - modo: "mesmo_horario" (os períodos de segunda valem para todo dia de
--   trabalho da escala) ou "por_dia";
-- - intervalo_minutos: descontado do dia com um período só;
-- - tolerancia_minutos e minimo_por_dia: marcação e cobertura (opcionais).
-- Os períodos continuam imutáveis (T038).
-- ---------------------------------------------------------------------------

ALTER TABLE "tabela_horario" ADD COLUMN     "cor" TEXT NOT NULL DEFAULT 'cinza',
ADD COLUMN     "intervalo_minutos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minimo_por_dia" INTEGER,
ADD COLUMN     "modo" TEXT NOT NULL DEFAULT 'por_dia',
ADD COLUMN     "sigla" VARCHAR(2),
ADD COLUMN     "tolerancia_minutos" INTEGER,
ADD COLUMN     "unidade_organizacional_id" TEXT;

ALTER TABLE "tabela_horario"
  ADD CONSTRAINT "tabela_horario_cor_check"
  CHECK ("cor" IN ('azul', 'laranja', 'cinza', 'verde', 'verde_agua', 'roxo', 'indigo', 'tangerina', 'ciano', 'oliva', 'mostarda', 'violeta'));

ALTER TABLE "tabela_horario"
  ADD CONSTRAINT "tabela_horario_modo_check"
  CHECK ("modo" IN ('mesmo_horario', 'por_dia'));

ALTER TABLE "tabela_horario"
  ADD CONSTRAINT "tabela_horario_sigla_check"
  CHECK ("sigla" IS NULL OR char_length("sigla") BETWEEN 1 AND 2);

ALTER TABLE "tabela_horario"
  ADD CONSTRAINT "tabela_horario_intervalo_check"
  CHECK ("intervalo_minutos" IN (0, 15, 30, 45, 60, 90, 120));

ALTER TABLE "tabela_horario"
  ADD CONSTRAINT "tabela_horario_tolerancia_check"
  CHECK ("tolerancia_minutos" IS NULL OR "tolerancia_minutos" BETWEEN 0 AND 60);

ALTER TABLE "tabela_horario"
  ADD CONSTRAINT "tabela_horario_minimo_check"
  CHECK ("minimo_por_dia" IS NULL OR "minimo_por_dia" BETWEEN 0 AND 999);

CREATE INDEX "tabela_horario_unidade_idx"
  ON "tabela_horario" ("empresa_id", "unidade_organizacional_id");
