/**
 * T216 — ligação da Avaliação 90°/180° e do Onboarding com as telas
 * compartilhadas: o link da rodada, o envio do onboarding pela rota própria
 * e a avaliação depois da identificação na página pública.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  criarClientePesquisaPublica,
  type ClientePesquisaPublica,
  type PesquisaPublica,
} from "../../../api/pesquisaPublicaClient";
import {
  rodadaDaPesquisaPublica,
  tokenDaPesquisaPublica,
} from "../../../app/rotaPublica";
import { ResponderPesquisa } from "../../publico/ResponderPesquisa";
import { secoesDaAvaliacao } from "./avaliacao/catalogo";
import { ehModeloComTelaPropria } from "./integracao";

const CPF_TESTE = "20743195841";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("T216 — ligação dos modelos com as telas do módulo", () => {
  it("só avaliação 90°/180° e onboarding têm tela própria", () => {
    expect(ehModeloComTelaPropria("avaliacao90")).toBe(true);
    expect(ehModeloComTelaPropria("avaliacao180")).toBe(true);
    expect(ehModeloComTelaPropria("onboarding")).toBe(true);
    expect(ehModeloComTelaPropria("pulso")).toBe(false);
    expect(ehModeloComTelaPropria("personalizada")).toBe(false);
  });

  it("o link do convite do onboarding leva a rodada", () => {
    expect(tokenDaPesquisaPublica("#/p/abc123?rodada=30")).toBe("abc123");
    expect(rodadaDaPesquisaPublica("#/p/abc123?rodada=30")).toBe(30);
    expect(rodadaDaPesquisaPublica("#/p/abc123")).toBeNull();
    expect(tokenDaPesquisaPublica("#/p/abc123?outra=1")).toBeNull();
    expect(tokenDaPesquisaPublica("#/p/abc123/?rodada=60")).toBe("abc123");
  });

  it("o envio do onboarding vai para a rota própria, com a rodada", async () => {
    const buscar = vi.fn(
      async (..._a: unknown[]) => new Response("{}", { status: 201 }),
    );
    const c = criarClientePesquisaPublica(buscar as unknown as typeof fetch);
    await c.enviarRespostas("tok", {
      respostas: [],
      onboarding: { rodada: 30 },
    });
    expect(buscar.mock.calls[0]![0]).toBe(
      "/v1/publico/pesquisas/tok/onboarding/respostas",
    );
    expect(
      JSON.parse((buscar.mock.calls[0]![1] as RequestInit).body as string),
    ).toEqual({
      respostas: [],
      rodada: 30,
    });
    await c.enviarRespostas("tok", {
      respostas: [],
      onboarding: { rodada: null },
    });
    expect(
      JSON.parse((buscar.mock.calls[1]![1] as RequestInit).body as string),
    ).toEqual({ respostas: [] });
    await c.enviarRespostas("tok", { respostas: [] });
    expect(buscar.mock.calls[2]![0]).toBe(
      "/v1/publico/pesquisas/tok/respostas",
    );
  });

  it("avaliação: depois do CPF, a lista de quem a pessoa avalia", async () => {
    const pesquisa: PesquisaPublica = {
      empresa: "Empresa Exemplo",
      nome: "Avaliação 90° – Ciclo 2026.2",
      boasVindas: null,
      modelo: "avaliacao90",
      identificacao: "identificada",
      totalPerguntas: 24,
      minutosEstimados: 8,
      secoes: secoesDaAvaliacao(),
    } as PesquisaPublica;
    const cliente: ClientePesquisaPublica = {
      abrir: vi.fn(async () => pesquisa),
      identificar: vi.fn(async () => ({
        passe: "passe-x",
        primeiroNome: "Gestora",
      })),
      enviarRespostas: vi.fn(async () => undefined),
    };
    const buscar = vi.fn(
      async (..._a: unknown[]) =>
        new Response(
          JSON.stringify({
            modelo: "avaliacao90",
            comentarios: "extremos",
            prazo: null,
            prazoAutoavaliacao: null,
            itens: [
              {
                parId: "par-1",
                papel: "gestor",
                avaliado: { nome: "Ana Teste", cargo: null },
                respondida: false,
                aberta: true,
                comparativo: null,
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", buscar);
    render(<ResponderPesquisa token="tok" cliente={cliente} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Iniciar pesquisa" }),
    );
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      await screen.findByRole("heading", { name: "Olá, Gestora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Avaliar Ana Teste" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(buscar).toHaveBeenCalled());
    expect(buscar.mock.calls[0]![0]).toBe(
      "/v1/publico/pesquisas/tok/avaliacao/pendentes",
    );
    expect(
      JSON.parse((buscar.mock.calls[0]![1] as RequestInit).body as string),
    ).toEqual({ passe: "passe-x" });
  });
});
