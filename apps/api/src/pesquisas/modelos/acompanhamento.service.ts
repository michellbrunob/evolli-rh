import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../../pessoas/pessoas-auditoria.service";
import type { PessoasAuditContext } from "../../pessoas/pessoas.types";
import { PesquisasService } from "../pesquisas.service";
import {
  acompanhamentoVazio,
  conferirAcompanhamento,
  detalharAcompanhamento,
  lerAcompanhamento,
  type AcompanhamentoNr1Detalhe,
} from "./copsoq/acompanhamento";

/**
 * T216 — conformidade com a NR-1 (riscos psicossociais): as 7 etapas que a
 * empresa marca e guarda e o plano de ação escrito pelo RH, em
 * `pesquisa.acompanhamento`. O resultado do modelo sai pelos resultados da
 * pesquisa (`ResultadosPesquisa.modelo`); aqui fica só o acompanhamento.
 */
@Injectable()
export class AcompanhamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pesquisas: PesquisasService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private async detalhe(
    p: { id: string; identificacao: string; publicadaEm: Date | null },
    bruto: unknown,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const [respostas, participantes] = await Promise.all([
      this.prisma.pesquisaResposta.count({ where: { pesquisaId: p.id } }),
      this.prisma.pesquisaParticipante.count({ where: { pesquisaId: p.id } }),
    ]);
    return detalharAcompanhamento(lerAcompanhamento(bruto), {
      anonima: p.identificacao === "anonima",
      respostas,
      participantes,
      publicadaEm: p.publicadaEm,
    });
  }

  async obter(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const { pesquisa: p } = await this.pesquisas.pesquisaDoModelo(
      this.prisma,
      id,
      "leitura",
      ctx,
    );
    if (p.modelo !== "copsoq") throw new NotFoundException();
    return this.detalhe(p, p.acompanhamento ?? acompanhamentoVazio());
  }

  async gravar(
    id: string,
    corpo: unknown,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const gravado = await this.prisma.$transaction(async (tx) => {
      const { pesquisa: p, empresaId } = await this.pesquisas.pesquisaDoModelo(
        tx,
        id,
        "escrita",
        ctx,
      );
      if (p.modelo !== "copsoq") throw new NotFoundException();
      const conferido = conferirAcompanhamento(
        corpo,
        lerAcompanhamento(p.acompanhamento),
        new Date(),
      );
      if (!conferido.ok) throw new CamposRecusadosException(conferido.erros);
      const novo = await tx.pesquisa.update({
        where: { id: p.id },
        data: {
          acompanhamento: conferido.valor as unknown as Prisma.InputJsonValue,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_alterada",
        "pesquisa",
        p.id,
        empresaId,
      );
      return novo;
    });
    return this.detalhe(gravado, gravado.acompanhamento);
  }
}
