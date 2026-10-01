import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOST_DEMONSTRACAO_LOCAL,
  resolverHostDeEscuta,
  validateEnv,
} from "./env.validation";

/** Lê um arquivo de exemplo do jeito que `Copy-Item`/`cp` entregariam. */
function lerExemplo(nome: string): Record<string, string> {
  const bruto = readFileSync(join(__dirname, "..", "..", nome), "utf8");
  const mapa: Record<string, string> = {};
  for (const linha of bruto.split(/[\r\n]+/)) {
    const m = /^([A-Z0-9_]+)=(.*?)\s*$/.exec(linha);
    if (m) mapa[m[1]!] = m[2]!;
  }
  return mapa;
}

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
  // ---- T141: modo de demonstração LOCAL --------------------------------

  it("EVOLLI_DEMO_MODE tem padrão false e não altera a escuta histórica", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });

    expect(result.EVOLLI_DEMO_MODE).toBe(false);
    expect(result.HOST).toBeUndefined();
    expect(resolverHostDeEscuta(result)).toBeUndefined();
  });

  it("modo de demonstração aplica 127.0.0.1 mesmo sem HOST definido", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      EVOLLI_DEMO_MODE: "true",
    });

    expect(result.EVOLLI_DEMO_MODE).toBe(true);
    expect(resolverHostDeEscuta(result)).toBe(HOST_DEMONSTRACAO_LOCAL);
    expect(resolverHostDeEscuta(result)).toBe("127.0.0.1");
  });

  it("modo de demonstração aceita HOST=127.0.0.1 declarado explicitamente", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      EVOLLI_DEMO_MODE: "true",
      HOST: "127.0.0.1",
    });

    expect(resolverHostDeEscuta(result)).toBe("127.0.0.1");
  });

  it.each(["0.0.0.0", "::", "localhost", "192.168.0.10", "demo.exemplo.com"])(
    "modo de demonstração recusa escutar em %s",
    (host) => {
      expect(() =>
        validateEnv({
          DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
          EVOLLI_DEMO_MODE: "true",
          HOST: host,
        }),
      ).toThrow(/EVOLLI_DEMO_MODE/);
    },
  );

  it("modo de demonstração é proibido em produção", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NODE_ENV: "production",
        EVOLLI_DEMO_MODE: "true",
      }),
    ).toThrow(/NODE_ENV=production/);
  });

  it("EVOLLI_DEMO_MODE é estrito: valor fora de true/false falha alto", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        EVOLLI_DEMO_MODE: "1",
      }),
    ).toThrow(/EVOLLI_DEMO_MODE/);
  });

  it("fora do modo de demonstração, HOST continua livre (produção intacta)", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      NODE_ENV: "production",
      HOST: "0.0.0.0",
    });

    expect(resolverHostDeEscuta(result)).toBe("0.0.0.0");
  });
  // ---- T141: o .env.example precisa subir a API como está -----------------

  it("apps/api/.env.example, copiado literalmente, passa na validação", () => {
    // O guia do ambiente local manda copiar este arquivo. Se ele não passar
    // aqui, a API não sobe e o passo 5/8 falha como um timeout genérico.
    const exemplo = lerExemplo(".env.example");
    const result = validateEnv({
      ...exemplo,
      DATABASE_URL: "postgresql://evolli_app:x@127.0.0.1:5432/d?schema=app",
    });

    expect(result.MFA_ENABLED).toBe(false);
    expect(result.MFA_TOTP_ENCRYPTION_KEY).toBeUndefined();
  });

  it("o exemplo não declara a chave TOTP vazia", () => {
    const exemplo = lerExemplo(".env.example");
    expect(
      Object.prototype.hasOwnProperty.call(exemplo, "MFA_TOTP_ENCRYPTION_KEY"),
    ).toBe(false);
  });

  it("chave TOTP declarada e vazia continua sendo recusada", () => {
    // A validação não foi afrouxada: o que mudou foi o exemplo.
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        MFA_TOTP_ENCRYPTION_KEY: "",
      }),
    ).toThrow(/MFA_TOTP_ENCRYPTION_KEY/);
  });

  it("com MFA ligado em produção a chave continua obrigatória", () => {
    const exemplo = lerExemplo(".env.example");
    expect(() =>
      validateEnv({
        ...exemplo,
        DATABASE_URL: "postgresql://evolli_app:x@127.0.0.1:5432/d?schema=app",
        NODE_ENV: "production",
        MFA_ENABLED: "true",
      }),
    ).toThrow(/MFA_TOTP_ENCRYPTION_KEY/);
  });
});
