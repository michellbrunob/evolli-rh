import { Injectable } from "@nestjs/common";
import { Prisma, TipoDocumento } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { DocumentosAuditoriaService } from "../documentos-auditoria.service";
import { DocumentosAuditContext, ResultadoPaginado } from "../documentos.types";
import {
  EscopoDocumentos,
  deslocamento,
  intersectarEmpresaSolicitada,
  podeAcessarDocumentos,
  resolverEscopoDocumentos,
} from "../escopo-documentos.util";
import { traduzirErroDocumentos } from "../validacao-documentos.util";
import {
  AlterarTipoDocumentoDto,
  CriarTipoDocumentoDto,
  ListarTiposDocumentoQueryDto,
} from "../dto/documentos.dto";

/**
 * Catálogo de tipos documentais, por empresa (ADR 0011, decisão 5). Todo tipo
 * nasce e permanece **restrito** (Emenda 1) — a classificação não é aceita do
 * cliente. Só RH cria/altera; a capacidade é imposta pelo `AuthorizationGuard`
 * (fase 1) e reavaliada aqui (fase 2). A operação exige aprovação de DPO
 * registrada — a referência é obrigatória no DTO e persistida como evidência.
 */
@Injectable()
export class TipoDocumentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: DocumentosAuditoriaService,
  ) {}

  async criar(
    dto: CriarTipoDocumentoDto,
    ctx: DocumentosAuditContext,
  ): Promise<TipoDocumento> {
    const escopo = resolverEscopoDocumentos(ctx.actor);

    if (dto.empresaId !== escopo.empresaId) {
      return this.auditoria.negarAcesso(
        ctx,
        "tipo_documento",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessarDocumentos(
        ctx.actor,
        "tipo_documento",
        "create",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "tipo_documento",
        null,
        escopo.empresaId,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tipo = await tx.tipoDocumento.create({
          data: {
            empresaId: escopo.empresaId,
            codigo: dto.codigo,
            nome: dto.nome,
            // classificacao permanece o default `restrito` — nunca vinda do
            // cliente (ADR 0011, decisão 10; Emenda 1).
            dpoAprovacaoReferencia: dto.aprovacaoDpoReferencia,
            dpoAprovadoEm: new Date(),
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "documentos_tipo_documento_criado",
          "tipo_documento",
          tipo.id,
          escopo.empresaId,
        );

        return tipo;
      });
    } catch (error) {
      traduzirErroDocumentos(error);
    }
  }

  async alterar(
    tipoDocumentoId: string,
    dto: AlterarTipoDocumentoDto,
    ctx: DocumentosAuditContext,
  ): Promise<TipoDocumento> {
    const escopo = resolverEscopoDocumentos(ctx.actor);
    await this.carregarNoEscopo(tipoDocumentoId, ctx, escopo, "alter");

    try {
      return await this.prisma.$transaction(async (tx) => {
        const atualizado = await tx.tipoDocumento.update({
          where: { id: tipoDocumentoId },
          data: {
            nome: dto.nome,
            // Nova alteração de catálogo → nova evidência de aprovação de DPO.
            dpoAprovacaoReferencia: dto.aprovacaoDpoReferencia,
            dpoAprovadoEm: new Date(),
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "documentos_tipo_documento_atualizado",
          "tipo_documento",
          atualizado.id,
          escopo.empresaId,
        );

        return atualizado;
      });
    } catch (error) {
      traduzirErroDocumentos(error);
    }
  }

  async listar(
    query: ListarTiposDocumentoQueryDto,
    ctx: DocumentosAuditContext,
  ): Promise<ResultadoPaginado<TipoDocumento>> {
    const escopo = resolverEscopoDocumentos(ctx.actor);
    const filtro = intersectarEmpresaSolicitada(escopo, query.empresaId);

    if (filtro === null) {
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    const where: Prisma.TipoDocumentoWhereInput = {
      empresaId: filtro.empresaId,
    };

    const [itens, total] = await Promise.all([
      this.prisma.tipoDocumento.findMany({
        where,
        orderBy: [{ codigo: "asc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.tipoDocumento.count({ where }),
    ]);

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(
    tipoDocumentoId: string,
    ctx: DocumentosAuditContext,
  ): Promise<TipoDocumento> {
    const escopo = resolverEscopoDocumentos(ctx.actor);
    return this.carregarNoEscopo(tipoDocumentoId, ctx, escopo, "read");
  }

  private async carregarNoEscopo(
    tipoDocumentoId: string,
    ctx: DocumentosAuditContext,
    escopo: EscopoDocumentos,
    action: "read" | "alter",
  ): Promise<TipoDocumento> {
    const tipo = await this.prisma.tipoDocumento.findFirst({
      where: { id: tipoDocumentoId, empresaId: escopo.empresaId },
    });

    if (!tipo) {
      // Inexistente e fora do escopo respondem igual (404).
      return this.auditoria.negarAcesso(
        ctx,
        "tipo_documento",
        tipoDocumentoId,
        null,
      );
    }

    if (
      !podeAcessarDocumentos(
        ctx.actor,
        "tipo_documento",
        action,
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "tipo_documento",
        tipo.id,
        escopo.empresaId,
      );
    }

    return tipo;
  }
}
