/**
 * Núcleo puro do ciclo de vida de propostas de compensação de Banco de Horas
 * (Ponto V1, T054).
 *
 * TypeScript puro — **sem** NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Implementa a **máquina de estados** da proposta de
 * compensação (contrato T053) sobre dados **100% sintéticos**, retornando a cada
 * transição uma **nova versão** da proposta + um **evento técnico de auditoria**
 * — **sem** mutar a entrada e **sem** apagar histórico.
 *
 * Fronteiras rígidas (T053 §2, §6) — este núcleo **NÃO**:
 * - cria `debito_compensacao`, integra ao extrato (T052) ou registra efetivo;
 * - decide saldo disponível, ordem de consumo, validade de crédito, política de
 *   saldo negativo, bloqueio por alerta +38h/−24h ou alçada definitiva;
 * - calcula dinheiro, salário, adicional, DSR, Folha, pagamento ou quitação;
 * - implementa autenticação, sessão, RBAC de aplicação ou consulta por empresa
 *   (recebe apenas um papel técnico sintético e permite só `rh`);
 * - persiste, loga, chama rede/banco ou toca em NestJS/Prisma.
 */

import {
  AcaoProposta,
  CompensacaoErroCodigo,
  EstadoProposta,
  ESTADOS_TERMINAIS,
  EventoAuditoriaCompensacao,
  PapelTecnico,
  PropostaCompensacao,
  ResultadoTransicao,
} from "./compensacao.types";

/** Estados conhecidos (catálogo fechado). */
const ESTADOS = new Set<string>([
  "rascunho",
  "submetida_para_revisao",
  "aprovada_para_registro",
  "recusada",
  "cancelada",
]);

/** Ações conhecidas (catálogo fechado). */
const ACOES = new Set<string>(["submeter", "aprovar", "recusar", "cancelar"]);

/** Justificativas conhecidas (catálogo fechado, sem texto livre). */
const JUSTIFICATIVAS = new Set<string>([
  "compensacao_saldo_positivo",
  "compensacao_acordo_semana",
  "compensacao_ajuste_operacional",
]);

/** Único papel técnico autorizado a transicionar propostas (núcleo neutro). */
const PAPEL_AUTORIZADO: PapelTecnico = "rh";

const TERMINAIS = new Set<string>(ESTADOS_TERMINAIS);

/**
 * Tabela de transições permitidas: estado atual → ação → novo estado. Estados
 * terminais não aparecem como origem (não têm saída). Qualquer par
 * (estado, ação) ausente é uma transição inválida.
 */
const TRANSICOES: Readonly<
  Record<EstadoProposta, Partial<Record<AcaoProposta, EstadoProposta>>>
> = {
  rascunho: {
    submeter: "submetida_para_revisao",
    cancelar: "cancelada",
  },
  submetida_para_revisao: {
    aprovar: "aprovada_para_registro",
    recusar: "recusada",
    cancelar: "cancelada",
  },
  aprovada_para_registro: {},
  recusada: {},
  cancelada: {},
};

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/** Valida `"AAAA-MM-DD"` sintaticamente e como data de calendário existente. */
function periodoValido(periodo: string): boolean {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodo);
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

function vazio(valor: unknown): boolean {
  return typeof valor !== "string" || valor.trim().length === 0;
}

function invalido(
  codigo: CompensacaoErroCodigo,
  propostaId: string | null,
): ResultadoTransicao {
  return { status: "invalido", erro: { codigo, propostaId } };
}

/**
 * Aplica uma transição à proposta de compensação. **Fail-closed:** entrada ou
 * transição inválida é rejeitada e a proposta de entrada permanece **intacta**.
 *
 * @param proposta proposta sintética (não é mutada).
 * @param acao ação de transição.
 * @param papel papel técnico sintético (só `rh` é autorizado).
 * @param refAuditoriaNova referência técnica do evento de auditoria desta
 *   transição (fornecida pelo chamador; o núcleo não gera ids nem usa relógio).
 */
export function transicionar(
  proposta: PropostaCompensacao,
  acao: AcaoProposta,
  papel: PapelTecnico,
  refAuditoriaNova: string,
): ResultadoTransicao {
  const idSeguro = vazio(proposta?.id) ? null : proposta.id;

  // ---- Validação estrutural da proposta (fail-closed) -----------------------
  if (
    vazio(proposta?.id) ||
    vazio(proposta?.empresaRef) ||
    vazio(proposta?.vinculoRef) ||
    vazio(proposta?.refAuditoria) ||
    vazio(refAuditoriaNova)
  ) {
    return invalido("CAMPO_OBRIGATORIO_VAZIO", idSeguro);
  }
  if (!periodoValido(proposta.periodoReferencia)) {
    return invalido("PERIODO_INVALIDO", idSeguro);
  }
  if (
    !Number.isInteger(proposta.minutosPropostos) ||
    proposta.minutosPropostos <= 0
  ) {
    return invalido("MINUTOS_INVALIDOS", idSeguro);
  }
  if (!JUSTIFICATIVAS.has(proposta.justificativa)) {
    return invalido("JUSTIFICATIVA_DESCONHECIDA", idSeguro);
  }
  if (!ESTADOS.has(proposta.situacao)) {
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
  if (TERMINAIS.has(proposta.situacao)) {
    return invalido("ESTADO_TERMINAL", idSeguro);
  }

  // ---- Transição permitida? -------------------------------------------------
  const novoEstado = TRANSICOES[proposta.situacao][acao];
  if (novoEstado === undefined) {
    return invalido("TRANSICAO_INVALIDA", idSeguro);
  }

  // ---- Nova versão imutável + evento de auditoria ---------------------------
  const propostaAtualizada: PropostaCompensacao = {
    ...proposta,
    situacao: novoEstado,
    refAuditoria: refAuditoriaNova,
  };
  const evento: EventoAuditoriaCompensacao = {
    propostaId: proposta.id,
    acao,
    estadoDe: proposta.situacao,
    estadoPara: novoEstado,
    papel,
    refAuditoria: refAuditoriaNova,
  };

  return { status: "transicionado", proposta: propostaAtualizada, evento };
}

/** Indica se um estado é terminal (sem transição de saída). */
export function ehTerminal(estado: EstadoProposta): boolean {
  return TERMINAIS.has(estado);
}

/**
 * Aplica uma sequência de transições, acumulando o **histórico de eventos**.
 * Para no primeiro erro (fail-closed), preservando o histórico até ali. Útil
 * para demonstrar o ciclo de vida sem mutar nada (cada passo gera nova versão).
 */
export interface PassoTransicao {
  readonly acao: AcaoProposta;
  readonly papel: PapelTecnico;
  readonly refAuditoria: string;
}

export interface ResultadoHistorico {
  readonly proposta: PropostaCompensacao;
  readonly eventos: readonly EventoAuditoriaCompensacao[];
  readonly erro: ResultadoTransicao | null;
}

export function aplicarSequencia(
  inicial: PropostaCompensacao,
  passos: readonly PassoTransicao[],
): ResultadoHistorico {
  let atual = inicial;
  const eventos: EventoAuditoriaCompensacao[] = [];
  for (const passo of passos) {
    const resultado = transicionar(
      atual,
      passo.acao,
      passo.papel,
      passo.refAuditoria,
    );
    if (resultado.status !== "transicionado") {
      return { proposta: atual, eventos, erro: resultado };
    }
    atual = resultado.proposta;
    eventos.push(resultado.evento);
  }
  return { proposta: atual, eventos, erro: null };
}
