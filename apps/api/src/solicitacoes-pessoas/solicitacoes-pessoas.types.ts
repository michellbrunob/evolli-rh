import { AccessUser, AcaoSolicitacaoPessoa, AuditAction } from "@prisma/client";
import { SessionRequestMetadata } from "../auth/session/session.service";

/** Ator + contexto de requisição para a trilha de auditoria (ADR 0004). */
export interface SolicitacoesPessoasAuditContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/** Página de resultados. Mesmo formato dos demais módulos. */
export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;

/**
 * Ação de transição → evento de auditoria. Uma ação por transição (mesmo
 * critério de `pessoas.movimentacao.*`): uma ação genérica esconderia, na
 * trilha, qual decisão o RH tomou.
 */
export const ACAO_AUDIT_ACTION: Readonly<
  Record<AcaoSolicitacaoPessoa, AuditAction>
> = {
  criar: "pessoas_solicitacao_criada",
  enviar: "pessoas_solicitacao_enviada",
  cancelar: "pessoas_solicitacao_cancelada",
  iniciar_revisao: "pessoas_solicitacao_revisao_iniciada",
  aguardar_informacao: "pessoas_solicitacao_informacao_solicitada",
  retomar_revisao: "pessoas_solicitacao_revisao_retomada",
  encaminhar_para_operacao: "pessoas_solicitacao_encaminhada",
  recusar: "pessoas_solicitacao_recusada",
  reabrir: "pessoas_solicitacao_reaberta",
};

/**
 * **Origem da intenção** de cada transição (contrato T065 §4.1) — não é a
 * identidade autenticada.
 *
 * O ator autenticado desta fundação é **sempre o RH**: não existe vínculo
 * `AccessUser <-> Colaborador` (DP-23, deliberadamente não materializado), então
 * o colaborador não tem como provar que a solicitação é dele. O RH registra em
 * nome do colaborador, como já ocorre em `solicitacoes-documento`, e é o RH que
 * a auditoria grava como ator real.
 *
 * Este mapa existe para que o núcleo puro aplique a tabela de transições certa:
 * ele diz de QUEM a ação é originalmente, não QUEM a executou. A regra de fase
 * aprovada (`PD-SOL-03`: cancelamento só antes de `em_revisao_rh`) é garantida
 * pela própria máquina de estados, não por este mapa.
 */
export const ACAO_ORIGEM: Readonly<
  Record<Exclude<AcaoSolicitacaoPessoa, "criar">, "colaborador" | "rh">
> = {
  enviar: "colaborador",
  cancelar: "colaborador",
  iniciar_revisao: "rh",
  aguardar_informacao: "rh",
  retomar_revisao: "rh",
  encaminhar_para_operacao: "rh",
  recusar: "rh",
  reabrir: "rh",
};

/**
 * Transições que exigem **justificativa codificada** (`PD-SOL-03`): a recusa,
 * que o contrato T065 §4 já exigia com motivo codificado, e a reabertura, cuja
 * decisão fala explicitamente em "justificativa auditada". As demais não a
 * exigem, e pedir motivo onde a decisão não pediu seria inventar exigência.
 */
export const ACOES_COM_MOTIVO_OBRIGATORIO: readonly AcaoSolicitacaoPessoa[] = [
  "recusar",
  "reabrir",
];
