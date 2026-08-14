import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationSubject,
  DOCUMENTOS_RESOURCES,
  DocumentosResource,
} from "./permission.types";

/**
 * Matriz de acesso da Etapa 2 — Documentos, V1 de metadados (ADR 0011),
 * célula a célula, nas duas fases: capacidade (sem `targetCompanyId`, roda no
 * guard) e escopo (com a empresa do documento resolvida, roda no service).
 *
 * Nenhum papel é dado como negado por ausência de teste: cada negação é uma
 * asserção explícita.
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
  resource: DocumentosResource,
  action: AuthorizationAction,
  companyId: string | null = EMPRESA_A,
): boolean {
  return evaluatePermission(sujeito(role, companyId), { resource, action });
}

function escopo(
  role: AccessRole,
  resource: DocumentosResource,
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

describe("RBAC/ABAC — Documentos (Etapa 2, metadados)", () => {
  describe("admin_tecnico é negado em TODO o domínio", () => {
    it.each(DOCUMENTOS_RESOURCES)(
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
      expect(
        evaluatePermission(sujeito("admin_tecnico", null), {
          resource: "empresa",
          action: "create",
        }),
      ).toBe(true);
    });
  });

  describe("rh opera catálogo, metadado e solicitação na própria empresa", () => {
    it("tem capacidade de criar/alterar/ler catálogo, metadado e criar/ler solicitação", () => {
      expect(capacidade("rh", "tipo_documento", "read")).toBe(true);
      expect(capacidade("rh", "tipo_documento", "create")).toBe(true);
      expect(capacidade("rh", "tipo_documento", "alter")).toBe(true);
      expect(capacidade("rh", "documento_metadado", "read")).toBe(true);
      expect(capacidade("rh", "documento_metadado", "create")).toBe(true);
      expect(capacidade("rh", "documento_metadado", "alter")).toBe(true);
      expect(capacidade("rh", "solicitacao_documento", "read")).toBe(true);
      expect(capacidade("rh", "solicitacao_documento", "create")).toBe(true);
    });

    it("não altera solicitação (não há alteração nesta V1)", () => {
      expect(capacidade("rh", "solicitacao_documento", "alter")).toBe(false);
      expect(capacidade("rh", "solicitacao_documento", "manage")).toBe(false);
    });

    it("é permitido na própria empresa e negado em outra", () => {
      expect(escopo("rh", "documento_metadado", "create", EMPRESA_A)).toBe(
        true,
      );
      expect(escopo("rh", "documento_metadado", "create", EMPRESA_B)).toBe(
        false,
      );
      expect(escopo("rh", "tipo_documento", "create", EMPRESA_A)).toBe(true);
      expect(escopo("rh", "tipo_documento", "create", EMPRESA_B)).toBe(false);
    });

    it("sem empresa atribuída não tem capacidade", () => {
      for (const resource of DOCUMENTOS_RESOURCES) {
        expect(capacidade("rh", resource, "read", null)).toBe(false);
      }
    });
  });

  describe("dp: só RH cria/altera catálogo (Emenda 1 da ADR 0011)", () => {
    it("dp lê o catálogo, mas não o cria nem altera", () => {
      expect(capacidade("dp", "tipo_documento", "read")).toBe(true);
      expect(capacidade("dp", "tipo_documento", "create")).toBe(false);
      expect(capacidade("dp", "tipo_documento", "alter")).toBe(false);
    });

    it("dp opera metadado e solicitação como rh", () => {
      expect(capacidade("dp", "documento_metadado", "read")).toBe(true);
      expect(capacidade("dp", "documento_metadado", "create")).toBe(true);
      expect(capacidade("dp", "documento_metadado", "alter")).toBe(true);
      expect(capacidade("dp", "solicitacao_documento", "read")).toBe(true);
      expect(capacidade("dp", "solicitacao_documento", "create")).toBe(true);
    });

    it("dp é permitido na própria empresa e negado em outra", () => {
      expect(escopo("dp", "documento_metadado", "create", EMPRESA_A)).toBe(
        true,
      );
      expect(escopo("dp", "documento_metadado", "create", EMPRESA_B)).toBe(
        false,
      );
      // Mesmo na própria empresa, dp não cria catálogo.
      expect(escopo("dp", "tipo_documento", "create", EMPRESA_A)).toBe(false);
    });
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
      for (const resource of DOCUMENTOS_RESOURCES) {
        for (const action of ACOES) {
          expect(capacidade(role, resource, action)).toBe(false);
          expect(escopo(role, resource, action, EMPRESA_A)).toBe(false);
        }
      }
    });
  });

  describe("negação por padrão", () => {
    it("apenas rh e dp obtêm algum recurso de documentos", () => {
      const permitidos = TODOS_OS_PAPEIS.filter((role) =>
        DOCUMENTOS_RESOURCES.some((resource) =>
          ACOES.some((action) => capacidade(role, resource, action)),
        ),
      );
      expect(permitidos.sort()).toEqual(["dp", "rh"]);
    });

    it("apenas rh cria/altera catálogo", () => {
      const podeCriarCatalogo = TODOS_OS_PAPEIS.filter(
        (role) =>
          capacidade(role, "tipo_documento", "create") ||
          capacidade(role, "tipo_documento", "alter"),
      );
      expect(podeCriarCatalogo).toEqual(["rh"]);
    });
  });
});
