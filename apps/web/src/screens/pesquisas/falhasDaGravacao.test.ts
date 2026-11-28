/**
 * T216 — a falha ao gravar diz o que aconteceu: sessão expirada e página
 * desatualizada não aparecem como "verifique a conexão".
 */
import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/colaboradoresClient";
import {
  CsrfRequestError,
  CsrfSessionExpiredError,
} from "../../api/csrfClient";
import { mensagemDaFalha } from "./falhasDaGravacao";

const acao = "gerar a pesquisa";

describe("mensagem da falha ao gravar", () => {
  it("403 csrf_invalido: página desatualizada, tentar de novo", () => {
    const m = mensagemDaFalha(
      new ApiError(403, "x", { codigo: "csrf_invalido" }),
      acao,
    );
    expect(m).toMatch(/página ficou desatualizada/);
    expect(m).not.toMatch(/conexão/);
  });

  it("401 e token recusado na renovação: sessão expirada", () => {
    for (const erro of [
      new ApiError(401, "x"),
      new CsrfSessionExpiredError(),
    ]) {
      const m = mensagemDaFalha(erro, acao);
      expect(m).toBe(
        "Não foi possível gerar a pesquisa: sua sessão expirou. Entre de novo para continuar.",
      );
    }
  });

  it("403 sem código: permissão", () => {
    expect(mensagemDaFalha(new ApiError(403, "x"), acao)).toMatch(
      /seu acesso não permite/,
    );
  });

  it("409, 422 e 5xx têm a própria mensagem", () => {
    expect(mensagemDaFalha(new ApiError(409, "x"), acao)).toMatch(
      /mudou de situação/,
    );
    expect(mensagemDaFalha(new ApiError(422, "x"), acao)).toMatch(
      /recusou algum campo/,
    );
    expect(mensagemDaFalha(new ApiError(503, "x"), acao)).toMatch(
      /servidor teve um problema/,
    );
  });

  it("só sem resposta é a conexão", () => {
    expect(mensagemDaFalha(new TypeError("Failed to fetch"), acao)).toBe(
      "Não foi possível gerar a pesquisa. Verifique a conexão e tente de novo.",
    );
    expect(mensagemDaFalha(new CsrfRequestError("rede"), acao)).toMatch(
      /o pedido não saiu/,
    );
    expect(mensagemDaFalha(new ApiError(404, "x"), acao)).not.toMatch(
      /conexão/,
    );
  });
});
