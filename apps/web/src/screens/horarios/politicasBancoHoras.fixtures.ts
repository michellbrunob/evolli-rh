/**
 * Dados sintéticos de "Cadastros > Políticas de Banco de Horas" (T078).
 *
 * Amostra puramente demonstrativa de como políticas futuras de Banco de
 * Horas poderão ser versionadas por empresa/unidade e vigência — sem ativar
 * regra, calcular saldo ou alterar período fechado. Nenhuma linha representa
 * uma política "ativa", "aprovada" ou operacional; todas seguem como
 * rascunho, aguardando validação ou versão histórica de exemplo.
 */

import { formatarDiaCivil } from "../../format/data";

export type SituacaoPoliticaBancoHoras =
  "rascunho" | "aguardando_validacao" | "versao_historica_exemplo";

export interface PoliticaBancoHorasExemplo {
  readonly id: string;
  readonly empresaUnidadeTecnica: string;
  readonly versao: string;
  readonly vigenciaInicioIlustrativa: string;
  readonly vigenciaFimIlustrativa: string;
  readonly situacao: SituacaoPoliticaBancoHoras;
  readonly responsavelTecnico: string;
  readonly decisaoGatePendente: string;
  readonly trilhaAuditoria: string;
}

export const ROTULO_SITUACAO_POLITICA: Record<
  SituacaoPoliticaBancoHoras,
  string
> = {
  rascunho: "Rascunho",
  aguardando_validacao: "Aguardando validação",
  versao_historica_exemplo: "Versão histórica de exemplo",
};

export function formatarVigenciaIlustrativa(
  politica: Pick<
    PoliticaBancoHorasExemplo,
    "vigenciaInicioIlustrativa" | "vigenciaFimIlustrativa"
  >,
): string {
  return `${formatarDiaCivil(politica.vigenciaInicioIlustrativa)} a ${formatarDiaCivil(
    politica.vigenciaFimIlustrativa,
  )} (ilustrativa)`;
}

export const POLITICAS_BANCO_HORAS_EXEMPLO: readonly PoliticaBancoHorasExemplo[] =
  [
    {
      id: "POL-BH-2026-0001",
      empresaUnidadeTecnica: "UN-01 (exemplo)",
      versao: "v0.1 (rascunho)",
      vigenciaInicioIlustrativa: "2026-02-01",
      vigenciaFimIlustrativa: "2026-07-31",
      situacao: "rascunho",
      responsavelTecnico: "RT-Politica-01 (exemplo)",
      decisaoGatePendente: "Decisão RH pendente (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
    },
    {
      id: "POL-BH-2026-0002",
      empresaUnidadeTecnica: "UN-02 (exemplo)",
      versao: "v0.2 (rascunho)",
      vigenciaInicioIlustrativa: "2026-03-01",
      vigenciaFimIlustrativa: "2026-08-31",
      situacao: "rascunho",
      responsavelTecnico: "RT-Politica-02 (exemplo)",
      decisaoGatePendente: "Decisão RH + Jurídico pendente (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
    },
    {
      id: "POL-BH-2026-0003",
      empresaUnidadeTecnica: "UN-01 (exemplo)",
      versao: "v0.3 (aguardando validação)",
      vigenciaInicioIlustrativa: "2026-04-01",
      vigenciaFimIlustrativa: "2026-09-30",
      situacao: "aguardando_validacao",
      responsavelTecnico: "RT-Politica-01 (exemplo)",
      decisaoGatePendente: "Decisão RH + Jurídico + Folha pendente (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
    },
    {
      id: "POL-BH-2026-0004",
      empresaUnidadeTecnica: "UN-03 (exemplo)",
      versao: "v0.1 (aguardando validação)",
      vigenciaInicioIlustrativa: "2026-05-04",
      vigenciaFimIlustrativa: "2026-10-31",
      situacao: "aguardando_validacao",
      responsavelTecnico: "RT-Politica-03 (exemplo)",
      decisaoGatePendente: "Decisão RH + Jurídico pendente (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
    },
    {
      id: "POL-BH-2025-0001",
      empresaUnidadeTecnica: "UN-02 (exemplo)",
      versao: "v0.1 (histórica de exemplo)",
      vigenciaInicioIlustrativa: "2025-01-05",
      vigenciaFimIlustrativa: "2025-06-30",
      situacao: "versao_historica_exemplo",
      responsavelTecnico: "RT-Politica-02 (exemplo)",
      decisaoGatePendente: "Sem decisão pendente — versão histórica de exemplo",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
    },
    {
      id: "POL-BH-2025-0002",
      empresaUnidadeTecnica: "UN-03 (exemplo)",
      versao: "v0.2 (histórica de exemplo)",
      vigenciaInicioIlustrativa: "2025-07-01",
      vigenciaFimIlustrativa: "2025-12-31",
      situacao: "versao_historica_exemplo",
      responsavelTecnico: "RT-Politica-03 (exemplo)",
      decisaoGatePendente: "Sem decisão pendente — versão histórica de exemplo",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
    },
  ];
