/**
 * Cliente da administração do escopo do gestor (T157) — RH.
 *
 * Fala com as rotas que a T151 entregou e com mais nenhuma:
 *
 *   POST  /v1/gestor/administracao/ligacoes
 *   PATCH /v1/gestor/administracao/ligacoes/:ligacaoId/encerrar
 *   GET   /v1/gestor/administracao/ligacoes
 *   POST  /v1/gestor/administracao/atribuicoes
 *   PATCH /v1/gestor/administracao/atribuicoes/:atribuicaoId/encerrar
 *   GET   /v1/gestor/administracao/atribuicoes
 *
 * **As três rotas de `excecoes` existem no servidor e NÃO têm função aqui.**
 * Não é esquecimento: `motivoCodigo` é catálogo fechado cujo conteúdo depende
 * de validação com RH (ADR 0015, decisão 9). Escrever o cliente antes dessa
 * decisão obrigaria a escolher quais motivos oferecer — que é exatamente a
 * decisão que não é nossa.
 *
 * **Não existe `DELETE` em lugar nenhum.** Encerrar é preencher `vigenciaFim`,
 * nunca apagar: o histórico de quem respondeu pelo quê e quando é a evidência
 * que a decisão 8 da ADR 0015 exige. O servidor também não oferece a rota.
 *
 * **Nenhuma função aceita `empresaId`.** A empresa vem sempre da sessão, no
 * servidor. Mandar empresa pelo corpo seria oferecer ao cliente a escolha da
 * fronteira de autorização — e o backend ignoraria, o que é pior: pareceria
 * funcionar.
 *
 * Segue o molde dos demais clientes (`vinculoHorarioClient`, `usersClient`):
 * `BASE` local, `apiFetch` local, `ApiError` local. A duplicação é a convenção
 * vigente — não existe módulo HTTP compartilhado em `apps/web/src/api`.
 */
import { clearCsrfToken, getCsrfToken, refreshCsrfToken } from "./csrfClient";
import {
  listarColaboradores,
  type ColaboradorApi,
} from "./colaboradoresClient";
import { listarEquipes, type EquipeApi } from "./organizacaoClient";
import { listarUsuarios, type SafeAccessUserApi } from "./usersClient";

const BASE = "/v1";
const ADMIN = `${BASE}/gestor/administracao`;

/**
 * Papéis a que o RBAC concede `gestor_atribuicao`.
 *
 * Espelha `evaluateGestor` em `rbac.evaluator.ts`: existe **um** `case`
 * concessivo, `rh`, e ele vale só na própria empresa. `master_tecnico` é
 * negado de propósito — não tem empresa, e toda consulta aqui parte da empresa
 * do ator. Manter a lista como constante exportada permite que o teste a
 * prenda: acrescentar papel aqui sem o servidor conceder produziria uma tela
 * que carrega e responde 403.
 */
export const PAPEIS_COM_ADMINISTRACAO_DE_LIDERANCA: readonly string[] = ["rh"];

/** Papéis aceitos em `papel` pela `CriarAtribuicaoDto` do servidor. */
export const PAPEIS_GESTOR_EQUIPE = ["principal", "substituto"] as const;
export type PapelGestorEquipe = (typeof PAPEIS_GESTOR_EQUIPE)[number];

/**
 * Erro de API deste módulo.
 *
 * Carrega `status` e a mensagem do servidor quando ela existe. Quem fizer
 * `catch` precisa importar esta classe DESTE arquivo: há mais de dez
 * `ApiError` homônimas e independentes no frontend, e `instanceof` falha em
 * silêncio entre elas.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Ligação conta de acesso ↔ colaborador, como a projeção do servidor a
 * devolve: cinco campos, só identificadores e vigência.
 *
 * `criadoPorUserId` e `encerradoPorUserId` **não** vêm, por decisão do
 * servidor: autoria de configuração é dado de trilha, e quem precisa dela
 * consulta a auditoria — onde a própria leitura fica registrada.
 */
export interface LigacaoApi {
  id: string;
  userId: string;
  colaboradorId: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

/** Atribuição gestor ↔ equipe, com papel e vigência. */
export interface AtribuicaoApi {
  id: string;
  equipeId: string;
  gestorColaboradorId: string;
  papel: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

/** Espelha `VincularContaDto`. Datas em `AAAA-MM-DD`, sem hora. */
export interface VincularContaDto {
  userId: string;
  colaboradorId: string;
  vigenciaInicio: string;
}

/** Espelha `CriarAtribuicaoDto`. `vigenciaFim` é opcional só aqui. */
export interface CriarAtribuicaoDto {
  equipeId: string;
  gestorColaboradorId: string;
  papel: PapelGestorEquipe;
  vigenciaInicio: string;
  vigenciaFim?: string;
}

/**
 * Espelha `EncerrarVigenciaDto`: `vigenciaFim` é **obrigatória**.
 *
 * Não existe "encerrar agora" implícito. O dia em que alguém deixa de ver
 * outra pessoa é decisão de quem administra, não do relógio do servidor.
 */
export interface EncerrarVigenciaDto {
  vigenciaFim: string;
}

export interface ListarAtribuicoesQuery {
  equipeId?: string;
}

async function getCsrf(): Promise<string> {
  return getCsrfToken() ?? refreshCsrfToken();
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(path, {
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
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Ligação conta ↔ colaborador
// ---------------------------------------------------------------------------

/**
 * Lista as ligações da empresa do ator.
 *
 * **Devolve array simples, sem envelope de paginação** — é o contrato do
 * servidor (`listarLigacoes` faz `findMany` e mapeia). Não há `pagina`,
 * `total` nem `cursor` a consumir, e inventar o parâmetro responderia 400
 * (`whitelist` + `forbidNonWhitelisted` no `ValidationPipe` global).
 */
export async function listarLigacoes(): Promise<LigacaoApi[]> {
  const res = await apiFetch(`${ADMIN}/ligacoes`);
  return jsonOrThrow(res);
}

export async function vincularConta(
  dto: VincularContaDto,
): Promise<LigacaoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`${ADMIN}/ligacoes`, {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function encerrarLigacao(
  ligacaoId: string,
  dto: EncerrarVigenciaDto,
): Promise<LigacaoApi> {
  const token = await getCsrf();
  const res = await apiFetch(
    `${ADMIN}/ligacoes/${encodeURIComponent(ligacaoId)}/encerrar`,
    {
      method: "PATCH",
      headers: { "x-csrf-token": token },
      body: JSON.stringify(dto),
    },
  );
  return jsonOrThrow(res);
}

// ---------------------------------------------------------------------------
// Atribuição gestor ↔ equipe
// ---------------------------------------------------------------------------

/** Também array simples: o servidor não pagina esta rota. */
export async function listarAtribuicoes(
  query: ListarAtribuicoesQuery = {},
): Promise<AtribuicaoApi[]> {
  const params = new URLSearchParams();
  if (query.equipeId) params.set("equipeId", query.equipeId);
  const qs = params.toString();
  const res = await apiFetch(`${ADMIN}/atribuicoes${qs ? `?${qs}` : ""}`);
  return jsonOrThrow(res);
}

export async function criarAtribuicao(
  dto: CriarAtribuicaoDto,
): Promise<AtribuicaoApi> {
  const token = await getCsrf();
  const res = await apiFetch(`${ADMIN}/atribuicoes`, {
    method: "POST",
    headers: { "x-csrf-token": token },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function encerrarAtribuicao(
  atribuicaoId: string,
  dto: EncerrarVigenciaDto,
): Promise<AtribuicaoApi> {
  const token = await getCsrf();
  const res = await apiFetch(
    `${ADMIN}/atribuicoes/${encodeURIComponent(atribuicaoId)}/encerrar`,
    {
      method: "PATCH",
      headers: { "x-csrf-token": token },
      body: JSON.stringify(dto),
    },
  );
  return jsonOrThrow(res);
}

// ---------------------------------------------------------------------------
// Catálogos de apoio — paginados, consumidos ATÉ O FIM
// ---------------------------------------------------------------------------

/**
 * Teto de voltas dos laços de paginação.
 *
 * Não é limite de negócio: é o que impede um servidor que devolvesse sempre o
 * mesmo cursor, ou um `total` incoerente com a página, de virar laço infinito
 * no navegador. Com `tamanhoPagina` 100, cobre 5.000 registros por catálogo.
 * Estourar o teto é condição de erro declarada, nunca truncamento silencioso —
 * foi exatamente o truncamento silencioso que a T156 registrou como defeito
 * nas telas existentes.
 */
const MAXIMO_DE_PAGINAS = 50;
const TAMANHO_PAGINA = 100;

export class CatalogoIncompletoError extends Error {
  constructor(readonly catalogo: string) {
    super(
      `A lista de ${catalogo} é grande demais para ser carregada por completo nesta tela.`,
    );
    this.name = "CatalogoIncompletoError";
  }
}

/**
 * Contas de acesso da empresa, por cursor (`GET /v1/users`, T120).
 *
 * Keyset puro: sem `total` e sem offset. O laço segue `nextCursor` até ele vir
 * `null`, que é a única forma de saber que acabou.
 */
export async function carregarTodasAsContas(): Promise<SafeAccessUserApi[]> {
  const todas: SafeAccessUserApi[] = [];
  let cursor: string | undefined;
  for (let volta = 0; volta < MAXIMO_DE_PAGINAS; volta += 1) {
    // `cursor` entra só quando existe: com `exactOptionalPropertyTypes`, uma
    // propriedade opcional recebendo `undefined` explícito é erro de tipo — e
    // mandar `cursor=undefined` na query seria pedir a primeira página de novo.
    const pagina = await listarUsuarios({
      limit: TAMANHO_PAGINA,
      ...(cursor ? { cursor } : {}),
    });
    todas.push(...pagina.items);
    if (!pagina.nextCursor) return todas;
    cursor = pagina.nextCursor;
  }
  throw new CatalogoIncompletoError("contas de acesso");
}

/**
 * Colaboradores da empresa (`GET /v1/colaboradores`).
 *
 * Envelope por offset: `{itens, total, pagina, tamanhoPagina}`. O laço para
 * quando já acumulou `total`, ou quando a página volta vazia — a segunda
 * condição protege contra `total` maior que o conjunto realmente paginável.
 */
export async function carregarTodosOsColaboradores(): Promise<
  ColaboradorApi[]
> {
  const todos: ColaboradorApi[] = [];
  for (let pagina = 1; pagina <= MAXIMO_DE_PAGINAS; pagina += 1) {
    const resposta = await listarColaboradores({
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
    });
    todos.push(...resposta.itens);
    if (resposta.itens.length === 0 || todos.length >= resposta.total) {
      return todos;
    }
  }
  throw new CatalogoIncompletoError("colaboradores");
}

/** Equipes da empresa (`GET /v1/equipes`), mesmo envelope por offset. */
export async function carregarTodasAsEquipes(): Promise<EquipeApi[]> {
  const todas: EquipeApi[] = [];
  for (let pagina = 1; pagina <= MAXIMO_DE_PAGINAS; pagina += 1) {
    const resposta = await listarEquipes({
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
    });
    todas.push(...resposta.itens);
    if (resposta.itens.length === 0 || todas.length >= resposta.total) {
      return todas;
    }
  }
  throw new CatalogoIncompletoError("equipes");
}
