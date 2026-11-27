import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import type { AuthorizationAction } from "./permission.types";

/**
 * T215 — contrato do vínculo (nível, gestor direto, jornada, escala, salário,
 * conselho, dependentes, pensão e matrícula), na edição do colaborador:
 * - rh e dp: leem e editam, só na própria empresa;
 * - master_tecnico: só lê (sem empresa ativa, global; com ela, só nela);
 * - demais papéis: negados — o salário é dado sensível.
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
      resource: "contrato_vinculo",
      action,
      ...(targetCompanyId !== undefined ? { targetCompanyId } : {}),
    },
  );

describe("RBAC — contrato do vínculo (T215)", () => {
  describe.each(["rh", "dp"] as const)("%s", (role) => {
    it.each(["read", "alter"] as const)(
      "%s: só na própria empresa",
      (action) => {
        expect(pode(role, A, action)).toBe(true);
        expect(pode(role, A, action, A)).toBe(true);
        expect(pode(role, A, action, B)).toBe(false);
        expect(pode(role, null, action)).toBe(false);
      },
    );

    it("ações fora do conjunto são negadas", () => {
      for (const action of ["create", "manage", "reset"] as const) {
        expect(pode(role, A, action, A)).toBe(false);
      }
    });
  });

  describe("master_tecnico", () => {
    it("lê: sem empresa ativa, global; com ela, só nela", () => {
      expect(pode("master_tecnico", null, "read")).toBe(true);
      expect(pode("master_tecnico", null, "read", A)).toBe(true);
      expect(pode("master_tecnico", A, "read", A)).toBe(true);
      expect(pode("master_tecnico", A, "read", B)).toBe(false);
      expect(pode("master_tecnico", null, "read", null)).toBe(false);
    });

    it("nunca edita", () => {
      expect(pode("master_tecnico", null, "alter")).toBe(false);
      expect(pode("master_tecnico", A, "alter", A)).toBe(false);
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
    for (const action of ["read", "alter"] as const) {
      expect(pode(role, A, action)).toBe(false);
      expect(pode(role, A, action, A)).toBe(false);
    }
  });
});
