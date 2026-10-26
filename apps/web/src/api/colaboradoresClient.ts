import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import type { EnderecoApi, PerfilPessoalApi } from "./dadosPessoaisClient";

const BASE = "/v1";

export type TipoVinculo =
  "clt" | "estagio" | "pj" | "temporario" | "outro_controlado";

export type SituacaoColaborador = "ativo" | "inativo";

export type SituacaoVinculo = "previsto" | "ativo" | "encerrado";

export interface ColaboradorApi {
  id: string;
  nome: string;
  situacao: SituacaoColaborador;
  criadoEm: string;
  atualizadoEm: string;
}

export interface VinculoApi {
  id: string;
  colaboradorId: string;
  empresaId: string;
  /** T179 — opcional desde 2026-10-21: `null` quando não foi informada. */
  matricula: string | null;
  tipo: TipoVinculo;
  situacao: SituacaoVinculo;
  dataAdmissao: string;
  dataDesligamento: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

/**
 * T178 — vínculo como a LISTAGEM o projeta: só o que a linha da tabela usa.
 *
 * Só vínculos da empresa ativa (escopo global para `master_tecnico` sem
 * empresa ativa), já ordenados pelo servidor — ativo, previsto, encerrado e,
 * dentro de cada um, admissão mais recente primeiro. O primeiro é o "vínculo
 * principal" da linha; o cliente não reordena, para não ter duas regras.
 */
/** T184 — cargo ou departamento resumido: só id, código e nome. */
export interface ReferenciaListadaApi {
  id: string;
  codigo: string;
  nome: string;
}

/**
 * T184 — lotação VIGENTE do vínculo (a alocação organizacional aberta), com
 * cada referência `null` quando ela não a tem.
 */
export interface LotacaoListadaApi {
  cargo: ReferenciaListadaApi | null;
  departamento: ReferenciaListadaApi | null;
}

export interface VinculoListadoApi {
  id: string;
  empresaId: string;
  /** T179 — `null` quando a admissão não informou matrícula. */
  matricula: string | null;
  situacao: SituacaoVinculo;
  /** Dia civil (`@db.Date`); exibir só com `formatarDiaCivil`. */
  dataAdmissao: string;
  dataDesligamento: string | null;
  /**
   * T184 — `null` sem lotação vigente: vínculo previsto (admissão não
   * efetivada) ou encerrado (decisão da proprietária de 2026-10-26).
   */
  lotacaoVigente: LotacaoListadaApi | null;
  /**
   * T185 — vigências de jornada (T183) perto de hoje, do colaborador na
   * empresa deste vínculo; a tela escolhe a que contém o dia civil do
   * navegador. Vazio para vínculo que não está ativo.
   */
  vigenciasDeJornada: VigenciaDeJornadaListadaApi[];
}

/** T185 — uma vigência de jornada na listagem. */
export interface VigenciaDeJornadaListadaApi {
  /** Primeiro dia (`YYYY-MM-DD`). */
  vigenciaInicio: string;
  /** Primeiro dia SEM a jornada (`YYYY-MM-DD`), ou `null`. */
  vigenciaFim: string | null;
  jornada: { id: string; codigo: string | null; nome: string; ativo: boolean };
}

/**
 * T178 — item de `GET /v1/colaboradores`.
 *
 * `situacao`, para `rh`/`dp`, é a situação NA EMPRESA ATIVA (tem vínculo
 * ativo nela); só para `master_tecnico` sem empresa ativa é a global. Por isso
 * não deve ser sobrescrita pela resposta de `PATCH /v1/colaboradores/:id`,
 * que traz a situação global.
 */
export interface ColaboradorListadoApi extends ColaboradorApi {
  vinculos: VinculoListadoApi[];
}

/**
 * T178 — contagem do escopo inteiro (empresa ativa), calculada no servidor
 * SEM filtros nem busca. Não muda com a página nem com o filtro na tela.
 */
export interface ContadoresColaboradoresApi {
  ativos: number;
  inativos: number;
}

export interface ListagemColaboradoresApi extends ResultadoPaginado<ColaboradorListadoApi> {
  contadores: ContadoresColaboradoresApi;
}

/**
 * T178 — teto de `busca`, o mesmo do validador do servidor. Constante, e não
 * função, de propósito: os testes automockam este módulo, e um valor
 * primitivo sobrevive ao automock — uma função normalizadora viraria `vi.fn`
 * e a tela deixaria de normalizar justo nos testes.
 */
export const BUSCA_COLABORADORES_MAXIMO = 160;

export interface ListarColaboradoresQuery {
  situacao?: SituacaoColaborador;
  situacaoVinculo?: SituacaoVinculo;
  /**
   * T178 — nome (contém, sem diferenciar maiúsculas) ou matrícula (contém, só
   * de vínculos da empresa ativa). Aparada aqui; vazia não é enviada. A
   * empresa nunca vai na query: é a da sessão.
   */
  busca?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

/**
 * Destino organizacional da admissão: ao menos uma referência é exigida pela
 * API, e `areaId` só é aceito acompanhado de `departamentoId` — a mesma regra
 * de `assertDestinoCoerente` no backend. O cliente não escolhe por conta
 * própria: só envia o que o formulário selecionou.
 */
export interface DestinoOrganizacionalDto {
  unidadeOrganizacionalId?: string;
  departamentoId?: string;
  areaId?: string;
  equipeId?: string;
  cargoId?: string;
  centroCustoId?: string;
}

/**
 * Admissão: cria colaborador + primeiro vínculo, em uma única chamada. Espelha
 * `AdmitirColaboradorDto` do backend — `empresaId` é a empresa do próprio ator
 * (obtida via `/v1/empresas`, nunca inventada no cliente) e é conferida contra
 * a sessão no servidor; divergência responde 404, nunca 403.
 *
 * T179 — na Nova admissão, Departamento e Cargo são OBRIGATÓRIOS; Unidade,
 * Área (com o departamento), Equipe e Centro de custo são opcionais
 * (decisões da proprietária de 2026-10-21). A matrícula também é opcional:
 * vazia, o campo nem vai no corpo. Novo vínculo de colaborador existente não
 * muda.
 */
export interface AdmitirColaboradorDto extends DestinoOrganizacionalDto {
  departamentoId: string;
  cargoId: string;
  nome: string;
  empresaId: string;
  /** T179 — opcional; omitida quando vazia. */
  matricula?: string;
  tipo: TipoVinculo;
  dataAdmissao: string;
  motivoCodigo: "admissao_inicial";
  /**
   * T177 — Módulo 1, gravado na MESMA transação da admissão. Vazio vai como
   * `null`.
   *
   * OBRIGATÓRIO: `perfilPessoal` com `dataNascimento`. OPCIONAIS: os demais
   * campos do perfil (`sexo` só com um código de `OPCOES_SEXO`), o `endereco`
   * inteiro e os `contatos` — T179: cada contato vazio é omitido, e o bloco
   * inteiro some quando os três estão vazios.
   */
  perfilPessoal: Record<
    Exclude<keyof PerfilPessoalApi, "atualizadoEm" | "dataNascimento">,
    string | null
  > & { dataNascimento: string };
  endereco?: Record<Exclude<keyof EnderecoApi, "atualizadoEm">, string | null>;
  contatos?: { emailPessoal?: string; celular?: string; telefone?: string };
  /**
   * T183 — jornada de trabalho opcional (só o RH a envia): a vigência começa
   * na data de admissão. Ausente é "sem jornada".
   */
  tabelaHorarioId?: string;
}

/**
 * Resposta da admissão (T167): o colaborador no topo, como antes, mais a
 * confirmação do vínculo e do ato de admissão criados na mesma transação.
 * Projeção fechada no servidor — nenhum dado pessoal além dos aprovados.
 */
export interface AdmissaoRegistradaApi extends ColaboradorApi {
  vinculo: {
    id: string;
    empresaId: string;
    /** T179 — `null` quando a admissão não informou matrícula. */
    matricula: string | null;
    tipo: TipoVinculo;
    situacao: SituacaoVinculo;
    dataAdmissao: string;
  };
  movimentacao: {
    id: string;
    tipo: "admissao";
    status: "solicitada" | "programada";
    vigenciaInicio: string;
    destino: Required<{
      [K in keyof DestinoOrganizacionalDto]: string | null;
    }>;
  };
  /**
   * T177 — o que o servidor gravou do Módulo 1. O perfil sempre vem;
   * endereço é `null` quando nenhum campo veio. T179 — contatos também são
   * `null` quando nenhum veio, e cada um pode ser `null` sozinho.
   */
  perfilPessoal: PerfilPessoalApi;
  endereco: EnderecoApi | null;
  contatos: {
    emailPessoal: string | null;
    celular: string | null;
    telefone: string | null;
    atualizadoEm: string;
  } | null;
  /**
   * T183 — a vigência da jornada criada com a admissão, ou `null` sem
   * jornada. Ausente em respostas de antes da T183.
   */
  jornada?: {
    id: string;
    tabelaHorarioId: string;
    vigenciaInicio: string;
  } | null;
}

export interface RetificarColaboradorDto {
  nome: string;
}

/**
 * T179 — um campo recusado pelo servidor, SEM o valor enviado: só o caminho
 * do campo no corpo (`matricula`, `contatos.emailPessoal`, `emailPessoal`) e o
 * motivo (`em_uso`).
 */
export interface ErroDeCampoApi {
  readonly campo: string;
  readonly motivo: string;
}

/**
 * T179 — o que o corpo do erro pode trazer além da mensagem: `erros` (409 por
 * campo) e `codigo` (por exemplo `idempotencia_conteudo_divergente`, no 422).
 */
export interface DetalhesDaRecusaApi {
  readonly erros?: readonly ErroDeCampoApi[];
  readonly codigo?: string;
}

function ehErroDeCampo(item: unknown): item is ErroDeCampoApi {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as { campo?: unknown }).campo === "string" &&
    typeof (item as { motivo?: unknown }).motivo === "string"
  );
}

export class ApiError extends Error {
  /** T179 — campos recusados, quando o servidor os informa. */
  readonly erros?: readonly ErroDeCampoApi[];
  /** T179 — código estável da recusa, quando o servidor o informa. */
  readonly codigo?: string;

  /**
   * `corpo` é o corpo JSON do erro, ou nada. Só `erros` (lista de
   * `{campo, motivo}` em texto) e `codigo` (texto) são lidos; qualquer outra
   * coisa do corpo é ignorada, e forma inesperada simplesmente não vira
   * detalhe — quem já usava `status` e `message` não muda.
   */
  constructor(
    readonly status: number,
    message: string,
    corpo?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    if (typeof corpo === "object" && corpo !== null) {
      const { erros, codigo } = corpo as {
        erros?: unknown;
        codigo?: unknown;
      };
      if (Array.isArray(erros)) {
        this.erros = erros
          .filter(ehErroDeCampo)
          .map(({ campo, motivo }) => ({ campo, motivo }));
      }
      if (typeof codigo === "string") this.codigo = codigo;
    }
  }
}

/** T179 — opções do envio da admissão. */
export interface OpcoesDaAdmissao {
  /**
   * Chave de idempotência (UUID) do envio, no cabeçalho `Idempotency-Key`.
   * A MESMA chave em nova tentativa nunca cria uma segunda admissão: o
   * servidor devolve a já gravada, ou recusa com 422 se o conteúdo mudou.
   */
  readonly chaveIdempotencia?: string;
}

/**
 * T179 — rede caída ao renovar o token vira `CsrfRequestError`: a gravação nem
 * saiu, e a tela não a confunde com envio incerto.
 */
async function getCsrf(): Promise<string> {
  return tokenCsrfParaGravacao();
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers as Record<string, string>),
    },
  });
  if (res.status === 401) {
    clearCsrfToken();
  }
  // T179 (revisão definitiva) — 403 `csrf_invalido`: o token desta aba ficou
  // desatualizado; descartado, a próxima gravação pede um novo.
  await descartarTokenSeDesatualizado(res);
  return res;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(body.message)
      ? (body.message[0] ?? "Erro na requisição.")
      : (body.message ?? "Erro na requisição.");
    throw new ApiError(res.status, msg, body);
  }
  return res.json() as Promise<T>;
}

export async function listarColaboradores(
  query: ListarColaboradoresQuery = {},
): Promise<ListagemColaboradoresApi> {
  const params = new URLSearchParams();
  if (query.situacao) params.set("situacao", query.situacao);
  if (query.situacaoVinculo)
    params.set("situacaoVinculo", query.situacaoVinculo);
  // T178 — normaliza também aqui (a tela já normaliza): só espaços não viram
  // busca, e o servidor recusaria um termo vazio ou acima do teto.
  const busca = (query.busca ?? "")
    .trim()
    .slice(0, BUSCA_COLABORADORES_MAXIMO)
    .trim();
  if (busca) params.set("busca", busca);
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  const res = await apiFetch(`/colaboradores${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function buscarColaborador(id: string): Promise<ColaboradorApi> {
  const res = await apiFetch(`/colaboradores/${id}`);
  return jsonOrThrow(res);
}

export async function listarVinculosDoColaborador(
  colaboradorId: string,
): Promise<VinculoApi[]> {
  const res = await apiFetch(`/colaboradores/${colaboradorId}/vinculos`);
  return jsonOrThrow(res);
}

/**
 * Registra a admissão. T179 — com `chaveIdempotencia`, o envio é idempotente:
 * reenviar a mesma chave (depois de uma falha de rede, por exemplo) devolve a
 * admissão já gravada com o mesmo 201, e o cabeçalho `Idempotent-Replayed`.
 */
export async function admitirColaborador(
  dto: AdmitirColaboradorDto,
  opcoes: OpcoesDaAdmissao = {},
): Promise<AdmissaoRegistradaApi> {
  const token = await getCsrf();
  const res = await apiFetch("/colaboradores", {
    method: "POST",
    headers: {
      "x-csrf-token": token,
      ...(opcoes.chaveIdempotencia
        ? { "Idempotency-Key": opcoes.chaveIdempotencia }
        : {}),
    },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function retificarColaborador(
  id: string,
  dto: RetificarColaboradorDto,
): Promise<ColaboradorApi> {
  const token = await getCsrf();
  const res = await apiFetch(`/colaboradores/${id}`, {
    method: "PATCH",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}
