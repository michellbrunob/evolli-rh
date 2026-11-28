-- T216 — encerramento com data e hora (horário de Brasília). O prazo passa
-- de DATE para o instante (TIMESTAMP(3), em UTC, como as demais colunas de
-- instante). Compatível com o que já está gravado: a data antiga vira
-- 23:59 daquele dia no horário de Brasília.
--
-- PRIVILÉGIOS: nenhum GRANT novo (coluna existente).

-- AlterTable
ALTER TABLE "pesquisa" ALTER COLUMN "encerra_em" SET DATA TYPE TIMESTAMP(3)
  USING (
    ("encerra_em"::timestamp + interval '23 hours 59 minutes')
      AT TIME ZONE 'America/Sao_Paulo'
      AT TIME ZONE 'UTC'
  );
