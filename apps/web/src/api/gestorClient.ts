/**
 * Cliente da consulta consultiva do gestor (T153) — SOMENTE LEITURA.
 *
 * Fala com as duas rotas que a T151 entregou e com mais nenhuma:
 *
 *   GET /v1/gestor/equipe
 *   GET /v1/gestor/equipe/vinculos/:vinculoId
 *
 * **Não existe função de mutação neste módulo, e isso não é omissão.** O
 * `GestorConsultaController` tem só `@Get`, e o RBAC concede apenas `read` em
 * `gestor_equipe` — a ausência de rota e a ausência de permissão se confirmam
 * mutuamente (ADR 0015, `PD-SOL-01`). Acrescentar um `POST` aqui seria
 * escrever um cliente para uma porta que não existe.
 *
 * **Nenhuma das duas funções aceita data, e isso é a fronteira de uma falha
 * de autorização real já corrigida no servidor.** `ConsultaEquipeQueryDto` é
 * uma classe vazia de propósito: com `whitelist` e `forbidNonWhitelisted`
 * ligados no `ValidationPipe` global, QUALQUER query string — inclusive
 * `?dataReferencia=` — responde **400**. Quem pergunta não escolhe em que data
 * é autorizado (ADR 0015, decisão 8). Por isso este módulo não monta query:
 * não há `montarQuery` aqui, e acrescentá-lo quebraria as duas chamadas.
 *
 * Segue o molde dos demais clientes do projeto (`usersClient`,
 * `documentosClient`): `BASE` local, `apiFetch` local, `ApiError` local. A
 * duplicação é a convenção vigente — não existe módulo HTTP compartilhado em
 * `apps/web/src/api`, e criar um seria refatorar 14 arquivos fora do escopo
 * desta tarefa.
 */
import { clearCsrfToken } from "./csrfClient";

const BASE = "/v1";

/**
 * Erro de API deste módulo.
 *
 * Carrega o `status` e uma mensagem **nossa**, nunca a do servidor: quem fizer
 * `catch` precisa importar esta classe DESTE arquivo, senão `instanceof` falha
 * em silêncio (há mais de dez `ApiError` homônimas e independentes no
 * frontend).
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

/** Referência a um nó organizacional, como a projeção fechada a devolve. */
export interface ReferenciaNomeadaApi {
  id: string;
  nome: string;
}

/**
 * Lotação vigente na data de referência do servidor.
 *
 * Os três nós são anuláveis de forma independente: a alocação pode existir
 * sem equipe, sem departamento ou sem unidade.
 */
export interface LotacaoVigenteApi {
  equipe: ReferenciaNomeadaApi | null;
  departamento: ReferenciaNomeadaApi | null;
  unidadeOrganizacional: ReferenciaNomeadaApi | null;
  vigenteDe: string;
}

/**
 * Um vínculo dentro do escopo do gestor.
 *
 * São **exatamente** os dez campos da projeção fechada da decisão 7 (ADR
 * 0015), produzidos por `comoItem` no servidor. Acrescentar campo aqui não
 * revela nada — o servidor simplesmente não o manda —, mas desalinha o tipo
 * do contrato e convida a tela a exibir `undefined`.
 *
 * `situacaoVinculo` é a situação do VÍNCULO, nunca a do colaborador: aquela é
 * agregada de todos os vínculos, inclusive de outras empresas, e revelaria
 * vínculo alheio por inferência.
 */
export interface MembroEquipeApi {
  vinculoId: string;
  colaboradorId: string;
  nome: string;
  matricula: string;
  situacaoVinculo: string;
  tipoVinculo: string;
  /** `YYYY-MM-DD`. */
  dataAdmissao: string;
  /** `YYYY-MM-DD`, ou `null` enquanto o vínculo estiver ativo. */
  dataDesligamento: string | null;
  cargoVigente: ReferenciaNomeadaApi | null;
  lotacaoVigente: LotacaoVigenteApi | null;
}

/**
 * Resposta da lista.
 *
 * `dataReferencia` é **informativa**: é o dia civil em `America/Sao_Paulo` que
 * o servidor usou para resolver o escopo, lido do relógio dele uma única vez
 * por requisição. A interface a exibe para que o gestor saiba a que momento a
 * resposta se refere — e não oferece nenhum jeito de mudá-la.
 */
export interface EquipeApi {
  dataReferencia: string;
  itens: MembroEquipeApi[];
}

/** Horário vigente do colaborador na data de referência. */
export interface HorarioVigenteApi {
  tabelaId: string;
  nome: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

/**
 * Detalhe de um vínculo do escopo.
 *
 * É o item da lista mais `horarioVigente`, e mais dois campos que o servidor
 * devolve **sempre `null`, de propósito**: `resumoJornada` e
 * `andamentoSolicitacoes`. Eles existem no contrato para que o cliente não
 * precise adivinhar se a capacidade existe e falhou ou se nunca existiu —
 * `DP-3J-12` e `PD-SOL-05` seguem pendentes, sem contrato seguro. A tela
 * honra isso **não desenhando nada** para eles: nem cartão vazio, nem
 * "em breve", nem placeholder.
 */
export interface DetalheVinculoApi extends MembroEquipeApi {
  dataReferencia: string;
  horarioVigente: HorarioVigenteApi | null;
  resumoJornada: null;
  andamentoSolicitacoes: null;
}

async function apiFetch(path: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    // Só GET: nenhum cabeçalho CSRF, porque nenhuma destas chamadas muda
    // estado. `getCsrf` nem é importado aqui.
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) {
    clearCsrfToken();
  }
  return res;
}

/**
 * Converte a resposta, ou lança com uma mensagem **nossa**.
 *
 * O corpo de erro do servidor nunca é lido nem repassado. Isso não é só
 * higiene: o `AllExceptionsFilter` devolve `status_code`, `message`,
 * `request_id` e `timestamp`, e exibir qualquer um deles na tela entregaria
 * detalhe interno a quem não precisa. A mensagem que a pessoa vê é escrita
 * aqui, por status.
 */
async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    throw new ApiError(res.status, fallback);
  }
  return (await res.json()) as T;
}

/**
 * Lista os colaboradores dentro do escopo do gestor na data do servidor.
 *
 * Lista vazia é **resultado**, não erro: conta sem ligação à pessoa, pessoa
 * sem atribuição vigente ou equipe sem gente produzem `itens: []` com 200. A
 * tela precisa explicar isso — a ADR 0015 antecipou que pareceria "quebrado"
 * até o RH configurar.
 */
export async function listarEquipe(): Promise<EquipeApi> {
  const res = await apiFetch("/gestor/equipe");
  return jsonOrThrow<EquipeApi>(res, "Não foi possível carregar sua equipe.");
}

/**
 * Detalha um vínculo do escopo.
 *
 * **404 é indistinguível entre "não existe", "é de outra equipe" e "é de outra
 * empresa"** — e é assim de propósito, por anti-enumeração: 403 confirmaria
 * que o vínculo existe. Quem chama não deve tentar distinguir, e a mensagem
 * devolvida aqui também não distingue.
 */
export async function detalharVinculo(
  vinculoId: string,
): Promise<DetalheVinculoApi> {
  const res = await apiFetch(
    `/gestor/equipe/vinculos/${encodeURIComponent(vinculoId)}`,
  );
  if (res.status === 404) {
    throw new ApiError(404, "Este registro não está disponível para consulta.");
  }
  return jsonOrThrow<DetalheVinculoApi>(
    res,
    "Não foi possível carregar o detalhe.",
  );
}
