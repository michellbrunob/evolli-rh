/**
 * Dados sintéticos da tela "Documentos > Metadados" (T047).
 *
 * Reflete os conceitos já materializados no backend
 * (`apps/api/src/documentos/`, ADR 0011): `TipoDocumento` (catálogo por
 * empresa, classificação `restrito`), `DocumentoMetadado` (sujeito é o
 * colaborador, estado `upload_desabilitado` — único "ativo" alcançável nesta
 * V1, sem transição para conteúdo — ou `substituido`) e
 * `SolicitacaoDocumento` (estado `pendente` — único alcançável nesta V1).
 * Esta tela **não chama** o backend; é puramente visual.
 *
 * ADR 0011, decisão 1: metadado e conteúdo são segregados por construção —
 * nenhuma entidade de metadado carrega bytes, upload, storage ou endereço de
 * arquivo. Esta tela reforça a mesma segregação: só metadado é mostrado.
 *
 * Nomes de tipo documental são deliberadamente administrativos e neutros
 * (endereço, identificação, escolaridade) — nunca uma categoria que revele
 * informação sensível por inferência (saúde, família, filiação — ADR 0011,
 * O3), e nunca um tipo real do catálogo de nenhuma empresa. Identificadores
 * de colaborador são abstratos e sintéticos (`Vínculo V-001`), mesma
 * convenção já usada em T043/T045/T046 — nunca nome, CPF ou empresa real.
 *
 * O prazo de validade exibido é **ilustrativo**: a política real de
 * validade/expiração de documento (DP-2E-06) ainda não foi decidida pelo
 * produto — esta tela não declara nem antecipa essa decisão.
 */
import { formatarDiaCivil } from "../../format/data";

export type SituacaoRegistroDocumento =
  "metadado_ativo" | "metadado_substituido" | "solicitacao_pendente";

export type CategoriaRegistro = "documento" | "solicitacao";

export interface TipoDocumentoExemplo {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface RegistroDocumentoExemplo {
  readonly id: string;
  readonly vinculo: string;
  readonly tipoDocumento: string;
  readonly categoria: CategoriaRegistro;
  readonly situacao: SituacaoRegistroDocumento;
  readonly data: string;
  readonly validade?: string;
  readonly referenciaTecnica: string;
}

export const ROTULO_SITUACAO: Record<SituacaoRegistroDocumento, string> = {
  metadado_ativo: "Ativo (metadado)",
  metadado_substituido: "Substituído",
  solicitacao_pendente: "Pendente",
};

export const ROTULO_CATEGORIA: Record<CategoriaRegistro, string> = {
  documento: "Documento",
  solicitacao: "Solicitação",
};

/**
 * Validade do registro — data civil em `DD/MM/AAAA` (T154).
 *
 * A ausência **não** usa o traço padrão de propósito: a validade desta tela é
 * ilustrativa (vide a nota abaixo da tabela em `DocumentosMetadadosScreen`), e
 * o texto longo é o que sinaliza isso dentro da célula. Trocá-lo pelo traço é
 * decisão de produto, não de formatação — e a T154 só uniformiza formatação.
 */
export function formatarValidade(item: RegistroDocumentoExemplo): string {
  return item.validade
    ? formatarDiaCivil(item.validade)
    : "Sem validade definida (exemplo)";
}

export const TIPOS_DOCUMENTO_EXEMPLO: readonly TipoDocumentoExemplo[] = [
  {
    id: "tipo-exemplo-1",
    codigo: "ENDERECO",
    nome: "Comprovante de Endereço (exemplo)",
  },
  {
    id: "tipo-exemplo-2",
    codigo: "IDENTIFICACAO",
    nome: "Documento de Identificação (exemplo)",
  },
  {
    id: "tipo-exemplo-3",
    codigo: "ESCOLARIDADE",
    nome: "Comprovante de Escolaridade (exemplo)",
  },
];

export const REGISTROS_DOCUMENTO_EXEMPLO: readonly RegistroDocumentoExemplo[] =
  [
    {
      id: "registro-exemplo-1",
      vinculo: "Vínculo V-001",
      tipoDocumento: "Comprovante de Endereço (exemplo)",
      categoria: "documento",
      situacao: "metadado_ativo",
      data: "2026-01-10",
      validade: "2026-07-10",
      referenciaTecnica: "DOC-0001",
    },
    {
      id: "registro-exemplo-2",
      vinculo: "Vínculo V-014",
      tipoDocumento: "Documento de Identificação (exemplo)",
      categoria: "documento",
      situacao: "metadado_substituido",
      data: "2025-11-02",
      referenciaTecnica: "DOC-0002",
    },
    {
      id: "registro-exemplo-3",
      vinculo: "Vínculo V-007",
      tipoDocumento: "Comprovante de Escolaridade (exemplo)",
      categoria: "solicitacao",
      situacao: "solicitacao_pendente",
      data: "2026-02-03",
      referenciaTecnica: "SOL-0001",
    },
    {
      id: "registro-exemplo-4",
      vinculo: "Vínculo V-022",
      tipoDocumento: "Comprovante de Endereço (exemplo)",
      categoria: "solicitacao",
      situacao: "solicitacao_pendente",
      data: "2026-02-05",
      referenciaTecnica: "SOL-0002",
    },
  ];
