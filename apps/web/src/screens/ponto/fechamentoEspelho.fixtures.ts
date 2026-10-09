/**
 * Dados sintéticos de "Ponto > Fechamento e Espelho" (T079).
 *
 * Amostra puramente demonstrativa de como o RH poderá acompanhar a revisão
 * de um período antes de um eventual fechamento — sem calcular jornada,
 * saldo, compensação, pagamento, desconto, DSR, Banco de Horas ou Folha, e
 * sem executar fechamento, reabertura, aprovação, rejeição ou geração de
 * espelho reais. Nenhuma linha representa um fechamento realmente
 * executado; todas seguem como exemplos ilustrativos.
 */

import { formatarDiaCivil } from "../../format/data";

export type SituacaoFechamento =
  | "em_revisao_exemplo"
  | "aguardando_validacao_exemplo"
  | "pronto_para_decisao_exemplo"
  | "historico_ilustrativo";

export interface FechamentoEspelhoExemplo {
  readonly id: string;
  readonly periodoInicioIlustrativo: string;
  readonly periodoFimIlustrativo: string;
  readonly empresaUnidadeTecnica: string;
  readonly situacao: SituacaoFechamento;
  readonly pendenciasBloqueadoras: readonly string[];
  readonly alertasInformativos: readonly string[];
  readonly ajustesManuaisEmRevisao: number;
  readonly responsavelTecnico: string;
  readonly validacaoGestor: string;
  readonly situacaoEspelho: string;
  readonly trilhaAuditoria: string;
}

export const ROTULO_SITUACAO_FECHAMENTO: Record<SituacaoFechamento, string> = {
  em_revisao_exemplo: "Em revisão (exemplo)",
  aguardando_validacao_exemplo: "Aguardando validação (exemplo)",
  pronto_para_decisao_exemplo: "Pronto para decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export function formatarPeriodoIlustrativo(
  fechamento: Pick<
    FechamentoEspelhoExemplo,
    "periodoInicioIlustrativo" | "periodoFimIlustrativo"
  >,
): string {
  return `${formatarDiaCivil(fechamento.periodoInicioIlustrativo)} a ${formatarDiaCivil(
    fechamento.periodoFimIlustrativo,
  )} (ilustrativo)`;
}

export const FECHAMENTOS_ESPELHO_EXEMPLO: readonly FechamentoEspelhoExemplo[] =
  [
    {
      id: "FEC-2026-0001",
      periodoInicioIlustrativo: "2026-02-01",
      periodoFimIlustrativo: "2026-02-28",
      empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
      situacao: "em_revisao_exemplo",
      pendenciasBloqueadoras: [
        "Pendência cadastral A (exemplo)",
        "Pendência cadastral B (exemplo)",
      ],
      alertasInformativos: ["Alerta informativo A (exemplo)"],
      ajustesManuaisEmRevisao: 2,
      responsavelTecnico: "RT-Fechamento-01 (exemplo)",
      validacaoGestor: "Pendente (exemplo)",
      situacaoEspelho: "Não disponibilizado (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
    },
    {
      id: "FEC-2026-0002",
      periodoInicioIlustrativo: "2026-03-01",
      periodoFimIlustrativo: "2026-03-31",
      empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
      situacao: "em_revisao_exemplo",
      pendenciasBloqueadoras: ["Pendência cadastral C (exemplo)"],
      alertasInformativos: [],
      ajustesManuaisEmRevisao: 1,
      responsavelTecnico: "RT-Fechamento-02 (exemplo)",
      validacaoGestor: "Pendente (exemplo)",
      situacaoEspelho: "Não disponibilizado (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
    },
    {
      id: "FEC-2026-0003",
      periodoInicioIlustrativo: "2026-04-01",
      periodoFimIlustrativo: "2026-04-30",
      empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
      situacao: "aguardando_validacao_exemplo",
      pendenciasBloqueadoras: [],
      alertasInformativos: [
        "Alerta informativo B (exemplo)",
        "Alerta informativo C (exemplo)",
      ],
      ajustesManuaisEmRevisao: 0,
      responsavelTecnico: "RT-Fechamento-01 (exemplo)",
      validacaoGestor: "Pendente (exemplo)",
      situacaoEspelho: "Não disponibilizado (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
    },
    {
      id: "FEC-2026-0004",
      periodoInicioIlustrativo: "2026-05-01",
      periodoFimIlustrativo: "2026-05-31",
      empresaUnidadeTecnica: "Unidade U-03 (exemplo)",
      situacao: "aguardando_validacao_exemplo",
      pendenciasBloqueadoras: ["Pendência cadastral D (exemplo)"],
      alertasInformativos: ["Alerta informativo D (exemplo)"],
      ajustesManuaisEmRevisao: 1,
      responsavelTecnico: "RT-Fechamento-03 (exemplo)",
      validacaoGestor: "Devolvido pelo gestor (exemplo)",
      situacaoEspelho: "Não disponibilizado (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
    },
    {
      id: "FEC-2026-0005",
      periodoInicioIlustrativo: "2026-06-01",
      periodoFimIlustrativo: "2026-06-30",
      empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
      situacao: "pronto_para_decisao_exemplo",
      pendenciasBloqueadoras: [],
      alertasInformativos: [],
      ajustesManuaisEmRevisao: 0,
      responsavelTecnico: "RT-Fechamento-02 (exemplo)",
      validacaoGestor: "Recomendado pelo gestor (exemplo)",
      situacaoEspelho: "Não disponibilizado (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
    },
    {
      id: "FEC-2026-0006",
      periodoInicioIlustrativo: "2026-08-01",
      periodoFimIlustrativo: "2026-08-31",
      empresaUnidadeTecnica: "Unidade U-01 (exemplo)",
      situacao: "pronto_para_decisao_exemplo",
      pendenciasBloqueadoras: [],
      alertasInformativos: ["Alerta informativo E (exemplo)"],
      ajustesManuaisEmRevisao: 0,
      responsavelTecnico: "RT-Fechamento-01 (exemplo)",
      validacaoGestor: "Recomendado pelo gestor (exemplo)",
      situacaoEspelho: "Não disponibilizado (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
    },
    {
      id: "FEC-2025-0001",
      periodoInicioIlustrativo: "2025-09-01",
      periodoFimIlustrativo: "2025-09-30",
      empresaUnidadeTecnica: "Unidade U-03 (exemplo)",
      situacao: "historico_ilustrativo",
      pendenciasBloqueadoras: [],
      alertasInformativos: [],
      ajustesManuaisEmRevisao: 0,
      responsavelTecnico: "RT-Fechamento-03 (exemplo)",
      validacaoGestor: "Recomendado pelo gestor (exemplo)",
      situacaoEspelho: "Disponibilizado (exemplo)",
      trilhaAuditoria: "4 eventos registrados (exemplo)",
    },
    {
      id: "FEC-2025-0002",
      periodoInicioIlustrativo: "2025-10-01",
      periodoFimIlustrativo: "2025-10-31",
      empresaUnidadeTecnica: "Unidade U-02 (exemplo)",
      situacao: "historico_ilustrativo",
      pendenciasBloqueadoras: [],
      alertasInformativos: [],
      ajustesManuaisEmRevisao: 0,
      responsavelTecnico: "RT-Fechamento-02 (exemplo)",
      validacaoGestor: "Recomendado pelo gestor (exemplo)",
      situacaoEspelho: "Disponibilizado (exemplo)",
      trilhaAuditoria: "4 eventos registrados (exemplo)",
    },
  ];
