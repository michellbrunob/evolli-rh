/**
 * T216 — Motivação (TAD): a coluna da aba Respostas (score de 1 a 7 com o
 * nível) e a resposta individual na régua do modelo, com cada pilar ao
 * lado do time.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  RespostaResumo,
  ResultadoIndividualTad,
} from "../../../../api/pesquisasClient";
import {
  DETALHE,
  RESPOSTA_DETALHE,
  RESPOSTAS,
  servicoFalso,
} from "../../dadosDeTeste";
import { estadoDoModelo } from "../../estadoDaPesquisa";
import {
  ResponderPesquisa,
  montarPreviaPublica,
} from "../../../publico/ResponderPesquisa";
import { secoesDoModelo } from "../../modelosDePesquisa";
import { ITENS_TAD, TAD } from "./catalogo";
import { nivelLocalDaTad, resultadoLocalDaTad } from "./resultadoLocal";
import { PaginaDoModelo } from "../PaginaDoModelo";
import { ResultadoIndividual } from "../../ResultadoIndividual";
import { ResultadosDaPesquisa } from "../../ResultadosDaPesquisa";
import { visaoIndividualDoModelo } from "../resultados";
import { diferencaTad } from "./ResultadoTad";
import { textoDaRegua } from "../RespostasNaRegua";

const DETALHE_TAD: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "tad",
  identificacao: "anonima",
  secoes: [...estadoDoModelo("tad").secoes],
};

const pilares = [
  {
    chave: "autonomia",
    rotulo: "Autonomia",
    perguntas: 7,
    score: 4.43,
    nivel: "moderado" as const,
  },
  {
    chave: "competencia",
    rotulo: "Competência",
    perguntas: 6,
    score: 4,
    nivel: "moderado" as const,
  },
  {
    chave: "relacionamento",
    rotulo: "Relacionamento",
    perguntas: 8,
    score: 4.75,
    nivel: "moderado" as const,
  },
];

describe("T216 — TAD: aba Respostas e resposta individual", () => {
  const comIndicador: RespostaResumo[] = [
    {
      ...RESPOSTAS[0]!,
      resumoDoModelo: { modelo: "tad", valor: 4.39, nivel: "moderado" },
    },
    {
      ...RESPOSTAS[1]!,
      resumoDoModelo: { modelo: "tad", valor: 7, nivel: "alto" },
    },
  ];

  it("a coluna é o score de motivação (1 a 7) com o nível", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() => Promise.resolve(DETALHE_TAD)),
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
    expect(tabela).toHaveTextContent("Score de motivação");
    const linhas = within(tabela).getAllByRole("row");
    expect(linhas[1]).toHaveTextContent("7,00 /7Alto");
    expect(linhas[2]).toHaveTextContent("4,39 /7Moderado");
    expect(textoDaRegua(comIndicador[0]!)).toBe("Score 4,39");
    expect(
      textoDaRegua({
        ...RESPOSTAS[0]!,
        resumoDoModelo: { modelo: "tad", valor: null, nivel: null },
      }),
    ).toBe("—");
  });

  const individual: ResultadoIndividualTad = {
    modelo: "tad",
    geral: 4.39,
    nivel: "moderado",
    pilares,
    time: { geral: 5.13, pilares: [5.14, 5, null] },
  };

  it("a Visão geral da resposta: painel da TAD e cada pilar ao lado do time", async () => {
    const resposta: RespostaDetalhe = {
      ...RESPOSTA_DETALHE,
      modelo: individual,
    };
    render(
      <ResultadoIndividual
        servico={servicoFalso({
          obterPesquisa: vi.fn(() => Promise.resolve(DETALHE_TAD)),
          respostaDaPesquisa: vi.fn(() => Promise.resolve(resposta)),
        })}
        pesquisaId="p-1"
        respostaId="r-1"
        onVoltar={vi.fn()}
        onLista={vi.fn()}
        onIr={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("region", { name: "Score geral de motivação" }),
    ).toHaveTextContent("4,39/ 7Moderado");
    expect(screen.queryByText("Média geral")).toBeNull();
    expect(screen.queryByText("Média nos últimos pulsos")).toBeNull();
    const linhas = within(
      screen.getByRole("table", { name: "Comparação com o time" }),
    ).getAllByRole("row");
    expect(linhas.map((l) => l.textContent)).toEqual([
      "NecessidadeRespostaTimeDiferença",
      "Score geral4,395,13−0,74",
      "Autonomia4,435,14−0,71",
      "Competência4,005,00−1,00",
      "Relacionamento4,75——",
    ]);
  });

  it("sem o time, só o painel; outros modelos não trocam a Visão geral", () => {
    render(
      <>
        {visaoIndividualDoModelo(
          { ...RESPOSTA_DETALHE, modelo: { ...individual, time: null } },
          DETALHE_TAD.secoes,
        )}
      </>,
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.getByRole("region", { name: "Score geral de motivação" }),
    ).toBeInTheDocument();
    expect(
      visaoIndividualDoModelo(RESPOSTA_DETALHE, DETALHE_TAD.secoes),
    ).toBeNull();
  });

  it("diferença com duas casas e sinal", () => {
    expect(diferencaTad(5.5, 4.89)).toBe("+0,61");
    expect(diferencaTad(4, 5.2)).toBe("−1,20");
    expect(diferencaTad(4.39, 4.39)).toBe("0,00");
  });
});

describe("T216 — TAD: resultado ao fim da página pública", () => {
  const previa = montarPreviaPublica({
    empresa: "Empresa Sintética",
    nome: "Motivação",
    boasVindas: null,
    identificacao: "anonima",
    modelo: "tad",
    secoes: secoesDoModelo(TAD),
  });
  const ids = new Map(
    previa.secoes.flatMap((s) => s.perguntas).map((p) => [p.chave!, p.id]),
  );
  const marcar = (direto: number, invertido: number) =>
    Object.fromEntries(
      ITENS_TAD.map((i) => [
        ids.get(i.chave)!,
        i.invertido ? invertido : direto,
      ]),
    );

  it("o cálculo local é o da API: invertidos 8 − resposta, geral = média dos pilares", () => {
    const tudo7 = resultadoLocalDaTad(previa.secoes, marcar(7, 7))!;
    expect(tudo7.pilares.map((p) => p.score)).toEqual([4.43, 4, 4.75]);
    expect(tudo7).toMatchObject({ geral: 4.39, nivel: "moderado" });
    expect(resultadoLocalDaTad(previa.secoes, marcar(7, 1))).toMatchObject({
      geral: 7,
      nivel: "alto",
    });
    expect(resultadoLocalDaTad(previa.secoes, marcar(1, 7))).toMatchObject({
      geral: 1,
      nivel: "baixo",
    });
    // Valor fora da escala não conta; sem nada respondido, nulo.
    expect(resultadoLocalDaTad(previa.secoes, marcar(9, 9))).toBeNull();
    expect(resultadoLocalDaTad(previa.secoes, {})).toBeNull();
    // Níveis nas fronteiras, iguais aos da API.
    expect([7, 5.5, 5.49, 3.5, 3.49, 1].map(nivelLocalDaTad)).toEqual([
      "alto",
      "alto",
      "moderado",
      "moderado",
      "baixo",
      "baixo",
    ]);
  });

  it("depois de enviar: score geral com nível e frase, pilares, radar e o aviso", () => {
    render(<ResponderPesquisa previa={previa} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Começar a pré-visualização" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    for (let i = 0; i < 21; i++) {
      const radios = within(screen.getByRole("radiogroup")).getAllByRole(
        "radio",
      );
      expect(radios).toHaveLength(7);
      fireEvent.click(radios[6]!);
      fireEvent.click(
        screen.getByRole("button", {
          name: i === 20 ? /Enviar respostas/ : /Próximo/,
        }),
      );
    }
    expect(
      screen.getByRole("heading", { name: "Respostas enviadas!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Score geral de motivação" }),
    ).toHaveTextContent("4,39de 7,00ModeradoSatisfação parcial");
    const pilares = within(
      screen.getByRole("list", { name: "Seus pilares" }),
    ).getAllByRole("listitem");
    expect(pilares.map((p) => p.querySelector("strong")!.textContent)).toEqual([
      "Autonomia",
      "Competência",
      "Relacionamento",
    ]);
    expect(pilares[0]).toHaveTextContent("AutonomiaModerado4,43");
    expect(
      screen.getByRole("img", {
        name: "Mapa de motivação, de 0 a 7: Autonomia 4,43, Competência 4,00, Relacionamento 4,75",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Este resultado aparece só agora/)).toHaveAttribute(
      "role",
      "note",
    );
    expect(
      screen.getByRole("button", { name: "Salvar em PDF" }),
    ).toBeInTheDocument();
  });
});

describe("T216 — TAD: 'Sobre o modelo'", () => {
  it("explica o que é a TAD: teoria, as 3 necessidades, a escala e as referências", () => {
    render(
      <PaginaDoModelo
        modelo={TAD}
        pagina={TAD.pagina!}
        onVoltar={vi.fn()}
        onUsar={vi.fn()}
      />,
    );
    const tad = screen.getByRole("region", { name: "O que é a TAD?" });
    expect(tad).toHaveTextContent("Teoria da Autodeterminação");
    expect(tad).toHaveTextContent("Deci e Richard Ryan");
    expect(tad).toHaveTextContent("21 afirmações de 1 a 7");
    expect(tad).toHaveTextContent("Van den Broeck");
    expect(
      screen.getByRole("region", { name: "Os 3 pilares" }),
    ).toBeInTheDocument();
  });
});
