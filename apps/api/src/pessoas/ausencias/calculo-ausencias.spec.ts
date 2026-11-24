import {
  diaDaVolta,
  diasCorridos,
  diasUteis,
  direitoDoTipo,
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
