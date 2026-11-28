/**
 * T216 — Motivação (TAD): a planilha com as abas do modelo (as invertidas
 * com a média pontuada em `8 − média`) e o relatório imprimível próprio, na
 * escala de 1 a 7. Dados sintéticos.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadoPergunta,
  ResultadoTad,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { lerAbasXlsx } from "../../../pessoas/importacao/planilhaXlsx";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import {
  DETALHE,
  RESPOSTA_DETALHE,
  RESPOSTAS,
  RESULTADOS,
} from "../../dadosDeTeste";
import { montarRelatorio } from "../../dadosDoRelatorio";
import { estadoDoModelo, perguntasEmOrdem } from "../../estadoDaPesquisa";
import { planilhaDosResultados } from "../../exportarResultados";
import { ITENS_TAD } from "./catalogo";
import { mediaPontuada } from "./exportarTad";
import { DocumentoTad } from "./RelatorioTad";
import { DocumentoDaResposta } from "../../RelatorioImprimivel";

const HOJE = "2026-11-27";

const detalhe: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "tad",
  identificacao: "identificada",
  secoes: [...estadoDoModelo("tad").secoes],
};
const todas = perguntasEmOrdem(detalhe.secoes);
const id = (chave: string) => todas.find((p) => p.chave === chave)!.id;

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
const r: ResultadoTad = {
  modelo: "tad",
  respondentes: 1,
  geral: 4.39,
  nivel: "moderado",
  pilares,
  niveis: { alto: 0, moderado: 1, baixo: 0 },
};
// Tudo marcado em 7: as invertidas pontuam 1.
const perguntas: ResultadoPergunta[] = ITENS_TAD.map((i) => ({
  perguntaId: id(i.chave),
  tipo: "escala",
  respondidas: 1,
  viram: 1,
  media: 7,
  distribuicao: [1, 2, 3, 4, 5, 6, 7].map((valor) => ({
    valor,
    quantidade: valor === 7 ? 1 : 0,
  })),
}));
const geral: ResultadosPesquisa = {
  ...RESULTADOS,
  respostas: 1,
  perguntas,
  modelo: r,
};

const resposta: RespostaDetalhe = {
  ...RESPOSTA_DETALHE,
  valores: ITENS_TAD.map((i) => ({
    perguntaId: id(i.chave),
    valor: 7,
    mediaTime: 7,
  })),
  modelo: {
    modelo: "tad",
    geral: 4.39,
    nivel: "moderado",
    pilares,
    time: null,
  },
};

const carregado = (g = geral): RelatorioCarregado => ({
  detalhe,
  geral: g,
  empresa: "Empresa Alfa",
  lista: RESPOSTAS,
  rel: montarRelatorio({
    detalhe,
    geral: g,
    empresa: "Empresa Alfa",
    hoje: HOJE,
    respostas: RESPOSTAS,
  }),
});

describe("T216 — TAD: planilha do modelo", () => {
  it("Resumo, Afirmações, Respostas individuais e Metodologia", async () => {
    const abas = await lerAbasXlsx(
      planilhaDosResultados(carregado().rel, detalhe, geral, [resposta]),
    );
    expect(Object.keys(abas)).toEqual([
      "Resumo",
      "Afirmações",
      "Respostas individuais",
      "Metodologia",
    ]);
    const resumo = abas["Resumo"]!;
    expect(resumo.find((l) => l[0] === "Score geral")).toEqual([
      "Score geral",
      "4.39",
      "Moderado",
      "21",
    ]);
    expect(resumo.find((l) => l[0] === "Competência")).toEqual([
      "Competência",
      "4",
      "Moderado",
      "6",
    ]);
    expect(resumo.find((l) => l[0] === "Moderado (3,5 a 5,4)")).toEqual([
      "Moderado (3,5 a 5,4)",
      "1",
    ]);
  });

  it("afirmações: invertida marcada e média pontuada = 8 − média", async () => {
    const abas = await lerAbasXlsx(
      planilhaDosResultados(carregado().rel, detalhe, geral, [resposta]),
    );
    const afirmacoes = abas["Afirmações"]!;
    expect(afirmacoes[3]!.slice(0, 7)).toEqual([
      "#",
      "Afirmação",
      "Pilar",
      "Invertida",
      "Respostas",
      "Média marcada",
      "Média pontuada",
    ]);
    // tad_01 direta; tad_03 invertida (7 vira 1).
    expect(afirmacoes[4]!.slice(2, 7)).toEqual([
      "Autonomia",
      "Não",
      "1",
      "7",
      "7",
    ]);
    expect(afirmacoes[6]!.slice(2, 7)).toEqual([
      "Competência",
      "Sim",
      "1",
      "7",
      "1",
    ]);
    expect(afirmacoes[6]!.at(-1)).toBe("1");
  });

  it("respostas individuais: valor marcado, pilares e geral de cada pessoa e a média", async () => {
    const abas = await lerAbasXlsx(
      planilhaDosResultados(carregado().rel, detalhe, geral, [resposta]),
    );
    const linhas = abas["Respostas individuais"]!;
    const cab = linhas[3]!;
    expect(cab[0]).toBe("Resposta");
    expect(cab[4]).toMatch(/^3\. .*\(invertida\)$/);
    expect(cab.slice(-5)).toEqual([
      "Autonomia",
      "Competência",
      "Relacionamento",
      "Score geral",
      "Nível",
    ]);
    expect(linhas[4]![0]).toBe("Ana Exemplo");
    expect(linhas[4]!.slice(-5)).toEqual([
      "4.43",
      "4",
      "4.75",
      "4.39",
      "Moderado",
    ]);
    expect(linhas[5]![0]).toBe("Média");
    expect(linhas[5]![2]).toBe("7");
  });

  it("confidencial: sem respostas individuais", async () => {
    const conf = { ...detalhe, identificacao: "confidencial" as const };
    const c = carregado();
    const abas = await lerAbasXlsx(
      planilhaDosResultados(c.rel, conf, geral, [resposta]),
    );
    expect(abas["Respostas individuais"]).toBeUndefined();
  });

  it("média pontuada", () => {
    expect(mediaPontuada(6.5, true)).toBe(1.5);
    expect(mediaPontuada(6.5, false)).toBe(6.5);
    expect(mediaPontuada(null, true)).toBeNull();
  });
});

describe("T216 — TAD: relatório imprimível do modelo", () => {
  it("capa, pilares, radar e as afirmações com a média pontuada", () => {
    render(<DocumentoTad carregado={carregado()} r={r} />);
    const pilaresTab = screen.getByRole("table", { name: "Os 3 pilares" });
    expect(within(pilaresTab).getAllByRole("row")[1]).toHaveTextContent(
      "Autonomia (7 afirmações)4,43Moderado",
    );
    expect(
      screen.getByRole("img", {
        name: "Mapa das necessidades, de 0 a 7: Autonomia (4,43) 4,43, Competência (4,00) 4,00, Relacionamento (4,75) 4,75",
      }),
    ).toBeInTheDocument();
    const linhas = within(
      screen.getByRole("table", { name: "Afirmações" }),
    ).getAllByRole("row");
    expect(linhas).toHaveLength(22);
    expect(linhas[3]).toHaveTextContent("(invertida)");
    expect(linhas[3]).toHaveTextContent("Competência7,001,00");
    expect(document.body).not.toHaveTextContent(/\/10(?!0)/);
  });

  it("sem o resultado do modelo, os números ficam ocultos", () => {
    render(<DocumentoTad carregado={carregado()} r={null} />);
    expect(screen.getAllByText("Números ocultos").length).toBeGreaterThan(0);
  });
});

describe("T216 — TAD: PDF de uma resposta", () => {
  it("a capa traz o score de 1 a 7 e os pilares ao lado do time, sem a média de 0 a 10", () => {
    render(
      <DocumentoDaResposta
        detalhe={detalhe}
        resposta={{
          ...resposta,
          modelo: {
            ...resposta.modelo!,
            time: { geral: 5.13, pilares: [5.14, 5, null] },
          } as never,
        }}
        empresa="Empresa Alfa"
        hoje={HOJE}
      />,
    );
    expect(screen.getByText("Score geral de motivação")).toBeInTheDocument();
    expect(
      screen.getByText("−0,74 em relação ao time (5,13)"),
    ).toBeInTheDocument();
    const pilaresDaResposta = screen.getByRole("list", {
      name: "Pilares da resposta",
    });
    expect(pilaresDaResposta).toHaveTextContent("Autonomiatime 5,144,43");
    expect(pilaresDaResposta).toHaveTextContent("Relacionamento4,75");
    expect(screen.queryByText("Média das respostas")).toBeNull();
  });
});
