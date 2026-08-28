/**
 * Dados sintéticos da tela "Pessoas > Horário de trabalho" (T046).
 *
 * Ilustra a atribuição de tabela de horário ao colaborador com vigência,
 * conforme `docs/modules/etapa3-jornada-ponto-v1-detalhada.md` (§2.4): "o
 * horário é atribuído no cadastro do colaborador... com vigência — uma nova
 * vigência substitui a anterior dali em diante, nunca retroativamente" e
 * "mudanças de horário não podem alterar períodos já apurados". A fundação
 * real desse conceito já existe em `apps/api/src/horarios/vinculo/`
 * (`VinculoHorario`: colaboradorId + tabelaHorarioId + vigência), mas esta
 * tela não a chama — é puramente visual.
 *
 * Identificadores são abstratos e sintéticos (`Vínculo V-001`), a mesma
 * convenção já usada na especificação e nas telas anteriores (T043/T045) —
 * nunca nome, CPF, empresa real ou horário extraído de sistema externo.
 * Puramente apresentação: sem chamada de rede, sem persistência.
 */

export type SituacaoVigencia = "vigente" | "encerrada";

export interface AtribuicaoHorarioExemplo {
  readonly id: string;
  readonly vinculo: string;
  readonly tabelaHorario: string;
  readonly vigenciaInicio: string;
  readonly vigenciaFim?: string;
  readonly situacao: SituacaoVigencia;
}

/** Tabelas de horário disponíveis para atribuição — mesma convenção do T043. */
export const TABELAS_HORARIO_DISPONIVEIS: readonly string[] = [
  "Tabela Administrativo (exemplo)",
  "Tabela Meio Período (exemplo)",
  "Tabela Comercial (exemplo)",
];

export const ROTULO_SITUACAO: Record<SituacaoVigencia, string> = {
  vigente: "Vigente",
  encerrada: "Encerrada",
};

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — só formatação, sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Formata o período de vigência para exibição na listagem. */
export function formatarVigencia(item: AtribuicaoHorarioExemplo): string {
  const inicio = formatarDataBr(item.vigenciaInicio);
  if (!item.vigenciaFim) {
    return `${inicio} – vigente`;
  }
  return `${inicio} – ${formatarDataBr(item.vigenciaFim)}`;
}

export const ATRIBUICOES_EXEMPLO: readonly AtribuicaoHorarioExemplo[] = [
  {
    id: "atribuicao-exemplo-1",
    vinculo: "Vínculo V-001",
    tabelaHorario: "Tabela Administrativo (exemplo)",
    vigenciaInicio: "2026-01-01",
    situacao: "vigente",
  },
  {
    id: "atribuicao-exemplo-2",
    vinculo: "Vínculo V-014",
    tabelaHorario: "Tabela Meio Período (exemplo)",
    vigenciaInicio: "2026-03-01",
    situacao: "vigente",
  },
  {
    id: "atribuicao-exemplo-3",
    vinculo: "Vínculo V-007",
    tabelaHorario: "Tabela Administrativo (exemplo)",
    vigenciaInicio: "2025-01-01",
    vigenciaFim: "2025-12-31",
    situacao: "encerrada",
  },
  {
    id: "atribuicao-exemplo-4",
    vinculo: "Vínculo V-022",
    tabelaHorario: "Tabela Comercial (exemplo)",
    vigenciaInicio: "2026-02-01",
    situacao: "vigente",
  },
];
