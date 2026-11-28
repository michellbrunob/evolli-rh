import { describe, expect, it } from "vitest";
import { lerAbasXlsx } from "../../../pessoas/importacao/planilhaXlsx";
import {
  frasesEmbaralhadas,
  montarRespostas,
} from "../../../publico/regrasDaPesquisa";
import { DETALHE } from "../../dadosDeTeste";
import { secoesDoModelo } from "../../modelosDePesquisa";
import { AREAS, PARES } from "./areas";
import { BLOCOS_DISC } from "./blocos";
import { MODELO_DISC } from "./definicao";
import { planilhaDisc } from "./exportarDisc";
import { FATOR, FATORES } from "./fatores";
import { perfilDasEscolhas } from "./perfilLocal";
import { COMBINACOES, conteudoDoPerfil, tituloDoPerfil } from "./perfis";
import { resultadoDeTeste } from "./resultadoDeTeste";

/** T216 — Perfil comportamental (DISC): catálogo, regras e planilha. */

describe("T216 — DISC: catálogo", () => {
  it("28 blocos de 4 frases distintas, na ordem D, I, S, C", () => {
    expect(BLOCOS_DISC).toHaveLength(28);
    const todas = BLOCOS_DISC.flatMap((b) => b.frases);
    expect(new Set(todas).size).toBe(112);
    expect(new Set(BLOCOS_DISC.map((b) => b.tema)).size).toBe(28);
    for (const b of BLOCOS_DISC) {
      expect(b.tema.length).toBeLessThanOrEqual(40);
      for (const f of b.frases) expect(f.length).toBeLessThanOrEqual(200);
    }
  });

  it("vira 28 blocos obrigatórios com o fator de cada frase", () => {
    const secoes = secoesDoModelo(MODELO_DISC);
    const perguntas = secoes.flatMap((s) => s.perguntas);
    expect(perguntas).toHaveLength(28);
    for (const p of perguntas) {
      expect(p).toMatchObject({
        tipo: "escolha_forcada",
        obrigatoria: true,
        condicao: null,
      });
      expect(p.config.opcoes!.map((o) => o.fator)).toEqual([
        "D",
        "I",
        "S",
        "C",
      ]);
      expect(p.config).not.toHaveProperty("outro");
    }
    expect(perguntas[0]!.rotulo).toBe(BLOCOS_DISC[0]!.tema);
    expect(MODELO_DISC).toMatchObject({
      id: "disc",
      modelo: "disc",
      comentarioFinal: null,
      limite: 28,
    });
  });

  it("as 13 áreas cobrem o mapa e os 10 pares têm texto", () => {
    expect(AREAS).toHaveLength(13);
    let area = 0;
    for (const a of AREAS) area += (a.x[1] - a.x[0]) * (a.y[1] - a.y[0]);
    expect(area).toBe(100 * 100);
    expect(Object.keys(PARES)).toHaveLength(10);
    expect(Object.keys(COMBINACOES)).toHaveLength(12);
  });
});

describe("T216 — DISC: resposta e resultado no navegador", () => {
  const secoes = secoesDoModelo(MODELO_DISC);
  const perguntas = secoes.flatMap((s) => s.perguntas);
  const escolher = (fatores: string) =>
    Object.fromEntries(
      [...fatores].map((f, i) => [
        perguntas[i]!.id,
        perguntas[i]!.config.opcoes!.find((o) => o.fator === f)!.id,
      ]),
    );

  it("perfil local: percentuais, predominante e empate D, I, S, C", () => {
    const r = perfilDasEscolhas(
      secoes,
      escolher(`${"I".repeat(17)}${"D".repeat(6)}SSSCC`),
    )!;
    expect(r.percentuais).toEqual({ D: 21, I: 61, S: 11, C: 7 });
    expect(r.predominante).toBe("I");
    expect(r.total).toBe(28);
    const empate = perfilDasEscolhas(
      secoes,
      escolher(`${"C".repeat(14)}${"D".repeat(14)}`),
    )!;
    expect(empate.predominante).toBe("D");
    expect(empate.percentuais).toEqual({ D: 50, I: 0, S: 0, C: 50 });
    expect(perfilDasEscolhas(secoes, {})).toBeNull();
    // Sobre os blocos respondidos.
    expect(perfilDasEscolhas(secoes, escolher("SS"))!.percentuais.S).toBe(100);
  });

  it("envio: o bloco vai como { opcao }", () => {
    const escolhas = escolher("DI");
    expect(montarRespostas(secoes, escolhas)).toEqual([
      {
        perguntaId: perguntas[0]!.id,
        valor: { opcao: escolhas[perguntas[0]!.id] },
      },
      {
        perguntaId: perguntas[1]!.id,
        valor: { opcao: escolhas[perguntas[1]!.id] },
      },
    ]);
  });

  it("frases embaralhadas: a mesma ordem a cada vez e diferente entre blocos", () => {
    const frases = ["D", "I", "S", "C"];
    const a = frasesEmbaralhadas("bloco-1", frases);
    expect(frasesEmbaralhadas("bloco-1", frases)).toEqual(a);
    expect([...a].sort()).toEqual([...frases].sort());
    const ordens = new Set(
      Array.from({ length: 28 }, (_, i) =>
        frasesEmbaralhadas(`bloco-${i}`, frases).join(""),
      ),
    );
    expect(ordens.size).toBeGreaterThan(4);
    expect(frases).toEqual(["D", "I", "S", "C"]);
  });
});

describe("T216 — DISC: nome e conteúdo do perfil", () => {
  it("mono, bi e tri", () => {
    expect(
      tituloDoPerfil({
        tipo: "mono",
        fatores: ["I"],
        codigo: "I",
        intensidade: "puro",
      }),
    ).toBe("Influência pura");
    expect(
      tituloDoPerfil({
        tipo: "mono",
        fatores: ["C"],
        codigo: "C",
        intensidade: "moderado",
      }),
    ).toBe("Conformidade moderada");
    expect(
      tituloDoPerfil({
        tipo: "bi",
        fatores: ["D", "C"],
        codigo: "DC",
        intensidade: "acentuado",
      }),
    ).toBe("Estrategista");
    expect(
      tituloDoPerfil({
        tipo: "tri",
        fatores: ["D", "C", "S"],
        codigo: "DCS",
        intensidade: "equilibrado",
      }),
    ).toBe("Perfil equilibrado");
  });

  it("bi junta o principal e o secundário; tri usa o principal", () => {
    const bi = conteudoDoPerfil({
      tipo: "bi",
      fatores: ["I", "S"],
      codigo: "IS",
      intensidade: "moderado",
    });
    expect(bi.resumo).toBe(COMBINACOES.IS!.resumo);
    expect(bi.fortes.slice(0, 4)).toEqual(FATOR.I.fortes.slice(0, 4));
    expect(bi.fortes).toContain(FATOR.S.fortes[0]);
    expect(bi.principal).toBe("I");
    const tri = conteudoDoPerfil({
      tipo: "tri",
      fatores: ["S", "C", "D"],
      codigo: "SCD",
      intensidade: "equilibrado",
    });
    expect(tri.resumo).toBe(FATOR.S.resumo);
    expect(tri.fortes).toEqual(FATOR.S.fortes);
  });
});

describe("T216 — DISC: planilha", () => {
  it("7 abas; pessoas numeradas na anônima; glossário dos 4 fatores", async () => {
    const abas = await lerAbasXlsx(
      planilhaDisc(
        {
          ...DETALHE,
          modelo: "disc",
          identificacao: "anonima",
          nome: "DISC teste",
        },
        resultadoDeTeste(),
        "Empresa Sintética",
        "2026-11-27",
      ),
    );
    expect(Object.keys(abas)).toEqual([
      "Resumo",
      "Participantes",
      "Análise do perfil",
      "Plano de ação",
      "Compatibilidade",
      "Diversidade do time",
      "Glossário DISC",
    ]);
    expect(abas.Resumo![0]![0]).toBe("DISC — DISC teste");
    expect(abas.Resumo![1]![0]).toContain("Empresa: Empresa Sintética");
    expect(abas.Resumo![3]!.slice(0, 2)).toEqual(["D", "Dominância"]);
    expect(abas.Resumo!.flat()).toContain("Perfil equilibrado (D/C/S)");
    expect(abas.Participantes!.slice(3).map((l) => l[0])).toEqual([
      "Resposta 1",
      "Resposta 2",
      "Resposta 3",
    ]);
    expect(abas.Participantes![3]!.slice(1, 6)).toEqual([
      "I",
      "21",
      "61",
      "11",
      "7",
    ]);
    expect(abas["Diversidade do time"]![2]).toEqual(["Score (0 a 100)", "79"]);
    expect(abas["Diversidade do time"]![3]![1]).toBe("Equilibrado");
    expect(abas["Glossário DISC"]!.slice(3).map((l) => l[0])).toEqual(
      FATORES.map((f) => `${FATOR[f].nome} (${f})`),
    );
    expect(abas.Compatibilidade![0]![0]).toBe("Compatibilidade — Dominância");
    expect(abas["Plano de ação"]!.slice(3).map((l) => l[0])).toEqual([
      "Onde brilha",
      "Tenha cuidado",
      "Como dar retorno",
      "Como motivar",
      "Plano de 30, 60 e 90 dias",
    ]);
  });

  it("confidencial: nenhuma pessoa na aba Participantes", async () => {
    const abas = await lerAbasXlsx(
      planilhaDisc(
        { ...DETALHE, modelo: "disc", identificacao: "confidencial" },
        { ...resultadoDeTeste(), pessoas: [] },
        "",
        "2026-11-27",
      ),
    );
    expect(abas.Participantes![3]).toEqual([
      "Pesquisa confidencial: os perfis aparecem só agrupados.",
    ]);
    expect(abas.Participantes).toHaveLength(4);
  });
});
