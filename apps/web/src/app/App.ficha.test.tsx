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
import { ComGuardaDeSaida } from "../test/ComGuardaDeSaida";
import {
  definirLarguraDaJanela,
  redefinirLarguraDaJanela,
} from "../test/viewport";
import {
  ABAS_DA_FICHA,
  competenciaDoMesAtual,
  competenciaValida,
  competenciaVizinha,
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
import { obterUsuarioAtual } from "../api/usersClient";
import {
  detalharSolicitacaoPessoa,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
  registrarSolicitacaoPessoa,
  transicionarSolicitacaoPessoa,
} from "../api/solicitacoesPessoasClient";
import {
  listarPontosDoVinculo,
  registrarAjustePonto,
  registrarPonto,
} from "../api/pontoClient";
import {
  criarDocumento,
  listarDocumentos,
  listarSolicitacoesDocumento,
  listarTiposDocumento,
} from "../api/documentosClient";

vi.mock("../api/colaboradoresClient");
vi.mock("../api/cargoClient");
vi.mock("../api/organizacaoClient");
vi.mock("../api/vinculoContratualClient");
vi.mock("../api/vinculoHorarioClient");
vi.mock("../api/horariosClient");
vi.mock("../api/contatosColaboradorClient");
vi.mock("../api/dadosPessoaisClient");
vi.mock("../api/movimentacaoClient");
// T201 — a aba Documentos lê o ator da sessão e os documentos da pessoa.
vi.mock("../api/usersClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/usersClient")>(
      "../api/usersClient",
    );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});
// T203 — a aba Solicitações lê as solicitações por vínculo.
vi.mock("../api/solicitacoesPessoasClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/solicitacoesPessoasClient")
  >("../api/solicitacoesPessoasClient");
  return {
    ...actual,
    listarSolicitacoesPessoas: vi.fn(),
    detalharSolicitacaoPessoa: vi.fn(),
    historicoSolicitacaoPessoa: vi.fn(),
    registrarSolicitacaoPessoa: vi.fn(),
    transicionarSolicitacaoPessoa: vi.fn(),
  };
});
// T202 — a aba Registros de ponto lê as marcações por vínculo.
vi.mock("../api/pontoClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/pontoClient")>(
      "../api/pontoClient",
    );
  return {
    ...actual,
    listarPontosDoVinculo: vi.fn(),
    registrarPonto: vi.fn(),
    registrarAjustePonto: vi.fn(),
  };
});
vi.mock("../api/documentosClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/documentosClient")
  >("../api/documentosClient");
  return {
    ...actual,
    listarTiposDocumento: vi.fn(),
    listarDocumentos: vi.fn(),
    listarSolicitacoesDocumento: vi.fn(),
    criarDocumento: vi.fn(),
    substituirDocumento: vi.fn(),
    criarSolicitacaoDocumento: vi.fn(),
  };
});

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
  vi.mocked(obterUsuarioAtual).mockResolvedValue({
    id: "ator-sintetico",
    email: "pessoa.teste@example.test",
    role: "rh",
    companyId: EMPRESA,
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  vi.mocked(listarTiposDocumento).mockResolvedValue(
    paginado([
      {
        id: "t-rg",
        empresaId: EMPRESA,
        codigo: "RG",
        nome: "Identidade (teste)",
        classificacao: "restrito",
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
      },
    ]),
  );
  vi.mocked(listarDocumentos).mockImplementation(async (consulta) =>
    paginado([
      {
        id: "d-1",
        empresaId: EMPRESA,
        colaboradorId: consulta?.colaboradorId ?? ana.id,
        tipoDocumentoId: "t-rg",
        estado: "upload_desabilitado" as const,
        substituiDocumentoId: null,
        criadoEm: "2026-03-10T12:00:00.000Z",
        atualizadoEm: "2026-03-10T12:00:00.000Z",
      },
    ]),
  );
  vi.mocked(listarSolicitacoesDocumento).mockResolvedValue(paginado([]));
  vi.mocked(listarPontosDoVinculo).mockResolvedValue(paginado([]));
  vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(paginado([]));
  vi.mocked(historicoSolicitacaoPessoa).mockResolvedValue([]);
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
        // T202 — a aba de ponto sempre leva a competência (a do mês corrente,
        // se não houver).
        ...(aba === "ponto" ? { competencia: competenciaDoMesAtual() } : {}),
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

  it("B1 — URL com Todos, PJ e página 4 além do fim: 'nesta página'; a primeira página mantém o PJ na URL", async () => {
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => ({
      itens: consulta?.pagina === 4 ? [] : [ana],
      pagina: consulta?.pagina ?? 1,
      tamanhoPagina: 20,
      total: 3,
      contadores: {
        ativos: 2,
        inativos: 1,
        emAdmissao: 0,
        desligados: 1,
        total: 3,
        ativosPorTipo: {
          clt: 1,
          estagio: 0,
          pj: 1,
          temporario: 0,
          outro_controlado: 0,
        },
      },
    }));
    window.history.replaceState(
      null,
      "",
      `/${LISTAGEM}?aba=todos&pagina=4&tipo=pj`,
    );
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", {
      name: "Nenhum colaborador nesta página",
    });
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe(`${LISTAGEM}?aba=todos&tipo=pj`),
    );
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        tipoVinculo: "pj",
      }),
    );
    await screen.findByRole("table", { name: "Colaboradores — Todos" });
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

/**
 * T200 — a guarda de saída no App, com o histórico de verdade do navegador:
 * menu, trilha da ficha, abas internas, rota digitada, voltar e avançar.
 * Montado como no shell (`ComGuardaDeSaida`).
 */
describe("T200 — guarda de saída no App", () => {
  function montarComGuarda(papel = "rh") {
    return render(
      <ComGuardaDeSaida>
        <App papelDoAtor={papel} />
      </ComGuardaDeSaida>,
    );
  }
  const pergunta = () =>
    screen.getByRole("alertdialog", { name: "Sair sem salvar?" });
  const telasDaPergunta = () =>
    within(pergunta())
      .getAllByRole("listitem")
      .map((li) => li.textContent);
  const fichaNaTela = () =>
    document.querySelector<HTMLElement>(".ficha-colaborador");
  function editarNome(valor = "Ana Editada (teste)") {
    const campo = within(fichaNaTela()!).getByLabelText(
      "Nome",
    ) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: valor } });
    return campo;
  }
  const barra = () =>
    screen.getByRole("navigation", { name: "Navegação do painel" });
  /** A pergunta aparece depois que o navegador anda (assíncrono). */
  const esperarPergunta = () =>
    screen.findByRole("alertdialog", { name: "Sair sem salvar?" });
  /** O navegador anda no histórico de forma assíncrona. */
  async function navegador(acao: () => void) {
    await act(async () => {
      acao();
      await new Promise((resolver) => setTimeout(resolver, 20));
    });
  }

  it("menu lateral: pergunta; continuar mantém a ficha e devolve o foco ao item; sair sem salvar navega", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana)}`);
    montarComGuarda();
    await esperarFicha(ana.nome);
    const campo = editarNome();
    const item = within(barra()).getByRole("button", {
      name: /^Colaboradores/,
    });
    item.focus();
    fireEvent.click(item);
    expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(fichaNaTela()).not.toBeNull();
    expect(campo.value).toBe("Ana Editada (teste)");
    expect(item).toHaveFocus();

    fireEvent.click(item);
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(fichaNaTela()).toBeNull();
    expect(window.location.hash).toBe(LISTAGEM);
  });

  it("trilha da ficha: o diálogo único (não mais o da ficha); sair sem salvar volta à listagem", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana)}`);
    montarComGuarda();
    await esperarFicha(ana.nome);
    editarNome();
    const trilha = within(fichaNaTela()!).getByRole("button", {
      name: "Colaboradores",
    });
    fireEvent.click(trilha);
    expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(window.location.hash).toBe(LISTAGEM);
  });

  it("voltar do navegador: desfaz e pergunta; continuar fica na ficha; sair sem salvar volta — sem entradas a mais", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}`);
    montarComGuarda();
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${ana.nome}`,
      }),
    );
    await esperarFicha(ana.nome);
    const entradas = window.history.length;
    const campo = editarNome();

    await navegador(() => window.history.back());
    await esperarPergunta();
    expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
    await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(fichaNaTela()).not.toBeNull();
    expect(campo.value).toBe("Ana Editada (teste)");
    expect(window.location.hash).toBe(rotaDe(ana));

    await navegador(() => window.history.back());
    await esperarPergunta();
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    await navegador(() => undefined);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(window.location.hash).toBe(LISTAGEM);
    expect(fichaNaTela()).toBeNull();
    expect(window.history.length).toBe(entradas);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // A entrada da ficha continua lá: avançar a reabre, sem nada a perguntar.
    await navegador(() => window.history.forward());
    await esperarFicha(ana.nome);
    expect(window.location.hash).toBe(rotaDe(ana));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("'Sair sem salvar' antes de o navegador terminar de desfazer: o passo aceito espera e não se perde", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}`);
    montarComGuarda();
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${ana.nome}`,
      }),
    );
    await esperarFicha(ana.nome);
    editarNome();
    // Os `go` do shell ficam retidos: a reversão ainda não chegou.
    const ir = window.history.go.bind(window.history);
    const retidos: number[] = [];
    const espiao = vi
      .spyOn(window.history, "go")
      .mockImplementation((passo?: number) => {
        retidos.push(passo ?? 0);
      });
    await navegador(() => window.history.back());
    await esperarPergunta();
    expect(retidos).toEqual([1]);
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    // Nenhum passo novo antes de a reversão chegar.
    expect(retidos).toEqual([1]);
    espiao.mockRestore();
    await navegador(() => ir(retidos[0]!));
    await navegador(() => undefined);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(window.location.hash).toBe(LISTAGEM);
    expect(fichaNaTela()).toBeNull();
  });

  it("avançar do navegador: desfaz e pergunta; sair sem salvar aplica o mesmo passo", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}`);
    montarComGuarda();
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${ana.nome}`,
      }),
    );
    await esperarFicha(ana.nome);
    // Sem edição: a trilha sai direto (entrada nova da listagem).
    fireEvent.click(
      within(fichaNaTela()!).getByRole("button", { name: "Colaboradores" }),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const entradas = window.history.length;
    await navegador(() => window.history.back());
    await esperarFicha(ana.nome);
    editarNome();

    await navegador(() => window.history.forward());
    await esperarPergunta();
    expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
    await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(fichaNaTela()).not.toBeNull();

    await navegador(() => window.history.forward());
    await esperarPergunta();
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    await navegador(() => undefined);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(window.location.hash).toBe(LISTAGEM);
    expect(window.history.length).toBe(entradas);
  });

  it("rota digitada: desfaz e pergunta; continuar fica; sair sem salvar vai à rota digitada, com os parâmetros", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana)}`);
    montarComGuarda();
    await esperarFicha(ana.nome);
    const campo = editarNome();
    const digitada = `${LISTAGEM}?aba=desligados&tipo=pj`;

    await navegador(() => {
      window.location.hash = digitada;
    });
    await esperarPergunta();
    expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
    await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(campo.value).toBe("Ana Editada (teste)");

    await navegador(() => {
      window.location.hash = digitada;
    });
    await esperarPergunta();
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    await navegador(() => undefined);
    await screen.findByRole("table", { name: "Colaboradores — Desligados" });
    expect(window.location.hash).toBe(digitada);
    expect(fichaNaTela()).toBeNull();
  });

  it("aba interna de Pessoas: trocar de aba com o formulário aberto pergunta; continuar fica na aba", async () => {
    vi.mocked(listarTabelasHorario).mockResolvedValue(
      paginado([
        {
          id: "tabela-1",
          codigo: "ADM",
          nome: "Administrativo (teste)",
          ativo: true,
        },
      ]) as never,
    );
    window.history.replaceState(null, "", `/${LISTAGEM}`);
    montarComGuarda();
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const abas = screen.getByRole("tablist", { name: "Seções de Pessoas" });
    fireEvent.click(
      within(abas).getByRole("tab", { name: "Horário de trabalho" }),
    );
    const novo = await screen.findByRole("button", { name: "Novo vínculo" });
    await waitFor(() => expect(novo).toBeEnabled());
    fireEvent.click(novo);

    fireEvent.click(
      within(abas).getByRole("tab", { name: "Histórico funcional" }),
    );
    expect(telasDaPergunta()).toEqual(["Horário de trabalho"]);
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(
      within(abas).getByRole("tab", { name: "Horário de trabalho" }),
    ).toHaveAttribute("aria-selected", "true");

    fireEvent.click(
      within(abas).getByRole("tab", { name: "Histórico funcional" }),
    );
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(
      within(abas).getByRole("tab", { name: "Histórico funcional" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("aba Jornada do dashboard: sair dela com o formulário aberto pergunta; sem formulário, troca direto", async () => {
    vi.mocked(listarTabelasHorario).mockResolvedValue(
      paginado([
        {
          id: "tabela-1",
          codigo: "ADM",
          nome: "Administrativo (teste)",
          ativo: true,
        },
      ]) as never,
    );
    window.history.replaceState(null, "", `/${LISTAGEM}?aba=jornada`);
    montarComGuarda();
    const novo = await screen.findByRole("button", { name: "Novo vínculo" });
    await waitFor(() => expect(novo).toBeEnabled());
    const grupos = screen.getByRole("tablist", {
      name: "Grupos de colaboradores",
    });
    // Sem formulário aberto, a troca de aba não pergunta.
    fireEvent.click(within(grupos).getByRole("tab", { name: /^Todos/ }));
    await screen.findByRole("table", { name: "Colaboradores — Todos" });
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(
      within(grupos).getByRole("tab", { name: /^Jornada de trabalho/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Novo vínculo" }),
    );
    fireEvent.click(within(grupos).getByRole("tab", { name: /^Ativos/ }));
    expect(telasDaPergunta()).toEqual(["Horário de trabalho"]);
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    await screen.findByRole("table", { name: "Colaboradores — Ativos" });
  });

  it("por papel: RH e DP editam e a guarda pergunta; master_tecnico só lê e sai direto", async () => {
    for (const papel of ["rh", "dp"] as const) {
      window.history.replaceState(null, "", `/${rotaDe(ana)}`);
      const { unmount } = montarComGuarda(papel);
      await esperarFicha(ana.nome);
      editarNome();
      fireEvent.click(
        within(barra()).getByRole("button", { name: /^Colaboradores/ }),
      );
      expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
      unmount();
    }
    window.history.replaceState(null, "", `/${rotaDe(ana)}`);
    montarComGuarda("master_tecnico");
    await esperarFicha(ana.nome);
    expect(within(fichaNaTela()!).queryByLabelText("Nome")).toBeNull();
    fireEvent.click(
      within(barra()).getByRole("button", { name: /^Colaboradores/ }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await screen.findByRole("table", { name: /^Colaboradores — / });
  });

  it("perfil sem acesso a Colaboradores: a rota é recusada e nada pergunta", async () => {
    window.history.replaceState(null, "", "/");
    montarComGuarda("gestor");
    await navegador(() => {
      window.location.hash = rotaDe(ana);
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fichaNaTela()).toBeNull();
  });

  it("resposta atrasada da listagem depois de sair sem salvar não reabre a ficha nem a pergunta", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}`);
    montarComGuarda();
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${ana.nome}`,
      }),
    );
    await esperarFicha(ana.nome);
    editarNome();
    let responder: (v: never) => void = () => undefined;
    vi.mocked(listarColaboradores).mockImplementationOnce(
      () => new Promise((r) => (responder = r as never)),
    );
    fireEvent.click(
      within(fichaNaTela()!).getByRole("button", { name: "Colaboradores" }),
    );
    fireEvent.click(
      within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(fichaNaTela()).toBeNull();
    await act(async () => {
      responder({
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
      } as never);
    });
    expect(fichaNaTela()).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(window.location.hash).toBe(LISTAGEM);
  });

  describe("revisão adversarial", () => {
    const jornadaAtiva = {
      id: "tabela-1",
      codigo: "ADM",
      nome: "Administrativo (teste)",
      ativo: true,
    };
    /** A Jornada com uma jornada ativa e um vínculo de Ana (link da ficha). */
    function comJornadaAtiva() {
      vi.mocked(listarTabelasHorario).mockResolvedValue(
        paginado([jornadaAtiva]) as never,
      );
      vi.mocked(listarVinculosHorario).mockResolvedValue(
        paginado([
          {
            id: "66666666-6666-4666-8666-666666666666",
            colaboradorId: ana.id,
            empresaId: EMPRESA,
            tabelaHorarioId: jornadaAtiva.id,
            tabela: jornadaAtiva,
            colaborador: { id: ana.id, nome: ana.nome },
            vigenciaInicio: "2025-01-10",
            vigenciaFim: null,
            criadoPorUserId: "77777777-7777-4777-8777-777777777777",
            criadoEm: "2025-01-10T12:00:00.000Z",
            atualizadoEm: "2025-01-10T12:00:00.000Z",
          },
        ]) as never,
      );
    }
    const formularioDeVinculo = () =>
      screen.queryByRole("form", {
        name: "Formulário de novo vínculo de horário",
      });
    async function abrirNovoVinculo() {
      const novo = await screen.findByRole("button", { name: "Novo vínculo" });
      await waitFor(() => expect(novo).toBeEnabled());
      fireEvent.click(novo);
      await waitFor(() => expect(formularioDeVinculo()).not.toBeNull());
    }
    /** O foco num controle do formulário, como quem está digitando nele. */
    function focarNoFormulario() {
      const controle = formularioDeVinculo()!.querySelector<HTMLElement>(
        "input, select, button",
      )!;
      controle.focus();
      expect(controle).toHaveFocus();
    }
    const grupos = () =>
      screen.getByRole("tablist", { name: "Grupos de colaboradores" });
    async function irParaJornada() {
      fireEvent.click(
        within(grupos()).getByRole("tab", { name: /^Jornada de trabalho/ }),
      );
      await screen.findByRole("button", { name: "Novo vínculo" });
    }
    const principal = () => document.getElementById("conteudo-principal");
    const sairSemSalvar = () =>
      fireEvent.click(
        within(pergunta()).getByRole("button", { name: "Sair sem salvar" }),
      );
    const continuarEditando = () =>
      fireEvent.click(
        within(pergunta()).getByRole("button", { name: "Continuar editando" }),
      );

    it("B1 — 'Pular para o conteúdo' foca o conteúdo sem mudar a URL nem criar entrada no histórico", async () => {
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      await screen.findByRole("table", { name: /^Colaboradores — / });
      const entradas = window.history.length;
      const estado: unknown = window.history.state;
      const link = screen.getByRole("link", { name: "Pular para o conteúdo" });
      // `false`: o padrão do link (navegar até a âncora) foi impedido.
      expect(fireEvent.click(link)).toBe(false);
      await navegador(() => undefined);
      expect(window.history.length).toBe(entradas);
      expect(window.history.state).toEqual(estado);
      expect(window.location.hash).toBe(LISTAGEM);
      expect(principal()).toHaveFocus();
    });

    it("B1 — âncora sem índice no meio do histórico: voltar continua perguntando, 'Sair sem salvar' executa e nada fica preso", async () => {
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      const tabela = await screen.findByRole("table", {
        name: /^Colaboradores — /,
      });
      // Uma âncora da própria página aberta pelo navegador (digitada, ou um
      // link antigo): entrada nova, sem o índice do shell.
      await navegador(() => {
        window.location.hash = "#conteudo-principal";
      });
      fireEvent.click(
        within(tabela).getByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      const campo = editarNome();

      // Voltar até a âncora: não é rota, a ficha fica e nada pergunta.
      await navegador(() => window.history.back());
      expect(fichaNaTela()).not.toBeNull();
      expect(screen.queryByRole("alertdialog")).toBeNull();
      // Voltar até a listagem: pergunta; continuar fica na ficha.
      await navegador(() => window.history.back());
      await esperarPergunta();
      await navegador(() => undefined);
      continuarEditando();
      expect(fichaNaTela()).not.toBeNull();
      expect(campo.value).toBe("Ana Editada (teste)");

      // De novo: pergunta outra vez, e "Sair sem salvar" vai à listagem.
      await navegador(() => window.history.back());
      await esperarPergunta();
      await navegador(() => undefined);
      sairSemSalvar();
      await navegador(() => undefined);
      await screen.findByRole("table", { name: /^Colaboradores — / });
      expect(fichaNaTela()).toBeNull();
      expect(window.location.hash).toBe(LISTAGEM);
      expect(screen.queryByRole("alertdialog")).toBeNull();

      // Nada ficou preso: avançar reabre a ficha (passando pela âncora), e
      // com nova edição o voltar pergunta de novo.
      await navegador(() => window.history.forward());
      await navegador(() => window.history.forward());
      await esperarFicha(ana.nome);
      expect(screen.queryByRole("alertdialog")).toBeNull();
      editarNome("Ana Outra Edição (teste)");
      await navegador(() => window.history.go(-2));
      await esperarPergunta();
      expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
      // A reversão chega de volta à ficha (o navegador termina de andar
      // antes de o teste acabar, sem vazar para o próximo).
      await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
      continuarEditando();
      expect(fichaNaTela()).not.toBeNull();
    });

    it("B2 — ficha aberta pela Jornada: rota digitada que sai da Jornada pergunta pelo formulário; continuar o preserva; sair sem salvar descarta", async () => {
      comJornadaAtiva();
      window.history.replaceState(null, "", `/${LISTAGEM}?aba=jornada`);
      montarComGuarda();
      await abrirNovoVinculo();
      fireEvent.click(
        await screen.findByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      const digitada = `${LISTAGEM}?aba=ativos`;

      await navegador(() => {
        window.location.hash = digitada;
      });
      await esperarPergunta();
      expect(telasDaPergunta()).toEqual(["Horário de trabalho"]);
      await navegador(() => undefined);
      continuarEditando();
      expect(fichaNaTela()).not.toBeNull();
      // De volta à Jornada pela trilha (só a ficha sai, e ela está limpa):
      // o formulário continua aberto.
      fireEvent.click(
        within(fichaNaTela()!).getByRole("button", { name: "Colaboradores" }),
      );
      await waitFor(() => expect(formularioDeVinculo()).not.toBeNull());
      expect(screen.queryByRole("alertdialog")).toBeNull();

      fireEvent.click(
        await screen.findByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      await navegador(() => {
        window.location.hash = digitada;
      });
      await esperarPergunta();
      await navegador(() => undefined);
      sairSemSalvar();
      await navegador(() => undefined);
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      expect(fichaNaTela()).toBeNull();
      expect(formularioDeVinculo()).toBeNull();
    });

    it("B2 — ficha aberta pela Jornada: dois passos de histórico até fora da Jornada perguntam; trocar a aba da ficha não", async () => {
      comJornadaAtiva();
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      await irParaJornada();
      await abrirNovoVinculo();
      fireEvent.click(
        await screen.findByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      // Saída isenta: trocar a aba da ficha não desmonta nada.
      fireEvent.click(
        within(fichaNaTela()!).getByRole("tab", { name: /^Jornada/ }),
      );
      expect(screen.queryByRole("alertdialog")).toBeNull();

      await navegador(() => window.history.go(-3));
      await esperarPergunta();
      expect(telasDaPergunta()).toEqual(["Horário de trabalho"]);
      await navegador(() => undefined);
      continuarEditando();
      expect(fichaNaTela()).not.toBeNull();

      await navegador(() => window.history.go(-3));
      await esperarPergunta();
      await navegador(() => undefined);
      sairSemSalvar();
      await navegador(() => undefined);
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      expect(formularioDeVinculo()).toBeNull();
    });

    it("B3 — voltar aceito: o foco vai ao conteúdo principal depois da navegação, nunca ao body", async () => {
      comJornadaAtiva();
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      await irParaJornada();
      await abrirNovoVinculo();
      focarNoFormulario();

      await navegador(() => window.history.back());
      await esperarPergunta();
      await navegador(() => undefined);
      sairSemSalvar();
      await navegador(() => undefined);
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      expect(formularioDeVinculo()).toBeNull();
      expect(document.activeElement).not.toBe(document.body);
      expect(principal()).toHaveFocus();
    });

    it("B3 — avançar aceito: o foco vai ao conteúdo principal depois da navegação, nunca ao body", async () => {
      comJornadaAtiva();
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      await irParaJornada();
      fireEvent.click(within(grupos()).getByRole("tab", { name: /^Ativos/ }));
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      await navegador(() => window.history.back());
      await abrirNovoVinculo();
      focarNoFormulario();

      await navegador(() => window.history.forward());
      await esperarPergunta();
      await navegador(() => undefined);
      sairSemSalvar();
      await navegador(() => undefined);
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      expect(document.activeElement).not.toBe(document.body);
      expect(principal()).toHaveFocus();
    });

    it("B3 — rota digitada aceita: o foco vai ao conteúdo principal depois da navegação, nunca ao body", async () => {
      comJornadaAtiva();
      window.history.replaceState(null, "", `/${LISTAGEM}?aba=jornada`);
      montarComGuarda();
      await abrirNovoVinculo();
      focarNoFormulario();

      await navegador(() => {
        window.location.hash = `${LISTAGEM}?aba=ativos`;
      });
      await esperarPergunta();
      await navegador(() => undefined);
      sairSemSalvar();
      await navegador(() => undefined);
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      expect(document.activeElement).not.toBe(document.body);
      expect(principal()).toHaveFocus();
    });

    it("B5 — Jornadas de trabalho: o item do menu já ativo não pergunta; outro destino pergunta", async () => {
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });

      // Jornadas de trabalho com o formulário aberto.
      const jornadas = () =>
        within(barra()).getByRole("button", { name: /^Jornadas de trabalho/ });
      fireEvent.click(jornadas());
      const nova = await screen.findAllByRole("button", {
        name: "Nova jornada",
      });
      fireEvent.click(nova[0]!);
      fireEvent.click(jornadas());
      expect(screen.queryByRole("alertdialog")).toBeNull();
      // Outro destino desmonta: pergunta.
      fireEvent.click(
        within(barra()).getByRole("button", { name: /^Colaboradores/ }),
      );
      expect(telasDaPergunta()).toEqual(["Jornadas de trabalho"]);
      sairSemSalvar();
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
    });

    it("B5 — Pessoas › Horário de trabalho: o item já ativo não troca a aba, então não pergunta", async () => {
      comJornadaAtiva();
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
      const abas = screen.getByRole("tablist", { name: "Seções de Pessoas" });
      fireEvent.click(
        within(abas).getByRole("tab", { name: "Horário de trabalho" }),
      );
      await abrirNovoVinculo();
      fireEvent.click(
        within(barra()).getByRole("button", { name: /^Colaboradores/ }),
      );
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(formularioDeVinculo()).not.toBeNull();
    });

    it("B5 — Pessoas com a Jornada aberta: o item já ativo volta a listagem ao início, então pergunta", async () => {
      comJornadaAtiva();
      window.history.replaceState(null, "", `/${LISTAGEM}?aba=jornada`);
      montarComGuarda();
      await abrirNovoVinculo();
      fireEvent.click(
        within(barra()).getByRole("button", { name: /^Colaboradores/ }),
      );
      expect(telasDaPergunta()).toEqual(["Horário de trabalho"]);
      continuarEditando();
      expect(formularioDeVinculo()).not.toBeNull();
      fireEvent.click(
        within(barra()).getByRole("button", { name: /^Colaboradores/ }),
      );
      sairSemSalvar();
      await screen.findByRole("table", { name: "Colaboradores — Ativos" });
    });

    it("B7 — rota digitada desfeita ganha índice: o salto de dois passos até ela pergunta e 'Sair sem salvar' chega exatamente a ela", async () => {
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      const tabela = await screen.findByRole("table", {
        name: /^Colaboradores — /,
      });
      fireEvent.click(
        within(tabela).getByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      const campo = editarNome();
      // Trocar a aba da ficha é uma entrada nova, sem nada a perguntar.
      fireEvent.click(
        within(fichaNaTela()!).getByRole("tab", { name: /^Jornada/ }),
      );
      await waitFor(() =>
        expect(window.location.hash).toBe(rotaDe(ana, "jornada")),
      );
      const digitada = `${LISTAGEM}?aba=desligados`;

      await navegador(() => {
        window.location.hash = digitada;
      });
      await esperarPergunta();
      await navegador(() => undefined);
      continuarEditando();
      expect(window.location.hash).toBe(rotaDe(ana, "jornada"));
      // A entrada digitada ficou à frente, já com o índice dela.
      await navegador(() => window.history.back());
      expect(window.location.hash).toBe(rotaDe(ana));
      expect(screen.queryByRole("alertdialog")).toBeNull();

      // Salto de dois passos até a rota digitada: pergunta.
      await navegador(() => window.history.go(2));
      await esperarPergunta();
      expect(telasDaPergunta()).toEqual(["Ficha do colaborador"]);
      await navegador(() => undefined);
      expect(window.location.hash).toBe(rotaDe(ana));
      expect(campo.value).toBe("Ana Editada (teste)");

      sairSemSalvar();
      await navegador(() => undefined);
      await navegador(() => undefined);
      await screen.findByRole("table", { name: "Colaboradores — Desligados" });
      expect(window.location.hash).toBe(digitada);
      expect(fichaNaTela()).toBeNull();
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("B8 — gaveta aberta e voltar aceito: a gaveta fecha e o foco chega a um destino fora de [inert], nunca ao body", async () => {
      definirLarguraDaJanela(375);
      try {
        window.history.replaceState(null, "", `/${LISTAGEM}`);
        montarComGuarda();
        const tabela = await screen.findByRole("table", {
          name: /^Colaboradores — /,
        });
        fireEvent.click(
          within(tabela).getByRole("button", {
            name: `Abrir ficha de ${ana.nome}`,
          }),
        );
        await esperarFicha(ana.nome);
        editarNome();
        const menu = screen.getByRole("button", { name: "Menu" });
        fireEvent.click(menu);
        expect(menu).toHaveAttribute("aria-expanded", "true");

        await navegador(() => window.history.back());
        await esperarPergunta();
        await navegador(() => undefined);
        sairSemSalvar();
        await navegador(() => undefined);
        await waitFor(() => expect(fichaNaTela()).toBeNull());
        expect(menu).toHaveAttribute("aria-expanded", "false");
        await screen.findByRole("table", { name: /^Colaboradores — / });
        const ativo = document.activeElement;
        expect(ativo).not.toBe(document.body);
        expect(ativo?.closest("[inert]")).toBeNull();
      } finally {
        redefinirLarguraDaJanela();
      }
    });

    it("B10 — âncora digitada com o diálogo aberto: 'Sair sem salvar' chega exatamente ao destino do voltar, sem segunda pergunta e sem foco no body", async () => {
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      const tabela = await screen.findByRole("table", {
        name: /^Colaboradores — /,
      });
      fireEvent.click(
        within(tabela).getByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      editarNome();

      await navegador(() => window.history.back());
      await esperarPergunta();
      await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
      // Com o diálogo ainda aberto, uma âncora digitada na barra: entrada
      // nova, sem rota, que muda o índice em que o navegador está.
      await navegador(() => {
        window.location.hash = "#conteudo-principal";
      });
      expect(pergunta()).toBeInTheDocument();
      expect(fichaNaTela()).not.toBeNull();

      sairSemSalvar();
      await navegador(() => undefined);
      await navegador(() => undefined);
      await screen.findByRole("table", { name: /^Colaboradores — / });
      expect(window.location.hash).toBe(LISTAGEM);
      expect(fichaNaTela()).toBeNull();
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(document.activeElement).not.toBe(document.body);
    });

    const indiceAtual = () =>
      (window.history.state as Record<string, unknown> | null)?.[
        "evolliIndice"
      ];

    it("B11 — avançar um passo, âncora digitada com o diálogo aberto (o destino à frente some): 'Sair sem salvar' chega ao destino aceito, numa entrada nova", async () => {
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      const tabela = await screen.findByRole("table", {
        name: /^Colaboradores — /,
      });
      fireEvent.click(
        within(tabela).getByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      // A listagem à frente da ficha (índices 0 → 1 → 2), e de volta à ficha.
      fireEvent.click(
        within(fichaNaTela()!).getByRole("button", { name: "Colaboradores" }),
      );
      await screen.findByRole("table", { name: /^Colaboradores — / });
      await navegador(() => window.history.back());
      await esperarFicha(ana.nome);
      expect(indiceAtual()).toBe(1);
      editarNome();

      await navegador(() => window.history.forward());
      await esperarPergunta();
      await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
      // A âncora digitada toma o lugar da listagem que estava à frente.
      await navegador(() => {
        window.location.hash = "#conteudo-principal";
      });
      expect(pergunta()).toBeInTheDocument();

      sairSemSalvar();
      await navegador(() => undefined);
      await navegador(() => undefined);
      await screen.findByRole("table", { name: /^Colaboradores — / });
      expect(window.location.hash).toBe(LISTAGEM);
      expect(indiceAtual()).toBe(3);
      expect(fichaNaTela()).toBeNull();
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(document.activeElement).not.toBe(document.body);
      // Nenhuma pergunta nem navegação a mais depois.
      await navegador(() => undefined);
      expect(window.location.hash).toBe(LISTAGEM);
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("B11 — salto de dois passos para frente, âncora digitada com o diálogo aberto: o destino aceito, já apagado, é aplicado numa entrada nova", async () => {
      window.history.replaceState(null, "", `/${LISTAGEM}`);
      montarComGuarda();
      const tabela = await screen.findByRole("table", {
        name: /^Colaboradores — /,
      });
      fireEvent.click(
        within(tabela).getByRole("button", {
          name: `Abrir ficha de ${ana.nome}`,
        }),
      );
      await esperarFicha(ana.nome);
      fireEvent.click(
        within(fichaNaTela()!).getByRole("button", { name: "Colaboradores" }),
      );
      const listagem = await screen.findByRole("table", {
        name: /^Colaboradores — /,
      });
      fireEvent.click(
        within(listagem).getByRole("button", {
          name: `Abrir ficha de ${bruno.nome}`,
        }),
      );
      await esperarFicha(bruno.nome);
      // Ficha de Ana (1), listagem (2), ficha de Bruno (3): de volta à de Ana.
      await navegador(() => window.history.go(-2));
      await esperarFicha(ana.nome);
      expect(indiceAtual()).toBe(1);
      editarNome();

      await navegador(() => window.history.go(2));
      await esperarPergunta();
      await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
      await navegador(() => {
        window.location.hash = "#conteudo-principal";
      });
      expect(pergunta()).toBeInTheDocument();

      sairSemSalvar();
      await navegador(() => undefined);
      await navegador(() => undefined);
      await esperarFicha(bruno.nome);
      expect(window.location.hash).toBe(rotaDe(bruno));
      expect(indiceAtual()).toBe(3);
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(document.activeElement).not.toBe(document.body);
      await navegador(() => undefined);
      expect(window.location.hash).toBe(rotaDe(bruno));
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("B12 — destino à frente SEM hash, apagado por âncora digitada: 'Sair sem salvar' chega a ele sem recarregar o documento nem armar o aviso nativo", async () => {
      // No navegador, ir de `/#x` para uma URL sem hash pelo `location` é
      // navegação de documento (recarga, com o aviso nativo). O jsdom a
      // trata como navegação de fragmento — e dispara `popstate` e
      // `hashchange`. A entrada recriada pelo shell vem de `pushState`, que
      // não dispara evento nenhum: é isso que o teste exige.
      const eventosDoNavegador: string[] = [];
      const contar = (evento: Event) => eventosDoNavegador.push(evento.type);
      try {
        window.history.replaceState(null, "", "/#/pessoas/nova-admissao");
        montarComGuarda();
        await screen.findByLabelText(/^Nome completo/);
        // Um destino do shell sem rota: a URL fica sem hash (índice 1).
        fireEvent.click(
          within(barra()).getByRole("button", {
            name: /^Estrutura organizacional/,
          }),
        );
        await screen.findByRole("heading", {
          level: 1,
          name: "Estrutura organizacional",
        });
        expect(window.location.hash).toBe("");
        expect(indiceAtual()).toBe(1);
        const destino = window.location.pathname + window.location.search;

        // De volta à Nova admissão, com edição pendente.
        await navegador(() => window.history.back());
        const nome = await screen.findByLabelText(/^Nome completo/);
        fireEvent.change(nome, {
          target: { value: "Pessoa Sintetica Rascunho" },
        });

        await navegador(() => window.history.forward());
        await esperarPergunta();
        expect(telasDaPergunta()).toEqual(["Nova admissão"]);
        await waitFor(() =>
          expect(window.location.hash).toBe("#/pessoas/nova-admissao"),
        );
        // A âncora digitada toma o lugar do destino sem hash.
        await navegador(() => {
          window.location.hash = "#conteudo-principal";
        });
        expect(pergunta()).toBeInTheDocument();

        const empilhar = vi.spyOn(window.history, "pushState");
        window.addEventListener("popstate", contar);
        window.addEventListener("hashchange", contar);
        sairSemSalvar();
        await navegador(() => undefined);
        await navegador(() => undefined);
        expect(
          await screen.findByRole("heading", {
            level: 1,
            name: "Estrutura organizacional",
          }),
        ).toBeInTheDocument();
        // Uma entrada da própria aplicação, com o índice novo; nenhuma
        // navegação de documento (nem evento do navegador).
        expect(empilhar).toHaveBeenCalledWith(
          expect.objectContaining({ evolliIndice: 2 }),
          "",
          expect.stringMatching(/\/$/),
        );
        expect(eventosDoNavegador).toEqual([]);
        empilhar.mockRestore();
        expect(window.location.pathname + window.location.search).toBe(destino);
        expect(window.location.hash).toBe("");
        expect(indiceAtual()).toBe(2);
        expect(screen.queryByRole("alertdialog")).toBeNull();
        const ativo = document.activeElement;
        expect(ativo).not.toBe(document.body);
        expect(ativo?.closest("[inert]")).toBeNull();
        // A edição foi descartada: o aviso nativo não está mais armado.
        const aviso = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(aviso);
        expect(aviso.defaultPrevented).toBe(false);
        // Nada mais pergunta nem anda depois.
        await navegador(() => undefined);
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(indiceAtual()).toBe(2);
      } finally {
        window.removeEventListener("popstate", contar);
        window.removeEventListener("hashchange", contar);
      }
    });

    it("B12 — destino à frente COM hash, apagado por âncora digitada: o mesmo caminho, por pushState, sem navegação do documento", async () => {
      const eventosDoNavegador: string[] = [];
      const contar = (evento: Event) => eventosDoNavegador.push(evento.type);
      try {
        window.history.replaceState(null, "", `/${LISTAGEM}`);
        montarComGuarda();
        const tabela = await screen.findByRole("table", {
          name: /^Colaboradores — /,
        });
        fireEvent.click(
          within(tabela).getByRole("button", {
            name: `Abrir ficha de ${ana.nome}`,
          }),
        );
        await esperarFicha(ana.nome);
        fireEvent.click(
          within(fichaNaTela()!).getByRole("button", {
            name: "Colaboradores",
          }),
        );
        await screen.findByRole("table", { name: /^Colaboradores — / });
        await navegador(() => window.history.back());
        await esperarFicha(ana.nome);
        editarNome();
        await navegador(() => window.history.forward());
        await esperarPergunta();
        await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
        await navegador(() => {
          window.location.hash = "#conteudo-principal";
        });

        const empilhar = vi.spyOn(window.history, "pushState");
        window.addEventListener("popstate", contar);
        window.addEventListener("hashchange", contar);
        sairSemSalvar();
        await navegador(() => undefined);
        await navegador(() => undefined);
        await screen.findByRole("table", { name: /^Colaboradores — / });
        expect(window.location.hash).toBe(LISTAGEM);
        expect(indiceAtual()).toBe(3);
        expect(empilhar).toHaveBeenCalledWith(
          expect.objectContaining({ evolliIndice: 3 }),
          "",
          expect.stringContaining(LISTAGEM),
        );
        expect(eventosDoNavegador).toEqual([]);
        empilhar.mockRestore();
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(document.activeElement).not.toBe(document.body);
      } finally {
        window.removeEventListener("popstate", contar);
        window.removeEventListener("hashchange", contar);
      }
    });
  });
});

describe("T201 — aba Documentos da ficha no shell", () => {
  const painelDocumentos = (nome = ana.nome) =>
    screen.findByRole("table", { name: `Documentos registrados — ${nome}` });
  const voltarPelaTrilha = () =>
    fireEvent.click(
      within(
        document.querySelector<HTMLElement>(".ficha-colaborador")!,
      ).getByRole("button", { name: "Colaboradores" }),
    );

  it("rota direta abre a aba Documentos; recarregar a mantém", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "documentos")}`);
    const entradas = window.history.length;
    const { unmount } = render(<App papelDoAtor="dp" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Documentos");
    await painelDocumentos();
    expect(window.location.hash).toBe(rotaDe(ana, "documentos"));
    expect(window.history.length).toBe(entradas);
    expect(listarDocumentos).toHaveBeenCalledWith(
      expect.objectContaining({ colaboradorId: ana.id }),
    );
    const url = window.location.hash;
    unmount();

    window.history.replaceState(null, "", `/${url}`);
    render(<App papelDoAtor="dp" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Documentos");
    await painelDocumentos();
  });

  it("a aba muda a URL; 'voltar' e 'avançar' alternam entre ela e a anterior", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "jornada")}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    // Só ao abrir a aba os documentos são lidos.
    expect(listarDocumentos).not.toHaveBeenCalled();
    const aba = screen.getByRole("tab", { name: "Documentos" });
    aba.focus();
    fireEvent.click(aba);
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaDe(ana, "documentos")),
    );
    await painelDocumentos();
    // O foco fica na aba (padrão de abas): a carga não o tira dela.
    expect(screen.getByRole("tab", { name: "Documentos" })).toHaveFocus();

    navegadorVaiPara(rotaDe(ana, "jornada"));
    await waitFor(() =>
      expect(abaSelecionada()).toHaveTextContent("Jornada de trabalho"),
    );
    navegadorVaiPara(rotaDe(ana, "documentos"));
    await waitFor(() =>
      expect(abaSelecionada()).toHaveTextContent("Documentos"),
    );
    // A aba já visitada fica montada: nada é relido por voltar a ela.
    expect(listarDocumentos).toHaveBeenCalledTimes(1);
  });

  it("outra pessoa pela URL: a aba lê e mostra só os documentos dela", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "documentos")}`);
    render(<App papelDoAtor="rh" />);
    await painelDocumentos();
    navegadorVaiPara(rotaDe(bruno, "documentos"));
    await painelDocumentos(bruno.nome);
    expect(
      vi.mocked(listarDocumentos).mock.calls.map((c) => c[0]?.colaboradorId),
    ).toEqual([ana.id, bruno.id]);
    expect(
      screen.queryByRole("table", {
        name: `Documentos registrados — ${ana.nome}`,
      }),
    ).toBeNull();
  });

  it("colaborador fora da empresa da sessão: 'não encontrado', e nenhum documento é lido", async () => {
    window.history.replaceState(
      null,
      "",
      `/${LISTAGEM}/99999999-9999-4999-8999-999999999999/documentos`,
    );
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", {
      level: 1,
      name: "Colaborador não encontrado",
    });
    expect(screen.queryByRole("tab", { name: "Documentos" })).toBeNull();
    expect(obterUsuarioAtual).not.toHaveBeenCalled();
    expect(listarDocumentos).not.toHaveBeenCalled();
    expect(listarSolicitacoesDocumento).not.toHaveBeenCalled();
  });

  it.each(["gestor", "colaborador", "financeiro", "auditor", "dpo"] as const)(
    "%s com a URL da aba Documentos não monta a ficha, e nenhum documento é lido",
    async (papel) => {
      window.history.replaceState(null, "", `/${rotaDe(ana, "documentos")}`);
      render(<App papelDoAtor={papel} />);
      await screen.findByRole("navigation", { name: "Navegação do painel" });
      await waitFor(() => expect(window.location.hash).not.toContain(ana.id));
      expect(document.querySelector(".ficha-colaborador")).toBeNull();
      expect(listarDocumentos).not.toHaveBeenCalled();
      expect(listarSolicitacoesDocumento).not.toHaveBeenCalled();
      expect(listarTiposDocumento).not.toHaveBeenCalled();
    },
  );

  it("guarda de saída (T200): tipo escolhido e não salvo pergunta antes de sair da ficha", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "documentos")}`);
    render(
      <ComGuardaDeSaida>
        <App papelDoAtor="rh" />
      </ComGuardaDeSaida>,
    );
    await painelDocumentos();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar documento" }),
    );
    fireEvent.change(screen.getByLabelText(/^Tipo do documento/), {
      target: { value: "t-rg" },
    });
    voltarPelaTrilha();
    const pergunta = screen.getByRole("alertdialog", {
      name: "Sair sem salvar?",
    });
    expect(
      within(pergunta)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Ficha do colaborador"]);
    fireEvent.click(
      within(pergunta).getByRole("button", { name: "Continuar editando" }),
    );
    expect(screen.getByLabelText(/^Tipo do documento/)).toHaveValue("t-rg");
    expect(criarDocumento).not.toHaveBeenCalled();

    // Outra aba da ficha não é saída: o formulário fica, escondido.
    fireEvent.click(screen.getByRole("tab", { name: "Dados do colaborador" }));
    await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaDe(ana, "documentos")),
    );
    expect(screen.getByLabelText(/^Tipo do documento/)).toHaveValue("t-rg");
  });

  it("formulário aberto e vazio não pergunta nada ao sair", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "documentos")}`);
    render(
      <ComGuardaDeSaida>
        <App papelDoAtor="dp" />
      </ComGuardaDeSaida>,
    );
    await painelDocumentos();
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar documento" }),
    );
    voltarPelaTrilha();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await screen.findByRole("table", { name: /^Colaboradores — / });
  });
});

describe("T202 — rota da aba de ponto (rotasDoShell)", () => {
  it("competência na rota; sem ela, o mês corrente", () => {
    expect(fichaDaRota(`${LISTAGEM}/${ana.id}/ponto/2026-10`)).toEqual({
      colaboradorId: ana.id,
      aba: "ponto",
      competencia: "2026-10",
    });
    expect(fichaDaRota(`${LISTAGEM}/${ana.id}/ponto`)).toEqual({
      colaboradorId: ana.id,
      aba: "ponto",
      competencia: competenciaDoMesAtual(),
    });
    expect(
      rotaDaFicha({
        colaboradorId: ana.id,
        aba: "ponto",
        competencia: "2026-10",
      }),
    ).toBe(`${LISTAGEM}/${ana.id}/ponto/2026-10`);
    // Nas outras abas a competência não vai à URL.
    expect(
      rotaDaFicha({
        colaboradorId: ana.id,
        aba: "dados",
        competencia: "2026-10",
      }),
    ).toBe(`${LISTAGEM}/${ana.id}/dados`);
  });

  it("mês inválido, mês em outra aba ou segmento a mais: não é rota", () => {
    for (const fragmento of [
      `${LISTAGEM}/${ana.id}/ponto/2026-13`,
      `${LISTAGEM}/${ana.id}/ponto/2026-00`,
      `${LISTAGEM}/${ana.id}/ponto/2026-1`,
      `${LISTAGEM}/${ana.id}/ponto/26-11`,
      `${LISTAGEM}/${ana.id}/ponto/abc`,
      `${LISTAGEM}/${ana.id}/ponto/`,
      `${LISTAGEM}/${ana.id}/ponto/2026-11/extra`,
      `${LISTAGEM}/${ana.id}/dados/2026-11`,
      `${LISTAGEM}/${ana.id}/documentos/2026-11`,
    ]) {
      expect(fichaDaRota(fragmento)).toBeNull();
      expect(destinoDaRota(fragmento)).toBeNull();
    }
  });

  it("competência vizinha e validação", () => {
    expect(competenciaVizinha("2026-01", -1)).toBe("2025-12");
    expect(competenciaVizinha("2026-12", 1)).toBe("2027-01");
    expect(competenciaVizinha("2026-11", -1)).toBe("2026-10");
    expect(competenciaValida("2026-11")).toBe(true);
    expect(competenciaValida("2026-13")).toBe(false);
    expect(competenciaValida("0000-05")).toBe(false);
    expect(competenciaDoMesAtual(new Date(2026, 0, 31))).toBe("2026-01");
  });
});

describe("T202 — aba Registros de ponto no shell", () => {
  const blocoPrincipal = () =>
    screen.findByRole("region", { name: /MAT-0001 · vínculo principal/ });
  const rotaPonto = (c: ColaboradorListadoApi, competencia: string) =>
    `${LISTAGEM}/${c.id}/ponto/${competencia}`;
  const entradaDe = (competencia: string, momento: string) => ({
    id: `e-${competencia}`,
    vinculoId: ana.vinculos[0]!.id,
    empresaId: EMPRESA,
    tipo: "entrada" as const,
    momento,
    competencia,
    registradoPorUserId: "u-1",
    registradoEm: momento,
    efetivo: {
      tipo: "entrada" as const,
      momento,
      anulado: false,
      totalAjustes: 0,
    },
  });

  beforeEach(() => {
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (_id, q) =>
      q?.competencia === "2026-10"
        ? paginado([entradaDe("2026-10", "2026-10-05T11:00:00.000Z")])
        : paginado([]),
    );
  });

  it("rota direta abre a aba no mês da URL, sem entrada nova; recarregar mantém", async () => {
    window.history.replaceState(null, "", `/${rotaPonto(ana, "2026-10")}`);
    const entradas = window.history.length;
    const { unmount } = render(<App papelDoAtor="dp" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Registros de ponto");
    const bloco = await blocoPrincipal();
    expect(bloco).toHaveTextContent("05/10/2026");
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
    expect(window.location.hash).toBe(rotaPonto(ana, "2026-10"));
    expect(window.history.length).toBe(entradas);
    expect(listarPontosDoVinculo).toHaveBeenCalledWith(ana.vinculos[0]!.id, {
      competencia: "2026-10",
      pagina: 1,
      tamanhoPagina: 100,
    });
    const url = window.location.hash;
    unmount();

    window.history.replaceState(null, "", `/${url}`);
    render(<App papelDoAtor="dp" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Registros de ponto");
    expect(await blocoPrincipal()).toHaveTextContent("05/10/2026");
  });

  it("URL sem mês: abre no mês corrente e corrige a URL no lugar", async () => {
    window.history.replaceState(null, "", `/${LISTAGEM}/${ana.id}/ponto`);
    const entradas = window.history.length;
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    await blocoPrincipal();
    await waitFor(() =>
      expect(window.location.hash).toBe(
        rotaPonto(ana, competenciaDoMesAtual()),
      ),
    );
    expect(window.history.length).toBe(entradas);
  });

  it("mês inválido na URL não abre a ficha nem consulta ponto", async () => {
    window.history.replaceState(null, "", `/${rotaPonto(ana, "2026-13")}`);
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("navigation", { name: "Navegação do painel" });
    await waitFor(() => expect(window.location.hash).not.toContain("2026-13"));
    expect(document.querySelector(".ficha-colaborador")).toBeNull();
    expect(listarPontosDoVinculo).not.toHaveBeenCalled();
  });

  it("trocar de mês empilha entrada; voltar e avançar percorrem os meses", async () => {
    window.history.replaceState(null, "", `/${rotaPonto(ana, "2026-10")}`);
    render(<App papelDoAtor="rh" />);
    await blocoPrincipal();
    const entradas = window.history.length;
    const anterior = screen.getByRole("button", { name: "Mês anterior" });
    anterior.focus();
    fireEvent.click(anterior);
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaPonto(ana, "2026-09")),
    );
    expect(window.history.length).toBe(entradas + 1);
    expect(await screen.findByText("setembro de 2026")).toBeInTheDocument();
    expect(anterior).toHaveFocus();

    navegadorVaiPara(rotaPonto(ana, "2026-10"));
    expect(await screen.findByText("outubro de 2026")).toBeInTheDocument();
    expect(await blocoPrincipal()).toHaveTextContent("05/10/2026");
    navegadorVaiPara(rotaPonto(ana, "2026-09"));
    expect(await screen.findByText("setembro de 2026")).toBeInTheDocument();
  });

  it("trocar de aba: a de ponto abre no mês corrente e, ao voltar a ela, no último mês visto", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "dados")}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    expect(listarPontosDoVinculo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Registros de ponto" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(
        rotaPonto(ana, competenciaDoMesAtual()),
      ),
    );
    await blocoPrincipal();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    const mesAnterior = competenciaVizinha(competenciaDoMesAtual(), -1);
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaPonto(ana, mesAnterior)),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaDe(ana, "documentos")),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Registros de ponto" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaPonto(ana, mesAnterior)),
    );
  });

  it("outra pessoa pela URL: lê só os vínculos dela", async () => {
    window.history.replaceState(null, "", `/${rotaPonto(ana, "2026-10")}`);
    render(<App papelDoAtor="rh" />);
    await blocoPrincipal();
    navegadorVaiPara(rotaPonto(bruno, "2026-10"));
    await screen.findByRole("region", { name: /MAT-0002 · vínculo principal/ });
    expect(
      vi.mocked(listarPontosDoVinculo).mock.calls.map(([id]) => id),
    ).toEqual([ana.vinculos[0]!.id, bruno.vinculos[0]!.id]);
    expect(screen.queryByRole("region", { name: /MAT-0001/ })).toBeNull();
  });

  it("colaborador fora da empresa da sessão: 'não encontrado', sem consulta de ponto", async () => {
    window.history.replaceState(
      null,
      "",
      `/${LISTAGEM}/99999999-9999-4999-8999-999999999999/ponto/2026-10`,
    );
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", {
      level: 1,
      name: "Colaborador não encontrado",
    });
    expect(listarPontosDoVinculo).not.toHaveBeenCalled();
  });

  it.each(["gestor", "colaborador", "financeiro", "auditor", "dpo"] as const)(
    "%s com a URL da aba de ponto não monta a ficha, e nada de ponto é lido",
    async (papel) => {
      window.history.replaceState(null, "", `/${rotaPonto(ana, "2026-10")}`);
      render(<App papelDoAtor={papel} />);
      await screen.findByRole("navigation", { name: "Navegação do painel" });
      await waitFor(() => expect(window.location.hash).not.toContain(ana.id));
      expect(document.querySelector(".ficha-colaborador")).toBeNull();
      expect(listarPontosDoVinculo).not.toHaveBeenCalled();
    },
  );

  it("só leitura: sair da ficha pela aba de ponto não pergunta nada (sem edição pendente)", async () => {
    window.history.replaceState(null, "", `/${rotaPonto(ana, "2026-10")}`);
    render(
      <ComGuardaDeSaida>
        <App papelDoAtor="rh" />
      </ComGuardaDeSaida>,
    );
    await blocoPrincipal();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaPonto(ana, "2026-09")),
    );
    fireEvent.click(
      within(
        document.querySelector<HTMLElement>(".ficha-colaborador")!,
      ).getByRole("button", { name: "Colaboradores" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(registrarPonto).not.toHaveBeenCalled();
    expect(registrarAjustePonto).not.toHaveBeenCalled();
  });
});

describe("T203 — aba Solicitações no shell", () => {
  const blocoPrincipal = (c: ColaboradorListadoApi = ana) =>
    screen.findByRole("region", {
      name: new RegExp(
        `^CLT · ${c.vinculos[0]!.matricula} · vínculo principal`,
      ),
    });
  const solicitacaoDe = (c: ColaboradorListadoApi) => ({
    id: `s-de-${c.id}`,
    empresaId: EMPRESA,
    vinculoId: c.vinculos[0]!.id,
    tipo: "atestado" as const,
    motivo: "atestado_apresentado" as const,
    situacao: "enviada" as const,
    periodoReferencia: "2026-10-05",
    registradoPorUserId: "u-1",
    enviadaEm: "2026-10-05T12:30:00.000Z",
    primeiraRevisaoEm: null,
    criadoEm: "2026-10-05T12:00:00.000Z",
    atualizadoEm: "2026-10-05T12:30:00.000Z",
  });

  beforeEach(() => {
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) => {
      const dono = [ana, bruno].find((c) => c.vinculos[0]!.id === q?.vinculoId);
      return paginado(dono ? [solicitacaoDe(dono)] : []);
    });
  });

  function comoMaster(companyId: string | null) {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      id: "ator-sintetico",
      email: "pessoa.teste@example.test",
      role: "master_tecnico",
      companyId,
      unitId: null,
      teamId: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  }

  it("rota direta (RH) abre a aba, sem entrada nova; recarregar mantém; só leitura", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
    const entradas = window.history.length;
    const { unmount } = render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Solicitações");
    const bloco = await blocoPrincipal();
    expect(bloco).toHaveTextContent("Atestado");
    expect(window.location.hash).toBe(rotaDe(ana, "solicitacoes"));
    expect(window.history.length).toBe(entradas);
    expect(listarSolicitacoesPessoas).toHaveBeenCalledWith({
      vinculoId: ana.vinculos[0]!.id,
      pagina: 1,
      tamanhoPagina: 100,
    });
    const url = window.location.hash;
    unmount();

    window.history.replaceState(null, "", `/${url}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Solicitações");
    await blocoPrincipal();
    expect(registrarSolicitacaoPessoa).not.toHaveBeenCalled();
    expect(transicionarSolicitacaoPessoa).not.toHaveBeenCalled();
  });

  it("DP com a URL da aba: abre Dados do colaborador, corrige a URL no lugar e não consulta solicitações", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
    const entradas = window.history.length;
    render(<App papelDoAtor="dp" />);
    await esperarFicha(ana.nome);
    expect(abaSelecionada()).toHaveTextContent("Dados do colaborador");
    await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
    expect(window.history.length).toBe(entradas);
    expect(screen.queryByRole("tab", { name: "Solicitações" })).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
    expect(detalharSolicitacaoPessoa).not.toHaveBeenCalled();
    expect(historicoSolicitacaoPessoa).not.toHaveBeenCalled();
  });

  it("DP indo à URL da aba por voltar/avançar: fica em Dados, URL corrigida, sem consulta", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "jornada")}`);
    render(<App papelDoAtor="dp" />);
    await esperarFicha(ana.nome);
    navegadorVaiPara(rotaDe(ana, "solicitacoes"));
    await waitFor(() => expect(window.location.hash).toBe(rotaDe(ana)));
    expect(abaSelecionada()).toHaveTextContent("Dados do colaborador");
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
  });

  it("master_tecnico com empresa ativa lê; sem empresa, orientação e nenhuma consulta", async () => {
    comoMaster(EMPRESA);
    window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
    const { unmount } = render(<App papelDoAtor="master_tecnico" />);
    await blocoPrincipal();
    expect(listarSolicitacoesPessoas).toHaveBeenCalledTimes(1);
    unmount();

    vi.mocked(listarSolicitacoesPessoas).mockClear();
    comoMaster(null);
    window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
    render(<App papelDoAtor="master_tecnico" />);
    expect(
      await screen.findByText(
        `Escolha uma empresa ativa para consultar as solicitações de ${ana.nome}.`,
      ),
    ).toBeInTheDocument();
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
  });

  it("trocar de aba empilha a URL; voltar e avançar alternam entre ela e a anterior", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "dados")}`);
    render(<App papelDoAtor="rh" />);
    await esperarFicha(ana.nome);
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
    const entradas = window.history.length;
    const aba = screen.getByRole("tab", { name: "Solicitações" });
    aba.focus();
    fireEvent.click(aba);
    await waitFor(() =>
      expect(window.location.hash).toBe(rotaDe(ana, "solicitacoes")),
    );
    expect(window.history.length).toBe(entradas + 1);
    await blocoPrincipal();
    expect(screen.getByRole("tab", { name: "Solicitações" })).toHaveFocus();

    navegadorVaiPara(rotaDe(ana, "dados"));
    await waitFor(() =>
      expect(abaSelecionada()).toHaveTextContent("Dados do colaborador"),
    );
    navegadorVaiPara(rotaDe(ana, "solicitacoes"));
    await waitFor(() =>
      expect(abaSelecionada()).toHaveTextContent("Solicitações"),
    );
    // A aba já visitada fica montada: nada é relido por voltar a ela.
    expect(listarSolicitacoesPessoas).toHaveBeenCalledTimes(1);
  });

  it("outra pessoa pela URL: lê só os vínculos dela", async () => {
    window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
    render(<App papelDoAtor="rh" />);
    await blocoPrincipal();
    navegadorVaiPara(rotaDe(bruno, "solicitacoes"));
    await blocoPrincipal(bruno);
    expect(
      vi
        .mocked(listarSolicitacoesPessoas)
        .mock.calls.map(([q]) => q?.vinculoId),
    ).toEqual([ana.vinculos[0]!.id, bruno.vinculos[0]!.id]);
  });

  it("colaborador fora da empresa da sessão: 'não encontrado', sem consulta", async () => {
    window.history.replaceState(
      null,
      "",
      `/${LISTAGEM}/99999999-9999-4999-8999-999999999999/solicitacoes`,
    );
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", {
      level: 1,
      name: "Colaborador não encontrado",
    });
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
  });

  it.each(["gestor", "colaborador", "financeiro", "auditor", "dpo"] as const)(
    "%s com a URL da aba Solicitações não monta a ficha, e nada é lido",
    async (papel) => {
      window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
      render(<App papelDoAtor={papel} />);
      await screen.findByRole("navigation", { name: "Navegação do painel" });
      await waitFor(() => expect(window.location.hash).not.toContain(ana.id));
      expect(document.querySelector(".ficha-colaborador")).toBeNull();
      expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
    },
  );

  it("só leitura: com o detalhe aberto, sair da ficha não pergunta nada (sem edição pendente)", async () => {
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(solicitacaoDe(ana));
    window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
    render(
      <ComGuardaDeSaida>
        <App papelDoAtor="rh" />
      </ComGuardaDeSaida>,
    );
    const bloco = await blocoPrincipal();
    fireEvent.click(
      within(bloco).getByRole("button", { name: /^Ver detalhe/ }),
    );
    await screen.findByRole("heading", {
      level: 4,
      name: "Detalhe da solicitação de Atestado",
    });
    fireEvent.click(
      within(
        document.querySelector<HTMLElement>(".ficha-colaborador")!,
      ).getByRole("button", { name: "Colaboradores" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await screen.findByRole("table", { name: /^Colaboradores — / });
  });
});

describe("T204 — Nova solicitação na ficha, no shell", () => {
  const pergunta = () =>
    screen.findByRole("alertdialog", { name: "Sair sem salvar?" });
  async function navegador(acao: () => void) {
    await act(async () => {
      acao();
      await new Promise((resolver) => setTimeout(resolver, 20));
    });
  }
  /** Listagem → ficha (Dados) → aba Solicitações: três entradas. */
  async function abrirAbaSolicitacoes() {
    window.history.replaceState(null, "", `/${LISTAGEM}`);
    render(
      <ComGuardaDeSaida>
        <App papelDoAtor="rh" />
      </ComGuardaDeSaida>,
    );
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${ana.nome}`,
      }),
    );
    await esperarFicha(ana.nome);
    fireEvent.click(screen.getByRole("tab", { name: "Solicitações" }));
    return screen.findByRole("button", { name: "Nova solicitação" });
  }
  function escolherTipo(valor: string) {
    const janela = screen.getByRole("dialog", { name: "Nova solicitação" });
    fireEvent.change(within(janela).getByLabelText(/^Tipo/), {
      target: { value: valor },
    });
  }

  it("janela alterada: sair da ficha pelo navegador pergunta ('Nova solicitação'); continuar mantém o tipo; sair sem salvar sai sem gravar", async () => {
    fireEvent.click(await abrirAbaSolicitacoes());
    escolherTipo("ferias");

    await navegador(() => window.history.go(-2));
    const dialogo = await pergunta();
    expect(
      within(dialogo)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Nova solicitação"]);
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Continuar editando" }),
    );
    expect(
      within(
        screen.getByRole("dialog", { name: "Nova solicitação" }),
      ).getByLabelText(/^Tipo/),
    ).toHaveValue("ferias");
    expect(window.location.hash).toBe(rotaDe(ana, "solicitacoes"));

    await navegador(() => window.history.go(-2));
    fireEvent.click(
      within(await pergunta()).getByRole("button", { name: "Sair sem salvar" }),
    );
    await navegador(() => undefined);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(registrarSolicitacaoPessoa).not.toHaveBeenCalled();
  });

  it("registro em curso: sair espera o salvamento (nada é descartado nem repetido)", async () => {
    let entregar!: (v: unknown) => void;
    vi.mocked(registrarSolicitacaoPessoa).mockReturnValueOnce(
      new Promise((ok) => {
        entregar = ok;
      }) as never,
    );
    vi.mocked(transicionarSolicitacaoPessoa).mockResolvedValueOnce({} as never);
    fireEvent.click(await abrirAbaSolicitacoes());
    escolherTipo("ausencia");
    const janela = screen.getByRole("dialog", { name: "Nova solicitação" });
    fireEvent.click(within(janela).getByRole("button", { name: "Revisar" }));
    fireEvent.click(
      await within(janela).findByRole("button", { name: "Confirmar e enviar" }),
    );

    await navegador(() => window.history.go(-2));
    expect(
      await screen.findByRole("alertdialog", {
        name: "Aguarde o salvamento terminar",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sair sem salvar" })).toBe(
      null,
    );
    await act(async () => {
      entregar({
        id: "nova-shell",
        empresaId: EMPRESA,
        vinculoId: ana.vinculos[0]!.id,
        tipo: "ausencia",
        motivo: "ausencia_programada",
        situacao: "rascunho",
        periodoReferencia: null,
        registradoPorUserId: "u-1",
        enviadaEm: null,
        primeiraRevisaoEm: null,
        criadoEm: "2026-11-09T12:00:00.000Z",
        atualizadoEm: "2026-11-09T12:00:00.000Z",
      });
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Nova solicitação" })).toBe(
        null,
      ),
    );
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
    expect(transicionarSolicitacaoPessoa).toHaveBeenCalledWith("nova-shell", {
      acao: "enviar",
    });
    // Nada navega sozinho: continua na ficha.
    expect(document.querySelector(".ficha-colaborador")).not.toBeNull();
  });

  it("janela aberta sem alteração: sair não pergunta", async () => {
    fireEvent.click(await abrirAbaSolicitacoes());
    await navegador(() => window.history.go(-2));
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("master_tecnico com empresa: a aba lê, sem 'Nova solicitação'", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      id: "ator-sintetico",
      email: "pessoa.teste@example.test",
      role: "master_tecnico",
      companyId: EMPRESA,
      unitId: null,
      teamId: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    window.history.replaceState(null, "", `/${rotaDe(ana, "solicitacoes")}`);
    render(<App papelDoAtor="master_tecnico" />);
    await screen.findByText("Somente consulta");
    await waitFor(() => expect(listarSolicitacoesPessoas).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Nova solicitação" })).toBe(
      null,
    );
  });
});
