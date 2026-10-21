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
import {
  ContadoresColaboradores,
  PessoasAuditContext,
  ResultadoPaginado,
} from "../pessoas.types";
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
import {
  DadosPessoaisColaboradorService,
  ValoresEndereco,
  ValoresPerfil,
} from "../dados-pessoais/dados-pessoais.service";
import {
  ContatoColaboradorService,
  ValoresContatos,
} from "../contatos/contato-colaborador.service";

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
 *
 * O topo também é escolhido campo a campo — e não `...colaborador` —, para que
 * uma coluna futura no `Colaborador` não passe para esta resposta sem decisão.
 */
export interface AdmissaoRegistrada extends Pick<
  Colaborador,
  "id" | "nome" | "situacao" | "criadoEm" | "atualizadoEm"
> {
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
  /**
   * T177 — o que o servidor gravou do Módulo 1. Perfil e contatos são
   * obrigatórios na admissão; endereço é `null` quando nenhum campo veio.
   */
  perfilPessoal: ValoresPerfil;
  endereco: ValoresEndereco | null;
  contatos: ValoresContatos;
}

/**
 * T178 — vínculo resumido na listagem: o que a porta principal de
 * Colaboradores mostra (matrícula, situação e admissão), sem tipo, lotação nem
 * nada além. Só vínculos do escopo da sessão.
 */
export interface VinculoListado {
  id: string;
  empresaId: string;
  matricula: string;
  situacao: SituacaoVinculo;
  dataAdmissao: Date;
  dataDesligamento: Date | null;
}

/**
 * T178 — item da listagem: projeção FECHADA. `situacao` é a situação **na
 * empresa ativa** para quem está escopado (tem vínculo ativo nela), e a
 * materializada (global) só para o `master_tecnico` sem empresa ativa. A
 * global, para o RH de uma empresa, mostraria "ativo" um colaborador desligado
 * ali e ativo em outra — resíduo de uma empresa na tela da outra.
 */
export interface ColaboradorListado {
  id: string;
  nome: string;
  situacao: SituacaoColaborador;
  criadoEm: Date;
  atualizadoEm: Date;
  /** Ordenados: ativo, previsto, encerrado; depois admissão mais recente. */
  vinculos: VinculoListado[];
}

export interface ListagemColaboradores extends ResultadoPaginado<ColaboradorListado> {
  contadores: ContadoresColaboradores;
}

/**
 * O `contains` do Prisma vira `LIKE '%termo%'` sem escapar os curingas: uma
 * busca por "%" ou "_" casaria com todo mundo. Escapados, valem literalmente.
 */
export function escaparCuringas(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const ORDEM_SITUACAO_VINCULO: Record<SituacaoVinculo, number> = {
  ativo: 0,
  previsto: 1,
  encerrado: 2,
};

/** Vínculo principal primeiro: o ativo, depois o previsto, depois o mais novo. */
export function ordenarVinculosListados(
  vinculos: readonly VinculoListado[],
): VinculoListado[] {
  return [...vinculos].sort(
    (a, b) =>
      ORDEM_SITUACAO_VINCULO[a.situacao] - ORDEM_SITUACAO_VINCULO[b.situacao] ||
      b.dataAdmissao.getTime() - a.dataAdmissao.getTime() ||
      a.matricula.localeCompare(b.matricula),
  );
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
    // T177 — Módulo 1 do cadastro, gravado na transação da admissão.
    private readonly dadosPessoais: DadosPessoaisColaboradorService,
    private readonly contatos: ContatoColaboradorService,
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
    // T177 — cada bloco do Módulo 1 tem a sua própria permissão, reavaliada
    // com a empresa ativa. Hoje `rh` e `dp` têm as duas; a verificação existe
    // para que o dia em que as matrizes divergirem não abra um atalho pela
    // admissão.
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "dados_pessoais_colaborador",
        "alter",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "dados_pessoais_colaborador",
        null,
        escopo.empresaId,
      );
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "contato_colaborador",
        "alter",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "contato_colaborador",
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

        // T177 — Módulo 1: perfil, endereço e contatos iniciais, na MESMA
        // transação. Qualquer falha desfaz a admissão inteira: não existe
        // colaborador sem os dados enviados, nem dado sem colaborador.
        const alvoModulo1 = {
          colaboradorId: colaborador.id,
          empresaId: escopo.empresaId,
        };
        const modulo1 = await this.dadosPessoais.gravarNaAdmissao(
          tx,
          ctx,
          alvoModulo1,
          { perfilPessoal: dto.perfilPessoal, endereco: dto.endereco },
        );
        const contatosGravados = await this.contatos.criarNaAdmissao(
          tx,
          ctx,
          alvoModulo1,
          dto.contatos,
        );

        return {
          id: colaborador.id,
          nome: colaborador.nome,
          situacao: colaborador.situacao,
          criadoEm: colaborador.criadoEm,
          atualizadoEm: colaborador.atualizadoEm,
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
          perfilPessoal: modulo1.perfilPessoal,
          endereco: modulo1.endereco,
          contatos: contatosGravados,
        };
      });
    } catch (error) {
      traduzirErroPessoas(error);
    }
  }

  /**
   * Listagem da porta principal de Colaboradores (T164; T178).
   *
   * - **Escopo estrutural:** para `rh`/`dp` (e `master_tecnico` com empresa
   *   ativa), só colaborador com vínculo na empresa da sessão; para o
   *   `master_tecnico` sem empresa ativa, toda a base, auditada.
   * - **Situação na empresa:** escopado, "ativo" é ter vínculo ativo NA
   *   empresa ativa — no filtro, na coluna e nos contadores. Global, vale a
   *   situação materializada.
   * - **Busca** (T178): nome contém, sem diferenciar maiúsculas; ou matrícula
   *   contém, só em vínculos do escopo.
   * - **Contadores** (T178): o escopo inteiro, sem filtros nem busca.
   */
  async listar(
    query: ListarColaboradoresQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ListagemColaboradores> {
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
    const filtro = intersectarLeitura(escopo, query.empresaId);

    if (filtro === null) {
      // Pedido de outra empresa devolve página vazia, nunca erro.
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
        contadores: { ativos: 0, inativos: 0 },
      };
    }

    const empresaId = filtro.empresaId;
    const noEscopo: Prisma.VinculoFuncionalWhereInput =
      empresaId !== undefined ? { empresaId } : {};

    // Escopo: colaborador com vínculo na empresa (escopado) ou qualquer um
    // (global). É a base de tudo — lista, total e contadores.
    const base: Prisma.ColaboradorWhereInput =
      empresaId !== undefined ? { vinculos: { some: { empresaId } } } : {};

    const ativoNoEscopo: Prisma.ColaboradorWhereInput =
      empresaId !== undefined
        ? { vinculos: { some: { empresaId, situacao: "ativo" } } }
        : { situacao: "ativo" };
    const inativoNoEscopo: Prisma.ColaboradorWhereInput =
      empresaId !== undefined
        ? { vinculos: { none: { empresaId, situacao: "ativo" } } }
        : { situacao: "inativo" };

    const filtros: Prisma.ColaboradorWhereInput[] = [base];
    if (query.situacaoVinculo) {
      filtros.push({
        vinculos: { some: { ...noEscopo, situacao: query.situacaoVinculo } },
      });
    }
    if (query.situacao) {
      filtros.push(
        query.situacao === "ativo" ? ativoNoEscopo : inativoNoEscopo,
      );
    }
    if (query.busca) {
      const termo = escaparCuringas(query.busca);
      filtros.push({
        OR: [
          { nome: { contains: termo, mode: "insensitive" } },
          {
            vinculos: {
              some: {
                ...noEscopo,
                matricula: { contains: termo, mode: "insensitive" },
              },
            },
          },
        ],
      });
    }
    const where: Prisma.ColaboradorWhereInput = { AND: filtros };

    const [linhas, total, ativos, totalNoEscopo] = await Promise.all([
      this.prisma.colaborador.findMany({
        where,
        // Ordenação fixa no servidor — nunca vinda do cliente.
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
        select: {
          id: true,
          nome: true,
          situacao: true,
          criadoEm: true,
          atualizadoEm: true,
          vinculos: {
            where: noEscopo,
            select: {
              id: true,
              empresaId: true,
              matricula: true,
              situacao: true,
              dataAdmissao: true,
              dataDesligamento: true,
            },
          },
        },
      }),
      this.prisma.colaborador.count({ where }),
      this.prisma.colaborador.count({ where: { AND: [base, ativoNoEscopo] } }),
      this.prisma.colaborador.count({ where: base }),
    ]);

    if (escopo.global) {
      // Consulta ampla do Master: auditada (fail-safe), sem dado pessoal.
      await this.auditoria.registrarConsultaGlobal(ctx, "colaborador", null);
    }

    const itens: ColaboradorListado[] = linhas.map((c) => ({
      id: c.id,
      nome: c.nome,
      situacao:
        empresaId !== undefined
          ? c.vinculos.some((v) => v.situacao === "ativo")
            ? "ativo"
            : "inativo"
          : c.situacao,
      criadoEm: c.criadoEm,
      atualizadoEm: c.atualizadoEm,
      vinculos: ordenarVinculosListados(c.vinculos),
    }));

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
      contadores: { ativos, inativos: totalNoEscopo - ativos },
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
