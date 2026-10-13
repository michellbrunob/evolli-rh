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
});

async function entrar() {
  fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
    target: { value: EMAIL_SINTETICO },
  });
  fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
    target: { value: SENHA_SINTETICA },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByRole("navigation", { name: "Navegação do painel" });
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
    await screen.findByRole("navigation", { name: "Navegação do painel" });
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

  it("sessão válida ao recarregar: shell aparece direto, nunca mostra login", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");

    render(<AutenticacaoApp />);

    expect(
      await screen.findByRole("navigation", { name: "Navegação do painel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Entrar" }),
    ).not.toBeInTheDocument();
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

  it("logout real: chama o endpoint via authClient, limpa o estado e volta ao login", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token-restaurado");
    vi.mocked(logout).mockResolvedValueOnce(undefined);

    render(<AutenticacaoApp />);
    await screen.findByRole("navigation", { name: "Navegação do painel" });

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
    await screen.findByRole("navigation", { name: "Navegação do painel" });

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
    await screen.findByRole("navigation", { name: "Navegação do painel" });

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
    expect(await screen.findByRole("navigation")).toBeInTheDocument();
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
    await screen.findByRole("navigation");
    // Agora sim: a primeira (e única) chamada funcional é a permitida.
    expect(vi.mocked(listarTabelasHorario)).not.toHaveBeenCalled();
    expect(vi.mocked(listarEquipe)).toHaveBeenCalled();
  });

  it("B1.3 gestor entra DIRETO na consulta da equipe", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("gestor"));

    render(<AutenticacaoApp />);

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
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

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

  it("B1.8 rh aterrissa em 'Pessoas Colaboradores' (T159)", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator("rh"));

    render(<AutenticacaoApp />);
    await screen.findByRole("navigation");

    expect(destinosAtivos()).toEqual(["Pessoas Colaboradores"]);
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
    ["dp", "Pessoas Colaboradores"],
    ["master_tecnico", "Pessoas Colaboradores"],
    ["colaborador", "Visão geral"],
    ["financeiro", "Visão geral"],
  ])(
    "B1.9 papel %s aterrissa em %s e não ganha a capacidade",
    async (papel, destino) => {
      vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
      vi.mocked(obterUsuarioAtual).mockResolvedValueOnce(ator(papel));

      render(<AutenticacaoApp />);
      await screen.findByRole("navigation");

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

    await screen.findByRole("navigation");
    // Recalculado para o ator NOVO, não herdado do gestor anterior.
    expect(destinosAtivos()).toEqual(["Pessoas Colaboradores"]);
  });

  it("B1.13 quem já navegou não é redirecionado de novo", async () => {
    vi.mocked(refreshCsrfToken).mockResolvedValueOnce("token");
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor"));

    render(<AutenticacaoApp />);
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
