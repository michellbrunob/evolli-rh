import { cpfValido } from "../pessoas/dados-pessoais/normalizacao-dados-pessoais.util";
import { PERFIL_DO_GESTOR_DEMO } from "./demo-seed";

/**
 * T216 — o gestor da demonstração entra no link da Avaliação 90°/180° com
 * CPF e data de nascimento. O CPF é sintético: dígitos verificadores certos
 * (o cadastro recusa CPF inválido) e claramente fictício (zeros à esquerda).
 */
describe("perfil pessoal do gestor da demonstração", () => {
  it("CPF sintético válido, só com dígitos e com cara de fictício", () => {
    expect(cpfValido(PERFIL_DO_GESTOR_DEMO.cpf)).toBe(true);
    expect(PERFIL_DO_GESTOR_DEMO.cpf).toMatch(/^0{6}\d{5}$/);
  });

  it("mantém a data de nascimento que a admissão exige", () => {
    expect(PERFIL_DO_GESTOR_DEMO.dataNascimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
