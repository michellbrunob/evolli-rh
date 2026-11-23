import { describe, expect, it } from "vitest";
import { edicaoAPartirDe, voltarDaEdicao } from "./rotasDoShell";

/**
 * T215 — a página "Editar colaborador" aberta pela ficha volta para a ficha
 * (na aba de onde saiu); aberta pela lista (ou direto pela URL), volta para
 * a lista.
 */
const ID = "8f0c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01";
const OUTRO = "11111111-1111-4111-8111-111111111111";

describe("T215 — volta da edição", () => {
  it("da ficha: a edição guarda a aba, e voltar reabre a ficha nela", () => {
    const edicao = edicaoAPartirDe(
      { colaboradorId: ID, aba: "documentos" },
      ID,
      "endereco",
    );
    expect(edicao).toEqual({
      colaboradorId: ID,
      aba: "dados",
      edicao: "endereco",
      voltarParaFicha: "documentos",
    });
    expect(voltarDaEdicao(edicao)).toEqual({
      colaboradorId: ID,
      aba: "documentos",
    });
  });

  it("da lista (sem ficha aberta): voltar fecha, e a lista aparece", () => {
    const edicao = edicaoAPartirDe(null, ID, "dados-basicos");
    expect(edicao).toEqual({
      colaboradorId: ID,
      aba: "dados",
      edicao: "dados-basicos",
    });
    expect(voltarDaEdicao(edicao)).toBeNull();
  });

  it("ficha de outra pessoa aberta: não volta para ela", () => {
    const edicao = edicaoAPartirDe(
      { colaboradorId: OUTRO, aba: "dados" },
      ID,
      "dados-basicos",
    );
    expect(edicao).not.toHaveProperty("voltarParaFicha");
    expect(voltarDaEdicao(edicao)).toBeNull();
  });

  it("trocar de seção mantém a volta para a ficha", () => {
    const edicao = edicaoAPartirDe(
      { colaboradorId: ID, aba: "escala" },
      ID,
      "dados-basicos",
    );
    const outraSecao = { ...edicao, edicao: "endereco" as const };
    expect(voltarDaEdicao(outraSecao)).toEqual({
      colaboradorId: ID,
      aba: "escala",
    });
  });
});
