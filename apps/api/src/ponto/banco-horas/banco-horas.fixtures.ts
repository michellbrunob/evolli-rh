/**
 * Movimentos e cenários **exclusivamente sintéticos** para os testes do núcleo
 * de Banco de Horas (T052).
 *
 * Todos os valores são **fictícios e inventados** para exercitar a derivação do
 * extrato — jamais extraídos de arquivo, relógio, Secullum ou sistema real. Não
 * há CPF, nome, empresa real ou dado bruto: só identificadores **técnicos**,
 * datas `"AAAA-MM-DD"` sintéticas, minutos e origens técnicas.
 *
 * TypeScript puro — sem I/O, sem persistência, sem framework.
 */

import { MovimentoBancoHoras } from "./banco-horas.types";

/** Crédito sintético isolado (+120 min). */
export const MOV_CREDITO: MovimentoBancoHoras = {
  id: "MV-0001",
  natureza: "credito",
  minutos: 120,
  dataReferencia: "2026-07-01",
  origem: "apuracao_credito_extra",
};

/** Débito sintético isolado (−25 min). */
export const MOV_DEBITO: MovimentoBancoHoras = {
  id: "MV-0002",
  natureza: "debito",
  minutos: 25,
  dataReferencia: "2026-07-02",
  origem: "apuracao_debito_atraso_saida",
};

/**
 * Sequência sintética crédito + débito (ambos preservados como eventos
 * distintos): +120, −25, +90, −180 → saldo derivado +5.
 */
export const SEQUENCIA_CREDITO_DEBITO: readonly MovimentoBancoHoras[] = [
  MOV_CREDITO,
  MOV_DEBITO,
  {
    id: "MV-0003",
    natureza: "credito",
    minutos: 90,
    dataReferencia: "2026-07-10",
    origem: "apuracao_credito_extra",
  },
  {
    id: "MV-0004",
    natureza: "debito",
    minutos: 180,
    dataReferencia: "2026-08-05",
    origem: "apuracao_debito_compensacao",
  },
];

/**
 * Sequência que resulta em **saldo negativo** (resultado matemático, sem
 * decidir política): +30, −100 → saldo derivado −70.
 */
export const SEQUENCIA_SALDO_NEGATIVO: readonly MovimentoBancoHoras[] = [
  {
    id: "MN-0001",
    natureza: "credito",
    minutos: 30,
    dataReferencia: "2026-07-01",
    origem: "movimento_sintetico",
  },
  {
    id: "MN-0002",
    natureza: "debito",
    minutos: 100,
    dataReferencia: "2026-07-02",
    origem: "movimento_sintetico",
  },
];
