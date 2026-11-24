-- ---------------------------------------------------------------------------
-- T215 — horários do turno editáveis (2026-11-25), como no quadro da
-- referência: mudar o horário vale para o rascunho a partir de hoje; o que já
-- foi publicado guarda o próprio horário. A aplicação troca os períodos da
-- tabela numa transação (apaga e grava de novo). Revê a T038, que tinha
-- tornado `periodo_horario` imutável (decisão da proprietária de 2026-11-25).
-- A EXCLUSION de sobreposição e o CHECK de início < fim continuam.
-- ---------------------------------------------------------------------------
GRANT UPDATE, DELETE ON TABLE "periodo_horario" TO evolli_app;
