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
    it("admin_tecnico NÃO gerencia conta de terceiro (CG-RBAC-01, ADR 0012)", () => {
      // Convergido para bootstrap/histórico: sem gestão global de contas.
      expect(
        evaluatePermission(subject({ role: "admin_tecnico" }), {
          resource: "other_account",
          action: "manage",
          targetUserId: "user-2",
          targetCompanyId: "outra-empresa",
        }),
      ).toBe(false);
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

  describe("other_account/read (T120 — listagem de contas)", () => {
    it("master_tecnico lista em escopo global (sem targetCompanyId resolvido)", () => {
      expect(
        evaluatePermission(subject({ role: "master_tecnico" }), {
          resource: "other_account",
          action: "read",
        }),
      ).toBe(true);
    });

    it("rh e dp listam quando têm empresa própria", () => {
      for (const role of ["rh", "dp"] as const) {
        expect(
          evaluatePermission(subject({ role, companyId: "empresa-a" }), {
            resource: "other_account",
            action: "read",
          }),
        ).toBe(true);
      }
    });

    it("rh/dp sem empresa própria (companyId nulo) são negados", () => {
      for (const role of ["rh", "dp"] as const) {
        expect(
          evaluatePermission(subject({ role, companyId: null }), {
            resource: "other_account",
            action: "read",
          }),
        ).toBe(false);
      }
    });

    it("admin_tecnico NÃO lista contas (CG-RBAC-01, ADR 0012) — mesma negação de 'manage'", () => {
      expect(
        evaluatePermission(subject({ role: "admin_tecnico" }), {
          resource: "other_account",
          action: "read",
        }),
      ).toBe(false);
    });

    it("gestor/financeiro/colaborador/auditor/dpo nunca listam contas de terceiro", () => {
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
            action: "read",
          }),
        ).toBe(false);
      }
    });
  });

  describe("mfa/reset (T125 — redefinição administrativa de MFA)", () => {
    it("master_tecnico reseta MFA em qualquer empresa", () => {
      expect(
        evaluatePermission(subject({ role: "master_tecnico" }), {
          resource: "mfa",
          action: "reset",
          targetUserId: "outro",
          targetCompanyId: "empresa-b",
        }),
      ).toBe(true);
    });

    it("rh reseta MFA só na própria empresa", () => {
      const rh = subject({ role: "rh", companyId: "empresa-a" });
      expect(
        evaluatePermission(rh, {
          resource: "mfa",
          action: "reset",
          targetUserId: "outro",
          targetCompanyId: "empresa-a",
        }),
      ).toBe(true);
      expect(
        evaluatePermission(rh, {
          resource: "mfa",
          action: "reset",
          targetUserId: "outro",
          targetCompanyId: "empresa-b",
        }),
      ).toBe(false);
    });

    it("dp NUNCA reseta MFA (diferença deliberada de other_account/manage)", () => {
      expect(
        evaluatePermission(subject({ role: "dp", companyId: "empresa-a" }), {
          resource: "mfa",
          action: "reset",
          targetUserId: "outro",
          targetCompanyId: "empresa-a",
        }),
      ).toBe(false);
    });

    it("gestor/financeiro/colaborador/admin_tecnico/auditor/dpo nunca resetam MFA", () => {
      for (const role of [
        "gestor",
        "financeiro",
        "colaborador",
        "admin_tecnico",
        "auditor",
        "dpo",
      ] as const) {
        expect(
          evaluatePermission(subject({ role, companyId: "empresa-a" }), {
            resource: "mfa",
            action: "reset",
            targetUserId: "outro",
            targetCompanyId: "empresa-a",
          }),
        ).toBe(false);
      }
    });

    it("ninguém reseta o PRÓPRIO MFA por esta rota (é sempre sobre outra conta)", () => {
      expect(
        evaluatePermission(subject({ role: "master_tecnico", userId: "u1" }), {
          resource: "mfa",
          action: "reset",
          targetUserId: "u1",
          targetCompanyId: "empresa-a",
        }),
      ).toBe(false);
    });

    it("só a ação 'reset' é reconhecida no recurso mfa", () => {
      expect(
        evaluatePermission(subject({ role: "master_tecnico" }), {
          resource: "mfa",
          action: "manage",
          targetUserId: "outro",
        }),
      ).toBe(false);
    });
  });

  describe("access_log", () => {
    it("permite leitura só para master_tecnico, auditor e dpo", () => {
      // `admin_tecnico` deixou de ler a trilha (CG-RBAC-01, ADR 0012).
      for (const role of ["master_tecnico", "auditor", "dpo"] as const) {
        expect(
          evaluatePermission(subject({ role }), {
            resource: "access_log",
            action: "read",
          }),
        ).toBe(true);
      }
    });

    it("nega leitura para os demais papéis (inclui admin_tecnico)", () => {
      for (const role of [
        "admin_tecnico",
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

    it("admin_tecnico NÃO atribui papel a terceiro (CG-RBAC-01, ADR 0012)", () => {
      // Convergido para bootstrap/histórico: sem atribuição de papéis por rota.
      expect(
        evaluatePermission(subject({ role: "admin_tecnico" }), {
          resource: "user_role",
          action: "alter",
          targetUserId: "u2",
          targetCompanyId: "outra-empresa",
          targetNewRole: "rh",
        }),
      ).toBe(false);
    });

    it("ninguém cria/promove a admin_tecnico por rota — nem master, nem rh (CG-RBAC-01)", () => {
      for (const role of ["master_tecnico", "rh"] as const) {
        expect(
          evaluatePermission(subject({ role, companyId: "empresa-a" }), {
            resource: "user_role",
            action: "create",
            targetCompanyId: "empresa-a",
            targetNewRole: "admin_tecnico",
          }),
        ).toBe(false);
      }
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

    it("ninguém atribui dpo nem auditor por rota — papéis legados não provisionáveis (CG-DPO-01/03)", () => {
      // `dpo` (depreciado) e `auditor` (pendente DP-7) permanecem no
      // enum/histórico, mas são proibidos de provisionamento por rota.
      for (const alvo of ["dpo", "auditor"] as const) {
        for (const role of ["master_tecnico", "rh"] as const) {
          expect(
            evaluatePermission(subject({ role, companyId: "empresa-a" }), {
              resource: "user_role",
              action: "create",
              targetCompanyId: "empresa-a",
              targetNewRole: alvo,
            }),
          ).toBe(false);
          expect(
            evaluatePermission(subject({ role, companyId: "empresa-a" }), {
              resource: "user_role",
              action: "alter",
              targetUserId: "u2",
              targetCompanyId: "empresa-a",
              targetNewRole: alvo,
            }),
          ).toBe(false);
        }
      }
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
