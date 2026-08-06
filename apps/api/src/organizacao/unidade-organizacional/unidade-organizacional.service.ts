import { Injectable } from "@nestjs/common";
import {
  Prisma,
  StatusOrganizacional,
  UnidadeOrganizacional,
} from "@prisma/client";
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
  deslocamento,
  resolverEmpresaPai,
} from "../validacao.util";
import {
  AtualizarNoOrganizacionalDto,
  CriarUnidadeOrganizacionalDto,
  ListarPorEmpresaQueryDto,
} from "../dto/organizacao.dto";

/** UnidadeOrganizacional — estabelecimento/filial/local de uma empresa (§3.2). */
@Injectable()
export class UnidadeOrganizacionalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(
    dto: CriarUnidadeOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<UnidadeOrganizacional> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await resolverEmpresaPai(
      this.prisma,
      escopo,
      dto.empresaId,
    );
    if (!empresa) {
      return this.auditoria.negarAcesso(
        ctx,
        "unidade_organizacional",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessar(ctx.actor, "unidade_organizacional", "create", empresa.id)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "unidade_organizacional",
        null,
        empresa.id,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.unidadeOrganizacional.create({
          data: { empresaId: empresa.id, codigo: dto.codigo, nome: dto.nome },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_unidade_organizacional_criada",
          "unidade_organizacional",
          criada.id,
          criada.empresaId,
        );

        return criada;
      });
    } catch (error) {
      traduzirErroPrisma(error);
    }
  }

  async listar(
    query: ListarPorEmpresaQueryDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<ResultadoPaginado<UnidadeOrganizacional>> {
    const escopo = resolverEscopo(ctx.actor);
    const filtro = intersectarEmpresaSolicitada(escopo, query.empresaId);

    if (filtro === null) {
      // Empresa pedida fora do escopo: página vazia, nunca erro — erro
      // confirmaria a existência da empresa alheia.
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    const where: Prisma.UnidadeOrganizacionalWhereInput = {
      ...filtro,
      ...(query.status ? { status: query.status } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.unidadeOrganizacional.findMany({
        where,
        orderBy: { codigo: "asc" },
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.unidadeOrganizacional.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "unidade_organizacional",
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
    unidadeId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<UnidadeOrganizacional> {
    const escopo = resolverEscopo(ctx.actor);
    const unidade = await this.carregarNoEscopo(unidadeId, ctx, escopo, "read");

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "unidade_organizacional",
      unidade.id,
      unidade.empresaId,
    );

    return unidade;
  }

  async atualizar(
    unidadeId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<UnidadeOrganizacional> {
    const escopo = resolverEscopo(ctx.actor);
    const unidade = await this.carregarNoEscopo(
      unidadeId,
      ctx,
      escopo,
      "alter",
    );

    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.unidadeOrganizacional.update({
        where: { id: unidade.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_unidade_organizacional_atualizada",
        "unidade_organizacional",
        atualizada.id,
        atualizada.empresaId,
      );

      return atualizada;
    });
  }

  async inativar(
    unidadeId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<UnidadeOrganizacional> {
    const escopo = resolverEscopo(ctx.actor);
    const unidade = await this.carregarNoEscopo(
      unidadeId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaAtivo(unidade.status);

    // Equipes ativas vinculadas bloqueiam — sem cascata (R-INA-2).
    const equipesAtivas = await this.prisma.equipe.count({
      where: {
        unidadeOrganizacionalId: unidade.id,
        status: StatusOrganizacional.ativo,
      },
    });
    assertSemFilhosAtivos(equipesAtivas);

    return this.prisma.$transaction(async (tx) => {
      const inativada = await tx.unidadeOrganizacional.update({
        where: { id: unidade.id },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_unidade_organizacional_inativada",
        "unidade_organizacional",
        inativada.id,
        inativada.empresaId,
      );

      return inativada;
    });
  }

  /**
   * R-INA-5: reativação explícita e auditada, condicionada a a empresa pai
   * estar ativa — reativar sob pai inativo recriaria pela porta dos fundos o
   * estado que R-INA-3 proíbe na criação.
   */
  async reativar(
    unidadeId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<UnidadeOrganizacional> {
    const escopo = resolverEscopo(ctx.actor);
    const unidade = await this.carregarNoEscopo(
      unidadeId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaInativo(unidade.status);

    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id: unidade.empresaId },
      select: { status: true },
    });
    assertPaisAtivosParaReativar([empresa.status]);

    return this.prisma.$transaction(async (tx) => {
      const reativada = await tx.unidadeOrganizacional.update({
        where: { id: unidade.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_unidade_organizacional_reativada",
        "unidade_organizacional",
        reativada.id,
        reativada.empresaId,
      );

      return reativada;
    });
  }

  private async carregarNoEscopo(
    unidadeId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<UnidadeOrganizacional> {
    const unidade = await this.prisma.unidadeOrganizacional.findFirst({
      where: { id: unidadeId, ...filtroEmpresa(escopo) },
    });

    if (!unidade) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(
        ctx,
        "unidade_organizacional",
        unidadeId,
        null,
      );
    }

    if (
      !podeAcessar(
        ctx.actor,
        "unidade_organizacional",
        action,
        unidade.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "unidade_organizacional",
        unidade.id,
        unidade.empresaId,
      );
    }

    return unidade;
  }
}
