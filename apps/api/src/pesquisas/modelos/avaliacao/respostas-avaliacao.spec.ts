import {
  conferirRespostaDaAvaliacao,
  lerRespostaDaAvaliacao,
} from "./respostas-avaliacao";
import { ITENS } from "./definicao";

/** T216 — a resposta de uma avaliação (24 afirmações + comentários). */

const todas = (n: number, exceto: Record<string, unknown> = {}) =>
  ITENS.map((i) => ({
    perguntaId: i.id,
    valor: i.id in exceto ? exceto[i.id] : n,
  }));

describe("T216 — conferir a resposta da avaliação", () => {
  it("aceita as 24 notas e guarda os comentários depois delas", () => {
    const r = conferirRespostaDaAvaliacao(
      todas(4),
      { comunicacao: "  Explica bem as metas.  ", lideranca: "" },
      "opcionais",
    );
    expect(r.erros).toEqual([]);
    expect(r.resposta!.valores).toHaveLength(25);
    expect(r.resposta!.valores.at(-1)).toEqual({
      perguntaId: "comentario_comunicacao",
      valor: "Explica bem as metas.",
    });
    expect(r.resposta!.comentarios).toEqual({
      comunicacao: "Explica bem as metas.",
    });
  });

  it("todas as 24 são obrigatórias, de 1 a 5, inteiras", () => {
    const r = conferirRespostaDaAvaliacao(
      todas(3, { com_1: undefined, teq_1: 6, pro_1: 2.5, org_1: null }),
      {},
      "opcionais",
    );
    expect(r.resposta).toBeNull();
    expect(r.erros).toEqual([
      { campo: "com_1", motivo: "obrigatorio" },
      { campo: "teq_1", motivo: "invalido" },
      { campo: "pro_1", motivo: "invalido" },
      { campo: "org_1", motivo: "obrigatorio" },
    ]);
  });

  it("recusa id desconhecido, repetido, lista inválida e comentário fora do catálogo", () => {
    expect(
      conferirRespostaDaAvaliacao(
        [...todas(3), { perguntaId: "xyz", valor: 3 }],
        {},
        "opcionais",
      ).erros,
    ).toEqual([{ campo: "respostas", motivo: "invalido" }]);
    expect(
      conferirRespostaDaAvaliacao(
        [...todas(3), { perguntaId: "com_1", valor: 3 }],
        {},
        "opcionais",
      ).erros,
    ).toEqual([{ campo: "respostas", motivo: "invalido" }]);
    expect(conferirRespostaDaAvaliacao("x", {}, "opcionais").erros).toEqual([
      { campo: "respostas", motivo: "invalido" },
    ]);
    expect(
      conferirRespostaDaAvaliacao(todas(3), { simpatia: "x" }, "opcionais")
        .erros,
    ).toEqual([{ campo: "comentarios", motivo: "invalido" }]);
    expect(
      conferirRespostaDaAvaliacao(todas(3), "texto", "opcionais").erros,
    ).toEqual([{ campo: "comentarios", motivo: "invalido" }]);
  });

  it("comentário longo demais", () => {
    const r = conferirRespostaDaAvaliacao(
      todas(3),
      { lideranca: "x".repeat(1001) },
      "opcionais",
    );
    expect(r.erros).toEqual([
      { campo: "comentario_lideranca", motivo: "limite" },
    ]);
  });

  it("notas extremas pedem comentário (média < 2,5 ou = 5)", () => {
    const notas = todas(3, {
      com_1: 5,
      com_2: 5,
      com_3: 5,
      lid_1: 2,
      lid_2: 2,
      lid_3: 3,
    });
    const r = conferirRespostaDaAvaliacao(notas, {}, "extremos");
    expect(r.erros).toEqual([
      { campo: "comentario_comunicacao", motivo: "obrigatorio" },
      { campo: "comentario_lideranca", motivo: "obrigatorio" },
    ]);
    const ok = conferirRespostaDaAvaliacao(
      notas,
      { comunicacao: "a", lideranca: "b" },
      "extremos",
    );
    expect(ok.erros).toEqual([]);
  });

  it("obrigatórios: um comentário por competência", () => {
    const r = conferirRespostaDaAvaliacao(todas(3), {}, "obrigatorios");
    expect(r.erros).toHaveLength(8);
    expect(
      conferirRespostaDaAvaliacao(todas(3), {}, "opcionais").erros,
    ).toEqual([]);
  });

  it("lê de volta notas e comentários gravados", () => {
    const r = conferirRespostaDaAvaliacao(
      todas(4),
      { organizacao: "Cumpre prazos." },
      "opcionais",
    );
    const lido = lerRespostaDaAvaliacao(r.resposta!.valores);
    expect(lido.notas.com_1).toBe(4);
    expect(Object.keys(lido.notas)).toHaveLength(24);
    expect(lido.comentarios).toEqual({ organizacao: "Cumpre prazos." });
    expect(lerRespostaDaAvaliacao(null)).toEqual({
      notas: {},
      comentarios: {},
    });
  });
});
