import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AccessRole, AccessUser, Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { evaluatePermission } from "../../auth/authorization/rbac.evaluator";
import { AuditService } from "../../audit/audit.service";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { RegistrarContatosColaboradorDto } from "./contato-colaborador.dto";
import {
  ContatoColaboradorService,
  camposAlterados,
} from "./contato-colaborador.service";
import { resolverEscopoContatos } from "./escopo-contatos.util";
import {
  normalizarEmailPessoal,
  normalizarTelefone,
} from "./normalizacao-contatos.util";

/**
 * T169 — Contatos do colaborador.
 *
 * Cobre, sem banco: normalização e validação (ficha, §3), a matriz de acesso
 * da ficha nas duas camadas (guard e serviço), a resolução da empresa REAL do
 * colaborador, os estados `sem_registro`/`registrado`/`bloqueado` e a
 * auditoria — que registra campos afetados e nunca valores.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";
const COLABORADOR = "33333333-3333-4333-8333-333333333333";
const CONTATO_ID = "44444444-4444-4444-8444-444444444444";

const EMAIL = "pessoa.sintetica@example.test";
const CELULAR = "+5511987654321";
const TELEFONE = "1133334444";

function ator(role: AccessRole, companyId: string | null): AccessUser {
  return { id: `ator-${role}`, role, companyId } as unknown as AccessUser;
}

function ctx(actor: AccessUser): PessoasAuditContext {
  return {
    actor,
    metadata: { ip: "127.0.0.1", userAgent: "jest", requestId: "req-t169" },
  } as PessoasAuditContext;
}

async function errosDe(corpo: Record<string, unknown>) {
  const dto = plainToInstance(RegistrarContatosColaboradorDto, corpo);
  const erros = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return {
    dto,
    campos: erros.map((e) => e.property).sort(),
    /** Quais regras recusaram cada campo — prova QUAL decorador agiu. */
    regras: Object.fromEntries(
      erros.map((e) => [e.property, Object.keys(e.constraints ?? {}).sort()]),
    ),
  };
}

const CORPO_VALIDO = {
  emailPessoal: EMAIL,
  celular: CELULAR,
  telefone: TELEFONE,
};

// ---------------------------------------------------------------------------
// Normalização e validação
// ---------------------------------------------------------------------------

describe("Contatos — normalização (ficha, §3)", () => {
  it("e-mail: apara as pontas e usa caixa baixa, como o e-mail de conta", () => {
    expect(normalizarEmailPessoal("  Pessoa.Sintetica@Example.TEST ")).toBe(
      "pessoa.sintetica@example.test",
    );
  });

  it.each([
    ["(11) 98765-4321", "11987654321"],
    ["+55 (11) 98765-4321", "+5511987654321"],
    ["+44 20.7946.0958", "+442079460958"],
    ["  1133334444  ", "1133334444"],
    ["1234-5678", "12345678"],
  ])("telefone %p vira %p — só dígitos, + preservado", (entrada, saida) => {
    expect(normalizarTelefone(entrada)).toBe(saida);
  });

  it.each(["11 9876-ABCD", "55+11987654321", "+", "ramal 123", "11/98765"])(
    "telefone com caractere fora do permitido %p volta intacto (a validação recusa)",
    (entrada) => {
      expect(normalizarTelefone(entrada)).toBe(entrada);
    },
  );

  it("valor que não é texto volta intacto", () => {
    expect(normalizarTelefone(11987654321)).toBe(11987654321);
    expect(normalizarEmailPessoal(null)).toBeNull();
  });
});

describe("Contatos — validação do corpo", () => {
  it("corpo válido passa e chega NORMALIZADO ao serviço", async () => {
    const { dto, campos } = await errosDe({
      emailPessoal: "  Pessoa.Sintetica@EXAMPLE.test",
      celular: "+55 (11) 98765-4321",
      telefone: "(11) 3333-4444",
    });
    expect(campos).toEqual([]);
    expect({ ...dto }).toEqual({
      emailPessoal: EMAIL,
      celular: CELULAR,
      telefone: TELEFONE,
    });
  });

  it("os três campos são obrigatórios", async () => {
    expect((await errosDe({})).campos).toEqual([
      "celular",
      "emailPessoal",
      "telefone",
    ]);
  });

  it.each(["", "   ", "sem-arroba", "a@b@c.test", "duas palavras@x.test"])(
    "e-mail inválido %p é recusado",
    async (emailPessoal) => {
      expect((await errosDe({ ...CORPO_VALIDO, emailPessoal })).campos).toEqual(
        ["emailPessoal"],
      );
    },
  );

  // E-mails SINTATICAMENTE válidos: parte local de 64 e rótulos de até 63.
  // `@IsEmail` também recusa acima de 254, então o teste confere QUAL regra
  // agiu — sem `@MaxLength(254)`, a lista de regras não traria `maxLength`.
  const emailComTamanho = (total: number) => {
    const local = "a".repeat(64);
    const fim = ".test";
    const meio = total - local.length - 1 - fim.length - 2 * 64;
    return `${local}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(meio)}${fim}`;
  };

  it("e-mail válido com exatamente 254 caracteres é aceito", async () => {
    const emailPessoal = emailComTamanho(254);
    expect(emailPessoal).toHaveLength(254);
    expect((await errosDe({ ...CORPO_VALIDO, emailPessoal })).campos).toEqual(
      [],
    );
  });

  it("e-mail válido com 255 caracteres é recusado pelo limite de 254", async () => {
    const emailPessoal = emailComTamanho(255);
    expect(emailPessoal).toHaveLength(255);
    const { campos, regras } = await errosDe({
      ...CORPO_VALIDO,
      emailPessoal,
    });
    expect(campos).toEqual(["emailPessoal"]);
    expect(regras["emailPessoal"]).toContain("maxLength");
  });

  it.each([
    ["1234567", "7 dígitos"],
    ["+1234567890123456", "16 dígitos"],
    ["11 9876-ABCD", "letra"],
    ["", "vazio"],
    ["() - .", "só separadores"],
  ])("telefone %p (%s) é recusado nos dois campos", async (valor) => {
    expect(
      (await errosDe({ ...CORPO_VALIDO, celular: valor, telefone: valor }))
        .campos,
    ).toEqual(["celular", "telefone"]);
  });

  it("8 e 15 dígitos são os limites aceitos", async () => {
    expect(
      (
        await errosDe({
          ...CORPO_VALIDO,
          celular: "12345678",
          telefone: "+123456789012345",
        })
      ).campos,
    ).toEqual([]);
  });

  it("empresa vinda do navegador é recusada — o corpo não a aceita", async () => {
    expect(
      (await errosDe({ ...CORPO_VALIDO, empresaId: EMPRESA_B })).campos,
    ).toEqual(["empresaId"]);
  });

  it("campo fora da ficha é recusado (e-mail corporativo não é gravado aqui)", async () => {
    expect(
      (await errosDe({ ...CORPO_VALIDO, emailCorporativo: "x@empresa.test" }))
        .campos,
    ).toEqual(["emailCorporativo"]);
  });
});

// ---------------------------------------------------------------------------
// Acesso — duas camadas
// ---------------------------------------------------------------------------

describe("Contatos — matriz de acesso da ficha", () => {
  function pode(
    role: AccessRole,
    companyId: string | null,
    action: "read" | "alter" | "create" | "manage",
    targetCompanyId?: string,
  ) {
    return evaluatePermission(
      { userId: `u-${role}`, role, companyId },
      {
        resource: "contato_colaborador",
        action,
        ...(targetCompanyId !== undefined && { targetCompanyId }),
      },
    );
  }

  describe("fase 1 (guard): capacidade", () => {
    it.each([
      ["rh", EMPRESA_A],
      ["dp", EMPRESA_A],
      ["master_tecnico", null],
      ["master_tecnico", EMPRESA_A],
    ] as const)("%s (empresa %s) lê e edita", (role, companyId) => {
      expect(pode(role, companyId, "read")).toBe(true);
      expect(pode(role, companyId, "alter")).toBe(true);
    });

    it.each([
      ["gestor", EMPRESA_A],
      ["colaborador", EMPRESA_A],
      ["financeiro", EMPRESA_A],
      ["admin_tecnico", null],
      ["auditor", null],
      ["dpo", null],
      ["rh", null],
      ["dp", null],
    ] as const)("%s (empresa %s) não tem acesso", (role, companyId) => {
      expect(pode(role, companyId, "read")).toBe(false);
      expect(pode(role, companyId, "alter")).toBe(false);
    });

    it.each(["create", "manage"] as const)(
      "ação %s não existe no recurso, nem para o master",
      (action) => {
        expect(pode("rh", EMPRESA_A, action)).toBe(false);
        expect(pode("master_tecnico", null, action)).toBe(false);
      },
    );
  });

  describe("fase 2 (serviço): fronteira com a empresa do vínculo", () => {
    it.each(["rh", "dp"] as const)("%s: só a própria empresa ativa", (role) => {
      expect(pode(role, EMPRESA_A, "alter", EMPRESA_A)).toBe(true);
      expect(pode(role, EMPRESA_A, "alter", EMPRESA_B)).toBe(false);
      expect(pode(role, EMPRESA_A, "read", EMPRESA_B)).toBe(false);
    });

    it("master sem empresa ativa: qualquer empresa", () => {
      expect(pode("master_tecnico", null, "alter", EMPRESA_B)).toBe(true);
      expect(pode("master_tecnico", null, "read", EMPRESA_A)).toBe(true);
    });

    it("master com empresa ativa: só ela", () => {
      expect(pode("master_tecnico", EMPRESA_A, "alter", EMPRESA_A)).toBe(true);
      expect(pode("master_tecnico", EMPRESA_A, "alter", EMPRESA_B)).toBe(false);
    });

    it("a exceção do master NÃO se estende a colaborador/vínculo", () => {
      expect(
        evaluatePermission(
          { userId: "m", role: "master_tecnico", companyId: null },
          { resource: "colaborador", action: "alter" },
        ),
      ).toBe(false);
      expect(
        evaluatePermission(
          { userId: "m", role: "master_tecnico", companyId: null },
          { resource: "vinculo_funcional", action: "create" },
        ),
      ).toBe(false);
    });
  });

  describe("resolverEscopoContatos (defesa em profundidade)", () => {
    it.each(["rh", "dp"] as const)("%s recebe a empresa da SESSÃO", (role) => {
      expect(resolverEscopoContatos(ator(role, EMPRESA_A))).toEqual({
        global: false,
        empresaId: EMPRESA_A,
      });
    });

    it("master sem empresa ativa é global; com empresa ativa, escopado", () => {
      expect(resolverEscopoContatos(ator("master_tecnico", null))).toEqual({
        global: true,
      });
      expect(resolverEscopoContatos(ator("master_tecnico", EMPRESA_A))).toEqual(
        { global: false, empresaId: EMPRESA_A },
      );
    });

    it.each([
      ["rh", null],
      ["dp", null],
      ["gestor", EMPRESA_A],
      ["colaborador", EMPRESA_A],
      ["financeiro", EMPRESA_A],
      ["admin_tecnico", null],
      ["auditor", null],
      ["dpo", null],
    ] as const)("%s (empresa %s) é recusado", (role, companyId) => {
      expect(() => resolverEscopoContatos(ator(role, companyId))).toThrow(
        ForbiddenException,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Serviço — empresa real, estados e trilha de TODA consulta, sem valores
// ---------------------------------------------------------------------------

type Vinculo = {
  empresaId: string;
  situacao: "previsto" | "ativo" | "encerrado";
};

function montar(opcoes: {
  vinculos: Vinculo[];
  contato?: Record<string, unknown> | null;
  falhaAuditoria?: boolean;
  /**
   * O banco devolve os vínculos IGNORANDO o filtro de empresa. Só existe para
   * isolar a fase 2 (`podeAcessarPessoas`): com o filtro correto, ela nunca é
   * a camada que nega.
   */
  ignorarFiltroDeEmpresa?: boolean;
}) {
  const contatoGravado =
    opcoes.contato === undefined || opcoes.contato === null
      ? null
      : {
          id: CONTATO_ID,
          atualizadoEm: new Date("2026-10-16T12:00:00Z"),
          ...opcoes.contato,
        };

  const prisma = {
    vinculoFuncional: {
      findMany: jest.fn(async (args: { where: { empresaId?: string } }) =>
        opcoes.vinculos.filter(
          (v) =>
            opcoes.ignorarFiltroDeEmpresa ||
            args.where.empresaId === undefined ||
            v.empresaId === args.where.empresaId,
        ),
      ),
    },
    contatoColaborador: {
      findUnique: jest.fn(async () => contatoGravado),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: CONTATO_ID,
        emailPessoal: args.data.emailPessoal,
        celular: args.data.celular,
        telefone: args.data.telefone,
        atualizadoEm: new Date("2026-10-16T12:00:00Z"),
        // Coluna que a projeção não pede: se vazar, o teste de resposta pega.
        criadoPorUserId: "NAO_PODE_VAZAR",
      })),
      update: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        ...contatoGravado,
        ...args.data,
      })),
    },
    contatoColaboradorEvento: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  );

  const auditService = {
    record: jest.fn(async () => {
      if (opcoes.falhaAuditoria) {
        throw new Error("trilha indisponível");
      }
    }),
    recordOrThrow: jest.fn(),
  };
  const auditoria = new PessoasAuditoriaService(
    auditService as unknown as AuditService,
  );
  const service = new ContatoColaboradorService(
    prisma as unknown as PrismaService,
    auditoria,
  );
  return { prisma, auditService, service };
}

/** Tudo o que foi gravado na trilha e nos eventos, serializado. */
function trilha(m: ReturnType<typeof montar>): string {
  return JSON.stringify([
    m.auditService.record.mock.calls,
    m.prisma.contatoColaboradorEvento.create.mock.calls,
  ]);
}

function semValores(texto: string) {
  for (const valor of [EMAIL, CELULAR, TELEFONE, "5511987654321", "@"]) {
    expect(texto).not.toContain(valor);
  }
}

/** A única linha de `audit_event` gravada com sucesso (não a de negação). */
function eventoFormal(m: ReturnType<typeof montar>) {
  const chamadas = m.auditService.record.mock.calls as unknown as [
    Record<string, unknown>,
    unknown,
  ][];
  expect(chamadas).toHaveLength(1);
  const [entrada, tx] = chamadas[0]!;
  // Sempre dentro da transação: sem `tx`, a trilha seria best-effort.
  expect(tx).toBe(m.prisma);
  return entrada;
}

function eventoDeTratamento(m: ReturnType<typeof montar>) {
  const chamadas = m.prisma.contatoColaboradorEvento.create.mock
    .calls as unknown as [{ data: Record<string, unknown> }][];
  expect(chamadas).toHaveLength(1);
  return chamadas[0]![0].data;
}

const COM_VALOR = { emailPessoal: EMAIL, celular: CELULAR, telefone: TELEFONE };
const ATIVO_A: Vinculo[] = [{ empresaId: EMPRESA_A, situacao: "ativo" }];
const ENCERRADO_A: Vinculo[] = [
  { empresaId: EMPRESA_A, situacao: "encerrado" },
];
const DUAS_EMPRESAS: Vinculo[] = [
  { empresaId: EMPRESA_A, situacao: "ativo" },
  { empresaId: EMPRESA_B, situacao: "ativo" },
];

describe("Contatos — serviço", () => {
  describe("colaborador fora do alcance", () => {
    it("rh sem vínculo do colaborador na empresa ativa: 404, negação auditada, nada lido", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_B, situacao: "ativo" }],
      });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(m.prisma.vinculoFuncional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { colaboradorId: COLABORADOR, empresaId: EMPRESA_A },
        }),
      );
      expect(m.auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "authorization_denied",
          resource: "contato_colaborador",
          result: "denied",
          companyId: EMPRESA_A,
        }),
      );
      expect(m.prisma.contatoColaborador.findUnique).not.toHaveBeenCalled();
    });

    it("colaborador inexistente responde igual a fora do escopo (404)", async () => {
      const m = montar({ vinculos: [] });
      await expect(
        m.service.registrar(
          COLABORADOR,
          CORPO_VALIDO as RegistrarContatosColaboradorDto,
          ctx(ator("dp", EMPRESA_A)),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(m.prisma.contatoColaborador.create).not.toHaveBeenCalled();
    });

    it.each(["gestor", "colaborador"] as const)(
      "%s é recusado antes de qualquer consulta",
      async (role) => {
        const m = montar({ vinculos: ATIVO_A });
        await expect(
          m.service.consultar(COLABORADOR, ctx(ator(role, EMPRESA_A))),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(m.prisma.vinculoFuncional.findMany).not.toHaveBeenCalled();
      },
    );

    it("fase 2 isolada: vínculo de outra empresa que escape do filtro é negado (404), sem ler contato", async () => {
      // Com o filtro de empresa correto, este caso não é alcançável. O mock
      // devolve o vínculo da empresa B mesmo assim, para provar que a segunda
      // camada (`podeAcessarPessoas` com a empresa do vínculo) nega sozinha.
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_B, situacao: "ativo" }],
        contato: COM_VALOR,
        ignorarFiltroDeEmpresa: true,
      });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(m.auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "authorization_denied",
          result: "denied",
          companyId: EMPRESA_B,
        }),
      );
      expect(m.prisma.contatoColaborador.findUnique).not.toHaveBeenCalled();
      expect(m.prisma.contatoColaboradorEvento.create).not.toHaveBeenCalled();
    });
  });

  describe("toda consulta deixa trilha (GET)", () => {
    it("com valor: devolve só os três campos; trilha consultado/success e evento valores_devolvidos, sem valores", async () => {
      const m = montar({ vinculos: ATIVO_A, contato: COM_VALOR });
      const resposta = await m.service.consultar(
        COLABORADOR,
        ctx(ator("dp", EMPRESA_A)),
      );
      expect(resposta).toEqual({
        colaboradorId: COLABORADOR,
        empresaId: EMPRESA_A,
        situacao: "registrado",
        contatos: {
          emailPessoal: EMAIL,
          celular: CELULAR,
          telefone: TELEFONE,
          atualizadoEm: new Date("2026-10-16T12:00:00Z"),
        },
      });
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          resource: "contato_colaborador",
          resourceId: COLABORADOR,
          companyId: EMPRESA_A,
          actorRole: "dp",
          result: "success",
          requestId: "req-t169",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual({
        colaboradorId: COLABORADOR,
        empresaId: EMPRESA_A,
        contatoId: CONTATO_ID,
        acao: "leitura",
        resultado: "valores_devolvidos",
        campos: ["email_pessoal", "celular", "telefone"],
        atorUserId: "ator-dp",
        requestId: "req-t169",
      });
      semValores(trilha(m));
    });

    it("sem registro: sem erro, sem valor — e COM trilha (sem_registro, sem contato, nenhum campo)", async () => {
      const m = montar({ vinculos: ATIVO_A, contato: null });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).resolves.toEqual({
        colaboradorId: COLABORADOR,
        empresaId: EMPRESA_A,
        situacao: "sem_registro",
        contatos: null,
      });
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          resourceId: COLABORADOR,
          companyId: EMPRESA_A,
          result: "success",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          colaboradorId: COLABORADOR,
          empresaId: EMPRESA_A,
          contatoId: null,
          acao: "leitura",
          resultado: "sem_registro",
          campos: [],
        }),
      );
    });

    it("bloqueado (desligado): sem valor, valor NÃO lido — e COM trilha apontando o contato existente", async () => {
      const m = montar({ vinculos: ENCERRADO_A, contato: COM_VALOR });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).resolves.toEqual({
        colaboradorId: COLABORADOR,
        empresaId: EMPRESA_A,
        situacao: "bloqueado",
        contatos: null,
      });
      // Só o id do contato é buscado; os valores, nunca.
      expect(m.prisma.contatoColaborador.findUnique).toHaveBeenCalledTimes(1);
      expect(m.prisma.contatoColaborador.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ select: { id: true } }),
      );
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          companyId: EMPRESA_A,
          result: "success",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          contatoId: CONTATO_ID,
          acao: "leitura",
          resultado: "bloqueado",
          campos: [],
        }),
      );
    });

    it("bloqueado sem contato gravado: trilha sem contato", async () => {
      const m = montar({ vinculos: ENCERRADO_A, contato: null });
      await m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A)));
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({ contatoId: null, resultado: "bloqueado" }),
      );
    });

    it("vínculo previsto (admitido, ainda não ativo) é uso operacional", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "previsto" }],
        contato: null,
      });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).resolves.toMatchObject({ situacao: "sem_registro" });
    });

    it.each([
      ["com valor", ATIVO_A, COM_VALOR],
      ["sem registro", ATIVO_A, null],
      ["bloqueado", ENCERRADO_A, COM_VALOR],
    ] as const)(
      "fail-safe (%s): se a trilha falha, nada é respondido",
      async (_caso, vinculos, contato) => {
        const m = montar({
          vinculos: [...vinculos],
          contato,
          falhaAuditoria: true,
        });
        await expect(
          m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
        ).rejects.toThrow("trilha indisponível");
        expect(m.prisma.contatoColaboradorEvento.create).not.toHaveBeenCalled();
      },
    );
  });

  describe("master_tecnico", () => {
    it("sem empresa ativa: resolve e audita a empresa REAL do vínculo", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_B, situacao: "ativo" }],
        contato: COM_VALOR,
      });
      const resposta = await m.service.consultar(
        COLABORADOR,
        ctx(ator("master_tecnico", null)),
      );
      expect(resposta.empresaId).toBe(EMPRESA_B);
      expect(m.prisma.vinculoFuncional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { colaboradorId: COLABORADOR } }),
      );
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          companyId: EMPRESA_B,
          actorRole: "master_tecnico",
        }),
      );
    });

    it("sem empresa ativa e sem registro: também deixa trilha, com a empresa real", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_B, situacao: "ativo" }],
        contato: null,
      });
      await m.service.consultar(COLABORADOR, ctx(ator("master_tecnico", null)));
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({ companyId: EMPRESA_B, result: "success" }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          empresaId: EMPRESA_B,
          resultado: "sem_registro",
        }),
      );
    });

    it("GET ambíguo (duas empresas): 409, nada lido, trilha SEM empresa e com resultado de falha", async () => {
      const m = montar({ vinculos: DUAS_EMPRESAS, contato: COM_VALOR });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("master_tecnico", null))),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.prisma.contatoColaborador.findUnique).not.toHaveBeenCalled();
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          resource: "contato_colaborador",
          resourceId: COLABORADOR,
          companyId: null,
          actorRole: "master_tecnico",
          result: "failure",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual({
        colaboradorId: COLABORADOR,
        empresaId: null,
        contatoId: null,
        acao: "leitura",
        resultado: "empresa_ambigua",
        campos: [],
        atorUserId: "ator-master_tecnico",
        requestId: "req-t169",
      });
    });

    it("PUT ambíguo: 409, nada gravado, trilha de edição SEM empresa e com falha", async () => {
      const m = montar({ vinculos: DUAS_EMPRESAS, contato: null });
      await expect(
        m.service.registrar(
          COLABORADOR,
          CORPO_VALIDO as RegistrarContatosColaboradorDto,
          ctx(ator("master_tecnico", null)),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.prisma.contatoColaborador.create).not.toHaveBeenCalled();
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_atualizado",
          companyId: null,
          result: "failure",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          acao: "edicao",
          resultado: "empresa_ambigua",
          empresaId: null,
        }),
      );
      semValores(trilha(m));
    });

    it("ambíguo e trilha indisponível: erro, nunca o 409 silencioso", async () => {
      const m = montar({ vinculos: DUAS_EMPRESAS, falhaAuditoria: true });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("master_tecnico", null))),
      ).rejects.toThrow("trilha indisponível");
    });

    it("com empresa ativa: só ela — colaborador de outra empresa é 404", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_B, situacao: "ativo" }],
      });
      await expect(
        m.service.consultar(
          COLABORADOR,
          ctx(ator("master_tecnico", EMPRESA_A)),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("edita em qualquer empresa, auditado com a empresa real", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_B, situacao: "ativo" }],
        contato: null,
      });
      const resposta = await m.service.registrar(
        COLABORADOR,
        CORPO_VALIDO as RegistrarContatosColaboradorDto,
        ctx(ator("master_tecnico", null)),
      );
      expect(resposta.resultado).toBe("criado");
      expect(m.prisma.contatoColaborador.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ empresaId: EMPRESA_B }),
        }),
      );
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_criado",
          companyId: EMPRESA_B,
          actorRole: "master_tecnico",
        }),
      );
    });
  });

  describe("gravação", () => {
    it("criação: empresa do VÍNCULO, autoria da sessão, evento gravado com os três campos, sem valores na trilha", async () => {
      const m = montar({ vinculos: ATIVO_A, contato: null });
      const resposta = await m.service.registrar(
        COLABORADOR,
        CORPO_VALIDO as RegistrarContatosColaboradorDto,
        ctx(ator("rh", EMPRESA_A)),
      );
      expect(resposta).toEqual({
        colaboradorId: COLABORADOR,
        empresaId: EMPRESA_A,
        situacao: "registrado",
        resultado: "criado",
        contatos: {
          emailPessoal: EMAIL,
          celular: CELULAR,
          telefone: TELEFONE,
          atualizadoEm: new Date("2026-10-16T12:00:00Z"),
        },
      });
      expect(m.prisma.contatoColaborador.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            empresaId: EMPRESA_A,
            colaboradorId: COLABORADOR,
            emailPessoal: EMAIL,
            celular: CELULAR,
            telefone: TELEFONE,
            criadoPorUserId: "ator-rh",
            atualizadoPorUserId: "ator-rh",
          },
        }),
      );
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_criado",
          result: "success",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          contatoId: CONTATO_ID,
          acao: "criacao",
          resultado: "gravado",
          campos: ["email_pessoal", "celular", "telefone"],
          empresaId: EMPRESA_A,
        }),
      );
      semValores(trilha(m));
    });

    it("edição: o evento registra SÓ os campos que mudaram", async () => {
      const m = montar({ vinculos: ATIVO_A, contato: COM_VALOR });
      const resposta = await m.service.registrar(
        COLABORADOR,
        { ...CORPO_VALIDO, telefone: "1144445555" },
        ctx(ator("dp", EMPRESA_A)),
      );
      expect(resposta.resultado).toBe("atualizado");
      expect(m.prisma.contatoColaborador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONTATO_ID },
          data: expect.objectContaining({ atualizadoPorUserId: "ator-dp" }),
        }),
      );
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({ action: "pessoas_contato_atualizado" }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          acao: "edicao",
          resultado: "gravado",
          campos: ["telefone"],
        }),
      );
      semValores(trilha(m));
      expect(trilha(m)).not.toContain("1144445555");
    });

    it("PUT sem alteração: nada gravado, mas a devolução dos valores fica na trilha como leitura", async () => {
      const m = montar({ vinculos: ATIVO_A, contato: COM_VALOR });
      const resposta = await m.service.registrar(
        COLABORADOR,
        CORPO_VALIDO as RegistrarContatosColaboradorDto,
        ctx(ator("rh", EMPRESA_A)),
      );
      expect(resposta.resultado).toBe("sem_alteracao");
      expect(resposta.contatos).toMatchObject(COM_VALOR);
      expect(m.prisma.contatoColaborador.update).not.toHaveBeenCalled();
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          companyId: EMPRESA_A,
          result: "success",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          contatoId: CONTATO_ID,
          acao: "leitura",
          resultado: "sem_alteracao",
          campos: ["email_pessoal", "celular", "telefone"],
        }),
      );
      semValores(trilha(m));
    });

    it("PUT sem alteração e trilha indisponível: nada é devolvido", async () => {
      const m = montar({
        vinculos: ATIVO_A,
        contato: COM_VALOR,
        falhaAuditoria: true,
      });
      await expect(
        m.service.registrar(
          COLABORADOR,
          CORPO_VALIDO as RegistrarContatosColaboradorDto,
          ctx(ator("rh", EMPRESA_A)),
        ),
      ).rejects.toThrow("trilha indisponível");
    });

    it("desligado: edição recusada (409), nada gravado — e a tentativa fica na trilha", async () => {
      const m = montar({ vinculos: ENCERRADO_A, contato: COM_VALOR });
      await expect(
        m.service.registrar(
          COLABORADOR,
          CORPO_VALIDO as RegistrarContatosColaboradorDto,
          ctx(ator("rh", EMPRESA_A)),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.prisma.contatoColaborador.create).not.toHaveBeenCalled();
      expect(m.prisma.contatoColaborador.update).not.toHaveBeenCalled();
      expect(m.prisma.contatoColaborador.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ select: { id: true } }),
      );
      expect(eventoFormal(m)).toEqual(
        expect.objectContaining({
          action: "pessoas_contato_atualizado",
          companyId: EMPRESA_A,
          result: "failure",
        }),
      );
      expect(eventoDeTratamento(m)).toEqual(
        expect.objectContaining({
          contatoId: CONTATO_ID,
          acao: "edicao",
          resultado: "bloqueado",
          campos: [],
        }),
      );
      semValores(trilha(m));
    });

    it("criação concorrente perdida na unicidade do banco vira 409", async () => {
      const m = montar({ vinculos: ATIVO_A, contato: null });
      m.prisma.contatoColaborador.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "5.22.0",
        }),
      );
      await expect(
        m.service.registrar(
          COLABORADOR,
          CORPO_VALIDO as RegistrarContatosColaboradorDto,
          ctx(ator("rh", EMPRESA_A)),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("falha na trilha desfaz a gravação (mesma transação)", async () => {
      const m = montar({
        vinculos: ATIVO_A,
        contato: null,
        falhaAuditoria: true,
      });
      await expect(
        m.service.registrar(
          COLABORADOR,
          CORPO_VALIDO as RegistrarContatosColaboradorDto,
          ctx(ator("rh", EMPRESA_A)),
        ),
      ).rejects.toThrow("trilha indisponível");
      expect(m.prisma.contatoColaboradorEvento.create).not.toHaveBeenCalled();
    });
  });

  describe("camposAlterados", () => {
    it("compara valores normalizados, campo a campo", () => {
      const atual = {
        emailPessoal: EMAIL,
        celular: CELULAR,
        telefone: TELEFONE,
      };
      expect(camposAlterados(atual, { ...atual })).toEqual([]);
      expect(
        camposAlterados(atual, {
          emailPessoal: "outra@example.test",
          celular: "11900000000",
          telefone: TELEFONE,
        }),
      ).toEqual(["email_pessoal", "celular"]);
    });
  });
});
