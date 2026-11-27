import type { Modelo } from "../pesquisas.types";
import { ESTRUTURA_NR1 } from "./copsoq/definicao";
import type { EstruturaFixa } from "./estrutura-fixa";
import { ESTRUTURA_ISFB } from "./isfb/definicao";

/**
 * T216 — o ponto de registro dos modelos com metodologia própria. Cada
 * modelo mora em `modelos/<id>/` (definição, cálculo puro e regras) e entra
 * aqui: o questionário fixo vale para criar e editar a pesquisa; os modelos
 * com cálculo próprio respondem em `GET /pesquisas/:id/modelo/resultado`.
 */

export const ESTRUTURAS_FIXAS: Partial<Record<Modelo, EstruturaFixa>> = {
  copsoq: ESTRUTURA_NR1,
  isfb: ESTRUTURA_ISFB,
};

export function estruturaFixaDo(modelo: Modelo): EstruturaFixa | null {
  return ESTRUTURAS_FIXAS[modelo] ?? null;
}

/** Os modelos com resultado próprio (`/modelo/resultado`). */
export const MODELOS_COM_RESULTADO = ["copsoq", "isfb"] as const;
export type ModeloComResultado = (typeof MODELOS_COM_RESULTADO)[number];

export function temResultadoProprio(m: Modelo): m is ModeloComResultado {
  return (MODELOS_COM_RESULTADO as readonly string[]).includes(m);
}
