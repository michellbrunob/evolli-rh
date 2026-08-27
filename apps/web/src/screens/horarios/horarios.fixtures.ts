/**
 * Dados sintéticos da tela "Cadastros > Horários" (T043).
 *
 * Tudo aqui é fictício e inventado apenas para preencher a tela visual: nomes
 * de tabela, faixas de horário e datas de vigência não reproduzem nenhuma
 * empresa, colaborador ou horário observado em sistema externo (ver
 * `docs/modules/etapa3-jornada-ponto-v1-detalhada.md`, §9 — catálogo
 * observado, deliberadamente NÃO reutilizado aqui). Puramente apresentação:
 * sem chamada de rede, sem persistência.
 */

export const DIAS_ABREV = [
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sab",
  "Dom",
] as const;

export type DiaAbrev = (typeof DIAS_ABREV)[number];

export type SituacaoTabelaHorario = "ativa" | "inativa";

/** Uma faixa de trabalho de um dia (ex.: manhã ou tarde, com intervalo). */
export interface FaixaHorarioExemplo {
  dia: DiaAbrev;
  entrada: string;
  saida: string;
}

export interface TabelaHorarioExemplo {
  id: string;
  nome: string;
  situacao: SituacaoTabelaHorario;
  faixas: FaixaHorarioExemplo[];
  vigenciaInicio: string;
  vigenciaFim?: string;
}

/**
 * Três tabelas fictícias, cobrindo os três estados de situação/vigência mais
 * relevantes para a tela: ativa e vigente, ativa sem faixa aos finais de
 * semana, e inativa (histórico).
 */
export const TABELAS_HORARIO_EXEMPLO: TabelaHorarioExemplo[] = [
  {
    id: "tabela-exemplo-1",
    nome: "Tabela Administrativo (exemplo)",
    situacao: "ativa",
    faixas: [
      { dia: "Seg", entrada: "09:00", saida: "12:00" },
      { dia: "Seg", entrada: "13:00", saida: "18:00" },
      { dia: "Ter", entrada: "09:00", saida: "12:00" },
      { dia: "Ter", entrada: "13:00", saida: "18:00" },
      { dia: "Qua", entrada: "09:00", saida: "12:00" },
      { dia: "Qua", entrada: "13:00", saida: "18:00" },
      { dia: "Qui", entrada: "09:00", saida: "12:00" },
      { dia: "Qui", entrada: "13:00", saida: "18:00" },
      { dia: "Sex", entrada: "09:00", saida: "12:00" },
      { dia: "Sex", entrada: "13:00", saida: "17:00" },
    ],
    vigenciaInicio: "2026-01-01",
  },
  {
    id: "tabela-exemplo-2",
    nome: "Tabela Meio Período (exemplo)",
    situacao: "ativa",
    faixas: [
      { dia: "Seg", entrada: "09:00", saida: "13:00" },
      { dia: "Ter", entrada: "09:00", saida: "13:00" },
      { dia: "Qua", entrada: "09:00", saida: "13:00" },
      { dia: "Qui", entrada: "09:00", saida: "13:00" },
      { dia: "Sex", entrada: "09:00", saida: "13:00" },
    ],
    vigenciaInicio: "2026-03-01",
    vigenciaFim: "2026-12-31",
  },
  {
    id: "tabela-exemplo-3",
    nome: "Tabela Descontinuada (exemplo)",
    situacao: "inativa",
    faixas: [
      { dia: "Seg", entrada: "08:30", saida: "12:30" },
      { dia: "Ter", entrada: "08:30", saida: "12:30" },
      { dia: "Qua", entrada: "08:30", saida: "12:30" },
      { dia: "Qui", entrada: "08:30", saida: "12:30" },
      { dia: "Sex", entrada: "08:30", saida: "12:30" },
    ],
    vigenciaInicio: "2025-01-01",
    vigenciaFim: "2025-12-31",
  },
];

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — só formatação, sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Lista compacta de dias com faixa (ex.: "Seg, Ter, Qua, Qui, Sex"). */
export function listarDiasUteis(
  faixas: readonly FaixaHorarioExemplo[],
): string {
  const ordem = new Map(DIAS_ABREV.map((dia, indice) => [dia, indice]));
  const dias = Array.from(new Set(faixas.map((faixa) => faixa.dia))).sort(
    (a, b) => (ordem.get(a) ?? 0) - (ordem.get(b) ?? 0),
  );
  return dias.join(", ");
}

/**
 * Agrupa faixas por dia e monta um resumo legível, ex.:
 * "Seg: 09:00–12:00 / 13:00–18:00 · Sex: 09:00–12:00 / 13:00–17:00".
 */
export function resumirFaixas(faixas: readonly FaixaHorarioExemplo[]): string {
  const ordem = new Map(DIAS_ABREV.map((dia, indice) => [dia, indice]));
  const dias = Array.from(new Set(faixas.map((faixa) => faixa.dia))).sort(
    (a, b) => (ordem.get(a) ?? 0) - (ordem.get(b) ?? 0),
  );

  return dias
    .map((dia) => {
      const doDia = faixas
        .filter((faixa) => faixa.dia === dia)
        .map((faixa) => `${faixa.entrada}–${faixa.saida}`)
        .join(" / ");
      return `${dia}: ${doDia}`;
    })
    .join(" · ");
}

/** Formata o período de vigência para exibição na listagem. */
export function formatarVigencia(tabela: TabelaHorarioExemplo): string {
  const inicio = formatarDataBr(tabela.vigenciaInicio);
  if (!tabela.vigenciaFim) {
    return `${inicio} – vigente`;
  }
  return `${inicio} – ${formatarDataBr(tabela.vigenciaFim)}`;
}
