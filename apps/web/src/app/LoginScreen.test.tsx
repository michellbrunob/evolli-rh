import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen";
import { ApiError, login } from "../api/authClient";

vi.mock("../api/authClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/authClient")>(
      "../api/authClient",
    );
  return {
    ...actual,
    login: vi.fn(),
  };
});

const EMAIL_SINTETICO = "pessoa.teste@example.test";
const SENHA_SINTETICA = "SenhaSintetica123!";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginScreen (T116)", () => {
  it("tem um único h1 'Entrar'", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Entrar" }),
    ).toHaveLength(1);
  });

  it("expõe os campos E-mail e Senha por label, com tipo e autocomplete corretos", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    const campoEmail = screen.getByLabelText(/^E-mail\b/i);
    const campoSenha = screen.getByLabelText(/^Senha\b/i);

    expect(campoEmail).toHaveAttribute("type", "email");
    expect(campoEmail).toHaveAttribute("autoComplete", "username");
    expect(campoSenha).toHaveAttribute("type", "password");
    expect(campoSenha).toHaveAttribute("autoComplete", "current-password");
  });

  it("envia e-mail e senha ao backend e chama onLoginSuccess ao entrar com sucesso", async () => {
    vi.mocked(login).mockResolvedValueOnce(undefined);
    const onLoginSuccess = vi.fn();

    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);

    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: EMAIL_SINTETICO,
        password: SENHA_SINTETICA,
      }),
    );
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
  });

  it("desabilita o botão e mostra 'Entrando…' durante o envio", async () => {
    // Em uso real, sucesso troca `onLoginSuccess` -> o pai desmonta esta
    // tela (vira o shell autenticado); aqui o pai é um mock que não desmonta
    // nada, então o teste verifica só o estado ENQUANTO a chamada está
    // pendente — não o que acontece depois que ela resolve.
    vi.mocked(login).mockReturnValueOnce(new Promise(() => {}));

    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("button", { name: "Entrando…" }),
    ).toBeDisabled();
  });

  it("mostra mensagem genérica em falha de credencial (401) — nunca indica o motivo específico", async () => {
    vi.mocked(login).mockRejectedValueOnce(
      new ApiError(401, "Não autorizado."),
    );

    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: "senha-errada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const erro = await screen.findByRole("alert");
    expect(erro).toHaveTextContent("E-mail ou senha inválidos.");
    // Nunca indica se o e-mail existe, se a senha falhou ou se a conta está
    // bloqueada — a mesma mensagem serve para todos os três casos.
    expect(erro.textContent).not.toMatch(
      /existe|cadastrad|bloquead|desativad/i,
    );
  });

  it("mostra mensagem distinta de limite de tentativas em 429, sem relacionar a uma conta específica", async () => {
    vi.mocked(login).mockRejectedValueOnce(
      new ApiError(429, "Muitas requisições."),
    );

    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    );
  });

  it("mostra mensagem de indisponibilidade (não de credencial) para erro de servidor (500) — nunca sugere e-mail ou senha errados", async () => {
    vi.mocked(login).mockRejectedValueOnce(new ApiError(500, "Erro interno."));

    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const erro = await screen.findByRole("alert");
    expect(erro).toHaveTextContent(
      "Não foi possível entrar. Tente novamente em instantes.",
    );
    expect(erro.textContent).not.toMatch(/e-mail ou senha/i);
  });

  it("mostra mensagem de conectividade para falha inesperada (ex.: rede fora do ar)", async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error("network down"));

    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Verifique sua conexão e tente novamente.",
    );
  });

  it("limpa o campo de senha após uma tentativa que falhou, mantém o e-mail", async () => {
    vi.mocked(login).mockRejectedValueOnce(
      new ApiError(401, "Não autorizado."),
    );

    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: "senha-errada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText(/^Senha\b/i)).toHaveValue("");
    expect(screen.getByLabelText(/^E-mail\b/i)).toHaveValue(EMAIL_SINTETICO);
  });

  it("nunca grava e-mail ou senha em localStorage ou sessionStorage", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.mocked(login).mockResolvedValueOnce(undefined);

    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("não referencia cadastro público, gestão de usuários, redefinição de senha, MFA ou SSO", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cadastr",
      "esqueci",
      "redefinir",
      "recuper",
      "mfa",
      "sso",
      "cpf",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
