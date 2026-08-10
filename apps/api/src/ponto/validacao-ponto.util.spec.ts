import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AjustePonto, EventoPonto } from "@prisma/client";
import {
  competenciaDe,
  dataDeColunaDate,
  dataLocalDe,
  FUSO_COMPETENCIA,
} from "./competencia.util";
import {
  assertAjusteMantemCompetencia,
  assertEventoAjustavel,
  assertVinculoAceitaPonto,
  resolverEfetivo,
  VinculoParaPonto,
} from "./validacao-ponto.util";

type AjusteAplicavel = Pick<
  AjustePonto,
  "anula" | "momentoCorrigido" | "tipoCorrigido" | "registradoEm"
>;

function ajuste(parcial: Partial<AjusteAplicavel>): AjusteAplicavel {
  return {
    anula: false,
    momentoCorrigido: null,
    tipoCorrigido: null,
    registradoEm: new Date("2026-08-20T12:00:00Z"),
    ...parcial,
  };
}

function evento(
  parcial: Partial<Pick<EventoPonto, "tipo" | "momento">> = {},
): Pick<EventoPonto, "tipo" | "momento"> {
  return {
    tipo: "entrada",
    momento: new Date("2026-08-10T11:00:00Z"),
    ...parcial,
  };
}

function vinculo(parcial: Partial<VinculoParaPonto> = {}): VinculoParaPonto {
  return {
    situacao: "ativo",
    dataAdmissao: new Date("2026-08-01T00:00:00Z"),
    dataDesligamento: null,
    ...parcial,
  };
}

describe("competencia — ancoragem em fuso declarado", () => {
  it("usa o fuso local, nao UTC", () => {
    // 2026-08-01T02:00Z e 2026-07-31 23:00 em America/Sao_Paulo (UTC-3).
    // Este e o caso que motiva gravar a competencia em vez de deriva-la: os
    // dois fusos dao MESES diferentes para o mesmo instante.
    expect(FUSO_COMPETENCIA).toBe("America/Sao_Paulo");
    expect(competenciaDe(new Date("2026-08-01T02:00:00Z"))).toBe("2026-07");
    expect(competenciaDe(new Date("2026-08-01T12:00:00Z"))).toBe("2026-08");
  });

  it("fecha a virada do mes no horario local, nao no UTC", () => {
    // 23:59:59 local do ultimo dia de julho ainda e julho.
    expect(competenciaDe(new Date("2026-08-01T02:59:59Z"))).toBe("2026-07");
    // 00:00 local do dia 1 de agosto ja e agosto.
    expect(competenciaDe(new Date("2026-08-01T03:00:00Z"))).toBe("2026-08");
  });

  it("formata mes com zero a esquerda", () => {
    expect(competenciaDe(new Date("2026-01-15T15:00:00Z"))).toBe("2026-01");
    expect(competenciaDe(new Date("2026-12-15T15:00:00Z"))).toBe("2026-12");
  });

  it("dataLocalDe segue o mesmo fuso da competencia", () => {
    expect(dataLocalDe(new Date("2026-08-01T02:00:00Z"))).toBe("2026-07-31");
    expect(dataLocalDe(new Date("2026-08-01T12:00:00Z"))).toBe("2026-08-01");
  });

  it("dataDeColunaDate le a data sem reintroduzir fuso", () => {
    // Coluna `date` chega como meia-noite UTC; converter para local a jogaria
    // para o dia anterior.
    expect(dataDeColunaDate(new Date("2026-08-01T00:00:00Z"))).toBe(
      "2026-08-01",
    );
  });
});

describe("assertVinculoAceitaPonto", () => {
  it("aceita vinculo ativo dentro da vigencia", () => {
    expect(() =>
      assertVinculoAceitaPonto(vinculo(), new Date("2026-08-10T11:00:00Z")),
    ).not.toThrow();
  });

  it("recusa vinculo previsto", () => {
    expect(() =>
      assertVinculoAceitaPonto(
        vinculo({ situacao: "previsto" }),
        new Date("2026-08-10T11:00:00Z"),
      ),
    ).toThrow(UnprocessableEntityException);
  });

  it("ACEITA vinculo encerrado — corrigir o ultimo mes de um desligado e rotina de DP", () => {
    expect(() =>
      assertVinculoAceitaPonto(
        vinculo({
          situacao: "encerrado",
          dataDesligamento: new Date("2026-08-31T00:00:00Z"),
        }),
        new Date("2026-08-28T11:00:00Z"),
      ),
    ).not.toThrow();
  });

  it("recusa momento anterior a admissao", () => {
    expect(() =>
      assertVinculoAceitaPonto(vinculo(), new Date("2026-07-31T11:00:00Z")),
    ).toThrow(UnprocessableEntityException);
  });

  it("recusa momento posterior ao desligamento", () => {
    expect(() =>
      assertVinculoAceitaPonto(
        vinculo({
          situacao: "encerrado",
          dataDesligamento: new Date("2026-08-31T00:00:00Z"),
        }),
        new Date("2026-09-01T11:00:00Z"),
      ),
    ).toThrow(UnprocessableEntityException);
  });

  it("aceita o PRIMEIRO e o ULTIMO dia da vigencia — fronteiras inclusivas", () => {
    const v = vinculo({
      situacao: "encerrado",
      dataAdmissao: new Date("2026-08-01T00:00:00Z"),
      dataDesligamento: new Date("2026-08-31T00:00:00Z"),
    });

    // 08:00 local do dia da admissao.
    expect(() =>
      assertVinculoAceitaPonto(v, new Date("2026-08-01T11:00:00Z")),
    ).not.toThrow();
    // 20:00 local do dia do desligamento.
    expect(() =>
      assertVinculoAceitaPonto(v, new Date("2026-08-31T23:00:00Z")),
    ).not.toThrow();
  });

  it("a fronteira e avaliada em data LOCAL — 02:00Z do dia 1 ainda e o dia 31 anterior", () => {
    // Sem a conversao de fuso, este caso passaria por engano: o instante
    // "parece" 2026-08-01 em UTC, mas localmente ainda e 2026-07-31, antes da
    // admissao.
    expect(() =>
      assertVinculoAceitaPonto(vinculo(), new Date("2026-08-01T02:00:00Z")),
    ).toThrow(UnprocessableEntityException);
  });
});

describe("assertAjusteMantemCompetencia", () => {
  it("aceita correcao dentro da mesma competencia", () => {
    expect(() =>
      assertAjusteMantemCompetencia(
        "2026-08",
        new Date("2026-08-20T11:00:00Z"),
      ),
    ).not.toThrow();
  });

  it("recusa correcao que moveria o evento para outro mes", () => {
    expect(() =>
      assertAjusteMantemCompetencia(
        "2026-08",
        new Date("2026-09-02T11:00:00Z"),
      ),
    ).toThrow(UnprocessableEntityException);
  });
});

describe("assertEventoAjustavel — anulacao e terminal", () => {
  it("permite ajuste sobre evento nao anulado", () => {
    expect(() =>
      assertEventoAjustavel({
        tipo: "entrada",
        momento: new Date(),
        anulado: false,
        totalAjustes: 1,
      }),
    ).not.toThrow();
  });

  it("recusa novo ajuste sobre evento ja anulado", () => {
    expect(() =>
      assertEventoAjustavel({
        tipo: "entrada",
        momento: new Date(),
        anulado: true,
        totalAjustes: 1,
      }),
    ).toThrow(ConflictException);
  });
});

describe("resolverEfetivo", () => {
  it("sem ajuste, o efetivo e o original intacto", () => {
    const original = evento();
    const efetivo = resolverEfetivo(original, []);

    expect(efetivo).toEqual({
      tipo: original.tipo,
      momento: original.momento,
      anulado: false,
      totalAjustes: 0,
    });
  });

  it("aplica correcao de momento sem tocar o tipo", () => {
    const corrigido = new Date("2026-08-10T11:30:00Z");
    const efetivo = resolverEfetivo(evento(), [
      ajuste({ momentoCorrigido: corrigido }),
    ]);

    expect(efetivo.momento).toEqual(corrigido);
    expect(efetivo.tipo).toBe("entrada");
    expect(efetivo.anulado).toBe(false);
  });

  it("aplica correcao de tipo sem tocar o momento", () => {
    const original = evento();
    const efetivo = resolverEfetivo(original, [
      ajuste({ tipoCorrigido: "saida" }),
    ]);

    expect(efetivo.tipo).toBe("saida");
    expect(efetivo.momento).toEqual(original.momento);
  });

  it("na cadeia, o ajuste MAIS RECENTE vence", () => {
    const primeiro = new Date("2026-08-10T11:30:00Z");
    const segundo = new Date("2026-08-10T11:45:00Z");

    const efetivo = resolverEfetivo(evento(), [
      ajuste({
        momentoCorrigido: primeiro,
        registradoEm: new Date("2026-08-20T10:00:00Z"),
      }),
      ajuste({
        momentoCorrigido: segundo,
        registradoEm: new Date("2026-08-21T10:00:00Z"),
      }),
    ]);

    expect(efetivo.momento).toEqual(segundo);
    expect(efetivo.totalAjustes).toBe(2);
  });

  it("anulacao marca o evento como anulado", () => {
    const efetivo = resolverEfetivo(evento(), [ajuste({ anula: true })]);
    expect(efetivo.anulado).toBe(true);
  });

  it("um ajuste inserido POR FORA da API depois de uma anulacao nao a desfaz", () => {
    // A API impede este caso (`assertEventoAjustavel`), mas SQL direto ou
    // manutencao manual poderiam inseri-lo. A leitura precisa continuar
    // correta: o evento segue anulado.
    const efetivo = resolverEfetivo(evento(), [
      ajuste({ anula: true, registradoEm: new Date("2026-08-20T10:00:00Z") }),
      ajuste({
        momentoCorrigido: new Date("2026-08-10T12:00:00Z"),
        registradoEm: new Date("2026-08-21T10:00:00Z"),
      }),
    ]);

    expect(efetivo.anulado).toBe(true);
  });

  it("nunca muta o evento original", () => {
    const original = evento();
    const momentoOriginal = original.momento;

    resolverEfetivo(original, [
      ajuste({ momentoCorrigido: new Date("2026-08-10T23:00:00Z") }),
      ajuste({ tipoCorrigido: "fim_pausa" }),
    ]);

    expect(original.momento).toEqual(momentoOriginal);
    expect(original.tipo).toBe("entrada");
  });
});
