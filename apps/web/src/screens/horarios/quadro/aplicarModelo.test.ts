import { describe, expect, it } from "vitest";
import type { DiaGravadoApi } from "../../../api/escalaClient";
import {
  type OpcoesDoModelo,
  aceitaTurnoPorDia,
  celulasDoModelo,
  diasDoModelo,
  escalaDoModelo,
  folgaDaPessoa,
  pessoasComOModelo,
  planoDoModelo,
} from "./aplicarModelo";
import { escala, pessoa, tabelaHorario } from "./fixturasDoQuadro";

const COMERCIAL = tabelaHorario("Comercial");
const TARDE = tabelaHorario("Tarde", {
  periodos: ["segunda", "terca", "quarta", "quinta", "sexta"].map((dia) => ({
    dia,
    inicio: "13:00",
    fim: "19:00",
  })),
  intervaloMinutos: 15,
});

function opcoes(extra: Partial<OpcoesDoModelo> = {}): OpcoesDoModelo {
  return {
    modelo: "5x2",
    turno: COMERCIAL,
    folga: "mesmo",
    domingoACada3: false,
    diasTrabalho: [],
    inicio: "2026-11-30",
    fim: "2026-12-13",
    substituir: false,
    ...extra,
  };
}

/** "t" trabalho, "f" folga, "d" DSR, "-" fora do vínculo. */
const tipos = (cs: ({ tipo: string } | null)[]) =>
  cs.map((c) => (c ? c.tipo[0] : "-")).join("");

const semanas = (s: string) => [s.slice(0, 7), s.slice(7, 14), s.slice(14)];

function gravado(
  dia: string,
  extra: Partial<DiaGravadoApi> = {},
): DiaGravadoApi {
  return {
    dia,
    camada: "rascunho",
    tipo: "folga",
    turno: null,
    periodos: [],
    intervaloMinutos: 0,
    sobreaviso: [],
    unidade: null,
    observacao: null,
    ...extra,
  };
}

describe("T215 — Aplicar modelo", () => {
  it("5x2: segunda a sexta no turno, sábado folga, domingo DSR; 40 h na semana", () => {
    const p = pessoa("Ana", { colaboradorId: "c-a" });
    const plano = planoDoModelo([p], opcoes());
    expect(plano.gravar).toHaveLength(14);
    expect(plano.gravar.slice(0, 7).map((g) => g.tipo)).toEqual([
      "trabalho",
      "trabalho",
      "trabalho",
      "trabalho",
      "trabalho",
      "folga",
      "dsr",
    ]);
    expect(plano.gravar[0]).toEqual({
      colaboradorId: "c-a",
      dia: "2026-11-30",
      tipo: "trabalho",
      tabelaHorarioId: COMERCIAL.id,
      periodos: [{ inicio: "09:00", fim: "18:00" }],
      intervaloMinutos: 60,
      sobreaviso: [],
      unidadeOrganizacionalId: null,
      observacao: null,
    });
    expect(plano.gravar[5]).toEqual({
      colaboradorId: "c-a",
      dia: "2026-12-05",
      tipo: "folga",
      observacao: null,
    });
    expect(plano.porPessoa).toEqual([
      {
        colaboradorId: "c-a",
        nome: "Ana",
        minutosNaSemana: 40 * 60,
        celulas: 14,
      },
    ]);
  });

  it("horas da primeira semana contam o domingo trabalhado; a escala do modelo", () => {
    const o = opcoes({ modelo: "6x1", folga: "distribuir" });
    const plano = planoDoModelo([pessoa("A"), pessoa("B")], o);
    expect(plano.porPessoa.map((x) => x.minutosNaSemana)).toEqual([
      48 * 60,
      48 * 60,
    ]);
    expect(escalaDoModelo(opcoes({ modelo: "12x36" }), 0)).toMatchObject({
      modelo: "12x36",
      turno: { id: COMERCIAL.id },
      folgaSemanal: null,
      inicioCiclo: "2026-11-30",
      vigenciaInicio: "2026-11-30",
    });
    expect(escalaDoModelo(opcoes(), 0)).toMatchObject({ inicioCiclo: null });
    expect(
      escalaDoModelo(opcoes({ modelo: "outra", diasTrabalho: [2, 4] }), 0),
    ).toMatchObject({ diasTrabalho: [2, 4] });
  });

  it("sem data de fim: 8 semanas; até uma data: só até ela", () => {
    expect(diasDoModelo("2026-11-30", null)).toHaveLength(56);
    expect(diasDoModelo("2026-11-30", "2026-12-02")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    expect(diasDoModelo("2026-11-30", "2026-11-29")).toEqual([]);
  });

  it("6x1: DSR no domingo para todos ou girando entre as pessoas", () => {
    expect([0, 1, 2, 7].map((i) => folgaDaPessoa("distribuir", i))).toEqual([
      7, 1, 2, 7,
    ]);
    expect(folgaDaPessoa("mesmo", 3)).toBe(7);
    const dias = diasDoModelo("2026-11-30", "2026-12-06");
    const o = opcoes({ modelo: "6x1", folga: "distribuir" });
    const ps = [pessoa("A"), pessoa("B"), pessoa("C")];
    expect(ps.map((p, i) => tipos(celulasDoModelo(p, o, i, dias)))).toEqual([
      "ttttttd",
      "dtttttt",
      "tdttttt",
    ]);
    expect(
      tipos(celulasDoModelo(ps[1]!, opcoes({ modelo: "6x1" }), 1, dias)),
    ).toBe("ttttttd");
  });

  it("6x1 com domingos: quem folga fora do domingo folga nele a cada 3 semanas", () => {
    const dias = diasDoModelo("2026-11-30", "2026-12-20");
    const o = opcoes({
      modelo: "6x1",
      folga: "distribuir",
      domingoACada3: true,
    });
    // Pessoa 1 (folga na segunda): na 2ª semana, a segunda troca com o domingo.
    expect(semanas(tipos(celulasDoModelo(pessoa("B"), o, 1, dias)))).toEqual([
      "dtttttt",
      "ttttttd",
      "dtttttt",
    ]);
    // Pessoa 2 (folga na terça): na 1ª semana.
    expect(semanas(tipos(celulasDoModelo(pessoa("C"), o, 2, dias)))).toEqual([
      "ttttttd",
      "tdttttt",
      "tdttttt",
    ]);
    // Quem já folga no domingo não muda.
    expect(semanas(tipos(celulasDoModelo(pessoa("A"), o, 0, dias)))).toEqual([
      "ttttttd",
      "ttttttd",
      "ttttttd",
    ]);
    // Sem a opção, nada muda.
    expect(
      semanas(
        tipos(
          celulasDoModelo(pessoa("B"), { ...o, domingoACada3: false }, 1, dias),
        ),
      ),
    ).toEqual(["dtttttt", "dtttttt", "dtttttt"]);
    // O dia trocado ganha o turno.
    expect(celulasDoModelo(pessoa("B"), o, 1, dias)[7]).toMatchObject({
      tipo: "trabalho",
      turno: { id: COMERCIAL.id },
      minutos: 8 * 60,
    });
  });

  it("um turno por dia nas escalas de dias fixos", () => {
    expect(aceitaTurnoPorDia("5x2")).toBe(true);
    expect(aceitaTurnoPorDia("outra")).toBe(true);
    expect(aceitaTurnoPorDia("6x1")).toBe(false);
    expect(aceitaTurnoPorDia("12x36")).toBe(false);
    const dias = diasDoModelo("2026-11-30", "2026-12-06");
    const cs = celulasDoModelo(
      pessoa("A"),
      opcoes({ turnoPorDia: new Map([[3, TARDE]]) }),
      0,
      dias,
    );
    expect(cs[0]).toMatchObject({ turno: { id: COMERCIAL.id } });
    expect(cs[2]).toMatchObject({
      tipo: "trabalho",
      turno: { id: TARDE.id },
      periodos: [{ inicio: "13:00", fim: "19:00" }],
      intervaloMinutos: 15,
      minutos: 345,
    });
  });

  it("outra: os dias escolhidos; plantão 12x36 começa no primeiro dia", () => {
    const dias = diasDoModelo("2026-11-30", "2026-12-06");
    expect(
      tipos(
        celulasDoModelo(
          pessoa("A"),
          opcoes({ modelo: "outra", diasTrabalho: [1, 3, 5] }),
          0,
          dias,
        ),
      ),
    ).toBe("tftftfd");
    expect(
      tipos(celulasDoModelo(pessoa("A"), opcoes({ modelo: "12x36" }), 0, dias)),
    ).toBe("tftftft");
  });

  it("sem Substituir, só ocupa os dias vazios; com Substituir, regrava mantendo a observação", () => {
    const p = pessoa("Ana", {
      colaboradorId: "c-a",
      escalas: [escala()],
      dias: [
        gravado("2026-11-30", { observacao: "consulta" }),
        gravado("2026-12-01", { camada: "publicado", tipo: "dsr" }),
      ],
    });
    const sem = planoDoModelo([p], opcoes());
    expect(sem.ocupadas).toBe(2);
    expect(sem.gravar.map((g) => g.dia)).not.toContain("2026-11-30");
    expect(sem.gravar).toHaveLength(12);
    expect(sem.porPessoa[0]!.celulas).toBe(12);
    const com = planoDoModelo([p], opcoes({ substituir: true }));
    expect(com.gravar).toHaveLength(14);
    expect(com.gravar[0]).toMatchObject({
      dia: "2026-11-30",
      tipo: "trabalho",
      observacao: "consulta",
    });
  });

  it("fora do vínculo fica de fora", () => {
    const p = pessoa("Ana", { dataDesligamento: "2026-12-02" });
    expect(
      tipos(
        celulasDoModelo(
          p,
          opcoes(),
          0,
          diasDoModelo("2026-11-30", "2026-12-06"),
        ),
      ),
    ).toBe("ttt----");
    expect(planoDoModelo([p], opcoes()).gravar.map((g) => g.dia)).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });

  it("as pessoas com o modelo: o lote entra como rascunho por cima", () => {
    const p = pessoa("Ana", {
      colaboradorId: "c-a",
      dias: [gravado("2026-11-30"), gravado("2026-11-29")],
    });
    const plano = planoDoModelo(
      [p],
      opcoes({ substituir: true, fim: "2026-11-30" }),
    );
    const [r] = pessoasComOModelo([p], plano.gravar, [COMERCIAL]);
    expect(r!.dias).toEqual([
      gravado("2026-11-29"),
      gravado("2026-11-30", {
        tipo: "trabalho",
        turno: { id: COMERCIAL.id, nome: "Comercial", cor: "azul", sigla: "C" },
        periodos: [{ inicio: "09:00", fim: "18:00" }],
        intervaloMinutos: 60,
      }),
    ]);
    // Sem as opções, a escala da pessoa não muda.
    expect(r!.escalas).toEqual(p.escalas);
  });

  it("com as opções, a escala do modelo vale no período (até o dia seguinte ao fim)", () => {
    const antiga = escala({ id: "velha" });
    const p = pessoa("Ana", { escalas: [antiga] });
    const o = opcoes({ modelo: "6x1", folga: "distribuir" });
    const [, r] = pessoasComOModelo([pessoa("X"), p], [], [COMERCIAL], o);
    expect(r!.escalas).toEqual([
      expect.objectContaining({
        modelo: "6x1",
        folgaSemanal: 1,
        vigenciaInicio: "2026-11-30",
        vigenciaFim: "2026-12-14",
      }),
      antiga,
    ]);
    const [s] = pessoasComOModelo([p], [], [COMERCIAL], { ...o, fim: null });
    expect(s!.escalas[0]).toMatchObject({ vigenciaFim: null });
  });
});
