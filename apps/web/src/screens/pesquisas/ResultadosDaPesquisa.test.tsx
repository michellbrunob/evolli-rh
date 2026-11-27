/**
 * T216 — resultados de uma pesquisa: cabeçalho com status, Visão geral
 * (eNPS, médias, escolhas, sim/não, textos), Por departamento com o mínimo
 * por grupo, Respostas só na identificada e o CSV que respeita a
 * identificação. Servidor simulado; dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baixarArquivo } from "../dashboard/exportacao";
import { DETALHE, RESULTADOS, servicoFalso } from "./dadosDeTeste";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";

vi.mock("../dashboard/exportacao", async (original) => {
  const actual = await original<typeof import("../dashboard/exportacao")>();
  return { ...actual, baixarArquivo: vi.fn() };
});

const abrirMenu = (nome: string | RegExp) =>
  fireEvent.pointerDown(screen.getByRole("button", { name: nome }), {
    button: 0,
    ctrlKey: false,
  });

beforeEach(() => {
  vi.mocked(baixarArquivo).mockClear();
});

function montar(
  extra: Parameters<typeof servicoFalso>[0] = {},
  podeEditar = true,
) {
  const servico = servicoFalso(extra);
  const onEditar = vi.fn();
  render(
    <ResultadosDaPesquisa
      servico={servico}
      pesquisaId="p-1"
      podeEditar={podeEditar}
      onVoltar={vi.fn()}
      onEditar={onEditar}
    />,
  );
  return { servico, onEditar };
}

const identificada = {
  obterPesquisa: vi.fn(() =>
    Promise.resolve({ ...DETALHE, identificacao: "identificada" as const }),
  ),
};

describe("Resultados — cabeçalho e visão geral", () => {
  it("cabeçalho com modelo, criação, identificação e participação", async () => {
    montar();
    const cabecalho = await screen.findByRole("region", {
      name: "Sobre a pesquisa",
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Clima de novembro" }),
    ).toBeInTheDocument();
    expect(cabecalho).toHaveTextContent("Clima");
    expect(cabecalho).toHaveTextContent("02/11/2026");
    expect(cabecalho).toHaveTextContent("Confidencial");
    expect(cabecalho).toHaveTextContent("8 de 10 · 80%");
  });

  it("eNPS com promotores, neutros, detratores e o índice", async () => {
    montar();
    const enps = await screen.findByRole("region", { name: "eNPS" });
    expect(enps).toHaveTextContent("50");
    expect(enps).toHaveTextContent("Promotores (9–10)5 · 63%");
    expect(enps).toHaveTextContent("Neutros (7–8)2 · 25%");
    expect(enps).toHaveTextContent("Detratores (0–6)1 · 13%");
  });

  it("médias, sim/não, escolhas e textos sem autor fora da identificada", async () => {
    montar();
    const conc = await screen.findByRole("region", {
      name: "2. Tenho clareza das prioridades.",
    });
    expect(conc).toHaveTextContent("Média 4,3");
    const sim = screen.getByRole("region", { name: "3. Recomendaria a área?" });
    expect(sim).toHaveTextContent("Sim6 · 75%");
    expect(sim).toHaveTextContent("Não2 · 25%");
    const esc = screen.getByRole("region", {
      name: "4. Qual canal você prefere?",
    });
    expect(esc).toHaveTextContent("Reunião5 · 63%");
    expect(esc).toHaveTextContent("Mural");
    const txt = screen.getByRole("region", { name: "5. Comentários" });
    expect(txt).toHaveTextContent("Mais retorno, por favor.");
    expect(txt).toHaveTextContent("2 pessoas viram esta pergunta");
    expect(txt).not.toHaveTextContent("Pessoa Exemplo");
  });

  it("na identificada, o texto mostra quem escreveu", async () => {
    montar(identificada);
    const txt = await screen.findByRole("region", { name: "5. Comentários" });
    expect(txt).toHaveTextContent("Pessoa Exemplo");
  });

  it("recorte abaixo do mínimo: 'Poucas respostas para mostrar'", async () => {
    const { servico } = montar({
      resultadosDaPesquisa: vi.fn((_id: string, dep?: string | null) =>
        Promise.resolve(
          dep
            ? {
                ...RESULTADOS,
                filtro: { departamentoId: dep, visivel: false },
                perguntas: [],
              }
            : RESULTADOS,
        ),
      ),
    });
    await screen.findByRole("region", { name: "eNPS" });
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(screen.getByRole("option", { name: /Financeiro/ }));
    expect(
      await screen.findByText("Poucas respostas para mostrar"),
    ).toBeInTheDocument();
    expect(servico.resultadosDaPesquisa).toHaveBeenLastCalledWith("p-1", "d-2");
    expect(screen.queryByRole("region", { name: "eNPS" })).toBeNull();
  });
});

describe("Resultados — por departamento e respostas", () => {
  it("só os departamentos visíveis têm médias; os demais escondem os números", async () => {
    const { servico } = montar({
      resultadosDaPesquisa: vi.fn((_id: string, dep?: string | null) =>
        Promise.resolve({
          ...RESULTADOS,
          filtro: { departamentoId: dep ?? null, visivel: true },
          perguntas: dep
            ? RESULTADOS.perguntas.map((p) =>
                p.perguntaId === "q-conc" ? { ...p, media: 3.5 } : p,
              )
            : RESULTADOS.perguntas,
        }),
      ),
    });
    await screen.findByRole("region", { name: "eNPS" });
    fireEvent.click(screen.getByRole("tab", { name: "Por departamento" }));
    const tabela = await screen.findByRole("table", {
      name: "Médias por departamento",
    });
    const [, operacoes, financeiro] = within(tabela).getAllByRole("row");
    await waitFor(() => expect(operacoes).toHaveTextContent("3,5"));
    expect(operacoes).toHaveTextContent("Operações");
    expect(financeiro).toHaveTextContent("Poucas respostas para mostrar");
    expect(servico.resultadosDaPesquisa).toHaveBeenCalledWith("p-1", "d-1");
    expect(servico.resultadosDaPesquisa).not.toHaveBeenCalledWith("p-1", "d-2");
  });

  it("aba Respostas só na identificada e só para quem opera", async () => {
    const { servico } = montar();
    await screen.findByRole("region", { name: "eNPS" });
    expect(screen.queryByRole("tab", { name: "Respostas" })).toBeNull();
    expect(servico.respostasDaPesquisa).not.toHaveBeenCalled();
  });

  it("na identificada, a aba Respostas lista cada pessoa e as respostas dela", async () => {
    const { servico } = montar({
      ...identificada,
      respostasDaPesquisa: vi.fn(() =>
        Promise.resolve([
          {
            colaboradorId: "c-1",
            nome: "Ana Exemplo",
            departamento: "Operações",
            respondidaEm: "2026-11-20T12:00:00Z",
            valores: [
              { perguntaId: "q-nota", valor: 9 },
              { perguntaId: "q-esc", valor: { outro: "Mural" } },
            ],
          },
        ]),
      ),
    });
    fireEvent.click(await screen.findByRole("tab", { name: "Respostas" }));
    const pessoa = await screen.findByRole("button", { name: /Ana Exemplo/ });
    expect(pessoa).toHaveTextContent("20/11/2026");
    fireEvent.click(pessoa);
    const respostas = screen.getByRole("region", {
      name: "Respostas de Ana Exemplo",
    });
    expect(respostas).toHaveTextContent("Quanto você indicaria a empresa?9");
    expect(respostas).toHaveTextContent("Outro: Mural");
    expect(servico.respostasDaPesquisa).toHaveBeenCalledWith("p-1");
  });

  it("master técnico: sem menu de status, sem Editar e sem Respostas", async () => {
    montar(identificada, false);
    await screen.findByRole("region", { name: "eNPS" });
    expect(screen.queryByRole("button", { name: /Mudar status/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Respostas" })).toBeNull();
  });
});

describe("Resultados — status e CSV", () => {
  it("pausar muda o status direto; finalizar pede confirmação", async () => {
    const { servico } = montar();
    await screen.findByRole("region", { name: "eNPS" });
    abrirMenu(/Mudar status/);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Pausada" }));
    await waitFor(() =>
      expect(servico.alterarStatusDaPesquisa).toHaveBeenCalledWith(
        "p-1",
        "pausada",
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Status alterado para Pausada.",
    );

    abrirMenu(/Mudar status/);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Finalizada" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Finalizar a pesquisa?",
    });
    expect(janela).toHaveTextContent("não volta a ficar ativa");
    expect(servico.alterarStatusDaPesquisa).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(janela).getByRole("button", { name: "Finalizar pesquisa" }),
    );
    await waitFor(() =>
      expect(servico.alterarStatusDaPesquisa).toHaveBeenLastCalledWith(
        "p-1",
        "finalizada",
      ),
    );
  });

  it("CSV do resumo na confidencial nunca leva autor", async () => {
    montar();
    await screen.findByRole("region", { name: "eNPS" });
    abrirMenu("Exportar CSV");
    expect(
      screen.queryByRole("menuitem", { name: /Respostas por pessoa/ }),
    ).toBeNull();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Resumo por pergunta/ }),
    );
    expect(baixarArquivo).toHaveBeenCalledTimes(1);
    const [csv, nome] = vi.mocked(baixarArquivo).mock.calls[0]!;
    expect(nome).toBe("clima-de-novembro-resumo.csv");
    expect(String(csv)).toContain("Mais retorno, por favor.");
    expect(String(csv)).not.toContain("Pessoa Exemplo");
  });

  it("CSV por pessoa na identificada leva nome e respostas", async () => {
    montar({
      ...identificada,
      respostasDaPesquisa: vi.fn(() =>
        Promise.resolve([
          {
            colaboradorId: "c-1",
            nome: "Ana Exemplo",
            departamento: "Operações",
            respondidaEm: "2026-11-20T12:00:00Z",
            valores: [{ perguntaId: "q-sim", valor: "sim" }],
          },
        ]),
      ),
    });
    await screen.findByRole("region", { name: "eNPS" });
    abrirMenu("Exportar CSV");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Respostas por pessoa/ }),
    );
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalledTimes(1));
    const [csv, nome] = vi.mocked(baixarArquivo).mock.calls[0]!;
    expect(nome).toBe("clima-de-novembro-respostas.csv");
    expect(String(csv)).toContain("Ana Exemplo;Operações;20/11/2026");
    expect(String(csv)).toContain("Sim");
  });
});
