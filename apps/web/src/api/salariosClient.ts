import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import { ApiError } from "./colaboradoresClient";

const BASE = "/v1";

/**
 * T215 — Salários: a linha do tempo salarial do colaborador (aba Salários da
 * ficha). Datas em dia civil `AAAA-MM-DD`; valores em reais com ponto e 2
 * casas ("1621.00").
 */
export interface AlteracaoSalarialApi {
  id: string;
  origem: "admissao" | "alteracao";
  vigenciaInicio: string;
  /** Véspera do período seguinte; `null` no vigente. */
  vigenciaFim: string | null;
  salarioBruto: string;
  cargo: string | null;
  modeloContrato: string | null;
  vigente: boolean;
}

export interface HistoricoSalarialApi {
  colaboradorId: string;
  empresaId: string;
  vinculo: {
    id: string;
    tipo: string;
    situacao: "previsto" | "ativo" | "encerrado";
    dataAdmissao: string;
  };
  dependentesIrrf: number | null;
  pensaoAlimenticiaPercentual: string | null;
  /** Da mais nova para a mais antiga; a primeira é a vigente. */
  alteracoes: AlteracaoSalarialApi[];
}

export interface GravarAlteracaoSalarialDto {
  vigenciaInicio: string;
  salarioBruto: string;
  cargo: string | null;
  modeloContrato: string | null;
}

const rota = (colaboradorId: string) =>
  `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/salarios`;

async function enviar<T>(
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  corpo?: unknown,
): Promise<T> {
  const token = metodo === "GET" ? null : await tokenCsrfParaGravacao();
  const res = await fetch(url, {
    method: metodo,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token !== null ? { "x-csrf-token": token } : {}),
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  if (res.status === 401) clearCsrfToken();
  if (token !== null) await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  return res.json() as Promise<T>;
}

export function consultarHistoricoSalarial(
  colaboradorId: string,
): Promise<HistoricoSalarialApi> {
  return enviar("GET", rota(colaboradorId));
}

/** Registra uma alteração; devolve a linha do tempo já reorganizada. */
export function registrarAlteracaoSalarial(
  colaboradorId: string,
  dto: GravarAlteracaoSalarialDto,
): Promise<HistoricoSalarialApi> {
  return enviar("POST", rota(colaboradorId), dto);
}

export function atualizarAlteracaoSalarial(
  colaboradorId: string,
  alteracaoId: string,
  dto: GravarAlteracaoSalarialDto,
): Promise<HistoricoSalarialApi> {
  return enviar(
    "PUT",
    `${rota(colaboradorId)}/${encodeURIComponent(alteracaoId)}`,
    dto,
  );
}

/** Remove (só logicamente); a linha da admissão não se remove. */
export function removerAlteracaoSalarial(
  colaboradorId: string,
  alteracaoId: string,
): Promise<HistoricoSalarialApi> {
  return enviar(
    "DELETE",
    `${rota(colaboradorId)}/${encodeURIComponent(alteracaoId)}`,
  );
}
