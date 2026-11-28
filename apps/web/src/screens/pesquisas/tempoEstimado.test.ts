import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MODELOS_DE_PESQUISA,
  ROTEIROS_PERSONALIZADOS,
} from "./modelosDePesquisa";
import { minutosDoOnboarding } from "./modelos/onboarding/envio";
import {
  MINUTOS_POR_MODELO,
  minutosCurtos,
  minutosDaPesquisa,
  minutosDoModelo,
  minutosEstimados,
  perguntasParaOTempo,
  tempoNoTexto,
  tempoParaResponder,
  textoDoTempoEstimado,
} from "./tempoEstimado";

/** O mapa da API (`regras-pesquisa.ts`), lido do código-fonte. */
function mapaDaApi(): Record<string, number> {
  const fonte = readFileSync(
    join(__dirname, "../../../../api/src/pesquisas/regras-pesquisa.ts"),
    "utf8",
  );
  const corpo = /MINUTOS_POR_MODELO[^=]*=\s*\{([^}]*)\}/.exec(fonte)?.[1] ?? "";
  return Object.fromEntries(
    [...corpo.matchAll(/(\w+):\s*(\d+)/g)].map(([, k, v]) => [k, Number(v)]),
  );
}

const modelo = (id: string) => MODELOS_DE_PESQUISA.find((m) => m.id === id)!;

/** O código-fonte dos catálogos (o tempo nunca é escrito à mão). */
const FONTES_DOS_CATALOGOS = import.meta.glob<string>(
  "./modelos/*/catalogo.ts",
  { query: "?raw", import: "default", eager: true },
);

describe("T216 — tempo estimado (mapa por modelo e regra)", () => {
  it("0,3 minuto por pergunta, arredondado, no mínimo 3 minutos", () => {
    expect(minutosEstimados(0)).toBe(3);
    expect(minutosEstimados(5)).toBe(3);
    expect(minutosEstimados(12)).toBe(4);
    expect(minutosEstimados(17)).toBe(5);
    expect(minutosEstimados(28)).toBe(8);
    expect(minutosEstimados(76)).toBe(23);
  });

  it("o mapa único de minutos por modelo (decisão da proprietária)", () => {
    expect(MINUTOS_POR_MODELO).toEqual({
      pulso: 2,
      clima: 15,
      copsoq: 15,
      disc: 8,
      isfb: 6,
      onboarding: 5,
    });
  });

  it("o mapa da tela é o espelho exato do mapa da API", () => {
    const api = mapaDaApi();
    expect(Object.keys(api).length).toBeGreaterThan(0);
    expect(api).toEqual(MINUTOS_POR_MODELO);
  });

  it("modelo do mapa: o número dele, com perguntas acrescentadas ou tiradas", () => {
    expect(minutosDaPesquisa("pulso", 5)).toBe(2);
    expect(minutosDaPesquisa("pulso", 30)).toBe(2);
    expect(minutosDaPesquisa("clima", 10)).toBe(15);
    expect(minutosDaPesquisa("copsoq", 76)).toBe(15);
    expect(minutosDaPesquisa("disc", 28)).toBe(8);
    expect(minutosDaPesquisa("isfb", 18)).toBe(6);
    expect(minutosDaPesquisa("onboarding", 3)).toBe(5);
  });

  it("os demais modelos (e sem modelo) seguem a regra", () => {
    expect(minutosDaPesquisa("enps", 30)).toBe(9);
    expect(minutosDaPesquisa("pulso_clima", 34)).toBe(10);
    expect(minutosDaPesquisa("tad", 21)).toBe(6);
    expect(minutosDaPesquisa("personalizada", 76)).toBe(23);
    expect(minutosDaPesquisa(undefined, 12)).toBe(4);
    expect(minutosDaPesquisa(null, 0)).toBe(3);
  });

  it("o Onboarding usa os minutos do mapa (e-mails e textos)", () => {
    for (const n of [3, 17, 30]) {
      expect(minutosDoOnboarding(n)).toBe(5);
    }
  });

  it("os modelos da galeria: os do mapa com o número dele, os outros pela regra", () => {
    expect(
      ["pulso", "clima", "copsoq", "disc", "isfb", "onboarding"].map((id) =>
        minutosDoModelo(modelo(id)),
      ),
    ).toEqual([2, 15, 15, 8, 6, 5]);
    expect(minutosDoModelo(modelo("pulso_clima"))).toBe(10);
    expect(minutosDoModelo(modelo("enps"))).toBe(
      minutosEstimados(perguntasParaOTempo(modelo("enps").secoes)),
    );
  });

  it("o tempo escrito em cada modelo é o do mapa ou o da regra, contado como na página pública", () => {
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

  it("nenhum catálogo escreve os minutos à mão (saem do mapa ou da regra)", () => {
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
    expect(tempoParaResponder("enps", 62)).toBe("Cerca de 19 minutos");
    expect(tempoParaResponder("enps", 0)).toBe("Cerca de 3 minutos");
    expect(minutosCurtos("enps", 62)).toBe("19 min");
    expect(tempoNoTexto("tad", 21)).toBe("cerca de 6 minutos");
  });

  it("os textos do catálogo usam o número do mapa", () => {
    const clima = modelo("clima");
    expect(tempoParaResponder("clima", perguntasParaOTempo(clima.secoes))).toBe(
      "Cerca de 15 minutos",
    );
    expect(minutosCurtos("isfb", 18)).toBe("6 min");
    expect(tempoNoTexto("pulso", 7)).toBe("cerca de 2 minutos");
    expect(clima.pagina?.numeros?.[3]?.valor ?? "").toBe("15 min");
    expect(modelo("isfb").pagina?.selo).toBe("6 min");
  });

  it("texto", () => {
    expect(textoDoTempoEstimado(3)).toBe("cerca de 3 minutos");
  });
});
