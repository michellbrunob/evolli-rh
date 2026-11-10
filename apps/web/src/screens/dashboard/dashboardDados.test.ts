/**
 * T205 — dados do Dashboard: período, série mensal (paginação de trás para
 * frente, teto, exclusões, deduplicação) e frase-resumo. Funções puras, sem
 * tela.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  ListarMovimentacoesQuery,
  MovimentacaoApi,
} from "../../api/movimentacaoClient";
import {
  LeituraAbandonada,
  TAMANHO_PAGINA_MOVIMENTACOES,
  TETO_DE_PAGINAS_POR_SERIE,
  diaCivilDe,
  fraseResumo,
  lerSerieMensal,
  periodoDoAno,
} from "./dashboardDados";

/** 9 de novembro de 2026, meio-dia, no relógio do navegador. */
const AGORA = new Date(2026, 10, 9, 12, 0, 0);

let n = 0;
function mov(
  vigenciaInicio: string,
  parcial: Partial<MovimentacaoApi> = {},
): MovimentacaoApi {
  n += 1;
  return {
    id: `m-${n}`,
    vinculoId: `v-${n}`,
    empresaId: "empresa-sintetica",
    tipo: "admissao",
    status: "efetivada",
    motivoCodigo: "admissao_inicial",
    registradaEm: "2026-01-01T00:00:00.000Z",
    solicitanteUserId: "u-1",
    vigenciaInicio,
    efetivadaEm: "2026-01-01T00:00:00.000Z",
    executorUserId: "u-1",
    retificaId: null,
    destinoUnidadeOrganizacionalId: null,
    destinoDepartamentoId: null,
    destinoAreaId: null,
    destinoEquipeId: null,
    destinoCargoId: null,
    destinoCentroCustoId: null,
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    ...parcial,
  } as MovimentacaoApi;
}

/** "Servidor" que devolve a lista (já em ordem decrescente) paginada. */
function servidor(todas: MovimentacaoApi[]) {
  return vi.fn(async (q: ListarMovimentacoesQuery) => {
    const tamanho = q.tamanhoPagina ?? 20;
    const pagina = q.pagina ?? 1;
    const doTipo = todas.filter(
      (m) => m.tipo === q.tipo && m.status === q.status,
    );
    return {
      itens: doTipo.slice((pagina - 1) * tamanho, pagina * tamanho),
      pagina,
      tamanhoPagina: tamanho,
      total: doTipo.length,
    };
  });
}

describe("T205 — período do ano", () => {
  it("ano corrente: de 1º de janeiro até hoje, meses até o mês atual", () => {
    expect(periodoDoAno(2026, AGORA)).toEqual({
      ano: 2026,
      inicio: "2026-01-01",
      fim: "2026-11-09",
      meses: 11,
      ateHoje: true,
    });
  });

  it("ano passado: o ano inteiro", () => {
    expect(periodoDoAno(2025, AGORA)).toEqual({
      ano: 2025,
      inicio: "2025-01-01",
      fim: "2025-12-31",
      meses: 12,
      ateHoje: false,
    });
  });

  it("dia civil da API: data pura ou instante; malformado é nulo", () => {
    expect(diaCivilDe("2026-03-05")).toBe("2026-03-05");
    expect(diaCivilDe("2026-03-05T00:00:00.000Z")).toBe("2026-03-05");
    expect(diaCivilDe("05/03/2026")).toBeNull();
  });
});

describe("T205 — série mensal (movimentações efetivadas)", () => {
  it("agrupa pelo mês da vigência, só efetivadas do tipo pedido, até hoje", async () => {
    const listar = servidor([
      mov("2026-12-01"), // futura: fora do período (depois de hoje)
      mov("2026-11-10"), // amanhã: fora
      mov("2026-11-09"), // hoje: dentro
      mov("2026-03-15"),
      mov("2026-03-01"),
      mov("2026-01-01"),
      mov("2025-12-31"), // antes do início: para a leitura
      mov("2025-06-01"),
    ]);
    const serie = await lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      listar,
    );
    expect(serie).toEqual({
      tipo: "completa",
      porMes: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1],
      total: 4,
    });
    expect(listar).toHaveBeenCalledWith({
      tipo: "admissao",
      status: "efetivada",
      pagina: 1,
      tamanhoPagina: TAMANHO_PAGINA_MOVIMENTACOES,
    });
  });

  it("descarta, além do servidor, outro tipo e outro status (retificada, cancelada…)", async () => {
    const listar = vi.fn(async () => ({
      itens: [
        mov("2026-05-01"),
        mov("2026-05-02", { status: "retificada" }),
        mov("2026-05-03", { status: "cancelada" }),
        mov("2026-05-04", { tipo: "desligamento" }),
      ],
      pagina: 1,
      tamanhoPagina: 100,
      total: 4,
    }));
    const serie = await lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      listar,
    );
    expect(serie).toMatchObject({ tipo: "completa", total: 1 });
  });

  it("lê todas as páginas de trás para frente até passar do início do ano, sem repetir", async () => {
    // 250 movimentações no ano e mais algumas do ano anterior.
    const doAno = Array.from({ length: 250 }, (_, i) =>
      mov(`2026-${String(10 - (i % 10)).padStart(2, "0")}-15`),
    ).sort((a, b) => (a.vigenciaInicio < b.vigenciaInicio ? 1 : -1));
    const anteriores = [mov("2025-12-01"), mov("2025-11-01")];
    const todas = [...doAno, ...anteriores];
    const listar = servidor(todas);
    const serie = await lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      listar,
    );
    expect(serie).toMatchObject({ tipo: "completa", total: 250 });
    expect(listar).toHaveBeenCalledTimes(3);
    expect(listar.mock.calls.map(([q]) => q.pagina)).toEqual([1, 2, 3]);
  });

  it("um registro que reaparece na página seguinte conta uma vez", async () => {
    const repetida = mov("2026-04-10");
    const primeira = Array.from({ length: 99 }, () => mov("2026-05-10"));
    const listar = vi
      .fn()
      .mockResolvedValueOnce({
        itens: [...primeira, repetida],
        pagina: 1,
        tamanhoPagina: 100,
        total: 101,
      })
      .mockResolvedValueOnce({
        itens: [repetida],
        pagina: 2,
        tamanhoPagina: 100,
        total: 101,
      });
    const serie = await lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      listar,
    );
    expect(serie).toMatchObject({ tipo: "completa", total: 100 });
  });

  it("teto: 20 páginas sem passar do início do ano → excedida, sem número parcial", async () => {
    const listar = vi.fn(async (q: ListarMovimentacoesQuery) => ({
      itens: Array.from({ length: 100 }, () => mov("2026-06-01")),
      pagina: q.pagina ?? 1,
      tamanhoPagina: 100,
      total: 5000,
    }));
    const serie = await lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      listar,
    );
    expect(serie).toEqual({ tipo: "excedida" });
    expect(TETO_DE_PAGINAS_POR_SERIE).toBe(20);
    expect(listar).toHaveBeenCalledTimes(20);
  });

  it("2.001 no ano: passa do teto de 2.000 → excedida depois de exatamente 20 páginas", async () => {
    const listar = servidor(
      Array.from({ length: 2001 }, () => mov("2026-06-01")),
    );
    const serie = await lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      listar,
    );
    expect(serie).toEqual({ tipo: "excedida" });
    expect(listar).toHaveBeenCalledTimes(20);
  });

  it("leitura que deixou de valer: não pede as páginas seguintes", async () => {
    const listar = servidor(
      Array.from({ length: 300 }, () => mov("2026-06-01")),
    );
    let vale = true;
    const leitura = lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      async (q) => {
        const r = await listar(q);
        vale = false; // outro ano pedido enquanto a 1ª página chegava
        return r;
      },
      () => vale,
    );
    await expect(leitura).rejects.toBeInstanceOf(LeituraAbandonada);
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it("exatamente no teto, mas completa (a 20ª página é a última): números completos", async () => {
    const todas = Array.from({ length: 2000 }, () => mov("2026-06-01"));
    const serie = await lerSerieMensal(
      "admissao",
      periodoDoAno(2026, AGORA),
      servidor(todas),
    );
    expect(serie).toMatchObject({ tipo: "completa", total: 2000 });
  });

  it("ano passado: pula as do ano corrente e conta só as do ano pedido", async () => {
    const serie = await lerSerieMensal(
      "desligamento",
      periodoDoAno(2025, AGORA),
      servidor([
        mov("2026-02-01", { tipo: "desligamento" }),
        mov("2025-12-31", { tipo: "desligamento" }),
        mov("2025-01-01", { tipo: "desligamento" }),
        mov("2024-12-31", { tipo: "desligamento" }),
      ]),
    );
    expect(serie).toEqual({
      tipo: "completa",
      porMes: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      total: 2,
    });
  });

  it("falha da leitura propaga (a tela mostra a falha, sem número parcial)", async () => {
    const listar = vi
      .fn()
      .mockResolvedValueOnce({
        itens: Array.from({ length: 100 }, () => mov("2026-06-01")),
        pagina: 1,
        tamanhoPagina: 100,
        total: 300,
      })
      .mockRejectedValueOnce(new Error("rede"));
    await expect(
      lerSerieMensal("admissao", periodoDoAno(2026, AGORA), listar),
    ).rejects.toThrow("rede");
  });
});

describe("T205 — frase-resumo", () => {
  it("pessoas para ativos e em admissão; vínculos para admissões e desligamentos", () => {
    expect(fraseResumo(12, 2, 5, 1, periodoDoAno(2026, AGORA))).toBe(
      "Hoje há 12 pessoas ativas e 2 pessoas em admissão. Em 2026, até hoje, houve 5 admissões e 1 desligamento de vínculos efetivados.",
    );
  });

  it("singular e zero; ano passado sem 'até hoje'", () => {
    expect(fraseResumo(1, 0, 0, 3, periodoDoAno(2025, AGORA))).toBe(
      "Hoje há 1 pessoa ativa e 0 pessoas em admissão. Em 2025, houve 0 admissões e 3 desligamentos de vínculos efetivados.",
    );
  });
});
