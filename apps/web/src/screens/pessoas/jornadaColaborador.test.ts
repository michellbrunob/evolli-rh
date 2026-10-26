import { describe, expect, it } from "vitest";
import {
  diaAnteriorCivil,
  jornadaDeHoje,
  mensagemDoCampo,
  rotuloDaJornada,
  situacaoDaVigencia,
  ultimoDiaDaVigencia,
  vigenciaAberta,
} from "./jornadaColaborador";
import type { VinculoHorarioApi } from "../../api/vinculoHorarioClient";

function vigencia(
  vigenciaInicio: string,
  vigenciaFim: string | null,
  id = `v-${vigenciaInicio}`,
): VinculoHorarioApi {
  return {
    id,
    colaboradorId: "c",
    empresaId: "e",
    tabelaHorarioId: "t",
    tabela: { id: "t", codigo: "COM_44H", nome: "Comercial", ativo: true },
    vigenciaInicio,
    vigenciaFim,
    criadoPorUserId: "u",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
  };
}

describe("jornadaColaborador (T183)", () => {
  it("o dia anterior atravessa mês e ano sem depender de fuso", () => {
    expect(diaAnteriorCivil("2026-03-01")).toBe("2026-02-28");
    expect(diaAnteriorCivil("2024-03-01")).toBe("2024-02-29");
    expect(diaAnteriorCivil("2026-01-01")).toBe("2025-12-31");
  });

  it("situação: o início conta, o fim gravado não conta", () => {
    const hoje = "2026-05-10";
    expect(situacaoDaVigencia(vigencia("2026-05-10", null), hoje)).toBe(
      "vigente",
    );
    expect(situacaoDaVigencia(vigencia("2026-05-11", null), hoje)).toBe(
      "programada",
    );
    expect(situacaoDaVigencia(vigencia("2026-01-01", "2026-05-10"), hoje)).toBe(
      "encerrada",
    );
    expect(situacaoDaVigencia(vigencia("2026-01-01", "2026-05-11"), hoje)).toBe(
      "vigente",
    );
  });

  it("a jornada de hoje e a vigência aberta podem ser diferentes (troca programada)", () => {
    const anterior = vigencia("2026-01-01", "2026-06-01", "a");
    const nova = vigencia("2026-06-01", null, "b");
    const lista = [nova, anterior];
    expect(jornadaDeHoje(lista, "2026-05-10")?.id).toBe("a");
    expect(vigenciaAberta(lista)?.id).toBe("b");
    expect(jornadaDeHoje(lista, "2026-06-01")?.id).toBe("b");
  });

  it("o último dia mostrado é o anterior ao fim gravado", () => {
    expect(ultimoDiaDaVigencia(vigencia("2026-01-01", "2026-04-01"))).toBe(
      "2026-03-31",
    );
    expect(ultimoDiaDaVigencia(vigencia("2026-01-01", null))).toBeNull();
  });

  it("rótulo com e sem código", () => {
    expect(rotuloDaJornada({ codigo: "COM_44H", nome: "Comercial" })).toBe(
      "COM_44H — Comercial",
    );
    expect(rotuloDaJornada({ codigo: null, nome: "Antiga" })).toBe("Antiga");
  });

  it("cada recusa por campo vira mensagem no campo; o desconhecido não", () => {
    for (const [campo, motivo, alvo] of [
      ["tabelaHorarioId", "indisponivel", "tabelaHorarioId"],
      ["tabelaHorarioId", "igual_a_vigente", "tabelaHorarioId"],
      ["vigenciaInicio", "fora_de_ordem", "vigenciaInicio"],
      ["vigenciaInicio", "sobreposta", "vigenciaInicio"],
      ["vigenciaFim", "fora_de_ordem", "vigenciaFim"],
      ["vigenciaFim", "ja_encerrada", "vigenciaFim"],
    ] as const) {
      expect(mensagemDoCampo(campo, motivo)?.campo).toBe(alvo);
    }
    expect(mensagemDoCampo("codigo", "em_uso")).toBeNull();
  });
});
