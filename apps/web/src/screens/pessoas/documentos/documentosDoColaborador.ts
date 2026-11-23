import type {
  CategoriaDocumentoColaborador,
  EstadoDocumentoColaborador,
} from "../../../api/colaboradoresClient";

/**
 * T213 — documentos do colaborador (ADR 0021): o que a tela sabe antes de
 * falar com o servidor. A conferência real (extensão, tipo e conteúdo) é do
 * servidor; aqui só a orientação imediata, para não enviar o que será
 * recusado. Nenhum documento é obrigatório.
 */

export const CATEGORIAS_PRINCIPAIS: readonly CategoriaDocumentoColaborador[] = [
  "rg",
  "cpf",
  "comprovante_endereco",
  "carteira_trabalho",
  "certidoes",
];

export const ROTULO_DA_CATEGORIA: Readonly<
  Record<CategoriaDocumentoColaborador, string>
> = {
  rg: "RG",
  cpf: "CPF",
  comprovante_endereco: "Comprovante de endereço",
  carteira_trabalho: "Carteira de Trabalho",
  certidoes: "Certidões",
  outros: "Outros",
};

/** O nome mostrado: o dado em "outros", ou o rótulo da categoria. */
export function rotuloDoDocumento(
  categoria: CategoriaDocumentoColaborador,
  nome: string | null | undefined,
): string {
  return categoria === "outros" && nome ? nome : ROTULO_DA_CATEGORIA[categoria];
}

/** Os estados que a tela mostra — sempre com texto e ícone. */
export type EstadoNaTela =
  "pendente" | "em_verificacao" | "aprovado" | "reprovado" | "nao_enviado";

export const ESTADOS_DO_DOCUMENTO: readonly {
  readonly estado: EstadoNaTela;
  readonly rotulo: string;
}[] = [
  { estado: "pendente", rotulo: "Pendente" },
  { estado: "em_verificacao", rotulo: "Em verificação" },
  { estado: "aprovado", rotulo: "Aprovado" },
  { estado: "reprovado", rotulo: "Reprovado" },
  { estado: "nao_enviado", rotulo: "Não enviado" },
];

export const ROTULO_DO_ESTADO: Readonly<Record<EstadoNaTela, string>> =
  Object.fromEntries(
    ESTADOS_DO_DOCUMENTO.map(({ estado, rotulo }) => [estado, rotulo]),
  ) as Record<EstadoNaTela, string>;

export function estadoDaApi(estado: EstadoDocumentoColaborador): EstadoNaTela {
  return estado;
}

export const LIMITE_DO_ARQUIVO_BYTES = 10 * 1024 * 1024;
/** Até 5 por categoria: em "outros", até 5 linhas. */
export const LIMITE_DE_OUTROS = 5;
export const NOME_DE_OUTROS_MAXIMO = 60;

/** O que o campo de arquivo oferece. */
export const ACEITA_NO_CAMPO =
  ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const FORMATOS: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** Erro de orientação do arquivo escolhido, ou `null` se pode seguir. */
export function conferirArquivoEscolhido(arquivo: File): string | null {
  const ponto = arquivo.name.lastIndexOf(".");
  const extensao =
    ponto === -1 ? "" : arquivo.name.slice(ponto + 1).toLowerCase();
  const esperado = FORMATOS[extensao];
  if (!esperado || (arquivo.type !== "" && arquivo.type !== esperado)) {
    return "Use um arquivo PDF, JPG ou PNG.";
  }
  if (arquivo.size === 0) return "O arquivo está vazio.";
  if (arquivo.size > LIMITE_DO_ARQUIVO_BYTES) {
    return "O arquivo passa de 10 MB.";
  }
  return null;
}

/** Erro do nome de um "outro documento", ou `null`. */
export function conferirNomeDeOutros(
  nome: string,
  existentes: readonly string[],
): string | null {
  const limpo = nome.trim();
  if (limpo === "") return "Dê um nome ao documento.";
  if ([...limpo].length > NOME_DE_OUTROS_MAXIMO) {
    return `Use até ${NOME_DE_OUTROS_MAXIMO} caracteres.`;
  }
  const igual = (a: string) => a.trim().toLocaleLowerCase("pt-BR");
  if (existentes.some((e) => igual(e) === igual(limpo))) {
    return "Já existe um documento com esse nome.";
  }
  if (existentes.length >= LIMITE_DE_OUTROS) {
    return `Até ${LIMITE_DE_OUTROS} outros documentos por vez.`;
  }
  return null;
}

/** Tamanho legível ("120 KB", "2,4 MB"). */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  // Uma casa decimal, vírgula como separador e sem ",0" à toa.
  const mb = (Math.round((bytes / (1024 * 1024)) * 10) / 10).toFixed(1);
  return `${mb.replace(/\.0$/, "").replace(".", ",")} MB`;
}

/** Chave de idempotência de um envio (uma por arquivo escolhido). */
export function novaChaveDeEnvio(): string {
  return crypto.randomUUID();
}
