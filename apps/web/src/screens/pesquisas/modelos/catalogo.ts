/**
 * T216 — os modelos com metodologia própria (catálogo de dados, sem telas).
 * Cada um mora em `modelos/<id>/definicao.ts`; `modeloDaGaleria` os encontra
 * por aqui. A galeria (cards, filtros e categorias) liga cada modelo à parte.
 */
import type { ModeloPesquisa } from "../../../api/pesquisasClient";
import type { ModeloDaGaleria } from "../modelosDePesquisa";
import { MODELO_NR1 } from "./copsoq/definicao";
import { MODELO_ISFB } from "./isfb/definicao";

export const MODELOS_REGISTRADOS: readonly ModeloDaGaleria[] = [
  MODELO_NR1,
  MODELO_ISFB,
];

/** Questionário fixo: as perguntas não se editam nem se adicionam. */
export const QUESTIONARIOS_FIXOS: ReadonlySet<ModeloPesquisa> = new Set([
  "copsoq",
  "isfb",
]);

export const ehQuestionarioFixo = (modelo: ModeloPesquisa): boolean =>
  QUESTIONARIOS_FIXOS.has(modelo);

/** Categoria do modelo na galeria (a galeria cria o grupo "Saúde e NR-1"). */
export const CATEGORIA_NA_GALERIA: Readonly<Record<string, string>> = {
  copsoq: "saude",
  isfb: "saude",
};
