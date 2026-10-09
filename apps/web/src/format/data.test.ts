/**
 * Testes do formatador central de datas (T154).
 *
 * O teste que mais importa aqui é o de **fuso**: a tarefa existe porque
 * `new Date("2026-10-08")` é meia-noite UTC e, a oeste de Greenwich, exibe o
 * dia anterior. Por isso vários casos abaixo trocam o fuso do processo e
 * exigem que a data civil **não se mova** — e que o instante **se mova**,
 * porque para ele converter é o correto.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  AUSENTE,
  FUSO_DE_NEGOCIO,
  formatarDiaCivil,
  formatarInstante,
  formatarMesReferencia,
} from "./data";

/**
 * Executa com outro fuso de processo.
 *
 * `process.env.TZ` só é relido pelo `Date` depois que o cache interno do V8 é
 * invalidado; `Date.prototype.toString()` o força. É a técnica usada para
 * provar que a data civil é imune ao ambiente.
 */
function comFuso<T>(tz: string, acao: () => T): T {
  const anterior = process.env.TZ;
  process.env.TZ = tz;
  new Date().toString();
  try {
    return acao();
  } finally {
    process.env.TZ = anterior;
    new Date().toString();
  }
}

afterEach(() => {
  new Date().toString();
});

describe("formatarDiaCivil", () => {
  it("T154.1 converte AAAA-MM-DD para DD/MM/AAAA", () => {
    expect(formatarDiaCivil("2026-10-08")).toBe("08/10/2026");
  });

  it("T154.2 preserva o 29 de fevereiro de ano bissexto", () => {
    expect(formatarDiaCivil("2024-02-29")).toBe("29/02/2024");
  });

  it("T154.3 aceita o ISO completo que o Prisma devolve para colunas @db.Date", () => {
    // `dataAdmissao` chega como `2026-01-05T00:00:00.000Z`: os dez primeiros
    // caracteres JÁ são o dia gravado.
    expect(formatarDiaCivil("2026-01-05T00:00:00.000Z")).toBe("05/01/2026");
  });

  it("T154.4 NÃO muda de dia com o fuso do processo — o ponto da tarefa", () => {
    // Em qualquer fuso a oeste de Greenwich, `new Date("2026-10-08")` exibiria
    // 07/10. Em qualquer fuso a leste, o inverso. A data civil não se move.
    for (const tz of [
      "UTC",
      "America/Sao_Paulo",
      "Pacific/Kiritimati", // UTC+14
      "Pacific/Niue", // UTC-11
      "Asia/Tokyo",
    ]) {
      expect(comFuso(tz, () => formatarDiaCivil("2026-10-08"))).toBe(
        "08/10/2026",
      );
      expect(comFuso(tz, () => formatarDiaCivil("2026-01-01"))).toBe(
        "01/01/2026",
      );
      expect(comFuso(tz, () => formatarDiaCivil("2026-12-31"))).toBe(
        "31/12/2026",
      );
    }
  });

  it("T154.5 ausente e inválido devolvem o traço, sem lançar e sem Invalid Date", () => {
    for (const v of [
      null,
      undefined,
      "",
      "   ",
      "não é data",
      "08/10/2026", // já formatado: não é ISO, não é entrada válida aqui
      "2026-13-01", // mês inexistente
      "2026-02-30", // dia inexistente
      "26-10-08", // ano com dois dígitos
    ]) {
      const saida = formatarDiaCivil(v as string | null | undefined);
      expect(saida).toBe(AUSENTE);
      expect(saida).not.toContain("Invalid");
      expect(saida).not.toContain("NaN");
    }
  });

  it("T154.6 nunca lança, para qualquer entrada", () => {
    const entradas: unknown[] = [
      0,
      1,
      {},
      [],
      true,
      Symbol("x"),
      () => {},
      new Date(),
    ];
    for (const v of entradas) {
      expect(() => formatarDiaCivil(v as never)).not.toThrow();
      expect(formatarDiaCivil(v as never)).toBe(AUSENTE);
    }
  });
});

describe("formatarMesReferencia", () => {
  it("T154.7 converte AAAA-MM para MM/AAAA", () => {
    expect(formatarMesReferencia("2026-03")).toBe("03/2026");
  });

  it("T154.8 aceita AAAA-MM-DD e ISO completo", () => {
    expect(formatarMesReferencia("2026-03-17")).toBe("03/2026");
    expect(formatarMesReferencia("2026-03-17T12:00:00.000Z")).toBe("03/2026");
  });

  it("T154.9 não muda com o fuso do processo", () => {
    for (const tz of ["UTC", "Pacific/Kiritimati", "Pacific/Niue"]) {
      expect(comFuso(tz, () => formatarMesReferencia("2026-01"))).toBe(
        "01/2026",
      );
      expect(comFuso(tz, () => formatarMesReferencia("2026-12"))).toBe(
        "12/2026",
      );
    }
  });

  it("T154.10 ausente e inválido devolvem o traço", () => {
    for (const v of [null, undefined, "", "2026-13", "xx-yy", "2026"]) {
      expect(formatarMesReferencia(v as string | null | undefined)).toBe(
        AUSENTE,
      );
    }
  });
});

describe("formatarInstante", () => {
  it("T154.11 exibe DD/MM/AAAA às HH:mm no fuso de negócio", () => {
    // 2026-10-08T15:30Z = 12:30 em São Paulo (UTC-3).
    expect(formatarInstante("2026-10-08T15:30:00.000Z")).toBe(
      "08/10/2026 às 12:30",
    );
  });

  it("T154.12 instante UTC que pertence ao DIA ANTERIOR em São Paulo", () => {
    // 2026-01-05T00:30Z ainda é 04/01 às 21:30 no Brasil. É justamente este
    // caso que o fatiamento de ISO em UTC exibia errado.
    expect(formatarInstante("2026-01-05T00:30:00.000Z")).toBe(
      "04/01/2026 às 21:30",
    );
  });

  it("T154.13 instante com offset explícito é convertido corretamente", () => {
    // 09:00 em Lisboa (+01:00) = 05:00 em São Paulo.
    expect(formatarInstante("2026-06-10T09:00:00+01:00")).toBe(
      "10/06/2026 às 05:00",
    );
    // O mesmo instante, escrito já em -03:00, dá o mesmo resultado.
    expect(formatarInstante("2026-06-10T05:00:00-03:00")).toBe(
      "10/06/2026 às 05:00",
    );
  });

  it("T154.14 relógio de 24 horas, sem AM/PM e sem hora 24", () => {
    // 23:45 em São Paulo.
    const noite = formatarInstante("2026-10-08T02:45:00.000Z");
    expect(noite).toBe("07/10/2026 às 23:45");
    expect(noite).not.toMatch(/AM|PM/i);

    // Meia-noite tem de ser 00, nunca 24.
    const meiaNoite = formatarInstante("2026-10-08T03:00:00.000Z");
    expect(meiaNoite).toBe("08/10/2026 às 00:00");
    expect(meiaNoite).not.toContain("24:");
  });

  it("T154.15 o resultado NÃO depende do fuso do processo", () => {
    // O instante é absoluto: lido de qualquer máquina, exibe a hora de SP.
    for (const tz of ["UTC", "Asia/Tokyo", "Pacific/Niue", "Europe/Lisbon"]) {
      expect(
        comFuso(tz, () => formatarInstante("2026-01-05T00:30:00.000Z")),
      ).toBe("04/01/2026 às 21:30");
    }
  });

  it("T154.16 ausente e inválido devolvem o traço, nunca Invalid Date", () => {
    for (const v of [
      null,
      undefined,
      "",
      "   ",
      "não é data",
      "2026-99-99T99:99:99Z",
    ]) {
      const saida = formatarInstante(v as string | null | undefined);
      expect(saida).toBe(AUSENTE);
      expect(saida).not.toContain("Invalid");
      expect(saida).not.toContain("NaN");
    }
  });

  it("T154.17 nunca lança, para qualquer entrada", () => {
    for (const v of [0, {}, [], true, () => {}]) {
      expect(() => formatarInstante(v as never)).not.toThrow();
      expect(formatarInstante(v as never)).toBe(AUSENTE);
    }
  });

  it("T154.18 o fuso de negócio é o mesmo que o servidor usa", () => {
    expect(FUSO_DE_NEGOCIO).toBe("America/Sao_Paulo");
  });

  it("T154.21 horário de verão histórico sai do IANA, não de um offset fixo", () => {
    // O Brasil teve horário de verão até 2019. Em janeiro de 2018 São Paulo
    // estava em UTC-2; em julho, UTC-3. Quem subtrai três horas na mão erra
    // metade do ano — por isso a conversão é do `Intl`, com o fuso IANA.
    expect(formatarInstante("2018-01-15T12:00:00.000Z")).toBe(
      "15/01/2018 às 10:00",
    );
    expect(formatarInstante("2018-07-15T12:00:00.000Z")).toBe(
      "15/07/2018 às 09:00",
    );
    // Depois de 2019 não há mais verão: janeiro e julho ficam ambos em UTC-3.
    expect(formatarInstante("2026-01-15T12:00:00.000Z")).toBe(
      "15/01/2026 às 09:00",
    );
    expect(formatarInstante("2026-07-15T12:00:00.000Z")).toBe(
      "15/07/2026 às 09:00",
    );
  });
});

/**
 * R1 — o instante precisa ser inequívoco.
 *
 * `new Date("2026-10-08T15:30:00")` é lido como hora LOCAL do processo. O
 * mesmo valor renderizaria 12:30 numa máquina em UTC e 03:30 em Tóquio: a
 * tela passaria a depender de onde o código roda. A função recusa a entrada
 * em vez de exibir uma hora plausível e errada.
 */
describe("formatarInstante — só aceita instante inequívoco", () => {
  const FUSOS = [
    "UTC",
    "America/Sao_Paulo",
    "Asia/Tokyo",
    "Pacific/Niue",
    "Pacific/Kiritimati",
    "Europe/Lisbon",
    "America/Los_Angeles",
  ];

  it("T154.22 com Z, a saída é a mesma em qualquer fuso de processo", () => {
    for (const tz of FUSOS) {
      expect(
        comFuso(tz, () => formatarInstante("2026-10-08T15:30:00.000Z")),
      ).toBe("08/10/2026 às 12:30");
      expect(comFuso(tz, () => formatarInstante("2026-01-05T00:30:00Z"))).toBe(
        "04/01/2026 às 21:30",
      );
    }
  });

  it("T154.23 com offset explícito, a saída é a mesma em qualquer fuso", () => {
    // Três grafias do MESMO instante — têm de dar exatamente o mesmo texto.
    const grafias = [
      "2026-06-10T09:00:00+01:00",
      "2026-06-10T05:00:00-03:00",
      "2026-06-10T08:00:00.000Z",
    ];
    for (const tz of FUSOS) {
      for (const g of grafias) {
        expect(comFuso(tz, () => formatarInstante(g))).toBe(
          "10/06/2026 às 05:00",
        );
      }
    }
  });

  it("T154.24 instante SEM fuso devolve o traço — em qualquer fuso de processo", () => {
    const ambiguos = [
      "2026-10-08T15:30:00",
      "2026-10-08T15:30",
      "2026-10-08T15:30:00.000",
      "2026-01-05T00:30:00",
    ];
    for (const tz of FUSOS) {
      for (const v of ambiguos) {
        expect(comFuso(tz, () => formatarInstante(v))).toBe(AUSENTE);
      }
    }
  });

  it("T154.25 data civil não é instante", () => {
    for (const v of ["2026-10-08", "2026-10", "2026"]) {
      expect(formatarInstante(v)).toBe(AUSENTE);
    }
    // E continua sendo tratada pela função certa.
    expect(formatarDiaCivil("2026-10-08")).toBe("08/10/2026");
  });

  it("T154.26 espaço no lugar do T é recusado — nenhuma API nossa emite isso", () => {
    for (const v of [
      "2026-10-08 15:30:00Z",
      "2026-10-08 15:30:00",
      "2026-10-08 15:30:00-03:00",
    ]) {
      expect(formatarInstante(v)).toBe(AUSENTE);
    }
  });

  it("T154.27 valores parcialmente válidos são recusados", () => {
    for (const v of [
      "2026-10-08T15Z", // sem minutos
      "2026-10-08T15:Z", // minuto vazio
      "2026-10-08T15:30:00ZZ", // sufixo duplicado
      "2026-10-08T15:30:00Z extra", // lixo depois
      "antes 2026-10-08T15:30:00Z", // lixo antes
      "2026-10-08T15:30:00+03", // offset sem minutos
      "2026-10-08T15:30:00+0300", // offset sem dois-pontos
      "2026-13-08T15:30:00Z", // mês inexistente
      "2026-02-30T15:30:00Z", // dia inexistente
      "2026-10-08T24:00:00Z", // hora 24
      "2026-10-08T15:60:00Z", // minuto 60
      "2026-10-08T15:30:60Z", // segundo 60
    ]) {
      expect(formatarInstante(v)).toBe(AUSENTE);
      expect(formatarInstante(v)).not.toContain("Invalid");
    }
  });

  it("T154.28 offset impossível é recusado", () => {
    for (const v of [
      "2026-10-08T15:30:00+25:00",
      "2026-10-08T15:30:00-24:00",
      "2026-10-08T15:30:00+05:99",
      "2026-10-08T15:30:00+99:99",
    ]) {
      expect(formatarInstante(v)).toBe(AUSENTE);
    }
    // O limite válido continua passando.
    expect(formatarInstante("2026-10-08T15:30:00+23:59")).not.toBe(AUSENTE);
  });

  it("T154.29 fração de segundo em qualquer precisão é aceita", () => {
    for (const v of [
      "2026-10-08T15:30:00.0Z",
      "2026-10-08T15:30:00.000Z",
      "2026-10-08T15:30:00.123456Z",
      "2026-10-08T15:30:00Z",
      "2026-10-08T15:30Z",
    ]) {
      expect(formatarInstante(v)).toBe("08/10/2026 às 12:30");
    }
  });

  it("T154.30 espaço em volta não muda o resultado", () => {
    expect(formatarInstante("  2026-10-08T15:30:00Z  ")).toBe(
      "08/10/2026 às 12:30",
    );
  });
});

describe("contrato do módulo", () => {
  it("T154.19 nenhuma saída contém ISO cru", () => {
    const saidas = [
      formatarDiaCivil("2026-10-08"),
      formatarDiaCivil("2026-01-05T00:00:00.000Z"),
      formatarMesReferencia("2026-03"),
      formatarInstante("2026-10-08T15:30:00.000Z"),
    ];
    for (const s of saidas) {
      expect(s).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(s).not.toContain("T00:");
      expect(s).not.toContain("Z");
    }
  });

  it("T154.20 o traço é o mesmo caractere usado no produto", () => {
    expect(AUSENTE).toBe("—");
  });
});
