/**
 * Núcleo puro de extrato e saldo derivado de Banco de Horas (Ponto V1, T052).
 *
 * TypeScript puro — **sem** NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Recebe movimentos **já normalizados e sintéticos**
 * e devolve, em memória, o extrato com saldo **derivado** e totais separados.
 *
 * Contrato: `docs/modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md` (T051).
 * Invariantes honradas (T051 §4): histórico imutável (a entrada é preservada,
 * nunca editada); nunca "zerar" apagando movimentos; saldo **derivado** da soma
 * assinada; **crédito e débito nunca são colapsados** num movimento líquido.
 *
 * Fronteiras rígidas — este núcleo **NÃO**:
 * - compensa, reordena, deduplica-por-mérito, aplica ordem de consumo, trata
 *   validade/expiração de crédito, bloqueia saldo negativo, faz ajuste humano,
 *   aprovação, quitação (`debito_quitacao` fica fora — T051 BH-04/05/06);
 * - calcula dinheiro, salário, adicional, DSR financeiro, Folha ou pagamento;
 * - persiste, loga, chama rede/banco ou toca em NestJS/Prisma;
 * - reimplementa a apuração de jornada (só a consome via adaptador explícito).
 */

import { ResultadoApuracaoDiaria } from "../apuracao/apuracao.types";
import {
  BancoHorasErroCodigo,
  LinhaExtrato,
  MovimentoBancoHoras,
  OrigemMovimento,
  ResultadoExtratoBancoHoras,
} from "./banco-horas.types";

/** Naturezas válidas (catálogo fechado). */
const NATUREZAS = new Set<string>(["credito", "debito"]);

/** Origens válidas (catálogo fechado — sem `debito_quitacao`, fora de escopo). */
const ORIGENS = new Set<string>([
  "apuracao_credito_extra",
  "apuracao_debito_atraso_saida",
  "apuracao_debito_compensacao",
  "apuracao_debito_falta",
  "movimento_sintetico",
]);

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/** Valida `"AAAA-MM-DD"` sintaticamente e como data de calendário existente. */
function dataReferenciaValida(data: string): boolean {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!casamento) {
    return false;
  }
  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  const dia = Number(casamento[3]);
  if (mes < 1 || mes > 12) {
    return false;
  }
  const base = DIAS_NO_MES[mes - 1] ?? 0;
  const diasNoMes = mes === 2 && bissexto(ano) ? 29 : base;
  return dia >= 1 && dia <= diasNoMes;
}

function invalido(
  codigo: BancoHorasErroCodigo,
  id: string | null,
  posicao: number,
): ResultadoExtratoBancoHoras {
  return { status: "invalido", erro: { codigo, id, posicao } };
}

/**
 * Gera o extrato do Banco de Horas a partir de movimentos **já normalizados e
 * sintéticos**, preservando a **ordem de entrada** (nunca reordena) e derivando
 * o saldo acumulado. **Fail-closed:** qualquer movimento inválido rejeita
 * **todo** o resultado (nenhuma linha é produzida).
 *
 * @param movimentos lista já normalizada e em ordem cronológica (o chamador
 *   ordena; este núcleo **não** reordena, T051 §4 invariante).
 */
export function gerarExtratoSintetico(
  movimentos: readonly MovimentoBancoHoras[],
): ResultadoExtratoBancoHoras {
  // ---- Validação fail-closed (rejeita todo o extrato no 1º erro) -------------
  const idsVistos = new Set<string>();
  for (let i = 0; i < movimentos.length; i += 1) {
    const movimento = movimentos[i];
    if (movimento === undefined) {
      return invalido("MOVIMENTO_ID_VAZIO", null, i);
    }
    if (typeof movimento.id !== "string" || movimento.id.trim().length === 0) {
      return invalido("MOVIMENTO_ID_VAZIO", null, i);
    }
    if (idsVistos.has(movimento.id)) {
      return invalido("MOVIMENTO_ID_DUPLICADO", movimento.id, i);
    }
    idsVistos.add(movimento.id);
    if (!dataReferenciaValida(movimento.dataReferencia)) {
      return invalido("MOVIMENTO_DATA_INVALIDA", movimento.id, i);
    }
    if (!Number.isInteger(movimento.minutos) || movimento.minutos <= 0) {
      return invalido("MOVIMENTO_MINUTOS_INVALIDOS", movimento.id, i);
    }
    if (!NATUREZAS.has(movimento.natureza)) {
      return invalido("MOVIMENTO_NATUREZA_DESCONHECIDA", movimento.id, i);
    }
    if (!ORIGENS.has(movimento.origem)) {
      return invalido("MOVIMENTO_ORIGEM_DESCONHECIDA", movimento.id, i);
    }
  }

  // ---- Derivação do extrato (ordem preservada, saldo acumulado) --------------
  const linhas: LinhaExtrato[] = [];
  let saldo = 0;
  let totalCreditos = 0;
  let totalDebitos = 0;

  for (const movimento of movimentos) {
    if (movimento.natureza === "credito") {
      saldo += movimento.minutos;
      totalCreditos += movimento.minutos;
    } else {
      saldo -= movimento.minutos;
      totalDebitos += movimento.minutos;
    }
    // Cada movimento é preservado individualmente: crédito e débito nunca são
    // colapsados num líquido; o saldo é apenas a soma assinada derivada.
    linhas.push({ movimento, saldoAcumuladoMinutos: saldo });
  }

  return {
    status: "gerado",
    linhas,
    totalCreditosMinutos: totalCreditos,
    totalDebitosMinutos: totalDebitos,
    // Saldo derivado; pode ser negativo — resultado **matemático**, sem decidir
    // política trabalhista (limite/−24h só alerta; bloqueio é pendente, T051).
    saldoMinutos: saldo,
  };
}

/** Metadados técnicos para nomear os movimentos derivados de uma apuração. */
export interface MetaMovimentoApuracao {
  /** Base do id técnico (ex.: `"AP-2026-08-25-V001"`); sem dado pessoal. */
  readonly idBase: string;
  /** Data de referência do dia apurado, `"AAAA-MM-DD"`. */
  readonly dataReferencia: string;
}

/** Escolhe a origem técnica do débito conforme a classificação do dia (T050). */
function origemDebito(classificacao: ClassificacaoApuracao): OrigemMovimento {
  if (classificacao === "compensacao") {
    return "apuracao_debito_compensacao";
  }
  if (classificacao === "falta_injustificada") {
    return "apuracao_debito_falta";
  }
  return "apuracao_debito_atraso_saida";
}

type ClassificacaoApuracao = Extract<
  ResultadoApuracaoDiaria,
  { status: "apurado" }
>["classificacao"];

/**
 * Adaptador **puro e explícito**: converte o resultado diário do motor de
 * apuração (T050) em movimentos de crédito e débito **separados**, sem
 * reimplementar a apuração. Lê apenas `impactoBanco` (componentes já separados)
 * e a classificação do dia; **não** calcula jornada nem dinheiro.
 *
 * Produz **até dois** movimentos (um crédito e um débito, quando > 0), cada um
 * com id técnico distinto — o crédito **nunca** compensa o débito.
 */
export function movimentosDeApuracaoDiaria(
  resultado: ResultadoApuracaoDiaria,
  meta: MetaMovimentoApuracao,
): readonly MovimentoBancoHoras[] {
  if (resultado.status !== "apurado") {
    return [];
  }
  const movimentos: MovimentoBancoHoras[] = [];
  const credito = resultado.impactoBanco.creditoMinutos;
  const debito = resultado.impactoBanco.debitoMinutos;

  if (credito > 0) {
    movimentos.push({
      id: `${meta.idBase}-C`,
      natureza: "credito",
      minutos: credito,
      dataReferencia: meta.dataReferencia,
      origem: "apuracao_credito_extra",
    });
  }
  if (debito > 0) {
    movimentos.push({
      id: `${meta.idBase}-D`,
      natureza: "debito",
      minutos: debito,
      dataReferencia: meta.dataReferencia,
      origem: origemDebito(resultado.classificacao),
    });
  }
  return movimentos;
}
