/**
 * T216 — modelos com tela própria (Avaliação 90°/180° e Onboarding) dentro
 * das telas compartilhadas: os resultados não desenham as abas, o painel e
 * o "Exportar" comuns (nem escondidos), só os da tela própria; o rascunho
 * nasce ao abrir o modelo, a rota passa a `<id>/rascunho` no lugar, e o
 * rascunho reabre no assistente próprio (ou é retomado pelo modelo).
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PesquisaDetalhe } from "../../../api/pesquisasClient";
import { DETALHE, RESUMO, lista, servicoFalso } from "../dadosDeTeste";
import { PesquisasModulo } from "../PesquisasModulo";
import type { RotaDePesquisas } from "../rotasDePesquisas";
import { ResultadosDaPesquisa } from "../ResultadosDaPesquisa";
import { clienteDaAvaliacao } from "./avaliacao/cliente";
import { clienteDoOnboarding } from "./onboarding/cliente";
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
      obter: vi.fn(async () => ({
        ...dados.avaliacaoDetalheFalsa(),
        modelo: "avaliacao90",
      })),
      organograma: vi.fn(async () => dados.organogramaFalso()),
      salvar: vi.fn(async () => dados.avaliacaoDetalheFalsa()),
    },
  };
});

vi.mock("./onboarding/gruposDoPublico", async (original) => {
  const real = await original<typeof import("./onboarding/gruposDoPublico")>();
  return {
    ...real,
    listarGruposDoPublico: vi.fn(async () => ({
      departamento: [],
      cargo: [],
      unidade: [],
      centroCusto: [],
    })),
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
      previaDoPublico: vi.fn(async () => ({
        total: 0,
        semEmail: 0,
        proximas: { 30: 0, 60: 0, 90: 0 },
        pessoas: [],
      })),
      salvar: vi.fn(async () => ({})),
      obter: vi.fn(async () => {
        const { CONFIG_PADRAO } =
          await import("./onboarding/regrasDoOnboarding");
        return { config: CONFIG_PADRAO };
      }),
    },
  };
});

afterEach(() => {
  localStorage.clear();
  vi.mocked(clienteDaAvaliacao.obter).mockClear();
  vi.mocked(clienteDoOnboarding.obter).mockClear();
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

describe("T216 — rascunho dos modelos com tela própria", () => {
  const semRascunhos = () =>
    servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([RESUMO]))),
    });

  function abrir(
    servico: ReturnType<typeof servicoFalso>,
    rota: RotaDePesquisas,
    onNavegar = vi.fn(),
  ) {
    const r = render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={rota}
        onNavegar={onNavegar}
      />,
    );
    const trocar = (nova: RotaDePesquisas) =>
      r.rerender(
        <PesquisasModulo
          servico={servico}
          podeEditar
          rota={nova}
          onNavegar={onNavegar}
        />,
      );
    return { onNavegar, trocar };
  }

  it.each([
    ["avaliacao90", "Nova Avaliação 90°"],
    ["avaliacao180", "Nova Avaliação 180°"],
    ["onboarding", "Nova pesquisa de Onboarding"],
  ])(
    "%s: grava ao abrir e a rota passa a <id>/rascunho, com o mesmo assistente",
    async (modelo, titulo) => {
      const servico = semRascunhos();
      const { onNavegar, trocar } = abrir(servico, { tela: "modelo", modelo });
      expect(
        await screen.findByRole("heading", { level: 1, name: titulo }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(onNavegar).toHaveBeenLastCalledWith(
          { tela: "rascunho", id: "p-novo" },
          { substituir: true },
        ),
      );
      expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
      trocar({ tela: "rascunho", id: "p-novo" });
      expect(
        screen.getByRole("heading", { level: 1, name: titulo }),
      ).toBeInTheDocument();
      expect(servico.obterPesquisa).not.toHaveBeenCalledWith("p-novo");
      expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
    },
  );

  it("o rascunho do mesmo modelo é retomado (sem criar outro)", async () => {
    const rascunho = {
      ...RESUMO,
      id: "p-r",
      modelo: "avaliacao90" as const,
      status: "rascunho" as const,
    };
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([rascunho]))),
    });
    const { onNavegar } = abrir(servico, {
      tela: "modelo",
      modelo: "avaliacao90",
    });
    await waitFor(() =>
      expect(onNavegar).toHaveBeenCalledWith(
        { tela: "rascunho", id: "p-r" },
        { substituir: true },
      ),
    );
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
  });

  it("reabrir <id>/rascunho: a avaliação volta com o nome e a configuração", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({
          ...DETALHE,
          id: "p-r",
          nome: "Ciclo retomado",
          modelo: "avaliacao90",
          identificacao: "identificada",
          status: "rascunho",
          boasVindas: null,
        } as PesquisaDetalhe),
      ),
    });
    abrir(servico, { tela: "rascunho", id: "p-r" });
    expect(await screen.findByLabelText("Nome da avaliação")).toHaveValue(
      "Ciclo retomado",
    );
    await waitFor(() =>
      expect(clienteDaAvaliacao.obter).toHaveBeenCalledWith("p-r"),
    );
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
  });

  it("reabrir <id>/rascunho: o onboarding volta com o nome gravado", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({
          ...DETALHE,
          id: "p-o",
          nome: "Onboarding retomado",
          modelo: "onboarding",
          identificacao: "confidencial",
          status: "rascunho",
          secoes: [],
        } as PesquisaDetalhe),
      ),
    });
    abrir(servico, { tela: "rascunho", id: "p-o" });
    expect(await screen.findByLabelText("Nome")).toHaveValue(
      "Onboarding retomado",
    );
    await waitFor(() =>
      expect(clienteDoOnboarding.obter).toHaveBeenCalledWith("p-o"),
    );
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
  });
});
