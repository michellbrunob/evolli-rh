import { Injectable } from "@nestjs/common";
import { Equipe, Prisma, StatusOrganizacional } from "@prisma/client";
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
  deslocamento,
  resolverDepartamentoPai,
  resolverUnidadePai,
} from "../validacao.util";
import {
  AtualizarNoOrganizacionalDto,
  CriarEquipeDto,
  ListarEquipesQueryDto,
} from "../dto/organizacao.dto";

/**
 * Equipe — pertence **obrigatoriamente** a um Departamento e, opcionalmente,
 * a uma UnidadeOrganizacional (Baseline V1, item 3).
 *
 * `empresaId` é sempre derivado do departamento pai, nunca aceito do cliente.
 * As FKs compostas no banco (`departamento_id, empresa_id` e
 * `unidade_organizacional_id, empresa_id`) recusam qualquer combinação que
 * cruze empresas (spec R5) mesmo que a validação de aplicação falhe.
 */
@Injectable()
export class EquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(
    dto: CriarEquipeDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Equipe> {
    const escopo = resolverEscopo(ctx.actor);

    const departamento = await resolverDepartamentoPai(
      this.prisma,
      escopo,
      dto.departamentoId,
    );
    if (!departamento) {
      return this.auditoria.negarAcesso(ctx, "equipe", null, null);
    }
    if (!podeAcessar(ctx.actor, "equipe", "create", departamento.empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        "equipe",
        null,
        departamento.empresaId,
      );
    }

    if (dto.unidadeOrganizacionalId) {
      const unidade = await resolverUnidadePai(
        this.prisma,
        escopo,
        dto.unidadeOrganizacionalId,
        departamento.empresaId,
      );
      if (!unidade) {
        return this.auditoria.negarAcesso(
          ctx,
          "equipe",
          null,
          departamento.empresaId,
        );
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.equipe.create({
          data: {
            // Empresa derivada da estrutura, nunca do corpo da requisição.
            empresaId: departamento.empresaId,
            departamentoId: departamento.id,
            unidadeOrganizacionalId: dto.unidadeOrganizacionalId ?? null,
            codigo: dto.codigo,
            nome: dto.nome,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_equipe_criada",
          "equipe",
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
    query: ListarEquipesQueryDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<ResultadoPaginado<Equipe>> {
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

    const where: Prisma.EquipeWhereInput = {
      ...filtro,
      ...(query.departamentoId ? { departamentoId: query.departamentoId } : {}),
      ...(query.unidadeOrganizacionalId
        ? { unidadeOrganizacionalId: query.unidadeOrganizacionalId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.equipe.findMany({
        where,
        orderBy: { codigo: "asc" },
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.equipe.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "equipe",
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
    equipeId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Equipe> {
    const escopo = resolverEscopo(ctx.actor);
    const equipe = await this.carregarNoEscopo(equipeId, ctx, escopo, "read");

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "equipe",
      equipe.id,
      equipe.empresaId,
    );

    return equipe;
  }

  async atualizar(
    equipeId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Equipe> {
    const escopo = resolverEscopo(ctx.actor);
    const equipe = await this.carregarNoEscopo(equipeId, ctx, escopo, "alter");

    return this.prisma.$transaction(async (tx) => {
      // Só `nome`. Mover a equipe para outro departamento ou unidade é
      // reclassificação — fluxo declarado futuro (Baseline V1, item 7).
      const atualizada = await tx.equipe.update({
        where: { id: equipe.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_equipe_atualizada",
        "equipe",
        atualizada.id,
        atualizada.empresaId,
      );

      return atualizada;
    });
  }

  /** Equipe é folha nesta fatia — nenhum filho organizacional a bloquear. */
  async inativar(
    equipeId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Equipe> {
    const escopo = resolverEscopo(ctx.actor);
    const equipe = await this.carregarNoEscopo(equipeId, ctx, escopo, "manage");
    assertAindaAtivo(equipe.status);

    return this.prisma.$transaction(async (tx) => {
      const inativada = await tx.equipe.update({
        where: { id: equipe.id },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_equipe_inativada",
        "equipe",
        inativada.id,
        inativada.empresaId,
      );

      return inativada;
    });
  }

  /**
   * R-INA-5: reativação explícita e auditada. Equipe é o único nó com dois
   * pais, então **ambos** precisam estar ativos — o departamento sempre, e a
   * unidade só quando houver vínculo. A reativação não reclassifica: nenhum
   * `departamentoId`/`unidadeOrganizacionalId` é tocado.
   */
  async reativar(
    equipeId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Equipe> {
    const escopo = resolverEscopo(ctx.actor);
    const equipe = await this.carregarNoEscopo(equipeId, ctx, escopo, "manage");
    assertAindaInativo(equipe.status);

    const [departamento, unidade] = await Promise.all([
      this.prisma.departamento.findUniqueOrThrow({
        where: { id: equipe.departamentoId },
        select: { status: true },
      }),
      equipe.unidadeOrganizacionalId
        ? this.prisma.unidadeOrganizacional.findUniqueOrThrow({
            where: { id: equipe.unidadeOrganizacionalId },
            select: { status: true },
          })
        : Promise.resolve(null),
    ]);

    assertPaisAtivosParaReativar([
      departamento.status,
      ...(unidade ? [unidade.status] : []),
    ]);

    return this.prisma.$transaction(async (tx) => {
      const reativada = await tx.equipe.update({
        where: { id: equipe.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_equipe_reativada",
        "equipe",
        reativada.id,
        reativada.empresaId,
      );

      return reativada;
    });
  }

  private async carregarNoEscopo(
    equipeId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<Equipe> {
    const equipe = await this.prisma.equipe.findFirst({
      where: { id: equipeId, ...filtroEmpresa(escopo) },
    });

    if (!equipe) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(ctx, "equipe", equipeId, null);
    }

    if (!podeAcessar(ctx.actor, "equipe", action, equipe.empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        "equipe",
        equipe.id,
        equipe.empresaId,
      );
    }

    return equipe;
  }
}
