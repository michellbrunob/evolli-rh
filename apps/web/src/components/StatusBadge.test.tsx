import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge, type StatusVariant } from "./StatusBadge";

describe("StatusBadge (UI-F02)", () => {
  it("exibe o rótulo textual visível (não depende só da cor)", () => {
    render(<StatusBadge variant="success">Concluído</StatusBadge>);
    expect(screen.getByText("Concluído")).toBeInTheDocument();
  });

  it("aplica a classe da variante (neutral por padrão)", () => {
    const { container, rerender } = render(<StatusBadge>Neutro</StatusBadge>);
    expect(container.querySelector(".evolli-badge")).toHaveClass(
      "evolli-badge--neutral",
    );

    rerender(<StatusBadge variant="danger">Falha</StatusBadge>);
    expect(container.querySelector(".evolli-badge")).toHaveClass(
      "evolli-badge--danger",
    );
  });

  it("cada variante acrescenta um glifo de forma distinta, marcado como decorativo", () => {
    const variantes: StatusVariant[] = [
      "neutral",
      "success",
      "warning",
      "danger",
      "info",
    ];
    const glifos = new Set<string>();

    for (const variante of variantes) {
      const { container, unmount } = render(
        <StatusBadge variant={variante}>Rótulo</StatusBadge>,
      );
      const glyph = container.querySelector(".evolli-badge__glyph");
      expect(glyph).not.toBeNull();
      expect(glyph).toHaveAttribute("aria-hidden", "true");
      // O rótulo textual permanece legível (fora do elemento decorativo).
      expect(screen.getByText("Rótulo")).toBeInTheDocument();
      glifos.add(glyph?.textContent ?? "");
      unmount();
    }

    // Glifos distintos entre as cinco variantes → forma comunica o estado.
    expect(glifos.size).toBe(variantes.length);
  });
});
