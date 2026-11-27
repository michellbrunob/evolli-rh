import { describe, expect, it } from "vitest";
import type { DiaGravadoApi } from "../../../api/escalaClient";
import { escala, pessoa } from "./fixturasDoQuadro";
import {
  padraoParaPublicar,
  periodosDaPublicacao,
  resumoDaPublicacao,
} from "./publicacaoDaEscala";
import { diasDoPeriodo } from "./quadroDaEscala";

function dia(
  d: string,
  camada: "rascunho" | "publicado",
  tipo: DiaGravadoApi["tipo"],
): DiaGravadoApi {
  return {
    dia: d,
    camada,
    tipo,
    turno: null,
    periodos: [],
    intervaloMinutos: 0,
    sobreaviso: [],
    unidade: null,
    observacao: null,
  };
}

describe("T215 — publicar: resumo e períodos", () => {
  it("novas, alteradas, removidas (trabalho publicado que vira folga) e pessoas, só nos dias do período", () => {
    const ana = pessoa("Ana", {
      colaboradorId: "a",
      dias: [
        dia("2026-11-23", "rascunho", "trabalho"),
        dia("2026-11-24", "publicado", "folga"),
        dia("2026-11-24", "rascunho", "trabalho"),
        dia("2026-11-25", "publicado", "trabalho"),
        dia("2026-11-25", "rascunho", "folga"),
        dia("2026-11-26", "publicado", "sobreaviso"),
        dia("2026-11-26", "rascunho", "dsr"),
        dia("2026-11-27", "publicado", "trabalho"),
        dia("2026-11-27", "rascunho", "sobreaviso"),
        dia("2026-12-01", "rascunho", "trabalho"),
      ],
    });
    const bia = pessoa("Bia", {
      colaboradorId: "b",
      dias: [dia("2026-11-28", "publicado", "trabalho")],
    });
    const semana = new Set([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
    ]);
    expect(resumoDaPublicacao([ana, bia], semana)).toEqual({
      novas: 1,
      alteradas: 2,
      removidas: 2,
      pessoas: 1,
    });
    expect(resumoDaPublicacao([ana], new Set(["2026-12-01"]))).toEqual({
      novas: 1,
      alteradas: 0,
      removidas: 0,
      pessoas: 1,
    });
  });

  it("dias do padrão ainda não publicados entram como novos (a mesma regra do servidor)", () => {
    const comPadrao = pessoa("Caio", {
      colaboradorId: "c",
      dataAdmissao: "2026-11-24",
      escalas: [escala()],
      dias: [dia("2026-11-25", "publicado", "trabalho")],
    });
    // 23: antes da admissão; 25: já publicado; 24, 26–29: do padrão.
    expect(padraoParaPublicar(comPadrao, "2026-11-23")).toBe(false);
    expect(padraoParaPublicar(comPadrao, "2026-11-25")).toBe(false);
    expect(padraoParaPublicar(comPadrao, "2026-11-28")).toBe(true); // sábado: folga
    const semana = new Set(diasDoPeriodo("2026-11-23", "2026-11-29"));
    expect(resumoDaPublicacao([comPadrao], semana)).toEqual({
      novas: 5,
      alteradas: 0,
      removidas: 0,
      pessoas: 1,
    });
    // Trabalho sem turno fixo não tem forma de dia gravado: fica no padrão.
    const semTurno = pessoa("Dora", {
      colaboradorId: "d",
      escalas: [escala({ turno: null })],
    });
    expect(padraoParaPublicar(semTurno, "2026-11-23")).toBe(false);
    expect(padraoParaPublicar(semTurno, "2026-11-29")).toBe(true);
  });

  it("semana: a semana, o mês e 4 semanas; mês: o mês e 4 semanas", () => {
    expect(periodosDaPublicacao("semana", "2026-11-23", "2026-11-29")).toEqual([
      {
        rotulo: "Semana de 23 a 29 de novembro de 2026",
        inicio: "2026-11-23",
        fim: "2026-11-29",
      },
      {
        rotulo: "Mês de novembro de 2026",
        inicio: "2026-11-01",
        fim: "2026-11-30",
      },
      {
        rotulo: "Até 20/12 (4 semanas)",
        inicio: "2026-11-23",
        fim: "2026-12-20",
      },
    ]);
    expect(periodosDaPublicacao("mes", "2027-02-01", "2027-02-28")).toEqual([
      {
        rotulo: "Mês de fevereiro de 2027",
        inicio: "2027-02-01",
        fim: "2027-02-28",
      },
      {
        rotulo: "Até 28/02 (4 semanas)",
        inicio: "2027-02-01",
        fim: "2027-02-28",
      },
    ]);
  });
});
