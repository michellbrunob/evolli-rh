import { describe, expect, it } from "vitest";
import { tratamentoDe } from "./tratamento";

describe("T215 — tratamento pelo gênero do cadastro", () => {
  it("masculino: o, ele, convidado, do", () => {
    expect(tratamentoDe("masculino", "Michell Bruno Teste")).toEqual({
      pronome: "Ele",
      pronomeNaFrase: "ele",
      artigo: "O",
      convidado: "convidado",
      oNome: "O Michell",
      oNomeNaFrase: "o Michell",
      doNome: "do Michell",
    });
  });

  it("feminino: a, ela, convidada, da", () => {
    expect(tratamentoDe("feminino", "Ana Teste")).toMatchObject({
      pronome: "Ela",
      pronomeNaFrase: "ela",
      convidado: "convidada",
      oNome: "A Ana",
      oNomeNaFrase: "a Ana",
      doNome: "da Ana",
    });
  });

  it.each(["outro", "prefiro_nao_informar", null, undefined, ""])(
    "%s: neutro, sem adivinhar pelo nome",
    (genero) => {
      expect(tratamentoDe(genero, "Maria Teste")).toMatchObject({
        pronome: "A pessoa",
        convidado: "convidada(o)",
        oNome: "Maria",
        doNome: "de Maria",
      });
    },
  );
});
