import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import type {
  AuthorizationAction,
  AuthorizationResource,
} from "./permission.types";

/**
 * T216 — Pesquisas. `pesquisa`: RH e DP leem, criam e alteram na empresa
 * ativa; o master técnico só lê. `resposta_pesquisa`: só RH e DP leem.
 * Os demais papéis são negados.
 */
const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";
const ACOES: AuthorizationAction[] = ["read", "create", "alter", "manage"];

function pode(
  resource: AuthorizationResource,
  role: AccessRole,
  action: AuthorizationAction,
  targetCompanyId?: string,
  companyId: string | null = EMPRESA_A,
) {
  return evaluatePermission(
    { userId: "u", role, companyId },
    {
      resource,
      action,
      ...(targetCompanyId === undefined ? {} : { targetCompanyId }),
    },
  );
}

describe("T216 — RBAC das pesquisas", () => {
  it.each(["rh", "dp"] as const)(
    "%s lê, cria e altera a pesquisa só na própria empresa",
    (role) => {
      for (const acao of ["read", "create", "alter"] as const) {
        expect(pode("pesquisa", role, acao)).toBe(true);
        expect(pode("pesquisa", role, acao, EMPRESA_B)).toBe(false);
        expect(pode("pesquisa", role, acao, undefined, null)).toBe(false);
      }
      expect(pode("pesquisa", role, "manage")).toBe(false);
    },
  );

  it.each(["rh", "dp"] as const)(
    "%s só lê as respostas individuais, na própria empresa",
    (role) => {
      expect(pode("resposta_pesquisa", role, "read")).toBe(true);
      expect(pode("resposta_pesquisa", role, "read", EMPRESA_A)).toBe(true);
      expect(pode("resposta_pesquisa", role, "read", EMPRESA_B)).toBe(false);
      expect(pode("resposta_pesquisa", role, "read", undefined, null)).toBe(
        false,
      );
      for (const acao of ["create", "alter", "manage"] as const) {
        expect(pode("resposta_pesquisa", role, acao)).toBe(false);
      }
    },
  );

  it("master técnico só lê a pesquisa (com empresa ativa) e nunca as respostas individuais", () => {
    expect(pode("pesquisa", "master_tecnico", "read")).toBe(true);
    expect(pode("pesquisa", "master_tecnico", "read", undefined, null)).toBe(
      false,
    );
    expect(pode("pesquisa", "master_tecnico", "create")).toBe(false);
    expect(pode("pesquisa", "master_tecnico", "alter")).toBe(false);
    expect(pode("resposta_pesquisa", "master_tecnico", "read")).toBe(false);
  });

  it.each([
    "gestor",
    "colaborador",
    "financeiro",
    "admin_tecnico",
    "auditor",
    "dpo",
  ] as const)("%s é negado em toda ação", (role) => {
    for (const recurso of ["pesquisa", "resposta_pesquisa"] as const) {
      for (const acao of ACOES) {
        expect(pode(recurso, role, acao)).toBe(false);
        expect(pode(recurso, role, acao, EMPRESA_A)).toBe(false);
      }
    }
  });
});
