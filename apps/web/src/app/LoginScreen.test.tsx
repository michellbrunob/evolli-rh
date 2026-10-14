import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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

    // Prefixos: pegam a família inteira da palavra ("cadastro", "cadastre-se",
    // "cadastrar"), que é o ponto — a ação não entra sob nenhuma flexão.
    for (const trechoProibido of [
      "cadastr",
      "esqueci",
      "redefinir",
      "recuper",
      "cpf",
      // T160 — a renovação visual não pode trazer ação sem contrato junto.
      // Cada um destes é uma promessa que o servidor não honra hoje.
      "captcha",
      "lembrar",
      "registro de ponto",
      "bater ponto",
      "google",
      "microsoft",
    ]) {
      expect(texto).not.toContain(trechoProibido);
    }

    // Palavras inteiras: "sso" e "mfa" são siglas, e como trecho solto davam
    // falso positivo em palavra legítima — "acesso" contém "sso". Medido
    // na T160: a guarda por trecho reprovava a frase "acesso restrito".
    for (const siglaProibida of ["sso", "mfa"]) {
      expect(texto).not.toMatch(new RegExp(`\b${siglaProibida}\b`));
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

/**
 * T160 — composição institucional da porta de entrada.
 *
 * O que estes testes prendem não é estética: é que a renovação visual **não
 * trouxe promessa junto**. Uma tela de login é o lugar mais fácil do produto
 * para alguém acrescentar "entrar com Google", "lembrar-me" ou "esqueci minha
 * senha" — nenhum dos três tem contrato, e os três parecem inofensivos.
 */
describe("LoginScreen — composição institucional (T160)", () => {
  const css = readFileSync("src/app/LoginScreen.css", "utf8");

  it("apresenta a marca Evolli em texto, não em imagem", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    expect(screen.getByText("Evolli RH")).toBeInTheDocument();
    // Nenhum ativo externo: o símbolo é SVG desenhado no projeto.
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("o fundo abstrato é decorativo e não entra na árvore de acessibilidade", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    const decorativos = document.querySelectorAll("svg");
    expect(decorativos.length).toBeGreaterThan(0);
    for (const svg of decorativos) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
    }
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("o conteúdo da entrada vive num <main>, com um único h1", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    const principal = screen.getByRole("main");
    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(principal).toContainElement(titulos[0]!);
  });

  it("o painel institucional não vira segundo h1", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("não há link nenhum na porta de entrada", () => {
    // Um link aqui seria ou uma ação sem contrato ("esqueci minha senha") ou
    // saída para fora do produto. Nenhuma das duas existe.
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("a única ação da etapa de credenciais é Entrar", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Entrar",
    ]);
  });

  it("a ordem de foco é e-mail, senha, Entrar", () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    const formulario = screen.getByRole("form", { name: /login/i });
    const focaveis = [
      ...formulario.querySelectorAll<HTMLElement>("input, button"),
    ];
    expect(focaveis).toHaveLength(3);
    expect(focaveis[0]).toHaveAttribute("type", "email");
    expect(focaveis[1]).toHaveAttribute("type", "password");
    expect(focaveis[2]).toHaveTextContent("Entrar");
    for (const elemento of focaveis) {
      expect(elemento.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("o painel institucional continua na etapa do 2º fator", async () => {
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

    expect(screen.getByText("Evolli RH")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("o erro continua anunciado por role=alert dentro do cartão", async () => {
    vi.mocked(login).mockRejectedValueOnce(new ApiError(401, "nao importa"));
    render(<LoginScreen onLoginSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^E-mail\b/i), {
      target: { value: EMAIL_SINTETICO },
    });
    fireEvent.change(screen.getByLabelText(/^Senha\b/i), {
      target: { value: SENHA_SINTETICA },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("E-mail ou senha inválidos.");
    expect(within(screen.getByRole("main")).getByRole("alert")).toBe(alerta);
  });

  describe("contrato visual escrito no CSS", () => {
    /** O CSS sem comentários — o que o navegador de fato aplica. */
    const cssSemComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");

    /** Conteúdo exato de um bloco `@media`, por casamento de chaves. */
    function blocoDeMedia(consulta: RegExp): string {
      const fonte = cssSemComentarios;
      const encontrado = consulta.exec(fonte);
      if (!encontrado) throw new Error(`bloco ausente: ${consulta}`);
      const abre = encontrado.index + encontrado[0].length - 1;
      let profundidade = 0;
      for (let i = abre; i < fonte.length; i += 1) {
        if (fonte[i] === "{") profundidade += 1;
        else if (fonte[i] === "}") {
          profundidade -= 1;
          if (profundidade === 0) return fonte.slice(abre + 1, i);
        }
      }
      throw new Error(`bloco não fecha: ${consulta}`);
    }

    it("nenhum ativo de terceiro: sem @import, sem url() remota, sem fonte externa", () => {
      // Sem os comentários: o cabeçalho do arquivo *fala sobre* `@import` para
      // explicar a regra, e uma guarda que lê comentário reprova a própria
      // documentação dela. Medido na T160.
      expect(cssSemComentarios).not.toMatch(/@import/);
      expect(cssSemComentarios).not.toMatch(/url\(\s*["']?https?:/);
      expect(cssSemComentarios).not.toMatch(
        /fonts\.googleapis|typekit|fontawesome/i,
      );
    });

    it("sem gradiente decorativo — a fundação do produto não os usa", () => {
      expect(cssSemComentarios).not.toMatch(
        /linear-gradient|radial-gradient|conic-gradient/,
      );
    });

    it("toda animação está atrás de prefers-reduced-motion", () => {
      // Hoje esta tela não tem movimento nenhum, e a asserção continua
      // valendo: o que ela proíbe é movimento FORA do bloco de preferência.
      // Com o bloco ausente, `foraDoBloco` é o arquivo inteiro — então
      // qualquer `transition` acrescentada em qualquer lugar reprova.
      const consulta =
        /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)\s*\{/;
      const comMovimento = consulta.test(cssSemComentarios)
        ? blocoDeMedia(consulta)
        : "";
      const foraDoBloco = comMovimento
        ? cssSemComentarios.replace(comMovimento, "")
        : cssSemComentarios;

      expect(foraDoBloco).not.toMatch(/\btransition\s*:/);
      expect(foraDoBloco).not.toMatch(/\banimation\s*:/);
      if (comMovimento) {
        // Se o bloco existir, o extrator precisa ter delimitado mesmo.
        expect(comMovimento.length).toBeLessThan(cssSemComentarios.length);
      }
    });

    it("a entrada do painel dispara uma vez — nada de laço", () => {
      // Movimento perpétuo por mais de cinco segundos cairia na WCAG 2.2.2 e
      // exigiria um controle de pausa que esta tela não tem.
      expect(cssSemComentarios).not.toMatch(/\binfinite\b/);
      expect(cssSemComentarios).toMatch(/@keyframes\s+login-entrada/);
    });

    it("animação que não avança não pode esconder a marca", () => {
      // Medido no navegador, e é o motivo de esta asserção existir: com
      // `opacity: 0` no quadro inicial e `fill-mode: both`, uma animação que
      // não avança — documento sem pintar — prende o conteúdo em
      // transparente, e a marca some por tempo indefinido. Animando só o
      // deslocamento, o pior caso é o texto 10px mais baixo.
      //
      // A guarda cobre o arquivo inteiro de propósito: nem dentro do bloco de
      // movimento pode haver `opacity` ou `visibility` animados.
      expect(cssSemComentarios).not.toMatch(/opacity:\s*0\b/);
      expect(cssSemComentarios).not.toMatch(/visibility:\s*hidden/);

      const consulta =
        /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)\s*\{/;
      const comMovimento = blocoDeMedia(consulta);
      // O que a animação mexe é só transform — e o quadro inicial existe.
      expect(comMovimento).toMatch(/transform:\s*translateY\(/);
      expect(comMovimento).not.toMatch(/\bopacity\b/);
      expect(comMovimento).not.toMatch(/\bvisibility\b/);
    });

    it("nada força largura maior que a tela em 375px", () => {
      // Rolagem horizontal no mobile nasce de largura fixa e de deslocamento
      // lateral; nenhum dos dois entra aqui. Sem comentários, pelo mesmo
      // motivo do `@import`: o arquivo EXPLICA que `translateX` é proibido, e
      // a guarda não pode reprovar a própria explicação.
      expect(cssSemComentarios).not.toMatch(/translateX|translate3d/);
      expect(cssSemComentarios).not.toMatch(/min-width:\s*\d{3,}px\s*;/);
    });
  });
});
