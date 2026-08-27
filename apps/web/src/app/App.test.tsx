import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App — shell administrativo + tela Cadastros > Horários (T043)", () => {
  it("usa marcos semânticos e um único banner (a barra do shell)", () => {
    render(<App />);

    // Exatamente um banner: a barra superior do shell. A tela de domínio não
    // introduz landmark próprio, então não há segundo banner competindo.
    const banner = screen.getByRole("banner");
    expect(banner).toHaveClass("app-shell__topbar");

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("exibe a marca textual 'Evolli RH' e o rótulo do painel", () => {
    render(<App />);

    expect(screen.getAllByText("Evolli RH").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Painel Administrativo")).toBeInTheDocument();
  });

  it("tem exatamente um título de nível 1: o da tela Horários", () => {
    render(<App />);

    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent("Horários");
  });

  it("oferece um link 'pular para o conteúdo' que aponta para o <main>", () => {
    render(<App />);

    const skip = screen.getByRole("link", { name: /pular para o conteúdo/i });
    expect(skip.getAttribute("href")).toBe("#conteudo-principal");

    const alvo = document.getElementById("conteudo-principal");
    expect(alvo).not.toBeNull();
    expect(alvo).toBe(screen.getByRole("main"));
  });

  it("o <main> é rotulado pelo título da tela (aria-labelledby)", () => {
    render(<App />);

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(rotuloId).toBeTruthy();
    const rotulo = document.getElementById(rotuloId!);
    expect(rotulo?.tagName).toBe("H1");
    expect(rotulo).toHaveTextContent("Horários");
  });

  it("renderiza a tela Cadastros > Horários dentro do <main>", () => {
    render(<App />);

    const main = screen.getByRole("main");
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(main).toContainElement(screen.getByText("Somente RH"));
  });

  it("não referencia autenticação, sessão real ou dado sensível no shell", () => {
    render(<App />);

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
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
