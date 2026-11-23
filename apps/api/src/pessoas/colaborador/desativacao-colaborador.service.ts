import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { podeAcessarPessoas } from "../escopo-pessoas.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";

/** O estado da desativação do colaborador na empresa, como a tela o lê. */
export interface EstadoDaDesativacao {
  desativado: boolean;
  desativadoEm: Date | null;
}

export interface DesativacaoDoColaborador extends EstadoDaDesativacao {
  colaboradorId: string;
  empresaId: string;
}

/** Corrida com outra aba: o índice único parcial já tem a vigente. */
function eDesativacaoVigenteDuplicada(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

/**
 * T215 — desativar e reativar o colaborador NA EMPRESA ATIVA (lixeira do
 * "Editar colaborador"; decisão da proprietária de 2026-11-23).
 *
 * - **Nada se apaga:** colaborador, vínculos, documentos e histórico ficam;
 *   desativar abre uma linha em `desativacao_colaborador`, e reativar a
 *   fecha (`reativadoEm`). A linha nunca sai (o banco nega o DELETE).
 * - **Por empresa:** a empresa vem SEMPRE da sessão (`rh` e `dp`); nenhum id
 *   de empresa vem do navegador. Sem vínculo na empresa, 404 auditado, igual
 *   ao inexistente.
 * - **Idempotente:** pedir o estado em que a pessoa já está devolve o estado
 *   atual, sem trilha nova.
 * - A trilha registra só a ação, o colaborador e a empresa.
 */
@Injectable()
export class DesativacaoColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  /** O estado na empresa (leitura sem trilha; quem chama já autorizou). */
  async estado(
    colaboradorId: string,
    empresaId: string,
  ): Promise<EstadoDaDesativacao> {
    const vigente = await this.prisma.desativacaoColaborador.findFirst({
      where: { colaboradorId, empresaId, reativadoEm: null },
      select: { desativadoEm: true },
    });
    return {
      desativado: vigente !== null,
      desativadoEm: vigente?.desativadoEm ?? null,
    };
  }

  async desativar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<DesativacaoDoColaborador> {
    const empresaId = await this.resolverEmpresa(colaboradorId, ctx);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const vigente = await tx.desativacaoColaborador.findFirst({
          where: { colaboradorId, empresaId, reativadoEm: null },
          select: { desativadoEm: true },
        });
        if (vigente) {
          return {
            colaboradorId,
            empresaId,
            desativado: true,
            desativadoEm: vigente.desativadoEm,
          };
        }
        const criada = await tx.desativacaoColaborador.create({
          data: { colaboradorId, empresaId, desativadoPorId: ctx.actor.id },
          select: { desativadoEm: true },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_colaborador_desativado",
          "colaborador",
          colaboradorId,
          empresaId,
        );
        return {
          colaboradorId,
          empresaId,
          desativado: true,
          desativadoEm: criada.desativadoEm,
        };
      });
    } catch (erro) {
      if (!eDesativacaoVigenteDuplicada(erro)) throw erro;
      // Outra aba desativou no mesmo instante: o estado é o dela.
      return {
        colaboradorId,
        empresaId,
        ...(await this.estado(colaboradorId, empresaId)),
      };
    }
  }

  async reativar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<DesativacaoDoColaborador> {
    const empresaId = await this.resolverEmpresa(colaboradorId, ctx);
    return this.prisma.$transaction(async (tx) => {
      const fechadas = await tx.desativacaoColaborador.updateMany({
        where: { colaboradorId, empresaId, reativadoEm: null },
        data: { reativadoEm: new Date(), reativadoPorId: ctx.actor.id },
      });
      if (fechadas.count > 0) {
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_colaborador_reativado",
          "colaborador",
          colaboradorId,
          empresaId,
        );
      }
      return {
        colaboradorId,
        empresaId,
        desativado: false,
        desativadoEm: null,
      };
    });
  }

  /**
   * A empresa ativa da sessão, se a pessoa tem vínculo nela e o papel
   * altera colaboradores ali. O master técnico não desativa (o guard já o
   * recusa; aqui é defesa em profundidade).
   */
  private async resolverEmpresa(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<string> {
    if (ctx.actor.role === "master_tecnico") throw new ForbiddenException();
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) throw new ForbiddenException();
    const { empresaId } = escopo;
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId },
      select: { id: true },
    });
    if (
      vinculo === null ||
      !podeAcessarPessoas(ctx.actor, "colaborador", "alter", empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaboradorId,
        empresaId,
      );
    }
    return empresaId;
  }
}
