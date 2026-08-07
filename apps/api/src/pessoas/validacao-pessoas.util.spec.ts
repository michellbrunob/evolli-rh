import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { StatusMovimentacao, TipoMovimentacao } from "@prisma/client";
import {
  assertDestinoCoerente,
  assertSituacaoVinculoParaEfetivar,
  assertSucessaoCoerente,
  assertTransicaoMovimentacao,
  assertVigenciaAlcancada,
  assertVigenciaCoerente,
  dataUtc,
  produzAlocacao,
} from "./validacao-pessoas.util";
import { DestinoOrganizacional } from "./pessoas.types";

const VAZIO: DestinoOrganizacional = {
  unidadeOrganizacionalId: null,
  departamentoId: null,
  areaId: null,
  equipeId: null,
  cargoId: null,
  centroCustoId: null,
};

const D = (data: string) => dataUtc(new Date(data));

const TODOS_STATUS: readonly StatusMovimentacao[] = [
  "solicitada",
  "programada",
  "efetivada",
  "cancelada",
  "retificada",
];

describe("Máquina de estados da movimentação (spec §8)", () => {
  const PERMITIDAS: ReadonlyArray<[StatusMovimentacao, StatusMovimentacao]> = [
    ["solicitada", "efetivada"],
    ["solicitada", "cancelada"],
    ["programada", "efetivada"],
    ["programada", "cancelada"],
    ["efetivada", "retificada"],
  ];

  it.each(PERMITIDAS)("permite %s -> %s", (de, para) => {
    expect(() => assertTransicaoMovimentacao(de, para)).not.toThrow();
  });

  it("recusa toda transição não listada, célula a célula", () => {
    const permitidas = new Set(
      PERMITIDAS.map(([de, para]) => `${de}->${para}`),
    );
    for (const de of TODOS_STATUS) {
      for (const para of TODOS_STATUS) {
        if (permitidas.has(`${de}->${para}`)) continue;
        expect(() => assertTransicaoMovimentacao(de, para)).toThrow(
          ConflictException,
        );
      }
    }
  });

  it("de `efetivada` a única saída é `retificada` (RI-M1)", () => {
    for (const para of TODOS_STATUS) {
      if (para === "retificada") continue;
      expect(() => assertTransicaoMovimentacao("efetivada", para)).toThrow(
        ConflictException,
      );
    }
  });

  it("`cancelada` e `retificada` são terminais", () => {
    for (const de of ["cancelada", "retificada"] as const) {
      for (const para of TODOS_STATUS) {
        expect(() => assertTransicaoMovimentacao(de, para)).toThrow(
          ConflictException,
        );
      }
    }
  });
});

describe("Situação exigida do vínculo por tipo de movimentação", () => {
  it("admissão só efetiva sobre vínculo `previsto`", () => {
    expect(() =>
      assertSituacaoVinculoParaEfetivar("admissao", "previsto"),
    ).not.toThrow();
    for (const situacao of ["ativo", "encerrado"] as const) {
      expect(() =>
        assertSituacaoVinculoParaEfetivar("admissao", situacao),
      ).toThrow(ConflictException);
    }
  });

  it.each([
    "transferencia_organizacional",
    "mudanca_cargo",
    "desligamento",
  ] as const)("%s só efetiva sobre vínculo `ativo`", (tipo) => {
    expect(() =>
      assertSituacaoVinculoParaEfetivar(tipo, "ativo"),
    ).not.toThrow();
    for (const situacao of ["previsto", "encerrado"] as const) {
      expect(() => assertSituacaoVinculoParaEfetivar(tipo, situacao)).toThrow(
        ConflictException,
      );
    }
  });
});

describe("Destino organizacional (Baseline V1, item 10)", () => {
  const COM_DEPARTAMENTO: DestinoOrganizacional = {
    ...VAZIO,
    departamentoId: "dept-1",
  };

  const QUE_ALOCAM: readonly TipoMovimentacao[] = [
    "admissao",
    "transferencia_organizacional",
    "mudanca_cargo",
  ];

  it.each(QUE_ALOCAM)("%s exige ao menos uma referência", (tipo) => {
    expect(() => assertDestinoCoerente(tipo, VAZIO)).toThrow(
      UnprocessableEntityException,
    );
    expect(() => assertDestinoCoerente(tipo, COM_DEPARTAMENTO)).not.toThrow();
  });

  it("desligamento não aceita destino — não realoca ninguém", () => {
    expect(() => assertDestinoCoerente("desligamento", VAZIO)).not.toThrow();
    expect(() =>
      assertDestinoCoerente("desligamento", COM_DEPARTAMENTO),
    ).toThrow(UnprocessableEntityException);
  });

  it("área sem departamento é recusada (a FK composta não seria verificada)", () => {
    expect(() =>
      assertDestinoCoerente("admissao", { ...VAZIO, areaId: "area-1" }),
    ).toThrow(UnprocessableEntityException);

    expect(() =>
      assertDestinoCoerente("admissao", {
        ...VAZIO,
        areaId: "area-1",
        departamentoId: "dept-1",
      }),
    ).not.toThrow();
  });

  it("só desligamento não produz alocação", () => {
    expect(produzAlocacao("desligamento")).toBe(false);
    for (const tipo of QUE_ALOCAM) {
      expect(produzAlocacao(tipo)).toBe(true);
    }
  });
});

describe("Coerência de datas", () => {
  it("vigência nunca precede a admissão (RI-M4)", () => {
    expect(() =>
      assertVigenciaCoerente(D("2026-01-01"), D("2026-02-01"), null),
    ).toThrow(UnprocessableEntityException);

    expect(() =>
      assertVigenciaCoerente(D("2026-02-01"), D("2026-02-01"), null),
    ).not.toThrow();
  });

  it("vigência nunca sucede um desligamento já efetivado", () => {
    expect(() =>
      assertVigenciaCoerente(D("2026-06-01"), D("2026-01-01"), D("2026-03-01")),
    ).toThrow(UnprocessableEntityException);
  });

  it("sucessão exige vigência estritamente posterior ao início vigente", () => {
    // `vigente_ate` é exclusivo: fechar no mesmo dia produziria intervalo
    // vazio, que o CHECK do banco recusa.
    expect(() =>
      assertSucessaoCoerente(D("2026-03-01"), D("2026-03-01")),
    ).toThrow(UnprocessableEntityException);

    expect(() =>
      assertSucessaoCoerente(D("2026-03-02"), D("2026-03-01")),
    ).not.toThrow();
  });

  it("movimentação programada não é efetivada antes da vigência", () => {
    expect(() =>
      assertVigenciaAlcancada(D("2026-12-31"), D("2026-08-07")),
    ).toThrow(ConflictException);

    expect(() =>
      assertVigenciaAlcancada(D("2026-08-07"), D("2026-08-07")),
    ).not.toThrow();
  });

  it("dataUtc zera a hora, para comparar com coluna DATE", () => {
    const resultado = dataUtc(new Date("2026-08-07T23:45:12.500Z"));
    expect(resultado.toISOString()).toBe("2026-08-07T00:00:00.000Z");
  });
});
