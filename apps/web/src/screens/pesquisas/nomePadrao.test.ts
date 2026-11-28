/**
 * T216 — o nome padrão das pesquisas por mês: mês com inicial maiúscula e
 * sem "de" ("Pulso – Novembro 2026"), em todos os modelos que nomeiam pelo
 * mês (os outros têm o nome próprio: semestre, ciclo, data ou fixo).
 */
import { describe, expect, it } from "vitest";
import { estadoDoModelo, nomeSugerido } from "./estadoDaPesquisa";
import {
  MODELOS_DE_PESQUISA,
  ROTEIROS_PERSONALIZADOS,
} from "./modelosDePesquisa";

describe("nome padrão por mês", () => {
  it("mês com inicial maiúscula e sem 'de'", () => {
    expect(nomeSugerido("Pulso", "2026-11-28")).toBe("Pulso – Novembro 2026");
    expect(nomeSugerido("Clima", "2027-01-03")).toBe("Clima – Janeiro 2027");
    expect(nomeSugerido("Benefícios", "2026-03-31")).toBe(
      "Benefícios – Março 2026",
    );
  });

  it("todo modelo nomeado pelo mês segue o mesmo formato", () => {
    const porMes = [...MODELOS_DE_PESQUISA, ...ROTEIROS_PERSONALIZADOS].filter(
      (m) => m.id !== "personalizada" && !m.nomeDaPesquisa,
    );
    expect(porMes.length).toBeGreaterThan(0);
    for (const m of porMes) {
      const nome = estadoDoModelo(m.id, "2026-11-28").nome;
      expect(nome).toBe(`${m.nomeBase} – Novembro 2026`);
      expect(nome).not.toMatch(/ de 2026|novembro/);
    }
  });
});
