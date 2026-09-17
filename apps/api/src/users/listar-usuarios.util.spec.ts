import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import {
  codificarCursorListagemUsuarios,
  decodificarCursorListagemUsuarios,
  empresaParaAuditoriaListagem,
  filtroEmpresaListagemUsuarios,
  resolverEscopoListagemUsuarios,
} from "./listar-usuarios.util";

function actor(overrides: Partial<AccessUser> = {}): AccessUser {
  return {
    id: "user-1",
    email: "ator@example.test",
    passwordHash: "hash",
    role: "colaborador",
    companyId: "empresa-a",
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AccessUser;
}

describe("resolverEscopoListagemUsuarios", () => {
  it("master_tecnico: global, com companyId de filtro quando enviado", () => {
    const escopo = resolverEscopoListagemUsuarios(
      actor({ role: "master_tecnico", companyId: null }),
      "empresa-x",
    );
    expect(escopo).toEqual({ global: true, companyId: "empresa-x" });
  });

  it("master_tecnico: global, sem filtro quando companyId não é enviado", () => {
    const escopo = resolverEscopoListagemUsuarios(
      actor({ role: "master_tecnico", companyId: null }),
      undefined,
    );
    expect(escopo).toEqual({ global: true, companyId: undefined });
  });

  it("rh: empresa SEMPRE da sessão — companyId de requisição é ignorado", () => {
    const escopo = resolverEscopoListagemUsuarios(
      actor({ role: "rh", companyId: "empresa-a" }),
      "empresa-b-tentativa-de-outra-empresa",
    );
    expect(escopo).toEqual({ global: false, companyId: "empresa-a" });
  });

  it("dp: mesmo comportamento de rh", () => {
    const escopo = resolverEscopoListagemUsuarios(
      actor({ role: "dp", companyId: "empresa-a" }),
      "empresa-b",
    );
    expect(escopo).toEqual({ global: false, companyId: "empresa-a" });
  });

  it("rh/dp sem empresa própria: nega (defesa em profundidade)", () => {
    expect(() =>
      resolverEscopoListagemUsuarios(
        actor({ role: "rh", companyId: null }),
        undefined,
      ),
    ).toThrow(ForbiddenException);
  });

  it("papel sem capacidade (ex.: colaborador): nega (defesa em profundidade)", () => {
    expect(() =>
      resolverEscopoListagemUsuarios(actor({ role: "colaborador" }), undefined),
    ).toThrow(ForbiddenException);
  });
});

describe("filtroEmpresaListagemUsuarios / empresaParaAuditoriaListagem", () => {
  it("global sem companyId: sem filtro; auditoria registra null", () => {
    const escopo = { global: true, companyId: undefined } as const;
    expect(filtroEmpresaListagemUsuarios(escopo)).toEqual({});
    expect(empresaParaAuditoriaListagem(escopo)).toBeNull();
  });

  it("global com companyId: filtra por ela; auditoria registra a mesma empresa", () => {
    const escopo = { global: true, companyId: "empresa-x" } as const;
    expect(filtroEmpresaListagemUsuarios(escopo)).toEqual({
      companyId: "empresa-x",
    });
    expect(empresaParaAuditoriaListagem(escopo)).toBe("empresa-x");
  });

  it("não-global: sempre filtra e audita pela empresa do escopo", () => {
    const escopo = { global: false, companyId: "empresa-a" } as const;
    expect(filtroEmpresaListagemUsuarios(escopo)).toEqual({
      companyId: "empresa-a",
    });
    expect(empresaParaAuditoriaListagem(escopo)).toBe("empresa-a");
  });
});

describe("cursor de listagem de usuários", () => {
  it("codifica e decodifica preservando createdAt e id", () => {
    const original = {
      createdAt: new Date("2026-01-15T10:30:00.000Z"),
      id: "11111111-1111-1111-1111-111111111111",
    };

    const cursor = codificarCursorListagemUsuarios(original);
    const decodificado = decodificarCursorListagemUsuarios(cursor);

    expect(decodificado.id).toBe(original.id);
    expect(decodificado.createdAt.toISOString()).toBe(
      original.createdAt.toISOString(),
    );
  });

  it("cursor não é o payload em claro (opaco)", () => {
    const cursor = codificarCursorListagemUsuarios({
      createdAt: new Date("2026-01-15T10:30:00.000Z"),
      id: "id-qualquer",
    });
    expect(cursor).not.toMatch(/2026-01-15/);
    expect(cursor).not.toMatch(/id-qualquer/);
  });

  it("cursor com base64 inválido: 400 genérico", () => {
    expect(() =>
      decodificarCursorListagemUsuarios("###não-é-base64url###"),
    ).toThrow(BadRequestException);
  });

  it("cursor sem separador: 400 genérico", () => {
    const semSeparador = Buffer.from("sem-separador-aqui", "utf8").toString(
      "base64url",
    );
    expect(() => decodificarCursorListagemUsuarios(semSeparador)).toThrow(
      BadRequestException,
    );
  });

  it("cursor com data não parseável: 400 genérico", () => {
    const dataInvalida = Buffer.from("data-invalida|algum-id", "utf8").toString(
      "base64url",
    );
    expect(() => decodificarCursorListagemUsuarios(dataInvalida)).toThrow(
      BadRequestException,
    );
  });

  it("cursor com id vazio: 400 genérico", () => {
    const idVazio = Buffer.from("2026-01-15T10:30:00.000Z|", "utf8").toString(
      "base64url",
    );
    expect(() => decodificarCursorListagemUsuarios(idVazio)).toThrow(
      BadRequestException,
    );
  });
});
