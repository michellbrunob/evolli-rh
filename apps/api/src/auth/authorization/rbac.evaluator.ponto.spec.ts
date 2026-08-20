import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationSubject,
  PONTO_RESOURCES,
  PontoResource,
} from "./permission.types";

/**
 * Matriz de acesso da Etapa 3 — Jornada e Ponto (ADR 0008; Baseline Jornada
 * V1, decisão 5), célula a célula, nas **duas fases** da avaliação:
 * capacidade (sem `targetCompanyId`, roda no guard) e escopo (com a empresa do
 * vínculo resolvida, roda no service).
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

/** Só RH e DP operam este domínio (decisão 5). */
const PAPEIS_PERMITIDOS: readonly AccessRole[] = ["rh", "dp"];

const PAPEIS_NEGADOS = TODOS_OS_PAPEIS.filter(
  (papel) => !PAPEIS_PERMITIDOS.includes(papel),
);

function sujeito(
  role: AccessRole,
  companyId: string | null = EMPRESA_A,
): AuthorizationSubject {
  return { userId: "ator-sintetico", role, companyId };
}

describe("evaluatePonto — matriz da Baseline Jornada V1", () => {
  describe("RH e DP: registram e consultam na propria empresa", () => {
    for (const papel of PAPEIS_PERMITIDOS) {
      for (const recurso of PONTO_RESOURCES) {
        it(`${papel} pode create e read em ${recurso} (fase de capacidade)`, () => {
          for (const acao of ["create", "read"] as const) {
            expect(
              evaluatePermission(sujeito(papel), {
                resource: recurso,
                action: acao,
              }),
            ).toBe(true);
          }
        });

        it(`${papel} pode create e read em ${recurso} na propria empresa (fase de escopo)`, () => {
          for (const acao of ["create", "read"] as const) {
            expect(
              evaluatePermission(sujeito(papel), {
                resource: recurso,
                action: acao,
                targetCompanyId: EMPRESA_A,
              }),
            ).toBe(true);
          }
        });

        it(`${papel} NAO acessa ${recurso} de outra empresa`, () => {
          for (const acao of ["create", "read"] as const) {
            expect(
              evaluatePermission(sujeito(papel), {
                resource: recurso,
                action: acao,
                targetCompanyId: EMPRESA_B,
              }),
            ).toBe(false);
          }
        });

        it(`${papel} sem empresa nao passa nem na fase de capacidade em ${recurso}`, () => {
          expect(
            evaluatePermission(sujeito(papel, null), {
              resource: recurso,
              action: "read",
            }),
          ).toBe(false);
        });
      }
    }

    // Não existe alteração nem gestão neste domínio: o evento é imutável
    // (decisão 4) e não há aprovação nem fechamento (decisão 7). Mesmo RH/DP
    // são negados nessas ações.
    for (const papel of PAPEIS_PERMITIDOS) {
      for (const recurso of PONTO_RESOURCES) {
        for (const acao of ["alter", "manage"] as const) {
          it(`${papel} NAO tem ${acao} em ${recurso} — acao inexistente nesta V1`, () => {
            expect(
              evaluatePermission(sujeito(papel), {
                resource: recurso,
                action: acao,
                targetCompanyId: EMPRESA_A,
              }),
            ).toBe(false);
          });
        }
      }
    }
  });

  describe("demais papeis: negados em todas as celulas", () => {
    for (const papel of PAPEIS_NEGADOS) {
      for (const recurso of PONTO_RESOURCES) {
        it(`${papel} e negado em ${recurso}, em toda acao e nas duas fases`, () => {
          for (const acao of ACOES) {
            expect(
              evaluatePermission(sujeito(papel), {
                resource: recurso,
                action: acao,
              }),
            ).toBe(false);

            expect(
              evaluatePermission(sujeito(papel), {
                resource: recurso,
                action: acao,
                targetCompanyId: EMPRESA_A,
              }),
            ).toBe(false);
          }
        });
      }
    }
  });

  describe("admin_tecnico: negacao deliberada, nao omissao", () => {
    it("e negado em ponto mesmo com empresa resolvida, em toda acao", () => {
      for (const recurso of PONTO_RESOURCES) {
        for (const acao of ACOES) {
          expect(
            evaluatePermission(sujeito("admin_tecnico", null), {
              resource: recurso,
              action: acao,
            }),
          ).toBe(false);

          expect(
            evaluatePermission(sujeito("admin_tecnico"), {
              resource: recurso,
              action: acao,
              targetCompanyId: EMPRESA_A,
            }),
          ).toBe(false);
        }
      }
    });

    it("também NÃO acessa a ESTRUTURA organizacional (CG-RBAC-01, ADR 0012)", () => {
      // A antiga assimetria acabou: `admin_tecnico` converge para
      // bootstrap/histórico e é negado de forma uniforme. O único acesso global
      // standing (inclusive à estrutura) passou a ser do `master_tecnico`.
      expect(
        evaluatePermission(sujeito("admin_tecnico", null), {
          resource: "empresa",
          action: "read",
          targetCompanyId: EMPRESA_B,
        }),
      ).toBe(false);
      expect(
        evaluatePermission(sujeito("master_tecnico", null), {
          resource: "empresa",
          action: "read",
          targetCompanyId: EMPRESA_B,
        }),
      ).toBe(true);
    });
  });

  describe("gestor: negado enquanto DP-8 nao for decidida", () => {
    it("nao acessa ponto nem da propria empresa", () => {
      // "Gestor aprova o ponto da equipe" é o fluxo natural do domínio — é
      // exatamente por isso que conceder sem a decisão seria escolher a
      // fronteira por conta própria.
      for (const recurso of PONTO_RESOURCES) {
        expect(
          evaluatePermission(sujeito("gestor"), {
            resource: recurso,
            action: "read",
            targetCompanyId: EMPRESA_A,
          }),
        ).toBe(false);
      }
    });
  });

  describe("colaborador: negado — portal do colaborador esta fora de escopo", () => {
    it("nao consulta ponto, nem o proprio", () => {
      for (const recurso of PONTO_RESOURCES) {
        expect(
          evaluatePermission(sujeito("colaborador"), {
            resource: recurso,
            action: "read",
            targetCompanyId: EMPRESA_A,
          }),
        ).toBe(false);
      }
    });
  });

  describe("auditor e dpo: leem a trilha, nao o dado de ponto", () => {
    it("sao negados em ponto mas mantem access_log", () => {
      for (const papel of ["auditor", "dpo"] as const) {
        for (const recurso of PONTO_RESOURCES) {
          expect(
            evaluatePermission(sujeito(papel), {
              resource: recurso,
              action: "read",
              targetCompanyId: EMPRESA_A,
            }),
          ).toBe(false);
        }

        // A leitura da trilha que já possuíam segue intacta.
        expect(
          evaluatePermission(sujeito(papel), {
            resource: "access_log",
            action: "read",
          }),
        ).toBe(true);
      }
    });
  });

  describe("cobertura da matriz", () => {
    it("cobre exatamente os dois recursos de ponto — nenhum a mais", () => {
      // Se um recurso novo entrar em PONTO_RESOURCES sem decisão de produto,
      // este teste falha e força a revisão da matriz.
      const esperados: readonly PontoResource[] = [
        "evento_ponto",
        "ajuste_ponto",
      ];
      expect([...PONTO_RESOURCES].sort()).toEqual([...esperados].sort());
    });
  });
});
