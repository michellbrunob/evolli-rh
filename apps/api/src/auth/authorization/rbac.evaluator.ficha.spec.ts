import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import { AuthorizationResource } from "./permission.types";

/**
 * T181 — a edição de dados pessoais, endereço e contatos na ficha é só de RH
 * e DP, na empresa ativa (decisão da proprietária de 2026-10-23). O
 * `master_tecnico` mantém a leitura que já tinha e NÃO edita. A ficha mostra a
 * edição só a RH e DP (`PAPEIS_EDICAO_FICHA`, na web) e depois de uma leitura
 * aceita; este teste prende, no servidor, a regra que sustenta isso, em todos
 * os papéis e situações de empresa, nas duas fases da avaliação (capacidade,
 * sem empresa resolvida, e escopo, com ela).
 *
 * A consulta de CEP exige a capacidade de admitir (`colaborador:create`): RH e
 * DP, os mesmos que editam a ficha.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";

const TODOS_OS_PAPEIS: readonly AccessRole[] = [
  "admin_tecnico",
  "rh",
  "dp",
  "gestor",
  "financeiro",
  "colaborador",
  "auditor",
  "dpo",
  "master_tecnico",
];

const CATEGORIAS_DA_FICHA: readonly AuthorizationResource[] = [
  "dados_pessoais_colaborador",
  "contato_colaborador",
];

/** Empresa do alvo: não resolvida, a do sujeito, outra e nenhuma. */
const ALVOS: readonly (string | null | undefined)[] = [
  undefined,
  EMPRESA_A,
  EMPRESA_B,
  null,
];

function pode(
  role: AccessRole,
  empresaDoSujeito: string | null,
  resource: AuthorizationResource,
  action: "read" | "alter" | "create",
  alvo: string | null | undefined,
): boolean {
  return evaluatePermission(
    { userId: "u1", role, companyId: empresaDoSujeito },
    {
      resource,
      action,
      ...(alvo === undefined ? {} : { targetCompanyId: alvo }),
    },
  );
}

describe("T181 — ficha: fora o master_tecnico, quem lê dados pessoais e contatos também os edita", () => {
  for (const resource of CATEGORIAS_DA_FICHA) {
    for (const role of TODOS_OS_PAPEIS.filter((p) => p !== "master_tecnico")) {
      for (const empresaDoSujeito of [EMPRESA_A, null]) {
        it.each(ALVOS)(
          `${resource} · ${role} · sujeito ${empresaDoSujeito ? "com" : "sem"} empresa · alvo %s: ler ⇔ editar`,
          (alvo) => {
            expect(pode(role, empresaDoSujeito, resource, "alter", alvo)).toBe(
              pode(role, empresaDoSujeito, resource, "read", alvo),
            );
          },
        );
      }
    }
  }

  it("master_tecnico nunca edita, em nenhuma fase nem empresa", () => {
    for (const resource of CATEGORIAS_DA_FICHA) {
      for (const empresaDoSujeito of [EMPRESA_A, null]) {
        for (const alvo of ALVOS) {
          expect(
            pode("master_tecnico", empresaDoSujeito, resource, "alter", alvo),
          ).toBe(false);
        }
      }
    }
  });

  it("master_tecnico mantém só a leitura que já tinha", () => {
    for (const resource of CATEGORIAS_DA_FICHA) {
      // Sem empresa ativa, lê em qualquer empresa; com ela, só nela.
      expect(pode("master_tecnico", null, resource, "read", undefined)).toBe(
        true,
      );
      expect(pode("master_tecnico", null, resource, "read", EMPRESA_B)).toBe(
        true,
      );
      expect(
        pode("master_tecnico", EMPRESA_A, resource, "read", EMPRESA_A),
      ).toBe(true);
      expect(
        pode("master_tecnico", EMPRESA_A, resource, "read", EMPRESA_B),
      ).toBe(false);
      expect(pode("master_tecnico", null, resource, "read", null)).toBe(false);
    }
  });

  it.each(["rh", "dp"] as const)(
    "%s edita só na própria empresa ativa",
    (role) => {
      for (const resource of CATEGORIAS_DA_FICHA) {
        expect(pode(role, EMPRESA_A, resource, "alter", EMPRESA_A)).toBe(true);
        expect(pode(role, EMPRESA_A, resource, "alter", EMPRESA_B)).toBe(false);
        expect(pode(role, EMPRESA_A, resource, "alter", null)).toBe(false);
        expect(pode(role, null, resource, "alter", undefined)).toBe(false);
      }
    },
  );

  it.each([
    "gestor",
    "financeiro",
    "colaborador",
    "admin_tecnico",
    "auditor",
    "dpo",
  ] as const)("%s não lê nem edita, em nenhuma empresa", (role) => {
    for (const resource of CATEGORIAS_DA_FICHA) {
      for (const alvo of ALVOS) {
        expect(pode(role, EMPRESA_A, resource, "read", alvo)).toBe(false);
        expect(pode(role, EMPRESA_A, resource, "alter", alvo)).toBe(false);
      }
    }
  });
});

describe("T181 — ficha: a consulta de CEP é de quem pode admitir", () => {
  it.each(TODOS_OS_PAPEIS)("%s", (role) => {
    const esperado = role === "rh" || role === "dp";
    expect(pode(role, EMPRESA_A, "colaborador", "create", undefined)).toBe(
      esperado,
    );
  });
});
