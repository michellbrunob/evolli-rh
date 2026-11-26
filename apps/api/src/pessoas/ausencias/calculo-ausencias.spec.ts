import {
  avisosDaClt,
  diaDaVolta,
  diasCorridos,
  diasUteis,
  diasProporcionais,
  direitoDoTipo,
  indiceDoPeriodoAtual,
  regraDeFeriasDoTipo,
  ehDiaUtil,
  hojeEmSaoPaulo,
  maxVendaveis,
  periodoParaFerias,
  periodosAquisitivos,
  prazoDoAbono,
  seSobrepoem,
  somarDias,
  somarMeses,
  type AusenciaDoSaldo,
} from "./calculo-ausencias";

/**
 * T215 — Férias e ausências: os cálculos puros (dias civis `AAAA-MM-DD`).
 * Feriados: só os NACIONAIS fixos por lei (não há calendário de feriados no
 * servidor); estaduais e municipais ficam para quando houver o cadastro.
 */
describe("T215 — cálculos de ausências", () => {
  describe("datas", () => {
    it("hoje é o dia civil de São Paulo", () => {
      expect(hojeEmSaoPaulo(new Date("2026-11-24T02:30:00Z"))).toBe(
        "2026-11-23",
      );
      expect(hojeEmSaoPaulo(new Date("2026-11-24T03:00:00Z"))).toBe(
        "2026-11-24",
      );
    });

    it("somar dias e meses (fim de mês ajustado)", () => {
      expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
      expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
      expect(somarMeses("2024-01-31", 1)).toBe("2024-02-29");
      expect(somarMeses("2025-01-01", 12)).toBe("2026-01-01");
    });

    it("dias corridos contam o primeiro e o último", () => {
      expect(diasCorridos("2027-01-05", "2027-01-24")).toBe(20);
      expect(diasCorridos("2026-12-02", "2026-12-02")).toBe(1);
    });
  });

  describe("dias úteis e volta", () => {
    it("segunda a sexta, menos feriados nacionais", () => {
      expect(diasUteis("2027-01-05", "2027-01-24")).toBe(14);
      // 20/11/2026 (sexta) é feriado nacional (Lei 14.759/2023).
      expect(diasUteis("2026-11-16", "2026-11-22")).toBe(4);
      expect(ehDiaUtil("2026-12-25")).toBe(false);
      expect(ehDiaUtil("2026-11-21")).toBe(false); // sábado
      expect(ehDiaUtil("2026-11-23")).toBe(true);
    });

    it("a volta é o primeiro dia útil depois do fim", () => {
      expect(diaDaVolta("2027-01-24")).toBe("2027-01-25");
      expect(diaDaVolta("2026-12-04")).toBe("2026-12-07");
      // 25/12 feriado, 26 e 27 fim de semana.
      expect(diaDaVolta("2026-12-24")).toBe("2026-12-28");
    });
  });

  describe("períodos aquisitivos e saldo", () => {
    const sem: AusenciaDoSaldo[] = [];

    it("ciclos de 12 meses desde a admissão; prazo de gozo 12 meses depois", () => {
      const p = periodosAquisitivos({
        admissao: "2024-01-01",
        ate: "2026-11-23",
        hoje: "2026-11-23",
        direito: 30,
        ausencias: sem,
      });
      expect(p.map((x) => [x.inicio, x.fim, x.prazoGozo, x.situacao])).toEqual([
        ["2024-01-01", "2024-12-31", "2025-12-31", "vencido"],
        ["2025-01-01", "2025-12-31", "2026-12-31", "disponivel"],
        ["2026-01-01", "2026-12-31", "2027-12-31", "em_aquisicao"],
      ]);
      expect(p.every((x) => x.direito === 30 && x.disponiveis === 30)).toBe(
        true,
      );
    });

    it("solicitados: férias que ocupam saldo, com os dias vendidos", () => {
      const p = periodosAquisitivos({
        admissao: "2025-01-01",
        ate: "2026-11-23",
        hoje: "2026-11-23",
        direito: 30,
        ausencias: [
          {
            tipo: "ferias",
            status: "aprovada",
            inicio: "2026-03-02",
            fim: "2026-03-21",
            diasVendidos: 10,
            periodoAquisitivoInicio: "2025-01-01",
          },
          {
            tipo: "ferias",
            status: "cancelada",
            inicio: "2026-05-04",
            fim: "2026-05-08",
            diasVendidos: 0,
            periodoAquisitivoInicio: "2025-01-01",
          },
          {
            tipo: "day_off",
            status: "aprovada",
            inicio: "2026-06-01",
            fim: "2026-06-01",
            diasVendidos: 0,
            periodoAquisitivoInicio: null,
          },
        ],
      });
      expect(p[0]).toMatchObject({ solicitados: 30, disponiveis: 0 });
      // Sem saldo: vencido não, disponível com 0.
      expect(p[0]!.situacao).toBe("disponivel");
    });

    it("só CLT e Estágio têm saldo automático (30 dias); os demais, 0", () => {
      expect(direitoDoTipo("clt")).toBe(30);
      expect(direitoDoTipo("estagio")).toBe(30);
      expect(direitoDoTipo("aprendiz")).toBe(0);
      expect(direitoDoTipo("pj")).toBe(0);
      expect(direitoDoTipo("freelancer")).toBe(0);
    });

    it.each([
      ["clt", "calculada"],
      ["estagio", "calculada"],
      ["pj", "sem_ferias"],
      ["freelancer", "sem_ferias"],
      ["aprendiz", "sem_regra"],
      ["temporario", "sem_regra"],
      ["part_time", "sem_regra"],
      ["trainee", "sem_regra"],
      ["outro_controlado", "sem_regra"],
    ] as const)("regra de férias de %s: %s", (tipo, regra) => {
      expect(regraDeFeriasDoTipo(tipo)).toBe(regra);
    });

    it("de que período as férias descontam: o mais antigo completo e ainda no prazo, com saldo", () => {
      const p = periodosAquisitivos({
        admissao: "2024-01-01",
        ate: "2027-01-05",
        hoje: "2026-11-23",
        direito: 30,
        ausencias: sem,
      });
      expect(periodoParaFerias(p, "2027-01-05")?.inicio).toBe("2026-01-01");
      expect(periodoParaFerias(p, "2026-12-01")?.inicio).toBe("2025-01-01");
      // Pedido explícito, mas ainda em aquisição na data: não serve.
      expect(periodoParaFerias(p, "2026-12-01", "2026-01-01")).toBeNull();
      expect(periodoParaFerias(p, "2026-12-01", "2025-01-01")?.inicio).toBe(
        "2025-01-01",
      );
    });

    it("abono pecuniário: até 1/3 (no máximo 10) e pedido até 15 dias antes do fim do período", () => {
      expect(maxVendaveis(30)).toBe(10);
      expect(maxVendaveis(12)).toBe(4);
      expect(maxVendaveis(0)).toBe(0);
      expect(prazoDoAbono({ inicio: "2026-01-01", fim: "2026-12-31" })).toBe(
        "2026-12-16",
      );
    });
  });

  describe("reinício do período aquisitivo (como a referência, 2026-11-26)", () => {
    const sem: AusenciaDoSaldo[] = [];
    const base = {
      admissao: "2026-02-16",
      hoje: "2026-11-26",
      direito: 30,
      ausencias: sem,
    };

    it("proporcional: 2,5 dias por mês; fração de 15 dias ou mais conta o mês", () => {
      // 16/02 a 31/10: 8 meses e 16 dias → 9 meses → 22,5 → 23.
      expect(diasProporcionais("2026-02-16", "2026-10-31", 30)).toBe(23);
      // 8 meses e 14 dias → 8 meses → 20.
      expect(diasProporcionais("2026-02-16", "2026-10-29", 30)).toBe(20);
      // 12 meses cheios: o direito inteiro, nunca acima.
      expect(diasProporcionais("2026-02-16", "2027-02-15", 30)).toBe(30);
      expect(diasProporcionais("2026-02-16", "2026-02-20", 30)).toBe(0);
    });

    it("férias coletivas: encurta o período (proporcional) e recomeça a contagem", () => {
      const p = periodosAquisitivos({
        ...base,
        ate: "2026-11-26",
        reinicios: [
          { inicio: "2026-11-01", motivo: "ferias_coletivas", dias: null },
        ],
      });
      expect(
        p.map((x) => [x.inicio, x.fim, x.direito, x.prazoGozo, x.situacao]),
      ).toEqual([
        ["2026-02-16", "2026-10-31", 23, "2027-10-31", "disponivel"],
        ["2026-11-01", "2027-10-31", 30, "2028-10-31", "em_aquisicao"],
      ]);
      expect(p[0]!.encurtado).toEqual({
        motivo: "ferias_coletivas",
        novoInicio: "2026-11-01",
      });
      expect(p[1]!.encurtado).toBeNull();
    });

    it("perda do direito: o período encurtado dá 0, salvo os dias informados", () => {
      const perda = periodosAquisitivos({
        ...base,
        ate: "2026-11-26",
        reinicios: [
          { inicio: "2026-11-01", motivo: "perda_direito", dias: null },
        ],
      });
      expect(perda[0]).toMatchObject({ direito: 0, disponiveis: 0 });
      const informado = periodosAquisitivos({
        ...base,
        ate: "2026-11-26",
        reinicios: [{ inicio: "2026-11-01", motivo: "outro", dias: 10 }],
      });
      expect(informado[0]).toMatchObject({ direito: 10, disponiveis: 10 });
    });

    it("reinício no futuro: o período em curso segue inteiro; o seguinte é encurtado", () => {
      const p = periodosAquisitivos({
        ...base,
        ate: "2028-01-01",
        reinicios: [{ inicio: "2028-01-01", motivo: "outro", dias: 10 }],
      });
      expect(p.map((x) => [x.inicio, x.fim, x.direito, x.situacao])).toEqual([
        ["2026-02-16", "2027-02-15", 30, "em_aquisicao"],
        ["2027-02-16", "2027-12-31", 10, "em_aquisicao"],
        ["2028-01-01", "2028-12-31", 30, "em_aquisicao"],
      ]);
    });

    it("dois reinícios em sequência; o que cai no início de um período só recomeça dali", () => {
      const p = periodosAquisitivos({
        ...base,
        ate: "2027-06-01",
        hoje: "2027-06-01",
        reinicios: [
          { inicio: "2027-03-01", motivo: "outro", dias: null },
          { inicio: "2026-11-01", motivo: "ferias_coletivas", dias: null },
          // Igual ao início natural: nada a encurtar.
          { inicio: "2026-02-16", motivo: "outro", dias: 5 },
        ],
      });
      expect(p.map((x) => [x.inicio, x.fim, x.direito])).toEqual([
        ["2026-02-16", "2026-10-31", 23],
        // 01/11/2026 a 28/02/2027: 4 meses → 10.
        ["2026-11-01", "2027-02-28", 10],
        ["2027-03-01", "2028-02-29", 30],
      ]);
    });

    it("as férias continuam no período em que foram lançadas", () => {
      const p = periodosAquisitivos({
        ...base,
        ate: "2026-11-26",
        ausencias: [
          {
            tipo: "ferias",
            status: "aprovada",
            inicio: "2026-11-01",
            fim: "2026-11-10",
            diasVendidos: 0,
            periodoAquisitivoInicio: "2026-02-16",
          },
        ],
        reinicios: [
          { inicio: "2026-11-01", motivo: "ferias_coletivas", dias: null },
        ],
      });
      expect(p[0]).toMatchObject({ solicitados: 10, disponiveis: 13 });
    });

    it("o período que a ficha mostra: com saldo; senão o encurtado logo antes do atual; senão o atual", () => {
      const comSaldo = periodosAquisitivos({
        ...base,
        ate: "2026-11-26",
        reinicios: [
          { inicio: "2026-11-01", motivo: "ferias_coletivas", dias: null },
        ],
      });
      expect(indiceDoPeriodoAtual(comSaldo, "2026-11-26")).toBe(0);
      const perda = periodosAquisitivos({
        ...base,
        ate: "2026-11-26",
        reinicios: [
          { inicio: "2026-11-01", motivo: "perda_direito", dias: null },
        ],
      });
      expect(indiceDoPeriodoAtual(perda, "2026-11-26")).toBe(0);
      const normal = periodosAquisitivos({ ...base, ate: "2026-11-26" });
      expect(indiceDoPeriodoAtual(normal, "2026-11-26")).toBe(0);
      expect(indiceDoPeriodoAtual([], "2026-11-26")).toBeNull();
      // Vencido com saldo aparece (antes: só "disponível").
      const vencido = periodosAquisitivos({
        admissao: "2024-01-01",
        ate: "2026-11-23",
        hoje: "2026-11-23",
        direito: 30,
        ausencias: sem,
      });
      expect(indiceDoPeriodoAtual(vencido, "2026-11-23")).toBe(0);
      // Tudo tirado: o período em curso.
      const tirado = periodosAquisitivos({
        admissao: "2025-01-01",
        ate: "2026-11-23",
        hoje: "2026-11-23",
        direito: 30,
        ausencias: [
          {
            tipo: "ferias",
            status: "aprovada",
            inicio: "2026-03-02",
            fim: "2026-03-31",
            diasVendidos: 0,
            periodoAquisitivoInicio: "2025-01-01",
          },
        ],
      });
      expect(indiceDoPeriodoAtual(tirado, "2026-11-23")).toBe(1);
    });
  });

  describe("Regras da CLT no registro de férias (só aviso, como a referência)", () => {
    const periodo = {
      inicio: "2025-01-01",
      fim: "2025-12-31",
      direito: 30,
      solicitados: 0,
      disponiveis: 30,
      prazoGozo: "2026-12-31",
      situacao: "disponivel" as const,
      encurtado: null,
    };

    it("período com menos de 5 dias corridos (art. 134, § 1º)", () => {
      // Terça a quinta.
      expect(
        avisosDaClt({
          inicio: "2026-12-01",
          fim: "2026-12-03",
          periodo,
          outrasFerias: [],
        }),
      ).toContainEqual({ regra: "minimo_5", dias: 3 });
      // 4 dias (terça a sexta) ainda é pouco.
      expect(
        avisosDaClt({
          inicio: "2026-12-01",
          fim: "2026-12-04",
          periodo,
          outrasFerias: [],
        }),
      ).toContainEqual({ regra: "minimo_5", dias: 4 });
      expect(
        avisosDaClt({
          inicio: "2026-12-01",
          fim: "2026-12-05",
          periodo,
          outrasFerias: [],
        }).some((a) => a.regra === "minimo_5"),
      ).toBe(false);
    });

    it("início nos 2 dias antes do domingo ou de feriado (art. 134, § 3º)", () => {
      // 04/12/2026 é sexta.
      expect(
        avisosDaClt({
          inicio: "2026-12-04",
          fim: "2026-12-17",
          periodo,
          outrasFerias: [],
        }),
      ).toEqual([
        {
          regra: "inicio_antes_de_descanso",
          antesDe: "domingo",
          dia: "2026-12-06",
        },
      ]);
      // Sábado também (véspera do domingo).
      expect(
        avisosDaClt({
          inicio: "2026-12-05",
          fim: "2026-12-18",
          periodo,
          outrasFerias: [],
        })[0],
      ).toEqual({
        regra: "inicio_antes_de_descanso",
        antesDe: "domingo",
        dia: "2026-12-06",
      });
      // 23/12/2026 (quarta): dois dias antes do Natal.
      expect(
        avisosDaClt({
          inicio: "2026-12-23",
          fim: "2027-01-05",
          periodo,
          outrasFerias: [],
        }),
      ).toContainEqual({
        regra: "inicio_antes_de_descanso",
        antesDe: "feriado",
        dia: "2026-12-25",
      });
      // Segunda-feira comum: nada.
      expect(
        avisosDaClt({
          inicio: "2026-12-07",
          fim: "2026-12-20",
          periodo,
          outrasFerias: [],
        }),
      ).toEqual([]);
    });

    it("até 3 períodos no mesmo período aquisitivo (art. 134, § 1º)", () => {
      const outras = [
        { inicio: "2026-02-02", fim: "2026-02-15" },
        { inicio: "2026-04-06", fim: "2026-04-10" },
        { inicio: "2026-06-01", fim: "2026-06-05" },
      ];
      expect(
        avisosDaClt({
          inicio: "2026-08-03",
          fim: "2026-08-07",
          periodo: { ...periodo, solicitados: 24, disponiveis: 6 },
          outrasFerias: outras,
        }),
      ).toContainEqual({ regra: "ate_3_periodos", ordem: 4 });
    });

    it("um dos períodos com 14 dias ou mais (art. 134, § 1º)", () => {
      // 10 dias agora, sobram 20: ainda cabe um de 14 — sem aviso.
      expect(
        avisosDaClt({
          inicio: "2026-08-03",
          fim: "2026-08-12",
          periodo,
          outrasFerias: [],
        }).some((a) => a.regra === "um_com_14"),
      ).toBe(false);
      // 10 já tirados (nenhum de 14) e 10 agora: sobram 10 — aviso.
      expect(
        avisosDaClt({
          inicio: "2026-08-03",
          fim: "2026-08-12",
          periodo: { ...periodo, solicitados: 10, disponiveis: 20 },
          outrasFerias: [{ inicio: "2026-02-02", fim: "2026-02-11" }],
        }),
      ).toContainEqual({ regra: "um_com_14" });
      // Já houve um de 14: sem aviso.
      expect(
        avisosDaClt({
          inicio: "2026-08-03",
          fim: "2026-08-12",
          periodo: { ...periodo, solicitados: 14, disponiveis: 16 },
          outrasFerias: [{ inicio: "2026-02-02", fim: "2026-02-15" }],
        }).some((a) => a.regra === "um_com_14"),
      ).toBe(false);
    });
  });

  describe("sobreposição", () => {
    it("intervalos que se cruzam; afastamento sem volta ocupa tudo dali em diante", () => {
      expect(
        seSobrepoem(
          { inicio: "2026-12-01", fim: "2026-12-10" },
          { inicio: "2026-12-10", fim: "2026-12-12" },
        ),
      ).toBe(true);
      expect(
        seSobrepoem(
          { inicio: "2026-12-01", fim: "2026-12-10" },
          { inicio: "2026-12-11", fim: "2026-12-12" },
        ),
      ).toBe(false);
      expect(
        seSobrepoem(
          { inicio: "2026-12-01", fim: null },
          { inicio: "2027-05-01", fim: "2027-05-02" },
        ),
      ).toBe(true);
      expect(
        seSobrepoem(
          { inicio: "2026-12-01", fim: null },
          { inicio: "2026-11-01", fim: "2026-11-30" },
        ),
      ).toBe(false);
    });
  });
});
