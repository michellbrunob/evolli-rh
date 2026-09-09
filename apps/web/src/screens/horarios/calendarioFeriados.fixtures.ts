/**
 * Dados sintéticos da tela "Cadastros > Calendário de feriados" (T076).
 *
 * Visão administrativa demonstrativa que organiza referências de feriados
 * por escopo (nacional, estadual, municipal, data móvel da empresa) — apenas
 * para consulta e organização visual, nunca para cálculo de jornada, escala,
 * dias úteis, Banco de Horas ou Folha.
 *
 * Datas são ilustrativas e deliberadamente distintas de qualquer feriado
 * oficial brasileiro (nunca 1º de janeiro, Carnaval, Sexta-feira Santa, 21 de
 * abril, 1º de maio, Corpus Christi, 7 de setembro, 12 de outubro, 2 de
 * novembro, 15 de novembro ou 25 de dezembro) — nunca nome de cidade, estado,
 * empresa ou pessoa real. "Responsável técnico" é um identificador abstrato
 * de equipe/papel, nunca nome real.
 */

export type EscopoFeriado =
  "nacional" | "estadual" | "municipal" | "data_movel_empresa";

export type SituacaoFeriado = "ativa" | "inativa" | "pendente_validacao";

export interface FeriadoExemplo {
  readonly id: string;
  readonly referenciaTecnica: string;
  readonly anoIlustrativo: number;
  readonly dataIlustrativa: string;
  readonly descricaoSintetica: string;
  readonly escopo: EscopoFeriado;
  readonly abrangenciaTecnica: string;
  readonly situacao: SituacaoFeriado;
  readonly responsavelTecnico: string;
}

export const ROTULO_ESCOPO_FERIADO: Record<EscopoFeriado, string> = {
  nacional: "Nacional",
  estadual: "Estadual",
  municipal: "Municipal",
  data_movel_empresa: "Data móvel da empresa",
};

export const ROTULO_SITUACAO_FERIADO: Record<SituacaoFeriado, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  pendente_validacao: "Pendente de validação",
};

/** Anos ilustrativos disponíveis para o filtro — só rótulo, sem calendário
 * real associado. */
export const ANOS_ILUSTRATIVOS_DISPONIVEIS: readonly number[] = [2025, 2026];

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — só formatação, sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export const FERIADOS_EXEMPLO: readonly FeriadoExemplo[] = [
  {
    id: "feriado-exemplo-1",
    referenciaTecnica: "FER-2026-0001",
    anoIlustrativo: 2026,
    dataIlustrativa: "2026-02-18",
    descricaoSintetica: "Feriado nacional (exemplo)",
    escopo: "nacional",
    abrangenciaTecnica: "Abrangência nacional (exemplo)",
    situacao: "ativa",
    responsavelTecnico: "RT-Feriados-01 (exemplo)",
  },
  {
    id: "feriado-exemplo-2",
    referenciaTecnica: "FER-2026-0002",
    anoIlustrativo: 2026,
    dataIlustrativa: "2026-03-10",
    descricaoSintetica: "Feriado estadual (exemplo)",
    escopo: "estadual",
    abrangenciaTecnica: "Abrangência estadual (exemplo)",
    situacao: "pendente_validacao",
    responsavelTecnico: "RT-Feriados-02 (exemplo)",
  },
  {
    id: "feriado-exemplo-3",
    referenciaTecnica: "FER-2026-0003",
    anoIlustrativo: 2026,
    dataIlustrativa: "2026-05-22",
    descricaoSintetica: "Feriado municipal (exemplo)",
    escopo: "municipal",
    abrangenciaTecnica: "Abrangência municipal (exemplo)",
    situacao: "inativa",
    responsavelTecnico: "RT-Feriados-03 (exemplo)",
  },
  {
    id: "feriado-exemplo-4",
    referenciaTecnica: "FER-2026-0004",
    anoIlustrativo: 2026,
    dataIlustrativa: "2026-06-05",
    descricaoSintetica: "Data móvel da empresa (exemplo)",
    escopo: "data_movel_empresa",
    abrangenciaTecnica: "Unidade específica (exemplo)",
    situacao: "pendente_validacao",
    responsavelTecnico: "RT-Feriados-01 (exemplo)",
  },
  {
    id: "feriado-exemplo-5",
    referenciaTecnica: "FER-2025-0001",
    anoIlustrativo: 2025,
    dataIlustrativa: "2025-08-14",
    descricaoSintetica: "Feriado nacional (exemplo)",
    escopo: "nacional",
    abrangenciaTecnica: "Abrangência nacional (exemplo)",
    situacao: "inativa",
    responsavelTecnico: "RT-Feriados-02 (exemplo)",
  },
  {
    id: "feriado-exemplo-6",
    referenciaTecnica: "FER-2025-0002",
    anoIlustrativo: 2025,
    dataIlustrativa: "2025-09-30",
    descricaoSintetica: "Feriado estadual (exemplo)",
    escopo: "estadual",
    abrangenciaTecnica: "Abrangência estadual (exemplo)",
    situacao: "ativa",
    responsavelTecnico: "RT-Feriados-03 (exemplo)",
  },
  {
    id: "feriado-exemplo-7",
    referenciaTecnica: "FER-2026-0005",
    anoIlustrativo: 2026,
    dataIlustrativa: "2026-10-08",
    descricaoSintetica: "Feriado municipal (exemplo)",
    escopo: "municipal",
    abrangenciaTecnica: "Abrangência municipal (exemplo)",
    situacao: "ativa",
    responsavelTecnico: "RT-Feriados-01 (exemplo)",
  },
];
