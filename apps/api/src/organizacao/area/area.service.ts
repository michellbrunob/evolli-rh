import { Injectable } from "@nestjs/common";
import { Area, Prisma, StatusOrganizacional } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { OrganizacaoAuditoriaService } from "../organizacao-auditoria.service";
import {
  OrganizacaoAuditContext,
  ResultadoPaginado,
} from "../organizacao.types";
import {
  EscopoOrganizacional,
  filtroEmpresaViaDepartamento,
  resolverEscopo,
} from "../escopo.util";
import { podeAcessar } from "../autorizacao.util";
import { traduzirErroPrisma } from "../prisma-erro.util";
import {
  assertAindaAtivo,
  assertAindaInativo,
  assertPaisAtivosParaReativar,
  assertSemFilhosAtivos,
  contarDependentesFuncionaisAtivos,
  deslocamento,
  resolverDepartamentoPai,
} from "../validacao.util";
import {
  AtualizarNoOrganizacionalDto,
  CriarAreaDto,
  ListarAreasQueryDto,
} from "../dto/organizacao.dto";

/** Area carregada junto do departamento pai — a empresa vem sempre de lá. */
type AreaComDepartamento = Area & { departamento: { empresaId: string } };

/**
 * Area — subdivisão **opcional** de Departamento (Baseline V1, item 1).
 *
 * Não possui `empresaId` próprio de propósito (spec §3.3): a empresa é sempre
 * a do departamento pai, o que torna divergência de empresa impossível por
 * construção. Todo filtro de escopo atravessa a relação.
 *
 * Como Departamento, é estrutura e **não** fronteira de autorização (item 2).
 */
@Injectable()
export class AreaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(dto: CriarAreaDto, ctx: OrganizacaoAuditContext): Promise<Area> {
    const escopo = resolverEscopo(ctx.actor);
    const departamento = await resolverDepartamentoPai(
      this.prisma,
      escopo,
      dto.departamentoId,
    );
    if (!departamento) {
      return this.auditoria.negarAcesso(ctx, "area", null, null);
    }
    if (!podeAcessar(ctx.actor, "area", "create", departamento.empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        "area",
        null,
        departamento.empresaId,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.area.create({
          data: {
            departamentoId: departamento.id,
            codigo: dto.codigo,
            nome: dto.nome,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_area_criada",
          "area",
          criada.id,
          departamento.empresaId,
        );

        return criada;
      });
    } catch (error) {
      traduzirErroPrisma(error);
    }
  }

  async listar(
    query: ListarAreasQueryDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<ResultadoPaginado<Area>> {
    const escopo = resolverEscopo(ctx.actor);

    const where: Prisma.AreaWhereInput = {
      ...filtroEmpresaViaDepartamento(escopo),
      ...(query.departamentoId ? { departamentoId: query.departamentoId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.area.findMany({
        where,
        orderBy: { codigo: "asc" },
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.area.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "area",
      null,
      null,
    );

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(areaId: string, ctx: OrganizacaoAuditContext): Promise<Area> {
    const escopo = resolverEscopo(ctx.actor);
    const area = await this.carregarNoEscopo(areaId, ctx, escopo, "read");

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "area",
      area.id,
      area.departamento.empresaId,
    );

    return this.semDepartamento(area);
  }

  async atualizar(
    areaId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Area> {
    const escopo = resolverEscopo(ctx.actor);
    const area = await this.carregarNoEscopo(areaId, ctx, escopo, "alter");

    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.area.update({
        where: { id: area.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_area_atualizada",
        "area",
        atualizada.id,
        area.departamento.empresaId,
      );

      return atualizada;
    });
  }

  /**
   * Area é folha nesta fatia — não tem filho organizacional que possa
   * bloquear. A checagem de R-INA-2 é, portanto, vazia por construção, não
   * por omissão.
   */
  async inativar(areaId: string, ctx: OrganizacaoAuditContext): Promise<Area> {
    const escopo = resolverEscopo(ctx.actor);
    const area = await this.carregarNoEscopo(areaId, ctx, escopo, "manage");
    assertAindaAtivo(area.status);

    // RI-O1 (Fatia 2): alocacao vigente de vinculo ativo tambem bloqueia.
    // Mesma regra da ADR 0006 d.7 aplicada a uma classe nova de dependente
    // — bloqueia, nunca cascateia. A recusa nao revela o dependente.
    assertSemFilhosAtivos(
      await contarDependentesFuncionaisAtivos(this.prisma, {
        areaId: area.id,
      }),
    );

    return this.prisma.$transaction(async (tx) => {
      const inativada = await tx.area.update({
        where: { id: area.id },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_area_inativada",
        "area",
        inativada.id,
        area.departamento.empresaId,
      );

      return inativada;
    });
  }

  /**
   * R-INA-5: reativação explícita e auditada, condicionada ao **departamento
   * pai** estar ativo. Não é preciso checar a empresa: um departamento só
   * está ativo se a empresa dele também estiver, por invariante da
   * inativação (ver `assertPaisAtivosParaReativar`).
   */
  async reativar(areaId: string, ctx: OrganizacaoAuditContext): Promise<Area> {
    const escopo = resolverEscopo(ctx.actor);
    const area = await this.carregarNoEscopo(areaId, ctx, escopo, "manage");
    assertAindaInativo(area.status);

    const departamento = await this.prisma.departamento.findUniqueOrThrow({
      where: { id: area.departamentoId },
      select: { status: true },
    });
    assertPaisAtivosParaReativar([departamento.status]);

    return this.prisma.$transaction(async (tx) => {
      const reativada = await tx.area.update({
        where: { id: area.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_area_reativada",
        "area",
        reativada.id,
        area.departamento.empresaId,
      );

      return reativada;
    });
  }

  private async carregarNoEscopo(
    areaId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<AreaComDepartamento> {
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, ...filtroEmpresaViaDepartamento(escopo) },
      include: { departamento: { select: { empresaId: true } } },
    });

    if (!area) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(ctx, "area", areaId, null);
    }

    if (!podeAcessar(ctx.actor, "area", action, area.departamento.empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        "area",
        area.id,
        area.departamento.empresaId,
      );
    }

    return area;
  }

  /**
   * Remove a relação carregada só para resolver escopo, mantendo a saída
   * estável e igual à dos demais nós organizacionais.
   */
  private semDepartamento(area: AreaComDepartamento): Area {
    return {
      id: area.id,
      departamentoId: area.departamentoId,
      codigo: area.codigo,
      nome: area.nome,
      status: area.status,
      criadoEm: area.criadoEm,
      atualizadoEm: area.atualizadoEm,
    };
  }
}
