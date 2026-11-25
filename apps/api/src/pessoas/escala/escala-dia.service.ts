import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  ErroDeCampo,
} from "../../common/erros/recusa-por-campo";
import { semDesativacaoVigente } from "../colaborador/desativacao";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { conferirDia, type Periodo } from "./dia-da-escala";
import { DiaDoQuadroDto, GravarDiaDto } from "./escala-dia.dto";

/** Um dia gravado no quadro (rascunho ou publicado). */
export interface DiaGravado {
  dia: string;
  camada: "rascunho" | "publicado";
  tipo: "trabalho" | "folga" | "dsr" | "sobreaviso";
  turno: {
    id: string;
    nome: string;
    cor: string | null;
    sigla: string | null;
  } | null;
  periodos: Periodo[];
  intervaloMinutos: number;
  sobreaviso: Periodo[];
  unidade: { id: string; nome: string } | null;
  observacao: string | null;
}

export const PROJECAO_DO_DIA = {
  dia: true,
  camada: true,
  tipo: true,
  periodos: true,
  intervaloMinutos: true,
  sobreaviso: true,
  observacao: true,
  turno: { select: { id: true, nome: true, cor: true, sigla: true } },
  unidade: { select: { id: true, nome: true } },
} as const satisfies Prisma.EscalaDiaSelect;

type LinhaDoDia = Prisma.EscalaDiaGetPayload<{
  select: typeof PROJECAO_DO_DIA;
}>;

function periodosDe(valor: Prisma.JsonValue): Periodo[] {
  return Array.isArray(valor)
    ? valor.map((p) => {
        const o = p as { inicio?: unknown; fim?: unknown };
        return { inicio: String(o.inicio), fim: String(o.fim) };
      })
    : [];
}

export function projetarDia(l: LinhaDoDia): DiaGravado {
  return {
    dia: l.dia.toISOString().slice(0, 10),
    camada: l.camada as DiaGravado["camada"],
    tipo: l.tipo as DiaGravado["tipo"],
    turno: l.turno,
    periodos: periodosDe(l.periodos),
    intervaloMinutos: l.intervaloMinutos,
    sobreaviso: periodosDe(l.sobreaviso),
    unidade: l.unidade,
    observacao: l.observacao,
  };
}

function recusar(...erros: ErroDeCampo[]): never {
  throw new CamposRecusadosException(erros);
}

function dataDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/**
 * T215 — o dia do quadro "Escala de trabalho" no RASCUNHO: gravar (menu da
 * célula e painel do dia) e limpar (volta ao padrão da pessoa). O publicado
 * só muda ao publicar.
 *
 * - `rh` e `dp` na empresa ativa (o guard nega os demais; o
 *   `master_tecnico` só lê o quadro).
 * - O dia precisa estar no vínculo da pessoa na empresa (de quem não está
 *   desativado); fora disso — ou pessoa de outra empresa —, `fora_do_vinculo`.
 * - Turno: jornada ATIVA da empresa; local: unidade ATIVA da empresa.
 * - A trilha leva só ação, recurso, empresa e o id do dia.
 */
@Injectable()
export class EscalaDiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private empresaDaSessao(ctx: PessoasAuditContext): string {
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) throw new ForbiddenException();
    return escopo.empresaId;
  }

  private async conferirVinculo(
    empresaId: string,
    colaboradorId: string,
    dia: Date,
  ): Promise<void> {
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: {
        colaboradorId,
        empresaId,
        dataAdmissao: { lte: dia },
        OR: [{ dataDesligamento: null }, { dataDesligamento: { gte: dia } }],
        colaborador: semDesativacaoVigente(empresaId),
      },
      select: { id: true },
    });
    if (vinculo === null) recusar({ campo: "dia", motivo: "fora_do_vinculo" });
  }

  async gravar(
    dto: GravarDiaDto,
    ctx: PessoasAuditContext,
  ): Promise<DiaGravado> {
    const empresaId = this.empresaDaSessao(ctx);
    const dia = dataDoDia(dto.dia);

    const regras = conferirDia(dto);
    if (regras.length > 0) recusar(...regras);
    await this.conferirVinculo(empresaId, dto.colaboradorId, dia);

    // `conferirDia` já recusou o que não se aplica ao tipo.
    const turnoId = dto.tabelaHorarioId ?? null;
    if (turnoId !== null) {
      const turno = await this.prisma.tabelaHorario.findFirst({
        where: { id: turnoId, empresaId, ativo: true },
        select: { id: true },
      });
      if (turno === null) {
        recusar({ campo: "tabelaHorarioId", motivo: "indisponivel" });
      }
    }
    const unidadeId = dto.unidadeOrganizacionalId ?? null;
    if (unidadeId !== null) {
      const unidade = await this.prisma.unidadeOrganizacional.findFirst({
        where: { id: unidadeId, empresaId, status: "ativo" },
        select: { id: true },
      });
      if (unidade === null) {
        recusar({ campo: "unidadeOrganizacionalId", motivo: "indisponivel" });
      }
    }

    const observacao = dto.observacao?.trim() || null;
    const dados = {
      tipo: dto.tipo,
      tabelaHorarioId: turnoId,
      periodos: (dto.periodos ?? []).map((p) => ({
        inicio: p.inicio,
        fim: p.fim,
      })) as Prisma.InputJsonValue,
      intervaloMinutos: dto.intervaloMinutos ?? 0,
      sobreaviso: (dto.sobreaviso ?? []).map((p) => ({
        inicio: p.inicio,
        fim: p.fim,
      })) as Prisma.InputJsonValue,
      unidadeOrganizacionalId: unidadeId,
      observacao,
      atualizadoPorUserId: ctx.actor.id,
    };

    return this.prisma.$transaction(async (tx) => {
      const linha = await tx.escalaDia.upsert({
        where: {
          colaboradorId_empresaId_dia_camada: {
            colaboradorId: dto.colaboradorId,
            empresaId,
            dia,
            camada: "rascunho",
          },
        },
        create: {
          ...dados,
          colaboradorId: dto.colaboradorId,
          empresaId,
          dia,
          camada: "rascunho",
          criadoPorUserId: ctx.actor.id,
        },
        update: dados,
        select: { ...PROJECAO_DO_DIA, id: true },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_escala_dia_gravado",
        "escala_colaborador",
        linha.id,
        empresaId,
      );
      return projetarDia(linha);
    });
  }

  /** Desfaz a mudança do dia no rascunho; idempotente. */
  async limpar(
    dto: DiaDoQuadroDto,
    ctx: PessoasAuditContext,
  ): Promise<{ colaboradorId: string; dia: string; limpo: boolean }> {
    const empresaId = this.empresaDaSessao(ctx);
    const dia = dataDoDia(dto.dia);
    await this.conferirVinculo(empresaId, dto.colaboradorId, dia);
    return this.prisma.$transaction(async (tx) => {
      const linha = await tx.escalaDia.findUnique({
        where: {
          colaboradorId_empresaId_dia_camada: {
            colaboradorId: dto.colaboradorId,
            empresaId,
            dia,
            camada: "rascunho",
          },
        },
        select: { id: true },
      });
      if (linha === null) {
        return { colaboradorId: dto.colaboradorId, dia: dto.dia, limpo: false };
      }
      await tx.escalaDia.delete({ where: { id: linha.id } });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_escala_dia_limpo",
        "escala_colaborador",
        linha.id,
        empresaId,
      );
      return { colaboradorId: dto.colaboradorId, dia: dto.dia, limpo: true };
    });
  }
}
