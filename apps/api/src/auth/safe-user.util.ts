import { AccessUser } from "@prisma/client";

/** Projeção segura de AccessUser — nunca inclui passwordHash/mfaSecretEncrypted. */
export interface SafeAccessUser {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
  unitId: string | null;
  teamId: string | null;
  mfaEnabled: boolean;
  status: string;
  createdAt: Date;
}

export function toSafeUser(user: AccessUser): SafeAccessUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    unitId: user.unitId,
    teamId: user.teamId,
    mfaEnabled: user.mfaEnabled,
    status: user.status,
    createdAt: user.createdAt,
  };
}
