/**
 * T210 — Configurações › Aparência: os quatro temas fechados e a aplicação no
 * `<html>` (`data-theme`). A preferência é da CONTA, gravada no servidor
 * (`PATCH /v1/users/me/aparencia`) e lida de `GET /v1/users/me`; nada fica
 * no navegador. O padrão (Azul Institucional) é o `:root` sem atributo.
 */

export type TemaDeAparencia =
  "azul_institucional" | "evolli_claro" | "verde_petroleo" | "alto_contraste";

export interface DescricaoDoTema {
  readonly codigo: TemaDeAparencia;
  readonly nome: string;
  readonly descricao: string;
  /** Amostra do cartão: ação, superfície e texto do tema. */
  readonly amostra: {
    readonly acao: string;
    readonly fundo: string;
    readonly superficie: string;
    readonly texto: string;
  };
}

export const TEMA_PADRAO: TemaDeAparencia = "azul_institucional";

/**
 * As cores da amostra são as da paleta do tema (decisão da T210), só para o
 * desenho do cartão; a tela inteira continua nos tokens.
 */
export const TEMAS: readonly DescricaoDoTema[] = [
  {
    codigo: "azul_institucional",
    nome: "Azul Institucional",
    descricao: "O visual padrão do Evolli, em azul.",
    amostra: {
      acao: "var(--amostra-azul-acao)",
      fundo: "var(--amostra-azul-fundo)",
      superficie: "var(--amostra-azul-superficie)",
      texto: "var(--amostra-azul-texto)",
    },
  },
  {
    codigo: "evolli_claro",
    nome: "Evolli Claro",
    descricao: "Tons de magenta sobre fundos claros e quentes.",
    amostra: {
      acao: "var(--amostra-claro-acao)",
      fundo: "var(--amostra-claro-fundo)",
      superficie: "var(--amostra-claro-superficie)",
      texto: "var(--amostra-claro-texto)",
    },
  },
  {
    codigo: "verde_petroleo",
    nome: "Verde Petróleo",
    descricao: "Verde-azulado sóbrio, com fundos levemente frios.",
    amostra: {
      acao: "var(--amostra-verde-acao)",
      fundo: "var(--amostra-verde-fundo)",
      superficie: "var(--amostra-verde-superficie)",
      texto: "var(--amostra-verde-texto)",
    },
  },
  {
    codigo: "alto_contraste",
    nome: "Alto Contraste",
    descricao: "Texto preto, bordas fortes e o máximo de legibilidade.",
    amostra: {
      acao: "var(--amostra-contraste-acao)",
      fundo: "var(--amostra-contraste-fundo)",
      superficie: "var(--amostra-contraste-superficie)",
      texto: "var(--amostra-contraste-texto)",
    },
  },
];

const CODIGOS = new Set<string>(TEMAS.map((t) => t.codigo));

/** O tema da conta; ausente ou desconhecido vira o padrão. */
export function temaDaConta(valor: unknown): TemaDeAparencia {
  return typeof valor === "string" && CODIGOS.has(valor)
    ? (valor as TemaDeAparencia)
    : TEMA_PADRAO;
}

/** Aplica no `<html>`: o padrão tira o atributo; os demais o põem. */
export function aplicarTema(valor: unknown): void {
  const tema = temaDaConta(valor);
  const raiz = document.documentElement;
  if (tema === TEMA_PADRAO) raiz.removeAttribute("data-theme");
  else raiz.setAttribute("data-theme", tema);
}

export function nomeDoTema(valor: unknown): string {
  const tema = temaDaConta(valor);
  return TEMAS.find((t) => t.codigo === tema)!.nome;
}
