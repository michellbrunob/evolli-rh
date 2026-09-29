import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";

/**
 * Cliente da Central de Solicitações de Pessoas (T140) — consome EXCLUSIVAMENTE
 * os cinco contratos reais integrados pela T139 em `apps/api/src/solicitacoes-pessoas/`:
 *
 * - `GET  /v1/solicitacoes-pessoas`                        — lista paginada.
 * - `GET  /v1/solicitacoes-pessoas/:id`                    — detalhe.
 * - `GET  /v1/solicitacoes-pessoas/:id/historico`          — linha do tempo.
 * - `POST /v1/solicitacoes-pessoas`                        — registra (nasce `rascunho`).
 * - `POST /v1/solicitacoes-pessoas/:id/transicoes`         — executa transição aprovada.
 *
 * A Central **registra e encaminha**; não executa. Nenhuma função aqui toca ponto,
 * férias, cadastro, vínculo, benefício, Banco de Horas, Folha ou fechamento.
 *
 * **Sem conteúdo, por construção.** Não existe campo de anexo, arquivo, URL, chave
 * de objeto, base64, blob, diagnóstico, CID ou descrição clínica — nem de entrada
 * nem de saída. `atestado` usa exatamente a mesma estrutura dos demais tipos
 * (`PD-SOL-05`), e a ADR 0013 aprovou o provedor privado futuro, nunca o upload.
 *
 * **O escopo vive no servidor.** O `empresaId` enviado no registro existe só para
 * ser reconferido contra a sessão (divergência responde 404, nunca 403); ele nunca
 * é fonte de autorização. A listagem NÃO envia empresa: o backend a deriva da
 * sessão. `credentials: "same-origin"` em toda chamada; CSRF só nas mutações.
 */

const BASE = "/v1";
const RECURSO = "/solicitacoes-pessoas";

// ---------------------------------------------------------------------------
// Catálogos fechados — espelham 1:1 os enums do backend. Nenhum valor extra.
// ---------------------------------------------------------------------------

/** Catálogo aprovado por `PD-SOL-01`. `documento` NÃO pertence a ele. */
export const TIPOS_SOLICITACAO_PESSOA = [
  "contestacao_ajuste_ponto",
  "ausencia",
  "ferias",
  "atualizacao_cadastral",
  "atestado",
  "beneficios",
] as const;
export type TipoSolicitacaoPessoa = (typeof TIPOS_SOLICITACAO_PESSOA)[number];

export const SITUACOES_SOLICITACAO_PESSOA = [
  "rascunho",
  "enviada",
  "em_revisao_rh",
  "aguardando_informacao",
  "encaminhada_para_operacao_rh",
  "recusada",
  "cancelada",
] as const;
export type SituacaoSolicitacaoPessoa =
  (typeof SITUACOES_SOLICITACAO_PESSOA)[number];

/**
 * Motivos codificados, na ordem declarada pelo backend. Não há texto livre.
 *
 * Nenhuma regra liga um motivo a um tipo ou a uma ação — o schema afirma isso
 * literalmente. Por isso a lista é apresentada inteira e plana: filtrá-la por
 * contexto seria inventar uma regra de elegibilidade que ninguém aprovou.
 */
export const MOTIVOS_SOLICITACAO_PESSOA = [
  "divergencia_marcacao",
  "ausencia_programada",
  "periodo_ferias",
  "dado_cadastral_desatualizado",
  "atestado_apresentado",
  "beneficio_solicitado",
  "informacao_insuficiente",
  "fora_do_escopo_da_central",
  "duplicidade",
  "reanalise_administrativa",
  "correcao_de_registro",
  "outro_controlado",
] as const;
export type MotivoSolicitacaoPessoa =
  (typeof MOTIVOS_SOLICITACAO_PESSOA)[number];

/** `criar` só aparece no histórico: não é transição, é o nascimento do registro. */
export type AcaoSolicitacaoPessoa =
  | "criar"
  | "enviar"
  | "cancelar"
  | "iniciar_revisao"
  | "aguardar_informacao"
  | "retomar_revisao"
  | "encaminhar_para_operacao"
  | "recusar"
  | "reabrir";

/** Ações que a rota de transição aceita (`criar` é excluída no próprio DTO). */
export type AcaoTransicaoSolicitacaoPessoa = Exclude<
  AcaoSolicitacaoPessoa,
  "criar"
>;

/**
 * Tabela de transições — espelho exato do núcleo puro T066
 * (`apps/api/src/solicitacoes/solicitacoes.ts`), reconciliado por `PD-SOL-03`.
 *
 * A interface a usa apenas para **não oferecer** o que o servidor recusaria; ela
 * não é autoridade de segurança. Invariantes preservadas: cancelamento somente
 * antes de `em_revisao_rh`; `cancelada` sem saída; reabertura só de `recusada` e
 * `encaminhada_para_operacao_rh`. Não existe estado `encerrada` — o termo
 * funcional corresponde a `encaminhada_para_operacao_rh`.
 */
export const ACOES_POR_SITUACAO: Record<
  SituacaoSolicitacaoPessoa,
  readonly AcaoTransicaoSolicitacaoPessoa[]
> = {
  rascunho: ["enviar", "cancelar"],
  enviada: ["iniciar_revisao", "cancelar"],
  em_revisao_rh: ["aguardar_informacao", "encaminhar_para_operacao", "recusar"],
  aguardando_informacao: ["retomar_revisao"],
  encaminhada_para_operacao_rh: ["reabrir"],
  recusada: ["reabrir"],
  cancelada: [],
};

/** "Justificativa auditada" de `PD-SOL-03` — mesma constante do backend. */
export const ACOES_COM_MOTIVO_OBRIGATORIO: readonly AcaoTransicaoSolicitacaoPessoa[] =
  ["recusar", "reabrir"];

// ---------------------------------------------------------------------------
// Formatos de resposta — espelham o retorno do backend, que devolve a linha
// persistida sem DTO de saída.
// ---------------------------------------------------------------------------

export interface SolicitacaoPessoaApi {
  id: string;
  empresaId: string;
  vinculoId: string;
  tipo: TipoSolicitacaoPessoa;
  motivo: MotivoSolicitacaoPessoa;
  situacao: SituacaoSolicitacaoPessoa;
  /**
   * ENTRA como `"AAAA-MM-DD"` e SAI como datetime ISO completo: a coluna é
   * `@db.Date`, mas o Prisma devolve `Date`. Use `formatarDiaReferencia`.
   */
  periodoReferencia: string | null;
  /** Ator que REGISTROU (conta de acesso), nunca o colaborador (sujeito). */
  registradoPorUserId: string;
  /** Marcos de acompanhamento (`PD-SOL-04`) — datas, nunca prazo ou contador. */
  enviadaEm: string | null;
  primeiraRevisaoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface SolicitacaoPessoaEventoApi {
  id: string;
  solicitacaoId: string;
  empresaId: string;
  acao: AcaoSolicitacaoPessoa;
  /** Nulo apenas na criação: não havia estado anterior. */
  situacaoDe: SituacaoSolicitacaoPessoa | null;
  situacaoPara: SituacaoSolicitacaoPessoa;
  motivo: MotivoSolicitacaoPessoa | null;
  registradoPorUserId: string;
  requestId: string;
  ocorridoEm: string;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

async function getCsrf(): Promise<string> {
  return getCsrfToken() ?? refreshCsrfToken();
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers as Record<string, string>),
    },
  });
  if (res.status === 401) {
    clearCsrfToken();
  }
  return res;
}

/**
 * Nunca repassa o corpo de erro do servidor — só o status. A tela decide a
 * mensagem pública; 404 (anti-enumeração) e 422 (transição recusada) são
 * traduzidos por quem chama.
 */
async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    throw new ApiError(res.status, fallback);
  }
  return res.json() as Promise<T>;
}

function montarQuery(
  params: Record<string, string | number | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== "") usp.set(chave, String(valor));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/**
 * Filtros aceitos pela API. **Sem `empresaId`**: a empresa é derivada da sessão
 * pelo servidor, e mandá-la daqui só abriria espaço para o navegador tentar
 * escolher escopo (o backend responderia com página vazia, mas o cliente não
 * deve nem tentar).
 */
export interface ListarSolicitacoesPessoasQuery {
  vinculoId?: string;
  tipo?: TipoSolicitacaoPessoa;
  situacao?: SituacaoSolicitacaoPessoa;
  pagina?: number;
  tamanhoPagina?: number;
}

export async function listarSolicitacoesPessoas(
  query: ListarSolicitacoesPessoasQuery = {},
): Promise<ResultadoPaginado<SolicitacaoPessoaApi>> {
  const res = await apiFetch(
    `${RECURSO}${montarQuery({
      vinculoId: query.vinculoId,
      tipo: query.tipo,
      situacao: query.situacao,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
    })}`,
  );
  return jsonOrThrow(res, "Não foi possível carregar as solicitações.");
}

export async function detalharSolicitacaoPessoa(
  solicitacaoId: string,
): Promise<SolicitacaoPessoaApi> {
  const res = await apiFetch(`${RECURSO}/${encodeURIComponent(solicitacaoId)}`);
  return jsonOrThrow(res, "Não foi possível carregar a solicitação.");
}

export async function historicoSolicitacaoPessoa(
  solicitacaoId: string,
): Promise<SolicitacaoPessoaEventoApi[]> {
  const res = await apiFetch(
    `${RECURSO}/${encodeURIComponent(solicitacaoId)}/historico`,
  );
  return jsonOrThrow(res, "Não foi possível carregar o histórico.");
}

/**
 * Registro. A solicitação nasce em `rascunho` — `situacao` não é aceita do
 * cliente, senão seria possível pular a máquina de estados.
 *
 * Não existe campo de anexo, texto livre, diagnóstico, CID ou descrição
 * clínica: `forbidNonWhitelisted` no servidor rejeita qualquer campo extra.
 */
export interface RegistrarSolicitacaoPessoaDto {
  empresaId: string;
  vinculoId: string;
  tipo: TipoSolicitacaoPessoa;
  motivo: MotivoSolicitacaoPessoa;
  /** `"AAAA-MM-DD"`. Opcional para TODOS os tipos. */
  periodoReferencia?: string;
}

export async function registrarSolicitacaoPessoa(
  dto: RegistrarSolicitacaoPessoaDto,
): Promise<SolicitacaoPessoaApi> {
  const token = await getCsrf();
  const res = await apiFetch(RECURSO, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res, "Não foi possível registrar a solicitação.");
}

export interface TransicionarSolicitacaoPessoaDto {
  acao: AcaoTransicaoSolicitacaoPessoa;
  /** Obrigatório em `recusar` e `reabrir`; o servidor responde 422 se faltar. */
  motivo?: MotivoSolicitacaoPessoa;
}

export async function transicionarSolicitacaoPessoa(
  solicitacaoId: string,
  dto: TransicionarSolicitacaoPessoaDto,
): Promise<SolicitacaoPessoaApi> {
  const token = await getCsrf();
  const res = await apiFetch(
    `${RECURSO}/${encodeURIComponent(solicitacaoId)}/transicoes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": token },
      body: JSON.stringify(dto),
    },
  );
  return jsonOrThrow(res, "Não foi possível executar esta ação.");
}

// ---------------------------------------------------------------------------
// Rótulos de apresentação — tradução dos códigos técnicos, sem criar domínio.
// ---------------------------------------------------------------------------

export const ROTULO_TIPO: Record<TipoSolicitacaoPessoa, string> = {
  contestacao_ajuste_ponto: "Contestação de ajuste de ponto",
  ausencia: "Ausência",
  ferias: "Férias",
  atualizacao_cadastral: "Atualização cadastral",
  atestado: "Atestado",
  beneficios: "Benefícios",
};

export const ROTULO_SITUACAO: Record<SituacaoSolicitacaoPessoa, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  em_revisao_rh: "Em revisão pelo RH",
  aguardando_informacao: "Aguardando informação",
  encaminhada_para_operacao_rh: "Encaminhada para operação do RH",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export const ROTULO_ACAO: Record<AcaoSolicitacaoPessoa, string> = {
  criar: "Registrada",
  enviar: "Enviar",
  cancelar: "Cancelar",
  iniciar_revisao: "Iniciar revisão",
  aguardar_informacao: "Aguardar informação",
  retomar_revisao: "Retomar revisão",
  encaminhar_para_operacao: "Encaminhar para operação",
  recusar: "Recusar",
  reabrir: "Reabrir",
};

export const ROTULO_MOTIVO: Record<MotivoSolicitacaoPessoa, string> = {
  divergencia_marcacao: "Divergência de marcação",
  ausencia_programada: "Ausência programada",
  periodo_ferias: "Período de férias",
  dado_cadastral_desatualizado: "Dado cadastral desatualizado",
  atestado_apresentado: "Atestado apresentado",
  beneficio_solicitado: "Benefício solicitado",
  informacao_insuficiente: "Informação insuficiente",
  fora_do_escopo_da_central: "Fora do escopo da Central",
  duplicidade: "Duplicidade",
  reanalise_administrativa: "Reanálise administrativa",
  correcao_de_registro: "Correção de registro",
  outro_controlado: "Outro (controlado)",
};

/** Realce não-cromático por situação; o texto do rótulo continua sendo a fonte. */
export const VARIANTE_SITUACAO: Record<
  SituacaoSolicitacaoPessoa,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  rascunho: "neutral",
  enviada: "info",
  em_revisao_rh: "info",
  aguardando_informacao: "warning",
  encaminhada_para_operacao_rh: "success",
  recusada: "danger",
  cancelada: "neutral",
};

/**
 * `periodoReferencia` volta do servidor como datetime ISO (coluna `@db.Date`,
 * valor `Date` no Prisma). Reexibe o dia, sem recalcular fuso: os 10 primeiros
 * caracteres já são a data UTC que foi gravada.
 */
export function formatarDiaReferencia(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

/** Data e hora de um marco, sem conversão de fuso (mesma forma da T133). */
export function formatarMomento(iso: string | null): string {
  return iso ? iso.replace("T", " ").slice(0, 16) : "—";
}
