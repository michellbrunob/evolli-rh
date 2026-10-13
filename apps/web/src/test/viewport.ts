/**
 * `window.matchMedia` para o jsdom (T159 — correção R1).
 *
 * ## Por que existe
 *
 * O jsdom não implementa `matchMedia`. Sem ele, o shell não teria como saber
 * se está no modo gaveta, e o cenário que a R1 descreve — abrir a gaveta no
 * mobile e **atravessar o breakpoint** para o desktop — seria intestável:
 * exatamente o cenário em que o defeito aparecia.
 *
 * Não é uma implementação de CSS. Reconhece `(max-width: Npx)` e
 * `(min-width: Npx)`, que é o que o produto usa, e ignora o resto — uma
 * consulta não reconhecida responde `false`, nunca um palpite.
 *
 * ## Contrato
 *
 * `definirLarguraDaJanela` é a ÚNICA forma de mudar a largura: ela atualiza
 * `window.innerWidth`, reavalia cada consulta viva e dispara `change` apenas
 * nas que de fato mudaram de resultado — como o navegador faz. Quem a chama
 * dentro de um teste de React precisa envolvê-la em `act()`, porque ela
 * provoca atualização de estado.
 */

type Ouvinte = (evento: MediaQueryListEvent) => void;

interface ConsultaViva {
  readonly media: string;
  readonly ouvintes: Set<Ouvinte>;
  ultimo: boolean;
}

/** Largura padrão do jsdom; mantida para que todo teste comece no desktop. */
export const LARGURA_PADRAO = 1024;

const vivas: ConsultaViva[] = [];
let larguraAtual = LARGURA_PADRAO;

function corresponde(media: string): boolean {
  const max = /\(\s*max-width:\s*(\d+)px\s*\)/.exec(media);
  if (max) return larguraAtual <= Number(max[1]);
  const min = /\(\s*min-width:\s*(\d+)px\s*\)/.exec(media);
  if (min) return larguraAtual >= Number(min[1]);
  return false;
}

export function instalarMatchMedia(): void {
  window.matchMedia = ((media: string) => {
    const viva: ConsultaViva = {
      media,
      ouvintes: new Set(),
      ultimo: corresponde(media),
    };
    vivas.push(viva);
    return {
      get matches() {
        return corresponde(media);
      },
      media,
      onchange: null,
      addEventListener: (_tipo: string, ouvinte: Ouvinte) => {
        viva.ouvintes.add(ouvinte);
      },
      removeEventListener: (_tipo: string, ouvinte: Ouvinte) => {
        viva.ouvintes.delete(ouvinte);
      },
      addListener: (ouvinte: Ouvinte) => {
        viva.ouvintes.add(ouvinte);
      },
      removeListener: (ouvinte: Ouvinte) => {
        viva.ouvintes.delete(ouvinte);
      },
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

export interface OpcoesDeLargura {
  /**
   * Não dispara `change`, só muda `matches`. Reproduz o ambiente de viewport
   * emulado em que isso foi medido (o painel de prévia do projeto): ali o
   * único sinal que chega é `resize`.
   */
  readonly silencioso?: boolean;
}

export function definirLarguraDaJanela(
  px: number,
  opcoes: OpcoesDeLargura = {},
): void {
  larguraAtual = px;
  Object.defineProperty(window, "innerWidth", {
    value: px,
    configurable: true,
    writable: true,
  });

  for (const viva of vivas) {
    const agora = corresponde(viva.media);
    if (agora === viva.ultimo) continue;
    viva.ultimo = agora;
    if (opcoes.silencioso) continue;
    for (const ouvinte of [...viva.ouvintes]) {
      ouvinte({ matches: agora, media: viva.media } as MediaQueryListEvent);
    }
  }
}

export function redefinirLarguraDaJanela(): void {
  definirLarguraDaJanela(LARGURA_PADRAO);
}
