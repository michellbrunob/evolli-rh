import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PontoScreen } from "./PontoScreen";

describe("PontoScreen — abas locais 'Visão do período' / 'Verificar folhas' / 'Banco de Horas' (T063/T069)", () => {
  it("mostra 'Visão do período' por padrão, com h1 único", () => {
    render(<PontoScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();
  });

  it("expõe as três abas com role='tab' e aria-selected correto por padrão", () => {
    render(<PontoScreen />);

    const tablist = screen.getByRole("tablist", { name: "Seções de Ponto" });
    expect(tablist).toBeInTheDocument();

    const abaPeriodo = screen.getByRole("tab", { name: "Visão do período" });
    const abaVerificar = screen.getByRole("tab", { name: "Verificar folhas" });
    const abaBancoHoras = screen.getByRole("tab", { name: "Banco de Horas" });
    expect(abaPeriodo).toHaveAttribute("aria-selected", "true");
    expect(abaVerificar).toHaveAttribute("aria-selected", "false");
    expect(abaBancoHoras).toHaveAttribute("aria-selected", "false");
    expect(abaPeriodo.tagName).toBe("BUTTON");
    expect(abaVerificar.tagName).toBe("BUTTON");
    expect(abaBancoHoras.tagName).toBe("BUTTON");
  });

  it("troca para 'Banco de Horas' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PontoScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Banco de Horas" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Banco de Horas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Extrato do Banco de Horas" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Banco de Horas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "Visão do período" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("tab", { name: "Verificar folhas" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(onTituloIdChange).toHaveBeenCalledWith("banco-horas-titulo");
  });

  it("troca para 'Verificar folhas' ao clicar na aba, só por estado local (sem regressão)", () => {
    render(<PontoScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Verificar folhas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Pendências da fila de verificação",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Verificar folhas" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Visão do período" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("volta para 'Visão do período' ao clicar de novo na aba", () => {
    render(<PontoScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));
    fireEvent.click(screen.getByRole("tab", { name: "Visão do período" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();
  });

  it("o botão 'Ver fila completa' da Visão do período troca para a aba Verificar folhas", () => {
    render(<PontoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Ver fila completa" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Verificar folhas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Verificar folhas" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("informa o titleId do h1 visível via onTituloIdChange, inclusive ao trocar de aba", () => {
    const onTituloIdChange = vi.fn();
    render(<PontoScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("visao-periodo-titulo");

    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));
    expect(onTituloIdChange).toHaveBeenCalledWith("verificar-folhas-titulo");

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("verificar-folhas-titulo");
  });

  it("não referencia autenticação, sessão, CPF, dinheiro, PDF ou dado real", () => {
    render(<PontoScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));
    fireEvent.click(screen.getByRole("tab", { name: "Visão do período" }));

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
      "mfa",
      "salário",
      "salario",
      "pagamento",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
