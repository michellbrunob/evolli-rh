import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import { ApiError } from "./colaboradoresClient";

const BASE = "/v1";

/**
 * Dados pessoais e endereço do colaborador (T177, Módulo 1). Espelha a
 * resposta de `GET /v1/colaboradores/:colaboradorId/dados-pessoais`.
 *
 * A data de nascimento vem como dia civil `AAAA-MM-DD` e é obrigatória: todo
 * perfil gravado a tem. Os demais campos são opcionais. Toda leitura é
 * auditada no servidor; `no-store` impede cache do navegador.
 */
export interface PerfilPessoalApi {
  dataNascimento: string;
  /**
   * T179 — código de `OPCOES_SEXO` (`feminino`, `masculino`, `intersexo`,
   * `nao_informar`), `null` quando não informado, ou o texto livre de um
   * cadastro anterior à lista fechada, que a ficha mostra como veio.
   */
  sexo: string | null;
  saudacao: string | null;
  estadoCivil: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  escolaridade: string | null;
  curso: string | null;
  nomePai: string | null;
  nomeMae: string | null;
  atualizadoEm: string;
}

export interface EnderecoApi {
  pais: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  atualizadoEm: string;
}

export type SituacaoDadosPessoaisApi =
  "sem_registro" | "registrado" | "bloqueado";

export interface DadosPessoaisDoColaboradorApi {
  colaboradorId: string;
  empresaId: string;
  situacao: SituacaoDadosPessoaisApi;
  perfilPessoal: PerfilPessoalApi | null;
  endereco: EnderecoApi | null;
}

export async function consultarDadosPessoaisDoColaborador(
  colaboradorId: string,
): Promise<DadosPessoaisDoColaboradorApi> {
  const res = await fetch(
    `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/dados-pessoais`,
    {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );
  if (res.status === 401) clearCsrfToken();
  if (!res.ok) {
    throw new ApiError(res.status, "Erro na requisição.");
  }
  return res.json() as Promise<DadosPessoaisDoColaboradorApi>;
}

/**
 * T181 — corpo de `PUT /v1/colaboradores/:colaboradorId/dados-pessoais`. Cada
 * bloco ENVIADO substitui o registro inteiro (o vazio vai `null`); o bloco
 * ausente fica como está. A ficha salva um bloco por vez.
 */
export interface RegistrarDadosPessoaisDto {
  perfilPessoal?: Omit<PerfilPessoalApi, "atualizadoEm">;
  endereco?: Omit<EnderecoApi, "atualizadoEm">;
}

/**
 * T181 — grava os dados pessoais e/ou o endereço do colaborador na empresa
 * ativa, e devolve o que o servidor gravou (a mesma forma da leitura).
 *
 * Mesmo desenho dos contatos: o token vem de `tokenCsrfParaGravacao` (rede
 * caída ao renová-lo vira `CsrfRequestError`, e a gravação nem sai); 403
 * `csrf_invalido` descarta o token desta aba; o corpo da recusa segue no
 * `ApiError`, que lê só `erros` e `codigo`.
 */
export async function registrarDadosPessoaisDoColaborador(
  colaboradorId: string,
  dto: RegistrarDadosPessoaisDto,
): Promise<DadosPessoaisDoColaboradorApi> {
  const token = await tokenCsrfParaGravacao();
  const res = await fetch(
    `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/dados-pessoais`,
    {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-csrf-token": token,
      },
      body: JSON.stringify(dto),
    },
  );
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const corpo: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", corpo);
  }
  return res.json() as Promise<DadosPessoaisDoColaboradorApi>;
}
