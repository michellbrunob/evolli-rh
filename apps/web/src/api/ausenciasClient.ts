import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import { ApiError } from "./colaboradoresClient";

const BASE = "/v1";

/**
 * T215 — Férias e ausências. Datas em dia civil `AAAA-MM-DD`; instantes
 * (`registradoEm`, `decididoEm`) em ISO.
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

/** Filtro "Período" da lista (recortes de hoje). */
export type PeriodoDaListaDeAusencias =
  | "em_ferias_agora"
  | "licencas_afastamentos"
  | "faltas_mes"
  | "proximas_ferias";

/** Filtro "Tipo" da lista: grupos de tipos. */
export type GrupoDeTipoDeAusencia =
  "ferias" | "licencas" | "afastamentos" | "faltas" | "day_off" | "home_office";

/** Filtro "Status": os status, mais "aguardando você". */
export type FiltroDeStatusDeAusencia = StatusAusencia | "aguardando_voce";

export interface AusenciaApi {
  id: string;
  colaborador: {
    id: string;
    nome: string;
    cargo: string | null;
    foto: { versao: number } | null;
  };
  tipo: TipoAusencia;
  motivoAfastamento: MotivoAfastamento | null;
  inicio: string;
  /** `null` só no afastamento sem data de volta. */
  fim: string | null;
  dias: number | null;
  diasUteis: number | null;
  diasVendidos: number;
  periodoAquisitivo: { inicio: string; fim: string } | null;
  status: StatusAusencia;
  observacao: string | null;
  registradoEm: string;
  decididoEm: string | null;
  /** T215 — o atestado ou documento anexado, sem nome nem chave. */
  anexo: AnexoDaAusenciaApi | null;
}

/** T215 — formatos do anexo (os da referência). */
export type FormatoAnexoAusencia =
  "pdf" | "jpg" | "png" | "webp" | "heic" | "heif" | "doc" | "docx";

export interface AnexoDaAusenciaApi {
  formato: FormatoAnexoAusencia;
  tamanhoBytes: number;
  enviadoEm: string;
}

/** T215 — a regra de férias pelo tipo do vínculo. */
export type RegraDeFerias = "calculada" | "sem_ferias" | "sem_regra";

export interface IndicadoresDeAusenciasApi {
  emFeriasAgora: number;
  /** T215 — pessoas fora hoje (o número da aba). */
  ausentesHoje?: number;
  licencasEAfastamentos: number;
  faltasEsteMes: number;
  proximasFerias: number;
  /** Aguardando o RH (o número da aba). */
  pendentes: number;
}

export interface ListagemDeAusenciasApi {
  itens: AusenciaApi[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
  indicadores: IndicadoresDeAusenciasApi;
}

export interface ListarAusenciasQuery {
  pagina?: number;
  tamanhoPagina?: number;
  busca?: string;
  periodo?: PeriodoDaListaDeAusencias;
  tipo?: GrupoDeTipoDeAusencia;
  status?: FiltroDeStatusDeAusencia;
}

export interface RegistrarAusenciaDto {
  colaboradorId: string;
  tipo: TipoAusencia;
  /** Só no afastamento, e obrigatório nele. */
  motivoAfastamento?: MotivoAfastamento;
  inicio: string;
  /** Obrigatório, salvo no afastamento sem data de volta. */
  fim?: string;
  /** Abono pecuniário (só férias), de 0 a 10. */
  diasVendidos?: number;
  /** De que período as férias descontam (ausente: automático). */
  periodoAquisitivoInicio?: string;
  /** Já aprovada, ou aguardando o RH (o afastamento é sempre aprovado). */
  aprovada: boolean;
  observacao?: string;
}

export interface SimularAusenciaQuery {
  colaboradorId: string;
  tipo: TipoAusencia;
  inicio: string;
  fim?: string;
  diasVendidos?: number;
  periodoAquisitivoInicio?: string;
  /** Editando: a própria ausência não conta (sobreposição e saldo). */
  ignorar?: string;
}

export interface SimulacaoDeAusenciaApi {
  dias: number | null;
  diasUteis: number | null;
  volta: string | null;
  periodo: { inicio: string; fim: string } | null;
  /** Férias: saldo do período antes e depois; fora das férias, `null`. */
  saldoAntes: number | null;
  saldoDepois: number | null;
  maxVendaveis: number | null;
  /** Último dia para pedir o abono sem a empresa poder negar. */
  prazoAbono: string | null;
  /** T215 — a regra de férias do vínculo da pessoa. */
  regraDeFerias?: RegraDeFerias;
  /** T215 — "Regras da CLT" (só aviso). */
  avisosClt?: AvisoCltApi[];
  /** T215 — os períodos com saldo de que as férias podem descontar. */
  periodosDisponiveis?: { inicio: string; fim: string; disponiveis: number }[];
  /** T215 — menos de 12 meses de casa: cabe "férias coletivas" (art. 140). */
  podeSerColetiva?: boolean;
  /** T215 — simulada como coletiva: os dias proporcionais e o novo período. */
  coletiva?: { dias: number; novoPeriodo: string } | null;
  /** T215 — a política de férias da pessoa e o que o pedido não segue. */
  politica?: {
    id: string;
    nome: string;
    violacoes: ViolacaoDaPoliticaApi[];
  } | null;
}

/** T215 — o que o pedido de férias não segue na política. */
export type ViolacaoDaPoliticaApi =
  | { regra: "antecedencia_minima"; dias: number; minimo: number }
  | { regra: "antecedencia_maxima"; meses: number; maximo: number }
  | { regra: "duracao_minima"; dias: number; minimo: number }
  | { regra: "duracao_maxima"; dias: number; maximo: number }
  | { regra: "periodos_por_ano"; ordem: number; maximo: number }
  | { regra: "periodo_maior"; minimo: number }
  | { regra: "intervalo"; dias: number; minimo: number }
  | {
      regra: "inicio_antes_de_descanso";
      antesDe: "domingo" | "feriado";
      dia: string;
    }
  | { regra: "inicio_no_descanso"; dia: string }
  | { regra: "volta_na_sexta"; dia: string }
  | { regra: "volta_na_vespera"; dia: string }
  | { regra: "bloqueio"; nome: string; inicio: string; fim: string }
  | { regra: "alem_do_saldo" }
  | { regra: "equipe"; fora: number; maximo: number };

/** T215 — um aviso das regras da CLT no registro de férias. */
export type AvisoCltApi =
  | { regra: "minimo_5"; dias: number }
  | { regra: "um_com_14" }
  | { regra: "ate_3_periodos"; ordem: number }
  | {
      regra: "inicio_antes_de_descanso";
      antesDe: "domingo" | "feriado";
      dia: string;
    };

export type SituacaoDoPeriodoAquisitivo =
  "em_aquisicao" | "disponivel" | "vencido";

export interface PeriodoAquisitivoApi {
  inicio: string;
  fim: string;
  direito: number;
  solicitados: number;
  disponiveis: number;
  prazoGozo: string;
  situacao: SituacaoDoPeriodoAquisitivo;
  /** T215 — encurtado por um reinício ("Ajustar período"). */
  encurtado: { motivo: MotivoReinicio; novoInicio: string } | null;
}

/** T215 — por que a contagem do período aquisitivo recomeçou. */
export type MotivoReinicio = "ferias_coletivas" | "perda_direito" | "outro";

/** T215 — um reinício da contagem ("Ajustar período"). */
export interface ReinicioApi {
  id: string;
  inicio: string;
  motivo: MotivoReinicio;
  diasPeriodoAnterior: number | null;
  observacao: string | null;
}

/** T215 — "Períodos hoje" / "Como os períodos vão ficar". */
export interface SimulacaoDeReinicioApi {
  periodos: PeriodoAquisitivoApi[];
  diasCalculados: number | null;
}

export interface NovoReinicioDto {
  inicio: string;
  motivo: MotivoReinicio;
  diasPeriodoAnterior?: number;
  observacao?: string;
}

export interface FeriasDoColaboradorApi {
  /** T215 — calculada (CLT, Estágio), sem_ferias (PJ, Freelancer), sem_regra. */
  regraDeFerias: RegraDeFerias;
  vinculo: { tipo: string; dataAdmissao: string };
  /** Só na regra calculada; nas demais, vazio. */
  periodos: PeriodoAquisitivoApi[];
  /** Índice do período que a ficha mostra, ou `null` sem período. */
  periodoAtual: number | null;
  proximaAusencia: AusenciaApi | null;
  historico: AusenciaApi[];
  /** T215 — reinícios da contagem, do mais antigo. */
  reinicios: ReinicioApi[];
}

function comConsulta(
  rota: string,
  consulta: Readonly<Record<string, string | number | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(consulta)) {
    if (valor !== undefined && valor !== "") params.set(chave, String(valor));
  }
  const texto = params.toString();
  return texto ? `${rota}?${texto}` : rota;
}

async function ler<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) clearCsrfToken();
  if (!res.ok) {
    const corpo: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", corpo);
  }
  return res.json() as Promise<T>;
}

async function gravar<T>(url: string, corpo?: unknown): Promise<T> {
  const token = await tokenCsrfParaGravacao();
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "x-csrf-token": token,
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  return res.json() as Promise<T>;
}

/** Lista as ausências da empresa ativa, com os indicadores do escopo. */
export function listarAusencias(
  query: ListarAusenciasQuery,
): Promise<ListagemDeAusenciasApi> {
  return ler(
    comConsulta(`${BASE}/ausencias`, {
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      busca: query.busca,
      periodo: query.periodo,
      tipo: query.tipo,
      status: query.status,
    }),
  );
}

/** Registra uma ausência (RH e DP). Recusa por campo vem no `ApiError`. */
export function registrarAusencia(
  dto: RegistrarAusenciaDto,
): Promise<AusenciaApi> {
  return gravar(`${BASE}/ausencias`, dto);
}

/** T215 — aprovar, com a mensagem opcional para quem pediu. */
export function aprovarAusencia(
  ausenciaId: string,
  mensagem?: string,
): Promise<AusenciaApi> {
  return gravar(
    `${BASE}/ausencias/${encodeURIComponent(ausenciaId)}/aprovar`,
    ...(mensagem ? [{ mensagem }] : []),
  );
}

/** T215 — "Sugerir outras datas": o pedido fica em ajuste sugerido. */
export function sugerirAusencia(
  ausenciaId: string,
  sugestao: { inicio: string; fim: string; mensagem?: string },
): Promise<AusenciaApi> {
  return gravar(
    `${BASE}/ausencias/${encodeURIComponent(ausenciaId)}/sugerir`,
    sugestao,
  );
}

export function recusarAusencia(
  ausenciaId: string,
  motivo?: string,
): Promise<AusenciaApi> {
  return gravar(
    `${BASE}/ausencias/${encodeURIComponent(ausenciaId)}/recusar`,
    motivo ? { motivo } : {},
  );
}

export function cancelarAusencia(ausenciaId: string): Promise<AusenciaApi> {
  return gravar(`${BASE}/ausencias/${encodeURIComponent(ausenciaId)}/cancelar`);
}

/** Dias, dias úteis, volta e, nas férias, período e saldo. */
export function simularAusencia(
  query: SimularAusenciaQuery,
): Promise<SimulacaoDeAusenciaApi> {
  return ler(
    comConsulta(`${BASE}/ausencias/simulacao`, {
      colaboradorId: query.colaboradorId,
      tipo: query.tipo,
      inicio: query.inicio,
      fim: query.fim,
      diasVendidos: query.diasVendidos,
      periodoAquisitivoInicio: query.periodoAquisitivoInicio,
      ignorar: query.ignorar,
    }),
  );
}

/** T215 — edita a ausência (as mesmas respostas do registro, menos a pessoa). */
export async function alterarAusencia(
  ausenciaId: string,
  dto: Omit<RegistrarAusenciaDto, "colaboradorId">,
): Promise<AusenciaApi> {
  const res = await fetch(
    `${BASE}/ausencias/${encodeURIComponent(ausenciaId)}`,
    {
      method: "PATCH",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-csrf-token": await tokenCsrfParaGravacao(),
      },
      body: JSON.stringify(dto),
    },
  );
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  return res.json() as Promise<AusenciaApi>;
}

/**
 * T215 — exclui a ausência: sai do histórico, da lista, do quadro e do
 * saldo (o servidor guarda o registro, marcado).
 */
export async function excluirAusencia(ausenciaId: string): Promise<void> {
  const res = await fetch(
    `${BASE}/ausencias/${encodeURIComponent(ausenciaId)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-csrf-token": await tokenCsrfParaGravacao(),
      },
    },
  );
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
}

/** Saldo de férias, próxima ausência e histórico do colaborador. */
export function consultarFeriasDoColaborador(
  colaboradorId: string,
): Promise<FeriasDoColaboradorApi> {
  return ler(
    `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/ferias`,
  );
}

/** T215 — "x.PDF" → "pdf"; sem extensão, vazio. */
function extensaoDoNome(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  return ponto < 0 ? "" : nome.slice(ponto + 1).toLowerCase();
}

/**
 * T215 — anexa o atestado ou documento à ausência: o arquivo vai em binário,
 * com tipo e extensão nos cabeçalhos; o nome do arquivo não vai.
 */
export async function enviarAnexoDaAusencia(
  ausenciaId: string,
  arquivo: File,
): Promise<{ anexo: AnexoDaAusenciaApi }> {
  const enviar = async () =>
    fetch(`${BASE}/ausencias/${encodeURIComponent(ausenciaId)}/anexo`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/octet-stream",
        "x-csrf-token": await tokenCsrfParaGravacao(),
        "x-evolli-anexo-tipo": arquivo.type || "application/octet-stream",
        "x-evolli-anexo-extensao": extensaoDoNome(arquivo.name),
      },
      body: arquivo,
    });
  const res = await enviar();
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  return res.json() as Promise<{ anexo: AnexoDaAusenciaApi }>;
}

/** T215 — remove (logicamente) o anexo da ausência. */
export async function removerAnexoDaAusencia(
  ausenciaId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/ausencias/${encodeURIComponent(ausenciaId)}/anexo`,
    {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-csrf-token": await tokenCsrfParaGravacao(),
      },
    },
  );
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
}

/** T215 — o arquivo anexado, em memória do navegador (download seguro). */
export async function obterAnexoDaAusencia(
  ausenciaId: string,
): Promise<{ readonly blob: Blob; readonly nome: string }> {
  const res = await fetch(
    `${BASE}/ausencias/${encodeURIComponent(ausenciaId)}/anexo/arquivo`,
    {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "*/*" },
    },
  );
  if (res.status === 401) clearCsrfToken();
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  const nome =
    /filename="([^"]+)"/.exec(
      res.headers.get("content-disposition") ?? "",
    )?.[1] ?? "atestado";
  return { blob: await res.blob(), nome };
}

const rotaDosReinicios = (colaboradorId: string) =>
  `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/ferias/reinicios`;

/** T215 — os períodos de hoje, ou como ficam com o reinício proposto. */
export function simularReinicio(
  colaboradorId: string,
  proposta: { inicio?: string; motivo?: MotivoReinicio; dias?: number } = {},
): Promise<SimulacaoDeReinicioApi> {
  return ler(
    comConsulta(`${rotaDosReinicios(colaboradorId)}/simulacao`, proposta),
  );
}

/** T215 — "Salvar reinício". */
export function registrarReinicio(
  colaboradorId: string,
  dto: NovoReinicioDto,
): Promise<ReinicioApi> {
  return gravar(rotaDosReinicios(colaboradorId), dto);
}

/** T215 — remove um reinício (o registro fica marcado no servidor). */
export async function removerReinicio(
  colaboradorId: string,
  reinicioId: string,
): Promise<void> {
  const res = await fetch(
    `${rotaDosReinicios(colaboradorId)}/${encodeURIComponent(reinicioId)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-csrf-token": await tokenCsrfParaGravacao(),
      },
    },
  );
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
}
