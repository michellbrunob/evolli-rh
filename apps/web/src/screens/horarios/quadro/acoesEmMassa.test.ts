import { describe, expect, it } from "vitest";
import type { DiaGravadoApi } from "../../../api/escalaClient";
import type { TabelaHorarioApi } from "../../../api/horariosClient";
import {
  chaveDoDia,
  copiarDias,
  darFolga,
  pessoasDoLote,
  planoParaDesfazer,
  rascunhosDe,
  rascunhosPorChave,
  semanasAte,
  trocarTurno,
  valorDaCelula,
} from "./acoesEmMassa";
import {
  celulaDoDia,
  diasDoPeriodo,
  juntarPessoaDoPeriodo,
} from "./quadroDaEscala";
import { escala, pessoa } from "./fixturasDoQuadro";

const SEMANA = diasDoPeriodo("2026-11-23", "2026-11-29");
const ANTERIOR = diasDoPeriodo("2026-11-16", "2026-11-22");

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

const AUSENCIA = {
  id: "x",
  tipo: "ferias" as const,
  motivoAfastamento: null,
  inicio: "2026-11-24",
  fim: "2026-11-25",
};

const LOJA: TabelaHorarioApi = {
  id: "t-loja",
  empresaId: "e",
  codigo: null,
  nome: "Loja",
  ativo: true,
  criadoPorUserId: "u",
  criadoEm: "",
  atualizadoEm: "",
  periodos: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"].map(
    (dia) => ({ dia, inicio: "10:00", fim: "19:00" }),
  ),
  intervaloMinutos: 60,
};

describe("T215 — ações em massa (puras)", () => {
  it("valor da célula: padrão com turno vira trabalho completo; sem escala, nenhum", () => {
    const p = pessoa("Ana", { escalas: [escala()] });
    expect(valorDaCelula(celulaDoDia(p, "2026-11-23"))).toEqual({
      tipo: "trabalho",
      tabelaHorarioId: "t-Comercial",
      intervaloMinutos: 60,
      sobreaviso: [],
      periodos: [{ inicio: "09:00", fim: "18:00" }],
      unidadeOrganizacionalId: null,
      observacao: null,
    });
    expect(valorDaCelula(celulaDoDia(p, "2026-11-29"))).toEqual({
      tipo: "dsr",
      observacao: null,
    });
    expect(valorDaCelula(celulaDoDia(pessoa("Bia"), "2026-11-23"))).toBeNull();
  });

  it("copiar semana anterior: o gravado da origem vai ao destino; o padrão da origem limpa o destino; fora do vínculo não entra", () => {
    const origem = pessoa("Ana", {
      colaboradorId: "c-ana",
      escalas: [escala()],
      dias: [
        gravado("2026-11-16", { tipo: "dsr", observacao: "Troca" }),
        gravado("2026-11-17", { camada: "publicado", tipo: "folga" }),
      ],
    });
    const atual = pessoa("Ana", {
      colaboradorId: "c-ana",
      dataAdmissao: "2026-11-01",
      dataDesligamento: "2026-11-27",
      escalas: [escala()],
    });
    const plano = copiarDias(
      [atual],
      new Map([["c-ana", origem]]),
      ANTERIOR,
      SEMANA,
    );
    expect(plano.gravar).toEqual([
      {
        colaboradorId: "c-ana",
        dia: "2026-11-23",
        tipo: "dsr",
        observacao: "Troca",
      },
      {
        colaboradorId: "c-ana",
        dia: "2026-11-24",
        tipo: "folga",
        observacao: null,
      },
    ]);
    // 25, 26, 27 vêm do padrão na origem; 28 e 29 estão fora do vínculo.
    expect(plano.limpar.map((d) => d.dia)).toEqual([
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
    ]);
    expect(pessoasDoLote(plano)).toBe(1);
  });

  it("semanas até a data: as semanas seguintes inteiras e a última cortada", () => {
    const s = semanasAte("2026-11-23", "2026-12-09");
    expect(s.map((w) => [w[0], w[w.length - 1]])).toEqual([
      ["2026-11-30", "2026-12-06"],
      ["2026-12-07", "2026-12-09"],
    ]);
    expect(semanasAte("2026-11-23", "2026-11-29")).toEqual([]);
  });

  it("trocar turno: só onde já há turno, nos dias escolhidos; o igual não conta; também nas folgas", () => {
    const p = pessoa("Ana", {
      colaboradorId: "c-ana",
      escalas: [escala()],
      dias: [gravado("2026-11-24", { observacao: "Médico" })],
    });
    const so = trocarTurno([p], {
      turno: LOJA,
      de: "2026-11-23",
      ate: "2026-11-29",
      diasDaSemana: new Set([1, 2, 3, 6]),
      tambemNasFolgas: false,
    });
    // Seg e qua têm turno; ter é folga gravada; sáb é folga do padrão.
    expect(so.plano.gravar.map((d) => d.dia)).toEqual([
      "2026-11-23",
      "2026-11-25",
    ]);
    expect(so.plano.gravar[0]).toMatchObject({
      tipo: "trabalho",
      tabelaHorarioId: "t-loja",
      periodos: [{ inicio: "10:00", fim: "19:00" }],
      intervaloMinutos: 60,
    });
    expect(so.mudancas).toEqual([
      { colaboradorId: "c-ana", nome: "Ana", dias: 2, iguais: 0 },
    ]);

    const todas = trocarTurno([p], {
      turno: LOJA,
      de: "2026-11-23",
      ate: "2026-11-29",
      diasDaSemana: new Set([1, 2, 3, 6, 7]),
      tambemNasFolgas: true,
    });
    // Turno de mesmo horário todo dia vale em qualquer dia (como no padrão),
    // domingo incluso. A observação do dia fica.
    expect(todas.plano.gravar.map((d) => d.dia)).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-28",
      "2026-11-29",
    ]);
    expect(todas.plano.gravar[1]).toMatchObject({ observacao: "Médico" });

    const igual = trocarTurno([p], {
      turno: { ...LOJA, id: "t-Comercial", nome: "Comercial" },
      de: "2026-11-23",
      ate: "2026-11-23",
      diasDaSemana: new Set([1]),
      tambemNasFolgas: false,
    });
    expect(igual.mudancas[0]).toMatchObject({ dias: 0, iguais: 1 });
  });

  it("dar folga: Folga ou DSR, só para quem está no vínculo no dia", () => {
    const a = pessoa("A", { colaboradorId: "a", escalas: [escala()] });
    const b = pessoa("B", { colaboradorId: "b", dataAdmissao: "2026-12-01" });
    expect(darFolga([a, b], "2026-11-25", "dsr").gravar).toEqual([
      { colaboradorId: "a", dia: "2026-11-25", tipo: "dsr", observacao: null },
    ]);
  });

  it("ausência aprovada vence o turno: dar folga, trocar turno e copiar deixam o dia como está", () => {
    const a = pessoa("A", {
      colaboradorId: "a",
      escalas: [escala()],
      ausencias: [
        {
          id: "x",
          tipo: "ferias" as const,
          motivoAfastamento: null,
          inicio: "2026-11-24",
          fim: "2026-11-25",
        },
      ],
    });
    const b = pessoa("B", { colaboradorId: "b", escalas: [escala()] });
    expect(
      darFolga([a, b], "2026-11-25", "folga").gravar.map(
        (g) => g.colaboradorId,
      ),
    ).toEqual(["b"]);
    expect(valorDaCelula(celulaDoDia(a, "2026-11-24"))).toBeNull();
    const troca = trocarTurno([a], {
      turno: LOJA,
      de: "2026-11-23",
      ate: "2026-11-27",
      diasDaSemana: new Set([1, 2, 3, 4, 5]),
      tambemNasFolgas: false,
    });
    expect(troca.plano.gravar.map((g) => g.dia)).toEqual([
      "2026-11-23",
      "2026-11-26",
      "2026-11-27",
    ]);
    // Nem com "Também nas folgas" a ausência recebe turno.
    const nasFolgas = trocarTurno([a], {
      turno: LOJA,
      de: "2026-11-23",
      ate: "2026-11-27",
      diasDaSemana: new Set([1, 2, 3, 4, 5]),
      tambemNasFolgas: true,
    });
    expect(nasFolgas.plano.gravar.map((g) => g.dia)).not.toContain(
      "2026-11-24",
    );
    // A célula da ausência guarda a observação do dia gravado.
    const comObs = pessoa("A", {
      colaboradorId: "a",
      escalas: [escala()],
      ausencias: [AUSENCIA],
      dias: [gravado("2026-11-24", { observacao: "Combinado" })],
    });
    expect(celulaDoDia(comObs, "2026-11-24")).toMatchObject({
      tipo: "ausencia",
      origem: "rascunho",
      observacao: "Combinado",
    });
    // Copiar: destino em ausência fica; origem em ausência não se copia.
    const origem = pessoa("A", {
      colaboradorId: "a",
      escalas: [escala()],
      dias: ANTERIOR.map((d) => gravado(d)),
      ausencias: [
        {
          ...{
            id: "x",
            tipo: "ferias" as const,
            motivoAfastamento: null,
            inicio: "2026-11-24",
            fim: "2026-11-25",
          },
          inicio: "2026-11-20",
          fim: "2026-11-20",
        },
      ],
    });
    const plano = copiarDias([a], new Map([["a", origem]]), ANTERIOR, SEMANA);
    const tocados = [...plano.gravar, ...plano.limpar].map((d) => d.dia).sort();
    expect(tocados).toEqual([
      "2026-11-23",
      "2026-11-26",
      "2026-11-28",
      "2026-11-29",
    ]);
  });

  it("rascunhos e desfazer: regrava o anterior ou limpa", () => {
    const p = pessoa("A", {
      colaboradorId: "a",
      dias: [
        gravado("2026-11-23", { tipo: "dsr" }),
        gravado("2026-11-24", { camada: "publicado" }),
      ],
    });
    expect(rascunhosDe([p])).toEqual([
      { colaboradorId: "a", dia: "2026-11-23" },
    ]);
    const anteriores = rascunhosPorChave([p]);
    expect([...anteriores.keys()]).toEqual([chaveDoDia("a", "2026-11-23")]);
    const volta = planoParaDesfazer(
      {
        gravar: [
          { colaboradorId: "a", dia: "2026-11-23", tipo: "folga" },
          { colaboradorId: "a", dia: "2026-11-25", tipo: "folga" },
        ],
        limpar: [{ colaboradorId: "a", dia: "2026-11-23" }],
      },
      anteriores,
    );
    expect(volta.gravar).toEqual([
      { colaboradorId: "a", dia: "2026-11-23", tipo: "dsr", observacao: null },
    ]);
    expect(volta.limpar).toEqual([{ colaboradorId: "a", dia: "2026-11-25" }]);
  });

  it("copiar sobre um destino já publicado diferente do padrão: o rascunho recebe o dia resolvido da origem", () => {
    // Origem (semana anterior) só no padrão 5x2; destino com a terça e a
    // quarta publicadas: a terça como folga (difere do padrão), a quarta
    // igual ao padrão.
    const origem = pessoa("Ana", {
      colaboradorId: "c-ana",
      escalas: [escala()],
    });
    const padraoDaQuarta = celulaDoDia(origem, "2026-11-25");
    const destino = pessoa("Ana", {
      colaboradorId: "c-ana",
      escalas: [escala()],
      dias: [
        gravado("2026-11-24", { camada: "publicado", tipo: "folga" }),
        gravado("2026-11-25", {
          camada: "publicado",
          tipo: "trabalho",
          turno: padraoDaQuarta.turno as DiaGravadoApi["turno"],
          periodos: [...padraoDaQuarta.periodos],
          intervaloMinutos: padraoDaQuarta.intervaloMinutos,
        }),
      ],
    });
    const plano = copiarDias(
      [destino],
      new Map([["c-ana", origem]]),
      ANTERIOR,
      SEMANA,
    );
    // A terça reproduz a segunda-feira anterior pelo padrão (trabalho).
    expect(plano.gravar).toEqual([
      {
        colaboradorId: "c-ana",
        dia: "2026-11-24",
        tipo: "trabalho",
        tabelaHorarioId: "t-Comercial",
        intervaloMinutos: 60,
        sobreaviso: [],
        periodos: [{ inicio: "09:00", fim: "18:00" }],
        unidadeOrganizacionalId: null,
        observacao: null,
      },
    ]);
    // A quarta publicada igual ao padrão e os dias sem publicado: limpa.
    expect(plano.limpar.map((d) => d.dia)).toEqual([
      "2026-11-23",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
    ]);
  });

  it("repetir por mais de 42 dias: as férias do segundo bloco de consulta continuam valendo", () => {
    const primeiro = pessoa("Ana", {
      colaboradorId: "c-ana",
      escalas: [escala()],
      ausencias: [{ ...AUSENCIA, id: "a1" }],
    });
    // O 2º bloco traz outra ausência (férias em janeiro).
    const segundo = pessoa("Ana", {
      colaboradorId: "c-ana",
      escalas: [escala()],
      ausencias: [
        {
          ...AUSENCIA,
          id: "a2",
          inicio: "2027-01-11",
          fim: "2027-01-15",
        },
      ],
    });
    const junto = juntarPessoaDoPeriodo(
      juntarPessoaDoPeriodo(undefined, primeiro),
      segundo,
    );
    expect(junto.ausencias?.map((a) => a.id)).toEqual(["a1", "a2"]);
    // Sem repetir: o mesmo bloco de novo não duplica.
    expect(juntarPessoaDoPeriodo(junto, segundo).ausencias).toHaveLength(2);
    // Repetir a semana até janeiro não grava trabalho nas férias do 2º bloco.
    const plano = copiarDias(
      [junto],
      new Map([["c-ana", primeiro]]),
      diasDoPeriodo("2026-11-16", "2026-11-20"),
      diasDoPeriodo("2027-01-11", "2027-01-15"),
    );
    expect(plano.gravar).toEqual([]);
    expect(plano.limpar).toEqual([]);
  });
});
