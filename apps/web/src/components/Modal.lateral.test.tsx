/**
 * T209 — animação reutilizável dos painéis laterais (`Modal` com
 * `posicao="lateral"`). O painel entra deslizando da direita, sai deslizando
 * para a direita e o fundo aparece e some por opacidade. A saída não usa
 * temporizador: o painel fica montado, inerte, até o `animationend` da
 * própria caixa; sem animação (movimento reduzido, ou a janela central), ele
 * sai na hora. Foco, Escape, fundo, guarda e rolagem continuam os mesmos.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Modal } from "./Modal";

/**
 * O jsdom não aplica as folhas de estilo: o nome da animação calculada vem
 * daqui, como o navegador o daria (com ou sem redução de movimento).
 */
function animacaoCalculada(
  nomeDaSaida: string,
  nomeDaEntrada = "evolli-painel-entra",
) {
  const original = window.getComputedStyle.bind(window);
  return vi
    .spyOn(window, "getComputedStyle")
    .mockImplementation((elemento: Element, pseudo?: string | null) => {
      const estilo = original(elemento, pseudo);
      if (
        !(elemento as HTMLElement).classList?.contains("evolli-modal__caixa")
      ) {
        return estilo;
      }
      const saindo = elemento.closest(".evolli-modal--saindo") !== null;
      return new Proxy(estilo, {
        get(alvo, prop) {
          if (prop === "animationName") {
            return saindo ? nomeDaSaida : nomeDaEntrada;
          }
          const valor = Reflect.get(alvo, prop);
          return typeof valor === "function" ? valor.bind(alvo) : valor;
        },
      });
    });
}

afterEach(() => {
  vi.restoreAllMocks();
});

function Palco({
  posicao = "lateral",
  alterado = false,
  bloqueado = false,
  onFechar,
}: {
  posicao?: "centro" | "lateral";
  alterado?: boolean;
  bloqueado?: boolean;
  onFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Abrir painel
      </button>
      <Modal
        aberto={aberto}
        titulo="Painel de teste"
        posicao={posicao}
        alterado={alterado}
        bloqueado={bloqueado}
        onFechar={() => {
          onFechar?.();
          setAberto(false);
        }}
      >
        <input aria-label="Campo de teste" />
      </Modal>
    </>
  );
}

/** `animationend` com o nome da animação (o jsdom não o preenche sozinho). */
function fimDaAnimacao(elemento: Element, animationName: string) {
  const evento = new Event("animationend", { bubbles: true });
  Object.defineProperty(evento, "animationName", { value: animationName });
  fireEvent(elemento, evento);
}

const camada = () => document.querySelector<HTMLElement>(".evolli-modal");
const caixa = () => document.querySelector<HTMLElement>(".evolli-modal__caixa");
const fundo = () => document.querySelector<HTMLElement>(".evolli-modal__fundo");

function abrir() {
  const gatilho = screen.getByRole("button", { name: "Abrir painel" });
  gatilho.focus();
  fireEvent.click(gatilho);
  return gatilho;
}

describe("T209 — painel lateral com entrada e saída animadas", () => {
  it("abre já na posição de entrada, com o foco no título", () => {
    animacaoCalculada("evolli-painel-sai");
    render(<Palco />);
    abrir();
    expect(camada()).toHaveClass("evolli-modal", "evolli-modal--lateral");
    expect(camada()).not.toHaveClass("evolli-modal--saindo");
    expect(
      screen.getByRole("dialog", { name: "Painel de teste" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Painel de teste" }),
    ).toHaveFocus();
  });

  it("fechar: o foco volta ao gatilho e a rolagem destrava NA HORA; o painel sai inerte até o fim da animação", () => {
    animacaoCalculada("evolli-painel-sai");
    const antes = document.body.style.overflow;
    render(<Palco />);
    const gatilho = abrir();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(gatilho).toHaveFocus();
    expect(document.body.style.overflow).toBe(antes);
    expect(camada()).toHaveClass("evolli-modal--saindo");
    expect(camada()).toHaveAttribute("aria-hidden", "true");
    expect(camada()).toHaveAttribute("inert");
    // Fora da árvore acessível: nenhum diálogo para o leitor de tela.
    expect(screen.queryByRole("dialog")).toBeNull();

    fimDaAnimacao(caixa()!, "evolli-painel-sai");
    expect(camada()).toBeNull();
  });

  it("o fim de uma animação de DENTRO do painel (ou a de entrada) não o desmonta", () => {
    animacaoCalculada("evolli-painel-sai");
    render(<Palco />);
    abrir();
    fimDaAnimacao(caixa()!, "evolli-painel-entra");
    expect(camada()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fimDaAnimacao(screen.getByLabelText("Campo de teste"), "evolli-painel-sai");
    expect(camada()).not.toBeNull();
    fimDaAnimacao(caixa()!, "evolli-painel-sai");
    expect(camada()).toBeNull();
  });

  it("saindo, o fim de OUTRA animação da caixa (não a de saída) não a desmonta", () => {
    animacaoCalculada("evolli-painel-sai");
    render(<Palco />);
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fimDaAnimacao(caixa()!, "evolli-painel-entra");
    expect(camada()).not.toBeNull();
    fimDaAnimacao(caixa()!, "evolli-painel-sai");
    expect(camada()).toBeNull();
  });

  it("redução de movimento (sem animação calculada): fecha na hora, sem esperar evento", () => {
    animacaoCalculada("none", "none");
    const gatilho = (render(<Palco />), abrir());
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(camada()).toBeNull();
    expect(gatilho).toHaveFocus();
  });

  it("reabrir durante a saída cancela a saída: o painel volta interativo", () => {
    animacaoCalculada("evolli-painel-sai");
    render(<Palco />);
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(camada()).toHaveClass("evolli-modal--saindo");
    abrir();
    expect(camada()).not.toHaveClass("evolli-modal--saindo");
    expect(camada()).not.toHaveAttribute("inert");
    expect(
      screen.getByRole("dialog", { name: "Painel de teste" }),
    ).toBeTruthy();
    // A saída anterior, se terminar agora, não fecha o painel reaberto.
    fimDaAnimacao(caixa()!, "evolli-painel-sai");
    expect(camada()).not.toBeNull();
  });

  it("Escape fecha com a mesma saída; durante a saída, Escape não fecha de novo", () => {
    animacaoCalculada("evolli-painel-sai");
    const onFechar = vi.fn();
    render(<Palco onFechar={onFechar} />);
    abrir();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(camada()).toHaveClass("evolli-modal--saindo");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("clique no fundo do painel lateral fecha pelo mesmo caminho do Fechar", () => {
    animacaoCalculada("evolli-painel-sai");
    const onFechar = vi.fn();
    render(<Palco onFechar={onFechar} />);
    abrir();
    fireEvent.click(fundo()!);
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(camada()).toHaveClass("evolli-modal--saindo");
    // Saindo, o fundo já não pede fechamento (nem que um clique o alcance).
    fireEvent.click(fundo()!);
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("guarda: com alteração pendente, o fundo pede confirmação; durante o envio, nada fecha", () => {
    animacaoCalculada("evolli-painel-sai");
    const onFechar = vi.fn();
    const { unmount } = render(<Palco alterado onFechar={onFechar} />);
    abrir();
    fireEvent.click(fundo()!);
    expect(onFechar).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", {
        name: "Há alterações não salvas nesta janela. Descartar?",
      }),
    ).toBeTruthy();
    unmount();

    render(<Palco bloqueado onFechar={onFechar} />);
    abrir();
    fireEvent.click(fundo()!);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).not.toHaveBeenCalled();
    expect(camada()).not.toHaveClass("evolli-modal--saindo");
  });

  it("a janela central não muda: o fundo não fecha e o fechamento é imediato", () => {
    animacaoCalculada("none", "none");
    const onFechar = vi.fn();
    render(<Palco posicao="centro" onFechar={onFechar} />);
    abrir();
    fireEvent.click(fundo()!);
    expect(onFechar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(camada()).toBeNull();
  });

  it("desmontar no meio da saída não deixa nada para trás", () => {
    animacaoCalculada("evolli-painel-sai");
    const { unmount } = render(<Palco />);
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    act(() => unmount());
    expect(camada()).toBeNull();
  });
});

describe("T209 — contrato de CSS da animação dos painéis laterais", () => {
  const css = readFileSync("src/components/Modal.css", "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const tokens = readFileSync("src/app/tokens.css", "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const inicio = css.indexOf("/* T209 — animação dos painéis laterais");
  const bloco = inicio > -1 ? css.slice(inicio) : "";

  it("durações curtas em tokens, uma curva só, sem cor nova", () => {
    expect(tokens).toContain("  --movimento-painel-entrada: 200ms;");
    expect(tokens).toContain("  --movimento-painel-saida: 160ms;");
    expect(tokens).toMatch(/ {2}--movimento-curva: cubic-bezier\([^)]*\);/);
    expect(inicio).toBeGreaterThan(-1);
    expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("entra da direita, sai para a direita; o fundo aparece e some por opacidade", () => {
    expect(bloco).toMatch(
      /@keyframes evolli-painel-entra \{\s*from \{\s*transform: translateX\(100%\);\s*\}\s*to \{\s*transform: none;\s*\}\s*\}/,
    );
    expect(bloco).toMatch(
      /@keyframes evolli-painel-sai \{\s*from \{\s*transform: none;\s*\}\s*to \{\s*transform: translateX\(100%\);\s*\}\s*\}/,
    );
    expect(bloco).toMatch(
      /\.evolli-modal--lateral \.evolli-modal__caixa \{[^}]*animation: evolli-painel-entra var\(--movimento-painel-entrada\)\s+var\(--movimento-curva\) both;/,
    );
    expect(bloco).toMatch(
      /\.evolli-modal--lateral\.evolli-modal--saindo \.evolli-modal__caixa \{[^}]*animation: evolli-painel-sai var\(--movimento-painel-saida\)\s+var\(--movimento-curva\) both;/,
    );
    expect(bloco).toMatch(
      /\.evolli-modal--lateral \.evolli-modal__fundo \{[^}]*animation: evolli-fundo-entra/,
    );
    expect(bloco).toMatch(
      /\.evolli-modal--lateral\.evolli-modal--saindo \.evolli-modal__fundo \{[^}]*animation: evolli-fundo-sai/,
    );
  });

  it("saindo, a camada não recebe clique", () => {
    expect(bloco).toMatch(
      /\.evolli-modal--saindo \{[^}]*pointer-events: none;/,
    );
  });

  it("prefers-reduced-motion: nenhuma animação perceptível, nem na saída", () => {
    const reduzido =
      /@media \(prefers-reduced-motion: reduce\) \{([^@]*)\}/.exec(
        bloco,
      )?.[1] ?? "";
    expect(reduzido).toContain(
      ".evolli-modal--lateral.evolli-modal--saindo .evolli-modal__caixa",
    );
    expect(reduzido).toContain(
      ".evolli-modal--lateral.evolli-modal--saindo .evolli-modal__fundo",
    );
    expect(bloco).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.evolli-modal--lateral \.evolli-modal__caixa,[^{]*\.evolli-modal--lateral \.evolli-modal__fundo \{[^}]*animation: none;/,
    );
  });

  it("a janela central não ganha animação", () => {
    expect(bloco).not.toMatch(/(^|\n)\.evolli-modal__caixa \{[^}]*animation/);
  });
});
