/**
 * T209 — navegação interna de Configurações com os ícones do ecossistema
 * (Iconsax, variante Bulk): decorativos, fora do nome acessível, 18 px.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavegacaoConfiguracoes } from "./NavegacaoConfiguracoes";

describe("T209 — ícones na navegação de Configurações", () => {
  it("cada item tem o seu ícone decorativo (aria-hidden), em duas camadas", () => {
    render(<NavegacaoConfiguracoes atual="empresas" mostrarEmpresas />);
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    for (const nome of ["Meu perfil", "Empresas"]) {
      const link = within(nav).getByRole("link", { name: nome });
      const svg = link.querySelector("svg");
      expect(svg, nome).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("width", "18");
      // Bulk: uma camada de fundo com opacidade e outra cheia.
      expect(svg!.querySelector("[opacity]")).not.toBeNull();
    }
  });
});
