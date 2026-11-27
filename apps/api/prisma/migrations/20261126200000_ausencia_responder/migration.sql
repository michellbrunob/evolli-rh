-- T215 — "Responder solicitação" (como a referência): aprovar com mensagem,
-- sugerir outras datas e recusar com motivo (até 1000 caracteres).

ALTER TYPE "AuditAction" ADD VALUE 'pessoas.ausencia.ajuste_sugerido';

ALTER TABLE "ausencia" ADD COLUMN "sugestao_inicio" DATE;
ALTER TABLE "ausencia" ADD COLUMN "sugestao_fim" DATE;

ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_sugestao_check"
  CHECK (("sugestao_inicio" IS NULL) = ("sugestao_fim" IS NULL)
    AND ("sugestao_fim" IS NULL OR "sugestao_fim" >= "sugestao_inicio"));

ALTER TABLE "ausencia" DROP CONSTRAINT "ausencia_motivo_decisao_check";
ALTER TABLE "ausencia"
  ADD CONSTRAINT "ausencia_motivo_decisao_check"
  CHECK ("motivo_decisao" IS NULL OR char_length("motivo_decisao") <= 1000);
