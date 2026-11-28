/**
 * T216 — o marcador `{empresa}` dos textos dos modelos: quem responde vê o
 * nome da empresa; no painel (gaveta, assistente, resultados) e sem nome,
 * "nossa empresa".
 */
const MARCADOR = /\{empresa\}/g;

export function textoComEmpresa(texto: string, empresa: string | null): string {
  const nome = empresa?.trim();
  return texto.replace(MARCADOR, nome ? nome : "nossa empresa");
}

export function textoParaOPainel(texto: string): string {
  return textoComEmpresa(texto, null);
}

interface SecaoComPerguntas {
  readonly perguntas: readonly {
    readonly texto: string;
    readonly descricao?: string | null;
  }[];
}

/** As seções com o marcador trocado no texto e na descrição das perguntas. */
export function secoesParaOPainel<S extends SecaoComPerguntas>(
  secoes: readonly S[],
): S[] {
  return secoes.map((s) => ({
    ...s,
    perguntas: s.perguntas.map((p) => ({
      ...p,
      texto: textoParaOPainel(p.texto),
      ...(typeof p.descricao === "string"
        ? { descricao: textoParaOPainel(p.descricao) }
        : {}),
    })),
  }));
}

/**
 * A pesquisa como o painel mostra (resultados, planilha e PDF): o marcador
 * trocado nas perguntas; a gravada fica intacta (editar usa a original).
 */
export function detalheParaOPainel<
  D extends { readonly secoes: readonly SecaoComPerguntas[] },
>(detalhe: D): D {
  return { ...detalhe, secoes: secoesParaOPainel(detalhe.secoes) };
}

/** As análises com o marcador trocado no rótulo das colunas. */
export function analisesParaOPainel<
  A extends { readonly colunas: readonly { readonly rotulo: string }[] },
>(analises: A): A {
  return {
    ...analises,
    colunas: analises.colunas.map((c) => ({
      ...c,
      rotulo: textoParaOPainel(c.rotulo),
    })),
  };
}
