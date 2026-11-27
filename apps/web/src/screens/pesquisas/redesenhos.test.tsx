/**
 * T216 — redesenhos das telas de Pesquisas: cartões de indicadores (selo da
 * faixa na linha do valor, ícone no título, maior e menor média com a cor
 * da faixa, régua com as pontas), cartão do eNPS por pergunta (zona, pílula
 * de promotores e detratores, barra empilhada por grupo), comentários (a
 * pergunta embaixo do título) e rodapés dos cartões. Servidor simulado;
 * dados sintéticos.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RESULTADOS, servicoFalso } from "./dadosDeTeste";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";

function montarResultados(extra: Parameters<typeof servicoFalso>[0] = {}) {
  render(
    <ResultadosDaPesquisa
      servico={servicoFalso(extra)}
      pesquisaId="p-1"
      podeEditar
      onVoltar={vi.fn()}
      onEditar={vi.fn()}
    />,
  );
}

const indicador = async (titulo: string) => {
  const ind = await screen.findByRole("region", { name: "Indicadores" });
  return within(ind)
    .getByRole("heading", { name: titulo })
    .closest(".pesquisas__indicador") as HTMLElement;
};

describe("B6 — cartões de indicadores", () => {
  it("o selo da faixa fica na linha do valor e o título tem ícone", async () => {
    montarResultados();
    const media = await indicador("Média geral");
    const valor = media.querySelector(".pesquisas__indicador-valor")!;
    expect(valor).toHaveTextContent("8,5 /108 ou mais");
    const titulo = within(media).getByRole("heading", { name: "Média geral" });
    expect(
      titulo.parentElement!.querySelector(".pesquisas__indicador-icone svg"),
    ).not.toBeNull();
    const enps = await indicador("eNPS");
    expect(enps.querySelector(".pesquisas__indicador-valor")).toHaveTextContent(
      "50Zona de qualidade",
    );
  });

  it("maior e menor média com a cor da faixa; a régua com as pontas 1 e 10", async () => {
    montarResultados({
      resultadosDaPesquisa: vi.fn(() =>
        Promise.resolve({
          ...RESULTADOS,
          indicadores: {
            mediaGeral: 7.3,
            perguntasDeEscala: 2,
            maiorMedia: { perguntaId: "q-conc", media: 8.7 },
            menorMedia: { perguntaId: "q-conc", media: 6 },
            enps: null,
          },
        }),
      ),
    });
    const maior = await indicador("Maior média");
    const menor = await indicador("Menor média");
    const media = await indicador("Média geral");
    expect(
      maior.querySelector<HTMLElement>(".pesquisas__indicador-numero")!.dataset
        .faixa,
    ).toBe("alta");
    expect(
      menor.querySelector<HTMLElement>(".pesquisas__indicador-numero")!.dataset
        .faixa,
    ).toBe("baixa");
    // A média geral fica neutra: a faixa dela vai no selo.
    expect(
      media.querySelector<HTMLElement>(".pesquisas__indicador-numero")!.dataset
        .faixa,
    ).toBeUndefined();
    for (const cartao of [media, maior, menor]) {
      const pontas = cartao.querySelector(".pesquisas__regua-pontas");
      expect(pontas).toHaveTextContent("110");
      expect(pontas!.children).toHaveLength(2);
    }
  });
});

describe("B7 — cartão do eNPS por pergunta", () => {
  it("zona, pílula de promotores e detratores e a barra empilhada por grupo", async () => {
    montarResultados();
    const cartao = await screen.findByRole("region", {
      name: "1. Quanto você indicaria a empresa?",
    });
    const enps = within(cartao).getByRole("region", { name: "eNPS" });
    expect(enps.querySelector(".pesquisas__zona-texto")).toHaveTextContent(
      "Zona de qualidade",
    );
    expect(enps.querySelector(".pesquisas__pilula-cinza")).toHaveTextContent(
      "63% promotores · 13% detratores",
    );
    expect(
      within(enps).getByRole("img", {
        name: "Grupos do eNPS: Detratores 0–6 13%, Neutros 7–8 25%, Promotores 9–10 63%",
      }),
    ).toBeInTheDocument();
    // A legenda diz as faixas de nota de cada grupo (sem lista de barras).
    expect(enps).toHaveTextContent("Detratores 0–6");
    expect(enps).toHaveTextContent("Neutros 7–8");
    expect(enps).toHaveTextContent("Promotores 9–10");
    expect(enps.querySelector(".pesquisas__linhas")).toBeNull();
  });
});

describe("B8 — comentários e rodapés dos cartões", () => {
  it("a pergunta citada fica embaixo do título; o contador, à parte", async () => {
    montarResultados();
    const cartao = await screen.findByRole("region", {
      name: "5. Comentários",
    });
    const titulo = within(cartao).getByRole("heading", {
      name: "Comentários livres",
    });
    const textos = titulo.parentElement!;
    expect(textos.lastElementChild).toHaveTextContent("“Comentários”");
    expect(textos).not.toHaveTextContent("2 comentários");
    expect(cartao).toHaveTextContent("2 comentários");
  });

  it("o rodapé é a última faixa do cartão (com a divisória), na escala e no eNPS", async () => {
    montarResultados();
    const escala = await screen.findByRole("region", {
      name: "2. Tenho clareza das prioridades.",
    });
    const enps = screen.getByRole("region", {
      name: "1. Quanto você indicaria a empresa?",
    });
    for (const [cartao, texto] of [
      [escala, "Favorável = notas 4 e 5"],
      [enps, "eNPS = % de promotores − % de detratores"],
    ] as const) {
      const rodape = cartao.lastElementChild!;
      expect(rodape.tagName).toBe("FOOTER");
      expect(rodape).toHaveClass("pesquisas__cartao-pergunta-rodape");
      expect(rodape).toHaveTextContent(texto);
    }
    // A coluna da rosca é separada das barras.
    expect(
      escala.querySelector(
        ".pesquisas__cartao-pergunta-corpo > .pesquisas__cartao-pergunta-resumo",
      ),
    ).not.toBeNull();
  });
});
