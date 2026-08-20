import { Injectable } from "@nestjs/common";
import {
  MovimentacaoFuncional,
  Prisma,
  StatusMovimentacao,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext, ResultadoPaginado } from "../pessoas.types";
import {
  EscopoPessoas,
  deslocamento,
  intersectarLeitura,
  podeAcessarPessoas,
  resolverEscopoLeituraPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import {
  assertDestinoCoerente,
  assertDestinoValidoEAtivo,
  assertSituacaoVinculoParaEfetivar,
  assertSucessaoCoerente,
  assertTransicaoMovimentacao,
  assertVigenciaAlcancada,
  assertVigenciaCoerente,
  dataUtc,
  produzAlocacao,
} from "../validacao-pessoas.util";
import {
  extrairDestino,
  recalcularSituacaoColaborador,
  traduzirErroPessoas,
} from "../pessoas-comum.util";
import {
  ListarMovimentacoesQueryDto,
  RegistrarMovimentacaoDto,
  RetificarMovimentacaoDto,
} from "../dto/pessoas.dto";

/**
 * Movimentação funcional — o **ato**. A alocação é o **estado** que o ato
 * produz (ADR 0007, d. 3).
 *
 * Não há workflow de aprovação nesta V1 (Baseline V1, item 7): RH e DP
 * registram e efetivam diretamente, dentro da própria empresa, sob
 * responsabilidade auditada. Os estados `aprovada`/`rejeitada` não existem.
 *
 * **Nenhuma decisão trabalhista é automatizada** (ADR 0007, d. 10): não há
 * cálculo de direito, saldo, período, rescisão ou enquadramento legal. O
 * sistema registra quem decidiu, quando e com qual efeito.
 */
@Injectable()
export class MovimentacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  /**
   * Registra movimentação sobre vínculo existente. `admissao` não passa por
   * aqui — ela nasce junto do vínculo (ver `ColaboradorService.admitir` e
   * `VinculoService.criar`), porque não faz sentido admitir um vínculo que já
   * existe.
   */
  async registrar(
    dto: RegistrarMovimentacaoDto,
    ctx: PessoasAuditContext,
  ): Promise<MovimentacaoFuncional> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const vinculo = await this.carregarVinculoNoEscopo(
      dto.vinculoId,
      ctx,
      escopo,
      "create",
    );

    const destino = extrairDestino(dto);
    assertDestinoCoerente(dto.tipo, destino);

    const vigenciaInicio = dataUtc(new Date(dto.vigenciaInicio));
    assertVigenciaCoerente(
      vigenciaInicio,
      vinculo.dataAdmissao,
      vinculo.dataDesligamento,
    );

    const status: StatusMovimentacao =
      vigenciaInicio > dataUtc(new Date()) ? "programada" : "solicitada";

    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertDestinoValidoEAtivo(tx, vinculo.empresaId, destino);

        const movimentacao = await tx.movimentacaoFuncional.create({
          data: {
            vinculoId: vinculo.id,
            empresaId: vinculo.empresaId,
            tipo: dto.tipo,
            status,
            motivoCodigo: dto.motivoCodigo,
            solicitanteUserId: ctx.actor.id,
            vigenciaInicio,
            destinoUnidadeOrganizacionalId: destino.unidadeOrganizacionalId,
            destinoDepartamentoId: destino.departamentoId,
            destinoAreaId: destino.areaId,
            destinoEquipeId: destino.equipeId,
            destinoCargoId: destino.cargoId,
            destinoCentroCustoId: destino.centroCustoId,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          status === "programada"
            ? "pessoas_movimentacao_programada"
            : "pessoas_movimentacao_registrada",
          "movimentacao_funcional",
          movimentacao.id,
          vinculo.empresaId,
        );

        return movimentacao;
      });
    } catch (error) {
      traduzirErroPessoas(error);
    }
  }

  async listar(
    query: ListarMovimentacoesQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ResultadoPaginado<MovimentacaoFuncional>> {
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
    const filtro = intersectarLeitura(escopo, query.empresaId);

    if (filtro === null) {
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    const where: Prisma.MovimentacaoFuncionalWhereInput = {
      // Escopado: empresa do ator. Global (Master): sem filtro de empresa.
      ...(filtro.empresaId !== undefined
        ? { empresaId: filtro.empresaId }
        : {}),
      ...(query.vinculoId ? { vinculoId: query.vinculoId } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.movimentacaoFuncional.findMany({
        where,
        orderBy: [{ vigenciaInicio: "desc" }, { registradaEm: "desc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.movimentacaoFuncional.count({ where }),
    ]);

    if (escopo.global) {
      await this.auditoria.registrarConsultaGlobal(
        ctx,
        "movimentacao_funcional",
        null,
      );
    }

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  /** Cancelamento antes da efetivação. Terminal — e permanece no histórico. */
  async cancelar(
    movimentacaoId: string,
    ctx: PessoasAuditContext,
  ): Promise<MovimentacaoFuncional> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const movimentacao = await this.carregarNoEscopo(
      movimentacaoId,
      ctx,
      escopo,
      "manage",
    );
    assertTransicaoMovimentacao(movimentacao.status, "cancelada");

    return this.prisma.$transaction(async (tx) => {
      const cancelada = await tx.movimentacaoFuncional.update({
        where: { id: movimentacao.id },
        data: { status: "cancelada" },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_movimentacao_cancelada",
        "movimentacao_funcional",
        cancelada.id,
        cancelada.empresaId,
      );

      return cancelada;
    });
  }

  /**
   * Efetivação — o único ponto em que o **estado** muda.
   *
   * Tudo acontece numa transação, com a linha do vínculo travada
   * (`FOR UPDATE`): sem isso, duas efetivações simultâneas sobre o mesmo
   * vínculo poderiam deixar duas alocações abertas. O índice único parcial do
   * banco recusaria a segunda de todo modo — o lock existe para que a recusa
   * seja um conflito previsível, não uma corrida.
   *
   * Nenhum job efetiva sozinho: mesmo para movimentação `programada`, a
   * efetivação é ato explícito, com executor identificado (spec §4.9).
   */
  async efetivar(
    movimentacaoId: string,
    ctx: PessoasAuditContext,
  ): Promise<MovimentacaoFuncional> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const alvo = await this.carregarNoEscopo(
      movimentacaoId,
      ctx,
      escopo,
      "manage",
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serializa efetivações concorrentes sobre o mesmo vínculo.
        await tx.$queryRaw`SELECT id FROM vinculo_funcional WHERE id = ${alvo.vinculoId}::text FOR UPDATE`;

        // Relê dentro da transação: o status pode ter mudado entre a checagem
        // de escopo e o lock.
        const movimentacao = await tx.movimentacaoFuncional.findUniqueOrThrow({
          where: { id: alvo.id },
        });
        assertTransicaoMovimentacao(movimentacao.status, "efetivada");
        assertVigenciaAlcancada(
          movimentacao.vigenciaInicio,
          dataUtc(new Date()),
        );

        const vinculo = await tx.vinculoFuncional.findUniqueOrThrow({
          where: { id: movimentacao.vinculoId },
        });
        assertSituacaoVinculoParaEfetivar(movimentacao.tipo, vinculo.situacao);

        const destino = {
          unidadeOrganizacionalId: movimentacao.destinoUnidadeOrganizacionalId,
          departamentoId: movimentacao.destinoDepartamentoId,
          areaId: movimentacao.destinoAreaId,
          equipeId: movimentacao.destinoEquipeId,
          cargoId: movimentacao.destinoCargoId,
          centroCustoId: movimentacao.destinoCentroCustoId,
        };

        // Revalida o destino **agora**: um nó organizacional pode ter sido
        // inativado entre o registro e a efetivação (RI-A3).
        await assertDestinoValidoEAtivo(tx, vinculo.empresaId, destino);

        // Encerra a alocação vigente, se houver. Sucessão, nunca sobrescrita:
        // `vigente_ate` é exclusivo, então o intervalo fechado é
        // [vigente_de, vigencia_inicio) e o novo abre exatamente onde o
        // anterior terminou — sem lacuna e sem sobreposição.
        if (movimentacao.tipo !== "admissao") {
          const vigente = await tx.alocacaoOrganizacional.findFirst({
            where: { vinculoId: vinculo.id, vigenteAte: null },
          });
          if (vigente) {
            assertSucessaoCoerente(
              movimentacao.vigenciaInicio,
              vigente.vigenteDe,
            );
            await tx.alocacaoOrganizacional.update({
              where: { id: vigente.id },
              data: { vigenteAte: movimentacao.vigenciaInicio },
            });
            await this.auditoria.registrarMutacao(
              tx,
              ctx,
              "pessoas_alocacao_encerrada",
              "alocacao_organizacional",
              vigente.id,
              vinculo.empresaId,
            );
          }
        }

        if (produzAlocacao(movimentacao.tipo)) {
          const alocacao = await tx.alocacaoOrganizacional.create({
            data: {
              vinculoId: vinculo.id,
              empresaId: vinculo.empresaId,
              unidadeOrganizacionalId: destino.unidadeOrganizacionalId,
              departamentoId: destino.departamentoId,
              areaId: destino.areaId,
              equipeId: destino.equipeId,
              cargoId: destino.cargoId,
              centroCustoId: destino.centroCustoId,
              vigenteDe: movimentacao.vigenciaInicio,
              movimentacaoOrigemId: movimentacao.id,
            },
          });
          await this.auditoria.registrarMutacao(
            tx,
            ctx,
            "pessoas_alocacao_criada",
            "alocacao_organizacional",
            alocacao.id,
            vinculo.empresaId,
          );
        }

        if (movimentacao.tipo === "admissao") {
          await tx.vinculoFuncional.update({
            where: { id: vinculo.id },
            data: { situacao: "ativo" },
          });
          await this.auditoria.registrarMutacao(
            tx,
            ctx,
            "pessoas_vinculo_ativado",
            "vinculo_funcional",
            vinculo.id,
            vinculo.empresaId,
          );
        } else if (movimentacao.tipo === "desligamento") {
          await tx.vinculoFuncional.update({
            where: { id: vinculo.id },
            data: {
              situacao: "encerrado",
              dataDesligamento: movimentacao.vigenciaInicio,
            },
          });
          await this.auditoria.registrarMutacao(
            tx,
            ctx,
            "pessoas_vinculo_encerrado",
            "vinculo_funcional",
            vinculo.id,
            vinculo.empresaId,
          );
        }

        const efetivada = await tx.movimentacaoFuncional.update({
          where: { id: movimentacao.id },
          data: {
            status: "efetivada",
            efetivadaEm: new Date(),
            executorUserId: ctx.actor.id,
          },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_movimentacao_efetivada",
          "movimentacao_funcional",
          efetivada.id,
          efetivada.empresaId,
        );

        await recalcularSituacaoColaborador(tx, vinculo.colaboradorId);

        return efetivada;
      });
    } catch (error) {
      traduzirErroPessoas(error);
    }
  }

  /**
   * Retificação (spec §4.10): corrige **o registro**, sem reescrever a
   * história.
   *
   * A original permanece na linha do tempo com status `retificada`, e a
   * correção nasce como movimentação nova, que ainda precisa ser efetivada
   * para produzir estado. Nada é apagado — nem a movimentação errada, nem a
   * alocação que ela produziu (que será encerrada por sucessão, não removida).
   */
  async retificar(
    movimentacaoId: string,
    dto: RetificarMovimentacaoDto,
    ctx: PessoasAuditContext,
  ): Promise<MovimentacaoFuncional> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const original = await this.carregarNoEscopo(
      movimentacaoId,
      ctx,
      escopo,
      "manage",
    );
    assertTransicaoMovimentacao(original.status, "retificada");

    const destino = extrairDestino(dto);
    assertDestinoCoerente(original.tipo, destino);

    const vinculo = await this.prisma.vinculoFuncional.findUniqueOrThrow({
      where: { id: original.vinculoId },
    });

    const vigenciaInicio = dataUtc(new Date(dto.vigenciaInicio));
    assertVigenciaCoerente(
      vigenciaInicio,
      vinculo.dataAdmissao,
      vinculo.dataDesligamento,
    );

    const status: StatusMovimentacao =
      vigenciaInicio > dataUtc(new Date()) ? "programada" : "solicitada";

    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertDestinoValidoEAtivo(tx, original.empresaId, destino);

        await tx.movimentacaoFuncional.update({
          where: { id: original.id },
          data: { status: "retificada" },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_movimentacao_retificada",
          "movimentacao_funcional",
          original.id,
          original.empresaId,
        );

        const correcao = await tx.movimentacaoFuncional.create({
          data: {
            vinculoId: original.vinculoId,
            empresaId: original.empresaId,
            tipo: original.tipo,
            status,
            motivoCodigo: dto.motivoCodigo,
            solicitanteUserId: ctx.actor.id,
            vigenciaInicio,
            retificaId: original.id,
            destinoUnidadeOrganizacionalId: destino.unidadeOrganizacionalId,
            destinoDepartamentoId: destino.departamentoId,
            destinoAreaId: destino.areaId,
            destinoEquipeId: destino.equipeId,
            destinoCargoId: destino.cargoId,
            destinoCentroCustoId: destino.centroCustoId,
          },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          status === "programada"
            ? "pessoas_movimentacao_programada"
            : "pessoas_movimentacao_registrada",
          "movimentacao_funcional",
          correcao.id,
          correcao.empresaId,
        );

        return correcao;
      });
    } catch (error) {
      traduzirErroPessoas(error);
    }
  }

  private async carregarNoEscopo(
    movimentacaoId: string,
    ctx: PessoasAuditContext,
    escopo: EscopoPessoas,
    action: "read" | "alter" | "manage" | "create",
  ): Promise<MovimentacaoFuncional> {
    const movimentacao = await this.prisma.movimentacaoFuncional.findFirst({
      where: { id: movimentacaoId, empresaId: escopo.empresaId },
    });

    if (!movimentacao) {
      return this.auditoria.negarAcesso(
        ctx,
        "movimentacao_funcional",
        movimentacaoId,
        null,
      );
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "movimentacao_funcional",
        action,
        movimentacao.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "movimentacao_funcional",
        movimentacao.id,
        movimentacao.empresaId,
      );
    }

    return movimentacao;
  }

  private async carregarVinculoNoEscopo(
    vinculoId: string,
    ctx: PessoasAuditContext,
    escopo: EscopoPessoas,
    action: "read" | "create" | "manage",
  ) {
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { id: vinculoId, empresaId: escopo.empresaId },
    });

    if (!vinculo) {
      return this.auditoria.negarAcesso(
        ctx,
        "movimentacao_funcional",
        vinculoId,
        null,
      );
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "movimentacao_funcional",
        action,
        vinculo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "movimentacao_funcional",
        vinculo.id,
        vinculo.empresaId,
      );
    }

    return vinculo;
  }
}
