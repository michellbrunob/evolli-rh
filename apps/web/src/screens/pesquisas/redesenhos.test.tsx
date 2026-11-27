/**
 * T216 — redesenhos das telas de Pesquisas: cartões de indicadores (selo da
 * faixa na linha do valor, ícone no título, maior e menor média com a cor
 * da faixa, régua com as pontas), cartão do eNPS por pergunta (zona, pílula
 * de promotores e detratores, barra empilhada por grupo), comentários (a
 * pergunta embaixo do título) e rodapés dos cartões. Servidor simulado;
 * dados sintéticos.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CampoGrupo } from "../../api/pesquisasClient";
import { GRUPOS, RESULTADOS, servicoFalso } from "./dadosDeTeste";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";
import { SepararRespostasPor } from "./SepararRespostasPor";

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

describe("B9 — Separar respostas por", () => {
  function montarSeparar(
    separarPor: CampoGrupo[],
    travado = false,
    grupos = GRUPOS,
  ) {
    const onMudar = vi.fn();
    render(
      <SepararRespostasPor
        servico={servicoFalso({
          listarGrupos: vi.fn(() => Promise.resolve(grupos)),
        })}
        separarPor={separarPor}
        travado={travado}
        motivoDoTravamento="A pesquisa já tem respostas: os campos não mudam mais."
        onMudar={onMudar}
      />,
    );
    return onMudar;
  }

  it("lista vertical: cada campo com as opções resumidas e o interruptor à direita", async () => {
    const onMudar = montarSeparar([], false, {
      ...GRUPOS,
      unidade: [
        { id: "u-1", nome: "Matriz" },
        { id: "u-2", nome: "Filial Sul" },
        { id: "u-3", nome: "Filial Norte" },
        { id: "u-4", nome: "Loja Centro" },
      ],
    });
    const lista = screen.getByRole("list", { name: "Separar respostas por" });
    const itens = within(lista).getAllByRole("listitem");
    expect(itens).toHaveLength(3);
    expect(
      await within(itens[2]!).findByText(
        "4 opções: Matriz, Filial Sul, Filial Norte…",
      ),
    ).toBeInTheDocument();
    const interruptor = within(itens[0]!).getByRole("switch", {
      name: "Departamento",
    });
    expect(interruptor).toHaveAttribute("aria-checked", "false");
    // O interruptor vem depois dos textos (fica à direita).
    expect(
      interruptor.closest(".pesquisas__separar-cabeca")!.lastElementChild,
    ).toBe(interruptor);
    fireEvent.click(interruptor);
    expect(onMudar).toHaveBeenCalledWith(["departamento"]);
    expect(
      screen.getByRole("region", { name: "Separar respostas por" }),
    ).toBeInTheDocument();
  });

  it("ligado: as opções dentro do cartão e o '+ Adicionar' na mesma linha", async () => {
    montarSeparar(["departamento"]);
    const opcoes = await screen.findByRole("list", {
      name: "Opções de departamento",
    });
    const item = opcoes.closest("li")!;
    expect(item).toHaveTextContent("Opções que aparecem para quem responde");
    const adicionar = within(item).getByRole("button", {
      name: "Adicionar departamento",
    });
    expect(adicionar.parentElement).toBe(opcoes.parentElement);
  });

  it("travado na edição: o campo ligado não parece ativo nem oferece adicionar", async () => {
    montarSeparar(["departamento"], true);
    const lista = screen.getByRole("list", { name: "Separar respostas por" });
    const ligado = within(lista).getByRole("switch", { name: "Departamento" });
    expect(ligado).toBeDisabled();
    expect(ligado).toHaveAttribute("aria-checked", "true");
    expect(ligado.closest("li")).toHaveAttribute("data-travado");
    expect(
      await screen.findByRole("list", { name: "Opções de departamento" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adicionar departamento" }),
    ).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(
      "A pesquisa já tem respostas: os campos não mudam mais.",
    );
  });
});
