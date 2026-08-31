/**
 * Pendências e passos **exclusivamente sintéticos** para os testes do núcleo da
 * fila "Verificar folhas" (T059).
 *
 * Todos os valores são **fictícios e inventados** — jamais extraídos de arquivo,
 * relógio, Secullum ou sistema real. Só referências **técnicas**: sem CPF, nome,
 * empresa real, marcação bruta, horário exato, AFD/TXT, arquivo ou dado pessoal.
 *
 * TypeScript puro — sem I/O, sem persistência, sem framework.
 */

import { PassoPendencia } from "./verificar-folhas";
import { Pendencia } from "./verificar-folhas.types";

/** Pendência sintética de jornada incompleta, em `aberta` (severidade atenção). */
export const PENDENCIA_JORNADA_INCOMPLETA: Pendencia = {
  id: "PEND-DEMO-0001",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  periodoReferencia: "2026-08-10",
  tipo: "jornada_incompleta",
  severidade: "atencao",
  origem: "apuracao",
  situacao: "aberta",
  motivo: "par_incompleto",
  refAuditoria: "AUD-DEMO-0000",
};

/** Pendência sintética de importação não associada, em `aberta` (crítica). */
export const PENDENCIA_IMPORTACAO_NAO_ASSOCIADA: Pendencia = {
  id: "PEND-DEMO-0002",
  empresaRef: "EMP-A",
  vinculoRef: "V-000",
  periodoReferencia: "2026-08-11",
  tipo: "dado_importacao_nao_associado",
  severidade: "critica",
  origem: "importacao",
  situacao: "aberta",
  motivo: "sem_vinculo",
  refAuditoria: "AUD-DEMO-0000",
};

/** Ciclo válido: aberta → em_revisao_rh → resolvida_sem_alteracao_automatica. */
export const PERCURSO_RESOLVIDA: readonly PassoPendencia[] = [
  { acao: "iniciar_revisao", papel: "rh", refAuditoria: "AUD-1" },
  { acao: "resolver_sem_alteracao", papel: "rh", refAuditoria: "AUD-2" },
];

/** Ciclo válido: aberta → em_revisao_rh → descartada_por_erro_tecnico. */
export const PERCURSO_DESCARTADA: readonly PassoPendencia[] = [
  { acao: "iniciar_revisao", papel: "rh", refAuditoria: "AUD-1" },
  { acao: "descartar_por_erro_tecnico", papel: "rh", refAuditoria: "AUD-2" },
];
