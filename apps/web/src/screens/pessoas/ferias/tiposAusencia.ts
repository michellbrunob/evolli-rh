/**
 * T215 — Férias e ausências: os tipos que a tela usa (o mesmo contrato do
 * servidor, `GET/POST /v1/ausencias`) e os rótulos, iguais aos da
 * referência funcional (decisão de 2026-11-23).
 *
 * A tela recebe as chamadas ao servidor por parâmetro (`ServicoDeAusencias`):
 * o shell liga o cliente real; os testes, um falso.
 */

export type TipoAusencia =
  | "ferias"
  | "licenca_medica"
  | "licenca_maternidade"
  | "licenca_paternidade"
  | "afastamento"
  | "falta_justificada"
  | "falta_sem_justificativa"
  | "day_off"
  | "home_office";

export type MotivoAfastamento =
  | "auxilio_doenca"
  | "acidente_trabalho"
  | "licenca_nao_remunerada"
  | "licenca_remunerada"
  | "outro";

export type StatusAusencia =
  | "aguardando_gestor"
  | "aguardando_rh"
  | "aprovada"
  | "cancelamento_pedido"
  | "ajuste_sugerido"
  | "recusada"
  | "cancelada";

export type FiltroPeriodo =
  | "em_ferias_agora"
  | "licencas_afastamentos"
  | "faltas_mes"
  | "proximas_ferias";

export type FiltroTipo =
  "ferias" | "licencas" | "afastamentos" | "faltas" | "day_off" | "home_office";

export type FiltroStatus = StatusAusencia | "aguardando_voce";

export interface AusenciaApi {
  readonly id: string;
  readonly colaborador: {
    readonly id: string;
    readonly nome: string;
    readonly cargo: string | null;
    readonly foto?: { readonly versao: number } | null;
  };
  readonly tipo: TipoAusencia;
  readonly motivoAfastamento: MotivoAfastamento | null;
  readonly inicio: string;
  readonly fim: string | null;
  readonly dias: number | null;
  readonly diasUteis: number | null;
  readonly diasVendidos: number;
  readonly periodoAquisitivo: {
    readonly inicio: string;
    readonly fim: string;
  } | null;
  readonly status: StatusAusencia;
  readonly observacao: string | null;
  readonly registradoEm: string;
  readonly decididoEm: string | null;
  /** T215 — o atestado ou documento anexado (ausente em dados antigos). */
  readonly anexo?: {
    readonly formato: string;
    readonly tamanhoBytes: number;
    readonly enviadoEm: string;
  } | null;
}

export interface IndicadoresDeAusencias {
  readonly emFeriasAgora: number;
  readonly licencasEAfastamentos: number;
  readonly faltasEsteMes: number;
  readonly proximasFerias: number;
  readonly pendentes: number;
}

export interface ListagemDeAusencias {
  readonly itens: readonly AusenciaApi[];
  readonly pagina: number;
  readonly tamanhoPagina: number;
  readonly total: number;
  readonly indicadores: IndicadoresDeAusencias;
}

export interface ConsultaDeAusencias {
  readonly pagina: number;
  readonly tamanhoPagina: number;
  readonly busca?: string;
  readonly periodo?: FiltroPeriodo;
  readonly tipo?: FiltroTipo;
  readonly status?: FiltroStatus;
}

export interface NovaAusencia {
  readonly colaboradorId: string;
  readonly tipo: TipoAusencia;
  readonly motivoAfastamento?: MotivoAfastamento;
  readonly inicio: string;
  readonly fim?: string;
  readonly diasVendidos?: number;
  readonly periodoAquisitivoInicio?: string;
  readonly aprovada: boolean;
  readonly observacao?: string;
}

export interface SimulacaoDeAusencia {
  readonly dias: number | null;
  readonly diasUteis: number | null;
  readonly volta: string | null;
  readonly periodo: { readonly inicio: string; readonly fim: string } | null;
  readonly saldoAntes: number | null;
  readonly saldoDepois: number | null;
  readonly maxVendaveis: number | null;
  readonly prazoAbono: string | null;
  /**
   * T215 — a regra de férias do vínculo: calculada (CLT, Estágio),
   * sem_ferias (PJ, Freelancer) ou sem_regra (Aprendiz e demais).
   */
  readonly regraDeFerias?: "calculada" | "sem_ferias" | "sem_regra";
}

export interface ConsultaDeSimulacao {
  readonly colaboradorId: string;
  readonly tipo: TipoAusencia;
  readonly inicio: string;
  readonly fim?: string;
  readonly diasVendidos?: number;
  readonly periodoAquisitivoInicio?: string;
}

/** Pessoa que pode ser escolhida na gaveta. */
export interface PessoaParaAusencia {
  readonly id: string;
  readonly nome: string;
  readonly cargo: string | null;
}

/** As chamadas ao servidor que a aba usa. */
export interface ServicoDeAusencias {
  readonly listar: (
    consulta: ConsultaDeAusencias,
    opcoes?: { readonly signal?: AbortSignal },
  ) => Promise<ListagemDeAusencias>;
  readonly registrar: (nova: NovaAusencia) => Promise<AusenciaApi>;
  readonly simular: (
    consulta: ConsultaDeSimulacao,
    opcoes?: { readonly signal?: AbortSignal },
  ) => Promise<SimulacaoDeAusencia>;
  readonly aprovar: (id: string) => Promise<AusenciaApi>;
  readonly recusar: (id: string, motivo?: string) => Promise<AusenciaApi>;
  readonly cancelar: (id: string) => Promise<AusenciaApi>;
  readonly buscarPessoas: (
    termo: string,
    opcoes?: { readonly signal?: AbortSignal },
  ) => Promise<readonly PessoaParaAusencia[]>;
  /** T215 — anexo (atestado ou documento) da ausência. */
  readonly enviarAnexo?: (ausenciaId: string, arquivo: File) => Promise<void>;
  readonly removerAnexo?: (ausenciaId: string) => Promise<void>;
  readonly baixarAnexo?: (
    ausenciaId: string,
  ) => Promise<{ readonly blob: Blob; readonly nome: string }>;
}

export const ROTULO_DO_TIPO: Readonly<Record<TipoAusencia, string>> = {
  ferias: "Férias",
  licenca_medica: "Licença médica",
  licenca_maternidade: "Licença maternidade",
  licenca_paternidade: "Licença paternidade",
  afastamento: "Afastamento",
  falta_justificada: "Falta justificada",
  falta_sem_justificativa: "Falta sem justificativa",
  day_off: "Day off",
  home_office: "Home office",
};

/** "19 dias de licença médica": o tipo em minúsculas, no meio da frase. */
export const TIPO_NA_FRASE: Readonly<Record<TipoAusencia, string>> = {
  ferias: "férias",
  licenca_medica: "licença médica",
  licenca_maternidade: "licença maternidade",
  licenca_paternidade: "licença paternidade",
  afastamento: "afastamento",
  falta_justificada: "falta justificada",
  falta_sem_justificativa: "falta sem justificativa",
  day_off: "day off",
  home_office: "home office",
};

export const TIPOS_DE_AUSENCIA = Object.keys(ROTULO_DO_TIPO) as TipoAusencia[];

export const MOTIVOS_DE_AFASTAMENTO: readonly {
  readonly valor: MotivoAfastamento;
  readonly rotulo: string;
  readonly ajuda: string;
}[] = [
  {
    valor: "auxilio_doenca",
    rotulo: "Auxílio-doença (INSS)",
    ajuda: "Doença, a partir do 16º dia de atestado",
  },
  {
    valor: "acidente_trabalho",
    rotulo: "Acidente de trabalho",
    ajuda: "Acidente ou doença ligada ao trabalho",
  },
  {
    valor: "licenca_nao_remunerada",
    rotulo: "Licença não remunerada",
    ajuda: "Contrato suspenso, sem salário",
  },
  {
    valor: "licenca_remunerada",
    rotulo: "Licença remunerada",
    ajuda: "A empresa continua pagando o salário",
  },
  {
    valor: "outro",
    rotulo: "Outro motivo",
    ajuda: "Conte o motivo na observação",
  },
];

export const ROTULO_DO_STATUS: Readonly<Record<StatusAusencia, string>> = {
  aguardando_gestor: "Aguardando o gestor",
  aguardando_rh: "Aguardando o RH",
  aprovada: "Aprovada",
  cancelamento_pedido: "Cancelamento pedido",
  ajuste_sugerido: "Ajuste sugerido",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export const OPCOES_DE_PERIODO: readonly {
  readonly valor: FiltroPeriodo | "";
  readonly rotulo: string;
}[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "em_ferias_agora", rotulo: "Em férias agora" },
  { valor: "licencas_afastamentos", rotulo: "Licenças e afastamentos" },
  { valor: "faltas_mes", rotulo: "Faltas deste mês" },
  { valor: "proximas_ferias", rotulo: "Próximas férias" },
];

export const OPCOES_DE_TIPO: readonly {
  readonly valor: FiltroTipo | "";
  readonly rotulo: string;
}[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "ferias", rotulo: "Férias" },
  { valor: "licencas", rotulo: "Licenças" },
  { valor: "afastamentos", rotulo: "Afastamentos" },
  { valor: "faltas", rotulo: "Faltas" },
  { valor: "day_off", rotulo: "Day off" },
  { valor: "home_office", rotulo: "Home office" },
];

export const OPCOES_DE_STATUS: readonly {
  readonly valor: FiltroStatus | "";
  readonly rotulo: string;
}[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "aguardando_voce", rotulo: "Aguardando você" },
  { valor: "aguardando_gestor", rotulo: "Aguardando o gestor" },
  { valor: "aguardando_rh", rotulo: "Aguardando o RH" },
  { valor: "aprovada", rotulo: "Aprovada" },
  { valor: "cancelamento_pedido", rotulo: "Cancelamento pedido" },
  { valor: "ajuste_sugerido", rotulo: "Ajuste sugerido" },
  { valor: "recusada", rotulo: "Recusada" },
  { valor: "cancelada", rotulo: "Cancelada" },
];
