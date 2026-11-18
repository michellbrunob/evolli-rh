-- T209 — Aprendiz como tipo de vínculo (fatia mínima, decisões AP-1 a AP-9).
--
-- Só acrescenta o valor ao tipo persistido, logo depois de 'estagio'. Nenhum
-- dado existente é lido ou alterado, e nenhuma regra legal (prazo, idade,
-- jornada, cota, programa) entra no banco. O valor novo não é usado nesta
-- mesma migration (restrição do PostgreSQL para ADD VALUE em transação).
ALTER TYPE "TipoVinculo" ADD VALUE 'aprendiz' AFTER 'estagio';
