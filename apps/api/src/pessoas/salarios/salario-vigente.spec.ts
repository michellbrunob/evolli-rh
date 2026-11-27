import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";
import { decidirSalarioDoContrato } from "./salario-vigente";

/**
 * T215 — o salário na edição do contrato (Dados profissionais): com linha do
 * tempo, o contrato só ESPELHA o período vigente; mudar o salário é uma
 * alteração com data na aba Salários, nunca uma reescrita do período.
 */
function recusa(fn: () => unknown): unknown {
  try {
    fn();
  } catch (erro) {
    expect(erro).toBeInstanceOf(CamposRecusadosException);
    return (erro as CamposRecusadosException).erros;
  }
  throw new Error("esperava recusa");
}

describe("T215 — decidirSalarioDoContrato", () => {
  it("com histórico e sem salário no corpo: mantém o vigente", () => {
    expect(decidirSalarioDoContrato("2000.00", undefined)).toEqual({
      acao: "manter",
    });
  });

  it("com histórico e o MESMO salário: mantém (formulário antigo, sem mudança)", () => {
    expect(decidirSalarioDoContrato("2000.00", "2000.00")).toEqual({
      acao: "manter",
    });
  });

  it("com histórico e salário diferente: recusa por campo, sem sobrescrever", () => {
    expect(
      recusa(() => decidirSalarioDoContrato("2045.00", "2000.00")),
    ).toEqual([{ campo: "salarioBruto", motivo: "nao_se_aplica" }]);
  });

  it("com histórico e salário apagado (null explícito): recusa obrigatorio", () => {
    expect(recusa(() => decidirSalarioDoContrato("2000.00", null))).toEqual([
      { campo: "salarioBruto", motivo: "obrigatorio" },
    ]);
  });

  it("sem histórico e com salário: abre a linha da admissão", () => {
    expect(decidirSalarioDoContrato(null, "1900.00")).toEqual({
      acao: "abrir_admissao",
      salarioBruto: "1900.00",
    });
  });

  it.each([undefined, null])(
    "sem histórico e sem salário (%p): nada muda no salário",
    (enviado) => {
      expect(decidirSalarioDoContrato(null, enviado)).toEqual({
        acao: "nenhuma",
      });
    },
  );
});
