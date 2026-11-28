import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  getCsrfToken,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import type { EnderecoApi, PerfilPessoalApi } from "./dadosPessoaisClient";

const BASE = "/v1";

/** T209 — Aprendiz entrou no catálogo, logo depois de Estágio. */
export type TipoVinculo =
  | "clt"
  | "estagio"
  | "aprendiz"
  | "pj"
  | "temporario"
  | "outro_controlado"
  // T209 — etapa 2 do Novo colaborador.
  | "part_time"
  | "freelancer"
  | "trainee";

export type SituacaoColaborador = "ativo" | "inativo";

export type SituacaoVinculo = "previsto" | "ativo" | "encerrado";

export interface ColaboradorApi {
  id: string;
  nome: string;
  situacao: SituacaoColaborador;
  criadoEm: string;
  atualizadoEm: string;
  /**
   * T209 — a foto do colaborador na empresa ativa, como a listagem e a ficha
   * a anunciam: só a versão, ou `null` sem foto. Ausente nas respostas que
   * não a trazem (admissão, retificação).
   */
  foto?: FotoAnunciadaApi | null;
}

/**
 * T209 — só a versão da foto: a tela monta a rota autenticada
 * (`/v1/colaboradores/:id/foto`). Nunca chave nem endereço do armazenamento.
 */
export interface FotoAnunciadaApi {
  readonly versao: number;
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
  /** T199 — tipo do vínculo (CLT, estágio, PJ…). */
  tipo: TipoVinculo;
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
  /**
   * T215 — desativado na empresa (lixeira do "Editar colaborador"): a
   * `situacao` vem "inativo" e a linha só aparece em Todos.
   */
  desativado?: boolean;
  /**
   * T215 — CPF (11 dígitos) na empresa ativa. AUSENTE para quem não lê dados
   * pessoais (e sem empresa ativa); `null` sem CPF ou com o dado bloqueado
   * (desligado). A tela distingue "sem permissão" de "vazio".
   */
  cpf?: string | null;
  /**
   * T215 — e-mail pessoal e celular do contato ativo na empresa. AUSENTE
   * para quem não lê contatos; `null` sem contato ou bloqueado.
   */
  contatos?: { emailPessoal: string | null; celular: string | null } | null;
  /**
   * T215 — salário bruto do contrato do vínculo principal ("5000.00").
   * AUSENTE para quem não lê o contrato; `null` sem contrato ou salário.
   */
  salarioBruto?: string | null;
}

/**
 * T178 — contagem do escopo inteiro (empresa ativa), calculada no servidor
 * SEM filtros nem busca. Não muda com a página nem com o filtro na tela.
 */
export interface ContadoresColaboradoresApi {
  ativos: number;
  inativos: number;
  /**
   * T199 — grupos exclusivos, com prioridade ativo > previsto > encerrado:
   * `ativos + emAdmissao + desligados = total`. Contados no servidor, sem
   * busca nem filtros.
   */
  emAdmissao: number;
  desligados: number;
  total: number;
  /**
   * T215 — desativados na empresa, fora dos três grupos:
   * `ativos + emAdmissao + desligados + desativados = total`.
   */
  desativados?: number;
  /** T199 — ativos pelo tipo do vínculo principal ativo; a soma é `ativos`. */
  ativosPorTipo: Record<TipoVinculo, number>;
  /**
   * T215 — cartão "Colaboradores ativos": pessoas com vínculo ativo admitido
   * no mês civil de hoje (America/Sao_Paulo).
   */
  admitidosNoMes?: number;
  /** T215 — pessoas com vínculo encerrado no ano civil de hoje. */
  desligadosNoAno?: number;
  /**
   * T215 — ativos ao fim de cada um dos 6 meses até hoje (o mais antigo
   * primeiro; o atual fecha hoje), para o gráfico do cartão.
   */
  serieAtivos?: number[];
}

/** T199 — grupo da aba do dashboard (ausente: todos). */
export type GrupoColaboradores = "ativos" | "em_admissao" | "desligados";

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
  /**
   * T190 — pela lotação VIGENTE (regra da T184): só colaborador com vínculo
   * ativo cuja alocação aberta está neste departamento / cargo. Os dois
   * juntos valem na mesma alocação. Os contadores não mudam.
   */
  departamentoId?: string;
  cargoId?: string;
  /** T199 — grupo da aba, aplicado no servidor antes da paginação. */
  grupo?: GrupoColaboradores;
  /** T199 — tipo do vínculo que define o grupo (sem grupo: qualquer um). */
  tipoVinculo?: TipoVinculo;
  /**
   * T215 — os grupos da gaveta "Filtrar": dentro de um grupo vale qualquer
   * valor; entre grupos, todos. Lotação e nível pela lotação vigente (vínculo
   * ativo, regra da T190); tipo pelo vínculo do grupo; gênero pelo perfil.
   * Lista vazia não vai à query.
   */
  departamentos?: readonly string[];
  areas?: readonly string[];
  centrosCusto?: readonly string[];
  unidades?: readonly string[];
  cargos?: readonly string[];
  niveis?: readonly string[];
  tipos?: readonly string[];
  generos?: readonly string[];
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
  /** T209 — etapa 2: opcionais (ao menos uma referência da lotação). */
  departamentoId?: string;
  cargoId?: string;
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
   * OBRIGATÓRIO: o bloco `perfilPessoal` (T209 — a data de nascimento passou
   * a opcional). OPCIONAIS: os campos do perfil (`sexo` só com um código de
   * `OPCOES_SEXO`; T209 — CPF, RG, gênero e contato de emergência), o
   * `endereco` inteiro e os `contatos` — T179: cada contato vazio é omitido, e
   * o bloco inteiro some quando os três estão vazios.
   */
  perfilPessoal: Partial<
    Record<Exclude<keyof PerfilPessoalApi, "atualizadoEm">, string | null>
  >;
  endereco?: Record<Exclude<keyof EnderecoApi, "atualizadoEm">, string | null>;
  contatos?: { emailPessoal?: string; celular?: string; telefone?: string };
  /**
   * T183 — jornada de trabalho opcional (só o RH a envia): a vigência começa
   * na data de admissão. Ausente é "sem jornada".
   */
  tabelaHorarioId?: string;
  /** T209 — o contrato da admissão (etapa 2); ausente sem nenhum valor. */
  contrato?: ContratoAdmissaoApi;
}

/**
 * T209 — o contrato da admissão (etapa 2): nível, gestor direto, jornada
 * semanal, escala, salário bruto (reais, com ponto: "5000.00"), conselho e
 * registro profissional, dependentes para IRRF e pensão (percentual, com
 * ponto). Cada campo vazio é omitido.
 */
export interface ContratoAdmissaoApi {
  nivel?: string;
  gestorDiretoId?: string;
  jornadaSemanalHoras?: number;
  escala?: string;
  salarioBruto?: string;
  conselhoProfissional?: string;
  registroProfissional?: string;
  dependentesIrrf?: number;
  pensaoAlimenticiaPercentual?: string;
}

/** T209 — o contrato como o servidor o gravou (decimais em 2 casas). */
export type ContratoGravadoApi = {
  [K in keyof ContratoAdmissaoApi]-?: ContratoAdmissaoApi[K] | null;
};

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
  perfilPessoal: PerfilPessoalApi | null;
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
  /** T209 — o contrato da admissão, ou `null` sem nenhum valor. */
  contrato?: ContratoGravadoApi | null;
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

/**
 * T209 — opções da leitura: `signal` cancela a requisição (busca, filtro,
 * aba, página ou tamanho trocados, empresa trocada, tela desmontada).
 */
export interface OpcoesDaLeitura {
  readonly signal?: AbortSignal;
}

/** T215 — os grupos da gaveta, com os nomes dos parâmetros da API. */
const GRUPOS_DA_GAVETA = [
  "departamentos",
  "areas",
  "centrosCusto",
  "unidades",
  "cargos",
  "niveis",
  "tipos",
  "generos",
] as const satisfies readonly (keyof ListarColaboradoresQuery)[];

export async function listarColaboradores(
  query: ListarColaboradoresQuery = {},
  opcoes: OpcoesDaLeitura = {},
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
  if (query.departamentoId) params.set("departamentoId", query.departamentoId);
  if (query.cargoId) params.set("cargoId", query.cargoId);
  if (query.grupo) params.set("grupo", query.grupo);
  if (query.tipoVinculo) params.set("tipoVinculo", query.tipoVinculo);
  for (const grupo of GRUPOS_DA_GAVETA) {
    const lista = query[grupo];
    if (lista && lista.length > 0) params.set(grupo, lista.join(","));
  }
  if (query.pagina !== undefined) params.set("pagina", String(query.pagina));
  if (query.tamanhoPagina !== undefined)
    params.set("tamanhoPagina", String(query.tamanhoPagina));
  const qs = params.toString();
  const res = await apiFetch(
    `/colaboradores${qs ? `?${qs}` : ""}`,
    opcoes.signal ? { signal: opcoes.signal } : {},
  );
  return jsonOrThrow(res);
}

export async function buscarColaborador(id: string): Promise<ColaboradorApi> {
  const res = await apiFetch(`/colaboradores/${id}`);
  return jsonOrThrow(res);
}

export async function listarVinculosDoColaborador(
  colaboradorId: string,
): Promise<VinculoApi[]> {
  // Sem cache: a situação do vínculo muda na efetivação e no desligamento.
  const res = await apiFetch(`/colaboradores/${colaboradorId}/vinculos`, {
    cache: "no-store",
  });
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
  return (await enviarAdmissao(dto, opcoes)).admissao;
}

/** T209 (Bloco C) — a admissão e se ela já existia (reenvio da mesma chave). */
export interface AdmissaoEnviada {
  readonly admissao: AdmissaoRegistradaApi;
  /**
   * `true` quando o servidor devolveu a admissão já gravada com a mesma
   * chave (`Idempotent-Replayed: true`): nada novo foi criado.
   */
  readonly reenvio: boolean;
}

/** O mesmo envio de `admitirColaborador`, dizendo se foi reenvio. */
export async function enviarAdmissao(
  dto: AdmitirColaboradorDto,
  opcoes: OpcoesDaAdmissao = {},
): Promise<AdmissaoEnviada> {
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
  const admissao = await jsonOrThrow<AdmissaoRegistradaApi>(res);
  return {
    admissao,
    reenvio: res.headers?.get("Idempotent-Replayed") === "true",
  };
}

/**
 * T215 — o CPF já está cadastrado na empresa ativa? Conferido enquanto o RH
 * digita. O CPF vai no corpo, nunca na URL.
 */
export async function consultarCpfEmUso(
  cpf: string,
  ignorarColaboradorId?: string,
): Promise<boolean> {
  const token = await getCsrf();
  const res = await apiFetch("/colaboradores/cpf-em-uso", {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify({
      cpf,
      ...(ignorarColaboradorId ? { ignorarColaboradorId } : {}),
    }),
  });
  return (await jsonOrThrow<{ emUso: boolean }>(res)).emUso;
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

/**
 * T209 — rascunho da Nova admissão, guardado no servidor por conta e empresa
 * ativa (`/v1/admissoes/rascunho`). Só os valores do formulário — nunca foto
 * ou arquivo; o servidor recusa campo fora do contrato da admissão.
 */
export interface ReferenciaDoRascunhoApi {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface DadosDoRascunhoApi {
  readonly etapa?: number;
  readonly campos?: Readonly<Record<string, string>>;
  readonly perfil?: Readonly<Record<string, string>>;
  readonly endereco?: Readonly<Record<string, string>>;
  readonly contatos?: Readonly<Record<string, string>>;
  readonly referencias?: Readonly<
    Partial<
      Record<
        "departamento" | "cargo" | "unidade" | "centroCusto",
        ReferenciaDoRascunhoApi
      >
    >
  >;
}

export interface RascunhoAdmissaoApi {
  readonly dados: DadosDoRascunhoApi;
  readonly versao: number;
  readonly atualizadoEm: string;
}

const ROTA_RASCUNHO = "/admissoes/rascunho";

/** O rascunho da própria conta na empresa ativa, ou `null`. */
export async function obterRascunhoAdmissao(): Promise<RascunhoAdmissaoApi | null> {
  const res = await apiFetch(ROTA_RASCUNHO);
  const corpo = await jsonOrThrow<{ rascunho: RascunhoAdmissaoApi | null }>(
    res,
  );
  return corpo.rascunho;
}

/** Grava (ou substitui) o rascunho. Nunca admite ninguém. */
export async function salvarRascunhoAdmissao(
  dados: DadosDoRascunhoApi,
): Promise<{ versao: number; atualizadoEm: string }> {
  const token = await getCsrf();
  const res = await apiFetch(ROTA_RASCUNHO, {
    method: "PUT",
    headers: { "x-csrf-token": token },
    body: JSON.stringify({ dados }),
  });
  return jsonOrThrow(res);
}

/** Apaga o rascunho (sem rascunho, nada acontece). */
export async function descartarRascunhoAdmissao(): Promise<void> {
  const token = await getCsrf();
  const res = await apiFetch(ROTA_RASCUNHO, {
    method: "DELETE",
    headers: { "x-csrf-token": token },
  });
  if (!res.ok) await jsonOrThrow(res);
}

// ---- T209 — foto do colaborador (ADR 0020) --------------------------------

/** O que o servidor devolve ao gravar a foto: só a versão e a data. */
export interface FotoColaboradorGravadaApi {
  readonly versao: number;
  readonly atualizadoEm: string;
}

/** A extensão do nome do arquivo, sem o ponto, em minúsculas. */
function extensaoDoArquivo(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  return ponto === -1 ? "" : nome.slice(ponto + 1).toLowerCase();
}

/** T217 — tipo de cada extensão aceita nos documentos do colaborador. */
const TIPO_DA_EXTENSAO: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * T217 — o tipo declarado no envio: o do navegador ou, quando ele não
 * informa (comum com DOC e DOCX), o da extensão. O servidor confere o
 * conteúdo de qualquer forma.
 */
export function tipoDoArquivo(arquivo: File): string {
  return (
    arquivo.type || (TIPO_DA_EXTENSAO[extensaoDoArquivo(arquivo.name)] ?? "")
  );
}

/**
 * T209 — envia ou substitui a foto do colaborador
 * (`PUT /v1/colaboradores/:id/foto`). O corpo é o arquivo como veio; o tipo
 * declarado e a extensão vão em cabeçalhos para o servidor conferir com o
 * conteúdo. Recusa responde 422 com `codigo`, 413 acima de 5 MB; indisponível,
 * 503. 403 `csrf_invalido` (outra aba renovou o token): renova e reenvia uma
 * vez.
 */
export async function enviarFotoColaborador(
  colaboradorId: string,
  arquivo: File,
): Promise<FotoColaboradorGravadaApi> {
  const enviar = async () =>
    apiFetch(`/colaboradores/${encodeURIComponent(colaboradorId)}/foto`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-csrf-token": await getCsrf(),
        "x-evolli-foto-tipo": arquivo.type,
        "x-evolli-foto-extensao": extensaoDoArquivo(arquivo.name),
      },
      body: arquivo,
    });
  let res = await enviar();
  if (res.status === 403 && getCsrfToken() === null) {
    res = await enviar();
  }
  return jsonOrThrow<FotoColaboradorGravadaApi>(res);
}

// ---------------------------------------------------------------------------
// T213 — documentos do colaborador com arquivo (ADR 0021). O navegador nunca
// fala com o armazenamento: envio e download passam pela API autenticada.
// T217: o nome original vai num cabeçalho, só para exibição (o servidor o
// saneia); a conferência continua pela extensão, pelo tipo e pelo conteúdo.

export type CategoriaDocumentoColaborador =
  | "rg"
  | "cpf"
  | "comprovante_endereco"
  | "carteira_trabalho"
  | "certidoes"
  | "outros";

export type EstadoDocumentoColaborador =
  "em_verificacao" | "aprovado" | "reprovado";

/** T217 — formatos aceitos (DOC, DOCX e WebP desde a T217). */
export type FormatoDocumentoColaborador =
  "pdf" | "jpg" | "png" | "doc" | "docx" | "webp";

/** T217 — quem enviou a versão atual: nome de exibição (ou nulo) e papel. */
export interface EnviadoPorDocumentoApi {
  readonly nome: string | null;
  readonly papel: string;
}

export interface DocumentoColaboradorApi {
  readonly id: string;
  readonly categoria: CategoriaDocumentoColaborador;
  /** Nome curto de "outros" (nunca para o `master_tecnico`). */
  readonly nome: string | null;
  /** T217 — nome original do arquivo (nunca para o `master_tecnico`). */
  readonly nomeArquivo?: string | null;
  /** T217 — autor da versão atual. */
  readonly enviadoPor?: EnviadoPorDocumentoApi | null;
  readonly estado: EstadoDocumentoColaborador;
  readonly formato: FormatoDocumentoColaborador;
  readonly tamanhoBytes: number;
  readonly versao: number;
  readonly enviadoEm: string;
  readonly verificadoEm: string | null;
}

const rotaDosDocumentos = (colaboradorId: string) =>
  `/colaboradores/${encodeURIComponent(colaboradorId)}/documentos`;

export async function listarDocumentosDoColaborador(
  colaboradorId: string,
): Promise<DocumentoColaboradorApi[]> {
  const res = await apiFetch(rotaDosDocumentos(colaboradorId));
  return jsonOrThrow<DocumentoColaboradorApi[]>(res);
}

/** Um envio em binário, com nova tentativa única se o token CSRF mudou. */
async function enviarBinario(
  caminho: string,
  arquivo: File,
  cabecalhos: Record<string, string>,
): Promise<DocumentoColaboradorApi> {
  const enviar = async () =>
    apiFetch(caminho, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-csrf-token": await getCsrf(),
        "x-evolli-documento-tipo": tipoDoArquivo(arquivo),
        "x-evolli-documento-extensao": extensaoDoArquivo(arquivo.name),
        "x-evolli-documento-arquivo": encodeURIComponent(arquivo.name),
        ...cabecalhos,
      },
      body: arquivo,
    });
  let res = await enviar();
  if (res.status === 403 && getCsrfToken() === null) {
    res = await enviar();
  }
  return jsonOrThrow<DocumentoColaboradorApi>(res);
}

/**
 * Envia um documento novo (`POST /v1/colaboradores/:id/documentos`). A chave
 * de idempotência é a do arquivo escolhido: a nova tentativa não duplica.
 */
export function enviarDocumentoDoColaborador(
  colaboradorId: string,
  pedido: {
    readonly categoria: CategoriaDocumentoColaborador;
    readonly nome?: string;
    readonly arquivo: File;
    readonly chaveIdempotencia: string;
  },
): Promise<DocumentoColaboradorApi> {
  return enviarBinario(rotaDosDocumentos(colaboradorId), pedido.arquivo, {
    "x-evolli-documento-categoria": pedido.categoria,
    ...(pedido.nome
      ? { "x-evolli-documento-nome": encodeURIComponent(pedido.nome) }
      : {}),
    "Idempotency-Key": pedido.chaveIdempotencia,
  });
}

/** Troca o arquivo (versão nova; a anterior fica guardada). */
export function trocarDocumentoDoColaborador(
  colaboradorId: string,
  documentoId: string,
  arquivo: File,
  chaveIdempotencia: string,
): Promise<DocumentoColaboradorApi> {
  return enviarBinario(
    `${rotaDosDocumentos(colaboradorId)}/${encodeURIComponent(documentoId)}/versoes`,
    arquivo,
    { "Idempotency-Key": chaveIdempotencia },
  );
}

/** Nova tentativa do antivírus para o documento em verificação. */
export async function verificarDocumentoDeNovo(
  colaboradorId: string,
  documentoId: string,
): Promise<DocumentoColaboradorApi> {
  const res = await apiFetch(
    `${rotaDosDocumentos(colaboradorId)}/${encodeURIComponent(documentoId)}/verificacao`,
    { method: "POST", headers: { "x-csrf-token": await getCsrf() } },
  );
  return jsonOrThrow<DocumentoColaboradorApi>(res);
}

/** Remoção lógica do documento. */
export async function removerDocumentoDoColaborador(
  colaboradorId: string,
  documentoId: string,
): Promise<void> {
  const res = await apiFetch(
    `${rotaDosDocumentos(colaboradorId)}/${encodeURIComponent(documentoId)}`,
    { method: "DELETE", headers: { "x-csrf-token": await getCsrf() } },
  );
  if (!res.ok) await jsonOrThrow<unknown>(res);
}

/**
 * Lê o arquivo aprovado pela rota autenticada (nunca uma URL do
 * armazenamento): os bytes e o nome neutro do servidor.
 */
export async function obterArquivoDoDocumento(
  colaboradorId: string,
  documentoId: string,
): Promise<{ readonly blob: Blob; readonly nome: string }> {
  const res = await apiFetch(
    `${rotaDosDocumentos(colaboradorId)}/${encodeURIComponent(documentoId)}/arquivo`,
    { headers: { Accept: "*/*" } },
  );
  if (!res.ok) await jsonOrThrow<unknown>(res);
  const nome =
    /filename="([^"]+)"/.exec(
      res.headers.get("content-disposition") ?? "",
    )?.[1] ?? "documento";
  return { blob: await res.blob(), nome };
}

/** Abre o arquivo aprovado numa aba nova, a partir da memória do navegador. */
export async function verDocumentoDoColaborador(
  colaboradorId: string,
  documentoId: string,
): Promise<void> {
  const { blob } = await obterArquivoDoDocumento(colaboradorId, documentoId);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
