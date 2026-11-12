/**
 * T208 — Configurações › Meu perfil pelo caminho real da sessão: o ator lido
 * em `GET /v1/users/me` desce até a tela sem leitura nova; quem não tem shell
 * de trabalho chega pelo Hub; a recarga reabre a tela; `master_tecnico` sem
 * empresa vê "Nenhuma empresa ativa"; a troca de empresa remonta a tela com a
 * empresa nova.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutenticacaoApp } from "./AutenticacaoApp";
import { refreshCsrfToken } from "../api/csrfClient";
import { obterUsuarioAtual } from "../api/usersClient";
import {
  listarEmpresasDoContexto,
  trocarEmpresaDoContexto,
} from "../api/contextoEmpresarialClient";

vi.mock("../api/authClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/authClient")>(
      "../api/authClient",
    );
  return { ...actual, login: vi.fn(), logout: vi.fn() };
});
vi.mock("../api/csrfClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/csrfClient")>(
      "../api/csrfClient",
    );
  return { ...actual, refreshCsrfToken: vi.fn() };
});
vi.mock("../api/usersClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/usersClient")>(
      "../api/usersClient",
    );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});
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

const ALFA = { id: "empresa-sintetica", codigo: "ALFA", nome: "Empresa Alfa" };
const BETA = {
  id: "empresa-sintetica-beta",
  codigo: "BETA",
  nome: "Empresa Beta",
};
const ATOR = {
  id: "ator-sintetico-id-interno",
  email: "pessoa.teste@example.test",
  role: "rh",
  companyId: ALFA.id,
  unitId: null,
  teamId: null,
  status: "active",
  createdAt: "2026-01-10T15:00:00.000Z",
  mfaAvailable: false,
  podeTrocarEmpresa: true,
  empresaAtiva: ALFA,
};
const ROTA = "#/configuracoes/meu-perfil";

/** Toda requisição que não passa por um cliente mockado chega aqui. */
const rede = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", rede);
  vi.mocked(refreshCsrfToken).mockResolvedValue("token-sintetico");
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ATOR as never);
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA, BETA]);
  vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(BETA);
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function montar(rota: string | null) {
  window.history.replaceState(null, "", rota === null ? "/" : `/${rota}`);
  return render(<AutenticacaoApp />);
}

const painel = () => screen.getByRole("region", { name: "Meu perfil" });
const valor = (rotulo: string) =>
  within(painel())
    .getByText(rotulo, { selector: "dt" })
    .parentElement!.querySelector("dd")!.textContent;

describe("T208 — Meu perfil a partir da sessão", () => {
  it("quem chega pelo Hub abre Configurações pelo cartão; o título recebe o foco", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      role: "colaborador",
      podeTrocarEmpresa: false,
    } as never);
    montar(null);
    const cartao = await screen.findByRole("button", {
      name: /^Configurações/,
    });
    expect(cartao).toHaveClass("hub__cartao");
    fireEvent.click(cartao);
    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Configurações",
    });
    await waitFor(() => expect(document.activeElement).toBe(titulo));
    expect(window.location.hash).toBe(ROTA);
    expect(valor("E-mail de acesso")).toBe("pessoa.teste@example.test");
    expect(valor("Papel")).toBe("Colaborador");
    expect(valor("Empresa ativa")).toBe("Empresa Alfa (ALFA)");
    expect(valor("Conta criada em")).toBe("10/01/2026");
    // Nenhuma leitura nova: só a do ator, e nada pela rede.
    expect(obterUsuarioAtual).toHaveBeenCalledTimes(1);
    expect(rede).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(
      "ator-sintetico-id-interno",
    );
  });

  it("recarregar a rota abre Meu perfil direto, sem passar pelo Hub", async () => {
    montar(ROTA);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Configurações" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Seu acesso" })).toBeNull();
    expect(valor("Papel")).toBe("RH");
    expect(rede).not.toHaveBeenCalled();
  });

  it("master técnico sem empresa ativa: 'Nenhuma empresa ativa'", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      role: "master_tecnico",
      companyId: null,
      empresaAtiva: null,
    } as never);
    montar(ROTA);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    expect(valor("Papel")).toBe("Master técnico");
    expect(valor("Empresa ativa")).toBe("Nenhuma empresa ativa");
  });

  it("master técnico com empresa ativa: nome e código", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      role: "master_tecnico",
    } as never);
    montar(ROTA);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    expect(valor("Empresa ativa")).toBe("Empresa Alfa (ALFA)");
  });

  it("trocar de empresa no menu: a tela volta em Meu perfil com a empresa nova", async () => {
    montar(ROTA);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      companyId: BETA.id,
      empresaAtiva: BETA,
    } as never);
    const navegacao = document.getElementById("navegacao-lateral")!;
    fireEvent.click(
      within(navegacao).getByRole("button", { name: /Empresa ativa/ }),
    );
    await within(navegacao).findByRole("list", { name: "Empresas da conta" });
    fireEvent.click(
      within(navegacao).getByRole("button", { name: /^Empresa Beta/ }),
    );
    await waitFor(() =>
      expect(valor("Empresa ativa")).toBe("Empresa Beta (BETA)"),
    );
    expect(trocarEmpresaDoContexto).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe(ROTA);
    expect(
      screen.getByRole("heading", { level: 1, name: "Configurações" }),
    ).toBeInTheDocument();
  });
});
