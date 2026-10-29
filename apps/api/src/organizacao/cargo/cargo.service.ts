import { Injectable } from "@nestjs/common";
import { Cargo, Prisma, StatusOrganizacional } from "@prisma/client";
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
import { criarComCodigoAutomatico } from "../criacao-automatica";
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
  CriarCargoDto,
  ListarReferenciasQueryDto,
} from "../dto/organizacao.dto";
import { filtroDeBuscaPorCodigoOuNome } from "../busca-referencias.util";

/**
 * Cargo — catálogo **por empresa** (Baseline V1, item 5). O mesmo `codigo`
 * pode se repetir em catálogos de empresas diferentes, o que viabiliza
 * consolidação futura sem compartilhar linha entre empresas.
 *
 * "Cargo", nunca "Role": o domínio de autorização já usa papel (`AccessRole`)
 * para outro conceito (ADR 0006, Emenda 1, item 3).
 *
 * Nesta fatia existe apenas cargo — **função** fica para a vida funcional
 * futura do colaborador (item 4). Sem faixa salarial, CBO ou jornada.
 */
@Injectable()
export class CargoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(
    dto: CriarCargoDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Cargo> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await resolverEmpresaPai(
      this.prisma,
      escopo,
      dto.empresaId,
    );
    if (!empresa) {
      return this.auditoria.negarAcesso(ctx, "cargo", null, dto.empresaId);
    }
    if (!podeAcessar(ctx.actor, "cargo", "create", empresa.id)) {
      return this.auditoria.negarAcesso(ctx, "cargo", null, empresa.id);
    }

    // T197 — sem código: criação inline da Nova admissão, com o código gerado
    // aqui e nome repetido recusado (`criacao-automatica.ts`).
    if (dto.codigo === undefined) {
      return criarComCodigoAutomatico({
        prisma: this.prisma,
        tipo: "cargo",
        prefixo: "CAR",
        empresaId: empresa.id,
        nome: dto.nome,
        porNome: (tx, filtro) => tx.cargo.findMany({ where: filtro }),
        codigosUsados: (tx, empresaId, codigos) =>
          tx.cargo.findMany({
            where: { empresaId, codigo: { in: codigos } },
            select: { codigo: true },
          }),
        criar: (tx, dados) => tx.cargo.create({ data: dados }),
        auditar: (tx, criado) =>
          this.auditoria.registrarMutacao(
            tx,
            ctx,
            "organizacao_cargo_criado",
            "cargo",
            criado.id,
            criado.empresaId,
          ),
      });
    }
    const codigo = dto.codigo;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.cargo.create({
          data: { empresaId: empresa.id, codigo, nome: dto.nome },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_cargo_criado",
          "cargo",
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
  ): Promise<ResultadoPaginado<Cargo>> {
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

    const where: Prisma.CargoWhereInput = {
      ...filtro,
      ...(query.status ? { status: query.status } : {}),
      // T196 — busca por código ou nome, antes da paginação.
      ...filtroDeBuscaPorCodigoOuNome(query.busca),
    };

    const [itens, total] = await Promise.all([
      this.prisma.cargo.findMany({
        where,
        orderBy: { codigo: "asc" },
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.cargo.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "cargo",
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
    cargoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Cargo> {
    const escopo = resolverEscopo(ctx.actor);
    const cargo = await this.carregarNoEscopo(cargoId, ctx, escopo, "read");

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "cargo",
      cargo.id,
      cargo.empresaId,
    );

    return cargo;
  }

  async atualizar(
    cargoId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Cargo> {
    const escopo = resolverEscopo(ctx.actor);
    const cargo = await this.carregarNoEscopo(cargoId, ctx, escopo, "alter");

    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.cargo.update({
        where: { id: cargo.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_cargo_atualizado",
        "cargo",
        atualizado.id,
        atualizado.empresaId,
      );

      return atualizado;
    });
  }

  /**
   * Cargo não tem filho organizacional nesta fatia — o que um dia o
   * bloquearia seria vínculo de colaborador, que não existe aqui.
   */
  async inativar(
    cargoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Cargo> {
    const escopo = resolverEscopo(ctx.actor);
    const cargo = await this.carregarNoEscopo(cargoId, ctx, escopo, "manage");
    assertAindaAtivo(cargo.status);

    // RI-O1 (Fatia 2): alocacao vigente de vinculo ativo tambem bloqueia.
    // Mesma regra da ADR 0006 d.7 aplicada a uma classe nova de dependente
    // — bloqueia, nunca cascateia. A recusa nao revela o dependente.
    assertSemFilhosAtivos(
      await contarDependentesFuncionaisAtivos(this.prisma, {
        cargoId: cargo.id,
      }),
    );

    return this.prisma.$transaction(async (tx) => {
      const inativado = await tx.cargo.update({
        where: { id: cargo.id },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_cargo_inativado",
        "cargo",
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
    cargoId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Cargo> {
    const escopo = resolverEscopo(ctx.actor);
    const cargo = await this.carregarNoEscopo(cargoId, ctx, escopo, "manage");
    assertAindaInativo(cargo.status);

    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id: cargo.empresaId },
      select: { status: true },
    });
    assertPaisAtivosParaReativar([empresa.status]);

    return this.prisma.$transaction(async (tx) => {
      const reativado = await tx.cargo.update({
        where: { id: cargo.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_cargo_reativado",
        "cargo",
        reativado.id,
        reativado.empresaId,
      );

      return reativado;
    });
  }

  private async carregarNoEscopo(
    cargoId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<Cargo> {
    const cargo = await this.prisma.cargo.findFirst({
      where: { id: cargoId, ...filtroEmpresa(escopo) },
    });

    if (!cargo) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(ctx, "cargo", cargoId, null);
    }

    if (!podeAcessar(ctx.actor, "cargo", action, cargo.empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        "cargo",
        cargo.id,
        cargo.empresaId,
      );
    }

    return cargo;
  }
}
