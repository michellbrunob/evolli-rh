import { Injectable } from "@nestjs/common";
import { Prisma, SolicitacaoDocumento } from "@prisma/client";
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
import {
  buscarTipoNaEmpresa,
  colaboradorTemVinculoNaEmpresa,
  traduzirErroDocumentos,
} from "../validacao-documentos.util";
import {
  CriarSolicitacaoDocumentoDto,
  ListarSolicitacoesDocumentoQueryDto,
} from "../dto/documentos.dto";

/**
 * Solicitação (pedido) de documento. Existe antes de qualquer documento e, nesta
 * V1, permanece `pendente`: atender exigiria conteúdo (Nível 2). Solicitar e
 * consultar — não há alteração nem exclusão. Leitura de solicitação **não** é
 * auditada como leitura de metadado (spec §11 audita a criação da solicitação e
 * a leitura do metadado; a leitura de solicitação não é evento de risco desta
 * V1); a criação é auditada transacionalmente.
 */
@Injectable()
export class SolicitacaoDocumentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: DocumentosAuditoriaService,
  ) {}

  async solicitar(
    dto: CriarSolicitacaoDocumentoDto,
    ctx: DocumentosAuditContext,
  ): Promise<SolicitacaoDocumento> {
    const escopo = resolverEscopoDocumentos(ctx.actor);

    if (dto.empresaId !== escopo.empresaId) {
      return this.auditoria.negarAcesso(
        ctx,
        "solicitacao_documento",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessarDocumentos(
        ctx.actor,
        "solicitacao_documento",
        "create",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "solicitacao_documento",
        null,
        escopo.empresaId,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const temVinculo = await colaboradorTemVinculoNaEmpresa(
          tx,
          escopo.empresaId,
          dto.colaboradorId,
        );
        if (!temVinculo) {
          return this.auditoria.negarAcesso(
            ctx,
            "solicitacao_documento",
            null,
            escopo.empresaId,
          );
        }

        const tipo = await buscarTipoNaEmpresa(
          tx,
          escopo.empresaId,
          dto.tipoDocumentoId,
        );
        if (!tipo) {
          return this.auditoria.negarAcesso(
            ctx,
            "solicitacao_documento",
            null,
            escopo.empresaId,
          );
        }

        const solicitacao = await tx.solicitacaoDocumento.create({
          data: {
            empresaId: escopo.empresaId,
            colaboradorId: dto.colaboradorId,
            tipoDocumentoId: dto.tipoDocumentoId,
            solicitanteUserId: ctx.actor.id,
            // estado permanece o default `pendente`.
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "documentos_solicitacao_documento_criada",
          "solicitacao_documento",
          solicitacao.id,
          escopo.empresaId,
        );

        return solicitacao;
      });
    } catch (error) {
      traduzirErroDocumentos(error);
    }
  }

  async listar(
    query: ListarSolicitacoesDocumentoQueryDto,
    ctx: DocumentosAuditContext,
  ): Promise<ResultadoPaginado<SolicitacaoDocumento>> {
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

    const where: Prisma.SolicitacaoDocumentoWhereInput = {
      empresaId: filtro.empresaId,
      ...(query.colaboradorId ? { colaboradorId: query.colaboradorId } : {}),
      ...(query.tipoDocumentoId
        ? { tipoDocumentoId: query.tipoDocumentoId }
        : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.solicitacaoDocumento.findMany({
        where,
        orderBy: [{ solicitadaEm: "desc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.solicitacaoDocumento.count({ where }),
    ]);

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(
    solicitacaoId: string,
    ctx: DocumentosAuditContext,
  ): Promise<SolicitacaoDocumento> {
    const escopo = resolverEscopoDocumentos(ctx.actor);
    return this.carregarNoEscopo(solicitacaoId, ctx, escopo);
  }

  private async carregarNoEscopo(
    solicitacaoId: string,
    ctx: DocumentosAuditContext,
    escopo: EscopoDocumentos,
  ): Promise<SolicitacaoDocumento> {
    const solicitacao = await this.prisma.solicitacaoDocumento.findFirst({
      where: { id: solicitacaoId, empresaId: escopo.empresaId },
    });

    if (!solicitacao) {
      return this.auditoria.negarAcesso(
        ctx,
        "solicitacao_documento",
        solicitacaoId,
        null,
      );
    }

    if (
      !podeAcessarDocumentos(
        ctx.actor,
        "solicitacao_documento",
        "read",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "solicitacao_documento",
        solicitacao.id,
        escopo.empresaId,
      );
    }

    return solicitacao;
  }
}
