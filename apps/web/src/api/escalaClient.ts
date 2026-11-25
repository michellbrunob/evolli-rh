import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import { ApiError } from "./colaboradoresClient";

const BASE = "/v1";

/**
 * T215 — Escala do colaborador (aba Escala da ficha): o padrão de escala
 * com vigência `[início, fim)`. Dias da semana de 1 (segunda) a 7
 * (domingo); datas em dia civil `AAAA-MM-DD`.
 */
export interface TurnoDaEscalaApi {
  id: string;
  codigo: string | null;
  nome: string;
  ativo: boolean;
  periodos: { dia: string; inicio: string; fim: string }[];
  /** Intervalo do turno de um período corrido (minutos). */
  intervaloMinutos?: number;
  cor?: string | null;
  sigla?: string | null;
}

export interface EscalaApi {
  id: string;
  modelo: string;
  /** `null` = sem turno fixo. */
  turno: TurnoDaEscalaApi | null;
  /** Só no 12x36: mês sim, mês não, os plantões usam este turno. */
  turnoNoite: TurnoDaEscalaApi | null;
  /** Só no 6x1. */
  folgaSemanal: number | null;
  /** Só em "outra". */
  diasTrabalho: number[];
  /** Revezamento, plantão e embarque. */
  inicioCiclo: string | null;
  vigenciaInicio: string;
  /** O primeiro dia SEM a escala; `null` = aberta. */
  vigenciaFim: string | null;
  /** Quando o padrão foi definido (ISO) e por quem (nome de exibição). */
  definidaEm: string;
  definidaPor: string | null;
}

export interface EscalasDoColaboradorApi {
  colaboradorId: string;
  empresaId: string;
  vinculo: {
    dataAdmissao: string;
    situacao: "previsto" | "ativo" | "encerrado";
  };
  /** A escala do contrato (código do modelo), ou `null`. */
  escalaDoCadastro: string | null;
  /** Da mais nova para a mais antiga. */
  escalas: EscalaApi[];
}

export interface DefinirEscalaDto {
  modelo: string;
  tabelaHorarioId: string | null;
  turnoNoiteId?: string | null;
  folgaSemanal?: number;
  diasTrabalho?: number[];
  inicioCiclo?: string;
  vigenciaInicio: string;
}

const rota = (colaboradorId: string) =>
  `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/escalas`;

async function enviar<T>(
  metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  corpo?: unknown,
): Promise<T> {
  const token = metodo === "GET" ? null : await tokenCsrfParaGravacao();
  const res = await fetch(url, {
    method: metodo,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token !== null ? { "x-csrf-token": token } : {}),
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  if (res.status === 401) clearCsrfToken();
  if (token !== null) await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  return res.json() as Promise<T>;
}

export function consultarEscalas(
  colaboradorId: string,
): Promise<EscalasDoColaboradorApi> {
  return enviar("GET", rota(colaboradorId));
}

/** Define (ou troca) o padrão; devolve a lista inteira. */
export function definirEscala(
  colaboradorId: string,
  dto: DefinirEscalaDto,
): Promise<EscalasDoColaboradorApi> {
  return enviar("POST", rota(colaboradorId), dto);
}

/** `vigenciaFim` é o PRIMEIRO dia sem a escala. */
export function encerrarEscala(
  colaboradorId: string,
  escalaId: string,
  vigenciaFim: string,
): Promise<EscalasDoColaboradorApi> {
  return enviar(
    "POST",
    `${rota(colaboradorId)}/${encodeURIComponent(escalaId)}/encerrar`,
    { vigenciaFim },
  );
}

/**
 * T215 — o quadro "Escala de trabalho" (semana ou mês) da empresa ativa: as
 * pessoas com vínculo no período, a lotação vigente, o gestor, a jornada do
 * contrato e os padrões que tocam o período.
 */
export interface ReferenciaDoQuadroApi {
  id: string;
  nome: string;
}

/**
 * T215 — ausência aprovada que toca o período (Férias e ausências). Ausência
 * vence o turno: o dia é dela e só muda em Férias e ausências.
 */
export interface AusenciaNoQuadroApi {
  id: string;
  tipo:
    | "ferias"
    | "licenca_medica"
    | "licenca_maternidade"
    | "licenca_paternidade"
    | "afastamento"
    | "falta_justificada"
    | "falta_sem_justificativa"
    | "day_off"
    | "home_office";
  motivoAfastamento: string | null;
  inicio: string;
  /** `null`: afastamento sem data de volta. */
  fim: string | null;
}

export interface PessoaDoQuadroApi {
  colaboradorId: string;
  nome: string;
  tipoVinculo: string;
  situacao: "previsto" | "ativo" | "encerrado";
  dataAdmissao: string;
  /** O último dia do vínculo, ou `null`. */
  dataDesligamento: string | null;
  departamento: ReferenciaDoQuadroApi | null;
  unidade: ReferenciaDoQuadroApi | null;
  cargo: ReferenciaDoQuadroApi | null;
  area: ReferenciaDoQuadroApi | null;
  centroCusto: ReferenciaDoQuadroApi | null;
  gestor: ReferenciaDoQuadroApi | null;
  /** Nível de carreira do contrato (código), ou `null`. */
  nivel: string | null;
  /** Gênero do perfil pessoal (código), ou `null`. */
  genero: string | null;
  escalaDoCadastro: string | null;
  jornadaSemanalHoras: number | null;
  /** Para o aviso de menor de 18 anos em turno noturno. */
  dataNascimento?: string | null;
  /** Do mais novo ao mais antigo. */
  escalas: EscalaApi[];
  /** Os dias gravados no período (rascunho e publicado). */
  dias: DiaGravadoApi[];
  /** As ausências aprovadas que tocam o período (ausente: nenhuma). */
  ausencias?: AusenciaNoQuadroApi[];
}

/** "HH:MM"; o fim antes do início termina no dia seguinte. */
export interface PeriodoDoDiaApi {
  inicio: string;
  fim: string;
}

export type TipoDoDia = "trabalho" | "folga" | "dsr" | "sobreaviso";

/** T215 — um dia gravado à mão no quadro, por cima do padrão. */
export interface DiaGravadoApi {
  dia: string;
  camada: "rascunho" | "publicado";
  tipo: TipoDoDia;
  turno: {
    id: string;
    nome: string;
    cor: string | null;
    sigla: string | null;
  } | null;
  periodos: PeriodoDoDiaApi[];
  intervaloMinutos: number;
  sobreaviso: PeriodoDoDiaApi[];
  unidade: { id: string; nome: string } | null;
  observacao: string | null;
}

export interface GravarDiaDto {
  colaboradorId: string;
  dia: string;
  tipo: TipoDoDia;
  tabelaHorarioId?: string | null;
  periodos?: PeriodoDoDiaApi[];
  intervaloMinutos?: number;
  sobreaviso?: PeriodoDoDiaApi[];
  unidadeOrganizacionalId?: string | null;
  observacao?: string | null;
}

/** Grava o dia no rascunho; devolve o dia gravado. */
export function gravarDia(dto: GravarDiaDto): Promise<DiaGravadoApi> {
  return enviar("PUT", `${BASE}/escala/dias`, dto);
}

/**
 * Quantos dias vão por envio: o servidor aceita até 500, e o corpo JSON tem
 * limite de 100 kB (100 dias cabem mesmo com observação de 300 caracteres).
 */
const DIAS_POR_ENVIO = 100;

const ROTA_DO_LOTE = `${BASE}/escala/dias/lote`;
const ROTA_DE_LIMPAR_LOTE = `${BASE}/escala/dias/limpar-lote`;

/**
 * T215 — grava vários dias no rascunho (ações em massa); em envios de até
 * cem dias, cada envio tudo ou nada. Devolve os dias gravados.
 */
export async function gravarDias(
  dias: readonly GravarDiaDto[],
): Promise<(DiaGravadoApi & { colaboradorId: string })[]> {
  const gravados: (DiaGravadoApi & { colaboradorId: string })[] = [];
  for (let i = 0; i < dias.length; i += DIAS_POR_ENVIO) {
    const r = await enviar<{
      dias: (DiaGravadoApi & { colaboradorId: string })[];
    }>("PUT", ROTA_DO_LOTE, {
      dias: dias.slice(i, i + DIAS_POR_ENVIO),
    });
    gravados.push(...r.dias);
  }
  return gravados;
}

/** T215 — desfaz a mudança de vários dias no rascunho (em envios de cem). */
export async function limparDias(
  dias: readonly { colaboradorId: string; dia: string }[],
): Promise<number> {
  let limpos = 0;
  for (let i = 0; i < dias.length; i += DIAS_POR_ENVIO) {
    const r = await enviar<{ dias: { limpo: boolean }[] }>(
      "POST",
      ROTA_DE_LIMPAR_LOTE,
      { dias: dias.slice(i, i + DIAS_POR_ENVIO) },
    );
    limpos += r.dias.filter((d) => d.limpo).length;
  }
  return limpos;
}

/** Desfaz a mudança do dia no rascunho (volta ao padrão). */
export function limparDia(
  colaboradorId: string,
  dia: string,
): Promise<{ colaboradorId: string; dia: string; limpo: boolean }> {
  return enviar("POST", `${BASE}/escala/dias/limpar`, { colaboradorId, dia });
}

/** T215 — uma publicação do quadro ("Publicada em 25/11 por Ana"). */
export interface PublicacaoDaEscalaApi {
  id: string;
  inicio: string;
  fim: string;
  novas: number;
  alteradas: number;
  pessoas: number;
  avisar: boolean;
  /** Instante ISO. */
  publicadaEm: string;
  publicadaPor: string | null;
}

/** Publica todo o rascunho do período; devolve a publicação. */
export function publicarEscala(
  inicio: string,
  fim: string,
  avisar: boolean,
): Promise<PublicacaoDaEscalaApi> {
  return enviar("POST", `${BASE}/escala/publicar`, { inicio, fim, avisar });
}

export interface QuadroDaEscalaApi {
  empresaId: string;
  inicio: string;
  fim: string;
  /** A publicação mais recente que toca o período, ou `null`. */
  publicacao?: PublicacaoDaEscalaApi | null;
  /** As Regras da escala (avisos, convenção, transição, feriados locais). */
  regras?: RegrasDaEscalaApi;
  pessoas: PessoaDoQuadroApi[];
}

/** `inicio` e `fim` contam; até 42 dias. */
export function consultarQuadro(
  inicio: string,
  fim: string,
): Promise<QuadroDaEscalaApi> {
  const q = new URLSearchParams({ inicio, fim });
  return enviar("GET", `${BASE}/escala/quadro?${q.toString()}`);
}

/** T215 — o que a convenção ou o acordo coletivo permite. */
export const CHAVES_DA_CONVENCAO = [
  "6x1_autorizada",
  "jornada_ampliada",
  "12x36_acordo",
  "revezamento_8h",
  "intervalo_30min",
  "comercio",
  "feriado_convencao",
  "portaria_1316",
] as const;
export type ChaveDaConvencao = (typeof CHAVES_DA_CONVENCAO)[number];

/** T215 — os avisos da CLT que as Regras ligam ou desligam. */
export const CHAVES_DOS_AVISOS = [
  "interjornada",
  "dois_descansos",
  "seis_dias",
  "dez_horas",
  "jornada_semanal",
  "revezamento",
  "intervalo",
  "sobrepostos",
  "plantao_descanso",
  "ausencia",
  "domingo",
  "feriado_comercio",
  "feriado",
  "6x1_transicao",
  "aprendiz_estagio",
  "menor_noturno",
  "tempo_parcial",
  "intermitente",
  "noturno",
  "sobreaviso",
  "12x36_2027",
] as const;
export type ChaveDoAviso = (typeof CHAVES_DOS_AVISOS)[number];

export interface FeriadoLocalApi {
  id: string;
  data: string;
  nome: string;
  tipo: "municipal" | "ponto_facultativo";
  /** Vazio = todas as unidades. */
  unidadeIds: string[];
}

export interface RegrasDaEscalaApi {
  personalizadas: boolean;
  inicioTransicao: string;
  semanaComeca: number;
  convencao: Record<ChaveDaConvencao, boolean>;
  avisos: Record<ChaveDoAviso, boolean>;
  antecedenciaDias: number;
  avisarPadrao: boolean;
  feriados: FeriadoLocalApi[];
}

export type SalvarRegrasDto = Omit<
  RegrasDaEscalaApi,
  "personalizadas" | "feriados" | "inicioTransicao"
> & { inicioTransicao: string | null };

const ROTA_DAS_REGRAS = `${BASE}/escala/regras`;
const ROTA_DOS_FERIADOS = `${BASE}/escala/feriados`;

export function consultarRegras(): Promise<RegrasDaEscalaApi> {
  return enviar("GET", ROTA_DAS_REGRAS);
}

export function salvarRegras(dto: SalvarRegrasDto): Promise<RegrasDaEscalaApi> {
  return enviar("PUT", ROTA_DAS_REGRAS, dto);
}

export function criarFeriadoLocal(dto: {
  data: string;
  nome: string;
  tipo: FeriadoLocalApi["tipo"];
  unidadeIds: string[];
}): Promise<RegrasDaEscalaApi> {
  return enviar("POST", ROTA_DOS_FERIADOS, dto);
}

export function removerFeriadoLocal(id: string): Promise<RegrasDaEscalaApi> {
  return enviar("DELETE", `${ROTA_DOS_FERIADOS}/${encodeURIComponent(id)}`);
}

/**
 * T215 — Visões salvas do quadro: os filtros com um nome, só da conta e da
 * empresa ativa. Toda resposta traz a lista inteira, em ordem de nome.
 */
export interface FiltrosDaVisaoApi {
  comAviso: boolean;
  semEscala: boolean;
  mudancas: boolean;
  ausentes: boolean;
  unidades: readonly string[];
  departamentos: readonly string[];
  tipos: readonly string[];
  turnos: readonly string[];
  gestores: readonly string[];
  cargos: readonly string[];
  areas: readonly string[];
  centrosCusto: readonly string[];
  niveis: readonly string[];
  generos: readonly string[];
}

export interface VisaoDoQuadroApi {
  id: string;
  nome: string;
  filtros: FiltrosDaVisaoApi;
}

export interface VisoesDoQuadroApi {
  visoes: VisaoDoQuadroApi[];
}

const ROTA_DAS_VISOES = `${BASE}/escala/visoes`;
const rotaDaVisao = (id: string) =>
  `${ROTA_DAS_VISOES}/${encodeURIComponent(id)}`;

export function consultarVisoes(): Promise<VisoesDoQuadroApi> {
  return enviar("GET", ROTA_DAS_VISOES);
}

export function criarVisao(dto: {
  nome: string;
  filtros: FiltrosDaVisaoApi;
}): Promise<VisoesDoQuadroApi> {
  return enviar("POST", ROTA_DAS_VISOES, dto);
}

export function renomearVisao(
  id: string,
  nome: string,
): Promise<VisoesDoQuadroApi> {
  return enviar("PATCH", rotaDaVisao(id), { nome });
}

export function removerVisao(id: string): Promise<VisoesDoQuadroApi> {
  return enviar("DELETE", rotaDaVisao(id));
}
