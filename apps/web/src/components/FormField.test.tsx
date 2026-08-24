import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";

describe("FormField (UI-F03)", () => {
  it("associa o rótulo ao controle (label ↔ input)", () => {
    render(
      <FormField id="campo" label="Meu rótulo">
        {(control) => <input type="text" {...control} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Meu rótulo");
    expect(input).toBe(screen.getByRole("textbox"));
    expect(input).toHaveAttribute("id", "campo");
  });

  it("associa o texto de ajuda via aria-describedby", () => {
    render(
      <FormField id="campo" label="Rótulo" help="Ajuda do campo">
        {(control) => <input type="text" {...control} />}
      </FormField>,
    );
    const input = screen.getByRole("textbox");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBe("campo-help");
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Ajuda do campo",
    );
  });

  it("comunica o erro por texto, semântica (aria-invalid + alert) e ícone — não só cor", () => {
    render(
      <FormField id="campo" label="Rótulo" error="Valor inválido">
        {(control) => <input type="text" {...control} />}
      </FormField>,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");

    // Mensagem em role=alert, referenciada por aria-describedby.
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("Valor inválido");
    expect(input.getAttribute("aria-describedby")).toBe("campo-error");

    // Ícone de forma distinta (decorativo) acompanha o texto.
    expect(alerta.querySelector(".evolli-field__error-icon")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("combina ajuda e erro no aria-describedby", () => {
    render(
      <FormField id="campo" label="Rótulo" help="Ajuda" error="Erro">
        {(control) => <input type="text" {...control} />}
      </FormField>,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-describedby",
      "campo-help campo-error",
    );
  });

  it("marca obrigatório com aria-required e texto para leitor de tela", () => {
    render(
      <FormField id="campo" label="Rótulo" required>
        {(control) => <input type="text" {...control} />}
      </FormField>,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-required",
      "true",
    );
    // O rótulo acessível inclui a indicação textual "(obrigatório)".
    expect(screen.getByLabelText(/obrigatório/i)).toBeInTheDocument();
  });

  it("propaga o estado desabilitado ao controle", () => {
    render(
      <FormField id="campo" label="Rótulo" disabled>
        {(control) => <input type="text" {...control} />}
      </FormField>,
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("funciona por composição com select e textarea", () => {
    const { rerender } = render(
      <FormField id="sel" label="Seleção">
        {(control) => (
          <select {...control}>
            <option value="a">A</option>
          </select>
        )}
      </FormField>,
    );
    expect(screen.getByLabelText("Seleção")).toBe(screen.getByRole("combobox"));

    rerender(
      <FormField id="ta" label="Área">
        {(control) => <textarea {...control} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Área").tagName).toBe("TEXTAREA");
  });

  it("não define aria-invalid nem describedby quando não há erro/ajuda", () => {
    render(
      <FormField id="campo" label="Rótulo">
        {(control) => <input type="text" {...control} />}
      </FormField>,
    );
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
