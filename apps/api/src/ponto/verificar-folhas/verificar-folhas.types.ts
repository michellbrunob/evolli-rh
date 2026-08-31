/**
 * Tipos do núcleo puro da fila conceitual "Verificar folhas" V1 (Ponto V1,
 * T059).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. Modela a **máquina de estados** de uma pendência de
 * revisão (contrato T058), operando **em memória** sobre dados **sintéticos** e
 * devolvendo, a cada transição, uma **nova versão** conceitual + um **evento
 * técnico de auditoria** — nunca mutando a entrada nem apagando histórico.
 *
 * Contrato de referência: `docs/modules/etapa3-fila-verificar-folhas-contrato-v1.md`
 * (T058). Fronteiras (T058 §2): este núcleo trata **apenas** a fila de revisão;
 * **não** cria pendências reais, **não** ajusta marcação, **não** chama
 * T050/T052/T054/T057, **não** cria movimento nem altera saldo, e **não**
 * calcula dinheiro/Folha.
 */

/** Tipos iniciais de pendência (catálogo fechado — T058 §3). */
export type TipoPendencia =
  | "batida_ausente"
  | "batida_fora_do_horario"
  | "jornada_incompleta"
  | "compensacao_pendente"
  | "dado_importacao_nao_associado";

/** Estados conceituais da pendência (catálogo fechado — T058 §5). */
export type EstadoPendencia =
  | "aberta"
  | "em_revisao_rh"
  | "aguardando_informacao"
  | "resolvida_sem_alteracao_automatica"
  | "descartada_por_erro_tecnico";

/** Estados terminais — sem transição de saída (T058 §5). */
export const ESTADOS_TERMINAIS = [
  "resolvida_sem_alteracao_automatica",
  "descartada_por_erro_tecnico",
] as const;

/**
 * Severidade — **apenas priorização operacional** (T058 §6.1). Recebida como
 * informação; o núcleo **não** calcula, **não** reclassifica e **não** a usa
 * para bloquear/resolver/descartar/fechar.
 */
export type SeveridadePendencia = "informativa" | "atencao" | "critica";

/** Origem técnica da pendência (catálogo fechado). */
export type OrigemPendencia = "apuracao" | "compensacao" | "importacao";

/** Motivo **codificado** (catálogo fechado, sem texto livre — ADR 0008 dec. 5). */
export type MotivoPendencia =
  | "par_incompleto"
  | "marcacao_ausente"
  | "marcacao_fora_horario"
  | "compensacao_aguardando"
  | "sem_vinculo";

/**
 * Papel técnico **sintético** recebido pelo núcleo. Neutro de autorização real
 * (sem RBAC/sessão/consulta por empresa): apenas permite transição para `rh` e
 * nega os demais. Não é o RBAC da aplicação.
 */
export type PapelTecnico =
  "rh" | "master_tecnico" | "dp" | "gestor" | "colaborador";

/**
 * Pendência **sintética** — só referências técnicas. Nunca CPF, nome, empresa
 * real, marcação bruta, horário exato, AFD/TXT, arquivo ou dado pessoal.
 */
export interface Pendencia {
  /** Identificador técnico da pendência (não vazio). */
  readonly id: string;
  /** Referência técnica da empresa (`empresa_id`), nunca razão social real. */
  readonly empresaRef: string;
  /** Referência técnica do vínculo (`VinculoFuncional`), nunca nome/CPF. */
  readonly vinculoRef: string;
  /** Dia/período de referência, `"AAAA-MM-DD"`. */
  readonly periodoReferencia: string;
  /** Tipo da pendência (§3). */
  readonly tipo: TipoPendencia;
  /** Severidade de priorização (recebida; não calculada). */
  readonly severidade: SeveridadePendencia;
  /** Origem técnica (catálogo fechado). */
  readonly origem: OrigemPendencia;
  /** Estado atual (máquina de estados). */
  readonly situacao: EstadoPendencia;
  /** Motivo codificado (catálogo fechado). */
  readonly motivo: MotivoPendencia;
  /** Referência técnica ao último evento de auditoria (ADR 0004). */
  readonly refAuditoria: string;
}

/** Ações de transição da máquina de estados (T058 §5.1). */
export type AcaoPendencia =
  | "iniciar_revisao"
  | "aguardar_informacao"
  | "retomar_revisao"
  | "resolver_sem_alteracao"
  | "descartar_por_erro_tecnico";

/**
 * Evento técnico de auditoria de uma transição — só endereçamento técnico, sem
 * dado sensível (ADR 0004, sem valor sensível em claro).
 */
export interface EventoAuditoriaPendencia {
  readonly pendenciaId: string;
  readonly acao: AcaoPendencia;
  readonly estadoDe: EstadoPendencia;
  readonly estadoPara: EstadoPendencia;
  readonly papel: PapelTecnico;
  readonly refAuditoria: string;
}

/** Código de erro **seguro** — rótulo técnico estável, sem dado sensível. */
export type VerificarFolhasErroCodigo =
  /** Campo técnico obrigatório vazio (id/empresaRef/vinculoRef/refAuditoria). */
  | "CAMPO_OBRIGATORIO_VAZIO"
  /** Data de referência fora de `"AAAA-MM-DD"` ou inexistente no calendário. */
  | "DATA_INVALIDA"
  /** Tipo fora do catálogo de tipos. */
  | "TIPO_DESCONHECIDO"
  /** Estado atual fora do catálogo de estados. */
  | "ESTADO_DESCONHECIDO"
  /** Ação fora do catálogo de ações. */
  | "ACAO_DESCONHECIDA"
  /** Severidade fora do catálogo. */
  | "SEVERIDADE_DESCONHECIDA"
  /** Origem fora do catálogo. */
  | "ORIGEM_DESCONHECIDA"
  /** Motivo fora do catálogo. */
  | "MOTIVO_DESCONHECIDO"
  /** Transição fora de ordem (ação não corresponde ao estado atual). */
  | "TRANSICAO_INVALIDA"
  /** Tentativa de transição a partir de estado terminal. */
  | "ESTADO_TERMINAL"
  /** Papel técnico sem permissão para operar (só `rh`). */
  | "PAPEL_NAO_AUTORIZADO";

/** Erro de transição — só código seguro + id técnico, sem dado sensível. */
export interface ErroVerificarFolhas {
  readonly codigo: VerificarFolhasErroCodigo;
  readonly pendenciaId: string | null;
}

/**
 * Resultado de uma transição — união discriminada por `status`.
 *
 * - `invalido`: **fail-closed** — a entrada/transição é rejeitada; a pendência
 *   de entrada permanece **intacta** (imutável).
 * - `transicionado`: **nova versão** da pendência (a entrada não é mutada) + o
 *   evento técnico de auditoria da transição.
 */
export type ResultadoTransicaoPendencia =
  | {
      readonly status: "invalido";
      readonly erro: ErroVerificarFolhas;
    }
  | {
      readonly status: "transicionado";
      readonly pendencia: Pendencia;
      readonly evento: EventoAuditoriaPendencia;
    };
