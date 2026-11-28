import { describe, expect, it } from "vitest";
import {
  MODELOS_DE_PESQUISA,
  ROTEIROS_PERSONALIZADOS,
  totalDePerguntas,
} from "./modelosDePesquisa";
import { minutosDoOnboarding } from "./modelos/onboarding/envio";
import { minutosEstimados, textoDoTempoEstimado } from "./tempoEstimado";

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

  it("o tempo escrito em cada modelo é o da regra", () => {
    const textos = (m: (typeof MODELOS_DE_PESQUISA)[number]) => {
      const pagina = (m as { pagina?: unknown }).pagina as
        | {
            metadados?: readonly string[];
            ficha?: readonly (readonly [string, string])[];
          }
        | undefined;
      return [
        m.boasVindas ?? "",
        ...(pagina?.metadados ?? []),
        ...(pagina?.ficha ?? [])
          .filter(([r]) => r === "Tempo")
          .map(([, v]) => v),
      ];
    };
    const divergentes: string[] = [];
    for (const m of [...MODELOS_DE_PESQUISA, ...ROTEIROS_PERSONALIZADOS]) {
      const esperado = minutosEstimados(totalDePerguntas(m));
      for (const t of textos(m)) {
        // "por pessoa" e "por avaliação": tempo de cada avaliado, outra conta.
        if (/por (pessoa|avaliação)/.test(t)) continue;
        for (const [, n] of t.matchAll(/(\d+)(?: a \d+)? minutos?/g)) {
          if (Number(n) !== esperado)
            divergentes.push(`${m.id}: "${t}" (regra: ${esperado})`);
        }
      }
    }
    expect(divergentes).toEqual([]);
  });

  it("texto", () => {
    expect(textoDoTempoEstimado(3)).toBe("cerca de 3 minutos");
  });
});
