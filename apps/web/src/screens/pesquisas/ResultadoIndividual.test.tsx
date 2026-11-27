/**
 * T216 — resultado individual: título (nome ou "Resposta anônima #N"),
 * indicadores comparados com o time, cada pergunta com a régua e a
 * diferença, paginação entre respostas, aba Respostas e exportar.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baixarArquivo } from "../dashboard/exportacao";
import { DETALHE, RESPOSTA_DETALHE, servicoFalso } from "./dadosDeTeste";
import { PaginaDaResposta, ResultadoIndividual } from "./ResultadoIndividual";

vi.mock("../dashboard/exportacao", async (original) => {
  const actual = await original<typeof import("../dashboard/exportacao")>();
  return { ...actual, baixarArquivo: vi.fn() };
});

beforeEach(() => {
  vi.mocked(baixarArquivo).mockClear();
});

describe("Resultado individual", () => {
  it("identificada: nome, indicadores e comparação com o time", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({ ...DETALHE, identificacao: "identificada" as const }),
      ),
    });
    render(
      <ResultadoIndividual
        servico={servico}
        pesquisaId="p-1"
        respostaId="r-1"
        onVoltar={vi.fn()}
        onIr={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ana Exemplo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Operações · respondeu em 20\/11\/2026 às 11:23/),
    ).toBeInTheDocument();
    const ind = screen.getByRole("region", { name: "Indicadores da resposta" });
    expect(ind).toHaveTextContent("Média geral10,0 /10");
    expect(ind).toHaveTextContent("+1,5 acima do time (8,5)");
    expect(ind).toHaveTextContent(
      "Recomendação10 /10Promotor · eNPS do time 50",
    );
    const tabela = screen.getByRole("table", { name: "Comparação com o time" });
    const [, linha] = within(tabela).getAllByRole("row");
    expect(linha).toHaveTextContent("Tenho clareza das prioridades.");
    expect(linha).toHaveTextContent("5,0 /5");
    expect(linha).toHaveTextContent("+0,8time 4,3");
  });

  it("faixa da média, últimos pulsos, comentário livre e o seletor de respostas", async () => {
    const onIr = vi.fn();
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({ ...DETALHE, identificacao: "identificada" as const }),
      ),
      respostaDaPesquisa: vi.fn(() =>
        Promise.resolve({
          ...RESPOSTA_DETALHE,
          indicadores: {
            ...RESPOSTA_DETALHE.indicadores,
            mediaUltimosPulsos: 7.5,
          },
        }),
      ),
    });
    render(
      <ResultadoIndividual
        servico={servico}
        pesquisaId="p-1"
        respostaId="r-1"
        onVoltar={vi.fn()}
        onIr={onIr}
      />,
    );
    const ind = await screen.findByRole("region", {
      name: "Indicadores da resposta",
    });
    expect(ind).toHaveTextContent("Média geral10,0 /108 ou mais");
    expect(ind).toHaveTextContent("Média nos últimos pulsos7,5 /10");
    expect(ind).toHaveTextContent("Comentário livreNenhum comentário deixado.");
    // "1 de 2 ⌄": todas as respostas, da mais recente, com a média.
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Resposta 1 de 2. Escolher outra",
      }),
      { button: 0, ctrlKey: false },
    );
    const itens = await screen.findAllByRole("menuitem");
    expect(itens.map((i) => i.textContent)).toEqual([
      "Bruno ExemploMédia 5,5",
      "Ana ExemploMédia 9,0",
    ]);
    fireEvent.click(itens[0]!);
    expect(onIr).toHaveBeenCalledWith("r-2");
    // Aba Respostas: cada escala com a régua e a nota marcada na cor da faixa.
    fireEvent.click(screen.getByRole("tab", { name: /Respostas/ }));
    const marcadas = document.querySelectorAll("[data-marcado]");
    expect([...marcadas].map((m) => m.textContent)).toEqual(["10", "5"]);
    expect(marcadas[0]).toHaveAttribute("data-faixa", "alta");
  });

  it("anônima: numerada e sem pessoa; paginação entre respostas", async () => {
    const onIr = vi.fn();
    render(
      <PaginaDaResposta
        nomeDaPesquisa="Pulso"
        identificacao="anonima"
        secoes={DETALHE.secoes}
        respostaId="r-1"
        carregar={() => Promise.resolve({ ...RESPOSTA_DETALHE, nome: null })}
        rotuloVoltar="Voltar"
        onVoltar={vi.fn()}
        onIr={onIr}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Resposta anônima #1",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Identidade oculta · respondeu em/),
    ).toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resposta anterior" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima resposta" }));
    expect(onIr).toHaveBeenCalledWith("r-2");
  });

  it("aba Respostas e exportar em PDF", async () => {
    render(
      <PaginaDaResposta
        nomeDaPesquisa="Pulso"
        identificacao="identificada"
        secoes={DETALHE.secoes}
        respostaId="r-1"
        carregar={() => Promise.resolve(RESPOSTA_DETALHE)}
        rotuloVoltar="Voltar"
        onVoltar={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Respostas/ }));
    expect(
      screen.getByRole("region", { name: "Respostas de Ana Exemplo" }),
    ).toHaveTextContent("Outro: Mural");
    expect(
      screen.queryByRole("navigation", { name: "Outras respostas" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
    expect(vi.mocked(baixarArquivo).mock.calls[0]![2]).toBe("application/pdf");
  });
});
