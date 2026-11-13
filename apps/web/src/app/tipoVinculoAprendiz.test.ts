/**
 * T209 — Aprendiz como tipo de vínculo (fatia mínima, AP-1 a AP-9): o rótulo
 * "Aprendiz", logo depois de "Estágio", em TODAS as superfícies que exibem o
 * tipo; o valor na URL da listagem; e uma cor própria na distribuição por
 * tipo (Colaboradores e Dashboard), com contraste de objeto gráfico (3:1)
 * sobre o fundo de cada uma. Nada de prazo, idade, jornada ou cota.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TIPOS_DE_VINCULO,
  listagemDaRota,
  rotaDaListagem,
  ESTADO_INICIAL_DA_LISTAGEM,
} from "./rotasDoShell";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");

const ROTA = "#/pessoas/colaboradores";

describe("T209 — Aprendiz na URL e na ordem dos tipos", () => {
  it("a ordem dos tipos tem Aprendiz logo depois de Estágio", () => {
    expect(TIPOS_DE_VINCULO).toEqual([
      "clt",
      "estagio",
      "aprendiz",
      "pj",
      "temporario",
      "outro_controlado",
    ]);
  });

  it("tipo=aprendiz é lido e escrito na URL da listagem", () => {
    expect(listagemDaRota(`${ROTA}?tipo=aprendiz`)?.tipo).toBe("aprendiz");
    expect(
      rotaDaListagem({ ...ESTADO_INICIAL_DA_LISTAGEM, tipo: "aprendiz" }),
    ).toBe(`${ROTA}?tipo=aprendiz`);
    // Variações não são tipo controlado: caem no padrão.
    expect(listagemDaRota(`${ROTA}?tipo=Aprendiz`)?.tipo).toBeNull();
  });
});

describe("T209 — rótulo 'Aprendiz' em todas as superfícies que exibem o tipo", () => {
  it.each([
    "src/screens/pessoas/ColaboradoresScreen.tsx",
    "src/screens/pessoas/NovaAdmissaoScreen.tsx",
    "src/screens/pessoas/FichaColaboradorScreen.tsx",
    "src/screens/pessoas/DadosContratuaisScreen.tsx",
    "src/screens/pessoas/HistoricoFuncionalScreen.tsx",
    "src/screens/pessoas/RegistrosPontoColaboradorSecao.tsx",
    "src/screens/pessoas/SolicitacoesColaboradorSecao.tsx",
    "src/screens/dashboard/DashboardScreen.tsx",
    "src/screens/equipe/EquipeScreen.tsx",
  ])("%s: 'Aprendiz' logo depois de 'Estágio'", (arquivo) => {
    expect(ler(arquivo)).toMatch(
      /estagio: "Estágio",\n(\s*\/\/[^\n]*\n)*\s*aprendiz: "Aprendiz",/,
    );
  });

  it("o cliente da API conhece o tipo", () => {
    expect(ler("src/api/colaboradoresClient.ts")).toMatch(
      /export type TipoVinculo =[^;]*"aprendiz"[^;]*;/,
    );
  });
});

/** Luminância relativa (WCAG 2) de um hexadecimal `#rrggbb`. */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe("T209 — cor própria e acessível de Aprendiz na distribuição", () => {
  const tokens = ler("src/app/tokens.css");
  const token = (nome: string) => {
    const achado = new RegExp(`--${nome}: (#[0-9a-fA-F]{6});`).exec(tokens);
    if (!achado) throw new Error(`token ${nome} sem hexadecimal`);
    return achado[1]!;
  };

  it("o token existe e tem contraste de objeto gráfico (3:1) sobre os fundos", () => {
    const cor = token("cor-tipo-aprendiz");
    expect(contraste(cor, token("surface-canvas"))).toBeGreaterThanOrEqual(3);
    expect(contraste(cor, token("evolli-fundo"))).toBeGreaterThanOrEqual(3);
    // Distinta das cores dos outros tipos (nenhum tipo repete cor).
    for (const outra of [
      "color-action",
      "status-success-ink",
      "status-warning-ink",
      "color-ink-subtle",
      "evolli-azul",
      "evolli-verde-agua-escuro",
      "evolli-marinho",
      "evolli-ardosia",
    ]) {
      expect(cor.toLowerCase()).not.toBe(token(outra).toLowerCase());
    }
  });

  it("Colaboradores e Dashboard pintam Aprendiz com o token próprio", () => {
    expect(ler("src/screens/pessoas/ColaboradoresScreen.css")).toMatch(
      /\.colaboradores-screen__barra-tipo--aprendiz \{[^}]*background: var\(--cor-tipo-aprendiz\);/,
    );
    expect(ler("src/screens/dashboard/DashboardScreen.css")).toMatch(
      /\.dashboard__barra-tipo--aprendiz \{[^}]*background: var\(--cor-tipo-aprendiz\);/,
    );
  });
});
