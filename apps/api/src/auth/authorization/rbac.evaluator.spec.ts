import { evaluatePermission } from "./rbac.evaluator";
import { AuthorizationSubject } from "./permission.types";

function subject(
  overrides: Partial<AuthorizationSubject> = {},
): AuthorizationSubject {
  return {
    userId: "user-1",
    role: "colaborador",
    companyId: "company-1",
    ...overrides,
  };
}

describe("evaluatePermission (RBAC/ABAC)", () => {
  it("nega por padrão qualquer recurso/ação não mapeada", () => {
    const result = evaluatePermission(subject(), {
      // @ts-expect-error resource inexistente de propósito
      resource: "nao_existe",
      action: "read",
    });
    expect(result).toBe(false);
  });

  describe("own_account", () => {
    it("permite qualquer papel ler/gerenciar a própria conta", () => {
      for (const role of [
        "admin_tecnico",
        "rh",
        "dp",
        "gestor",
        "financeiro",
        "colaborador",
        "auditor",
        "dpo",
      ] as const) {
        expect(
          evaluatePermission(subject({ role }), {
            resource: "own_account",
            action: "read",
          }),
        ).toBe(true);
      }
    });

    it("nega se targetUserId for de outro usuário", () => {
      expect(
        evaluatePermission(subject(), {
          resource: "own_account",
          action: "read",
          targetUserId: "outro-usuario",
        }),
      ).toBe(false);
    });
  });

  describe("other_account (gerenciar conta de terceiro)", () => {
    it("admin_tecnico gerencia qualquer empresa (escopo instância)", () => {
      expect(
        evaluatePermission(subject({ role: "admin_tecnico" }), {
          resource: "other_account",
          action: "manage",
          targetUserId: "user-2",
          targetCompanyId: "outra-empresa",
        }),
      ).toBe(true);
    });

    it("rh gerencia só dentro da própria empresa", () => {
      const rh = subject({ role: "rh", companyId: "empresa-a" });

      expect(
        evaluatePermission(rh, {
          resource: "other_account",
          action: "manage",
          targetUserId: "user-2",
          targetCompanyId: "empresa-a",
        }),
      ).toBe(true);

      expect(
        evaluatePermission(rh, {
          resource: "other_account",
          action: "manage",
          targetUserId: "user-2",
          targetCompanyId: "empresa-b",
        }),
      ).toBe(false);
    });

    it("gestor/financeiro/colaborador/auditor/dpo nunca gerenciam conta de terceiro", () => {
      for (const role of [
        "gestor",
        "financeiro",
        "colaborador",
        "auditor",
        "dpo",
      ] as const) {
        expect(
          evaluatePermission(subject({ role, companyId: "empresa-a" }), {
            resource: "other_account",
            action: "manage",
            targetUserId: "user-2",
            targetCompanyId: "empresa-a",
          }),
        ).toBe(false);
      }
    });

    it("nunca permite 'gerenciar' o próprio usuário via other_account", () => {
      expect(
        evaluatePermission(subject({ role: "admin_tecnico", userId: "u1" }), {
          resource: "other_account",
          action: "manage",
          targetUserId: "u1",
          targetCompanyId: "empresa-a",
        }),
      ).toBe(false);
    });
  });

  describe("access_log", () => {
    it("permite leitura só para admin_tecnico, auditor e dpo", () => {
      for (const role of ["admin_tecnico", "auditor", "dpo"] as const) {
        expect(
          evaluatePermission(subject({ role }), {
            resource: "access_log",
            action: "read",
          }),
        ).toBe(true);
      }
    });

    it("nega leitura para os demais papéis", () => {
      for (const role of [
        "rh",
        "dp",
        "gestor",
        "financeiro",
        "colaborador",
      ] as const) {
        expect(
          evaluatePermission(subject({ role }), {
            resource: "access_log",
            action: "read",
          }),
        ).toBe(false);
      }
    });
  });

  describe("user_role (alterar/criar papel de terceiro)", () => {
    it("ninguém altera o próprio papel — nem admin_tecnico", () => {
      const admin = subject({ role: "admin_tecnico", userId: "u1" });
      expect(
        evaluatePermission(admin, {
          resource: "user_role",
          action: "alter",
          targetUserId: "u1",
          targetNewRole: "rh",
        }),
      ).toBe(false);
    });

    it("admin_tecnico altera papel de terceiro em qualquer empresa", () => {
      expect(
        evaluatePermission(subject({ role: "admin_tecnico" }), {
          resource: "user_role",
          action: "alter",
          targetUserId: "u2",
          targetCompanyId: "outra-empresa",
          targetNewRole: "rh",
        }),
      ).toBe(true);
    });

    it("rh não pode promover terceiro a admin_tecnico", () => {
      expect(
        evaluatePermission(subject({ role: "rh", companyId: "empresa-a" }), {
          resource: "user_role",
          action: "alter",
          targetUserId: "u2",
          targetCompanyId: "empresa-a",
          targetNewRole: "admin_tecnico",
        }),
      ).toBe(false);
    });

    it("rh só altera papel dentro da própria empresa", () => {
      const rh = subject({ role: "rh", companyId: "empresa-a" });

      expect(
        evaluatePermission(rh, {
          resource: "user_role",
          action: "alter",
          targetUserId: "u2",
          targetCompanyId: "empresa-b",
          targetNewRole: "colaborador",
        }),
      ).toBe(false);
    });

    it("cria conta sem :id — rh não pode criar admin_tecnico", () => {
      expect(
        evaluatePermission(subject({ role: "rh", companyId: "empresa-a" }), {
          resource: "user_role",
          action: "create",
          targetCompanyId: "empresa-a",
          targetNewRole: "admin_tecnico",
        }),
      ).toBe(false);
    });

    it("cria conta — rh cria colaborador na própria empresa", () => {
      expect(
        evaluatePermission(subject({ role: "rh", companyId: "empresa-a" }), {
          resource: "user_role",
          action: "create",
          targetCompanyId: "empresa-a",
          targetNewRole: "colaborador",
        }),
      ).toBe(true);
    });

    it("gestor/financeiro/colaborador/auditor/dpo nunca alteram/criam papel", () => {
      for (const role of [
        "gestor",
        "financeiro",
        "colaborador",
        "auditor",
        "dpo",
      ] as const) {
        expect(
          evaluatePermission(subject({ role, companyId: "empresa-a" }), {
            resource: "user_role",
            action: "alter",
            targetUserId: "u2",
            targetCompanyId: "empresa-a",
            targetNewRole: "colaborador",
          }),
        ).toBe(false);
      }
    });
  });
});
