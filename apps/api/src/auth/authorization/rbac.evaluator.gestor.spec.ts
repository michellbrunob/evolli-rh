import { AccessRole } from "@prisma/client";
import { evaluatePermission } from "./rbac.evaluator";
import {
  AuthorizationAction,
  AuthorizationSubject,
  GESTOR_RESOURCES,
  GestorResource,
} from "./permission.types";
import {
  DOCUMENTOS_RESOURCES,
  HORARIOS_RESOURCES,
  ORGANIZATIONAL_RESOURCES,
  PESSOAS_RESOURCES,
  PONTO_RESOURCES,
  SOLICITACOES_PESSOAS_RESOURCES,
} from "./permission.types";

/**
 * Matriz de acesso do Gestor consultivo (T151, ADR 0015), célula a célula, nas
 * duas fases da avaliação: capacidade (sem `targetCompanyId`, roda no guard) e
 * escopo (com a empresa resolvida, roda no service).
 *
 * Nenhum papel é dado como negado por ausência de teste: cada negação abaixo é
 * asserção explícita. Esta é a primeira capacidade concedida ao papel `gestor`
 * em todo o produto, então a fronteira entre o que abriu e o que continua
 * fechado precisa estar escrita, não subentendida.
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

const ACOES: readonly AuthorizationAction[] = [
  "read",
  "create",
  "alter",
  "manage",
  "reset",
];

function sujeito(
  role: AccessRole,
  companyId: string | null = EMPRESA_A,
): AuthorizationSubject {
  return { userId: "ator-1", role, companyId };
}

function capacidade(
  role: AccessRole,
  resource: GestorResource,
  action: AuthorizationAction,
): boolean {
  return evaluatePermission(sujeito(role), { resource, action });
}

function escopo(
  role: AccessRole,
  resource: GestorResource,
  action: AuthorizationAction,
  targetCompanyId: string,
): boolean {
  return evaluatePermission(sujeito(role), {
    resource,
    action,
    targetCompanyId,
  });
}

describe("gestor_equipe — consulta consultiva", () => {
  it("gestor LÊ a própria equipe na própria empresa", () => {
    expect(capacidade("gestor", "gestor_equipe", "read")).toBe(true);
    expect(escopo("gestor", "gestor_equipe", "read", EMPRESA_A)).toBe(true);
  });

  it("gestor NÃO lê equipe de outra empresa", () => {
    expect(escopo("gestor", "gestor_equipe", "read", EMPRESA_B)).toBe(false);
  });

  it("gestor sem empresa na sessão não lê nada", () => {
    expect(
      evaluatePermission(sujeito("gestor", null), {
        resource: "gestor_equipe",
        action: "read",
      }),
    ).toBe(false);
  });

  it("gestor NÃO tem nenhuma mutação — consultivo é consultivo", () => {
    for (const acao of ACOES.filter((a) => a !== "read")) {
      expect(capacidade("gestor", "gestor_equipe", acao)).toBe(false);
      expect(escopo("gestor", "gestor_equipe", acao, EMPRESA_A)).toBe(false);
    }
  });

  it("rh lê, para conferir o escopo que configurou", () => {
    expect(escopo("rh", "gestor_equipe", "read", EMPRESA_A)).toBe(true);
    expect(escopo("rh", "gestor_equipe", "read", EMPRESA_B)).toBe(false);
  });

  it("master_tecnico é negado — não há escopo global de equipe a ler", () => {
    // Exceção deliberada ao padrão dos outros domínios: a consulta resolve o
    // escopo a partir da sessão, e conta global não tem empresa. Conceder
    // devolveria sempre lista vazia — permissão que não permite nada.
    for (const acao of ACOES) {
      expect(escopo("master_tecnico", "gestor_equipe", acao, EMPRESA_A)).toBe(
        false,
      );
    }
  });

  it("todos os demais papéis são negados em leitura", () => {
    const permitidos: readonly AccessRole[] = ["gestor", "rh"];
    for (const papel of TODOS_OS_PAPEIS.filter(
      (p) => !permitidos.includes(p),
    )) {
      expect(escopo(papel, "gestor_equipe", "read", EMPRESA_A)).toBe(false);
    }
  });
});

describe("gestor_atribuicao — administração pelo RH", () => {
  it("rh administra na própria empresa", () => {
    for (const acao of ["read", "create", "alter"] as AuthorizationAction[]) {
      expect(capacidade("rh", "gestor_atribuicao", acao)).toBe(true);
      expect(escopo("rh", "gestor_atribuicao", acao, EMPRESA_A)).toBe(true);
    }
  });

  it("rh NÃO administra outra empresa", () => {
    for (const acao of ["read", "create", "alter"] as AuthorizationAction[]) {
      expect(escopo("rh", "gestor_atribuicao", acao, EMPRESA_B)).toBe(false);
    }
  });

  it("gestor é NEGADO na administração — não define o próprio escopo", () => {
    for (const acao of ACOES) {
      expect(capacidade("gestor", "gestor_atribuicao", acao)).toBe(false);
      expect(escopo("gestor", "gestor_atribuicao", acao, EMPRESA_A)).toBe(
        false,
      );
    }
  });

  it("dp é NEGADO — a decisão 9 nomeia o RH", () => {
    for (const acao of ACOES) {
      expect(escopo("dp", "gestor_atribuicao", acao, EMPRESA_A)).toBe(false);
    }
  });

  it("master_tecnico é negado — permissão que a rota não honra mente na matriz", () => {
    // `empresaDoAtor()` recusa conta sem empresa, entao a rota responderia 404
    // mesmo com a permissao concedida. Leitura global de verdade exigiria
    // decidir QUAL empresa um leitor sem empresa lista — desenho que a
    // ADR 0015 nao cobriu.
    for (const acao of ACOES) {
      expect(
        escopo("master_tecnico", "gestor_atribuicao", acao, EMPRESA_A),
      ).toBe(false);
    }
  });

  it("todos os demais papéis são negados em tudo", () => {
    const permitidos: readonly AccessRole[] = ["rh"];
    for (const papel of TODOS_OS_PAPEIS.filter(
      (p) => !permitidos.includes(p),
    )) {
      for (const acao of ACOES) {
        expect(escopo(papel, "gestor_atribuicao", acao, EMPRESA_A)).toBe(false);
      }
    }
  });
});

describe("a T151 não afrouxou nenhuma negação anterior do gestor", () => {
  /**
   * A ADR 0015 resolveu DP-8 **apenas** no recorte de `gestor_equipe`. Se um
   * destes voltar a passar, o recorte vazou para um domínio que nenhuma
   * decisão abriu.
   */
  /**
   * DERIVADA, não escrita à mão.
   *
   * A versão anterior era uma lista literal de doze nomes — e **omitia os três
   * recursos de documentos**, que é precisamente o domínio mais sensível a um
   * gestor por conter atestado e laudo. Uma lista manual de "tudo o que
   * continua negado" é a forma errada de expressar a regra: ela envelhece em
   * silêncio a cada recurso novo, e o que falta nela nunca aparece como teste
   * vermelho.
   *
   * Derivar da união faz o contrário: um recurso criado amanhã entra aqui
   * sozinho, e quem quiser liberá-lo ao gestor terá de dizer isso
   * explicitamente, removendo-o de `GESTOR_RESOURCES`.
   */
  const AINDA_NEGADOS = [
    ...ORGANIZATIONAL_RESOURCES,
    ...PESSOAS_RESOURCES,
    ...PONTO_RESOURCES,
    ...DOCUMENTOS_RESOURCES,
    ...HORARIOS_RESOURCES,
    ...SOLICITACOES_PESSOAS_RESOURCES,
  ] as const;

  it.each(AINDA_NEGADOS)("gestor continua negado em %s", (recurso) => {
    for (const acao of ACOES) {
      expect(
        evaluatePermission(sujeito("gestor"), {
          resource: recurso,
          action: acao,
          targetCompanyId: EMPRESA_A,
        }),
      ).toBe(false);
    }
  });
});

describe("cobertura da matriz", () => {
  it("todo recurso de gestor é exercitado por este arquivo", () => {
    expect([...GESTOR_RESOURCES].sort()).toEqual([
      "gestor_atribuicao",
      "gestor_equipe",
    ]);
  });
});
