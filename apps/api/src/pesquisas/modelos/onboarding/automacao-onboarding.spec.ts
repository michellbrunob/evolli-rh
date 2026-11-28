import {
  aceitaResposta,
  conferirConfigOnboarding,
  configGravada,
  CONFIG_PADRAO,
  dataDaRodada,
  envioVencido,
  horarioValido,
  intervaloDoAgendador,
  lembreteDevido,
  noPublico,
  planejarEnvios,
  proximasRodadas,
  proximoDiaUtil,
  situacaoDepoisDoAviso,
  ultimoDiaParaResponder,
  type ConfigOnboarding,
  type PessoaDoPublico,
} from "./automacao-onboarding";

/** T216 — Onboarding: configuração do envio, público e convites. */

const ID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const pessoa = (
  n: number,
  admissao: string | null,
  extra: Partial<PessoaDoPublico> = {},
): PessoaDoPublico => ({
  id: ID(n),
  admissao,
  departamentoId: null,
  cargoId: null,
  unidadeId: null,
  centroCustoId: null,
  ...extra,
});

const config = (extra: Partial<ConfigOnboarding> = {}): ConfigOnboarding => ({
  ...CONFIG_PADRAO,
  ...extra,
});

describe("T216 — configuração do envio do onboarding", () => {
  const hoje = "2026-11-27";

  it("sem nada, o padrão: automático aos 30 e 60 dias, 09:00, 7 dias, lembrete 3", () => {
    const r = conferirConfigOnboarding({}, "confidencial", hoje);
    expect(r.erros).toEqual([]);
    expect(r.config).toEqual(CONFIG_PADRAO);
  });

  it("anônima: nunca tem lembrete", () => {
    const r = conferirConfigOnboarding({ lembreteDias: 5 }, "anonima", hoje);
    expect(r.config!.lembreteDias).toBeNull();
  });

  it("ordena as rodadas e só guarda rodadas no automático", () => {
    expect(
      conferirConfigOnboarding({ rodadas: [90, 30] }, "identificada", hoje)
        .config!.rodadas,
    ).toEqual([30, 90]);
    expect(
      conferirConfigOnboarding({ modo: "agora" }, "identificada", hoje).config!
        .rodadas,
    ).toEqual([]);
  });

  it("agendar: guarda o dia; e-mail personalizado com os três textos", () => {
    const r = conferirConfigOnboarding(
      {
        modo: "agendar",
        agendadoPara: "2026-11-28",
        horario: "06:30",
        email: {
          modelo: "personalizado",
          assunto: " Como estão seus primeiros dias? ",
          titulo: "Primeiros dias",
          mensagem: "Conte para a gente.",
        },
        publico: { tipo: "pessoas", colaboradorIds: [ID(1)] },
      },
      "identificada",
      hoje,
    );
    expect(r.erros).toEqual([]);
    expect(r.config).toMatchObject({
      modo: "agendar",
      agendadoPara: "2026-11-28",
      horario: "06:30",
      email: {
        modelo: "personalizado",
        assunto: "Como estão seus primeiros dias?",
      },
    });
  });

  it.each([
    [{ modo: "talvez" }, "envio"],
    [{ rodadas: [45] }, "rodadas"],
    [{ rodadas: [30, 30] }, "rodadas"],
    [{ horario: "05:30" }, "horario"],
    [{ horario: "21:30" }, "horario"],
    [{ horario: "09:15" }, "horario"],
    [{ prazoDias: 4 }, "prazoDias"],
    [{ lembreteDias: 1 }, "lembreteDias"],
    [{ soDiasUteis: "sim" }, "envio"],
    [{ publico: { tipo: "todo mundo" } }, "publico"],
    [{ publico: { tipo: "pessoas", colaboradorIds: [] } }, "publico"],
    [{ publico: { tipo: "pessoas", colaboradorIds: ["x"] } }, "publico"],
    [
      {
        publico: {
          tipo: "grupo",
          condicoes: [{ campo: "salario", operador: "e", valores: [ID(1)] }],
        },
      },
      "publico",
    ],
    [
      {
        publico: {
          tipo: "grupo",
          condicoes: [
            { campo: "cargo", operador: "e", valores: [ID(1), ID(2)] },
          ],
        },
      },
      "publico",
    ],
    [
      { email: { modelo: "personalizado", assunto: "a", titulo: "b" } },
      "email",
    ],
    [{ email: { modelo: "padrao", assunto: "x".repeat(81) } }, "email"],
  ])("recusa %j (campo %s)", (bruto, campo) => {
    const r = conferirConfigOnboarding(bruto, "confidencial", hoje);
    expect(r.config).toBeNull();
    expect(r.erros.map((e) => e.campo)).toContain(campo);
  });

  it("automático sem rodada: obrigatório; agendar sem dia ou no passado", () => {
    expect(
      conferirConfigOnboarding({ rodadas: [] }, "confidencial", hoje).erros,
    ).toEqual([{ campo: "rodadas", motivo: "obrigatorio" }]);
    expect(
      conferirConfigOnboarding({ modo: "agendar" }, "confidencial", hoje).erros,
    ).toEqual([{ campo: "agendadoPara", motivo: "obrigatorio" }]);
    expect(
      conferirConfigOnboarding(
        { modo: "agendar", agendadoPara: "2026-11-26" },
        "confidencial",
        hoje,
      ).erros,
    ).toEqual([{ campo: "agendadoPara", motivo: "fora_do_prazo" }]);
    expect(
      conferirConfigOnboarding(
        { modo: "agendar", agendadoPara: "2026-02-30" },
        "confidencial",
        hoje,
      ).erros,
    ).toEqual([{ campo: "agendadoPara", motivo: "obrigatorio" }]);
  });

  it("horário: das 06:00 às 21:00, de 30 em 30 minutos", () => {
    expect(horarioValido("06:00")).toBe(true);
    expect(horarioValido("21:00")).toBe(true);
    expect(horarioValido("12:30")).toBe(true);
    expect(horarioValido("5:00")).toBe(false);
    expect(horarioValido(900)).toBe(false);
  });

  it("configuração gravada completa com o padrão", () => {
    expect(configGravada({ prazoDias: 15 })).toEqual({
      ...CONFIG_PADRAO,
      prazoDias: 15,
    });
    expect(configGravada("x")).toEqual(CONFIG_PADRAO);
  });
});

describe("T216 — datas das rodadas", () => {
  it("admissão + N dias; em dia útil, vai para o próximo dia útil", () => {
    // 2026-10-29 + 30 = 2026-11-28 (sábado) → 2026-11-30 (segunda)
    expect(dataDaRodada("2026-10-29", 30, false)).toBe("2026-11-28");
    expect(dataDaRodada("2026-10-29", 30, true)).toBe("2026-11-30");
    // 2026-10-16 + 30 = 2026-11-15 (feriado, domingo) → 2026-11-16
    expect(dataDaRodada("2026-10-16", 30, true)).toBe("2026-11-16");
  });

  it("feriado local também conta", () => {
    expect(proximoDiaUtil("2026-11-26", new Set(["2026-11-26"]))).toBe(
      "2026-11-27",
    );
    expect(proximoDiaUtil("2026-11-27", new Set(["2026-11-27"]))).toBe(
      "2026-11-30",
    );
    expect(proximoDiaUtil("2026-11-25", new Set())).toBe("2026-11-25");
  });

  it("último dia para responder: o dia do envio + o prazo", () => {
    expect(ultimoDiaParaResponder("2026-11-27", 7)).toBe("2026-12-04");
  });
});

describe("T216 — público", () => {
  const p = pessoa(1, "2026-01-01", {
    departamentoId: ID(10),
    cargoId: ID(20),
    unidadeId: null,
  });

  it("todos; pessoas escolhidas; grupo com todas as condições", () => {
    expect(noPublico(p, { tipo: "todos" })).toBe(true);
    expect(noPublico(p, { tipo: "pessoas", colaboradorIds: [ID(1)] })).toBe(
      true,
    );
    expect(noPublico(p, { tipo: "pessoas", colaboradorIds: [ID(2)] })).toBe(
      false,
    );
    expect(
      noPublico(p, {
        tipo: "grupo",
        condicoes: [
          { campo: "departamento", operador: "e", valores: [ID(10)] },
          { campo: "cargo", operador: "uma_destas", valores: [ID(21), ID(20)] },
        ],
      }),
    ).toBe(true);
    expect(
      noPublico(p, {
        tipo: "grupo",
        condicoes: [
          { campo: "departamento", operador: "e", valores: [ID(10)] },
          { campo: "unidade", operador: "uma_destas", valores: [ID(30)] },
        ],
      }),
    ).toBe(false);
  });
});

describe("T216 — planejamento dos convites", () => {
  const hoje = "2026-11-27";

  it("automático: só datas a partir da ativação, até 30 dias à frente", () => {
    const r = planejarEnvios({
      config: config({ soDiasUteis: false }),
      inicio: "2026-11-20",
      hoje,
      pessoas: [
        pessoa(1, "2026-10-28"), // 30 → 2026-11-27 (hoje); 60 → 2026-12-27 (até 30 dias)
        pessoa(2, "2026-10-01"), // 30 → 2026-10-31 (antes da ativação); 60 → 2026-11-30
        pessoa(3, "2026-12-01"), // 30 → 2026-12-31 (além de 30 dias)
        pessoa(4, null),
      ],
      existentes: new Set(),
    });
    expect(r).toEqual([
      { colaboradorId: ID(1), rodada: 30, dataPrevista: "2026-11-27" },
      { colaboradorId: ID(1), rodada: 60, dataPrevista: "2026-12-27" },
      { colaboradorId: ID(2), rodada: 60, dataPrevista: "2026-11-30" },
    ]);
  });

  it("idempotente: o que já existe não volta", () => {
    const entrada = {
      config: config({ soDiasUteis: false }),
      inicio: "2026-11-20",
      hoje,
      pessoas: [pessoa(1, "2026-10-28")],
    };
    const primeiro = planejarEnvios({ ...entrada, existentes: new Set() });
    const chaves = new Set(
      primeiro.map((e) => `${e.colaboradorId}:${e.rodada}`),
    );
    expect(planejarEnvios({ ...entrada, existentes: chaves })).toEqual([]);
  });

  it("incluir atrasados: quem passou há até 30 dias recebe no primeiro envio", () => {
    const base = {
      inicio: hoje,
      hoje,
      existentes: new Set<string>(),
      pessoas: [
        pessoa(1, "2026-10-10"), // 30 → 2026-11-09 (18 dias antes)
        pessoa(2, "2026-09-01"), // 30 → 2026-10-01 (57 dias antes: fora); 60 → 2026-10-31
      ],
    };
    expect(
      planejarEnvios({ ...base, config: config({ soDiasUteis: false }) }),
    ).toEqual([
      // a rodada de 60 dias da pessoa 1 ainda vem (2026-12-09)
      { colaboradorId: ID(1), rodada: 60, dataPrevista: "2026-12-09" },
    ]);
    expect(
      planejarEnvios({
        ...base,
        config: config({ soDiasUteis: false, incluirAtrasados: true }),
      }),
    ).toEqual([
      { colaboradorId: ID(1), rodada: 30, dataPrevista: hoje },
      { colaboradorId: ID(1), rodada: 60, dataPrevista: "2026-12-09" },
      { colaboradorId: ID(2), rodada: 60, dataPrevista: hoje },
    ]);
  });

  it("agora e agendado: um convite único (rodada 0) para o público", () => {
    const pessoas = [
      pessoa(1, "2020-01-01", { departamentoId: ID(9) }),
      pessoa(2, null),
    ];
    expect(
      planejarEnvios({
        config: config({ modo: "agora", rodadas: [] }),
        inicio: hoje,
        hoje,
        pessoas,
        existentes: new Set(),
      }),
    ).toEqual([
      { colaboradorId: ID(1), rodada: 0, dataPrevista: hoje },
      { colaboradorId: ID(2), rodada: 0, dataPrevista: hoje },
    ]);
    expect(
      planejarEnvios({
        config: config({
          modo: "agendar",
          agendadoPara: "2026-12-02",
          publico: {
            tipo: "grupo",
            condicoes: [
              { campo: "departamento", operador: "e", valores: [ID(9)] },
            ],
          },
        }),
        inicio: hoje,
        hoje,
        pessoas,
        existentes: new Set([`${ID(2)}:0`]),
      }),
    ).toEqual([
      { colaboradorId: ID(1), rodada: 0, dataPrevista: "2026-12-02" },
    ]);
  });

  it("próximas rodadas: quantas pessoas em cada uma nos próximos 30 dias", () => {
    const r = proximasRodadas(
      [
        pessoa(1, "2026-10-28"),
        pessoa(2, "2026-10-01"),
        pessoa(3, "2026-09-10"),
      ],
      { publico: { tipo: "todos" }, soDiasUteis: false },
      hoje,
    );
    expect(r).toEqual({ 30: 1, 60: 2, 90: 1 });
  });
});

describe("T216 — situação dos convites", () => {
  it("vence no horário escolhido; o 'agora' vence na hora", () => {
    const c = { modo: "automatizar" as const, horario: "09:00" };
    expect(
      envioVencido(c, "2026-11-27", new Date("2026-11-27T08:59:00-03:00")),
    ).toBe(false);
    expect(
      envioVencido(c, "2026-11-27", new Date("2026-11-27T09:00:00-03:00")),
    ).toBe(true);
    expect(
      envioVencido(
        { modo: "agora", horario: "21:00" },
        "2026-11-27",
        new Date("2026-11-27T00:00:00-03:00"),
      ),
    ).toBe(true);
  });

  it("sem e-mail no cadastro; sem provedor, aguardando e-mail; com provedor, enviado", () => {
    expect(situacaoDepoisDoAviso(false, true)).toBe("sem_email");
    expect(situacaoDepoisDoAviso(true, false)).toBe("aguardando_email");
    expect(situacaoDepoisDoAviso(true, true)).toBe("enviado");
  });

  it("lembrete: uma vez, N dias depois, só sem resposta e dentro do prazo", () => {
    const c = {
      lembreteDias: 3 as const,
      horario: "09:00",
      prazoDias: 7 as const,
    };
    const e = {
      situacao: "aguardando_email" as const,
      dataPrevista: "2026-11-20",
      lembreteEm: null,
    };
    const antes = new Date("2026-11-23T08:00:00-03:00");
    const depois = new Date("2026-11-23T09:00:00-03:00");
    expect(lembreteDevido(e, c, antes, "2026-11-23")).toBe(false);
    expect(lembreteDevido(e, c, depois, "2026-11-23")).toBe(true);
    expect(
      lembreteDevido({ ...e, lembreteEm: depois }, c, depois, "2026-11-23"),
    ).toBe(false);
    expect(
      lembreteDevido({ ...e, situacao: "respondido" }, c, depois, "2026-11-23"),
    ).toBe(false);
    expect(
      lembreteDevido(e, { ...c, lembreteDias: null }, depois, "2026-11-23"),
    ).toBe(false);
    expect(
      lembreteDevido(e, c, new Date("2026-11-28T09:00:00-03:00"), "2026-11-28"),
    ).toBe(false);
  });

  it("aceita resposta: já saiu, no prazo e sem resposta", () => {
    const e = {
      situacao: "aguardando_email" as const,
      dataPrevista: "2026-11-20",
    };
    expect(aceitaResposta(e, 7, "2026-11-20")).toBe(true);
    expect(aceitaResposta(e, 7, "2026-11-27")).toBe(true);
    expect(aceitaResposta(e, 7, "2026-11-28")).toBe(false);
    expect(aceitaResposta(e, 7, "2026-11-19")).toBe(false);
    expect(
      aceitaResposta({ ...e, situacao: "agendado" }, 7, "2026-11-21"),
    ).toBe(false);
    expect(
      aceitaResposta({ ...e, situacao: "respondido" }, 7, "2026-11-21"),
    ).toBe(false);
    expect(aceitaResposta({ ...e, situacao: "pulado" }, 7, "2026-11-21")).toBe(
      false,
    );
    expect(
      aceitaResposta({ ...e, situacao: "sem_email" }, 7, "2026-11-21"),
    ).toBe(true);
  });

  it("intervalo do agendador: padrão 5 min, desligado nos testes e com 0", () => {
    expect(intervaloDoAgendador({})).toBe(300_000);
    expect(intervaloDoAgendador({ NODE_ENV: "test" })).toBe(0);
    expect(
      intervaloDoAgendador({ PESQUISAS_AGENDADOR_INTERVALO_MS: "0" }),
    ).toBe(0);
    expect(
      intervaloDoAgendador({ PESQUISAS_AGENDADOR_INTERVALO_MS: "60000" }),
    ).toBe(60_000);
    expect(
      intervaloDoAgendador({ PESQUISAS_AGENDADOR_INTERVALO_MS: "5" }),
    ).toBe(10_000);
    expect(
      intervaloDoAgendador({ PESQUISAS_AGENDADOR_INTERVALO_MS: "abc" }),
    ).toBe(0);
    expect(
      intervaloDoAgendador({
        NODE_ENV: "test",
        PESQUISAS_AGENDADOR_INTERVALO_MS: "20000",
      }),
    ).toBe(20_000);
  });
});

describe("T216 — convites já criados e dias úteis (provas extras)", () => {
  const hoje = "2026-11-27";

  it("rodada já criada não volta; a outra ainda vem", () => {
    const r = planejarEnvios({
      config: config({ soDiasUteis: false }),
      inicio: "2026-11-20",
      hoje,
      pessoas: [pessoa(1, "2026-10-28")],
      existentes: new Set([`${ID(1)}:30`]),
    });
    expect(r).toEqual([{ colaboradorId: ID(1), rodada: 60, dataPrevista: "2026-12-27" }]);
  });

  it("atrasado já convidado não recebe de novo no primeiro envio", () => {
    const r = planejarEnvios({
      config: config({ soDiasUteis: false, incluirAtrasados: true, rodadas: [30] }),
      inicio: hoje,
      hoje,
      pessoas: [pessoa(1, "2026-10-10")],
      existentes: new Set([`${ID(1)}:30`]),
    });
    expect(r).toEqual([]);
  });

  it("só em dias úteis: a data da rodada no sábado vai para segunda", () => {
    const r = planejarEnvios({
      config: config({ rodadas: [30] }),
      inicio: "2026-11-20",
      hoje,
      pessoas: [pessoa(1, "2026-10-29")],
      existentes: new Set(),
    });
    expect(r).toEqual([{ colaboradorId: ID(1), rodada: 30, dataPrevista: "2026-11-30" }]);
  });

  it("feriado local também empurra a data da rodada", () => {
    expect(dataDaRodada("2026-10-27", 30, true, new Set(["2026-11-26"]))).toBe("2026-11-27");
    expect(dataDaRodada("2026-10-27", 30, false, new Set(["2026-11-26"]))).toBe("2026-11-26");
  });
});
