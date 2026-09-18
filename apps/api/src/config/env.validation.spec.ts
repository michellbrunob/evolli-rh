import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("aceita configuração válida e aplica defaults", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3000);
    expect(result.APP_VERSION).toBe("0.0.0");
    expect(result.DB_READY_TIMEOUT_MS).toBe(2000);
  });

  it("rejeita configuração sem DATABASE_URL", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it("MFA_ENABLED tem padrão false (lançamento inicial sem 2º fator) — T131", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });
    expect(result.MFA_ENABLED).toBe(false);
  });

  it("com MFA desativado, a chave TOTP NÃO é exigida no boot, mesmo em produção — T131", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NODE_ENV: "production",
        MFA_ENABLED: "false",
      }),
    ).not.toThrow();
  });

  it("com MFA ativado em produção, exige a chave TOTP (fail-closed), citando só o nome — T131", () => {
    let caught: unknown;
    try {
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NODE_ENV: "production",
        MFA_ENABLED: "true",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/MFA_TOTP_ENCRYPTION_KEY/);
  });

  it("com MFA ativado em produção e a chave presente, aceita — T131", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NODE_ENV: "production",
        MFA_ENABLED: "true",
        MFA_TOTP_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      }),
    ).not.toThrow();
  });

  it("rejeita MFA_ENABLED com valor fora de true/false (fail alto, nunca liga por engano) — T131", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        MFA_ENABLED: "1",
      }),
    ).toThrow();
  });

  it("rejeita e falha de forma segura se MIGRATE_DATABASE_URL estiver presente no processo da API, sem revelar a URL/credencial", () => {
    const migratorUrl =
      "postgresql://evolli_migrator:senha-super-secreta@db-interno.evolli.local:5432/evolli_rh_dev?schema=app";

    let caught: unknown;
    try {
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        MIGRATE_DATABASE_URL: migratorUrl,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/MIGRATE_DATABASE_URL/);
    expect(message).not.toContain(migratorUrl);
    expect(message).not.toContain("senha-super-secreta");
    expect(message).not.toContain("db-interno.evolli.local");
  });
});
