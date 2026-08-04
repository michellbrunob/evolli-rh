import { PasswordHashService } from "../password/password-hash.service";
import { RecoveryCodeService } from "./recovery-code.service";

describe("RecoveryCodeService", () => {
  const service = new RecoveryCodeService(new PasswordHashService());

  it("gera 10 códigos únicos por padrão", () => {
    const codes = service.generateCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("hash/verify aceita o código certo e rejeita outro", async () => {
    const [code] = service.generateCodes(1);
    const hash = await service.hashCode(code!);

    await expect(service.verifyCode(hash, code!)).resolves.toBe(true);
    await expect(service.verifyCode(hash, "AAAAA-AAAAA")).resolves.toBe(false);
  });

  it("verificação é case-insensitive e ignora espaço nas pontas", async () => {
    const [code] = service.generateCodes(1);
    const hash = await service.hashCode(code!);

    await expect(
      service.verifyCode(hash, `  ${code!.toLowerCase()}  `),
    ).resolves.toBe(true);
  });

  it("hash nunca contém o código em claro", async () => {
    const [code] = service.generateCodes(1);
    const hash = await service.hashCode(code!);
    expect(hash).not.toContain(code!);
  });
});
