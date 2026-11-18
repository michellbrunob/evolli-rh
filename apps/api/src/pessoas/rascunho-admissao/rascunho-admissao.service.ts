import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import type { PessoasAuditContext } from "../pessoas.types";
import {
  podeAcessarPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import {
  filtrarDadosDoRascunho,
  type DadosDoRascunho,
} from "./dados-do-rascunho";

export interface RascunhoAdmissaoApi {
  readonly dados: DadosDoRascunho;
  readonly versao: number;
  readonly atualizadoEm: string;
}

/**
 * T209 — rascunho da Nova admissão, por conta e empresa ativa.
 *
 * Mesma capacidade da admissão (`colaborador:create`), reavaliada com a
 * empresa ativa da sessão (nunca do corpo): RH e DP; `master_tecnico`,
 * gestor e os demais papéis não têm rascunho. Cada conta só vê o próprio.
 * Salvar e descartar deixam trilha, sem o conteúdo. Salvar nunca cria
 * colaborador, vínculo ou movimentação.
 */
@Injectable()
export class RascunhoAdmissaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private async escopo(ctx: PessoasAuditContext): Promise<string> {
    const { empresaId } = resolverEscopoPessoas(ctx.actor);
    if (!podeAcessarPessoas(ctx.actor, "colaborador", "create", empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        "rascunho_admissao",
        null,
        empresaId,
      );
    }
    return empresaId;
  }

  async obter(
    ctx: PessoasAuditContext,
  ): Promise<{ rascunho: RascunhoAdmissaoApi | null }> {
    const empresaId = await this.escopo(ctx);
    const linha = await this.prisma.rascunhoAdmissao.findUnique({
      where: {
        atorUserId_empresaId: { atorUserId: ctx.actor.id, empresaId },
      },
    });
    if (!linha) return { rascunho: null };
    return {
      rascunho: {
        dados: linha.dados as DadosDoRascunho,
        versao: linha.versao,
        atualizadoEm: linha.atualizadoEm.toISOString(),
      },
    };
  }

  async salvar(
    entrada: unknown,
    ctx: PessoasAuditContext,
  ): Promise<{ versao: number; atualizadoEm: string }> {
    const empresaId = await this.escopo(ctx);
    const dados = filtrarDadosDoRascunho(entrada);
    return this.prisma.$transaction(async (tx) => {
      const linha = await tx.rascunhoAdmissao.upsert({
        where: {
          atorUserId_empresaId: { atorUserId: ctx.actor.id, empresaId },
        },
        create: {
          atorUserId: ctx.actor.id,
          empresaId,
          dados: dados as Prisma.InputJsonValue,
        },
        update: {
          dados: dados as Prisma.InputJsonValue,
          versao: { increment: 1 },
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_rascunho_admissao_salvo",
        "rascunho_admissao",
        linha.id,
        empresaId,
      );
      return {
        versao: linha.versao,
        atualizadoEm: linha.atualizadoEm.toISOString(),
      };
    });
  }

  /** Descarta o rascunho (sem rascunho, nada acontece). */
  async descartar(ctx: PessoasAuditContext): Promise<void> {
    const empresaId = await this.escopo(ctx);
    await this.prisma.$transaction(async (tx) => {
      const linha = await tx.rascunhoAdmissao.findUnique({
        where: {
          atorUserId_empresaId: { atorUserId: ctx.actor.id, empresaId },
        },
        select: { id: true },
      });
      if (!linha) return;
      await tx.rascunhoAdmissao.delete({ where: { id: linha.id } });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_rascunho_admissao_descartado",
        "rascunho_admissao",
        linha.id,
        empresaId,
      );
    });
  }
}
