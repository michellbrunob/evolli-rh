/**
 * T216 — ficha › aba Pesquisas: "Pesquisas respondidas" (só identificadas),
 * as respostas da pessoa ao abrir e o estado vazio que explica por que
 * confidenciais e anônimas nunca aparecem. Dados sintéticos.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/colaboradoresClient";
import type { PesquisaDaFicha } from "../../../../api/pesquisasClient";
import { SECOES } from "../../../pesquisas/dadosDeTeste";
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
  it("lista as pesquisas respondidas e abre as respostas da pessoa", async () => {
    montar(() => Promise.resolve([RESPONDIDA]));
    expect(
      await screen.findByRole("heading", { name: "Pesquisas respondidas" }),
    ).toBeInTheDocument();
    const item = screen.getByRole("button", { name: /Onboarding de outubro/ });
    expect(item).toHaveTextContent(
      "Onboarding · 30 dias · respondida em 30/10/2026",
    );
    expect(item).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(item);
    expect(item).toHaveAttribute("aria-expanded", "true");
    const respostas = screen.getByRole("region", {
      name: "Respostas de Onboarding de outubro",
    });
    expect(respostas).toHaveTextContent("Quanto você indicaria a empresa?8");
    expect(respostas).toHaveTextContent("Recomendaria a área?Não");
    expect(respostas).toHaveTextContent("Faltou o crachá.");
    expect(respostas).toHaveTextContent("Qual canal você prefere?Sem resposta");
  });

  it("vazio explica que só identificadas aparecem", async () => {
    montar(() => Promise.resolve([]));
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
