import {
  acompanhamentoVazio,
  conferirAcompanhamento,
  detalharAcompanhamento,
  lerAcompanhamento,
} from "./acompanhamento";

/** T216 — acompanhamento da NR-1: etapas e plano de ação. */

const AGORA = new Date("2026-11-27T15:00:00Z");
const DEPOIS = new Date("2026-12-10T15:00:00Z");

const medida = {
  id: "m1",
  dimensaoId: "burnout",
  titulo: " Pausas programadas ",
  descricao: null,
  controle: "administrativo",
  responsavel: "RH",
  prazo: "2027-01-31",
  indicador: null,
  situacao: "em_andamento",
};

function corpo(extra: Record<string, unknown> = {}) {
  return { etapas: [], plano: [], profissionalSst: {}, ...extra };
}

describe("conferirAcompanhamento", () => {
  it("grava itens, evidências e a data de conclusão (que se mantém)", () => {
    const c = conferirAcompanhamento(
      corpo({
        etapas: [
          {
            id: "validar",
            itens: [false, false, false],
            evidencias: " PGR assinado na pasta do SST ",
            concluida: true,
          },
        ],
        plano: [medida],
      }),
      acompanhamentoVazio(),
      AGORA,
    );
    if (!c.ok) throw new Error("recusado");
    const validar = c.valor.etapas.find((e) => e.id === "validar")!;
    expect(validar).toEqual({
      id: "validar",
      itens: [false, false, false],
      evidencias: "PGR assinado na pasta do SST",
      concluidaEm: AGORA.toISOString(),
    });
    expect(c.valor.plano[0]!.titulo).toBe("Pausas programadas");
    expect(c.valor.atualizadoEm).toBe(AGORA.toISOString());

    const d = conferirAcompanhamento(
      corpo({
        etapas: [
          { id: "validar", itens: [true, false, false], concluida: true },
        ],
      }),
      c.valor,
      DEPOIS,
    );
    if (!d.ok) throw new Error("recusado");
    expect(d.valor.etapas[3]!.concluidaEm).toBe(AGORA.toISOString());
    // Desmarcar a conclusão apaga a data; etapa ausente fica como estava.
    const e = conferirAcompanhamento(
      corpo({
        etapas: [
          { id: "validar", itens: [true, false, false], concluida: false },
        ],
      }),
      d.valor,
      DEPOIS,
    );
    if (!e.ok) throw new Error("recusado");
    expect(e.valor.etapas[3]!.concluidaEm).toBeNull();
    expect(e.valor.etapas[3]!.itens).toEqual([true, false, false]);
  });

  it("concluir exige item marcado ou evidência; automáticas não se marcam", () => {
    const r = conferirAcompanhamento(
      corpo({
        etapas: [
          { id: "treinar", itens: [false, false, false], concluida: true },
          { id: "mapear", itens: [], concluida: true },
        ],
      }),
      acompanhamentoVazio(),
      AGORA,
    );
    expect(r).toEqual({
      ok: false,
      erros: [
        { campo: "etapas.mapear", motivo: "nao_se_aplica" },
        { campo: "etapas.treinar", motivo: "obrigatorio" },
      ],
    });
  });

  it("recusa etapas e medidas fora do formato", () => {
    const erros = (c: unknown) => {
      const r = conferirAcompanhamento(c, acompanhamentoVazio(), AGORA);
      return r.ok ? [] : r.erros;
    };
    expect(erros({})).toEqual([
      { campo: "etapas", motivo: "invalido" },
      { campo: "plano", motivo: "invalido" },
    ]);
    expect(erros(corpo({ etapas: [{ id: "outra" }] }))).toEqual([
      { campo: "etapas", motivo: "invalido" },
    ]);
    expect(
      erros(corpo({ etapas: [{ id: "comunicar", itens: [true] }] })),
    ).toEqual([{ campo: "etapas.comunicar", motivo: "invalido" }]);
    expect(
      erros(
        corpo({
          etapas: [
            {
              id: "revisar",
              itens: [true, true],
              evidencias: "x".repeat(2001),
            },
          ],
        }),
      ),
    ).toEqual([{ campo: "etapas.revisar", motivo: "limite" }]);
    expect(erros(corpo({ plano: [{ ...medida, titulo: " " }] }))).toEqual([
      { campo: "plano.m1", motivo: "obrigatorio" },
    ]);
    expect(
      erros(corpo({ plano: [{ ...medida, prazo: "2027-02-30" }] })),
    ).toEqual([{ campo: "plano.m1", motivo: "invalido" }]);
    expect(
      erros(corpo({ plano: [{ ...medida, dimensaoId: "outra" }] })),
    ).toEqual([{ campo: "plano.m1", motivo: "invalido" }]);
    expect(erros(corpo({ plano: [medida, medida] }))).toEqual([
      { campo: "plano", motivo: "invalido" },
    ]);
    expect(
      erros(
        corpo({
          plano: Array.from({ length: 201 }, (_, i) => ({
            ...medida,
            id: `m${i}`,
          })),
        }),
      ),
    ).toEqual([{ campo: "plano", motivo: "limite" }]);
    expect(
      erros(corpo({ profissionalSst: { nome: "n".repeat(121) } })),
    ).toEqual([{ campo: "profissionalSst", motivo: "limite" }]);
  });
});

describe("detalharAcompanhamento", () => {
  const publicadaEm = new Date("2026-11-27T13:00:00Z");

  it("mapear: anônima com a 1ª resposta; identificada com todos", () => {
    const vazio = acompanhamentoVazio();
    const anon = detalharAcompanhamento(vazio, {
      anonima: true,
      respostas: 1,
      participantes: 0,
      publicadaEm,
    });
    expect(anon.etapas[0]!.concluida).toBe(true);
    expect(anon.concluidas).toBe(1);
    expect(anon.proxima).toBe("plano");
    expect(anon.revisarEm).toBe("2027-11");
    const parcial = detalharAcompanhamento(vazio, {
      anonima: false,
      respostas: 2,
      participantes: 3,
      publicadaEm: null,
    });
    expect(parcial.etapas[0]!.concluida).toBe(false);
    expect(parcial.proxima).toBe("mapear");
    expect(parcial.revisarEm).toBeNull();
    const todos = detalharAcompanhamento(vazio, {
      anonima: false,
      respostas: 3,
      participantes: 3,
      publicadaEm,
    });
    expect(todos.etapas[0]!.concluida).toBe(true);
    const nenhum = detalharAcompanhamento(vazio, {
      anonima: false,
      respostas: 0,
      participantes: 0,
      publicadaEm,
    });
    expect(nenhum.etapas[0]!.concluida).toBe(false);
  });

  it("plano conclui com a 1ª medida; manuais pela data de conclusão", () => {
    const a = lerAcompanhamento({
      ...acompanhamentoVazio(),
      plano: [medida],
      etapas: [
        {
          id: "comunicar",
          itens: [true, true, true, true],
          evidencias: null,
          concluidaEm: AGORA.toISOString(),
        },
      ],
    });
    expect(a.etapas[2]!.itens).toEqual([true, true, true]);
    const d = detalharAcompanhamento(a, {
      anonima: true,
      respostas: 0,
      participantes: 0,
      publicadaEm,
    });
    expect(d.etapas.map((e) => e.concluida)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(d.etapas[1]!.automatica).toBe(true);
    expect(d.etapas[2]!.automatica).toBe(false);
    expect(d.concluidas).toBe(2);
  });

  it("lê o que estiver gravado, mesmo vazio ou antigo", () => {
    expect(lerAcompanhamento(null)).toEqual(acompanhamentoVazio());
    expect(lerAcompanhamento("x").etapas).toHaveLength(7);
  });
});
