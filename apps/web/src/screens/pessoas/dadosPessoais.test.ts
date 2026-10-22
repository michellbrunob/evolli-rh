/**
 * T179 — sexo de lista FECHADA (decisão da proprietária de 2026-10-21): a
 * regra do cliente aceita só os quatro códigos ou nada, monta o corpo com o
 * código e mostra o rótulo na leitura.
 */
import { describe, expect, it } from "vitest";
import {
  OPCOES_SEXO,
  PERFIL_VAZIO,
  blocoPerfil,
  ehCodigoSexo,
  rotuloDoSexo,
  validarPerfil,
} from "./dadosPessoais";

const valido = { ...PERFIL_VAZIO, dataNascimento: "1990-05-20" };

describe("sexo — lista fechada (T179)", () => {
  it("as opções são exatamente as quatro decididas, nesta ordem", () => {
    expect(OPCOES_SEXO.map((o) => [o.codigo, o.rotulo])).toEqual([
      ["feminino", "Feminino"],
      ["masculino", "Masculino"],
      ["intersexo", "Intersexo"],
      ["nao_informar", "Não informar"],
    ]);
  });

  it("sem seleção é válido e vai null", () => {
    expect(validarPerfil(valido)).toEqual({});
    expect(blocoPerfil(valido).sexo).toBeNull();
  });

  it.each(["feminino", "masculino", "intersexo", "nao_informar"])(
    "código %s é aceito e vai como veio",
    (codigo) => {
      expect(ehCodigoSexo(codigo)).toBe(true);
      expect(validarPerfil({ ...valido, sexo: codigo })).toEqual({});
      expect(blocoPerfil({ ...valido, sexo: codigo }).sexo).toBe(codigo);
    },
  );

  it.each(["Feminino", "FEMININO", "outro", "f", " feminino"])(
    "valor fora da lista (%p) é recusado no cliente",
    (valor) => {
      expect(ehCodigoSexo(valor)).toBe(false);
      expect(validarPerfil({ ...valido, sexo: valor }).sexo).toMatch(
        /Selecione uma das opções de sexo/,
      );
    },
  );

  it("leitura: código pelo rótulo, ausente null, texto antigo como veio", () => {
    expect(rotuloDoSexo("intersexo")).toBe("Intersexo");
    expect(rotuloDoSexo("nao_informar")).toBe("Não informar");
    expect(rotuloDoSexo(null)).toBeNull();
    expect(rotuloDoSexo(undefined)).toBeNull();
    expect(rotuloDoSexo("")).toBeNull();
    expect(rotuloDoSexo("Fem. (legado)")).toBe("Fem. (legado)");
  });
});
