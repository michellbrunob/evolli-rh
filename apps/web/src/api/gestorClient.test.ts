/**
 * Testes do cliente da consulta consultiva do gestor (T153).
 *
 * O que estes testes prendem, e por quê:
 *
 *  - a URL exata das duas rotas, **com o prefixo `/v1`** — o versionamento é
 *    por URI (`enableVersioning`), e errar o prefixo dá 404 em produção e
 *    teste verde em jsdom;
 *  - que **nenhuma query** é enviada: as rotas recusam qualquer parâmetro com
 *    400, de propósito, e um `?dataReferencia=` acidental quebraria a tela
 *    inteira — além de ser a fronteira de autorização que a ADR 0015 fixou;
 *  - que **nenhum método diferente de GET** é usado, e que o módulo não
 *    exporta função de mutação nenhuma;
 *  - que o corpo de erro do servidor **nunca** chega à mensagem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as gestorClient from "./gestorClient";
import { ApiError, detalharVinculo, listarEquipe } from "./gestorClient";
import { clearCsrfToken, setCsrfToken } from "./csrfClient";

function respostaOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function respostaErro(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      status_code: status,
      message: "detalhe interno que NUNCA deve vazar",
      request_id: "req-123",
      timestamp: "2026-10-08T00:00:00.000Z",
    }),
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

/**
 * Captura a rejeição com tipo, em vez de `.catch(e => e as ApiError)`: aquele
 * produz a UNIÃO com o tipo de sucesso, e `erro.message` não tipa. Falha se a
 * promessa resolver — um teste de erro que passa com sucesso não prova nada.
 */
async function capturar(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error("esperava uma rejeição, mas a promessa resolveu");
}

function ultimaChamada() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: (init ?? {}) as RequestInit };
}

const ITEM = {
  vinculoId: "11111111-1111-4111-8111-111111111111",
  colaboradorId: "22222222-2222-4222-8222-222222222222",
  nome: "Pessoa Demo Alfa Turno A",
  matricula: "DEMO-A-0201",
  situacaoVinculo: "ativo",
  tipoVinculo: "efetivo",
  dataAdmissao: "2026-01-05T00:00:00.000Z",
  dataDesligamento: null,
  cargoVigente: { id: "c1", nome: "Operador" },
  lotacaoVigente: {
    equipe: { id: "e1", nome: "Turno A" },
    departamento: null,
    unidadeOrganizacional: null,
    vigenteDe: "2026-01-05T00:00:00.000Z",
  },
};

describe("listarEquipe", () => {
  it("T153.C1 chama GET /v1/gestor/equipe, sem query nenhuma", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ dataReferencia: "2026-10-08", itens: [ITEM] }),
    );

    const r = await listarEquipe();

    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/gestor/equipe");
    // A asserção que importa: NADA depois do caminho. Qualquer `?` aqui vira
    // 400 no servidor, porque `ConsultaEquipeQueryDto` é vazia de propósito.
    expect(url).not.toContain("?");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin");
    expect(r.itens).toHaveLength(1);
    expect(r.dataReferencia).toBe("2026-10-08");
  });

  it("T153.C2 não envia dataReferencia nem qualquer outro parâmetro", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ dataReferencia: "2026-10-08", itens: [] }),
    );
    await listarEquipe();
    expect(ultimaChamada().url).not.toMatch(/dataReferencia/i);
  });

  it("T153.C3 erro não vaza o corpo do servidor", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(500));

    const erro = await capturar(listarEquipe());
    expect(erro.status).toBe(500);
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.message).toBe("Não foi possível carregar sua equipe.");
    expect(erro.message).not.toContain("detalhe interno");
    expect(erro.message).not.toContain("req-123");
  });
});

describe("detalharVinculo", () => {
  it("T153.C4 chama GET /v1/gestor/equipe/vinculos/:id, sem query", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({
        ...ITEM,
        dataReferencia: "2026-10-08",
        horarioVigente: null,
        resumoJornada: null,
        andamentoSolicitacoes: null,
      }),
    );

    await detalharVinculo(ITEM.vinculoId);

    const { url, init } = ultimaChamada();
    expect(url).toBe(`/v1/gestor/equipe/vinculos/${ITEM.vinculoId}`);
    expect(url).not.toContain("?");
    expect(init.method).toBe("GET");
  });

  it("T153.C5 escapa o id no caminho", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(404));
    await detalharVinculo("a/b c").catch(() => undefined);
    expect(ultimaChamada().url).toBe("/v1/gestor/equipe/vinculos/a%2Fb%20c");
  });

  it("T153.C6 404 vira indisponibilidade, sem distinguir inexistente de alheio", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(404));
    const erro = await capturar(detalharVinculo(ITEM.vinculoId));

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.status).toBe(404);
    expect(erro.message).toBe(
      "Este registro não está disponível para consulta.",
    );
    // Anti-enumeração: a mensagem não pode sugerir que o registro existe e é
    // de outra pessoa, nem que não existe.
    expect(erro.message).not.toMatch(
      /outra empresa|outra equipe|não existe|inexistente/i,
    );
    expect(erro.message).not.toContain("detalhe interno");
  });

  it("T153.C7 403 também não vaza corpo interno", async () => {
    fetchMock.mockResolvedValueOnce(respostaErro(403));
    const erro = await capturar(detalharVinculo(ITEM.vinculoId));
    expect(erro.status).toBe(403);
    expect(erro.message).toBe("Não foi possível carregar o detalhe.");
    expect(erro.message).not.toContain("detalhe interno");
  });

  it("T153.C8 devolve os campos declarados ausentes como null, sem inventar", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({
        ...ITEM,
        dataReferencia: "2026-10-08",
        horarioVigente: {
          tabelaId: "t1",
          nome: "Turno A 08-17",
          vigenciaInicio: "2026-01-05T00:00:00.000Z",
          vigenciaFim: null,
        },
        resumoJornada: null,
        andamentoSolicitacoes: null,
      }),
    );

    const d = await detalharVinculo(ITEM.vinculoId);
    expect(d.resumoJornada).toBeNull();
    expect(d.andamentoSolicitacoes).toBeNull();
    expect(d.horarioVigente?.nome).toBe("Turno A 08-17");
  });
});

describe("superfície do módulo", () => {
  it("T153.C9 não exporta nenhuma função de mutação", () => {
    // Prende a decisão: o controller de consulta só tem `@Get`, e o RBAC só
    // concede `read`. Uma função de escrita aqui seria cliente de uma porta
    // que não existe — e este teste quebra antes de alguém descobrir isso em
    // produção.
    const exportados = Object.keys(gestorClient).sort();
    expect(exportados).toEqual(["ApiError", "detalharVinculo", "listarEquipe"]);

    for (const nome of exportados) {
      expect(nome).not.toMatch(
        /criar|atualizar|alterar|remover|excluir|encerrar|aprovar|salvar/i,
      );
    }
  });

  it("T153.C10 nenhuma chamada usa método diferente de GET", async () => {
    fetchMock.mockResolvedValue(
      respostaOk({ dataReferencia: "2026-10-08", itens: [] }),
    );
    await listarEquipe();
    fetchMock.mockResolvedValue(
      respostaOk({
        ...ITEM,
        dataReferencia: "2026-10-08",
        horarioVigente: null,
        resumoJornada: null,
        andamentoSolicitacoes: null,
      }),
    );
    await detalharVinculo(ITEM.vinculoId);

    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).method).toBe("GET");
    }
  });
});
