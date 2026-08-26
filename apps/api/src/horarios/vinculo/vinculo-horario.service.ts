import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, VinculoHorario } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { HorariosAuditoriaService } from "../horarios-auditoria.service";
import {
  HorariosAuditContext,
  ResultadoPaginado,
  TAMANHO_PAGINA_PADRAO,
} from "../horarios.types";
import {
  EscopoLeituraHorarios,
  deslocamento,
  filtroEmpresaLeituraHorarios,
  podeConsultarHorarios,
  resolverEscopoHorarios,
  resolverEscopoLeituraHorarios,
} from "../escopo-horarios.util";
import { traduzirErroHorario } from "../validacao-horarios.util";
import {
  CriarVinculoHorarioDto,
  EncerrarVinculoHorarioDto,
  ListarVinculosHorarioQueryDto,
} from "../dto/horarios.dto";

/** Projeção pública de um vínculo horário↔colaborador. */
interface VinculoProjetado {
  id: string;
  colaboradorId: string;
  empresaId: string;
  tabelaHorarioId: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoPorUserId: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

/** `Date` (coluna DATE, meia-noite UTC) -> `"YYYY-MM-DD"`. */
function dataIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** `"YYYY-MM-DD"` -> `Date` em meia-noite UTC, para coluna DATE. */
function dataDe(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Vínculo histórico de uma tabela de horário a um colaborador, com vigência
 * (T038). Só RH opera; a fronteira é `empresa_id`.
 *
 * A não sobreposição de vigências (um colaborador não tem duas tabelas válidas
 * para o mesmo dia na mesma empresa) é garantida pelo banco (EXCLUSION
 * CONSTRAINT + índice parcial); aqui, uma colisão vira 409. A coerência
 * colaborador↔empresa é validada na aplicação (404 anti-enumeração) e reforçada
 * por CONSTRAINT TRIGGER.
 */
@Injectable()
export class VinculoHorarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: HorariosAuditoriaService,
  ) {}

  async criar(
    dto: CriarVinculoHorarioDto,
    ctx: HorariosAuditContext,
  ): Promise<VinculoProjetado> {
    const escopo = resolverEscopoHorarios(ctx.actor);

    // O colaborador precisa ter vínculo funcional na empresa do ator. Sem isso,
    // 404 anti-enumeração (não confirma se o colaborador existe em outra
    // empresa). Reforçado por CONSTRAINT TRIGGER no banco.
    const vinculoFuncional = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId: dto.colaboradorId, empresaId: escopo.empresaId },
      select: { id: true },
    });
    if (vinculoFuncional === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_horario",
        dto.colaboradorId,
        escopo.empresaId,
      );
    }

    // A tabela precisa existir na mesma empresa. Fora do escopo -> 404.
    const tabela = await this.prisma.tabelaHorario.findFirst({
      where: { id: dto.tabelaHorarioId, empresaId: escopo.empresaId },
      select: { id: true, ativo: true },
    });
    if (tabela === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_horario",
        dto.tabelaHorarioId,
        escopo.empresaId,
      );
    }
    if (!tabela.ativo) {
      throw new UnprocessableEntityException(
        "Tabela de horario desativada nao pode ser vinculada.",
      );
    }

    const vigenciaInicio = dataDe(dto.vigenciaInicio);
    const vigenciaFim =
      dto.vigenciaFim !== undefined ? dataDe(dto.vigenciaFim) : null;

    if (vigenciaFim !== null && vigenciaFim <= vigenciaInicio) {
      throw new UnprocessableEntityException(
        "vigenciaFim deve ser posterior a vigenciaInicio.",
      );
    }

    try {
      const criado = await this.prisma.$transaction(async (tx) => {
        const vinculo = await tx.vinculoHorario.create({
          data: {
            colaboradorId: dto.colaboradorId,
            empresaId: escopo.empresaId,
            tabelaHorarioId: tabela.id,
            vigenciaInicio,
            vigenciaFim,
            criadoPorUserId: ctx.actor.id,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "horarios_vinculo_criado",
          "vinculo_horario",
          vinculo.id,
          escopo.empresaId,
        );

        return vinculo;
      });

      return this.projetar(criado);
    } catch (error) {
      traduzirErroHorario(error);
    }
  }

  async listar(
    query: ListarVinculosHorarioQueryDto,
    ctx: HorariosAuditContext,
  ): Promise<ResultadoPaginado<VinculoProjetado>> {
    const escopo = resolverEscopoLeituraHorarios(ctx.actor);

    const where: Prisma.VinculoHorarioWhereInput = {
      ...filtroEmpresaLeituraHorarios(escopo),
      ...(query.colaboradorId !== undefined && {
        colaboradorId: query.colaboradorId,
      }),
      ...(query.tabelaHorarioId !== undefined && {
        tabelaHorarioId: query.tabelaHorarioId,
      }),
    };

    const pagina = query.pagina ?? 1;
    const tamanhoPagina = query.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO;

    const [vinculos, total] = await Promise.all([
      this.prisma.vinculoHorario.findMany({
        where,
        orderBy: [{ vigenciaInicio: "desc" }, { id: "asc" }],
        skip: deslocamento(pagina, tamanhoPagina),
        take: tamanhoPagina,
      }),
      this.prisma.vinculoHorario.count({ where }),
    ]);

    await this.auditoria.registrarConsulta(
      ctx,
      "vinculo_horario",
      query.colaboradorId ?? null,
      escopo.global ? null : escopo.empresaId,
    );

    return {
      itens: vinculos.map((vinculo) => this.projetar(vinculo)),
      pagina,
      tamanhoPagina,
      total,
    };
  }

  async detalhar(
    vinculoId: string,
    ctx: HorariosAuditContext,
  ): Promise<VinculoProjetado> {
    const { vinculo, escopo } = await this.carregar(vinculoId, ctx);

    await this.auditoria.registrarConsulta(
      ctx,
      "vinculo_horario",
      vinculo.id,
      escopo.global ? null : escopo.empresaId,
    );

    return this.projetar(vinculo);
  }

  /**
   * Encerra a vigência de um vínculo aberto — o mecanismo de troca de horário,
   * que preserva o histórico (a definição do período já decorrido não muda).
   * Só RH, só na própria empresa.
   */
  async encerrar(
    vinculoId: string,
    dto: EncerrarVinculoHorarioDto,
    ctx: HorariosAuditContext,
  ): Promise<VinculoProjetado> {
    const escopo = resolverEscopoHorarios(ctx.actor);

    const vinculo = await this.prisma.vinculoHorario.findFirst({
      where: { id: vinculoId, empresaId: escopo.empresaId },
      select: {
        id: true,
        empresaId: true,
        vigenciaInicio: true,
        vigenciaFim: true,
      },
    });

    if (vinculo === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_horario",
        vinculoId,
        escopo.empresaId,
      );
    }

    if (vinculo.vigenciaFim !== null) {
      throw new UnprocessableEntityException(
        "Vinculo ja encerrado. Registre um novo vinculo para nova vigencia.",
      );
    }

    const vigenciaFim = dataDe(dto.vigenciaFim);
    if (vigenciaFim <= vinculo.vigenciaInicio) {
      throw new UnprocessableEntityException(
        "vigenciaFim deve ser posterior a vigenciaInicio.",
      );
    }

    try {
      const encerrado = await this.prisma.$transaction(async (tx) => {
        const atualizado = await tx.vinculoHorario.update({
          where: { id: vinculo.id },
          data: { vigenciaFim },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "horarios_vinculo_encerrado",
          "vinculo_horario",
          vinculo.id,
          vinculo.empresaId,
        );

        return atualizado;
      });

      return this.projetar(encerrado);
    } catch (error) {
      traduzirErroHorario(error);
    }
  }

  /**
   * Carrega um vínculo já escopado por empresa, negando (404 + `denied`) o que
   * estiver fora do escopo do ator.
   */
  private async carregar(
    vinculoId: string,
    ctx: HorariosAuditContext,
  ): Promise<{ vinculo: VinculoHorario; escopo: EscopoLeituraHorarios }> {
    const escopo = resolverEscopoLeituraHorarios(ctx.actor);

    const vinculo = await this.prisma.vinculoHorario.findFirst({
      where: { id: vinculoId, ...filtroEmpresaLeituraHorarios(escopo) },
    });

    if (vinculo === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_horario",
        vinculoId,
        escopo.global ? null : escopo.empresaId,
      );
    }

    if (!podeConsultarHorarios(ctx.actor, "vinculo_horario", "read", escopo)) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_horario",
        vinculoId,
        vinculo.empresaId,
      );
    }

    return { vinculo, escopo };
  }

  private projetar(vinculo: VinculoHorario): VinculoProjetado {
    return {
      id: vinculo.id,
      colaboradorId: vinculo.colaboradorId,
      empresaId: vinculo.empresaId,
      tabelaHorarioId: vinculo.tabelaHorarioId,
      vigenciaInicio: dataIso(vinculo.vigenciaInicio),
      vigenciaFim:
        vinculo.vigenciaFim !== null ? dataIso(vinculo.vigenciaFim) : null,
      criadoPorUserId: vinculo.criadoPorUserId,
      criadoEm: vinculo.criadoEm,
      atualizadoEm: vinculo.atualizadoEm,
    };
  }
}
