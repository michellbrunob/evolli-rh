import {
  AtribuicaoDeEquipe,
  ExcecaoIndividual,
  comoDiaIso,
  resolverEscopo,
  vigenteEm,
} from "./gestor-escopo";

/**
 * Cobertura do núcleo puro do escopo do gestor (T151, ADR 0015).
 *
 * Esta é a regra que decide quem um gestor pode ver. Testada sem banco, sem
 * sessão e sem HTTP de propósito: um erro aqui é um vazamento de dado de
 * terceiro, e o caso que importa — "sem atribuição, não vê ninguém" — precisa
 * ser provado isoladamente, não inferido do comportamento de uma rota.
 */

const atribuicao = (
  equipeId: string,
  inicio: string,
  fim: string | null = null,
  papel: "principal" | "substituto" = "principal",
): AtribuicaoDeEquipe => ({ equipeId, papel, inicio, fim });

const excecao = (
  vinculoId: string,
  inicio: string,
  fim: string,
  encerradaEm: string | null = null,
): ExcecaoIndividual => ({ vinculoId, inicio, fim, encerradaEm });

describe("vigenteEm — semântica [inicio, fim)", () => {
  it("inclui o dia de início", () => {
    expect(
      vigenteEm({ inicio: "2026-03-01", fim: "2026-04-01" }, "2026-03-01"),
    ).toBe(true);
  });

  it("EXCLUI o dia de fim — encerrar em D e recomeçar em D é sucessão", () => {
    expect(
      vigenteEm({ inicio: "2026-03-01", fim: "2026-04-01" }, "2026-04-01"),
    ).toBe(false);
  });

  it("período aberto vale indefinidamente para a frente", () => {
    expect(vigenteEm({ inicio: "2026-03-01", fim: null }, "2099-01-01")).toBe(
      true,
    );
  });

  it("não vale antes do início — vigência futura não antecipa acesso", () => {
    expect(vigenteEm({ inicio: "2026-03-01", fim: null }, "2026-02-28")).toBe(
      false,
    );
  });
});

describe("resolverEscopo", () => {
  it("sem atribuição e sem exceção, o escopo é VAZIO — nunca a empresa inteira", () => {
    const escopo = resolverEscopo([], [], "2026-06-01");
    expect(escopo.vazio).toBe(true);
    expect(escopo.equipeIds).toEqual([]);
    expect(escopo.vinculoIdsPorExcecao).toEqual([]);
  });

  it("um gestor com MÚLTIPLAS equipes alcança todas (ADR 0015, decisão 2)", () => {
    const escopo = resolverEscopo(
      [atribuicao("eq-1", "2026-01-01"), atribuicao("eq-2", "2026-01-01")],
      [],
      "2026-06-01",
    );
    expect([...escopo.equipeIds].sort()).toEqual(["eq-1", "eq-2"]);
    expect(escopo.vazio).toBe(false);
  });

  it("substituto alcança o mesmo que principal — cobertura que vê menos não cobre", () => {
    const comoPrincipal = resolverEscopo(
      [atribuicao("eq-1", "2026-01-01", null, "principal")],
      [],
      "2026-06-01",
    );
    const comoSubstituto = resolverEscopo(
      [atribuicao("eq-1", "2026-01-01", null, "substituto")],
      [],
      "2026-06-01",
    );
    expect(comoSubstituto.equipeIds).toEqual(comoPrincipal.equipeIds);
  });

  it("atribuição ENCERRADA não alcança mais", () => {
    const escopo = resolverEscopo(
      [atribuicao("eq-1", "2026-01-01", "2026-05-01")],
      [],
      "2026-06-01",
    );
    expect(escopo.vazio).toBe(true);
  });

  it("atribuição FUTURA ainda não alcança", () => {
    const escopo = resolverEscopo(
      [atribuicao("eq-1", "2026-09-01")],
      [],
      "2026-06-01",
    );
    expect(escopo.vazio).toBe(true);
  });

  it("na data exata do encerramento já não alcança, e na véspera ainda alcança", () => {
    const atrib = [atribuicao("eq-1", "2026-01-01", "2026-05-01")];
    expect(resolverEscopo(atrib, [], "2026-04-30").equipeIds).toEqual(["eq-1"]);
    expect(resolverEscopo(atrib, [], "2026-05-01").equipeIds).toEqual([]);
  });

  it("não repete equipe quando há principal e substituto na mesma", () => {
    const escopo = resolverEscopo(
      [
        atribuicao("eq-1", "2026-01-01", null, "principal"),
        atribuicao("eq-1", "2026-03-01", "2026-04-01", "substituto"),
      ],
      [],
      "2026-03-15",
    );
    expect(escopo.equipeIds).toEqual(["eq-1"]);
  });

  it("exceção vigente acrescenta o vínculo nomeado", () => {
    const escopo = resolverEscopo(
      [],
      [excecao("vin-x", "2026-01-01", "2026-12-01")],
      "2026-06-01",
    );
    expect(escopo.vinculoIdsPorExcecao).toEqual(["vin-x"]);
    expect(escopo.vazio).toBe(false);
  });

  it("exceção EXPIRADA não acrescenta nada", () => {
    const escopo = resolverEscopo(
      [],
      [excecao("vin-x", "2026-01-01", "2026-02-01")],
      "2026-06-01",
    );
    expect(escopo.vazio).toBe(true);
  });

  it("exceção FUTURA não acrescenta nada", () => {
    const escopo = resolverEscopo(
      [],
      [excecao("vin-x", "2026-09-01", "2026-12-01")],
      "2026-06-01",
    );
    expect(escopo.vazio).toBe(true);
  });

  it("exceção REVOGADA deixa de valer no dia da revogação, antes do prazo", () => {
    const comRevogacao = [
      excecao("vin-x", "2026-01-01", "2026-12-01", "2026-05-01"),
    ];
    // Antes da revogação ainda alcança...
    expect(
      resolverEscopo([], comRevogacao, "2026-04-30").vinculoIdsPorExcecao,
    ).toEqual(["vin-x"]);
    // ...e a partir dela, não — mesmo com o prazo original ainda em aberto.
    expect(resolverEscopo([], comRevogacao, "2026-05-01").vazio).toBe(true);
    expect(resolverEscopo([], comRevogacao, "2026-11-30").vazio).toBe(true);
  });

  it("combina equipe e exceção sem perder nenhuma das duas origens", () => {
    const escopo = resolverEscopo(
      [atribuicao("eq-1", "2026-01-01")],
      [excecao("vin-x", "2026-01-01", "2026-12-01")],
      "2026-06-01",
    );
    expect(escopo.equipeIds).toEqual(["eq-1"]);
    expect(escopo.vinculoIdsPorExcecao).toEqual(["vin-x"]);
  });
});

describe("comoDiaIso", () => {
  it("normaliza @db.Date do Prisma sem deslocar o dia por fuso", () => {
    // Prisma devolve `@db.Date` como meia-noite UTC. Formatar em fuso local
    // deslocaria para 04 em qualquer fuso a oeste de Greenwich — e deslocar o
    // dia aqui deslocaria a fronteira de um escopo de autorização.
    expect(comoDiaIso(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
  });

  it("preserva null", () => {
    expect(comoDiaIso(null)).toBeNull();
  });
});
