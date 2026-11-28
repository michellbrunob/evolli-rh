/**
 * T216 — telas dos modelos com cálculo próprio: Pulso e Clima (cartões,
 * dimensões em ordem, eNPS/LNPS e comentários por dimensão), TAD (time e
 * pessoa; o Clima tem os testes em `clima/Clima.test.tsx`), as perguntas
 * de metodologia fixa no assistente e o título do assistente.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  DimensaoDoModelo,
  PesquisaDetalhe,
  RecomendacaoDoModelo,
  ResultadoPulsoClima,
  ResultadoTad,
  ResultadosPesquisa,
} from "../../../api/pesquisasClient";
import { tituloDoAssistente } from "../AssistenteDoModelo";
import { DETALHE, RESULTADOS } from "../dadosDeTeste";
import { estadoDoModelo, perguntasEmOrdem } from "../estadoDaPesquisa";
import { modeloDaGaleria } from "../modelosDePesquisa";
import { PerguntasFixas } from "./PerguntasFixas";
import { resultadoIndividualDoModelo, visaoGeralDoModelo } from "./resultados";
import { textoComEmpresa } from "./empresa";
import { abasDoModelo } from "./exportacao";

function detalheDo(id: string): PesquisaDetalhe {
  return {
    ...DETALHE,
    modelo: id as PesquisaDetalhe["modelo"],
    secoes: [...estadoDoModelo(id).secoes],
  };
}

const nps = (
  perguntaId: string | null,
  indice: number | null,
  faixa: RecomendacaoDoModelo["faixa"],
): RecomendacaoDoModelo => ({
  perguntaId,
  respostas: 3,
  promotores: 2,
  neutros: 0,
  detratores: 1,
  indice,
  faixa,
  distribuicao: Array.from({ length: 11 }, (_, valor) => ({
    valor,
    quantidade: valor === 10 ? 2 : valor === 3 ? 1 : 0,
  })),
});

const dim = (
  chave: string,
  rotulo: string,
  score: number,
  faixa: DimensaoDoModelo["faixa"],
  extra: Partial<DimensaoDoModelo> = {},
): DimensaoDoModelo => ({
  chave,
  rotulo,
  afirmacoes: 3,
  respostas: 9,
  score,
  faixa,
  favoravel: 60,
  neutro: 10,
  desfavoravel: 30,
  comentarios: 0,
  ...extra,
});

describe("T216 — Pulso e Clima: visão geral", () => {
  const detalhe = detalheDo("pulso_clima");
  const todas = perguntasEmOrdem(detalhe.secoes);
  const id = (chave: string) => todas.find((p) => p.chave === chave)!.id;
  const r: ResultadoPulsoClima = {
    modelo: "pulso_clima",
    score: 65,
    faixa: "atencao",
    favoravel: 65,
    neutro: 0,
    desfavoravel: 35,
    dimensoes: [
      dim("alinhamento_estrategia", "Alinhamento e Estratégia", 67, "atencao"),
      dim("lideranca", "Liderança", 88, "forte", {
        afirmacoes: 4,
        comentarios: 1,
      }),
      dim("condicoes", "Condições de Trabalho", 40, "critico", {
        afirmacoes: 2,
      }),
    ],
    afirmacoes: [
      {
        chave: "pc_lid_01",
        perguntaId: id("pc_lid_01"),
        dimensao: "lideranca",
        subdimensao: null,
        respostas: 3,
        media: 4.5,
        score: 88,
        favoravel: 100,
        neutro: 0,
        desfavoravel: 0,
      },
    ],
    enps: nps(id("pc_enps_01"), 33, "bom"),
    lnps: nps(id("pc_lnps_01"), -10, "critico"),
    comentarios: [
      {
        dimensao: "lideranca",
        perguntaId: id("__comentario_lideranca__"),
        quantidade: 1,
      },
      {
        dimensao: "enps",
        perguntaId: id("__comentario_enps__"),
        quantidade: 1,
      },
    ],
  };
  const geral: ResultadosPesquisa = {
    ...RESULTADOS,
    perguntas: [
      {
        perguntaId: id("__comentario_lideranca__"),
        tipo: "paragrafo",
        respondidas: 1,
        viram: 3,
        textos: [{ texto: "Gestor presente", autor: null }],
      },
      {
        perguntaId: id("__comentario_enps__"),
        tipo: "paragrafo",
        respondidas: 1,
        viram: 3,
        textos: [{ texto: "Bom lugar", autor: null }],
      },
    ],
    modelo: r,
  };

  it("cartões: score geral com faixa, eNPS, LNPS e a dimensão mais crítica", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    const ind = screen.getByRole("region", { name: "Indicadores" });
    expect(ind).toHaveTextContent("Score geral65/100Atenção");
    expect(ind).toHaveTextContent("Média das 22 afirmações.");
    expect(ind).toHaveTextContent("eNPS · empresa+33Bom");
    expect(ind).toHaveTextContent("67% promotores · 33% detratores");
    expect(ind).toHaveTextContent("LNPS · liderança direta−10Crítico");
    expect(ind).toHaveTextContent(
      "Dimensão mais crítica40/100CríticoCondições de Trabalho",
    );
    expect(
      screen.getByRole("img", { name: "Score geral: 65 de 100" }),
    ).toBeInTheDocument();
  });

  it("dimensões da mais baixa para a mais alta, com afirmações, faixa e favorável", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    const lista = screen.getByRole("list", { name: "Dimensões" });
    const itens = within(lista).getAllByRole("listitem");
    expect(itens.map((li) => li.querySelector("strong")!.textContent)).toEqual([
      "Condições de Trabalho",
      "Alinhamento e Estratégia",
      "Liderança",
    ]);
    expect(itens[2]).toHaveTextContent("4 afirmações · Forte");
    expect(
      within(itens[0]!).getByRole("img", {
        name: "Condições de Trabalho: 30% desfavorável, 10% neutro, 60% favorável",
      }),
    ).toBeInTheDocument();
  });

  it("blocos do eNPS e do LNPS: enunciado, distribuição e grupos", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    const enps = screen
      .getAllByRole("region", { name: "eNPS · empresa" })
      .at(-1)!;
    expect(enps).toHaveTextContent("nossa empresa");
    expect(enps).toHaveTextContent("Promotoresnotas 9–102 pessoas · 67%");
    expect(enps).toHaveTextContent("Detratoresnotas 0–61 pessoa · 33%");
    expect(
      within(enps).getByRole("img", {
        name: "eNPS · empresa: 33, de −100 a 100",
      }),
    ).toBeInTheDocument();
  });

  it("detalhe por pergunta e comentários filtrados por dimensão", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    expect(
      screen.getByText("1 comentário sobre esta dimensão"),
    ).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: "Comentários" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^Liderança/ }));
    expect(
      within(screen.getByRole("list", { name: "Comentários" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
    expect(screen.getByText("“Gestor presente”")).toBeInTheDocument();
    expect(screen.queryByText("“Bom lugar”")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^eNPS · empresa/ }));
    expect(screen.getByText("“Bom lugar”")).toBeInTheDocument();
  });

  it("sem resultado do modelo, a visão por pergunta continua", () => {
    expect(visaoGeralDoModelo(detalhe, { ...geral, modelo: null })).toBeNull();
    expect(visaoGeralDoModelo(detalhe, RESULTADOS)).toBeNull();
  });
});

describe("T216 — Motivação (TAD)", () => {
  const pilares = [
    {
      chave: "autonomia",
      rotulo: "Autonomia",
      perguntas: 7,
      score: 5.14,
      nivel: "moderado" as const,
    },
    {
      chave: "competencia",
      rotulo: "Competência",
      perguntas: 6,
      score: 5.5,
      nivel: "alto" as const,
    },
    {
      chave: "relacionamento",
      rotulo: "Relacionamento",
      perguntas: 8,
      score: 3.2,
      nivel: "baixo" as const,
    },
  ];
  const r: ResultadoTad = {
    modelo: "tad",
    respondentes: 3,
    geral: 5.13,
    nivel: "moderado",
    pilares,
    niveis: { alto: 1, moderado: 2, baixo: 0 },
  };

  it("time: score geral com nível, pilares, radar e pessoas por nível", () => {
    render(
      <>{visaoGeralDoModelo(detalheDo("tad"), { ...RESULTADOS, modelo: r })}</>,
    );
    const geral = screen.getByRole("region", {
      name: "Score geral de motivação",
    });
    expect(geral).toHaveTextContent("5,13/ 7Moderado");
    expect(geral).toHaveTextContent("Satisfação parcial");
    expect(
      screen.getByRole("region", { name: "Competência" }),
    ).toHaveTextContent("5,50/ 7Alto");
    expect(
      screen.getByRole("region", { name: "Relacionamento" }),
    ).toHaveTextContent("Baixo");
    expect(
      screen.getByRole("img", {
        name: "Mapa das necessidades, de 0 a 7: Autonomia (5,14) 5,14, Competência (5,50) 5,50, Relacionamento (3,20) 3,20",
      }),
    ).toBeInTheDocument();
    const niveis = screen.getByRole("region", { name: "Pessoas por nível" });
    expect(niveis).toHaveTextContent("Alto: 1 pessoa");
    expect(niveis).toHaveTextContent("Moderado: 2 pessoas");
    expect(niveis).toHaveTextContent("Baixo: 0 pessoas");
  });

  it("pessoa: o painel aparece no resultado individual; sem modelo, nada", () => {
    const individual = {
      modelo: "tad" as const,
      geral: 7,
      nivel: "alto" as const,
      pilares,
    };
    render(<>{resultadoIndividualDoModelo({ modelo: individual } as never)}</>);
    expect(
      screen.getByRole("region", { name: "Score geral de motivação" }),
    ).toHaveTextContent("7,00/ 7Alto");
    expect(resultadoIndividualDoModelo({ modelo: null } as never)).toBeNull();
  });
});

describe("T216 — assistente dos modelos", () => {
  it("metodologia fixa: grupos em acordeão, legenda, selos e o comentário da dimensão", () => {
    const m = modeloDaGaleria("pulso_clima");
    render(
      <PerguntasFixas
        modelo={m}
        secoes={estadoDoModelo("pulso_clima").secoes}
      />,
    );
    const cartao = screen.getByRole("region", { name: "Perguntas" });
    expect(cartao).toHaveTextContent("24");
    expect(cartao).toHaveTextContent(
      "Metodologia fixa · as perguntas não podem ser editadas",
    );
    expect(cartao).toHaveTextContent("4 e 5 contam como favoráveis");
    // Só o primeiro grupo começa aberto.
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
    expect(cartao).toHaveTextContent("Comentário opcional sobre esta dimensão");
    fireEvent.click(screen.getByRole("button", { name: "Expandir todas" }));
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(10);
    expect(cartao).toHaveTextContent("LNPS 0–10");
    expect(cartao).toHaveTextContent("eNPS 0–10");
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recolher todas" }));
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
  });

  it("TAD: agrupada por pilar (7, 6, 8) com o selo Invertida, na ordem de resposta", () => {
    const m = modeloDaGaleria("tad");
    render(<PerguntasFixas modelo={m} secoes={estadoDoModelo("tad").secoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Expandir todas" }));
    expect(
      screen.getByRole("button", { name: /Autonomia · 7 perguntas/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Competência · 6 perguntas/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Relacionamento · 8 perguntas/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Invertida")).toHaveLength(9);
    expect(screen.getAllByText("Escala 1–7")).toHaveLength(21);
  });

  it("título do assistente e o marcador {empresa}", () => {
    expect(tituloDoAssistente(modeloDaGaleria("pulso"))).toBe(
      "Nova pesquisa Pulso",
    );
    expect(tituloDoAssistente(modeloDaGaleria("clima"))).toBe(
      "Nova pesquisa de Clima",
    );
    expect(tituloDoAssistente(modeloDaGaleria("pulso_clima"))).toBe(
      "Nova pesquisa Pulso e Clima",
    );
    expect(textoComEmpresa("Orgulho da {empresa}.", "Alfa")).toBe(
      "Orgulho da Alfa.",
    );
    expect(textoComEmpresa("Orgulho da {empresa}.", "  ")).toBe(
      "Orgulho da nossa empresa.",
    );
  });
});

describe("T216 — planilha: abas próprias dos modelos", () => {
  const base = {
    dimensoes: [] as DimensaoDoModelo[],
    afirmacoes: [],
  };

  it("Pulso e Clima: a aba Dimensões com o geral, o eNPS e o LNPS", () => {
    const r: ResultadoPulsoClima = {
      modelo: "pulso_clima",
      score: 71,
      faixa: "saudavel",
      favoravel: 70,
      neutro: 10,
      desfavoravel: 20,
      ...base,
      dimensoes: [dim("lideranca", "Liderança", 88, "forte")],
      enps: nps("e", 33, "bom"),
      lnps: nps("l", 0, "em_ajuste"),
      comentarios: [],
    };
    const [aba] = abasDoModelo({ ...RESULTADOS, modelo: r }, "Alfa", "PC");
    expect(aba!.nome).toBe("Dimensões");
    const texto = JSON.stringify(aba!.linhas);
    expect(texto).toContain('"Liderança",88,"Forte"');
    expect(texto).toContain('"Score geral",71,"Saudável"');
    expect(texto).toContain('"eNPS · empresa",33,"Bom",3');
    expect(texto).toContain('"LNPS · liderança direta",0,"Em ajuste"');
  });

  it("TAD: a aba Pilares com o geral e as pessoas por nível; sem modelo, nenhuma", () => {
    const r: ResultadoTad = {
      modelo: "tad",
      respondentes: 3,
      geral: 5.13,
      nivel: "moderado",
      pilares: [
        {
          chave: "autonomia",
          rotulo: "Autonomia",
          perguntas: 7,
          score: 5.14,
          nivel: "moderado",
        },
      ],
      niveis: { alto: 1, moderado: 2, baixo: 0 },
    };
    const [aba] = abasDoModelo({ ...RESULTADOS, modelo: r }, "Alfa", "TAD");
    expect(aba!.nome).toBe("Pilares");
    const texto = JSON.stringify(aba!.linhas);
    expect(texto).toContain(
      '"Autonomia",{"numero":5.14,"formato":"decimal"},"Moderado",7',
    );
    expect(texto).toContain('"Moderado (3,5 a 5,4)",2');
    expect(abasDoModelo(RESULTADOS, "Alfa", "X")).toEqual([]);
  });
});
