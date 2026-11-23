import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ContratoDoColaboradorApi,
  consultarContratoDoColaborador,
  registrarContratoDoColaborador,
} from "./edicaoColaboradorClient";
import { ApiError } from "./colaboradoresClient";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ID = "11111111-1111-4111-8111-111111111111";

const CONTRATO: ContratoDoColaboradorApi = {
  colaboradorId: ID,
  empresaId: "22222222-2222-4222-8222-222222222222",
  vinculo: {
    id: "33333333-3333-4333-8333-333333333333",
    matricula: "SINT-01",
    tipo: "clt",
    situacao: "ativo",
    dataAdmissao: "2026-01-10",
    dataDesligamento: null,
  },
  contrato: {
    nivel: "pleno",
    gestorDiretoId: null,
    jornadaSemanalHoras: 44,
    escala: "5x2",
    salarioBruto: "5000.00",
    conselhoProfissional: null,
    registroProfissional: null,
    dependentesIrrf: 0,
    pensaoAlimenticiaPercentual: null,
  },
  atualizadoEm: "2026-11-23T12:00:00.000Z",
};

describe("edicaoColaboradorClient (T215)", () => {
  beforeEach(() => clearCsrfToken());
  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it("consulta: GET do contrato do colaborador, sem cache e sem CSRF", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, CONTRATO));
    expect(await consultarContratoDoColaborador(ID)).toEqual(CONTRATO);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/v1/colaboradores/${ID}/contrato`);
    expect(init).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(init.headers).not.toHaveProperty("x-csrf-token");
  });

  it("consulta: 401 limpa o token e lança ApiError", async () => {
    setCsrfToken("token-antigo");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(401, { message: "Não autorizado." }),
    );
    const erro = await consultarContratoDoColaborador(ID).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(401);
    expect(getCsrfToken()).toBeNull();
  });

  it("registra: PUT com o token CSRF e o corpo; devolve o gravado", async () => {
    setCsrfToken("token-sintetico");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, CONTRATO));
    const dto = { salarioBruto: "5000.00", matricula: "SINT-01" };
    expect(await registrarContratoDoColaborador(ID, dto)).toEqual(CONTRATO);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/v1/colaboradores/${ID}/contrato`);
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ "x-csrf-token": "token-sintetico" });
    expect(JSON.parse(init.body as string)).toEqual(dto);
  });

  it("registra: recusa por campo chega no ApiError, sem o valor", async () => {
    setCsrfToken("token-sintetico");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(409, {
        message: "Conflito.",
        erros: [{ campo: "matricula", motivo: "em_uso" }],
      }),
    );
    const erro = (await registrarContratoDoColaborador(ID, {
      matricula: "SINT-02",
    }).catch((e: unknown) => e)) as ApiError;
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.status).toBe(409);
    expect(erro.erros).toEqual([{ campo: "matricula", motivo: "em_uso" }]);
  });
});
