import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PontoDoStatus,
  StatusBadge,
  classesDoStatus,
  type StatusVariant,
} from "./StatusBadge";

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

  it("cada variante mostra um ponto colorido decorativo, sem símbolo (padrão do sistema)", () => {
    const variantes: StatusVariant[] = [
      "neutral",
      "success",
      "warning",
      "danger",
      "info",
    ];
    for (const variante of variantes) {
      const { container, unmount } = render(
        <StatusBadge variant={variante}>Rótulo</StatusBadge>,
      );
      const ponto = container.querySelector(".evolli-badge__ponto");
      expect(ponto).not.toBeNull();
      expect(ponto).toHaveAttribute("aria-hidden", "true");
      // Só o ponto: nenhum ✓, ×, ! ou i ao lado do rótulo.
      expect(ponto?.textContent).toBe("");
      expect(container.querySelector(".evolli-badge")?.textContent).toBe(
        "Rótulo",
      );
      unmount();
    }
  });

  it("aceita uma classe extra só de posição, sem perder a da variante", () => {
    const { container } = render(
      <StatusBadge variant="info" className="tela__posicao">
        Programada
      </StatusBadge>,
    );
    const selo = container.querySelector(".evolli-badge");
    expect(selo).toHaveClass("evolli-badge--info", "tela__posicao");
  });

  it("expõe as classes e o ponto para quando o elemento precisa ser outro (ex.: botão de menu)", () => {
    expect(classesDoStatus("danger")).toBe("evolli-badge evolli-badge--danger");
    expect(classesDoStatus()).toBe("evolli-badge evolli-badge--neutral");
    const { container } = render(
      <button type="button" className={classesDoStatus("success")}>
        <PontoDoStatus />
        Ativo
      </button>,
    );
    const ponto = container.querySelector(".evolli-badge__ponto");
    expect(ponto).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Ativo" })).toHaveClass(
      "evolli-badge--success",
    );
  });
});
