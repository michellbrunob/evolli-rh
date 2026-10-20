import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutenticacaoApp } from "./AutenticacaoApp";
import { login, logout } from "../api/authClient";
import { refreshCsrfToken } from "../api/csrfClient";
import { ApiError, listarSessoesAtivas } from "../api/sessoesClient";
import { obterUsuarioAtual } from "../api/usersClient";
import { listarTabelasHorario } from "../api/horariosClient";
import { listarEquipe } from "../api/gestorClient";
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

/** Do login até o Hub — a primeira tela depois de o ator ser resolvido. */
async function entrarNoHub() {
  preencherEEntrar();
  await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
}

/** Abre um produto do Hub e espera o shell montar. */
async function abrirProduto(rotulo: RegExp | string) {
  fireEvent.click(screen.getByRole("button", { name: rotulo }));
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
    // Sessão válida leva ao Hub (T162), e nunca ao login.
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
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

  it("sessão válida ao recarregar: o Hub aparece direto, nunca mostra login (T162)", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");

    render(<AutenticacaoApp />);

    expect(
      await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).not.toBeInTheDocument();
    // E dali o shell continua a um clique de distância.
    await abrirProduto(/^Colaboradores/);
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
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

  it("T178: sem rota na URL, recarregar continua abrindo o Hub", async () => {
    window.history.replaceState(null, "", window.location.pathname);
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    render(<AutenticacaoApp />);
    expect(
      await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB }),
    ).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("T162: o login leva ao Hub, e o shell só monta quando um produto é aberto", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    await entrarNoHub();

    // Nada do shell existe ainda, e nenhuma tela funcional foi montada.
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
    expect(vi.mocked(listarEquipe)).not.toHaveBeenCalled();

    await abrirProduto(/^Colaboradores/);
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
  });

  it("T162: 'Hub' volta ao ponto de entrada e desmonta o shell", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/^Colaboradores/);

    fireEvent.click(screen.getByRole("button", { name: "Hub" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
  });

  it("logout real: chama o endpoint via authClient, limpa o estado e volta ao login", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    vi.mocked(logout).mockResolvedValueOnce(undefined);

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/^Colaboradores/);

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

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
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/^Colaboradores/);

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(logout).toHaveBeenCalled());

    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("T117: 'Sessões ativas' descobrindo que a própria sessão não é mais válida (401) volta ao login, como o logout", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    vi.mocked(listarSessoesAtivas).mockRejectedValueOnce(
      new ApiError(401, "Não autorizado."),
    );

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/^Colaboradores/);

    fireEvent.click(screen.getByRole("button", { name: "Sessões ativas" }));
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
    // Ator conhecido: o Hub monta. O shell ainda não — e isso é o ponto.
    expect(
      await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
    await abrirProduto(/^Colaboradores/);
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
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
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    // T162 — no Hub ainda não saiu NENHUMA chamada funcional, nem a permitida.
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
    expect(vi.mocked(listarEquipe)).not.toHaveBeenCalled();

    await abrirProduto(/Minha equipe/);
    // Agora sim: a primeira (e única) chamada funcional é a permitida.
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
    expect(vi.mocked(listarEquipe)).toHaveBeenCalled();
  });

  it("B1.3 gestor entra DIRETO na consulta da equipe — o único produto que o Hub lhe oferece", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/Minha equipe/);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Minha equipe" }),
    ).toBeInTheDocument();
    expect(destinosAtivos()).toEqual(["Minha equipe Consulta do gestor"]);
  });

  it("B1.4 gestor NÃO chama /v1/horarios no login", async () => {
    vi.mocked(refreshCsrfToken).mockRejectedValueOnce(new Error("401"));
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("button", { name: "Entrar" });
    await entrarNoHub();
    // Nem no Hub...
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();

    await abrirProduto(/Minha equipe/);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });
    // ...nem depois de abrir o produto.
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
  });

  it("B1.5 gestor NÃO chama /v1/horarios no refresh (sessão já válida)", async () => {
    // Refresh = montagem com cookie de sessão válido, sem passar pelo login.
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();

    await abrirProduto(/Minha equipe/);
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
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    // O Hub tampouco oferece horários ao gestor — a capacidade não existe.
    expect(screen.getByRole("main").textContent).not.toContain("Horários");

    await abrirProduto(/Minha equipe/);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    const main = screen.getByRole("main");
    expect(main.textContent).not.toContain("Somente RH");
    expect(main.textContent).not.toContain("tabelas de horário");
  });

  it("B1.7 a primeira chamada funcional do gestor é a consulta permitida", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/Minha equipe/);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    expect(vi.mocked(listarEquipe)).toHaveBeenCalled();
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
  });

  it("B1.8 rh aterrissa em 'Pessoas Colaboradores' (T159)", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("rh"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    // O Hub já oferece "Minha equipe" ao rh, porque o contrato lhe concede.
    expect(
      screen.getByRole("button", { name: /Minha equipe/ }),
    ).toBeInTheDocument();

    await abrirProduto(/^Colaboradores/);

    expect(destinosAtivos()).toEqual([
      "Colaboradores Consulta, ficha e vida funcional",
    ]);
    // E continua vendo "Minha equipe", porque o contrato lhe concede.
    expect(
      screen.getByRole("button", { name: /Minha equipe/ }),
    ).toBeInTheDocument();
  });

  /**
   * T159 — a aterrissagem deixou de ser "Cadastros para todos".
   *
   * `dp` e `master_tecnico` leem colaborador e vão para Pessoas. `colaborador`
   * e `financeiro` não têm destino funcional algum: vão para a Visão geral,
   * que é demonstrativa e **não faz requisição** — antes caíam em Cadastros e
   * tomavam 403 na primeira chamada, que era a primeira impressão do produto.
   */
  it.each([
    ["dp", "Colaboradores Consulta, ficha e vida funcional", /^Colaboradores/],
    [
      "master_tecnico",
      "Colaboradores Consulta, ficha e vida funcional",
      /^Colaboradores/,
    ],
    ["colaborador", "Visão geral", /Visão geral/],
    ["financeiro", "Visão geral", /Visão geral/],
  ])(
    "B1.9 papel %s aterrissa em %s e não ganha a capacidade",
    async (papel, destino, abrir) => {
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator(papel));

      render(<AutenticacaoApp />);
      await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
      // Nem no Hub o destino de liderança é oferecido a estes papéis.
      expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();

      await abrirProduto(abrir);

      expect(destinosAtivos()).toEqual([destino]);
      expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
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

    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/Minha equipe/);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });
    expect(screen.queryByRole("alert")).toBeNull();
    // Uma aplicação, não duas: um <main>, uma navegação.
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("B1.12 logout e login com outro papel recalculam o destino", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));
    vi.mocked(logout).mockResolvedValueOnce(undefined);
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/Minha equipe/);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await screen.findByRole("button", { name: "Entrar" });

    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("rh"));
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    // T162 — a sessão nova começa no Hub, nunca dentro do produto em que a
    // anterior estava. Era "Minha equipe", e o gestor saiu.
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/^Colaboradores/);

    // Recalculado para o ator NOVO, não herdado do gestor anterior.
    expect(destinosAtivos()).toEqual([
      "Colaboradores Consulta, ficha e vida funcional",
    ]);
  });

  it("B1.13 quem já navegou não é redirecionado de novo", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor"));

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/Minha equipe/);
    await screen.findByRole("heading", { level: 1, name: "Minha equipe" });

    fireEvent.click(screen.getByRole("button", { name: /^Relatórios/ }));
    await screen.findByRole("navigation");

    // Vários ciclos de render depois, continua onde a pessoa escolheu.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(destinosAtivos()).toEqual(["Relatórios"]);
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
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/Minha equipe/);
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
// T163 — a troca de empresa remonta a árvore inteira.
// ---------------------------------------------------------------------------

describe("T163 — contexto empresarial ativo", () => {
  /**
   * Faz o "servidor" passar a responder com a empresa Beta ativa a partir da
   * confirmação da troca — e não antes. É o que permite afirmar que a tela
   * mudou porque o servidor mudou, e não porque ela se adiantou.
   */
  function trocarParaBetaNoServidor() {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({ ...ATOR_PADRAO } as never);
    vi.mocked(trocarEmpresaDoContexto).mockImplementation(async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue({
        ...ATOR_PADRAO,
        companyId: EMPRESA_BETA.id,
        empresaAtiva: EMPRESA_BETA,
      } as never);
      return EMPRESA_BETA;
    });
  }

  it("o Hub mostra a empresa ATIVA que o servidor resolveu", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });

    const seletor = await screen.findByLabelText("Empresa");
    expect((seletor as HTMLSelectElement).value).toBe(EMPRESA_ALFA.id);
  });

  it("trocar de empresa reresolve o ator e remonta no contexto novo", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    // A segunda leitura do ator traz a empresa nova — é o servidor que diz
    // onde a sessão passou a operar, não a tela.
    // O servidor é quem muda: a troca altera o contexto, e QUALQUER leitura
    // seguinte do ator já vê a empresa nova. Encadear `mockResolvedValueOnce`
    // suporia um número exato de leituras — suposição frágil, e que esconde
    // uma releitura a mais em vez de tolerá-la.
    trocarParaBetaNoServidor();

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    const seletor = await screen.findByLabelText("Empresa");
    await waitFor(() =>
      expect((seletor as HTMLSelectElement).options.length).toBe(2),
    );

    fireEvent.change(seletor, { target: { value: EMPRESA_BETA.id } });

    await waitFor(() =>
      expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(EMPRESA_BETA.id),
    );
    // O ator foi lido de NOVO depois da troca — é daí que vem a empresa
    // nova, e não de estado local da tela.
    await waitFor(() =>
      expect(
        vi.mocked(obterUsuarioAtual).mock.calls.length,
      ).toBeGreaterThanOrEqual(2),
    );
    const depois = await screen.findByLabelText("Empresa");
    expect((depois as HTMLSelectElement).value).toBe(EMPRESA_BETA.id);
  });

  it("trocar de empresa DENTRO de um módulo devolve ao Hub", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    // O servidor é quem muda: a troca altera o contexto, e QUALQUER leitura
    // seguinte do ator já vê a empresa nova. Encadear `mockResolvedValueOnce`
    // suporia um número exato de leituras — suposição frágil, e que esconde
    // uma releitura a mais em vez de tolerá-la.
    trocarParaBetaNoServidor();

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    await abrirProduto(/^Colaboradores/);

    // De volta ao Hub só para trocar — e a troca não deixa ninguém dentro de
    // um módulo cujo universo de dados acabou de mudar sem aviso.
    fireEvent.click(screen.getByRole("button", { name: "Hub" }));
    const seletor = await screen.findByLabelText("Empresa");
    await waitFor(() =>
      expect((seletor as HTMLSelectElement).options.length).toBe(2),
    );
    fireEvent.change(seletor, { target: { value: EMPRESA_BETA.id } });
    await waitFor(() => expect(trocarEmpresaDoContexto).toHaveBeenCalled());

    expect(
      await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegação do painel" }),
    ).not.toBeInTheDocument();
  });

  it("papel que não troca não recebe seletor nem pede a lista", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce({
      ...ATOR_PADRAO,
      role: "gestor",
      podeTrocarEmpresa: false,
    } as never);

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
  });

  it("logout limpa o contexto junto com a sessão", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(logout).mockResolvedValueOnce(undefined);

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    // Nenhum resquício de empresa na tela de login.
    expect(document.body.textContent ?? "").not.toContain(EMPRESA_ALFA.nome);
    expect(document.body.textContent ?? "").not.toContain(EMPRESA_BETA.nome);
  });

  it("nada de storage do navegador em todo o ciclo com troca de empresa", async () => {
    const gravou = vi.spyOn(Storage.prototype, "setItem");
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    // O servidor é quem muda: a troca altera o contexto, e QUALQUER leitura
    // seguinte do ator já vê a empresa nova. Encadear `mockResolvedValueOnce`
    // suporia um número exato de leituras — suposição frágil, e que esconde
    // uma releitura a mais em vez de tolerá-la.
    trocarParaBetaNoServidor();

    render(<AutenticacaoApp />);
    await screen.findByRole("heading", { level: 1, name: TITULO_DO_HUB });
    const seletor = await screen.findByLabelText("Empresa");
    await waitFor(() =>
      expect((seletor as HTMLSelectElement).options.length).toBe(2),
    );
    fireEvent.change(seletor, { target: { value: EMPRESA_BETA.id } });
    await waitFor(() => expect(trocarEmpresaDoContexto).toHaveBeenCalled());

    expect(gravou).not.toHaveBeenCalled();
  });
});
