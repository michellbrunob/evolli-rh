/**
 * T198 — a ficha unificada do colaborador no shell: rota própria por
 * colaborador e por aba (D17, D18), aberta pela linha da listagem ou pela URL,
 * recarregável, com "voltar" e "avançar" do navegador, e a mesma validação de
 * capacidade de qualquer rota — quem não abre Colaboradores não abre a ficha.
 *
 * A página em si (cabeçalho, estados, abas) tem testes próprios em
 * `FichaColaboradorScreen.test.tsx`; a troca de empresa com a ficha aberta, em
 * `AutenticacaoApp.test.tsx`.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  ABAS_DA_FICHA,
  destinoDaRota,
  fichaDaRota,
  rotaDaFicha,
} from "./rotasDoShell";
import {
  type ColaboradorListadoApi,
  type VinculoApi,
  buscarColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../api/colaboradoresClient";
import { buscarCargo, listarCargos } from "../api/cargoClient";
import {
  buscarDepartamento,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../api/organizacaoClient";
import { listarAlocacoesVinculo } from "../api/vinculoContratualClient";
import { listarVinculosHorario } from "../api/vinculoHorarioClient";
import { listarTabelasHorario } from "../api/horariosClient";
import { consultarContatosDoColaborador } from "../api/contatosColaboradorClient";
import { consultarDadosPessoaisDoColaborador } from "../api/dadosPessoaisClient";
import {
  buscarLinhaDoTempo,
  listarMovimentacoes,
} from "../api/movimentacaoClient";

vi.mock("../api/colaboradoresClient");
vi.mock("../api/cargoClient");
vi.mock("../api/organizacaoClient");
vi.mock("../api/vinculoContratualClient");
vi.mock("../api/vinculoHorarioClient");
vi.mock("../api/horariosClient");
vi.mock("../api/contatosColaboradorClient");
vi.mock("../api/dadosPessoaisClient");
vi.mock("../api/movimentacaoClient");

// Fluxo com o App inteiro: o limite maior vale só para este arquivo.
vi.setConfig({ testTimeout: 20_000 });

const EMPRESA = "44444444-4444-4444-4444-444444444444";
const LISTAGEM = "#/pessoas/colaboradores";

function paginado<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

const ana: ColaboradorListadoApi = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Ana Sintética (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
  vinculos: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      empresaId: EMPRESA,
      matricula: "MAT-0001",
      tipo: "clt" as const,
      situacao: "ativo",
      dataAdmissao: "2025-01-10T00:00:00.000Z",
      dataDesligamento: null,
      lotacaoVigente: null,
      vigenciasDeJornada: [],
    },
  ],
};

const bruno: ColaboradorListadoApi = {
  ...ana,
  id: "22222222-2222-4222-8222-222222222222",
  nome: "Bruno Sintético (teste)",
  vinculos: [
    {
      ...ana.vinculos[0]!,
      id: "55555555-5555-4555-8555-555555555555",
      matricula: "MAT-0002",
    },
  ],
};

function vinculoDe(c: ColaboradorListadoApi): VinculoApi {
  const v = c.vinculos[0]!;
  return {
    id: v.id,
    colaboradorId: c.id,
    empresaId: EMPRESA,
    matricula: v.matricula,
    tipo: "clt",
    situacao: "ativo",
    dataAdmissao: "2025-01-10",
    dataDesligamento: null,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  };
}

const rotaDe = (c: ColaboradorListadoApi, aba = "dados") =>
  `${LISTAGEM}/${c.id}/${aba}`;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  vi.mocked(listarColaboradores).mockResolvedValue({
    ...paginado([ana, bruno]),
    contadores: {
      ativos: 2,
      inativos: 0,
      emAdmissao: 0,
      desligados: 0,
      total: 2,
      ativosPorTipo: {
        clt: 2,
        estagio: 0,
        pj: 0,
        temporario: 0,
        outro_controlado: 0,
      },
    },
  });
  vi.mocked(buscarColaborador).mockImplementation(async (id) => {
    const achado = [ana, bruno].find((c) => c.id === id);
    if (!achado) {
      throw Object.assign(new Error("Recurso não encontrado."), {
        status: 404,
      });
    }
    return {
      id: achado.id,
      nome: achado.nome,
      situacao: achado.situacao,
      criadoEm: achado.criadoEm,
      atualizadoEm: achado.atualizadoEm,
    };
  });
  vi.mocked(listarVinculosDoColaborador).mockImplementation(async (id) =>
    id === bruno.id ? [vinculoDe(bruno)] : [vinculoDe(ana)],
  );
  vi.mocked(listarAlocacoesVinculo).mockResolvedValue([]);
  vi.mocked(buscarCargo).mockRejectedValue(new Error("não usado"));
  vi.mocked(buscarDepartamento).mockRejectedValue(new Error("não usado"));
  vi.mocked(listarVinculosHorario).mockResolvedValue(paginado([]));
  vi.mocked(listarTabelasHorario).mockResolvedValue(paginado([]));
  vi.mocked(buscarLinhaDoTempo).mockResolvedValue([]);
  vi.mocked(listarMovimentacoes).mockResolvedValue(paginado([]) as never);
  for (const catalogo of [
    listarCargos,
    listarDepartamentos,
    listarUnidades,
    listarAreas,
    listarEquipes,
    listarCentrosCusto,
    listarEmpresasMulti,
  ]) {
    vi.mocked(catalogo).mockResolvedValue(paginado([]) as never);
  }
  vi.mocked(consultarContatosDoColaborador).mockImplementation(
    async (colaboradorId) => ({
      colaboradorId,
      empresaId: EMPRESA,
      situacao: "sem_registro",
      contatos: null,
    }),
  );
  vi.mocked(consultarDadosPessoaisDoColaborador).mockImplementation(
    async (colaboradorId) => ({
      colaboradorId,
      empresaId: EMPRESA,
      situacao: "sem_registro",
      perfilPessoal: null,
      endereco: null,
    }),
  );
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

async function esperarFicha(nome: string) {
  await screen.findByRole("tablist", { name: `Seções da ficha de ${nome}` });
}

function abaSelecionada() {
  return screen
    .getAllByRole("tab", { selected: true })
    .find((a) => a.closest(".ficha-colaborador"));
}

/** O que o navegador faz no "voltar"/"avançar": a URL, e `popstate`. */
function navegadorVaiPara(fragmento: string) {
  act(() => {
    window.history.replaceState(null, "", `/${fragmento}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("T198 — rota da ficha (rotasDoShell)", () => {
  it("colaborador e aba; sem aba, vale 'dados'", () => {
    expect(fichaDaRota(rotaDe(ana, "jornada"))).toEqual({
      colaboradorId: ana.id,
      aba: "jornada",
    });
    expect(fichaDaRota(`${LISTAGEM}/${ana.id}`)).toEqual({
      colaboradorId: ana.id,
      aba: "dados",
    });
    for (const aba of ABAS_DA_FICHA) {
      expect(fichaDaRota(rotaDaFicha({ colaboradorId: ana.id, aba }))).toEqual({
        colaboradorId: ana.id,
        aba,
      });
    }
  });

  it("id fora do formato, aba desconhecida ou segmento a mais: não é rota", () => {
    for (const fragmento of [
      `${LISTAGEM}/nao-e-uuid/dados`,
      `${LISTAGEM}/${ana.id}/salarios`,
      `${LISTAGEM}/${ana.id}/dados/extra`,
      `${LISTAGEM}/`,
      `${LISTAGEM}/../admin`,
    ]) {
      expect(fichaDaRota(fragmento)).toBeNull();
      expect(destinoDaRota(fragmento)).toBeNull();
    }
  });

  it("a ficha pertence ao destino de Colaboradores (mesma capacidade)", () => {
    expect(destinoDaRota(rotaDe(ana, "contratuais"))).toBe("pessoas");
    expect(destinoDaRota(LISTAGEM)).toBe("pessoas");
  });
});

describe("T198 — abrir, trocar de aba, voltar (App)", () => {
  it("abre pela linha: rota da ficha empilhada; as abas mudam a URL; a trilha volta à listagem", async () => {
    render(<App papelDoAtor="rh" />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    const entradas = window.history.length;
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${ana.nome}`,
      }),
    );
    await esperarFicha(ana.nome);
    expect(window.location.hash).toBe(rotaDe(ana));
    expect(window.history.length).toBe(entradas + 1);
    // O `<main>` é rotulado pelo título da ficha.
    expect(screen.getByRole("main")).toHaveAccessibleName(ana.nome);

    fireEvent.click(screen.getByRole("tab", { name: "Vida funcional" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaDe(ana, "vida-funcional")),
    );
    expect(abaSelecionada()).toHaveTextContent("Vida funcional");

    fireEvent.click(
      within(
        document.querySelector<HTMLElement>(".ficha-colaborador")!,
      ).getByRole("button", { name: "Colaboradores" }),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(window.location.hash).toBe(LISTAGEM);
  });

  it("rota direta abre a ficha já na aba pedida, sem entrada nova no histórico", async () => {
    window.history.replaceState(null, "", `/${rotaDe(bruno, "contratuais")}`);
    const entradas = window.history.length;
    render(<App papelDoAtor="dp" />);
    await esperarFicha(bruno.nome);
    expect(abaSelecionada()).toHaveTextContent("Dados contratuais");
    expect(window.location.hash).toBe(rotaDe(bruno, "contratuais"));
    expect(window.history.length).toBe(entradas);
    expect(buscarColaborador).toHaveBeenCalledWith(bruno.id);
    // A listagem não foi montada por baixo.
    expect(listarColaboradores).not.toHaveBeenCalled();
  });

  it("rota sem aba abre 'Dados do colaborador' e corrige a URL no lugar", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}/${ana.id}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Dados do colaborador");
    await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
  });

  it("recarregar (nova montagem) mantém o colaborador e a aba", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "jornada")}`);
    const { unmount } = render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    fireEvent.click(screen.getByRole("tab", { name: "Vida funcional" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaDe(ana, "vida-funcional")),
    );
    const url = window.location.hash;
    unmount();

    window.history.replaceState(null, "", `/${url}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Vida funcional");
  });

  it("'voltar' e 'avançar' do navegador percorrem abas, fichas e a listagem", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "jornada")}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);

    navegadorVaiPara(rotaDe(ana, "contratuais"));
    await waitFor(() =>
      expect(abaSelecionada()).toHaveTextContent("Dados contratuais"),
    );

    navegadorVaiPara(rotaDe(bruno, "dados"));
    await esperarFicha(bruno.nome);
    expect(
      screen.queryByRole("heading", { level: 1, name: ana.nome }),
    ).toBeNull();

    navegadorVaiPara(LISTAGEM);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(document.querySelector(".ficha-colaborador")).toBeNull();

    navegadorVaiPara(rotaDe(ana, "vida-funcional"));
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Vida funcional");
  });

  it("id que não é de um colaborador da empresa: 'não encontrado', com volta à listagem", async () => {
    window.history.replaceState(
      null,
      "",
      `/${LISTAGEM}/99999999-9999-4999-8999-999999999999/dados`,
    );
    render(<App papelDoAtor="rh" />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Colaborador não encontrado",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(window.location.hash).toBe(LISTAGEM);
  });

  it("id fora do formato não vira requisição: a URL não é rota", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}/nao-e-uuid/dados`);
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(buscarColaborador).not.toHaveBeenCalled();
    expect(document.querySelector(".ficha-colaborador")).toBeNull();
  });

  it("sair de Colaboradores pela barra fecha a ficha; voltar à barra abre a listagem", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana)}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    fireEvent.click(
      screen.getByRole("button", { name: /^Estrutura organizacional/ }),
    );
    const barra = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    fireEvent.click(
      within(barra).getByRole("button", { name: /^Colaboradores/ }),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(document.querySelector(".ficha-colaborador")).toBeNull();
    expect(window.location.hash).toBe(LISTAGEM);
  });
});

describe("T198 — quem abre a ficha (mesma capacidade de Colaboradores)", () => {
  it("rh e dp editam; master_tecnico só lê (D23)", async () => {
    for (const [papel, edita] of [
      ["rh", true],
      ["dp", true],
      ["master_tecnico", false],
    ] as const) {
      window.history.replaceState(null, "", `/${rotaDe(ana)}`);
      const { unmount } = render(<App papelDoAtor={papel} />);
      await esperarFicha(ana.nome);
      const ficha = document.querySelector<HTMLElement>(".ficha-colaborador")!;
      if (edita) {
        expect(within(ficha).getByLabelText("Nome")).toBeInTheDocument();
      } else {
        expect(within(ficha).queryByLabelText("Nome")).toBeNull();
      }
      unmount();
    }
  });

  it("pós-revisão (C1): rh e dp seguem vendo a jornada vigente da própria empresa no cabeçalho", async () => {
    // Escopados, rh e dp só recebem vínculos de horário da empresa ativa — a
    // mesma do vínculo principal: o filtro por empresa não muda nada para eles.
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      paginado([
        {
          id: "h-1",
          colaboradorId: ana.id,
          empresaId: EMPRESA,
          tabelaHorarioId: "t-1",
          tabela: {
            id: "t-1",
            codigo: "JOR44",
            nome: "Comercial (teste)",
            ativo: true,
          },
          colaborador: { id: ana.id, nome: ana.nome },
          vigenciaInicio: "2025-01-10",
          vigenciaFim: null,
          criadoPorUserId: "u-1",
          criadoEm: "2025-01-10T12:00:00.000Z",
          atualizadoEm: "2025-01-10T12:00:00.000Z",
        },
      ]),
    );
    for (const papel of ["rh", "dp"] as const) {
      window.history.replaceState(null, "", `/${rotaDe(ana)}`);
      const { unmount } = render(<App papelDoAtor={papel} />);
      await esperarFicha(ana.nome);
      const cabecalho = document.querySelector<HTMLElement>(
        ".ficha-colaborador__cabecalho",
      )!;
      await waitFor(() =>
        expect(cabecalho).toHaveTextContent("JOR44 — Comercial (teste)"),
      );
      unmount();
    }
  });

  it.each(["gestor", "colaborador", "financeiro", "auditor", "dpo"] as const)(
    "%s com a URL da ficha não a monta, e nada é lido",
    async (papel) => {
      window.history.replaceState(null, "", `/${rotaDe(ana, "contratuais")}`);
      render(<App papelDoAtor={papel} />);
      await screen.findByRole("navigation", { name: "Navegação do painel" });
      await waitFor(() => expect(window.location.hash).not.toContain(ana.id));
      expect(document.querySelector(".ficha-colaborador")).toBeNull();
      expect(buscarColaborador).not.toHaveBeenCalled();
      expect(listarVinculosDoColaborador).not.toHaveBeenCalled();
    },
  );

  it("gestor digitando a URL da ficha com o painel aberto fica onde está", async () => {
    render(<App papelDoAtor="gestor" />);
    const atual = await screen.findByRole("button", { name: /^Minha equipe/ });
    expect(atual).toHaveAttribute("aria-current", "page");
    act(() => {
      window.history.pushState(null, "", `/${rotaDe(ana)}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(window.location.hash).not.toContain(ana.id));
    expect(document.querySelector(".ficha-colaborador")).toBeNull();
    expect(buscarColaborador).not.toHaveBeenCalled();
  });
});

describe("T198 — atalhos das visões da empresa para a ficha (D24)", () => {
  it("Horário de trabalho: o nome na linha abre a ficha, na rota dela", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      paginado([
        {
          id: "h-1",
          colaboradorId: ana.id,
          empresaId: EMPRESA,
          tabelaHorarioId: "t-1",
          tabela: {
            id: "t-1",
            codigo: null,
            nome: "Comercial (teste)",
            ativo: true,
          },
          colaborador: { id: ana.id, nome: ana.nome },
          vigenciaInicio: "2025-01-10",
          vigenciaFim: null,
          criadoPorUserId: "u-1",
          criadoEm: "2025-01-10T12:00:00.000Z",
          atualizadoEm: "2025-01-10T12:00:00.000Z",
        },
      ]),
    );
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${ana.nome}`,
      }),
    );
    await esperarFicha(ana.nome);
    expect(window.location.hash).toBe(rotaDe(ana));

    // Voltar devolve à mesma aba de Pessoas de onde se veio.
    fireEvent.click(
      within(
        document.querySelector<HTMLElement>(".ficha-colaborador")!,
      ).getByRole("button", { name: "Colaboradores" }),
    );
    expect(
      await screen.findByRole("tab", {
        name: "Horário de trabalho",
        selected: true,
      }),
    ).toBeInTheDocument();
  });
});

/**
 * T199 — o estado do dashboard de Colaboradores na URL (D-3): aba, página e
 * ids de filtros. Recarregar, voltar e avançar o restauram; a busca nunca vai
 * para a URL; valor inválido cai no padrão e a URL é corrigida no lugar.
 */
describe("T199 — o estado do dashboard na URL (App)", () => {
  const ultimaConsulta = () =>
    vi.mocked(listarColaboradores).mock.lastCall?.[0] ?? {};
  const abaDoDashboard = (nome: RegExp) =>
    within(
      screen.getByRole("tablist", { name: "Grupos de colaboradores" }),
    ).getByRole("tab", { name: nome });

  it("trocar de aba empilha a URL com a aba; a consulta pede o grupo", async () => {
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    expect(window.location.hash).toBe(LISTAGEM);
    const entradas = window.history.length;

    fireEvent.click(abaDoDashboard(/^Desligados/));
    await waitFor(() =>
      expect(window.location.hash).toBe(`${LISTAGEM}?aba=desligados`),
    );
    expect(window.history.length).toBe(entradas + 1);
    await waitFor(() => expect(ultimaConsulta().grupo).toBe("desligados"));
  });

  it("a busca nunca vai para a URL", async () => {
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.change(screen.getByLabelText("Tipo de vínculo"), {
      target: { value: "pj" },
    });
    await waitFor(() =>
      expect(window.location.hash).toBe(`${LISTAGEM}?tipo=pj`),
    );
    fireEvent.change(screen.getByLabelText("Buscar por nome ou matrícula"), {
      target: { value: "Ana MAT-0001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(ultimaConsulta().busca).toBe("Ana MAT-0001"));
    expect(window.location.hash).toBe(`${LISTAGEM}?tipo=pj`);
    expect(window.location.href).not.toMatch(/Ana|MAT-0001|busca/);
  });

  it("rota direta abre na aba e no filtro pedidos, sem entrada nova no histórico", async () => {
    const rota = `${LISTAGEM}?aba=em-admissao&tipo=estagio`;
    window.history.replaceState(null, "", `/${rota}`);
    const entradas = window.history.length;
    render(<App papelDoAtor="dp" />);
    await screen.findByRole("table", { name: /^Colaboradores — Em admissão/ });
    expect(abaDoDashboard(/^Em admissão/)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(ultimaConsulta()).toMatchObject({
      grupo: "em_admissao",
      tipoVinculo: "estagio",
      pagina: 1,
    });
    expect(window.location.hash).toBe(rota);
    expect(window.history.length).toBe(entradas);
  });

  it("URL inválida: cai em Ativos sem filtros e é corrigida no lugar; nada inválido vira consulta", async () => {
    window.history.replaceState(
      null,
      "",
      `/${LISTAGEM}?aba=inativos&pagina=0&tipo=autonomo&departamento=1&busca=Ana`,
    );
    const entradas = window.history.length;
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    await waitFor(() => expect(window.location.hash).toBe(LISTAGEM));
    expect(window.history.length).toBe(entradas);
    for (const [consulta] of vi.mocked(listarColaboradores).mock.calls) {
      expect(consulta).not.toHaveProperty("busca");
      expect(consulta).not.toHaveProperty("tipoVinculo");
      expect(consulta).not.toHaveProperty("departamentoId");
      expect(consulta?.pagina).toBe(1);
    }
  });

  it("id de lotação desconhecido na URL: nunca vira consulta; a URL é corrigida no lugar, sem entrada no histórico", async () => {
    const OUTRO = "99999999-9999-4999-8999-999999999999";
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    fireEvent.click(abaDoDashboard(/^Todos/));
    await waitFor(() =>
      expect(window.location.hash).toBe(`${LISTAGEM}?aba=todos`),
    );

    // "voltar"/"avançar" não mudam o tamanho do histórico; só a correção
    // poderia (e não deve).
    const entradas = window.history.length;
    navegadorVaiPara(`${LISTAGEM}?aba=todos&departamento=${OUTRO}`);
    await waitFor(() =>
      expect(window.location.hash).toBe(`${LISTAGEM}?aba=todos`),
    );
    expect(window.history.length).toBe(entradas);
    for (const [consulta] of vi.mocked(listarColaboradores).mock.calls) {
      expect(consulta?.departamentoId).toBeUndefined();
    }
  });

  it("recarregar (nova montagem) mantém aba e filtro", async () => {
    const { unmount } = render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(abaDoDashboard(/^Todos/));
    fireEvent.change(screen.getByLabelText("Tipo de vínculo"), {
      target: { value: "temporario" },
    });
    await waitFor(() =>
      expect(window.location.hash).toBe(
        `${LISTAGEM}?aba=todos&tipo=temporario`,
      ),
    );
    const url = window.location.hash;
    unmount();

    vi.mocked(listarColaboradores).mockClear();
    window.history.replaceState(null, "", `/${url}`);
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — Todos/ });
    expect(
      (screen.getByLabelText("Tipo de vínculo") as HTMLSelectElement).value,
    ).toBe("temporario");
    expect(ultimaConsulta()).toMatchObject({ tipoVinculo: "temporario" });
    expect(ultimaConsulta()).not.toHaveProperty("grupo");
  });

  it("'voltar' e 'avançar' do navegador percorrem as abas", async () => {
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });

    navegadorVaiPara(`${LISTAGEM}?aba=desligados`);
    await screen.findByRole("table", { name: /^Colaboradores — Desligados/ });
    await waitFor(() => expect(ultimaConsulta().grupo).toBe("desligados"));

    navegadorVaiPara(`${LISTAGEM}?aba=todos&pagina=2`);
    await screen.findByRole("table", { name: /^Colaboradores — Todos/ });
    await waitFor(() => expect(ultimaConsulta().pagina).toBe(2));

    navegadorVaiPara(LISTAGEM);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 1 }));
    expect(ultimaConsulta().grupo).toBe("ativos");
  });

  it("abrir a ficha a partir de uma aba e voltar: a URL e a aba voltam, o foco volta ao nome", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}?aba=todos&tipo=clt`);
    render(<App papelDoAtor="rh" />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — Todos/,
    });
    const nome = within(tabela).getByRole("button", {
      name: `Abrir ficha de ${ana.nome}`,
    });
    nome.focus();
    fireEvent.click(nome);
    await esperarFicha(ana.nome);
    expect(window.location.hash).toBe(rotaDe(ana));

    fireEvent.click(
      within(
        document.querySelector<HTMLElement>(".ficha-colaborador")!,
      ).getByRole("button", { name: "Colaboradores" }),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe(`${LISTAGEM}?aba=todos&tipo=clt`),
    );
    expect(abaDoDashboard(/^Todos/)).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Abrir ficha de ${ana.nome}` }),
      ).toHaveFocus(),
    );
  });

  it("sair pela barra e voltar a Colaboradores abre o dashboard no estado inicial", async () => {
    window.history.replaceState(
      null,
      "",
      `/${LISTAGEM}?aba=desligados&tipo=pj`,
    );
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("table", { name: /^Colaboradores — Desligados/ });
    fireEvent.click(
      screen.getByRole("button", { name: /^Estrutura organizacional/ }),
    );
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Navegação do painel" }),
      ).getByRole("button", { name: /^Colaboradores/ }),
    );
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    expect(window.location.hash).toBe(LISTAGEM);
  });
});
