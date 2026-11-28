/**
 * T216 — Pulso e Clima: a faixa do score 0–100 (a mesma regra da API):
 * abaixo de 50 crítico · 50 a 69 atenção · 70 a 84 saudável · 85 ou mais
 * forte.
 */
import type { FaixaDeScore } from "../../../../api/pesquisasClient";

export function faixaDoScoreLocal(score: number): FaixaDeScore {
  if (score < 50) return "critico";
  if (score < 70) return "atencao";
  if (score < 85) return "saudavel";
  return "forte";
}
