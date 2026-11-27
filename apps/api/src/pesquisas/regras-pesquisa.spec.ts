import {
  cpfNormalizado,
  minutosEstimados,
  motivoIndisponivel,
  podeEditar,
  primeiroNome,
  statusEfetivo,
  transicaoValida,
} from "./regras-pesquisa";
import { STATUS_PESQUISA } from "./pesquisas.types";

/** T216 — status calculado, transições e auxiliares da página pública. */

describe("T216 — statusEfetivo", () => {
  const hoje = "2026-11-27";

  it("ativa ou pausada com prazo vencido conta como finalizada", () => {
    expect(statusEfetivo("ativa", "2026-11-26", hoje)).toBe("finalizada");
    expect(statusEfetivo("pausada", "2026-11-26", hoje)).toBe("finalizada");
  });

  it("o dia do encerramento ainda vale; sem prazo, nunca vence", () => {
    expect(statusEfetivo("ativa", hoje, hoje)).toBe("ativa");
    expect(statusEfetivo("ativa", null, hoje)).toBe("ativa");
  });

  it("rascunho e cancelada não mudam pelo prazo", () => {
    expect(statusEfetivo("rascunho", "2020-01-01", hoje)).toBe("rascunho");
    expect(statusEfetivo("cancelada", "2020-01-01", hoje)).toBe("cancelada");
  });
});

describe("T216 — transições", () => {
  const validas = new Set([
    "ativa>pausada",
    "ativa>finalizada",
    "ativa>cancelada",
    "pausada>ativa",
    "pausada>finalizada",
    "pausada>cancelada",
  ]);

  it("só as do documento; rascunho → ativa só pelo Publicar", () => {
    for (const de of STATUS_PESQUISA) {
      for (const para of STATUS_PESQUISA) {
        expect(transicaoValida(de, para)).toBe(validas.has(`${de}>${para}`));
      }
    }
  });

  it("edita só rascunho, ativa e pausada", () => {
    expect(STATUS_PESQUISA.filter(podeEditar)).toEqual([
      "rascunho",
      "ativa",
      "pausada",
    ]);
  });
});

describe("T216 — página pública", () => {
  it("motivo do aviso por status", () => {
    expect(motivoIndisponivel("ativa")).toBeNull();
    expect(motivoIndisponivel("pausada")).toBe("pausada");
    expect(motivoIndisponivel("finalizada")).toBe("encerrada");
    expect(motivoIndisponivel("cancelada")).toBe("cancelada");
    expect(motivoIndisponivel("rascunho")).toBe("inexistente");
  });

  it("tempo estimado, primeiro nome e CPF", () => {
    expect(minutosEstimados(0)).toBe(1);
    expect(minutosEstimados(8)).toBe(3);
    expect(primeiroNome("  Pessoa  Sintética Um ")).toBe("Pessoa");
    expect(cpfNormalizado("123.456.789-09")).toBe("12345678909");
    expect(cpfNormalizado("1234567890")).toBeNull();
    expect(cpfNormalizado("abc")).toBeNull();
  });
});
