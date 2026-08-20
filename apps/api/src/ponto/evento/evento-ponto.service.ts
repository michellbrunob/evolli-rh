import { Injectable } from "@nestjs/common";
import { AjustePonto, EventoPonto, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PontoAuditoriaService } from "../ponto-auditoria.service";
import {
  PontoAuditContext,
  ResultadoPaginado,
  TAMANHO_PAGINA_PADRAO,
  ValorEfetivoPonto,
} from "../ponto.types";
import {
  EscopoLeituraPonto,
  deslocamento,
  filtroEmpresaLeituraPonto,
  podeAcessarPonto,
  podeConsultarPonto,
  resolverEscopoLeituraPonto,
  resolverEscopoPonto,
} from "../escopo-ponto.util";
import { competenciaDe } from "../competencia.util";
import {
  assertAjusteMantemCompetencia,
  assertEventoAjustavel,
  assertVinculoAceitaPonto,
  resolverEfetivo,
  traduzirErroPonto,
} from "../validacao-ponto.util";
import {
  ListarPontosDoVinculoQueryDto,
  ListarPontosQueryDto,
  RegistrarAjustePontoDto,
  RegistrarEventoPontoDto,
} from "../dto/ponto.dto";

/** Projeção pública de um ajuste. Sem dado pessoal, sem ator além do id. */
interface AjusteProjetado {
  id: string;
  motivoCodigo: AjustePonto["motivoCodigo"];
  anula: boolean;
  momentoCorrigido: Date | null;
  tipoCorrigido: AjustePonto["tipoCorrigido"];
  registradoPorUserId: string;
  registradoEm: Date;
}

/** Projeção pública de um evento, com o valor efetivo já resolvido. */
interface EventoProjetado {
  id: string;
  vinculoId: string;
  empresaId: string;
  tipo: EventoPonto["tipo"];
  momento: Date;
  competencia: string;
  registradoPorUserId: string;
  registradoEm: Date;
  efetivo: ValorEfetivoPonto;
}

interface EventoDetalhado extends EventoProjetado {
  ajustes: AjusteProjetado[];
}

const ORDEM_AJUSTES = { registradoEm: "asc" } as const;

/**
 * Registro e consulta de marcações de ponto (Etapa 3, ADR 0008).
 *
 * ### O que este service nunca faz
 *
 * Não altera nem apaga `EventoPonto` — e não por disciplina: `evolli_app` não
 * tem `UPDATE`/`DELETE` nessas tabelas (migration
 * `20260810120000_jornada_ponto_rastreavel`). Se um caminho de código tentasse,
 * o **banco** recusaria.
 *
 * Não calcula nada. Não há saldo, hora extra, banco de horas ou jornada
 * esperada em lugar nenhum deste arquivo (decisão 6).
 *
 * ### Isolamento por empresa
 *
 * Duas camadas, e a primeira não depende da segunda: **toda** consulta é
 * construída com `empresaId` derivado da sessão, então um ator fora do escopo
 * simplesmente não encontra a linha. A checagem explícita (`podeAcessarPonto`)
 * é a segunda camada, sobre a entidade já carregada, e é ela que produz o
 * evento `denied` antes do 404.
 */
@Injectable()
export class EventoPontoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PontoAuditoriaService,
  ) {}

  /**
   * Registra uma marcação. Escrita e evento de auditoria na **mesma
   * transação** (ADR 0004 §2).
   */
  async registrar(
    dto: RegistrarEventoPontoDto,
    ctx: PontoAuditContext,
  ): Promise<EventoProjetado> {
    const escopo = resolverEscopoPonto(ctx.actor);
    const momento = new Date(dto.momento);

    // Busca já escopada: um vínculo de outra empresa não é encontrado aqui,
    // independentemente da checagem seguinte.
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { id: dto.vinculoId, empresaId: escopo.empresaId },
      select: {
        id: true,
        empresaId: true,
        situacao: true,
        dataAdmissao: true,
        dataDesligamento: true,
      },
    });

    if (vinculo === null) {
      // 404 + `denied`: não confirma se o vínculo existe em outra empresa.
      return this.auditoria.negarAcesso(
        ctx,
        "evento_ponto",
        dto.vinculoId,
        escopo.empresaId,
      );
    }

    if (
      !podeAcessarPonto(ctx.actor, "evento_ponto", "create", vinculo.empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "evento_ponto",
        dto.vinculoId,
        vinculo.empresaId,
      );
    }

    assertVinculoAceitaPonto(vinculo, momento);

    try {
      const evento = await this.prisma.$transaction(async (tx) => {
        const criado = await tx.eventoPonto.create({
          data: {
            vinculoId: vinculo.id,
            empresaId: vinculo.empresaId,
            tipo: dto.tipo,
            momento,
            // Calculada aqui, no insert, e nunca mais recalculada.
            competencia: competenciaDe(momento),
            registradoPorUserId: ctx.actor.id,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "ponto_evento_registrado",
          "evento_ponto",
          criado.id,
          vinculo.empresaId,
        );

        return criado;
      });

      return this.projetar(evento, []);
    } catch (error) {
      traduzirErroPonto(error);
    }
  }

  async listar(
    query: ListarPontosQueryDto,
    ctx: PontoAuditContext,
  ): Promise<ResultadoPaginado<EventoProjetado>> {
    const escopo = resolverEscopoLeituraPonto(ctx.actor);

    const where: Prisma.EventoPontoWhereInput = {
      // Escopado: empresa do ator. Global (Master): sem filtro de empresa.
      ...filtroEmpresaLeituraPonto(escopo),
      ...(query.vinculoId !== undefined && { vinculoId: query.vinculoId }),
      ...(query.competencia !== undefined && {
        competencia: query.competencia,
      }),
      ...(query.tipo !== undefined && { tipo: query.tipo }),
    };

    return this.paginar(where, query.pagina, query.tamanhoPagina, ctx, escopo);
  }

  async listarPorVinculo(
    vinculoId: string,
    query: ListarPontosDoVinculoQueryDto,
    ctx: PontoAuditContext,
  ): Promise<ResultadoPaginado<EventoProjetado>> {
    const escopo = resolverEscopoLeituraPonto(ctx.actor);

    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { id: vinculoId, ...filtroEmpresaLeituraPonto(escopo) },
      select: { id: true, empresaId: true },
    });

    if (vinculo === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "evento_ponto",
        vinculoId,
        escopo.global ? null : escopo.empresaId,
      );
    }

    if (!podeConsultarPonto(ctx.actor, "evento_ponto", "read", escopo)) {
      return this.auditoria.negarAcesso(
        ctx,
        "evento_ponto",
        vinculoId,
        vinculo.empresaId,
      );
    }

    const where: Prisma.EventoPontoWhereInput = {
      // Escopado: empresa do ator. Global (Master): sem filtro de empresa.
      ...filtroEmpresaLeituraPonto(escopo),
      vinculoId,
      ...(query.competencia !== undefined && {
        competencia: query.competencia,
      }),
      ...(query.tipo !== undefined && { tipo: query.tipo }),
    };

    return this.paginar(where, query.pagina, query.tamanhoPagina, ctx, escopo, {
      resourceId: vinculoId,
    });
  }

  async detalhar(
    pontoId: string,
    ctx: PontoAuditContext,
  ): Promise<EventoDetalhado> {
    const { evento, ajustes, escopo } = await this.carregarComAjustes(
      pontoId,
      ctx,
    );

    await this.auditoria.registrarConsulta(
      ctx,
      "evento_ponto",
      evento.id,
      escopo.global ? null : escopo.empresaId,
    );

    return {
      ...this.projetar(evento, ajustes),
      ajustes: ajustes.map((ajuste) => this.projetarAjuste(ajuste)),
    };
  }

  async listarAjustes(
    pontoId: string,
    ctx: PontoAuditContext,
  ): Promise<AjusteProjetado[]> {
    const { evento, ajustes, escopo } = await this.carregarComAjustes(
      pontoId,
      ctx,
    );

    await this.auditoria.registrarConsulta(
      ctx,
      "ajuste_ponto",
      evento.id,
      escopo.global ? null : escopo.empresaId,
    );

    return ajustes.map((ajuste) => this.projetarAjuste(ajuste));
  }

  /**
   * Registra um ajuste. O evento original permanece byte a byte como estava —
   * este método só insere.
   */
  async registrarAjuste(
    pontoId: string,
    dto: RegistrarAjustePontoDto,
    ctx: PontoAuditContext,
  ): Promise<AjusteProjetado> {
    const { evento, ajustes } = await this.carregarComAjustes(
      pontoId,
      ctx,
      "create",
    );

    assertEventoAjustavel(resolverEfetivo(evento, ajustes));

    const anula = dto.anula ?? false;
    const momentoCorrigido =
      dto.momentoCorrigido !== undefined
        ? new Date(dto.momentoCorrigido)
        : null;

    if (momentoCorrigido !== null) {
      assertAjusteMantemCompetencia(evento.competencia, momentoCorrigido);
      // A vigência continua valendo para o valor corrigido: um ajuste não pode
      // colocar a marcação fora do período em que a pessoa esteve vinculada.
      const vinculo = await this.prisma.vinculoFuncional.findFirstOrThrow({
        where: { id: evento.vinculoId, empresaId: evento.empresaId },
        select: {
          situacao: true,
          dataAdmissao: true,
          dataDesligamento: true,
        },
      });
      assertVinculoAceitaPonto(vinculo, momentoCorrigido);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.ajustePonto.create({
          data: {
            eventoPontoId: evento.id,
            empresaId: evento.empresaId,
            motivoCodigo: dto.motivoCodigo,
            anula,
            momentoCorrigido: anula ? null : momentoCorrigido,
            tipoCorrigido: anula ? null : (dto.tipoCorrigido ?? null),
            registradoPorUserId: ctx.actor.id,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "ponto_ajuste_registrado",
          "ajuste_ponto",
          criado.id,
          evento.empresaId,
        );

        return this.projetarAjuste(criado);
      });
    } catch (error) {
      traduzirErroPonto(error);
    }
  }

  /**
   * Carrega evento + ajustes já escopados por empresa, negando (404 +
   * `denied`) o que estiver fora do escopo do ator.
   */
  private async carregarComAjustes(
    pontoId: string,
    ctx: PontoAuditContext,
    acao: "read" | "create" = "read",
  ): Promise<{
    evento: EventoPonto;
    ajustes: AjustePonto[];
    escopo: EscopoLeituraPonto;
  }> {
    // Leitura pode ser global (Master). O registro de ajuste (`create`) chega
    // aqui só por rh/dp — o guard nega o Master antes; se chegasse, o resolver
    // devolveria global e `podeConsultarPonto(create)` negaria (defesa em
    // profundidade).
    const escopo = resolverEscopoLeituraPonto(ctx.actor);

    const evento = await this.prisma.eventoPonto.findFirst({
      where: { id: pontoId, ...filtroEmpresaLeituraPonto(escopo) },
    });

    if (evento === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "evento_ponto",
        pontoId,
        escopo.global ? null : escopo.empresaId,
      );
    }

    const recurso = acao === "create" ? "ajuste_ponto" : "evento_ponto";
    if (!podeConsultarPonto(ctx.actor, recurso, acao, escopo)) {
      return this.auditoria.negarAcesso(
        ctx,
        recurso,
        pontoId,
        evento.empresaId,
      );
    }

    const ajustes = await this.prisma.ajustePonto.findMany({
      where: { eventoPontoId: evento.id, ...filtroEmpresaLeituraPonto(escopo) },
      orderBy: ORDEM_AJUSTES,
    });

    return { evento, ajustes, escopo };
  }

  /**
   * Página de eventos com o valor efetivo de cada um resolvido.
   *
   * Os ajustes são buscados em **uma** consulta para a página inteira, não uma
   * por evento — a alternativa faria uma listagem de 100 marcações disparar
   * 101 consultas.
   */
  private async paginar(
    where: Prisma.EventoPontoWhereInput,
    paginaSolicitada: number | undefined,
    tamanhoSolicitado: number | undefined,
    ctx: PontoAuditContext,
    escopo: EscopoLeituraPonto,
    extra?: { resourceId: string },
  ): Promise<ResultadoPaginado<EventoProjetado>> {
    const pagina = paginaSolicitada ?? 1;
    const tamanhoPagina = tamanhoSolicitado ?? TAMANHO_PAGINA_PADRAO;

    const [eventos, total] = await Promise.all([
      this.prisma.eventoPonto.findMany({
        where,
        orderBy: [{ momento: "desc" }, { id: "asc" }],
        skip: deslocamento(pagina, tamanhoPagina),
        take: tamanhoPagina,
      }),
      this.prisma.eventoPonto.count({ where }),
    ]);

    const ajustesPorEvento = await this.agruparAjustes(
      eventos.map((evento) => evento.id),
      escopo,
    );

    await this.auditoria.registrarConsulta(
      ctx,
      "evento_ponto",
      extra?.resourceId ?? null,
      escopo.global ? null : escopo.empresaId,
    );

    return {
      itens: eventos.map((evento) =>
        this.projetar(evento, ajustesPorEvento.get(evento.id) ?? []),
      ),
      pagina,
      tamanhoPagina,
      total,
    };
  }

  private async agruparAjustes(
    eventoIds: string[],
    escopo: EscopoLeituraPonto,
  ): Promise<Map<string, AjustePonto[]>> {
    const agrupado = new Map<string, AjustePonto[]>();
    if (eventoIds.length === 0) {
      return agrupado;
    }

    const ajustes = await this.prisma.ajustePonto.findMany({
      // Eventos já vieram escopados; o filtro de empresa é defesa adicional
      // (omitido no escopo global do Master).
      where: {
        eventoPontoId: { in: eventoIds },
        ...filtroEmpresaLeituraPonto(escopo),
      },
      orderBy: ORDEM_AJUSTES,
    });

    for (const ajuste of ajustes) {
      const lista = agrupado.get(ajuste.eventoPontoId);
      if (lista === undefined) {
        agrupado.set(ajuste.eventoPontoId, [ajuste]);
      } else {
        lista.push(ajuste);
      }
    }

    return agrupado;
  }

  /**
   * Projeção mínima: só o necessário. Nenhum nome, matrícula ou dado de
   * colaborador atravessa esta fronteira — quem precisa da pessoa consulta o
   * módulo de pessoas, com a autorização daquele módulo.
   */
  private projetar(
    evento: EventoPonto,
    ajustes: AjustePonto[],
  ): EventoProjetado {
    return {
      id: evento.id,
      vinculoId: evento.vinculoId,
      empresaId: evento.empresaId,
      tipo: evento.tipo,
      momento: evento.momento,
      competencia: evento.competencia,
      registradoPorUserId: evento.registradoPorUserId,
      registradoEm: evento.registradoEm,
      efetivo: resolverEfetivo(evento, ajustes),
    };
  }

  private projetarAjuste(ajuste: AjustePonto): AjusteProjetado {
    return {
      id: ajuste.id,
      motivoCodigo: ajuste.motivoCodigo,
      anula: ajuste.anula,
      momentoCorrigido: ajuste.momentoCorrigido,
      tipoCorrigido: ajuste.tipoCorrigido,
      registradoPorUserId: ajuste.registradoPorUserId,
      registradoEm: ajuste.registradoEm,
    };
  }
}
