/**
 * Propostas de compensação **exclusivamente sintéticas** para os testes do
 * núcleo (T054).
 *
 * Todos os valores são **fictícios e inventados** — jamais extraídos de arquivo,
 * relógio, Secullum ou sistema real. Só referências **técnicas**: sem CPF, nome,
 * empresa real, marcação bruta, horário, arquivo ou dado pessoal.
 *
 * TypeScript puro — sem I/O, sem persistência, sem framework.
 */

import { PropostaCompensacao } from "./compensacao.types";

/** Proposta sintética em `rascunho`, com referências técnicas válidas. */
export const PROPOSTA_RASCUNHO: PropostaCompensacao = {
  id: "COMP-DEMO-0001",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  periodoReferencia: "2026-08-10",
  minutosPropostos: 120,
  justificativa: "compensacao_saldo_positivo",
  situacao: "rascunho",
  refAuditoria: "AUD-DEMO-0000",
};
