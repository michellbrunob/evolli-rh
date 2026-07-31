import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("aceita configuração válida e aplica defaults", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3000);
    expect(result.APP_VERSION).toBe("0.0.0");
  });

  it("rejeita configuração sem DATABASE_URL", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
