import { Injectable } from "@nestjs/common";
import {
  Colaborador,
  Prisma,
  SituacaoColaborador,
  SituacaoVinculo,
  StatusMovimentacao,
  TipoMovimentacao,
  TipoVinculo,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext, ResultadoPaginado } from "../pessoas.types";
import {
  EscopoLeituraPessoas,
  deslocamento,
  filtroVinculoEmpresa,
  intersectarLeitura,
  podeAcessarPessoas,
  podeConsultarPessoas,
  resolverEscopoLeituraPessoas,
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
 * Resposta da admissão (T167).
 *
 * Mantém os campos do `Colaborador` no topo — quem já lia `id`, `nome` e
 * `situacao` continua lendo —, e ACRESCENTA a confirmação do vínculo e do ato
 * de admissão criados na mesma transação. Antes, o cliente precisava de dois
 * GETs para saber que vínculo tinha nascido.
 *
 * Projeção FECHADA: cada campo é escolhido aqui, nunca a entidade inteira. Só
 * entram dados já aprovados (nome, matrícula, tipo, situação, datas
 * funcionais) e identificadores técnicos. A lotação aparece como os ids do
 * destino gravado na movimentação: a alocação só nasce na efetivação (ADR 0007,
 * ato × estado), e afirmar uma lotação vigente aqui seria falso.
 */
export interface AdmissaoRegistrada extends Colaborador {
  vinculo: {
    id: string;
    empresaId: string;
    matricula: string;
    tipo: TipoVinculo;
    situacao: SituacaoVinculo;
    dataAdmissao: Date;
  };
  movimentacao: {
    id: string;
    tipo: TipoMovimentacao;
    status: StatusMovimentacao;
    vigenciaInicio: Date;
    destino: {
      unidadeOrganizacionalId: string | null;
      departamentoId: string | null;
      areaId: string | null;
      equipeId: string | null;
      cargoId: string | null;
      centroCustoId: string | null;
    };
  };
}

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
  ): Promise<AdmissaoRegistrada> {
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

        return {
          ...colaborador,
          vinculo: {
            id: vinculo.id,
            empresaId: vinculo.empresaId,
            matricula: vinculo.matricula,
            tipo: vinculo.tipo,
            situacao: vinculo.situacao,
            dataAdmissao: vinculo.dataAdmissao,
          },
          movimentacao: {
            id: movimentacao.id,
            tipo: movimentacao.tipo,
            status: movimentacao.status,
            vigenciaInicio: movimentacao.vigenciaInicio,
            destino: {
              unidadeOrganizacionalId:
                movimentacao.destinoUnidadeOrganizacionalId,
              departamentoId: movimentacao.destinoDepartamentoId,
              areaId: movimentacao.destinoAreaId,
              equipeId: movimentacao.destinoEquipeId,
              cargoId: movimentacao.destinoCargoId,
              centroCustoId: movimentacao.destinoCentroCustoId,
            },
          },
        };
      });
    } catch (error) {
      traduzirErroPessoas(error);
    }
  }

  async listar(
    query: ListarColaboradoresQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ResultadoPaginado<Colaborador>> {
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
    const filtro = intersectarLeitura(escopo, query.empresaId);

    if (filtro === null) {
      // Pedido de outra empresa devolve página vazia, nunca erro.
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    // O escopo é estrutural: para rh/dp a consulta só encontra colaborador com
    // vínculo na empresa do ator. Para o `master_tecnico` (global), sem filtro
    // de empresa (`filtro.empresaId` indefinido) — toda a base, auditada.
    const filtroVinculo =
      filtro.empresaId !== undefined
        ? {
            some: {
              empresaId: filtro.empresaId,
              ...(query.situacaoVinculo
                ? { situacao: query.situacaoVinculo }
                : {}),
            },
          }
        : query.situacaoVinculo
          ? { some: { situacao: query.situacaoVinculo } }
          : undefined;

    const where: Prisma.ColaboradorWhereInput = {
      ...(filtroVinculo ? { vinculos: filtroVinculo } : {}),
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

    if (escopo.global) {
      // Consulta ampla do Master: auditada (fail-safe), sem dado pessoal.
      await this.auditoria.registrarConsultaGlobal(ctx, "colaborador", null);
    }

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
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
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
      // Mutação é sempre escopada (master_tecnico nunca chega aqui): reusa o
      // carregador de leitura na forma escopada.
      { global: false, empresaId: escopo.empresaId },
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
    escopo: EscopoLeituraPessoas,
    action: "read" | "alter" | "manage",
  ): Promise<Colaborador> {
    const colaborador = await this.prisma.colaborador.findFirst({
      where: {
        id: colaboradorId,
        // Escopado: só se tiver vínculo na empresa do ator. Global (Master):
        // sem filtro de empresa.
        ...filtroVinculoEmpresa(escopo),
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

    if (!podeConsultarPessoas(ctx.actor, "colaborador", action, escopo)) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaborador.id,
        escopo.global ? null : escopo.empresaId,
      );
    }

    if (escopo.global && action === "read") {
      // Leitura global do Master: auditada (fail-safe), só id técnico.
      await this.auditoria.registrarConsultaGlobal(
        ctx,
        "colaborador",
        colaborador.id,
      );
    }

    return colaborador;
  }
}
