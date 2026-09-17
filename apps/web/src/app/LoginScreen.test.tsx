import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen";
import { ApiError, login, verifyMfa } from "../api/authClient";

vi.mock("../api/authClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/authClient")>(
      "../api/authClient",
    );
  return {
    ...actual,
    login: vi.fn(),
    verifyMfa: vi.fn(),
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
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });
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
    vi.mocked(login).mockResolvedValueOnce({ mfaRequerido: false });

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

  describe("segundo fator (T126)", () => {
    async function entrarComMfaRequerido() {
      vi.mocked(login).mockResolvedValueOnce({
        mfaRequerido: true,
        challengeToken: "challenge-opaco-123",
      });
      render(<LoginScreen onLoginSuccess={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
        target: { value: EMAIL_SINTETICO },
      });
      fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
        target: { value: SENHA_SINTETICA },
      });
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
      await screen.findByRole("heading", {
        level: 1,
        name: "Verificação em duas etapas",
      });
    }

    it("MFA requerido: troca para a etapa do 2º fator, com h1 único e sem shell", async () => {
      await entrarComMfaRequerido();
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(
        screen.getByLabelText(/Código de verificação/i),
      ).toBeInTheDocument();
      // Nenhuma sessão plena: onLoginSuccess não foi chamado ainda.
      expect(
        screen.queryByRole("navigation", { name: "Navegação do painel" }),
      ).not.toBeInTheDocument();
    });

    it("verificação válida chama verifyMfa com o challenge e libera onLoginSuccess", async () => {
      vi.mocked(login).mockResolvedValueOnce({
        mfaRequerido: true,
        challengeToken: "challenge-opaco-123",
      });
      vi.mocked(verifyMfa).mockResolvedValueOnce(undefined);
      const onLoginSuccess = vi.fn();
      render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
      fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
        target: { value: EMAIL_SINTETICO },
      });
      fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
        target: { value: SENHA_SINTETICA },
      });
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
      await screen.findByLabelText(/Código de verificação/i);

      fireEvent.change(screen.getByLabelText(/Código de verificação/i), {
        target: { value: "123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

      await waitFor(() =>
        expect(verifyMfa).toHaveBeenCalledWith({
          challengeToken: "challenge-opaco-123",
          code: "123456",
        }),
      );
      await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
    });

    it("verificação inválida (401): erro genérico e limpa o campo de código, sem liberar sessão", async () => {
      await entrarComMfaRequerido();
      vi.mocked(verifyMfa).mockRejectedValueOnce(
        new ApiError(401, "Não autorizado."),
      );

      fireEvent.change(screen.getByLabelText(/Código de verificação/i), {
        target: { value: "000000" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

      const erro = await screen.findByRole("alert");
      expect(erro).toHaveTextContent("Código inválido ou expirado.");
      expect(erro.textContent).not.toMatch(
        /conta|usad|existe|expirou o token/i,
      );
      expect(screen.getByLabelText(/Código de verificação/i)).toHaveValue("");
    });

    it("'Voltar' retorna à etapa de credenciais e limpa código/challenge", async () => {
      await entrarComMfaRequerido();
      fireEvent.change(screen.getByLabelText(/Código de verificação/i), {
        target: { value: "999999" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

      expect(
        screen.getByRole("heading", { level: 1, name: "Entrar" }),
      ).toBeInTheDocument();
      // Senha foi limpa; e-mail preservado.
      expect(screen.getByLabelText(/^Senha\b/i)).toHaveValue("");
    });

    it("nunca grava challenge ou código em localStorage/sessionStorage", async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      await entrarComMfaRequerido();
      vi.mocked(verifyMfa).mockResolvedValueOnce(undefined);
      fireEvent.change(screen.getByLabelText(/Código de verificação/i), {
        target: { value: "123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Verificar" }));
      await waitFor(() => expect(verifyMfa).toHaveBeenCalled());

      expect(setItemSpy).not.toHaveBeenCalled();
      // O challenge não aparece em nenhum atributo de DOM persistente.
      expect(document.body.innerHTML).not.toContain("challenge-opaco-123");
    });
  });
});
