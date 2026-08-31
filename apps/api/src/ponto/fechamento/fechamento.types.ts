/**
 * Tipos do núcleo puro do ciclo de fechamento do período de Ponto e conferência
 * manual do Espelho V1 (Ponto V1, T057).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Modela a **máquina de estados** do período
 * (contrato T056), operando **em memória** sobre dados **sintéticos** e
 * devolvendo, a cada transição, uma **nova versão** conceitual + um **evento
 * técnico de auditoria** — nunca mutando a entrada nem apagando histórico.
 *
 * Contrato de referência: `docs/modules/etapa3-fechamento-espelho-contrato-v1.md`
 * (T056). Fronteiras (T056 §2, §5, §6): este núcleo trata **apenas** o
 * ciclo conceitual do período; **não** cria movimento de Banco de Horas, **não**
 * chama T050/T052/T054, **não** altera saldo, **não** emite PDF/Espelho real,
 * **não** captura assinatura e **não** calcula dinheiro/Folha.
 */

/** Estados conceituais do período (catálogo fechado — T056 §3). */
export type EstadoPeriodo =
  | "em_apuracao"
  | "em_verificacao_rh"
  | "pronto_para_fechamento"
  | "fechado_operacionalmente"
  | "espelho_emitido"
  | "conferencia_manual_pendente"
  | "conferencia_manual_registrada";

/** Estado terminal — sem transição de saída (T056 §3). */
export const ESTADO_TERMINAL: EstadoPeriodo = "conferencia_manual_registrada";

/**
 * Papel técnico **sintético** recebido pelo núcleo. Neutro de autorização real
 * (sem RBAC/sessão/consulta por empresa): apenas permite transição para `rh` e
 * nega os demais. Não é o RBAC da aplicação.
 */
export type PapelTecnico =
  "rh" | "master_tecnico" | "dp" | "gestor" | "colaborador";

/**
 * Período **sintético** — só referências técnicas. Nunca CPF, nome, empresa
 * real, marcação bruta, AFD/TXT, horário, valor, documento ou assinatura real.
 */
export interface PeriodoFechamento {
  /** Identificador técnico do período (não vazio). */
  readonly id: string;
  /** Referência técnica da empresa (`empresa_id`), nunca razão social real. */
  readonly empresaRef: string;
  /** Referência técnica do vínculo (`VinculoFuncional`), nunca nome/CPF. */
  readonly vinculoRef: string;
  /** Início do intervalo de referência, `"AAAA-MM-DD"`. */
  readonly inicioReferencia: string;
  /** Fim do intervalo de referência, `"AAAA-MM-DD"` (deve ser > início). */
  readonly fimReferencia: string;
  /** Estado atual (máquina de estados). */
  readonly situacao: EstadoPeriodo;
  /** Referência técnica ao último evento de auditoria (ADR 0004). */
  readonly refAuditoria: string;
}

/** Ações de transição da máquina de estados (T056 §3.1). */
export type AcaoPeriodo =
  | "enviar_para_verificacao"
  | "marcar_pronto_para_fechamento"
  | "fechar_operacionalmente"
  | "emitir_espelho"
  | "iniciar_conferencia_manual"
  | "registrar_conferencia_manual";

/**
 * Evento técnico de auditoria de uma transição — só endereçamento técnico, sem
 * dado sensível (ADR 0004, sem valor sensível em claro).
 */
export interface EventoAuditoriaFechamento {
  readonly periodoId: string;
  readonly acao: AcaoPeriodo;
  readonly estadoDe: EstadoPeriodo;
  readonly estadoPara: EstadoPeriodo;
  readonly papel: PapelTecnico;
  readonly refAuditoria: string;
}

/** Código de erro **seguro** — rótulo técnico estável, sem dado sensível. */
export type FechamentoErroCodigo =
  /** Campo técnico obrigatório vazio (id/empresaRef/vinculoRef/refAuditoria). */
  | "CAMPO_OBRIGATORIO_VAZIO"
  /** Data de referência fora de `"AAAA-MM-DD"` ou inexistente no calendário. */
  | "DATA_INVALIDA"
  /** Intervalo invertido (fim não é posterior ao início). */
  | "INTERVALO_INVERTIDO"
  /** Estado atual fora do catálogo de estados. */
  | "ESTADO_DESCONHECIDO"
  /** Ação fora do catálogo de ações. */
  | "ACAO_DESCONHECIDA"
  /** Transição fora de ordem (ação não corresponde ao estado atual). */
  | "TRANSICAO_INVALIDA"
  /** Tentativa de transição a partir do estado terminal. */
  | "ESTADO_TERMINAL"
  /** Papel técnico sem permissão para operar (só `rh`). */
  | "PAPEL_NAO_AUTORIZADO";

/** Erro de transição — só código seguro + id técnico, sem dado sensível. */
export interface ErroFechamento {
  readonly codigo: FechamentoErroCodigo;
  readonly periodoId: string | null;
}

/**
 * Resultado de uma transição — união discriminada por `status`.
 *
 * - `invalido`: **fail-closed** — a entrada/transição é rejeitada; o período de
 *   entrada permanece **intacto** (imutável).
 * - `transicionado`: **nova versão** do período (a entrada não é mutada) + o
 *   evento técnico de auditoria da transição.
 */
export type ResultadoTransicaoPeriodo =
  | {
      readonly status: "invalido";
      readonly erro: ErroFechamento;
    }
  | {
      readonly status: "transicionado";
      readonly periodo: PeriodoFechamento;
      readonly evento: EventoAuditoriaFechamento;
    };
