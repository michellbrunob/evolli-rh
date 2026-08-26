import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationSubject,
  HORARIOS_RESOURCES,
  HorariosResource,
} from "./permission.types";

/**
 * Matriz de acesso de Cadastros — Horarios (T038), celula a celula, nas duas
 * fases: capacidade (sem `targetCompanyId`) e escopo (com a empresa resolvida).
 *
 * Diferenca central em relacao a ponto: **RH e o UNICO operador** (T037). DP,
 * que opera ponto, e NEGADO aqui. `master_tecnico` so le. Cada negacao abaixo e
 * asserção explicita — nenhum papel e dado como negado por ausencia de teste.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";

const ACOES: readonly AuthorizationAction[] = [
  "read",
  "create",
  "alter",
  "manage",
];

const ACOES_OPERACIONAIS = ["create", "read", "alter"] as const;

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

/** So RH opera este dominio (T037) — nem DP. */
const PAPEL_PERMITIDO: AccessRole = "rh";

const PAPEIS_NEGADOS = TODOS_OS_PAPEIS.filter(
  (papel) => papel !== PAPEL_PERMITIDO,
);

function sujeito(
  role: AccessRole,
  companyId: string | null = EMPRESA_A,
): AuthorizationSubject {
  return { userId: "ator-sintetico", role, companyId };
}

describe("evaluateHorarios — matriz de Cadastros/Horarios (T038)", () => {
  describe("RH: unico operador, restrito a propria empresa", () => {
    for (const recurso of HORARIOS_RESOURCES) {
      it(`rh pode create/read/alter em ${recurso} (capacidade)`, () => {
        for (const acao of ACOES_OPERACIONAIS) {
          expect(
            evaluatePermission(sujeito("rh"), {
              resource: recurso,
              action: acao,
            }),
          ).toBe(true);
        }
      });

      it(`rh pode create/read/alter em ${recurso} na propria empresa (escopo)`, () => {
        for (const acao of ACOES_OPERACIONAIS) {
          expect(
            evaluatePermission(sujeito("rh"), {
              resource: recurso,
              action: acao,
              targetCompanyId: EMPRESA_A,
            }),
          ).toBe(true);
        }
      });

      it(`rh NAO acessa ${recurso} de outra empresa`, () => {
        for (const acao of ACOES_OPERACIONAIS) {
          expect(
            evaluatePermission(sujeito("rh"), {
              resource: recurso,
              action: acao,
              targetCompanyId: EMPRESA_B,
            }),
          ).toBe(false);
        }
      });

      it(`rh sem empresa nao passa nem na capacidade em ${recurso}`, () => {
        expect(
          evaluatePermission(sujeito("rh", null), {
            resource: recurso,
            action: "read",
          }),
        ).toBe(false);
      });

      it(`rh NAO tem 'manage' em ${recurso} — acao inexistente`, () => {
        expect(
          evaluatePermission(sujeito("rh"), {
            resource: recurso,
            action: "manage",
            targetCompanyId: EMPRESA_A,
          }),
        ).toBe(false);
      });
    }
  });

  describe("master_tecnico: le global, nunca muta", () => {
    for (const recurso of HORARIOS_RESOURCES) {
      it(`master le ${recurso} de qualquer empresa (capacidade global)`, () => {
        expect(
          evaluatePermission(sujeito("master_tecnico", null), {
            resource: recurso,
            action: "read",
          }),
        ).toBe(true);
      });

      it(`master NAO cria/altera ${recurso}`, () => {
        for (const acao of ["create", "alter", "manage"] as const) {
          expect(
            evaluatePermission(sujeito("master_tecnico", null), {
              resource: recurso,
              action: acao,
            }),
          ).toBe(false);
        }
      });
    }
  });

  describe("DP: NEGADO (a alcada de horario e exclusiva de RH, T037)", () => {
    for (const recurso of HORARIOS_RESOURCES) {
      it(`dp e negado em ${recurso}, em toda acao e nas duas fases`, () => {
        for (const acao of ACOES) {
          expect(
            evaluatePermission(sujeito("dp"), {
              resource: recurso,
              action: acao,
            }),
          ).toBe(false);
          expect(
            evaluatePermission(sujeito("dp"), {
              resource: recurso,
              action: acao,
              targetCompanyId: EMPRESA_A,
            }),
          ).toBe(false);
        }
      });
    }
  });

  describe("demais papeis: negados em todas as celulas", () => {
    for (const papel of PAPEIS_NEGADOS.filter(
      (p) => p !== "master_tecnico" && p !== "dp",
    )) {
      for (const recurso of HORARIOS_RESOURCES) {
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

  describe("cobertura da matriz", () => {
    it("cobre exatamente os dois recursos de horarios — nenhum a mais", () => {
      const esperados: readonly HorariosResource[] = [
        "tabela_horario",
        "vinculo_horario",
      ];
      expect([...HORARIOS_RESOURCES].sort()).toEqual([...esperados].sort());
    });
  });
});
