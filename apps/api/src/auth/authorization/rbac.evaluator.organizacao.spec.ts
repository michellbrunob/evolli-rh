import { evaluatePermission } from "./rbac.evaluator";
import {
  AuthorizationSubject,
  ORGANIZATIONAL_RESOURCES,
  OrganizationalResource,
} from "./permission.types";

/**
 * Etapa 1 — Fatia 1: autorização sobre a estrutura organizacional (spec §8).
 *
 * Cobre as duas fases descritas em `evaluateOrganizacao`:
 *  - **capacidade** (sem `targetCompanyId`), avaliada pelo `AuthorizationGuard`;
 *  - **escopo** (com `targetCompanyId`), avaliada no service.
 */

function subject(
  overrides: Partial<AuthorizationSubject> = {},
): AuthorizationSubject {
  return {
    userId: "user-1",
    role: "colaborador",
    companyId: "empresa-a",
    ...overrides,
  };
}

const RECURSOS = ORGANIZATIONAL_RESOURCES;
const ACOES = ["read", "create", "alter", "manage"] as const;

describe("evaluatePermission — estrutura organizacional", () => {
  describe("admin_tecnico (convergido para bootstrap/histórico — CG-RBAC-01, ADR 0012)", () => {
    it("NÃO administra nem lê a estrutura organizacional, em nenhuma empresa", () => {
      for (const resource of RECURSOS) {
        for (const action of ACOES) {
          // Fase 2 (escopo) e fase 1 (capacidade), ambas negadas.
          expect(
            evaluatePermission(
              subject({ role: "admin_tecnico", companyId: null }),
              { resource, action, targetCompanyId: "empresa-b" },
            ),
          ).toBe(false);
          expect(
            evaluatePermission(
              subject({ role: "admin_tecnico", companyId: null }),
              { resource, action },
            ),
          ).toBe(false);
        }
      }
    });
  });

  describe("master_tecnico (único acesso global standing — T030/ADR 0012)", () => {
    it("administra qualquer recurso organizacional, em qualquer empresa", () => {
      for (const resource of RECURSOS) {
        for (const action of ACOES) {
          expect(
            evaluatePermission(
              subject({ role: "master_tecnico", companyId: null }),
              { resource, action, targetCompanyId: "empresa-b" },
            ),
          ).toBe(true);
          expect(
            evaluatePermission(
              subject({ role: "master_tecnico", companyId: null }),
              { resource, action },
            ),
          ).toBe(true);
        }
      }
    });
  });

  describe("rh — administra a própria empresa", () => {
    it("lê e administra recursos da própria empresa", () => {
      for (const resource of RECURSOS) {
        for (const action of ACOES) {
          const esperado = !(resource === "empresa" && action === "create");
          expect(
            evaluatePermission(
              subject({ role: "rh", companyId: "empresa-a" }),
              {
                resource,
                action,
                targetCompanyId: "empresa-a",
              },
            ),
          ).toBe(esperado);
        }
      }
    });

    it("nunca alcança recurso de outra empresa", () => {
      for (const resource of RECURSOS) {
        for (const action of ACOES) {
          expect(
            evaluatePermission(
              subject({ role: "rh", companyId: "empresa-a" }),
              {
                resource,
                action,
                targetCompanyId: "empresa-b",
              },
            ),
          ).toBe(false);
        }
      }
    });

    it("não cria empresa: a empresa criada nunca é a própria", () => {
      expect(
        evaluatePermission(subject({ role: "rh", companyId: "empresa-a" }), {
          resource: "empresa",
          action: "create",
        }),
      ).toBe(false);
    });

    it("sem empresa atribuída, não passa nem na fase de capacidade", () => {
      for (const resource of RECURSOS) {
        expect(
          evaluatePermission(subject({ role: "rh", companyId: null }), {
            resource,
            action: "read",
          }),
        ).toBe(false);
      }
    });
  });

  describe("dp — leitura na própria empresa, sem escrita", () => {
    it("lê recursos da própria empresa", () => {
      for (const resource of RECURSOS) {
        expect(
          evaluatePermission(subject({ role: "dp", companyId: "empresa-a" }), {
            resource,
            action: "read",
            targetCompanyId: "empresa-a",
          }),
        ).toBe(true);
      }
    });

    it("nunca escreve, nem na própria empresa", () => {
      for (const resource of RECURSOS) {
        for (const action of ["create", "alter", "manage"] as const) {
          expect(
            evaluatePermission(
              subject({ role: "dp", companyId: "empresa-a" }),
              {
                resource,
                action,
                targetCompanyId: "empresa-a",
              },
            ),
          ).toBe(false);
        }
      }
    });

    it("não lê recurso de outra empresa", () => {
      for (const resource of RECURSOS) {
        expect(
          evaluatePermission(subject({ role: "dp", companyId: "empresa-a" }), {
            resource,
            action: "read",
            targetCompanyId: "empresa-b",
          }),
        ).toBe(false);
      }
    });
  });

  describe("financeiro — só leitura de centro_custo (parte inequívoca da matriz)", () => {
    it("lê centro_custo da própria empresa", () => {
      expect(
        evaluatePermission(
          subject({ role: "financeiro", companyId: "empresa-a" }),
          {
            resource: "centro_custo",
            action: "read",
            targetCompanyId: "empresa-a",
          },
        ),
      ).toBe(true);
    });

    it("não lê centro_custo de outra empresa", () => {
      expect(
        evaluatePermission(
          subject({ role: "financeiro", companyId: "empresa-a" }),
          {
            resource: "centro_custo",
            action: "read",
            targetCompanyId: "empresa-b",
          },
        ),
      ).toBe(false);
    });

    it("não escreve centro_custo", () => {
      for (const action of ["create", "alter", "manage"] as const) {
        expect(
          evaluatePermission(
            subject({ role: "financeiro", companyId: "empresa-a" }),
            {
              resource: "centro_custo",
              action,
              targetCompanyId: "empresa-a",
            },
          ),
        ).toBe(false);
      }
    });

    it('não alcança os demais recursos — "estrutura mínima" não foi definida', () => {
      const outros = RECURSOS.filter(
        (r): r is OrganizationalResource => r !== "centro_custo",
      );
      for (const resource of outros) {
        for (const action of ACOES) {
          expect(
            evaluatePermission(
              subject({ role: "financeiro", companyId: "empresa-a" }),
              { resource, action, targetCompanyId: "empresa-a" },
            ),
          ).toBe(false);
        }
      }
    });
  });

  describe("papéis negados por decisão explícita", () => {
    it("gestor não acessa estrutura: escopo é pendência declarada (DP-8)", () => {
      for (const resource of RECURSOS) {
        for (const action of ACOES) {
          expect(
            evaluatePermission(
              subject({ role: "gestor", companyId: "empresa-a" }),
              { resource, action, targetCompanyId: "empresa-a" },
            ),
          ).toBe(false);
        }
      }
    });

    it("auditor e dpo não são provisionáveis nesta fatia (DP-7)", () => {
      for (const role of ["auditor", "dpo"] as const) {
        for (const resource of RECURSOS) {
          for (const action of ACOES) {
            expect(
              evaluatePermission(subject({ role, companyId: "empresa-a" }), {
                resource,
                action,
                targetCompanyId: "empresa-a",
              }),
            ).toBe(false);
          }
        }
      }
    });

    it("colaborador não tem acesso à estrutura", () => {
      for (const resource of RECURSOS) {
        for (const action of ACOES) {
          expect(
            evaluatePermission(
              subject({ role: "colaborador", companyId: "empresa-a" }),
              { resource, action, targetCompanyId: "empresa-a" },
            ),
          ).toBe(false);
        }
      }
    });
  });

  describe("leitura da trilha de auditoria", () => {
    it("auditor, dpo e master_tecnico leem access_log; admin_tecnico não (CG-RBAC-01)", () => {
      for (const role of ["auditor", "dpo", "master_tecnico"] as const) {
        expect(
          evaluatePermission(subject({ role, companyId: "empresa-a" }), {
            resource: "access_log",
            action: "read",
          }),
        ).toBe(true);
      }
      expect(
        evaluatePermission(
          subject({ role: "admin_tecnico", companyId: null }),
          { resource: "access_log", action: "read" },
        ),
      ).toBe(false);
    });
  });

  describe("departamento e área não são fronteira de autorização", () => {
    it("a decisão depende só da empresa, nunca do nó estrutural", () => {
      // Mesmo sujeito e mesma empresa produzem o mesmo veredito para todos os
      // recursos estruturais — não existe regra por departamento/área
      // (Baseline V1, item 2).
      const vereditos = ["departamento", "area", "equipe"].map((resource) =>
        evaluatePermission(subject({ role: "rh", companyId: "empresa-a" }), {
          resource: resource as OrganizationalResource,
          action: "alter",
          targetCompanyId: "empresa-a",
        }),
      );
      expect(new Set(vereditos).size).toBe(1);
      expect(vereditos[0]).toBe(true);
    });
  });
});
