import { clearCsrfToken } from "./csrfClient";
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
