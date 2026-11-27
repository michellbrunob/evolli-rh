/**
 * T216 — ficha › aba Pesquisas: o cartão "Pesquisas respondidas" (só
 * identificadas), o resultado individual da pessoa ao abrir e o estado vazio
 * que explica por que confidenciais e anônimas nunca aparecem.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/colaboradoresClient";
import type { PesquisaDaFicha } from "../../../../api/pesquisasClient";
import { RESPOSTA_DETALHE, SECOES } from "../../../pesquisas/dadosDeTeste";
import { AbaPesquisas } from "./AbaPesquisas";

const RESPONDIDA: PesquisaDaFicha = {
  pesquisaId: "p-1",
  nome: "Onboarding de outubro",
  modelo: "onboarding",
  respondidaEm: "2026-10-30T15:00:00Z",
  secoes: SECOES,
  valores: [
    { perguntaId: "q-nota", valor: 8 },
    { perguntaId: "q-sim", valor: "nao" },
    { perguntaId: "q-txt", valor: "Faltou o crachá." },
  ],
};

const montar = (carregar: () => Promise<PesquisaDaFicha[]>) =>
  render(
    <AbaPesquisas
      colaboradorId="c-1"
      primeiroNome="Ana"
      carregar={vi.fn(carregar)}
    />,
  );

describe("AbaPesquisas (T216)", () => {
  it("cartão com a lista; abrir sem resultado individual mostra as respostas", async () => {
    montar(() => Promise.resolve([RESPONDIDA]));
    const cartao = await screen.findByRole("region", {
      name: "Pesquisas respondidas",
    });
    expect(cartao).toHaveTextContent("1 pesquisa identificada");
    const item = within(cartao).getByRole("button", {
      name: /Onboarding de outubro/,
    });
    expect(item).toHaveTextContent(
      "Onboarding · 30 dias · respondida em 30/10/2026",
    );
    fireEvent.click(item);
    const respostas = screen.getByRole("region", {
      name: "Respostas de Onboarding de outubro",
    });
    // Escala: a régua inteira, com a nota marcada (e lida como texto).
    expect(respostas).toHaveTextContent(
      "Quanto você indicaria a empresa?Nota 8 de 10",
    );
    const marcada = respostas.querySelector("[data-marcado]");
    expect(marcada).toHaveTextContent("8");
    expect(marcada).toHaveAttribute("data-faixa", "alta");
    expect(respostas).toHaveTextContent("Recomendaria a área?Não");
    expect(respostas).toHaveTextContent("Faltou o crachá.");
    expect(respostas).toHaveTextContent("Qual canal você prefere?Sem resposta");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Voltar para as pesquisas respondidas",
      }),
    );
    expect(
      await screen.findByRole("region", { name: "Pesquisas respondidas" }),
    ).toBeInTheDocument();
  });

  it("com o resultado individual da API, abre a mesma página dos resultados", async () => {
    const carregarResposta = vi.fn(() => Promise.resolve(RESPOSTA_DETALHE));
    render(
      <AbaPesquisas
        colaboradorId="c-1"
        primeiroNome="Ana"
        carregar={vi.fn(() =>
          Promise.resolve([{ ...RESPONDIDA, respostaId: "r-1" }]),
        )}
        carregarResposta={carregarResposta}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Onboarding de outubro/ }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ana Exemplo" }),
    ).toBeInTheDocument();
    expect(carregarResposta).toHaveBeenCalledWith("p-1", "r-1");
    expect(
      screen.getByRole("region", { name: "Indicadores da resposta" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Outras respostas" }),
    ).toBeNull();
  });

  it("vazio dentro do cartão explica que só identificadas aparecem", async () => {
    montar(() => Promise.resolve([]));
    expect(
      await screen.findByRole("region", { name: "Pesquisas respondidas" }),
    ).toHaveTextContent("Nenhuma pesquisa respondida até agora");
    expect(
      await screen.findByText("Nenhuma pesquisa respondida"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Aparecem aqui só as pesquisas identificadas que Ana respondeu/,
      ),
    ).toHaveTextContent(
      "confidenciais e anônimas nunca ficam ligadas à pessoa",
    );
  });

  it("sem permissão, diz quem vê as respostas", async () => {
    montar(() => Promise.reject(new ApiError(403, "negado")));
    expect(
      await screen.findByText(/ficam visíveis só para o RH e o DP/),
    ).toHaveAttribute("role", "status");
  });

  it("falha diferente de permissão é erro", async () => {
    montar(() => Promise.reject(new Error("rede")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as pesquisas.",
    );
  });
});
