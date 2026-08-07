import { Injectable } from "@nestjs/common";
import {
  Colaborador,
  Prisma,
  SituacaoColaborador,
  StatusMovimentacao,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext, ResultadoPaginado } from "../pessoas.types";
import {
  EscopoPessoas,
  deslocamento,
  intersectarEmpresaSolicitada,
  podeAcessarPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import {
  assertDestinoCoerente,
  assertDestinoValidoEAtivo,
  dataUtc,
} from "../validacao-pessoas.util";
import { extrairDestino, traduzirErroPessoas } from "../pessoas-comum.util";
import {
  AdmitirColaboradorDto,
  ListarColaboradoresQueryDto,
  RetificarColaboradorDto,
} from "../dto/pessoas.dto";

/**
 * Colaborador — a pessoa. Carrega **apenas** os dados aprovados na Baseline V1
 * (item 1): `nome` e `situacao` derivada. Nenhum documento, contato, endereço,
 * data de nascimento, nome social ou dado sensível existe nesta entidade.
 *
 * Não tem `empresa_id`: a empresa é propriedade do **vínculo** (item 2). Por
 * isso o escopo de leitura atravessa a relação — um colaborador é visível a
 * quem tem escopo em alguma empresa onde ele tenha vínculo.
 */
@Injectable()
export class ColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  /**
   * Admissão: cria colaborador, primeiro vínculo (`previsto`) e a movimentação
   * de `admissao` — **na mesma transação**.
   *
   * Os três nascem juntos por necessidade de autorização, não por conveniência:
   * um colaborador sem vínculo não teria empresa, ficaria fora de todo escopo e
   * seria invisível até para quem o criou.
   *
   * O vínculo nasce `previsto`, nunca `ativo`: ativar exige efetivar a
   * movimentação, que é ato explícito e auditado (spec §8).
   */
  async admitir(
    dto: AdmitirColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<Colaborador> {
    const escopo = resolverEscopoPessoas(ctx.actor);

    if (dto.empresaId !== escopo.empresaId) {
      // Empresa fora do escopo: 404 público, `denied` na trilha. Nunca 403 —
      // confirmaria a existência da empresa.
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessarPessoas(ctx.actor, "colaborador", "create", escopo.empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        null,
        escopo.empresaId,
      );
    }

    const destino = extrairDestino(dto);
    assertDestinoCoerente("admissao", destino);

    const dataAdmissao = dataUtc(new Date(dto.dataAdmissao));
    const status: StatusMovimentacao =
      dataAdmissao > dataUtc(new Date()) ? "programada" : "solicitada";

    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertDestinoValidoEAtivo(tx, escopo.empresaId, destino);

        const colaborador = await tx.colaborador.create({
          data: { nome: dto.nome, situacao: SituacaoColaborador.inativo },
        });

        const vinculo = await tx.vinculoFuncional.create({
          data: {
            colaboradorId: colaborador.id,
            empresaId: escopo.empresaId,
            matricula: dto.matricula,
            tipo: dto.tipo,
            situacao: "previsto",
            dataAdmissao,
          },
        });

        const movimentacao = await tx.movimentacaoFuncional.create({
          data: {
            vinculoId: vinculo.id,
            empresaId: escopo.empresaId,
            tipo: "admissao",
            status,
            motivoCodigo: dto.motivoCodigo,
            solicitanteUserId: ctx.actor.id,
            vigenciaInicio: dataAdmissao,
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
          "pessoas_colaborador_criado",
          "colaborador",
          colaborador.id,
          escopo.empresaId,
        );
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_vinculo_criado",
          "vinculo_funcional",
          vinculo.id,
          escopo.empresaId,
        );
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          status === "programada"
            ? "pessoas_movimentacao_programada"
            : "pessoas_movimentacao_registrada",
          "movimentacao_funcional",
          movimentacao.id,
          escopo.empresaId,
        );

        return colaborador;
      });
    } catch (error) {
      traduzirErroPessoas(error);
    }
  }

  async listar(
    query: ListarColaboradoresQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ResultadoPaginado<Colaborador>> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const filtro = intersectarEmpresaSolicitada(escopo, query.empresaId);

    if (filtro === null) {
      // Pedido de outra empresa devolve página vazia, nunca erro.
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    // O escopo é estrutural: a consulta só encontra colaborador que tenha
    // vínculo na empresa do ator. Não depende de o service lembrar de filtrar
    // depois.
    const where: Prisma.ColaboradorWhereInput = {
      vinculos: {
        some: {
          empresaId: filtro.empresaId,
          ...(query.situacaoVinculo ? { situacao: query.situacaoVinculo } : {}),
        },
      },
      ...(query.situacao ? { situacao: query.situacao } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.colaborador.findMany({
        where,
        // Ordenação fixa no servidor — nunca vinda do cliente.
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.colaborador.count({ where }),
    ]);

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<Colaborador> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    return this.carregarNoEscopo(colaboradorId, ctx, escopo, "read");
  }

  /**
   * Retificação de cadastro — **só o nome** (spec §4.10 aplicado ao cadastro).
   *
   * A trilha registra *que* houve retificação, nunca o valor anterior nem o
   * novo (ADR 0004 §5): o valor seria dado pessoal, e a trilha não é
   * repositório de dado pessoal.
   */
  async retificar(
    colaboradorId: string,
    dto: RetificarColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<Colaborador> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const colaborador = await this.carregarNoEscopo(
      colaboradorId,
      ctx,
      escopo,
      "alter",
    );

    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.colaborador.update({
        where: { id: colaborador.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_colaborador_atualizado",
        "colaborador",
        atualizado.id,
        escopo.empresaId,
      );

      return atualizado;
    });
  }

  private async carregarNoEscopo(
    colaboradorId: string,
    ctx: PessoasAuditContext,
    escopo: EscopoPessoas,
    action: "read" | "alter" | "manage",
  ): Promise<Colaborador> {
    const colaborador = await this.prisma.colaborador.findFirst({
      where: {
        id: colaboradorId,
        vinculos: { some: { empresaId: escopo.empresaId } },
      },
    });

    if (!colaborador) {
      // Inexistente e fora do escopo respondem igual (404) — a distinção
      // vazaria a existência de uma pessoa em outra empresa.
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaboradorId,
        null,
      );
    }

    if (
      !podeAcessarPessoas(ctx.actor, "colaborador", action, escopo.empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaborador.id,
        escopo.empresaId,
      );
    }

    return colaborador;
  }
}
