import { describe, expect, it, vi } from "vitest";
import {
  ErroPesquisaPublica,
  criarClientePesquisaPublica,
} from "./pesquisaPublicaClient";

function resposta(status: number, corpo?: unknown): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PESQUISA = {
  empresa: "Empresa Exemplo",
  nome: "Pulso do trimestre",
  boasVindas: null,
  identificacao: "anonima",
  totalPerguntas: 1,
  minutosEstimados: 1,
  secoes: [],
};

describe("T216 — cliente público de pesquisas", () => {
  it("abre a pesquisa sem cookie, sem CSRF e sem cache, com o token codificado", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(200, PESQUISA));
    const cliente = criarClientePesquisaPublica(buscar);

    await expect(cliente.abrir("ab c/1")).resolves.toEqual(PESQUISA);

    const [url, init] = buscar.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/v1/publico/pesquisas/ab%20c%2F1");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
    expect(JSON.stringify(init.headers)).not.toMatch(/csrf/i);
  });

  it("devolve o motivo quando a pesquisa não está disponível", async () => {
    const cliente = criarClientePesquisaPublica(
      vi.fn().mockResolvedValue(resposta(200, { indisponivel: "pausada" })),
    );
    await expect(cliente.abrir("t")).resolves.toEqual({
      indisponivel: "pausada",
    });
  });

  it("404 vira pesquisa inexistente; 410 usa o motivo do servidor", async () => {
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(resposta(404, { mensagem: "x" }))
      .mockResolvedValueOnce(resposta(410, { indisponivel: "cancelada" }))
      .mockResolvedValueOnce(resposta(410));
    const cliente = criarClientePesquisaPublica(buscar);
    await expect(cliente.abrir("t")).resolves.toEqual({
      indisponivel: "inexistente",
    });
    await expect(cliente.abrir("t")).resolves.toEqual({
      indisponivel: "cancelada",
    });
    await expect(cliente.abrir("t")).resolves.toEqual({
      indisponivel: "encerrada",
    });
  });

  it("falha de servidor na abertura vira erro com o status", async () => {
    const cliente = criarClientePesquisaPublica(
      vi.fn().mockResolvedValue(resposta(500)),
    );
    await expect(cliente.abrir("t")).rejects.toMatchObject({ status: 500 });
  });

  it("identifica por POST com CPF e data, sem cookie", async () => {
    const buscar = vi
      .fn()
      .mockResolvedValue(resposta(200, { passe: "p1", primeiroNome: "Alex" }));
    const cliente = criarClientePesquisaPublica(buscar);

    await expect(
      cliente.identificar("tok", {
        cpf: "20743195841",
        dataNascimento: "1990-04-15",
      }),
    ).resolves.toEqual({ passe: "p1", primeiroNome: "Alex" });

    const [url, init] = buscar.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/v1/publico/pesquisas/tok/identificar");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(init.body as string)).toEqual({
      cpf: "20743195841",
      dataNascimento: "1990-04-15",
    });
  });

  it.each([401, 409, 429])(
    "identificação recusada (%i) vira erro com o status",
    async (status) => {
      const cliente = criarClientePesquisaPublica(
        vi.fn().mockResolvedValue(resposta(status, { mensagem: "detalhe" })),
      );
      const erro = await cliente
        .identificar("t", { cpf: "1", dataNascimento: "2000-01-01" })
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPesquisaPublica);
      expect((erro as ErroPesquisaPublica).status).toBe(status);
      // O texto do servidor nunca vira a mensagem.
      expect((erro as Error).message).not.toContain("detalhe");
    },
  );

  it("envia as respostas com o passe e aceita o 201", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(201, { ok: true }));
    const cliente = criarClientePesquisaPublica(buscar);
    await cliente.enviarRespostas("tok", {
      passe: "p1",
      respostas: [{ perguntaId: "q1", valor: 4 }],
    });
    const [url, init] = buscar.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/v1/publico/pesquisas/tok/respostas");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(init.body as string)).toEqual({
      passe: "p1",
      respostas: [{ perguntaId: "q1", valor: 4 }],
    });
  });

  it("sem passe (anônima), o corpo não leva o campo", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(201, { ok: true }));
    await criarClientePesquisaPublica(buscar).enviarRespostas("tok", {
      respostas: [],
    });
    const [, init] = buscar.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ respostas: [] });
  });

  it("anônima com separação: o corpo leva os grupos escolhidos", async () => {
    const buscar = vi.fn().mockResolvedValue(resposta(201, { ok: true }));
    await criarClientePesquisaPublica(buscar).enviarRespostas("tok", {
      grupos: { departamento: "d1", unidade: null },
      respostas: [],
    });
    const [, init] = buscar.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      grupos: { departamento: "d1", unidade: null },
      respostas: [],
    });
  });

  it("422 traz os erros por pergunta", async () => {
    const cliente = criarClientePesquisaPublica(
      vi.fn().mockResolvedValue(
        resposta(422, {
          erros: [{ campo: "q1", motivo: "fora do intervalo" }, { x: 1 }],
        }),
      ),
    );
    const erro = (await cliente
      .enviarRespostas("t", { respostas: [] })
      .catch((e: unknown) => e)) as ErroPesquisaPublica;
    expect(erro.status).toBe(422);
    expect(erro.erros).toEqual([{ campo: "q1", motivo: "fora do intervalo" }]);
  });
});
