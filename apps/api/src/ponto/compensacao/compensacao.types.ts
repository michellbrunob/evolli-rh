/**
 * Tipos do núcleo puro do ciclo de vida de propostas de compensação de Banco de
 * Horas (Ponto V1, T054).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. O núcleo modela a **máquina de estados** da proposta
 * de compensação (contrato T053), operando **em memória** sobre dados **100%
 * sintéticos** e devolvendo, a cada transição, uma **nova versão** conceitual +
 * um **evento técnico de auditoria** — nunca mutando a entrada nem apagando
 * histórico.
 *
 * Contrato de referência: `docs/modules/etapa3-banco-horas-compensacao-contrato-v1.md`
 * (T053). Fronteiras (T053 §2, §6): este núcleo trata **apenas** a proposta;
 * **não** cria `debito_compensacao`, **não** integra ao extrato (T052), **não**
 * decide saldo disponível/ordem de consumo/validade/saldo negativo e **não**
 * calcula dinheiro/Folha.
 */

/** Estados conceituais da proposta de compensação (catálogo fechado). */
export type EstadoProposta =
  | "rascunho"
  | "submetida_para_revisao"
  | "aprovada_para_registro"
  | "recusada"
  | "cancelada";

/** Estados terminais — sem transição de saída (T053 §3). */
export const ESTADOS_TERMINAIS = [
  "aprovada_para_registro",
  "recusada",
  "cancelada",
] as const;

/**
 * Papel técnico **sintético** recebido pelo núcleo. O núcleo é neutro de
 * autorização real (sem RBAC/sessão/consulta por empresa): apenas permite
 * transição para `rh` e nega os demais. Não é o RBAC da aplicação.
 */
export type PapelTecnico =
  "rh" | "master_tecnico" | "dp" | "gestor" | "colaborador";

/**
 * Justificativa **codificada** (catálogo controlado, sem texto livre — ADR 0008
 * dec. 5). Valores sintéticos e ilustrativos.
 */
export type JustificativaCompensacao =
  | "compensacao_saldo_positivo"
  | "compensacao_acordo_semana"
  | "compensacao_ajuste_operacional";

/**
 * Proposta de compensação **sintética** — só referências técnicas. Nunca CPF,
 * nome, empresa real, marcação bruta, horário, arquivo ou dado pessoal.
 */
export interface PropostaCompensacao {
  /** Identificador técnico da proposta (não vazio). */
  readonly id: string;
  /** Referência técnica da empresa (`empresa_id`), nunca razão social real. */
  readonly empresaRef: string;
  /** Referência técnica do vínculo (`VinculoFuncional`), nunca nome/CPF. */
  readonly vinculoRef: string;
  /** Dia/período de referência, `"AAAA-MM-DD"`. */
  readonly periodoReferencia: string;
  /** Minutos propostos para o futuro débito — inteiro **positivo**. */
  readonly minutosPropostos: number;
  /** Motivo codificado (catálogo fechado). */
  readonly justificativa: JustificativaCompensacao;
  /** Estado atual (máquina de estados). */
  readonly situacao: EstadoProposta;
  /** Referência técnica ao último evento de auditoria (ADR 0004). */
  readonly refAuditoria: string;
}

/** Ações de transição da máquina de estados. */
export type AcaoProposta = "submeter" | "aprovar" | "recusar" | "cancelar";

/**
 * Evento técnico de auditoria de uma transição — só endereçamento técnico,
 * sem dado sensível (ADR 0004, sem valor sensível em claro).
 */
export interface EventoAuditoriaCompensacao {
  /** Id técnico da proposta. */
  readonly propostaId: string;
  /** Ação aplicada. */
  readonly acao: AcaoProposta;
  /** Estado antes da transição. */
  readonly estadoDe: EstadoProposta;
  /** Estado após a transição. */
  readonly estadoPara: EstadoProposta;
  /** Papel técnico que executou. */
  readonly papel: PapelTecnico;
  /** Referência técnica do evento (encadeamento com `refAuditoria`). */
  readonly refAuditoria: string;
}

/** Código de erro **seguro** — rótulo técnico estável, sem dado sensível. */
export type CompensacaoErroCodigo =
  /** Campo técnico obrigatório vazio (id/empresaRef/vinculoRef/refAuditoria). */
  | "CAMPO_OBRIGATORIO_VAZIO"
  /** `periodoReferencia` fora de `"AAAA-MM-DD"` ou inexistente no calendário. */
  | "PERIODO_INVALIDO"
  /** Minutos não inteiros ou não positivos. */
  | "MINUTOS_INVALIDOS"
  /** Justificativa fora do catálogo fechado. */
  | "JUSTIFICATIVA_DESCONHECIDA"
  /** Estado atual fora do catálogo de estados. */
  | "ESTADO_DESCONHECIDO"
  /** Ação fora do catálogo de ações. */
  | "ACAO_DESCONHECIDA"
  /** Transição não permitida a partir do estado atual (inclui não-terminal). */
  | "TRANSICAO_INVALIDA"
  /** Transição a partir de um estado terminal. */
  | "ESTADO_TERMINAL"
  /** Papel técnico sem permissão para operar (só `rh`). */
  | "PAPEL_NAO_AUTORIZADO";

/** Erro de transição — só código seguro + id técnico, sem dado sensível. */
export interface ErroCompensacao {
  readonly codigo: CompensacaoErroCodigo;
  readonly propostaId: string | null;
}

/**
 * Resultado de uma transição — união discriminada por `status`.
 *
 * - `invalido`: **fail-closed** — a entrada/transição é rejeitada; a proposta de
 *   entrada permanece **intacta** (imutável).
 * - `transicionado`: **nova versão** da proposta (a entrada não é mutada) + o
 *   evento técnico de auditoria da transição.
 */
export type ResultadoTransicao =
  | {
      readonly status: "invalido";
      readonly erro: ErroCompensacao;
    }
  | {
      readonly status: "transicionado";
      readonly proposta: PropostaCompensacao;
      readonly evento: EventoAuditoriaCompensacao;
    };
