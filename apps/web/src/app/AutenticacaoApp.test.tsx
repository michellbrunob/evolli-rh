import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { abrirSecoesFechadasDoMenu } from "../test/menuLateral";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutenticacaoApp } from "./AutenticacaoApp";
import { definirDuracaoMinimaDaAbertura } from "./abertura/duracaoDaAbertura";
import { login, logout } from "../api/authClient";
import { refreshCsrfToken } from "../api/csrfClient";
import { ApiError, listarSessoesAtivas } from "../api/sessoesClient";
import {
  ApiError as ApiErrorDeUsuarios,
  obterUsuarioAtual,
} from "../api/usersClient";
import { listarTabelasHorario } from "../api/horariosClient";
import { listarEquipe } from "../api/gestorClient";
import {
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../api/organizacaoClient";
import { listarCargos } from "../api/cargoClient";
import {
  buscarColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../api/colaboradoresClient";
import { listarMovimentacoes } from "../api/movimentacaoClient";
import {
  listarDocumentos,
  listarSolicitacoesDocumento,
  listarTiposDocumento,
} from "../api/documentosClient";
import { listarPontosDoVinculo } from "../api/pontoClient";
import { listarSolicitacoesPessoas } from "../api/solicitacoesPessoasClient";
import {
  listarEmpresasDoContexto,
  trocarEmpresaDoContexto,
} from "../api/contextoEmpresarialClient";

vi.mock("../api/authClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/authClient")>(
      "../api/authClient",
    );
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
  };
});

vi.mock("../api/csrfClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/csrfClient")>(
      "../api/csrfClient",
    );
  return {
    ...actual,
    refreshCsrfToken: vi.fn(),
  };
});

vi.mock("../api/sessoesClient", async () => {
  const actual = await vi.importActual<typeof import("../api/sessoesClient")>(
    "../api/sessoesClient",
  );
  return {
    ...actual,
    listarSessoesAtivas: vi.fn(),
  };
});

// T131 — ao autenticar, o `AutenticacaoApp` consulta `GET /v1/users/me` para
// saber se o MFA está disponível. Mock padrão: MFA indisponível (lançamento
// inicial), coerente com o servidor com `MFA_ENABLED=false`.
//
// T153 — o mock passou a devolver um ator COMPLETO. Antes era
// `{ mfaAvailable: false }`, um substituto incompleto de `SafeAccessUserApi`
// que bastava enquanto a resposta só alimentava o MFA. Agora o shell só monta
// com o papel conhecido, e resposta sem `role` utilizável falha fechado — de
// propósito: montar com papel desconhecido é exatamente o estado que
// produzia 403 na aterrissagem. O papel `rh` mantém o destino inicial
// histórico ("Cadastros"), então nenhum teste anterior muda de comportamento.
/** Duas empresas sintéticas distintas, como no E2E do backend. */
export const EMPRESA_ALFA = {
  id: "empresa-sintetica",
  codigo: "ALFA",
  nome: "Empresa Alfa",
};
export const EMPRESA_BETA = {
  id: "empresa-sintetica-beta",
  codigo: "BETA",
  nome: "Empresa Beta",
};

export const ATOR_PADRAO = {
  id: "ator-sintetico-1",
  email: "pessoa.teste@example.test",
  role: "rh",
  companyId: "empresa-sintetica",
  unitId: null,
  teamId: null,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  mfaAvailable: false,
  // T163 — o ator já chega com o contexto empresarial resolvido.
  podeTrocarEmpresa: true,
  empresaAtiva: EMPRESA_ALFA,
};

vi.mock("../api/usersClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/usersClient")>(
      "../api/usersClient",
    );
  return {
    ...actual,
    obterUsuarioAtual: vi.fn(),
  };
});

// T153 — sentinelas da aterrissagem. `listarTabelasHorario` é o que a tela
// "Cadastros" dispara ao montar e o que produzia 403 para o gestor;
// `listarEquipe` é a consulta que ele de fato pode fazer. Mockados aqui para
// que os testes possam afirmar QUAL chamada saiu, e quando.
// T163 — o Hub não lê mais `/v1/empresas` (ressalva R-2 da T162): a empresa
// ativa chega dentro de `/v1/users/me`. O que ele consulta agora é a lista de
// empresas AUTORIZADAS, e só quando o servidor diz que o papel seleciona.
vi.mock("../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/contextoEmpresarialClient")
  >("../api/contextoEmpresarialClient");
  return {
    ...actual,
    listarEmpresasDoContexto: vi.fn(),
    trocarEmpresaDoContexto: vi.fn(),
  };
});

// T189 (B1) — a Nova admissão só oferece o cadastro rápido de referência
// com a empresa carregada. Por padrão estas leituras FALHAM, como falhavam
// antes (fetch sem servidor); os testes do B1 as resolvem.
vi.mock("../api/organizacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/organizacaoClient")
  >("../api/organizacaoClient");
  return {
    ...actual,
    listarEmpresasMulti: vi.fn(),
    listarDepartamentos: vi.fn(),
    listarUnidades: vi.fn(),
    listarEquipes: vi.fn(),
    listarCentrosCusto: vi.fn(),
    listarAreas: vi.fn(),
  };
});

vi.mock("../api/cargoClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/cargoClient")>(
      "../api/cargoClient",
    );
  return { ...actual, listarCargos: vi.fn() };
});

// T201 — a ficha aberta na aba Documentos: a pessoa, os vínculos e os
// documentos. Por padrão estas leituras FALHAM, como falhavam antes (fetch
// sem servidor); os testes da T201 as resolvem.
vi.mock("../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/colaboradoresClient")
  >("../api/colaboradoresClient");
  return {
    ...actual,
    buscarColaborador: vi.fn(),
    listarVinculosDoColaborador: vi.fn(),
    // T207 — as leituras do Dashboard passam pela implementação real (como
    // antes: fetch sem servidor, ou o fetch falso do teste); os testes da
    // vista do quadro as resolvem e devolvem depois.
    listarColaboradores: vi.fn(actual.listarColaboradores),
  };
});

vi.mock("../api/movimentacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/movimentacaoClient")
  >("../api/movimentacaoClient");
  return {
    ...actual,
    listarMovimentacoes: vi.fn(actual.listarMovimentacoes),
  };
});

// T203 — a ficha aberta na aba Solicitações. Por padrão a leitura FALHA,
// como falhava antes (fetch sem servidor); os testes da T203 a resolvem.
vi.mock("../api/solicitacoesPessoasClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/solicitacoesPessoasClient")
  >("../api/solicitacoesPessoasClient");
  return { ...actual, listarSolicitacoesPessoas: vi.fn() };
});

// T202 — a ficha aberta na aba Registros de ponto. Por padrão a leitura FALHA,
// como falhava antes (fetch sem servidor); os testes da T202 a resolvem.
vi.mock("../api/pontoClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/pontoClient")>(
      "../api/pontoClient",
    );
  return { ...actual, listarPontosDoVinculo: vi.fn() };
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
  };
});

vi.mock("../api/horariosClient", async () => {
  const actual = await vi.importActual<typeof import("../api/horariosClient")>(
    "../api/horariosClient",
  );
  return { ...actual, listarTabelasHorario: vi.fn() };
});

vi.mock("../api/gestorClient", async () => {
  const actual = await vi.importActual<typeof import("../api/gestorClient")>(
    "../api/gestorClient",
  );
  return { ...actual, listarEquipe: vi.fn(), detalharVinculo: vi.fn() };
});

const EMAIL_SINTETICO = "pessoa.teste@example.test";
const SENHA_SINTETICA = "SenhaSintetica123!";

beforeEach(() => {
  vi.clearAllMocks();
  // Reposto a cada teste porque `clearAllMocks` não repõe implementação, e
  // os testes da T153 trocam o ator deliberadamente.
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ATOR_PADRAO as never);
  vi.mocked(listarTabelasHorario).mockResolvedValue({
    itens: [],
    total: 0,
  } as never);
  vi.mocked(listarEquipe).mockResolvedValue({
    dataReferencia: "2026-10-08",
    itens: [],
  } as never);
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([
    EMPRESA_ALFA,
    EMPRESA_BETA,
  ]);
  vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(EMPRESA_BETA);
  for (const leitura of [
    listarEmpresasMulti,
    listarDepartamentos,
    listarUnidades,
    listarEquipes,
    listarCentrosCusto,
    listarAreas,
    listarCargos,
    buscarColaborador,
    listarVinculosDoColaborador,
    listarTiposDocumento,
    listarDocumentos,
    listarSolicitacoesDocumento,
    listarPontosDoVinculo,
    listarSolicitacoesPessoas,
  ]) {
    vi.mocked(leitura).mockRejectedValue(new Error("rede") as never);
  }
});

/**
 * T162 — o login leva ao **Hub**, não mais ao shell.
 *
 * Os testes que exercitam o shell passaram a atravessar o Hub em vez de pular
 * por cima dele: nenhuma asserção foi removida, só deixou de valer o atalho
 * "entrar = shell montado". Onde o teste provava que algo NÃO é chamado antes
 * do shell, a garantia ficou mais forte — agora existe uma tela inteira entre
 * as duas coisas, e nela nada funcional roda.
 */
const TITULO_DO_HUB = "Seu acesso";

function preencherEEntrar() {
  fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
    target: { value: EMAIL_SINTETICO },
  });
  fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
    target: { value: SENHA_SINTETICA },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

/**
 * T205 — depois do login (ou da sessão restaurada), RH, DP e
 * `master_tecnico` aterrissam no Dashboard (D-2); o Hub fica a um clique,
 * pelo topo. Os testes que exercitam o Hub chegam a ele por aqui: aceitam o
 * Hub já na tela ou saem do Dashboard pelo botão "Hub".
 */
const TITULO_DO_DASHBOARD = "Dashboard";

function hubNaTela() {
  return screen.queryByRole("heading", { level: 1, name: TITULO_DO_HUB });
}

function dashboardNaTela() {
  return screen.queryByRole("heading", {
    level: 1,
    name: TITULO_DO_DASHBOARD,
  });
}

/**
 * T209 — o Hub foi desativado como destino de uso normal: depois do login,
 * a sessão aterrissa no destino do papel (o Dashboard, para o ator padrão).
 * Os testes que passavam pelo Hub chegam a essa aterrissagem.
 */
async function chegarAoHub() {
  await waitFor(() => expect(dashboardNaTela()).not.toBeNull());
}

/**
 * T209 — "Sair" e "Sessões ativas" moram no menu da conta, na barra
 * superior; a tela de acesso temporário tem o próprio "Sair".
 */
async function itemDaConta(nome: string): Promise<HTMLElement> {
  const direto = screen.queryByRole("button", { name: nome });
  if (direto) return direto;
  const conta = screen.getByRole("button", { name: /^Conta: / });
  if (conta.getAttribute("aria-expanded") !== "true") {
    fireEvent.keyDown(conta, { key: "Enter" });
  }
  return screen.findByRole("menuitem", { name: nome });
}

const botaoSair = () => itemDaConta("Sair");

/** T209 — um destino do menu lateral (não o cabeçalho de um módulo). */
function itemDoMenu(rotulo: RegExp): HTMLElement {
  const nav = screen.getByRole("navigation", { name: "Navegação do painel" });
  return within(nav)
    .getAllByRole("button", { name: rotulo })
    .find((b) => !b.hasAttribute("aria-expanded"))!;
}

/** Do login até o Hub (passando pela aterrissagem no Dashboard). */
async function entrarNoHub() {
  preencherEEntrar();
  await chegarAoHub();
}

/**
 * Abre um produto e espera o shell montar. T209 — sem Hub, pelo item do menu
 * lateral (o destino, não o cabeçalho de um módulo expansível).
 */
async function abrirProduto(rotulo: RegExp | string) {
  const nav = await screen.findByRole("navigation", {
    name: "Navegação do painel",
  });
  abrirSecoesFechadasDoMenu();
  const alvo = within(nav)
    .getAllByRole("button", { name: rotulo })
    .find((b) => !b.hasAttribute("aria-expanded"));
  fireEvent.click(alvo!);
  await screen.findByRole("navigation", { name: "Navegação do painel" });
}

/** Caminho completo do ator padrão (`rh`): login, Hub e produto aberto. */
async function entrar() {
  await entrarNoHub();
  await abrirProduto(/^Colaboradores/);
}

describe("AutenticacaoApp (T116) — portão de sessão", () => {
  it("mostra 'Verificando sessão…' antes da checagem terminar, sem shell nem login", async () => {
    let resolver: () => void;
    vi.mocked(refreshCsrfToken).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = () => resolve("token-x");
      }),
    );

    render(<AutenticacaoApp />);

    expect(screen.getByText("Verificando sessão…")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).not.toBeInTheDocument();

    resolver!();
    // Sessão válida leva à aterrissagem do papel (T205; T209: sem Hub), e
    // nunca ao login.
    await chegarAoHub();
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
  });

  it("sessão ausente (401 em /auth/csrf): mostra a tela de login, shell completamente oculto", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));

    render(<AutenticacaoApp />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("sessão válida ao recarregar: abre a aterrissagem do papel (o Dashboard, T205), nunca o login", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");

    render(<AutenticacaoApp />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
    // O Hub continua a um clique, pelo topo.
    await chegarAoHub();
  });

  it("T178: recarregar numa rota do shell abre direto nela, sem passar pelo Hub", async () => {
    window.history.replaceState(null, "", "#/pessoas/colaboradores");
    try {
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
      render(<AutenticacaoApp />);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { level: 1, name: TITULO_DO_HUB }),
      ).not.toBeInTheDocument();
      expect(window.location.hash).toBe("#/pessoas/colaboradores");
    } finally {
      window.history.replaceState(null, "", window.location.pathname);
    }
  });

  it("T178/T205: sem rota na URL, recarregar abre a aterrissagem do papel, com a rota dela", async () => {
    window.history.replaceState(null, "", window.location.pathname);
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    render(<AutenticacaoApp />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      }),
    ).toBeInTheDocument();
    expect(window.location.hash).toMatch(/^#\/dashboard\?ano=\d{4}$/);
    expect(hubNaTela()).toBeNull();
  });

  it("login bem-sucedido libera o shell (navegação e telas internas aparecem só depois)", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });

    await entrar();

    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).not.toBeInTheDocument();
    expect(await botaoSair()).toBeInTheDocument();
  });

  it("T209: o login leva direto à aterrissagem do papel — nenhuma tela de Hub antes", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    await entrarNoHub();

    expect(hubNaTela()).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
    await abrirProduto(/^Colaboradores Consulta/);
    expect(hubNaTela()).toBeNull();
  });

  it("T209: não há 'Hub' no topo para voltar; o shell continua montado", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");

    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores Consulta/);

    expect(screen.queryByRole("button", { name: "Hub" })).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
  });

  it("logout real: chama o endpoint via authClient, limpa o estado e volta ao login", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    vi.mocked(logout).mockResolvedValueOnce(undefined);

    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);

    fireEvent.click(await botaoSair());

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
  });

  it("logout volta ao login mesmo se o servidor não confirmar (ex.: sessão já expirada)", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    vi.mocked(logout).mockRejectedValueOnce(new Error("401"));

    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);

    fireEvent.click(await botaoSair());

    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
  });

  it("botão 'Sair' só existe depois de autenticado — nunca durante verificação ou login", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });

    expect(
      screen.queryByRole("button", { name: "Sair" }),
    ).not.toBeInTheDocument();
  });

  it("nunca grava token CSRF, e-mail ou senha em localStorage/sessionStorage ao longo de todo o ciclo", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    vi.mocked(logout).mockResolvedValueOnce(undefined);

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    await entrar();
    fireEvent.click(await botaoSair());
    await waitFor(() => expect(logout).toHaveBeenCalled());

    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("T117: 'Sessões ativas' descobrindo que a própria sessão não é mais válida (401) volta ao login, como o logout", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    vi.mocked(listarSessoesAtivas).mockRejectedValueOnce(
      new ApiError(401, "Não autorizado."),
    );

    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);

    fireEvent.click(await itemDaConta("Sessões ativas"));
    await screen.findByRole("heading", { name: "Sessões ativas" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
  });

  it("T117: botão 'Sessões ativas' só existe depois de autenticado — nunca durante verificação ou login", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });

    expect(
      screen.queryByRole("button", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T153 — B1: o papel autorizado não pode aterrissar numa tela proibida, e
// nenhuma requisição funcional pode sair antes de o ator ser conhecido.
//
// T162 — o Hub entrou entre o ator resolvido e o shell, e por isso os casos
// deste bloco passaram a dizer DUAS coisas onde antes diziam uma:
//
//   1. no Hub, nada funcional é chamado — nem o que o papel poderia chamar;
//   2. ao abrir o produto, a aterrissagem continua sendo a que a T153 fixou.
//
// A asserção que importa — "este papel nunca toca no recurso proibido" — não
// foi afrouxada em nenhum caso: ela agora vale do login até depois de o shell
// montar, e não só no instante da montagem.
// ---------------------------------------------------------------------------

function ator(role: string, over: Record<string, unknown> = {}) {
  return { ...ATOR_PADRAO, id: `ator-${role}`, role, ...over } as never;
}

/** Promessa controlável, para manter `/v1/users/me` pendente de propósito. */
function deferido<T>() {
  let resolver!: (v: T) => void;
  const promise = new Promise<T>((a) => {
    resolver = a;
  });
  return { promise, resolve: resolver };
}

async function commitar(acao: () => void) {
  await act(async () => {
    acao();
    await new Promise((r) => setTimeout(r, 0));
  });
}

function destinosAtivos() {
  return [...document.querySelectorAll("nav button")]
    .filter((b) => b.getAttribute("aria-current") === "page")
    .map((b) => b.textContent?.replace(/\s+/g, " ").trim());
}

describe("T153 — aterrissagem segura por papel", () => {
  it("B1.1 com /v1/users/me pendente, nem <App> nem tela funcional montam", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    const d = deferido<unknown>();
    vi.mocked(obterUsuarioAtual).mockReturnValueOnce(d.promise as never);

    render(<AutenticacaoApp />);

    expect(
      await screen.findByText("Carregando seu acesso…"),
    ).toBeInTheDocument();
    // Nada do shell: sem navegação, sem main, sem h1, sem botão Sair.
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();

    await commitar(() => d.resolve(ator("rh")));
    // T205 — ator conhecido: só agora o shell monta, já no Dashboard (D-2).
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
    expect(hubNaTela()).toBeNull();
  });

  it("B1.2 nenhum cliente funcional é chamado antes de o ator ser conhecido", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    const d = deferido<unknown>();
    vi.mocked(obterUsuarioAtual).mockReturnValueOnce(d.promise as never);

    render(<AutenticacaoApp />);
    await screen.findByText("Carregando seu acesso…");

    // `listarTabelasHorario` é o cliente que a tela "Cadastros" dispara ao montar —
    // a origem concreta do 403 medido no navegador.
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
    expect(vi.mocked(listarEquipe)).not.toHaveBeenCalled();

    await commitar(() => d.resolve(ator("gestor")));
    // T205 — o gestor aterrissa direto na consulta da equipe (D-2): a
    // primeira (e única) chamada funcional é a permitida.
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
    expect(vi.mocked(listarEquipe)).toHaveBeenCalled();
  });

  it("B1.3 gestor entra DIRETO na consulta da equipe, sem passar pelo Hub (T205)", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Minha equipe" }),
    ).toBeInTheDocument();
    // T211 — no menu, o item de Minha equipe se chama Liderança.
    expect(destinosAtivos()).toEqual(["Liderança Consulta do gestor"]);
    expect(hubNaTela()).toBeNull();
    // Aterrissar numa tela não deixa o foco no body: ele vai ao título.
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("equipe-titulo"),
    );
    // Sem Dashboard para o gestor (ADR 0015): nem tela, nem item no menu.
    expect(dashboardNaTela()).toBeNull();
    expect(
      within(
        screen.getByRole("navigation", { name: "Navegação do painel" }),
      ).queryByRole("button", { name: /^Dashboard/ }),
    ).toBeNull();
  });

  it("B1.4 gestor NÃO chama /v1/horarios no login", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("button", { name: "Entrar" });
    preencherEEntrar();
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
  });

  it("B1.5 gestor NÃO chama /v1/horarios no refresh (sessão já válida)", async () => {
    // Refresh = montagem com cookie de sessão válido, sem passar pelo login.
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
  });

  it("B1.6 'Horários' e 'Somente RH' nunca aparecem para o gestor", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    const d = deferido<unknown>();
    vi.mocked(obterUsuarioAtual).mockReturnValueOnce(d.promise as never);

    render(<AutenticacaoApp />);
    await screen.findByText("Carregando seu acesso…");
    // Durante a inicialização não existe conteúdo de tela nenhuma.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();

    await commitar(() => d.resolve(ator("gestor")));
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    const main = screen.getByRole("main");
    expect(main.textContent).not.toContain("Horários");
    expect(main.textContent).not.toContain("Somente RH");
    expect(main.textContent).not.toContain("tabelas de horário");
  });

  it("B1.7 a primeira chamada funcional do gestor é a consulta permitida", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    expect(vi.mocked(listarEquipe)).toHaveBeenCalled();
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
  });

  it("B1.8 rh aterrissa no Dashboard (T205), que é o primeiro item do menu", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("rh"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", {
      level: 1,
      name: TITULO_DO_DASHBOARD,
    });

    expect(destinosAtivos()).toEqual(["Dashboard Visão geral do ano"]);
    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    expect(within(nav).getAllByRole("button")[0]).toHaveTextContent(
      /^Dashboard/,
    );
    // E continua vendo Minha equipe (o item Liderança), porque o contrato lhe
    // concede.
    abrirSecoesFechadasDoMenu();
    expect(
      screen.getByRole("button", { name: /^Liderança/ }),
    ).toBeInTheDocument();
  });

  /**
   * T159 — a aterrissagem deixou de ser "Cadastros para todos". T205 — `dp`
   * e `master_tecnico` (com ou sem empresa) aterrissam no Dashboard;
   * `colaborador` e `financeiro` não têm destino funcional algum: ficam no
   * Hub e, de lá, só a Visão geral demonstrativa, que **não faz requisição**.
   */
  it.each([
    ["dp", {}],
    ["master_tecnico", {}],
    [
      "master_tecnico",
      { companyId: null, empresaAtiva: null, podeTrocarEmpresa: true },
    ],
  ])(
    "B1.9 papel %s aterrissa no Dashboard e não ganha a capacidade de liderança",
    async (papel, extra) => {
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator(papel, extra));

      render(<AutenticacaoApp />);
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      });

      expect(destinosAtivos()).toEqual(["Dashboard Visão geral do ano"]);
      abrirSecoesFechadasDoMenu();
      expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
    },
  );

  it.each(["colaborador", "financeiro"])(
    "B1.9 papel %s não tem Dashboard nem Minha equipe: tela de acesso temporário, sem módulos (T209)",
    async (papel) => {
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator(papel));

      render(<AutenticacaoApp />);
      await screen.findByRole("heading", {
        level: 1,
        name: "Acesso em configuração",
      });
      expect(dashboardNaTela()).toBeNull();
      expect(hubNaTela()).toBeNull();
      expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
      expect(
        screen.queryByRole("navigation", { name: "Navegação do painel" }),
      ).toBeNull();
    },
  );

  it("B1.10 falha em /v1/users/me não monta nenhuma tela protegida", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockRejectedValueOnce(new Error("500"));

    render(<AutenticacaoApp />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar seu acesso.",
    );
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
    expect(vi.mocked(listarEquipe)).not.toHaveBeenCalled();
  });

  it("B1.11 retry bem-sucedido monta a aplicação uma única vez", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual)
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    // T205 — a aterrissagem vale também depois da nova tentativa.
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });
    expect(screen.queryByRole("alert")).toBeNull();
    // Uma aplicação, não duas: um <main>, uma navegação do painel (T209: a
    // barra superior tem a própria, a da trilha).
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(
      screen.getAllByRole("navigation", { name: "Navegação do painel" }),
    ).toHaveLength(1);
  });

  it("B1.12 logout e login com outro papel recalculam o destino", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));
    vi.mocked(logout).mockResolvedValueOnce(undefined);
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    fireEvent.click(await botaoSair());
    await screen.findByRole("button", { name: "Entrar" });

    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("rh"));
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    // T205 — a sessão nova aterrissa de novo, pelo papel NOVO (o rh vai ao
    // Dashboard), e não herda o produto em que a anterior estava.
    await screen.findByRole("heading", {
      level: 1,
      name: TITULO_DO_DASHBOARD,
    });
    expect(destinosAtivos()).toEqual(["Dashboard Visão geral do ano"]);
  });

  it("B1.13 quem já navegou não é redirecionado de novo", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    // T211 — Relatórios (demonstração) saiu do menu: Configurações é o
    // outro destino que o gestor abre.
    fireEvent.click(screen.getByRole("button", { name: /^Configurações/ }));
    await screen.findByRole("navigation", { name: "Navegação do painel" });

    // Vários ciclos de render depois, continua onde a pessoa escolheu.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(destinosAtivos()).toEqual(["Configurações Meu perfil"]);
    expect(
      screen.queryByRole("heading", { level: 1, name: "Minha equipe" }),
    ).toBeNull();
  });

  it("B1.14 montagem dupla (StrictMode) não produz chamada proibida", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValue("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor"));

    render(
      <StrictMode>
        <AutenticacaoApp />
      </StrictMode>,
    );
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
  });

  it("B1.15 o corpo interno do erro de /v1/users/me nunca é exibido", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockRejectedValueOnce(
      Object.assign(new Error("detalhe interno que NUNCA deve vazar"), {
        status: 500,
        body: { request_id: "req-xyz", message: "segredo do servidor" },
      }),
    );

    render(<AutenticacaoApp />);
    await screen.findByRole("alert");

    const texto = document.body.textContent ?? "";
    for (const vazamento of [
      "detalhe interno",
      "req-xyz",
      "segredo do servidor",
      "request_id",
      "status_code",
      "500",
    ]) {
      expect(texto).not.toContain(vazamento);
    }
  });

  it("B1.16 resposta sem papel utilizável falha fechado, não monta o shell", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce({
      ...ATOR_PADRAO,
      role: "   ",
    } as never);

    render(<AutenticacaoApp />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T163/T189 — a troca de empresa remonta a árvore inteira; desde a T189, no
// mesmo módulo, pelo seletor do menu lateral ou do Hub, com aviso às outras
// abas e reconferência ao foco.
// ---------------------------------------------------------------------------

/**
 * `BroadcastChannel` de mentira, no mesmo processo: o que uma instância
 * publica chega às OUTRAS com o mesmo nome — como entre abas. A "outra aba"
 * dos testes é uma instância criada pelo próprio teste.
 */
class CanalFalso {
  static abertos = new Set<CanalFalso>();
  private readonly ouvintes = new Set<(e: { data: unknown }) => void>();
  constructor(readonly name: string) {
    CanalFalso.abertos.add(this);
  }
  postMessage(dado: unknown) {
    for (const canal of CanalFalso.abertos) {
      if (canal === this || canal.name !== this.name) continue;
      for (const ouvinte of canal.ouvintes) ouvinte({ data: dado });
    }
  }
  addEventListener(_tipo: string, ouvinte: (e: { data: unknown }) => void) {
    this.ouvintes.add(ouvinte);
  }
  removeEventListener(_tipo: string, ouvinte: (e: { data: unknown }) => void) {
    this.ouvintes.delete(ouvinte);
  }
  close() {
    CanalFalso.abertos.delete(this);
  }
}

const NOME_DO_CANAL = "evolli-contexto-empresarial";
const ATOR_EM_BETA = {
  ...ATOR_PADRAO,
  companyId: EMPRESA_BETA.id,
  empresaAtiva: EMPRESA_BETA,
};

/**
 * Faz o "servidor" passar a responder com a empresa Beta ativa a partir da
 * confirmação da troca — e não antes. É o que permite afirmar que a tela
 * mudou porque o servidor mudou, e não porque ela se adiantou.
 */
function trocarParaBetaNoServidor() {
  vi.mocked(obterUsuarioAtual).mockResolvedValue({ ...ATOR_PADRAO } as never);
  vi.mocked(trocarEmpresaDoContexto).mockImplementation(async (id) => {
    const empresa = id === EMPRESA_BETA.id ? EMPRESA_BETA : EMPRESA_ALFA;
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR_PADRAO,
      companyId: empresa.id,
      empresaAtiva: empresa,
    } as never);
    return empresa;
  });
}

/** O servidor mudou de empresa por fora desta aba (outra aba, revogação). */
function servidorPassaParaBeta() {
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ATOR_EM_BETA as never);
}

const anuncio = () =>
  document.querySelector(".autenticacao-app__anuncio") as HTMLElement;
const seletorDoMenu = () =>
  document.getElementById("menu-empresa-ativa-botao") as HTMLButtonElement;

async function trocarPeloMenuPara(nome: string) {
  await waitFor(() => expect(seletorDoMenu()).not.toBeNull());
  fireEvent.click(seletorDoMenu());
  fireEvent.click(
    await screen.findByRole("button", { name: new RegExp(`^${nome}`) }),
  );
}

/**
 * T210 (estabilização) — consultas da Nova admissão no contêiner certo (as
 * etapas, o rodapé do cadastro). Na árvore inteira do app (menu, barra e as
 * quatro etapas montadas), cada consulta por papel ou rótulo custa ~0,4 s no
 * jsdom (nome acessível e `getComputedStyle` de cada candidato), e os testes
 * da T189 encostavam nos 5 s. As asserções continuam as mesmas.
 */
const conteudoDoCadastro = () =>
  document.querySelector<HTMLElement>(".cadastro-etapas__conteudo")!;
const rodapeDoCadastro = () =>
  document.querySelector<HTMLElement>(".cadastro-etapas__rodape")!;

async function abrirNovaAdmissaoPorRota() {
  window.history.replaceState(null, "", "#/pessoas/nova-admissao");
  vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
  render(<AutenticacaoApp />);
  return screen.findByLabelText(/^Nome completo/);
}

describe("T163/T189 — contexto empresarial ativo", () => {
  beforeEach(() => {
    CanalFalso.abertos.clear();
    vi.stubGlobal("BroadcastChannel", CanalFalso);
    window.history.replaceState(null, "", window.location.pathname);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("o Hub mostra a empresa ATIVA que o servidor resolveu, no seletor", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    expect(botao).toHaveTextContent("Empresa Alfa");
    expect(botao).toHaveTextContent("Código ALFA");
  });

  it("troca pelo menu lateral DENTRO de Colaboradores: fica no módulo, limpo, com o título em foco", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    trocarParaBetaNoServidor();
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);
    expect(window.location.hash).toBe("#/pessoas/colaboradores");

    // Busca antiga digitada na empresa Alfa.
    const busca = (await screen.findByLabelText(
      /Buscar por nome ou matrícula/,
    )) as HTMLInputElement;
    fireEvent.change(busca, { target: { value: "busca da empresa anterior" } });

    await trocarPeloMenuPara("Empresa Beta");

    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    // Mesmo módulo, não o Hub.
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: TITULO_DO_HUB }),
    ).toBeNull();
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
    // Recriado: a busca da empresa anterior não sobrou.
    const buscaNova = (await screen.findByLabelText(
      /Buscar por nome ou matrícula/,
    )) as HTMLInputElement;
    expect(buscaNova.value).toBe("");
    // Foco no título da tela de destino; anúncio da troca.
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("colaboradores-titulo"),
    );
    expect(anuncio()).toHaveTextContent("Empresa Beta (código BETA)");
    // Nada da empresa anterior no conteúdo nem no anúncio.
    const main = document.getElementById("conteudo-principal")!;
    expect(main.textContent).not.toMatch(/Empresa Alfa|ALFA/);
    expect(anuncio().textContent).not.toMatch(/Alfa|ALFA/);
  });

  it("rota direta da Nova admissão: a troca reduz ao nível do módulo (Colaboradores)", async () => {
    trocarParaBetaNoServidor();
    await abrirNovaAdmissaoPorRota();
    expect(window.location.hash).toBe("#/pessoas/nova-admissao");

    await trocarPeloMenuPara("Empresa Beta");

    await waitFor(() =>
      expect(window.location.hash).toBe("#/pessoas/colaboradores"),
    );
    expect(screen.queryByLabelText(/^Nome completo/)).toBeNull();
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
  });

  it("T198 — ficha aberta pela rota: a troca volta à listagem da empresa nova, sem a ficha anterior", async () => {
    trocarParaBetaNoServidor();
    const rotaDaFicha =
      "#/pessoas/colaboradores/11111111-1111-4111-8111-111111111111/contratuais";
    window.history.replaceState(null, "", rotaDaFicha);
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await waitFor(() =>
      expect(document.querySelector(".ficha-colaborador")).not.toBeNull(),
    );
    expect(window.location.hash).toBe(rotaDaFicha);

    await trocarPeloMenuPara("Empresa Beta");

    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe("#/pessoas/colaboradores"),
    );
    // A ficha da empresa anterior não é reaberta na empresa nova.
    expect(document.querySelector(".ficha-colaborador")).toBeNull();
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("colaboradores-titulo"),
    );
  });

  it("T205 — Dashboard aberto: a troca mantém o Dashboard, reabre no ano corrente (estado inicial seguro, como a T189), relê tudo na empresa nova e põe o foco no título", async () => {
    trocarParaBetaNoServidor();
    const respostas: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        respostas.push(String(url));
        const corpo = String(url).includes("/v1/colaboradores")
          ? {
              itens: [],
              pagina: 1,
              tamanhoPagina: 1,
              total: 0,
              contadores: {
                ativos: 0,
                inativos: 0,
                emAdmissao: 0,
                desligados: 0,
                total: 0,
                ativosPorTipo: {},
              },
            }
          : { itens: [], pagina: 1, tamanhoPagina: 100, total: 0 };
        return new Response(JSON.stringify(corpo), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    window.history.replaceState(null, "", "#/dashboard?ano=2025");
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    const status = () =>
      document.querySelector<HTMLElement>(".dashboard [role=status]");
    await waitFor(() =>
      expect(status()).toHaveTextContent("Dashboard de 2025 lido em"),
    );
    const leiturasAntes = respostas.length;
    expect(leiturasAntes).toBeGreaterThanOrEqual(3);

    await trocarPeloMenuPara("Empresa Beta");

    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    const corrente = new Date().getFullYear();
    await waitFor(() =>
      expect(status()).toHaveTextContent(`Dashboard de ${corrente} lido em`),
    );
    expect(window.location.hash).toBe(`#/dashboard?ano=${corrente}`);
    // Contadores e as duas séries, de novo, na empresa nova.
    expect(respostas.length).toBeGreaterThanOrEqual(leiturasAntes + 3);
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("dashboard-titulo"),
    );
  });

  describe("T201 — ficha na aba Documentos", () => {
    const ANA_ID = "11111111-1111-4111-8111-111111111111";
    const ROTA = `#/pessoas/colaboradores/${ANA_ID}/documentos`;
    const TIPO = {
      id: "t-rg",
      empresaId: EMPRESA_ALFA.id,
      codigo: "RG",
      nome: "Identidade (teste)",
      classificacao: "restrito",
      criadoEm: "2026-01-01T00:00:00.000Z",
      atualizadoEm: "2026-01-01T00:00:00.000Z",
    };
    const DOC = {
      id: "d-1",
      empresaId: EMPRESA_ALFA.id,
      colaboradorId: ANA_ID,
      tipoDocumentoId: TIPO.id,
      estado: "upload_desabilitado" as const,
      substituiDocumentoId: null,
      criadoEm: "2026-03-10T12:00:00.000Z",
      atualizadoEm: "2026-03-10T12:00:00.000Z",
    };
    const paginado = <T,>(itens: T[]) => ({
      itens,
      pagina: 1,
      tamanhoPagina: 20,
      total: itens.length,
    });

    function anaNaEmpresaAlfa() {
      vi.mocked(buscarColaborador).mockResolvedValue({
        id: ANA_ID,
        nome: "Ana Sintética (teste)",
        situacao: "ativo",
        criadoEm: "2025-01-10T12:00:00.000Z",
        atualizadoEm: "2025-01-10T12:00:00.000Z",
      });
      vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
        {
          id: "33333333-3333-4333-8333-333333333333",
          colaboradorId: ANA_ID,
          empresaId: EMPRESA_ALFA.id,
          matricula: "MAT-0001",
          tipo: "clt",
          situacao: "previsto",
          dataAdmissao: "2025-01-10",
          dataDesligamento: null,
          criadoEm: "2025-01-10T12:00:00.000Z",
          atualizadoEm: "2025-01-10T12:00:00.000Z",
        },
      ]);
      vi.mocked(listarTiposDocumento).mockResolvedValue(paginado([TIPO]));
      vi.mocked(listarSolicitacoesDocumento).mockResolvedValue(paginado([]));
    }

    it("troca de empresa com a leitura em curso: volta à listagem da empresa nova, e a resposta atrasada não aparece", async () => {
      trocarParaBetaNoServidor();
      anaNaEmpresaAlfa();
      let entregar!: (v: ReturnType<typeof paginado<typeof DOC>>) => void;
      vi.mocked(listarDocumentos).mockReturnValue(
        new Promise((ok) => {
          entregar = ok;
        }),
      );
      window.history.replaceState(null, "", ROTA);
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      render(<AutenticacaoApp />);
      await screen.findByRole("tab", { name: "Documentos", selected: true });
      await waitFor(() => expect(listarDocumentos).toHaveBeenCalledTimes(1));

      await trocarPeloMenuPara("Empresa Beta");
      await waitFor(() =>
        expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
      );
      await waitFor(() =>
        expect(window.location.hash).toBe("#/pessoas/colaboradores"),
      );
      expect(document.querySelector(".ficha-colaborador")).toBeNull();

      await act(async () => {
        entregar(paginado([DOC]));
      });
      const main = document.getElementById("conteudo-principal")!;
      expect(main.textContent).not.toMatch(
        /Identidade \(teste\)|Documentos registrados/,
      );
      expect(listarDocumentos).toHaveBeenCalledTimes(1);
    });

    it("tipo escolhido e não salvo: a troca de empresa pergunta antes, e continuar mantém a escolha", async () => {
      trocarParaBetaNoServidor();
      anaNaEmpresaAlfa();
      vi.mocked(listarDocumentos).mockResolvedValue(paginado([DOC]));
      window.history.replaceState(null, "", ROTA);
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      render(<AutenticacaoApp />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Registrar documento" }),
      );
      fireEvent.change(screen.getByLabelText(/^Tipo do documento/), {
        target: { value: TIPO.id },
      });

      await trocarPeloMenuPara("Empresa Beta");
      expect(
        await screen.findByText(
          /Há edição em andamento em: Ficha do colaborador\./,
        ),
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Continuar editando" }),
      );
      expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^Tipo do documento/)).toHaveValue(TIPO.id);
    });

    it("T203 — aba Solicitações com a leitura em curso: a troca volta à listagem da empresa nova e a resposta atrasada não aparece", async () => {
      trocarParaBetaNoServidor();
      anaNaEmpresaAlfa();
      let entregar!: (v: unknown) => void;
      vi.mocked(listarSolicitacoesPessoas).mockReturnValue(
        new Promise((ok) => {
          entregar = ok;
        }) as never,
      );
      const rotaSolicitacoes = `#/pessoas/colaboradores/${ANA_ID}/solicitacoes`;
      window.history.replaceState(null, "", rotaSolicitacoes);
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      render(<AutenticacaoApp />);
      await screen.findByRole("tab", { name: "Solicitações", selected: true });
      await waitFor(() =>
        expect(listarSolicitacoesPessoas).toHaveBeenCalledTimes(1),
      );

      await trocarPeloMenuPara("Empresa Beta");
      await waitFor(() =>
        expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
      );
      await waitFor(() =>
        expect(window.location.hash).toBe("#/pessoas/colaboradores"),
      );
      expect(document.querySelector(".ficha-colaborador")).toBeNull();
      // Só leitura: a troca não pergunta nada.
      expect(screen.queryByText(/Há edição em andamento/)).toBeNull();

      await act(async () => {
        entregar({
          itens: [
            {
              id: "s-1",
              empresaId: EMPRESA_ALFA.id,
              vinculoId: "33333333-3333-4333-8333-333333333333",
              tipo: "atestado",
              motivo: "atestado_apresentado",
              situacao: "enviada",
              periodoReferencia: "2026-10-05",
              registradoPorUserId: "u-1",
              enviadaEm: null,
              primeiraRevisaoEm: null,
              criadoEm: "2026-10-05T12:00:00.000Z",
              atualizadoEm: "2026-10-05T12:00:00.000Z",
            },
          ],
          pagina: 1,
          tamanhoPagina: 100,
          total: 1,
        });
      });
      const main = document.getElementById("conteudo-principal")!;
      expect(main.textContent).not.toMatch(/Atestado|Solicitações de /);
      expect(listarSolicitacoesPessoas).toHaveBeenCalledTimes(1);
    });

    it("T204 — 'Nova solicitação' com o tipo escolhido: a troca de empresa pergunta antes, e continuar mantém a escolha", async () => {
      trocarParaBetaNoServidor();
      anaNaEmpresaAlfa();
      vi.mocked(listarSolicitacoesPessoas).mockResolvedValue({
        itens: [],
        pagina: 1,
        tamanhoPagina: 100,
        total: 0,
      });
      const rotaSolicitacoes = `#/pessoas/colaboradores/${ANA_ID}/solicitacoes`;
      window.history.replaceState(null, "", rotaSolicitacoes);
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      render(<AutenticacaoApp />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Nova solicitação" }),
      );
      const janela = screen.getByRole("dialog", { name: "Nova solicitação" });
      fireEvent.change(within(janela).getByLabelText(/^Tipo/), {
        target: { value: "ferias" },
      });

      await trocarPeloMenuPara("Empresa Beta");
      expect(
        await screen.findByText(
          /Há edição em andamento em: Nova solicitação\./,
        ),
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Continuar editando" }),
      );
      expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
      expect(
        within(
          screen.getByRole("dialog", { name: "Nova solicitação" }),
        ).getByLabelText(/^Tipo/),
      ).toHaveValue("ferias");
    });

    it("T202 — aba Registros de ponto com a leitura em curso: a troca volta à listagem da empresa nova e a resposta atrasada não aparece", async () => {
      trocarParaBetaNoServidor();
      anaNaEmpresaAlfa();
      const momento = "2026-10-05T11:00:00.000Z";
      let entregar!: (v: unknown) => void;
      vi.mocked(listarPontosDoVinculo).mockReturnValue(
        new Promise((ok) => {
          entregar = ok;
        }) as never,
      );
      const rotaPonto = `#/pessoas/colaboradores/${ANA_ID}/ponto/2026-10`;
      window.history.replaceState(null, "", rotaPonto);
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      render(<AutenticacaoApp />);
      await screen.findByRole("tab", {
        name: "Registros de ponto",
        selected: true,
      });
      await waitFor(() =>
        expect(listarPontosDoVinculo).toHaveBeenCalledTimes(1),
      );

      await trocarPeloMenuPara("Empresa Beta");
      await waitFor(() =>
        expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
      );
      await waitFor(() =>
        expect(window.location.hash).toBe("#/pessoas/colaboradores"),
      );
      expect(document.querySelector(".ficha-colaborador")).toBeNull();
      // Sem edição pendente: a aba de ponto só lê, a troca não pergunta.
      expect(screen.queryByText(/Há edição em andamento/)).toBeNull();

      await act(async () => {
        entregar({
          itens: [
            {
              id: "e-1",
              vinculoId: "33333333-3333-4333-8333-333333333333",
              empresaId: EMPRESA_ALFA.id,
              tipo: "entrada",
              momento,
              competencia: "2026-10",
              registradoPorUserId: "u-1",
              registradoEm: momento,
              efetivo: {
                tipo: "entrada",
                momento,
                anulado: false,
                totalAjustes: 0,
              },
            },
          ],
          pagina: 1,
          tamanhoPagina: 100,
          total: 1,
        });
      });
      const main = document.getElementById("conteudo-principal")!;
      expect(main.textContent).not.toMatch(/05\/10\/2026|Registros de ponto/);
      expect(listarPontosDoVinculo).toHaveBeenCalledTimes(1);
    });
  });

  it("T199 — dashboard com aba, página e filtros na URL: a troca limpa tudo e volta a Ativos", async () => {
    trocarParaBetaNoServidor();
    window.history.replaceState(
      null,
      "",
      "#/pessoas/colaboradores?aba=desligados&pagina=2&tipo=pj",
    );
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: /^Desligados/, selected: true }),
      ).toBeInTheDocument(),
    );
    expect(window.location.hash).toBe(
      "#/pessoas/colaboradores?aba=desligados&pagina=2&tipo=pj",
    );

    await trocarPeloMenuPara("Empresa Beta");

    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe("#/pessoas/colaboradores"),
    );
    // Recriado no estado inicial: Ativos, sem tipo, página 1.
    expect(
      await screen.findByRole("tab", { name: /^Ativos/, selected: true }),
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Tipo de vínculo") as HTMLSelectElement).value,
    ).toBe("");
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("colaboradores-titulo"),
    );
  });

  it("edição pendente: cancelar a confirmação mantém a empresa e o que foi digitado", async () => {
    trocarParaBetaNoServidor();
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Rascunho" } });

    await trocarPeloMenuPara("Empresa Beta");
    expect(
      await screen.findByText(/Há edição em andamento em: Nova admissão\./),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));

    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
    expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa");
    expect(
      (screen.getByLabelText(/^Nome completo/) as HTMLInputElement).value,
    ).toBe("Pessoa Sintetica Rascunho");
  });

  it("T195 — edição pendente numa etapa adiantada: continuar editando mantém a etapa e os dados", async () => {
    trocarParaBetaNoServidor();
    const nome = await abrirNovaAdmissaoPorRota();
    const etapas = within(conteudoDoCadastro());
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Rascunho" } });
    fireEvent.change(etapas.getByLabelText(/^Data de nascimento/), {
      target: { value: "1990-05-20" },
    });
    // T209 — CPF obrigatório na etapa 1 (sintético, dígitos válidos).
    fireEvent.change(etapas.getByLabelText(/^CPF$/), {
      target: { value: "529.982.247-25" },
    });
    fireEvent.click(
      within(rodapeDoCadastro()).getByRole("button", { name: "Próxima etapa" }),
    );
    const titulo = await etapas.findByRole("heading", {
      level: 2,
      name: /Dados profissionais$/,
    });

    await trocarPeloMenuPara("Empresa Beta");
    fireEvent.click(
      await screen.findByRole("button", { name: "Continuar editando" }),
    );

    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
    expect(titulo).toBeVisible();
    expect(
      (etapas.getByLabelText(/^Nome completo/) as HTMLInputElement).value,
    ).toBe("Pessoa Sintetica Rascunho");
  });

  it("edição pendente: confirmar troca, descarta e vai para Colaboradores na empresa nova", async () => {
    trocarParaBetaNoServidor();
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Rascunho" } });

    await trocarPeloMenuPara("Empresa Beta");
    fireEvent.click(
      await screen.findByRole("button", { name: "Trocar e descartar" }),
    );

    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(EMPRESA_BETA.id);
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
    expect(document.body.textContent).not.toContain(
      "Pessoa Sintetica Rascunho",
    );
  });

  it("papel que não troca não recebe seletor nem pede a lista — no Hub e no menu", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR_PADRAO,
      role: "dp",
      podeTrocarEmpresa: false,
    } as never);

    render(<AutenticacaoApp />);
    await chegarAoHub();
    expect(screen.queryByRole("button", { name: /Empresa ativa/ })).toBeNull();
    await abrirProduto(/^Colaboradores/);
    expect(
      document.querySelector(".app-shell__sidebar .seletor-empresa__leitura"),
    ).toHaveTextContent("Empresa Alfa");
    expect(screen.queryByRole("button", { name: /Empresa ativa/ })).toBeNull();
    expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
  });

  it("a lista de empresas é lida uma vez por login, não a cada tela", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await screen.findByRole("button", { name: /Empresa ativa/ });
    await abrirProduto(/^Colaboradores Consulta/);
    await waitFor(() => expect(seletorDoMenu()).not.toBeNull());
    // T209 — sem Hub: outra tela pelo menu.
    await abrirProduto(/^Dashboard/);
    await screen.findByRole("button", { name: /Empresa ativa/ });
    expect(listarEmpresasDoContexto).toHaveBeenCalledTimes(1);
  });

  it("aviso de outra aba: reconfere o servidor e recria no mesmo módulo", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);
    const leiturasAntes = vi.mocked(obterUsuarioAtual).mock.calls.length;

    servidorPassaParaBeta();
    const outraAba = new CanalFalso(NOME_DO_CANAL);
    act(() => outraAba.postMessage({ tipo: "contexto-empresarial-alterado" }));

    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    expect(vi.mocked(obterUsuarioAtual).mock.calls.length).toBeGreaterThan(
      leiturasAntes,
    );
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
    expect(anuncio()).toHaveTextContent(
      "A empresa ativa desta sessão mudou. Empresa ativa: Empresa Beta (código BETA).",
    );
  });

  it("mensagem estranha no canal é ignorada (não reconfere)", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    const leituras = vi.mocked(obterUsuarioAtual).mock.calls.length;
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({ tipo: "outra-coisa" }),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(obterUsuarioAtual).mock.calls.length).toBe(leituras);
  });

  it("ao recuperar o foco, reconfere; mesma empresa não mexe em nada", async () => {
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Foco" } });
    const leituras = vi.mocked(obterUsuarioAtual).mock.calls.length;

    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() =>
      expect(vi.mocked(obterUsuarioAtual).mock.calls.length).toBe(leituras + 1),
    );
    expect(
      (screen.getByLabelText(/^Nome completo/) as HTMLInputElement).value,
    ).toBe("Pessoa Sintetica Foco");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("ao recuperar o foco com a empresa trocada por fora (sem edição), recria no contexto novo", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);

    servidorPassaParaBeta();
    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("T209 — outra CONTA confirmada pelo servidor na mesma aba: sem Hub, vai ao destino do papel novo", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores Consulta/);

    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...(ATOR_EM_BETA as object),
      id: "outra-conta-sintetica",
      role: "gestor",
    } as never);
    act(() => window.dispatchEvent(new Event("focus")));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Minha equipe" }),
    ).toBeInTheDocument();
    expect(hubNaTela()).toBeNull();
  });

  it("com edição pendente, a mudança por fora vira aviso bloqueante — continuar descarta, com aviso", async () => {
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Aba" } });

    servidorPassaParaBeta();
    act(() => window.dispatchEvent(new Event("focus")));

    const aviso = await screen.findByRole("alertdialog", {
      name: "A empresa ativa mudou",
    });
    expect(aviso).toHaveTextContent("Empresa Beta (código BETA)");
    // A árvore antiga fica visível, mas inerte; o aviso não nomeia a anterior.
    expect(document.querySelector(".autenticacao-app__arvore")).toHaveAttribute(
      "inert",
    );
    expect(aviso.textContent).not.toMatch(/Alfa|ALFA/);
    expect(
      (
        screen.getByLabelText(/^Nome completo/, {
          hidden: true,
        } as never) as HTMLInputElement
      ).value,
    ).toBe("Pessoa Sintetica Aba");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continuar na empresa nova e descartar alterações",
      }),
    );
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
    expect(document.body.textContent).not.toContain("Pessoa Sintetica Aba");
  });

  it("com edição pendente, “voltar à empresa anterior” troca de volta e mantém o que foi digitado", async () => {
    vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(EMPRESA_ALFA);
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Volta" } });
    const outraAba = new CanalFalso(NOME_DO_CANAL);
    const avisoNaOutraAba = vi.fn();
    outraAba.addEventListener("message", avisoNaOutraAba);

    servidorPassaParaBeta();
    act(() => outraAba.postMessage({ tipo: "contexto-empresarial-alterado" }));
    await screen.findByRole("alertdialog", { name: "A empresa ativa mudou" });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Voltar à empresa anterior e continuar editando",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(EMPRESA_ALFA.id);
    expect(
      (screen.getByLabelText(/^Nome completo/) as HTMLInputElement).value,
    ).toBe("Pessoa Sintetica Volta");
    expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa");
    expect(
      document.querySelector(".autenticacao-app__arvore"),
    ).not.toHaveAttribute("inert");
    // A outra aba fica sabendo da volta.
    expect(avisoNaOutraAba).toHaveBeenCalledTimes(1);
  });

  it("reconferência que encontra a sessão encerrada (401) volta ao login", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    vi.mocked(obterUsuarioAtual).mockRejectedValue(
      new ApiErrorDeUsuarios(401, "sessão expirada"),
    );
    act(() => window.dispatchEvent(new Event("focus")));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
  });

  it("logout limpa o contexto junto com a sessão", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(logout).mockResolvedValueOnce(undefined);

    render(<AutenticacaoApp />);
    await chegarAoHub();
    fireEvent.click(await botaoSair());

    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    // Nenhum resquício de empresa na tela de login, nem no anúncio.
    expect(document.body.textContent ?? "").not.toContain(EMPRESA_ALFA.nome);
    expect(document.body.textContent ?? "").not.toContain(EMPRESA_BETA.nome);
  });

  it("nada de storage do navegador em todo o ciclo com troca de empresa e aviso entre abas", async () => {
    const gravou = vi.spyOn(Storage.prototype, "setItem");
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    trocarParaBetaNoServidor();

    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);
    await trocarPeloMenuPara("Empresa Beta");
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({
        tipo: "contexto-empresarial-alterado",
      }),
    );
    act(() => window.dispatchEvent(new Event("focus")));

    expect(gravou).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T189 (B1/N1) — referência rápida digitada conta como edição pendente; e
// "continuar na empresa nova" relê o servidor antes de aplicar.
// ---------------------------------------------------------------------------

describe("T189 (B1/N1) — referência rápida pendente e conferência antes de continuar", () => {
  const EMPRESA_GAMA = {
    id: "empresa-sintetica-gama",
    codigo: "GAMA",
    nome: "Empresa Gama",
  };
  const ATOR_EM_GAMA = {
    ...ATOR_PADRAO,
    companyId: EMPRESA_GAMA.id,
    empresaAtiva: EMPRESA_GAMA,
  };

  function pagina<T>(itens: T[]) {
    return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
  }

  beforeEach(() => {
    CanalFalso.abertos.clear();
    vi.stubGlobal("BroadcastChannel", CanalFalso);
    window.history.replaceState(null, "", window.location.pathname);
    // A empresa ALFA carregada e nenhuma referência: o "+" fica disponível.
    vi.mocked(listarEmpresasMulti).mockResolvedValue(
      pagina([{ ...EMPRESA_ALFA, status: "ativo" }]) as never,
    );
    for (const leitura of [
      listarDepartamentos,
      listarUnidades,
      listarEquipes,
      listarCentrosCusto,
      listarAreas,
      listarCargos,
    ]) {
      vi.mocked(leitura).mockResolvedValue(pagina([]) as never);
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
  });

  /**
   * Nova admissão com o cadastro rápido de departamento aberto, pelo caminho
   * que a interface oferece (T195): a etapa 1 é preenchida, "Próxima etapa" leva
   * à etapa 2 e o "+" abre o modal. Nesse estado a Nova admissão também é
   * edição pendente — não há como abrir o "+" com ela vazia. Que o modal,
   * sozinho, conte como pendência só com código ou nome digitados (e vazio
   * não conte) é provado no teste do componente, com o registro isolado
   * (`ModalReferenciaRapida.test.tsx`, T189 B1).
   */
  async function abrirReferenciaRapida() {
    await abrirNovaAdmissaoPorRota();
    const etapas = within(conteudoDoCadastro());
    fireEvent.change(etapas.getByLabelText(/Nome completo/), {
      target: { value: "Pessoa Sintetica Referencia" },
    });
    fireEvent.change(etapas.getByLabelText(/^Data de nascimento/), {
      target: { value: "1990-05-20" },
    });
    // T209 — CPF obrigatório na etapa 1 (sintético, dígitos válidos).
    fireEvent.change(etapas.getByLabelText(/^CPF$/), {
      target: { value: "529.982.247-25" },
    });
    fireEvent.click(
      within(rodapeDoCadastro()).getByRole("button", { name: "Próxima etapa" }),
    );
    await etapas.findByRole("heading", {
      level: 2,
      name: /Dados profissionais$/,
    });
    const mais = await etapas.findByRole("button", {
      name: "Cadastrar novo departamento",
    });
    await waitFor(() => expect(mais).toBeEnabled());
    fireEvent.click(mais);
    await screen.findByRole("dialog", { name: "Cadastrar departamento" });
  }
  const campoDaReferencia = (rotulo: RegExp) =>
    within(
      document.querySelector(".evolli-modal__caixa") as HTMLElement,
    ).getByLabelText(rotulo) as HTMLInputElement;

  function trocaEmOutraAba(ator: unknown) {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator as never);
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({
        tipo: "contexto-empresarial-alterado",
      }),
    );
  }

  const aviso = () =>
    screen.findByRole("alertdialog", { name: "A empresa ativa mudou" });

  /**
   * T195 — a etapa ATIVA da Nova admissão: os quatro painéis ficam sempre
   * montados, e só o da etapa atual está sem `hidden`. Confere que exatamente
   * a Etapa 2 é a visível — nenhuma outra ao mesmo tempo — e que o indicador
   * das etapas a marca como atual (`aria-current="step"`).
   */
  function esperarEtapa2Ativa() {
    const visiveis = [
      ...document.querySelectorAll<HTMLElement>(
        "section.cadastro-etapas__etapa",
      ),
    ]
      .filter((painel) => !painel.hasAttribute("hidden"))
      .map((painel) => painel.querySelector("h2")?.textContent);
    expect(visiveis).toEqual(["Etapa 2 de 4: Dados profissionais"]);
    expect(
      document.querySelector('.cadastro-etapas__etapas [aria-current="step"]'),
    ).toHaveTextContent("Etapa 2: Dados profissionais, etapa atual");
  }

  it("B1: código digitado + troca em outra aba → aviso; voltar preserva empresa, modal e código", async () => {
    vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(EMPRESA_ALFA);
    await abrirReferenciaRapida();
    fireEvent.change(campoDaReferencia(/^Código/), {
      target: { value: "DEP_RASCUNHO" },
    });

    trocaEmOutraAba(ATOR_EM_BETA);
    const alerta = await aviso();
    // Nada recriado enquanto a pessoa não escolhe.
    expect(campoDaReferencia(/^Código/).value).toBe("DEP_RASCUNHO");
    expect(document.querySelector(".autenticacao-app__arvore")).toHaveAttribute(
      "inert",
    );

    fireEvent.click(
      within(alerta).getByRole("button", {
        name: "Voltar à empresa anterior e continuar editando",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(EMPRESA_ALFA.id);
    expect(
      screen.getByRole("dialog", { name: "Cadastrar departamento" }),
    ).toBeInTheDocument();
    expect(campoDaReferencia(/^Código/).value).toBe("DEP_RASCUNHO");
    expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa");
    // A admissão por trás do modal também ficou, na mesma etapa.
    expect(
      (
        within(conteudoDoCadastro()).getByLabelText(
          /Nome completo/,
        ) as HTMLInputElement
      ).value,
    ).toBe("Pessoa Sintetica Referencia");
    esperarEtapa2Ativa();
  });

  it("B1: nome digitado → descarte só depois de “continuar”, no contexto atual", async () => {
    await abrirReferenciaRapida();
    fireEvent.change(campoDaReferencia(/^Nome/), {
      target: { value: "Departamento Rascunho" },
    });

    trocaEmOutraAba(ATOR_EM_BETA);
    const alerta = await aviso();
    expect(campoDaReferencia(/^Nome/).value).toBe("Departamento Rascunho");

    fireEvent.click(
      within(alerta).getByRole("button", {
        name: "Continuar na empresa nova e descartar alterações",
      }),
    );
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Cadastrar departamento" }),
    ).toBeNull();
    expect(document.body.textContent).not.toContain("Departamento Rascunho");
    expect(document.body.textContent).not.toContain(
      "Pessoa Sintetica Referencia",
    );
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
  });

  it("B1: código e nome digitados também bloqueiam", async () => {
    await abrirReferenciaRapida();
    fireEvent.change(campoDaReferencia(/^Código/), {
      target: { value: "DEP_AMBOS" },
    });
    fireEvent.change(campoDaReferencia(/^Nome/), {
      target: { value: "Departamento Ambos" },
    });
    trocaEmOutraAba(ATOR_EM_BETA);
    await aviso();
    expect(campoDaReferencia(/^Nome/).value).toBe("Departamento Ambos");
  });

  // T195 — o "+" só existe na etapa 2, depois da etapa 1 preenchida: com o
  // modal aberto, a admissão já é pendência. O antigo "modal vazio, troca
  // aplicada direto" deixou de ser alcançável pela interface; a regra do
  // modal vazio segue provada no teste do componente.
  it("B1 (T195): modal aberto e vazio, admissão preenchida — avisa; voltar preserva etapa, modal e dados", async () => {
    vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(EMPRESA_ALFA);
    await abrirReferenciaRapida();
    trocaEmOutraAba(ATOR_EM_BETA);
    const alerta = await aviso();
    fireEvent.click(
      within(alerta).getByRole("button", {
        name: "Voltar à empresa anterior e continuar editando",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(
      screen.getByRole("dialog", { name: "Cadastrar departamento" }),
    ).toBeInTheDocument();
    expect(campoDaReferencia(/^Código/).value).toBe("");
    expect(
      (
        within(conteudoDoCadastro()).getByLabelText(
          /Nome completo/,
        ) as HTMLInputElement
      ).value,
    ).toBe("Pessoa Sintetica Referencia");
    expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa");
    esperarEtapa2Ativa();
  });

  it("N1: duas trocas seguidas em outra aba — “continuar” relê e aplica a mais recente", async () => {
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica N1" } });

    trocaEmOutraAba(ATOR_EM_BETA);
    await aviso();
    // Segunda troca, com o aviso aberto: o servidor agora está em GAMA.
    trocaEmOutraAba(ATOR_EM_GAMA);
    const leituras = vi.mocked(obterUsuarioAtual).mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continuar na empresa nova e descartar alterações",
      }),
    );
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Gama"),
    );
    expect(vi.mocked(obterUsuarioAtual).mock.calls.length).toBe(leituras + 1);
    expect(seletorDoMenu()).not.toHaveTextContent("Empresa Beta");
    expect(anuncio()).toHaveTextContent("Empresa Gama (código GAMA)");
  });

  it.each([
    ["falha de rede", () => new TypeError("Failed to fetch")],
    ["403", () => new ApiErrorDeUsuarios(403, "negado")],
    ["404", () => new ApiErrorDeUsuarios(404, "não encontrado")],
  ])(
    "N1: %s na conferência não libera a tela nem troca de contexto",
    async (_caso, erro) => {
      const nome = await abrirNovaAdmissaoPorRota();
      fireEvent.change(nome, { target: { value: "Pessoa Sintetica Incerta" } });
      trocaEmOutraAba(ATOR_EM_BETA);
      await aviso();

      vi.mocked(obterUsuarioAtual).mockRejectedValue(erro());
      fireEvent.click(
        screen.getByRole("button", {
          name: "Continuar na empresa nova e descartar alterações",
        }),
      );

      expect(
        await screen.findByText(
          /Não foi possível conferir a empresa ativa agora/,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(
        document.querySelector(".autenticacao-app__arvore"),
      ).toHaveAttribute("inert");
      expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa");
      expect(
        (
          screen.getByLabelText(/^Nome completo/, {
            hidden: true,
          } as never) as HTMLInputElement
        ).value,
      ).toBe("Pessoa Sintetica Incerta");
      expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
    },
  );

  it("N1: 401 na conferência — sessão encerrada, nada aplicado, só a saída", async () => {
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Sessao" } });
    trocaEmOutraAba(ATOR_EM_BETA);
    await aviso();

    vi.mocked(obterUsuarioAtual).mockRejectedValue(
      new ApiErrorDeUsuarios(401, "sessão expirada"),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Continuar na empresa nova e descartar alterações",
      }),
    );
    expect(await screen.findByText(/Sua sessão terminou/)).toBeInTheDocument();
    expect(await botaoSair()).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Continuar na empresa nova e descartar alterações",
      }),
    ).toBeNull();
    expect(document.querySelector(".autenticacao-app__arvore")).toHaveAttribute(
      "inert",
    );
    expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa");
  });

  it("N1: se a sessão voltou à empresa desta aba, “continuar” não descarta nada", async () => {
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Volta" } });
    trocaEmOutraAba(ATOR_EM_BETA);
    await aviso();
    // A outra aba voltou para ALFA antes do clique.
    vi.mocked(obterUsuarioAtual).mockResolvedValue({ ...ATOR_PADRAO } as never);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continuar na empresa nova e descartar alterações",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(
      (screen.getByLabelText(/^Nome completo/) as HTMLInputElement).value,
    ).toBe("Pessoa Sintetica Volta");
    expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa");
    expect(
      document.querySelector(".autenticacao-app__arvore"),
    ).not.toHaveAttribute("inert");
  });
});

// ---------------------------------------------------------------------------
// T200 — a guarda de saída no shell autenticado: Hub, Sair, sessão encerrada
// por fora, o aviso nativo do navegador e a troca de empresa, que continua com
// o diálogo próprio da T189.
// ---------------------------------------------------------------------------
describe("T200 — guarda de saída no shell autenticado", () => {
  beforeEach(() => {
    CanalFalso.abertos.clear();
    vi.stubGlobal("BroadcastChannel", CanalFalso);
    window.history.replaceState(null, "", window.location.pathname);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
  });

  const perguntaDeSaida = () =>
    screen.getByRole("alertdialog", { name: "Sair sem salvar?" });

  async function novaAdmissaoComNome() {
    const nome = await abrirNovaAdmissaoPorRota();
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Rascunho" } });
    return nome as HTMLInputElement;
  }

  it("menu: pergunta, lista a tela e a frase da T179; continuar mantém tudo; sair sem salvar vai à tela escolhida (T209: sem Hub)", async () => {
    const nome = await novaAdmissaoComNome();
    const hub = itemDoMenu(/^Dashboard/);
    hub.focus();
    fireEvent.click(hub);
    const pergunta = perguntaDeSaida();
    expect(pergunta).toHaveAccessibleDescription(
      "Há alterações não salvas em: Nova admissão Saindo agora, elas serão descartadas. Nada da Nova admissão foi salvo.",
    );
    expect(
      within(pergunta).getByRole("button", { name: "Continuar editando" }),
    ).toHaveFocus();
    fireEvent.click(
      within(pergunta).getByRole("button", { name: "Continuar editando" }),
    );
    expect(nome.value).toBe("Pessoa Sintetica Rascunho");
    expect(hub).toHaveFocus();
    expect(dashboardNaTela()).toBeNull();

    fireEvent.click(hub);
    fireEvent.click(
      within(perguntaDeSaida()).getByRole("button", {
        name: "Sair sem salvar",
      }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      }),
    ).toBeInTheDocument();
  });

  it("menu: depois de 'Sair sem salvar', o foco fica num elemento real — nunca no body (T209: sem Hub)", async () => {
    await novaAdmissaoComNome();
    const hub = itemDoMenu(/^Dashboard/);
    hub.focus();
    fireEvent.click(hub);
    fireEvent.click(
      within(perguntaDeSaida()).getByRole("button", {
        name: "Sair sem salvar",
      }),
    );
    await chegarAoHub();
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
  });

  it("Sair: continuar não encerra a sessão; sair sem salvar encerra, sem o aviso de perda (foi escolha)", async () => {
    await novaAdmissaoComNome();
    fireEvent.click(await botaoSair());
    fireEvent.click(
      within(perguntaDeSaida()).getByRole("button", {
        name: "Continuar editando",
      }),
    );
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(await botaoSair());
    fireEvent.click(
      within(perguntaDeSaida()).getByRole("button", {
        name: "Sair sem salvar",
      }),
    );
    await screen.findByLabelText(/^E-mail\b/i);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/alterações que não tinham sido salvas/),
    ).toBeNull();
  });

  it("sessão encerrada por fora com edição pendente: sai, nada é gravado, e o login avisa que se perdeu", async () => {
    await novaAdmissaoComNome();
    vi.mocked(obterUsuarioAtual).mockRejectedValue(
      new ApiErrorDeUsuarios(401, "Não autenticado."),
    );
    const outraAba = new CanalFalso(NOME_DO_CANAL);
    act(() => outraAba.postMessage({ tipo: "contexto-empresarial-alterado" }));

    const aviso = await screen.findByText(
      "Sua sessão foi encerrada. As alterações que não tinham sido salvas foram perdidas.",
    );
    expect(aviso).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/^E-mail\b/i)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("sessão encerrada por fora sem nada pendente: volta ao login sem o aviso de perda", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);
    vi.mocked(obterUsuarioAtual).mockRejectedValue(
      new ApiErrorDeUsuarios(401, "Não autenticado."),
    );
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({
        tipo: "contexto-empresarial-alterado",
      }),
    );
    await screen.findByLabelText(/^E-mail\b/i);
    expect(
      screen.queryByText(/alterações que não tinham sido salvas/),
    ).toBeNull();
  });

  it("troca de empresa continua no diálogo próprio da T189, não no da guarda", async () => {
    trocarParaBetaNoServidor();
    await novaAdmissaoComNome();
    await trocarPeloMenuPara("Empresa Beta");
    expect(
      await screen.findByText(/Há edição em andamento em: Nova admissão\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("alertdialog", { name: "Sair sem salvar?" }),
    ).toBeNull();
  });

  it("recarregar ou fechar a aba: o aviso nativo só enquanto houver o que perder", async () => {
    const disparar = () => {
      const evento = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(evento);
      return evento.defaultPrevented;
    };
    const nome = await abrirNovaAdmissaoPorRota();
    expect(disparar()).toBe(false);
    fireEvent.change(nome, { target: { value: "Pessoa Sintetica Rascunho" } });
    expect(disparar()).toBe(true);
    fireEvent.click(itemDoMenu(/^Dashboard/));
    fireEvent.click(
      within(perguntaDeSaida()).getByRole("button", {
        name: "Sair sem salvar",
      }),
    );
    await chegarAoHub();
    expect(disparar()).toBe(false);
  });
});

describe("T206 — preferência do menu lateral: só nesta aba, por conta e empresa", () => {
  const emTrilho = () =>
    document.querySelector(".app-shell--menu-recolhido") !== null;

  beforeEach(() => {
    CanalFalso.abertos.clear();
    vi.stubGlobal("BroadcastChannel", CanalFalso);
    window.history.replaceState(null, "", window.location.pathname);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("sobrevive à navegação pelo menu (mesma conta, mesma empresa)", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores Consulta/);
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(emTrilho()).toBe(true);

    // T209 — sem Hub: outra tela pelo trilho (item único, que navega).
    await abrirProduto(/^Dashboard/);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_DASHBOARD });

    expect(emTrilho()).toBe(true);
    expect(
      screen.getByRole("button", { name: "Expandir menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("outra empresa abre expandida — e a preferência antiga não volta com a empresa antiga", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(emTrilho()).toBe(true);

    servidorPassaParaBeta();
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({
        tipo: "contexto-empresarial-alterado",
      }),
    );
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    expect(emTrilho()).toBe(false);

    vi.mocked(obterUsuarioAtual).mockResolvedValue(ATOR_PADRAO as never);
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({
        tipo: "contexto-empresarial-alterado",
      }),
    );
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa"),
    );
    expect(emTrilho()).toBe(false);
  });

  it("logout apaga a preferência: o próximo login começa expandido", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(logout).mockResolvedValueOnce(undefined);
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await abrirProduto(/^Colaboradores/);
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(emTrilho()).toBe(true);

    fireEvent.click(await botaoSair());
    await screen.findByLabelText(/^E-mail\b/i);
    preencherEEntrar();
    await screen.findByRole("navigation", { name: "Navegação do painel" });

    expect(emTrilho()).toBe(false);
    expect(
      screen.getByRole("button", { name: "Recolher menu" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

describe("T206/T209 — foco na aterrissagem (sem Hub)", () => {
  beforeEach(() => {
    CanalFalso.abertos.clear();
    vi.stubGlobal("BroadcastChannel", CanalFalso);
    window.history.replaceState(null, "", window.location.pathname);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
  });

  /** O foco está num elemento real, visível e alcançável — nunca no body. */
  function esperarFocoValido(alvo: HTMLElement) {
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(alvo);
    expect(alvo.closest("[inert]")).toBeNull();
    expect(alvo.closest("[hidden]")).toBeNull();
    expect(alvo.closest('[aria-hidden="true"]')).toBeNull();
  }

  it("aterrissagem depois do login: o título do Dashboard recebe o foco uma vez só", async () => {
    const focar = vi.spyOn(HTMLElement.prototype, "focus");
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Dashboard",
    });
    await waitFor(() => esperarFocoValido(titulo));
    expect(focar.mock.contexts.filter((c) => c === titulo)).toHaveLength(1);
    focar.mockRestore();
  });

  it("gestor: a aterrissagem em Minha equipe leva o foco ao título", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    render(<AutenticacaoApp />);
    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Minha equipe",
    });
    await waitFor(() => esperarFocoValido(titulo));
  });
});
describe("T207 — vista do Quadro de colaboradores: só nesta aba, por conta e empresa", () => {
  const CONTADORES_VAZIOS = {
    ativos: 0,
    inativos: 0,
    emAdmissao: 0,
    desligados: 0,
    total: 0,
    ativosPorTipo: {
      clt: 0,
      estagio: 0,
      aprendiz: 0,
      pj: 0,
      temporario: 0,
      outro_controlado: 0,
      part_time: 0,
      freelancer: 0,
      trainee: 0,
    },
  };
  const emTabela = () =>
    document.querySelector(".dashboard__bloco--quadro table") !== null;
  const acoesDoQuadro = () =>
    screen.findByRole("button", { name: "Ações: Quadro de colaboradores" });

  beforeEach(() => {
    CanalFalso.abertos.clear();
    vi.stubGlobal("BroadcastChannel", CanalFalso);
    window.history.replaceState(null, "", window.location.pathname);
    vi.mocked(listarColaboradores).mockResolvedValue({
      itens: [],
      pagina: 1,
      tamanhoPagina: 1,
      total: 0,
      contadores: CONTADORES_VAZIOS,
    } as never);
    vi.mocked(listarMovimentacoes).mockResolvedValue({
      itens: [],
      pagina: 1,
      tamanhoPagina: 100,
      total: 0,
    } as never);
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
    const reais = {
      ...(await vi.importActual<typeof import("../api/colaboradoresClient")>(
        "../api/colaboradoresClient",
      )),
      ...(await vi.importActual<typeof import("../api/movimentacaoClient")>(
        "../api/movimentacaoClient",
      )),
    };
    vi.mocked(listarColaboradores).mockImplementation(
      reais.listarColaboradores,
    );
    vi.mocked(listarMovimentacoes).mockImplementation(
      reais.listarMovimentacoes,
    );
  });

  async function verComoTabela() {
    fireEvent.click(await acoesDoQuadro());
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver como tabela" }));
    expect(emTabela()).toBe(true);
  }

  it("sobrevive à navegação pelo menu; outra conta, depois do logout, começa no gráfico", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(logout).mockResolvedValueOnce(undefined);
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    await verComoTabela();

    // T209 — sem Hub: sai pelo menu e volta.
    await abrirProduto(/^Colaboradores Consulta/);
    await abrirProduto(/^Dashboard/);
    await acoesDoQuadro();
    expect(emTabela()).toBe(true);

    fireEvent.click(await botaoSair());
    await screen.findByLabelText(/^E-mail\b/i);
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("dp"));
    preencherEEntrar();
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    await acoesDoQuadro();
    expect(emTabela()).toBe(false);
  });

  it("a mesma conta sai e entra de novo: a vista escolhida é apagada pelo logout", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(logout).mockResolvedValueOnce(undefined);
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    await verComoTabela();

    fireEvent.click(await botaoSair());
    await screen.findByLabelText(/^E-mail\b/i);
    // A MESMA conta e a mesma empresa: só o logout pode apagar a vista.
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ATOR_PADRAO as never);
    preencherEEntrar();
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    await acoesDoQuadro();
    expect(emTabela()).toBe(false);
  });

  it("outra empresa abre no gráfico — e a vista antiga não volta com a empresa antiga", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    await verComoTabela();

    servidorPassaParaBeta();
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({
        tipo: "contexto-empresarial-alterado",
      }),
    );
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Beta"),
    );
    await acoesDoQuadro();
    expect(emTabela()).toBe(false);

    vi.mocked(obterUsuarioAtual).mockResolvedValue(ATOR_PADRAO as never);
    act(() =>
      new CanalFalso(NOME_DO_CANAL).postMessage({
        tipo: "contexto-empresarial-alterado",
      }),
    );
    await waitFor(() =>
      expect(seletorDoMenu()).toHaveTextContent("Empresa Alfa"),
    );
    await acoesDoQuadro();
    expect(emTabela()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T209 — tela de abertura institucional: só ao recarregar a página (sessão
// verificada) e depois de um login aceito, até o acesso estar pronto. Nunca
// na troca de empresa nem na navegação interna; nunca atrasa login recusado,
// sessão expirada ou falha ao carregar o acesso.
// ---------------------------------------------------------------------------
describe("T209 — tela de abertura institucional", () => {
  const abertura = () => document.querySelector<HTMLElement>(".tela-abertura");

  beforeEach(() => {
    CanalFalso.abertos.clear();
    vi.stubGlobal("BroadcastChannel", CanalFalso);
    window.history.replaceState(null, "", window.location.pathname);
  });
  afterEach(() => {
    definirDuracaoMinimaDaAbertura(0);
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("recarregar com sessão válida: abertura com a marca e 'Verificando sessão…', depois a aterrissagem", async () => {
    const sessao = deferido<string>();
    vi.mocked(refreshCsrfToken).mockReturnValueOnce(sessao.promise);
    render(<AutenticacaoApp />);

    expect(abertura()).not.toBeNull();
    expect(within(abertura()!).getByRole("status")).toHaveTextContent(
      "Verificando sessão…",
    );
    // A marca é decorativa: o leitor de tela ouve só a mensagem.
    expect(abertura()!.querySelector(".tela-abertura__marca")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      abertura()!.querySelector("img.marca-evolli")?.getAttribute("src"),
    ).toMatch(/evolli-vertical\.svg$/);
    // Nada focável na abertura.
    expect(
      abertura()!.querySelectorAll("button, a, input, [tabindex]"),
    ).toHaveLength(0);

    await commitar(() => sessao.resolve("token"));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      }),
    ).toBeInTheDocument();
    expect(abertura()).toBeNull();
  });

  it("login aceito: abertura com 'Carregando seu acesso…' até o ator chegar; o foco vai ao título da aterrissagem", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    const eu = deferido<never>();
    vi.mocked(obterUsuarioAtual).mockReturnValueOnce(eu.promise);
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    expect(abertura()).toBeNull();

    preencherEEntrar();
    await waitFor(() => expect(abertura()).not.toBeNull());
    expect(within(abertura()!).getByRole("status")).toHaveTextContent(
      "Carregando seu acesso…",
    );
    // Nenhuma tela funcional montada por baixo.
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).toBeNull();

    await commitar(() => eu.resolve(ATOR_PADRAO as never));
    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: TITULO_DO_DASHBOARD,
    });
    expect(abertura()).toBeNull();
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("duração mínima curta: o acesso pronto em seguida não faz a abertura piscar, e ela sai sozinha", async () => {
    definirDuracaoMinimaDaAbertura(300);
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await commitar(() => undefined);
    // O acesso já chegou (sem rede), mas a abertura cumpre a duração mínima.
    expect(abertura()).not.toBeNull();
    expect(
      screen.queryByRole("heading", { level: 1, name: TITULO_DO_DASHBOARD }),
    ).toBeNull();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      }),
    ).toBeInTheDocument();
    expect(abertura()).toBeNull();
  });

  it("com a duração mínima segurando a abertura, o pedido de foco espera: o título da aterrissagem recebe o foco", async () => {
    definirDuracaoMinimaDaAbertura(300);
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    // O gestor aterrissa em "Minha equipe", que depende do pedido de foco (o
    // Dashboard foca o próprio título sozinho).
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    preencherEEntrar();
    await waitFor(() => expect(abertura()).not.toBeNull());
    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Minha equipe",
    });
    expect(abertura()).toBeNull();
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("sessão expirada ao recarregar: o login aparece na hora, sem esperar a duração mínima", async () => {
    definirDuracaoMinimaDaAbertura(60_000);
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    render(<AutenticacaoApp />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(abertura()).toBeNull();
  });

  it("login recusado: o erro aparece na hora e a abertura nunca entra", async () => {
    definirDuracaoMinimaDaAbertura(60_000);
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockRejectedValueOnce(new Error("rede"));
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    preencherEEntrar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível entrar.",
    );
    expect(abertura()).toBeNull();
    expect(obterUsuarioAtual).not.toHaveBeenCalled();
  });

  it("falha ao carregar o acesso: a tela de falha aparece na hora, sem esperar a duração mínima", async () => {
    definirDuracaoMinimaDaAbertura(60_000);
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockRejectedValueOnce(new Error("rede"));
    render(<AutenticacaoApp />);
    expect(
      await screen.findByText("Não foi possível carregar seu acesso."),
    ).toBeInTheDocument();
    expect(abertura()).toBeNull();
  });

  it("papel sem empresa ativa (acesso global): a abertura sai e a aterrissagem do papel aparece", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(
      ator("master_tecnico", {
        companyId: null,
        empresaAtiva: null,
        podeTrocarEmpresa: false,
      }),
    );
    render(<AutenticacaoApp />);
    expect(abertura()).not.toBeNull();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      }),
    ).toBeInTheDocument();
    expect(abertura()).toBeNull();
  });

  it("movimento reduzido: a abertura sabe e o CSS tira a animação", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((consulta: string) => {
      const base = original(consulta);
      if (!consulta.includes("prefers-reduced-motion")) return base;
      return {
        matches: true,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      } as unknown as MediaQueryList;
    }) as typeof window.matchMedia;
    try {
      const sessao = deferido<string>();
      vi.mocked(refreshCsrfToken).mockReturnValueOnce(sessao.promise);
      render(<AutenticacaoApp />);
      expect(abertura()).toHaveAttribute("data-movimento", "reduzido");
      await commitar(() => sessao.resolve("token"));
      await screen.findByRole("heading", {
        level: 1,
        name: TITULO_DO_DASHBOARD,
      });
    } finally {
      window.matchMedia = original;
    }
  });

  it("navegação interna não mostra a abertura", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_DASHBOARD });
    fireEvent.click(
      screen.getByRole("button", { name: /^Colaboradores Consulta/ }),
    );
    expect(abertura()).toBeNull();
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    expect(abertura()).toBeNull();
    await abrirProduto(/^Dashboard/);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_DASHBOARD });
    expect(abertura()).toBeNull();
  });

  it("troca de empresa não mostra a abertura: só o aviso simples enquanto o acesso é relido", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    render(<AutenticacaoApp />);
    await chegarAoHub();
    // Mesmo com a duração mínima ligada, a troca não passa pela abertura.
    definirDuracaoMinimaDaAbertura(60_000);

    const eu = deferido<never>();
    vi.mocked(obterUsuarioAtual).mockReturnValueOnce(eu.promise);
    fireEvent.click(
      await screen.findByRole("button", { name: /Empresa ativa/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /^Empresa Beta/ }),
    );
    await waitFor(() =>
      expect(
        document.querySelector(".autenticacao-app__verificando"),
      ).toHaveTextContent("Carregando seu acesso…"),
    );
    expect(abertura()).toBeNull();
    await commitar(() =>
      eu.resolve({
        ...ATOR_PADRAO,
        companyId: EMPRESA_BETA.id,
        empresaAtiva: EMPRESA_BETA,
      } as never),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Empresa ativa/ }),
      ).toHaveTextContent("Empresa Beta"),
    );
    expect(abertura()).toBeNull();
  });
});

describe("T209 — Hub desativado como destino de uso normal", () => {
  const TITULO_TEMPORARIO = "Acesso em configuração";
  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  function telaTemporaria() {
    return screen.queryByRole("heading", { level: 1, name: TITULO_TEMPORARIO });
  }

  it.each(["rh", "dp", "master_tecnico"])(
    "%s aterrissa no Dashboard, sem Hub em lugar nenhum",
    async (papel) => {
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator(papel));
      render(<AutenticacaoApp />);
      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: TITULO_DO_DASHBOARD,
        }),
      ).toBeInTheDocument();
      expect(hubNaTela()).toBeNull();
      expect(screen.queryByRole("button", { name: "Hub" })).toBeNull();
      expect(document.body).not.toHaveTextContent(/\bHub\b(?! de Benefícios)/);
    },
  );

  it("master técnico sem empresa ativa: Dashboard com a orientação de escolher empresa", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(
      ator("master_tecnico", {
        companyId: null,
        empresaAtiva: null,
        podeTrocarEmpresa: true,
      }),
    );
    render(<AutenticacaoApp />);
    expect(
      await screen.findByText(
        "Escolha uma empresa ativa no menu para ver o Dashboard.",
      ),
    ).toBeInTheDocument();
    expect(hubNaTela()).toBeNull();
  });

  it("gestor aterrissa em Minha equipe", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor"));
    render(<AutenticacaoApp />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Minha equipe" }),
    ).toBeInTheDocument();
    expect(hubNaTela()).toBeNull();
  });

  it.each(["colaborador", "financeiro", "auditor", "dpo", "admin_tecnico"])(
    "%s vê só a tela neutra de acesso temporário: sem Hub, módulos, cartões nem atalhos",
    async (papel) => {
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator(papel));
      render(<AutenticacaoApp />);
      const titulo = await screen.findByRole("heading", {
        level: 1,
        name: TITULO_TEMPORARIO,
      });
      await waitFor(() => expect(titulo).toHaveFocus());
      expect(
        screen.getByText(
          "Seu acesso está sendo configurado. Novos recursos serão liberados conforme o seu papel.",
        ),
      ).toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(/Hub/);
      expect(screen.queryByRole("navigation")).toBeNull();
      // O único controle é Sair.
      expect(
        screen.getAllByRole("button").map((b) => b.textContent?.trim()),
      ).toEqual(["Sair"]);
      expect(screen.queryByRole("link")).toBeNull();
    },
  );

  it("a tela temporária não faz nenhuma requisição funcional", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("colaborador"));
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_TEMPORARIO });
    expect(vi.mocked(obterUsuarioAtual)).toHaveBeenCalledTimes(1);
  });

  it("'Sair' na tela temporária encerra a sessão e volta ao login", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("colaborador"));
    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_TEMPORARIO });
    fireEvent.click(await botaoSair());
    expect(
      await screen.findByRole("button", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(telaTemporaria()).toBeNull();
  });

  it.each([
    ["rh", TITULO_DO_DASHBOARD],
    ["gestor", "Minha equipe"],
    ["colaborador", "Acesso em configuração"],
  ] as const)(
    "%s com a URL antiga do Hub (#/hub) cai no mesmo destino do papel",
    async (papel, titulo) => {
      window.history.replaceState(null, "", "/#/hub");
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator(papel));
      render(<AutenticacaoApp />);
      expect(
        await screen.findByRole("heading", { level: 1, name: titulo }),
      ).toBeInTheDocument();
      expect(hubNaTela()).toBeNull();
    },
  );

  it("colaborador com rota permitida (Meu perfil) continua abrindo a tela, sem ampliar nada", async () => {
    window.history.replaceState(null, "", "/#/configuracoes/meu-perfil");
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("colaborador"));
    render(<AutenticacaoApp />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Configurações" }),
    ).toBeInTheDocument();
    expect(hubNaTela()).toBeNull();
  });
});

describe("T210 — o tema da conta vai para o <html> (data-theme)", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("começa no padrão e, com a identidade, aplica o tema da conta", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR_PADRAO,
      temaAparencia: "verde_petroleo",
    } as never);
    render(<AutenticacaoApp />);
    // Antes da identidade da sessão: o padrão.
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    await chegarAoHub();
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "verde_petroleo",
      ),
    );
  });

  it("sem tema, ou com valor desconhecido, fica no padrão (sem atributo)", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR_PADRAO,
      temaAparencia: "roxo",
    } as never);
    render(<AutenticacaoApp />);
    await chegarAoHub();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("ao sair, volta ao padrão", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR_PADRAO,
      temaAparencia: "alto_contraste",
    } as never);
    vi.mocked(logout).mockResolvedValue(undefined as never);
    render(<AutenticacaoApp />);
    await chegarAoHub();
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "alto_contraste",
      ),
    );
    fireEvent.click(await botaoSair());
    await waitFor(() =>
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false),
    );
  });
});
