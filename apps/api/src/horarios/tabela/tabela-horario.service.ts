import { Injectable } from "@nestjs/common";
import { PeriodoHorario, Prisma, TabelaHorario } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { HorariosAuditoriaService } from "../horarios-auditoria.service";
import {
  HorariosAuditContext,
  ResultadoPaginado,
  TAMANHO_PAGINA_PADRAO,
} from "../horarios.types";
import {
  deslocamento,
  filtroEmpresaLeituraHorarios,
  podeConsultarHorarios,
  resolverEscopoHorarios,
  resolverEscopoLeituraHorarios,
} from "../escopo-horarios.util";
import {
  formatarHora,
  normalizarPeriodos,
  numeroParaDia,
  traduzirErroHorario,
} from "../validacao-horarios.util";
import {
  CriarTabelaHorarioDto,
  ListarTabelasHorarioQueryDto,
} from "../dto/horarios.dto";

/** Projeção pública de um período. Sem id interno — a definição é imutável. */
interface PeriodoProjetado {
  dia: string;
  inicio: string;
  fim: string;
}

/** Projeção pública de uma tabela de horário. */
interface TabelaProjetada {
  id: string;
  empresaId: string;
  nome: string;
  ativo: boolean;
  criadoPorUserId: string;
  criadoEm: Date;
  atualizadoEm: Date;
  periodos: PeriodoProjetado[];
}

const ORDEM_PERIODOS = [
  { diaSemana: "asc" },
  { inicioMinuto: "asc" },
] satisfies Prisma.PeriodoHorarioOrderByWithRelationInput[];

/**
 * Cadastro de tabelas de horário (T038).
 *
 * ### O que este service nunca faz
 *
 * Não edita a definição (períodos) de uma tabela já criada — não há caminho de
 * código para isso, e `periodo_horario` é imutável no banco (`evolli_app` sem
 * `UPDATE`/`DELETE`, migration T038). "Alterar" um horário é criar uma tabela
 * nova (revisão). Não apaga nada fisicamente: desativação é lógica (`ativo`).
 *
 * Não calcula jornada, tolerância, banco de horas nem DSR — fora de escopo.
 *
 * ### Isolamento por empresa
 *
 * Toda consulta é construída com `empresaId` derivado da sessão; a checagem
 * explícita é a segunda camada, que produz o evento `denied` antes do 404.
 */
@Injectable()
export class TabelaHorarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: HorariosAuditoriaService,
  ) {}

  async criar(
    dto: CriarTabelaHorarioDto,
    ctx: HorariosAuditContext,
  ): Promise<TabelaProjetada> {
    const escopo = resolverEscopoHorarios(ctx.actor);
    const periodos = normalizarPeriodos(
      dto.periodos.map((p) => ({ dia: p.dia, inicio: p.inicio, fim: p.fim })),
    );

    try {
      const criada = await this.prisma.$transaction(async (tx) => {
        const tabela = await tx.tabelaHorario.create({
          data: {
            empresaId: escopo.empresaId,
            nome: dto.nome,
            criadoPorUserId: ctx.actor.id,
            periodos: {
              create: periodos.map((p) => ({
                diaSemana: p.diaSemana,
                inicioMinuto: p.inicioMinuto,
                fimMinuto: p.fimMinuto,
              })),
            },
          },
          include: { periodos: { orderBy: ORDEM_PERIODOS } },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "horarios_tabela_criada",
          "tabela_horario",
          tabela.id,
          escopo.empresaId,
        );

        return tabela;
      });

      return this.projetar(criada, criada.periodos);
    } catch (error) {
      traduzirErroHorario(error);
    }
  }

  async listar(
    query: ListarTabelasHorarioQueryDto,
    ctx: HorariosAuditContext,
  ): Promise<ResultadoPaginado<TabelaProjetada>> {
    const escopo = resolverEscopoLeituraHorarios(ctx.actor);

    const where: Prisma.TabelaHorarioWhereInput = {
      ...filtroEmpresaLeituraHorarios(escopo),
      ...(query.ativo !== undefined && { ativo: query.ativo }),
    };

    const pagina = query.pagina ?? 1;
    const tamanhoPagina = query.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO;

    const [tabelas, total] = await Promise.all([
      this.prisma.tabelaHorario.findMany({
        where,
        orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
        skip: deslocamento(pagina, tamanhoPagina),
        take: tamanhoPagina,
        include: { periodos: { orderBy: ORDEM_PERIODOS } },
      }),
      this.prisma.tabelaHorario.count({ where }),
    ]);

    await this.auditoria.registrarConsulta(
      ctx,
      "tabela_horario",
      null,
      escopo.global ? null : escopo.empresaId,
    );

    return {
      itens: tabelas.map((tabela) => this.projetar(tabela, tabela.periodos)),
      pagina,
      tamanhoPagina,
      total,
    };
  }

  async detalhar(
    tabelaId: string,
    ctx: HorariosAuditContext,
  ): Promise<TabelaProjetada> {
    const escopo = resolverEscopoLeituraHorarios(ctx.actor);

    const tabela = await this.prisma.tabelaHorario.findFirst({
      where: { id: tabelaId, ...filtroEmpresaLeituraHorarios(escopo) },
      include: { periodos: { orderBy: ORDEM_PERIODOS } },
    });

    if (tabela === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "tabela_horario",
        tabelaId,
        escopo.global ? null : escopo.empresaId,
      );
    }

    if (!podeConsultarHorarios(ctx.actor, "tabela_horario", "read", escopo)) {
      return this.auditoria.negarAcesso(
        ctx,
        "tabela_horario",
        tabelaId,
        tabela.empresaId,
      );
    }

    await this.auditoria.registrarConsulta(
      ctx,
      "tabela_horario",
      tabela.id,
      escopo.global ? null : escopo.empresaId,
    );

    return this.projetar(tabela, tabela.periodos);
  }

  async desativar(
    tabelaId: string,
    ctx: HorariosAuditContext,
  ): Promise<TabelaProjetada> {
    return this.mudarEstado(tabelaId, false, ctx);
  }

  async reativar(
    tabelaId: string,
    ctx: HorariosAuditContext,
  ): Promise<TabelaProjetada> {
    return this.mudarEstado(tabelaId, true, ctx);
  }

  /**
   * Muda o estado lógico (`ativo`) de uma tabela — desativação é lógica, sem
   * exclusão física (T037). Só RH, só na própria empresa. O que já existe de
   * vínculos históricos usando a tabela permanece intacto.
   */
  private async mudarEstado(
    tabelaId: string,
    ativo: boolean,
    ctx: HorariosAuditContext,
  ): Promise<TabelaProjetada> {
    const escopo = resolverEscopoHorarios(ctx.actor);

    // Busca já escopada: tabela de outra empresa não é encontrada aqui.
    const tabela = await this.prisma.tabelaHorario.findFirst({
      where: { id: tabelaId, empresaId: escopo.empresaId },
      select: { id: true, empresaId: true },
    });

    if (tabela === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "tabela_horario",
        tabelaId,
        escopo.empresaId,
      );
    }

    const action = ativo
      ? "horarios_tabela_reativada"
      : "horarios_tabela_desativada";

    try {
      const atualizada = await this.prisma.$transaction(async (tx) => {
        const tabelaAtualizada = await tx.tabelaHorario.update({
          where: { id: tabela.id },
          data: { ativo },
          include: { periodos: { orderBy: ORDEM_PERIODOS } },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          action,
          "tabela_horario",
          tabela.id,
          tabela.empresaId,
        );

        return tabelaAtualizada;
      });

      return this.projetar(atualizada, atualizada.periodos);
    } catch (error) {
      traduzirErroHorario(error);
    }
  }

  private projetar(
    tabela: TabelaHorario,
    periodos: PeriodoHorario[],
  ): TabelaProjetada {
    return {
      id: tabela.id,
      empresaId: tabela.empresaId,
      nome: tabela.nome,
      ativo: tabela.ativo,
      criadoPorUserId: tabela.criadoPorUserId,
      criadoEm: tabela.criadoEm,
      atualizadoEm: tabela.atualizadoEm,
      periodos: periodos.map((p) => ({
        dia: numeroParaDia(p.diaSemana),
        inicio: formatarHora(p.inicioMinuto),
        fim: formatarHora(p.fimMinuto),
      })),
    };
  }
}
