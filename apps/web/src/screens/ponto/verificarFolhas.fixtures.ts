/**
 * Dados sintéticos da tela "Ponto > Verificar folhas" (T045).
 *
 * Ilustra a fila de triagem descrita em
 * `docs/modules/etapa3-jornada-ponto-v1-detalhada.md` (§5) — "sinaliza o que
 * precisa de atenção antes de um fechamento, sem ajustar, descontar,
 * compensar ou fechar automaticamente". Identificadores são abstratos e
 * sintéticos (`Vínculo V-001`), mesma convenção já usada na especificação
 * (§0) — nenhum CPF, nome, empresa real ou horário observado em sistema
 * externo. Puramente apresentação: sem chamada de rede, sem persistência.
 */

export type TipoPendencia =
  | "batida_ausente"
  | "batida_fora_horario"
  | "jornada_incompleta"
  | "compensacao_pendente"
  | "importacao_nao_associada";

export type SeveridadePendencia = "informativa" | "atencao" | "critica";

export type EstadoPendencia = "aberto" | "em_analise" | "resolvido";

export interface PendenciaExemplo {
  readonly id: string;
  readonly vinculo: string;
  readonly dia: string;
  readonly tipo: TipoPendencia;
  readonly severidade: SeveridadePendencia;
  readonly estado: EstadoPendencia;
  readonly detalhe: string;
}

export const ROTULO_TIPO: Record<TipoPendencia, string> = {
  batida_ausente: "Batida ausente",
  batida_fora_horario: "Batida fora do horário",
  jornada_incompleta: "Jornada incompleta",
  compensacao_pendente: "Compensação pendente",
  importacao_nao_associada: "Dado de importação não associado",
};

export const ROTULO_SEVERIDADE: Record<SeveridadePendencia, string> = {
  informativa: "Informativa",
  atencao: "Atenção",
  critica: "Crítica",
};

export const ROTULO_ESTADO: Record<EstadoPendencia, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  resolvido: "Resolvido",
};

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — só formatação, sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export const PENDENCIAS_EXEMPLO: readonly PendenciaExemplo[] = [
  {
    id: "pendencia-exemplo-1",
    vinculo: "Vínculo V-001",
    dia: "2026-01-05",
    tipo: "batida_ausente",
    severidade: "critica",
    estado: "aberto",
    detalhe:
      "Falta uma marcação esperada pelo horário planejado do dia (exemplo ilustrativo).",
  },
  {
    id: "pendencia-exemplo-2",
    vinculo: "Vínculo V-014",
    dia: "2026-01-06",
    tipo: "batida_fora_horario",
    severidade: "atencao",
    estado: "em_analise",
    detalhe:
      "Marcação registrada fora da faixa prevista pelo horário vigente (exemplo ilustrativo).",
  },
  {
    id: "pendencia-exemplo-3",
    vinculo: "Vínculo V-007",
    dia: "2026-01-07",
    tipo: "jornada_incompleta",
    severidade: "atencao",
    estado: "aberto",
    detalhe:
      "O conjunto de marcações do dia não fecha o par entrada/saída esperado (exemplo ilustrativo).",
  },
  {
    id: "pendencia-exemplo-4",
    vinculo: "Vínculo V-022",
    dia: "2026-01-08",
    tipo: "compensacao_pendente",
    severidade: "informativa",
    estado: "em_analise",
    detalhe:
      "Situação de compensação registrada aguardando tratamento do RH (exemplo ilustrativo).",
  },
  {
    id: "pendencia-exemplo-5",
    vinculo: "Vínculo V-033",
    dia: "2026-01-09",
    tipo: "importacao_nao_associada",
    severidade: "critica",
    estado: "aberto",
    detalhe:
      "Marcação importada não pôde ser associada a um colaborador cadastrado nesta empresa (exemplo ilustrativo).",
  },
  {
    id: "pendencia-exemplo-6",
    vinculo: "Vínculo V-041",
    dia: "2026-01-02",
    tipo: "batida_ausente",
    severidade: "atencao",
    estado: "resolvido",
    detalhe:
      "Pendência já tratada pelo RH pelos fluxos próprios (exemplo ilustrativo, sem efeito real).",
  },
];
