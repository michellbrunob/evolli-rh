-- T209 — Novo colaborador, etapa 2 (dados profissionais). Migration aditiva.
--
-- * Tipos novos de contratação: part_time, freelancer e trainee.
-- * Contrato da admissão numa tabela própria (uma linha por vínculo), fora do
--   vínculo: o salário não sai pelas rotas que já devolvem o vínculo.
-- * Listas fechadas (nível, escala, conselho) e faixas por CHECK; registro
--   profissional só com conselho; gestor direto é uma pessoa (o vínculo dele
--   na mesma empresa é conferido no servidor).

ALTER TYPE "TipoVinculo" ADD VALUE IF NOT EXISTS 'part_time';
ALTER TYPE "TipoVinculo" ADD VALUE IF NOT EXISTS 'freelancer';
ALTER TYPE "TipoVinculo" ADD VALUE IF NOT EXISTS 'trainee';

CREATE TABLE "contrato_vinculo" (
    "vinculo_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nivel" TEXT,
    "gestor_direto_colaborador_id" TEXT,
    "jornada_semanal_horas" INTEGER,
    "escala" TEXT,
    "salario_bruto" DECIMAL(12,2),
    "conselho_profissional" TEXT,
    "registro_profissional" TEXT,
    "dependentes_irrf" INTEGER,
    "pensao_alimenticia_percentual" DECIMAL(5,2),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contrato_vinculo_pkey" PRIMARY KEY ("vinculo_id")
);

CREATE UNIQUE INDEX "contrato_vinculo_vinculo_id_empresa_id_key" ON "contrato_vinculo"("vinculo_id", "empresa_id");
CREATE INDEX "contrato_vinculo_empresa_id_idx" ON "contrato_vinculo"("empresa_id");
CREATE INDEX "contrato_vinculo_gestor_direto_colaborador_id_idx" ON "contrato_vinculo"("gestor_direto_colaborador_id");

ALTER TABLE "contrato_vinculo" ADD CONSTRAINT "contrato_vinculo_vinculo_id_empresa_id_fkey" FOREIGN KEY ("vinculo_id", "empresa_id") REFERENCES "vinculo_funcional"("id", "empresa_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contrato_vinculo" ADD CONSTRAINT "contrato_vinculo_gestor_direto_colaborador_id_fkey" FOREIGN KEY ("gestor_direto_colaborador_id") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contrato_vinculo"
  ADD CONSTRAINT "contrato_vinculo_nivel_check"
  CHECK ("nivel" IS NULL OR "nivel" IN ('primeiro_emprego', 'junior', 'pleno', 'senior', 'lider_tecnico', 'coordenador', 'gerente', 'head', 'diretor', 'vp', 'c_level'));

ALTER TABLE "contrato_vinculo"
  ADD CONSTRAINT "contrato_vinculo_escala_check"
  CHECK ("escala" IS NULL OR "escala" IN ('5x2', '6x1', 'semana_espanhola', '4x3', 'fim_de_semana', '5x1', '6x2', '4x2', '2x2', '3x3', '4x4', '12x36', '12x60', '12x72', '18x36', '24x48', '24x72', '7x7', '14x14', '14x21', '15x15', '20x10', '21x21', '28x28', 'outra'));

ALTER TABLE "contrato_vinculo"
  ADD CONSTRAINT "contrato_vinculo_conselho_check"
  CHECK (
    ("conselho_profissional" IS NULL OR "conselho_profissional" IN ('oab', 'crm', 'coren', 'cro', 'crp', 'crea', 'cau', 'cra', 'crc', 'crf', 'crn', 'cref', 'crefito', 'crbm', 'crtr'))
    AND ("registro_profissional" IS NULL OR ("conselho_profissional" IS NOT NULL AND char_length("registro_profissional") BETWEEN 1 AND 40 AND "registro_profissional" !~ '[[:cntrl:]]'))
  );

ALTER TABLE "contrato_vinculo"
  ADD CONSTRAINT "contrato_vinculo_numeros_check"
  CHECK (
    ("jornada_semanal_horas" IS NULL OR "jornada_semanal_horas" BETWEEN 1 AND 80)
    AND ("salario_bruto" IS NULL OR "salario_bruto" > 0)
    AND ("dependentes_irrf" IS NULL OR "dependentes_irrf" BETWEEN 0 AND 99)
    AND ("pensao_alimenticia_percentual" IS NULL OR "pensao_alimenticia_percentual" BETWEEN 0 AND 100)
  );
