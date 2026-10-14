import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccessUser, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SessionRequestMetadata } from "../auth/session/session.service";
import { comoDiaIso } from "./gestor-escopo";
import { classificarErroDeBanco } from "./diagnostico-erro-banco";
import {
  CriarAtribuicaoDto,
  CriarExcecaoDto,
  VincularContaDto,
} from "./dto/gestor.dto";

export interface GestorAuditContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/**
 * Resposta única para "este registro já está encerrado".
 *
 * Genérica de propósito, e idêntica nos três encerramentos: distinguir "você
 * perdeu a corrida" de "isto já estava encerrado desde ontem" não muda nada
 * para quem chamou — nos dois casos a operação não aconteceu e o estado final
 * é o mesmo — e descrever qual foi o caso revelaria atividade de outro
 * operador do RH.
 */
const MENSAGEM_JA_ENCERRADO = "O registro já está encerrado.";

/**
 * A lista fechada de CHECKs mudou para `diagnostico-erro-banco.ts`, junto da
 * regra que a usa. Reexportada porque é parte do contrato público deste
 * módulo desde a T157.
 */
export { CHECKS_DA_FAMILIA_GESTOR } from "./diagnostico-erro-banco";

/**
 * Administração do escopo do gestor, pelo RH (T151, ADR 0015, decisões 6 e 9).
 *
 * Três capacidades, nenhuma delas destrutiva:
 *   - ligar/desligar uma conta de acesso a um colaborador (DP-23);
 *   - atribuir/encerrar a responsabilidade de um gestor sobre uma equipe;
 *   - conceder/revogar exceção individual, sempre com prazo e justificativa.
 *
 * **Nada aqui apaga histórico.** Encerrar é sempre preencher `vigencia_fim`
 * — nunca `DELETE`, nunca reescrita de período passado. O banco reforça:
 * não há rota `DELETE` e toda FK é `ON DELETE RESTRICT`.
 *
 * **Toda mutação audita na mesma transação** (ADR 0004 §2). Se a auditoria
 * falhar, `AuditService.record` lança dentro da transação e o Prisma reverte
 * a alteração junto — uma concessão de acesso registrada sem trilha é pior
 * que uma concessão que falhou.
 *
 * **O escopo de empresa vem sempre do ator**, nunca do corpo da requisição. O
 * RH administra apenas a própria empresa; o banco confirma por FK composta e
 * por CONSTRAINT TRIGGER, de modo que um erro de aplicação não basta para
 * cruzar empresas.
 */
@Injectable()
export class GestorAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Empresa do ator. `master_tecnico` é global e **não administra** — o RBAC
   * já o nega em `gestor_atribuicao` para `create`/`alter`, e aqui a ausência
   * de `companyId` vira recusa explícita em vez de `null` propagado.
   */
  private empresaDoAtor(ctx: GestorAuditContext): string {
    const empresaId = ctx.actor.companyId;
    if (!empresaId) {
      throw new NotFoundException();
    }
    return empresaId;
  }

  private async auditar(
    tx: Prisma.TransactionClient,
    ctx: GestorAuditContext,
    action: Parameters<AuditService["record"]>[0]["action"],
    resource: Parameters<AuditService["record"]>[0]["resource"],
    resourceId: string,
    empresaId: string,
  ): Promise<void> {
    await this.auditService.record(
      {
        actorType: "user",
        actorUserId: ctx.actor.id,
        actorRole: ctx.actor.role,
        companyId: empresaId,
        action,
        resource,
        resourceId,
        ip: ctx.metadata.ip,
        userAgent: ctx.metadata.userAgent,
        result: "success",
        requestId: ctx.metadata.requestId,
      },
      tx,
    );
  }

  /**
   * Traduz violação de invariante do banco em resposta estável.
   *
   * `P2002` (índice único parcial) e `23P01` (EXCLUSION) descrevem a mesma
   * colisão de negócio — já existe registro vigente para aquele período — e
   * viram 409. A mensagem é genérica de propósito: detalhar qual registro
   * colidiu revelaria configuração de outra equipe a quem perguntou.
   */
  private comoConflito(erro: unknown, mensagem: string): never {
    // Exceções HTTP que o próprio service levantou (o 409 do encerramento
    // perdido, o 404 anti-enumeração) atravessam intactas.
    //
    // Redundante hoje — o `throw erro` do fim já as devolveria sem tocar — e
    // mantida mesmo assim: a garantia passaria a depender de nenhuma cláusula
    // futura casar antes, e "o 404 anti-enumeração não pode virar 409" é
    // forte demais para ficar valendo por acidente de ordenação.
    if (
      erro instanceof ConflictException ||
      erro instanceof NotFoundException
    ) {
      throw erro;
    }

    // A regra em si vive em `diagnostico-erro-banco.ts` e **não mudou na
    // T161**: `P2002`, `23P01`/`23505` por texto e `23514` só com o nome de
    // um CHECK desta família. Nenhum SQLSTATE novo virou conflito.
    if (classificarErroDeBanco(erro) === "conflito") {
      throw new ConflictException(mensagem);
    }

    // T161 — o que escapa daqui vira 500, e o `AllExceptionsFilter` é quem
    // o identifica no log (classe, código do Prisma, SQLSTATE e constraint).
    //
    // O diagnóstico NÃO mora aqui de propósito: o E2E roda com
    // `LOG_LEVEL=silent`, então um `PinoLogger` neste ponto não escreveria
    // nada justamente na CI, que é onde a falha aparece. O `Logger` do Nest,
    // usado pelo filtro, escreve — foi ele que produziu a única pista que
    // existiu em `0db3d70`.
    throw erro;
  }

  // -------------------------------------------------------------------------
  // DP-23 — ligação conta ↔ colaborador
  // -------------------------------------------------------------------------

  /**
   * Liga uma conta de acesso a um colaborador.
   *
   * A pessoa **nunca** é inferida: o RH informa os dois identificadores, e o
   * banco verifica que a conta pertence à empresa e que o colaborador tem
   * vínculo nela. Igualdade de e-mail entre conta e cadastro não participa da
   * decisão — não é prova de identidade.
   */
  async vincularConta(ctx: GestorAuditContext, dto: VincularContaDto) {
    const empresaId = this.empresaDoAtor(ctx);

    // 404 anti-enumeração: conta de outra empresa é indistinguível de conta
    // inexistente para quem pergunta.
    const conta = await this.prisma.accessUser.findFirst({
      where: { id: dto.userId, companyId: empresaId },
      select: { id: true },
    });
    if (!conta) throw new NotFoundException();

    const temVinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId: dto.colaboradorId, empresaId },
      select: { id: true },
    });
    if (!temVinculo) throw new NotFoundException();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.accessUserColaborador.create({
          data: {
            userId: dto.userId,
            colaboradorId: dto.colaboradorId,
            empresaId,
            vigenciaInicio: new Date(`${dto.vigenciaInicio}T00:00:00.000Z`),
            criadoPorUserId: ctx.actor.id,
          },
        });

        await this.auditar(
          tx,
          ctx,
          "gestor_conta_vinculada",
          "access_user_colaborador",
          criado.id,
          empresaId,
        );

        return this.comoLigacao(criado);
      });
    } catch (erro) {
      return this.comoConflito(
        erro,
        "Já existe ligação vigente para esta conta ou para este colaborador.",
      );
    }
  }

  /**
   * Encerra a ligação. Não apaga: preenche `vigencia_fim`, e a linha histórica
   * permanece — o banco agora recusa `DELETE` para `evolli_app` e recusa
   * reabrir o que já foi encerrado (migration 20261007120000).
   */
  async desvincularConta(
    ctx: GestorAuditContext,
    ligacaoId: string,
    vigenciaFim: string,
  ) {
    const empresaId = this.empresaDoAtor(ctx);

    // 404 anti-enumeração, e SÓ isso: registro de outra empresa é
    // indistinguível de inexistente. Esta leitura não decide o encerramento —
    // quem decide é o predicado do `updateMany` abaixo.
    const existe = await this.prisma.accessUserColaborador.findFirst({
      where: { id: ligacaoId, empresaId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const alteradas = await tx.accessUserColaborador.updateMany({
          where: { id: ligacaoId, empresaId, vigenciaFim: null },
          data: {
            vigenciaFim: new Date(`${vigenciaFim}T00:00:00.000Z`),
            encerradoPorUserId: ctx.actor.id,
          },
        });
        if (alteradas.count === 0) {
          throw new ConflictException(MENSAGEM_JA_ENCERRADO);
        }

        const encerrada = await tx.accessUserColaborador.findUniqueOrThrow({
          where: { id: ligacaoId },
        });

        await this.auditar(
          tx,
          ctx,
          "gestor_conta_desvinculada",
          "access_user_colaborador",
          encerrada.id,
          empresaId,
        );

        return this.comoLigacao(encerrada);
      });
    } catch (erro) {
      return this.comoConflito(erro, MENSAGEM_JA_ENCERRADO);
    }
  }

  async listarLigacoes(ctx: GestorAuditContext) {
    const empresaId = this.empresaDoAtor(ctx);
    // `select` explícito, não a linha inteira: as colunas que não aparecem
    // na projeção não precisam sair do banco. `criadoPorUserId` e
    // `encerradoPorUserId` ficam de fora de propósito — a autoria da
    // configuração é dado de trilha, e quem precisa dela consulta a
    // auditoria, onde a leitura fica registrada.
    const ligacoes = await this.prisma.accessUserColaborador.findMany({
      where: { empresaId },
      select: {
        id: true,
        userId: true,
        colaboradorId: true,
        vigenciaInicio: true,
        vigenciaFim: true,
      },
      orderBy: [{ vigenciaInicio: "desc" }, { id: "asc" }],
    });
    return ligacoes.map((l) => this.comoLigacao(l));
  }

  // -------------------------------------------------------------------------
  // Atribuição gestor ↔ equipe
  // -------------------------------------------------------------------------

  async criarAtribuicao(ctx: GestorAuditContext, dto: CriarAtribuicaoDto) {
    const empresaId = this.empresaDoAtor(ctx);

    // A equipe precisa ser desta empresa. A FK composta garante no banco; esta
    // checagem existe para devolver 404 em vez de erro de integridade.
    const equipe = await this.prisma.equipe.findFirst({
      where: { id: dto.equipeId, empresaId },
      select: { id: true },
    });
    if (!equipe) throw new NotFoundException();

    const gestorTemVinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId: dto.gestorColaboradorId, empresaId },
      select: { id: true },
    });
    if (!gestorTemVinculo) throw new NotFoundException();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.atribuicaoGestorEquipe.create({
          data: {
            empresaId,
            equipeId: dto.equipeId,
            gestorColaboradorId: dto.gestorColaboradorId,
            papel: dto.papel,
            vigenciaInicio: new Date(`${dto.vigenciaInicio}T00:00:00.000Z`),
            vigenciaFim: dto.vigenciaFim
              ? new Date(`${dto.vigenciaFim}T00:00:00.000Z`)
              : null,
            criadoPorUserId: ctx.actor.id,
          },
        });

        await this.auditar(
          tx,
          ctx,
          "gestor_atribuicao_criada",
          "atribuicao_gestor_equipe",
          criada.id,
          empresaId,
        );

        return this.comoAtribuicao(criada);
      });
    } catch (erro) {
      return this.comoConflito(
        erro,
        "Já existe atribuição vigente com este papel para a equipe no período.",
      );
    }
  }

  /**
   * Encerra a atribuição. **Atômico**: o encerramento é o próprio `UPDATE`
   * condicionado, não uma leitura seguida de escrita.
   *
   * O que havia antes era um TOCTOU clássico: `findFirst` conferia
   * `vigenciaFim === null`, e o `update` seguinte endereçava só o `id`. Dois
   * `PATCH` simultâneos passavam os dois pela conferência e os dois
   * escreviam — o segundo sobrescrevia autor e data do primeiro, e a trilha
   * ficava com dois eventos de encerramento para um encerramento só.
   *
   * Com o predicado dentro do `updateMany`, o PostgreSQL resolve: em READ
   * COMMITTED, a segunda transação espera o lock da linha e, ao ser liberada,
   * **reavalia o predicado sobre a versão nova** da tupla. `vigenciaFim` já
   * não é nula, nada casa, `count` é zero, e o 409 é levantado DENTRO da
   * transação — então a auditoria da perdedora também reverte. Exatamente um
   * encerramento, exatamente um evento.
   *
   * O banco diz o mesmo de forma independente: o trigger
   * `atribuicao_gestor_equipe_encerramento_unico` recusa reabrir ou reescrever
   * o encerramento mesmo que este predicado seja removido por engano.
   */
  async encerrarAtribuicao(
    ctx: GestorAuditContext,
    atribuicaoId: string,
    vigenciaFim: string,
  ) {
    const empresaId = this.empresaDoAtor(ctx);

    const existe = await this.prisma.atribuicaoGestorEquipe.findFirst({
      where: { id: atribuicaoId, empresaId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const alteradas = await tx.atribuicaoGestorEquipe.updateMany({
          where: { id: atribuicaoId, empresaId, vigenciaFim: null },
          data: {
            vigenciaFim: new Date(`${vigenciaFim}T00:00:00.000Z`),
            encerradoPorUserId: ctx.actor.id,
          },
        });
        if (alteradas.count === 0) {
          throw new ConflictException(MENSAGEM_JA_ENCERRADO);
        }

        const encerrada = await tx.atribuicaoGestorEquipe.findUniqueOrThrow({
          where: { id: atribuicaoId },
        });

        await this.auditar(
          tx,
          ctx,
          "gestor_atribuicao_encerrada",
          "atribuicao_gestor_equipe",
          encerrada.id,
          empresaId,
        );

        return this.comoAtribuicao(encerrada);
      });
    } catch (erro) {
      return this.comoConflito(
        erro,
        "O encerramento conflita com outra atribuição do mesmo papel.",
      );
    }
  }

  async listarAtribuicoes(ctx: GestorAuditContext, equipeId?: string) {
    const empresaId = this.empresaDoAtor(ctx);
    const atribuicoes = await this.prisma.atribuicaoGestorEquipe.findMany({
      where: { empresaId, ...(equipeId ? { equipeId } : {}) },
      select: {
        id: true,
        equipeId: true,
        gestorColaboradorId: true,
        papel: true,
        vigenciaInicio: true,
        vigenciaFim: true,
      },
      orderBy: [{ vigenciaInicio: "desc" }, { id: "asc" }],
    });
    return atribuicoes.map((a) => this.comoAtribuicao(a));
  }

  // -------------------------------------------------------------------------
  // Exceção individual
  // -------------------------------------------------------------------------

  async criarExcecao(ctx: GestorAuditContext, dto: CriarExcecaoDto) {
    const empresaId = this.empresaDoAtor(ctx);

    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { id: dto.vinculoId, empresaId },
      select: { id: true },
    });
    if (!vinculo) throw new NotFoundException();

    const gestorTemVinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId: dto.gestorColaboradorId, empresaId },
      select: { id: true },
    });
    if (!gestorTemVinculo) throw new NotFoundException();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.excecaoAcessoGestor.create({
          data: {
            empresaId,
            gestorColaboradorId: dto.gestorColaboradorId,
            vinculoId: dto.vinculoId,
            motivoCodigo: dto.motivoCodigo,
            justificativa: dto.justificativa.trim(),
            vigenciaInicio: new Date(`${dto.vigenciaInicio}T00:00:00.000Z`),
            vigenciaFim: new Date(`${dto.vigenciaFim}T00:00:00.000Z`),
            criadoPorUserId: ctx.actor.id,
          },
        });

        await this.auditar(
          tx,
          ctx,
          "gestor_excecao_criada",
          "excecao_acesso_gestor",
          criada.id,
          empresaId,
        );

        return this.comoExcecao(criada);
      });
    } catch (erro) {
      return this.comoConflito(
        erro,
        "Já existe exceção vigente para este gestor e vínculo no período.",
      );
    }
  }

  /**
   * Revoga uma exceção antes do prazo. O período original permanece gravado —
   * `encerrada_em` encurta o alcance sem reescrever o que foi concedido, de
   * modo que a trilha continua mostrando o que se decidiu e quando mudou.
   */
  async encerrarExcecao(ctx: GestorAuditContext, excecaoId: string) {
    const empresaId = this.empresaDoAtor(ctx);

    const existe = await this.prisma.excecaoAcessoGestor.findFirst({
      where: { id: excecaoId, empresaId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException();

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Mesmo encerramento atômico de `encerrarAtribuicao` — aqui o marco é
        // `encerradaEm`, não `vigenciaFim`: o prazo acordado permanece
        // gravado, e a revogação apenas o encurta. Reescrever `vigenciaFim`
        // apagaria o que o RH havia concedido.
        const alteradas = await tx.excecaoAcessoGestor.updateMany({
          where: { id: excecaoId, empresaId, encerradaEm: null },
          data: {
            encerradaEm: new Date(),
            encerradoPorUserId: ctx.actor.id,
          },
        });
        if (alteradas.count === 0) {
          throw new ConflictException(MENSAGEM_JA_ENCERRADO);
        }

        const encerrada = await tx.excecaoAcessoGestor.findUniqueOrThrow({
          where: { id: excecaoId },
        });

        await this.auditar(
          tx,
          ctx,
          "gestor_excecao_encerrada",
          "excecao_acesso_gestor",
          encerrada.id,
          empresaId,
        );

        return this.comoExcecao(encerrada);
      });
    } catch (erro) {
      return this.comoConflito(erro, MENSAGEM_JA_ENCERRADO);
    }
  }

  async listarExcecoes(ctx: GestorAuditContext, gestorColaboradorId?: string) {
    const empresaId = this.empresaDoAtor(ctx);
    // A `justificativa` SAI aqui, e isso é deliberado: a decisão 9 exige que
    // o RH possa auditar por que cada exceção existe, e esconder o motivo de
    // quem administra as exceções inutilizaria a listagem. A rota é
    // `gestor_atribuicao/read`, negada ao gestor e a todos os outros papéis.
    const excecoes = await this.prisma.excecaoAcessoGestor.findMany({
      where: {
        empresaId,
        ...(gestorColaboradorId ? { gestorColaboradorId } : {}),
      },
      select: {
        id: true,
        gestorColaboradorId: true,
        vinculoId: true,
        motivoCodigo: true,
        justificativa: true,
        vigenciaInicio: true,
        vigenciaFim: true,
        encerradaEm: true,
      },
      orderBy: [{ vigenciaInicio: "desc" }, { id: "asc" }],
    });
    return excecoes.map((e) => this.comoExcecao(e));
  }

  // -------------------------------------------------------------------------
  // Projeções. Datas sempre como `YYYY-MM-DD`: `@db.Date` chega do Prisma como
  // DateTime em UTC, e devolver o ISO completo convidaria o cliente a
  // interpretá-lo em fuso local, deslocando o dia.
  // -------------------------------------------------------------------------

  private comoLigacao(l: {
    id: string;
    userId: string;
    colaboradorId: string;
    vigenciaInicio: Date;
    vigenciaFim: Date | null;
  }) {
    return {
      id: l.id,
      userId: l.userId,
      colaboradorId: l.colaboradorId,
      vigenciaInicio: comoDiaIso(l.vigenciaInicio),
      vigenciaFim: comoDiaIso(l.vigenciaFim),
    };
  }

  private comoAtribuicao(a: {
    id: string;
    equipeId: string;
    gestorColaboradorId: string;
    papel: string;
    vigenciaInicio: Date;
    vigenciaFim: Date | null;
  }) {
    return {
      id: a.id,
      equipeId: a.equipeId,
      gestorColaboradorId: a.gestorColaboradorId,
      papel: a.papel,
      vigenciaInicio: comoDiaIso(a.vigenciaInicio),
      vigenciaFim: comoDiaIso(a.vigenciaFim),
    };
  }

  private comoExcecao(e: {
    id: string;
    gestorColaboradorId: string;
    vinculoId: string;
    motivoCodigo: string;
    justificativa: string;
    vigenciaInicio: Date;
    vigenciaFim: Date;
    encerradaEm: Date | null;
  }) {
    return {
      id: e.id,
      gestorColaboradorId: e.gestorColaboradorId,
      vinculoId: e.vinculoId,
      motivoCodigo: e.motivoCodigo,
      justificativa: e.justificativa,
      vigenciaInicio: comoDiaIso(e.vigenciaInicio),
      vigenciaFim: comoDiaIso(e.vigenciaFim),
      encerradaEm: e.encerradaEm ? e.encerradaEm.toISOString() : null,
    };
  }
}
