/**
 * T216 — o registro dos modelos com regra própria. Cada frente acrescenta a
 * entrada do seu modelo (uma linha no objeto abaixo); o service, o cálculo
 * dos resultados e o resultado individual consultam só este arquivo.
 *
 * - `estrutura`: metodologia fixa — os itens são conferidos ao gravar
 *   (`secoes` → 422 `estrutura_do_modelo`).
 * - `calcular`: o resultado agregado (`ResultadosPesquisa.modelo`).
 * - `individual`: o resultado da pessoa (`RespostaDetalhe.modelo`).
 */
import type { ErroDeCampo } from "../../common/erros/recusa-por-campo";
import type { Modelo, Secao } from "../pesquisas.types";
import { calcularClima } from "./clima/calculo";
import { ESTRUTURA_CLIMA } from "./clima/definicao";
import { conferirEstruturaFixa } from "./comum";
import { ESTRUTURA_DISC } from "./disc/definicao-disc";
import { calcularPulsoClima } from "./pulso_clima/calculo";
import { ESTRUTURA_PULSO_CLIMA } from "./pulso_clima/definicao";
import { calcularTad, individualDaTad } from "./tad/calculo";
import { ESTRUTURA_TAD } from "./tad/definicao";
import type {
  ModeloRegistrado,
  RespostaDoModelo,
  ResultadoDoModelo,
  ResultadoIndividualDoModelo,
} from "./tipos";

export const MODELOS_REGISTRADOS: Partial<Record<Modelo, ModeloRegistrado>> = {
  pulso_clima: {
    modelo: "pulso_clima",
    estrutura: ESTRUTURA_PULSO_CLIMA,
    calcular: calcularPulsoClima,
  },
  clima: {
    modelo: "clima",
    estrutura: ESTRUTURA_CLIMA,
    calcular: calcularClima,
  },
  tad: {
    modelo: "tad",
    estrutura: ESTRUTURA_TAD,
    calcular: calcularTad,
    individual: individualDaTad,
  },
  // O resultado do DISC tem rota própria (`/perfil-comportamental`).
  disc: { modelo: "disc", estrutura: ESTRUTURA_DISC },
};

/** Metodologia fixa: os erros da estrutura (vazio quando confere). */
export function errosDaEstruturaDoModelo(
  modelo: Modelo,
  secoes: readonly Secao[],
): ErroDeCampo[] {
  const estrutura = MODELOS_REGISTRADOS[modelo]?.estrutura;
  return estrutura ? conferirEstruturaFixa(estrutura, secoes) : [];
}

/** O resultado agregado do modelo, ou `null` se ele não tem cálculo próprio. */
export function resultadoDoModelo(
  modelo: Modelo,
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
): ResultadoDoModelo | null {
  const calcular = MODELOS_REGISTRADOS[modelo]?.calcular;
  return calcular ? calcular(secoes, respostas) : null;
}

/** O resultado de uma pessoa no modelo, ou `null`. */
export function resultadoIndividualDoModelo(
  modelo: Modelo,
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): ResultadoIndividualDoModelo | null {
  const individual = MODELOS_REGISTRADOS[modelo]?.individual;
  return individual ? individual(secoes, valores) : null;
}
