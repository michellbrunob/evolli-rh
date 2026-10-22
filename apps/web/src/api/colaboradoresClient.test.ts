/**
 * T178 — `listarColaboradores`: a query que sai do navegador.
 *
 * A busca é do servidor; o cliente só a normaliza (apara, corta no teto, omite
 * se vazia). A empresa nunca entra na query — é a da sessão.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  type AdmitirColaboradorDto,
  BUSCA_COLABORADORES_MAXIMO,
  admitirColaborador,
  listarColaboradores,
} from "./colaboradoresClient";

const VAZIA = {
  itens: [],
  pagina: 1,
  tamanhoPagina: 20,
  total: 0,
  contadores: { ativos: 0, inativos: 0 },
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => VAZIA,
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function queryEnviada(): URLSearchParams {
  const [url] = fetchMock.mock.calls.at(-1)!;
  return new URL(String(url), "http://localhost").searchParams;
}

describe("T178 — listarColaboradores", () => {
  it("envia busca aparada junto com filtros e paginação, sem empresa", async () => {
    await listarColaboradores({
      situacao: "ativo",
      situacaoVinculo: "previsto",
      busca: "  Ana  ",
      pagina: 2,
      tamanhoPagina: 20,
    });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(String(url).startsWith("/v1/colaboradores?")).toBe(true);
    expect((init as RequestInit).method ?? "GET").toBe("GET");
    const q = queryEnviada();
    expect(q.get("busca")).toBe("Ana");
    expect(q.get("situacao")).toBe("ativo");
    expect(q.get("situacaoVinculo")).toBe("previsto");
    expect(q.get("pagina")).toBe("2");
    expect(q.has("empresaId")).toBe(false);
  });

  it.each([
    ["vazia", ""],
    ["só espaços", "   "],
    ["ausente", undefined],
  ])("busca %s não vai na query", async (_nome, busca) => {
    await listarColaboradores(
      busca === undefined ? { pagina: 1 } : { busca, pagina: 1 },
    );
    expect(queryEnviada().has("busca")).toBe(false);
  });

  it("busca acima do teto é cortada em 160 caracteres", async () => {
    await listarColaboradores({ busca: "b".repeat(300) });
    expect(queryEnviada().get("busca")).toBe(
      "b".repeat(BUSCA_COLABORADORES_MAXIMO),
    );
    expect(BUSCA_COLABORADORES_MAXIMO).toBe(160);
  });

  it("devolve o envelope com `contadores` como veio do servidor", async () => {
    await expect(listarColaboradores()).resolves.toEqual(VAZIA);
  });
});

// ---------------------------------------------------------------------------
// T179 — admissão com chave de idempotência, e o corpo do erro chegando à
// tela só com `erros` e `codigo`.
// ---------------------------------------------------------------------------
vi.mock("./csrfClient", () => ({
  clearCsrfToken: vi.fn(),
  getCsrfToken: () => "token-sintetico",
  refreshCsrfToken: vi.fn(async () => "token-sintetico"),
  // T179 — o token das gravações vem por aqui.
  tokenCsrfParaGravacao: vi.fn(async () => "token-sintetico"),
  // T179 (revisão definitiva) — descarte do token num 403 csrf_invalido.
  descartarTokenSeDesatualizado: vi.fn(async () => undefined),
}));

const DTO: AdmitirColaboradorDto = {
  nome: "Pessoa Sintética",
  empresaId: "44444444-4444-4444-4444-444444444444",
  matricula: "MAT-1",
  tipo: "clt",
  dataAdmissao: "2026-11-03",
  motivoCodigo: "admissao_inicial",
  departamentoId: "55555555-5555-5555-5555-555555555555",
  cargoId: "77777777-7777-4777-8777-777777777777",
  unidadeOrganizacionalId: "88888888-8888-4888-8888-888888888888",
  perfilPessoal: {
    dataNascimento: "1990-05-20",
    sexo: null,
    saudacao: null,
    estadoCivil: null,
    nacionalidade: null,
    naturalidade: null,
    escolaridade: null,
    curso: null,
    nomePai: null,
    nomeMae: null,
  },
  contatos: {
    emailPessoal: "pessoa@exemplo.test",
    celular: "+5531999990000",
    telefone: "+553133330000",
  },
};

function respostaDeErro(status: number, corpo: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => corpo,
  } as unknown as Response;
}

describe("T179 — admitirColaborador", () => {
  it("envia a chave no cabeçalho Idempotency-Key, junto do CSRF", async () => {
    await admitirColaborador(DTO, {
      chaveIdempotencia: "12345678-1234-4234-8234-123456789abc",
    });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/v1/colaboradores");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect((init as RequestInit).method).toBe("POST");
    expect(headers["Idempotency-Key"]).toBe(
      "12345678-1234-4234-8234-123456789abc",
    );
    expect(headers["x-csrf-token"]).toBe("token-sintetico");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(DTO);
  });

  it("sem chave, não manda o cabeçalho", async () => {
    await admitirColaborador(DTO);
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(
      (init as RequestInit).headers as Record<string, string>,
    ).not.toHaveProperty("Idempotency-Key");
  });

  it("409 por campo: o ApiError carrega `erros`, sem valores, e o status", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaDeErro(409, {
        status_code: 409,
        message: "Conflito.",
        request_id: "r",
        timestamp: "t",
        erros: [
          { campo: "matricula", motivo: "em_uso" },
          { campo: "contatos.emailPessoal", motivo: "em_uso", extra: "x" },
          { campo: 1, motivo: "em_uso" },
        ],
      }),
    );
    const erro = await admitirColaborador(DTO).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(409);
    expect((erro as ApiError).message).toBe("Conflito.");
    // Só `{campo, motivo}` em texto; o resto do item e itens malformados somem.
    expect((erro as ApiError).erros).toEqual([
      { campo: "matricula", motivo: "em_uso" },
      { campo: "contatos.emailPessoal", motivo: "em_uso" },
    ]);
    expect((erro as ApiError).codigo).toBeUndefined();
  });

  it("422 com código: o ApiError carrega `codigo`", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaDeErro(422, {
        message: "Divergente.",
        codigo: "idempotencia_conteudo_divergente",
      }),
    );
    const erro = (await admitirColaborador(DTO).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(erro.status).toBe(422);
    expect(erro.codigo).toBe("idempotencia_conteudo_divergente");
    expect(erro.erros).toBeUndefined();
  });

  it("corpo de erro ilegível ainda vira ApiError com o status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("sem JSON");
      },
    } as unknown as Response);
    const erro = (await admitirColaborador(DTO).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(erro.status).toBe(500);
    expect(erro.message).toBe("Erro na requisição.");
  });
});
