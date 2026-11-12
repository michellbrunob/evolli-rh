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
import { atualizarPerfilProprio, obterUsuarioAtual } from "../api/usersClient";
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
  return {
    ...actual,
    obterUsuarioAtual: vi.fn(),
    atualizarPerfilProprio: vi.fn(),
  };
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

describe("T208 — o nome de exibição na sessão", () => {
  const campo = () => screen.getByRole("textbox", { name: "Nome de exibição" });
  const navegacao = () => document.getElementById("navegacao-lateral")!;
  const menu = (nome: RegExp) =>
    within(navegacao()).getByRole("button", { name: nome });

  it("salvar troca o ator da sessão sem remontar: sair e voltar mostra o nome salvo, sem ler /users/me de novo", async () => {
    vi.mocked(atualizarPerfilProprio).mockResolvedValue({
      ...ATOR,
      nomeExibicao: "Nome Salvo",
      perfilAtualizadoEm: "2026-11-12T15:00:00.000Z",
    } as never);
    montar(ROTA);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    fireEvent.change(campo(), { target: { value: "Nome Salvo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(within(painel()).getByRole("status")).toHaveTextContent(
        "Perfil salvo.",
      ),
    );
    expect(atualizarPerfilProprio).toHaveBeenCalledWith({
      nomeExibicao: "Nome Salvo",
      perfilAtualizadoEmLido: null,
    });

    fireEvent.click(menu(/^Jornada Visão/));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 1, name: "Configurações" }),
      ).toBeNull(),
    );
    fireEvent.click(menu(/^Configurações/));
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    expect(campo()).toHaveValue("Nome Salvo");
    expect(valor("Última alteração do perfil")).toBe("12/11/2026 às 12:00");
    expect(obterUsuarioAtual).toHaveBeenCalledTimes(1);
  });

  it("recarga: o nome vem de /users/me", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      nomeExibicao: "Nome Do Servidor",
      perfilAtualizadoEm: "2026-11-11T12:00:00.000Z",
    } as never);
    montar(ROTA);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    expect(campo()).toHaveValue("Nome Do Servidor");
  });

  it("trocar de empresa com o nome alterado pergunta antes; depois de salvo, o nome segue na empresa nova (é da conta)", async () => {
    vi.mocked(atualizarPerfilProprio).mockResolvedValue({
      ...ATOR,
      nomeExibicao: "Nome Global",
      perfilAtualizadoEm: "2026-11-12T15:00:00.000Z",
    } as never);
    montar(ROTA);
    await screen.findByRole("heading", { level: 1, name: "Configurações" });
    fireEvent.change(campo(), { target: { value: "Nome Global" } });

    fireEvent.click(
      within(navegacao()).getByRole("button", { name: /Empresa ativa/ }),
    );
    await within(navegacao()).findByRole("list", { name: "Empresas da conta" });
    fireEvent.click(
      within(navegacao()).getByRole("button", { name: /^Empresa Beta/ }),
    );
    // A confirmação é a do próprio seletor (T189): nomeia a edição.
    const aviso = await within(navegacao()).findByRole("alert");
    expect(aviso).toHaveTextContent("Há edição em andamento em: Meu perfil");
    fireEvent.click(
      within(navegacao()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
    expect(campo()).toHaveValue("Nome Global");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(within(painel()).getByRole("status")).toHaveTextContent(
        "Perfil salvo.",
      ),
    );

    vi.mocked(obterUsuarioAtual).mockResolvedValue({
      ...ATOR,
      companyId: BETA.id,
      empresaAtiva: BETA,
      nomeExibicao: "Nome Global",
      perfilAtualizadoEm: "2026-11-12T15:00:00.000Z",
    } as never);
    fireEvent.click(
      within(navegacao()).getByRole("button", { name: /Empresa ativa/ }),
    );
    await within(navegacao()).findByRole("list", { name: "Empresas da conta" });
    fireEvent.click(
      within(navegacao()).getByRole("button", { name: /^Empresa Beta/ }),
    );
    await waitFor(() =>
      expect(valor("Empresa ativa")).toBe("Empresa Beta (BETA)"),
    );
    expect(campo()).toHaveValue("Nome Global");
  });
});
