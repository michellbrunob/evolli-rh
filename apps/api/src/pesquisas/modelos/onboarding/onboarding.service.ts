import { createHash } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { AuditService } from "../../../audit/audit.service";
import { CamposRecusadosException } from "../../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../../../pessoas/pessoas-auditoria.service";
import type { PessoasAuditContext } from "../../../pessoas/pessoas.types";
import type { SessionRequestMetadata } from "../../../auth/session/session.service";
import {
  dataDoDia,
  diaDe,
  hojeEmSaoPaulo,
  somarDias,
} from "../../../pessoas/ausencias/calculo-ausencias";
import { totalDePerguntas } from "../../estrutura-pesquisa";
import {
  CAMPOS_GRUPO,
  type CampoGrupo,
  type Secao,
} from "../../pesquisas.types";
import {
  motivoIndisponivel,
  podeEditar,
  statusEfetivo,
} from "../../regras-pesquisa";
import { catalogoAtivo, lotacoesVigentes } from "../../pessoas-da-pesquisa";
import { conferirRespostas } from "../../validacao-respostas";
import {
  feriadosLocais,
  pessoasAtivas,
  type PessoaAtiva,
} from "../pessoas-ativas";
import {
  aceitaResposta,
  conferirConfigOnboarding,
  configGravada,
  noPublico,
  proximasRodadas,
  ultimoDiaParaResponder,
  type ConfigOnboarding,
  type Publico,
  type SituacaoDoEnvio,
} from "./automacao-onboarding";
import {
  compararRodadas,
  contatos,
  fluxoDaIntencao,
  funil,
  pesoDosBlocos,
  resultadoDaRodada,
  textosDoPapel,
  type RespostaDoOnboarding,
} from "./calculo-onboarding";
import { ProcessadorDePesquisas } from "../processador-de-pesquisas";

/**
 * T216 — Onboarding com envio automático: a configuração do envio (RH), a
 * ativação, os convites (lista e "pular"), o resultado por rodada e a
 * resposta pelo link com a rodada. A resposta identificada guarda a pessoa
 * e a rodada (uma por rodada); a confidencial, só os grupos da lotação e a
 * rodada; o convite fica "respondido" com o dia, sem ligação com a resposta.
 */

type Db = Prisma.TransactionClient;

function hashDoPasse(passe: string): string {
  return createHash("sha256").update(passe, "utf8").digest("hex");
}

export interface OnboardingDetalhe {
  pesquisaId: string;
  config: ConfigOnboarding;
  ativa: boolean;
  /** O dia da ativação (`AAAA-MM-DD`), ou `null` antes de ativar. */
  ativadaEm: string | null;
  publico: { total: number; semEmail: number };
  proximas: Record<30 | 60 | 90, number>;
  funil: ReturnType<typeof funil>;
  proximoEnvio: { data: string; horario: string; pessoas: number } | null;
  link: string | null;
}

export interface PessoaDoPublicoOnboarding {
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  unidade: string | null;
  temEmail: boolean;
  noPublico: boolean;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    private readonly auditService: AuditService,
    private readonly processador: ProcessadorDePesquisas,
  ) {}

  private empresa(
    ctx: PessoasAuditContext,
    uso: "leitura" | "escrita",
  ): string {
    const papel = ctx.actor.role;
    const ok =
      papel === "rh" ||
      papel === "dp" ||
      (papel === "master_tecnico" && uso === "leitura");
    if (!ok || ctx.actor.companyId === null) throw new ForbiddenException();
    return ctx.actor.companyId;
  }

  private async linha(
    db: Db,
    id: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ) {
    const p = await db.pesquisa.findFirst({
      where: { id, empresaId, excluidaEm: null, modelo: "onboarding" },
    });
    if (!p) return this.auditoria.negarAcesso(ctx, "pesquisa", id, empresaId);
    return p;
  }

  private publicoDe(
    pessoas: readonly PessoaAtiva[],
    publico: Publico,
  ): PessoaAtiva[] {
    return pessoas.filter((p) => noPublico(comoPublico(p), publico));
  }

  async obter(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<OnboardingDetalhe> {
    const empresaId = this.empresa(ctx, "leitura");
    const p = await this.linha(this.prisma, id, empresaId, ctx);
    return this.detalhe(this.prisma, p);
  }

  private async detalhe(
    db: Db,
    p: {
      id: string;
      empresaId: string;
      configModelo: unknown;
      status: Parameters<typeof statusEfetivo>[0];
      encerraEm: Date | null;
      publicadaEm: Date | null;
      token: string;
    },
  ): Promise<OnboardingDetalhe> {
    const config = configGravada(p.configModelo);
    const hoje = hojeEmSaoPaulo();
    const [pessoas, envios, feriados] = await Promise.all([
      pessoasAtivas(db, p.empresaId),
      db.pesquisaEnvio.findMany({
        where: { pesquisaId: p.id },
        select: { situacao: true, dataPrevista: true },
      }),
      feriadosLocais(db, p.empresaId, hoje, somarDias(hoje, 45)),
    ]);
    const doPublico = this.publicoDe(pessoas, config.publico);
    const agendados = envios
      .filter((e) => e.situacao === "agendado")
      .map((e) => diaDe(e.dataPrevista))
      .sort();
    const proximo = agendados[0] ?? null;
    const status = statusEfetivo(p.status, p.encerraEm, new Date());
    return {
      pesquisaId: p.id,
      config,
      ativa: status === "ativa",
      ativadaEm: p.publicadaEm ? hojeEmSaoPaulo(p.publicadaEm) : null,
      publico: {
        total: doPublico.length,
        semEmail: doPublico.filter((x) => !x.temEmail).length,
      },
      proximas: proximasRodadas(
        pessoas.map(comoPublico),
        config,
        hoje,
        feriados,
      ),
      funil: funil(envios),
      proximoEnvio: proximo
        ? {
            data: proximo,
            horario: config.horario,
            pessoas: agendados.filter((d) => d === proximo).length,
          }
        : null,
      link: p.publicadaEm ? `#/p/${p.token}` : null,
    };
  }

  /** Quem está no público hoje (e quem não tem e-mail), para o assistente. */
  async previaDoPublico(
    dto: { publico?: unknown; soDiasUteis?: unknown },
    ctx: PessoasAuditContext,
  ): Promise<{
    total: number;
    semEmail: number;
    proximas: Record<30 | 60 | 90, number>;
    pessoas: PessoaDoPublicoOnboarding[];
  }> {
    const empresaId = this.empresa(ctx, "leitura");
    const hoje = hojeEmSaoPaulo();
    const r = conferirConfigOnboarding(
      {
        publico: dto.publico ?? { tipo: "todos" },
        soDiasUteis: dto.soDiasUteis ?? true,
      },
      "confidencial",
      hoje,
    );
    if (!r.config) throw new CamposRecusadosException(r.erros);
    const [pessoas, feriados] = await Promise.all([
      pessoasAtivas(this.prisma, empresaId),
      feriadosLocais(this.prisma, empresaId, hoje, somarDias(hoje, 45)),
    ]);
    const lista = pessoas.map((p) => ({
      colaboradorId: p.id,
      nome: p.nome,
      cargo: p.cargo,
      departamento: p.departamento,
      unidade: p.unidade,
      temEmail: p.temEmail,
      noPublico: noPublico(comoPublico(p), r.config!.publico),
    }));
    const dentro = lista.filter((x) => x.noPublico);
    return {
      total: dentro.length,
      semEmail: dentro.filter((x) => !x.temEmail).length,
      proximas: proximasRodadas(
        pessoas.map(comoPublico),
        r.config,
        hoje,
        feriados,
      ),
      pessoas: lista,
    };
  }

  /** Grava a configuração do envio (rascunho, ativa ou pausada). */
  async salvar(
    id: string,
    dto: { config?: unknown },
    ctx: PessoasAuditContext,
  ): Promise<OnboardingDetalhe> {
    const empresaId = this.empresa(ctx, "escrita");
    return this.prisma.$transaction(async (tx) => {
      const p = await this.linha(tx, id, empresaId, ctx);
      if (!podeEditar(statusEfetivo(p.status, p.encerraEm, new Date()))) {
        throw new ConflictException();
      }
      const r = conferirConfigOnboarding(
        dto.config,
        p.identificacao,
        hojeEmSaoPaulo(),
      );
      if (!r.config) throw new CamposRecusadosException(r.erros);
      // O modo não muda depois de ativar (os convites já seguem um modo).
      if (p.status !== "rascunho") {
        const atual = configGravada(p.configModelo);
        if (atual.modo !== r.config.modo) {
          throw new CamposRecusadosException([
            { campo: "envio", motivo: "nao_editavel" },
          ]);
        }
      }
      const alterada = await tx.pesquisa.update({
        where: { id },
        data: {
          configModelo: r.config as unknown as Prisma.InputJsonValue,
          todos: false,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_alterada",
        "pesquisa",
        id,
        empresaId,
      );
      return this.detalhe(tx, alterada);
    });
  }

  /**
   * Ativa: o rascunho fica ativo e o link funciona; os convites saem conforme
   * o modo (agora: já; agendado: no dia; automático: na data de cada pessoa).
   * Não exige participante: no automático, as pessoas entram com o tempo.
   */
  async ativar(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<OnboardingDetalhe> {
    const empresaId = this.empresa(ctx, "escrita");
    await this.prisma.$transaction(async (tx) => {
      const p = await this.linha(tx, id, empresaId, ctx);
      if (statusEfetivo(p.status, p.encerraEm, new Date()) !== "rascunho") {
        throw new ConflictException();
      }
      const erros = [];
      if (totalDePerguntas(p.secoes as unknown as Secao[]) === 0) {
        erros.push({
          campo: "secoes" as const,
          motivo: "obrigatorio" as const,
        });
      }
      if (p.configModelo === null) {
        erros.push({ campo: "envio" as const, motivo: "obrigatorio" as const });
      } else {
        const r = conferirConfigOnboarding(
          p.configModelo,
          p.identificacao,
          hojeEmSaoPaulo(),
        );
        erros.push(...r.erros);
      }
      if (p.encerraEm && p.encerraEm.getTime() <= Date.now()) {
        erros.push({
          campo: "encerraEm" as const,
          motivo: "invalido" as const,
        });
      }
      if (erros.length) throw new CamposRecusadosException(erros);
      await tx.pesquisa.update({
        where: { id },
        data: { status: "ativa", publicadaEm: new Date() },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_publicada",
        "pesquisa",
        id,
        empresaId,
      );
    });
    // Agora: os convites já saem (ou ficam aguardando e-mail).
    await this.processador.processarOnboarding(id, new Date());
    const p = await this.linha(this.prisma, id, empresaId, ctx);
    return this.detalhe(this.prisma, p);
  }

  async envios(id: string, ctx: PessoasAuditContext) {
    const empresaId = this.empresa(ctx, "leitura");
    const p = await this.linha(this.prisma, id, empresaId, ctx);
    const config = configGravada(p.configModelo);
    const linhas = await this.prisma.pesquisaEnvio.findMany({
      where: { pesquisaId: id },
      orderBy: [{ dataPrevista: "asc" }, { id: "asc" }],
      select: {
        id: true,
        colaboradorId: true,
        rodada: true,
        dataPrevista: true,
        situacao: true,
        enviadoEm: true,
        lembreteEm: true,
        colaborador: { select: { nome: true } },
      },
    });
    const anonima = p.identificacao === "anonima";
    return {
      identificacao: p.identificacao,
      horario: config.horario,
      itens: linhas.map((l) => ({
        id: l.id,
        colaboradorId: l.colaboradorId,
        nome: l.colaborador.nome,
        rodada: l.rodada,
        dataPrevista: diaDe(l.dataPrevista),
        prazo: ultimoDiaParaResponder(diaDe(l.dataPrevista), config.prazoDias),
        // Na anônima, ninguém sabe quem respondeu: só quem recebeu.
        situacao: (anonima && l.situacao === "respondido"
          ? "aguardando_email"
          : l.situacao) as SituacaoDoEnvio,
        enviadoEm: l.enviadoEm ? l.enviadoEm.toISOString() : null,
        lembreteEm: l.lembreteEm ? l.lembreteEm.toISOString() : null,
      })),
    };
  }

  /** "Pular envio": só o convite ainda agendado. */
  async pular(
    id: string,
    envioId: string,
    ctx: PessoasAuditContext,
  ): Promise<void> {
    const empresaId = this.empresa(ctx, "escrita");
    await this.prisma.$transaction(async (tx) => {
      await this.linha(tx, id, empresaId, ctx);
      const r = await tx.pesquisaEnvio.updateMany({
        where: { id: envioId, pesquisaId: id, situacao: "agendado" },
        data: { situacao: "pulado" },
      });
      if (r.count !== 1) {
        const existe = await tx.pesquisaEnvio.count({
          where: { id: envioId, pesquisaId: id },
        });
        if (!existe) throw new NotFoundException();
        throw new ConflictException();
      }
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_alterada",
        "pesquisa",
        id,
        empresaId,
      );
    });
  }

  async resultados(
    id: string,
    filtro: { campo: CampoGrupo; grupoId: string } | null,
    ctx: PessoasAuditContext,
  ) {
    const empresaId = this.empresa(ctx, "leitura");
    const p = await this.linha(this.prisma, id, empresaId, ctx);
    const config = configGravada(p.configModelo);
    const secoes = p.secoes as unknown as Secao[];
    const linhas = await this.prisma.pesquisaResposta.findMany({
      where: { pesquisaId: id },
      orderBy: [{ respondidaEm: "asc" }, { id: "asc" }],
      select: {
        rodada: true,
        colaboradorId: true,
        departamentoId: true,
        centroCustoId: true,
        unidadeId: true,
        valores: true,
      },
    });
    // O grupo de cada resposta: identificada pela lotação vigente; as outras
    // pelo que foi gravado (lotação no envio ou escolha na anônima).
    const lot =
      p.identificacao === "identificada"
        ? await lotacoesVigentes(
            this.prisma,
            empresaId,
            linhas.flatMap((l) => (l.colaboradorId ? [l.colaboradorId] : [])),
          )
        : new Map();
    const grupoDe = (
      l: (typeof linhas)[number],
      campo: CampoGrupo,
    ): string | null => {
      if (l.colaboradorId) return lot.get(l.colaboradorId)?.[campo]?.id ?? null;
      return campo === "departamento"
        ? l.departamentoId
        : campo === "centroCusto"
          ? l.centroCustoId
          : l.unidadeId;
    };
    const filtradas = filtro
      ? linhas.filter((l) => grupoDe(l, filtro.campo) === filtro.grupoId)
      : linhas;
    const respostas: RespostaDoOnboarding[] = filtradas.map((l) => ({
      rodada: l.rodada,
      colaboradorId:
        p.identificacao === "identificada" ? l.colaboradorId : null,
      valores: new Map(
        (l.valores as unknown as { perguntaId: string; valor: unknown }[]).map(
          (v) => [v.perguntaId, v.valor],
        ),
      ),
    }));
    const rodadasConfig: number[] =
      config.modo === "automatizar" ? config.rodadas : [0];
    const rodadas = [
      ...new Set([...rodadasConfig, ...respostas.map((r) => r.rodada)]),
    ].sort((a, b) => a - b);
    const porRodada = rodadas.map((r) =>
      resultadoDaRodada(
        r,
        secoes,
        respostas.filter((x) => x.rodada === r),
      ),
    );
    const comparacoes = porRodada
      .slice(1)
      .map((depois) => compararRodadas(porRodada[0]!, depois))
      .filter((c) => c !== null);
    const visivel = respostas.length >= 3;
    const envios = await this.prisma.pesquisaEnvio.findMany({
      where: { pesquisaId: id },
      select: { situacao: true },
    });
    const grupos: Partial<Record<CampoGrupo, { id: string; nome: string }[]>> =
      {};
    for (const campo of CAMPOS_GRUPO) {
      grupos[campo] = await catalogoAtivo(this.prisma, empresaId, campo);
    }
    return {
      pesquisaId: id,
      identificacao: p.identificacao,
      respostas: respostas.length,
      filtro: filtro ?? null,
      rodadas: porRodada,
      comparacoes,
      peso: pesoDosBlocos(secoes, respostas),
      fluxo:
        p.identificacao === "identificada" && rodadas.length >= 2
          ? {
              de: rodadas[0]!,
              para: rodadas[1]!,
              ...fluxoDaIntencao(secoes, respostas, rodadas[0]!, rodadas[1]!),
            }
          : null,
      contatos: visivel ? contatos(secoes, respostas) : [],
      melhorar: visivel ? textosDoPapel(secoes, respostas, "melhorar") : [],
      gosta: visivel ? textosDoPapel(secoes, respostas, "gosta") : [],
      funil: funil(envios),
      grupos,
    };
  }

  // -------------------------------------------------------------------------
  // Pelo link

  async responder(
    token: string,
    dados: {
      passe?: string;
      rodada?: number | null;
      grupos?: Record<string, unknown>;
      respostas: { perguntaId: string; valor: unknown }[];
    },
    metadata: SessionRequestMetadata,
  ): Promise<{ ok: true; rodada: number }> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException();
    const p = await this.prisma.pesquisa.findFirst({
      where: {
        token,
        excluidaEm: null,
        publicadaEm: { not: null },
        modelo: "onboarding",
      },
    });
    if (!p) throw new NotFoundException();
    if (motivoIndisponivel(p.status, p.encerraEm, new Date()) !== null) {
      throw new GoneException();
    }
    const config = configGravada(p.configModelo);
    const hoje = hojeEmSaoPaulo();
    const identifica = p.identificacao !== "anonima";
    const rodadasValidas: number[] =
      config.modo === "automatizar" ? config.rodadas : [0];
    if (
      dados.rodada !== undefined &&
      dados.rodada !== null &&
      !rodadasValidas.includes(dados.rodada)
    ) {
      throw new CamposRecusadosException([
        { campo: "rodada", motivo: "invalido" },
      ]);
    }

    let participante: { id: string; colaboradorId: string } | null = null;
    let envio: { id: string; rodada: number } | null = null;
    if (identifica) {
      if (!dados.passe) throw new UnauthorizedException();
      const linha = await this.prisma.pesquisaPasse.findFirst({
        where: {
          hash: hashDoPasse(dados.passe),
          pesquisaId: p.id,
          expiraEm: { gt: new Date() },
        },
        select: { participante: { select: { id: true, colaboradorId: true } } },
      });
      if (!linha) throw new UnauthorizedException();
      participante = linha.participante;
      const convites = await this.prisma.pesquisaEnvio.findMany({
        where: {
          pesquisaId: p.id,
          colaboradorId: participante.colaboradorId,
          ...(dados.rodada !== undefined && dados.rodada !== null
            ? { rodada: dados.rodada }
            : {}),
        },
        orderBy: [{ dataPrevista: "asc" }],
        select: { id: true, rodada: true, situacao: true, dataPrevista: true },
      });
      const aberto = convites.find((c) =>
        aceitaResposta(
          {
            situacao: c.situacao as SituacaoDoEnvio,
            dataPrevista: diaDe(c.dataPrevista),
          },
          config.prazoDias,
          hoje,
        ),
      );
      if (!aberto) {
        if (convites.some((c) => c.situacao === "respondido")) {
          throw new ConflictException();
        }
        throw new GoneException();
      }
      envio = { id: aberto.id, rodada: aberto.rodada };
    } else if (
      config.modo === "automatizar" &&
      (dados.rodada === undefined || dados.rodada === null)
    ) {
      throw new CamposRecusadosException([
        { campo: "rodada", motivo: "obrigatorio" },
      ]);
    }
    const rodada = envio?.rodada ?? dados.rodada ?? 0;

    const conferidas = conferirRespostas(
      p.secoes as unknown as Secao[],
      dados.respostas,
    );
    if (conferidas.erros.length) {
      throw new CamposRecusadosException(conferidas.erros);
    }
    // Anônima: a escolha de grupo (só os campos da pesquisa).
    let grupos: Record<CampoGrupo, string | null> = {
      departamento: null,
      centroCusto: null,
      unidade: null,
    };
    if (!identifica && dados.grupos) {
      for (const [chave, valor] of Object.entries(dados.grupos)) {
        const campo = chave as CampoGrupo;
        if (
          !(CAMPOS_GRUPO as readonly string[]).includes(chave) ||
          (valor !== null &&
            valor !== undefined &&
            (!p.separarPor.includes(campo) || typeof valor !== "string"))
        ) {
          throw new CamposRecusadosException([
            { campo: "grupos", motivo: "invalido" },
          ]);
        }
        if (typeof valor === "string" && valor) {
          const ativos = await catalogoAtivo(this.prisma, p.empresaId, campo);
          if (!ativos.some((g) => g.id === valor)) {
            throw new CamposRecusadosException([
              { campo: "grupos", motivo: "invalido" },
            ]);
          }
          grupos[campo] = valor;
        }
      }
    }
    await this.prisma.$transaction(async (tx) => {
      if (participante && envio) {
        const marcado = await tx.pesquisaEnvio.updateMany({
          where: {
            id: envio.id,
            situacao: { notIn: ["respondido", "pulado"] },
          },
          data: { situacao: "respondido", respondidoEm: dataDoDia(hoje) },
        });
        if (marcado.count !== 1) throw new ConflictException();
        // O passe vale para um envio (como nas demais pesquisas).
        await tx.pesquisaPasse.deleteMany({
          where: { participanteId: participante.id },
        });
        if (p.identificacao === "confidencial") {
          const lot = (
            await lotacoesVigentes(tx, p.empresaId, [
              participante.colaboradorId,
            ])
          ).get(participante.colaboradorId);
          grupos = {
            departamento: lot?.departamento?.id ?? null,
            centroCusto: lot?.centroCusto?.id ?? null,
            unidade: lot?.unidade?.id ?? null,
          };
        }
      }
      try {
        await tx.pesquisaResposta.create({
          data: {
            pesquisaId: p.id,
            empresaId: p.empresaId,
            colaboradorId:
              p.identificacao === "identificada" && participante
                ? participante.colaboradorId
                : null,
            departamentoId: grupos.departamento,
            centroCustoId: grupos.centroCusto,
            unidadeId: grupos.unidade,
            valores: conferidas.valores as unknown as Prisma.InputJsonValue,
            respondidaEm:
              p.identificacao === "confidencial" ? dataDoDia(hoje) : new Date(),
            rodada,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new ConflictException();
        }
        throw e;
      }
      await this.auditService.record(
        {
          actorType: "system",
          actorSystemId: "pesquisa-publica:onboarding",
          companyId: p.empresaId,
          action: "pesquisas_resposta_recebida",
          resource: "pesquisa",
          resourceId: p.id,
          ip: null,
          userAgent: null,
          result: "success",
          requestId: metadata.requestId,
        },
        tx,
      );
    });
    return { ok: true, rodada };
  }
}

export function comoPublico(p: PessoaAtiva) {
  return {
    id: p.id,
    admissao: p.admissao,
    departamentoId: p.departamentoId,
    cargoId: p.cargoId,
    unidadeId: p.unidadeId,
    centroCustoId: p.centroCustoId,
  };
}
