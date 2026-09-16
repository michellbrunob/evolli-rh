import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessoesAtivasPanel } from "./SessoesAtivasPanel";
import {
  ApiError,
  type SessaoApi,
  listarSessoesAtivas,
  revogarSessao,
} from "../api/sessoesClient";

vi.mock("../api/sessoesClient", async () => {
  const actual = await vi.importActual<typeof import("../api/sessoesClient")>(
    "../api/sessoesClient",
  );
  return {
    ...actual,
    listarSessoesAtivas: vi.fn(),
    revogarSessao: vi.fn(),
  };
});

const sessaoAtual: SessaoApi = {
  id: "11111111-1111-1111-1111-111111111111",
  createdAt: "2026-01-01T10:00:00.000Z",
  lastSeenAt: "2026-01-05T09:30:00.000Z",
  expiresAt: "2026-01-08T10:00:00.000Z",
  ip: "203.0.113.10",
  userAgent: "Mozilla/5.0 (teste, aba atual)",
};

const sessaoOutroDispositivo: SessaoApi = {
  id: "22222222-2222-2222-2222-222222222222",
  createdAt: "2025-12-20T08:00:00.000Z",
  lastSeenAt: "2026-01-04T18:00:00.000Z",
  expiresAt: "2026-01-08T10:00:00.000Z",
  ip: "203.0.113.20",
  userAgent: "Mozilla/5.0 (teste, outro dispositivo)",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SessoesAtivasPanel (T117)", () => {
  it("não renderiza nada quando `aberto` é false", () => {
    render(
      <SessoesAtivasPanel
        aberto={false}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();
    expect(listarSessoesAtivas).not.toHaveBeenCalled();
  });

  it("carrega e lista as sessões reais ao abrir, sem token/cookie/segredo em tela", async () => {
    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([
      sessaoAtual,
      sessaoOutroDispositivo,
    ]);

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    const tabela = await screen.findByRole("table", {
      name: "Sessões ativas da sua conta",
    });
    expect(tabela).toHaveTextContent("Mozilla/5.0 (teste, aba atual)");
    expect(tabela).toHaveTextContent("203.0.113.10");
    expect(tabela).toHaveTextContent("Mozilla/5.0 (teste, outro dispositivo)");

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "token",
      "cookie",
      "senha",
      "password",
      "hash",
      "csrf",
      "authorization",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("mostra o estado de carregamento antes das sessões chegarem", async () => {
    let resolver: (v: SessaoApi[]) => void;
    vi.mocked(listarSessoesAtivas).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    expect(screen.getByText("Carregando sessões…")).toBeInTheDocument();

    resolver!([sessaoAtual]);
    await screen.findByRole("table", { name: "Sessões ativas da sua conta" });
  });

  it("mostra EmptyState quando não há sessões ativas", async () => {
    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([]);

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Nenhuma sessão ativa" }),
    ).toBeInTheDocument();
  });

  it("mostra erro de carregamento e permite tentar novamente", async () => {
    vi.mocked(listarSessoesAtivas).mockRejectedValueOnce(new Error("falha"));

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    await screen.findByText("Não foi possível carregar suas sessões ativas.");

    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([sessaoAtual]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Sessões ativas da sua conta" });
  });

  it("carga inicial com 401: trata como sessão própria encerrada, sem mostrar tela de erro", async () => {
    const onSessaoAtualEncerrada = vi.fn();
    vi.mocked(listarSessoesAtivas).mockRejectedValueOnce(
      new ApiError(401, "Não autorizado."),
    );

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={onSessaoAtualEncerrada}
      />,
    );

    await waitFor(() =>
      expect(onSessaoAtualEncerrada).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.queryByText("Não foi possível carregar suas sessões ativas."),
    ).not.toBeInTheDocument();
  });

  it("revoga uma sessão de outro dispositivo e recarrega a lista, sem encerrar a sessão atual", async () => {
    const onSessaoAtualEncerrada = vi.fn();
    vi.mocked(listarSessoesAtivas)
      .mockResolvedValueOnce([sessaoAtual, sessaoOutroDispositivo])
      .mockResolvedValueOnce([sessaoAtual]);
    vi.mocked(revogarSessao).mockResolvedValueOnce(undefined);

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={onSessaoAtualEncerrada}
      />,
    );

    const tabela = await screen.findByRole("table", {
      name: "Sessões ativas da sua conta",
    });
    const linha = within(tabela)
      .getByText("Mozilla/5.0 (teste, outro dispositivo)")
      .closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: "Encerrar sessão" }),
    );

    await waitFor(() =>
      expect(revogarSessao).toHaveBeenCalledWith(sessaoOutroDispositivo.id),
    );
    await waitFor(() =>
      expect(vi.mocked(listarSessoesAtivas)).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("Mozilla/5.0 (teste, outro dispositivo)"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText("Mozilla/5.0 (teste, aba atual)"),
    ).toBeInTheDocument();
    expect(onSessaoAtualEncerrada).not.toHaveBeenCalled();
  });

  it("revoga a sessão atual: a releitura pós-revogação responde 401 e aciona onSessaoAtualEncerrada", async () => {
    const onSessaoAtualEncerrada = vi.fn();
    vi.mocked(listarSessoesAtivas)
      .mockResolvedValueOnce([sessaoAtual])
      .mockRejectedValueOnce(new ApiError(401, "Não autorizado."));
    vi.mocked(revogarSessao).mockResolvedValueOnce(undefined);

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={onSessaoAtualEncerrada}
      />,
    );

    await screen.findByRole("table", { name: "Sessões ativas da sua conta" });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar sessão" }));

    await waitFor(() =>
      expect(revogarSessao).toHaveBeenCalledWith(sessaoAtual.id),
    );
    await waitFor(() =>
      expect(onSessaoAtualEncerrada).toHaveBeenCalledTimes(1),
    );
  });

  it("revogar diretamente com 401 (sessão já inválida) também aciona onSessaoAtualEncerrada, sem tentar recarregar", async () => {
    const onSessaoAtualEncerrada = vi.fn();
    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([sessaoAtual]);
    vi.mocked(revogarSessao).mockRejectedValueOnce(
      new ApiError(401, "Não autorizado."),
    );

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={onSessaoAtualEncerrada}
      />,
    );

    await screen.findByRole("table", { name: "Sessões ativas da sua conta" });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar sessão" }));

    await waitFor(() =>
      expect(onSessaoAtualEncerrada).toHaveBeenCalledTimes(1),
    );
    expect(listarSessoesAtivas).toHaveBeenCalledTimes(1);
  });

  it("mostra erro inline quando revogar falha por outro motivo (ex.: 404), sem afetar a sessão atual", async () => {
    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([
      sessaoAtual,
      sessaoOutroDispositivo,
    ]);
    vi.mocked(revogarSessao).mockRejectedValueOnce(
      new ApiError(404, "Não encontrado."),
    );

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    const tabela = await screen.findByRole("table", {
      name: "Sessões ativas da sua conta",
    });
    const linha = within(tabela)
      .getByText("Mozilla/5.0 (teste, outro dispositivo)")
      .closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: "Encerrar sessão" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não encontrado.",
    );
  });

  it("desabilita todos os botões de revogar enquanto uma revogação está em andamento (uma por vez)", async () => {
    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([
      sessaoAtual,
      sessaoOutroDispositivo,
    ]);
    vi.mocked(revogarSessao).mockReturnValueOnce(new Promise(() => {}));

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    const tabela = await screen.findByRole("table", {
      name: "Sessões ativas da sua conta",
    });
    const botoes = within(tabela).getAllByRole("button", {
      name: /Encerrar sessão/,
    });
    fireEvent.click(botoes[0]!);

    await waitFor(() =>
      expect(
        within(tabela).getByRole("button", { name: "Encerrando…" }),
      ).toBeInTheDocument(),
    );
    for (const botao of within(tabela).getAllByRole("button")) {
      expect(botao).toBeDisabled();
    }
  });

  it("fecha o painel ao clicar em Fechar", async () => {
    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([sessaoAtual]);
    const onFechar = vi.fn();

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={onFechar}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    await screen.findByRole("table", { name: "Sessões ativas da sua conta" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("não permite revogar sessão de outro usuário — não há campo para digitar id, nem referência a papel/e-mail/senha/MFA/SSO", async () => {
    vi.mocked(listarSessoesAtivas).mockResolvedValueOnce([sessaoAtual]);

    render(
      <SessoesAtivasPanel
        aberto={true}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );

    await screen.findByRole("table", { name: "Sessões ativas da sua conta" });

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of ["papel", "permiss", "e-mail", "senha"]) {
      expect(texto).not.toContain(termoProibido);
    }
    // "sso" e "mfa" usam limite de palavra: "acesso" (legítimo no aviso do
    // painel) não pode dar falso positivo para "SSO".
    expect(texto).not.toMatch(/\bmfa\b/);
    expect(texto).not.toMatch(/\bsso\b/);
  });
});
