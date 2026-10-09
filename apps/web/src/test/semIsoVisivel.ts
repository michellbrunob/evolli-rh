/**
 * Guarda de regressão da T154 — nenhuma data ISO visível ao usuário.
 *
 * ## Por que olha o DOM renderizado, e não o código-fonte
 *
 * Uma varredura de fonte por `\d{4}-\d{2}-\d{2}` acusaria tudo que é
 * legítimo: o `value` de `<input type="date">`, payloads, query strings,
 * `key` de React, ids e comparações de ordenação — todos **devem** continuar
 * em ISO, porque são contrato, não apresentação.
 *
 * O texto renderizado separa os dois casos sozinho: `textContent` contém o que
 * a pessoa lê e **não** contém o `value` de um campo de formulário nem nada
 * que viaje em atributo. A mesma asserção que pega "2026-01-05" numa célula de
 * tabela ignora `<input value="2026-01-05">` sem precisar de exceção escrita à
 * mão — e exceção escrita à mão é exatamente o que faz uma guarda envelhecer
 * até não guardar mais nada.
 */

/** `AAAA-MM-DD`, com fronteira para não casar dentro de um número maior. */
const ISO_DIA = /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g;

/** `AAAA-MM` isolado — competência crua. */
const ISO_MES = /(?<!\d)(?:19|20)\d{2}-(?:0[1-9]|1[0-2])(?![-\d])/g;

/** Marcas de instante ISO que nunca devem chegar à tela. */
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
  const texto = raiz.textContent ?? "";
  const achados: AchadoDeIso[] = [];

  const registrar = (trecho: string, indice: number) => {
    const de = Math.max(0, indice - 40);
    const ate = Math.min(texto.length, indice + trecho.length + 40);
    achados.push({
      trecho,
      contexto: `…${texto.slice(de, ate).replace(/\s+/g, " ")}…`,
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
 * Usada nos testes das telas que exibem data. A mensagem nomeia o trecho e o
 * contexto — sem isso, "encontrou ISO" manda quem corrige procurar no escuro.
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
