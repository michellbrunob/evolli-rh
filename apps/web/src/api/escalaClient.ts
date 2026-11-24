import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";
import { ApiError } from "./colaboradoresClient";

const BASE = "/v1";

/**
 * T215 — Escala do colaborador (aba Escala da ficha): o padrão de escala
 * com vigência `[início, fim)`. Dias da semana de 1 (segunda) a 7
 * (domingo); datas em dia civil `AAAA-MM-DD`.
 */
export interface TurnoDaEscalaApi {
  id: string;
  codigo: string | null;
  nome: string;
  ativo: boolean;
  periodos: { dia: string; inicio: string; fim: string }[];
}

export interface EscalaApi {
  id: string;
  modelo: string;
  /** `null` = sem turno fixo. */
  turno: TurnoDaEscalaApi | null;
  /** Só no 12x36: mês sim, mês não, os plantões usam este turno. */
  turnoNoite: TurnoDaEscalaApi | null;
  /** Só no 6x1. */
  folgaSemanal: number | null;
  /** Só em "outra". */
  diasTrabalho: number[];
  /** Revezamento, plantão e embarque. */
  inicioCiclo: string | null;
  vigenciaInicio: string;
  /** O primeiro dia SEM a escala; `null` = aberta. */
  vigenciaFim: string | null;
}

export interface EscalasDoColaboradorApi {
  colaboradorId: string;
  empresaId: string;
  vinculo: {
    dataAdmissao: string;
    situacao: "previsto" | "ativo" | "encerrado";
  };
  /** A escala do contrato (código do modelo), ou `null`. */
  escalaDoCadastro: string | null;
  /** Da mais nova para a mais antiga. */
  escalas: EscalaApi[];
}

export interface DefinirEscalaDto {
  modelo: string;
  tabelaHorarioId: string | null;
  turnoNoiteId?: string | null;
  folgaSemanal?: number;
  diasTrabalho?: number[];
  inicioCiclo?: string;
  vigenciaInicio: string;
}

const rota = (colaboradorId: string) =>
  `${BASE}/colaboradores/${encodeURIComponent(colaboradorId)}/escalas`;

async function enviar<T>(
  metodo: "GET" | "POST",
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

export function consultarEscalas(
  colaboradorId: string,
): Promise<EscalasDoColaboradorApi> {
  return enviar("GET", rota(colaboradorId));
}

/** Define (ou troca) o padrão; devolve a lista inteira. */
export function definirEscala(
  colaboradorId: string,
  dto: DefinirEscalaDto,
): Promise<EscalasDoColaboradorApi> {
  return enviar("POST", rota(colaboradorId), dto);
}

/** `vigenciaFim` é o PRIMEIRO dia sem a escala. */
export function encerrarEscala(
  colaboradorId: string,
  escalaId: string,
  vigenciaFim: string,
): Promise<EscalasDoColaboradorApi> {
  return enviar(
    "POST",
    `${rota(colaboradorId)}/${encodeURIComponent(escalaId)}/encerrar`,
    { vigenciaFim },
  );
}
