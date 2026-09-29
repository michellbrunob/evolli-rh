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

/**
 * Tipos de solicitação (catálogo fechado — `PD-SOL-01`, aprovada em
 * 2026-09-29). `documento` **saiu** deste catálogo: solicitação de documento
 * permanece no fluxo real e separado de `solicitacoes-documento` (T133).
 */
export type TipoSolicitacao =
  | "contestacao_ajuste_ponto"
  | "ausencia"
  | "ferias"
  | "atualizacao_cadastral"
  | "atestado"
  | "beneficios";

/** Estados conceituais da solicitação (catálogo fechado — T065 §4). */
export type EstadoSolicitacao =
  | "rascunho"
  | "enviada"
  | "em_revisao_rh"
  | "aguardando_informacao"
  | "encaminhada_para_operacao_rh"
  | "recusada"
  | "cancelada";

/**
 * Estados que **encerram o ciclo** da Central (T065 §4). Note que encerrar o
 * ciclo não é mais sinônimo de "sem nenhuma saída": `PD-SOL-03` autorizou o RH
 * a reabrir dois deles (ver `ESTADOS_REABRIVEIS`). `cancelada` continua
 * terminal em sentido absoluto.
 */
export const ESTADOS_TERMINAIS = [
  "encaminhada_para_operacao_rh",
  "recusada",
  "cancelada",
] as const;

/**
 * Estados terminais que o **RH** pode reabrir, com justificativa codificada e
 * auditada (`PD-SOL-03`). `encaminhada_para_operacao_rh` é o estado que o termo
 * funcional "encerrada" designa — nenhum estado literal `encerrada` existe.
 * `cancelada` **não** está aqui: uma solicitação cancelada exige nova
 * solicitação.
 */
export const ESTADOS_REABRIVEIS = [
  "encaminhada_para_operacao_rh",
  "recusada",
] as const;

/**
 * Motivo **codificado** (catálogo controlado, sem texto livre — ADR 0008 dec. 5).
 *
 * Mesmo mecanismo — e pela mesma razão — de `MotivoMovimentacao` (Fatia 2) e
 * `MotivoAjustePonto` (Etapa 3): um campo de observação sem classificação é por
 * onde dado sensível (ex.: diagnóstico médico) entra sem controle. O que
 * `PD-SOL-05` fecha é o **mecanismo** (código fechado, sem texto livre); o
 * **conteúdo** da lista é detalhe de implementação, extensível de forma aditiva
 * e a validar com RH — a mesma ressalva já registrada nos dois enums acima.
 *
 * `segunda_via_documento` saiu junto com o tipo `documento` (`PD-SOL-01`).
 * Nenhuma regra associa um motivo a um tipo: essa vinculação não foi decidida e
 * não é inventada aqui.
 */
export type MotivoSolicitacao =
  // Registro da intenção.
  | "divergencia_marcacao"
  | "ausencia_programada"
  | "periodo_ferias"
  | "dado_cadastral_desatualizado"
  | "atestado_apresentado"
  | "beneficio_solicitado"
  // Decisão do RH (recusa) e justificativa de reabertura — `PD-SOL-03`.
  | "informacao_insuficiente"
  | "fora_do_escopo_da_central"
  | "duplicidade"
  | "reanalise_administrativa"
  | "correcao_de_registro"
  /** Escape do próprio catálogo — nunca texto livre. */
  | "outro_controlado";

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

/**
 * Ações de transição da máquina de estados (T065 §4.1, reconciliado por
 * `PD-SOL-03`). `reabrir` é a ação exclusiva do RH sobre
 * `encaminhada_para_operacao_rh` ("encerrada", termo funcional) e `recusada`;
 * `cancelada` **não** é reabrível — exige nova solicitação.
 */
export type AcaoSolicitacao =
  | "enviar"
  | "cancelar"
  | "iniciar_revisao"
  | "aguardar_informacao"
  | "retomar_revisao"
  | "encaminhar_para_operacao"
  | "recusar"
  | "reabrir";

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
