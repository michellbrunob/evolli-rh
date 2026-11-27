/**
 * T216 — Motivação (TAD): 21 afirmações na escala de 1 a 7 em 3 pilares
 * (autonomia 7, competência 6, relacionamento 8). Itens invertidos valem
 * `8 − resposta`. Metodologia fixa: a API confere os itens.
 */
import type { EstruturaFixa, ItemFixo } from "../tipos";

export const PILARES_TAD = [
  { chave: "autonomia", rotulo: "Autonomia" },
  { chave: "competencia", rotulo: "Competência" },
  { chave: "relacionamento", rotulo: "Relacionamento" },
] as const;

/** Os rótulos dos 7 pontos, de 1 a 7. */
export const ROTULOS_TAD = [
  "Nada verdadeiro",
  "Quase nunca verdadeiro",
  "Raramente verdadeiro",
  "Neutro",
  "Frequentemente verdadeiro",
  "Quase sempre verdadeiro",
  "Totalmente verdadeiro",
] as const;

/** As 21 afirmações, na ordem, com o pilar e a inversão. */
export const ITENS_TAD: readonly {
  chave: string;
  pilar: string;
  invertido: boolean;
}[] = (
  [
    ["autonomia", false],
    ["relacionamento", false],
    ["competencia", true],
    ["competencia", false],
    ["autonomia", true],
    ["relacionamento", false],
    ["relacionamento", true],
    ["autonomia", false],
    ["relacionamento", false],
    ["competencia", false],
    ["autonomia", true],
    ["competencia", false],
    ["autonomia", false],
    ["competencia", true],
    ["relacionamento", false],
    ["relacionamento", true],
    ["autonomia", false],
    ["relacionamento", true],
    ["competencia", true],
    ["autonomia", true],
    ["relacionamento", false],
  ] as const
).map(([pilar, invertido], i) => ({
  chave: `tad_${String(i + 1).padStart(2, "0")}`,
  pilar,
  invertido,
}));

export const ESTRUTURA_TAD: EstruturaFixa = {
  itens: ITENS_TAD.map((i): ItemFixo => ({
    chave: i.chave,
    tipo: "escala",
    config: (c) => c.minimo === 1 && c.maximo === 7,
  })),
  opcionais: [],
};
