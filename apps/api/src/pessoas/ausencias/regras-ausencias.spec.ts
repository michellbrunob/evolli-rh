import { proximoStatus, validarForma } from "./ausencias.service";
import type { RegistrarAusenciaDto } from "./ausencias.dto";

/** T215 — transições das decisões e regras de forma do registro. */
describe("T215 — regras de ausências", () => {
  describe("decisões", () => {
    it.each([
      ["aguardando_rh", "aprovar", "aprovada"],
      ["aguardando_gestor", "aprovar", "aprovada"],
      ["ajuste_sugerido", "aprovar", "aprovada"],
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
});
