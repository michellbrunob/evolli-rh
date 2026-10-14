/**
 * Política do contexto empresarial ativo (T163).
 *
 * O que estes testes prendem:
 *
 * - **a política do `master_tecnico` é explícita** — a instrução exigia que o
 *   comportamento global preservado fosse coberto por teste, nunca por lista
 *   inventada no frontend. É o primeiro bloco;
 * - **quem não seleciona não lista** — lista vazia, sempre, mesmo tendo
 *   empresa; o serviço transforma isso em 403 antes de chegar à rede;
 * - **revogação rebaixa, nunca promove** — o defeito mais caro possível aqui
 *   seria perda de acesso virar ganho de escopo;
 * - **sem seleção, nada muda** — a propriedade que torna a T163 revisável.
 */
import { AccessRole, AccessUser } from "@prisma/client";
import {
  aplicarContextoAoAtor,
  empresaEstaAutorizada,
  listarEmpresasAutorizadas,
  papelSelecionaEmpresa,
  papelTemPoliticaGlobal,
  resolverContextoEmpresarial,
  type LeitorDeAutorizacao,
} from "./contexto-empresarial";

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";
const EMPRESA_D = "44444444-4444-4444-8444-444444444444";

interface LinhaEmpresa {
  id: string;
  codigo: string;
  nome: string;
  status: "ativo" | "inativo";
}

interface LinhaConcessao {
  userId: string;
  empresaId: string;
  revogadoEm: Date | null;
}

/**
 * Banco em memória com a MESMA semântica das consultas reais: filtro por
 * `status: "ativo"`, por `revogadoEm: null` e pela relação `empresa`. Um duplo
 * que ignorasse esses filtros faria os testes passarem sem provar nada.
 */
function bancoFake(
  empresas: LinhaEmpresa[],
  concessoes: LinhaConcessao[],
): LeitorDeAutorizacao {
  const empresaAtiva = (id: string) =>
    empresas.find((e) => e.id === id && e.status === "ativo") ?? null;

  const concessoesVigentes = (userId: string) =>
    concessoes.filter(
      (c) =>
        c.userId === userId &&
        c.revogadoEm === null &&
        empresaAtiva(c.empresaId) !== null,
    );

  return {
    empresa: {
      findFirst: async (args) => {
        const where = args.where as { id?: string; status?: string };
        if (where.status === "ativo" && where.id !== undefined) {
          return empresaAtiva(where.id);
        }
        return empresas.find((e) => e.id === where.id) ?? null;
      },
      findMany: async () =>
        empresas
          .filter((e) => e.status === "ativo")
          .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    },
    accessUserEmpresa: {
      findFirst: async (args) => {
        const where = args.where as { userId?: string; empresaId?: string };
        const achou = concessoesVigentes(where.userId ?? "").find(
          (c) => c.empresaId === where.empresaId,
        );
        return achou === undefined ? null : { id: "concessao" };
      },
      findMany: async (args) => {
        const where = args.where as { userId?: string };
        return concessoesVigentes(where.userId ?? "").map((c) => ({
          empresa: empresas.find((e) => e.id === c.empresaId)!,
        }));
      },
    },
  };
}

function ator(role: AccessRole, companyId: string | null): AccessUser {
  return {
    id: "ator-1",
    email: "pessoa.teste@example.test",
    passwordHash: "nao-usado",
    role,
    companyId,
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as AccessUser;
}

const EMPRESAS: LinhaEmpresa[] = [
  { id: EMPRESA_A, codigo: "AAA", nome: "Empresa A", status: "ativo" },
  { id: EMPRESA_B, codigo: "BBB", nome: "Empresa B", status: "ativo" },
  { id: EMPRESA_D, codigo: "DDD", nome: "Empresa D", status: "ativo" },
];

describe("T163 — quem seleciona empresa", () => {
  const TODOS: AccessRole[] = [
    "master_tecnico",
    "admin_tecnico",
    "rh",
    "dp",
    "gestor",
    "colaborador",
    "financeiro",
    "auditor",
    "dpo",
  ];

  it("apenas rh e master_tecnico selecionam", () => {
    const selecionam = TODOS.filter(papelSelecionaEmpresa);
    expect(selecionam).toEqual(["master_tecnico", "rh"]);
  });

  it("apenas master_tecnico tem política global", () => {
    const globais = TODOS.filter(papelTemPoliticaGlobal);
    expect(globais).toEqual(["master_tecnico"]);
  });

  it.each([
    "dp",
    "gestor",
    "colaborador",
    "financeiro",
    "auditor",
    "dpo",
    "admin_tecnico",
  ] as AccessRole[])(
    "%s recebe lista VAZIA, mesmo tendo empresa",
    async (role) => {
      const prisma = bancoFake(EMPRESAS, [
        // Mesmo com concessão gravada — o papel não seleciona, ponto.
        { userId: "ator-1", empresaId: EMPRESA_B, revogadoEm: null },
      ]);
      const lista = await listarEmpresasAutorizadas(
        prisma,
        ator(role, EMPRESA_A),
      );
      expect(lista).toEqual([]);
    },
  );
});

describe("T163 — política do master_tecnico, explícita", () => {
  it("recebe TODAS as empresas ativas, da tabela empresa e não de concessão", async () => {
    // Nenhuma linha em access_user_empresa: a política dele não depende dela.
    const prisma = bancoFake(EMPRESAS, []);
    const lista = await listarEmpresasAutorizadas(
      prisma,
      ator("master_tecnico", null),
    );
    expect(lista.map((e) => e.codigo)).toEqual(["AAA", "BBB", "DDD"]);
  });

  it("empresa INATIVA não entra na lista nem é selecionável", async () => {
    const comInativa: LinhaEmpresa[] = [
      ...EMPRESAS.slice(0, 2),
      { id: EMPRESA_D, codigo: "DDD", nome: "Empresa D", status: "inativo" },
    ];
    const prisma = bancoFake(comInativa, []);
    const lista = await listarEmpresasAutorizadas(
      prisma,
      ator("master_tecnico", null),
    );
    expect(lista.map((e) => e.id)).not.toContain(EMPRESA_D);
    await expect(
      empresaEstaAutorizada(prisma, ator("master_tecnico", null), EMPRESA_D),
    ).resolves.toBe(false);
  });

  it("sem seleção, continua em escopo global — companyId nulo", async () => {
    const prisma = bancoFake(EMPRESAS, []);
    const ctx = await resolverContextoEmpresarial(
      prisma,
      ator("master_tecnico", null),
      null,
    );
    expect(ctx.empresaAtivaId).toBeNull();
    expect(ctx.podeTrocarEmpresa).toBe(true);
  });

  it("com seleção, passa a operar NAQUELA empresa", async () => {
    const prisma = bancoFake(EMPRESAS, []);
    const ctx = await resolverContextoEmpresarial(
      prisma,
      ator("master_tecnico", null),
      EMPRESA_D,
    );
    expect(ctx.empresaAtivaId).toBe(EMPRESA_D);
    expect(ctx.selecaoInvalidada).toBe(false);
  });
});

describe("T163 — rh: concessões mais a própria empresa", () => {
  it("vê a própria empresa mesmo sem linha na tabela", async () => {
    const prisma = bancoFake(EMPRESAS, []);
    const lista = await listarEmpresasAutorizadas(
      prisma,
      ator("rh", EMPRESA_A),
    );
    expect(lista.map((e) => e.id)).toEqual([EMPRESA_A]);
  });

  it("vê a própria mais as concedidas, ordenadas e sem repetir", async () => {
    const prisma = bancoFake(EMPRESAS, [
      { userId: "ator-1", empresaId: EMPRESA_B, revogadoEm: null },
      // Concessão redundante da própria empresa não duplica a linha.
      { userId: "ator-1", empresaId: EMPRESA_A, revogadoEm: null },
    ]);
    const lista = await listarEmpresasAutorizadas(
      prisma,
      ator("rh", EMPRESA_A),
    );
    expect(lista.map((e) => e.codigo)).toEqual(["AAA", "BBB"]);
  });

  it("NÃO vê empresa de terceiro sem concessão", async () => {
    const prisma = bancoFake(EMPRESAS, [
      { userId: "ator-1", empresaId: EMPRESA_B, revogadoEm: null },
    ]);
    const lista = await listarEmpresasAutorizadas(
      prisma,
      ator("rh", EMPRESA_A),
    );
    expect(lista.map((e) => e.id)).not.toContain(EMPRESA_D);
    await expect(
      empresaEstaAutorizada(prisma, ator("rh", EMPRESA_A), EMPRESA_D),
    ).resolves.toBe(false);
  });

  it("concessão REVOGADA sai da lista e deixa de autorizar", async () => {
    const prisma = bancoFake(EMPRESAS, [
      {
        userId: "ator-1",
        empresaId: EMPRESA_B,
        revogadoEm: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);
    const lista = await listarEmpresasAutorizadas(
      prisma,
      ator("rh", EMPRESA_A),
    );
    expect(lista.map((e) => e.id)).toEqual([EMPRESA_A]);
    await expect(
      empresaEstaAutorizada(prisma, ator("rh", EMPRESA_A), EMPRESA_B),
    ).resolves.toBe(false);
  });
});

describe("T163 — resolução por requisição", () => {
  it("sem seleção, o contexto é IDÊNTICO ao de antes da T163", async () => {
    const prisma = bancoFake(EMPRESAS, []);
    for (const role of ["rh", "dp", "gestor", "colaborador"] as AccessRole[]) {
      const ctx = await resolverContextoEmpresarial(
        prisma,
        ator(role, EMPRESA_A),
        null,
      );
      expect(ctx.empresaAtivaId).toBe(EMPRESA_A);
      expect(ctx.selecaoInvalidada).toBe(false);
    }
  });

  it("seleção válida de rh é respeitada", async () => {
    const prisma = bancoFake(EMPRESAS, [
      { userId: "ator-1", empresaId: EMPRESA_B, revogadoEm: null },
    ]);
    const ctx = await resolverContextoEmpresarial(
      prisma,
      ator("rh", EMPRESA_A),
      EMPRESA_B,
    );
    expect(ctx.empresaAtivaId).toBe(EMPRESA_B);
  });

  it("revogação REBAIXA ao padrão — nunca promove a escopo global", async () => {
    // Este é o defeito que não pode existir: perder acesso virar ganho.
    const prisma = bancoFake(EMPRESAS, [
      {
        userId: "ator-1",
        empresaId: EMPRESA_B,
        revogadoEm: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);
    const ctx = await resolverContextoEmpresarial(
      prisma,
      ator("rh", EMPRESA_A),
      EMPRESA_B,
    );
    expect(ctx.empresaAtivaId).toBe(EMPRESA_A);
    expect(ctx.empresaAtivaId).not.toBeNull();
    expect(ctx.selecaoInvalidada).toBe(true);
  });

  it("empresa inexistente na sessão também rebaixa", async () => {
    const prisma = bancoFake(EMPRESAS, []);
    const ctx = await resolverContextoEmpresarial(
      prisma,
      ator("rh", EMPRESA_A),
      "99999999-9999-4999-8999-999999999999",
    );
    expect(ctx.empresaAtivaId).toBe(EMPRESA_A);
    expect(ctx.selecaoInvalidada).toBe(true);
  });

  it("papel que PERDEU o direito de selecionar tem a seleção invalidada", async () => {
    // rh virou dp depois de já ter selecionado a empresa B.
    const prisma = bancoFake(EMPRESAS, [
      { userId: "ator-1", empresaId: EMPRESA_B, revogadoEm: null },
    ]);
    const ctx = await resolverContextoEmpresarial(
      prisma,
      ator("dp", EMPRESA_A),
      EMPRESA_B,
    );
    expect(ctx.empresaAtivaId).toBe(EMPRESA_A);
    expect(ctx.selecaoInvalidada).toBe(true);
    expect(ctx.podeTrocarEmpresa).toBe(false);
  });

  it("master_tecnico com seleção revogada volta ao global, não a outra empresa", async () => {
    const semEmpresaD: LinhaEmpresa[] = EMPRESAS.map((e) =>
      e.id === EMPRESA_D ? { ...e, status: "inativo" as const } : e,
    );
    const prisma = bancoFake(semEmpresaD, []);
    const ctx = await resolverContextoEmpresarial(
      prisma,
      ator("master_tecnico", null),
      EMPRESA_D,
    );
    expect(ctx.empresaAtivaId).toBeNull();
    expect(ctx.selecaoInvalidada).toBe(true);
  });
});

describe("T163 — o ator entregue aos serviços", () => {
  it("companyId passa a ser a empresa ATIVA, e a da conta fica preservada", async () => {
    const prisma = bancoFake(EMPRESAS, [
      { userId: "ator-1", empresaId: EMPRESA_B, revogadoEm: null },
    ]);
    const base = ator("rh", EMPRESA_A);
    const ctx = await resolverContextoEmpresarial(prisma, base, EMPRESA_B);
    const comContexto = aplicarContextoAoAtor(base, ctx);

    // É isto que faz os 8 resolvedores de escopo do produto operarem na
    // empresa certa sem que nenhum deles precise mudar.
    expect(comContexto.companyId).toBe(EMPRESA_B);
    expect(comContexto.contaEmpresaId).toBe(EMPRESA_A);
    expect(comContexto.podeTrocarEmpresa).toBe(true);
    // Nada mais do ator muda.
    expect(comContexto.id).toBe(base.id);
    expect(comContexto.role).toBe(base.role);
  });

  it("para quem não seleciona, o ator é indistinguível do de antes", async () => {
    const prisma = bancoFake(EMPRESAS, []);
    const base = ator("gestor", EMPRESA_A);
    const ctx = await resolverContextoEmpresarial(prisma, base, null);
    const comContexto = aplicarContextoAoAtor(base, ctx);
    expect(comContexto.companyId).toBe(base.companyId);
    expect(comContexto.podeTrocarEmpresa).toBe(false);
  });
});
