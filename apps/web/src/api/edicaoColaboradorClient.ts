import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import {
  ApiError,
  type ContratoGravadoApi,
  type SituacaoVinculo,
  type TipoVinculo,
} from "./colaboradoresClient";

const BASE = "/v1";

/**
 * T215 — o vínculo principal como a edição do colaborador o recebe: a
 * matrícula (editável) e o resto só leitura. Datas em dia civil `AAAA-MM-DD`.
 */
export interface VinculoDoContratoApi {
  id: string;
  matricula: string | null;
  tipo: TipoVinculo;
  situacao: SituacaoVinculo;
  dataAdmissao: string;
  dataDesligamento: string | null;
}

/**
 * T215 — resposta de `GET`/`PUT /v1/colaboradores/:colaboradorId/contrato`:
 * o contrato do vínculo principal na empresa ativa. Sem linha gravada, todos
 * os campos do contrato vêm `null` e `atualizadoEm` também.
 */
export interface ContratoDoColaboradorApi {
  colaboradorId: string;
  empresaId: string;
  vinculo: VinculoDoContratoApi;
  contrato: ContratoGravadoApi;
  atualizadoEm: string | null;
}

/**
 * T215 — corpo do `PUT`: o bloco inteiro do contrato substitui o gravado
 * (ausente e `null` limpam). A matrícula AUSENTE mantém a gravada; `null`
 * apaga; texto segue o padrão da admissão e é única na empresa (409 por
 * campo `matricula`/`em_uso`). Gestor direto de fora da empresa, inexistente
 * ou a própria pessoa: 422 por campo `gestorDiretoId`/`indisponivel`.
 */
export interface RegistrarContratoDto {
  nivel?: string | null;
  gestorDiretoId?: string | null;
  jornadaSemanalHoras?: number | null;
  escala?: string | null;
  salarioBruto?: string | null;
  conselhoProfissional?: string | null;
  registroProfissional?: string | null;
  dependentesIrrf?: number | null;
  pensaoAlimenticiaPercentual?: string | null;
  matricula?: string | null;
}

function rotaDoContrato(colaboradorId: string): string {
  return `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/contrato`;
}

/** Lê o contrato do vínculo principal (RH, DP e, só leitura, master técnico). */
export async function consultarContratoDoColaborador(
  colaboradorId: string,
): Promise<ContratoDoColaboradorApi> {
  const res = await fetch(rotaDoContrato(colaboradorId), {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) clearCsrfToken();
  if (!res.ok) {
    throw new ApiError(res.status, "Erro na requisição.");
  }
  return res.json() as Promise<ContratoDoColaboradorApi>;
}

/**
 * Grava o contrato (e a matrícula) do vínculo principal, e devolve o que o
 * servidor gravou. Mesmo desenho dos dados pessoais: o token vem de
 * `tokenCsrfParaGravacao`; 403 `csrf_invalido` descarta o token desta aba; o
 * corpo da recusa segue no `ApiError`, que lê só `erros` e `codigo`.
 */
export async function registrarContratoDoColaborador(
  colaboradorId: string,
  dto: RegistrarContratoDto,
): Promise<ContratoDoColaboradorApi> {
  const token = await tokenCsrfParaGravacao();
  const res = await fetch(rotaDoContrato(colaboradorId), {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-csrf-token": token,
    },
    body: JSON.stringify(dto),
  });
  if (res.status === 401) clearCsrfToken();
  await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const corpo: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", corpo);
  }
  return res.json() as Promise<ContratoDoColaboradorApi>;
}
