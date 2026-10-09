/**
 * Guarda de regressão da T154 — nenhuma data ISO visível ao usuário.
 *
 * **Infraestrutura de teste.** Mora em `src/test/` junto do `setup.ts` e é
 * importada só por arquivos `*.test.tsx`. Não há caminho de `src/main.tsx`
 * até aqui, então nada disto entra no bundle de produção — e o próprio
 * `semIsoVisivel.test.ts` prova isso varrendo os imports do projeto.
 *
 * ## Por que olha o DOM renderizado, e não o código-fonte
 *
 * Uma varredura de fonte por `AAAA-MM-DD` acusaria tudo que é legítimo: o
 * `value` de `<input type="date">`, payloads, query strings, `key` de React,
 * ids e comparações de ordenação — todos **devem** continuar em ISO, porque
 * são contrato, não apresentação.
 *
 * O texto renderizado separa os dois casos sozinho: o que a pessoa lê não
 * inclui o `value` de um campo de formulário nem nada que viaje em atributo.
 * A mesma asserção que pega "2026-01-05" numa célula de tabela ignora
 * `<input value="2026-01-05">` sem precisar de exceção escrita à mão — e
 * exceção escrita à mão é exatamente o que faz uma guarda envelhecer até não
 * guardar mais nada.
 *
 * ## As duas armadilhas que o texto puro não resolve
 *
 * **1. Código técnico com data embutida.** `AP-2026-08-11-V001-C` é uma
 * referência de apuração, não uma data exibida — e a coluna ao lado mostra
 * `11/08/2026`, certinho. Uma fronteira que só recusa dígitos deixa o hífen
 * passar e reprova a tela inteira por causa do código. Por isso a fronteira
 * recusa **caractere de palavra OU hífen** dos dois lados: dentro de
 * `AP-…-V001-C` não há onde a data começar. Protocolo (`PROT-2026-10-0042`),
 * matrícula, UUID, CEP, telefone, CNPJ e semver caem na mesma proteção.
 *
 * **2. Concatenação entre células.** `textContent` cola tudo: duas células
 * vizinhas com "ano 2026" e "-10-08 itens" viram `ano 2026-10-08 itens`, e a
 * guarda acusaria uma data que ninguém vê. Mas uma data partida entre dois
 * `<span>` na MESMA linha — `<span>2026</span><span>-10-08</span>` — é
 * exibida como uma data e **tem** de ser pega.
 *
 * A diferença não está no texto, está no DOM: `<span>` é inline e `<td>` não.
 * Então o texto é montado percorrendo a árvore e inserindo um espaço nas
 * fronteiras dos elementos que quebram visualmente — nunca entre inline.
 */

/**
 * Elementos que NÃO quebram o fluxo visual: o texto deles cola no vizinho,
 * como o navegador faz. Todo o resto recebe espaço em volta.
 */
const INLINE = new Set([
  "A",
  "ABBR",
  "B",
  "BDI",
  "BDO",
  "CITE",
  "CODE",
  "DATA",
  "DFN",
  "EM",
  "I",
  "KBD",
  "MARK",
  "Q",
  "S",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TIME",
  "U",
  "VAR",
]);

/** Nunca são texto para o leitor, mas entram em `textContent`. */
const NAO_E_TEXTO = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/**
 * Texto como o usuário lê, com quebra nas fronteiras de bloco.
 *
 * É o que separa "data partida entre dois spans" (uma data de verdade) de
 * "duas células vizinhas" (nenhuma data). `textContent` não faz essa
 * distinção porque joga tudo num string só.
 */
export function textoVisivel(raiz: HTMLElement): string {
  const partes: string[] = [];

  const visitar = (no: Node): void => {
    if (no.nodeType === TEXT_NODE) {
      partes.push(no.nodeValue ?? "");
      return;
    }
    if (no.nodeType !== ELEMENT_NODE) return;

    const el = no as Element;
    if (NAO_E_TEXTO.has(el.tagName)) return;

    const quebra = !INLINE.has(el.tagName);
    if (quebra) partes.push(" ");
    for (const filho of Array.from(el.childNodes)) visitar(filho);
    if (quebra) partes.push(" ");
  };

  visitar(raiz);
  return partes.join("");
}

/**
 * `AAAA-MM-DD` com fronteira dura.
 *
 * As fronteiras são o coração da correção: recusam a data quando ela está
 * grudada em letra, dígito, sublinhado ou hífen — ou seja, quando faz parte
 * de um identificador. Pontuação comum (espaço, parêntese, dois-pontos,
 * vírgula, barra, aspas) não é caractere de palavra, então uma data cercada
 * de pontuação continua sendo detectada, que é o caso real de regressão.
 */
const ISO_DIA = /(?<![\w-])\d{4}-\d{2}-\d{2}(?![\w-])/g;

/** `AAAA-MM` isolado — competência crua. Mesma fronteira dura. */
const ISO_MES = /(?<![\w-])(?:19|20)\d{2}-(?:0[1-9]|1[0-2])(?![\w-])/g;

/**
 * Marcas de instante ISO que nunca devem chegar à tela.
 *
 * Deliberadamente SEM a fronteira dura: num instante completo
 * (`2026-01-05T00:00:00.000Z`) o `T` é caractere de palavra e bloquearia
 * `ISO_DIA`. São estas marcas que pegam o instante cru.
 */
const MARCAS_DE_INSTANTE = [/\d{2}:\d{2}:\d{2}/, /T\d{2}:\d{2}/, /\.\d{3}Z/];

export interface AchadoDeIso {
  trecho: string;
  contexto: string;
}

/**
 * Procura datas ISO no TEXTO VISÍVEL de um elemento.
 *
 * Devolve a lista de achados com um recorte do contexto, para que a falha do
 * teste diga onde está o problema em vez de só dizer que existe.
 */
export function acharIsoVisivel(raiz: HTMLElement): AchadoDeIso[] {
  const texto = textoVisivel(raiz);
  const achados: AchadoDeIso[] = [];

  const registrar = (trecho: string, indice: number) => {
    const de = Math.max(0, indice - 40);
    const ate = Math.min(texto.length, indice + trecho.length + 40);
    achados.push({
      trecho,
      contexto: `…${texto.slice(de, ate).replace(/\s+/g, " ").trim()}…`,
    });
  };

  for (const padrao of [ISO_DIA, ISO_MES]) {
    padrao.lastIndex = 0;
    let casado: RegExpExecArray | null;
    while ((casado = padrao.exec(texto)) !== null) {
      registrar(casado[0], casado.index);
    }
  }

  for (const marca of MARCAS_DE_INSTANTE) {
    const casado = marca.exec(texto);
    if (casado) registrar(casado[0], casado.index);
  }

  return achados;
}

/**
 * Falha se houver data ISO no texto visível.
 *
 * Usada nos testes de todas as superfícies que exibem data. A mensagem nomeia
 * o trecho e o contexto — sem isso, "encontrou ISO" manda quem corrige
 * procurar no escuro.
 */
export function expectSemIsoVisivel(raiz: HTMLElement): void {
  const achados = acharIsoVisivel(raiz);
  if (achados.length === 0) return;
  const detalhe = achados
    .map((a) => `  • "${a.trecho}" em ${a.contexto}`)
    .join("\n");
  throw new Error(
    `Data ISO visível ao usuário (${achados.length}). A tela deve usar ` +
      `formatarDiaCivil / formatarMesReferencia / formatarInstante:\n${detalhe}`,
  );
}
