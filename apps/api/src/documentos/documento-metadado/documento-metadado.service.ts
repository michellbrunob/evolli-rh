import { ConflictException, Injectable } from "@nestjs/common";
import { DocumentoMetadado, Prisma } from "@prisma/client";
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
  CriarDocumentoMetadadoDto,
  ListarDocumentosMetadadoQueryDto,
  SubstituirDocumentoMetadadoDto,
} from "../dto/documentos.dto";

/**
 * Metadado do documento — o documento como conceito, **sem conteúdo** (ADR 0011,
 * decisão 1). Nenhum método aqui aceita, devolve ou referencia byte, caminho,
 * URL ou endereço de armazenamento: não há o que devolver, porque não há
 * conteúdo.
 *
 * **Leitura é auditada de forma fail-safe** (decisão 7): se o evento de leitura
 * não puder ser gravado, a leitura não retorna sucesso.
 */
@Injectable()
export class DocumentoMetadadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: DocumentosAuditoriaService,
  ) {}

  async criar(
    dto: CriarDocumentoMetadadoDto,
    ctx: DocumentosAuditContext,
  ): Promise<DocumentoMetadado> {
    const escopo = resolverEscopoDocumentos(ctx.actor);

    if (dto.empresaId !== escopo.empresaId) {
      return this.auditoria.negarAcesso(
        ctx,
        "documento_metadado",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessarDocumentos(
        ctx.actor,
        "documento_metadado",
        "create",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "documento_metadado",
        null,
        escopo.empresaId,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertReferenciasNoEscopo(
          tx,
          ctx,
          escopo.empresaId,
          dto.colaboradorId,
          dto.tipoDocumentoId,
        );

        const metadado = await tx.documentoMetadado.create({
          data: {
            empresaId: escopo.empresaId,
            colaboradorId: dto.colaboradorId,
            tipoDocumentoId: dto.tipoDocumentoId,
            // estado permanece o default `upload_desabilitado` — não há
            // transição para conteúdo (ADR 0011, decisão 2).
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "documentos_documento_metadado_criado",
          "documento_metadado",
          metadado.id,
          escopo.empresaId,
        );

        return metadado;
      });
    } catch (error) {
      traduzirErroDocumentos(error);
    }
  }

  async listar(
    query: ListarDocumentosMetadadoQueryDto,
    ctx: DocumentosAuditContext,
  ): Promise<ResultadoPaginado<DocumentoMetadado>> {
    const escopo = resolverEscopoDocumentos(ctx.actor);
    const filtro = intersectarEmpresaSolicitada(escopo, query.empresaId);

    if (filtro === null) {
      // Pedido de outra empresa devolve página vazia, nunca erro — e não gera
      // evento de leitura, porque nada foi lido.
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    const where: Prisma.DocumentoMetadadoWhereInput = {
      empresaId: filtro.empresaId,
      ...(query.colaboradorId ? { colaboradorId: query.colaboradorId } : {}),
      ...(query.tipoDocumentoId
        ? { tipoDocumentoId: query.tipoDocumentoId }
        : {}),
      ...(query.estado ? { estado: query.estado } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.documentoMetadado.findMany({
        where,
        orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.documentoMetadado.count({ where }),
    ]);

    // Fail-safe: se o evento de leitura não puder ser gravado, a consulta não é
    // reportada como bem-sucedida (ADR 0011, decisão 7).
    await this.auditoria.registrarLeitura(
      ctx,
      "documentos_documento_metadado_consultado",
      "documento_metadado",
      null,
      filtro.empresaId,
    );

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(
    documentoId: string,
    ctx: DocumentosAuditContext,
  ): Promise<DocumentoMetadado> {
    const escopo = resolverEscopoDocumentos(ctx.actor);
    const metadado = await this.carregarNoEscopo(
      documentoId,
      ctx,
      escopo,
      "read",
    );

    await this.auditoria.registrarLeitura(
      ctx,
      "documentos_documento_metadado_consultado",
      "documento_metadado",
      metadado.id,
      escopo.empresaId,
    );

    return metadado;
  }

  /**
   * Substituição preserva histórico (ADR 0011, decisão 8): cria um metadado novo
   * apontando para o anterior; o anterior transita para `substituido` e
   * **permanece**. Nunca `UPDATE` destrutivo, nunca `DELETE`. Um metadado já
   * substituído não pode ser substituído de novo (409) — a correção da correção
   * parte do registro corrente.
   */
  async substituir(
    documentoId: string,
    dto: SubstituirDocumentoMetadadoDto,
    ctx: DocumentosAuditContext,
  ): Promise<DocumentoMetadado> {
    const escopo = resolverEscopoDocumentos(ctx.actor);
    const atual = await this.carregarNoEscopo(
      documentoId,
      ctx,
      escopo,
      "alter",
    );

    if (atual.estado === "substituido") {
      throw new ConflictException();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tipo = await buscarTipoNaEmpresa(
          tx,
          escopo.empresaId,
          dto.tipoDocumentoId,
        );
        if (!tipo) {
          return this.auditoria.negarAcesso(
            ctx,
            "documento_metadado",
            documentoId,
            escopo.empresaId,
          );
        }

        const novo = await tx.documentoMetadado.create({
          data: {
            empresaId: escopo.empresaId,
            colaboradorId: atual.colaboradorId,
            tipoDocumentoId: dto.tipoDocumentoId,
            substituiDocumentoId: atual.id,
          },
        });

        await tx.documentoMetadado.update({
          where: { id: atual.id },
          data: { estado: "substituido" },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "documentos_documento_metadado_substituido",
          "documento_metadado",
          novo.id,
          escopo.empresaId,
        );

        return novo;
      });
    } catch (error) {
      traduzirErroDocumentos(error);
    }
  }

  private async assertReferenciasNoEscopo(
    tx: Prisma.TransactionClient,
    ctx: DocumentosAuditContext,
    empresaId: string,
    colaboradorId: string,
    tipoDocumentoId: string,
  ): Promise<void> {
    const temVinculo = await colaboradorTemVinculoNaEmpresa(
      tx,
      empresaId,
      colaboradorId,
    );
    if (!temVinculo) {
      // Colaborador inexistente OU sem vínculo nesta empresa → 404 igual, para
      // não revelar que a pessoa existe em outra empresa.
      await this.auditoria.negarAcesso(
        ctx,
        "documento_metadado",
        null,
        empresaId,
      );
    }

    const tipo = await buscarTipoNaEmpresa(tx, empresaId, tipoDocumentoId);
    if (!tipo) {
      await this.auditoria.negarAcesso(
        ctx,
        "documento_metadado",
        null,
        empresaId,
      );
    }
  }

  private async carregarNoEscopo(
    documentoId: string,
    ctx: DocumentosAuditContext,
    escopo: EscopoDocumentos,
    action: "read" | "alter",
  ): Promise<DocumentoMetadado> {
    const metadado = await this.prisma.documentoMetadado.findFirst({
      where: { id: documentoId, empresaId: escopo.empresaId },
    });

    if (!metadado) {
      return this.auditoria.negarAcesso(
        ctx,
        "documento_metadado",
        documentoId,
        null,
      );
    }

    if (
      !podeAcessarDocumentos(
        ctx.actor,
        "documento_metadado",
        action,
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "documento_metadado",
        metadado.id,
        escopo.empresaId,
      );
    }

    return metadado;
  }
}
