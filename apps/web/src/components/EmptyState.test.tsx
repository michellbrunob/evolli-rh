import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState (UI-F02)", () => {
  it("renderiza o título (nível 2 por padrão)", () => {
    render(<EmptyState title="Sem itens" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Sem itens" }),
    ).toBeInTheDocument();
  });

  it("exibe descrição e ação apenas quando fornecidas", () => {
    const { rerender } = render(<EmptyState title="Sem itens" />);
    expect(screen.queryByText("Explique")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <EmptyState
        title="Sem itens"
        description="Explique"
        action={<button>Agir</button>}
      />,
    );
    expect(screen.getByText("Explique")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agir" })).toBeInTheDocument();
  });

  it("marca o ícone como decorativo (aria-hidden)", () => {
    const { container } = render(<EmptyState title="Sem itens" icon="—" />);
    const icone = container.querySelector(".evolli-empty-state__icon");
    expect(icone).not.toBeNull();
    expect(icone).toHaveAttribute("aria-hidden", "true");
  });

  it("respeita o nível de cabeçalho configurável", () => {
    render(<EmptyState title="Sem itens" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });
});
