import { GestorConsultaService } from "./gestor-consulta.service";

/**
 * Uma requisição, um instante (T151, revisão final — R2).
 *
 * A consulta do gestor usa a data corrente em três lugares: resolver o escopo
 * do ator, filtrar as alocações vigentes e preencher o campo informativo da
 * resposta. Se cada um lesse o relógio por conta própria, uma requisição que
 * atravessasse a meia-noite resolveria o escopo em 31/01 e leria os vínculos
 * em 01/02 — uma janela estreita, mas real, em que o conjunto autorizado e o
 * conjunto lido são de dias diferentes.
 *
 * COMO ESTE TESTE PROVA ISSO, de forma determinística: o construtor `Date` é
 * substituído por um que **avança um dia a cada chamada sem argumentos**. Com
 * uma única leitura, as três datas coincidem. Com duas, divergem — e a
 * asserção falha. Não há espera, sleep nem dependência do relógio real.
 */
describe("GestorConsultaService: uma requisição, um instante", () => {
  const DIAS = [
    "2026-01-31T09:00:00.000Z",
    "2026-02-01T09:00:00.000Z",
    "2026-02-02T09:00:00.000Z",
  ];

  const DateReal = Date;
  let leiturasDoRelogio = 0;

  /** Datas capturadas pelo duplo de Prisma, para comparação. */
  let whereLigacao: Record<string, unknown>;
  let whereAlocacao: Record<string, unknown>;

  function instalarRelogioQueAvanca(): void {
    leiturasDoRelogio = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Date = class extends DateReal {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          // Cada `new Date()` devolve um dia diferente do anterior.
          const i = Math.min(leiturasDoRelogio, DIAS.length - 1);
          leiturasDoRelogio += 1;
          super(DIAS[i]!);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          super(...(args as [any]));
        }
      }
    };
  }

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Date = DateReal;
  });

  /**
   * Duplo mínimo de Prisma. Não imita o banco — apenas registra os `where`
   * que o serviço monta, que é onde a data aparece.
   */
  function prismaFalso(comLigacao: boolean) {
    return {
      accessUserColaborador: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          whereLigacao = args.where;
          return comLigacao ? { colaboradorId: "col-1" } : null;
        },
      },
      atribuicaoGestorEquipe: {
        findMany: async () => [
          {
            equipeId: "eq-1",
            papel: "principal" as const,
            vigenciaInicio: new DateReal("2020-01-01T00:00:00.000Z"),
            vigenciaFim: null,
          },
        ],
      },
      excecaoAcessoGestor: { findMany: async () => [] },
      vinculoFuncional: {
        findMany: async (args: {
          select: { alocacoes: { where: Record<string, unknown> } };
        }) => {
          whereAlocacao = args.select.alocacoes.where;
          return [];
        },
      },
    };
  }

  const auditoriaFalsa = { record: async () => undefined };

  function servico(comLigacao: boolean): GestorConsultaService {
    return new GestorConsultaService(
      prismaFalso(comLigacao) as never,
      auditoriaFalsa as never,
    );
  }

  const contexto = {
    actor: { id: "user-1", role: "gestor", companyId: "emp-1" },
    metadata: { ip: "127.0.0.1", userAgent: "teste", requestId: "req-1" },
  } as never;

  /** `{ lte: Date }` -> `'YYYY-MM-DD'`. */
  function diaDe(filtro: unknown): string {
    const lte = (filtro as { lte: Date }).lte;
    return lte.toISOString().slice(0, 10);
  }

  it("o relógio é lido UMA vez, mesmo com o dia virando entre as chamadas", async () => {
    instalarRelogioQueAvanca();

    const resposta = await servico(true).listarEquipe(contexto);

    // Controle de que o relógio realmente avançaria: o duplo foi instalado e
    // teria entregue 2026-02-01 numa segunda leitura.
    expect(leiturasDoRelogio).toBeGreaterThan(0);

    const daLigacao = diaDe(whereLigacao.vigenciaInicio);
    const daAlocacao = diaDe(whereAlocacao.vigenteDe);

    // As três referências temporais da requisição são a MESMA.
    expect(daLigacao).toBe("2026-01-31");
    expect(daAlocacao).toBe("2026-01-31");
    expect(resposta.dataReferencia).toBe("2026-01-31");
  });

  it("também na resposta VAZIA, que antes derivava a data outra vez", async () => {
    // Este era o caso concreto da segunda leitura: sem ligação, o escopo
    // devolvia `null` e o campo informativo chamava `hoje()` de novo. Com o
    // relógio avançando, isso produziria 2026-02-01 numa resposta cujo escopo
    // foi decidido em 2026-01-31.
    instalarRelogioQueAvanca();

    const resposta = await servico(false).listarEquipe(contexto);

    expect(resposta.itens).toEqual([]);
    expect(diaDe(whereLigacao.vigenciaInicio)).toBe("2026-01-31");
    expect(resposta.dataReferencia).toBe("2026-01-31");
  });

  it("o duplo de relógio de fato avança — senão os testes acima não provariam nada", () => {
    instalarRelogioQueAvanca();

    const primeira = new Date().toISOString().slice(0, 10);
    const segunda = new Date().toISOString().slice(0, 10);

    expect(primeira).toBe("2026-01-31");
    expect(segunda).toBe("2026-02-01");
    expect(primeira).not.toBe(segunda);
  });
});
