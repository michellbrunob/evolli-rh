/**
 * Núcleo puro do ciclo conceitual da Central de Solicitações do Colaborador
 * (T066).
 *
 * TypeScript puro — **sem** NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Aplica a **máquina de estados** de uma solicitação
 * (contrato T065), em memória e sobre dados **sintéticos**, devolvendo a cada
 * transição uma **nova versão** conceitual + um **evento técnico de auditoria**.
 *
 * Contrato: `docs/modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md`
 * (T065). Fronteiras rígidas — este núcleo **NÃO**:
 * - corrige marcação, cria `debito_compensacao`, lança ausência/férias, altera
 *   cadastro/documento, fecha período, emite Espelho, calcula jornada/Banco de
 *   Horas, dinheiro/Folha/salário — a Central só **registra e encaminha**; o
 *   encaminhamento (`encaminhada_para_operacao_rh`) **não** executa mutação;
 * - trata anexo, upload, download, arquivo, imagem, PDF, atestado, assinatura,
 *   notificação ou documento pessoal;
 * - chama Ponto/Banco de Horas/Folha/Documentos/eSocial nem qualquer núcleo;
 * - implementa autenticação, sessão, RBAC de aplicação, endpoint ou consulta
 *   real — o "ator" é só papel + referências técnicas sintéticas;
 * - persiste, loga, faz rede/banco ou toca em NestJS/Prisma.
 */

import {
  AcaoSolicitacao,
  AtorSolicitacao,
  EstadoSolicitacao,
  EventoAuditoriaSolicitacao,
  ESTADOS_REABRIVEIS,
  ESTADOS_TERMINAIS,
  ResultadoTransicaoSolicitacao,
  Solicitacao,
  SolicitacoesErroCodigo,
} from "./solicitacoes.types";

/** Tipos conhecidos (catálogo fechado — `PD-SOL-01`). */
const TIPOS = new Set<string>([
  "contestacao_ajuste_ponto",
  "ausencia",
  "ferias",
  "atualizacao_cadastral",
  "atestado",
  "beneficios",
]);

/** Estados conhecidos (catálogo fechado — T065 §4). */
const ESTADOS = new Set<string>([
  "rascunho",
  "enviada",
  "em_revisao_rh",
  "aguardando_informacao",
  "encaminhada_para_operacao_rh",
  "recusada",
  "cancelada",
]);

/** Motivos conhecidos (catálogo fechado — ver `MotivoSolicitacao`). */
const MOTIVOS = new Set<string>([
  "divergencia_marcacao",
  "ausencia_programada",
  "periodo_ferias",
  "dado_cadastral_desatualizado",
  "atestado_apresentado",
  "beneficio_solicitado",
  "informacao_insuficiente",
  "fora_do_escopo_da_central",
  "duplicidade",
  "reanalise_administrativa",
  "correcao_de_registro",
  "outro_controlado",
]);

/** Papéis conhecidos. */
const PAPEIS = new Set<string>([
  "colaborador",
  "rh",
  "master_tecnico",
  "dp",
  "gestor",
]);

/** Estados terminais (derivado do catálogo do contrato). */
const TERMINAIS = new Set<string>(ESTADOS_TERMINAIS);

/** Terminais que o RH pode reabrir (`PD-SOL-03`) — `cancelada` fora. */
const REABRIVEIS = new Set<string>(ESTADOS_REABRIVEIS);

/** Papel operacional exigido por ação (só `colaborador`/`rh` operam — T065 §4.1/§5). */
type PapelOperacional = "colaborador" | "rh";

const ACAO_PAPEL: Readonly<Record<AcaoSolicitacao, PapelOperacional>> = {
  enviar: "colaborador",
  cancelar: "colaborador",
  iniciar_revisao: "rh",
  aguardar_informacao: "rh",
  retomar_revisao: "rh",
  encaminhar_para_operacao: "rh",
  recusar: "rh",
  // `PD-SOL-03`: reabrir é exclusivo do RH.
  reabrir: "rh",
};

/**
 * Máquina de estados (T065 §4.1, reconciliada por `PD-SOL-03`): estado atual →
 * ação → novo estado. O papel exigido por ação vive em `ACAO_PAPEL` (conferido
 * antes desta tabela). Encaminhamento, recusa e cancelamento encerram o ciclo
 * da Central **sem** mutação operacional.
 *
 * Duas mudanças em relação ao desenho conceitual anterior:
 *
 * 1. **`aguardando_informacao` não cancela.** Esse estado só é alcançável
 *    **depois** de `em_revisao_rh`, e `PD-SOL-03` fechou que o colaborador
 *    cancela **somente antes** de `em_revisao_rh`. Manter a transição
 *    transportaria para a fundação persistente uma regra que a decisão revogou.
 * 2. **`reabrir` existe.** O RH reabre `encaminhada_para_operacao_rh` e
 *    `recusada`, devolvendo-as a `em_revisao_rh` — único estado não terminal
 *    sob responsabilidade do RH. A decisão aprova *que* o RH reabre e *com
 *    justificativa auditada*; o estado de destino é derivado dela, não
 *    inventado. `cancelada` permanece sem saída: exige nova solicitação.
 */
const TRANSICOES: Readonly<
  Record<EstadoSolicitacao, Partial<Record<AcaoSolicitacao, EstadoSolicitacao>>>
> = {
  rascunho: {
    enviar: "enviada",
    cancelar: "cancelada",
  },
  enviada: {
    iniciar_revisao: "em_revisao_rh",
    cancelar: "cancelada",
  },
  em_revisao_rh: {
    aguardar_informacao: "aguardando_informacao",
    encaminhar_para_operacao: "encaminhada_para_operacao_rh",
    recusar: "recusada",
  },
  aguardando_informacao: {
    retomar_revisao: "em_revisao_rh",
  },
  encaminhada_para_operacao_rh: {
    reabrir: "em_revisao_rh",
  },
  recusada: {
    reabrir: "em_revisao_rh",
  },
  cancelada: {},
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
  codigo: SolicitacoesErroCodigo,
  solicitacaoId: string | null,
): ResultadoTransicaoSolicitacao {
  return { status: "invalido", erro: { codigo, solicitacaoId } };
}

/**
 * Aplica uma transição à solicitação. **Fail-closed:** entrada, ator ou
 * transição inválida é rejeitada e a solicitação de entrada permanece
 * **intacta**.
 *
 * @param solicitacao solicitação sintética (não é mutada).
 * @param acao ação de transição.
 * @param ator ator sintético (papel + referências técnicas); só `colaborador`
 *   (na própria solicitação) e `rh` (na própria empresa) operam.
 * @param refAuditoriaNova referência técnica do evento de auditoria desta
 *   transição (fornecida pelo chamador; o núcleo não gera ids nem usa relógio).
 */
export function transicionarSolicitacao(
  solicitacao: Solicitacao,
  acao: AcaoSolicitacao,
  ator: AtorSolicitacao,
  refAuditoriaNova: string,
): ResultadoTransicaoSolicitacao {
  const idSeguro = vazio(solicitacao?.id) ? null : solicitacao.id;

  // ---- Validação estrutural (fail-closed) -----------------------------------
  if (
    vazio(solicitacao?.id) ||
    vazio(solicitacao?.empresaRef) ||
    vazio(solicitacao?.vinculoRef) ||
    vazio(solicitacao?.refAuditoria) ||
    vazio(ator?.empresaRef) ||
    vazio(ator?.vinculoRef) ||
    vazio(refAuditoriaNova)
  ) {
    return invalido("CAMPO_OBRIGATORIO_VAZIO", idSeguro);
  }
  // Período é opcional; quando presente, precisa ser uma data válida.
  if (
    solicitacao.periodoReferencia !== null &&
    !dataValida(solicitacao.periodoReferencia)
  ) {
    return invalido("PERIODO_INVALIDO", idSeguro);
  }
  if (!TIPOS.has(solicitacao.tipo)) {
    return invalido("TIPO_DESCONHECIDO", idSeguro);
  }
  if (!MOTIVOS.has(solicitacao.motivo)) {
    return invalido("MOTIVO_DESCONHECIDO", idSeguro);
  }
  if (!ESTADOS.has(solicitacao.situacao)) {
    return invalido("ESTADO_DESCONHECIDO", idSeguro);
  }
  if (!ACAO_PAPEL[acao]) {
    return invalido("ACAO_DESCONHECIDA", idSeguro);
  }
  if (!PAPEIS.has(ator.papel)) {
    return invalido("PAPEL_DESCONHECIDO", idSeguro);
  }

  // ---- Autorização por papel (só o dono da ação; nega os demais) ------------
  // master_tecnico/dp/gestor nunca operam: seu papel não casa com ACAO_PAPEL.
  if (ator.papel !== ACAO_PAPEL[acao]) {
    return invalido("PAPEL_NAO_AUTORIZADO", idSeguro);
  }

  // ---- Escopo por referência técnica (falha segura, sem revelar conteúdo) ----
  if (!escopoCompativel(solicitacao, ator)) {
    return invalido("ATOR_FORA_DO_ESCOPO", idSeguro);
  }

  // ---- Transição permitida? -------------------------------------------------
  const novoEstado = TRANSICOES[solicitacao.situacao][acao];
  if (novoEstado === undefined) {
    // Estado que encerra o ciclo e não oferece a ação pedida — inclui QUALQUER
    // tentativa sobre `cancelada`, que não tem saída — é reportado como
    // terminal; os demais casos são transição fora de ordem. A distinção
    // importa porque só a segunda é recuperável mudando a ordem das operações.
    return invalido(
      TERMINAIS.has(solicitacao.situacao)
        ? "ESTADO_TERMINAL"
        : "TRANSICAO_INVALIDA",
      idSeguro,
    );
  }

  // ---- Nova versão imutável + evento de auditoria ---------------------------
  // O encaminhamento é só mudança de estado (registro/handoff): nenhuma
  // marcação, saldo, cadastro, documento, fechamento ou Folha é tocado aqui.
  const solicitacaoAtualizada: Solicitacao = {
    ...solicitacao,
    situacao: novoEstado,
    refAuditoria: refAuditoriaNova,
  };
  const evento: EventoAuditoriaSolicitacao = {
    solicitacaoId: solicitacao.id,
    acao,
    estadoDe: solicitacao.situacao,
    estadoPara: novoEstado,
    papel: ator.papel,
    refAuditoria: refAuditoriaNova,
  };

  return {
    status: "transicionada",
    solicitacao: solicitacaoAtualizada,
    evento,
  };
}

/**
 * Escopo do ator (T065 §5): `colaborador` só na própria solicitação
 * (`vinculoRef` **e** `empresaRef` compatíveis); `rh` só na própria empresa
 * (`empresaRef` compatível). Papéis não operacionais já foram negados antes.
 */
function escopoCompativel(
  solicitacao: Solicitacao,
  ator: AtorSolicitacao,
): boolean {
  if (ator.papel === "colaborador") {
    return (
      ator.vinculoRef === solicitacao.vinculoRef &&
      ator.empresaRef === solicitacao.empresaRef
    );
  }
  if (ator.papel === "rh") {
    return ator.empresaRef === solicitacao.empresaRef;
  }
  return false;
}

/** Indica se um estado encerra o ciclo da Central (T065 §4). */
export function ehTerminal(estado: EstadoSolicitacao): boolean {
  return TERMINAIS.has(estado);
}

/**
 * Indica se um estado terminal pode ser **reaberto pelo RH** (`PD-SOL-03`).
 * `cancelada` nunca pode: exige nova solicitação.
 */
export function ehReabrivel(estado: EstadoSolicitacao): boolean {
  return REABRIVEIS.has(estado);
}

/** Um passo de transição (ação + ator + referência de auditoria). */
export interface PassoSolicitacao {
  readonly acao: AcaoSolicitacao;
  readonly ator: AtorSolicitacao;
  readonly refAuditoria: string;
}

/** Resultado de uma sequência de transições, com histórico de eventos. */
export interface ResultadoHistoricoSolicitacao {
  readonly solicitacao: Solicitacao;
  readonly eventos: readonly EventoAuditoriaSolicitacao[];
  readonly erro: ResultadoTransicaoSolicitacao | null;
}

/**
 * Aplica uma sequência de transições, acumulando o **histórico de eventos**.
 * Para no primeiro erro (fail-closed), preservando o histórico até ali. Cada
 * passo gera nova versão (imutabilidade); a entrada nunca é mutada.
 */
export function aplicarSequenciaSolicitacao(
  inicial: Solicitacao,
  passos: readonly PassoSolicitacao[],
): ResultadoHistoricoSolicitacao {
  let atual = inicial;
  const eventos: EventoAuditoriaSolicitacao[] = [];
  for (const passo of passos) {
    const resultado = transicionarSolicitacao(
      atual,
      passo.acao,
      passo.ator,
      passo.refAuditoria,
    );
    if (resultado.status !== "transicionada") {
      return { solicitacao: atual, eventos, erro: resultado };
    }
    atual = resultado.solicitacao;
    eventos.push(resultado.evento);
  }
  return { solicitacao: atual, eventos, erro: null };
}
