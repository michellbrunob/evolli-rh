/**
 * Dados sintéticos de "Pessoas > Dependentes" (T093).
 *
 * Amostra puramente demonstrativa de categorias de referência técnica de
 * dependência por vínculo ilustrativo e escopo técnico — sem identificar,
 * vincular, validar, comprovar, conceder, aprovar, calcular, descontar,
 * pagar, reembolsar, importar, exportar ou integrar dependente real.
 * Nenhuma linha representa uma pessoa identificável ou um vínculo
 * reconhecido; todas seguem como referência em revisão, aguardando decisão
 * ou histórico ilustrativo.
 */

export type SituacaoDependentes =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface DependenteExemplo {
  readonly id: string;
  readonly categoriaReferencia: string;
  readonly vinculoIlustrativo: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoDependentes;
  readonly responsavelTecnico: string;
  readonly decisaoGatePendente: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_DEPENDENTES: Record<SituacaoDependentes, string> =
  {
    referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
    aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
    historico_ilustrativo: "Histórico ilustrativo",
  };

export const DEPENDENTES_EXEMPLO: readonly DependenteExemplo[] = [
  {
    id: "DEP-2026-0001",
    categoriaReferencia: "Categoria de referência D-01 (exemplo)",
    vinculoIlustrativo: "Vínculo ilustrativo V-01 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Dependentes-01 (exemplo)",
    decisaoGatePendente: "Validação RH pendente (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de categoria de dependência (exemplo ilustrativo, sem identificação, vínculo ou validação real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "DEP-2026-0002",
    categoriaReferencia: "Categoria de referência D-02 (exemplo)",
    vinculoIlustrativo: "Vínculo ilustrativo V-02 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Dependentes-02 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de categoria de dependência (exemplo ilustrativo, sem identificação, vínculo ou validação real).",
    camposPendentes: [],
  },
  {
    id: "DEP-2026-0003",
    categoriaReferencia: "Categoria de referência D-01 (exemplo)",
    vinculoIlustrativo: "Vínculo ilustrativo V-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Dependentes-01 (exemplo)",
    decisaoGatePendente: "Reconhecimento formal pendente (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem identificação, vínculo ou validação real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "DEP-2026-0004",
    categoriaReferencia: "Categoria de referência D-03 (exemplo)",
    vinculoIlustrativo: "Vínculo ilustrativo V-04 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Dependentes-03 (exemplo)",
    decisaoGatePendente: "Aprovação de referência pendente (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem identificação, vínculo ou validação real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "DEP-2026-0005",
    categoriaReferencia: "Categoria de referência D-02 (exemplo)",
    vinculoIlustrativo: "Vínculo ilustrativo V-01 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Dependentes-02 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de categoria de dependência (exemplo ilustrativo, sem identificação, vínculo ou validação real).",
    camposPendentes: [],
  },
  {
    id: "DEP-2025-0001",
    categoriaReferencia: "Categoria de referência D-01 (exemplo)",
    vinculoIlustrativo: "Vínculo ilustrativo V-02 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Dependentes-03 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre dependente, benefício ou Folha.",
    camposPendentes: [],
  },
  {
    id: "DEP-2025-0002",
    categoriaReferencia: "Categoria de referência D-04 (exemplo)",
    vinculoIlustrativo: "Vínculo ilustrativo V-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Dependentes-01 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre dependente, benefício ou Folha.",
    camposPendentes: [],
  },
];
