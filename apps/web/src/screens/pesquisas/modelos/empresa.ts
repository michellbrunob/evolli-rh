/**
 * T216 — o marcador `{empresa}` dos textos dos modelos: quem responde vê o
 * nome da empresa; no painel (sobre o modelo, gaveta, assistente, resultados,
 * resultado individual, planilha e PDF), o nome da empresa ativa quando o
 * módulo o conhece e, sem nome, "nossa empresa". O texto gravado na pesquisa
 * continua com o marcador: o nome só entra na hora de mostrar.
 */
import { useEffect } from "react";

const MARCADOR = /\{empresa\}/g;

/** O nome da empresa ativa que o módulo de Pesquisas recebeu do shell. */
let empresaDoPainel: string | null = null;

/** O módulo informa o nome da empresa ativa (ou `null` para esquecer). */
export function definirEmpresaDoPainel(nome: string | null): void {
  empresaDoPainel = nome?.trim() || null;
}

/**
 * O módulo de Pesquisas guarda o nome da empresa ativa enquanto está na
 * tela: definido já no desenho (antes das telas de dentro), esquecido ao
 * sair.
 */
export function useEmpresaDoPainel(nome: string | null | undefined): void {
  definirEmpresaDoPainel(nome ?? null);
  useEffect(() => () => definirEmpresaDoPainel(null), []);
}

export function textoComEmpresa(texto: string, empresa: string | null): string {
  const nome = empresa?.trim();
  return texto.replace(MARCADOR, nome ? nome : "nossa empresa");
}

/** No painel: o nome dado, o da empresa ativa ou "nossa empresa". */
export function textoParaOPainel(
  texto: string,
  empresa: string | null = null,
): string {
  return textoComEmpresa(texto, empresa?.trim() || empresaDoPainel);
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
  empresa: string | null = null,
): S[] {
  return secoes.map((s) => ({
    ...s,
    perguntas: s.perguntas.map((p) => ({
      ...p,
      texto: textoParaOPainel(p.texto, empresa),
      ...(typeof p.descricao === "string"
        ? { descricao: textoParaOPainel(p.descricao, empresa) }
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
>(detalhe: D, empresa: string | null = null): D {
  return { ...detalhe, secoes: secoesParaOPainel(detalhe.secoes, empresa) };
}

/** As análises com o marcador trocado no rótulo das colunas. */
export function analisesParaOPainel<
  A extends { readonly colunas: readonly { readonly rotulo: string }[] },
>(analises: A, empresa: string | null = null): A {
  return {
    ...analises,
    colunas: analises.colunas.map((c) => ({
      ...c,
      rotulo: textoParaOPainel(c.rotulo, empresa),
    })),
  };
}
