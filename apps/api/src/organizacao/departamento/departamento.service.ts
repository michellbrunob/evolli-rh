import { Injectable } from "@nestjs/common";
import { Departamento, Prisma, StatusOrganizacional } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { OrganizacaoAuditoriaService } from "../organizacao-auditoria.service";
import {
  OrganizacaoAuditContext,
  ResultadoPaginado,
} from "../organizacao.types";
import {
  EscopoOrganizacional,
  filtroEmpresa,
  intersectarEmpresaSolicitada,
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
  resolverEmpresaPai,
} from "../validacao.util";
import {
  AtualizarNoOrganizacionalDto,
  CriarDepartamentoDto,
  ListarReferenciasQueryDto,
} from "../dto/organizacao.dto";
import { filtroDeBuscaPorCodigoOuNome } from "../busca-referencias.util";

/**
 * Departamento — nível organizacional principal, pertencente à **empresa** e
 * atravessando unidades (Baseline V1, item 1).
 *
 * É estrutura, **não** fronteira de autorização (item 2): nenhuma checagem de
 * acesso usa `departamentoId`, e ele não existe em `access_user` nem em
 * `audit_event`.
 */
@Injectable()
export class DepartamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(
    dto: CriarDepartamentoDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Departamento> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await resolverEmpresaPai(
      this.prisma,
      escopo,
      dto.empresaId,
    );
    if (!empresa) {
      return this.auditoria.negarAcesso(
        ctx,
        "departamento",
        null,
        dto.empresaId,
      );
    }
    if (!podeAcessar(ctx.actor, "departamento", "create", empresa.id)) {
      return this.auditoria.negarAcesso(ctx, "departamento", null, empresa.id);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.departamento.create({
          data: { empresaId: empresa.id, codigo: dto.codigo, nome: dto.nome },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_departamento_criado",
          "departamento",
          criado.id,
          criado.empresaId,
        );

        return criado;
      });
    } catch (error) {
      traduzirErroPrisma(error);
    }
  }

  async listar(
    query: ListarReferenciasQueryDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<ResultadoPaginado<Departamento>> {
    const escopo = resolverEscopo(ctx.actor);
    const filtro = intersectarEmpresaSolicitada(escopo, query.empresaId);

    if (filtro === null) {
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    const where: Prisma.DepartamentoWhereInput = {
      ...filtro,
      ...(query.status ? { status: query.status } : {}),
      // T196 — busca por código ou nome, antes da paginação.
      ...filtroDeBuscaPorCodigoOuNome(query.busca),
    };

    const [itens, total] = await Promise.all([
      this.prisma.departamento.findMany({
        where,
        orderBy: { codigo: "asc" },
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.departamento.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "departamento",
      null,
      filtro.empresaId ?? null,
    );

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(
    departamentoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Departamento> {
    const escopo = resolverEscopo(ctx.actor);
    const departamento = await this.carregarNoEscopo(
      departamentoId,
      ctx,
      escopo,
      "read",
    );

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "departamento",
      departamento.id,
      departamento.empresaId,
    );

    return departamento;
  }

  async atualizar(
    departamentoId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Departamento> {
    const escopo = resolverEscopo(ctx.actor);
    const departamento = await this.carregarNoEscopo(
      departamentoId,
      ctx,
      escopo,
      "alter",
    );

    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.departamento.update({
        where: { id: departamento.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_departamento_atualizado",
        "departamento",
        atualizado.id,
        atualizado.empresaId,
      );

      return atualizado;
    });
  }

  async inativar(
    departamentoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Departamento> {
    const escopo = resolverEscopo(ctx.actor);
    const departamento = await this.carregarNoEscopo(
      departamentoId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaAtivo(departamento.status);

    // Áreas e equipes ativas bloqueiam — sem cascata (R-INA-2).
    const status = StatusOrganizacional.ativo;
    const [areasAtivas, equipesAtivas] = await Promise.all([
      this.prisma.area.count({
        where: { departamentoId: departamento.id, status },
      }),
      this.prisma.equipe.count({
        where: { departamentoId: departamento.id, status },
      }),
    ]);
    assertSemFilhosAtivos(areasAtivas + equipesAtivas);
    // RI-O1 (Fatia 2): alocacao vigente de vinculo ativo tambem bloqueia.
    // Mesma regra da ADR 0006 d.7 aplicada a uma classe nova de dependente
    // — bloqueia, nunca cascateia. A recusa nao revela o dependente.
    assertSemFilhosAtivos(
      await contarDependentesFuncionaisAtivos(this.prisma, {
        departamentoId: departamento.id,
      }),
    );

    return this.prisma.$transaction(async (tx) => {
      const inativado = await tx.departamento.update({
        where: { id: departamento.id },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_departamento_inativado",
        "departamento",
        inativado.id,
        inativado.empresaId,
      );

      return inativado;
    });
  }

  /**
   * R-INA-5: reativação explícita e auditada, condicionada a a empresa pai
   * estar ativa (ver `assertPaisAtivosParaReativar`).
   */
  async reativar(
    departamentoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Departamento> {
    const escopo = resolverEscopo(ctx.actor);
    const departamento = await this.carregarNoEscopo(
      departamentoId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaInativo(departamento.status);

    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id: departamento.empresaId },
      select: { status: true },
    });
    assertPaisAtivosParaReativar([empresa.status]);

    return this.prisma.$transaction(async (tx) => {
      const reativado = await tx.departamento.update({
        where: { id: departamento.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_departamento_reativado",
        "departamento",
        reativado.id,
        reativado.empresaId,
      );

      return reativado;
    });
  }

  private async carregarNoEscopo(
    departamentoId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<Departamento> {
    const departamento = await this.prisma.departamento.findFirst({
      where: { id: departamentoId, ...filtroEmpresa(escopo) },
    });

    if (!departamento) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(
        ctx,
        "departamento",
        departamentoId,
        null,
      );
    }

    if (
      !podeAcessar(ctx.actor, "departamento", action, departamento.empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "departamento",
        departamento.id,
        departamento.empresaId,
      );
    }

    return departamento;
  }
}
