import {
  foraDoVinculo,
  proximoStatus,
  validarForma,
} from "./ausencias.service";
import type { RegistrarAusenciaDto } from "./ausencias.dto";

/** T215 — transições das decisões e regras de forma do registro. */
describe("T215 — regras de ausências", () => {
  describe("decisões", () => {
    it.each([
      ["aguardando_rh", "aprovar", "aprovada"],
      ["aguardando_gestor", "aprovar", "aprovada"],
      // Sem o Portal, a sugestão não tem resposta: aprovar aprovaria as datas
      // antigas (o servidor recusa por campo).
      ["ajuste_sugerido", "aprovar", null],
      ["ajuste_sugerido", "recusar", "recusada"],
      ["aprovada", "aprovar", "aprovada"],
      ["recusada", "aprovar", null],
      ["cancelada", "aprovar", null],
      ["cancelamento_pedido", "aprovar", null],
      ["aguardando_rh", "recusar", "recusada"],
      ["recusada", "recusar", "recusada"],
      ["cancelamento_pedido", "recusar", "aprovada"],
      ["aprovada", "recusar", null],
      ["aprovada", "cancelar", "cancelada"],
      ["aguardando_rh", "cancelar", "cancelada"],
      ["cancelada", "cancelar", "cancelada"],
      ["recusada", "cancelar", null],
    ] as const)("%s + %s → %s", (atual, decisao, esperado) => {
      expect(proximoStatus(atual, decisao)).toBe(esperado);
    });
  });

  describe("forma do registro", () => {
    const semFim = (dto: RegistrarAusenciaDto): RegistrarAusenciaDto => {
      const { fim: _fim, ...resto } = dto;
      void _fim;
      return resto;
    };
    const base: RegistrarAusenciaDto = {
      colaboradorId: "c",
      tipo: "ferias",
      inicio: "2027-01-05",
      fim: "2027-01-24",
      aprovada: true,
    };

    it("férias completas passam", () => {
      expect(validarForma(base)).toEqual([]);
    });

    it("fim obrigatório (salvo no afastamento) e nunca antes do início", () => {
      expect(validarForma(semFim(base))).toEqual([
        { campo: "fim", motivo: "obrigatorio" },
      ]);
      expect(validarForma({ ...base, fim: "2027-01-04" })).toEqual([
        { campo: "fim", motivo: "fim_antes_do_inicio" },
      ]);
    });

    it("afastamento: motivo obrigatório e volta opcional", () => {
      expect(validarForma(semFim({ ...base, tipo: "afastamento" }))).toEqual([
        { campo: "motivoAfastamento", motivo: "obrigatorio" },
      ]);
      expect(
        validarForma(
          semFim({
            ...base,
            tipo: "afastamento",
            motivoAfastamento: "auxilio_doenca",
          }),
        ),
      ).toEqual([]);
    });

    it("motivo, venda e período só onde se aplicam", () => {
      expect(
        validarForma({
          ...base,
          tipo: "day_off",
          motivoAfastamento: "outro",
          diasVendidos: 2,
          periodoAquisitivoInicio: "2026-01-01",
        }),
      ).toEqual([
        { campo: "motivoAfastamento", motivo: "nao_se_aplica" },
        { campo: "diasVendidos", motivo: "nao_se_aplica" },
        { campo: "periodoAquisitivoInicio", motivo: "nao_se_aplica" },
      ]);
    });
  });

  describe("dentro do vínculo", () => {
    const vinculo = {
      dataAdmissao: new Date("2026-03-02"),
      dataDesligamento: null as Date | null,
    };

    it("antes da admissão: recusa no início", () => {
      expect(foraDoVinculo(vinculo, "2026-03-01", "2026-03-05")).toEqual([
        { campo: "inicio", motivo: "antes_da_admissao" },
      ]);
      expect(foraDoVinculo(vinculo, "2026-03-02", "2026-03-05")).toEqual([]);
    });

    it("depois do desligamento: recusa no início ou no fim", () => {
      const desligado = {
        ...vinculo,
        dataDesligamento: new Date("2026-10-30"),
      };
      expect(foraDoVinculo(desligado, "2026-10-20", "2026-10-30")).toEqual([]);
      expect(foraDoVinculo(desligado, "2026-10-28", "2026-11-03")).toEqual([
        { campo: "fim", motivo: "fora_do_vinculo" },
      ]);
      expect(foraDoVinculo(desligado, "2026-11-02", "2026-11-03")).toEqual([
        { campo: "inicio", motivo: "fora_do_vinculo" },
      ]);
      // Afastamento sem volta passaria do desligamento.
      expect(foraDoVinculo(desligado, "2026-10-20", null)).toEqual([
        { campo: "fim", motivo: "fora_do_vinculo" },
      ]);
    });
  });
});
