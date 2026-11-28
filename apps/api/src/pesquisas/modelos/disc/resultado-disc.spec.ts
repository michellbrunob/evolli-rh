import type { Secao } from "../../pesquisas.types";
import {
  type EntradaDoResultadoDisc,
  type RespostaDisc,
  montarResultadoDisc,
} from "./resultado-disc";

/** T216 — DISC: o resultado do endpoint (time, recorte e pessoas). */

function blocos(n: number): Secao[] {
  return [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: Array.from({ length: n }, (_, i) => ({
        id: `b${i + 1}`,
        tipo: "escolha_forcada" as const,
        texto: "Qual frase combina mais com você?",
        rotulo: null,
        descricao: null,
        obrigatoria: true,
        config: {
          opcoes: (["D", "I", "S", "C"] as const).map((fator) => ({
            id: `b${i + 1}-${fator}`,
            texto: `Frase ${fator}`,
            fator,
          })),
        },
        condicao: null,
      })),
    },
  ];
}

let n = 0;
function resposta(
  fatores: string,
  extra: Partial<RespostaDisc> = {},
): RespostaDisc {
  n += 1;
  return {
    id: `r${n}`,
    respondidaEm: new Date(Date.UTC(2026, 10, 27, 12, n)),
    valores: [...fatores].map((f, i) => ({
      perguntaId: `b${i + 1}`,
      valor: { opcao: `b${i + 1}-${f}` },
    })),
    grupos: {},
    autor: null,
    departamento: null,
    ...extra,
  };
}

const I17 = `${"I".repeat(17)}${"D".repeat(6)}SSSCC`;
const S18 = `${"S".repeat(18)}${"C".repeat(7)}DDD`;
const DC = `${"D".repeat(14)}${"C".repeat(14)}`;

function entrada(
  respostas: RespostaDisc[],
  extra: Partial<EntradaDoResultadoDisc> = {},
): EntradaDoResultadoDisc {
  return {
    pesquisaId: "p1",
    secoes: blocos(28),
    respostas,
    nomesDosGrupos: new Map([
      ["g1", "Comercial"],
      ["g2", "Operações"],
    ]),
    minimoPorGrupo: 3,
    filtro: null,
    recortes: [],
    minimoNaVisaoGeral: false,
    comPessoas: true,
    ...extra,
  };
}

describe("T216 — DISC: montarResultadoDisc", () => {
  it("o time do exemplo: equilibrado D/C/S, 3 pessoas e as pessoas numeradas", () => {
    const r = montarResultadoDisc(
      entrada([
        resposta(I17, { autor: "Ana", departamento: "Comercial" }),
        resposta(S18, { autor: "Bia", departamento: null }),
        resposta(DC, { autor: "Caio", departamento: "Operações" }),
      ]),
    );
    expect(r.respostas).toBe(3);
    expect(r.filtro).toEqual({
      campo: null,
      grupoId: null,
      respostas: 3,
      visivel: true,
    });
    expect(r.perfil!.percentuais).toEqual({ D: 27, I: 20, S: 25, C: 27 });
    expect(r.perfil!.classe.codigo).toBe("DCS");
    expect(r.totalDePessoas).toBe(3);
    expect(r.porPredominante).toEqual({ D: 1, I: 1, S: 1, C: 0 });
    expect(r.diversidade).toEqual({
      score: 79,
      faixa: "equilibrado",
      ausentes: ["C"],
    });
    expect(r.pessoas.map((p) => [p.numero, p.nome, p.departamento])).toEqual([
      [1, "Ana", "Comercial"],
      [2, "Bia", null],
      [3, "Caio", "Operações"],
    ]);
    expect(r.pessoas[0]!.perfil.percentuais).toEqual({
      D: 21,
      I: 61,
      S: 11,
      C: 7,
    });
    expect(r.pessoas[2]!.perfil.classe.codigo).toBe("DC");
    expect(r.pontos).toHaveLength(3);
  });

  it("os pontos do mapa saem pela posição, sem a ordem de chegada", () => {
    const r = montarResultadoDisc(
      entrada([resposta(S18), resposta(I17), resposta(DC)]),
    );
    const xs = r.pontos.map((p) => p.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(r.pontos[0]).toEqual({ x: 18, y: 28, area: 4, fator: "I" });
  });

  it("sem permissão (ou confidencial): nenhuma pessoa, o time inteiro", () => {
    const r = montarResultadoDisc(
      entrada([resposta(I17, { autor: "Ana" })], { comPessoas: false }),
    );
    expect(r.pessoas).toEqual([]);
    expect(r.totalDePessoas).toBe(1);
  });

  it("sem permissão e com recorte visível: ainda nenhuma pessoa", () => {
    const g = { grupos: { departamento: "g1" } };
    const r = montarResultadoDisc(
      entrada([resposta(I17, g), resposta(S18, g), resposta(DC, g)], {
        comPessoas: false,
        recortes: ["departamento"],
        filtro: { campo: "departamento", grupoId: "g1" },
      }),
    );
    expect(r.filtro.visivel).toBe(true);
    expect(r.totalDePessoas).toBe(3);
    expect(r.pessoas).toEqual([]);
  });

  it("confidencial com o mínimo: o time aparece, as pessoas não", () => {
    const r = montarResultadoDisc(
      entrada([resposta(I17), resposta(S18), resposta(DC)], {
        minimoNaVisaoGeral: true,
        comPessoas: false,
      }),
    );
    expect(r.perfil).not.toBeNull();
    expect(r.pontos).toHaveLength(3);
    expect(r.pessoas).toHaveLength(0);
  });

  it("anônima: as pessoas sem nome nem departamento", () => {
    const r = montarResultadoDisc(
      entrada([resposta(I17, { departamento: "Comercial" })]),
    );
    expect(r.pessoas[0]).toMatchObject({ nome: null, departamento: null });
  });

  it("resposta sem nenhum bloco não vira perfil", () => {
    const r = montarResultadoDisc(
      entrada([resposta(""), resposta(I17), resposta("SS")]),
    );
    expect(r.totalDePessoas).toBe(2);
    expect(r.pessoas.map((p) => p.numero)).toEqual([2, 3]);
    expect(r.pessoas[1]!.perfil.percentuais).toEqual({
      D: 0,
      I: 0,
      S: 100,
      C: 0,
    });
  });

  it("confidencial: abaixo do mínimo, nada aparece na visão geral", () => {
    const poucas = montarResultadoDisc(
      entrada([resposta(I17), resposta(S18)], {
        minimoNaVisaoGeral: true,
        comPessoas: false,
      }),
    );
    expect(poucas.filtro.visivel).toBe(false);
    expect(poucas.perfil).toBeNull();
    expect(poucas.pontos).toEqual([]);
    expect(poucas.respostas).toBe(2);
    const bastam = montarResultadoDisc(
      entrada([resposta(I17), resposta(S18), resposta(DC)], {
        minimoNaVisaoGeral: true,
        comPessoas: false,
      }),
    );
    expect(bastam.filtro.visivel).toBe(true);
    expect(bastam.totalDePessoas).toBe(3);
  });

  it("recorte por grupo: o mínimo e a proteção do grupo menor", () => {
    const g = (id: string) => ({ grupos: { departamento: id } });
    const respostas = [
      resposta(I17, g("g1")),
      resposta(I17, g("g1")),
      resposta(S18, g("g1")),
      resposta(DC, g("g2")),
      resposta(DC, g("g2")),
      resposta(DC, g("g2")),
      resposta(S18, g("g2")),
    ];
    const r = montarResultadoDisc(
      entrada(respostas, {
        recortes: ["departamento"],
        filtro: { campo: "departamento", grupoId: "g1" },
      }),
    );
    expect(r.grupos.departamento!.map((x) => [x.nome, x.visivel])).toEqual([
      ["Comercial", true],
      ["Operações", true],
    ]);
    expect(r.filtro).toEqual({
      campo: "departamento",
      grupoId: "g1",
      respostas: 3,
      visivel: true,
    });
    expect(r.porPredominante).toEqual({ D: 0, I: 2, S: 1, C: 0 });
    expect(r.pessoas.map((p) => p.numero)).toEqual([1, 2, 3]);

    // Um grupo com 2: oculto; o menor visível também (proteção).
    const comPequeno = [
      ...respostas,
      resposta(I17, { grupos: { departamento: "g3" } }),
      resposta(I17, { grupos: { departamento: "g3" } }),
    ];
    for (const grupoId of ["g3", "g1"]) {
      const o = montarResultadoDisc(
        entrada(comPequeno, {
          recortes: ["departamento"],
          filtro: { campo: "departamento", grupoId },
        }),
      );
      expect(o.filtro.visivel).toBe(false);
      expect(o.perfil).toBeNull();
      expect(o.pessoas).toEqual([]);
    }
  });

  it("recorte fora dos disponíveis: sem números", () => {
    const r = montarResultadoDisc(
      entrada([resposta(I17, { grupos: { unidade: "g1" } })], {
        recortes: ["departamento"],
        filtro: { campo: "unidade", grupoId: "g1" },
      }),
    );
    expect(r.filtro).toMatchObject({ respostas: 0, visivel: false });
    expect(r.totalDePessoas).toBe(0);
  });
});
