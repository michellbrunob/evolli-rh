import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import type { AuthorizationAction } from "./permission.types";

/**
 * T215 — anexo da ausência (`anexo_ausencia`: atestado ou documento), com a
 * proteção reforçada dos documentos sensíveis:
 * - rh e dp: listam, enviam, baixam e removem, só na própria empresa;
 * - master_tecnico: nada (vê só o registro da ausência, pelo recurso
 *   `ausencia`, nunca o arquivo);
 * - demais papéis: nada.
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
      resource: "anexo_ausencia",
      action,
      ...(targetCompanyId !== undefined ? { targetCompanyId } : {}),
    },
  );

describe("RBAC — anexo da ausência (T215)", () => {
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

  it("master_tecnico: nunca lê, envia ou remove o arquivo, com ou sem empresa", () => {
    for (const action of ["read", "create", "alter"] as const) {
      expect(pode("master_tecnico", A, action)).toBe(false);
      expect(pode("master_tecnico", A, action, A)).toBe(false);
      expect(pode("master_tecnico", null, action)).toBe(false);
    }
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
