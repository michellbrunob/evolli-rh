/**
 * T216 — cliente dos modelos: os arquivos de evidência da NR-1 renovam o
 * token CSRF e repetem UMA vez quando a página ficou desatualizada (403
 * `csrf_invalido`, outra aba renovou o token); os demais 403 não repetem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";
import {
  enviarEvidenciaNr1,
  removerEvidenciaNr1,
} from "./modelosDePesquisaClient";

const fetchMock = vi.fn();

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CSRF_INVALIDO = { codigo: "csrf_invalido" };
const ACOMPANHAMENTO = { etapas: [], plano: [], concluidas: 2 };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearCsrfToken();
  setCsrfToken("token-antigo");
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCsrfToken();
});

const token = (i: number) =>
  (fetchMock.mock.calls[i]![1] as RequestInit).headers as Record<
    string,
    string
  >;

const arquivo = () =>
  new File(["%PDF-1.4"], "Ata.pdf", { type: "application/pdf" });

describe("evidências da NR-1: página desatualizada", () => {
  it("envio: 403 csrf_invalido renova o token e repete uma vez", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(403, CSRF_INVALIDO))
      .mockResolvedValueOnce(resposta(200, { csrfToken: "token-novo" }))
      .mockResolvedValueOnce(resposta(200, ACOMPANHAMENTO));
    const a = await enviarEvidenciaNr1("p1", "comunicar", arquivo());
    expect(a).toEqual(ACOMPANHAMENTO);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]![0]).toBe("/v1/auth/csrf");
    expect(token(0)["x-csrf-token"]).toBe("token-antigo");
    expect(token(2)["x-csrf-token"]).toBe("token-novo");
    expect(fetchMock.mock.calls[2]![0]).toBe(
      "/v1/pesquisas/p1/modelo/acompanhamento/evidencias/comunicar",
    );
    expect(getCsrfToken()).toBe("token-novo");
  });

  it("envio: repete só uma vez; a 2ª recusa vira o erro da página desatualizada", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(403, CSRF_INVALIDO))
      .mockResolvedValueOnce(resposta(200, { csrfToken: "token-novo" }))
      .mockResolvedValueOnce(resposta(403, CSRF_INVALIDO));
    await expect(
      enviarEvidenciaNr1("p1", "comunicar", arquivo()),
    ).rejects.toMatchObject({ status: 403, codigo: "csrf_invalido" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("envio: 403 de permissão não repete", async () => {
    fetchMock.mockResolvedValueOnce(resposta(403, { message: "Forbidden" }));
    await expect(
      enviarEvidenciaNr1("p1", "comunicar", arquivo()),
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCsrfToken()).toBe("token-antigo");
  });

  it("remoção: 403 csrf_invalido renova o token e repete uma vez", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(403, CSRF_INVALIDO))
      .mockResolvedValueOnce(resposta(200, { csrfToken: "token-novo" }))
      .mockResolvedValueOnce(resposta(200, ACOMPANHAMENTO));
    await expect(removerEvidenciaNr1("p1", "comunicar", "a1")).resolves.toEqual(
      ACOMPANHAMENTO,
    );
    expect(token(2)["x-csrf-token"]).toBe("token-novo");
    expect((fetchMock.mock.calls[2]![1] as RequestInit).method).toBe("DELETE");
  });

  it("sessão expirada (401) não repete e descarta o token", async () => {
    fetchMock.mockResolvedValueOnce(resposta(401, {}));
    await expect(
      enviarEvidenciaNr1("p1", "comunicar", arquivo()),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCsrfToken()).toBeNull();
  });
});
