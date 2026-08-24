import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App — shell + vitrine de componentes (UI-F01/UI-F02)", () => {
  it("usa marcos semânticos e um único banner (a barra do shell)", () => {
    render(<App />);

    // Exatamente um banner: a barra superior do shell. O PageHeader é um <div>
    // (não landmark), então não há segundo banner competindo na página.
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

  it("tem exatamente um título de nível 1", () => {
    render(<App />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("oferece um link 'pular para o conteúdo' que aponta para o <main>", () => {
    render(<App />);

    const skip = screen.getByRole("link", { name: /pular para o conteúdo/i });
    expect(skip.getAttribute("href")).toBe("#conteudo-principal");

    const alvo = document.getElementById("conteudo-principal");
    expect(alvo).not.toBeNull();
    expect(alvo).toBe(screen.getByRole("main"));
  });

  it("o <main> é rotulado pelo título da página (aria-labelledby)", () => {
    render(<App />);

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(rotuloId).toBeTruthy();
    expect(document.getElementById(rotuloId!)?.tagName).toBe("H1");
  });

  it("demonstra os componentes com rótulos neutros", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /biblioteca de componentes/i,
      }),
    ).toBeInTheDocument();
    // Uma amostra de cada componente-chave da vitrine.
    expect(
      screen.getByRole("button", { name: "Primária" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indisponível" })).toBeDisabled();
    expect(screen.getByText("Cartão neutro")).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByText("Nada para exibir ainda")).toBeInTheDocument();
  });

  it("não referencia domínio, dados reais, login ou sessão no shell", () => {
    render(<App />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "colaborador",
      "ponto",
      "folha",
      "reserva fiscal",
      "documento",
      "relatório",
      "login",
      "senha",
      "sessão",
      "mfa",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
