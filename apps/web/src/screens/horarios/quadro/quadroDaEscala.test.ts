import { describe, expect, it } from "vitest";
import {
  agrupar,
  buscar,
  celulaDoDia,
  deslocar,
  diasDoPeriodo,
  iniciais,
  metaDoPeriodo,
  nomeDosGrupos,
  ordenar,
  periodoDa,
  periodosNoDia,
  rotuloDaEscala,
  tituloDoPeriodo,
  turnoDaPessoa,
} from "./quadroDaEscala";
import { DIAS_UTEIS, escala, pessoa, turno } from "./fixturasDoQuadro";

describe("período e título", () => {
  it("semana de segunda a domingo; mês do dia 1 ao último (bissexto incluso)", () => {
    expect(periodoDa("semana", "2026-11-25")).toEqual({
      inicio: "2026-11-23",
      fim: "2026-11-29",
    });
    expect(periodoDa("semana", "2026-11-29")).toEqual({
      inicio: "2026-11-23",
      fim: "2026-11-29",
    });
    expect(periodoDa("mes", "2028-02-10")).toEqual({
      inicio: "2028-02-01",
      fim: "2028-02-29",
    });
    expect(diasDoPeriodo("2026-11-23", "2026-11-29")).toHaveLength(7);
  });

  it("anterior e seguinte: 7 dias na semana; o dia 1 do mês vizinho no mês (virada de ano)", () => {
    expect(deslocar("semana", "2026-11-25", 1)).toBe("2026-11-30");
    expect(deslocar("semana", "2026-11-25", -1)).toBe("2026-11-16");
    expect(deslocar("mes", "2026-12-31", 1)).toBe("2027-01-01");
    expect(deslocar("mes", "2027-01-15", -1)).toBe("2026-12-01");
  });

  it("títulos como na referência, no mesmo mês, entre meses e entre anos", () => {
    expect(tituloDoPeriodo("semana", "2026-11-23", "2026-11-29")).toBe(
      "23 a 29 de novembro de 2026",
    );
    expect(tituloDoPeriodo("semana", "2026-11-30", "2026-12-06")).toBe(
      "30 de novembro a 6 de dezembro de 2026",
    );
    expect(tituloDoPeriodo("semana", "2026-12-28", "2027-01-03")).toBe(
      "28 de dezembro de 2026 a 3 de janeiro de 2027",
    );
    expect(tituloDoPeriodo("mes", "2027-03-01", "2027-03-31")).toBe(
      "Março de 2027",
    );
  });
});

describe("célula do dia", () => {
  it("5x2 com turno: trabalho com horário e horas líquidas; sábado folga; domingo DSR", () => {
    const p = pessoa("Ana", { escalas: [escala()] });
    expect(celulaDoDia(p, "2026-11-23")).toMatchObject({
      tipo: "trabalho",
      turno: { nome: "Comercial" },
      horario: "09:00–18:00",
      minutos: 8 * 60,
    });
    expect(celulaDoDia(p, "2026-11-28").tipo).toBe("folga");
    expect(celulaDoDia(p, "2026-11-29").tipo).toBe("dsr");
  });

  it("6x1: a folga escolhida é o DSR e o domingo é trabalho", () => {
    const p = pessoa("Bia", {
      escalas: [escala({ modelo: "6x1", folgaSemanal: 3 })],
    });
    expect(celulaDoDia(p, "2026-11-25").tipo).toBe("dsr");
    expect(celulaDoDia(p, "2026-11-29").tipo).toBe("trabalho");
  });

  it("sem padrão: sem escala; fora do vínculo antes da admissão e depois do último dia", () => {
    const p = pessoa("Caio", {
      dataAdmissao: "2026-11-25",
      dataDesligamento: "2026-11-27",
      escalas: [escala({ vigenciaInicio: "2026-11-26" })],
    });
    expect(celulaDoDia(p, "2026-11-24").tipo).toBe("fora");
    expect(celulaDoDia(p, "2026-11-25").tipo).toBe("sem-escala");
    expect(celulaDoDia(p, "2026-11-26").tipo).toBe("trabalho");
    expect(celulaDoDia(p, "2026-11-27").tipo).toBe("trabalho");
    expect(celulaDoDia(p, "2026-11-28").tipo).toBe("fora");
  });

  it("a vigência termina no dia ANTERIOR a vigenciaFim; o padrão seguinte vale dali", () => {
    const p = pessoa("Davi", {
      escalas: [
        escala({
          id: "e2",
          modelo: "6x1",
          folgaSemanal: 7,
          turno: turno("Loja"),
          vigenciaInicio: "2026-11-26",
        }),
        escala({ vigenciaFim: "2026-11-26" }),
      ],
    });
    expect(celulaDoDia(p, "2026-11-25").turno?.nome).toBe("Comercial");
    expect(celulaDoDia(p, "2026-11-28")).toMatchObject({
      tipo: "trabalho",
      turno: { nome: "Loja" },
    });
  });

  it("padrão sem turno fixo: trabalho sem horário nem horas", () => {
    const p = pessoa("Edu", { escalas: [escala({ turno: null })] });
    expect(celulaDoDia(p, "2026-11-23")).toMatchObject({
      tipo: "trabalho",
      turno: null,
      horario: null,
      minutos: 0,
    });
  });

  it("jornada por dia da semana: o dia sem período é folga; cada dia tem o seu horário", () => {
    const t = turno("Escalonado", {
      intervaloMinutos: 0,
      periodos: [
        { dia: "segunda", inicio: "08:00", fim: "12:00" },
        { dia: "segunda", inicio: "13:00", fim: "17:00" },
        { dia: "terca", inicio: "10:00", fim: "14:00" },
      ],
    });
    const p = pessoa("Fábio", {
      escalas: [escala({ modelo: "outra", diasTrabalho: [1, 2, 3], turno: t })],
    });
    expect(celulaDoDia(p, "2026-11-23")).toMatchObject({
      horario: "08:00–17:00",
      minutos: 8 * 60,
    });
    expect(celulaDoDia(p, "2026-11-24")).toMatchObject({
      horario: "10:00–14:00",
      minutos: 4 * 60,
    });
    expect(celulaDoDia(p, "2026-11-25").tipo).toBe("folga");
    expect(periodosNoDia(t, "2026-11-25")).toEqual([]);
  });

  it("12x36 com turno da noite: no mês seguinte ao início do ciclo, os plantões usam a noite", () => {
    const noite = turno("Noturno", {
      periodos: DIAS_UTEIS.map((dia) => ({
        dia,
        inicio: "19:00",
        fim: "23:59",
      })),
    });
    const p = pessoa("Gil", {
      escalas: [
        escala({
          modelo: "12x36",
          turnoNoite: noite,
          inicioCiclo: "2026-10-01",
          vigenciaInicio: "2026-10-01",
        }),
      ],
    });
    expect(celulaDoDia(p, "2026-10-01").turno?.nome).toBe("Comercial");
    expect(celulaDoDia(p, "2026-11-02").turno?.nome).toBe("Noturno");
  });
});

describe("rótulos, metas e grupos", () => {
  it("rótulo da escala: padrão com turno, só o modelo, o do contrato ou sem escala", () => {
    expect(
      rotuloDaEscala(pessoa("A", { escalas: [escala()] }), "2026-11-23"),
    ).toBe("5x2 · Comercial");
    expect(
      rotuloDaEscala(
        pessoa("B", { escalas: [escala({ modelo: "6x1", turno: null })] }),
        "2026-11-23",
      ),
    ).toBe("6x1");
    expect(
      rotuloDaEscala(pessoa("C", { escalaDoCadastro: "5x2" }), "2026-11-23"),
    ).toBe("5x2");
    expect(rotuloDaEscala(pessoa("D"), "2026-11-23")).toBe("Sem escala fixa");
    // Padrão programado: descreve a pessoa mesmo antes de valer.
    expect(
      rotuloDaEscala(
        pessoa("E", { escalas: [escala({ vigenciaInicio: "2027-01-04" })] }),
        "2026-11-23",
      ),
    ).toBe("5x2 · Comercial");
  });

  it("meta do mês: jornada por semana do dia (contrato e EC 141) × dias ÷ 7", () => {
    const marco = diasDoPeriodo("2027-03-01", "2027-03-31");
    expect(metaDoPeriodo(pessoa("A", { jornadaSemanalHoras: 44 }), marco)).toBe(
      186 * 60,
    );
    expect(
      Math.round(
        metaDoPeriodo(pessoa("B", { jornadaSemanalHoras: 30 }), marco) / 60,
      ),
    ).toBe(133);
    // Sem jornada no contrato: o limite legal.
    expect(
      metaDoPeriodo(pessoa("C", { jornadaSemanalHoras: null }), marco),
    ).toBe(186 * 60);
    // Novembro de 2026, antes da transição: 44 h.
    const nov = diasDoPeriodo("2026-11-01", "2026-11-30");
    expect(metaDoPeriodo(pessoa("D"), nov)).toBe(
      Math.round((44 * 60 * 30) / 7),
    );
  });

  it("iniciais, busca sem acento e ordem pelo nome", () => {
    expect(iniciais("Michell Bruno Borges Dos Santos")).toBe("MS");
    expect(iniciais("teste")).toBe("TE");
    expect(iniciais("Teste T209 Alfa Aprendiz 02")).toBe("TA");
    expect(iniciais("Érica d'Ávila")).toBe("ÉD");
    expect(iniciais("  ")).toBe("?");
    const lista = [pessoa("Úrsula"), pessoa("ana"), pessoa("Bruno")];
    expect(buscar(lista, "urs").map((p) => p.nome)).toEqual(["Úrsula"]);
    expect(buscar(lista, "  ").length).toBe(3);
    expect(ordenar(lista, "asc").map((p) => p.nome)).toEqual([
      "ana",
      "Bruno",
      "Úrsula",
    ]);
    expect(ordenar(lista, "desc").map((p) => p.nome)).toEqual([
      "Úrsula",
      "Bruno",
      "ana",
    ]);
  });

  it("agrupa em ordem alfabética com 'Não informado' por último e a unidade comum", () => {
    const ti = { id: "d1", nome: "Tecnologia" };
    const mk = { id: "d2", nome: "Marketing" };
    const un = { id: "u1", nome: "Matriz" };
    const lista = [
      pessoa("A", { departamento: ti, unidade: un }),
      pessoa("B"),
      pessoa("C", { departamento: mk, unidade: un }),
      pessoa("D", { departamento: ti, unidade: { id: "u2", nome: "Filial" } }),
    ];
    const grupos = agrupar(lista, "departamento", "2026-11-23");
    expect(grupos.map((g) => [g.nome, g.pessoas.length, g.unidade])).toEqual([
      ["Marketing", 1, "Matriz"],
      ["Tecnologia", 2, null],
      ["Não informado", 1, null],
    ]);
    expect(agrupar(lista, "nenhum", "2026-11-23")).toHaveLength(1);
    expect(
      agrupar(lista, "unidade", "2026-11-23").map((g) => [g.nome, g.unidade]),
    ).toEqual([
      ["Filial", null],
      ["Matriz", null],
      ["Não informado", null],
    ]);
    expect(nomeDosGrupos("departamento", 1)).toBe("1 departamento");
    expect(nomeDosGrupos("gestor", 2)).toBe("2 gestores");
  });

  it("agrupa por turno e por gestor", () => {
    const a = pessoa("A", { escalas: [escala()] });
    const b = pessoa("B", {
      gestor: { id: "g", nome: "Gestora" },
      escalas: [escala({ turno: turno("Loja") })],
    });
    expect(turnoDaPessoa(a, "2026-11-23")?.nome).toBe("Comercial");
    expect(agrupar([a, b], "turno", "2026-11-23").map((g) => g.nome)).toEqual([
      "Comercial",
      "Loja",
    ]);
    expect(agrupar([a, b], "gestor", "2026-11-23").map((g) => g.nome)).toEqual([
      "Gestora",
      "Não informado",
    ]);
  });
});
