import { describe, expect, it } from "vitest";
import { plural } from "./plural";

describe("T215 — plural do português brasileiro", () => {
  it.each([
    [0, "0 feriados"],
    [1, "1 feriado"],
    [2, "2 feriados"],
    [26, "26 feriados"],
  ])("%i → %s", (n, esperado) => {
    expect(plural(n, "feriado", "feriados")).toBe(esperado);
  });

  it("plural irregular vem por extenso", () => {
    expect(plural(1, "pendência", "pendências")).toBe("1 pendência");
    expect(plural(3, "mês", "meses")).toBe("3 meses");
  });
});
