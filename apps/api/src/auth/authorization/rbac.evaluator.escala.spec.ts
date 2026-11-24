import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import type { AuthorizationAction } from "./permission.types";

/**
 * T215 — escala do colaborador (`escala_colaborador`): RH e DP leem,
 * definem e encerram na empresa ativa; o master técnico só lê; os demais
 * papéis são negados.
 */
const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";
const ACOES: AuthorizationAction[] = ["read", "create", "alter", "manage"];

function pode(
  role: AccessRole,
  action: AuthorizationAction,
  targetCompanyId?: string,
  companyId: string | null = EMPRESA_A,
) {
  return evaluatePermission(
    { userId: "u", role, companyId },
    {
      resource: "escala_colaborador",
      action,
      ...(targetCompanyId === undefined ? {} : { targetCompanyId }),
    },
  );
}

describe("T215 — RBAC da escala do colaborador", () => {
  it.each(["rh", "dp"] as const)(
    "%s lê, define e encerra só na própria empresa",
    (role) => {
      for (const acao of ["read", "create", "alter"] as const) {
        expect(pode(role, acao)).toBe(true);
        expect(pode(role, acao, EMPRESA_A)).toBe(true);
        expect(pode(role, acao, EMPRESA_B)).toBe(false);
        expect(pode(role, acao, undefined, null)).toBe(false);
      }
      expect(pode(role, "manage", EMPRESA_A)).toBe(false);
    },
  );

  it("master técnico só lê, com empresa ativa", () => {
    expect(pode("master_tecnico", "read")).toBe(true);
    expect(pode("master_tecnico", "read", EMPRESA_A)).toBe(true);
    expect(pode("master_tecnico", "read", EMPRESA_B)).toBe(false);
    expect(pode("master_tecnico", "create", EMPRESA_A)).toBe(false);
    expect(pode("master_tecnico", "alter", EMPRESA_A)).toBe(false);
  });

  it.each([
    "gestor",
    "colaborador",
    "financeiro",
    "admin_tecnico",
    "auditor",
    "dpo",
  ] as const)("%s é negado em toda ação", (role) => {
    for (const acao of ACOES) {
      expect(pode(role, acao)).toBe(false);
      expect(pode(role, acao, EMPRESA_A)).toBe(false);
    }
  });
});
