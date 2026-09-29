/**
 * Atores, solicitações e percursos **exclusivamente sintéticos** para os testes
 * do núcleo da Central de Solicitações do Colaborador (T066).
 *
 * Todos os valores são **fictícios e inventados** — jamais extraídos de arquivo,
 * relógio, cadastro ou sistema real. Só referências **técnicas**: sem CPF, nome,
 * texto livre, marcação bruta, atestado, arquivo, imagem, documento pessoal ou
 * dado sensível.
 *
 * TypeScript puro — sem I/O, sem persistência, sem framework.
 */

import { PassoSolicitacao } from "./solicitacoes";
import { AtorSolicitacao, Solicitacao } from "./solicitacoes.types";

/** Colaborador dono do vínculo `V-001` na empresa `EMP-A`. */
export const ATOR_COLABORADOR: AtorSolicitacao = {
  papel: "colaborador",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
};

/** RH da empresa `EMP-A`. */
export const ATOR_RH: AtorSolicitacao = {
  papel: "rh",
  empresaRef: "EMP-A",
  vinculoRef: "V-RH-A",
};

/** Colaborador de outro vínculo (`V-999`), para testes de escopo. */
export const ATOR_COLABORADOR_OUTRO: AtorSolicitacao = {
  papel: "colaborador",
  empresaRef: "EMP-A",
  vinculoRef: "V-999",
};

/** RH de outra empresa (`EMP-B`), para testes de escopo. */
export const ATOR_RH_OUTRA_EMPRESA: AtorSolicitacao = {
  papel: "rh",
  empresaRef: "EMP-B",
  vinculoRef: "V-RH-B",
};

/** Solicitação sintética de contestação de ponto, em `rascunho` (com período). */
export const SOLICITACAO_CONTESTACAO: Solicitacao = {
  id: "SOL-DEMO-0001",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  tipo: "contestacao_ajuste_ponto",
  periodoReferencia: "2026-08-10",
  motivo: "divergencia_marcacao",
  situacao: "rascunho",
  refAuditoria: "AUD-SOL-0000",
};

/**
 * Solicitação sintética de atestado, em `rascunho` (sem período aplicável).
 *
 * Substitui a antiga fixture do tipo `documento`, retirado do catálogo por
 * `PD-SOL-01`. Mesmo sendo do tipo `atestado`, a fixture carrega **apenas
 * referências técnicas**: nenhum diagnóstico, CID, descrição clínica, arquivo
 * ou anexo — a minimização vale inclusive para os dados de teste.
 */
export const SOLICITACAO_ATESTADO: Solicitacao = {
  id: "SOL-DEMO-0002",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  tipo: "atestado",
  periodoReferencia: null,
  motivo: "atestado_apresentado",
  situacao: "rascunho",
  refAuditoria: "AUD-SOL-0000",
};

/** Percurso completo: rascunho → enviada → em_revisao_rh → encaminhada. */
export const PERCURSO_CONTESTACAO_ENCAMINHADA: readonly PassoSolicitacao[] = [
  { acao: "enviar", ator: ATOR_COLABORADOR, refAuditoria: "AUD-SOL-1" },
  { acao: "iniciar_revisao", ator: ATOR_RH, refAuditoria: "AUD-SOL-2" },
  {
    acao: "encaminhar_para_operacao",
    ator: ATOR_RH,
    refAuditoria: "AUD-SOL-3",
  },
];

/** Percurso: rascunho → enviada → em_revisao_rh (atestado em revisão). */
export const PERCURSO_ATESTADO_EM_REVISAO: readonly PassoSolicitacao[] = [
  { acao: "enviar", ator: ATOR_COLABORADOR, refAuditoria: "AUD-SOL-1" },
  { acao: "iniciar_revisao", ator: ATOR_RH, refAuditoria: "AUD-SOL-2" },
];

/**
 * Percurso de recusa e reabertura (`PD-SOL-03`): rascunho → enviada →
 * em_revisao_rh → recusada → em_revisao_rh.
 */
export const PERCURSO_RECUSADA_E_REABERTA: readonly PassoSolicitacao[] = [
  { acao: "enviar", ator: ATOR_COLABORADOR, refAuditoria: "AUD-SOL-1" },
  { acao: "iniciar_revisao", ator: ATOR_RH, refAuditoria: "AUD-SOL-2" },
  { acao: "recusar", ator: ATOR_RH, refAuditoria: "AUD-SOL-3" },
  { acao: "reabrir", ator: ATOR_RH, refAuditoria: "AUD-SOL-4" },
];
