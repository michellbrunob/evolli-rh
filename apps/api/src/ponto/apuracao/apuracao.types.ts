/**
 * Tipos do núcleo puro de apuração diária de jornada e banco de horas
 * (Ponto V1, T050).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, banco, rede, log ou variáveis de
 * ambiente. O motor recebe estruturas **sintéticas** em memória e devolve, em
 * memória, os componentes da apuração do dia **em minutos** e apontamentos
 * **não financeiros**.
 *
 * Contrato de referência: `docs/modules/etapa3-motor-apuracao-puro-v1.md` (T050).
 * O motor **não** calcula dinheiro, DSR financeiro, Folha, saldo acumulado,
 * quitação/pagamento de banco, fechamento, espelho ou assinatura; **não**
 * associa CPF a colaborador, não faz parsing/importação nem persiste.
 */

/**
 * Classificação sintética do dia — catálogo **fechado** (sem texto livre;
 * alinhado à ADR 0008 dec. 5 e à R12 do caderno de homologação, T049). É
 * **entrada** do motor; o motor **não** infere a classificação.
 */
export type ClassificacaoDia =
  | "regular"
  | "falta_justificada"
  | "falta_injustificada"
  | "feriado"
  | "folga"
  | "ferias"
  | "compensacao";

/** Uma faixa de trabalho prevista, em `"HH:MM"` 24h (o intervalo entre faixas é pausa). */
export interface FaixaPrevista {
  readonly inicio: string;
  readonly fim: string;
}

/**
 * Entrada do motor, **por dia e por vínculo**. O chamador já resolveu empresa,
 * colaborador e a versão de horário vigente (fora deste núcleo). Nada aqui é
 * dado real: faixas, marcações e classificação são **sintéticas**.
 */
export interface ApuracaoDiariaEntrada {
  /** Jornada prevista por faixas de trabalho (`"HH:MM"`), em ordem crescente. */
  readonly faixasPrevistas: readonly FaixaPrevista[];
  /**
   * Marcações sintéticas (`"HH:MM"`), em ordem **cronológica estrita**, pareadas
   * sequencialmente (1ª entrada, 2ª saída, 3ª entrada, …) — como num REP, sem
   * marca de tipo. Só é usada para cálculo no dia `regular`.
   */
  readonly marcacoes: readonly string[];
  /** Classificação sintética do dia (catálogo fechado). */
  readonly classificacao: ClassificacaoDia;
  /** Quando verdadeiro, aplica o intervalo mínimo de 1h (almoço livre). */
  readonly almocoLivre?: boolean;
}

/** Código de apontamento — catálogo fechado, sem texto livre. */
export type ApontamentoCodigo = "dsr_desconto_sinalizado";

/**
 * Apontamento **não financeiro** — um sinalizador codificado. O campo
 * `financeiro` é o literal `false` por construção: este motor **nunca** produz
 * efeito financeiro (R9 do caderno; `DP-3J-21`, cálculo financeiro, permanece
 * fora).
 */
export interface Apontamento {
  readonly codigo: ApontamentoCodigo;
  readonly financeiro: false;
}

/**
 * Impacto **diário proposto** ao banco de horas — crédito e débito como
 * **componentes separados** (T050 D2: hora extra não compensa nem apaga
 * atraso). Este objeto é o impacto **do dia**, nunca o saldo acumulado.
 */
export interface ImpactoBancoDia {
  readonly creditoMinutos: number;
  readonly debitoMinutos: number;
}

/** Código de erro **seguro** — rótulo técnico estável, nunca com dado sensível. */
export type ApuracaoErroCodigo =
  /** Faixa com horário fora do formato `"HH:MM"`. */
  | "FAIXA_HORARIO_INVALIDO"
  /** Faixa com fim menor ou igual ao início. */
  | "FAIXA_INTERVALO_INVALIDO"
  /** Faixas sobrepostas ou fora de ordem crescente. */
  | "FAIXA_FORA_DE_ORDEM"
  /** Marcação com horário fora do formato `"HH:MM"`. */
  | "MARCACAO_HORARIO_INVALIDO"
  /** Marcações fora de ordem cronológica estrita (inclui repetição). */
  | "MARCACAO_FORA_DE_ORDEM"
  /** Dia `regular`: nº de marcações não pareia com as faixas previstas. */
  | "MARCACOES_INCOMPATIVEIS_COM_FAIXAS"
  /** Almoço livre (≥1h) empurraria a entrada efetiva além da saída do bloco. */
  | "ALMOCO_INVERTE_BLOCO";

/** Erro de apuração — só código seguro (não há dado pessoal neste núcleo). */
export interface ErroApuracao {
  readonly codigo: ApuracaoErroCodigo;
}

/**
 * Resultado do motor — união discriminada por `status`.
 *
 * - `invalido`: entrada malformada (falha segura); nenhum componente calculado.
 * - `apurado`: componentes **separados** do dia, todos em minutos, mais o
 *   impacto diário ao banco (crédito e débito separados) e apontamentos não
 *   financeiros.
 */
export type ResultadoApuracaoDiaria =
  | {
      readonly status: "invalido";
      readonly erro: ErroApuracao;
    }
  | {
      readonly status: "apurado";
      readonly classificacao: ClassificacaoDia;
      /** Soma das durações das faixas previstas (min). */
      readonly jornadaPrevistaMinutos: number;
      /** Tempo trabalhado bruto pelas marcações, sem ajuste de almoço (min). */
      readonly tempoEfetivoTrabalhadoMinutos: number;
      /** Tempo trabalhado após o ajuste de almoço livre (min). */
      readonly jornadaComputadaMinutos: number;
      /** Crédito de hora extra (diferença positiva do dia), min. */
      readonly creditoHoraExtraMinutos: number;
      /** Débito por atraso/saída antecipada após a tolerância (min). */
      readonly debitoAtrasoSaidaAntecipadaMinutos: number;
      /** Diferença negativa do dia **antes** da tolerância (diagnóstico), min. */
      readonly diferencaNegativaBrutaMinutos: number;
      /** `true` quando um desvio negativo foi absorvido pela tolerância. */
      readonly toleranciaAplicada: boolean;
      /** Impacto diário proposto ao banco (crédito e débito separados). */
      readonly impactoBanco: ImpactoBancoDia;
      /** Apontamentos não financeiros do dia (catálogo fechado). */
      readonly apontamentos: readonly Apontamento[];
    };
