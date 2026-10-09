/**
 * Dados sintéticos da tela "Relatórios > Exceções de Ponto" (T075).
 *
 * Ilustra, apenas visualmente, o mesmo tipo de pendência já especificado no
 * contrato conceitual da fila "Verificar folhas"
 * (`docs/modules/etapa3-fila-verificar-folhas-contrato-v1.md`) — mas esta
 * tela **não** importa nem chama aquele núcleo: é uma amostra própria, em
 * memória, para um relatório de leitura.
 *
 * Catálogo de tipos espelha o mesmo vocabulário conceitual (marcação
 * ausente, jornada incompleta, marcação fora do horário, compensação
 * pendente, dado de importação não associado). Prioridade e situação são
 * só priorização/registro de leitura — sem efeito de cálculo, bloqueio ou
 * fechamento. O encaminhamento é derivado da situação, puramente
 * informativo: nunca uma ação que muta ponto, saldo, compensação, Folha ou
 * fechamento.
 *
 * Identificadores são abstratos e sintéticos (`Vínculo V-001`), mesma
 * convenção já usada nas telas anteriores — nunca nome, CPF, empresa real,
 * horário exato ou arquivo de importação real.
 */

export type TipoExcecaoPonto =
  | "marcacao_ausente"
  | "jornada_incompleta"
  | "marcacao_fora_horario"
  | "compensacao_pendente"
  | "dado_importacao_nao_associado";

export type PrioridadeExcecao = "baixa" | "media" | "alta";

export type SituacaoExcecao = "aberta" | "em_analise_rh" | "resolvida";

export interface ExcecaoPontoExemplo {
  readonly id: string;
  readonly referenciaTecnica: string;
  readonly periodoReferencia: string;
  readonly vinculoRef: string;
  readonly tipo: TipoExcecaoPonto;
  readonly prioridade: PrioridadeExcecao;
  readonly situacao: SituacaoExcecao;
}

export const ROTULO_TIPO_EXCECAO: Record<TipoExcecaoPonto, string> = {
  marcacao_ausente: "Marcação ausente",
  jornada_incompleta: "Jornada incompleta",
  marcacao_fora_horario: "Marcação fora do horário",
  compensacao_pendente: "Compensação pendente",
  dado_importacao_nao_associado: "Dado de importação não associado",
};

export const ROTULO_PRIORIDADE_EXCECAO: Record<PrioridadeExcecao, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const ROTULO_SITUACAO_EXCECAO: Record<SituacaoExcecao, string> = {
  aberta: "Aberta",
  em_analise_rh: "Em análise do RH",
  resolvida: "Resolvida",
};

/** Encaminhamento é só um rótulo de leitura derivado da situação — nunca uma
 * ação que muta ponto, saldo, compensação, Folha ou fechamento. */
export const ROTULO_ENCAMINHAMENTO_POR_SITUACAO: Record<
  SituacaoExcecao,
  string
> = {
  aberta: "Aguardando revisão do RH (exemplo)",
  em_analise_rh: "Em análise pelo RH da própria empresa (exemplo)",
  resolvida: "Revisão concluída, sem alteração automática (exemplo)",
};

export const EXCECOES_PONTO_EXEMPLO: readonly ExcecaoPontoExemplo[] = [
  {
    id: "excecao-exemplo-1",
    referenciaTecnica: "EXC-2026-0001",
    periodoReferencia: "2026-08-11",
    vinculoRef: "Vínculo V-001",
    tipo: "marcacao_ausente",
    prioridade: "alta",
    situacao: "aberta",
  },
  {
    id: "excecao-exemplo-2",
    referenciaTecnica: "EXC-2026-0002",
    periodoReferencia: "2026-08-12",
    vinculoRef: "Vínculo V-014",
    tipo: "jornada_incompleta",
    prioridade: "media",
    situacao: "em_analise_rh",
  },
  {
    id: "excecao-exemplo-3",
    referenciaTecnica: "EXC-2026-0003",
    periodoReferencia: "2026-08-13",
    vinculoRef: "Vínculo V-007",
    tipo: "marcacao_fora_horario",
    prioridade: "baixa",
    situacao: "resolvida",
  },
  {
    id: "excecao-exemplo-4",
    referenciaTecnica: "EXC-2026-0004",
    periodoReferencia: "2026-08-14",
    vinculoRef: "Vínculo V-022",
    tipo: "compensacao_pendente",
    prioridade: "media",
    situacao: "em_analise_rh",
  },
  {
    id: "excecao-exemplo-5",
    referenciaTecnica: "EXC-2026-0005",
    periodoReferencia: "2026-08-15",
    vinculoRef: "Vínculo V-031",
    tipo: "dado_importacao_nao_associado",
    prioridade: "alta",
    situacao: "aberta",
  },
  {
    id: "excecao-exemplo-6",
    referenciaTecnica: "EXC-2026-0006",
    periodoReferencia: "2026-08-16",
    vinculoRef: "Vínculo V-001",
    tipo: "marcacao_ausente",
    prioridade: "baixa",
    situacao: "resolvida",
  },
];
