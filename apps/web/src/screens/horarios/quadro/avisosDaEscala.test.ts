import { describe, expect, it } from "vitest";
import type {
  DiaGravadoApi,
  RegrasDaEscalaApi,
} from "../../../api/escalaClient";
import { CHAVES_DOS_AVISOS } from "../../../api/escalaClient";
import {
  avisosPorCelula,
  calcularAvisos,
  feriadoDaPessoa,
  pessoasEm6x1NaTransicao,
} from "./avisosDaEscala";
import { diasDoPeriodo } from "./quadroDaEscala";
import { escala, pessoa, turno } from "./fixturasDoQuadro";

function regras(extra: Partial<RegrasDaEscalaApi> = {}): RegrasDaEscalaApi {
  return {
    personalizadas: false,
    inicioTransicao: "2026-12-16",
    semanaComeca: 1,
    convencao: {
      "6x1_autorizada": false,
      jornada_ampliada: false,
      "12x36_acordo": true,
      revezamento_8h: false,
      intervalo_30min: false,
      comercio: false,
      feriado_convencao: false,
      portaria_1316: false,
    },
    avisos: Object.fromEntries(
      CHAVES_DOS_AVISOS.map((k) => [k, k !== "noturno"]),
    ) as RegrasDaEscalaApi["avisos"],
    antecedenciaDias: 7,
    avisarPadrao: true,
    feriados: [],
    ...extra,
  };
}

function dia(d: string, extra: Partial<DiaGravadoApi> = {}): DiaGravadoApi {
  return {
    dia: d,
    camada: "rascunho",
    tipo: "trabalho",
    turno: null,
    periodos: [{ inicio: "09:00", fim: "18:00" }],
    intervaloMinutos: 60,
    sobreaviso: [],
    unidade: null,
    observacao: null,
    ...extra,
  };
}

const MARCO = diasDoPeriodo("2027-03-01", "2027-03-07");
const NOV = diasDoPeriodo("2026-11-23", "2026-11-29");
const seisPorUm = (extra = {}) =>
  pessoa("teste", {
    colaboradorId: "c-t",
    escalas: [
      escala({
        modelo: "6x1",
        folgaSemanal: 7,
        turno: turno("Comercial", {
          periodos: [
            "segunda",
            "terca",
            "quarta",
            "quinta",
            "sexta",
            "sabado",
          ].map((d) => ({ dia: d, inicio: "09:00", fim: "18:00" })),
        }),
      }),
    ],
    ...extra,
  });

const chaves = (as: { chave: string; dia: string }[]) =>
  as.map((a) => `${a.chave}@${a.dia}`);

describe("T215 — avisos da CLT no quadro", () => {
  it("6x1 depois da transição: sem convenção, 6x1, 2 descansos e jornada da semana (como na referência)", () => {
    const avisos = calcularAvisos([seisPorUm()], MARCO, regras());
    expect(chaves(avisos)).toEqual([
      "6x1_transicao@2027-03-01",
      "jornada_semanal@2027-03-06",
      "dois_descansos@2027-03-07",
    ]);
    expect(avisos[0]).toMatchObject({
      categoria: "atencao",
      titulo: "6x1 sem convenção depois da transição",
      explicacao:
        "A partir de 16/12, a 6x1 só vale com convenção coletiva (EC 141/2026).",
    });
    expect(avisos[1]).toMatchObject({
      categoria: "conferir",
      titulo: "48 h na semana",
      explicacao: "Acima de 42 h (CF, art. 7º, XIII · EC 141/2026).",
    });
    expect(avisos[2]).toMatchObject({
      categoria: "atencao",
      titulo: "1 descanso por semana no período",
    });
    expect(
      pessoasEm6x1NaTransicao([seisPorUm()], MARCO, regras()),
    ).toHaveLength(1);
  });

  it("6x1 antes da transição: 44 h, sem aviso; com convenção, sem os avisos da 6x1", () => {
    // Antes da transição: só a semana de 48 h passa das 44 h.
    expect(chaves(calcularAvisos([seisPorUm()], NOV, regras()))).toEqual([
      "jornada_semanal@2026-11-28",
    ]);
    const conv = regras({
      convencao: { ...regras().convencao, "6x1_autorizada": true },
    });
    expect(chaves(calcularAvisos([seisPorUm()], MARCO, conv))).toEqual([
      "jornada_semanal@2027-03-06",
    ]);
    expect(pessoasEm6x1NaTransicao([seisPorUm()], MARCO, conv)).toEqual([]);
  });

  it("dia: mais de 10 h, intervalo abaixo do mínimo e descanso entre jornadas", () => {
    const p = pessoa("Ana", {
      colaboradorId: "c-a",
      escalas: [escala()],
      dias: [
        dia("2026-11-23", { periodos: [{ inicio: "08:00", fim: "20:00" }] }),
        dia("2026-11-24", {
          periodos: [{ inicio: "14:00", fim: "23:00" }],
          intervaloMinutos: 0,
        }),
        dia("2026-11-25", {
          periodos: [{ inicio: "06:00", fim: "11:00" }],
          intervaloMinutos: 0,
        }),
      ],
    });
    const avisos = calcularAvisos([p], NOV, regras());
    expect(chaves(avisos)).toEqual([
      "dez_horas@2026-11-23",
      "intervalo@2026-11-24",
      "intervalo@2026-11-25",
      "interjornada@2026-11-25",
    ]);
    expect(avisos[0]!.titulo).toBe("11 h no dia");
    expect(avisos[1]!.titulo).toBe("Sem intervalo");
    expect(avisos[2]!.explicacao).toContain("15 min");
    expect(avisos[3]!.titulo).toBe("7 h de descanso entre jornadas");
    // Convenção de intervalo de 30 min: 30 min passa.
    const p30 = pessoa("Bia", {
      escalas: [escala()],
      dias: [dia("2026-11-23", { intervaloMinutos: 30 })],
    });
    expect(chaves(calcularAvisos([p30], NOV, regras()))).toEqual([
      "intervalo@2026-11-23",
    ]);
    expect(
      calcularAvisos(
        [p30],
        NOV,
        regras({ convencao: { ...regras().convencao, intervalo_30min: true } }),
      ),
    ).toEqual([]);
  });

  it("feriado: trabalhado é informativo (como a referência); no comércio sem convenção, atenção; feriado local da unidade", () => {
    const dez = diasDoPeriodo("2026-12-21", "2026-12-27");
    const p = pessoa("Ana", {
      unidade: { id: "u1", nome: "Loja" },
      escalas: [escala({ vigenciaInicio: "2026-01-01" })],
      dias: [dia("2026-12-25"), dia("2026-12-26")],
    });
    const base = regras({
      feriados: [
        {
          id: "f",
          data: "2026-12-26",
          nome: "Aniversário",
          tipo: "municipal",
          unidadeIds: ["u1"],
        },
      ],
    });
    expect(feriadoDaPessoa(p, "2026-12-26", base)).toBe("Aniversário");
    // Estadual: pelo estado da empresa, para todos.
    expect(feriadoDaPessoa(p, "2026-07-09", { ...base, uf: "SP" })).toBe(
      "Revolução Constitucionalista",
    );
    expect(feriadoDaPessoa(p, "2026-07-09", base)).toBeNull();
    expect(
      feriadoDaPessoa(
        { ...p, unidade: { id: "u2", nome: "X" } },
        "2026-12-26",
        base,
      ),
    ).toBeNull();
    const avisos = calcularAvisos([p], dez, base).filter((a) =>
      a.chave.startsWith("feriado"),
    );
    expect(avisos.map((a) => [a.chave, a.categoria, a.titulo])).toEqual([
      ["feriado", "informativo", "Trabalho no feriado: Natal"],
      ["feriado", "informativo", "Trabalho no feriado: Aniversário"],
    ]);
    expect(avisos[0]!.explicacao).toBe(
      "Pagar em dobro ou dar folga compensatória (Lei 605/1949).",
    );
    const comercio = regras({
      ...base,
      convencao: { ...base.convencao, comercio: true },
    });
    expect(
      calcularAvisos([p], dez, comercio)
        .filter((a) => a.chave.startsWith("feriado"))
        .map((a) => a.chave),
    ).toEqual(["feriado_comercio", "feriado_comercio"]);
  });

  it("ausência aprovada: escalado (gravado) no dia vira aviso de atenção; o padrão não; desligado nas Regras some", () => {
    const p = pessoa("Ana", {
      escalas: [escala({ vigenciaInicio: "2026-01-01" })],
      dias: [
        dia("2026-11-24"),
        dia("2026-11-25", { tipo: "sobreaviso" }),
        dia("2026-11-26", { tipo: "folga", periodos: [] }),
      ],
      ausencias: [
        {
          id: "a",
          tipo: "ferias",
          motivoAfastamento: null,
          inicio: "2026-11-23",
          fim: "2026-11-27",
        },
      ],
    });
    const avisos = calcularAvisos([p], NOV, regras()).filter(
      (a) => a.chave === "ausencia",
    );
    expect(avisos.map((a) => [a.dia, a.categoria, a.titulo])).toEqual([
      ["2026-11-24", "atencao", "Escalado durante ausência aprovada"],
      ["2026-11-25", "atencao", "Escalado durante ausência aprovada"],
    ]);
    expect(avisos[0]!.explicacao).toBe(
      "Férias de 23/11 a 27/11: o dia não conta como trabalhado. Limpe o dia ou ajuste em Férias e ausências.",
    );
    // Na ausência o dia não conta como trabalhado: nada de jornada.
    expect(
      calcularAvisos([p], NOV, regras()).filter(
        (a) => a.chave === "dez_horas" && a.dia === "2026-11-24",
      ),
    ).toEqual([]);
    const desligado = regras();
    expect(
      calcularAvisos([p], NOV, {
        ...desligado,
        avisos: { ...desligado.avisos, ausencia: false },
      }).filter((a) => a.chave === "ausencia"),
    ).toEqual([]);
  });

  it("tempo parcial (CLT, 58-A): até 30 h; contrato de até 26 h aceita 6 extras (32 h)", () => {
    const parcial = (jornada: number, ate: string) =>
      pessoa("Par", {
        colaboradorId: "c-par",
        tipoVinculo: "part_time",
        jornadaSemanalHoras: jornada,
        dias: NOV.slice(0, 5).map((d) =>
          dia(d, {
            periodos: [{ inicio: "09:00", fim: ate }],
            intervaloMinutos: 0,
          }),
        ),
      });
    const doParcial = (p: ReturnType<typeof parcial>) =>
      calcularAvisos([p], NOV, regras()).filter(
        (a) => a.chave === "tempo_parcial",
      );
    // 5 × 6 h 12 = 31 h.
    const trinta = doParcial(parcial(30, "15:12"));
    expect(trinta.map((a) => [a.dia, a.titulo])).toEqual([
      ["2026-11-27", "31 h na semana em tempo parcial"],
    ]);
    expect(trinta[0]!.explicacao).toBe(
      "Tempo parcial acima de 26 h: até 30 h por semana, sem horas extras (CLT, art. 58-A).",
    );
    expect(doParcial(parcial(26, "15:12"))).toEqual([]);
    // 5 × 6 h 30 = 32 h 30 passa das 32 h.
    const vinte = doParcial(parcial(26, "15:30"));
    expect(vinte.map((a) => a.titulo)).toEqual([
      "32 h 30 na semana em tempo parcial",
    ]);
    expect(vinte[0]!.explicacao).toBe(
      "Contrato de até 26 h: até 6 h extras na semana, 32 h no total (CLT, art. 58-A).",
    );
    // CLT comum com 31 h: não é tempo parcial.
    expect(doParcial({ ...parcial(30, "15:12"), tipoVinculo: "clt" })).toEqual(
      [],
    );
  });

  it("contratos especiais: aprendiz acima de 6 h; menor em horário noturno; noturno e sobreaviso informativos", () => {
    const aprendiz = pessoa("Apr", {
      tipoVinculo: "aprendiz",
      escalas: [escala()],
      dias: [dia("2026-11-23")],
    });
    expect(
      calcularAvisos([aprendiz], NOV, regras()).map((a) => a.chave),
    ).toContain("aprendiz_estagio");
    const menor = pessoa("Menor", {
      dataNascimento: "2009-06-01",
      escalas: [escala()],
      dias: [
        dia("2026-11-23", {
          periodos: [{ inicio: "18:00", fim: "23:00" }],
          intervaloMinutos: 15,
        }),
        dia("2026-11-24", {
          tipo: "sobreaviso",
          periodos: [{ inicio: "18:00", fim: "22:00" }],
          intervaloMinutos: 0,
        }),
      ],
    });
    const comNoturno = regras({
      avisos: { ...regras().avisos, noturno: true },
    });
    expect(
      calcularAvisos([menor], NOV, comNoturno).map((a) => [
        a.chave,
        a.categoria,
      ]),
    ).toEqual([
      ["menor_noturno", "atencao"],
      ["noturno", "informativo"],
      ["sobreaviso", "informativo"],
    ]);
  });

  it("revezamento: semana com turno de noite e de dia, dia acima de 6 h (8 h pela convenção)", () => {
    const p = pessoa("Rev", {
      escalas: [escala()],
      dias: [
        dia("2026-11-23", {
          periodos: [{ inicio: "22:00", fim: "05:00" }],
          intervaloMinutos: 60,
        }),
        dia("2026-11-25", {
          periodos: [{ inicio: "08:00", fim: "15:00" }],
          intervaloMinutos: 0,
        }),
      ],
    });
    const r = calcularAvisos([p], NOV, regras()).filter(
      (a) => a.chave === "revezamento",
    );
    // A noite de segunda tem 6 h líquidas (não passa); terça, pelo padrão, 8 h.
    expect(r.map((a) => [a.dia, a.titulo])).toEqual([
      ["2026-11-24", "8 h em turno de revezamento"],
    ]);
    // Com a convenção de até 8 h, 8 h passa.
    expect(
      calcularAvisos(
        [p],
        NOV,
        regras({ convencao: { ...regras().convencao, revezamento_8h: true } }),
      ).filter((a) => a.chave === "revezamento"),
    ).toEqual([]);
  });

  it("regras desligam avisos; por célula", () => {
    const sem = regras({
      avisos: Object.fromEntries(
        CHAVES_DOS_AVISOS.map((k) => [k, false]),
      ) as RegrasDaEscalaApi["avisos"],
    });
    expect(calcularAvisos([seisPorUm()], MARCO, sem)).toEqual([]);
    const m = avisosPorCelula(calcularAvisos([seisPorUm()], MARCO, regras()));
    expect(m.get("c-t|2027-03-01")?.map((a) => a.chave)).toEqual([
      "6x1_transicao",
    ]);
  });

  it("PJ só recebe informativos; plantão sem interjornada; 18 anos completos não é menor", () => {
    const pj = pessoa("PJ", {
      tipoVinculo: "pj",
      escalas: [escala()],
      dias: [
        dia("2026-11-23", { periodos: [{ inicio: "08:00", fim: "20:00" }] }),
        dia("2026-11-24", {
          tipo: "sobreaviso",
          periodos: [{ inicio: "18:00", fim: "22:00" }],
          intervaloMinutos: 0,
        }),
      ],
    });
    expect(calcularAvisos([pj], NOV, regras()).map((a) => a.chave)).toEqual([
      "sobreaviso",
    ]);
    const plantonista = pessoa("Plantão", {
      escalas: [escala({ modelo: "12x60" })],
      dias: [
        dia("2026-11-23", { periodos: [{ inicio: "08:00", fim: "20:00" }] }),
        dia("2026-11-24", { periodos: [{ inicio: "06:00", fim: "18:00" }] }),
      ],
    });
    expect(
      calcularAvisos([plantonista], NOV, regras()).map((a) => a.chave),
    ).not.toContain("interjornada");
    const dezoito = pessoa("Dezoito", {
      dataNascimento: "2008-11-23",
      escalas: [escala()],
      dias: [
        dia("2026-11-23", {
          periodos: [{ inicio: "18:00", fim: "23:00" }],
          intervaloMinutos: 15,
        }),
      ],
    });
    expect(
      calcularAvisos([dezoito], NOV, regras()).map((a) => a.chave),
    ).not.toContain("menor_noturno");
  });

  it("12x36: aviso só a partir da 2ª etapa (um ano depois da transição)", () => {
    const plantao = (d: string) =>
      pessoa("Doze", {
        escalas: [escala({ modelo: "12x36", vigenciaInicio: "2026-01-01" })],
        dias: [dia(d, { periodos: [{ inicio: "07:00", fim: "19:00" }] })],
      });
    const dez26 = diasDoPeriodo("2026-12-21", "2026-12-27");
    expect(
      calcularAvisos([plantao("2026-12-22")], dez26, regras()).map(
        (a) => a.chave,
      ),
    ).not.toContain("12x36_2027");
    const dez27 = diasDoPeriodo("2027-12-20", "2027-12-26");
    const avisos = calcularAvisos([plantao("2027-12-21")], dez27, regras());
    expect(avisos.find((a) => a.chave === "12x36_2027")).toMatchObject({
      dia: "2027-12-20",
      titulo: "12x36 depois de 16/12",
    });
  });
});
