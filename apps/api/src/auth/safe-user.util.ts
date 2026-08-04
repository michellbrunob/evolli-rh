import { AccessUser } from "@prisma/client";

/** Projeção segura de AccessUser — nunca inclui passwordHash. */
export interface SafeAccessUser {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
  unitId: string | null;
  teamId: string | null;
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
    status: user.status,
    createdAt: user.createdAt,
  };
}
