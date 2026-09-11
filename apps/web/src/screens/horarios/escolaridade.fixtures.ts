/**
 * Dados sintéticos de "Cadastros > Escolaridade" (T086).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * de catálogo de escolaridade por categoria e escopo organizacional técnico
 * — sem alterar colaborador, vínculo, função, cargo, remuneração,
 * elegibilidade, acesso, jornada, ponto, Banco de Horas ou Folha. Nenhuma
 * linha representa uma referência ativa, aprovada, operacional ou validada;
 * todas seguem como referência em revisão, aguardando decisão ou histórico
 * ilustrativo.
 */

export type SituacaoEscolaridade =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface EscolaridadeExemplo {
  readonly id: string;
  readonly codigoIlustrativo: string;
  readonly referenciaEscolaridade: string;
  readonly categoriaReferencia: string;
  readonly escopoOrganizacionalTecnico: string;
  readonly situacao: SituacaoEscolaridade;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_ESCOLARIDADE: Record<
  SituacaoEscolaridade,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const ESCOLARIDADE_EXEMPLO: readonly EscolaridadeExemplo[] = [
  {
    id: "ESC-2026-0001",
    codigoIlustrativo: "ESCC-001 (exemplo)",
    referenciaEscolaridade: "Referência de escolaridade A (exemplo)",
    categoriaReferencia: "Categoria C-01 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Escolaridade-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de escolaridade (exemplo ilustrativo, sem diploma, certificado ou instituição real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "ESC-2026-0002",
    codigoIlustrativo: "ESCC-002 (exemplo)",
    referenciaEscolaridade: "Referência de escolaridade B (exemplo)",
    categoriaReferencia: "Categoria C-02 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Escolaridade-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de escolaridade (exemplo ilustrativo, sem diploma, certificado ou instituição real).",
    camposPendentes: [],
  },
  {
    id: "ESC-2026-0003",
    codigoIlustrativo: "ESCC-003 (exemplo)",
    referenciaEscolaridade: "Referência de escolaridade C (exemplo)",
    categoriaReferencia: "Categoria C-01 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Escolaridade-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem diploma, certificado ou instituição real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "ESC-2026-0004",
    codigoIlustrativo: "ESCC-004 (exemplo)",
    referenciaEscolaridade: "Referência de escolaridade D (exemplo)",
    categoriaReferencia: "Categoria C-03 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Escolaridade-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem diploma, certificado ou instituição real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "ESC-2026-0005",
    codigoIlustrativo: "ESCC-005 (exemplo)",
    referenciaEscolaridade: "Referência de escolaridade E (exemplo)",
    categoriaReferencia: "Categoria C-02 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Escolaridade-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de escolaridade (exemplo ilustrativo, sem diploma, certificado ou instituição real).",
    camposPendentes: [],
  },
  {
    id: "ESC-2025-0001",
    codigoIlustrativo: "ESCC-006 (exemplo)",
    referenciaEscolaridade: "Referência de escolaridade A (exemplo)",
    categoriaReferencia: "Categoria C-03 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Escolaridade-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre cadastro, elegibilidade ou Folha.",
    camposPendentes: [],
  },
  {
    id: "ESC-2025-0002",
    codigoIlustrativo: "ESCC-007 (exemplo)",
    referenciaEscolaridade: "Referência de escolaridade F (exemplo)",
    categoriaReferencia: "Categoria C-01 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Escolaridade-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre cadastro, elegibilidade ou Folha.",
    camposPendentes: [],
  },
];
