import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

/**
 * T131 — comportamento do login conforme o interruptor de servidor do MFA.
 *
 * Três ramos cobertos com dependências mockadas (o fluxo completo com
 * PostgreSQL real vive em `test/mfa.e2e-spec.ts`):
 *  - MFA desativado + conta SEM fator → sessão normal por senha;
 *  - MFA desativado + conta COM fator ativo → negação genérica, SEM bypass
 *    (nunca rebaixa para senha simples);
 *  - MFA ativado + conta COM fator ativo → challenge de 2º fator (sem sessão).
 */

const USUARIO = {
  id: "user-1",
  role: "colaborador",
  companyId: "empresa-a",
} as const;

const METADATA = { ip: "127.0.0.1", userAgent: "jest", requestId: "req-1" };

interface Mocks {
  hasActiveTotp: jest.Mock;
  isEnabled: jest.Mock;
  createLoginChallenge: jest.Mock;
  issue: jest.Mock;
  record: jest.Mock;
}

function build(mfaEnabled: boolean, hasFactor: boolean) {
  const mocks: Mocks = {
    hasActiveTotp: jest.fn().mockResolvedValue(hasFactor),
    isEnabled: jest.fn().mockReturnValue(mfaEnabled),
    createLoginChallenge: jest.fn().mockResolvedValue("challenge-opaco"),
    issue: jest
      .fn()
      .mockResolvedValue({ session: { id: "sess-1" }, csrfToken: "csrf" }),
    record: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    // Executa a callback com um "tx" fictício — as gravações usam os mocks.
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})),
  };
  const credentialVerifier = {
    verify: jest.fn().mockResolvedValue({ outcome: "valid", user: USUARIO }),
  };
  const rateLimitService = {
    assertNotRateLimited: jest.fn().mockResolvedValue(undefined),
    recordAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const sessionService = { issue: mocks.issue };
  const auditService = { record: mocks.record };
  const mfaService = {
    hasActiveTotp: mocks.hasActiveTotp,
    createLoginChallenge: mocks.createLoginChallenge,
  };
  const mfaConfig = { isEnabled: mocks.isEnabled };

  const service = new AuthService(
    prisma as never,
    credentialVerifier as never,
    rateLimitService as never,
    sessionService as never,
    {} as never, // passwordHashService (não usado no login)
    {} as never, // passwordPolicyService (não usado no login)
    {} as never, // emailNotifier (não usado no login)
    auditService as never,
    mfaService as never,
    mfaConfig as never,
  );

  return { service, mocks };
}

describe("AuthService.login — interruptor de MFA (T131)", () => {
  it("MFA desativado + conta sem fator → sessão normal", async () => {
    const { service, mocks } = build(false, false);
    const outcome = await service.login("e@x.test", "senha", METADATA);
    expect(outcome.kind).toBe("session");
    expect(mocks.issue).toHaveBeenCalledTimes(1);
    expect(mocks.createLoginChallenge).not.toHaveBeenCalled();
  });

  it("MFA desativado + conta com fator ativo → nega sem bypass (sem sessão, sem challenge)", async () => {
    const { service, mocks } = build(false, true);
    await expect(service.login("e@x.test", "senha", METADATA)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.createLoginChallenge).not.toHaveBeenCalled();
    // A negação é auditada como login_failed (best-effort), nunca revela o motivo.
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login_failed", result: "failure" }),
    );
  });

  it("MFA ativado + conta com fator ativo → challenge de 2º fator (sem sessão)", async () => {
    const { service, mocks } = build(true, true);
    const outcome = await service.login("e@x.test", "senha", METADATA);
    expect(outcome).toEqual({
      kind: "mfa_required",
      challengeToken: "challenge-opaco",
    });
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.createLoginChallenge).toHaveBeenCalledTimes(1);
  });
});
