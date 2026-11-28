/**
 * T216 — modelos com tela própria (Avaliação 90°/180° e Onboarding) dentro
 * das telas compartilhadas: os resultados não desenham as abas, o painel e
 * o "Exportar" comuns (nem escondidos), só os da tela própria.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PesquisaDetalhe } from "../../../api/pesquisasClient";
import { DETALHE, servicoFalso } from "../dadosDeTeste";
import { ResultadosDaPesquisa } from "../ResultadosDaPesquisa";
import {
  avaliacaoDetalheFalsa,
  resultadosFalsos,
} from "./avaliacao/dadosDeTeste";

vi.mock("./avaliacao/cliente", async (original) => {
  const real = await original<typeof import("./avaliacao/cliente")>();
  const dados = await import("./avaliacao/dadosDeTeste");
  return {
    ...real,
    clienteDaAvaliacao: {
      ...real.clienteDaAvaliacao,
      resultados: vi.fn(async () => dados.resultadosFalsos()),
      obter: vi.fn(async () => dados.avaliacaoDetalheFalsa()),
    },
  };
});

vi.mock("./onboarding/cliente", async (original) => {
  const real = await original<typeof import("./onboarding/cliente")>();
  return {
    ...real,
    clienteDoOnboarding: {
      ...real.clienteDoOnboarding,
      resultados: vi.fn(async () => ({
        pesquisaId: "p-1",
        identificacao: "confidencial",
        respostas: 0,
        filtro: null,
        rodadas: [],
        comparacoes: [],
        peso: { suficiente: false, blocos: [] },
        fluxo: null,
        contatos: [],
        melhorar: [],
        gosta: [],
        funil: {
          noPublico: 0,
          semEmail: 0,
          aguardandoEmail: 0,
          enviados: 0,
          responderam: 0,
          pulados: 0,
          agendados: 0,
        },
        grupos: {},
      })),
      envios: vi.fn(async () => ({
        identificacao: "confidencial",
        horario: "09:00",
        itens: [],
      })),
    },
  };
});

function montar(extra: Partial<PesquisaDetalhe>) {
  const servico = servicoFalso({
    obterPesquisa: vi.fn(() =>
      Promise.resolve({ ...DETALHE, ...extra } as PesquisaDetalhe),
    ),
  });
  return render(
    <ResultadosDaPesquisa
      servico={servico}
      pesquisaId="p-1"
      podeEditar
      onVoltar={vi.fn()}
      onEditar={vi.fn()}
    />,
  );
}

describe("T216 — resultados dos modelos com tela própria", () => {
  it("avaliação: só as abas e o Exportar da avaliação, uma vez", async () => {
    const { container } = montar({
      modelo: "avaliacao90",
      identificacao: "identificada",
    });
    expect(
      await screen.findByRole("tablist", { name: "Resultados da avaliação" }),
    ).toBeInTheDocument();
    // As comuns não existem nem escondidas.
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Exportar", hidden: true }),
    ).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Exportar Excel (.xlsx)" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Exportar PDF" }),
    ).toHaveLength(1);
    // Sanidade dos dados simulados.
    expect(resultadosFalsos().pessoas.length).toBeGreaterThan(0);
    expect(avaliacaoDetalheFalsa().times.length).toBeGreaterThan(0);
  });

  it("onboarding: só as abas e o Exportar do onboarding, uma vez", async () => {
    const { container } = montar({ modelo: "onboarding" });
    expect(
      await screen.findByRole("tablist", { name: "Resultados do onboarding" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Exportar", hidden: true }),
    ).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Exportar PDF" }),
    ).toHaveLength(1);
  });

  it("os demais modelos seguem com as abas e o Exportar comuns", async () => {
    const { container } = montar({ modelo: "clima" });
    expect(
      await screen.findByRole("tablist", { name: "Resultados" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Exportar" }),
    ).toBeInTheDocument();
  });
});
