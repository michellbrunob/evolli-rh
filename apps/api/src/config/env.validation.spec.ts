import { randomBytes } from "node:crypto";
import { validateEnv } from "./env.validation";

const VALID_MFA_KEY = randomBytes(32).toString("base64");

describe("validateEnv", () => {
  it("aceita configuração válida e aplica defaults", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      MFA_ENCRYPTION_KEY: VALID_MFA_KEY,
    });

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3000);
    expect(result.APP_VERSION).toBe("0.0.0");
    expect(result.DB_READY_TIMEOUT_MS).toBe(2000);
    expect(result.MFA_ENCRYPTION_KEY).toBe(VALID_MFA_KEY);
  });

  it("rejeita configuração sem DATABASE_URL", () => {
    expect(() => validateEnv({ MFA_ENCRYPTION_KEY: VALID_MFA_KEY })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejeita configuração sem MFA_ENCRYPTION_KEY", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      }),
    ).toThrow(/MFA_ENCRYPTION_KEY/);
  });

  it("rejeita MFA_ENCRYPTION_KEY que não decodifica para exatamente 32 bytes", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        MFA_ENCRYPTION_KEY:
          Buffer.from("chave-curta-demais").toString("base64"),
      }),
    ).toThrow(/MFA_ENCRYPTION_KEY/);
  });

  it("rejeita e falha de forma segura se MIGRATE_DATABASE_URL estiver presente no processo da API, sem revelar a URL/credencial", () => {
    const migratorUrl =
      "postgresql://evolli_migrator:senha-super-secreta@db-interno.evolli.local:5432/evolli_rh_dev?schema=app";

    let caught: unknown;
    try {
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        MFA_ENCRYPTION_KEY: VALID_MFA_KEY,
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
