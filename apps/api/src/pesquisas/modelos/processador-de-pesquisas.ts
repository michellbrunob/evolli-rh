import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  dataDoDia,
  diaDe,
  hojeEmSaoPaulo,
  somarDias,
} from "../../pessoas/ausencias/calculo-ausencias";
import { statusEfetivo } from "../regras-pesquisa";
import { feriadosLocais, pessoasAtivas } from "./pessoas-ativas";
import {
  NOTIFICADOR_DE_PESQUISAS,
  type NotificadorDePesquisas,
} from "./notificador-de-pesquisas";
import {
  ATRASO_MAXIMO_DIAS,
  HORIZONTE_DIAS,
  configGravada as configDoOnboarding,
  envioVencido,
  lembreteDevido,
  planejarEnvios,
  situacaoDepoisDoAviso,
  type SituacaoDoEnvio,
} from "./onboarding/automacao-onboarding";
import {
  agendaDeLembretes,
  configGravada as configDaAvaliacao,
  MARCO_DO_AVISO,
} from "./avaliacao/regras-avaliacao";
import { ehAvaliacao } from "./avaliacao/definicao";

/**
 * T216 — o processo periódico das pesquisas (chamado pelo agendador e logo
 * depois de ativar um onboarding). Idempotente: um convite por pessoa e
 * rodada (ou marco), transições condicionais e lembrete uma vez só — rodar
 * duas vezes, ou em duas instâncias, não duplica nada.
 *
 * - Onboarding: cria os convites de quem entra (na data de cada pessoa, até
 *   30 dias antes), avisa os que venceram e manda o lembrete.
 * - Avaliação 90°/180° com envio por e-mail: o convite de cada participante
 *   e os lembretes agendados para quem ainda tem pessoa pendente.
 *
 * Sem provedor de e-mail, o aviso não sai e o convite fica "aguardando
 * e-mail" (ou "sem e-mail", se a pessoa não tem e-mail no cadastro).
 */

@Injectable()
export class ProcessadorDePesquisas {
  private readonly logger = new Logger("ProcessadorDePesquisas");

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICADOR_DE_PESQUISAS)
    private readonly notificador: NotificadorDePesquisas,
  ) {}

  /** Todas as pesquisas ativas de onboarding e de avaliação. */
  async processar(agora: Date = new Date()): Promise<number> {
    const ativas = await this.prisma.pesquisa.findMany({
      where: {
        status: "ativa",
        excluidaEm: null,
        publicadaEm: { not: null },
        modelo: { in: ["onboarding", "avaliacao90", "avaliacao180"] },
      },
      select: { id: true, modelo: true },
    });
    let mudancas = 0;
    for (const p of ativas) {
      try {
        mudancas += ehAvaliacao(p.modelo)
          ? await this.processarAvaliacao(p.id, agora)
          : await this.processarOnboarding(p.id, agora);
      } catch (e) {
        // Uma pesquisa com problema não para as outras.
        this.logger.error(
          `Falha ao processar a pesquisa ${p.id}: ${(e as Error).message}`,
        );
      }
    }
    return mudancas;
  }

  async processarOnboarding(pesquisaId: string, agora: Date): Promise<number> {
    const p = await this.prisma.pesquisa.findFirst({
      where: {
        id: pesquisaId,
        modelo: "onboarding",
        excluidaEm: null,
        publicadaEm: { not: null },
      },
    });
    if (!p || statusEfetivo(p.status, p.encerraEm, agora) !== "ativa") return 0;
    const config = configDoOnboarding(p.configModelo);
    const hoje = hojeEmSaoPaulo(agora);
    const inicio = hojeEmSaoPaulo(p.publicadaEm!);
    const [pessoas, envios, feriados] = await Promise.all([
      pessoasAtivas(this.prisma, p.empresaId),
      this.prisma.pesquisaEnvio.findMany({
        where: { pesquisaId },
        select: {
          id: true,
          colaboradorId: true,
          rodada: true,
          situacao: true,
          dataPrevista: true,
          lembreteEm: true,
        },
      }),
      feriadosLocais(
        this.prisma,
        p.empresaId,
        somarDias(inicio, -ATRASO_MAXIMO_DIAS - 1),
        somarDias(hoje, HORIZONTE_DIAS + 15),
      ),
    ]);
    let mudancas = 0;
    const planejados = planejarEnvios({
      config,
      inicio,
      hoje,
      pessoas: pessoas.map((x) => ({
        id: x.id,
        admissao: x.admissao,
        departamentoId: x.departamentoId,
        cargoId: x.cargoId,
        unidadeId: x.unidadeId,
        centroCustoId: x.centroCustoId,
      })),
      existentes: new Set(envios.map((e) => `${e.colaboradorId}:${e.rodada}`)),
      feriados,
    });
    if (planejados.length) {
      const criados = await this.prisma.pesquisaEnvio.createMany({
        data: planejados.map((e) => ({
          pesquisaId,
          empresaId: p.empresaId,
          colaboradorId: e.colaboradorId,
          rodada: e.rodada,
          dataPrevista: dataDoDia(e.dataPrevista),
        })),
        skipDuplicates: true,
      });
      mudancas += criados.count;
      // Identificada e confidencial: quem tem convite entra pelo link.
      if (p.identificacao !== "anonima") {
        await this.prisma.pesquisaParticipante.createMany({
          data: [...new Set(planejados.map((e) => e.colaboradorId))].map(
            (colaboradorId) => ({
              pesquisaId,
              empresaId: p.empresaId,
              colaboradorId,
            }),
          ),
          skipDuplicates: true,
        });
      }
    }
    const temEmail = new Map(pessoas.map((x) => [x.id, x.temEmail]));
    const atuais = await this.prisma.pesquisaEnvio.findMany({
      where: {
        pesquisaId,
        situacao: { in: ["agendado", "aguardando_email", "enviado"] },
      },
      select: {
        id: true,
        colaboradorId: true,
        rodada: true,
        situacao: true,
        dataPrevista: true,
        lembreteEm: true,
      },
    });
    const link = (rodada: number) =>
      rodada > 0 ? `#/p/${p.token}?rodada=${rodada}` : `#/p/${p.token}`;
    for (const e of atuais) {
      const dia = diaDe(e.dataPrevista);
      if (e.situacao === "agendado") {
        if (dia > hoje || !envioVencido(config, dia, agora)) continue;
        const comEmail = temEmail.get(e.colaboradorId) ?? false;
        const saiu = comEmail
          ? await this.notificador.avisar({
              tipo: "convite",
              pesquisaId,
              empresaId: p.empresaId,
              colaboradorId: e.colaboradorId,
              rodada: e.rodada,
              link: link(e.rodada),
            })
          : false;
        const r = await this.prisma.pesquisaEnvio.updateMany({
          where: { id: e.id, situacao: "agendado" },
          data: {
            situacao: situacaoDepoisDoAviso(comEmail, saiu),
            enviadoEm: agora,
          },
        });
        mudancas += r.count;
      } else if (
        lembreteDevido(
          {
            situacao: e.situacao as SituacaoDoEnvio,
            dataPrevista: dia,
            lembreteEm: e.lembreteEm,
          },
          config,
          agora,
          hoje,
        )
      ) {
        await this.notificador.avisar({
          tipo: "lembrete",
          pesquisaId,
          empresaId: p.empresaId,
          colaboradorId: e.colaboradorId,
          rodada: e.rodada,
          link: link(e.rodada),
        });
        const r = await this.prisma.pesquisaEnvio.updateMany({
          where: { id: e.id, lembreteEm: null },
          data: { lembreteEm: agora },
        });
        mudancas += r.count;
      }
    }
    return mudancas;
  }

  async processarAvaliacao(pesquisaId: string, agora: Date): Promise<number> {
    const p = await this.prisma.pesquisa.findFirst({
      where: { id: pesquisaId, excluidaEm: null, publicadaEm: { not: null } },
    });
    if (
      !p ||
      !ehAvaliacao(p.modelo) ||
      statusEfetivo(p.status, p.encerraEm, agora) !== "ativa"
    ) {
      return 0;
    }
    const config = configDaAvaliacao(p.configModelo);
    if (config.envio !== "email") return 0;
    const [participantes, pessoas, envios, pendentes] = await Promise.all([
      this.prisma.pesquisaParticipante.findMany({
        where: { pesquisaId },
        select: { colaboradorId: true },
      }),
      pessoasAtivas(this.prisma, p.empresaId),
      this.prisma.pesquisaEnvio.findMany({
        where: { pesquisaId },
        select: { colaboradorId: true, rodada: true },
      }),
      this.prisma.pesquisaAvaliacaoPar.findMany({
        where: { pesquisaId, respostaId: null },
        select: { avaliadorId: true },
      }),
    ]);
    const temEmail = new Map(pessoas.map((x) => [x.id, x.temEmail]));
    const ja = new Set(envios.map((e) => `${e.colaboradorId}:${e.rodada}`));
    const comPendencia = new Set(pendentes.map((x) => x.avaliadorId));
    const avisos: {
      colaboradorId: string;
      marco: number;
      tipo: "convite" | "lembrete";
    }[] = participantes.map((x) => ({
      colaboradorId: x.colaboradorId,
      marco: MARCO_DO_AVISO.convite,
      tipo: "convite" as const,
    }));
    if (p.encerraEm) {
      // Os lembretes que valiam desde a publicação e já chegaram.
      const devidos = agendaDeLembretes(
        p.encerraEm,
        config.lembretes,
        new Date(p.publicadaEm!.getTime() - 60 * 60 * 1000),
      ).filter((l) => l.quando.getTime() <= agora.getTime());
      for (const l of devidos) {
        for (const colaboradorId of comPendencia) {
          avisos.push({
            colaboradorId,
            marco: MARCO_DO_AVISO[l.lembrete],
            tipo: "lembrete",
          });
        }
      }
    }
    let mudancas = 0;
    for (const a of avisos) {
      if (ja.has(`${a.colaboradorId}:${a.marco}`)) continue;
      const comEmail = temEmail.get(a.colaboradorId) ?? false;
      const saiu = comEmail
        ? await this.notificador.avisar({
            tipo: a.tipo,
            pesquisaId,
            empresaId: p.empresaId,
            colaboradorId: a.colaboradorId,
            rodada: a.marco,
            link: `#/p/${p.token}`,
          })
        : false;
      try {
        await this.prisma.pesquisaEnvio.create({
          data: {
            pesquisaId,
            empresaId: p.empresaId,
            colaboradorId: a.colaboradorId,
            rodada: a.marco,
            dataPrevista: dataDoDia(hojeEmSaoPaulo(agora)),
            situacao: situacaoDepoisDoAviso(comEmail, saiu),
            enviadoEm: agora,
          },
        });
        mudancas += 1;
      } catch (e) {
        // Outra execução já criou: segue.
        if (
          !(e instanceof Prisma.PrismaClientKnownRequestError) ||
          e.code !== "P2002"
        ) {
          throw e;
        }
      }
    }
    return mudancas;
  }
}
