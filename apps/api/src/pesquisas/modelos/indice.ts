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
import {
  calcularClima,
  individualDoClima,
  resumoDaRespostaDoClima,
} from "./clima/calculo";
import { conferirEstruturaDoClima } from "./clima/definicao";
import { conferirEstruturaFixa } from "./comum";
import { ESTRUTURA_DISC } from "./disc/definicao-disc";
import { ESTRUTURA_DA_AVALIACAO } from "./avaliacao/definicao";
import {
  calcularPulsoClima,
  indicadorDoPulsoClima,
  individualDoPulsoClima,
} from "./pulso_clima/calculo";
import { ESTRUTURA_PULSO_CLIMA } from "./pulso_clima/definicao";
import { calcularTad, indicadorDaTad, individualDaTad } from "./tad/calculo";
import { calcularNr1DoModelo, individualNr1DoModelo } from "./copsoq/calculo";
import { ESTRUTURA_NR1 } from "./copsoq/definicao";
import { calcularIsfbDoModelo, individualIsfbDoModelo } from "./isfb/calculo";
import { ESTRUTURA_ISFB } from "./isfb/definicao";
import { ESTRUTURA_TAD } from "./tad/definicao";
import { calcularEnps, individualDoEnps } from "./enps/calculo";
import { conferirEstruturaDoEnps } from "./enps/definicao";
import type {
  ContextoDoModelo,
  ModeloRegistrado,
  RespostaDoModelo,
  ResultadoDoModelo,
  ResultadoIndividualDoModelo,
  ResumoDaRespostaDoModelo,
} from "./tipos";

export const MODELOS_REGISTRADOS: Partial<Record<Modelo, ModeloRegistrado>> = {
  pulso_clima: {
    modelo: "pulso_clima",
    estrutura: ESTRUTURA_PULSO_CLIMA,
    calcular: calcularPulsoClima,
    individual: individualDoPulsoClima,
    resumoDaResposta: indicadorDoPulsoClima,
  },
  // Clima: perguntas editáveis (a API confere só chave e tipo).
  clima: {
    modelo: "clima",
    conferir: conferirEstruturaDoClima,
    calcular: calcularClima,
    individual: individualDoClima,
    resumoDaResposta: resumoDaRespostaDoClima,
  },
  // Avaliação 90°/180°: as 24 afirmações fixas; o cálculo e os resultados
  // nominais ficam nas rotas próprias (`modelos/avaliacao/`).
  avaliacao90: { modelo: "avaliacao90", estrutura: ESTRUTURA_DA_AVALIACAO },
  avaliacao180: { modelo: "avaliacao180", estrutura: ESTRUTURA_DA_AVALIACAO },
  tad: {
    modelo: "tad",
    estrutura: ESTRUTURA_TAD,
    calcular: calcularTad,
    individual: individualDaTad,
    resumoDaResposta: indicadorDaTad,
  },
  // O resultado do DISC tem rota própria (`/perfil-comportamental`).
  disc: { modelo: "disc", estrutura: ESTRUTURA_DISC },
  copsoq: {
    modelo: "copsoq",
    estrutura: ESTRUTURA_NR1,
    calcular: calcularNr1DoModelo,
    individual: individualNr1DoModelo,
  },
  isfb: {
    modelo: "isfb",
    estrutura: ESTRUTURA_ISFB,
    calcular: calcularIsfbDoModelo,
    individual: individualIsfbDoModelo,
  },
  // eNPS: só a principal é fixa; as demais perguntas são livres.
  enps: {
    modelo: "enps",
    conferir: conferirEstruturaDoEnps,
    calcular: calcularEnps,
    individual: individualDoEnps,
  },
};

/** Metodologia fixa: os erros da estrutura (vazio quando confere). */
export function errosDaEstruturaDoModelo(
  modelo: Modelo,
  secoes: readonly Secao[],
): ErroDeCampo[] {
  const registrado = MODELOS_REGISTRADOS[modelo];
  if (registrado?.conferir) return registrado.conferir(secoes);
  const estrutura = registrado?.estrutura;
  return estrutura ? conferirEstruturaFixa(estrutura, secoes) : [];
}

/** O resultado agregado do modelo, ou `null` se ele não tem cálculo próprio. */
export function resultadoDoModelo(
  modelo: Modelo,
  secoes: readonly Secao[],
  respostas: readonly RespostaDoModelo[],
  contexto?: ContextoDoModelo,
): ResultadoDoModelo | null {
  const calcular = MODELOS_REGISTRADOS[modelo]?.calcular;
  return calcular ? calcular(secoes, respostas, contexto) : null;
}

/** O resumo de uma resposta na lista (ex.: o índice do Clima), ou `null`. */
export function resumoDaRespostaDoModelo(
  modelo: Modelo,
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): ResumoDaRespostaDoModelo | null {
  const resumo = MODELOS_REGISTRADOS[modelo]?.resumoDaResposta;
  return resumo ? resumo(secoes, valores) : null;
}

/** O resultado de uma pessoa no modelo, ou `null`. */
export function resultadoIndividualDoModelo(
  modelo: Modelo,
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
  respostas?: readonly RespostaDoModelo[],
): ResultadoIndividualDoModelo | null {
  const individual = MODELOS_REGISTRADOS[modelo]?.individual;
  return individual ? individual(secoes, valores, respostas) : null;
}
