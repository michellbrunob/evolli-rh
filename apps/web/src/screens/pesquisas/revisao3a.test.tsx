/**
 * T216 — 3ª revisão, telas: faixas das escalas de 4 pontos, legenda do eNPS
 * numa linha, contagem sob cada grupo no mapa, numeração dos cartões sem as
 * perguntas de texto e o resultado individual (recomendação, números
 * coloridos, arredondamento e "igual ao time"). Dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  Pergunta,
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import {
  DETALHE,
  RESPOSTA_DETALHE,
  RESULTADOS,
  SECOES,
  servicoFalso,
} from "./dadosDeTeste";
import { ResultadoIndividual } from "./ResultadoIndividual";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";

const pergunta = (
  id: string,
  tipo: Pergunta["tipo"],
  texto: string,
  extra: Partial<Pergunta> = {},
): Pergunta => ({
  id,
  tipo,
  texto,
  descricao: null,
  obrigatoria: true,
  config: {},
  condicao: null,
  ...extra,
});

const distribuicao = (pares: [number, number][]) =>
  pares.map(([valor, quantidade]) => ({ valor, quantidade }));

function montarResultados(
  detalhe: PesquisaDetalhe,
  resultados: ResultadosPesquisa,
) {
  const servico = servicoFalso({
    obterPesquisa: vi.fn(() => Promise.resolve(detalhe)),
    resultadosDaPesquisa: vi.fn(() => Promise.resolve(resultados)),
  });
  render(
    <ResultadosDaPesquisa
      servico={servico}
      pesquisaId={detalhe.id}
      podeEditar
      onVoltar={vi.fn()}
      onEditar={vi.fn()}
      onDuplicada={vi.fn()}
      onSobreOModelo={vi.fn()}
      onAbrirResposta={vi.fn()}
    />,
  );
  return servico;
}

describe("R3-A-05, R3-A-28, R3-A-35 e R3-A-26 — tela de resultados", () => {
  it("escala de 4 pontos: só duas faixas (1 a 2 e 3 a 4)", async () => {
    montarResultados(
      {
        ...DETALHE,
        secoes: [
          {
            id: "s",
            titulo: null,
            descricao: null,
            perguntas: [pergunta("q-sat", "satisfacao_4", "Satisfação geral")],
          },
        ],
      },
      {
        ...RESULTADOS,
        perguntas: [
          {
            perguntaId: "q-sat",
            tipo: "satisfacao_4",
            respondidas: 4,
            viram: 4,
            media: 2.5,
            distribuicao: distribuicao([
              [1, 1],
              [2, 1],
              [3, 1],
              [4, 1],
            ]),
          },
        ],
      },
    );
    const cartao = await screen.findByRole("region", {
      name: "1. Satisfação geral",
    });
    expect(
      within(cartao).getByRole("img", {
        name: "Faixas: 1 a 2 50%, 3 a 4 50%",
      }),
    ).toBeInTheDocument();
    expect(cartao).not.toHaveTextContent("3 a 2");
  });

  it("legenda do eNPS no cartão com rótulos curtos (numa linha)", async () => {
    montarResultados(DETALHE, RESULTADOS);
    const ind = await screen.findByRole("region", { name: "Indicadores" });
    const legenda = within(ind)
      .getByRole("img", { name: /^eNPS: promotores/ })
      .parentElement!.querySelector(".pesquisas__legenda")!;
    expect(legenda).toHaveTextContent("63% prom.25% neutros13% detr.");
  });

  it("cartões: as perguntas de texto não têm número nem contam", async () => {
    const [nota, conc, sim, esc, txt] = SECOES[0]!.perguntas;
    montarResultados(
      {
        ...DETALHE,
        secoes: [
          {
            ...SECOES[0]!,
            perguntas: [nota!, conc!, { ...txt!, condicao: null }, sim!, esc!],
          },
        ],
      },
      RESULTADOS,
    );
    expect(
      await screen.findByRole("region", { name: "3. Recomendaria a área?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "4. Qual canal você prefere?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Comentários" }),
    ).toHaveTextContent("Comentários livres");
  });

  it("mapa por departamento: a contagem embaixo de cada grupo, oculto também", async () => {
    montarResultados(DETALHE, RESULTADOS);
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("tab", { name: /Análises/ }));
    const mapa = await screen.findByRole("table", {
      name: "Médias por departamento",
    });
    const cabecas = within(mapa).getAllByRole("rowheader");
    expect(cabecas.map((c) => c.textContent)).toEqual([
      "Toda a empresa8 respostas",
      "Operações6 respostas",
      "Financeiro2 respostas",
    ]);
    expect(screen.getByText("Médias na escala de 1 a 10")).toBeInTheDocument();
  });
});

describe("R3-A-11 — resultado individual", () => {
  const abrir = (r: RespostaDetalhe) => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({ ...DETALHE, identificacao: "identificada" as const }),
      ),
      respostaDaPesquisa: vi.fn(() => Promise.resolve(r)),
    });
    render(
      <ResultadoIndividual
        servico={servico}
        pesquisaId="p-1"
        respostaId={r.id}
        onVoltar={vi.fn()}
        onLista={vi.fn()}
        onIr={vi.fn()}
      />,
    );
  };

  it("linha da recomendação (0 a 10) em 'Respostas por pergunta', no fim", async () => {
    abrir(RESPOSTA_DETALHE);
    const tabela = await screen.findByRole("table", {
      name: "Comparação com o time",
    });
    const linhas = within(tabela).getAllByRole("row");
    expect(linhas).toHaveLength(3);
    expect(linhas[2]).toHaveTextContent("Recomendação · 0 a 10");
    expect(linhas[2]).toHaveTextContent("Quanto você indicaria a empresa?");
    expect(linhas[2]).toHaveTextContent("10 /10");
    expect(linhas[2]).toHaveTextContent("+1,6time 8,4");
  });

  it("os quatro cartões com o número grande colorido pela faixa e /10", async () => {
    abrir(RESPOSTA_DETALHE);
    const ind = await screen.findByRole("region", {
      name: "Indicadores da resposta",
    });
    const numeros = [...ind.querySelectorAll(".pesquisas__indicador-numero")];
    expect(numeros.map((n) => n.textContent)).toEqual(["10,0", "10", "5", "5"]);
    expect(numeros.map((n) => n.getAttribute("data-faixa"))).toEqual([
      "alta",
      "alta",
      "alta",
      "alta",
    ]);
    const sufixos = [...ind.querySelectorAll(".pesquisas__indicador-sufixo")];
    expect(sufixos.map((s) => s.textContent)).toEqual([
      " /10",
      " /10",
      " /5",
      " /5",
    ]);
  });

  it("diferença negativa com meio para cima (−2,75 → −2,7) e 'igual ao time'", async () => {
    abrir({
      ...RESPOSTA_DETALHE,
      valores: [
        { perguntaId: "q-nota", valor: 6, mediaTime: 8.4 },
        { perguntaId: "q-conc", valor: 4, mediaTime: 4 },
      ],
      indicadores: {
        ...RESPOSTA_DETALHE.indicadores,
        media: 7,
        mediaTime: 9.75,
        recomendacao: 6,
        maior: { perguntaId: "q-conc", valor: 4 },
        menor: { perguntaId: "q-conc", valor: 4 },
      },
    });
    const ind = await screen.findByRole("region", {
      name: "Indicadores da resposta",
    });
    expect(ind).toHaveTextContent("−2,7 abaixo do time (9,8)");
    expect(ind).toHaveTextContent("igual ao time (4,0)");
    expect(ind).not.toHaveTextContent("0,0 em relação");
    const cores = [...ind.querySelectorAll(".pesquisas__indicador-numero")].map(
      (n) => n.getAttribute("data-faixa"),
    );
    // 7,0 atenção; recomendação 6 é detrator; 4 de 5 vira 8 (saudável).
    expect(cores).toEqual(["media", "baixa", "alta", "alta"]);
    const tabela = screen.getByRole("table", { name: "Comparação com o time" });
    expect(within(tabela).getAllByRole("row")[1]).toHaveTextContent(
      "igualtime 4,0",
    );
  });

  it("igual na média geral: 'igual ao time', nunca '0,0 acima'", async () => {
    abrir({
      ...RESPOSTA_DETALHE,
      indicadores: {
        ...RESPOSTA_DETALHE.indicadores,
        media: 8.5,
        mediaTime: 8.5,
      },
    });
    const ind = await screen.findByRole("region", {
      name: "Indicadores da resposta",
    });
    await waitFor(() => expect(ind).toHaveTextContent("igual ao time (8,5)"));
    expect(ind).not.toHaveTextContent("0,0 acima");
  });
});
