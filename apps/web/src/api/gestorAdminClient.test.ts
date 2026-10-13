/**
 * Testes do cliente de administração da liderança (T157).
 *
 * O que estes testes prendem, e por quê:
 *
 *  - a URL exata das seis rotas, **com o prefixo `/v1`** — o versionamento é
 *    por URI, e errar o prefixo dá 404 em produção e teste verde em jsdom;
 *  - o método de cada uma: `POST` cria, `PATCH …/encerrar` encerra, `GET`
 *    lista. **Nenhum `DELETE` existe**, e o teste prova que o módulo não
 *    exporta função capaz de emiti-lo;
 *  - que toda mutação leva `x-csrf-token` — sem ele o `CsrfGuard` responde
 *    403, e o sintoma na tela seria "não salvou" sem explicação;
 *  - que **nenhum corpo carrega `empresaId`**: a empresa vem da sessão, e
 *    mandá-la seria oferecer ao cliente a fronteira de autorização;
 *  - que **as listagens administrativas não enviam paginação**, porque o
 *    contrato não a tem — `?pagina=` responderia 400 (`whitelist` +
 *    `forbidNonWhitelisted`);
 *  - que os catálogos paginados são percorridos **até o fim**, e que estourar
 *    o teto vira erro explícito em vez de lista truncada que se apresenta como
 *    completa — o defeito que a T156 registrou nas telas existentes;
 *  - que o módulo **não** exporta nada para as rotas de `excecoes`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as gestorAdminClient from "./gestorAdminClient";
import {
  ApiError,
  CatalogoIncompletoError,
  carregarTodasAsContas,
  carregarTodasAsEquipes,
  carregarTodosOsColaboradores,
  criarAtribuicao,
  encerrarAtribuicao,
  encerrarLigacao,
  listarAtribuicoes,
  listarLigacoes,
  vincularConta,
} from "./gestorAdminClient";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";

function respostaOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function respostaErro(
  status: number,
  message = "Conflito de vigência.",
): Response {
  return {
    ok: false,
    status,
    json: async () => ({ statusCode: status, message }),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearCsrfToken();
  setCsrfToken("csrf-em-memoria");
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCsrfToken();
});

async function capturar(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    return e as Error;
  }
  throw new Error("esperava uma rejeição, mas a promessa resolveu");
}

function chamada(indice = -1) {
  const [url, init] = fetchMock.mock.calls.at(indice)!;
  return { url: url as string, init: (init ?? {}) as RequestInit };
}

function cabecalhos(init: RequestInit): Record<string, string> {
  return (init.headers ?? {}) as Record<string, string>;
}

const LIGACAO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  colaboradorId: "33333333-3333-4333-8333-333333333333",
  vigenciaInicio: "2026-10-01",
  vigenciaFim: null,
};

const ATRIBUICAO = {
  id: "44444444-4444-4444-8444-444444444444",
  equipeId: "55555555-5555-4555-8555-555555555555",
  gestorColaboradorId: LIGACAO.colaboradorId,
  papel: "principal",
  vigenciaInicio: "2026-10-01",
  vigenciaFim: null,
};

describe("ligações conta ↔ colaborador", () => {
  it("lista sem query alguma, no caminho exato", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk([LIGACAO]));
    await listarLigacoes();
    const { url, init } = chamada();
    expect(url).toBe("/v1/gestor/administracao/ligacoes");
    expect(url).not.toContain("?");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("cria por POST, com CSRF e sem empresaId", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk(LIGACAO));
    await vincularConta({
      userId: LIGACAO.userId,
      colaboradorId: LIGACAO.colaboradorId,
      vigenciaInicio: "2026-10-01",
    });
    const { url, init } = chamada();
    expect(url).toBe("/v1/gestor/administracao/ligacoes");
    expect(init.method).toBe("POST");
    expect(cabecalhos(init)["x-csrf-token"]).toBe("csrf-em-memoria");
    const corpo = JSON.parse(init.body as string);
    expect(corpo).toEqual({
      userId: LIGACAO.userId,
      colaboradorId: LIGACAO.colaboradorId,
      vigenciaInicio: "2026-10-01",
    });
    expect(corpo).not.toHaveProperty("empresaId");
  });

  it("encerra por PATCH no sufixo /encerrar, com o id escapado", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk(LIGACAO));
    await encerrarLigacao(LIGACAO.id, { vigenciaFim: "2026-11-30" });
    const { url, init } = chamada();
    expect(url).toBe(
      `/v1/gestor/administracao/ligacoes/${LIGACAO.id}/encerrar`,
    );
    expect(init.method).toBe("PATCH");
    expect(cabecalhos(init)["x-csrf-token"]).toBe("csrf-em-memoria");
    expect(JSON.parse(init.body as string)).toEqual({
      vigenciaFim: "2026-11-30",
    });
  });
});

describe("atribuições gestor ↔ equipe", () => {
  it("lista sem filtro quando nenhum é pedido", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk([ATRIBUICAO]));
    await listarAtribuicoes();
    expect(chamada().url).toBe("/v1/gestor/administracao/atribuicoes");
  });

  it("envia só equipeId quando filtrado — e nenhum parâmetro de paginação", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk([ATRIBUICAO]));
    await listarAtribuicoes({ equipeId: ATRIBUICAO.equipeId });
    const { url } = chamada();
    expect(url).toBe(
      `/v1/gestor/administracao/atribuicoes?equipeId=${ATRIBUICAO.equipeId}`,
    );
    expect(url).not.toContain("pagina");
    expect(url).not.toContain("tamanhoPagina");
    expect(url).not.toContain("cursor");
  });

  it("cria com papel e vigência, omitindo vigenciaFim quando ausente", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk(ATRIBUICAO));
    await criarAtribuicao({
      equipeId: ATRIBUICAO.equipeId,
      gestorColaboradorId: ATRIBUICAO.gestorColaboradorId,
      papel: "principal",
      vigenciaInicio: "2026-10-01",
    });
    const corpo = JSON.parse(chamada().init.body as string);
    expect(corpo).not.toHaveProperty("vigenciaFim");
    expect(corpo.papel).toBe("principal");
  });

  it("encerra por PATCH no sufixo /encerrar", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk(ATRIBUICAO));
    await encerrarAtribuicao(ATRIBUICAO.id, { vigenciaFim: "2026-12-31" });
    const { url, init } = chamada();
    expect(url).toBe(
      `/v1/gestor/administracao/atribuicoes/${ATRIBUICAO.id}/encerrar`,
    );
    expect(init.method).toBe("PATCH");
  });
});

describe("erros", () => {
  it("409 vira ApiError com a mensagem do servidor", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(409));
    const erro = await capturar(
      criarAtribuicao({
        equipeId: ATRIBUICAO.equipeId,
        gestorColaboradorId: ATRIBUICAO.gestorColaboradorId,
        papel: "principal",
        vigenciaInicio: "2026-10-01",
      }),
    );
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(409);
    expect(erro.message).toBe("Conflito de vigência.");
  });

  it("corpo ilegível não quebra: cai na mensagem padrão", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("corpo não é JSON");
      },
    } as unknown as Response);
    const erro = await capturar(listarLigacoes());
    expect(erro.message).toBe("Erro na requisição.");
  });
});

describe("catálogos paginados: consumidos até o fim", () => {
  it("contas por cursor seguem até nextCursor vir nulo", async () => {
    fetchMock
      .mockResolvedValueOnce(
        respostaOk({ items: [{ id: "u1" }, { id: "u2" }], nextCursor: "c1" }),
      )
      .mockResolvedValueOnce(
        respostaOk({ items: [{ id: "u3" }], nextCursor: null }),
      );
    const todas = await carregarTodasAsContas();
    expect(todas.map((c) => c.id)).toEqual(["u1", "u2", "u3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chamada(0).url).toContain("limit=100");
    expect(chamada(1).url).toContain("cursor=c1");
  });

  it("colaboradores por offset seguem até acumular o total", async () => {
    const pagina = (itens: unknown[], total: number) =>
      respostaOk({ itens, total, pagina: 1, tamanhoPagina: 100 });
    fetchMock
      .mockResolvedValueOnce(pagina([{ id: "c1" }, { id: "c2" }], 3))
      .mockResolvedValueOnce(pagina([{ id: "c3" }], 3));
    const todos = await carregarTodosOsColaboradores();
    expect(todos.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(chamada(0).url).toContain("pagina=1");
    expect(chamada(1).url).toContain("pagina=2");
    expect(chamada(0).url).toContain("tamanhoPagina=100");
  });

  it("página vazia encerra o laço mesmo com total maior", async () => {
    fetchMock
      .mockResolvedValueOnce(
        respostaOk({
          itens: [{ id: "e1" }],
          total: 999,
          pagina: 1,
          tamanhoPagina: 100,
        }),
      )
      .mockResolvedValueOnce(
        respostaOk({ itens: [], total: 999, pagina: 2, tamanhoPagina: 100 }),
      );
    const todas = await carregarTodasAsEquipes();
    expect(todas).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("servidor que nunca termina vira erro explícito, nunca lista truncada", async () => {
    // Cursor sempre presente: sem o teto, isto seria laço infinito no
    // navegador. Com o teto, é uma condição de erro que a tela mostra.
    fetchMock.mockResolvedValue(
      respostaOk({ items: [{ id: "u" }], nextCursor: "sempre" }),
    );
    const erro = await capturar(carregarTodasAsContas());
    expect(erro).toBeInstanceOf(CatalogoIncompletoError);
    expect(erro.message).toContain("contas de acesso");
  });
});

describe("fronteiras do módulo", () => {
  it("não exporta nada para as rotas de exceções", () => {
    const nomes = Object.keys(gestorAdminClient);
    expect(nomes.some((n) => /excecao|excecoes/i.test(n))).toBe(false);
  });

  it("não exporta função de exclusão", () => {
    const nomes = Object.keys(gestorAdminClient);
    expect(nomes.some((n) => /excluir|remover|apagar|deletar/i.test(n))).toBe(
      false,
    );
  });

  it("nenhuma chamada do módulo usa DELETE", async () => {
    fetchMock.mockResolvedValue(respostaOk([]));
    await listarLigacoes();
    await listarAtribuicoes();
    fetchMock.mockResolvedValue(respostaOk(LIGACAO));
    await vincularConta({
      userId: LIGACAO.userId,
      colaboradorId: LIGACAO.colaboradorId,
      vigenciaInicio: "2026-10-01",
    });
    await encerrarLigacao(LIGACAO.id, { vigenciaFim: "2026-11-30" });
    const metodos = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit | undefined)?.method ?? "GET",
    );
    expect(metodos).not.toContain("DELETE");
  });

  it("concede administração apenas ao papel que o servidor concede", () => {
    expect(gestorAdminClient.PAPEIS_COM_ADMINISTRACAO_DE_LIDERANCA).toEqual([
      "rh",
    ]);
  });
});
