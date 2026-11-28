/**
 * T216 — o marcador `{empresa}` dos textos dos modelos nunca aparece cru
 * no painel: resultados (Visão geral, Análises, Respostas e resultado
 * individual), na ficha, na planilha e no relatório em PDF. No painel, o
 * marcador vira "nossa empresa"; a pesquisa gravada fica como está.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalisesPesquisa,
  PesquisaDetalhe,
} from "../../api/pesquisasClient";
import { baixarArquivo } from "../dashboard/exportacao";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import {
  ANALISES,
  DETALHE,
  RESPOSTA_DETALHE,
  servicoFalso,
} from "./dadosDeTeste";
import { detalheParaOPainel } from "./modelos/empresa";
import {
  RelatorioDaPesquisa,
  RelatorioDaResposta,
} from "./RelatorioImprimivel";
import { RespostasDaPessoa } from "./RespostasDaPessoa";
import { PaginaDaResposta, ResultadoIndividual } from "./ResultadoIndividual";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";

vi.mock("../dashboard/exportacao", async (original) => {
  const actual = await original<typeof import("../dashboard/exportacao")>();
  return { ...actual, baixarArquivo: vi.fn() };
});

beforeEach(() => {
  vi.mocked(baixarArquivo).mockClear();
});

const COM_MARCADOR: PesquisaDetalhe = {
  ...DETALHE,
  identificacao: "identificada",
  secoes: DETALHE.secoes.map((s) => ({
    ...s,
    perguntas: s.perguntas.map((p) =>
      p.id === "q-nota"
        ? { ...p, texto: "Quanto você indicaria a {empresa}?" }
        : p.id === "q-conc"
          ? { ...p, texto: "Tenho orgulho da {empresa}." }
          : p,
    ),
  })),
};

const ANALISES_COM_MARCADOR: AnalisesPesquisa = {
  ...ANALISES,
  colunas: [{ perguntaId: "q-conc", rotulo: "Orgulho da {empresa}" }],
};

const servico = () =>
  servicoFalso({
    obterPesquisa: vi.fn(() => Promise.resolve(COM_MARCADOR)),
    analisesDaPesquisa: vi.fn(() => Promise.resolve(ANALISES_COM_MARCADOR)),
  });

const semMarcador = () =>
  expect(document.body.textContent ?? "").not.toContain("{empresa}");

describe("{empresa} no painel", () => {
  it("detalheParaOPainel troca o marcador nas perguntas e não muda o original", () => {
    const d = detalheParaOPainel(COM_MARCADOR);
    const textos = d.secoes.flatMap((s) => s.perguntas.map((p) => p.texto));
    expect(textos).toContain("Tenho orgulho da nossa empresa.");
    expect(textos).toContain("Quanto você indicaria a nossa empresa?");
    expect(JSON.stringify(d)).not.toContain("{empresa}");
    expect(COM_MARCADOR.secoes[0]!.perguntas[1]!.texto).toBe(
      "Tenho orgulho da {empresa}.",
    );
  });

  it("Visão geral e Análises: o texto da pergunta e o rótulo da coluna", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servico()}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    expect(
      screen.getAllByText("Tenho orgulho da nossa empresa.").length,
    ).toBeGreaterThan(0);
    semMarcador();
    fireEvent.click(screen.getByRole("tab", { name: /Análises/ }));
    const mapa = await screen.findByRole("table", {
      name: "Médias por departamento",
    });
    expect(mapa).toHaveTextContent("Orgulho da nossa empresa");
    semMarcador();
  });

  it("Editar recebe a pesquisa como foi gravada (com o marcador)", async () => {
    const onEditar = vi.fn();
    render(
      <ResultadosDaPesquisa
        servico={servico()}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={onEditar}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEditar).toHaveBeenCalledWith(COM_MARCADOR);
  });

  it("planilha (.xlsx): nenhuma aba com o marcador", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servico()}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Exportar" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excel/ }));
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalledTimes(1));
    const [bytes] = vi.mocked(baixarArquivo).mock.calls[0]!;
    const abas = JSON.stringify(await lerAbasXlsx(bytes as Uint8Array));
    expect(abas).toContain("Tenho orgulho da nossa empresa.");
    expect(abas).not.toContain("{empresa}");
  });

  it("resultado individual e a aba Respostas", async () => {
    render(
      <ResultadoIndividual
        servico={servico()}
        pesquisaId="p-1"
        respostaId="r-1"
        onVoltar={vi.fn()}
        onLista={vi.fn()}
        onIr={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "Ana Exemplo" });
    expect(
      screen.getByRole("table", { name: "Comparação com o time" }),
    ).toHaveTextContent("Tenho orgulho da nossa empresa.");
    semMarcador();
    fireEvent.click(screen.getByRole("tab", { name: /Respostas/ }));
    expect(
      screen.getByRole("region", { name: "Respostas de Ana Exemplo" }),
    ).toHaveTextContent("Tenho orgulho da nossa empresa.");
    semMarcador();
  });

  it("a página da resposta aberta pela ficha (seções como gravadas)", async () => {
    render(
      <PaginaDaResposta
        nomeDaPesquisa="Pulso"
        identificacao="identificada"
        secoes={COM_MARCADOR.secoes}
        respostaId="r-1"
        carregar={() => Promise.resolve(RESPOSTA_DETALHE)}
        rotuloVoltar="Voltar"
        onVoltar={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("table", { name: "Comparação com o time" }),
    ).toHaveTextContent("Tenho orgulho da nossa empresa.");
    semMarcador();
  });

  it("as respostas da pessoa (ficha) trocam o marcador", () => {
    render(
      <RespostasDaPessoa
        rotulo="Respostas"
        secoes={COM_MARCADOR.secoes}
        valores={RESPOSTA_DETALHE.valores}
      />,
    );
    expect(screen.getByRole("region", { name: "Respostas" })).toHaveTextContent(
      "Quanto você indicaria a nossa empresa?",
    );
    semMarcador();
  });

  it("relatório em PDF: o geral e o da resposta", async () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    const { unmount } = render(
      <RelatorioDaPesquisa
        servico={servico()}
        pesquisaId="p-1"
        hoje="2026-11-27"
      />,
    );
    await screen.findByRole("list", { name: "Sumário" });
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        "Tenho orgulho da nossa empresa.",
      ),
    );
    semMarcador();
    unmount();
    render(
      <RelatorioDaResposta
        servico={servico()}
        pesquisaId="p-1"
        respostaId="r-1"
        imprimir={false}
      />,
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        "Tenho orgulho da nossa empresa.",
      ),
    );
    semMarcador();
    vi.restoreAllMocks();
  });
});
