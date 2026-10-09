import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACOES_COM_MOTIVO_OBRIGATORIO,
  ACOES_POR_SITUACAO,
  ApiError,
  MOTIVOS_SOLICITACAO_PESSOA,
  ROTULO_MOTIVO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  SITUACOES_SOLICITACAO_PESSOA,
  TIPOS_SOLICITACAO_PESSOA,
  detalharSolicitacaoPessoa,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
  registrarSolicitacaoPessoa,
  transicionarSolicitacaoPessoa,
} from "./solicitacoesPessoasClient";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";

function resposta(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const SOLICITACAO = {
  id: "11111111-1111-4111-8111-111111111111",
  empresaId: "22222222-2222-4222-8222-222222222222",
  vinculoId: "33333333-3333-4333-8333-333333333333",
  tipo: "ferias",
  motivo: "periodo_ferias",
  situacao: "rascunho",
  periodoReferencia: null,
  registradoPorUserId: "user-rh",
  enviadaEm: null,
  primeiraRevisaoEm: null,
  criadoEm: "2026-09-29T10:00:00.000Z",
  atualizadoEm: "2026-09-29T10:00:00.000Z",
};

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

function ultimaChamada() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: (init ?? {}) as RequestInit };
}

function cabecalhos(init: RequestInit): Record<string, string> {
  return (init.headers ?? {}) as Record<string, string>;
}

describe("solicitacoesPessoasClient — leituras (GET)", () => {
  it("listar usa /v1/solicitacoes-pessoas, same-origin e não envia CSRF", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(200, { itens: [], pagina: 1, tamanhoPagina: 20, total: 0 }),
    );
    await listarSolicitacoesPessoas();
    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/solicitacoes-pessoas");
    expect(init.credentials).toBe("same-origin");
    expect(init.method ?? "GET").toBe("GET");
    expect(cabecalhos(init)["x-csrf-token"]).toBeUndefined();
  });

  it("monta a query só com os filtros informados", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(200, { itens: [], pagina: 2, tamanhoPagina: 20, total: 0 }),
    );
    await listarSolicitacoesPessoas({
      pagina: 2,
      tamanhoPagina: 20,
      tipo: "atestado",
      situacao: "em_revisao_rh",
      vinculoId: "v-1",
    });
    const { url } = ultimaChamada();
    expect(url).toContain("pagina=2");
    expect(url).toContain("tamanhoPagina=20");
    expect(url).toContain("tipo=atestado");
    expect(url).toContain("situacao=em_revisao_rh");
    expect(url).toContain("vinculoId=v-1");
  });

  it("nunca envia empresaId na listagem: a empresa é derivada da sessão", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(200, { itens: [], pagina: 1, tamanhoPagina: 20, total: 0 }),
    );
    await listarSolicitacoesPessoas({ tipo: "ferias" });
    expect(ultimaChamada().url).not.toContain("empresaId");
  });

  it("detalhe e histórico usam as rotas reais e escapam o identificador", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, SOLICITACAO));
    await detalharSolicitacaoPessoa("a b");
    expect(ultimaChamada().url).toBe("/v1/solicitacoes-pessoas/a%20b");

    fetchMock.mockResolvedValueOnce(resposta(200, []));
    await historicoSolicitacaoPessoa("a b");
    expect(ultimaChamada().url).toBe(
      "/v1/solicitacoes-pessoas/a%20b/historico",
    );
    expect(cabecalhos(ultimaChamada().init)["x-csrf-token"]).toBeUndefined();
  });
});

describe("solicitacoesPessoasClient — mutações (POST)", () => {
  it("registrar envia CSRF, JSON e aceita 201 como sucesso", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, SOLICITACAO));
    const criada = await registrarSolicitacaoPessoa({
      empresaId: "emp-1",
      vinculoId: "vin-1",
      tipo: "atestado",
      motivo: "atestado_apresentado",
      periodoReferencia: "2026-08-10",
    });
    expect(criada.id).toBe(SOLICITACAO.id);

    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/solicitacoes-pessoas");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(cabecalhos(init)["x-csrf-token"]).toBe("csrf-em-memoria");
    expect(JSON.parse(init.body as string)).toEqual({
      empresaId: "emp-1",
      vinculoId: "vin-1",
      tipo: "atestado",
      motivo: "atestado_apresentado",
      periodoReferencia: "2026-08-10",
    });
  });

  it("registrar não inventa campo: o corpo tem só o que o DTO aceita", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, SOLICITACAO));
    await registrarSolicitacaoPessoa({
      empresaId: "emp-1",
      vinculoId: "vin-1",
      tipo: "ferias",
      motivo: "periodo_ferias",
    });
    const corpo = JSON.parse(ultimaChamada().init.body as string) as Record<
      string,
      unknown
    >;
    expect(Object.keys(corpo).sort()).toEqual([
      "empresaId",
      "motivo",
      "tipo",
      "vinculoId",
    ]);
    // Nada de anexo, conteúdo, situação ou texto livre.
    for (const proibido of [
      "situacao",
      "anexo",
      "arquivo",
      "url",
      "conteudo",
      "observacao",
      "diagnostico",
      "cid",
      "descricaoClinica",
    ]) {
      expect(corpo).not.toHaveProperty(proibido);
    }
  });

  it("transicionar usa a rota de transições, envia CSRF e aceita 201", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(201, { ...SOLICITACAO, situacao: "recusada" }),
    );
    const s = await transicionarSolicitacaoPessoa("sol-1", {
      acao: "recusar",
      motivo: "duplicidade",
    });
    expect(s.situacao).toBe("recusada");

    const { url, init } = ultimaChamada();
    expect(url).toBe("/v1/solicitacoes-pessoas/sol-1/transicoes");
    expect(init.method).toBe("POST");
    expect(cabecalhos(init)["x-csrf-token"]).toBe("csrf-em-memoria");
    expect(JSON.parse(init.body as string)).toEqual({
      acao: "recusar",
      motivo: "duplicidade",
    });
  });

  it("transicionar omite o motivo quando ele não foi informado", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, SOLICITACAO));
    await transicionarSolicitacaoPessoa("sol-1", { acao: "enviar" });
    expect(JSON.parse(ultimaChamada().init.body as string)).toEqual({
      acao: "enviar",
    });
  });
});

describe("solicitacoesPessoasClient — erros", () => {
  it("nunca repassa o corpo de erro do servidor", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(422, { message: "detalhe interno que NUNCA deve vazar" }),
    );
    const erro = await transicionarSolicitacaoPessoa("sol-1", {
      acao: "cancelar",
    }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(422);
    expect((erro as ApiError).message).not.toContain("detalhe interno");
  });

  it("preserva o status para a tela distinguir 404 de 403", async () => {
    fetchMock.mockResolvedValueOnce(resposta(404, {}));
    await expect(detalharSolicitacaoPessoa("x")).rejects.toMatchObject({
      status: 404,
    });

    fetchMock.mockResolvedValueOnce(resposta(403, {}));
    await expect(listarSolicitacoesPessoas()).rejects.toMatchObject({
      status: 403,
    });
  });

  it("401 descarta o token CSRF em memória", async () => {
    expect(getCsrfToken()).toBe("csrf-em-memoria");
    fetchMock.mockResolvedValueOnce(resposta(401, {}));
    await expect(listarSolicitacoesPessoas()).rejects.toBeInstanceOf(ApiError);
    expect(getCsrfToken()).toBeNull();
  });
});

describe("solicitacoesPessoasClient — catálogos e rótulos", () => {
  it("expõe exatamente os seis tipos aprovados, sem `documento`", () => {
    expect([...TIPOS_SOLICITACAO_PESSOA]).toEqual([
      "contestacao_ajuste_ponto",
      "ausencia",
      "ferias",
      "atualizacao_cadastral",
      "atestado",
      "beneficios",
    ]);
    expect(TIPOS_SOLICITACAO_PESSOA).not.toContain("documento");
  });

  it("todo tipo, situação e motivo tem rótulo humano", () => {
    for (const t of TIPOS_SOLICITACAO_PESSOA)
      expect(ROTULO_TIPO[t]).toBeTruthy();
    for (const s of SITUACOES_SOLICITACAO_PESSOA)
      expect(ROTULO_SITUACAO[s]).toBeTruthy();
    for (const m of MOTIVOS_SOLICITACAO_PESSOA)
      expect(ROTULO_MOTIVO[m]).toBeTruthy();
  });

  it("não existe situação `encerrada`: o terminal é encaminhada_para_operacao_rh", () => {
    expect(SITUACOES_SOLICITACAO_PESSOA).not.toContain("encerrada");
    expect(SITUACOES_SOLICITACAO_PESSOA).toContain(
      "encaminhada_para_operacao_rh",
    );
  });

  it("a tabela de ações espelha o núcleo T066 reconciliado por PD-SOL-03", () => {
    expect(ACOES_POR_SITUACAO).toEqual({
      rascunho: ["enviar", "cancelar"],
      enviada: ["iniciar_revisao", "cancelar"],
      em_revisao_rh: [
        "aguardar_informacao",
        "encaminhar_para_operacao",
        "recusar",
      ],
      aguardando_informacao: ["retomar_revisao"],
      encaminhada_para_operacao_rh: ["reabrir"],
      recusada: ["reabrir"],
      cancelada: [],
    });
  });

  it("cancelamento só antes de em_revisao_rh, e cancelada não tem saída", () => {
    expect(ACOES_POR_SITUACAO.rascunho).toContain("cancelar");
    expect(ACOES_POR_SITUACAO.enviada).toContain("cancelar");
    expect(ACOES_POR_SITUACAO.em_revisao_rh).not.toContain("cancelar");
    expect(ACOES_POR_SITUACAO.aguardando_informacao).not.toContain("cancelar");
    expect(ACOES_POR_SITUACAO.cancelada).toHaveLength(0);
  });

  it("reabertura só de recusada e encaminhada_para_operacao_rh", () => {
    const reabriveis = SITUACOES_SOLICITACAO_PESSOA.filter((s) =>
      ACOES_POR_SITUACAO[s].includes("reabrir"),
    );
    expect(reabriveis).toEqual(["encaminhada_para_operacao_rh", "recusada"]);
  });

  it("recusar e reabrir exigem justificativa", () => {
    expect([...ACOES_COM_MOTIVO_OBRIGATORIO]).toEqual(["recusar", "reabrir"]);
  });
});

// A formatação de datas saiu deste cliente na T154 (era erro de camada) e mora
// em `src/format/data.ts`; a cobertura equivalente está em `format/data.test.ts`.
