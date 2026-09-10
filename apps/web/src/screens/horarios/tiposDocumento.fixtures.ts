/**
 * Dados sintéticos de "Cadastros > Tipos de documento" (T084).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * de catálogo de tipo documental por categoria e escopo organizacional
 * técnico — sem criar documento, solicitação, permissão, assinatura,
 * validade, retenção, publicação ao colaborador ou encaminhamento à Folha.
 * Nenhuma linha representa um tipo documental ativo, aprovado, operacional
 * ou configurado; todas seguem como referência em revisão, aguardando
 * decisão ou histórico ilustrativo.
 *
 * `camposPendentes` pode incluir "Retenção a definir (exemplo)" — usado só
 * para contagem do indicador de resumo "itens com retenção a definir"; não é
 * uma coluna da tabela nem uma política de retenção real.
 */

export type SituacaoTipoDocumento =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface TipoDocumentoExemplo {
  readonly id: string;
  readonly tipoDocumental: string;
  readonly categoriaReferencia: string;
  readonly escopoOrganizacionalTecnico: string;
  readonly visibilidadePrevista: string;
  readonly situacao: SituacaoTipoDocumento;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_TIPO_DOCUMENTO: Record<
  SituacaoTipoDocumento,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const RETENCAO_A_DEFINIR_EXEMPLO = "Retenção a definir (exemplo)";
export const VISIBILIDADE_A_DEFINIR_EXEMPLO =
  "Visibilidade a definir (exemplo)";

export const TIPOS_DOCUMENTO_EXEMPLO: readonly TipoDocumentoExemplo[] = [
  {
    id: "TD-2026-0001",
    tipoDocumental: "Tipo documental de referência A (exemplo)",
    categoriaReferencia: "Categoria C-01 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
    visibilidadePrevista: VISIBILIDADE_A_DEFINIR_EXEMPLO,
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-TiposDocumento-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de catálogo de tipo documental (exemplo ilustrativo, sem documento ou arquivo real).",
    camposPendentes: [RETENCAO_A_DEFINIR_EXEMPLO, "Validação RH (exemplo)"],
  },
  {
    id: "TD-2026-0002",
    tipoDocumental: "Tipo documental de referência B (exemplo)",
    categoriaReferencia: "Categoria C-02 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
    visibilidadePrevista: "Restrita ao RH (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-TiposDocumento-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de catálogo de tipo documental (exemplo ilustrativo, sem documento ou arquivo real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "TD-2026-0003",
    tipoDocumental: "Tipo documental de referência C (exemplo)",
    categoriaReferencia: "Categoria C-01 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
    visibilidadePrevista: VISIBILIDADE_A_DEFINIR_EXEMPLO,
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-TiposDocumento-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem documento ou arquivo real).",
    camposPendentes: [
      RETENCAO_A_DEFINIR_EXEMPLO,
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "TD-2026-0004",
    tipoDocumental: "Tipo documental de referência D (exemplo)",
    categoriaReferencia: "Categoria C-03 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
    visibilidadePrevista: "Restrita ao RH (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-TiposDocumento-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem documento ou arquivo real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "TD-2026-0005",
    tipoDocumental: "Tipo documental de referência E (exemplo)",
    categoriaReferencia: "Categoria C-02 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
    visibilidadePrevista: VISIBILIDADE_A_DEFINIR_EXEMPLO,
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-TiposDocumento-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de catálogo de tipo documental (exemplo ilustrativo, sem documento ou arquivo real).",
    camposPendentes: [RETENCAO_A_DEFINIR_EXEMPLO],
  },
  {
    id: "TD-2025-0001",
    tipoDocumental: "Tipo documental de referência A (exemplo)",
    categoriaReferencia: "Categoria C-03 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
    visibilidadePrevista: "Restrita ao RH (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-TiposDocumento-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito documental real.",
    camposPendentes: [],
  },
  {
    id: "TD-2025-0002",
    tipoDocumental: "Tipo documental de referência F (exemplo)",
    categoriaReferencia: "Categoria C-01 (exemplo)",
    escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
    visibilidadePrevista: "Restrita ao RH (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-TiposDocumento-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito documental real.",
    camposPendentes: [],
  },
];
