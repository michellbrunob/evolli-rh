import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { campoPeloRotulo } from "./campoPeloRotulo";

describe("campoPeloRotulo (localizador rápido por rótulo, para os testes)", () => {
  it("acha o campo pelo <label for> e pelo <label> que o envolve", () => {
    render(
      <form>
        <label htmlFor="cpf">CPF</label>
        <input id="cpf" />
        <label>
          Nome completo <input data-testid="nome" />
        </label>
      </form>,
    );
    expect(campoPeloRotulo(/^CPF$/)).toBe(document.getElementById("cpf"));
    expect(campoPeloRotulo(/Nome completo/).getAttribute("data-testid")).toBe(
      "nome",
    );
  });

  it("aceita aria-labelledby (pelo caminho completo da Testing Library)", () => {
    render(
      <div>
        <span id="r">Salário bruto</span>
        <input aria-labelledby="r" data-testid="s" />
      </div>,
    );
    expect(campoPeloRotulo(/^Salário bruto/).getAttribute("data-testid")).toBe(
      "s",
    );
  });

  it("sem campo ou com mais de um: falha como o getByLabelText", () => {
    render(
      <div>
        <label htmlFor="a">Data</label>
        <input id="a" />
        <label htmlFor="b">Data</label>
        <input id="b" />
      </div>,
    );
    expect(() => campoPeloRotulo(/^Nada$/)).toThrow();
    expect(() => campoPeloRotulo(/^Data$/)).toThrow();
  });

  it("procura só dentro da raiz dada", () => {
    render(
      <div>
        <section data-testid="um">
          <label htmlFor="x">Cargo</label>
          <input id="x" />
        </section>
        <section data-testid="dois">
          <label htmlFor="y">Cargo</label>
          <input id="y" />
        </section>
      </div>,
    );
    const dois = document.querySelector<HTMLElement>('[data-testid="dois"]')!;
    expect(campoPeloRotulo(/^Cargo$/, dois)).toBe(document.getElementById("y"));
  });
});
