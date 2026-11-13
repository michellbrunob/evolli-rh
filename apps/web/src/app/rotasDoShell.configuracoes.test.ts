/**
 * T208 — a rota de Configurações › Meu perfil: canônica, atalho do módulo,
 * caminhos sem tela e a volta depois de uma troca de empresa.
 */
import { describe, expect, it } from "vitest";
import {
  destinoAposTrocaDeEmpresa,
  destinoDaRota,
  ehFragmentoDeRota,
  rotaDoDestino,
} from "./rotasDoShell";

describe("T208 — rota de Configurações", () => {
  it("o destino tem rota própria, em Meu perfil", () => {
    expect(rotaDoDestino("configuracoes")).toBe("#/configuracoes/meu-perfil");
    expect(destinoDaRota("#/configuracoes/meu-perfil")).toBe("configuracoes");
  });

  it("o atalho do módulo leva ao único submódulo com tela", () => {
    expect(destinoDaRota("#/configuracoes")).toBe("configuracoes");
  });

  it.each([
    "#/configuracoes/",
    "#/configuracoes/seguranca",
    "#/configuracoes/empresas",
    "#/configuracoes/equipe-e-permissoes",
    "#/configuracoes/meu-perfil/editar",
    "#/configuracoesx",
    "#/configuracoes?aba=meu-perfil",
  ])("%s não é rota: não há tela atrás dele", (fragmento) => {
    expect(destinoDaRota(fragmento)).toBeNull();
    expect(ehFragmentoDeRota(fragmento)).toBe(true);
  });

  it("trocar de empresa em Configurações volta a Configurações", () => {
    expect(destinoAposTrocaDeEmpresa("configuracoes")).toBe("configuracoes");
  });
});
