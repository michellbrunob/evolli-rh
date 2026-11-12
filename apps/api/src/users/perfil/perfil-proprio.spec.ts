/**
 * T208 — Configurações › Meu perfil: nome de exibição da própria conta.
 *
 * Unidade: normalização e validação do nome, o corpo aceito por
 * `PATCH /v1/users/me` (com o mesmo `ValidationPipe` global de `main.ts`),
 * a permissão da rota, o serviço (alvo, campos escritos, concorrência e
 * auditoria sem conteúdo) e a projeção da listagem administrativa, que não
 * ganha o nome. O banco real fica na suíte e2e `perfil-proprio`.
 */
import "reflect-metadata";
import { ConflictException, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessRole, AccessUser } from "@prisma/client";
import {
  NOME_EXIBICAO_MAXIMO,
  nomeExibicaoValido,
  normalizarNomeExibicao,
  tamanhoEmCaracteres,
} from "./nome-exibicao.util";
import { AtualizarPerfilProprioDto } from "../dto/atualizar-perfil-proprio.dto";
import { UsersController } from "../users.controller";
import { UsersService } from "../users.service";
import { PERMISSION_METADATA_KEY } from "../../auth/authorization/require-permission.decorator";
import { evaluatePermission } from "../../auth/authorization/rbac.evaluator";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { toSafeUser } from "../../auth/safe-user.util";
import { ACCESS_ROLES } from "../../auth/access-roles.const";

const PAPEIS = ACCESS_ROLES as readonly AccessRole[];

describe("T208 — normalização do nome de exibição", () => {
  it("apara as extremidades e junta espaços internos (tabulação, quebra, não separável)", () => {
    expect(normalizarNomeExibicao("  Ana   Lima  ")).toBe("Ana Lima");
    expect(normalizarNomeExibicao("Ana\t\nLima")).toBe("Ana Lima");
    expect(normalizarNomeExibicao("Ana Lima")).toBe("Ana Lima");
  });

  it("forma Unicode NFC: acento combinado vira um caractere só", () => {
    const decomposto = "José";
    expect(normalizarNomeExibicao(decomposto)).toBe("José");
    expect(
      tamanhoEmCaracteres(normalizarNomeExibicao(decomposto) as string),
    ).toBe(4);
  });

  it("vazio, só espaços, null e ausente viram null (limpa o nome)", () => {
    expect(normalizarNomeExibicao("")).toBeNull();
    expect(normalizarNomeExibicao("   \t ")).toBeNull();
    expect(normalizarNomeExibicao(null)).toBeNull();
    expect(normalizarNomeExibicao(undefined)).toBeNull();
  });

  it("tipo que não é texto passa sem mudança, para a validação recusar", () => {
    expect(normalizarNomeExibicao(42)).toBe(42);
    expect(normalizarNomeExibicao({ nome: "x" })).toEqual({ nome: "x" });
  });
});

describe("T208 — validação do nome de exibição", () => {
  it("null é válido (limpa o nome)", () => {
    expect(nomeExibicaoValido(null)).toBe(true);
  });

  it("de 2 a 80 caracteres, contados por caractere (um emoji vale um)", () => {
    expect(nomeExibicaoValido("Al")).toBe(true);
    expect(nomeExibicaoValido("A")).toBe(false);
    expect(nomeExibicaoValido("a".repeat(NOME_EXIBICAO_MAXIMO))).toBe(true);
    expect(nomeExibicaoValido("a".repeat(NOME_EXIBICAO_MAXIMO + 1))).toBe(
      false,
    );
    const comEmoji = "😀".repeat(NOME_EXIBICAO_MAXIMO - 1) + "a";
    expect(comEmoji.length).toBeGreaterThan(NOME_EXIBICAO_MAXIMO);
    expect(nomeExibicaoValido(comEmoji)).toBe(true);
  });

  it("texto real: ao menos uma letra; nada de controle nem formatação invisível", () => {
    expect(nomeExibicaoValido("12")).toBe(false);
    expect(nomeExibicaoValido("--")).toBe(false);
    expect(nomeExibicaoValido("Ana\u0000")).toBe(false);
    expect(nomeExibicaoValido("Ana​Lima")).toBe(false);
    expect(nomeExibicaoValido("Ana‮Lima")).toBe(false);
    expect(nomeExibicaoValido("Equipe 2")).toBe(true);
  });

  it("recusa texto com espaço nas extremidades (só passa normalizado) e tipo errado", () => {
    expect(nomeExibicaoValido(" Ana")).toBe(false);
    expect(nomeExibicaoValido(42)).toBe(false);
    expect(nomeExibicaoValido(undefined)).toBe(false);
  });
});

/** O mesmo `ValidationPipe` global de `main.ts`. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

function corpo(valor: unknown) {
  return pipe.transform(valor, {
    type: "body",
    metatype: AtualizarPerfilProprioDto,
  }) as Promise<AtualizarPerfilProprioDto>;
}

describe("T208 — corpo de PATCH /v1/users/me", () => {
  const LIDO = "2026-11-12T10:00:00.000Z";

  it("aceita o nome normalizado e a versão lida", async () => {
    const dto = await corpo({
      nomeExibicao: "  Ana   Lima ",
      perfilAtualizadoEmLido: LIDO,
    });
    expect(dto.nomeExibicao).toBe("Ana Lima");
    expect(dto.perfilAtualizadoEmLido).toBe(LIDO);
  });

  it("vazio limpa o nome; versão null é o perfil nunca salvo", async () => {
    const dto = await corpo({
      nomeExibicao: "   ",
      perfilAtualizadoEmLido: null,
    });
    expect(dto.nomeExibicao).toBeNull();
    expect(dto.perfilAtualizadoEmLido).toBeNull();
  });

  it.each([
    ["curto", "A"],
    ["longo", "a".repeat(NOME_EXIBICAO_MAXIMO + 1)],
    ["sem letra", "123"],
    ["número", 123],
  ])("recusa nome %s (400)", async (_caso, nomeExibicao) => {
    await expect(
      corpo({ nomeExibicao, perfilAtualizadoEmLido: null }),
    ).rejects.toThrow();
  });

  it("recusa corpo sem o nome ou sem a versão lida", async () => {
    await expect(corpo({ perfilAtualizadoEmLido: null })).rejects.toThrow();
    await expect(corpo({ nomeExibicao: "Ana" })).rejects.toThrow();
    await expect(
      corpo({ nomeExibicao: "Ana", perfilAtualizadoEmLido: "ontem" }),
    ).rejects.toThrow();
  });

  it.each([
    "id",
    "userId",
    "email",
    "role",
    "companyId",
    "unitId",
    "teamId",
    "status",
    "perfilAtualizadoEm",
  ])("recusa campo proibido no corpo: %s (400, não ignora)", async (campo) => {
    await expect(
      corpo({
        nomeExibicao: "Ana",
        perfilAtualizadoEmLido: null,
        [campo]: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("T208 — permissão de PATCH /v1/users/me", () => {
  it("exige own_account/manage, com CSRF e o AuthorizationGuard", () => {
    const handler = UsersController.prototype.atualizarMe;
    expect(Reflect.getMetadata(PERMISSION_METADATA_KEY, handler)).toEqual({
      resource: "own_account",
      action: "manage",
    });
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    expect(guards).toEqual([CsrfGuard, AuthorizationGuard]);
  });

  it.each(PAPEIS)(
    "%s: own_account/manage permite a própria conta e nega a de outra",
    (role) => {
      const sujeito = { userId: "conta-a", role, companyId: "empresa-x" };
      expect(
        evaluatePermission(sujeito, {
          resource: "own_account",
          action: "manage",
        }),
      ).toBe(true);
      expect(
        evaluatePermission(sujeito, {
          resource: "own_account",
          action: "manage",
          targetUserId: "conta-b",
        }),
      ).toBe(false);
    },
  );
});

function ator(parcial: Partial<AccessUser> = {}): AccessUser {
  return {
    id: "conta-a",
    email: "pessoa.a@example.test",
    passwordHash: "hash",
    role: "colaborador",
    companyId: "empresa-x",
    unitId: null,
    teamId: null,
    status: "active",
    nomeExibicao: null,
    perfilAtualizadoEm: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...parcial,
  } as AccessUser;
}

function montarServico(contagem: number) {
  const tx = {
    accessUser: {
      updateMany: jest.fn().mockResolvedValue({ count: contagem }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const servico = new UsersService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    audit as never,
  );
  return { servico, tx, audit };
}

const METADADOS = { ip: "203.0.113.9", userAgent: "teste", requestId: "req-1" };

describe("T208 — serviço: gravar o próprio perfil", () => {
  it("escreve só o nome e a data do perfil, na conta da sessão e na versão lida", async () => {
    const { servico, tx } = montarServico(1);
    const lido = new Date("2026-11-12T10:00:00.000Z");
    const resultado = await servico.atualizarPerfilProprio(
      { nomeExibicao: "Ana Lima", perfilAtualizadoEmLido: lido },
      { actor: ator(), metadata: METADADOS },
    );
    const chamada = tx.accessUser.updateMany.mock.calls[0][0];
    expect(chamada.where).toEqual({ id: "conta-a", perfilAtualizadoEm: lido });
    expect(Object.keys(chamada.data).sort()).toEqual([
      "nomeExibicao",
      "perfilAtualizadoEm",
    ]);
    expect(chamada.data.nomeExibicao).toBe("Ana Lima");
    expect(chamada.data.perfilAtualizadoEm).toBeInstanceOf(Date);
    expect(resultado).toEqual({
      nomeExibicao: "Ana Lima",
      perfilAtualizadoEm: chamada.data.perfilAtualizadoEm,
    });
  });

  it("perfil nunca salvo: a condição é a versão null", async () => {
    const { servico, tx } = montarServico(1);
    await servico.atualizarPerfilProprio(
      { nomeExibicao: null, perfilAtualizadoEmLido: null },
      { actor: ator(), metadata: METADADOS },
    );
    expect(tx.accessUser.updateMany.mock.calls[0][0].where).toEqual({
      id: "conta-a",
      perfilAtualizadoEm: null,
    });
  });

  it("versão desatualizada (nada gravado): 409 e nenhuma auditoria de sucesso", async () => {
    const { servico, audit } = montarServico(0);
    await expect(
      servico.atualizarPerfilProprio(
        { nomeExibicao: "Ana", perfilAtualizadoEmLido: null },
        { actor: ator(), metadata: METADADOS },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("auditoria própria, na transação, sem o conteúdo do nome", async () => {
    const { servico, tx, audit } = montarServico(1);
    await servico.atualizarPerfilProprio(
      { nomeExibicao: "Nome Muito Particular", perfilAtualizadoEmLido: null },
      { actor: ator({ role: "gestor" }), metadata: METADADOS },
    );
    const [evento, transacao] = audit.record.mock.calls[0];
    expect(transacao).toBe(tx);
    expect(evento).toMatchObject({
      action: "conta_perfil_atualizado",
      resource: "access_user",
      resourceId: "conta-a",
      actorUserId: "conta-a",
      actorRole: "gestor",
      companyId: "empresa-x",
      result: "success",
    });
    expect(JSON.stringify(evento)).not.toContain("Particular");
  });
});

describe("T208 — a listagem de Contas de acesso não ganha o perfil", () => {
  it("toSafeUser não carrega nome de exibição nem data do perfil", () => {
    const seguro = toSafeUser(
      ator({
        nomeExibicao: "Ana Lima",
        perfilAtualizadoEm: new Date("2026-11-12T10:00:00.000Z"),
      }),
    );
    expect(seguro).not.toHaveProperty("nomeExibicao");
    expect(seguro).not.toHaveProperty("perfilAtualizadoEm");
    expect(JSON.stringify(seguro)).not.toContain("Ana Lima");
  });
});
