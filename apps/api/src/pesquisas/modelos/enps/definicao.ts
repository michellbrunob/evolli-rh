/**
 * T216 — eNPS: a pergunta principal (nota de 0 a 10, a que calcula o
 * eNPS), 5 complementares na mesma escala de 0 a 10 e 2 abertas. Só a
 * principal é fixa: as demais podem ser editadas, removidas ou somadas
 * (escala de 0 a 10 ou texto livre), até 15 perguntas.
 */
import type { ErroDeCampo } from "../../../common/erros/recusa-por-campo";
import type { Pergunta, Secao } from "../../pesquisas.types";

export const CHAVE_PRINCIPAL_DO_ENPS = "enps_principal";

export const COMPLEMENTARES_DO_ENPS = [
  "enps_satisfacao",
  "enps_ambiente",
  "enps_lideranca",
  "enps_crescimento",
  "enps_reconhecimento",
] as const;

export const ABERTAS_DO_ENPS = ["enps_gosta", "enps_melhoraria"] as const;

/** A pergunta de recomendação do eNPS (nota 0–10 marcada como eNPS). */
export const ehNotaDoEnps = (p: Pergunta): boolean =>
  p.tipo === "nota_0_10" && p.config.enps === true;

/**
 * Uma complementar: nota de 0 a 10 que não é de recomendação (a escala de
 * 0 a 10 do modelo, ou a nota 0–10 sem eNPS/LNPS).
 */
export const ehComplementarDoEnps = (p: Pergunta): boolean =>
  (p.tipo === "escala" &&
    (p.config.minimo ?? 1) === 0 &&
    (p.config.maximo ?? 5) === 10) ||
  (p.tipo === "nota_0_10" && p.config.enps !== true && p.config.lnps !== true);

/**
 * A principal é fixa: exatamente uma nota de eNPS, a do modelo
 * (`enps_principal`). Erro único em `secoes`.
 */
export function conferirEstruturaDoEnps(
  secoes: readonly Secao[],
): ErroDeCampo[] {
  const todas = secoes.flatMap((s) => s.perguntas);
  const principais = todas.filter((p) => p.chave === CHAVE_PRINCIPAL_DO_ENPS);
  const notasDoEnps = todas.filter(ehNotaDoEnps);
  const confere =
    principais.length === 1 &&
    notasDoEnps.length === 1 &&
    notasDoEnps[0] === principais[0];
  return confere ? [] : [{ campo: "secoes", motivo: "estrutura_do_modelo" }];
}
