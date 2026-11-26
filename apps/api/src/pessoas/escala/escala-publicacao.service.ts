import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IsBoolean, IsDateString, Matches } from "class-validator";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  RecusaDeNegocioException,
} from "../../common/erros/recusa-por-campo";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { DIAS_NO_QUADRO } from "./quadro-escala.service";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 24 * 60 * 60 * 1000;

/** T215 — "Publicar a escala": o período (os dois dias contam) e o aviso. */
export class PublicarEscalaDto {
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  fim!: string;

  /** Avisar as pessoas pelo Portal e por e-mail (só quem teve mudança). */
  @IsBoolean()
  avisar!: boolean;
}

/** A publicação como o quadro mostra ("Publicada em 25/11 por Ana"). */
export interface PublicacaoDaEscala {
  id: string;
  inicio: string;
  fim: string;
  novas: number;
  alteradas: number;
  pessoas: number;
  avisar: boolean;
  publicadaEm: string;
  publicadaPor: string | null;
}

export const PROJECAO_DA_PUBLICACAO = {
  id: true,
  inicio: true,
  fim: true,
  novas: true,
  alteradas: true,
  pessoas: true,
  avisar: true,
  publicadoEm: true,
  publicadoPor: { select: { nomeExibicao: true } },
} as const satisfies Prisma.EscalaPublicacaoSelect;

export function projetarPublicacao(
  l: Prisma.EscalaPublicacaoGetPayload<{
    select: typeof PROJECAO_DA_PUBLICACAO;
  }>,
): PublicacaoDaEscala {
  return {
    id: l.id,
    inicio: l.inicio.toISOString().slice(0, 10),
    fim: l.fim.toISOString().slice(0, 10),
    novas: l.novas,
    alteradas: l.alteradas,
    pessoas: l.pessoas,
    avisar: l.avisar,
    publicadaEm: l.publicadoEm.toISOString(),
    publicadaPor: l.publicadoPor.nomeExibicao,
  };
}

function dataDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/**
 * T215 — publicar a escala: todo o RASCUNHO do período vira PUBLICADO (o dia
 * publicado é trocado, ou criado), o rascunho sai, e a publicação fica
 * registrada (novas, alteradas, pessoas, aviso pedido). Numa transação.
 *
 * - `rh` e `dp` na empresa ativa (o guard nega os demais).
 * - Sem mudança no rascunho do período: 422 `escala_nada_para_publicar`.
 * - O aviso às pessoas fica registrado; o envio depende do Portal e do
 *   e-mail (fora desta fatia; ligação pendente em
 *   docs/decisions/ligacoes-pendentes-modulos-futuros.md, item 3).
 * - A trilha leva só ação, recurso, empresa e o id da publicação.
 */
@Injectable()
export class EscalaPublicacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  async publicar(
    dto: PublicarEscalaDto,
    ctx: PessoasAuditContext,
  ): Promise<PublicacaoDaEscala> {
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) throw new ForbiddenException();
    const { empresaId } = escopo;

    const inicio = dataDoDia(dto.inicio);
    const fim = dataDoDia(dto.fim);
    const dias = Math.round((fim.getTime() - inicio.getTime()) / MS_DIA) + 1;
    if (dias < 1) {
      throw new CamposRecusadosException([
        { campo: "fim", motivo: "fora_de_ordem" },
      ]);
    }
    if (dias > DIAS_NO_QUADRO) {
      throw new CamposRecusadosException([
        { campo: "fim", motivo: "invalido" },
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      const rascunhos = await tx.escalaDia.findMany({
        where: {
          empresaId,
          camada: "rascunho",
          dia: { gte: inicio, lte: fim },
        },
      });
      if (rascunhos.length === 0) {
        throw new RecusaDeNegocioException("escala_nada_para_publicar");
      }

      let novas = 0;
      let alteradas = 0;
      for (const r of rascunhos) {
        const dados = {
          tipo: r.tipo,
          tabelaHorarioId: r.tabelaHorarioId,
          periodos: r.periodos as Prisma.InputJsonValue,
          intervaloMinutos: r.intervaloMinutos,
          sobreaviso: r.sobreaviso as Prisma.InputJsonValue,
          unidadeOrganizacionalId: r.unidadeOrganizacionalId,
          observacao: r.observacao,
          atualizadoPorUserId: ctx.actor.id,
        };
        const chave = {
          colaboradorId: r.colaboradorId,
          empresaId,
          dia: r.dia,
          camada: "publicado",
        };
        const publicado = await tx.escalaDia.findUnique({
          where: { colaboradorId_empresaId_dia_camada: chave },
          select: { id: true },
        });
        if (publicado) {
          alteradas += 1;
          await tx.escalaDia.update({
            where: { id: publicado.id },
            data: dados,
          });
        } else {
          novas += 1;
          await tx.escalaDia.create({
            data: { ...chave, ...dados, criadoPorUserId: ctx.actor.id },
          });
        }
        await tx.escalaDia.delete({ where: { id: r.id } });
      }

      const linha = await tx.escalaPublicacao.create({
        data: {
          empresaId,
          inicio,
          fim,
          novas,
          alteradas,
          pessoas: new Set(rascunhos.map((r) => r.colaboradorId)).size,
          avisar: dto.avisar,
          publicadoPorUserId: ctx.actor.id,
        },
        select: PROJECAO_DA_PUBLICACAO,
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_escala_publicada",
        "escala_colaborador",
        linha.id,
        empresaId,
      );
      return projetarPublicacao(linha);
    });
  }
}
