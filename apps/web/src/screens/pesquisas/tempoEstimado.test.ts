import { describe, expect, it } from "vitest";
import {
  MODELOS_DE_PESQUISA,
  ROTEIROS_PERSONALIZADOS,
} from "./modelosDePesquisa";
import { minutosDoOnboarding } from "./modelos/onboarding/envio";
import {
  minutosCurtos,
  minutosDoModelo,
  minutosEstimados,
  perguntasParaOTempo,
  tempoParaResponder,
  textoDoTempoEstimado,
} from "./tempoEstimado";

/** O código-fonte dos catálogos (o tempo nunca é escrito à mão). */
const FONTES_DOS_CATALOGOS = import.meta.glob<string>(
  "./modelos/*/catalogo.ts",
  { query: "?raw", import: "default", eager: true },
);

describe("T216 — tempo estimado (regra única)", () => {
  it("0,3 minuto por pergunta, arredondado, no mínimo 3 minutos", () => {
    expect(minutosEstimados(0)).toBe(3);
    expect(minutosEstimados(5)).toBe(3);
    expect(minutosEstimados(12)).toBe(4);
    expect(minutosEstimados(17)).toBe(5);
    expect(minutosEstimados(28)).toBe(8);
    expect(minutosEstimados(76)).toBe(23);
  });

  it("o Onboarding usa a mesma regra", () => {
    for (const n of [3, 17, 30]) {
      expect(minutosDoOnboarding(n)).toBe(minutosEstimados(n));
    }
  });

  it("o tempo escrito em cada modelo é o da regra, contado como na página pública", () => {
    const textos = (m: (typeof MODELOS_DE_PESQUISA)[number]) => {
      const pagina = m.pagina;
      return [
        m.boasVindas ?? "",
        pagina?.selo ?? "",
        ...(pagina?.metadados ?? []),
        ...(pagina?.numeros ?? []).map((n) => `${n.valor} ${n.rotulo}`),
        ...(pagina?.ficha ?? [])
          .filter(([r]) => r === "Tempo")
          .map(([, v]) => v),
      ];
    };
    const divergentes: string[] = [];
    for (const m of [...MODELOS_DE_PESQUISA, ...ROTEIROS_PERSONALIZADOS]) {
      const esperado = minutosDoModelo(m);
      for (const t of textos(m)) {
        // "por pessoa" e "por avaliação": tempo de cada avaliado, outra conta.
        if (/por (pessoa|avaliação)/.test(t)) continue;
        for (const [, n] of t.matchAll(/(\d+)(?: a \d+)? min(?:utos?)?\b/g)) {
          if (Number(n) !== esperado)
            divergentes.push(`${m.id}: "${t}" (regra: ${esperado})`);
        }
      }
    }
    expect(divergentes).toEqual([]);
  });

  it("nenhum catálogo escreve os minutos à mão (sai sempre da regra)", () => {
    const literais = Object.entries(FONTES_DOS_CATALOGOS)
      // Os modelos prontos da Personalizada guardam o tempo do card
      // (`ModeloDaGaleria.minutos`, decisão da 3ª revisão).
      .filter(([arquivo]) => !arquivo.includes("/personalizada/"))
      .flatMap(([arquivo, fonte]) =>
        fonte
          .split(/\r?\n/)
          .filter(
            (l) =>
              /\d+(?: a \d+)? min(?:utos?)?\b/.test(l) &&
              !/por (pessoa|avaliação)/.test(l),
          )
          .map((l) => `${arquivo}: ${l.trim()}`),
      );
    expect(Object.keys(FONTES_DOS_CATALOGOS).length).toBeGreaterThan(10);
    expect(literais).toEqual([]);
  });

  it("conta como a página pública: comentários por dimensão e comentário final entram", () => {
    const secoes = [
      { perguntas: [{}, {}, { chave: "__comentario_x" }] },
      { perguntas: [{}] },
    ];
    expect(perguntasParaOTempo(secoes)).toBe(4);
    expect(perguntasParaOTempo(secoes, "Algo a mais?")).toBe(5);
    expect(perguntasParaOTempo([])).toBe(0);
    const pulsoEClima = MODELOS_DE_PESQUISA.find(
      (m) => m.id === "pulso_clima",
    )!;
    // 24 perguntas e 8 comentários por dimensão + eNPS/LNPS: 34 na pública.
    expect(minutosDoModelo(pulsoEClima)).toBe(10);
    const clima = MODELOS_DE_PESQUISA.find((m) => m.id === "clima")!;
    expect(minutosDoModelo(clima)).toBe(19);
    expect(tempoParaResponder(perguntasParaOTempo(clima.secoes))).toBe(
      "Cerca de 19 minutos",
    );
    expect(tempoParaResponder(0)).toBe("Cerca de 3 minutos");
    expect(minutosCurtos(62)).toBe("19 min");
  });

  it("texto", () => {
    expect(textoDoTempoEstimado(3)).toBe("cerca de 3 minutos");
  });
});
