/**
 * Núcleo puro da fila conceitual "Verificar folhas" V1 (Ponto V1, T059).
 *
 * TypeScript puro — **sem** NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Implementa a **máquina de estados** de uma pendência
 * de revisão (contrato T058) sobre dados **sintéticos**, retornando a cada
 * transição uma **nova versão** da pendência + um **evento técnico de auditoria**
 * — **sem** mutar a entrada e **sem** apagar histórico.
 *
 * Fronteiras rígidas (T058 §2, §5, §7) — este núcleo **NÃO**:
 * - cria pendências reais, faz parser/importação AFD/TXT, associa por CPF ou
 *   ajusta/corrige marcação;
 * - calcula jornada, Banco de Horas, compensação efetiva, aprovação, fechamento,
 *   Espelho, assinatura, PDF, Folha, pagamento ou dinheiro;
 * - chama T050/T052/T054/T057, cria movimento ou altera saldo;
 * - usa severidade para calcular/bloquear/resolver/descartar/fechar (severidade
 *   é só priorização recebida);
 * - implementa autenticação, sessão, RBAC de aplicação ou consulta por empresa
 *   (recebe apenas um papel técnico sintético e permite só `rh`);
 * - persiste, loga, chama rede/banco ou toca em NestJS/Prisma.
 */

import {
  AcaoPendencia,
  EstadoPendencia,
  ESTADOS_TERMINAIS,
  EventoAuditoriaPendencia,
  PapelTecnico,
  Pendencia,
  ResultadoTransicaoPendencia,
  VerificarFolhasErroCodigo,
} from "./verificar-folhas.types";

/** Tipos conhecidos (catálogo fechado). */
const TIPOS = new Set<string>([
  "batida_ausente",
  "batida_fora_do_horario",
  "jornada_incompleta",
  "compensacao_pendente",
  "dado_importacao_nao_associado",
]);

/** Estados conhecidos (catálogo fechado). */
const ESTADOS = new Set<string>([
  "aberta",
  "em_revisao_rh",
  "aguardando_informacao",
  "resolvida_sem_alteracao_automatica",
  "descartada_por_erro_tecnico",
]);

/** Ações conhecidas (catálogo fechado). */
const ACOES = new Set<string>([
  "iniciar_revisao",
  "aguardar_informacao",
  "retomar_revisao",
  "resolver_sem_alteracao",
  "descartar_por_erro_tecnico",
]);

/** Severidades conhecidas (catálogo fechado). */
const SEVERIDADES = new Set<string>(["informativa", "atencao", "critica"]);

/** Origens conhecidas (catálogo fechado). */
const ORIGENS = new Set<string>(["apuracao", "compensacao", "importacao"]);

/** Motivos codificados conhecidos (catálogo fechado). */
const MOTIVOS = new Set<string>([
  "par_incompleto",
  "marcacao_ausente",
  "marcacao_fora_horario",
  "compensacao_aguardando",
  "sem_vinculo",
]);

/** Único papel técnico autorizado a transicionar (núcleo neutro). */
const PAPEL_AUTORIZADO: PapelTecnico = "rh";

const TERMINAIS = new Set<string>(ESTADOS_TERMINAIS);

/**
 * Máquina de estados (T058 §5.1): estado atual → ação → novo estado. Estados
 * terminais não aparecem como origem (sem saída).
 */
const TRANSICOES: Readonly<
  Record<EstadoPendencia, Partial<Record<AcaoPendencia, EstadoPendencia>>>
> = {
  aberta: { iniciar_revisao: "em_revisao_rh" },
  em_revisao_rh: {
    aguardar_informacao: "aguardando_informacao",
    resolver_sem_alteracao: "resolvida_sem_alteracao_automatica",
    descartar_por_erro_tecnico: "descartada_por_erro_tecnico",
  },
  aguardando_informacao: {
    retomar_revisao: "em_revisao_rh",
    resolver_sem_alteracao: "resolvida_sem_alteracao_automatica",
    descartar_por_erro_tecnico: "descartada_por_erro_tecnico",
  },
  resolvida_sem_alteracao_automatica: {},
  descartada_por_erro_tecnico: {},
};

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/** Valida `"AAAA-MM-DD"` sintaticamente e como data de calendário existente. */
function dataValida(data: string): boolean {
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

function vazio(valor: unknown): boolean {
  return typeof valor !== "string" || valor.trim().length === 0;
}

function invalido(
  codigo: VerificarFolhasErroCodigo,
  pendenciaId: string | null,
): ResultadoTransicaoPendencia {
  return { status: "invalido", erro: { codigo, pendenciaId } };
}

/**
 * Aplica uma transição à pendência. **Fail-closed:** entrada ou transição
 * inválida é rejeitada e a pendência de entrada permanece **intacta**.
 *
 * @param pendencia pendência sintética (não é mutada).
 * @param acao ação de transição.
 * @param papel papel técnico sintético (só `rh` é autorizado).
 * @param refAuditoriaNova referência técnica do evento de auditoria desta
 *   transição (fornecida pelo chamador; o núcleo não gera ids nem usa relógio).
 */
export function transicionarPendencia(
  pendencia: Pendencia,
  acao: AcaoPendencia,
  papel: PapelTecnico,
  refAuditoriaNova: string,
): ResultadoTransicaoPendencia {
  const idSeguro = vazio(pendencia?.id) ? null : pendencia.id;

  // ---- Validação estrutural (fail-closed) -----------------------------------
  if (
    vazio(pendencia?.id) ||
    vazio(pendencia?.empresaRef) ||
    vazio(pendencia?.vinculoRef) ||
    vazio(pendencia?.refAuditoria) ||
    vazio(refAuditoriaNova)
  ) {
    return invalido("CAMPO_OBRIGATORIO_VAZIO", idSeguro);
  }
  if (!dataValida(pendencia.periodoReferencia)) {
    return invalido("DATA_INVALIDA", idSeguro);
  }
  if (!TIPOS.has(pendencia.tipo)) {
    return invalido("TIPO_DESCONHECIDO", idSeguro);
  }
  if (!SEVERIDADES.has(pendencia.severidade)) {
    return invalido("SEVERIDADE_DESCONHECIDA", idSeguro);
  }
  if (!ORIGENS.has(pendencia.origem)) {
    return invalido("ORIGEM_DESCONHECIDA", idSeguro);
  }
  if (!MOTIVOS.has(pendencia.motivo)) {
    return invalido("MOTIVO_DESCONHECIDO", idSeguro);
  }
  if (!ESTADOS.has(pendencia.situacao)) {
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
  if (TERMINAIS.has(pendencia.situacao)) {
    return invalido("ESTADO_TERMINAL", idSeguro);
  }

  // ---- Transição permitida? -------------------------------------------------
  const novoEstado = TRANSICOES[pendencia.situacao][acao];
  if (novoEstado === undefined) {
    return invalido("TRANSICAO_INVALIDA", idSeguro);
  }

  // ---- Nova versão imutável + evento de auditoria ---------------------------
  // A severidade é apenas copiada (não recalculada, não usada para decidir).
  const pendenciaAtualizada: Pendencia = {
    ...pendencia,
    situacao: novoEstado,
    refAuditoria: refAuditoriaNova,
  };
  const evento: EventoAuditoriaPendencia = {
    pendenciaId: pendencia.id,
    acao,
    estadoDe: pendencia.situacao,
    estadoPara: novoEstado,
    papel,
    refAuditoria: refAuditoriaNova,
  };

  return { status: "transicionado", pendencia: pendenciaAtualizada, evento };
}

/** Indica se um estado é terminal (sem transição de saída). */
export function ehTerminal(estado: EstadoPendencia): boolean {
  return TERMINAIS.has(estado);
}

/** Um passo de transição (ação + papel + referência de auditoria). */
export interface PassoPendencia {
  readonly acao: AcaoPendencia;
  readonly papel: PapelTecnico;
  readonly refAuditoria: string;
}

/** Resultado de uma sequência de transições, com histórico de eventos. */
export interface ResultadoHistoricoPendencia {
  readonly pendencia: Pendencia;
  readonly eventos: readonly EventoAuditoriaPendencia[];
  readonly erro: ResultadoTransicaoPendencia | null;
}

/**
 * Aplica uma sequência de transições, acumulando o **histórico de eventos**.
 * Para no primeiro erro (fail-closed), preservando o histórico até ali. Cada
 * passo gera nova versão (imutabilidade); a entrada nunca é mutada.
 */
export function aplicarSequenciaPendencia(
  inicial: Pendencia,
  passos: readonly PassoPendencia[],
): ResultadoHistoricoPendencia {
  let atual = inicial;
  const eventos: EventoAuditoriaPendencia[] = [];
  for (const passo of passos) {
    const resultado = transicionarPendencia(
      atual,
      passo.acao,
      passo.papel,
      passo.refAuditoria,
    );
    if (resultado.status !== "transicionado") {
      return { pendencia: atual, eventos, erro: resultado };
    }
    atual = resultado.pendencia;
    eventos.push(resultado.evento);
  }
  return { pendencia: atual, eventos, erro: null };
}
