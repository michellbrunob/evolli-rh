/**
 * T216 — Perfil comportamental (DISC): um resultado da API para os testes
 * (3 respostas anônimas: I puro, S puro e D/C; o time fica equilibrado
 * D/C/S). Os números são os que o cálculo da API devolve.
 */
import type { PessoaDisc, ResultadoDisc } from "./tiposDisc";

const pessoa = (
  numero: number,
  perfil: PessoaDisc["perfil"],
  nome: string | null = null,
): PessoaDisc => ({
  respostaId: `r${numero}`,
  numero,
  nome,
  departamento: null,
  respondidaEm: `2026-11-27T1${numero}:00:00.000Z`,
  perfil,
});

export function resultadoDeTeste(
  extra: Partial<ResultadoDisc> = {},
): ResultadoDisc {
  return {
    pesquisaId: "p-1",
    respostas: 3,
    recortes: [],
    grupos: {},
    filtro: { campo: null, grupoId: null, respostas: 3, visivel: true },
    perfil: {
      pontos: { D: 23, I: 17, S: 21, C: 23 },
      total: 84,
      percentuais: { D: 27, I: 20, S: 25, C: 27 },
      predominante: "D",
      classe: {
        tipo: "tri",
        fatores: ["D", "C", "S"],
        codigo: "DCS",
        intensidade: "equilibrado",
      },
      posicao: { x: 52.5, y: 54.5, area: 2 },
    },
    totalDePessoas: 3,
    porPredominante: { D: 1, I: 1, S: 1, C: 0 },
    intensidades: { puro: 2, acentuado: 1, moderado: 0, equilibrado: 0 },
    areas: [
      { area: 4, pessoas: 1 },
      { area: 10, pessoas: 1 },
      { area: 13, pessoas: 1 },
    ],
    diversidade: { score: 79, faixa: "equilibrado", ausentes: ["C"] },
    lacunas: ["C"],
    compatibilidade: {
      matriz: [
        {
          a: "D",
          b: "D",
          relacao: "neutro",
          tipo: "mesma_linguagem",
          pares: 0,
        },
        { a: "D", b: "I", relacao: "sinergia", tipo: "complementar", pares: 1 },
        { a: "D", b: "S", relacao: "atrito", tipo: "pede_atencao", pares: 1 },
        { a: "D", b: "C", relacao: "neutro", tipo: "complementar", pares: 0 },
        {
          a: "I",
          b: "I",
          relacao: "sinergia",
          tipo: "mesma_linguagem",
          pares: 0,
        },
        { a: "I", b: "S", relacao: "sinergia", tipo: "complementar", pares: 1 },
        { a: "I", b: "C", relacao: "atrito", tipo: "pede_atencao", pares: 0 },
        {
          a: "S",
          b: "S",
          relacao: "sinergia",
          tipo: "mesma_linguagem",
          pares: 0,
        },
        { a: "S", b: "C", relacao: "sinergia", tipo: "complementar", pares: 0 },
        {
          a: "C",
          b: "C",
          relacao: "neutro",
          tipo: "mesma_linguagem",
          pares: 0,
        },
      ],
      totalDePares: 3,
      porTipo: {
        mesma_linguagem: { pares: 0, percentual: 0 },
        complementar: { pares: 2, percentual: 67 },
        pede_atencao: { pares: 1, percentual: 33 },
      },
      maiorAtencao: { a: "D", b: "S", pares: 1 },
    },
    pontos: [
      { x: 18, y: 28, area: 4, fator: "I" },
      { x: 50, y: 98, area: 13, fator: "D" },
      { x: 89, y: 36, area: 10, fator: "S" },
    ],
    pessoas: [
      pessoa(1, {
        pontos: { D: 6, I: 17, S: 3, C: 2 },
        total: 28,
        percentuais: { D: 21, I: 61, S: 11, C: 7 },
        predominante: "I",
        classe: {
          tipo: "mono",
          fatores: ["I"],
          codigo: "I",
          intensidade: "puro",
        },
        posicao: { x: 18, y: 28, area: 4 },
      }),
      pessoa(2, {
        pontos: { D: 3, I: 0, S: 18, C: 7 },
        total: 28,
        percentuais: { D: 11, I: 0, S: 64, C: 25 },
        predominante: "S",
        classe: {
          tipo: "mono",
          fatores: ["S"],
          codigo: "S",
          intensidade: "puro",
        },
        posicao: { x: 89, y: 36, area: 10 },
      }),
      pessoa(3, {
        pontos: { D: 14, I: 0, S: 0, C: 14 },
        total: 28,
        percentuais: { D: 50, I: 0, S: 0, C: 50 },
        predominante: "D",
        classe: {
          tipo: "bi",
          fatores: ["D", "C"],
          codigo: "DC",
          intensidade: "acentuado",
        },
        posicao: { x: 50, y: 98, area: 13 },
      }),
    ],
    ...extra,
  };
}
