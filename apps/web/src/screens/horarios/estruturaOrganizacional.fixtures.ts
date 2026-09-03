/**
 * Dados sintéticos da tela "Cadastros > Estrutura organizacional" (T073).
 *
 * Visão administrativa demonstrativa que organiza o ecossistema para as
 * futuras relações entre empresas, unidades, departamentos e centros de
 * custo — não é o backend real nem o chama. Todo dado é sintético e
 * independente do catálogo de `horarios.fixtures.ts` (T043).
 *
 * Hierarquia ilustrada: Empresa → Unidade → Departamento → Centro de custo.
 * Identificadores continuam abstratos e sintéticos (referência técnica
 * `EST-2026-000X`), mesma convenção já usada nas telas anteriores — nunca
 * razão social, CNPJ, endereço, documento ou nome de pessoa. "Responsável
 * técnico" é um identificador abstrato de equipe/papel, nunca nome real.
 */

export type TipoEstrutura =
  "empresa" | "unidade" | "departamento" | "centro_custo";

export type SituacaoEstrutura = "ativa" | "inativa";

export interface ItemEstruturaExemplo {
  readonly id: string;
  readonly referenciaTecnica: string;
  readonly tipo: TipoEstrutura;
  readonly nome: string;
  readonly vinculoSuperior?: string;
  readonly situacao: SituacaoEstrutura;
  readonly responsavelTecnico: string;
}

export const ROTULO_TIPO_ESTRUTURA: Record<TipoEstrutura, string> = {
  empresa: "Empresa",
  unidade: "Unidade",
  departamento: "Departamento",
  centro_custo: "Centro de custo",
};

export const ROTULO_SITUACAO_ESTRUTURA: Record<SituacaoEstrutura, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
};

/** Ordem hierárquica ilustrativa: Empresa → Unidade → Departamento → Centro de custo. */
export const HIERARQUIA_TIPOS: readonly TipoEstrutura[] = [
  "empresa",
  "unidade",
  "departamento",
  "centro_custo",
];

export const ITENS_ESTRUTURA_EXEMPLO: readonly ItemEstruturaExemplo[] = [
  {
    id: "estrutura-exemplo-1",
    referenciaTecnica: "EST-2026-0001",
    tipo: "empresa",
    nome: "Empresa Matriz (exemplo)",
    situacao: "ativa",
    responsavelTecnico: "RT-Estrutura-01 (exemplo)",
  },
  {
    id: "estrutura-exemplo-2",
    referenciaTecnica: "EST-2026-0002",
    tipo: "unidade",
    nome: "Unidade Sede (exemplo)",
    vinculoSuperior: "EST-2026-0001",
    situacao: "ativa",
    responsavelTecnico: "RT-Estrutura-01 (exemplo)",
  },
  {
    id: "estrutura-exemplo-3",
    referenciaTecnica: "EST-2026-0003",
    tipo: "departamento",
    nome: "Operações (exemplo)",
    vinculoSuperior: "EST-2026-0002",
    situacao: "ativa",
    responsavelTecnico: "RT-Estrutura-02 (exemplo)",
  },
  {
    id: "estrutura-exemplo-4",
    referenciaTecnica: "EST-2026-0004",
    tipo: "centro_custo",
    nome: "Centro de Custo Operações Sede (exemplo)",
    vinculoSuperior: "EST-2026-0003",
    situacao: "ativa",
    responsavelTecnico: "RT-Estrutura-02 (exemplo)",
  },
  {
    id: "estrutura-exemplo-5",
    referenciaTecnica: "EST-2026-0005",
    tipo: "departamento",
    nome: "Administrativo (exemplo)",
    vinculoSuperior: "EST-2026-0002",
    situacao: "inativa",
    responsavelTecnico: "RT-Estrutura-03 (exemplo)",
  },
];
