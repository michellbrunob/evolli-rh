import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationSubject,
} from "./permission.types";

const EMPRESA_A = "empresa-a";
const EMPRESA_B = "empresa-b";

function sujeito(
  role: AccessRole,
  companyId: string | null = EMPRESA_A,
): AuthorizationSubject {
  return { userId: "user-1", role, companyId };
}

/** Fase 1 (capacidade, no guard): alvo ainda não resolvido. */
function capacidade(role: AccessRole, action: AuthorizationAction): boolean {
  return evaluatePermission(sujeito(role), {
    resource: "solicitacao_pessoa",
    action,
  });
}

/** Fase 2 (escopo, no service): empresa do alvo já carregada. */
function escopo(
  role: AccessRole,
  action: AuthorizationAction,
  targetCompanyId: string | null,
): boolean {
  return evaluatePermission(sujeito(role), {
    resource: "solicitacao_pessoa",
    action,
    targetCompanyId,
  });
}

const ACOES_DA_CENTRAL: readonly AuthorizationAction[] = [
  "create",
  "read",
  "alter",
];

describe("rbac — Central de Solicitações de Pessoas (PD-SOL-01)", () => {
  describe("rh: único papel que opera", () => {
    for (const action of ACOES_DA_CENTRAL) {
      it(`permite rh em ${action} na própria empresa`, () => {
        expect(capacidade("rh", action)).toBe(true);
        expect(escopo("rh", action, EMPRESA_A)).toBe(true);
      });

      it(`nega rh em ${action} sobre outra empresa`, () => {
        expect(escopo("rh", action, EMPRESA_B)).toBe(false);
      });
    }

    it("nega rh sem empresa de escopo", () => {
      expect(
        evaluatePermission(sujeito("rh", null), {
          resource: "solicitacao_pessoa",
          action: "read",
        }),
      ).toBe(false);
    });
  });

  describe("master_tecnico: lê globalmente, nunca muta", () => {
    it("permite read em qualquer empresa", () => {
      expect(capacidade("master_tecnico", "read")).toBe(true);
      expect(escopo("master_tecnico", "read", EMPRESA_A)).toBe(true);
      expect(escopo("master_tecnico", "read", EMPRESA_B)).toBe(true);
    });

    it("nega create e alter — sem mutação trabalhista (ADR 0012, T065 §5)", () => {
      for (const action of ["create", "alter"] as const) {
        expect(capacidade("master_tecnico", action)).toBe(false);
        expect(escopo("master_tecnico", action, EMPRESA_A)).toBe(false);
      }
    });
  });

  describe("negação por padrão para todos os demais papéis", () => {
    const negados: readonly AccessRole[] = [
      // `PD-SOL-01` não deu operação ao DP nesta Central, ao contrário do que
      // fez em solicitacoes-documento e ajuste_ponto.
      "dp",
      // Consultivo não é capacidade de RBAC: não aprova, não recusa, não altera.
      "gestor",
      // Sem vínculo autenticado AccessUser <-> Colaborador (DP-23).
      "colaborador",
      "financeiro",
      "admin_tecnico",
      "auditor",
      "dpo",
    ];

    for (const role of negados) {
      for (const action of ACOES_DA_CENTRAL) {
        it(`nega ${role} em ${action}, nas duas fases`, () => {
          expect(capacidade(role, action)).toBe(false);
          expect(escopo(role, action, EMPRESA_A)).toBe(false);
        });
      }
    }
  });

  describe("ações fora da superfície da Central", () => {
    for (const action of ["manage", "reset"] as const) {
      it(`nega ${action} até para rh — a Central não expõe essa ação`, () => {
        expect(capacidade("rh", action)).toBe(false);
        expect(escopo("rh", action, EMPRESA_A)).toBe(false);
      });
    }
  });
});
