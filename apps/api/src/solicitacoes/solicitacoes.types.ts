/**
 * Tipos do núcleo puro do ciclo conceitual da Central de Solicitações do
 * Colaborador (T066).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Modela a **máquina de estados** de uma solicitação
 * (contrato T065), operando **em memória** sobre dados **sintéticos** e
 * devolvendo, a cada transição, uma **nova versão** conceitual + um **evento
 * técnico de auditoria** — nunca mutando a entrada nem apagando histórico.
 *
 * Contrato de referência: `docs/modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md`
 * (T065). Fronteiras (T065 §1, §7): a Central **apenas** registra e encaminha;
 * **não** corrige marcação, **não** gera débito, **não** altera cadastro/
 * documento/fechamento/Folha e o encaminhamento **não** executa mutação.
 */

/** Tipos de solicitação (catálogo fechado — T065 §2). */
export type TipoSolicitacao =
  | "contestacao_ajuste_ponto"
  | "ausencia"
  | "ferias"
  | "atualizacao_cadastral"
  | "documento";

/** Estados conceituais da solicitação (catálogo fechado — T065 §4). */
export type EstadoSolicitacao =
  | "rascunho"
  | "enviada"
  | "em_revisao_rh"
  | "aguardando_informacao"
  | "encaminhada_para_operacao_rh"
  | "recusada"
  | "cancelada";

/** Estados terminais — sem transição de saída (T065 §4). */
export const ESTADOS_TERMINAIS = [
  "encaminhada_para_operacao_rh",
  "recusada",
  "cancelada",
] as const;

/**
 * Motivo **codificado** (catálogo controlado, sem texto livre — ADR 0008 dec. 5).
 * Valores sintéticos e ilustrativos, não regra trabalhista aprovada.
 */
export type MotivoSolicitacao =
  | "divergencia_marcacao"
  | "ausencia_programada"
  | "periodo_ferias"
  | "dado_cadastral_desatualizado"
  | "segunda_via_documento";

/**
 * Papel técnico **sintético** do ator. Neutro de autorização real (sem
 * RBAC/sessão/consulta por empresa): apenas `colaborador` e `rh` podem operar,
 * cada um no seu escopo; os demais são negados. Não é o RBAC da aplicação.
 */
export type PapelAtor =
  "colaborador" | "rh" | "master_tecnico" | "dp" | "gestor";

/**
 * Ator **sintético** — só referências técnicas. O escopo é conferido por
 * referência: `colaborador` só atua na própria solicitação (`vinculoRef`
 * compatível); `rh` só atua em solicitação da própria empresa (`empresaRef`
 * compatível).
 */
export interface AtorSolicitacao {
  readonly papel: PapelAtor;
  /** Referência técnica da empresa do ator (`empresa_id`), nunca razão social. */
  readonly empresaRef: string;
  /** Referência técnica do vínculo do ator (`VinculoFuncional`), nunca nome/CPF. */
  readonly vinculoRef: string;
}

/**
 * Solicitação **sintética** — só referências técnicas. Nunca CPF, nome, texto
 * livre, marcação bruta, atestado, arquivo, imagem, documento pessoal ou dado
 * sensível.
 */
export interface Solicitacao {
  /** Identificador técnico da solicitação (não vazio). */
  readonly id: string;
  /** Referência técnica da empresa (`empresa_id`), nunca razão social real. */
  readonly empresaRef: string;
  /** Referência técnica do vínculo (`VinculoFuncional`), nunca nome/CPF. */
  readonly vinculoRef: string;
  /** Tipo da solicitação (§2). */
  readonly tipo: TipoSolicitacao;
  /**
   * Dia/período de referência, `"AAAA-MM-DD"` — **quando aplicável** (ex.:
   * contestação de ponto). `null` quando o tipo não referencia um período.
   */
  readonly periodoReferencia: string | null;
  /** Motivo codificado (catálogo fechado). */
  readonly motivo: MotivoSolicitacao;
  /** Estado atual (máquina de estados). */
  readonly situacao: EstadoSolicitacao;
  /** Referência técnica ao último evento de auditoria (ADR 0004). */
  readonly refAuditoria: string;
}

/** Ações de transição da máquina de estados (T065 §4.1). */
export type AcaoSolicitacao =
  | "enviar"
  | "cancelar"
  | "iniciar_revisao"
  | "aguardar_informacao"
  | "retomar_revisao"
  | "encaminhar_para_operacao"
  | "recusar";

/**
 * Evento técnico de auditoria de uma transição — só endereçamento técnico, sem
 * dado sensível (ADR 0004, sem valor sensível em claro).
 */
export interface EventoAuditoriaSolicitacao {
  readonly solicitacaoId: string;
  readonly acao: AcaoSolicitacao;
  readonly estadoDe: EstadoSolicitacao;
  readonly estadoPara: EstadoSolicitacao;
  readonly papel: PapelAtor;
  readonly refAuditoria: string;
}

/** Código de erro **seguro** — rótulo técnico estável, sem dado sensível. */
export type SolicitacoesErroCodigo =
  /** Campo técnico obrigatório vazio (id/empresaRef/vinculoRef/refAuditoria/ator). */
  | "CAMPO_OBRIGATORIO_VAZIO"
  /** `periodoReferencia` presente porém fora de `"AAAA-MM-DD"` ou inexistente. */
  | "PERIODO_INVALIDO"
  /** Tipo fora do catálogo. */
  | "TIPO_DESCONHECIDO"
  /** Motivo fora do catálogo. */
  | "MOTIVO_DESCONHECIDO"
  /** Estado atual fora do catálogo de estados. */
  | "ESTADO_DESCONHECIDO"
  /** Ação fora do catálogo de ações. */
  | "ACAO_DESCONHECIDA"
  /** Papel do ator fora do catálogo. */
  | "PAPEL_DESCONHECIDO"
  /** Papel não autorizado a executar a ação (só `colaborador`/`rh` no seu escopo). */
  | "PAPEL_NAO_AUTORIZADO"
  /** Ator fora do escopo (vínculo/empresa incompatível) — falha segura. */
  | "ATOR_FORA_DO_ESCOPO"
  /** Transição fora de ordem (ação não corresponde ao estado atual). */
  | "TRANSICAO_INVALIDA"
  /** Tentativa de transição a partir de estado terminal. */
  | "ESTADO_TERMINAL";

/** Erro de transição — só código seguro + id técnico, sem dado sensível. */
export interface ErroSolicitacoes {
  readonly codigo: SolicitacoesErroCodigo;
  readonly solicitacaoId: string | null;
}

/**
 * Resultado de uma transição — união discriminada por `status`.
 *
 * - `invalido`: **fail-closed** — a entrada/transição é rejeitada; a
 *   solicitação de entrada permanece **intacta** (imutável).
 * - `transicionada`: **nova versão** da solicitação (a entrada não é mutada) +
 *   o evento técnico de auditoria da transição.
 */
export type ResultadoTransicaoSolicitacao =
  | {
      readonly status: "invalido";
      readonly erro: ErroSolicitacoes;
    }
  | {
      readonly status: "transicionada";
      readonly solicitacao: Solicitacao;
      readonly evento: EventoAuditoriaSolicitacao;
    };
