import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
  ErroDeCampo,
} from "../../common/erros/recusa-por-campo";
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
  resolverEscopoLeituraTabelas,
} from "../escopo-horarios.util";
import { traduzirErroHorario } from "../validacao-horarios.util";
import {
  AtribuirJornadaDto,
  CriarVinculoHorarioDto,
  EncerrarVinculoHorarioDto,
  ListarVinculosHorarioQueryDto,
} from "../dto/horarios.dto";

/**
 * T183 — a jornada vem junto com o vínculo: o histórico mostra qual era e se
 * ela foi inativada depois, sem a tela buscar o catálogo inteiro.
 *
 * T191 — e o colaborador também, só `id` e `nome`: a tabela de vínculos do
 * Horário de trabalho resolvia o nome por uma página de 100 colaboradores, e
 * quem passava do centésimo aparecia sem nome. O nome vem pela relação do
 * próprio vínculo, na mesma consulta e no mesmo escopo: só acompanha um
 * vínculo que o papel já pode ler (RH, DP e master — os mesmos que leem
 * colaboradores). Nada além do nome: nenhum outro dado pessoal.
 */
const COM_JORNADA = {
  tabela: { select: { id: true, codigo: true, nome: true, ativo: true } },
  colaborador: { select: { id: true, nome: true } },
} satisfies Prisma.VinculoHorarioInclude;

type VinculoComJornada = Prisma.VinculoHorarioGetPayload<{
  include: typeof COM_JORNADA;
}>;

/** Projeção pública de um vínculo horário↔colaborador. */
export interface VinculoProjetado {
  id: string;
  colaboradorId: string;
  empresaId: string;
  tabelaHorarioId: string;
  /** T183 — a jornada vinculada, com a situação dela hoje. */
  tabela: {
    id: string;
    codigo: string | null;
    nome: string;
    ativo: boolean;
  };
  /** T191 — o colaborador do vínculo: só `id` e `nome`. */
  colaborador: {
    id: string;
    nome: string;
  };
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

/** T183 — recusa de regra, por campo e sem o valor (422). */
function recusar(campo: ErroDeCampo["campo"], motivo: ErroDeCampo["motivo"]) {
  return new CamposRecusadosException([{ campo, motivo }]);
}

/**
 * T183 — a vigência cruzou outra do mesmo colaborador na mesma empresa: a
 * EXCLUSION de `daterange` (23P01) ou o índice de vigência aberta única
 * (P2002, a colisão que a concorrência real produz).
 */
function eVigenciaSobreposta(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return true;
  }
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    (/23P01/.test(error.message) || /exclusion constraint/i.test(error.message))
  );
}

/** 409 no início da vigência, sem o valor. */
function sobreposta() {
  return new ConflitoDeCamposException([
    { campo: "vigenciaInicio", motivo: "sobreposta" },
  ]);
}

/**
 * Vínculo histórico de uma tabela de horário (jornada) a um colaborador, com
 * vigência (T038). Só RH opera; a fronteira é `empresa_id`. T183 — o DP
 * consulta, e a atribuição troca a jornada vigente numa operação só.
 *
 * A não sobreposição de vigências (um colaborador não tem duas jornadas
 * válidas para o mesmo dia na mesma empresa) é garantida pelo banco (EXCLUSION
 * CONSTRAINT + índice parcial); aqui, uma colisão vira 409 no campo do início.
 * A coerência colaborador↔empresa é validada na aplicação (404
 * anti-enumeração) e reforçada por CONSTRAINT TRIGGER.
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
    await this.exigirColaboradorNaEmpresa(
      dto.colaboradorId,
      escopo.empresaId,
      ctx,
    );

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
      throw recusar("tabelaHorarioId", "indisponivel");
    }

    const vigenciaInicio = dataDe(dto.vigenciaInicio);
    const vigenciaFim =
      dto.vigenciaFim !== undefined ? dataDe(dto.vigenciaFim) : null;

    if (vigenciaFim !== null && vigenciaFim <= vigenciaInicio) {
      throw recusar("vigenciaFim", "fora_de_ordem");
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
          include: COM_JORNADA,
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
      if (eVigenciaSobreposta(error)) throw sobreposta();
      traduzirErroHorario(error);
    }
  }

  /**
   * T183 — atribui ou TROCA a jornada de um colaborador, numa transação só.
   *
   * - Sem jornada vigente (vigência aberta), cria a vigência a partir de
   *   `vigenciaInicio`.
   * - Com jornada vigente, encerra a vigente em `vigenciaInicio` (o fim não
   *   conta: os dois períodos ficam adjacentes, sem lacuna nem sobreposição) e
   *   cria a nova. O novo início precisa vir depois do início da vigente, e a
   *   nova jornada precisa ser outra.
   * - Só jornada ATIVA da empresa ativa; inexistente na empresa e inativa
   *   respondem igual (`indisponivel`), sem revelar outra empresa.
   *
   * Na trilha, `horarios.vinculo.encerrado` (a anterior) e
   * `horarios.vinculo.criado` (a nova): só ids.
   */
  async atribuir(
    dto: AtribuirJornadaDto,
    ctx: HorariosAuditContext,
  ): Promise<VinculoProjetado> {
    const escopo = resolverEscopoHorarios(ctx.actor);
    await this.exigirColaboradorNaEmpresa(
      dto.colaboradorId,
      escopo.empresaId,
      ctx,
    );

    const tabela = await this.prisma.tabelaHorario.findFirst({
      where: {
        id: dto.tabelaHorarioId,
        empresaId: escopo.empresaId,
        ativo: true,
      },
      select: { id: true },
    });
    if (tabela === null) {
      throw recusar("tabelaHorarioId", "indisponivel");
    }

    const inicio = dataDe(dto.vigenciaInicio);

    try {
      const criado = await this.prisma.$transaction(async (tx) => {
        const vigente = await tx.vinculoHorario.findFirst({
          where: {
            colaboradorId: dto.colaboradorId,
            empresaId: escopo.empresaId,
            vigenciaFim: null,
          },
          select: { id: true, tabelaHorarioId: true, vigenciaInicio: true },
        });

        if (vigente !== null) {
          if (vigente.tabelaHorarioId === tabela.id) {
            throw recusar("tabelaHorarioId", "igual_a_vigente");
          }
          if (inicio <= vigente.vigenciaInicio) {
            throw recusar("vigenciaInicio", "fora_de_ordem");
          }
          await tx.vinculoHorario.update({
            where: { id: vigente.id },
            data: { vigenciaFim: inicio },
          });
          await this.auditoria.registrarMutacao(
            tx,
            ctx,
            "horarios_vinculo_encerrado",
            "vinculo_horario",
            vigente.id,
            escopo.empresaId,
          );
        }

        const novo = await tx.vinculoHorario.create({
          data: {
            colaboradorId: dto.colaboradorId,
            empresaId: escopo.empresaId,
            tabelaHorarioId: tabela.id,
            vigenciaInicio: inicio,
            vigenciaFim: null,
            criadoPorUserId: ctx.actor.id,
          },
          include: COM_JORNADA,
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "horarios_vinculo_criado",
          "vinculo_horario",
          novo.id,
          escopo.empresaId,
        );
        return novo;
      });

      return this.projetar(criado);
    } catch (error) {
      if (eVigenciaSobreposta(error)) throw sobreposta();
      traduzirErroHorario(error);
    }
  }

  async listar(
    query: ListarVinculosHorarioQueryDto,
    ctx: HorariosAuditContext,
  ): Promise<ResultadoPaginado<VinculoProjetado>> {
    const escopo = resolverEscopoLeituraTabelas(ctx.actor);

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
        include: COM_JORNADA,
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
   * Encerra a vigência de um vínculo aberto — preserva o histórico (a
   * definição do período já decorrido não muda). `vigenciaFim` é o PRIMEIRO
   * dia sem a jornada. Só RH, só na própria empresa.
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
      throw recusar("vigenciaFim", "ja_encerrada");
    }

    const vigenciaFim = dataDe(dto.vigenciaFim);
    if (vigenciaFim <= vinculo.vigenciaInicio) {
      throw recusar("vigenciaFim", "fora_de_ordem");
    }

    try {
      const encerrado = await this.prisma.$transaction(async (tx) => {
        const atualizado = await tx.vinculoHorario.update({
          where: { id: vinculo.id },
          data: { vigenciaFim },
          include: COM_JORNADA,
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
   * O colaborador precisa ter vínculo funcional na empresa do ator. Sem isso,
   * 404 anti-enumeração (não confirma se ele existe em outra empresa), com a
   * negação na trilha.
   */
  private async exigirColaboradorNaEmpresa(
    colaboradorId: string,
    empresaId: string,
    ctx: HorariosAuditContext,
  ): Promise<void> {
    const vinculoFuncional = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId },
      select: { id: true },
    });
    if (vinculoFuncional === null) {
      await this.auditoria.negarAcesso(
        ctx,
        "vinculo_horario",
        colaboradorId,
        empresaId,
      );
    }
  }

  /**
   * Carrega um vínculo já escopado por empresa, negando (404 + `denied`) o que
   * estiver fora do escopo do ator.
   */
  private async carregar(
    vinculoId: string,
    ctx: HorariosAuditContext,
  ): Promise<{ vinculo: VinculoComJornada; escopo: EscopoLeituraHorarios }> {
    const escopo = resolverEscopoLeituraTabelas(ctx.actor);

    const vinculo = await this.prisma.vinculoHorario.findFirst({
      where: { id: vinculoId, ...filtroEmpresaLeituraHorarios(escopo) },
      include: COM_JORNADA,
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

  private projetar(vinculo: VinculoComJornada): VinculoProjetado {
    return {
      id: vinculo.id,
      colaboradorId: vinculo.colaboradorId,
      empresaId: vinculo.empresaId,
      tabelaHorarioId: vinculo.tabelaHorarioId,
      tabela: {
        id: vinculo.tabela.id,
        codigo: vinculo.tabela.codigo,
        nome: vinculo.tabela.nome,
        ativo: vinculo.tabela.ativo,
      },
      colaborador: {
        id: vinculo.colaborador.id,
        nome: vinculo.colaborador.nome,
      },
      vigenciaInicio: dataIso(vinculo.vigenciaInicio),
      vigenciaFim:
        vinculo.vigenciaFim !== null ? dataIso(vinculo.vigenciaFim) : null,
      criadoPorUserId: vinculo.criadoPorUserId,
      criadoEm: vinculo.criadoEm,
      atualizadoEm: vinculo.atualizadoEm,
    };
  }
}
