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

  /**
   * Confere um ou mais dias (forma, vínculo, turno e local) e devolve os
   * dados a gravar, na ordem. A primeira recusa interrompe tudo.
   */
  private async preparar(
    empresaId: string,
    dtos: readonly GravarDiaDto[],
    ctx: PessoasAuditContext,
  ) {
    for (const dto of dtos) {
      const regras = conferirDia(dto);
      if (regras.length > 0) recusar(...regras);
    }
    await this.conferirVinculos(
      empresaId,
      dtos.map((d) => ({ colaboradorId: d.colaboradorId, dia: d.dia })),
    );

    const turnos = [
      ...new Set(
        dtos.map((d) => d.tabelaHorarioId).filter((x): x is string => !!x),
      ),
    ];
    if (turnos.length > 0) {
      const ativos = await this.prisma.tabelaHorario.count({
        where: { id: { in: turnos }, empresaId, ativo: true },
      });
      if (ativos !== turnos.length) {
        recusar({ campo: "tabelaHorarioId", motivo: "indisponivel" });
      }
    }
    const unidades = [
      ...new Set(
        dtos
          .map((d) => d.unidadeOrganizacionalId)
          .filter((x): x is string => !!x),
      ),
    ];
    if (unidades.length > 0) {
      const ativas = await this.prisma.unidadeOrganizacional.count({
        where: { id: { in: unidades }, empresaId, status: "ativo" },
      });
      if (ativas !== unidades.length) {
        recusar({ campo: "unidadeOrganizacionalId", motivo: "indisponivel" });
      }
    }

    // `conferirDia` já recusou o que não se aplica ao tipo.
    return dtos.map((dto) => ({
      colaboradorId: dto.colaboradorId,
      dia: dataDoDia(dto.dia),
      dados: {
        tipo: dto.tipo,
        tabelaHorarioId: dto.tabelaHorarioId ?? null,
        periodos: (dto.periodos ?? []).map((p) => ({
          inicio: p.inicio,
          fim: p.fim,
        })) as Prisma.InputJsonValue,
        intervaloMinutos: dto.intervaloMinutos ?? 0,
        sobreaviso: (dto.sobreaviso ?? []).map((p) => ({
          inicio: p.inicio,
          fim: p.fim,
        })) as Prisma.InputJsonValue,
        unidadeOrganizacionalId: dto.unidadeOrganizacionalId ?? null,
        observacao: dto.observacao?.trim() || null,
        atualizadoPorUserId: ctx.actor.id,
      },
    }));
  }

  /** Cada dia está no vínculo da pessoa na empresa (sem desativação). */
  private async conferirVinculos(
    empresaId: string,
    itens: readonly { colaboradorId: string; dia: string }[],
  ): Promise<void> {
    const ids = [...new Set(itens.map((i) => i.colaboradorId))];
    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: {
        colaboradorId: { in: ids },
        empresaId,
        colaborador: semDesativacaoVigente(empresaId),
      },
      select: {
        colaboradorId: true,
        dataAdmissao: true,
        dataDesligamento: true,
      },
    });
    for (const item of itens) {
      const dia = dataDoDia(item.dia);
      const dentro = vinculos.some(
        (v) =>
          v.colaboradorId === item.colaboradorId &&
          v.dataAdmissao <= dia &&
          (v.dataDesligamento === null || v.dataDesligamento >= dia),
      );
      if (!dentro) recusar({ campo: "dia", motivo: "fora_do_vinculo" });
    }
  }

  async gravar(
    dto: GravarDiaDto,
    ctx: PessoasAuditContext,
  ): Promise<DiaGravado> {
    const [gravado] = await this.gravarLote([dto], ctx);
    // O dia sozinho não leva a pessoa (quem chamou já sabe quem é).
    const dia: DiaGravado & { colaboradorId?: string } = { ...gravado! };
    delete dia.colaboradorId;
    return dia;
  }

  /**
   * T215 — vários dias de uma vez (ações em massa, copiar e repetir semana,
   * desfazer): tudo ou nada, numa transação; um evento de trilha por dia.
   */
  async gravarLote(
    dtos: readonly GravarDiaDto[],
    ctx: PessoasAuditContext,
  ): Promise<(DiaGravado & { colaboradorId: string })[]> {
    const empresaId = this.empresaDaSessao(ctx);
    const preparados = await this.preparar(empresaId, dtos, ctx);
    return this.prisma.$transaction(
      async (tx) => {
        const gravados: (DiaGravado & { colaboradorId: string })[] = [];
        for (const p of preparados) {
          const linha = await tx.escalaDia.upsert({
            where: {
              colaboradorId_empresaId_dia_camada: {
                colaboradorId: p.colaboradorId,
                empresaId,
                dia: p.dia,
                camada: "rascunho",
              },
            },
            create: {
              ...p.dados,
              colaboradorId: p.colaboradorId,
              empresaId,
              dia: p.dia,
              camada: "rascunho",
              criadoPorUserId: ctx.actor.id,
            },
            update: p.dados,
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
          gravados.push({
            colaboradorId: p.colaboradorId,
            ...projetarDia(linha),
          });
        }
        return gravados;
      },
      { timeout: 60_000 },
    );
  }

  /** Desfaz a mudança do dia no rascunho; idempotente. */
  async limpar(
    dto: DiaDoQuadroDto,
    ctx: PessoasAuditContext,
  ): Promise<{ colaboradorId: string; dia: string; limpo: boolean }> {
    const [r] = await this.limparLote([dto], ctx);
    return r!;
  }

  /** T215 — desfaz a mudança de vários dias no rascunho; idempotente. */
  async limparLote(
    itens: readonly DiaDoQuadroDto[],
    ctx: PessoasAuditContext,
  ): Promise<{ colaboradorId: string; dia: string; limpo: boolean }[]> {
    const empresaId = this.empresaDaSessao(ctx);
    await this.conferirVinculos(empresaId, itens);
    return this.prisma.$transaction(
      async (tx) => {
        const resultado: {
          colaboradorId: string;
          dia: string;
          limpo: boolean;
        }[] = [];
        for (const item of itens) {
          const linha = await tx.escalaDia.findUnique({
            where: {
              colaboradorId_empresaId_dia_camada: {
                colaboradorId: item.colaboradorId,
                empresaId,
                dia: dataDoDia(item.dia),
                camada: "rascunho",
              },
            },
            select: { id: true },
          });
          if (linha === null) {
            resultado.push({ ...item, limpo: false });
            continue;
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
          resultado.push({ ...item, limpo: true });
        }
        return resultado;
      },
      { timeout: 60_000 },
    );
  }
}
