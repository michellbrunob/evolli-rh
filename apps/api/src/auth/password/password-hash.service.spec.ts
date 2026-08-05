import {
  ARGON2ID_MEMORY_COST_KIB,
  ARGON2ID_PARALLELISM,
  ARGON2ID_TIME_COST,
  PasswordHashService,
} from "./password-hash.service";

describe("PasswordHashService", () => {
  const service = new PasswordHashService();

  it("piso de parâmetros Argon2id fechado na ADR 0003", () => {
    expect(ARGON2ID_MEMORY_COST_KIB).toBe(19 * 1024);
    expect(ARGON2ID_TIME_COST).toBe(2);
    expect(ARGON2ID_PARALLELISM).toBe(1);
  });

  it("hash usa argon2id com os parâmetros mínimos", async () => {
    const hash = await service.hash("uma-senha-de-teste-bem-longa");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).toContain(`m=${ARGON2ID_MEMORY_COST_KIB}`);
    expect(hash).toContain(`t=${ARGON2ID_TIME_COST}`);
    expect(hash).toContain(`p=${ARGON2ID_PARALLELISM}`);
  });

  it("verify aceita a senha correta e rejeita a errada", async () => {
    const hash = await service.hash("senha-correta-bem-longa-123456");
    await expect(
      service.verify(hash, "senha-correta-bem-longa-123456"),
    ).resolves.toBe(true);
    await expect(
      service.verify(hash, "senha-errada-bem-longa-123456"),
    ).resolves.toBe(false);
  });

  it("verify nunca lança para hash malformado — retorna false", async () => {
    await expect(
      service.verify("hash-invalido-nao-e-argon2", "qualquer-senha"),
    ).resolves.toBe(false);
  });
});
