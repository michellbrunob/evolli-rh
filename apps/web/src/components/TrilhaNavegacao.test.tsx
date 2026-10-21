import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrilhaNavegacao } from "./TrilhaNavegacao";

describe("TrilhaNavegacao (T178)", () => {
  it("é um nav rotulado com lista ordenada; o último item é a página atual", () => {
    render(
      <TrilhaNavegacao
        itens={[
          { rotulo: "Módulo" },
          { rotulo: "Lista", onSelecionar: () => {} },
          { rotulo: "Página" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Trilha de navegação" });
    expect(nav.querySelector("ol")).not.toBeNull();
    expect(within(nav).getAllByRole("listitem")).toHaveLength(3);
    expect(within(nav).getByText("Página")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Item sem ação é texto; o atual nunca é clicável.
    expect(within(nav).getAllByRole("button")).toHaveLength(1);
    for (const separador of nav.querySelectorAll(".evolli-trilha__separador")) {
      expect(separador).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("item intermediário com ação vira botão e chama onSelecionar", () => {
    const onSelecionar = vi.fn();
    render(
      <TrilhaNavegacao
        itens={[{ rotulo: "Lista", onSelecionar }, { rotulo: "Página" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lista" }));
    expect(onSelecionar).toHaveBeenCalledTimes(1);
  });

  it("o último item ignora onSelecionar: levaria aonde já se está", () => {
    render(
      <TrilhaNavegacao
        itens={[
          { rotulo: "Módulo" },
          { rotulo: "Atual", onSelecionar: vi.fn() },
        ]}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
