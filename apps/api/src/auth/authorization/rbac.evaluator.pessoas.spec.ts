import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationSubject,
  PESSOAS_RESOURCES,
  PessoasResource,
} from "./permission.types";

/**
 * Matriz de acesso da Etapa 1 — Fatia 2 (spec §6, ADR 0007), célula a célula,
 * nas **duas fases** da avaliação: capacidade (sem `targetCompanyId`, roda no
 * guard) e escopo (com a empresa do vínculo resolvida, roda no service).
 *
 * Nenhum papel é dado como negado por ausência de teste: cada negação abaixo é
 * uma asserção explícita.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";

const ACOES: readonly AuthorizationAction[] = [
  "read",
  "create",
  "alter",
  "manage",
];

const TODOS_OS_PAPEIS: readonly AccessRole[] = [
  "admin_tecnico",
  "rh",
  "dp",
  "gestor",
  "financeiro",
  "colaborador",
  "auditor",
  "dpo",
];

function sujeito(
  role: AccessRole,
  companyId: string | null = EMPRESA_A,
): AuthorizationSubject {
  return { userId: "ator-1", role, companyId };
}

function capacidade(
  role: AccessRole,
  resource: PessoasResource,
  action: AuthorizationAction,
  companyId: string | null = EMPRESA_A,
): boolean {
  // Fase 1: `targetCompanyId` ausente — é como o guard chama.
  return evaluatePermission(sujeito(role, companyId), { resource, action });
}

function escopo(
  role: AccessRole,
  resource: PessoasResource,
  action: AuthorizationAction,
  targetCompanyId: string,
  companyId: string | null = EMPRESA_A,
): boolean {
  return evaluatePermission(sujeito(role, companyId), {
    resource,
    action,
    targetCompanyId,
  });
}

describe("RBAC/ABAC — Colaboradores e vida funcional (Fatia 2)", () => {
  describe("admin_tecnico é negado em TODO o domínio", () => {
    // A exceção de acesso global (Emenda 1 da ADR 0005) foi concedida sobre a
    // estrutura organizacional, que não continha dado pessoal. A Baseline V1
    // (item 8) fecha a questão negando o papel aqui, de forma definitiva.
    it.each(PESSOAS_RESOURCES)(
      "nega admin_tecnico em %s, em toda ação e nas duas fases",
      (resource) => {
        for (const action of ACOES) {
          expect(capacidade("admin_tecnico", resource, action)).toBe(false);
          expect(capacidade("admin_tecnico", resource, action, null)).toBe(
            false,
          );
          expect(escopo("admin_tecnico", resource, action, EMPRESA_A)).toBe(
            false,
          );
        }
      },
    );

    it("continua com acesso à estrutura organizacional (Fatia 1 inalterada)", () => {
      // Prova de que a negação acima é *deste domínio*, não uma regressão de
      // autorização sobre o que já estava mergeado.
      expect(
        evaluatePermission(sujeito("admin_tecnico", null), {
          resource: "empresa",
          action: "create",
        }),
      ).toBe(true);
    });
  });

  describe("rh e dp operam a própria empresa", () => {
    it.each(["rh", "dp"] as const)(
      "%s tem capacidade em todo recurso e ação",
      (role) => {
        for (const resource of PESSOAS_RESOURCES) {
          for (const action of ACOES) {
            expect(capacidade(role, resource, action)).toBe(true);
          }
        }
      },
    );

    it.each(["rh", "dp"] as const)(
      "%s é permitido na própria empresa e negado em outra",
      (role) => {
        for (const resource of PESSOAS_RESOURCES) {
          for (const action of ACOES) {
            expect(escopo(role, resource, action, EMPRESA_A)).toBe(true);
            expect(escopo(role, resource, action, EMPRESA_B)).toBe(false);
          }
        }
      },
    );

    it.each(["rh", "dp"] as const)(
      "%s sem empresa atribuída não tem capacidade",
      (role) => {
        for (const resource of PESSOAS_RESOURCES) {
          expect(capacidade(role, resource, "read", null)).toBe(false);
        }
      },
    );
  });

  describe("demais papéis são negados por decisão explícita", () => {
    const NEGADOS: readonly AccessRole[] = [
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
    ];

    it.each(NEGADOS)("nega %s em todo recurso, ação e fase", (role) => {
      for (const resource of PESSOAS_RESOURCES) {
        for (const action of ACOES) {
          expect(capacidade(role, resource, action)).toBe(false);
          expect(escopo(role, resource, action, EMPRESA_A)).toBe(false);
        }
      }
    });

    it("auditor e dpo mantêm a leitura da trilha (access_log) intacta", () => {
      // A negação acima é sobre pessoas; o que eles já tinham não regride.
      for (const role of ["auditor", "dpo"] as const) {
        expect(
          evaluatePermission(sujeito(role), {
            resource: "access_log",
            action: "read",
          }),
        ).toBe(true);
      }
    });
  });

  describe("negação por padrão", () => {
    it("nenhum papel obtém recurso de pessoas fora de rh/dp", () => {
      const permitidos = TODOS_OS_PAPEIS.filter((role) =>
        PESSOAS_RESOURCES.some((resource) =>
          ACOES.some((action) => capacidade(role, resource, action)),
        ),
      );
      expect(permitidos.sort()).toEqual(["dp", "rh"]);
    });

    it("recurso desconhecido continua negado", () => {
      expect(
        evaluatePermission(sujeito("rh"), {
          // Recurso inexistente: o avaliador não deve conceder por omissão.
          resource: "recurso_inexistente" as never,
          action: "read",
        }),
      ).toBe(false);
    });
  });
});
