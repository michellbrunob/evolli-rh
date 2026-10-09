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

  it("T154.8 NÃO deriva competência de data completa — só AAAA-MM", () => {
    // Mudou nesta rodada, e de propósito. A versão anterior casava só o
    // PREFIXO, então `2026-10-xx` e `2026-1013` rendiam `10/2026` como se
    // fossem válidos. A medição dos call sites reais mostrou 388 entradas,
    // todas `AAAA-MM` — a competência vem de `<input type="month">`. Aceitar
    // mais que isso só servia para transformar lixo em competência plausível.
    expect(formatarMesReferencia("2026-03-17")).toBe(AUSENTE);
    expect(formatarMesReferencia("2026-03-17T12:00:00.000Z")).toBe(AUSENTE);
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
    // MUDOU nesta rodada: o limite passou a ser o do mundo real (±14:00), e
    // não mais o da gramática da linguagem (hora 00–23). `+23:59` tem forma
    // de fuso, mas fuso nenhum fica a 23h59 de Greenwich.
    expect(formatarInstante("2026-10-08T15:30:00+23:59")).toBe(AUSENTE);
    // O maior offset que existe de verdade continua passando.
    expect(formatarInstante("2026-10-08T15:30:00+14:00")).not.toBe(AUSENTE);
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

/**
 * Gramáticas estritas (B2).
 *
 * As três funções passaram a ser ancoradas no fim. O que cada uma aceita saiu
 * de uma medição: a suíte inteira rodou com as funções instrumentadas, e o
 * universo real de entradas foi `AAAA-MM-DD`, `null` e
 * `AAAA-MM-DDT00:00:00.000Z` para a data civil; `AAAA-MM` para o mês.
 */
describe("gramática estrita — data civil", () => {
  it("T154.43 aceita a forma exata", () => {
    expect(formatarDiaCivil("2026-10-08")).toBe("08/10/2026");
    expect(formatarDiaCivil("2026-01-01")).toBe("01/01/2026");
    expect(formatarDiaCivil("2026-12-31")).toBe("31/12/2026");
  });

  it("T154.44 aceita a forma serializada do Prisma, só à meia-noite UTC", () => {
    // Coluna `@db.Date` volta como `Date` e serializa assim. Medido: 153
    // entradas reais, todas `T00:00:00`.
    expect(formatarDiaCivil("2026-01-05T00:00:00.000Z")).toBe("05/01/2026");
    expect(formatarDiaCivil("2026-01-05T00:00:00Z")).toBe("05/01/2026");
    expect(formatarDiaCivil("2026-01-05T00:00:00.123456789Z")).toBe(
      "05/01/2026",
    );
  });

  it("T154.45 recusa horário que não seja meia-noite — é instante disfarçado", () => {
    for (const v of [
      "2026-01-05T09:00:00Z",
      "2026-01-05T00:00:01Z",
      "2026-01-05T00:01:00Z",
      "2026-01-05T23:59:59.999Z",
    ]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
    }
  });

  it("T154.46 recusa offset local na forma serializada", () => {
    for (const v of [
      "2026-01-05T00:00:00-03:00",
      "2026-01-05T00:00:00+00:00",
      "2026-01-05T00:00:00.000-03:00",
      "2026-01-05T00:00:00", // sem designador
    ]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
    }
  });

  it("T154.47 recusa lixo depois da data — o defeito que esta rodada fecha", () => {
    for (const v of [
      "2026-10-08lixo",
      "2026-10-0812345",
      "2026-10-08/09",
      "2026-10-08.",
      "2026-10-08T", // truncado
      "2026-10-08Z",
    ]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
    }
  });

  it("T154.48 recusa T99 e horário impossível anexado", () => {
    for (const v of [
      "2026-10-08T99:99:99Z",
      "2026-10-08T99",
      "2026-10-08T24:00:00Z",
      "2026-10-08T00:00:60Z",
    ]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
      // A função irmã recusa a MESMA string: um só padrão de rigor.
      expect(formatarInstante(v)).toBe(AUSENTE);
    }
  });

  it("T154.49 recusa segunda data anexada", () => {
    for (const v of [
      "2026-10-08-01",
      "2026-10-082026-10-09",
      "2026-10-08,2026-10-09",
      "2026-10-08 2026-10-09",
    ]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
    }
  });

  it("T154.50 recusa data incompleta", () => {
    for (const v of ["2026-10", "2026", "2026-10-", "26-10-08", "2026-1-8"]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
    }
  });

  it("T154.51 recusa espaços", () => {
    for (const v of [
      " 2026-10-08",
      "2026-10-08 ",
      "  2026-10-08  ",
      "2026 -10-08",
      "2026-10-08\t",
    ]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
    }
  });
});

describe("gramática estrita — mês de referência", () => {
  it("T154.52 aceita só AAAA-MM", () => {
    expect(formatarMesReferencia("2026-03")).toBe("03/2026");
    expect(formatarMesReferencia("2026-01")).toBe("01/2026");
    expect(formatarMesReferencia("2026-12")).toBe("12/2026");
  });

  it("T154.53 recusa lixo, prefixo e data anexada", () => {
    for (const v of [
      "2026-10-xx",
      "2026-10lixo",
      "2026-1013",
      "2026-10/11",
      "2026-10-13",
      "2026-10-13T00:00:00.000Z",
      " 2026-10",
      "2026-10 ",
      "2026-1",
      "26-10",
    ]) {
      expect(formatarMesReferencia(v)).toBe(AUSENTE);
    }
  });
});

/**
 * Calendário civil manual.
 *
 * Estes anos não têm relevância trabalhista nenhuma — são teste de CONTRATO
 * do utilitário. A validação anterior passava por `Date.UTC`, que aplica o
 * mapeamento legado de ano de dois dígitos (`Date.UTC(50,...)` → 1950) e
 * recusava um século inteiro de datas perfeitamente válidas.
 */
describe("calendário civil sem Date", () => {
  it("T154.54 anos 0001, 0050, 0099 e 0100 são aceitos", () => {
    expect(formatarDiaCivil("0001-01-01")).toBe("01/01/0001");
    expect(formatarDiaCivil("0050-06-15")).toBe("15/06/0050");
    expect(formatarDiaCivil("0099-12-31")).toBe("31/12/0099");
    expect(formatarDiaCivil("0100-01-01")).toBe("01/01/0100");
  });

  it("T154.55 bissextos seculares seguem a regra gregoriana", () => {
    // Divisível por 100 e não por 400: NÃO é bissexto.
    expect(formatarDiaCivil("1900-02-29")).toBe(AUSENTE);
    expect(formatarDiaCivil("1800-02-29")).toBe(AUSENTE);
    expect(formatarDiaCivil("2100-02-29")).toBe(AUSENTE);
    // Divisível por 400: É bissexto.
    expect(formatarDiaCivil("2000-02-29")).toBe("29/02/2000");
    expect(formatarDiaCivil("1600-02-29")).toBe("29/02/1600");
    // Divisível por 4 e não por 100.
    expect(formatarDiaCivil("2024-02-29")).toBe("29/02/2024");
    expect(formatarDiaCivil("2023-02-29")).toBe(AUSENTE);
  });

  it("T154.56 limite de dias de cada mês", () => {
    const limites: ReadonlyArray<readonly [string, number]> = [
      ["01", 31],
      ["02", 28],
      ["03", 31],
      ["04", 30],
      ["05", 31],
      ["06", 30],
      ["07", 31],
      ["08", 31],
      ["09", 30],
      ["10", 31],
      ["11", 30],
      ["12", 31],
    ];
    for (const [mes, ultimo] of limites) {
      const ok = `2026-${mes}-${String(ultimo).padStart(2, "0")}`;
      const demais = `2026-${mes}-${String(ultimo + 1).padStart(2, "0")}`;
      expect(formatarDiaCivil(ok)).not.toBe(AUSENTE);
      expect(formatarDiaCivil(demais)).toBe(AUSENTE);
    }
  });

  it("T154.57 ano zero e mês/dia zero são recusados", () => {
    for (const v of ["0000-01-01", "2026-00-10", "2026-10-00"]) {
      expect(formatarDiaCivil(v)).toBe(AUSENTE);
    }
    expect(formatarMesReferencia("0000-01")).toBe(AUSENTE);
  });

  it("T154.58 o resultado não depende do fuso do processo", () => {
    for (const tz of ["UTC", "Pacific/Kiritimati", "Pacific/Niue"]) {
      expect(comFuso(tz, () => formatarDiaCivil("0050-06-15"))).toBe(
        "15/06/0050",
      );
      expect(comFuso(tz, () => formatarDiaCivil("2000-02-29"))).toBe(
        "29/02/2000",
      );
    }
  });
});

describe("offsets dentro do que existe", () => {
  it("T154.59 ±14:00 são aceitos", () => {
    expect(formatarInstante("2026-10-08T15:30:00+14:00")).toBe(
      "07/10/2026 às 22:30",
    );
    expect(formatarInstante("2026-10-08T15:30:00-14:00")).toBe(
      "09/10/2026 às 02:30",
    );
  });

  it("T154.60 acima de 14 horas é recusado", () => {
    for (const v of [
      "2026-10-08T15:30:00+14:01",
      "2026-10-08T15:30:00-14:01",
      "2026-10-08T15:30:00+15:00",
      "2026-10-08T15:30:00+23:59",
      "2026-10-08T15:30:00-23:59",
      "2026-10-08T15:30:00+24:00",
      "2026-10-08T15:30:00+25:00",
    ]) {
      expect(formatarInstante(v)).toBe(AUSENTE);
    }
  });

  it("T154.61 minuto de offset fora de 00–59 é recusado", () => {
    expect(formatarInstante("2026-10-08T15:30:00+05:60")).toBe(AUSENTE);
    expect(formatarInstante("2026-10-08T15:30:00+05:99")).toBe(AUSENTE);
    // E a fronteira legal continua passando.
    expect(formatarInstante("2026-10-08T15:30:00+13:59")).not.toBe(AUSENTE);
    expect(formatarInstante("2026-10-08T15:30:00+05:59")).not.toBe(AUSENTE);
  });

  it("T154.62 ano de saída sempre com quatro dígitos", () => {
    // `year: "numeric"` do `Intl` não preenche com zero; `month` e `day` sim.
    // Sem o `padStart`, isto saía como "31/12/99".
    expect(formatarInstante("0100-01-01T00:00:00Z")).toBe(
      "31/12/0099 às 20:53",
    );
    expect(formatarInstante("1000-01-01T00:00:00Z")).toBe(
      "31/12/0999 às 20:53",
    );
    for (const v of [
      "0100-01-01T00:00:00Z",
      "1000-01-01T00:00:00Z",
      "2026-10-08T15:30:00Z",
      "9999-12-31T23:59:59Z",
    ]) {
      expect(formatarInstante(v)).toMatch(
        /^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/,
      );
    }
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
