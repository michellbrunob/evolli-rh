import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormActions } from "./FormActions";
import { Button } from "./Button";

describe("FormActions (UI-F03)", () => {
  it("agrupa as ações passadas como filhos", () => {
    render(
      <FormActions>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="primary">Confirmar</Button>
      </FormActions>,
    );
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar" }),
    ).toBeInTheDocument();
  });

  it("aplica o alinhamento (end por padrão)", () => {
    const { container, rerender } = render(
      <FormActions>
        <Button>Ok</Button>
      </FormActions>,
    );
    expect(container.querySelector(".evolli-form-actions")).toHaveClass(
      "evolli-form-actions--end",
    );

    rerender(
      <FormActions align="start">
        <Button>Ok</Button>
      </FormActions>,
    );
    expect(container.querySelector(".evolli-form-actions")).toHaveClass(
      "evolli-form-actions--start",
    );
  });

  it("reutiliza o Button (não cria nova gramática de botão)", () => {
    render(
      <FormActions>
        <Button variant="primary">Confirmar</Button>
      </FormActions>,
    );
    // O botão continua sendo o componente Button padrão.
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveClass(
      "evolli-button",
      "evolli-button--primary",
    );
  });
});
