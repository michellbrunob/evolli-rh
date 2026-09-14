/**
 * Dados sintéticos de "Pessoas > Documentos" (T090).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * técnicas de evidências documentais por categoria, finalidade de referência
 * e escopo técnico — sem receber, exibir, validar, assinar, publicar, reter,
 * excluir, compartilhar, importar, exportar ou integrar documentos reais.
 * Nenhuma linha representa um documento, arquivo, upload ou download real;
 * todas seguem como referência em revisão, aguardando decisão ou histórico
 * ilustrativo.
 */

export type SituacaoPessoasDocumentos =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface PessoasDocumentoExemplo {
  readonly id: string;
  readonly categoriaDocumental: string;
  readonly finalidadeReferencia: string;
  readonly visibilidadePrevista: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoPessoasDocumentos;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_PESSOAS_DOCUMENTOS: Record<
  SituacaoPessoasDocumentos,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const PESSOAS_DOCUMENTOS_EXEMPLO: readonly PessoasDocumentoExemplo[] = [
  {
    id: "DOC-2026-0001",
    categoriaDocumental: "Categoria documental C-01 (exemplo)",
    finalidadeReferencia: "Finalidade F-01 (exemplo)",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Documentos-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de evidência documental (exemplo ilustrativo, sem arquivo, upload, download ou visualização real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "DOC-2026-0002",
    categoriaDocumental: "Categoria documental C-02 (exemplo)",
    finalidadeReferencia: "Finalidade F-02 (exemplo)",
    visibilidadePrevista: "RH e auditoria (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Documentos-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de evidência documental (exemplo ilustrativo, sem arquivo, upload, download ou visualização real).",
    camposPendentes: [],
  },
  {
    id: "DOC-2026-0003",
    categoriaDocumental: "Categoria documental C-01 (exemplo)",
    finalidadeReferencia: "Finalidade F-03 (exemplo)",
    visibilidadePrevista: "Somente RH central (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Documentos-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem arquivo, upload, download ou visualização real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "DOC-2026-0004",
    categoriaDocumental: "Categoria documental C-03 (exemplo)",
    finalidadeReferencia: "Finalidade F-04 (exemplo)",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Documentos-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem arquivo, upload, download ou visualização real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "DOC-2026-0005",
    categoriaDocumental: "Categoria documental C-02 (exemplo)",
    finalidadeReferencia: "Finalidade F-01 (exemplo)",
    visibilidadePrevista: "RH e auditoria (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Documentos-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de evidência documental (exemplo ilustrativo, sem arquivo, upload, download ou visualização real).",
    camposPendentes: [],
  },
  {
    id: "DOC-2025-0001",
    categoriaDocumental: "Categoria documental C-01 (exemplo)",
    finalidadeReferencia: "Finalidade F-02 (exemplo)",
    visibilidadePrevista: "Somente RH central (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Documentos-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre arquivo, upload, download ou visualização.",
    camposPendentes: [],
  },
  {
    id: "DOC-2025-0002",
    categoriaDocumental: "Categoria documental C-04 (exemplo)",
    finalidadeReferencia: "Finalidade F-03 (exemplo)",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Documentos-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre arquivo, upload, download ou visualização.",
    camposPendentes: [],
  },
];
