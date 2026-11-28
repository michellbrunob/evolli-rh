import {
  acompanhamentoVazio,
  adicionarEvidencia,
  conferirAcompanhamento,
  detalharAcompanhamento,
  evidenciaDa,
  lerAcompanhamento,
  removerEvidencia,
  type ArquivoGravado,
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
      arquivos: [],
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

describe("arquivos de evidência das etapas", () => {
  const arquivo = (id: string): ArquivoGravado => ({
    id,
    nome: `ata-${id}.pdf`,
    formato: "pdf",
    tamanhoBytes: 1234,
    hashSha256: "ab".repeat(32),
    chave: `v1/empresas/e/pesquisas/p/evidencias/comunicar/${id}`,
    enviadoEm: AGORA.toISOString(),
  });
  const contexto = {
    anonima: true,
    respostas: 1,
    participantes: 0,
    publicadaEm: null,
  };

  it("acrescenta só nas etapas que a empresa conclui, até 10 por etapa", () => {
    let a = acompanhamentoVazio();
    for (let i = 0; i < 10; i += 1) {
      const r = adicionarEvidencia(a, "comunicar", arquivo(`a${i}`));
      if (!r.ok) throw new Error(r.motivo);
      a = r.valor;
    }
    expect(a.etapas[2]!.arquivos).toHaveLength(10);
    expect(adicionarEvidencia(a, "comunicar", arquivo("x"))).toEqual({
      ok: false,
      motivo: "limite",
    });
    expect(adicionarEvidencia(a, "validar", arquivo("x")).ok).toBe(true);
    expect(adicionarEvidencia(a, "mapear", arquivo("x"))).toEqual({
      ok: false,
      motivo: "nao_se_aplica",
    });
    expect(adicionarEvidencia(a, "plano", arquivo("x")).ok).toBe(false);
    expect(adicionarEvidencia(a, "outra", arquivo("x")).ok).toBe(false);
  });

  it("remove e encontra pelo id; o detalhe não expõe chave nem hash", () => {
    const r = adicionarEvidencia(
      acompanhamentoVazio(),
      "treinar",
      arquivo("t1"),
    );
    if (!r.ok) throw new Error(r.motivo);
    expect(evidenciaDa(r.valor, "treinar", "t1")?.chave).toContain("t1");
    expect(evidenciaDa(r.valor, "comunicar", "t1")).toBeNull();
    const d = detalharAcompanhamento(r.valor, contexto);
    expect(d.etapas[4]!.arquivos).toEqual([
      {
        id: "t1",
        nome: "ata-t1.pdf",
        formato: "pdf",
        tamanhoBytes: 1234,
        enviadoEm: AGORA.toISOString(),
      },
    ]);
    const sem = removerEvidencia(r.valor, "treinar", "t1");
    expect(sem?.removido.id).toBe("t1");
    expect(sem?.valor.etapas[4]!.arquivos).toEqual([]);
    expect(removerEvidencia(r.valor, "treinar", "nao-existe")).toBeNull();
    expect(removerEvidencia(r.valor, "validar", "t1")).toBeNull();
  });

  it("o PUT mantém os arquivos e aceita concluir só com arquivo", () => {
    const r = adicionarEvidencia(
      acompanhamentoVazio(),
      "comunicar",
      arquivo("c1"),
    );
    if (!r.ok) throw new Error(r.motivo);
    const c = conferirAcompanhamento(
      corpo({
        etapas: [
          {
            id: "comunicar",
            itens: [false, false, false],
            concluida: true,
            // Tentativa de trocar os arquivos pelo PUT: ignorada.
            arquivos: [],
          },
        ],
      }),
      r.valor,
      AGORA,
    );
    if (!c.ok) throw new Error("recusado");
    expect(c.valor.etapas[2]!.arquivos.map((x) => x.id)).toEqual(["c1"]);
    expect(c.valor.etapas[2]!.concluidaEm).toBe(AGORA.toISOString());
    // Sem item, descrição nem arquivo: concluir é recusado.
    const sem = conferirAcompanhamento(
      corpo({
        etapas: [
          { id: "validar", itens: [false, false, false], concluida: true },
        ],
      }),
      r.valor,
      AGORA,
    );
    expect(sem.ok).toBe(false);
  });

  it("lê os arquivos gravados e descarta os malformados", () => {
    const a = lerAcompanhamento({
      etapas: [
        {
          id: "comunicar",
          itens: [false, false, false],
          evidencias: null,
          concluidaEm: null,
          arquivos: [
            arquivo("ok"),
            { ...arquivo("sem-chave"), chave: 1 },
            { ...arquivo("formato"), formato: "exe" },
            null,
          ],
        },
      ],
    });
    expect(a.etapas[2]!.arquivos.map((x) => x.id)).toEqual(["ok"]);
    expect(a.etapas[3]!.arquivos).toEqual([]);
  });
});
