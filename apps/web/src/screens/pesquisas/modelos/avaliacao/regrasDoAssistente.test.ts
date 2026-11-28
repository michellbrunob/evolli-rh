/** T216 — regras puras do assistente da avaliação. */
import { describe, expect, it } from "vitest";
import {
  exigeComentario,
  nivelDaNota,
  nomePadrao,
  secoesDaAvaliacao,
} from "./catalogo";
import {
  ANA,
  BRUNO,
  CAIO,
  DORA,
  GESTORA,
  organogramaFalso,
} from "./dadosDeTeste";
import {
  candidatosAoTime,
  contar,
  erroDoNome,
  erroDoPrazo,
  erroDoPrazoDaAutoavaliacao,
  instante,
  legendaDoPrazo,
  textoDaContagem,
  textoDosLembretes,
  timesDoOrganograma,
  timesParaEnviar,
} from "./regrasDoAssistente";

const AGORA = new Date("2026-11-27T12:00:00-03:00");

describe("T216 — regras do assistente da avaliação", () => {
  it("nome padrão pelo semestre", () => {
    expect(nomePadrao("avaliacao90", "2026-06-30")).toBe(
      "Avaliação 90° – Ciclo 2026.1",
    );
    expect(nomePadrao("avaliacao180", "2026-07-01")).toBe(
      "Avaliação 180° – Ciclo 2026.2",
    );
  });

  it("catálogo gravado: 8 seções × 3, escala 1–5 com os rótulos", () => {
    const s = secoesDaAvaliacao();
    expect(s).toHaveLength(8);
    expect(s.flatMap((x) => x.perguntas)).toHaveLength(24);
    expect(s[0]!.perguntas[0]!.config.rotulos).toHaveLength(5);
  });

  it("níveis e comentário exigido", () => {
    expect(nivelDaNota(1.94)).toBe("insuficiente");
    expect(nivelDaNota(4.45)).toBe("excepcional");
    expect(nivelDaNota(3.96)).toBe("excelente");
    expect(exigeComentario("extremos", 2.4)).toBe(true);
    expect(exigeComentario("extremos", 2.5)).toBe(false);
    expect(exigeComentario("extremos", 5)).toBe(true);
    expect(exigeComentario("opcionais", 1)).toBe(false);
    expect(exigeComentario("obrigatorios", 3)).toBe(true);
  });

  it("times do organograma, candidatos ao time e o que vai para a API", () => {
    const t = timesDoOrganograma(organogramaFalso());
    expect(t).toHaveLength(1);
    const cand = candidatosAoTime(
      [GESTORA, ANA, BRUNO, CAIO, DORA],
      t,
      GESTORA.id,
    );
    expect(cand.map((p) => p.id)).toEqual([CAIO.id, DORA.id]);
    expect(timesParaEnviar(t)).toEqual([
      { gestorId: "g1", avaliadoIds: ["p1", "p2"] },
    ]);
    expect(timesParaEnviar([{ ...t[0]!, incluido: false }])).toEqual([]);
    expect(timesParaEnviar([{ ...t[0]!, pessoas: [] }])).toEqual([]);
  });

  it("contagem: 180° conta autoavaliação só de quem tem CPF", () => {
    const t = timesDoOrganograma(organogramaFalso());
    const c90 = contar("avaliacao90", t);
    expect(textoDaContagem("avaliacao90", c90)).toBe("1 gestor · 2 pessoas");
    const c180 = contar("avaliacao180", t);
    expect(c180).toMatchObject({
      autoavaliacoes: 1,
      pessoasSemCpf: 1,
      gestoresComEmail: 1,
    });
    expect(textoDaContagem("avaliacao180", c180)).toBe(
      "1 gestor · 2 pessoas · 1 autoavaliação",
    );
  });

  it("validações do nome e dos prazos", () => {
    expect(erroDoNome("")).toBe("Dê um nome para a avaliação.");
    expect(erroDoNome("x".repeat(121))).toBe("Use até 120 caracteres.");
    expect(erroDoNome("Ciclo")).toBeNull();
    expect(erroDoPrazo("", "23:59", AGORA)).toBe(
      "Escolha a data e o horário do prazo.",
    );
    expect(erroDoPrazo("2026-11-27", "12:30", AGORA)).toMatch(/1 hora/);
    expect(erroDoPrazo("2026-11-27", "13:00", AGORA)).toBeNull();
    const prazo = instante("2026-12-27", "23:59");
    expect(
      erroDoPrazoDaAutoavaliacao("2026-12-28", "10:00", prazo, AGORA),
    ).toMatch(/antes do prazo do gestor/);
    expect(
      erroDoPrazoDaAutoavaliacao("2026-11-27", "12:10", prazo, AGORA),
    ).toMatch(/1 hora/);
    expect(
      erroDoPrazoDaAutoavaliacao("2026-12-20", "23:59", prazo, AGORA),
    ).toBeNull();
  });

  it("legenda do prazo e texto dos lembretes", () => {
    expect(legendaDoPrazo("2026-11-27", "2026-11-27")).toBe("Hoje");
    expect(legendaDoPrazo("2026-11-27", "2026-11-28")).toBe(
      "1 dia a partir de hoje",
    );
    expect(legendaDoPrazo("2026-11-27", "2026-12-27")).toBe(
      "30 dias a partir de hoje",
    );
    expect(textoDosLembretes([])).toBe("sem lembretes");
    expect(textoDosLembretes(["7_dias", "3_dias", "no_dia", "depois"])).toBe(
      "lembretes 7 e 3 dias antes, no dia e depois do prazo",
    );
    expect(textoDosLembretes(["no_dia"])).toBe("lembrete no dia");
  });
});

describe("T216 — ninguém entra no próprio time (prova extra)", () => {
  it("o gestor nunca é candidato ao próprio time, mesmo sem time nenhum", () => {
    expect(candidatosAoTime([GESTORA, DORA], [], GESTORA.id).map((p) => p.id)).toEqual([DORA.id]);
  });
});
