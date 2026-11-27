import { createHash, randomBytes } from "node:crypto";
import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CamposRecusadosException } from "../common/erros/recusa-por-campo";
import type { SessionRequestMetadata } from "../auth/session/session.service";
import {
  dataDoDia,
  hojeEmSaoPaulo,
} from "../pessoas/ausencias/calculo-ausencias";
import { totalDePerguntas } from "./estrutura-pesquisa";
import {
  type AberturaPublica,
  CAMPOS_GRUPO,
  type CampoGrupo,
  ROTULOS_DOS_CAMPOS,
  type Secao,
} from "./pesquisas.types";
import {
  cpfNormalizado,
  exigeIdentificacao,
  minutosEstimados,
  motivoIndisponivel,
  primeiroNome,
} from "./regras-pesquisa";
import { catalogoAtivo, lotacoesVigentes } from "./pessoas-da-pesquisa";
import { conferirRespostas } from "./validacao-respostas";

/**
 * T216 — a página pública da pesquisa (sem sessão; o token na rota).
 *
 * - Abertura: empresa, nome, boas-vindas, estrutura — nunca participantes.
 *   Na anônima com separação, os grupos que quem responde escolhe (os
 *   itens ativos dos catálogos da empresa; "prefiro não informar" é `null`).
 * - Identificação (identificada e confidencial): CPF + nascimento de um
 *   participante. Erro genérico (401), sem dizer qual dado falhou; no máximo
 *   5 tentativas erradas por IP e pesquisa em 15 minutos (429). Deu certo:
 *   um passe aleatório (32 bytes, 2 horas, uso único) — só o hash fica.
 * - Resposta: confere tudo pelo tipo; uma por participante (409). Na
 *   confidencial, a resposta não leva a pessoa (só o departamento no envio)
 *   e o participante fica marcado só com o dia.
 */

export const TENTATIVAS_MAXIMAS = 5;
export const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;
export const VALIDADE_DO_PASSE_MS = 2 * 60 * 60 * 1000;

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

function hashDoPasse(passe: string): string {
  return createHash("sha256").update(passe, "utf8").digest("hex");
}

type PesquisaDoLink = Prisma.PesquisaGetPayload<{
  include: { empresa: { select: { nome: true } } };
}>;

@Injectable()
export class PesquisaPublicaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** A pesquisa publicada do link, ou `null` (inexistente ou excluída). */
  private async doLink(token: string): Promise<PesquisaDoLink | null> {
    if (!TOKEN.test(token)) return null;
    return this.prisma.pesquisa.findFirst({
      where: { token, excluidaEm: null, publicadaEm: { not: null } },
      include: { empresa: { select: { nome: true } } },
    });
  }

  /** 404 sem pesquisa; 410 quando não aceita resposta. */
  private async aceitando(token: string): Promise<PesquisaDoLink> {
    const p = await this.doLink(token);
    if (!p) throw new NotFoundException();
    if (motivoIndisponivel(p.status, p.encerraEm, new Date()) !== null) {
      throw new GoneException();
    }
    return p;
  }

  async abrir(token: string): Promise<AberturaPublica> {
    const p = await this.doLink(token);
    if (!p) return { indisponivel: "inexistente" };
    const motivo = motivoIndisponivel(p.status, p.encerraEm, new Date());
    if (motivo) return { indisponivel: motivo };
    const secoes = p.secoes as unknown as Secao[];
    const total = totalDePerguntas(secoes);
    // Os catálogos dos campos em paralelo (uma ida ao banco por campo).
    const grupos = await Promise.all(
      this.separarPor(p).map(async (campo) => ({
        campo,
        rotulo: ROTULOS_DOS_CAMPOS[campo],
        opcoes: await catalogoAtivo(this.prisma, p.empresaId, campo),
      })),
    );
    return {
      empresa: p.empresa.nome,
      nome: p.nome,
      boasVindas: p.boasVindas,
      modelo: p.modelo,
      identificacao: p.identificacao,
      totalPerguntas: total,
      minutosEstimados: minutosEstimados(total),
      secoes,
      grupos,
    };
  }

  /** Os campos de separação (só a anônima os tem). */
  private separarPor(p: PesquisaDoLink): CampoGrupo[] {
    return p.identificacao === "anonima" ? (p.separarPor as CampoGrupo[]) : [];
  }

  /**
   * A escolha de grupo da anônima: só os campos da pesquisa, cada um com um
   * item ativo do catálogo ou `null` ("prefiro não informar").
   */
  private async conferirGrupos(
    p: PesquisaDoLink,
    enviados: Record<string, unknown> | undefined,
  ): Promise<Record<CampoGrupo, string | null>> {
    const escolhidos: Record<CampoGrupo, string | null> = {
      departamento: null,
      centroCusto: null,
      unidade: null,
    };
    const campos = this.separarPor(p);
    if (!enviados) return escolhidos;
    const recusa = () =>
      new CamposRecusadosException([{ campo: "grupos", motivo: "invalido" }]);
    for (const [chave, valor] of Object.entries(enviados)) {
      const campo = chave as CampoGrupo;
      if (!(CAMPOS_GRUPO as readonly string[]).includes(chave)) throw recusa();
      if (valor === null || valor === undefined || valor === "") continue;
      if (!campos.includes(campo) || typeof valor !== "string") throw recusa();
      const ativos = await catalogoAtivo(this.prisma, p.empresaId, campo);
      if (!ativos.some((g) => g.id === valor)) throw recusa();
      escolhidos[campo] = valor;
    }
    return escolhidos;
  }

  async identificar(
    token: string,
    dados: { cpf: string; dataNascimento: string },
    metadata: SessionRequestMetadata,
  ): Promise<{ passe: string; primeiroNome: string }> {
    const p = await this.aceitando(token);
    if (!exigeIdentificacao(p.identificacao)) throw new NotFoundException();

    const ip = metadata.ip?.slice(0, 64) ?? null;
    const erradas = await this.prisma.pesquisaTentativa.count({
      where: {
        pesquisaId: p.id,
        ip,
        criadaEm: { gte: new Date(Date.now() - JANELA_TENTATIVAS_MS) },
      },
    });
    if (erradas >= TENTATIVAS_MAXIMAS) {
      await this.auditService.record({
        actorType: "system",
        actorSystemId: "pesquisa-publica:identificar",
        companyId: p.empresaId,
        action: "rate_limit_blocked",
        resource: "pesquisa",
        resourceId: p.id,
        ip,
        userAgent: null,
        result: "denied",
        requestId: metadata.requestId,
      });
      throw new HttpException(
        "Muitas requisições.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const participante = await this.participanteDe(p, dados);
    if (!participante) {
      await this.prisma.pesquisaTentativa.create({
        data: { pesquisaId: p.id, ip },
      });
      throw new UnauthorizedException();
    }
    if (participante.respondeuEm !== null) throw new ConflictException();

    const passe = randomBytes(32).toString("base64url");
    await this.prisma.pesquisaPasse.create({
      data: {
        pesquisaId: p.id,
        participanteId: participante.id,
        hash: hashDoPasse(passe),
        expiraEm: new Date(Date.now() + VALIDADE_DO_PASSE_MS),
      },
    });
    return { passe, primeiroNome: primeiroNome(participante.colaborador.nome) };
  }

  /** O participante cujo CPF e nascimento (na empresa) batem. */
  private async participanteDe(
    p: PesquisaDoLink,
    dados: { cpf: string; dataNascimento: string },
  ) {
    const cpf = cpfNormalizado(dados.cpf);
    const nascimento = dados.dataNascimento;
    if (!cpf || !/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return null;
    const data = new Date(`${nascimento}T00:00:00Z`);
    if (Number.isNaN(data.getTime())) return null;
    const perfil = await this.prisma.perfilPessoalColaborador.findFirst({
      where: { empresaId: p.empresaId, cpf, dataNascimento: data },
      select: { colaboradorId: true },
    });
    if (!perfil) return null;
    return this.prisma.pesquisaParticipante.findUnique({
      where: {
        pesquisaId_colaboradorId: {
          pesquisaId: p.id,
          colaboradorId: perfil.colaboradorId,
        },
      },
      select: {
        id: true,
        colaboradorId: true,
        respondeuEm: true,
        colaborador: { select: { nome: true } },
      },
    });
  }

  async responder(
    token: string,
    dados: {
      passe?: string;
      grupos?: Record<string, unknown>;
      respostas: { perguntaId: string; valor: unknown }[];
    },
    metadata: SessionRequestMetadata,
  ): Promise<{ ok: true }> {
    const p = await this.aceitando(token);
    const identifica = exigeIdentificacao(p.identificacao);

    let passe: {
      id: string;
      participanteId: string;
      colaboradorId: string;
    } | null = null;
    if (identifica) {
      if (!dados.passe) throw new UnauthorizedException();
      const linha = await this.prisma.pesquisaPasse.findFirst({
        where: {
          hash: hashDoPasse(dados.passe),
          pesquisaId: p.id,
          expiraEm: { gt: new Date() },
        },
        select: {
          id: true,
          participante: {
            select: { id: true, colaboradorId: true, respondeuEm: true },
          },
        },
      });
      if (!linha) throw new UnauthorizedException();
      if (linha.participante.respondeuEm !== null) {
        throw new ConflictException();
      }
      passe = {
        id: linha.id,
        participanteId: linha.participante.id,
        colaboradorId: linha.participante.colaboradorId,
      };
    }

    const conferidas = conferirRespostas(
      p.secoes as unknown as Secao[],
      dados.respostas,
    );
    if (conferidas.erros.length) {
      throw new CamposRecusadosException(conferidas.erros);
    }
    // Só a anônima recebe a escolha de grupo; nas outras, é ignorada.
    const escolhidos =
      p.identificacao === "anonima"
        ? await this.conferirGrupos(p, dados.grupos)
        : null;

    const hoje = hojeEmSaoPaulo();
    await this.prisma.$transaction(async (tx) => {
      let grupos: Record<CampoGrupo, string | null> = escolhidos ?? {
        departamento: null,
        centroCusto: null,
        unidade: null,
      };
      if (passe) {
        // Uso único: só um envio consome o passe.
        const consumido = await tx.pesquisaPasse.deleteMany({
          where: { id: passe.id, expiraEm: { gt: new Date() } },
        });
        if (consumido.count !== 1) throw new UnauthorizedException();
        const marcado = await tx.pesquisaParticipante.updateMany({
          where: { id: passe.participanteId, respondeuEm: null },
          data: { respondeuEm: dataDoDia(hoje) },
        });
        if (marcado.count !== 1) throw new ConflictException();
        // Os outros passes da pessoa saem junto: nada liga a pessoa à hora.
        await tx.pesquisaPasse.deleteMany({
          where: { participanteId: passe.participanteId },
        });
        if (p.identificacao === "confidencial") {
          // Os grupos da lotação no envio, sem a pessoa.
          const lot = (
            await lotacoesVigentes(tx, p.empresaId, [passe.colaboradorId])
          ).get(passe.colaboradorId);
          grupos = {
            departamento: lot?.departamento?.id ?? null,
            centroCusto: lot?.centroCusto?.id ?? null,
            unidade: lot?.unidade?.id ?? null,
          };
        }
      }
      await tx.pesquisaResposta.create({
        data: {
          pesquisaId: p.id,
          empresaId: p.empresaId,
          colaboradorId:
            p.identificacao === "identificada" && passe
              ? passe.colaboradorId
              : null,
          departamentoId: grupos.departamento,
          centroCustoId: grupos.centroCusto,
          unidadeId: grupos.unidade,
          valores: conferidas.valores as unknown as Prisma.InputJsonValue,
          // Na confidencial, só o dia.
          respondidaEm:
            p.identificacao === "confidencial" ? dataDoDia(hoje) : new Date(),
        },
      });
      // Sem conteúdo, sem pessoa, sem IP: só que a pesquisa recebeu uma.
      await this.auditService.record(
        {
          actorType: "system",
          actorSystemId: "pesquisa-publica:responder",
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
    return { ok: true };
  }
}
