import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentosScreen } from "./DocumentosScreen";

describe("DocumentosScreen — abas locais 'Metadados' / 'Repositório documental' (T070)", () => {
  it("mostra 'Metadados' por padrão, com h1 único", () => {
    render(<DocumentosScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Metadados de documentos",
      }),
    ).toBeInTheDocument();
  });

  it("expõe as duas abas com role='tab' e aria-selected correto por padrão", () => {
    render(<DocumentosScreen />);

    const tablist = screen.getByRole("tablist", {
      name: "Seções de Documentos",
    });
    expect(tablist).toBeInTheDocument();

    const abaMetadados = screen.getByRole("tab", { name: "Metadados" });
    const abaRepositorio = screen.getByRole("tab", {
      name: "Repositório documental",
    });
    expect(abaMetadados).toHaveAttribute("aria-selected", "true");
    expect(abaRepositorio).toHaveAttribute("aria-selected", "false");
    expect(abaMetadados.tagName).toBe("BUTTON");
    expect(abaRepositorio.tagName).toBe("BUTTON");
  });

  it("troca para 'Repositório documental' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<DocumentosScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Repositório documental" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Repositório documental",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Catálogo de tipos documentais do repositório",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Repositório documental" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Metadados" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "repositorio-documental-titulo",
    );
  });

  it("volta para 'Metadados' ao clicar de novo na aba", () => {
    render(<DocumentosScreen />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Repositório documental" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Metadados" }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Metadados de documentos",
      }),
    ).toBeInTheDocument();
  });

  it("informa o titleId do h1 visível via onTituloIdChange, inclusive ao trocar de aba", () => {
    const onTituloIdChange = vi.fn();
    render(<DocumentosScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith(
      "documentos-metadados-titulo",
    );

    fireEvent.click(
      screen.getByRole("tab", { name: "Repositório documental" }),
    );
    expect(onTituloIdChange).toHaveBeenCalledWith(
      "repositorio-documental-titulo",
    );

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("repositorio-documental-titulo");
  });

  it("não referencia autenticação, sessão, CPF, dinheiro ou dado real em nenhuma das abas", () => {
    render(<DocumentosScreen />);
    fireEvent.click(
      screen.getByRole("tab", { name: "Repositório documental" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Metadados" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "login",
      "senha",
      "sessão",
      "salário",
      "salario",
      "pagamento",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
