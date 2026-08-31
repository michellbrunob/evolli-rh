/**
 * Núcleo puro do ciclo de fechamento do período de Ponto e conferência manual do
 * Espelho V1 (Ponto V1, T057).
 *
 * TypeScript puro — **sem** NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Implementa a **máquina de estados** do período
 * (contrato T056) sobre dados **sintéticos**, retornando a cada transição uma
 * **nova versão** do período + um **evento técnico de auditoria** — **sem**
 * mutar a entrada e **sem** apagar histórico.
 *
 * Fronteiras rígidas (T056 §2, §5, §6, §7) — este núcleo **NÃO**:
 * - cria movimento de Banco de Horas, chama T050/T052/T054 ou altera saldo;
 * - emite PDF/Espelho real, arquivo, imagem, documento ou comprovante;
 * - captura/valida assinatura manual ou eletrônica;
 * - implementa reabertura, recusa, correção, retrocesso, desconto, pagamento,
 *   Folha, valor monetário, DSR financeiro ou integração;
 * - implementa autenticação, sessão, RBAC de aplicação, banco ou consulta por
 *   empresa (recebe apenas um papel técnico sintético e permite só `rh`);
 * - persiste, loga, chama rede/banco ou toca em NestJS/Prisma.
 */

import {
  AcaoPeriodo,
  EstadoPeriodo,
  ESTADO_TERMINAL,
  EventoAuditoriaFechamento,
  FechamentoErroCodigo,
  PapelTecnico,
  PeriodoFechamento,
  ResultadoTransicaoPeriodo,
} from "./fechamento.types";

/** Estados conhecidos (catálogo fechado). */
const ESTADOS = new Set<string>([
  "em_apuracao",
  "em_verificacao_rh",
  "pronto_para_fechamento",
  "fechado_operacionalmente",
  "espelho_emitido",
  "conferencia_manual_pendente",
  "conferencia_manual_registrada",
]);

/** Ações conhecidas (catálogo fechado). */
const ACOES = new Set<string>([
  "enviar_para_verificacao",
  "marcar_pronto_para_fechamento",
  "fechar_operacionalmente",
  "emitir_espelho",
  "iniciar_conferencia_manual",
  "registrar_conferencia_manual",
]);

/** Único papel técnico autorizado a transicionar (núcleo neutro). */
const PAPEL_AUTORIZADO: PapelTecnico = "rh";

/**
 * Máquina de estados **linear** (T056 §3.1): estado atual → ação → novo estado.
 * Só o caminho para a frente é permitido; não há reabertura, recusa, correção
 * ou retrocesso (pendentes de RH/Jurídico). O estado terminal não aparece como
 * origem (sem saída).
 */
const TRANSICOES: Readonly<
  Record<EstadoPeriodo, Partial<Record<AcaoPeriodo, EstadoPeriodo>>>
> = {
  em_apuracao: { enviar_para_verificacao: "em_verificacao_rh" },
  em_verificacao_rh: {
    marcar_pronto_para_fechamento: "pronto_para_fechamento",
  },
  pronto_para_fechamento: {
    fechar_operacionalmente: "fechado_operacionalmente",
  },
  fechado_operacionalmente: { emitir_espelho: "espelho_emitido" },
  espelho_emitido: {
    iniciar_conferencia_manual: "conferencia_manual_pendente",
  },
  conferencia_manual_pendente: {
    registrar_conferencia_manual: "conferencia_manual_registrada",
  },
  conferencia_manual_registrada: {},
};

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/** Valida `"AAAA-MM-DD"` e devolve dias-desde-época simples, ou `null`. */
function diaSerial(data: string): number | null {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!casamento) {
    return null;
  }
  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  const dia = Number(casamento[3]);
  if (mes < 1 || mes > 12) {
    return null;
  }
  const base = DIAS_NO_MES[mes - 1] ?? 0;
  const diasNoMes = mes === 2 && bissexto(ano) ? 29 : base;
  if (dia < 1 || dia > diasNoMes) {
    return null;
  }
  // Serial monotônico (não é data real; só para ordenar início < fim).
  return ano * 372 + (mes - 1) * 31 + (dia - 1);
}

function vazio(valor: unknown): boolean {
  return typeof valor !== "string" || valor.trim().length === 0;
}

function invalido(
  codigo: FechamentoErroCodigo,
  periodoId: string | null,
): ResultadoTransicaoPeriodo {
  return { status: "invalido", erro: { codigo, periodoId } };
}

/**
 * Aplica uma transição ao período. **Fail-closed:** entrada ou transição
 * inválida é rejeitada e o período de entrada permanece **intacto**.
 *
 * @param periodo período sintético (não é mutado).
 * @param acao ação de transição.
 * @param papel papel técnico sintético (só `rh` é autorizado).
 * @param refAuditoriaNova referência técnica do evento de auditoria desta
 *   transição (fornecida pelo chamador; o núcleo não gera ids nem usa relógio).
 */
export function transicionarPeriodo(
  periodo: PeriodoFechamento,
  acao: AcaoPeriodo,
  papel: PapelTecnico,
  refAuditoriaNova: string,
): ResultadoTransicaoPeriodo {
  const idSeguro = vazio(periodo?.id) ? null : periodo.id;

  // ---- Validação estrutural (fail-closed) -----------------------------------
  if (
    vazio(periodo?.id) ||
    vazio(periodo?.empresaRef) ||
    vazio(periodo?.vinculoRef) ||
    vazio(periodo?.refAuditoria) ||
    vazio(refAuditoriaNova)
  ) {
    return invalido("CAMPO_OBRIGATORIO_VAZIO", idSeguro);
  }
  const inicio = diaSerial(periodo.inicioReferencia);
  const fim = diaSerial(periodo.fimReferencia);
  if (inicio === null || fim === null) {
    return invalido("DATA_INVALIDA", idSeguro);
  }
  if (fim <= inicio) {
    return invalido("INTERVALO_INVERTIDO", idSeguro);
  }
  if (!ESTADOS.has(periodo.situacao)) {
    return invalido("ESTADO_DESCONHECIDO", idSeguro);
  }
  if (!ACOES.has(acao)) {
    return invalido("ACAO_DESCONHECIDA", idSeguro);
  }

  // ---- Autorização neutra (só `rh`) -----------------------------------------
  if (papel !== PAPEL_AUTORIZADO) {
    return invalido("PAPEL_NAO_AUTORIZADO", idSeguro);
  }

  // ---- Estado terminal não transiciona --------------------------------------
  if (periodo.situacao === ESTADO_TERMINAL) {
    return invalido("ESTADO_TERMINAL", idSeguro);
  }

  // ---- Transição permitida? (ordem linear) ----------------------------------
  const novoEstado = TRANSICOES[periodo.situacao][acao];
  if (novoEstado === undefined) {
    return invalido("TRANSICAO_INVALIDA", idSeguro);
  }

  // ---- Nova versão imutável + evento de auditoria ---------------------------
  const periodoAtualizado: PeriodoFechamento = {
    ...periodo,
    situacao: novoEstado,
    refAuditoria: refAuditoriaNova,
  };
  const evento: EventoAuditoriaFechamento = {
    periodoId: periodo.id,
    acao,
    estadoDe: periodo.situacao,
    estadoPara: novoEstado,
    papel,
    refAuditoria: refAuditoriaNova,
  };

  return { status: "transicionado", periodo: periodoAtualizado, evento };
}

/** Indica se o período está no estado terminal (sem transição de saída). */
export function ehTerminal(estado: EstadoPeriodo): boolean {
  return estado === ESTADO_TERMINAL;
}

/** Um passo de transição (ação + papel + referência de auditoria). */
export interface PassoPeriodo {
  readonly acao: AcaoPeriodo;
  readonly papel: PapelTecnico;
  readonly refAuditoria: string;
}

/** Resultado de uma sequência de transições, com histórico de eventos. */
export interface ResultadoHistoricoPeriodo {
  readonly periodo: PeriodoFechamento;
  readonly eventos: readonly EventoAuditoriaFechamento[];
  readonly erro: ResultadoTransicaoPeriodo | null;
}

/**
 * Aplica uma sequência de transições, acumulando o **histórico de eventos**.
 * Para no primeiro erro (fail-closed), preservando o histórico até ali. Cada
 * passo gera nova versão (imutabilidade); a entrada nunca é mutada.
 */
export function aplicarSequenciaPeriodo(
  inicial: PeriodoFechamento,
  passos: readonly PassoPeriodo[],
): ResultadoHistoricoPeriodo {
  let atual = inicial;
  const eventos: EventoAuditoriaFechamento[] = [];
  for (const passo of passos) {
    const resultado = transicionarPeriodo(
      atual,
      passo.acao,
      passo.papel,
      passo.refAuditoria,
    );
    if (resultado.status !== "transicionado") {
      return { periodo: atual, eventos, erro: resultado };
    }
    atual = resultado.periodo;
    eventos.push(resultado.evento);
  }
  return { periodo: atual, eventos, erro: null };
}
