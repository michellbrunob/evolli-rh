import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  AcaoSolicitacaoPessoa,
  Prisma,
  SolicitacaoPessoa,
  SolicitacaoPessoaEvento,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { transicionarSolicitacao } from "../solicitacoes/solicitacoes";
import {
  AtorSolicitacao,
  Solicitacao,
} from "../solicitacoes/solicitacoes.types";
import { SolicitacoesPessoasAuditoriaService } from "./solicitacoes-pessoas-auditoria.service";
import {
  ACAO_AUDIT_ACTION,
  ACAO_ORIGEM,
  ACOES_COM_MOTIVO_OBRIGATORIO,
  ResultadoPaginado,
  SolicitacoesPessoasAuditContext,
} from "./solicitacoes-pessoas.types";
import {
  EscopoLeituraSolicitacoesPessoas,
  deslocamento,
  filtroEmpresaLeituraSolicitacoesPessoas,
  intersectarLeituraSolicitacoesPessoas,
  parsearDiaReferencia,
  podeAcessarSolicitacoesPessoas,
  podeConsultarSolicitacoesPessoas,
  resolverEscopoLeituraSolicitacoesPessoas,
  resolverEscopoSolicitacoesPessoas,
} from "./escopo-solicitacoes-pessoas.util";
import {
  ListarSolicitacoesPessoaQueryDto,
  RegistrarSolicitacaoPessoaDto,
  TransicionarSolicitacaoPessoaDto,
} from "./dto/solicitacoes-pessoas.dto";

/**
 * Traduz erro do Prisma em resposta genérica. Nunca vaza tabela, coluna ou
 * constraint — o cliente recebe a categoria do problema, não o schema.
 */
function traduzirErro(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ConflictException();
    }
    if (error.code === "P2003") {
      throw new UnprocessableEntityException();
    }
  }
  throw error;
}

/**
 * Central de Solicitações de Pessoas — fundação backend (T139).
 *
 * A Central **registra e encaminha**; ela não executa nada. Nenhum método aqui
 * altera ponto, férias, cadastro, vínculo, benefício, Banco de Horas, Folha ou
 * fechamento, e nenhum cria pendência em "Verificar folhas" (`PD-SOL-02`
 * manteve os dois registros independentes). Levar uma solicitação a
 * `encaminhada_para_operacao_rh` é **handoff**: a operação real acontece no
 * fluxo próprio e autorizado do RH, com auditoria própria.
 *
 * A máquina de estados **não é reimplementada aqui**: este service delega a
 * `transicionarSolicitacao` do núcleo puro, que é a única fonte das transições
 * aprovadas. Duas máquinas divergentes é exatamente o que a T139 evita.
 */
@Injectable()
export class SolicitacaoPessoaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: SolicitacoesPessoasAuditoriaService,
  ) {}

  async registrar(
    dto: RegistrarSolicitacaoPessoaDto,
    ctx: SolicitacoesPessoasAuditContext,
  ): Promise<SolicitacaoPessoa> {
    const escopo = resolverEscopoSolicitacoesPessoas(ctx.actor);

    // `empresaId` do corpo é CONFERIDO contra a sessão, nunca usado como
    // concessão: pedir outra empresa é tentativa negada, não um filtro.
    if (dto.empresaId !== escopo.empresaId) {
      return this.auditoria.negarAcesso(ctx, null, dto.empresaId);
    }
    if (
      !podeAcessarSolicitacoesPessoas(
        ctx.actor,
        "solicitacao_pessoa",
        "create",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(ctx, null, escopo.empresaId);
    }

    let periodoReferencia: Date | null = null;
    if (dto.periodoReferencia !== undefined) {
      periodoReferencia = parsearDiaReferencia(dto.periodoReferencia);
      if (periodoReferencia === null) {
        // Dia que não existe no calendário (ex.: 2026-02-30).
        throw new UnprocessableEntityException();
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // O vínculo é conferido DENTRO do escopo antes da FK composta reagir:
        // um vínculo de outra empresa precisa responder 404 (indistinguível de
        // inexistente), não o erro de integridade que confirmaria sua ausência.
        const vinculo = await tx.vinculoFuncional.findFirst({
          where: { id: dto.vinculoId, empresaId: escopo.empresaId },
          select: { id: true },
        });
        if (!vinculo) {
          return this.auditoria.negarAcesso(ctx, null, escopo.empresaId);
        }

        const solicitacao = await tx.solicitacaoPessoa.create({
          data: {
            empresaId: escopo.empresaId,
            vinculoId: dto.vinculoId,
            tipo: dto.tipo,
            motivo: dto.motivo,
            periodoReferencia,
            registradoPorUserId: ctx.actor.id,
            // `situacao` permanece o default `rascunho`: a máquina de estados
            // começa do início, sempre.
          },
        });

        await tx.solicitacaoPessoaEvento.create({
          data: {
            solicitacaoId: solicitacao.id,
            empresaId: escopo.empresaId,
            acao: "criar",
            // Sem estado anterior: o registro acabou de nascer.
            situacaoDe: null,
            situacaoPara: solicitacao.situacao,
            // O motivo do registro vive na própria solicitação e é imutável;
            // repeti-lo aqui seria duplicar a mesma verdade em dois lugares.
            motivo: null,
            registradoPorUserId: ctx.actor.id,
            requestId: ctx.metadata.requestId,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          ACAO_AUDIT_ACTION.criar,
          solicitacao.id,
          escopo.empresaId,
        );

        return solicitacao;
      });
    } catch (error) {
      traduzirErro(error);
    }
  }

  async transicionar(
    solicitacaoId: string,
    dto: TransicionarSolicitacaoPessoaDto,
    ctx: SolicitacoesPessoasAuditContext,
  ): Promise<SolicitacaoPessoa> {
    const escopo = resolverEscopoSolicitacoesPessoas(ctx.actor);

    // "Justificativa auditada" de `PD-SOL-03`: recusa e reabertura exigem
    // motivo codificado. Exigir onde a decisão não pediu seria inventar regra.
    if (
      ACOES_COM_MOTIVO_OBRIGATORIO.includes(dto.acao) &&
      dto.motivo === undefined
    ) {
      throw new UnprocessableEntityException();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // ---- 1. LOCK -------------------------------------------------------
        // `FOR UPDATE` serializa transições concorrentes sobre a MESMA
        // solicitação (mesmo padrão de `movimentacao.efetivar`). Sem ele, duas
        // requisições simultâneas leem o mesmo estado anterior, ambas validam
        // contra ele e ambas confirmam: a última a gravar venceria e a linha do
        // tempo registraria duas transições partindo do mesmo estado — inclusive
        // um `cancelar` aplicado depois de `em_revisao_rh`, que `PD-SOL-03`
        // proíbe. Lock em memória não serviria: a API roda em mais de um
        // processo, e a serialização precisa ser do banco.
        //
        // O predicado casa `id` **e** `empresa_id` da sessão: solicitação
        // inexistente e solicitação de outra empresa produzem as duas zero
        // linhas — nenhuma espera pelo lock e nenhuma se distingue da outra, que
        // é o que mantém o 404 anti-enumeração (ADR 0006).
        const travada = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM solicitacao_pessoa
          WHERE id = ${solicitacaoId}::text
            AND empresa_id = ${escopo.empresaId}::text
          FOR UPDATE
        `;
        if (travada.length === 0) {
          return this.auditoria.negarAcesso(ctx, solicitacaoId, null);
        }

        // ---- 2. RELEITURA SOB O LOCK ---------------------------------------
        // Statement novo em READ COMMITTED enxerga um snapshot novo: se uma
        // transição concorrente commitou enquanto esperávamos o lock, é o estado
        // DELA que chega aqui. A perdedora valida contra o estado já serializado
        // e cai no 422 padrão da API, em vez de sobrescrever a vencedora.
        const atual = await tx.solicitacaoPessoa.findFirst({
          where: { id: solicitacaoId, empresaId: escopo.empresaId },
        });
        if (!atual) {
          return this.auditoria.negarAcesso(ctx, solicitacaoId, null);
        }
        if (
          !podeAcessarSolicitacoesPessoas(
            ctx.actor,
            "solicitacao_pessoa",
            "alter",
            atual.empresaId,
          )
        ) {
          return this.auditoria.negarAcesso(ctx, atual.id, atual.empresaId);
        }

        const resultado = transicionarSolicitacao(
          this.paraNucleo(atual, ctx),
          dto.acao,
          this.atorDaAcao(dto.acao, atual, ctx),
          ctx.metadata.requestId,
        );

        if (resultado.status !== "transicionada") {
          // Transição fora de ordem, estado terminal ou entrada inválida. A
          // resposta é genérica: o código interno do núcleo é rótulo técnico e
          // não é repassado ao cliente.
          throw new UnprocessableEntityException();
        }

        const situacaoNova = resultado.solicitacao.situacao;
        const solicitacao = await tx.solicitacaoPessoa.update({
          where: { id: atual.id },
          data: {
            situacao: situacaoNova,
            ...(dto.acao === "enviar" ? { enviadaEm: new Date() } : {}),
            // Gravado UMA vez, na primeira entrada em revisão: é a evidência do
            // primeiro retorno do RH (`PD-SOL-04`). Reabertura posterior não o
            // reescreve, senão a evidência original se perderia.
            ...(situacaoNova === "em_revisao_rh" &&
            atual.primeiraRevisaoEm === null
              ? { primeiraRevisaoEm: new Date() }
              : {}),
          },
        });

        await tx.solicitacaoPessoaEvento.create({
          data: {
            solicitacaoId: atual.id,
            empresaId: atual.empresaId,
            acao: dto.acao,
            situacaoDe: atual.situacao,
            situacaoPara: situacaoNova,
            motivo: dto.motivo ?? null,
            registradoPorUserId: ctx.actor.id,
            requestId: ctx.metadata.requestId,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          ACAO_AUDIT_ACTION[dto.acao],
          atual.id,
          atual.empresaId,
        );

        return solicitacao;
      });
    } catch (error) {
      traduzirErro(error);
    }
  }

  async listar(
    query: ListarSolicitacoesPessoaQueryDto,
    ctx: SolicitacoesPessoasAuditContext,
  ): Promise<ResultadoPaginado<SolicitacaoPessoa>> {
    const escopo = resolverEscopoLeituraSolicitacoesPessoas(ctx.actor);
    const filtro = intersectarLeituraSolicitacoesPessoas(
      escopo,
      query.empresaId,
    );

    if (filtro === null) {
      // Empresa alheia é página vazia, nunca erro: erro confirmaria que a
      // empresa existe (anti-enumeração).
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
      };
    }

    const where: Prisma.SolicitacaoPessoaWhereInput = {
      ...(filtro.empresaId !== undefined
        ? { empresaId: filtro.empresaId }
        : {}),
      ...(query.vinculoId ? { vinculoId: query.vinculoId } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.situacao ? { situacao: query.situacao } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.solicitacaoPessoa.findMany({
        where,
        orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
      }),
      this.prisma.solicitacaoPessoa.count({ where }),
    ]);

    await this.auditoria.registrarLeitura(
      ctx,
      null,
      escopo.global ? null : escopo.empresaId,
    );

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(
    solicitacaoId: string,
    ctx: SolicitacoesPessoasAuditContext,
  ): Promise<SolicitacaoPessoa> {
    const escopo = resolverEscopoLeituraSolicitacoesPessoas(ctx.actor);
    const solicitacao = await this.carregarNoEscopo(solicitacaoId, ctx, escopo);

    await this.auditoria.registrarLeitura(
      ctx,
      solicitacao.id,
      escopo.global ? null : escopo.empresaId,
    );

    return solicitacao;
  }

  /**
   * Linha do tempo da solicitação, em ordem cronológica. Append-only: o que
   * está aqui nunca é editado nem removido (o banco revoga `UPDATE`/`DELETE`),
   * então uma correção futura aparece como evento NOVO ao final.
   */
  async historico(
    solicitacaoId: string,
    ctx: SolicitacoesPessoasAuditContext,
  ): Promise<SolicitacaoPessoaEvento[]> {
    const escopo = resolverEscopoLeituraSolicitacoesPessoas(ctx.actor);
    const solicitacao = await this.carregarNoEscopo(solicitacaoId, ctx, escopo);

    const eventos = await this.prisma.solicitacaoPessoaEvento.findMany({
      where: {
        solicitacaoId: solicitacao.id,
        empresaId: solicitacao.empresaId,
      },
      orderBy: [{ ocorridoEm: "asc" }, { id: "asc" }],
    });

    await this.auditoria.registrarLeitura(
      ctx,
      solicitacao.id,
      escopo.global ? null : escopo.empresaId,
    );

    return eventos;
  }

  private async carregarNoEscopo(
    solicitacaoId: string,
    ctx: SolicitacoesPessoasAuditContext,
    escopo: EscopoLeituraSolicitacoesPessoas,
  ): Promise<SolicitacaoPessoa> {
    const solicitacao = await this.prisma.solicitacaoPessoa.findFirst({
      where: {
        id: solicitacaoId,
        ...filtroEmpresaLeituraSolicitacoesPessoas(escopo),
      },
    });

    if (!solicitacao) {
      return this.auditoria.negarAcesso(ctx, solicitacaoId, null);
    }

    if (
      !podeConsultarSolicitacoesPessoas(
        ctx.actor,
        "solicitacao_pessoa",
        "read",
        escopo,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        solicitacao.id,
        escopo.global ? null : escopo.empresaId,
      );
    }

    return solicitacao;
  }

  /** Projeta a linha persistida no formato do núcleo puro. */
  private paraNucleo(
    linha: SolicitacaoPessoa,
    ctx: SolicitacoesPessoasAuditContext,
  ): Solicitacao {
    return {
      id: linha.id,
      empresaRef: linha.empresaId,
      vinculoRef: linha.vinculoId,
      tipo: linha.tipo,
      periodoReferencia:
        linha.periodoReferencia === null
          ? null
          : linha.periodoReferencia.toISOString().slice(0, 10),
      motivo: linha.motivo,
      situacao: linha.situacao,
      refAuditoria: ctx.metadata.requestId,
    };
  }

  /**
   * Ator **no vocabulário do núcleo**: papel = origem da intenção, não
   * identidade autenticada.
   *
   * Quem executa é sempre o RH autenticado — é ele que a auditoria grava e é
   * sobre ele que o RBAC decidiu. Como não existe vínculo
   * `AccessUser <-> Colaborador` (DP-23), as ações de origem do colaborador são
   * registradas pelo RH em nome dele, e aqui recebem o papel `colaborador` com
   * as referências da própria solicitação para que o núcleo aplique a tabela de
   * transições correta. A regra que importa — cancelar só antes de
   * `em_revisao_rh` — é garantida pela máquina de estados, não por este mapa.
   */
  private atorDaAcao(
    acao: Exclude<AcaoSolicitacaoPessoa, "criar">,
    linha: SolicitacaoPessoa,
    ctx: SolicitacoesPessoasAuditContext,
  ): AtorSolicitacao {
    return ACAO_ORIGEM[acao] === "colaborador"
      ? {
          papel: "colaborador",
          empresaRef: linha.empresaId,
          vinculoRef: linha.vinculoId,
        }
      : {
          papel: "rh",
          empresaRef: linha.empresaId,
          // O RH não tem vínculo funcional: a referência é a da própria conta,
          // e o núcleo só exige que ela não seja vazia para o papel `rh`.
          vinculoRef: ctx.actor.id,
        };
  }
}
