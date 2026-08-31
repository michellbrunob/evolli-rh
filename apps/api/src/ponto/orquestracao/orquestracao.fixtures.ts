/**
 * Cenários e passos **exclusivamente sintéticos** para os testes do orquestrador
 * do fluxo de Ponto (T060).
 *
 * Todos os valores são **fictícios e inventados** — jamais extraídos de arquivo,
 * relógio, REP, Secullum ou sistema real. Só referências **técnicas**: sem CPF,
 * nome, empresa real, marcação bruta importada, AFD/TXT, arquivo, dado pessoal
 * ou financeiro. As marcações `"HH:MM"` são jornadas-modelo sintéticas.
 *
 * TypeScript puro — sem I/O, sem persistência, sem framework.
 */

import { PassoTransicao } from "../compensacao/compensacao";
import { PropostaCompensacao } from "../compensacao/compensacao.types";
import { PassoPeriodo } from "../fechamento/fechamento";
import { PeriodoFechamento } from "../fechamento/fechamento.types";
import { PassoPendencia } from "../verificar-folhas/verificar-folhas";
import { Pendencia } from "../verificar-folhas/verificar-folhas.types";
import {
  DiaSimulado,
  EscopoSimulacao,
  FechamentoSimulado,
  PendenciaSimulada,
  PropostaSimulada,
} from "./orquestracao.types";

/** Escopo técnico sintético compartilhado por toda a simulação. */
export const ESCOPO: EscopoSimulacao = {
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
};

/** Jornada-modelo sintética: dois blocos de 4h (`"HH:MM"`). */
const FAIXAS_PADRAO = [
  { inicio: "08:00", fim: "12:00" },
  { inicio: "13:00", fim: "17:00" },
] as const;

/** Dia sintético **normal**: marcações batem a jornada → crédito 0, débito 0. */
export const DIA_NORMAL: DiaSimulado = {
  entrada: {
    faixasPrevistas: FAIXAS_PADRAO,
    marcacoes: ["08:00", "12:00", "13:00", "17:00"],
    classificacao: "regular",
  },
  meta: { idBase: "AP-2026-08-10-V001", dataReferencia: "2026-08-10" },
};

/** Dia sintético com **hora extra**: saída 18:30 → crédito 90, débito 0. */
export const DIA_HORA_EXTRA: DiaSimulado = {
  entrada: {
    faixasPrevistas: FAIXAS_PADRAO,
    marcacoes: ["08:00", "12:00", "13:00", "18:30"],
    classificacao: "regular",
  },
  meta: { idBase: "AP-2026-08-11-V001", dataReferencia: "2026-08-11" },
};

/** Dia sintético com **atraso** de 25 min (> tolerância) → crédito 0, débito 25. */
export const DIA_ATRASO: DiaSimulado = {
  entrada: {
    faixasPrevistas: FAIXAS_PADRAO,
    marcacoes: ["08:25", "12:00", "13:00", "17:00"],
    classificacao: "regular",
  },
  meta: { idBase: "AP-2026-08-12-V001", dataReferencia: "2026-08-12" },
};

/** Pendência sintética de jornada incompleta, em `aberta`. */
export const PENDENCIA_ABERTA: Pendencia = {
  id: "PEND-DEMO-0001",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  periodoReferencia: "2026-08-12",
  tipo: "jornada_incompleta",
  severidade: "atencao",
  origem: "apuracao",
  situacao: "aberta",
  motivo: "par_incompleto",
  refAuditoria: "AUD-PEND-0000",
};

/** Percurso humano de RH: aberta → em_revisao_rh → resolvida (sem alteração). */
export const PERCURSO_PENDENCIA_RESOLVIDA: readonly PassoPendencia[] = [
  { acao: "iniciar_revisao", papel: "rh", refAuditoria: "AUD-PEND-1" },
  { acao: "resolver_sem_alteracao", papel: "rh", refAuditoria: "AUD-PEND-2" },
];

/** Pendência sintética + percurso de resolução (para a simulação padrão). */
export const PENDENCIA_SIMULADA: PendenciaSimulada = {
  inicial: PENDENCIA_ABERTA,
  passos: PERCURSO_PENDENCIA_RESOLVIDA,
};

/** Proposta de compensação sintética, em `rascunho`. */
export const PROPOSTA_RASCUNHO: PropostaCompensacao = {
  id: "PROP-DEMO-0001",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  periodoReferencia: "2026-08-11",
  minutosPropostos: 60,
  justificativa: "compensacao_acordo_semana",
  situacao: "rascunho",
  refAuditoria: "AUD-PROP-0000",
};

/** Percurso humano de RH: rascunho → submetida → aprovada_para_registro. */
export const PERCURSO_PROPOSTA_APROVADA: readonly PassoTransicao[] = [
  { acao: "submeter", papel: "rh", refAuditoria: "AUD-PROP-1" },
  { acao: "aprovar", papel: "rh", refAuditoria: "AUD-PROP-2" },
];

/** Proposta sintética + percurso de aprovação (para a simulação padrão). */
export const PROPOSTA_SIMULADA: PropostaSimulada = {
  inicial: PROPOSTA_RASCUNHO,
  passos: PERCURSO_PROPOSTA_APROVADA,
};

/** Período de fechamento sintético, em `em_apuracao`. */
export const PERIODO_EM_APURACAO: PeriodoFechamento = {
  id: "PER-DEMO-0001",
  empresaRef: "EMP-A",
  vinculoRef: "V-001",
  inicioReferencia: "2026-08-01",
  fimReferencia: "2026-08-31",
  situacao: "em_apuracao",
  refAuditoria: "AUD-PER-0000",
};

/** Percurso humano de RH completo: em_apuracao → conferencia_manual_registrada. */
export const PERCURSO_FECHAMENTO_COMPLETO: readonly PassoPeriodo[] = [
  { acao: "enviar_para_verificacao", papel: "rh", refAuditoria: "AUD-PER-1" },
  {
    acao: "marcar_pronto_para_fechamento",
    papel: "rh",
    refAuditoria: "AUD-PER-2",
  },
  { acao: "fechar_operacionalmente", papel: "rh", refAuditoria: "AUD-PER-3" },
  { acao: "emitir_espelho", papel: "rh", refAuditoria: "AUD-PER-4" },
  {
    acao: "iniciar_conferencia_manual",
    papel: "rh",
    refAuditoria: "AUD-PER-5",
  },
  {
    acao: "registrar_conferencia_manual",
    papel: "rh",
    refAuditoria: "AUD-PER-6",
  },
];

/** Fechamento sintético + percurso completo (para a simulação padrão). */
export const FECHAMENTO_SIMULADO: FechamentoSimulado = {
  inicial: PERIODO_EM_APURACAO,
  passos: PERCURSO_FECHAMENTO_COMPLETO,
};
