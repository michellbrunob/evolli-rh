import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { PasswordHashService } from "../password/password-hash.service";
import { normalizeEmail } from "../normalize-email.util";
import {
  CredentialVerificationResult,
  CredentialVerifier,
} from "./credential-verifier.interface";

@Injectable()
export class LocalCredentialVerifier implements CredentialVerifier {
  // Hash Argon2id (parâmetros reais de produção) de um valor fixo interno,
  // calculado uma vez, usado só para gastar tempo equivalente ao caso
  // "usuário existe" quando o e-mail não é encontrado — mitiga enumeração
  // por timing (§6). Nunca corresponde a nenhuma senha real de usuário.
  private dummyHashPromise: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHashService: PasswordHashService,
  ) {}

  async verify(
    email: string,
    plaintextSecret: string,
  ): Promise<CredentialVerificationResult> {
    const user = await this.prisma.accessUser.findUnique({
      where: { email: normalizeEmail(email) },
    });

    if (!user) {
      const dummyHash = await this.getDummyHash();
      await this.passwordHashService.verify(dummyHash, plaintextSecret);
      return { outcome: "invalid" };
    }

    const passwordMatches = await this.passwordHashService.verify(
      user.passwordHash,
      plaintextSecret,
    );

    if (!passwordMatches) {
      return { outcome: "invalid" };
    }
    if (user.status === "disabled") {
      return { outcome: "account_disabled" };
    }
    if (user.status === "locked") {
      return { outcome: "account_locked" };
    }

    return { outcome: "valid", user };
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = this.passwordHashService.hash(
        "evolli-rh-timing-parity-dummy-secret",
      );
    }
    return this.dummyHashPromise;
  }
}
