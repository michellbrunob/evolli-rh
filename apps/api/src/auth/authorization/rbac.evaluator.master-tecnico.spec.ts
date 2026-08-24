import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import { AuthorizationAction, AuthorizationSubject } from "./permission.types";

/**
 * T030 — Perfil global controlado `master_tecnico`. Matriz efetiva, célula a
 * célula, nas duas fases (capacidade sem `targetCompanyId`; escopo com a
 * empresa resolvida). Cobre o que o perfil PODE (leitura global + administração
 * de contas/papéis comuns + estrutura organizacional + leitura da trilha) e o
 * que ele NÃO PODE (mutação sensível de negócio, promoção a `master_tecnico`,
 * escrita na trilha).
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";

function master(companyId: string | null = null): AuthorizationSubject {
  // O Master de bootstrap não tem empresa; mesmo assim opera em escopo global.
  return { userId: "master-1", role: "master_tecnico", companyId };
}

function pode(
  subject: AuthorizationSubject,
  resource: string,
  action: AuthorizationAction,
  targetCompanyId?: string,
): boolean {
  return evaluatePermission(subject, {
    resource: resource as never,
    action,
    ...(targetCompanyId !== undefined ? { targetCompanyId } : {}),
  });
}

const RECURSOS_ORG = [
  "empresa",
  "unidade_organizacional",
  "departamento",
  "area",
  "equipe",
  "cargo",
  "centro_custo",
] as const;

const RECURSOS_PESSOAS = [
  "colaborador",
  "vinculo_funcional",
  "movimentacao_funcional",
  "alocacao_organizacional",
] as const;

const RECURSOS_PONTO = ["evento_ponto", "ajuste_ponto"] as const;

const RECURSOS_DOCUMENTOS = [
  "tipo_documento",
  "documento_metadado",
  "solicitacao_documento",
] as const;

describe("RBAC/ABAC — master_tecnico (T030, perfil global controlado)", () => {
  describe("Organização — lê e administra em qualquer empresa", () => {
    for (const recurso of RECURSOS_ORG) {
      for (const acao of ["read", "create", "alter", "manage"] as const) {
        it(`concede ${acao} em ${recurso}, na empresa B, mesmo sem empresa própria`, () => {
          // Capacidade (fase 1) e escopo (fase 2) numa empresa que não é a dele.
          expect(pode(master(), recurso, acao)).toBe(true);
          expect(pode(master(), recurso, acao, EMPRESA_B)).toBe(true);
        });
      }
    }
  });

  describe("Pessoas — leitura global; nenhuma mutação", () => {
    for (const recurso of RECURSOS_PESSOAS) {
      it(`concede read em ${recurso} em qualquer empresa`, () => {
        expect(pode(master(), recurso, "read")).toBe(true);
        expect(pode(master(), recurso, "read", EMPRESA_A)).toBe(true);
        expect(pode(master(), recurso, "read", EMPRESA_B)).toBe(true);
      });
      for (const acao of ["create", "alter", "manage"] as const) {
        it(`nega ${acao} em ${recurso} (mutação sensível reservada a rh/dp)`, () => {
          expect(pode(master(), recurso, acao)).toBe(false);
          expect(pode(master(), recurso, acao, EMPRESA_A)).toBe(false);
        });
      }
    }
  });

  describe("Ponto — leitura global; nunca registra evento/ajuste", () => {
    for (const recurso of RECURSOS_PONTO) {
      it(`concede read em ${recurso} em qualquer empresa`, () => {
        expect(pode(master(), recurso, "read")).toBe(true);
        expect(pode(master(), recurso, "read", EMPRESA_B)).toBe(true);
      });
      it(`nega create em ${recurso}`, () => {
        expect(pode(master(), recurso, "create")).toBe(false);
        expect(pode(master(), recurso, "create", EMPRESA_A)).toBe(false);
      });
    }
  });

  describe("Documentos — leitura global; nenhuma criação/substituição", () => {
    for (const recurso of RECURSOS_DOCUMENTOS) {
      it(`concede read em ${recurso} em qualquer empresa`, () => {
        expect(pode(master(), recurso, "read")).toBe(true);
        expect(pode(master(), recurso, "read", EMPRESA_B)).toBe(true);
      });
      for (const acao of ["create", "alter"] as const) {
        it(`nega ${acao} em ${recurso}`, () => {
          expect(pode(master(), recurso, acao)).toBe(false);
          expect(pode(master(), recurso, acao, EMPRESA_A)).toBe(false);
        });
      }
    }
  });

  describe("Contas de acesso e papéis", () => {
    it("gerencia conta de qualquer empresa (other_account)", () => {
      expect(
        evaluatePermission(master(), {
          resource: "other_account",
          action: "manage",
          targetUserId: "outro",
          targetCompanyId: EMPRESA_B,
        }),
      ).toBe(true);
    });

    it("atribui papéis COMUNS em qualquer empresa (create e alter)", () => {
      for (const novo of [
        "rh",
        "dp",
        "gestor",
        "financeiro",
        "colaborador",
      ] as AccessRole[]) {
        expect(
          evaluatePermission(master(), {
            resource: "user_role",
            action: "create",
            targetNewRole: novo,
            targetCompanyId: EMPRESA_B,
          }),
        ).toBe(true);
        expect(
          evaluatePermission(master(), {
            resource: "user_role",
            action: "alter",
            targetUserId: "outro",
            targetNewRole: novo,
            targetCompanyId: EMPRESA_A,
          }),
        ).toBe(true);
      }
    });

    it("NÃO promove ninguém a master_tecnico (nem cria, nem altera)", () => {
      expect(
        evaluatePermission(master(), {
          resource: "user_role",
          action: "create",
          targetNewRole: "master_tecnico",
          targetCompanyId: EMPRESA_A,
        }),
      ).toBe(false);
      expect(
        evaluatePermission(master(), {
          resource: "user_role",
          action: "alter",
          targetUserId: "outro",
          targetNewRole: "master_tecnico",
          targetCompanyId: EMPRESA_A,
        }),
      ).toBe(false);
    });

    it("NÃO atribui dpo nem auditor — papéis legados não provisionáveis (CG-DPO-01/03)", () => {
      for (const alvo of ["dpo", "auditor"] as const) {
        expect(
          evaluatePermission(master(), {
            resource: "user_role",
            action: "create",
            targetNewRole: alvo,
            targetCompanyId: EMPRESA_A,
          }),
        ).toBe(false);
        expect(
          evaluatePermission(master(), {
            resource: "user_role",
            action: "alter",
            targetUserId: "outro",
            targetNewRole: alvo,
            targetCompanyId: EMPRESA_A,
          }),
        ).toBe(false);
      }
    });

    it("NÃO cria admin_tecnico (papel privilegiado, fora dos comuns)", () => {
      expect(
        evaluatePermission(master(), {
          resource: "user_role",
          action: "create",
          targetNewRole: "admin_tecnico",
          targetCompanyId: EMPRESA_A,
        }),
      ).toBe(false);
    });

    it("NÃO altera o próprio papel (autoelevação)", () => {
      expect(
        evaluatePermission(master(), {
          resource: "user_role",
          action: "alter",
          targetUserId: "master-1",
          targetNewRole: "rh",
        }),
      ).toBe(false);
    });
  });

  describe("Trilha de auditoria (access_log)", () => {
    it("LÊ a trilha em escopo global (as duas empresas)", () => {
      expect(pode(master(), "access_log", "read")).toBe(true);
      // Independe de empresa-alvo: papel global, consulta ampla.
      expect(pode(master(), "access_log", "read", EMPRESA_A)).toBe(true);
      expect(pode(master(), "access_log", "read", EMPRESA_B)).toBe(true);
    });

    it("não escreve na trilha — só leitura", () => {
      for (const acao of ["create", "alter", "manage"] as const) {
        expect(pode(master(), "access_log", acao)).toBe(false);
      }
    });

    it("nenhum papel comum ganha acesso à trilha (deny-by-default preservado)", () => {
      for (const papel of [
        "rh",
        "dp",
        "gestor",
        "financeiro",
        "colaborador",
      ] as AccessRole[]) {
        expect(
          pode(
            { userId: "x", role: papel, companyId: EMPRESA_A },
            "access_log",
            "read",
            EMPRESA_A,
          ),
        ).toBe(false);
      }
    });
  });

  describe("Limites do perfil", () => {
    it("lê e gerencia apenas a PRÓPRIA conta (own_account)", () => {
      expect(
        evaluatePermission(master(), {
          resource: "own_account",
          action: "read",
          targetUserId: "master-1",
        }),
      ).toBe(true);
      expect(
        evaluatePermission(master(), {
          resource: "own_account",
          action: "manage",
          targetUserId: "outro",
        }),
      ).toBe(false);
    });
  });

  describe("Nenhuma rota comum atribui master_tecnico — vale para TODO ator", () => {
    for (const ator of ["admin_tecnico", "rh"] as AccessRole[]) {
      it(`${ator} não cria usuário master_tecnico`, () => {
        expect(
          evaluatePermission(
            { userId: "a", role: ator, companyId: EMPRESA_A },
            {
              resource: "user_role",
              action: "create",
              targetNewRole: "master_tecnico",
              targetCompanyId: EMPRESA_A,
            },
          ),
        ).toBe(false);
      });
      it(`${ator} não promove terceiro a master_tecnico`, () => {
        expect(
          evaluatePermission(
            { userId: "a", role: ator, companyId: EMPRESA_A },
            {
              resource: "user_role",
              action: "alter",
              targetUserId: "outro",
              targetNewRole: "master_tecnico",
              targetCompanyId: EMPRESA_A,
            },
          ),
        ).toBe(false);
      });
    }
  });
});
