import { describe, expect, it } from "vitest";
import {
  SECOES_DA_EDICAO,
  destinoDaRota,
  fichaDaRota,
  rotaDaFicha,
} from "./rotasDoShell";
import { fichaParaOPapel } from "./mapaNavegacao";

/**
 * T215 — a página "Editar colaborador" mora dentro de Colaboradores, com a
 * seção na URL: `#/pessoas/colaboradores/:id/editar/:secao`.
 */
const ID = "8f0c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01";
const BASE = `#/pessoas/colaboradores/${ID}/editar`;

describe("T215 — rota da edição do colaborador", () => {
  it("as 8 seções, na ordem do menu lateral", () => {
    expect(SECOES_DA_EDICAO).toEqual([
      "dados-basicos",
      "dados-profissionais",
      "endereco",
      "dependentes",
      "documentos",
      "dados-bancarios",
      "formacao-academica",
      "campos-extras",
    ]);
  });

  it("sem seção, abre Dados básicos", () => {
    expect(fichaDaRota(BASE)).toEqual({
      colaboradorId: ID,
      aba: "dados",
      edicao: "dados-basicos",
    });
  });

  it.each(SECOES_DA_EDICAO)("seção %s, de ida e volta", (secao) => {
    const rota = `${BASE}/${secao}`;
    const ficha = fichaDaRota(rota);
    expect(ficha).toEqual({ colaboradorId: ID, aba: "dados", edicao: secao });
    expect(rotaDaFicha(ficha!)).toBe(rota);
    expect(destinoDaRota(rota)).toBe("pessoas");
  });

  it("seção desconhecida ou segmento a mais não é rota", () => {
    expect(fichaDaRota(`${BASE}/salario`)).toBeNull();
    expect(fichaDaRota(`${BASE}/endereco/extra`)).toBeNull();
    expect(fichaDaRota(`#/pessoas/colaboradores/nao-e-uuid/editar`)).toBeNull();
  });

  it("a ficha de sempre continua sem edição", () => {
    expect(fichaDaRota(`#/pessoas/colaboradores/${ID}/documentos`)).toEqual({
      colaboradorId: ID,
      aba: "documentos",
    });
  });

  it.each([
    ["rh", true],
    ["dp", true],
    ["master_tecnico", false],
    ["gestor", false],
  ])("%s edita: %s (quem não edita cai na ficha, em Dados)", (papel, edita) => {
    const pedida = fichaDaRota(`${BASE}/endereco`)!;
    const resolvida = fichaParaOPapel(pedida, papel);
    if (edita) expect(resolvida).toEqual(pedida);
    else expect(resolvida).toEqual({ colaboradorId: ID, aba: "dados" });
  });
});
