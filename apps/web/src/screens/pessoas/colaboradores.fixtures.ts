/**
 * Dados sintéticos da tela "Pessoas > Colaboradores" (T072).
 *
 * Visão administrativa demonstrativa que organiza o ecossistema para o
 * futuro cadastro/vínculo de pessoas — não é o backend real nem o chama.
 * Todo dado é sintético e independente do catálogo de
 * `pessoasHorario.fixtures.ts` (T046).
 *
 * Identificadores continuam abstratos e sintéticos (referência técnica
 * `COL-2026-000X`), mesma convenção já usada nas telas anteriores — nunca
 * nome, CPF, empresa real ou documento. Tipo de vínculo usa categorias
 * administrativas genéricas (CLT, PJ, Estágio, Aprendiz), sem qualquer dado
 * pessoal ou sensível por trás. Unidade/departamento é sempre um rótulo de
 * exemplo, nunca uma estrutura organizacional real.
 */

export type SituacaoColaborador = "ativo" | "afastado" | "desligado";

export type TipoVinculoColaborador = "clt" | "pj" | "estagio" | "aprendiz";

export interface ColaboradorExemplo {
  readonly id: string;
  readonly referenciaTecnica: string;
  readonly situacao: SituacaoColaborador;
  readonly tipoVinculo: TipoVinculoColaborador;
  readonly unidade: string;
  readonly vigenciaInicio: string;
  readonly vigenciaFim?: string;
}

export const ROTULO_SITUACAO_COLABORADOR: Record<SituacaoColaborador, string> =
  {
    ativo: "Ativo",
    afastado: "Afastado",
    desligado: "Desligado",
  };

export const ROTULO_TIPO_VINCULO: Record<TipoVinculoColaborador, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  aprendiz: "Aprendiz",
};

/** Unidades/departamentos de exemplo — nunca uma estrutura real. */
export const UNIDADES_EXEMPLO: readonly string[] = [
  "Operações (exemplo)",
  "Administrativo (exemplo)",
  "Comercial (exemplo)",
  "Tecnologia (exemplo)",
];

/** `dd/mm/aaaa` a partir de `AAAA-MM-DD` — só formatação, sem fuso/hora. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Formata o período de vigência para exibição na listagem. */
export function formatarVigenciaColaborador(item: ColaboradorExemplo): string {
  const inicio = formatarDataBr(item.vigenciaInicio);
  if (!item.vigenciaFim) {
    return `${inicio} – vigente`;
  }
  return `${inicio} – ${formatarDataBr(item.vigenciaFim)}`;
}

export const COLABORADORES_EXEMPLO: readonly ColaboradorExemplo[] = [
  {
    id: "colaborador-exemplo-1",
    referenciaTecnica: "COL-2026-0001",
    situacao: "ativo",
    tipoVinculo: "clt",
    unidade: "Operações (exemplo)",
    vigenciaInicio: "2025-03-10",
  },
  {
    id: "colaborador-exemplo-2",
    referenciaTecnica: "COL-2026-0002",
    situacao: "ativo",
    tipoVinculo: "pj",
    unidade: "Tecnologia (exemplo)",
    vigenciaInicio: "2025-08-01",
  },
  {
    id: "colaborador-exemplo-3",
    referenciaTecnica: "COL-2026-0003",
    situacao: "afastado",
    tipoVinculo: "clt",
    unidade: "Administrativo (exemplo)",
    vigenciaInicio: "2024-11-15",
  },
  {
    id: "colaborador-exemplo-4",
    referenciaTecnica: "COL-2026-0004",
    situacao: "desligado",
    tipoVinculo: "estagio",
    unidade: "Comercial (exemplo)",
    vigenciaInicio: "2025-01-05",
    vigenciaFim: "2025-12-20",
  },
  {
    id: "colaborador-exemplo-5",
    referenciaTecnica: "COL-2026-0005",
    situacao: "ativo",
    tipoVinculo: "aprendiz",
    unidade: "Operações (exemplo)",
    vigenciaInicio: "2026-02-01",
  },
];
