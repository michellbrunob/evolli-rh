import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader (UI-F02)", () => {
  it("renderiza o título e NÃO cria um landmark banner", () => {
    render(<PageHeader title="Título da página" />);
    expect(
      screen.getByRole("heading", { name: "Título da página" }),
    ).toBeInTheDocument();
    // Bloco reutilizável não deve competir como segundo banner da página.
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("usa o nível de cabeçalho informado (padrão 2)", () => {
    const { rerender } = render(<PageHeader title="X" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();

    rerender(<PageHeader title="X" headingLevel={1} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("exibe a descrição apenas quando fornecida", () => {
    const { rerender } = render(<PageHeader title="X" />);
    expect(screen.queryByText("Apoio")).not.toBeInTheDocument();

    rerender(<PageHeader title="X" description="Apoio" />);
    expect(screen.getByText("Apoio")).toBeInTheDocument();
  });

  it("renderiza a área de ações quando fornecida", () => {
    render(<PageHeader title="X" actions={<button>Agir</button>} />);
    expect(screen.getByRole("button", { name: "Agir" })).toBeInTheDocument();
  });

  it("associa o titleId ao elemento do título", () => {
    render(<PageHeader title="X" titleId="cabecalho-x" />);
    expect(screen.getByRole("heading", { name: "X" })).toHaveAttribute(
      "id",
      "cabecalho-x",
    );
  });
});
