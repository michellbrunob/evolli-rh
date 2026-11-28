import { conferirSecoes, LIMITES } from "./estrutura-pesquisa";

/** T216 — a estrutura da pesquisa: forma, limites e condições. */

const pergunta = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  tipo: "texto_curto",
  texto: `Pergunta ${id}`,
  descricao: null,
  obrigatoria: false,
  config: {},
  condicao: null,
  ...extra,
});

const secao = (id: string, perguntas: unknown[]) => ({
  id,
  titulo: null,
  descricao: null,
  perguntas,
});

const opcoes = [
  { id: "a", texto: "Opção A" },
  { id: "b", texto: "Opção B" },
];

describe("T216 — conferirSecoes", () => {
  it("normaliza: apara textos, descarta chaves desconhecidas e completa padrões", () => {
    const r = conferirSecoes([
      {
        id: "s1",
        titulo: "  Clima  ",
        descricao: "",
        lixo: true,
        perguntas: [
          {
            id: "p1",
            tipo: "escala",
            texto: "  Como está?  ",
            config: { maximo: 7, extra: 1 },
            outraCoisa: "x",
          },
          pergunta("p2", { tipo: "nota_0_10", config: { enps: true } }),
        ],
      },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.secoes).toEqual([
      {
        id: "s1",
        titulo: "Clima",
        descricao: null,
        perguntas: [
          {
            id: "p1",
            tipo: "escala",
            texto: "Como está?",
            rotulo: null,
            descricao: null,
            obrigatoria: false,
            config: {
              minimo: 1,
              maximo: 7,
              rotuloMinimo: null,
              rotuloMaximo: null,
            },
            condicao: null,
          },
          {
            id: "p2",
            tipo: "nota_0_10",
            texto: "Pergunta p2",
            rotulo: null,
            descricao: null,
            obrigatoria: false,
            config: { enps: true },
            condicao: null,
          },
        ],
      },
    ]);
  });

  it("aceita seção sem perguntas (o rascunho); publicar exige ao menos uma", () => {
    expect(conferirSecoes([secao("s1", [])]).erros).toEqual([]);
  });

  it("recusa nenhuma seção ou mais de 20", () => {
    expect(conferirSecoes([]).erros).toEqual([
      { campo: "secoes", motivo: "limite" },
    ]);
    const muitas = Array.from({ length: 21 }, (_, i) => secao(`s${i}`, []));
    expect(conferirSecoes(muitas).erros).toEqual([
      { campo: "secoes", motivo: "limite" },
    ]);
    expect(conferirSecoes("x").erros[0]!.motivo).toBe("limite");
  });

  it("recusa mais perguntas que o limite", () => {
    const perguntas = Array.from({ length: LIMITES.perguntas + 1 }, (_, i) =>
      pergunta(`p${i}`),
    );
    const r = conferirSecoes([
      secao("s1", perguntas.slice(0, 30)),
      secao("s2", perguntas.slice(30)),
    ]);
    expect(r.erros).toContainEqual({ campo: "secoes", motivo: "limite" });
    const ok = conferirSecoes([secao("s1", perguntas.slice(0, 60))]);
    expect(ok.erros).toEqual([]);
  });

  it("recusa ids repetidos e fora do formato", () => {
    expect(
      conferirSecoes([secao("s1", [pergunta("p1"), pergunta("p1")])]).erros,
    ).toContainEqual({ campo: "secoes", motivo: "invalido" });
    expect(
      conferirSecoes([secao("s1", []), secao("s1", [])]).erros,
    ).toContainEqual({ campo: "secoes", motivo: "invalido" });
    expect(
      conferirSecoes([secao("s1", [pergunta("id com espaço")])]).erros,
    ).toContainEqual({ campo: "secoes", motivo: "invalido" });
  });

  it("erro da pergunta sai pelo id dela: texto vazio, longo, tipo e config", () => {
    const r = conferirSecoes([
      secao("s1", [
        pergunta("vazia", { texto: "  " }),
        pergunta("longa", { texto: "x".repeat(301) }),
        pergunta("tipo", { tipo: "desenho" }),
        pergunta("escolha", { tipo: "escolha_unica", config: { opcoes: [] } }),
        pergunta("escala", { tipo: "escala", config: { minimo: 2 } }),
        pergunta("numero", {
          tipo: "numero",
          config: { minimo: 10, maximo: 1 },
        }),
        pergunta("maximo", {
          tipo: "multipla_escolha",
          config: { opcoes, maximo: 3 },
        }),
      ]),
    ]);
    expect(r.erros).toEqual([
      { campo: "vazia", motivo: "obrigatorio" },
      { campo: "longa", motivo: "limite" },
      { campo: "tipo", motivo: "invalido" },
      { campo: "escolha", motivo: "invalido" },
      { campo: "escala", motivo: "invalido" },
      { campo: "numero", motivo: "invalido" },
      { campo: "maximo", motivo: "invalido" },
    ]);
  });

  it("opções: de 2 a 20, ids únicos, texto até 200", () => {
    const conf = (o: unknown) =>
      conferirSecoes([
        secao("s1", [
          pergunta("p", { tipo: "escolha_unica", config: { opcoes: o } }),
        ]),
      ]).erros;
    expect(conf(opcoes)).toEqual([]);
    expect(conf([opcoes[0]])).not.toEqual([]);
    expect(
      conf(Array.from({ length: 21 }, (_, i) => ({ id: `o${i}`, texto: "x" }))),
    ).not.toEqual([]);
    expect(conf([opcoes[0], opcoes[0]])).not.toEqual([]);
    expect(conf([opcoes[0], { id: "c", texto: "x".repeat(201) }])).not.toEqual(
      [],
    );
  });

  describe("condição", () => {
    const base = pergunta("q1", { tipo: "sim_nao" });

    it("aceita pergunta anterior de escolha/sim-não e opção existente", () => {
      const r = conferirSecoes([
        secao("s1", [
          base,
          pergunta("q2", { condicao: { perguntaId: "q1", opcaoId: "sim" } }),
        ]),
        secao("s2", [
          pergunta("q3", {
            tipo: "multipla_escolha",
            config: { opcoes },
          }),
          pergunta("q4", { condicao: { perguntaId: "q3", opcaoId: "b" } }),
        ]),
      ]);
      expect(r.erros).toEqual([]);
      expect(r.secoes[0]!.perguntas[1]!.condicao).toEqual({
        perguntaId: "q1",
        opcaoId: "sim",
      });
    });

    it("condição sobre pergunta anterior recusada: o erro sai só pela anterior", () => {
      const r = conferirSecoes([
        secao("s1", [
          pergunta("q1", { tipo: "sim_nao", texto: "" }),
          pergunta("q2", { condicao: { perguntaId: "q1", opcaoId: "sim" } }),
        ]),
      ]);
      expect(r.erros).toEqual([{ campo: "q1", motivo: "obrigatorio" }]);
    });

    it("recusa pergunta posterior (fora de ordem), de outro tipo ou opção inexistente", () => {
      const r = conferirSecoes([
        secao("s1", [
          pergunta("antes", {
            condicao: { perguntaId: "depois", opcaoId: "sim" },
          }),
          pergunta("depois", { tipo: "sim_nao" }),
          pergunta("texto"),
          pergunta("tipoErrado", {
            condicao: { perguntaId: "texto", opcaoId: "sim" },
          }),
          pergunta("opcaoErrada", {
            condicao: { perguntaId: "depois", opcaoId: "talvez" },
          }),
          pergunta("inexistente", {
            condicao: { perguntaId: "nada", opcaoId: "sim" },
          }),
          pergunta("propria", {
            tipo: "sim_nao",
            condicao: { perguntaId: "propria", opcaoId: "sim" },
          }),
        ]),
      ]);
      expect(r.erros).toEqual([
        { campo: "antes", motivo: "fora_de_ordem" },
        { campo: "tipoErrado", motivo: "invalido" },
        { campo: "opcaoErrada", motivo: "invalido" },
        { campo: "inexistente", motivo: "invalido" },
        { campo: "propria", motivo: "fora_de_ordem" },
      ]);
    });
  });
});

describe("T216 — rótulo curto da pergunta", () => {
  it("aparado, até 40; vazio vira nulo; acima de 40, limite", () => {
    const conf = (rotulo: unknown) =>
      conferirSecoes([
        {
          id: "s1",
          titulo: null,
          descricao: null,
          perguntas: [
            {
              id: "p1",
              tipo: "concordancia",
              texto: "Pergunta",
              rotulo,
              config: {},
            },
          ],
        },
      ]);
    expect(conf("  Clareza  ").secoes[0]!.perguntas[0]!.rotulo).toBe("Clareza");
    expect(conf("").secoes[0]!.perguntas[0]!.rotulo).toBeNull();
    expect(conf(undefined).secoes[0]!.perguntas[0]!.rotulo).toBeNull();
    expect(conf("x".repeat(40)).erros).toEqual([]);
    expect(conf("x".repeat(41)).erros).toEqual([
      { campo: "p1", motivo: "limite" },
    ]);
  });

  it("escala: guarda o rótulo de cada ponto, aparado e na ordem", () => {
    const r = conferirSecoes([
      secao("s1", [
        pergunta("e4", {
          tipo: "escala",
          config: {
            minimo: 1,
            maximo: 4,
            rotulos: [
              " Discordo ",
              "Discordo um pouco",
              "Concordo um pouco",
              "Concordo",
            ],
          },
        }),
      ]),
    ]);
    expect(r.erros).toEqual([]);
    expect(r.secoes[0]!.perguntas[0]!.config.rotulos).toEqual([
      "Discordo",
      "Discordo um pouco",
      "Concordo um pouco",
      "Concordo",
    ]);
  });

  it("escala com rótulos: guarda a exibição do maior para o menor", () => {
    const conf = (extra: Record<string, unknown>) =>
      conferirSecoes([
        secao("s1", [
          pergunta("e7", {
            tipo: "escala",
            config: {
              minimo: 1,
              maximo: 3,
              rotulos: ["Ruim", "Boa", "Ótima"],
              ...extra,
            },
          }),
        ]),
      ]);
    const r = conf({ decrescente: true });
    expect(r.erros).toEqual([]);
    expect(r.secoes[0]!.perguntas[0]!.config.decrescente).toBe(true);
    expect(
      conf({ decrescente: false }).secoes[0]!.perguntas[0]!.config,
    ).not.toHaveProperty("decrescente");
    expect(conf({}).secoes[0]!.perguntas[0]!.config).not.toHaveProperty(
      "decrescente",
    );
    expect(conf({ decrescente: "sim" }).erros).toEqual([
      { campo: "e7", motivo: "invalido" },
    ]);
  });

  it("escala: sem rótulos por ponto, a configuração fica como antes", () => {
    const r = conferirSecoes([
      secao("s1", [pergunta("e5", { tipo: "escala", config: { maximo: 5 } })]),
    ]);
    expect(r.erros).toEqual([]);
    expect(r.secoes[0]!.perguntas[0]!.config).not.toHaveProperty("rotulos");
  });

  it.each([
    ["quantidade diferente dos pontos", ["a", "b", "c"]],
    ["rótulo vazio", ["a", "", "c", "d"]],
    ["rótulo longo demais", ["a", "b", "c", "x".repeat(LIMITES.rotulo + 1)]],
    ["não é lista", "a,b,c,d"],
    ["item que não é texto", ["a", 2, "c", "d"]],
  ])("escala: recusa rótulos por ponto inválidos (%s)", (_caso, rotulos) => {
    const r = conferirSecoes([
      secao("s1", [
        pergunta("e6", {
          tipo: "escala",
          config: { minimo: 1, maximo: 4, rotulos },
        }),
      ]),
    ]);
    expect(r.erros).toEqual([{ campo: "e6", motivo: "invalido" }]);
  });
});

describe("T216 — modelos: chave, LNPS, rótulos dos pontos e escalas de 4 pontos", () => {
  const uma = (pergunta: Record<string, unknown>) =>
    conferirSecoes([
      {
        id: "s1",
        titulo: null,
        descricao: null,
        perguntas: [{ id: "p1", texto: "Pergunta", ...pergunta }],
      },
    ]);

  it("guarda a chave do item do modelo; sem chave, o campo não aparece", () => {
    const r = uma({ tipo: "concordancia", chave: "pc_ae_01" });
    expect(r.erros).toEqual([]);
    expect(r.secoes[0]!.perguntas[0]!.chave).toBe("pc_ae_01");
    expect(
      "chave" in uma({ tipo: "concordancia" }).secoes[0]!.perguntas[0]!,
    ).toBe(false);
    expect(
      uma({ tipo: "concordancia", chave: "__comentario_x__" }).erros,
    ).toEqual([]);
  });

  it("recusa chave fora do formato", () => {
    for (const chave of ["com espaço", "x".repeat(41), 7, ""]) {
      expect(uma({ tipo: "concordancia", chave }).erros).toEqual([
        { campo: "p1", motivo: "invalido" },
      ]);
    }
  });

  it("nota 0–10: LNPS e o texto das pontas; eNPS e LNPS juntos não", () => {
    const lnps = uma({
      tipo: "nota_0_10",
      config: {
        lnps: true,
        rotuloMinimo: " Pouco provável ",
        rotuloMaximo: "Muito provável",
      },
    });
    expect(lnps.erros).toEqual([]);
    expect(lnps.secoes[0]!.perguntas[0]!.config).toEqual({
      enps: false,
      lnps: true,
      rotuloMinimo: "Pouco provável",
      rotuloMaximo: "Muito provável",
    });
    expect(
      uma({ tipo: "nota_0_10", config: { enps: true } }).secoes[0]!
        .perguntas[0]!.config,
    ).toEqual({ enps: true });
    expect(
      uma({ tipo: "nota_0_10", config: { enps: true, lnps: true } }).erros,
    ).toEqual([{ campo: "p1", motivo: "invalido" }]);
    expect(uma({ tipo: "nota_0_10", config: { lnps: "sim" } }).erros).toEqual([
      { campo: "p1", motivo: "invalido" },
    ]);
  });

  it("escala: um rótulo por ponto, aparados; quantidade errada ou vazio recusa", () => {
    const rotulos = ["Nada", " Pouco ", "Médio", "Muito"];
    const ok = uma({
      tipo: "escala",
      config: { minimo: 1, maximo: 4, rotulos },
    });
    expect(ok.erros).toEqual([]);
    expect(ok.secoes[0]!.perguntas[0]!.config.rotulos).toEqual([
      "Nada",
      "Pouco",
      "Médio",
      "Muito",
    ]);
    const recusa = [{ campo: "p1", motivo: "invalido" }];
    expect(
      uma({ tipo: "escala", config: { minimo: 1, maximo: 5, rotulos } }).erros,
    ).toEqual(recusa);
    expect(
      uma({
        tipo: "escala",
        config: { minimo: 0, maximo: 3, rotulos: ["a", "", "c", "d"] },
      }).erros,
    ).toEqual(recusa);
    expect(
      uma({ tipo: "escala", config: { maximo: 2, rotulos: "a,b" } }).erros,
    ).toEqual(recusa);
    expect(
      uma({ tipo: "escala", config: { maximo: 5, rotulos: null } }).secoes[0]!
        .perguntas[0]!.config,
    ).toEqual({ minimo: 1, maximo: 5, rotuloMinimo: null, rotuloMaximo: null });
  });

  it("concordância e satisfação de 4 pontos são tipos aceitos", () => {
    expect(uma({ tipo: "concordancia_4" }).erros).toEqual([]);
    expect(uma({ tipo: "satisfacao_4" }).erros).toEqual([]);
    expect(uma({ tipo: "satisfacao_5" }).erros).toEqual([
      { campo: "p1", motivo: "invalido" },
    ]);
  });

  it("aceita 62 perguntas (Pesquisa de Clima) e recusa acima de 100", () => {
    const n = (q: number) =>
      conferirSecoes([
        secao(
          "s1",
          Array.from({ length: q }, (_, i) =>
            pergunta(`p${i}`, { tipo: "concordancia" }),
          ),
        ),
      ]).erros;
    expect(LIMITES.perguntas).toBe(100);
    expect(n(62)).toEqual([]);
    expect(n(100)).toEqual([]);
    expect(n(101)).toEqual([{ campo: "secoes", motivo: "limite" }]);
  });
});
