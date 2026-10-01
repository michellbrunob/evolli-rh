import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

/**
 * Cobertura do comportamento de janela (UI-F04, T142). A aparência é julgada
 * no navegador; aqui ficam as garantias que dá para provar: nome acessível,
 * foco inicial, foco preso, devolução do foco, Escape, fundo sem rolagem,
 * bloqueio durante envio e confirmação de descarte.
 */
function Palco({
  alterado = false,
  bloqueado = false,
}: {
  alterado?: boolean;
  bloqueado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <Button
        onClick={(e) => {
          e.currentTarget.focus();
          setAberto(true);
        }}
      >
        Abrir
      </Button>
      <Modal
        aberto={aberto}
        titulo="Nova admissão"
        descricao="Texto de apoio."
        onFechar={() => setAberto(false)}
        alterado={alterado}
        bloqueado={bloqueado}
        rodape={<Button type="button">Salvar</Button>}
      >
        <input aria-label="Campo A" />
        <input aria-label="Campo B" />
      </Modal>
    </div>
  );
}

const TABULAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tab de verdade. `fireEvent.keyDown` sozinho não move foco nenhum (o jsdom não
 * tem ordem de tabulação), então um teste que só dispara o evento enxerga o
 * foco parado e deixa passar um vazamento. Aqui o evento é disparado no
 * elemento focado; se o `Modal` o interceptou (`preventDefault`), vale o foco
 * que ele escolheu; se não, faz-se o que o navegador faria — ir ao próximo (ou
 * anterior) focável do DOCUMENTO INTEIRO, que inclui o que está atrás.
 */
function tab(shift = false) {
  const origem = document.activeElement ?? document.body;
  const seguiuPadrao = fireEvent.keyDown(origem, {
    key: "Tab",
    shiftKey: shift,
  });
  if (!seguiuPadrao) return;
  const todos = [...document.querySelectorAll<HTMLElement>(TABULAVEIS)];
  const i = todos.indexOf(origem as HTMLElement);
  const proximo = shift
    ? (todos[i - 1] ?? todos[todos.length - 1])
    : (todos[i + 1] ?? todos[0]);
  proximo?.focus();
}

describe("Modal (UI-F04)", () => {
  it("não renderiza nada enquanto está fechado", () => {
    render(<Palco />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("é um diálogo modal nomeado e descrito pelo próprio conteúdo", () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleName("Nova admissão");
    expect(dialogo).toHaveAccessibleDescription("Texto de apoio.");
  });

  it("leva o foco para o título ao abrir e o devolve ao acionador ao fechar", async () => {
    render(<Palco />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    fireEvent.click(abrir);

    const titulo = screen.getByRole("heading", { name: "Nova admissão" });
    await waitFor(() => expect(document.activeElement).toBe(titulo));

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });

  it("Escape fecha quando não há nada a perder", async () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("com alterações não salvas, fechar pede confirmação antes de descartar", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    // Não fechou: apareceu a confirmação, dentro da própria janela.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/alterações não salvas/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // ---- T144 (R2): a confirmação é um `alertdialog`. Sem nome acessível e sem
  // foco, quem usa leitor de tela não fica sabendo que a pergunta apareceu —
  // `alertdialog` não tem região viva implícita e nada é anunciado sozinho.
  it("a confirmação de descarte é um alertdialog nomeado pelo próprio texto", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    const confirmacao = screen.getByRole("alertdialog");
    expect(confirmacao).toHaveAccessibleName(
      "Há alterações não salvas nesta janela. Descartar?",
    );
    expect(confirmacao).toHaveAttribute("aria-modal", "true");
  });

  it("a confirmação leva o foco direto à ação segura, 'Continuar editando'", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Continuar editando" }),
      ),
    );
  });

  it("continuar editando devolve o foco a quem o tinha antes da confirmação", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const campo = screen.getByLabelText("Campo A");
    campo.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("alertdialog");

    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));

    await waitFor(() => expect(document.activeElement).toBe(campo));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("Escape na confirmação volta um nível e devolve o foco, sem fechar a janela", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const campo = screen.getByLabelText("Campo B");
    campo.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("alertdialog");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo));
  });

  // ---- T144 (contenção de foco): `aria-modal` na confirmação afirma que o que
  // está atrás dela está inerte. O Tab precisa honrar isso.
  async function abrirConfirmacao() {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    const confirmacao = await screen.findByRole("alertdialog");
    const continuar = screen.getByRole("button", {
      name: "Continuar editando",
    });
    const descartar = screen.getByRole("button", {
      name: "Descartar alterações",
    });
    await waitFor(() => expect(document.activeElement).toBe(continuar));
    return { confirmacao, continuar, descartar };
  }

  it("Tab em 'Continuar editando' vai a 'Descartar alterações'", async () => {
    const { continuar, descartar } = await abrirConfirmacao();
    expect(document.activeElement).toBe(continuar);

    tab();

    expect(document.activeElement).toBe(descartar);
  });

  it("Tab em 'Descartar alterações' volta a 'Continuar editando', sem sair para os campos", async () => {
    const { continuar, descartar } = await abrirConfirmacao();
    descartar.focus();

    tab();

    expect(document.activeElement).toBe(continuar);
  });

  it("Shift+Tab faz o ciclo inverso", async () => {
    const { continuar, descartar } = await abrirConfirmacao();

    tab(true);
    expect(document.activeElement).toBe(descartar);

    tab(true);
    expect(document.activeElement).toBe(continuar);
  });

  it("nada atrás da confirmação recebe foco, em nenhuma direção", async () => {
    const { confirmacao } = await abrirConfirmacao();
    const atras = [
      screen.getByLabelText("Campo A"),
      screen.getByLabelText("Campo B"),
      screen.getByRole("button", { name: "Salvar" }),
      screen.getByRole("button", { name: "Fechar" }),
      screen.getByRole("button", { name: "Abrir" }),
    ];

    for (const shift of [false, true]) {
      for (let passo = 0; passo < 6; passo++) {
        tab(shift);
        const foco = document.activeElement;
        expect(confirmacao.contains(foco)).toBe(true);
        for (const elemento of atras) expect(foco).not.toBe(elemento);
      }
    }
  });

  it("se o foco foi parar atrás da confirmação, Tab o traz de volta para dentro dela", async () => {
    const { continuar, descartar } = await abrirConfirmacao();

    screen.getByLabelText("Campo A").focus();
    tab();
    expect(document.activeElement).toBe(continuar);

    screen.getByLabelText("Campo B").focus();
    tab(true);
    expect(document.activeElement).toBe(descartar);
  });

  it("Escape fecha só a confirmação, partindo de dentro dela, e devolve o foco ao elemento anterior", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const campo = screen.getByLabelText("Campo B");
    campo.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    const confirmacao = await screen.findByRole("alertdialog");
    // O foco já está na ação segura da confirmação (e não no campo) antes do
    // Escape — é daí que o Escape parte.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(confirmacao).getByRole("button", { name: "Continuar editando" }),
      ),
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo));
  });

  it("'Continuar editando' preserva o que foi digitado e devolve o foco, partindo de dentro da confirmação", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const campo = screen.getByLabelText("Campo A");
    fireEvent.change(campo, { target: { value: "texto digitado" } });
    campo.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    const continuar = await screen.findByRole("button", {
      name: "Continuar editando",
    });
    await waitFor(() => expect(document.activeElement).toBe(continuar));

    fireEvent.click(continuar);

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText("Campo A")).toHaveValue("texto digitado");
    await waitFor(() => expect(document.activeElement).toBe(campo));
  });

  it("fechar e reabrir a confirmação usa o foco de AGORA, não o da vez anterior", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    const campoA = screen.getByLabelText("Campo A");
    const campoB = screen.getByLabelText("Campo B");

    // 1ª confirmação, a partir do Campo A.
    campoA.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("alertdialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(campoA));

    // 2ª confirmação, a partir do Campo B: não pode voltar para o Campo A.
    campoB.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("alertdialog");
    // Reabrir repete o comportamento: o foco vai de novo à ação segura.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Continuar editando" }),
      ),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(campoB));
    expect(document.activeElement).not.toBe(campoA);

    // Descartar e reabrir a janela inteira: a confirmação seguinte também
    // parte do foco da nova sessão.
    campoB.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Descartar alterações" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    const novoCampoA = screen.getByLabelText("Campo A");
    novoCampoA.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("alertdialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(novoCampoA));
  });

  it("durante o envio, não fecha por Escape nem pelo botão", async () => {
    render(<Palco bloqueado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
  });

  it("prende o foco: Tab no último volta ao primeiro", async () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const fechar = screen.getByRole("button", { name: "Fechar" });
    const salvar = screen.getByRole("button", { name: "Salvar" });

    salvar.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    await waitFor(() => expect(document.activeElement).toBe(fechar));

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    await waitFor(() => expect(document.activeElement).toBe(salvar));
  });

  it("trava a rolagem do fundo enquanto está aberto e devolve ao fechar", async () => {
    render(<Palco />);
    const antes = document.body.style.overflow;
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.body.style.overflow).toBe(antes));
  });

  it("clicar no fundo não fecha: descartar é sempre explícito", async () => {
    const { container } = render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const fundo = container.querySelector(".evolli-modal__fundo")!;
    fireEvent.click(fundo);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("não empilha: uma janela por vez", async () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("o onFechar só é chamado uma vez por fechamento", async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto titulo="Janela" onFechar={aoFechar}>
        <p>conteúdo</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
