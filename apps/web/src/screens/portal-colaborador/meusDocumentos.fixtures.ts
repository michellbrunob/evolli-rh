/**
 * Dados sintéticos de "Portal do Colaborador > Meus documentos" (T067).
 *
 * Só metadados **ilustrativos** — nenhum arquivo, imagem, PDF ou conteúdo
 * documental real existe nesta demonstração.
 */

export type SituacaoDocumentoExemplo = "disponivel" | "pendente";

export interface DocumentoPortalExemplo {
  readonly id: string;
  readonly tipoDocumental: string;
  readonly situacao: SituacaoDocumentoExemplo;
}

export const ROTULO_SITUACAO_DOCUMENTO: Record<
  SituacaoDocumentoExemplo,
  string
> = {
  disponivel: "Disponível",
  pendente: "Pendente",
};

export const DOCUMENTOS_PORTAL_EXEMPLO: readonly DocumentoPortalExemplo[] = [
  {
    id: "DOC-DEMO-0001",
    tipoDocumental: "Contracheque",
    situacao: "disponivel",
  },
  {
    id: "DOC-DEMO-0002",
    tipoDocumental: "Informe de rendimentos",
    situacao: "pendente",
  },
  {
    id: "DOC-DEMO-0003",
    tipoDocumental: "Comprovante de férias",
    situacao: "disponivel",
  },
];
