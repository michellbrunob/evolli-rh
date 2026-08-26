-- T038 - Cadastros: Tabelas de Horario e vinculo historico ao colaborador.
--
-- Migration ADITIVA. Nenhuma tabela ja mergeada tem coluna alterada ou
-- removida. Apenas novos valores de enum (AuditAction) e tres tabelas novas.
-- Nenhum backfill, nenhum tenant_id, nenhuma RLS multitenant (ADR 0005).
--
-- Nomenclatura em portugues, sem acento, snake_case (ADR 0006, Emenda 1).
--
-- ESCOPO: cadastrar tabelas de horario por empresa e vincula-las a
-- colaboradores com vigencia historica. NAO ha calculo, tolerancia, banco de
-- horas, DSR, fechamento, espelho, importacao TXT/REP/AFD nem UI (T034/T037).
-- Nenhum dado pessoal novo (nome, CPF, etc.) entra neste schema.
--
-- INTEGRIDADE GARANTIDA PELO BANCO (nao apenas pela aplicacao):
--
--   1. cada tabela de horario pertence a UMA empresa
--      -> FK tabela_horario.empresa_id + indice unico (id, empresa_id) que
--         serve de alvo da FK COMPOSTA de vinculo_horario.
--
--   2. periodos do mesmo dia de uma tabela NUNCA se sobrepoem  [T037]
--      -> periodo_horario_sem_sobreposicao (EXCLUSION CONSTRAINT GiST sobre
--         int4range de minutos), com coerencia inicio<fim por CHECK.
--
--   3. um colaborador NUNCA tem duas tabelas vigentes para o mesmo dia na
--      mesma empresa  [T037, req. 5]
--      -> vinculo_horario_sem_sobreposicao (EXCLUSION CONSTRAINT GiST sobre
--         daterange de vigencia), com vinculo aberto tratado como intervalo
--         infinito. Complementada pelo indice unico PARCIAL
--         vinculo_horario_vigente_unico (dois vinculos ABERTOS).
--
--   4. o vinculo aponta para tabela da MESMA empresa  [req. 7]
--      -> FK COMPOSTA (tabela_horario_id, empresa_id).
--
--   5. o colaborador tem vinculo funcional na empresa (sem cruzamento entre
--      empresas)  [req. do banco]
--      -> CONSTRAINT TRIGGER que verifica vinculo_funcional, alem da checagem
--         na aplicacao.
--
-- PRE-CONDICAO DE INFRAESTRUTURA (btree_gist):
--
-- As duas EXCLUSION CONSTRAINTS exigem a extensao `btree_gist` para combinar
-- igualdade sobre `text`/`integer` com sobreposicao de range num mesmo indice
-- GiST. `evolli_migrator` deliberadamente NAO tem privilegio de criar
-- extensao (ADR 0002, menor privilegio): a extensao e PRE-CONDICAO GERENCIADA,
-- provisionada uma vez pelo administrador via infra/postgres/04_extensions.sql
-- e apenas VERIFICADA aqui. Se faltar, esta migration ABORTA — nunca cria a
-- tabela sem a restricao.
--
-- PRIVILEGIOS: nenhum GRANT novo. As tabelas nascem com
-- SELECT/INSERT/UPDATE/DELETE para evolli_app via ALTER DEFAULT PRIVILEGES
-- (infra/postgres/02_schema_and_grants.sql). Como nao ha exclusao fisica
-- (T037, req. 12), esta migration REVOGA DELETE das tres tabelas; `periodo`
-- e imutavel apos criacao, entao tambem perde UPDATE. Inativar tabela e
-- encerrar vigencia usam UPDATE (mantido em tabela_horario e vinculo_horario).

-- ---------------------------------------------------------------------------
-- Guarda de pre-condicao: falha explicita, nunca fallback silencioso.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION
      'pre-condicao de infraestrutura ausente: extensao "btree_gist" nao instalada.'
      USING HINT =
        'Rode infra/postgres/04_extensions.sql como administrador/owner da base '
        'ANTES de prisma migrate deploy. Ver infra/postgres/README.md.';
  END IF;
END
$$;

-- AlterEnum
-- Novos valores nao sao usados nesta mesma migration (exigencia do PostgreSQL
-- para ADD VALUE dentro da transacao da migration).
ALTER TYPE "AuditAction" ADD VALUE 'horarios.tabela.criada';
ALTER TYPE "AuditAction" ADD VALUE 'horarios.tabela.desativada';
ALTER TYPE "AuditAction" ADD VALUE 'horarios.tabela.reativada';
ALTER TYPE "AuditAction" ADD VALUE 'horarios.vinculo.criado';
ALTER TYPE "AuditAction" ADD VALUE 'horarios.vinculo.encerrado';
ALTER TYPE "AuditAction" ADD VALUE 'horarios.consultado';

-- CreateTable
CREATE TABLE "tabela_horario" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabela_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodo_horario" (
    "id" TEXT NOT NULL,
    "tabela_horario_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "inicio_minuto" INTEGER NOT NULL,
    "fim_minuto" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodo_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculo_horario" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tabela_horario_id" TEXT NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "criado_por_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vinculo_horario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tabela_horario_empresa_id_ativo_idx" ON "tabela_horario"("empresa_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "tabela_horario_id_empresa_id_key" ON "tabela_horario"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "periodo_horario_tabela_horario_id_dia_semana_idx" ON "periodo_horario"("tabela_horario_id", "dia_semana");

-- CreateIndex
CREATE INDEX "vinculo_horario_colaborador_id_empresa_id_vigencia_inicio_idx" ON "vinculo_horario"("colaborador_id", "empresa_id", "vigencia_inicio");

-- CreateIndex
CREATE INDEX "vinculo_horario_empresa_id_idx" ON "vinculo_horario"("empresa_id");

-- CreateIndex
CREATE INDEX "vinculo_horario_tabela_horario_id_empresa_id_idx" ON "vinculo_horario"("tabela_horario_id", "empresa_id");

-- AddForeignKey
ALTER TABLE "tabela_horario" ADD CONSTRAINT "tabela_horario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabela_horario" ADD CONSTRAINT "tabela_horario_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodo_horario" ADD CONSTRAINT "periodo_horario_tabela_horario_id_fkey" FOREIGN KEY ("tabela_horario_id") REFERENCES "tabela_horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_horario" ADD CONSTRAINT "vinculo_horario_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_horario" ADD CONSTRAINT "vinculo_horario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_horario" ADD CONSTRAINT "vinculo_horario_tabela_horario_id_empresa_id_fkey" FOREIGN KEY ("tabela_horario_id", "empresa_id") REFERENCES "tabela_horario"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_horario" ADD CONSTRAINT "vinculo_horario_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Garantias que o Prisma nao expressa no schema (CHECKs, EXCLUSION, indice
-- parcial e CONSTRAINT TRIGGER). Escritas a mao, cobertas por teste e2e com
-- INSERT cru pelo papel migrator.
-- ---------------------------------------------------------------------------

-- [T037] Dia valido: 1=segunda ... 7=domingo.
ALTER TABLE "periodo_horario"
    ADD CONSTRAINT "periodo_horario_dia_valido"
    CHECK ("dia_semana" BETWEEN 1 AND 7);

-- [T037] Minutos coerentes: dentro do dia e fim depois do inicio.
ALTER TABLE "periodo_horario"
    ADD CONSTRAINT "periodo_horario_minutos_validos"
    CHECK (
        "inicio_minuto" >= 0
        AND "fim_minuto" <= 1440
        AND "fim_minuto" > "inicio_minuto"
    );

-- [T037] NAO SOBREPOSICAO de periodos do mesmo dia de uma tabela.
--
-- `int4range(inicio_minuto, fim_minuto, '[)')` modela o periodo com inicio
-- inclusivo e fim exclusivo: periodos ADJACENTES (ex.: 08:00-12:00 e
-- 12:00-13:00) nao conflitam; qualquer interseccao real e recusada. Exige
-- `btree_gist` para o `=` sobre `tabela_horario_id` (text) e `dia_semana`
-- (integer). Prisma nao tem sintaxe para EXCLUDE — a constraint vive aqui, e o
-- comentario no schema a documenta.
ALTER TABLE "periodo_horario"
    ADD CONSTRAINT "periodo_horario_sem_sobreposicao"
    EXCLUDE USING gist (
        "tabela_horario_id" WITH =,
        "dia_semana" WITH =,
        int4range("inicio_minuto", "fim_minuto", '[)') WITH &&
    );

-- [T037, req. 5] Vigencia coerente: fim, quando existe, e posterior ao inicio.
ALTER TABLE "vinculo_horario"
    ADD CONSTRAINT "vinculo_horario_vigencia_coerente"
    CHECK ("vigencia_fim" IS NULL OR "vigencia_fim" > "vigencia_inicio");

-- [T037, req. 5] NAO SOBREPOSICAO de vigencias por (colaborador, empresa).
--
-- Mesma semantica de `alocacao_organizacional_sem_sobreposicao`: `daterange`
-- com inicio inclusivo e fim exclusivo. Periodos adjacentes nao conflitam (a
-- "troca" fecha o anterior onde o novo comeca); `vigencia_fim IS NULL` vira
-- limite superior INFINITO, entao um vinculo aberto conflita com qualquer
-- posterior. Impede duas tabelas validas para o mesmo dia. Exige `btree_gist`
-- para o `=` sobre `colaborador_id` e `empresa_id` (text).
ALTER TABLE "vinculo_horario"
    ADD CONSTRAINT "vinculo_horario_sem_sobreposicao"
    EXCLUDE USING gist (
        "colaborador_id" WITH =,
        "empresa_id" WITH =,
        daterange("vigencia_inicio", "vigencia_fim", '[)') WITH &&
    );

-- Complemento, nao substituto: dois vinculos ABERTOS para o mesmo (colaborador,
-- empresa) tambem violam a EXCLUSION acima, mas este indice os rejeita com erro
-- de UNICIDADE, que a aplicacao traduz para 409 de forma estavel. E a colisao
-- que a concorrencia real produz.
CREATE UNIQUE INDEX "vinculo_horario_vigente_unico"
    ON "vinculo_horario" ("colaborador_id", "empresa_id")
    WHERE "vigencia_fim" IS NULL;

-- [req. do banco] O colaborador vinculado a um horario tem vinculo FUNCIONAL na
-- mesma empresa — sem isso, um horario poderia ser atribuido a colaborador que
-- nao pertence aquela empresa (vinculo cruzado). Mesmo padrao de
-- `assert_documento_com_vinculo_na_empresa` (Etapa 2). CONSTRAINT TRIGGER
-- DEFERRABLE: a verificacao acontece no COMMIT.
--
-- Por que no banco, e nao so no service: um service pode ser contornado por
-- script, correcao manual ou modulo futuro. A garantia vale para qualquer
-- caminho de escrita.
CREATE OR REPLACE FUNCTION "app"."assert_vinculo_horario_colaborador_na_empresa"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Em UPDATE que nao mexeu em colaborador nem empresa, nada a reverificar.
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
      'vinculo de horario referencia colaborador sem vinculo funcional na mesma empresa'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "vinculo_horario_exige_colaborador_na_empresa"
  AFTER INSERT OR UPDATE ON "vinculo_horario"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_vinculo_horario_colaborador_na_empresa"();

-- ---------------------------------------------------------------------------
-- Sem exclusao fisica (T037, req. 12). `evolli_app` perde DELETE nas tres
-- tabelas; `periodo_horario` e imutavel apos criacao, entao tambem perde
-- UPDATE. Nenhum privilegio novo e concedido.
-- ---------------------------------------------------------------------------
REVOKE DELETE ON TABLE "tabela_horario" FROM evolli_app;
REVOKE UPDATE, DELETE ON TABLE "periodo_horario" FROM evolli_app;
REVOKE DELETE ON TABLE "vinculo_horario" FROM evolli_app;
