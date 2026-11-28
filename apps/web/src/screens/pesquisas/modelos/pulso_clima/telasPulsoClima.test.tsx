/**
 * T216 — Pulso e Clima: a aba Comentários (ordem, filtro com score, mês e
 * departamento só quando aparece), a coluna da aba Respostas e a resposta
 * individual na régua do modelo (score 0–100 ao lado do time).
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DimensaoDoModelo,
  PesquisaDetalhe,
  RecomendacaoDoModelo,
  RespostaDetalhe,
  RespostaResumo,
  ResultadoIndividualPulsoClima,
  ResultadoPulsoClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import {
  DETALHE,
  RESPOSTA_DETALHE,
  RESPOSTAS,
  RESULTADOS,
  servicoFalso,
} from "../../dadosDeTeste";
import { estadoDoModelo, perguntasEmOrdem } from "../../estadoDaPesquisa";
import { ResultadoIndividual } from "../../ResultadoIndividual";
import { ResultadosDaPesquisa } from "../../ResultadosDaPesquisa";
import {
  abaExtraDoModelo,
  abasExtrasDoModelo,
  visaoGeralDoModelo,
} from "../resultados";
import { textoDaRegua } from "../RespostasNaRegua";
import { PaginaDoModelo } from "../PaginaDoModelo";
import { PULSO_CLIMA } from "./catalogo";
import { comparacaoComOTime, grupoDaNota } from "./IndividualPulsoClima";

const detalhe: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "pulso_clima",
  identificacao: "anonima",
  minimoPorGrupo: 3,
  secoes: [...estadoDoModelo("pulso_clima").secoes],
};
const todas = perguntasEmOrdem(detalhe.secoes);
const id = (chave: string) => todas.find((p) => p.chave === chave)!.id;

const nps = (indice: number, faixa: RecomendacaoDoModelo["faixa"]) => ({
  perguntaId: null,
  respostas: 3,
  promotores: 2,
  neutros: 0,
  detratores: 1,
  indice,
  faixa,
  distribuicao: [],
});

const dim = (
  chave: string,
  rotulo: string,
  score: number,
  faixa: DimensaoDoModelo["faixa"],
  comentarios: number,
): DimensaoDoModelo => ({
  chave,
  rotulo,
  afirmacoes: 4,
  respostas: 12,
  score,
  faixa,
  favoravel: 50,
  neutro: 20,
  desfavoravel: 30,
  comentarios,
});

const r: ResultadoPulsoClima = {
  modelo: "pulso_clima",
  score: 61,
  faixa: "atencao",
  favoravel: 60,
  neutro: 10,
  desfavoravel: 30,
  dimensoes: [
    dim("lideranca", "Liderança", 72, "saudavel", 2),
    dim("bem_estar", "Bem-estar e Segurança Psicossocial", 40, "critico", 0),
  ],
  afirmacoes: [],
  enps: nps(33, "bom"),
  lnps: nps(-10, "critico"),
  comentarios: [
    {
      dimensao: "lideranca",
      perguntaId: id("__comentario_lideranca__"),
      quantidade: 2,
      textos: [
        { texto: "Reuniões curtas", mes: "2026-11", departamento: "Vendas" },
        { texto: "Mais retorno", mes: "2026-10", departamento: null },
      ],
    },
    {
      dimensao: "enps",
      perguntaId: id("__comentario_enps__"),
      quantidade: 1,
      textos: [{ texto: "Bom lugar", mes: "2026-11", departamento: null }],
    },
  ],
};
const geral: ResultadosPesquisa = { ...RESULTADOS, perguntas: [], modelo: r };

describe("T216 — Pulso e Clima: aba Comentários", () => {
  it("a aba a mais conta os comentários; só no Pulso e Clima", () => {
    expect(abasExtrasDoModelo(detalhe, geral)).toEqual([
      { valor: "comentarios", rotulo: "Comentários", contagem: 3 },
    ]);
    expect(abasExtrasDoModelo({ ...detalhe, modelo: "pulso" }, geral)).toEqual(
      [],
    );
    expect(abaExtraDoModelo(detalhe, geral, "geral")).toBeNull();
    expect(
      abaExtraDoModelo({ ...detalhe, modelo: "clima" }, geral, "comentarios"),
    ).toBeNull();
  });

  it("cartões do mais recente ao mais antigo, com score, faixa, departamento e mês", () => {
    render(<>{abaExtraDoModelo(detalhe, geral, "comentarios")}</>);
    expect(
      screen.getByText(
        "Os comentários aparecem sem nome. O departamento só é mostrado em grupos com 3 respostas ou mais.",
      ),
    ).toBeInTheDocument();
    const itens = within(
      screen.getByRole("list", { name: "Comentários" }),
    ).getAllByRole("listitem");
    expect(itens.map((li) => li.querySelector("p")!.textContent)).toEqual([
      "“Reuniões curtas”",
      "“Bom lugar”",
      "“Mais retorno”",
    ]);
    expect(itens[0]).toHaveTextContent(
      "Liderança · 2 comentários · 4 afirmações72/100Saudável",
    );
    expect(itens[0]).toHaveTextContent("Anônimo · Vendas · novembro de 2026");
    expect(itens[1]).toHaveTextContent("eNPS · empresa · 1 comentário+33Bom");
    expect(itens[2]).toHaveTextContent(
      "Anônimo · Departamento oculto · outubro de 2026",
    );
  });

  it("filtro lateral com o score e a contagem; ordenar pelos mais antigos", () => {
    render(<>{abaExtraDoModelo(detalhe, geral, "comentarios")}</>);
    const filtro = screen.getByRole("list", { name: "Filtrar por dimensão" });
    expect(filtro).toHaveTextContent("Todas as dimensões3");
    expect(filtro).toHaveTextContent("Liderança · 72/1002");
    fireEvent.click(within(filtro).getByRole("button", { name: /^eNPS/ }));
    expect(
      within(screen.getByRole("list", { name: "Comentários" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
    fireEvent.click(
      within(filtro).getByRole("button", { name: /^Todas as dimensões/ }),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Ordenar" }));
    fireEvent.click(screen.getByRole("option", { name: "Mais antigos" }));
    const itens = within(
      screen.getByRole("list", { name: "Comentários" }),
    ).getAllByRole("listitem");
    expect(itens[0]).toHaveTextContent("Mais retorno");
  });

  it("'Ver em Comentários' abre a aba filtrada na dimensão", () => {
    let aba = "";
    const { unmount } = render(
      <>
        {visaoGeralDoModelo(detalhe, geral, (a) => {
          aba = a;
        })}
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver em Comentários" }));
    expect(aba).toBe("comentarios");
    unmount();
    render(<>{abaExtraDoModelo(detalhe, geral, aba as "comentarios")}</>);
    expect(
      within(
        screen.getByRole("list", { name: "Filtrar por dimensão" }),
      ).getByRole("button", { name: /^Liderança/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("list", { name: "Comentários" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
  });

  it("identificada: sem 'Anônimo' e sem o aviso; sem textos, usa os da pergunta", () => {
    const semTextos: ResultadoPulsoClima = {
      ...r,
      comentarios: [
        { ...r.comentarios[0]!, textos: undefined as never, quantidade: 1 },
      ],
    };
    render(
      <>
        {abaExtraDoModelo(
          { ...detalhe, identificacao: "identificada" },
          {
            ...geral,
            modelo: semTextos,
            perguntas: [
              {
                perguntaId: id("__comentario_lideranca__"),
                tipo: "paragrafo",
                respondidas: 1,
                viram: 1,
                textos: [{ texto: "Antigo formato", autor: null }],
              },
            ],
          },
          "comentarios",
        )}
      </>,
    );
    expect(screen.queryByRole("note")).toBeNull();
    const item = within(
      screen.getByRole("list", { name: "Comentários" }),
    ).getByRole("listitem");
    expect(item).toHaveTextContent("Antigo formato");
    expect(item).not.toHaveTextContent("Anônimo");
    expect(item).toHaveTextContent("Departamento oculto");
  });

  it("nas abas da pesquisa: Comentários com a contagem, antes de Respostas", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() =>
            Promise.resolve({ ...detalhe, respostas: 3 }),
          ),
          resultadosDaPesquisa: vi.fn(() => Promise.resolve(geral)),
        })}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    const abas = await screen.findByRole("tablist", { name: "Resultados" });
    expect(
      within(abas)
        .getAllByRole("tab")
        .map((t) => t.textContent),
    ).toEqual(["Visão geral", "Análises Novo", "Comentários 3", "Respostas 3"]);
    fireEvent.click(within(abas).getByRole("tab", { name: /Comentários/ }));
    expect(await screen.findByText("“Reuniões curtas”")).toBeInTheDocument();
  });
});

describe("T216 — Pulso e Clima: aba Respostas e resposta individual", () => {
  const comIndicador: RespostaResumo[] = [
    {
      ...RESPOSTAS[0]!,
      resumoDoModelo: { modelo: "pulso_clima", valor: 73, faixa: "saudavel" },
    },
    {
      ...RESPOSTAS[1]!,
      resumoDoModelo: { modelo: "pulso_clima", valor: null, faixa: null },
    },
  ];

  it("a coluna da aba Respostas é o score da resposta com a faixa", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() => Promise.resolve(detalhe)),
          resultadosDaPesquisa: vi.fn(() => Promise.resolve(geral)),
          respostasDaPesquisa: vi.fn(() => Promise.resolve(comIndicador)),
        })}
        pesquisaId="p-1"
        podeEditar
        abaInicial="respostas"
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    const tabela = await screen.findByRole(
      "table",
      { name: "Respostas" },
      { timeout: 5000 },
    );
    expect(tabela).toHaveTextContent("Score da resposta");
    expect(tabela).not.toHaveTextContent("Média das respostas");
    const linhas = within(tabela).getAllByRole("row");
    // Da mais recente para a mais antiga: a #2 (sem score) e a #1.
    expect(linhas[1]).toHaveTextContent("Resposta anônima #2—");
    expect(linhas[2]).toHaveTextContent("Resposta anônima #173/100Saudável");
    expect(textoDaRegua(RESPOSTAS[0]!)).toBeNull();
    expect(textoDaRegua(comIndicador[0]!)).toBe("Score 73");
  });

  const individual: ResultadoIndividualPulsoClima = {
    modelo: "pulso_clima",
    score: 73,
    faixa: "saudavel",
    scoreTime: 50,
    favoraveis: 21,
    neutras: 0,
    desfavoraveis: 1,
    dimensoes: [
      {
        chave: "lideranca",
        rotulo: "Liderança",
        score: 63,
        faixa: "atencao",
        scoreTime: 50,
      },
      {
        chave: "bem_estar",
        rotulo: "Bem-estar e Segurança Psicossocial",
        score: 75,
        faixa: "saudavel",
        scoreTime: 75,
      },
      {
        chave: "condicoes",
        rotulo: "Condições de Trabalho",
        score: 25,
        faixa: "critico",
        scoreTime: 60,
      },
    ],
    distribuicao: [
      { valor: 1, resposta: 0, time: 33 },
      { valor: 2, resposta: 1, time: 0 },
      { valor: 3, resposta: 0, time: 33 },
      { valor: 4, resposta: 21, time: 0 },
      { valor: 5, resposta: 0, time: 33 },
    ],
    enps: { nota: 6, indiceTime: 33 },
    lnps: { nota: null, indiceTime: 0 },
    comentarios: [{ dimensao: "lideranca", texto: "Mais retorno" }],
  };
  const resposta: RespostaDetalhe = {
    ...RESPOSTA_DETALHE,
    resumoDoModelo: comIndicador[0]!.resumoDoModelo!,
    modelo: individual,
  };

  it("a Visão geral da resposta fica na régua do modelo, sem a média de 0 a 10", async () => {
    render(
      <ResultadoIndividual
        servico={servicoFalso({
          obterPesquisa: vi.fn(() => Promise.resolve(detalhe)),
          respostaDaPesquisa: vi.fn(() => Promise.resolve(resposta)),
          respostasDaPesquisa: vi.fn(() => Promise.resolve(comIndicador)),
        })}
        pesquisaId="p-1"
        respostaId="r-1"
        onVoltar={vi.fn()}
        onLista={vi.fn()}
        onIr={vi.fn()}
      />,
    );
    const ind = await screen.findByRole("region", {
      name: "Indicadores da resposta",
    });
    expect(ind).toHaveTextContent("Score da resposta73/100Saudável");
    expect(ind).toHaveTextContent("23 pontos acima do time (50)");
    expect(ind).toHaveTextContent("Todas as respostas · 22 afirmações");
    expect(ind).toHaveTextContent("21favoráveis0neutras1desfavorável");
    expect(ind).toHaveTextContent(
      "eNPS · empresa6/10Detrator · eNPS do time: +33",
    );
    expect(ind).toHaveTextContent(
      "LNPS · liderança diretaSem nota nesta resposta.",
    );
    expect(ind).not.toHaveTextContent("Média geral");
    expect(screen.queryByText("Média nos últimos pulsos")).toBeNull();
    const dims = screen.getByRole("table", { name: "Dimensões da resposta" });
    expect(within(dims).getAllByRole("row")[1]).toHaveTextContent(
      "Liderança6350+13",
    );
    const difere = screen.getByRole("region", {
      name: "Onde esta resposta difere do time",
    });
    // Da maior diferença para a menor; a igual ao time fica de fora.
    expect(
      within(difere)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Condições de Trabalho35 pontos abaixo do time (60)",
      "Liderança13 pontos acima do time (50)",
    ]);
    expect(
      screen.getByRole("listitem", {
        name: "2 Discordo: 1 afirmação nesta resposta, 0% do time",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /Comentários/ }),
    ).toHaveTextContent("Liderança“Mais retorno”");
    // O seletor de respostas mostra o score do modelo.
    fireEvent.pointerDown(
      screen.getByRole("button", { name: /Resposta 1 de 2/ }),
      { button: 0, ctrlKey: false },
    );
    expect(await screen.findByText("Score 73")).toBeInTheDocument();
  });

  it("comparação com o time: acima, abaixo e igual, no plural certo", () => {
    expect(comparacaoComOTime(48, 47)).toBe("1 ponto acima do time (47)");
    expect(comparacaoComOTime(40, 47)).toBe("7 pontos abaixo do time (47)");
    expect(comparacaoComOTime(47, 47)).toBe("igual ao time (47)");
    expect([10, 9, 8, 7, 6, 0].map(grupoDaNota)).toEqual([
      "Promotor",
      "Promotor",
      "Neutro",
      "Neutro",
      "Detrator",
      "Detrator",
    ]);
  });
});

describe("T216 — 'Sobre o modelo' do Pulso e Clima", () => {
  it("Pulso e Clima: 4 números, 10 cartões e as duas réguas lado a lado", () => {
    render(
      <PaginaDoModelo
        modelo={PULSO_CLIMA}
        pagina={PULSO_CLIMA.pagina!}
        onVoltar={vi.fn()}
        onUsar={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Em números")).toHaveTextContent(
      "dimensões8afirmações de 1 a 522recomendações: eNPS e LNPS2espaços para comentário8",
    );
    const dims = screen.getByRole("region", { name: "As 10 dimensões" });
    expect(within(dims).getAllByRole("listitem")).toHaveLength(10);
    expect(dims.querySelector("ol")).toHaveClass("sobre__grupos--cartoes");
    const score = screen.getByRole("region", { name: "Score de 0 a 100" });
    expect(
      within(score)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Crítico0 a 49",
      "Atenção50 a 69",
      "Saudável70 a 84",
      "Forte85 a 100",
    ]);
    const nps = screen.getByRole("region", {
      name: "eNPS e LNPS de −100 a 100",
    });
    expect(
      within(nps)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Críticoabaixo de 0",
      "Em ajuste0 a 29",
      "Bom30 a 69",
      "Excelente70 ou mais",
    ]);
    expect(screen.queryByText("O que você recebe")).toBeNull();
    expect(screen.queryByRole("region", { name: "Ficha técnica" })).toBeNull();
    expect(screen.queryByLabelText("Exemplo do resultado")).toBeNull();
  });
});
