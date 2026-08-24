import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button (UI-F02)", () => {
  it("renderiza um <button> com type='button' por padrão", () => {
    render(<Button>Ação</Button>);
    const botao = screen.getByRole("button", { name: "Ação" });
    expect(botao.tagName).toBe("BUTTON");
    expect(botao).toHaveAttribute("type", "button");
  });

  it("aplica a classe de variante (primary por padrão)", () => {
    const { rerender } = render(<Button>Ação</Button>);
    expect(screen.getByRole("button")).toHaveClass("evolli-button--primary");

    rerender(<Button variant="secondary">Ação</Button>);
    expect(screen.getByRole("button")).toHaveClass("evolli-button--secondary");

    rerender(<Button variant="subtle">Ação</Button>);
    expect(screen.getByRole("button")).toHaveClass("evolli-button--subtle");
  });

  it("respeita o estado disabled e não dispara onClick", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Ação
      </Button>,
    );
    const botao = screen.getByRole("button");
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("encaminha type e atributos nativos", () => {
    render(
      <Button type="submit" aria-label="Enviar formulário">
        Enviar
      </Button>,
    );
    const botao = screen.getByRole("button", { name: "Enviar formulário" });
    expect(botao).toHaveAttribute("type", "submit");
  });
});
