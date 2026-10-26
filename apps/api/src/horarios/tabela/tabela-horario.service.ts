import { BadRequestException, Injectable } from "@nestjs/common";
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
  resolverEscopoLeituraTabelas,
} from "../escopo-horarios.util";
import { ConflitoDeCamposException } from "../../common/erros/recusa-por-campo";
import { escaparCuringas } from "../../pessoas/colaborador/colaborador.service";
import {
  formatarHora,
  normalizarPeriodos,
  numeroParaDia,
  traduzirErroHorario,
} from "../validacao-horarios.util";
import {
  CriarTabelaHorarioDto,
  EditarTabelaHorarioDto,
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
  /** T182 — `null` nas tabelas criadas antes do código existir. */
  codigo: string | null;
  nome: string;
  ativo: boolean;
  criadoPorUserId: string;
  criadoEm: Date;
  atualizadoEm: Date;
  periodos: PeriodoProjetado[];
}

/**
 * T182 — código repetido na empresa: o campo vai na resposta, sem o valor.
 * Usado pela consulta prévia e pela unicidade do banco (corrida).
 */
const CODIGO_EM_USO = [{ campo: "codigo", motivo: "em_uso" }] as const;

/**
 * T182 — nas escritas de `tabela_horario`, a única unicidade alcançável é a do
 * código na empresa (`@@unique([empresaId, codigo])`): um P2002 ali é o código
 * gravado ao mesmo tempo por outra pessoa.
 */
function eCodigoRepetidoNoBanco(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
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
 * T182 — a tabela de horário é a JORNADA DE TRABALHO do catálogo de Estrutura:
 * ganha código (único na empresa) e edição de nome e código; os períodos
 * continuam imutáveis. O DP consulta, só na própria empresa.
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
        await this.recusarCodigoEmUso(tx, escopo.empresaId, dto.codigo, null);
        const tabela = await tx.tabelaHorario.create({
          data: {
            empresaId: escopo.empresaId,
            codigo: dto.codigo,
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
      if (eCodigoRepetidoNoBanco(error)) {
        throw new ConflitoDeCamposException(CODIGO_EM_USO);
      }
      traduzirErroHorario(error);
    }
  }

  /**
   * T182 — edita NOME e/ou CÓDIGO de uma jornada da própria empresa (só RH).
   * Os períodos não têm caminho de edição (T038). Código repetido na empresa
   * responde 409 com o campo, sem o valor. Sem nenhum campo, 400. Sem
   * mudança real, devolve o gravado e não grava nada.
   */
  async editar(
    tabelaId: string,
    dto: EditarTabelaHorarioDto,
    ctx: HorariosAuditContext,
  ): Promise<TabelaProjetada> {
    if (dto.codigo === undefined && dto.nome === undefined) {
      throw new BadRequestException();
    }
    const escopo = resolverEscopoHorarios(ctx.actor);

    // Busca já escopada: tabela de outra empresa não é encontrada aqui.
    const tabela = await this.prisma.tabelaHorario.findFirst({
      where: { id: tabelaId, empresaId: escopo.empresaId },
      include: { periodos: { orderBy: ORDEM_PERIODOS } },
    });
    if (tabela === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "tabela_horario",
        tabelaId,
        escopo.empresaId,
      );
    }

    const mudancas: { codigo?: string; nome?: string } = {};
    if (dto.codigo !== undefined && dto.codigo !== tabela.codigo) {
      mudancas.codigo = dto.codigo;
    }
    if (dto.nome !== undefined && dto.nome !== tabela.nome) {
      mudancas.nome = dto.nome;
    }
    if (Object.keys(mudancas).length === 0) {
      return this.projetar(tabela, tabela.periodos);
    }

    try {
      const atualizada = await this.prisma.$transaction(async (tx) => {
        if (mudancas.codigo !== undefined) {
          await this.recusarCodigoEmUso(
            tx,
            tabela.empresaId,
            mudancas.codigo,
            tabela.id,
          );
        }
        const tabelaAtualizada = await tx.tabelaHorario.update({
          where: { id: tabela.id },
          data: mudancas,
          include: { periodos: { orderBy: ORDEM_PERIODOS } },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "horarios_tabela_editada",
          "tabela_horario",
          tabela.id,
          tabela.empresaId,
        );
        return tabelaAtualizada;
      });
      return this.projetar(atualizada, atualizada.periodos);
    } catch (error) {
      if (eCodigoRepetidoNoBanco(error)) {
        throw new ConflitoDeCamposException(CODIGO_EM_USO);
      }
      traduzirErroHorario(error);
    }
  }

  async listar(
    query: ListarTabelasHorarioQueryDto,
    ctx: HorariosAuditContext,
  ): Promise<ResultadoPaginado<TabelaProjetada>> {
    const escopo = resolverEscopoLeituraTabelas(ctx.actor);

    // T182 — busca por nome ou código, com os curingas do LIKE escapados.
    const termo = query.busca ? escaparCuringas(query.busca) : null;
    const where: Prisma.TabelaHorarioWhereInput = {
      ...filtroEmpresaLeituraHorarios(escopo),
      ...(query.ativo !== undefined && { ativo: query.ativo }),
      ...(termo !== null && {
        OR: [
          { nome: { contains: termo, mode: "insensitive" } },
          { codigo: { contains: termo, mode: "insensitive" } },
        ],
      }),
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
    const escopo = resolverEscopoLeituraTabelas(ctx.actor);

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

  /**
   * T182 — o código já é de outra tabela da mesma empresa? Só a empresa da
   * sessão é consultada: "em uso" nunca revela outra empresa. A unicidade do
   * banco cobre a corrida entre a consulta e a gravação.
   */
  private async recusarCodigoEmUso(
    tx: Prisma.TransactionClient,
    empresaId: string,
    codigo: string,
    tabelaId: string | null,
  ): Promise<void> {
    const outra = await tx.tabelaHorario.findFirst({
      where: {
        empresaId,
        codigo,
        ...(tabelaId !== null && { NOT: { id: tabelaId } }),
      },
      select: { id: true },
    });
    if (outra) {
      throw new ConflitoDeCamposException(CODIGO_EM_USO);
    }
  }

  private projetar(
    tabela: TabelaHorario,
    periodos: PeriodoHorario[],
  ): TabelaProjetada {
    return {
      id: tabela.id,
      empresaId: tabela.empresaId,
      codigo: tabela.codigo,
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
