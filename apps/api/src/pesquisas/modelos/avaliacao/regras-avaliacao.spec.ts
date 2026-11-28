import {
  agendaDeLembretes,
  conferirConfigAvaliacao,
  configGravada,
  CONFIG_PADRAO,
  gestorDasEquipes,
  montarOrganograma,
  participantesDosPares,
  planejarPares,
  type PessoaDoOrganograma,
} from "./regras-avaliacao";

/** T216 — Avaliação 90°/180°: organograma, times e configuração. */

const pessoa = (
  id: string,
  extra: Partial<PessoaDoOrganograma> = {},
): PessoaDoOrganograma => ({
  id,
  nome: `Pessoa ${id}`,
  cargo: null,
  departamento: null,
  equipeId: null,
  identificavel: true,
  temEmail: true,
  ...extra,
});

describe("T216 — organograma", () => {
  it("o gestor da equipe é o principal; sem principal, o substituto", () => {
    const m = gestorDasEquipes([
      { equipeId: "e1", gestorId: "sub", papel: "substituto" },
      { equipeId: "e1", gestorId: "pri", papel: "principal" },
      { equipeId: "e2", gestorId: "so-sub", papel: "substituto" },
    ]);
    expect(m.get("e1")).toBe("pri");
    expect(m.get("e2")).toBe("so-sub");
    expect(m.get("e3")).toBeUndefined();
  });

  it("monta os times pelo gestor da equipe e ordena por nome", () => {
    const o = montarOrganograma(
      [
        pessoa("g", { nome: "Gestora", equipeId: "e0" }),
        pessoa("b", { nome: "Bruno", equipeId: "e1" }),
        pessoa("a", { nome: "Ana", equipeId: "e1" }),
      ],
      [{ equipeId: "e1", gestorId: "g", papel: "principal" }],
    );
    expect(o.times).toHaveLength(1);
    expect(o.times[0]!.gestor.id).toBe("g");
    expect(o.times[0]!.pessoas.map((p) => p.nome)).toEqual(["Ana", "Bruno"]);
    expect(o.semGestor.map((s) => [s.pessoa.id, s.motivo])).toEqual([
      ["g", "sem_gestor"],
    ]);
  });

  it("auto-referência vira sem gestor (ninguém se avalia na 90°)", () => {
    const o = montarOrganograma(
      [pessoa("g", { equipeId: "e1" }), pessoa("x", { equipeId: "e1" })],
      [{ equipeId: "e1", gestorId: "g", papel: "principal" }],
    );
    expect(o.times[0]!.pessoas.map((p) => p.id)).toEqual(["x"]);
    expect(o.semGestor[0]).toMatchObject({
      pessoa: { id: "g" },
      motivo: "sem_gestor",
    });
  });

  it("gestor sem CPF e gestor fora dos ativos mandam o time para sem gestor", () => {
    const o = montarOrganograma(
      [
        pessoa("g", { nome: "Gestor Sem CPF", identificavel: false }),
        pessoa("x", { equipeId: "e1" }),
        pessoa("y", { equipeId: "e2" }),
      ],
      [
        { equipeId: "e1", gestorId: "g", papel: "principal" },
        { equipeId: "e2", gestorId: "fora", papel: "principal" },
      ],
      new Map([["fora", "Gestor Desligado"]]),
    );
    expect(o.times).toEqual([]);
    const por = Object.fromEntries(o.semGestor.map((s) => [s.pessoa.id, s]));
    expect(por.x).toMatchObject({
      motivo: "gestor_sem_cpf",
      gestorNome: "Gestor Sem CPF",
    });
    expect(por.y).toMatchObject({
      motivo: "gestor_inativo",
      gestorNome: "Gestor Desligado",
    });
    expect(por.g).toMatchObject({ motivo: "sem_gestor" });
  });
});

describe("T216 — times escolhidos → pares", () => {
  const ativos = new Set(["g1", "g2", "a", "b", "c", "semcpf"]);
  const ident = new Set(["g1", "g2", "a", "b", "c"]);

  it("90°: um par por pessoa, com o gestor", () => {
    const r = planejarPares(
      "avaliacao90",
      [{ gestorId: "g1", avaliadoIds: ["a", "b"] }],
      ativos,
      ident,
    );
    expect(r.erros).toEqual([]);
    expect(r.pares).toEqual([
      { avaliadorId: "g1", avaliadoId: "a", papel: "gestor" },
      { avaliadorId: "g1", avaliadoId: "b", papel: "gestor" },
    ]);
    expect(participantesDosPares(r.pares)).toEqual(["g1"]);
  });

  it("180°: a pessoa identificável também se avalia; sem CPF, só o gestor", () => {
    const r = planejarPares(
      "avaliacao180",
      [{ gestorId: "g1", avaliadoIds: ["a", "semcpf"] }],
      ativos,
      ident,
    );
    expect(r.pares).toEqual([
      { avaliadorId: "g1", avaliadoId: "a", papel: "gestor" },
      { avaliadorId: "a", avaliadoId: "a", papel: "autoavaliacao" },
      { avaliadorId: "g1", avaliadoId: "semcpf", papel: "gestor" },
    ]);
    expect(participantesDosPares(r.pares)).toEqual(["g1", "a"]);
  });

  it.each([
    [
      "pessoa em dois times",
      [
        { gestorId: "g1", avaliadoIds: ["a"] },
        { gestorId: "g2", avaliadoIds: ["a"] },
      ],
      "repetida",
    ],
    [
      "gestor repetido",
      [
        { gestorId: "g1", avaliadoIds: ["a"] },
        { gestorId: "g1", avaliadoIds: ["b"] },
      ],
      "repetida",
    ],
    [
      "gestor se avaliando",
      [{ gestorId: "g1", avaliadoIds: ["g1"] }],
      "invalido",
    ],
    [
      "pessoa inativa",
      [{ gestorId: "g1", avaliadoIds: ["zz"] }],
      "indisponivel",
    ],
    [
      "gestor inativo",
      [{ gestorId: "zz", avaliadoIds: ["a"] }],
      "indisponivel",
    ],
    [
      "gestor sem CPF",
      [{ gestorId: "semcpf", avaliadoIds: ["a"] }],
      "gestor_nao_identificavel",
    ],
    ["nenhuma pessoa", [{ gestorId: "g1", avaliadoIds: [] }], "sem_pessoas"],
    ["nenhum time", [], "sem_pessoas"],
  ])("recusa: %s", (_caso, times, motivo) => {
    const r = planejarPares("avaliacao90", times, ativos, ident);
    expect(r.erros).toEqual([{ campo: "times", motivo }]);
    expect(r.pares).toEqual([]);
  });
});

describe("T216 — configuração da avaliação", () => {
  const agora = new Date("2026-11-27T12:00:00-03:00");
  const prazo = new Date("2026-12-27T23:59:00-03:00");
  const ler = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
    const d = new Date(`${v}:00-03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  it("sem nada, o padrão (90° sem visibilidade nem prazo da autoavaliação)", () => {
    const r = conferirConfigAvaliacao("avaliacao90", {}, prazo, agora, ler);
    expect(r.erros).toEqual([]);
    expect(r.config).toEqual({ ...CONFIG_PADRAO, visibilidade: "so_rh" });
  });

  it("180°: prazo da autoavaliação antes do prazo do gestor", () => {
    const r = conferirConfigAvaliacao(
      "avaliacao180",
      {
        comentarios: "obrigatorios",
        liberarNoPortal: true,
        visibilidade: "so_rh",
        prazoAutoavaliacao: "2026-12-20T23:59",
        lembretes: ["depois", "7_dias"],
        envio: "link",
      },
      prazo,
      agora,
      ler,
    );
    expect(r.erros).toEqual([]);
    expect(r.config).toMatchObject({
      comentarios: "obrigatorios",
      liberarNoPortal: true,
      visibilidade: "so_rh",
      lembretes: ["7_dias", "depois"],
      envio: "link",
    });
    expect(r.config!.prazoAutoavaliacao).toBe("2026-12-21T02:59:00.000Z");
  });

  it.each([
    [{ comentarios: "talvez" }, "comentarios", "invalido"],
    [{ liberarNoPortal: "sim" }, "liberarNoPortal", "invalido"],
    [{ visibilidade: "todos" }, "visibilidade", "invalido"],
    [{ lembretes: ["ontem"] }, "lembretes", "invalido"],
    [{ lembretes: ["no_dia", "no_dia"] }, "lembretes", "invalido"],
    [{ envio: "pombo" }, "envio", "invalido"],
    [
      { prazoAutoavaliacao: "2026-12-30T10:00" },
      "prazoAutoavaliacao",
      "fora_de_ordem",
    ],
    [
      { prazoAutoavaliacao: "2026-11-27T12:30" },
      "prazoAutoavaliacao",
      "fora_do_prazo",
    ],
    [{ prazoAutoavaliacao: "amanhã" }, "prazoAutoavaliacao", "invalido"],
  ])("180°: recusa %j", (config, campo, motivo) => {
    const r = conferirConfigAvaliacao(
      "avaliacao180",
      config,
      prazo,
      agora,
      ler,
    );
    expect(r.erros).toEqual([{ campo, motivo }]);
    expect(r.config).toBeNull();
  });

  it("90°: prazo da autoavaliação não se aplica", () => {
    const r = conferirConfigAvaliacao(
      "avaliacao90",
      { prazoAutoavaliacao: "2026-12-20T23:59" },
      prazo,
      agora,
      ler,
    );
    expect(r.erros).toEqual([
      { campo: "prazoAutoavaliacao", motivo: "nao_se_aplica" },
    ]);
  });

  it("180° sem prazo do gestor: o da autoavaliação não tem como vir antes", () => {
    const r = conferirConfigAvaliacao(
      "avaliacao180",
      { prazoAutoavaliacao: "2026-12-20T23:59" },
      null,
      agora,
      ler,
    );
    expect(r.erros).toEqual([
      { campo: "prazoAutoavaliacao", motivo: "fora_de_ordem" },
    ]);
  });

  it("configuração gravada completa os campos que faltam com o padrão", () => {
    expect(configGravada(null)).toEqual(CONFIG_PADRAO);
    expect(configGravada({ envio: "link" })).toEqual({
      ...CONFIG_PADRAO,
      envio: "link",
    });
  });
});

describe("T216 — lembretes da avaliação", () => {
  const prazo = new Date("2026-12-27T23:59:00-03:00");

  it("às 09:00 de 7 e 3 dias antes, do dia e do dia seguinte", () => {
    const r = agendaDeLembretes(
      prazo,
      ["7_dias", "3_dias", "no_dia", "depois"],
      new Date("2026-11-27T12:00:00-03:00"),
    );
    expect(r.map((x) => [x.lembrete, x.quando.toISOString()])).toEqual([
      ["7_dias", "2026-12-20T12:00:00.000Z"],
      ["3_dias", "2026-12-24T12:00:00.000Z"],
      ["no_dia", "2026-12-27T12:00:00.000Z"],
      ["depois", "2026-12-28T12:00:00.000Z"],
    ]);
  });

  it("só agenda os que caem ≥ 1 h no futuro", () => {
    const r = agendaDeLembretes(
      prazo,
      ["7_dias", "3_dias", "no_dia"],
      new Date("2026-12-24T08:30:00-03:00"),
    );
    expect(r.map((x) => x.lembrete)).toEqual(["no_dia"]);
  });

  it("no dia, só antes do prazo (prazo às 08:00 não tem lembrete do dia)", () => {
    const cedo = new Date("2026-12-27T08:00:00-03:00");
    const r = agendaDeLembretes(
      cedo,
      ["no_dia", "depois"],
      new Date("2026-11-27T12:00:00-03:00"),
    );
    expect(r.map((x) => x.lembrete)).toEqual(["depois"]);
  });

  it("sem lembretes escolhidos, agenda vazia", () => {
    expect(
      agendaDeLembretes(prazo, [], new Date("2026-11-27T12:00:00-03:00")),
    ).toEqual([]);
  });
});

describe("T216 — 180° sem CPF (provas extras)", () => {
  const ativos = new Set(["g1", "a", "semcpf", "outro"]);
  const ident = new Set(["g1", "a", "outro"]);

  it("quem não tem CPF não entra pelo link (não é participante)", () => {
    const r = planejarPares(
      "avaliacao180",
      [{ gestorId: "g1", avaliadoIds: ["semcpf"] }],
      ativos,
      ident,
    );
    expect(r.pares).toEqual([
      { avaliadorId: "g1", avaliadoId: "semcpf", papel: "gestor" },
    ]);
    expect(participantesDosPares(r.pares)).toEqual(["g1"]);
  });

  it("conta as autoavaliações só de quem tem CPF", () => {
    const r = planejarPares(
      "avaliacao180",
      [{ gestorId: "g1", avaliadoIds: ["a", "semcpf", "outro"] }],
      ativos,
      ident,
    );
    expect(
      r.pares
        .filter((p) => p.papel === "autoavaliacao")
        .map((p) => p.avaliadoId),
    ).toEqual(["a", "outro"]);
    expect(r.pares).toHaveLength(5);
  });
});
