import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Empresa, Prisma, StatusOrganizacional } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { OrganizacaoAuditoriaService } from "../organizacao-auditoria.service";
import {
  OrganizacaoAuditContext,
  ResultadoPaginado,
} from "../organizacao.types";
import { EscopoOrganizacional, resolverEscopo } from "../escopo.util";
import { podeAcessar } from "../autorizacao.util";
import { traduzirErroPrisma } from "../prisma-erro.util";
import { assertAindaInativo } from "../validacao.util";
import {
  AtualizarNoOrganizacionalDto,
  CriarEmpresaDto,
  ListarNosOrganizacionaisQueryDto,
} from "../dto/organizacao.dto";

/**
 * Empresa — raiz do escopo organizacional (spec §3.1). Não existe entidade
 * acima dela nesta fatia, e `empresaId` é a única fronteira de autorização
 * (ADR 0005 decisão 3; Baseline V1 item 2).
 *
 * Sem CNPJ: DP-4 continua pendente de DPO/jurídico (spec §7).
 */
@Injectable()
export class EmpresaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(
    dto: CriarEmpresaDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    if (!escopo.global) {
      // Defesa em profundidade: o avaliador RBAC/ABAC já nega criação de
      // empresa a papel escopado, porque a empresa criada nunca é "a própria".
      throw new ForbiddenException();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.empresa.create({
          data: { codigo: dto.codigo, nome: dto.nome },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_empresa_criada",
          "empresa",
          criada.id,
          criada.id,
        );

        return criada;
      });
    } catch (error) {
      traduzirErroPrisma(error);
    }
  }

  async listar(
    query: ListarNosOrganizacionaisQueryDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<ResultadoPaginado<Empresa>> {
    const escopo = resolverEscopo(ctx.actor);

    const where: Prisma.EmpresaWhereInput = {
      ...this.filtroDeEscopo(escopo),
      ...(query.status ? { status: query.status } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.empresa.findMany({
        where,
        // Ordenação fixa no servidor — nunca vinda do cliente (spec §10).
        orderBy: { codigo: "asc" },
        skip: (query.pagina - 1) * query.tamanhoPagina,
        take: query.tamanhoPagina,
      }),
      this.prisma.empresa.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "estrutura_organizacional",
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

  async detalhar(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await this.carregarNoEscopo(empresaId, ctx, escopo, "read");

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "empresa",
      empresa.id,
      empresa.id,
    );

    return empresa;
  }

  async atualizar(
    empresaId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    await this.carregarNoEscopo(empresaId, ctx, escopo, "alter");

    return this.prisma.$transaction(async (tx) => {
      // Só `nome`: `codigo` é imutável (R1) e a empresa de uma entidade é
      // imutável (R7).
      const atualizada = await tx.empresa.update({
        where: { id: empresaId },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_empresa_atualizada",
        "empresa",
        atualizada.id,
        atualizada.id,
      );

      return atualizada;
    });
  }

  async inativar(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await this.carregarNoEscopo(
      empresaId,
      ctx,
      escopo,
      "manage",
    );

    if (empresa.status === StatusOrganizacional.inativo) {
      // Inativar o que já está inativo é conflito, não no-op silencioso —
      // evita evento de auditoria sem alteração correspondente.
      throw new ConflictException();
    }

    await this.assertSemFilhosAtivos(empresaId);

    return this.prisma.$transaction(async (tx) => {
      const inativada = await tx.empresa.update({
        where: { id: empresaId },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_empresa_inativada",
        "empresa",
        inativada.id,
        inativada.id,
      );

      return inativada;
    });
  }

  /**
   * R-INA-5: reativação é operação explícita e auditada.
   *
   * `Empresa` é a raiz — não tem pai a validar. Não reclassifica, não altera
   * `codigo`, empresa ou qualquer relação: só a transição de status.
   */
  async reativar(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await this.carregarNoEscopo(
      empresaId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaInativo(empresa.status);

    return this.prisma.$transaction(async (tx) => {
      const reativada = await tx.empresa.update({
        where: { id: empresa.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_empresa_reativada",
        "empresa",
        reativada.id,
        reativada.id,
      );

      return reativada;
    });
  }

  /**
   * Para `Empresa` o escopo incide sobre o próprio `id`: um ator escopado só
   * alcança a empresa à qual pertence.
   */
  private filtroDeEscopo(
    escopo: EscopoOrganizacional,
  ): Prisma.EmpresaWhereInput {
    return escopo.global ? {} : { id: escopo.empresaId };
  }

  /**
   * Carrega a empresa **já restrita ao escopo do ator**. Inexistente e fora do
   * escopo produzem a mesma resposta 404 — confirmar a existência permitiria
   * enumeração (spec §10).
   */
  private async carregarNoEscopo(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<Empresa> {
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId, ...this.filtroDeEscopo(escopo) },
    });

    if (!empresa) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(ctx, "empresa", empresaId, null);
    }

    // Fase 2 da autorização, com a empresa resolvida — defesa em profundidade
    // sobre o filtro já aplicado na consulta.
    if (!podeAcessar(ctx.actor, "empresa", action, empresa.id)) {
      return this.auditoria.negarAcesso(ctx, "empresa", empresa.id, empresa.id);
    }

    return empresa;
  }

  /**
   * R-INA-2 (Baseline V1, item 7): inativação é **bloqueada** quando existe
   * elemento ativo vinculado. Nunca há cascata, em nenhuma hipótese.
   *
   * `Area` não é contada aqui: ela pende de um departamento, e departamento
   * ativo já bloqueia. Para todo departamento estar inativo, suas áreas já
   * precisaram estar inativas (ver `DepartamentoService`).
   */
  private async assertSemFilhosAtivos(empresaId: string): Promise<void> {
    const status = StatusOrganizacional.ativo;
    const [unidades, departamentos, equipes, cargos, centrosCusto] =
      await Promise.all([
        this.prisma.unidadeOrganizacional.count({
          where: { empresaId, status },
        }),
        this.prisma.departamento.count({ where: { empresaId, status } }),
        this.prisma.equipe.count({ where: { empresaId, status } }),
        this.prisma.cargo.count({ where: { empresaId, status } }),
        this.prisma.centroCusto.count({ where: { empresaId, status } }),
      ]);

    if (unidades + departamentos + equipes + cargos + centrosCusto > 0) {
      throw new ConflictException();
    }
  }
}
