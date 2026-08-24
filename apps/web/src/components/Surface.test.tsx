import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "./Surface";

describe("Surface (UI-F02)", () => {
  it("renderiza uma <div> por padrão com a classe base e padding md", () => {
    render(<Surface>conteúdo</Surface>);
    const el = screen.getByText("conteúdo");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("evolli-surface");
    expect(el).toHaveClass("evolli-surface--pad-md");
  });

  it("permite escolher o elemento e o padding", () => {
    render(
      <Surface as="article" padding="lg">
        cartão
      </Surface>,
    );
    const el = screen.getByText("cartão");
    expect(el.tagName).toBe("ARTICLE");
    expect(el).toHaveClass("evolli-surface--pad-lg");
  });

  it("preserva classes extras e atributos nativos", () => {
    render(
      <Surface className="extra" data-testid="s" aria-label="Área">
        x
      </Surface>,
    );
    const el = screen.getByTestId("s");
    expect(el).toHaveClass("evolli-surface");
    expect(el).toHaveClass("extra");
    expect(el).toHaveAttribute("aria-label", "Área");
  });
});
