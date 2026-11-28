import type {
  AccessRole,
  CategoriaDocumentoColaborador,
  EstadoVerificacaoDocumento,
  FormatoDocumentoColaborador,
} from "@prisma/client";

/** T217 — quem enviou a versão atual: nome de exibição (ou nulo) e papel. */
export interface EnviadoPorDto {
  readonly nome: string | null;
  readonly papel: AccessRole;
}

export interface DocumentoColaboradorDto {
  readonly id: string;
  readonly categoria: CategoriaDocumentoColaborador;
  /** Só em "outros", e nunca para o `master_tecnico`. */
  readonly nome: string | null;
  /** T217 — nome original do arquivo da versão atual (nunca ao `master_tecnico`). */
  readonly nomeArquivo: string | null;
  /** T217 — autor da versão atual (visível a quem lê a lista). */
  readonly enviadoPor: EnviadoPorDto | null;
  readonly estado: EstadoVerificacaoDocumento;
  readonly formato: FormatoDocumentoColaborador;
  readonly tamanhoBytes: number;
  readonly versao: number;
  readonly enviadoEm: string;
  readonly verificadoEm: string | null;
}

/** Seleção do autor da versão (só o necessário para "Enviado por"). */
export const AUTOR_DA_VERSAO = {
  select: { nomeExibicao: true, role: true },
} as const;

/**
 * T217 — o documento como a API devolve. O nome livre de "outros" e o nome
 * original do arquivo podem conter dado pessoal: ficam fora quando
 * `mostrarNomes` é falso (o `master_tecnico`). Quem enviou aparece para todos
 * que leem a lista.
 */
export function projetarDocumento(
  documento: {
    readonly id: string;
    readonly categoria: CategoriaDocumentoColaborador;
    readonly nomeOutros: string | null;
  },
  versao: {
    readonly estado: EstadoVerificacaoDocumento;
    readonly formato: FormatoDocumentoColaborador;
    readonly tamanhoBytes: number;
    readonly numero: number;
    readonly criadoEm: Date;
    readonly verificadoEm: Date | null;
    readonly nomeOriginal?: string | null;
    readonly enviadaPor?: {
      readonly nomeExibicao: string | null;
      readonly role: AccessRole;
    } | null;
  },
  opcoes: { readonly mostrarNomes: boolean },
): DocumentoColaboradorDto {
  return {
    id: documento.id,
    categoria: documento.categoria,
    nome: opcoes.mostrarNomes ? documento.nomeOutros : null,
    nomeArquivo: opcoes.mostrarNomes ? (versao.nomeOriginal ?? null) : null,
    enviadoPor: versao.enviadaPor
      ? { nome: versao.enviadaPor.nomeExibicao, papel: versao.enviadaPor.role }
      : null,
    estado: versao.estado,
    formato: versao.formato,
    tamanhoBytes: versao.tamanhoBytes,
    versao: versao.numero,
    enviadoEm: versao.criadoEm.toISOString(),
    verificadoEm: versao.verificadoEm?.toISOString() ?? null,
  };
}
