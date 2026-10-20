/**
 * Consulta de CEP (T178) — `GET /v1/cep/:cep`, preenchimento ASSISTIDO do
 * endereço na Nova admissão.
 *
 * Autorizado pela proprietária: "ViaCEP para preenchimento assistido de
 * endereço, somente para CEP brasileiro, com campos editáveis e cadastro
 * manual como alternativa". O navegador nunca fala com o fornecedor: quem
 * consulta é o servidor, que aplica limite, tempo máximo e o RBAC (só `rh` e
 * `dp`, quem admite).
 *
 * O que sai daqui é SÓ o CEP, no caminho: sem corpo, sem query, sem nenhum
 * dado da pessoa em admissão. `cache: "no-store"` porque a resposta não deve
 * ficar no cache HTTP do navegador — quem decide reaproveitar é o servidor.
 */
import { clearCsrfToken } from "./csrfClient";

/** Resposta 200: cada campo pode vir `null` (o fornecedor nem sempre sabe). */
export interface EnderecoDoCepApi {
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  /** Sigla de 2 letras (ex.: "MG"). */
  uf: string | null;
  /** Nome por extenso (ex.: "Minas Gerais"). */
  estado: string | null;
}

/**
 * Recusa com o status real. A mensagem é FIXA por status — o corpo do
 * servidor não é repassado à tela, que escreve a própria mensagem.
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

/** Forma aceita pela rota: exatamente 8 dígitos, já sem hífen. */
const CEP_OITO_DIGITOS = /^\d{8}$/;

/**
 * Consulta o CEP (8 dígitos, já normalizados por quem chama).
 *
 * Fora da forma, recusa como o servidor recusaria (400) SEM fazer a
 * requisição: não há por que gastar uma consulta limitada com o que o
 * servidor devolveria como inválido.
 */
export async function consultarCep(cep: string): Promise<EnderecoDoCepApi> {
  if (!CEP_OITO_DIGITOS.test(cep)) {
    throw new ApiError(400, "CEP fora da forma de 8 dígitos.");
  }
  const res = await fetch(`/v1/cep/${cep}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) clearCsrfToken();
  if (!res.ok) {
    throw new ApiError(res.status, `Consulta de CEP recusada (${res.status}).`);
  }
  return res.json() as Promise<EnderecoDoCepApi>;
}
