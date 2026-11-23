import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import type { AuthorizationAction } from "./permission.types";

/**
 * T213 — documentos do colaborador com arquivo (ADR 0021):
 * - rh e dp: lista, envio, troca/remoção e download, só na própria empresa;
 * - master_tecnico: só a lista e o estado, com empresa ativa; nunca o
 *   conteúdo nem escrita;
 * - demais papéis: negados.
 */
const A = "empresa-a";
const B = "empresa-b";

const pode = (
  role: AccessRole,
  companyId: string | null,
  resource: "documento_colaborador" | "conteudo_documento_colaborador",
  action: AuthorizationAction,
  targetCompanyId?: string | null,
) =>
  evaluatePermission(
    { userId: "u", role, companyId },
    {
      resource,
      action,
      ...(targetCompanyId !== undefined ? { targetCompanyId } : {}),
    },
  );

describe("RBAC — documentos do colaborador (T213)", () => {
  describe.each(["rh", "dp"] as const)("%s", (role) => {
    it.each(["read", "create", "alter"] as const)(
      "documento_colaborador/%s: só na própria empresa",
      (action) => {
        expect(pode(role, A, "documento_colaborador", action)).toBe(true);
        expect(pode(role, A, "documento_colaborador", action, A)).toBe(true);
        expect(pode(role, A, "documento_colaborador", action, B)).toBe(false);
        expect(pode(role, null, "documento_colaborador", action)).toBe(false);
      },
    );

    it("baixa o conteúdo só na própria empresa", () => {
      expect(pode(role, A, "conteudo_documento_colaborador", "read")).toBe(
        true,
      );
      expect(pode(role, A, "conteudo_documento_colaborador", "read", A)).toBe(
        true,
      );
      expect(pode(role, A, "conteudo_documento_colaborador", "read", B)).toBe(
        false,
      );
    });

    it("ações fora do conjunto são negadas", () => {
      expect(pode(role, A, "documento_colaborador", "manage", A)).toBe(false);
      expect(pode(role, A, "conteudo_documento_colaborador", "alter", A)).toBe(
        false,
      );
    });
  });

  describe("master_tecnico", () => {
    it("lê a lista só com empresa ativa, e só nela", () => {
      expect(pode("master_tecnico", A, "documento_colaborador", "read")).toBe(
        true,
      );
      expect(
        pode("master_tecnico", A, "documento_colaborador", "read", A),
      ).toBe(true);
      expect(
        pode("master_tecnico", A, "documento_colaborador", "read", B),
      ).toBe(false);
      expect(
        pode("master_tecnico", null, "documento_colaborador", "read", A),
      ).toBe(false);
    });

    it("nunca escreve nem baixa", () => {
      for (const action of ["create", "alter"] as const) {
        expect(pode("master_tecnico", A, "documento_colaborador", action)).toBe(
          false,
        );
      }
      expect(
        pode("master_tecnico", A, "conteudo_documento_colaborador", "read"),
      ).toBe(false);
      expect(
        pode("master_tecnico", A, "conteudo_documento_colaborador", "read", A),
      ).toBe(false);
    });
  });

  it.each([
    "gestor",
    "colaborador",
    "financeiro",
    "auditor",
    "dpo",
    "admin_tecnico",
  ] as const)("%s: negado em tudo", (role) => {
    for (const resource of [
      "documento_colaborador",
      "conteudo_documento_colaborador",
    ] as const) {
      for (const action of ["read", "create", "alter"] as const) {
        expect(pode(role, A, resource, action)).toBe(false);
        expect(pode(role, A, resource, action, A)).toBe(false);
      }
    }
  });
});
