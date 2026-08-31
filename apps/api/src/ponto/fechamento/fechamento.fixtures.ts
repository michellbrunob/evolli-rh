/**
 * Períodos e passos **exclusivamente sintéticos** para os testes do núcleo de
 * fechamento (T057).
 *
 * Todos os valores são **fictícios e inventados** — jamais extraídos de arquivo,
 * relógio, Secullum ou sistema real. Só referências **técnicas**: sem CPF, nome,
 * empresa real, marcação bruta, AFD/TXT, horário, valor, documento ou assinatura.
 *
 * TypeScript puro — sem I/O, sem persistência, sem framework.
 */

import { PassoPeriodo } from "./fechamento";
import { PeriodoFechamento } from "./fechamento.types";

/** Período sintético em `em_apuracao`, com intervalo 26/07 → 25/08 (T056 F1). */
export const PERIODO_EM_APURACAO: PeriodoFechamento = {
  id: "PER-DEMO-0001",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  inicioReferencia: "2026-07-26",
  fimReferencia: "2026-08-25",
  situacao: "em_apuracao",
  refAuditoria: "AUD-DEMO-0000",
};

/** Sequência sintética completa: em_apuracao → conferencia_manual_registrada. */
export const PERCURSO_COMPLETO: readonly PassoPeriodo[] = [
  { acao: "enviar_para_verificacao", papel: "rh", refAuditoria: "AUD-1" },
  { acao: "marcar_pronto_para_fechamento", papel: "rh", refAuditoria: "AUD-2" },
  { acao: "fechar_operacionalmente", papel: "rh", refAuditoria: "AUD-3" },
  { acao: "emitir_espelho", papel: "rh", refAuditoria: "AUD-4" },
  { acao: "iniciar_conferencia_manual", papel: "rh", refAuditoria: "AUD-5" },
  { acao: "registrar_conferencia_manual", papel: "rh", refAuditoria: "AUD-6" },
];
