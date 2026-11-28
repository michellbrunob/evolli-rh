import type {
  CategoriaDocumentoColaborador,
  EnviadoPorDocumentoApi,
  EstadoDocumentoColaborador,
  FormatoDocumentoColaborador,
} from "../../../api/colaboradoresClient";
export { tipoDoArquivo } from "../../../api/colaboradoresClient";
import { ROTULO_PAPEL } from "../../../api/usersClient";
import { formatarInstante } from "../../../format/data";
import { plural } from "../../../format/plural";

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

/**
 * T215 — quantas categorias principais já têm arquivo ("N de 5 enviados",
 * como a referência). Reprovado não conta; "outros" fica fora.
 */
export function principaisEnviados(
  documentos: readonly {
    readonly categoria: CategoriaDocumentoColaborador;
    readonly estado: EstadoDocumentoColaborador;
  }[],
): number {
  const comArquivo = new Set(
    documentos.filter((d) => d.estado !== "reprovado").map((d) => d.categoria),
  );
  return CATEGORIAS_PRINCIPAIS.filter((c) => comArquivo.has(c)).length;
}

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

const TIPO_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** O que o campo de arquivo oferece (T217: também DOC, DOCX e WebP). */
export const ACEITA_NO_CAMPO = [
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  "application/pdf",
  "application/msword",
  TIPO_DOCX,
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",");

const FORMATOS: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: TIPO_DOCX,
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const extensaoDe = (nome: string) => {
  const ponto = nome.lastIndexOf(".");
  return ponto === -1 ? "" : nome.slice(ponto + 1).toLowerCase();
};

/** T217 — PDF e imagens abrem numa aba nova; DOC e DOCX só são baixados. */
export function podeVerNoNavegador(
  formato: FormatoDocumentoColaborador,
): boolean {
  return formato !== "doc" && formato !== "docx";
}

/** Erro de orientação do arquivo escolhido, ou `null` se pode seguir. */
export function conferirArquivoEscolhido(arquivo: File): string | null {
  const esperado = FORMATOS[extensaoDe(arquivo.name)];
  if (!esperado || (arquivo.type !== "" && arquivo.type !== esperado)) {
    return FORMATOS_ACEITOS;
  }
  if (arquivo.size === 0) return "O arquivo está vazio.";
  if (arquivo.size > LIMITE_DO_ARQUIVO_BYTES) {
    return `Este arquivo tem ${tamanhoLegivel(arquivo.size)} e o limite é 10 MB. Diminua o tamanho ou converta para PDF antes de enviar.`;
  }
  return null;
}

/** T217 — a orientação de formato, a mesma do navegador e do servidor. */
export const FORMATOS_ACEITOS =
  "Envie o arquivo em PDF, DOC, DOCX, JPG, PNG ou WebP.";

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

/** T217 — "Nome (Papel)"; sem nome de exibição, só o papel; sem autor, "—". */
export function quemEnviou(
  enviadoPor: EnviadoPorDocumentoApi | null | undefined,
): string {
  if (!enviadoPor) return "—";
  const papel = ROTULO_PAPEL[enviadoPor.papel] ?? enviadoPor.papel;
  return enviadoPor.nome ? `${enviadoPor.nome} (${papel})` : papel;
}

/** T217 — do envio mais recente para o mais antigo (empate: ordem recebida). */
export function ordenarPorEnvio<T extends { readonly enviadoEm: string }>(
  documentos: readonly T[],
): T[] {
  return documentos
    .map((documento, posicao) => ({ documento, posicao }))
    .sort(
      (a, b) =>
        Date.parse(b.documento.enviadoEm) - Date.parse(a.documento.enviadoEm) ||
        a.posicao - b.posicao,
    )
    .map(({ documento }) => documento);
}

/** T217 — o dia de um instante no fuso de negócio ("dd/mm/aaaa"). */
export const diaDoEnvio = (iso: string) =>
  formatarInstante(iso).split(" às ")[0] ?? "";

/**
 * T217 — a linha de resumo da aba: "N arquivos · último envio em
 * dd/mm/aaaa" (plural pela quantidade); sem arquivos, uma frase curta.
 */
export function resumoDosDocumentos(
  documentos: readonly { readonly enviadoEm: string }[],
): string {
  const [ultimo] = ordenarPorEnvio(documentos);
  if (!ultimo) return "Nada enviado ainda";
  return `${plural(documentos.length, "arquivo", "arquivos")} · último envio em ${diaDoEnvio(ultimo.enviadoEm)}`;
}
