/**
 * Cenários e construtores **exclusivamente sintéticos** para os testes do motor
 * de apuração (T050).
 *
 * Todos os valores aqui são **fictícios e inventados** para exercitar a
 * semântica do contrato (`docs/modules/etapa3-motor-apuracao-puro-v1.md`) —
 * jamais extraídos de arquivo, relógio, Secullum ou de qualquer sistema real.
 * Não há CPF, nome, empresa real ou batida real: só faixas e horários `"HH:MM"`.
 *
 * TypeScript puro — sem I/O, sem persistência, sem framework.
 */

import { ApuracaoDiariaEntrada, ClassificacaoDia } from "./apuracao.types";

/**
 * Jornada prevista sintética padrão: dois blocos de 4h (08:00–12:00 e
 * 14:00–18:00) = **480 min** previstos, com 2h de intervalo.
 */
export const FAIXAS_PADRAO = [
  { inicio: "08:00", fim: "12:00" },
  { inicio: "14:00", fim: "18:00" },
] as const;

/** Constrói uma entrada de apuração sintética com padrões convenientes. */
export function montarDia(
  parcial: Partial<ApuracaoDiariaEntrada> & {
    classificacao: ClassificacaoDia;
  },
): ApuracaoDiariaEntrada {
  return {
    faixasPrevistas: parcial.faixasPrevistas ?? FAIXAS_PADRAO,
    marcacoes: parcial.marcacoes ?? [],
    classificacao: parcial.classificacao,
    ...(parcial.almocoLivre !== undefined
      ? { almocoLivre: parcial.almocoLivre }
      : {}),
  };
}

/**
 * Cenário homologado (a) — **dia normal**: marcações batendo exatamente com a
 * jornada prevista padrão. Sem crédito, sem débito.
 */
export const CENARIO_DIA_NORMAL: ApuracaoDiariaEntrada = montarDia({
  classificacao: "regular",
  marcacoes: ["08:00", "12:00", "14:00", "18:00"],
});

/**
 * Cenário homologado (b) — **atraso + hora extra**: entra 30 min atrasado no
 * 1º bloco e sai 60 min além no 2º bloco. Débito (30) e crédito (60) devem
 * permanecer **separados** (hora extra não compensa atraso).
 */
export const CENARIO_ATRASO_MAIS_EXTRA: ApuracaoDiariaEntrada = montarDia({
  classificacao: "regular",
  marcacoes: ["08:30", "12:00", "14:00", "19:00"],
});

/**
 * Cenário homologado (c) — conjunto de **classificações sem cálculo por
 * marcação**: falta justificada, feriado, folga, férias, falta injustificada e
 * compensação, todas sobre a mesma jornada prevista padrão.
 */
export const CENARIOS_CLASSIFICACAO: Readonly<
  Record<Exclude<ClassificacaoDia, "regular">, ApuracaoDiariaEntrada>
> = {
  falta_justificada: montarDia({ classificacao: "falta_justificada" }),
  feriado: montarDia({ classificacao: "feriado" }),
  folga: montarDia({ classificacao: "folga" }),
  ferias: montarDia({ classificacao: "ferias" }),
  falta_injustificada: montarDia({ classificacao: "falta_injustificada" }),
  compensacao: montarDia({ classificacao: "compensacao" }),
};

/** Jornada prevista com **três faixas** (manhã, tarde, noite) — 3×2h = 360 min. */
export const FAIXAS_MULTIPLAS = [
  { inicio: "08:00", fim: "10:00" },
  { inicio: "13:00", fim: "15:00" },
  { inicio: "16:00", fim: "18:00" },
] as const;
