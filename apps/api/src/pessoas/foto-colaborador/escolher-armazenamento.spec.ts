import { ArmazenamentoEmMemoria } from "./armazenamento-de-objetos";
import { ArmazenamentoR2 } from "./armazenamento-r2";
import { escolherArmazenamentoDeFotos } from "./escolher-armazenamento";

/**
 * T209 — qual armazenamento a API usa. Padrão: o R2 privado. Em memória só
 * fora de produção, por variável explícita (prévia local sem tocar no
 * bucket); em produção a API nem sobe com ela.
 */
describe("escolherArmazenamentoDeFotos", () => {
  it("sem a variável, o R2", () => {
    expect(escolherArmazenamentoDeFotos({})).toBeInstanceOf(ArmazenamentoR2);
  });

  it("memória, fora de produção, só quando pedida", () => {
    expect(
      escolherArmazenamentoDeFotos({ EVOLLI_FOTO_ARMAZENAMENTO: "memoria" }),
    ).toBeInstanceOf(ArmazenamentoEmMemoria);
    expect(
      escolherArmazenamentoDeFotos({
        EVOLLI_FOTO_ARMAZENAMENTO: " memoria ",
        NODE_ENV: "development",
      }),
    ).toBeInstanceOf(ArmazenamentoEmMemoria);
  });

  it("memória em produção: recusa subir", () => {
    expect(() =>
      escolherArmazenamentoDeFotos({
        EVOLLI_FOTO_ARMAZENAMENTO: "memoria",
        NODE_ENV: "production",
      }),
    ).toThrow(/produção/);
  });

  it("valor desconhecido: recusa subir (nada de cair no R2 por engano)", () => {
    expect(() =>
      escolherArmazenamentoDeFotos({ EVOLLI_FOTO_ARMAZENAMENTO: "disco" }),
    ).toThrow(/desconhecido/);
  });
});
