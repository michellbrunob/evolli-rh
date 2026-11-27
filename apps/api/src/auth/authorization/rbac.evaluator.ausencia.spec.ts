import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import type { AuthorizationAction } from "./permission.types";

/**
 * T215 — Férias e ausências (`ausencia`):
 * - rh e dp: leem, registram e decidem, só na própria empresa;
 * - master_tecnico: só lê, e só com empresa ativa (sem empresa ativa não há
 *   escopo para a lista nem para o saldo);
 * - demais papéis: negados (gestor e portal chegam numa fatia futura).
 */
const A = "empresa-a";
const B = "empresa-b";

const pode = (
  role: AccessRole,
  companyId: string | null,
  action: AuthorizationAction,
  targetCompanyId?: string | null,
) =>
  evaluatePermission(
    { userId: "u", role, companyId },
    {
      resource: "ausencia",
      action,
      ...(targetCompanyId !== undefined ? { targetCompanyId } : {}),
    },
  );

describe("RBAC — Férias e ausências (T215)", () => {
  describe.each(["rh", "dp"] as const)("%s", (role) => {
    it.each(["read", "create", "alter"] as const)(
      "%s: só na própria empresa",
      (action) => {
        expect(pode(role, A, action)).toBe(true);
        expect(pode(role, A, action, A)).toBe(true);
        expect(pode(role, A, action, B)).toBe(false);
        expect(pode(role, null, action)).toBe(false);
      },
    );

    it("ações fora do conjunto são negadas", () => {
      for (const action of ["manage", "reset"] as const) {
        expect(pode(role, A, action, A)).toBe(false);
      }
    });
  });

  describe("master_tecnico", () => {
    it("lê só com empresa ativa, e só nela", () => {
      expect(pode("master_tecnico", A, "read")).toBe(true);
      expect(pode("master_tecnico", A, "read", A)).toBe(true);
      expect(pode("master_tecnico", A, "read", B)).toBe(false);
      expect(pode("master_tecnico", null, "read", A)).toBe(false);
    });

    it("nunca registra nem decide", () => {
      for (const action of ["create", "alter"] as const) {
        expect(pode("master_tecnico", A, action)).toBe(false);
        expect(pode("master_tecnico", A, action, A)).toBe(false);
      }
    });
  });

  it.each([
    "gestor",
    "colaborador",
    "financeiro",
    "admin_tecnico",
    "auditor",
    "dpo",
  ] as const)("%s: negado em tudo", (role) => {
    for (const action of ["read", "create", "alter"] as const) {
      expect(pode(role, A, action)).toBe(false);
      expect(pode(role, A, action, A)).toBe(false);
    }
  });
});
