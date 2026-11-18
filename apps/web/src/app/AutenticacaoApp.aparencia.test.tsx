/**
 * T210 — Configurações › Aparência pelo caminho real da sessão: todo papel
 * abre a rota; o tema da conta já vem aplicado e marcado; escolher grava e a
 * nova sessão (outro `GET /v1/users/me`) reabre com o tema salvo; a falha
 * deixa a sessão com o tema anterior.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutenticacaoApp } from "./AutenticacaoApp";
import { refreshCsrfToken } from "../api/csrfClient";
import {
  atualizarAparenciaPropria,
  obterUsuarioAtual,
} from "../api/usersClient";
import { listarEmpresasDoContexto } from "../api/contextoEmpresarialClient";

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
  return {
    ...actual,
    obterUsuarioAtual: vi.fn(),
    atualizarAparenciaPropria: vi.fn(),
  };
});
vi.mock("../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/contextoEmpresarialClient")
  >("../api/contextoEmpresarialClient");
  return { ...actual, listarEmpresasDoContexto: vi.fn() };
});

const ALFA = { id: "empresa-sintetica", codigo: "ALFA", nome: "Empresa Alfa" };
const ATOR = {
  id: "ator-sintetico",
  email: "pessoa.teste@example.test",
  role: "rh",
  companyId: ALFA.id,
  unitId: null,
  teamId: null,
  status: "active",
  createdAt: "2026-01-10T15:00:00.000Z",
  mfaAvailable: false,
  podeTrocarEmpresa: false,
  empresaAtiva: ALFA,
  temaAparencia: null as string | null,
};
const ROTA = "#/configuracoes/aparencia";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(refreshCsrfToken).mockResolvedValue("token-sintetico");
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ATOR as never);
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-theme");
});

function montar() {
  window.history.replaceState(null, "", `/${ROTA}`);
  return render(<AutenticacaoApp />);
}

const radio = (nome: RegExp) => screen.getByRole("radio", { name: nome });

describe("T210 — Aparência a partir da sessão", () => {
  it.each([
    "rh",
    "dp",
    "master_tecnico",
    "gestor",
    "colaborador",
    "financeiro",
    "auditor",
    "dpo",
    "admin_tecnico",
  ])("%s abre a rota de Aparência (recarga com a rota)", async (role) => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      role,
      ...(role === "master_tecnico"
        ? { companyId: null, empresaAtiva: null }
        : {}),
    } as never);
    montar();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Configurações" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Aparência" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA);
  });

  it("o tema da conta vem aplicado e marcado", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      temaAparencia: "alto_contraste",
    } as never);
    montar();
    await waitFor(() => expect(radio(/^Alto Contraste/)).toBeChecked());
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "alto_contraste",
    );
  });

  it("escolher grava; a nova sessão (novo /users/me) volta com o tema salvo", async () => {
    vi.mocked(atualizarAparenciaPropria).mockResolvedValue({
      ...ATOR,
      temaAparencia: "verde_petroleo",
    } as never);
    const primeira = montar();
    await waitFor(() => expect(radio(/^Azul Institucional/)).toBeChecked());
    fireEvent.click(radio(/^Verde Petróleo/));
    expect(
      await screen.findByText(
        "Tema Verde Petróleo aplicado e salvo na sua conta.",
      ),
    ).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "verde_petroleo",
    );
    primeira.unmount();
    document.documentElement.removeAttribute("data-theme");

    // Nova sessão: o servidor devolve o que foi gravado.
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      temaAparencia: "verde_petroleo",
    } as never);
    montar();
    await waitFor(() => expect(radio(/^Verde Petróleo/)).toBeChecked());
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "verde_petroleo",
    );
  });

  it("falha ao gravar: a sessão segue no tema anterior", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      temaAparencia: "evolli_claro",
    } as never);
    vi.mocked(atualizarAparenciaPropria).mockRejectedValue(new Error("rede"));
    montar();
    await waitFor(() => expect(radio(/^Evolli Claro/)).toBeChecked());
    fireEvent.click(radio(/^Alto Contraste/));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar o tema.",
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "evolli_claro",
    );
  });
});
