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

  it("recusa mais de 60 perguntas no total", () => {
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
