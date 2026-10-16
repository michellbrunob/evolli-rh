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
  return { dto, campos: erros.map((e) => e.property).sort() };
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

  it("e-mail acima de 254 caracteres é recusado", async () => {
    const emailPessoal = `${"a".repeat(64)}@${"b".repeat(186)}.test`;
    expect(emailPessoal.length).toBeGreaterThan(254);
    expect((await errosDe({ ...CORPO_VALIDO, emailPessoal })).campos).toEqual([
      "emailPessoal",
    ]);
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
// Serviço — empresa real, estados e auditoria sem valores
// ---------------------------------------------------------------------------

type Vinculo = {
  empresaId: string;
  situacao: "previsto" | "ativo" | "encerrado";
};

function montar(opcoes: {
  vinculos: Vinculo[];
  contato?: Record<string, unknown> | null;
  falhaAuditoria?: boolean;
}) {
  const contatoGravado =
    opcoes.contato === undefined
      ? null
      : opcoes.contato === null
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
        const m = montar({
          vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        });
        await expect(
          m.service.consultar(COLABORADOR, ctx(ator(role, EMPRESA_A))),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(m.prisma.vinculoFuncional.findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe("leitura", () => {
    it("colaborador existente sem registro: sem_registro, sem erro e sem auditoria de leitura", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        contato: null,
      });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).resolves.toEqual({
        colaboradorId: COLABORADOR,
        empresaId: EMPRESA_A,
        situacao: "sem_registro",
        contatos: null,
      });
      expect(m.auditService.record).not.toHaveBeenCalled();
      expect(m.prisma.contatoColaboradorEvento.create).not.toHaveBeenCalled();
    });

    it("registrado: devolve só os três campos e audita a leitura com a empresa real, sem valores", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        contato: { emailPessoal: EMAIL, celular: CELULAR, telefone: TELEFONE },
      });
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
      expect(m.auditService.record).toHaveBeenCalledTimes(1);
      expect(m.auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          resource: "contato_colaborador",
          resourceId: CONTATO_ID,
          companyId: EMPRESA_A,
          actorRole: "dp",
          result: "success",
          requestId: "req-t169",
        }),
        m.prisma,
      );
      expect(m.prisma.contatoColaboradorEvento.create).toHaveBeenCalledWith({
        data: {
          contatoId: CONTATO_ID,
          empresaId: EMPRESA_A,
          acao: "leitura",
          campos: ["email_pessoal", "celular", "telefone"],
          atorUserId: "ator-dp",
          requestId: "req-t169",
        },
      });
      semValores(trilha(m));
    });

    it("fail-safe: se a trilha falha, a leitura falha e nenhum valor é respondido", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        contato: { emailPessoal: EMAIL, celular: CELULAR, telefone: TELEFONE },
        falhaAuditoria: true,
      });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).rejects.toThrow("trilha indisponível");
    });

    it("desligado (todos os vínculos encerrados): bloqueado, sem valor e sem ler o registro", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "encerrado" }],
        contato: { emailPessoal: EMAIL, celular: CELULAR, telefone: TELEFONE },
      });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("rh", EMPRESA_A))),
      ).resolves.toEqual({
        colaboradorId: COLABORADOR,
        empresaId: EMPRESA_A,
        situacao: "bloqueado",
        contatos: null,
      });
      expect(m.prisma.contatoColaborador.findUnique).not.toHaveBeenCalled();
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
  });

  describe("master_tecnico", () => {
    it("sem empresa ativa: resolve e audita a empresa REAL do vínculo", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_B, situacao: "ativo" }],
        contato: { emailPessoal: EMAIL, celular: CELULAR, telefone: TELEFONE },
      });
      const resposta = await m.service.consultar(
        COLABORADOR,
        ctx(ator("master_tecnico", null)),
      );
      expect(resposta.empresaId).toBe(EMPRESA_B);
      expect(m.prisma.vinculoFuncional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { colaboradorId: COLABORADOR } }),
      );
      expect(m.auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "pessoas_contato_consultado",
          companyId: EMPRESA_B,
          actorRole: "master_tecnico",
        }),
        m.prisma,
      );
    });

    it("sem empresa ativa e colaborador em duas empresas: 409, nada lido", async () => {
      const m = montar({
        vinculos: [
          { empresaId: EMPRESA_A, situacao: "ativo" },
          { empresaId: EMPRESA_B, situacao: "ativo" },
        ],
      });
      await expect(
        m.service.consultar(COLABORADOR, ctx(ator("master_tecnico", null))),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.prisma.contatoColaborador.findUnique).not.toHaveBeenCalled();
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
      expect(m.auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "pessoas_contato_criado",
          companyId: EMPRESA_B,
          actorRole: "master_tecnico",
        }),
        m.prisma,
      );
    });
  });

  describe("gravação", () => {
    it("criação: empresa do VÍNCULO, autoria da sessão, evento com os três campos, sem valores na trilha", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        contato: null,
      });
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
      expect(m.prisma.contatoColaboradorEvento.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acao: "criacao",
          campos: ["email_pessoal", "celular", "telefone"],
          empresaId: EMPRESA_A,
        }),
      });
      semValores(trilha(m));
    });

    it("edição: o evento registra SÓ os campos que mudaram", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        contato: { emailPessoal: EMAIL, celular: CELULAR, telefone: TELEFONE },
      });
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
      expect(m.auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "pessoas_contato_atualizado" }),
        m.prisma,
      );
      expect(m.prisma.contatoColaboradorEvento.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ acao: "edicao", campos: ["telefone"] }),
      });
      semValores(trilha(m));
      expect(trilha(m)).not.toContain("1144445555");
    });

    it("sem alteração: nada gravado, nada auditado", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        contato: { emailPessoal: EMAIL, celular: CELULAR, telefone: TELEFONE },
      });
      const resposta = await m.service.registrar(
        COLABORADOR,
        CORPO_VALIDO as RegistrarContatosColaboradorDto,
        ctx(ator("rh", EMPRESA_A)),
      );
      expect(resposta.resultado).toBe("sem_alteracao");
      expect(m.prisma.contatoColaborador.update).not.toHaveBeenCalled();
      expect(m.auditService.record).not.toHaveBeenCalled();
    });

    it("desligado: edição recusada (409), nada gravado", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "encerrado" }],
        contato: null,
      });
      await expect(
        m.service.registrar(
          COLABORADOR,
          CORPO_VALIDO as RegistrarContatosColaboradorDto,
          ctx(ator("rh", EMPRESA_A)),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.prisma.$transaction).not.toHaveBeenCalled();
    });

    it("criação concorrente perdida na unicidade do banco vira 409", async () => {
      const m = montar({
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
        contato: null,
      });
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
        vinculos: [{ empresaId: EMPRESA_A, situacao: "ativo" }],
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
