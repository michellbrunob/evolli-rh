import { UnauthorizedException } from "@nestjs/common";
import { MfaService } from "./mfa.service";
import { hashOpaqueToken } from "../crypto/opaque-token.util";

/**
 * Foco: consumo ATÔMICO do código de recuperação sob concorrência
 * (`completeMfaLogin`). Prova, de forma determinística e sem banco real, que
 * quando o `updateMany` do código de recuperação retorna `count !== 1` (outro
 * verificador concorrente já o consumiu), a transação é abortada com erro
 * genérico e NENHUMA sessão é emitida.
 */

const REQUEST_METADATA = {
  ip: "203.0.113.10",
  userAgent: "teste",
  requestId: "req-1",
};

const challengeToken = "challenge-token-opaco-sintetico";

interface Cenario {
  recoveryUpdateCount: number;
}

function montarMfaService(cenario: Cenario) {
  const usuario = {
    id: "user-1",
    role: "colaborador",
    companyId: "empresa-a",
    email: "pessoa@example.test",
  };

  const issue = jest.fn().mockResolvedValue({
    session: { id: "sess-1" },
    token: "tok",
    csrfToken: "csrf",
  });
  const record = jest.fn().mockResolvedValue(undefined);
  const passwordVerify = jest.fn().mockResolvedValue(true); // código casa

  const tx = {
    accessMfaChallenge: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }), // consome o challenge
    },
    accessMfaRecoveryCode: {
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: cenario.recoveryUpdateCount }),
    },
  };

  const prisma = {
    accessMfaChallenge: {
      findUnique: jest.fn().mockResolvedValue({
        id: "challenge-1",
        userId: usuario.id,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 0,
        user: usuario,
      }),
    },
    // Sem fator TOTP ativo → força o caminho do código de recuperação.
    accessMfaTotp: { findUnique: jest.fn().mockResolvedValue(null) },
    accessMfaRecoveryCode: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: "rc-1", codeHash: "hash", usedAt: null }]),
    },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const service = new MfaService(
    prisma as never,
    {} as never, // cipher — não usado no caminho de recovery
    { verify: passwordVerify, hash: jest.fn() } as never,
    { issue } as never,
    { record } as never,
  );

  return { service, issue, record, tx, prisma };
}

describe("MfaService.completeMfaLogin — consumo atômico do código de recuperação", () => {
  it("count === 1: consome o código, emite a sessão e audita", async () => {
    const { service, issue } = montarMfaService({ recoveryUpdateCount: 1 });

    const issued = await service.completeMfaLogin(
      challengeToken,
      "ABCDE-FGHJK",
      REQUEST_METADATA,
    );

    expect(issued.session.id).toBe("sess-1");
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it("count !== 1 (corrida perdida): aborta com 401 genérico e NÃO emite sessão", async () => {
    const { service, issue, record } = montarMfaService({
      recoveryUpdateCount: 0,
    });

    await expect(
      service.completeMfaLogin(challengeToken, "ABCDE-FGHJK", REQUEST_METADATA),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Nenhuma sessão emitida, nenhum login_succeeded auditado.
    expect(issue).not.toHaveBeenCalled();
    const acoesAuditadas = record.mock.calls.map(
      (c) => (c[0] as { action: string }).action,
    );
    expect(acoesAuditadas).not.toContain("login_succeeded");
    expect(acoesAuditadas).not.toContain("mfa_challenge_succeeded");
  });

  it("o hash do challenge é usado para a busca — o token bruto nunca vira filtro direto", async () => {
    const { service, prisma } = montarMfaService({ recoveryUpdateCount: 1 });
    await service.completeMfaLogin(
      challengeToken,
      "ABCDE-FGHJK",
      REQUEST_METADATA,
    );
    expect(prisma.accessMfaChallenge.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOpaqueToken(challengeToken) },
      include: { user: true },
    });
  });
});
