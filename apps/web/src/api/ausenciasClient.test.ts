import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AusenciaApi,
  aprovarAusencia,
  cancelarAusencia,
  consultarFeriasDoColaborador,
  listarAusencias,
  recusarAusencia,
  registrarAusencia,
  simularAusencia,
} from "./ausenciasClient";
import { ApiError } from "./colaboradoresClient";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const COLABORADOR = "11111111-1111-4111-8111-111111111111";
const AUSENCIA = "22222222-2222-4222-8222-222222222222";

const ITEM: AusenciaApi = {
  id: AUSENCIA,
  colaborador: {
    id: COLABORADOR,
    nome: "Pessoa Sintética",
    cargo: "Analista",
    foto: null,
  },
  tipo: "ferias",
  motivoAfastamento: null,
  inicio: "2027-01-05",
  fim: "2027-01-24",
  dias: 20,
  diasUteis: 14,
  diasVendidos: 0,
  periodoAquisitivo: { inicio: "2026-01-01", fim: "2026-12-31" },
  status: "aprovada",
  observacao: null,
  registradoEm: "2026-11-23T12:00:00.000Z",
  decididoEm: "2026-11-23T12:00:00.000Z",
};

describe("ausenciasClient (T215)", () => {
  beforeEach(() => clearCsrfToken());
  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it("lista: GET com os filtros na query, sem cache e sem CSRF", async () => {
    const corpo = {
      itens: [ITEM],
      pagina: 1,
      tamanhoPagina: 20,
      total: 1,
      indicadores: {
        emFeriasAgora: 0,
        licencasEAfastamentos: 0,
        faltasEsteMes: 0,
        proximasFerias: 1,
        pendentes: 0,
      },
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, corpo));
    expect(
      await listarAusencias({
        pagina: 1,
        tamanhoPagina: 20,
        busca: "pessoa",
        periodo: "proximas_ferias",
        tipo: "ferias",
        status: "aguardando_voce",
      }),
    ).toEqual(corpo);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(
      "/v1/ausencias?pagina=1&tamanhoPagina=20&busca=pessoa&periodo=proximas_ferias&tipo=ferias&status=aguardando_voce",
    );
    expect(init).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(init.headers).not.toHaveProperty("x-csrf-token");
  });

  it("lista: 401 limpa o token e lança ApiError", async () => {
    setCsrfToken("token-antigo");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(401, { message: "Não autorizado." }),
    );
    const erro = await listarAusencias({}).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(401);
    expect(getCsrfToken()).toBeNull();
  });

  it("registra: POST com o token CSRF e o corpo; recusa por campo no ApiError", async () => {
    setCsrfToken("token-sintetico");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(201, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(409, {
          message: "Conflito.",
          erros: [{ campo: "inicio", motivo: "sobreposicao" }],
        }),
      );
    const dto = {
      colaboradorId: COLABORADOR,
      tipo: "ferias" as const,
      inicio: "2027-01-05",
      fim: "2027-01-24",
      aprovada: true,
    };
    expect(await registrarAusencia(dto)).toEqual(ITEM);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/v1/ausencias");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "x-csrf-token": "token-sintetico" });
    expect(JSON.parse(init.body as string)).toEqual(dto);

    const erro = (await registrarAusencia(dto).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(erro.status).toBe(409);
    expect(erro.erros).toEqual([{ campo: "inicio", motivo: "sobreposicao" }]);
  });

  it.each([
    ["aprovar", () => aprovarAusencia(AUSENCIA), undefined],
    [
      "recusar",
      () => recusarAusencia(AUSENCIA, "Motivo sintético"),
      { motivo: "Motivo sintético" },
    ],
    ["cancelar", () => cancelarAusencia(AUSENCIA), undefined],
  ] as const)("%s: POST na ação, com CSRF", async (acao, chamar, corpo) => {
    setCsrfToken("token-sintetico");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, ITEM));
    expect(await chamar()).toEqual(ITEM);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/v1/ausencias/${AUSENCIA}/${acao}`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "x-csrf-token": "token-sintetico" });
    if (corpo) expect(JSON.parse(init.body as string)).toEqual(corpo);
    else expect(init.body).toBeUndefined();
  });

  it("simula: GET com a consulta; sem CSRF", async () => {
    const simulacao = {
      dias: 20,
      diasUteis: 14,
      volta: "2027-01-25",
      periodo: { inicio: "2026-01-01", fim: "2026-12-31" },
      saldoAntes: 30,
      saldoDepois: 10,
      maxVendaveis: 10,
      prazoAbono: "2026-12-16",
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, simulacao));
    expect(
      await simularAusencia({
        colaboradorId: COLABORADOR,
        tipo: "ferias",
        inicio: "2027-01-05",
        fim: "2027-01-24",
        diasVendidos: 0,
      }),
    ).toEqual(simulacao);
    const [url] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(
      `/v1/ausencias/simulacao?colaboradorId=${COLABORADOR}&tipo=ferias&inicio=2027-01-05&fim=2027-01-24&diasVendidos=0`,
    );
  });

  it("férias do colaborador: GET do saldo e do histórico", async () => {
    const ferias = {
      periodos: [],
      periodoAtual: null,
      proximaAusencia: null,
      historico: [ITEM],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, ferias));
    expect(await consultarFeriasDoColaborador(COLABORADOR)).toEqual(ferias);
    const [url] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/v1/colaboradores/${COLABORADOR}/ferias`);
  });
});
