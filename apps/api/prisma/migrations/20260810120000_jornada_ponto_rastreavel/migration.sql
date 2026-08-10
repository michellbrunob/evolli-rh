-- Etapa 3 - Jornada e Ponto Rastreavel V1 (ADR 0008, Baseline Jornada V1).
--
-- Migration ADITIVA. Nenhuma tabela ja mergeada tem coluna alterada ou
-- removida; as unicas mudancas sobre o existente sao tres valores NOVOS no
-- enum `AuditAction` (aditivos, nenhum removido ou renomeado).
--
-- Nomenclatura em portugues, sem acento, snake_case (ADR 0006, Emenda 1).
--
-- ESCOPO FECHADO. O que esta migration NAO cria e tao deliberado quanto o que
-- ela cria (Baseline Jornada V1):
--
--   - nenhuma tabela de escala/jornada (decisao 1);
--   - nenhuma coluna de dispositivo, IP, foto, biometria, geolocalizacao ou
--     proveniencia de arquivo (decisao 3) - a unica origem e registro manual
--     interno, e nao ha onde guardar evidencia de origem porque nao existe
--     origem alternativa;
--   - nenhuma tabela `periodo_apuracao` e nenhum status de competencia
--     (decisoes 6 e 7) - competencia e um CAMPO do evento, nao uma entidade
--     com ciclo de vida; nao ha nada que "feche";
--   - nenhuma coluna de aprovador ou status de aprovacao (decisao 7);
--   - nenhuma coluna de saldo, horas, extra, adicional ou qualquer resultado
--     de calculo (decisao 6).
--
-- DADOS PESSOAIS: nenhum nome, matricula, documento ou identificador de pessoa
-- e duplicado aqui. O alcance ate a pessoa e sempre por `vinculo_id`. Ainda
-- assim, o par (vinculo, momento) JA E dado pessoal de comportamento e
-- presenca - o que motiva os controles abaixo.
--
-- INTEGRIDADE GARANTIDA PELO BANCO (nao apenas pela aplicacao):
--
--   1. evento e ajuste NUNCA cruzam empresa
--      -> FKs COMPOSTAS com empresa_id:
--         evento_ponto (vinculo_id, empresa_id) -> vinculo_funcional
--         ajuste_ponto (evento_ponto_id, empresa_id) -> evento_ponto
--         Um `empresa_id` divergente nao chega a ser gravado, mesmo que o
--         service erre - mesmo padrao ja usado em alocacao/movimentacao.
--
--   2. evento de ponto e IMUTAVEL e INDESTRUTIVEL para a aplicacao
--      -> REVOKE UPDATE, DELETE (abaixo). Ver bloco proprio.
--
--   3. um ajuste sempre tem efeito, e anular exclui corrigir
--      -> CHECK ajuste_ponto_efeito_coerente.
--
--   4. competencia sempre no formato 'YYYY-MM'
--      -> CHECK evento_ponto_competencia_formato.

-- CreateEnum
CREATE TYPE "TipoEventoPonto" AS ENUM ('entrada', 'saida', 'inicio_pausa', 'fim_pausa');

-- CreateEnum
CREATE TYPE "MotivoAjustePonto" AS ENUM ('erro_de_digitacao', 'registro_duplicado', 'registro_indevido', 'outro_controlado');

-- AlterEnum
-- Tres valores aditivos. Nenhum valor existente e removido ou renomeado - o
-- enum de `AuditAction` so cresce (ADR 0004 §5).
ALTER TYPE "AuditAction" ADD VALUE 'ponto.evento.registrado';
ALTER TYPE "AuditAction" ADD VALUE 'ponto.ajuste.registrado';
ALTER TYPE "AuditAction" ADD VALUE 'ponto.consultado';

-- CreateTable
CREATE TABLE "evento_ponto" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoEventoPonto" NOT NULL,
    "momento" TIMESTAMPTZ(3) NOT NULL,
    "competencia" CHAR(7) NOT NULL,
    "registrado_por_user_id" TEXT NOT NULL,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajuste_ponto" (
    "id" TEXT NOT NULL,
    "evento_ponto_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "motivo_codigo" "MotivoAjustePonto" NOT NULL,
    "anula" BOOLEAN NOT NULL DEFAULT false,
    "momento_corrigido" TIMESTAMPTZ(3),
    "tipo_corrigido" "TipoEventoPonto",
    "registrado_por_user_id" TEXT NOT NULL,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajuste_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evento_ponto_vinculo_id_momento_idx" ON "evento_ponto"("vinculo_id", "momento");

-- CreateIndex
CREATE INDEX "evento_ponto_empresa_id_competencia_idx" ON "evento_ponto"("empresa_id", "competencia");

-- CreateIndex
CREATE INDEX "evento_ponto_registrado_por_user_id_idx" ON "evento_ponto"("registrado_por_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "evento_ponto_id_empresa_id_key" ON "evento_ponto"("id", "empresa_id");

-- CreateIndex
CREATE INDEX "ajuste_ponto_evento_ponto_id_registrado_em_idx" ON "ajuste_ponto"("evento_ponto_id", "registrado_em");

-- CreateIndex
CREATE INDEX "ajuste_ponto_empresa_id_idx" ON "ajuste_ponto"("empresa_id");

-- CreateIndex
CREATE INDEX "ajuste_ponto_registrado_por_user_id_idx" ON "ajuste_ponto"("registrado_por_user_id");

-- AddForeignKey
ALTER TABLE "evento_ponto" ADD CONSTRAINT "evento_ponto_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_ponto" ADD CONSTRAINT "evento_ponto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_ponto" ADD CONSTRAINT "evento_ponto_registrado_por_user_id_fkey" FOREIGN KEY ("registrado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_ponto" ADD CONSTRAINT "ajuste_ponto_evento_ponto_id_empresa_id_fkey" FOREIGN KEY ("evento_ponto_id", "empresa_id") REFERENCES "evento_ponto"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_ponto" ADD CONSTRAINT "ajuste_ponto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_ponto" ADD CONSTRAINT "ajuste_ponto_registrado_por_user_id_fkey" FOREIGN KEY ("registrado_por_user_id") REFERENCES "access_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CHECKs que o Prisma nao expressa nativamente.
-- ---------------------------------------------------------------------------

-- Formato da competencia: 'YYYY-MM', sempre.
--
-- A COERENCIA entre `competencia` e `momento` deliberadamente NAO e checada
-- aqui: derivar o mes de um `timestamptz` exige `AT TIME ZONE`, que e STABLE e
-- nao IMMUTABLE (a definicao de fuso muda com atualizacao de tzdata), e o
-- PostgreSQL recusa funcao nao-imutavel em CHECK. A competencia e calculada na
-- aplicacao, no insert, sob um unico fuso declarado em codigo
-- (ponto/competencia.util.ts) - e o banco garante so a forma.
--
-- Isso e um limite conhecido, nao um esquecimento: a alternativa (derivar na
-- consulta) foi rejeitada porque faria o mes de um registro ja gravado mudar
-- silenciosamente ao trocar o fuso da aplicacao, o que e inaceitavel num
-- modulo cuja razao de ser e rastreabilidade.
ALTER TABLE "evento_ponto"
    ADD CONSTRAINT "evento_ponto_competencia_formato"
    CHECK ("competencia" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Um ajuste sempre tem efeito, e os dois efeitos sao mutuamente exclusivos:
--
--   anula = true  -> o evento nao deveria existir. Nenhum valor corrigido
--                    acompanha: nao se corrige o horario de algo que se esta
--                    dizendo que nunca deveria ter sido registrado.
--   anula = false -> corrige ao menos UM dos dois campos. Um ajuste que nao
--                    anula e nao corrige nada seria ruido na trilha - e, pior,
--                    daria a impressao de que uma correcao foi feita.
ALTER TABLE "ajuste_ponto"
    ADD CONSTRAINT "ajuste_ponto_efeito_coerente"
    CHECK (
        ("anula" = true  AND "momento_corrigido" IS NULL AND "tipo_corrigido" IS NULL)
        OR
        ("anula" = false AND ("momento_corrigido" IS NOT NULL OR "tipo_corrigido" IS NOT NULL))
    );

-- ---------------------------------------------------------------------------
-- APPEND-ONLY: imutabilidade garantida por PRIVILEGIO, nao por disciplina.
-- ---------------------------------------------------------------------------
-- Baseline Jornada V1, decisao 4: "o evento original nunca e alterado nem
-- apagado; correcao ocorre por ajuste rastreavel".
--
-- Um service pode ser contornado por script, correcao manual ou modulo futuro;
-- um privilegio ausente, nao. `evolli_app` herdaria UPDATE/DELETE nestas
-- tabelas como em qualquer tabela nova (ALTER DEFAULT PRIVILEGES,
-- 02_schema_and_grants.sql) - revogado aqui, no mesmo `prisma migrate deploy`
-- que as cria, para que um banco provisionado do zero ja nasca append-only,
-- sem depender de nenhum passo manual posterior.
--
-- Exatamente o mesmo tratamento que `audit_event` recebe desde a ADR 0004 §1,
-- e pela mesma razao: um exploit na API nao pode reescrever nem apagar
-- historico. Aqui o historico e de presenca de pessoas.
--
-- CONSEQUENCIA ASSUMIDA: nem a aplicacao consegue "consertar" um registro
-- errado - o unico caminho e registrar um ajuste. E o comportamento desejado.
--
-- NENHUM privilegio NOVO e concedido a `evolli_app` ou `evolli_migrator` por
-- esta migration (ADR 0002 intacta): ela so REVOGA.
REVOKE UPDATE, DELETE ON TABLE "evento_ponto" FROM evolli_app;
REVOKE UPDATE, DELETE ON TABLE "ajuste_ponto" FROM evolli_app;
