/**
 * T216 — exportação dos resultados: os dados do relatório, a planilha com
 * as abas (Resumo, Perguntas, eNPS, Participantes, Comentários, Alertas e
 * Metodologia) e o relatório em PDF (página A4 imprimível com capa,
 * sumário, seções 01 a 05 e rodapé paginado), sempre seguindo a
 * identificação: nada pessoal fora da identificada e nenhuma resposta
 * individual na confidencial. Servidor simulado; dados sintéticos.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  Identificacao,
  PesquisaDetalhe,
  RespostaDetalhe,
} from "../../api/pesquisasClient";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import {
  ANALISES,
  DETALHE,
  RESPOSTA_DETALHE,
  RESPOSTAS,
  RESULTADOS,
  servicoFalso,
} from "./dadosDeTeste";
import { montarRelatorio } from "./dadosDoRelatorio";
import { planilhaDosResultados } from "./exportarResultados";
import {
  DocumentoDaResposta,
  DocumentoDoRelatorio,
  RelatorioDaPesquisa,
  RelatorioDaResposta,
} from "./RelatorioImprimivel";

const HOJE = "2026-11-27";

const comId = (identificacao: Identificacao): PesquisaDetalhe => ({
  ...DETALHE,
  identificacao,
  ...(identificacao === "anonima" ? { participantes: null } : {}),
});

const relatorio = (
  identificacao: Identificacao,
  extra: { comAnalises?: boolean } = {},
) =>
  montarRelatorio({
    detalhe: comId(identificacao),
    geral: RESULTADOS,
    empresa: "Empresa Alfa",
    hoje: HOJE,
    respostas: identificacao === "confidencial" ? null : RESPOSTAS,
    analises: extra.comAnalises ? ANALISES : null,
  });

const SEGUNDA: RespostaDetalhe = {
  ...RESPOSTA_DETALHE,
  id: "r-2",
  numero: 2,
  colaboradorId: "c-2",
  nome: "Bruno Exemplo",
  departamento: "Financeiro",
  respondidaEm: "2026-11-21T12:00:00Z",
  media: 5.5,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dados do relatório", () => {
  it("média geral na escala de 10, faixas, favorável, eNPS e período", () => {
    const rel = relatorio("identificada");
    expect(rel.mediaGeral).toBe(8.5);
    expect(rel.faixaGeral).toBe("alta");
    expect(rel.favoravelGeral).toBe(100);
    expect(rel.enps).toMatchObject({
      indice: 50,
      zona: "qualidade",
      promotores: 5,
      total: 8,
    });
    expect(rel.enps!.porNota).toHaveLength(11);
    expect(rel.enps!.porNota[10]).toEqual({ nota: 10, quantidade: 5 });
    expect(rel.perguntas).toHaveLength(1);
    expect(rel.perguntas[0]).toMatchObject({
      texto: "Tenho clareza das prioridades.",
      media10: 8.5,
      favoravel: 100,
      neutro: 0,
      desfavoravel: 0,
    });
    expect(rel.periodo).toBe("20/11 – 21/11/2026");
    expect(rel.mesDeReferencia).toBe("Novembro de 2026");
    expect(rel.participacao).toBe(80);
  });

  it("comentários: autor só na identificada; nas outras, em ordem alfabética e sem autor", () => {
    const ident = relatorio("identificada").comentarios[0]!;
    expect(ident.textos[0]).toEqual({
      texto: "Mais retorno, por favor.",
      autor: "Pessoa Exemplo",
    });
    for (const id of ["confidencial", "anonima"] as const) {
      const c = relatorio(id).comentarios[0]!;
      expect(c.textos.map((t) => t.texto)).toEqual([
        "Mais clareza.",
        "Mais retorno, por favor.",
      ]);
      expect(c.textos.every((t) => t.autor === null)).toBe(true);
    }
  });

  it("alertas: grupo visível abaixo de 6,5 é Alta; grupo oculto nunca entra", () => {
    const rel = relatorio("anonima", { comAnalises: true });
    expect(rel.alertas).toEqual([
      expect.objectContaining({
        severidade: "Alta",
        onde: "Departamento",
        oQue: "Operações",
        media: 6.1,
      }),
    ]);
    expect(rel.departamentos).not.toBeNull();
    expect(relatorio("anonima").departamentos).toBeNull();
  });
});

describe("planilha (.xlsx)", () => {
  const abasDe = async (
    identificacao: Identificacao,
    respostas: RespostaDetalhe[] | null = [RESPOSTA_DETALHE, SEGUNDA],
  ) =>
    lerAbasXlsx(
      planilhaDosResultados(
        relatorio(identificacao, { comAnalises: true }),
        comId(identificacao),
        RESULTADOS,
        respostas,
      ),
    );

  it("as abas do relatório; a confidencial não tem Participantes", async () => {
    expect(Object.keys(await abasDe("identificada"))).toEqual([
      "Resumo",
      "Perguntas",
      "eNPS",
      "Participantes",
      "Comentários",
      "Alertas",
      "Metodologia",
    ]);
    const conf = await abasDe("confidencial");
    expect(Object.keys(conf)).not.toContain("Participantes");
    expect(JSON.stringify(conf)).not.toContain("Ana Exemplo");
    expect(JSON.stringify(conf)).not.toContain("Pessoa Exemplo");
  });

  it("resumo e perguntas: título, empresa, números como número e percentual como fração", async () => {
    const abas = await abasDe("identificada");
    const resumo = abas["Resumo"]!;
    expect(resumo[0]![0]).toBe("Resumo");
    expect(resumo[1]![0]).toBe("Empresa Alfa · Clima de novembro");
    const linha = (rotulo: string) => resumo.find((l) => l[0] === rotulo)!;
    expect(linha("Respostas")[1]).toBe("8");
    expect(linha("Taxa de participação")[1]).toBe("0.8");
    expect(linha("Média geral (de 0 a 10)").slice(1)).toEqual([
      "8.5",
      "Saudável · 8 ou mais",
    ]);
    expect(linha("Favorável")[1]).toBe("1");
    const perguntas = abas["Perguntas"]!;
    expect(perguntas[3]!.slice(0, 11)).toEqual([
      "#",
      "Pergunta",
      "Tema",
      "Escala",
      "Respostas",
      "Média",
      "Média (0 a 10)",
      "Faixa",
      "Favorável",
      "Neutro",
      "Desfavorável",
    ]);
    const conc = perguntas[4]!;
    expect(conc.slice(0, 9)).toEqual([
      "2",
      "Tenho clareza das prioridades.",
      "Tenho clareza das prioridades.",
      "1 a 5",
      "8",
      "4.3",
      "8.5",
      "Saudável · 8 ou mais",
      "1",
    ]);
    // Quantas respostas em cada nota (nota 4: 6; nota 5: 2).
    // Só as notas das escalas usadas (aqui, de 1 a 5): nada de "Nota 0".
    expect(perguntas[3]!.slice(11)).toEqual([
      "Nota 1",
      "Nota 2",
      "Nota 3",
      "Nota 4",
      "Nota 5",
    ]);
    expect(conc[11 + 3]).toBe("6");
    expect(conc[11 + 4]).toBe("2");
    expect(perguntas.at(-1)![1]).toBe("Média geral (média das perguntas)");
  });

  it("eNPS com a zona, os grupos e quantas pessoas deram cada nota", async () => {
    const enps = (await abasDe("confidencial"))["eNPS"]!;
    expect(enps.find((l) => l[0] === "eNPS" && l.length > 1)!.slice(1)).toEqual(
      ["50", "Zona de qualidade (de 50 a 74)"],
    );
    expect(enps.find((l) => l[0] === "Promotores (9 e 10)")!.slice(1)).toEqual([
      "5",
      "0.63",
    ]);
    const notas = enps.slice(enps.findIndex((l) => l[0] === "Nota") + 1);
    expect(notas).toHaveLength(11);
    expect(notas[10]!.slice(0, 2)).toEqual(["10", "5"]);
  });

  it("participantes: nome na identificada; na anônima, numerado, sem nome e grupo pequeno oculto", async () => {
    const ident = (await abasDe("identificada"))["Participantes"]!;
    expect(ident[3]!.slice(0, 3)).toEqual([
      "Nome",
      "Departamento",
      "Respondida em",
    ]);
    expect(ident[4]!.slice(0, 2)).toEqual(["Ana Exemplo", "Operações"]);
    const anon = (await abasDe("anonima"))["Participantes"]!;
    expect(anon[3]![0]).toBe("Participante");
    expect(anon[3]).not.toContain("Respondida em");
    // Sem "separar por", a anônima não leva grupo nenhum (só "—").
    expect(anon[4]!.slice(0, 2)).toEqual(["Participante 1", "—"]);
    expect(anon[5]!.slice(0, 2)).toEqual(["Participante 2", "—"]);
    expect(JSON.stringify(anon)).not.toContain("Exemplo");
  });

  it("comentários (autor só na identificada), alertas e metodologia", async () => {
    const ident = await abasDe("identificada");
    expect(ident["Comentários"]![3]).toEqual([
      "Pergunta",
      "Comentário",
      "Autor",
    ]);
    const anon = await abasDe("anonima");
    expect(anon["Comentários"]![3]).toEqual(["Pergunta", "Comentário"]);
    expect(JSON.stringify(anon["Comentários"])).not.toContain("Pessoa Exemplo");
    const alertas = anon["Alertas"]!;
    expect(alertas[4]!.slice(0, 5)).toEqual([
      "Alta",
      "Departamento",
      "Operações",
      "Operações",
      "6.1",
    ]);
    const metodologia = anon["Metodologia"]!.map((l) => l[0]);
    for (const tema of [
      "Escala",
      "Média geral",
      "Faixas da média",
      "eNPS",
      "Grupos pequenos",
      "Identificação",
    ])
      expect(metodologia).toContain(tema);
  });
});

describe("relatório em PDF (página imprimível)", () => {
  it("capa, sumário, seções 01–05 e rodapé paginado", () => {
    render(
      <DocumentoDoRelatorio
        rel={relatorio("confidencial", { comAnalises: true })}
      />,
    );
    expect(screen.getByText("Relatório de resultados")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Clima" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Empresa Alfa · 03/11 – 27/11/2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Média geral 8,5 de 0 a 10" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Saudável · 8 ou mais")).toBeInTheDocument();
    const sumario = screen.getByRole("list", { name: "Sumário" });
    expect(within(sumario).getAllByRole("listitem")).toHaveLength(5);
    for (const [n, titulo] of [
      ["01", "Resumo executivo"],
      ["02", "Resultados por pergunta"],
      ["03", "Por grupo"],
      ["04", "Evolução"],
      ["05", "Comentários e metodologia"],
    ])
      expect(
        screen.getByRole("region", { name: `${n} ${titulo}` }),
      ).toBeInTheDocument();
    expect(screen.getByText("5 / 5")).toBeInTheDocument();
    expect(
      screen.getAllByText("Documento confidencial · respostas confidenciais"),
    ).toHaveLength(4);
    expect(
      screen.getByText("Oculto · menos de 3 respostas"),
    ).toBeInTheDocument();
    // Confidencial: comentários sem autor.
    expect(screen.queryByText("Pessoa Exemplo")).toBeNull();
  });

  it("sem recorte, a seção de grupos sai e o sumário renumera", () => {
    render(<DocumentoDoRelatorio rel={relatorio("anonima")} />);
    expect(
      within(screen.getByRole("list", { name: "Sumário" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(4);
    expect(
      screen.getByRole("region", { name: "03 Evolução" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/primeira aplicação/)).toBeInTheDocument();
  });

  it("a rota imprime o documento com o nome do arquivo no título", async () => {
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    const servico = servicoFalso();
    render(
      <RelatorioDaPesquisa servico={servico} pesquisaId="p-1" hoje={HOJE} />,
    );
    expect(
      await screen.findByRole("list", { name: "Sumário" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("clima-de-novembro-resultados"),
    );
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    // Confidencial: nenhuma resposta individual é buscada.
    expect(servico.respostasDaPesquisa).not.toHaveBeenCalled();
  });

  it("resultado individual: capa no mesmo padrão e as respostas; anônima sem pessoa", () => {
    render(
      <DocumentoDaResposta
        detalhe={comId("anonima")}
        resposta={RESPOSTA_DETALHE}
        empresa="Empresa Alfa"
        hoje={HOJE}
      />,
    );
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Resposta anônima #1" }),
    ).toHaveLength(2);
    expect(
      screen.getByText(/^Identidade oculta · respondeu em/),
    ).toBeInTheDocument();
    expect(screen.getByText("Acima do time · 8,5")).toBeInTheDocument();
    expect(screen.getByText("Confidencial · anônima")).toBeInTheDocument();
    expect(screen.queryByText(/Ana Exemplo/)).toBeNull();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("na confidencial não há PDF de resposta individual", async () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <RelatorioDaResposta
        servico={servicoFalso()}
        pesquisaId="p-1"
        respostaId="r-1"
        imprimir={false}
      />,
    );
    expect(
      await screen.findByText("Não foi possível montar o relatório."),
    ).toBeInTheDocument();
  });
});
