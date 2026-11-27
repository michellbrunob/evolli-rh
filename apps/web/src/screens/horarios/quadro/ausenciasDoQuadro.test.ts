import { describe, expect, it } from "vitest";
import type { AusenciaNoQuadroApi } from "../../../api/escalaClient";
import {
  ausenciaDoDia,
  diasComAusencia,
  idsComAusencia,
  resumoDasAusencias,
  rotuloDaAusencia,
  siglaDaAusencia,
  tituloDaAusencia,
} from "./ausenciasDoQuadro";
import { pessoa } from "./fixturasDoQuadro";

const aus = (
  extra: Partial<AusenciaNoQuadroApi> = {},
): AusenciaNoQuadroApi => ({
  id: "a1",
  tipo: "falta_justificada",
  motivoAfastamento: null,
  inicio: "2026-11-19",
  fim: "2026-11-19",
  ...extra,
});

describe("T215 — ausências no quadro", () => {
  it("o dia da ausência: dentro do intervalo, ou desde o início quando não tem volta", () => {
    const p = pessoa("Ana", {
      ausencias: [
        aus({
          id: "f",
          tipo: "ferias",
          inicio: "2026-11-10",
          fim: "2026-11-12",
        }),
        aus({
          id: "af",
          tipo: "afastamento",
          motivoAfastamento: "auxilio_doenca",
          inicio: "2026-11-20",
          fim: null,
        }),
      ],
    });
    expect(ausenciaDoDia(p, "2026-11-09")).toBeNull();
    expect(ausenciaDoDia(p, "2026-11-10")?.id).toBe("f");
    expect(ausenciaDoDia(p, "2026-11-12")?.id).toBe("f");
    expect(ausenciaDoDia(p, "2026-11-13")).toBeNull();
    expect(ausenciaDoDia(p, "2026-11-20")?.id).toBe("af");
    expect(ausenciaDoDia(p, "2027-01-30")?.id).toBe("af");
    // Sem a lista (dados antigos): nenhuma.
    expect(ausenciaDoDia(pessoa("Bia"), "2026-11-10")).toBeNull();
  });

  it("rótulo, sigla e título (dica do mês)", () => {
    expect(rotuloDaAusencia(aus())).toBe("Falta justificada");
    expect(rotuloDaAusencia(aus({ tipo: "ferias" }))).toBe("Férias");
    expect(siglaDaAusencia(aus())).toBe("F");
    expect(siglaDaAusencia(aus({ tipo: "ferias" }))).toBe("F");
    expect(siglaDaAusencia(aus({ tipo: "licenca_medica" }))).toBe("L");
    expect(siglaDaAusencia(aus({ tipo: "afastamento" }))).toBe("A");
    expect(siglaDaAusencia(aus({ tipo: "day_off" }))).toBe("O");
    expect(tituloDaAusencia(aus())).toBe("Falta justificada de 19/11 a 19/11");
    expect(tituloDaAusencia(aus({ tipo: "afastamento", fim: null }))).toBe(
      "Afastamento desde 19/11, sem data de volta",
    );
  });

  it("no período: quem tem ausência, os dias e o resumo da coluna de horas", () => {
    const dias = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
    const ana = pessoa("Ana", { ausencias: [aus()] });
    const bia = pessoa("Bia", {
      ausencias: [aus({ inicio: "2026-11-25", fim: "2026-11-25" })],
    });
    const caio = pessoa("Caio", {
      ausencias: [
        aus({
          id: "x",
          tipo: "ferias",
          inicio: "2026-11-01",
          fim: "2026-11-16",
        }),
        aus({ id: "y", tipo: "afastamento", inicio: "2026-11-18", fim: null }),
      ],
    });
    expect([...idsComAusencia([ana, bia, caio], dias)]).toEqual([
      "c-Ana",
      "c-Caio",
    ]);
    expect([...diasComAusencia(caio, dias)]).toEqual([
      "2026-11-16",
      "2026-11-18",
      "2026-11-19",
    ]);
    expect(resumoDasAusencias(ana, dias)).toBe("Falta justificada até 19/11");
    expect(resumoDasAusencias(bia, dias)).toBeNull();
    // Mais de uma: a última do período; sem volta, "desde".
    expect(resumoDasAusencias(caio, dias)).toBe("Afastamento desde 18/11");
  });
});
