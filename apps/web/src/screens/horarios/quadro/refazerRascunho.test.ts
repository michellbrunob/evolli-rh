import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consultarQuadro,
  gravarDias,
  limparDias,
  type DiaGravadoApi,
} from "../../../api/escalaClient";
import { escala, pessoa } from "./fixturasDoQuadro";
import {
  DIAS_DO_REFAZER,
  planoDeRefazer,
  refazerRascunhoDoQuadro,
} from "./refazerRascunho";
import { diasDoPeriodo } from "./quadroDaEscala";

vi.mock("../../../api/escalaClient", async (original) => ({
  ...(await original<typeof import("../../../api/escalaClient")>()),
  consultarQuadro: vi.fn(),
  gravarDias: vi.fn(),
  limparDias: vi.fn(),
}));

function gravado(
  dia: string,
  extra: Partial<DiaGravadoApi> = {},
): DiaGravadoApi {
  return {
    dia,
    camada: "rascunho",
    tipo: "folga",
    turno: null,
    periodos: [],
    intervaloMinutos: 0,
    sobreaviso: [],
    unidade: null,
    observacao: null,
    ...extra,
  };
}

const SEMANA = diasDoPeriodo("2026-11-23", "2026-11-29");

describe("T215 — refazer o rascunho do quadro pelo padrão novo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("o rascunho vira o padrão em cada dia; ausência aprovada e fora do vínculo ficam; sem escala limpa", () => {
    const p = pessoa("Ana", {
      colaboradorId: "a",
      escalas: [escala({ vigenciaInicio: "2026-11-23" })],
      dias: [
        gravado("2026-11-23", { observacao: "Abre a loja" }),
        gravado("2026-11-24", { camada: "publicado", tipo: "dsr" }),
      ],
      ausencias: [
        {
          id: "x",
          tipo: "ferias",
          motivoAfastamento: null,
          inicio: "2026-11-25",
          fim: "2026-11-25",
        },
      ],
      dataDesligamento: "2026-11-28",
    });
    const plano = planoDeRefazer(p, SEMANA);
    expect(
      plano.gravar.map((g) => [g.dia, g.tipo, g.tabelaHorarioId ?? null]),
    ).toEqual([
      ["2026-11-23", "trabalho", "t-Comercial"],
      ["2026-11-24", "trabalho", "t-Comercial"],
      ["2026-11-26", "trabalho", "t-Comercial"],
      ["2026-11-27", "trabalho", "t-Comercial"],
      ["2026-11-28", "folga", null],
    ]);
    // A observação do dia fica.
    expect(plano.gravar[0]!.observacao).toBe("Abre a loja");
    expect(plano.limpar).toEqual([]);

    // Sem escala no dia: o rascunho volta ao vazio.
    const sem = pessoa("Bia", {
      colaboradorId: "b",
      dias: [gravado("2026-11-23")],
    });
    expect(planoDeRefazer(sem, SEMANA.slice(0, 2))).toEqual({
      gravar: [],
      limpar: [
        { colaboradorId: "b", dia: "2026-11-23" },
        { colaboradorId: "b", dia: "2026-11-24" },
      ],
    });
  });

  it("no servidor: lê o quadro dos 28 dias, grava e limpa, e diz quantos dias mudaram", async () => {
    expect(DIAS_DO_REFAZER).toBe(28);
    vi.mocked(consultarQuadro).mockImplementation(async (inicio, fim) => ({
      empresaId: "emp",
      inicio,
      fim,
      pessoas: [
        pessoa("Ana", {
          colaboradorId: "a",
          escalas: [escala({ vigenciaInicio: "2026-11-23" })],
        }),
        pessoa("Outra", { colaboradorId: "o", escalas: [escala()] }),
        pessoa("Sem", { colaboradorId: "s" }),
      ],
    }));
    vi.mocked(gravarDias).mockResolvedValue([]);
    vi.mocked(limparDias).mockResolvedValue(0);
    const n = await refazerRascunhoDoQuadro("a", "2026-11-23");
    expect(consultarQuadro).toHaveBeenCalledWith("2026-11-23", "2026-12-20");
    const gravados = vi.mocked(gravarDias).mock.calls[0]![0];
    expect(gravados).toHaveLength(28);
    expect(new Set(gravados.map((g) => g.colaboradorId))).toEqual(
      new Set(["a"]),
    );
    expect(n).toBe(28);
    // Sem escala: o rascunho dos 28 dias é limpo.
    expect(await refazerRascunhoDoQuadro("s", "2026-11-23")).toBe(28);
    const limpos = vi.mocked(limparDias).mock.calls[0]![0];
    expect(limpos).toHaveLength(28);
    expect(limpos[0]).toEqual({ colaboradorId: "s", dia: "2026-11-23" });
    // Pessoa fora do quadro (sem vínculo no período): nada.
    vi.mocked(gravarDias).mockClear();
    expect(await refazerRascunhoDoQuadro("x", "2026-11-23")).toBe(0);
    expect(gravarDias).not.toHaveBeenCalled();
  });
});
