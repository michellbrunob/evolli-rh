import { randomUUID } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  IndisponibilidadeException,
  RecusaDeNegocioException,
} from "../../common/erros/recusa-por-campo";
import type { ArmazenamentoDeObjetos } from "../foto-colaborador/armazenamento-de-objetos";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "../documentos-colaborador/armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  type VerificadorDeArquivos,
} from "../documentos-colaborador/verificador-de-arquivos";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import {
  AnexoRecusado,
  type ArquivoDoAnexo,
  type FormatoAnexoAusencia,
  EXTENSAO_DO_FORMATO_ANEXO,
  TIPO_DO_FORMATO_ANEXO,
  conferirArquivoDoAnexo,
} from "./anexo-ausencia.arquivo";

/** O anexo como a API devolve: sem nome, chave ou hash. */
export interface AnexoDaAusenciaApi {
  formato: FormatoAnexoAusencia;
  tamanhoBytes: number;
  enviadoEm: string;
}

export interface AnexoBaixado {
  bytes: Buffer;
  tipo: string;
  nome: string;
}

/** A chave do objeto: só ids internos, nunca nome, CPF ou e-mail. */
export function chaveDoAnexo(
  empresaId: string,
  colaboradorId: string,
  ausenciaId: string,
  anexoId: string,
): string {
  return `v1/empresas/${empresaId}/colaboradores/${colaboradorId}/ausencias/${ausenciaId}/anexos/${anexoId}`;
}

/** Status em que a ausência já não recebe anexo. */
const STATUS_ENCERRADOS = new Set(["cancelada", "recusada"]);

/**
 * T215 — anexo da ausência (atestado ou documento), sobre o armazenamento
 * privado e o antivírus dos documentos do colaborador (T213, ADR 0021):
 *
 * - conferência do arquivo (extensão, tipo e conteúdo; estrutura; macro);
 * - antivírus ANTES de gravar: reprovado é recusado, indisponível é 503 — em
 *   nenhum dos dois casos algo é gravado;
 * - um anexo vivo por ausência; remoção só lógica;
 * - empresa sempre a ativa da sessão: ausência de outra empresa responde 404;
 * - trilha de envio, download e remoção com o id da AUSÊNCIA, sem conteúdo.
 */
@Injectable()
export class AnexoAusenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    @Inject(ARMAZENAMENTO_DE_DOCUMENTOS)
    private readonly armazenamento: ArmazenamentoDeObjetos,
    @Inject(VERIFICADOR_DE_ARQUIVOS)
    private readonly verificador: VerificadorDeArquivos,
  ) {}

  async enviar(
    ausenciaId: string,
    arquivo: ArquivoDoAnexo,
    ctx: PessoasAuditContext,
  ): Promise<{ anexo: AnexoDaAusenciaApi }> {
    const empresaId = this.empresaDaSessao(ctx);
    const ausencia = await this.ausenciaDaEmpresa(ausenciaId, empresaId, ctx);
    if (STATUS_ENCERRADOS.has(ausencia.status)) throw new ConflictException();

    let conferido: ReturnType<typeof conferirArquivoDoAnexo>;
    try {
      conferido = conferirArquivoDoAnexo(arquivo);
    } catch (erro) {
      if (erro instanceof AnexoRecusado) {
        throw new RecusaDeNegocioException(erro.motivo);
      }
      throw erro;
    }
    if (await this.anexoVivo(ausenciaId)) throw new ConflictException();

    let resultado: Awaited<ReturnType<VerificadorDeArquivos["verificar"]>>;
    try {
      resultado = await this.verificador.verificar(arquivo.bytes);
    } catch {
      throw new IndisponibilidadeException("anexo_verificacao_indisponivel");
    }
    if (resultado !== "aprovado") {
      throw new RecusaDeNegocioException("anexo_reprovado_antivirus");
    }
    const verificadoEm = new Date();

    const anexoId = randomUUID();
    const chave = chaveDoAnexo(
      empresaId,
      ausencia.colaboradorId,
      ausenciaId,
      anexoId,
    );
    try {
      await this.armazenamento.gravar(
        chave,
        arquivo.bytes,
        TIPO_DO_FORMATO_ANEXO[conferido.formato],
      );
    } catch {
      await this.apagarSemFalhar(chave);
      throw new IndisponibilidadeException("anexo_armazenamento_indisponivel");
    }

    try {
      const criado = await this.prisma.$transaction(async (tx) => {
        const linha = await tx.anexoAusencia.create({
          data: {
            id: anexoId,
            empresaId,
            colaboradorId: ausencia.colaboradorId,
            ausenciaId,
            formato: conferido.formato,
            tamanhoBytes: conferido.tamanhoBytes,
            hashSha256: conferido.hashSha256,
            chaveObjeto: chave,
            enviadoPorId: ctx.actor.id,
            verificadoEm,
          },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_ausencia_anexo_enviado",
          "ausencia",
          ausenciaId,
          empresaId,
        );
        return linha;
      });
      return {
        anexo: {
          formato: criado.formato,
          tamanhoBytes: criado.tamanhoBytes,
          enviadoEm: criado.criadoEm.toISOString(),
        },
      };
    } catch (erro) {
      await this.apagarSemFalhar(chave);
      // Dois envios ao mesmo tempo: o índice parcial deixa só um.
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2002"
      ) {
        throw new ConflictException();
      }
      throw erro;
    }
  }

  async baixar(
    ausenciaId: string,
    ctx: PessoasAuditContext,
  ): Promise<AnexoBaixado> {
    const empresaId = this.empresaDaSessao(ctx);
    await this.ausenciaDaEmpresa(ausenciaId, empresaId, ctx);
    const anexo = await this.anexoVivo(ausenciaId);
    if (!anexo) throw new NotFoundException();
    let bytes: Buffer | null;
    try {
      bytes = await this.armazenamento.ler(anexo.chaveObjeto);
    } catch {
      throw new IndisponibilidadeException("anexo_armazenamento_indisponivel");
    }
    if (!bytes) throw new NotFoundException();
    // Fail-safe: sem trilha gravada, nada é entregue.
    await this.auditoria.registrarLeitura(
      ctx,
      "pessoas_ausencia_anexo_baixado",
      "ausencia",
      ausenciaId,
      empresaId,
    );
    return {
      bytes,
      tipo: TIPO_DO_FORMATO_ANEXO[anexo.formato],
      nome: `atestado.${EXTENSAO_DO_FORMATO_ANEXO[anexo.formato]}`,
    };
  }

  async remover(
    ausenciaId: string,
    ctx: PessoasAuditContext,
  ): Promise<{ anexo: null }> {
    const empresaId = this.empresaDaSessao(ctx);
    await this.ausenciaDaEmpresa(ausenciaId, empresaId, ctx);
    const anexo = await this.anexoVivo(ausenciaId);
    if (!anexo) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await tx.anexoAusencia.update({
        where: { id: anexo.id },
        data: { removidoEm: new Date(), removidoPorId: ctx.actor.id },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_ausencia_anexo_removido",
        "ausencia",
        ausenciaId,
        empresaId,
      );
    });
    return { anexo: null };
  }

  private anexoVivo(ausenciaId: string) {
    return this.prisma.anexoAusencia.findFirst({
      where: { ausenciaId, removidoEm: null },
      select: { id: true, formato: true, chaveObjeto: true },
    });
  }

  /** A ausência NA EMPRESA ativa; outra ou inexistente: 404 auditado. */
  private async ausenciaDaEmpresa(
    ausenciaId: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ) {
    const ausencia = await this.prisma.ausencia.findFirst({
      where: { id: ausenciaId, empresaId },
      select: { id: true, colaboradorId: true, status: true },
    });
    if (!ausencia) {
      return this.auditoria.negarAcesso(ctx, "ausencia", ausenciaId, empresaId);
    }
    return ausencia;
  }

  /**
   * Só `rh` e `dp`, na empresa ativa, leem e gravam o arquivo — nem o
   * `master_tecnico` (proteção reforçada dos documentos sensíveis). Defesa
   * em profundidade: o guard (`anexo_ausencia`) já nega os demais.
   */
  private empresaDaSessao(ctx: PessoasAuditContext): string {
    const papel = ctx.actor.role;
    if ((papel !== "rh" && papel !== "dp") || ctx.actor.companyId === null) {
      throw new ForbiddenException();
    }
    return ctx.actor.companyId;
  }

  private async apagarSemFalhar(chave: string): Promise<void> {
    await this.armazenamento.apagar(chave).catch(() => undefined);
  }
}
