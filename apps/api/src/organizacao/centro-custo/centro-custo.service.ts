import { Injectable } from "@nestjs/common";
import { CentroCusto, Prisma, StatusOrganizacional } from "@prisma/client";
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
  CriarCentroCustoDto,
  ListarReferenciasQueryDto,
} from "../dto/organizacao.dto";
import { filtroDeBuscaPorCodigoOuNome } from "../busca-referencias.util";

/**
 * CentroCusto — cadastrado **por empresa**, sem associação a unidade,
 * departamento, área ou equipe nesta fatia (Baseline V1, item 6).
 *
 * Rótulo organizacional apenas: nenhum valor monetário, rateio, plano de
 * contas ou integração com sistema financeiro externo (spec §1/§3.5).
 */
@Injectable()
export class CentroCustoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(
    dto: CriarCentroCustoDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<CentroCusto> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await resolverEmpresaPai(
      this.prisma,
      escopo,
      dto.empresaId,
    );
    if (!empresa) {
      return this.auditoria.negarAcesso(
        ctx,
        "centro_custo",
        null,
        dto.empresaId,
      );
    }
    if (!podeAcessar(ctx.actor, "centro_custo", "create", empresa.id)) {
      return this.auditoria.negarAcesso(ctx, "centro_custo", null, empresa.id);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.centroCusto.create({
          data: { empresaId: empresa.id, codigo: dto.codigo, nome: dto.nome },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_centro_custo_criado",
          "centro_custo",
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
  ): Promise<ResultadoPaginado<CentroCusto>> {
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

    const where: Prisma.CentroCustoWhereInput = {
      ...filtro,
      ...(query.status ? { status: query.status } : {}),
      // T196 — busca por código ou nome, antes da paginação.
      ...filtroDeBuscaPorCodigoOuNome(query.busca),
    };

    const [itens, total] = await Promise.all([
      this.prisma.centroCusto.findMany({
        where,
        orderBy: { codigo: "asc" },
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.centroCusto.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "centro_custo",
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
    centroCustoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<CentroCusto> {
    const escopo = resolverEscopo(ctx.actor);
    const centroCusto = await this.carregarNoEscopo(
      centroCustoId,
      ctx,
      escopo,
      "read",
    );

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "centro_custo",
      centroCusto.id,
      centroCusto.empresaId,
    );

    return centroCusto;
  }

  async atualizar(
    centroCustoId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<CentroCusto> {
    const escopo = resolverEscopo(ctx.actor);
    const centroCusto = await this.carregarNoEscopo(
      centroCustoId,
      ctx,
      escopo,
      "alter",
    );

    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.centroCusto.update({
        where: { id: centroCusto.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_centro_custo_atualizado",
        "centro_custo",
        atualizado.id,
        atualizado.empresaId,
      );

      return atualizado;
    });
  }

  /** Sem associação estrutural nesta fatia — nada a bloquear na inativação. */
  async inativar(
    centroCustoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<CentroCusto> {
    const escopo = resolverEscopo(ctx.actor);
    const centroCusto = await this.carregarNoEscopo(
      centroCustoId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaAtivo(centroCusto.status);

    // RI-O1 (Fatia 2): alocacao vigente de vinculo ativo tambem bloqueia.
    // Mesma regra da ADR 0006 d.7 aplicada a uma classe nova de dependente
    // — bloqueia, nunca cascateia. A recusa nao revela o dependente.
    assertSemFilhosAtivos(
      await contarDependentesFuncionaisAtivos(this.prisma, {
        centroCustoId: centroCusto.id,
      }),
    );

    return this.prisma.$transaction(async (tx) => {
      const inativado = await tx.centroCusto.update({
        where: { id: centroCusto.id },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_centro_custo_inativado",
        "centro_custo",
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
    centroCustoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<CentroCusto> {
    const escopo = resolverEscopo(ctx.actor);
    const centroCusto = await this.carregarNoEscopo(
      centroCustoId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaInativo(centroCusto.status);

    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id: centroCusto.empresaId },
      select: { status: true },
    });
    assertPaisAtivosParaReativar([empresa.status]);

    return this.prisma.$transaction(async (tx) => {
      const reativado = await tx.centroCusto.update({
        where: { id: centroCusto.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_centro_custo_reativado",
        "centro_custo",
        reativado.id,
        reativado.empresaId,
      );

      return reativado;
    });
  }

  private async carregarNoEscopo(
    centroCustoId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<CentroCusto> {
    const centroCusto = await this.prisma.centroCusto.findFirst({
      where: { id: centroCustoId, ...filtroEmpresa(escopo) },
    });

    if (!centroCusto) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(
        ctx,
        "centro_custo",
        centroCustoId,
        null,
      );
    }

    if (
      !podeAcessar(ctx.actor, "centro_custo", action, centroCusto.empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "centro_custo",
        centroCusto.id,
        centroCusto.empresaId,
      );
    }

    return centroCusto;
  }
}
