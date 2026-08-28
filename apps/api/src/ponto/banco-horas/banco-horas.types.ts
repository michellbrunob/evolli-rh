/**
 * Tipos do núcleo puro de extrato e saldo derivado de Banco de Horas
 * (Ponto V1, T052).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, banco, rede, log ou variáveis de
 * ambiente. O núcleo recebe **movimentos já normalizados e sintéticos** (crédito
 * ou débito, em minutos) e devolve, em memória, um **extrato** com saldo
 * acumulado **derivado** e totais separados de créditos e débitos.
 *
 * Contrato de referência: `docs/modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md`
 * (T051). Fronteiras deste núcleo (T051 §2): cobre a camada **extrato/saldo**;
 * **não** compensa, **não** aplica ordem de consumo, **não** trata validade de
 * crédito, **não** bloqueia saldo negativo, **não** faz ajuste humano,
 * aprovação, quitação, pagamento, Folha ou valor monetário.
 */

/** Natureza do movimento: crédito soma ao saldo; débito subtrai. */
export type NaturezaMovimento = "credito" | "debito";

/**
 * Origem **técnica** do movimento — catálogo **fechado** (sem texto livre;
 * ADR 0008 dec. 5). Não é dado pessoal nem financeiro: apenas de onde o
 * movimento veio. `debito_quitacao` **não** existe aqui: a quitação permanece
 * pendente (T051 BH-04/05/06) e fora do escopo da T052.
 */
export type OrigemMovimento =
  /** Crédito de hora extra vindo da apuração diária (T050). */
  | "apuracao_credito_extra"
  /** Débito de atraso/saída antecipada vindo da apuração diária (T050). */
  | "apuracao_debito_atraso_saida"
  /** Débito proposto de compensação vindo da apuração diária (T050). */
  | "apuracao_debito_compensacao"
  /** Débito de jornada prevista por falta injustificada (T050). */
  | "apuracao_debito_falta"
  /** Movimento sintético avulso (fixtures de teste), sem origem de apuração. */
  | "movimento_sintetico";

/**
 * Movimento **já normalizado e sintético** — crédito ou débito em **minutos**
 * (sempre positivos; a `natureza` dá o sinal). Sem CPF, nome, empresa real ou
 * dado bruto: só identificador **técnico**, data de referência e origem técnica.
 */
export interface MovimentoBancoHoras {
  /** Identificador **técnico** do movimento — não vazio e único no extrato. */
  readonly id: string;
  /** Crédito ou débito. */
  readonly natureza: NaturezaMovimento;
  /** Duração em minutos — inteiro **positivo** (o sinal vem da `natureza`). */
  readonly minutos: number;
  /** Data de referência do movimento, `"AAAA-MM-DD"`. */
  readonly dataReferencia: string;
  /** Origem técnica (catálogo fechado). */
  readonly origem: OrigemMovimento;
}

/** Linha do extrato: o movimento preservado + o saldo acumulado após ele. */
export interface LinhaExtrato {
  readonly movimento: MovimentoBancoHoras;
  /** Saldo acumulado (min) **derivado** até e incluindo este movimento. */
  readonly saldoAcumuladoMinutos: number;
}

/** Código de erro **seguro** — rótulo técnico estável, sem dado sensível. */
export type BancoHorasErroCodigo =
  /** Identificador técnico ausente/vazio. */
  | "MOVIMENTO_ID_VAZIO"
  /** Identificador técnico repetido no mesmo extrato. */
  | "MOVIMENTO_ID_DUPLICADO"
  /** Data de referência fora de `"AAAA-MM-DD"` ou inexistente no calendário. */
  | "MOVIMENTO_DATA_INVALIDA"
  /** Minutos não inteiros ou não positivos. */
  | "MOVIMENTO_MINUTOS_INVALIDOS"
  /** Natureza fora de `{credito, debito}`. */
  | "MOVIMENTO_NATUREZA_DESCONHECIDA"
  /** Origem fora do catálogo fechado. */
  | "MOVIMENTO_ORIGEM_DESCONHECIDA";

/** Erro de extrato — só endereçamento técnico (id/posição), sem dado sensível. */
export interface ErroBancoHoras {
  readonly codigo: BancoHorasErroCodigo;
  /** Id técnico do movimento problemático, quando legível; `null` se vazio. */
  readonly id: string | null;
  /** Índice 0-based do movimento na lista de entrada. */
  readonly posicao: number;
}

/**
 * Resultado do núcleo — união discriminada por `status`.
 *
 * - `invalido`: **fail-closed** — um movimento inválido rejeita **todo** o
 *   extrato; nenhuma linha é produzida.
 * - `gerado`: extrato na **ordem de entrada** (preservada, nunca reordenada),
 *   saldo derivado e totais **separados** de crédito e débito.
 */
export type ResultadoExtratoBancoHoras =
  | {
      readonly status: "invalido";
      readonly erro: ErroBancoHoras;
    }
  | {
      readonly status: "gerado";
      readonly linhas: readonly LinhaExtrato[];
      readonly totalCreditosMinutos: number;
      readonly totalDebitosMinutos: number;
      /** Saldo final derivado (créditos − débitos); pode ser **negativo**. */
      readonly saldoMinutos: number;
    };
