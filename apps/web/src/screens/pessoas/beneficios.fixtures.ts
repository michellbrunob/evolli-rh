/**
 * Dados sintéticos de "Pessoas > Benefícios" (T092).
 *
 * Amostra puramente demonstrativa de categorias de referência técnica de
 * benefício por modalidade ilustrativa e escopo técnico — sem conceder,
 * vincular, suspender, aprovar, calcular, descontar, pagar, reembolsar,
 * importar, exportar ou integrar benefício real. Nenhuma linha representa um
 * benefício concedido, ativo ou aplicado; todas seguem como referência em
 * revisão, aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoBeneficios =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface BeneficioExemplo {
  readonly id: string;
  readonly categoriaReferencia: string;
  readonly modalidadeIlustrativa: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoBeneficios;
  readonly responsavelTecnico: string;
  readonly decisaoGatePendente: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_BENEFICIOS: Record<SituacaoBeneficios, string> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const BENEFICIOS_EXEMPLO: readonly BeneficioExemplo[] = [
  {
    id: "BEN-2026-0001",
    categoriaReferencia: "Categoria de referência B-01 (exemplo)",
    modalidadeIlustrativa: "Modalidade ilustrativa M-01 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Beneficios-01 (exemplo)",
    decisaoGatePendente: "Validação RH pendente (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de categoria de benefício (exemplo ilustrativo, sem concessão, cálculo ou pagamento real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "BEN-2026-0002",
    categoriaReferencia: "Categoria de referência B-02 (exemplo)",
    modalidadeIlustrativa: "Modalidade ilustrativa M-02 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Beneficios-02 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de categoria de benefício (exemplo ilustrativo, sem concessão, cálculo ou pagamento real).",
    camposPendentes: [],
  },
  {
    id: "BEN-2026-0003",
    categoriaReferencia: "Categoria de referência B-01 (exemplo)",
    modalidadeIlustrativa: "Modalidade ilustrativa M-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Beneficios-01 (exemplo)",
    decisaoGatePendente: "Reconhecimento formal pendente (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem concessão, cálculo ou pagamento real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "BEN-2026-0004",
    categoriaReferencia: "Categoria de referência B-03 (exemplo)",
    modalidadeIlustrativa: "Modalidade ilustrativa M-04 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Beneficios-03 (exemplo)",
    decisaoGatePendente: "Aprovação de referência pendente (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem concessão, cálculo ou pagamento real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "BEN-2026-0005",
    categoriaReferencia: "Categoria de referência B-02 (exemplo)",
    modalidadeIlustrativa: "Modalidade ilustrativa M-01 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Beneficios-02 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de categoria de benefício (exemplo ilustrativo, sem concessão, cálculo ou pagamento real).",
    camposPendentes: [],
  },
  {
    id: "BEN-2025-0001",
    categoriaReferencia: "Categoria de referência B-01 (exemplo)",
    modalidadeIlustrativa: "Modalidade ilustrativa M-02 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Beneficios-03 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre benefício, remuneração ou Folha.",
    camposPendentes: [],
  },
  {
    id: "BEN-2025-0002",
    categoriaReferencia: "Categoria de referência B-04 (exemplo)",
    modalidadeIlustrativa: "Modalidade ilustrativa M-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Beneficios-01 (exemplo)",
    decisaoGatePendente: "Nenhuma pendência (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre benefício, remuneração ou Folha.",
    camposPendentes: [],
  },
];
