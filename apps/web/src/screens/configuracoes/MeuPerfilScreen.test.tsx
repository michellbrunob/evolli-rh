/**
 * T208 — Configurações › Meu perfil: só leitura, só os quatro campos aprovados
 * (MP-4), nenhum dado proibido, nenhum controle de edição, navegação interna
 * com um item só e o layout que não vaza rolagem horizontal a 375 px.
 */
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROTULO_PAPEL } from "../../api/usersClient";
import {
  CONFIGURACOES_TITULO_ID,
  MeuPerfilScreen,
  type ContaDoMeuPerfil,
} from "./MeuPerfilScreen";

const EMPRESA = {
  id: "empresa-sintetica-id-interno",
  codigo: "ALFA",
  nome: "Empresa Alfa",
};
const CONTA: ContaDoMeuPerfil = {
  email: "pessoa.teste@example.test",
  role: "rh",
  createdAt: "2026-03-15T12:00:00.000Z",
  empresaAtiva: EMPRESA,
};

const painel = () => screen.getByRole("region", { name: "Meu perfil" });

/** Pares rótulo → valor da lista de dados, na ordem da tela. */
function dados(): [string, string][] {
  return [...painel().querySelectorAll(".configuracoes__dado")].map((par) => [
    par.querySelector("dt")!.textContent ?? "",
    par.querySelector("dd")!.textContent ?? "",
  ]);
}

describe("T208 — o que Meu perfil mostra", () => {
  it("exatamente e-mail, papel, empresa ativa e data de criação, nessa ordem", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    expect(dados()).toEqual([
      ["E-mail de acesso", "pessoa.teste@example.test"],
      ["Papel", "RH"],
      ["Empresa ativa", "Empresa Alfa (ALFA)"],
      ["Conta criada em", "15/03/2026"],
    ]);
    const data = painel().querySelector("time")!;
    expect(data).toHaveAttribute("dateTime", "2026-03-15T12:00:00.000Z");
  });

  it("sem empresa ativa (escopo global), diz isso — não inventa empresa", () => {
    render(
      <MeuPerfilScreen
        conta={{ ...CONTA, role: "master_tecnico", empresaAtiva: null }}
      />,
    );
    expect(dados()[1]).toEqual(["Papel", "Master técnico"]);
    expect(dados()[2]).toEqual(["Empresa ativa", "Nenhuma empresa ativa"]);
  });

  it.each(Object.entries(ROTULO_PAPEL))(
    "papel %s aparece pelo rótulo (%s), nunca pelo código",
    (papel, rotulo) => {
      render(<MeuPerfilScreen conta={{ ...CONTA, role: papel }} />);
      expect(dados()[1]).toEqual(["Papel", rotulo]);
    },
  );

  it("sem conta (shell montado sem ator), cada valor é '—'", () => {
    render(<MeuPerfilScreen conta={null} />);
    expect(dados().map(([, valor]) => valor)).toEqual(["—", "—", "—", "—"]);
  });

  it("título único de página, trilha Configurações › Meu perfil", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent("Configurações");
    expect(titulos[0]).toHaveAttribute("id", CONFIGURACOES_TITULO_ID);
    const trilha = screen.getByRole("navigation", {
      name: "Trilha de navegação",
    });
    expect(
      within(trilha)
        .getAllByRole("listitem")
        .map((li) => li.textContent?.replace("›", "").trim()),
    ).toEqual(["Configurações", "Meu perfil"]);
    expect(within(trilha).getByText("Meu perfil")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("navegação interna só com Meu perfil, no grupo Sua conta — nenhum item sem tela", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    const interna = screen.getByRole("navigation", { name: "Configurações" });
    const lista = within(interna).getByRole("list", { name: "Sua conta" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1);
    expect(interna.textContent).not.toMatch(
      /Segurança|Empresas|Equipe|Permiss|Sessões/,
    );
  });
});

describe("T208 — o que Meu perfil NÃO mostra nem oferece", () => {
  it("nenhum identificador interno, documento, contato, foto, idioma ou preferência", () => {
    render(
      <MeuPerfilScreen
        conta={
          {
            ...CONTA,
            // Campos que o ator real também traz: não podem vazar.
            id: "conta-id-interno",
            companyId: "empresa-sintetica-id-interno",
            unitId: "unidade-id-interna",
            teamId: "equipe-id-interna",
            status: "active",
          } as ContaDoMeuPerfil
        }
      />,
    );
    const texto = document.body.textContent ?? "";
    for (const proibido of [
      "conta-id-interno",
      "empresa-sintetica-id-interno",
      "unidade-id-interna",
      "equipe-id-interna",
      "active",
      "Ativa",
    ]) {
      expect(texto).not.toContain(proibido);
    }
    expect(texto).not.toMatch(
      /CPF|CNPJ|Telefone|Celular|Foto|Idioma|Fuso|Preferênc|Situação|Unidade|Endereço|Nome completo/i,
    );
  });

  it("nenhum campo, botão ou controle de edição; a indisponibilidade é dita em texto", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelectorAll("input, select, textarea")).toHaveLength(
      0,
    );
    expect(
      document.querySelectorAll("[disabled], [aria-disabled]"),
    ).toHaveLength(0);
    expect(painel()).toHaveTextContent(
      "A edição destes dados ainda não está disponível.",
    );
  });
});

describe("T208 — layout a 375 px (CSS)", () => {
  const css = readFileSync(
    "src/screens/configuracoes/MeuPerfilScreen.css",
    "utf8",
  );
  const regra = (seletor: string) => {
    const inicio = css.indexOf(`\n${seletor} {`);
    if (inicio < 0) return "";
    return css.slice(inicio, css.indexOf("}", inicio));
  };

  it("uma coluna que encolhe por padrão; duas só a partir de 720 px", () => {
    expect(regra(".configuracoes__corpo")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 720px\) \{\s*\.configuracoes__corpo \{\s*grid-template-columns: minmax\(0, 13rem\) minmax\(0, 1fr\);/,
    );
    expect(regra(".configuracoes")).toMatch(/min-width:\s*0/);
    expect(regra(".configuracoes__painel")).toMatch(/min-width:\s*0/);
  });

  it("e-mail e empresa longos quebram dentro da caixa", () => {
    expect(regra(".configuracoes__dado dd")).toMatch(
      /overflow-wrap:\s*anywhere/,
    );
    expect(regra(".configuracoes__dado dd")).toMatch(/min-width:\s*0/);
  });

  it("o item da navegação interna tem alvo de 44 px e foco visível", () => {
    expect(regra(".configuracoes__item")).toMatch(/min-height:\s*44px/);
    expect(regra(".configuracoes__item:focus-visible")).toMatch(/outline:/);
  });

  it("sem posição fixa nem largura mínima que force rolagem", () => {
    expect(css).not.toMatch(/position:\s*fixed/);
    // Declarações de propriedade (não a consulta de mídia de 720 px).
    expect(css).not.toMatch(/^\s+min-width:\s*[1-9]/m);
    expect(css).not.toMatch(/^\s+(min-)?width:\s*\d{3,}px/m);
  });
});
