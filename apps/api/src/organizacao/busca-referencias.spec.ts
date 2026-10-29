import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AccessRole, AccessUser } from "@prisma/client";
import { filtroDeBuscaPorCodigoOuNome } from "./busca-referencias.util";
import { ListarReferenciasQueryDto } from "./dto/organizacao.dto";
import { DepartamentoService } from "./departamento/departamento.service";
import { CargoService } from "./cargo/cargo.service";
import { UnidadeOrganizacionalService } from "./unidade-organizacional/unidade-organizacional.service";
import { CentroCustoService } from "./centro-custo/centro-custo.service";
import { OrganizacaoAuditoriaService } from "./organizacao-auditoria.service";
import { PrismaService } from "../database/prisma.service";

/**
 * T196 — busca por código ou nome nas referências da lotação (Departamento,
 * Cargo, Unidade e Centro de custo). Prisma é dublê: aqui se verifica a
 * DECISÃO de cada service (o `where` antes da paginação, igual no `count`) e
 * a validação do termo; o comportamento real do banco (sem diferenciar
 * maiúsculas, isolamento, mais de 100 itens) é provado no E2E.
 */

const TERMO = "termo de busca";

function ator(overrides: Partial<AccessUser> = {}): AccessUser {
  return {
    id: "user-1",
    email: "rh@example.test",
    passwordHash: "hash",
    role: "rh" as AccessRole,
    companyId: "empresa-a",
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AccessUser;
}

function contexto(actor: AccessUser = ator()) {
  return { actor, metadata: { ip: null, userAgent: null, requestId: "req-1" } };
}

async function validarQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(ListarReferenciasQueryDto, query);
  const erros = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, erros };
}

describe("T196 — filtroDeBuscaPorCodigoOuNome", () => {
  it("sem termo, nenhuma condição: a listagem é a de sempre", () => {
    expect(filtroDeBuscaPorCodigoOuNome(undefined)).toEqual({});
    expect(filtroDeBuscaPorCodigoOuNome("")).toEqual({});
  });

  it("com termo, procura em código OU nome, sem diferenciar maiúsculas", () => {
    expect(filtroDeBuscaPorCodigoOuNome("Adm")).toEqual({
      OR: [
        { codigo: { contains: "Adm", mode: "insensitive" } },
        { nome: { contains: "Adm", mode: "insensitive" } },
      ],
    });
  });

  it("curingas valem literalmente (escapados)", () => {
    const { OR } = filtroDeBuscaPorCodigoOuNome("50%_a\\b");
    expect(OR?.[0]?.codigo?.contains).toBe("50\\%\\_a\\\\b");
    expect(OR?.[1]?.nome?.contains).toBe("50\\%\\_a\\\\b");
  });
});

describe("T196 — ListarReferenciasQueryDto", () => {
  it("apara e colapsa espaços; vazia ou só espaços vale como ausente", async () => {
    expect((await validarQuery({ busca: "  a   b  " })).dto.busca).toBe("a b");
    for (const busca of ["", "   "]) {
      const { dto, erros } = await validarQuery({ busca });
      expect(erros).toEqual([]);
      expect(dto.busca).toBeUndefined();
    }
  });

  it("aceita até 160 caracteres e recusa acima disso, sem repetir o termo no erro", async () => {
    expect((await validarQuery({ busca: "a".repeat(160) })).erros).toEqual([]);
    const termo = `${"x".repeat(150)}LONGO-DEMAIS`;
    const { erros } = await validarQuery({ busca: termo });
    expect(erros.map((e) => e.property)).toEqual(["busca"]);
    expect(JSON.stringify(erros[0]!.constraints)).not.toContain("LONGO-DEMAIS");
  });

  it("recusa caractere de controle e tipo que não é texto, sem repetir o termo", async () => {
    const controle = await validarQuery({ busca: "ab\u0007CONTROLE" });
    expect(controle.erros.map((e) => e.property)).toEqual(["busca"]);
    expect(JSON.stringify(controle.erros[0]!.constraints)).not.toContain(
      "CONTROLE",
    );
    const lista = await validarQuery({ busca: ["a", "b"] });
    expect(lista.erros.map((e) => e.property)).toEqual(["busca"]);
  });

  it("convive com página, tamanho, situação e empresa, e o tamanho continua limitado a 100", async () => {
    const { dto, erros } = await validarQuery({
      busca: "a",
      pagina: "2",
      tamanhoPagina: "20",
      status: "ativo",
    });
    expect(erros).toEqual([]);
    expect(dto).toMatchObject({ busca: "a", pagina: 2, tamanhoPagina: 20 });
    expect(
      (await validarQuery({ busca: "a", tamanhoPagina: "101" })).erros.map(
        (e) => e.property,
      ),
    ).toEqual(["tamanhoPagina"]);
  });
});

type Delegado = { findMany: jest.Mock; count: jest.Mock };

const ROTAS = [
  {
    nome: "Departamento",
    delegado: "departamento",
    recurso: "departamento",
    criar: (p: PrismaService, a: OrganizacaoAuditoriaService) =>
      new DepartamentoService(p, a),
  },
  {
    nome: "Cargo",
    delegado: "cargo",
    recurso: "cargo",
    criar: (p: PrismaService, a: OrganizacaoAuditoriaService) =>
      new CargoService(p, a),
  },
  {
    nome: "Unidade",
    delegado: "unidadeOrganizacional",
    recurso: "unidade_organizacional",
    criar: (p: PrismaService, a: OrganizacaoAuditoriaService) =>
      new UnidadeOrganizacionalService(p, a),
  },
  {
    nome: "Centro de custo",
    delegado: "centroCusto",
    recurso: "centro_custo",
    criar: (p: PrismaService, a: OrganizacaoAuditoriaService) =>
      new CentroCustoService(p, a),
  },
] as const;

describe.each(ROTAS)("T196 — listar $nome com busca", (rota) => {
  function montar() {
    const delegado: Delegado = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const prisma = { [rota.delegado]: delegado } as unknown as PrismaService;
    const auditoria = {
      registrarConsultaAmpla: jest.fn().mockResolvedValue(undefined),
    } as unknown as OrganizacaoAuditoriaService & {
      registrarConsultaAmpla: jest.Mock;
    };
    return { service: rota.criar(prisma, auditoria), delegado, auditoria };
  }

  it("o termo entra no where junto do escopo e da situação, e o count usa o mesmo where", async () => {
    const { service, delegado } = montar();
    await service.listar(
      { pagina: 2, tamanhoPagina: 20, status: "ativo", busca: TERMO },
      contexto(),
    );
    const where = {
      empresaId: "empresa-a",
      status: "ativo",
      OR: [
        { codigo: { contains: TERMO, mode: "insensitive" } },
        { nome: { contains: TERMO, mode: "insensitive" } },
      ],
    };
    expect(delegado.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { codigo: "asc" },
      skip: 20,
      take: 20,
    });
    expect(delegado.count).toHaveBeenCalledWith({ where });
  });

  it("sem termo, o where é o de sempre", async () => {
    const { service, delegado } = montar();
    await service.listar({ pagina: 1, tamanhoPagina: 20 }, contexto());
    expect(delegado.findMany.mock.calls[0]![0].where).toEqual({
      empresaId: "empresa-a",
    });
  });

  it("outra empresa pedida por perfil escopado: página vazia, nada consultado", async () => {
    const { service, delegado } = montar();
    const r = await service.listar(
      { pagina: 1, tamanhoPagina: 20, empresaId: "empresa-b", busca: TERMO },
      contexto(),
    );
    expect(r).toEqual({ itens: [], pagina: 1, tamanhoPagina: 20, total: 0 });
    expect(delegado.findMany).not.toHaveBeenCalled();
  });

  it("consulta global do master é auditada como sempre, e o termo não vai para a auditoria", async () => {
    const { service, auditoria } = montar();
    await service.listar(
      { pagina: 1, tamanhoPagina: 20, busca: TERMO },
      contexto(ator({ role: "master_tecnico" as AccessRole, companyId: null })),
    );
    expect(auditoria.registrarConsultaAmpla).toHaveBeenCalledTimes(1);
    const [escopo, , recurso, idRecurso, empresa] =
      auditoria.registrarConsultaAmpla.mock.calls[0]!;
    expect(escopo).toEqual({ global: true });
    expect([recurso, idRecurso, empresa]).toEqual([rota.recurso, null, null]);
    expect(
      JSON.stringify(auditoria.registrarConsultaAmpla.mock.calls),
    ).not.toContain(TERMO);
  });
});
