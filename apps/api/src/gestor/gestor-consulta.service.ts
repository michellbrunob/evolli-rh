import { Injectable, NotFoundException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SessionRequestMetadata } from "../auth/session/session.service";
import {
  AtribuicaoDeEquipe,
  EscopoDoGestor,
  ExcecaoIndividual,
  comoDiaIso,
  resolverEscopo,
} from "./gestor-escopo";

export interface GestorConsultaContext {
  actor: AccessUser;
  metadata: SessionRequestMetadata;
}

/**
 * Consulta consultiva do gestor (T151, ADR 0015, decisões 1, 2, 3 e 7).
 *
 * **Somente leitura.** Não existe um único método de mutação nesta classe, e
 * isso é garantia de duas camadas: o RBAC só concede `read` em
 * `gestor_equipe`, e aqui não há o que chamar. Esconder botão na interface
 * não é controle de acesso — o controle está aqui e no avaliador.
 *
 * COMO O ESCOPO É RESOLVIDO, e por que nesta ordem:
 *
 *   1. empresa e identidade saem da **sessão** (`ctx.actor`), nunca do cliente;
 *   2. a conta vira pessoa por `access_user_colaborador` vigente (DP-23);
 *   3. a pessoa vira equipes por `atribuicao_gestor_equipe` vigente;
 *   4. as equipes viram vínculos pela **alocação vigente** de cada um;
 *   5. exceções individuais vigentes acrescentam vínculos nominais.
 *
 * Em qualquer passo que falhe, o resultado é **vazio** — nunca a empresa
 * inteira. Conta sem pessoa, pessoa sem equipe e equipe sem gente produzem
 * lista vazia, que é a resposta correta. O fallback para "tudo" é o modo
 * clássico de um filtro de autorização virar vazamento, e aqui ele não existe:
 * quando `escopo.vazio` é verdadeiro, a função retorna antes de consultar.
 *
 * PROJEÇÃO FECHADA (decisão 7): nome, matrícula, situação do vínculo, tipo e
 * datas do vínculo, cargo e lotação vigentes, e horário vigente. Nada mais sai
 * daqui. Em particular **não** saem: `Colaborador.situacao` (é agregada de
 * todos os vínculos, inclusive de outras empresas — vazaria existência de
 * vínculo alheio), documentos, remuneração, dado clínico, MFA e segredo.
 *
 * FORA DESTA ENTREGA, por ausência de contrato seguro e não por esquecimento:
 * **resumo de jornada** não existe como dado nem como rota — o núcleo de ponto
 * é puro e não está ligado a controller; e **andamento de solicitações** tem
 * modelo seguro, mas `tipo` e `motivo` revelam condição de saúde por
 * inferência (um `atestado` é um diagnóstico implícito), e `PD-SOL-05` só
 * autoriza "informação operacional mínima", que ainda não está definida.
 * Ambos ficam para a T152/T153, com decisão própria.
 */
@Injectable()
export class GestorConsultaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private hoje(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Resolve o escopo do ator na data. Público para que o E2E possa exercitar
   * a resolução sem passar por HTTP.
   *
   * `master_tecnico` e `rh` não têm atribuição de equipe — eles consultam para
   * conferir configuração, e o fazem informando o gestor explicitamente. Este
   * método é sempre sobre **o próprio ator**.
   */
  async escopoDoAtor(
    ctx: GestorConsultaContext,
    dataReferencia: string,
  ): Promise<{
    empresaId: string;
    colaboradorId: string;
    escopo: EscopoDoGestor;
  } | null> {
    const empresaId = ctx.actor.companyId;
    if (!empresaId) return null;

    // Passo 2: conta -> pessoa. Sem ligação vigente, o gestor não é ninguém no
    // cadastro, e portanto não alcança ninguém.
    const ligacao = await this.prisma.accessUserColaborador.findFirst({
      where: {
        userId: ctx.actor.id,
        empresaId,
        vigenciaInicio: { lte: new Date(`${dataReferencia}T00:00:00.000Z`) },
        OR: [
          { vigenciaFim: null },
          { vigenciaFim: { gt: new Date(`${dataReferencia}T00:00:00.000Z`) } },
        ],
      },
      select: { colaboradorId: true },
    });
    if (!ligacao) return null;

    const [atribuicoes, excecoes] = await Promise.all([
      this.prisma.atribuicaoGestorEquipe.findMany({
        where: { gestorColaboradorId: ligacao.colaboradorId, empresaId },
        select: {
          equipeId: true,
          papel: true,
          vigenciaInicio: true,
          vigenciaFim: true,
        },
      }),
      this.prisma.excecaoAcessoGestor.findMany({
        where: { gestorColaboradorId: ligacao.colaboradorId, empresaId },
        select: {
          vinculoId: true,
          vigenciaInicio: true,
          vigenciaFim: true,
          encerradaEm: true,
        },
      }),
    ]);

    const escopo = resolverEscopo(
      atribuicoes.map((a): AtribuicaoDeEquipe => ({
        equipeId: a.equipeId,
        papel: a.papel,
        inicio: comoDiaIso(a.vigenciaInicio) as string,
        fim: comoDiaIso(a.vigenciaFim),
      })),
      excecoes.map((e): ExcecaoIndividual => ({
        vinculoId: e.vinculoId,
        inicio: comoDiaIso(e.vigenciaInicio) as string,
        fim: comoDiaIso(e.vigenciaFim),
        encerradaEm: e.encerradaEm
          ? e.encerradaEm.toISOString().slice(0, 10)
          : null,
      })),
      dataReferencia,
    );

    return { empresaId, colaboradorId: ligacao.colaboradorId, escopo };
  }

  /**
   * Lista os vínculos dentro do escopo do gestor na data de referência.
   *
   * O `where` combina duas origens com `OR`: alocação vigente apontando para
   * uma equipe atribuída, ou vínculo nomeado por exceção. As duas já vêm
   * filtradas por empresa, e a consulta repete `empresaId` — redundância
   * deliberada, para que um erro na resolução do escopo não produza leitura
   * fora da empresa.
   */
  private async consultarEscopo(
    ctx: GestorConsultaContext,
    dataReferencia?: string,
  ): Promise<{
    empresaId: string | null;
    dataReferencia: string;
    itens: ReturnType<GestorConsultaService["comoItem"]>[];
  }> {
    const data = dataReferencia ?? this.hoje();
    const resolvido = await this.escopoDoAtor(ctx, data);

    // Sem ligação, sem atribuição, sem exceção: lista vazia. NUNCA empresa
    // inteira. Retornar antes de consultar torna o vazamento impossível por
    // construção, não por cuidado no `where`.
    if (!resolvido || resolvido.escopo.vazio) {
      return {
        empresaId: resolvido?.empresaId ?? null,
        dataReferencia: data,
        itens: [],
      };
    }

    const { empresaId, escopo } = resolvido;
    const limite = new Date(`${data}T00:00:00.000Z`);

    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: {
        empresaId,
        OR: [
          {
            alocacoes: {
              some: {
                empresaId,
                equipeId: { in: [...escopo.equipeIds] },
                vigenteDe: { lte: limite },
                OR: [{ vigenteAte: null }, { vigenteAte: { gt: limite } }],
              },
            },
          },
          { id: { in: [...escopo.vinculoIdsPorExcecao] } },
        ],
      },
      select: {
        id: true,
        matricula: true,
        tipo: true,
        situacao: true,
        dataAdmissao: true,
        dataDesligamento: true,
        colaborador: { select: { id: true, nome: true } },
        alocacoes: {
          where: {
            vigenteDe: { lte: limite },
            OR: [{ vigenteAte: null }, { vigenteAte: { gt: limite } }],
          },
          select: {
            cargo: { select: { id: true, nome: true } },
            equipe: { select: { id: true, nome: true } },
            departamento: { select: { id: true, nome: true } },
            unidadeOrganizacional: { select: { id: true, nome: true } },
            vigenteDe: true,
          },
          take: 1,
        },
      },
      orderBy: [{ matricula: "asc" }],
    });

    return {
      empresaId,
      dataReferencia: data,
      itens: vinculos.map((v) => this.comoItem(v)),
    };
  }

  /**
   * Lista a equipe e registra a consulta como LISTA (sem id de recurso: a
   * leitura foi do conjunto, não de uma pessoa).
   */
  async listarEquipe(ctx: GestorConsultaContext, dataReferencia?: string) {
    const {
      empresaId,
      dataReferencia: data,
      itens,
    } = await this.consultarEscopo(ctx, dataReferencia);
    if (empresaId) {
      await this.registrarConsulta(ctx, empresaId, null);
    }
    return { dataReferencia: data, itens };
  }

  /**
   * Detalhe de um vínculo, se ele estiver no escopo.
   *
   * Fora do escopo responde **404**, nunca 403: 403 confirmaria que o vínculo
   * existe, e a diferença entre "não existe" e "existe mas não é seu" é
   * exatamente o que a anti-enumeração precisa esconder. Vale igualmente para
   * vínculo de outra equipe e de outra empresa.
   */
  async detalharVinculo(
    ctx: GestorConsultaContext,
    vinculoId: string,
    dataReferencia?: string,
  ) {
    const data = dataReferencia ?? this.hoje();
    // Usa `consultarEscopo`, não `listarEquipe`: esta é uma leitura de
    // DETALHE, e precisa deixar na trilha o id do vínculo consultado. Chamar a
    // listagem gravaria um evento com a forma de consulta de lista, perdendo
    // justamente a informação que torna a trilha útil depois.
    const lista = await this.consultarEscopo(ctx, data);
    const item = lista.itens.find((i) => i.vinculoId === vinculoId);
    // Fora do escopo: 404, nunca 403 — e ANTES de qualquer evento, para que a
    // trilha não registre consulta a algo que o ator não podia ver.
    if (!item) throw new NotFoundException();

    const limite = new Date(`${data}T00:00:00.000Z`);
    const horario = await this.prisma.vinculoHorario.findFirst({
      where: {
        colaboradorId: item.colaboradorId,
        empresaId: ctx.actor.companyId as string,
        vigenciaInicio: { lte: limite },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gt: limite } }],
      },
      select: {
        vigenciaInicio: true,
        vigenciaFim: true,
        tabela: { select: { id: true, nome: true } },
      },
    });

    if (lista.empresaId) {
      await this.registrarConsulta(ctx, lista.empresaId, vinculoId);
    }

    return {
      dataReferencia: data,
      ...item,
      horarioVigente: horario
        ? {
            tabelaId: horario.tabela.id,
            nome: horario.tabela.nome,
            vigenciaInicio: comoDiaIso(horario.vigenciaInicio),
            vigenciaFim: comoDiaIso(horario.vigenciaFim),
          }
        : null,
      // Declarados como ausentes de propósito, para que o cliente não precise
      // adivinhar se a capacidade existe e falhou ou se nunca existiu.
      resumoJornada: null,
      andamentoSolicitacoes: null,
    };
  }

  /**
   * Trilha de consulta a dado de terceiro.
   *
   * **Fail-safe**, como `ponto.consultado` e `organizacao.estrutura.consultada`:
   * ver pessoa de terceiro é ação sensível por si, mas a leitura já autorizada
   * não é bloqueada por falha de auditoria. Registra ator, papel, empresa e id
   * técnico — nunca nome, matrícula ou qualquer dado da pessoa consultada.
   */
  private async registrarConsulta(
    ctx: GestorConsultaContext,
    empresaId: string,
    resourceId: string | null,
  ): Promise<void> {
    await this.auditService.record({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: empresaId,
      action: "gestor_equipe_consultada",
      resource: "gestor_equipe",
      resourceId,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "success",
      requestId: ctx.metadata.requestId,
    });
  }

  /** Projeção fechada da decisão 7. Acrescentar campo aqui é decisão, não detalhe. */
  private comoItem(v: {
    id: string;
    matricula: string;
    tipo: string;
    situacao: string;
    dataAdmissao: Date;
    dataDesligamento: Date | null;
    colaborador: { id: string; nome: string };
    alocacoes: {
      cargo: { id: string; nome: string } | null;
      equipe: { id: string; nome: string } | null;
      departamento: { id: string; nome: string } | null;
      unidadeOrganizacional: { id: string; nome: string } | null;
      vigenteDe: Date;
    }[];
  }) {
    const alocacao = v.alocacoes[0] ?? null;
    return {
      vinculoId: v.id,
      colaboradorId: v.colaborador.id,
      nome: v.colaborador.nome,
      matricula: v.matricula,
      // Situação do VÍNCULO, nunca a do colaborador: aquela é agregada de
      // todos os vínculos, inclusive de outras empresas, e revelaria vínculo
      // alheio por inferência.
      situacaoVinculo: v.situacao,
      tipoVinculo: v.tipo,
      dataAdmissao: comoDiaIso(v.dataAdmissao),
      dataDesligamento: comoDiaIso(v.dataDesligamento),
      cargoVigente: alocacao?.cargo
        ? { id: alocacao.cargo.id, nome: alocacao.cargo.nome }
        : null,
      lotacaoVigente: alocacao
        ? {
            equipe: alocacao.equipe,
            departamento: alocacao.departamento,
            unidadeOrganizacional: alocacao.unidadeOrganizacional,
            vigenteDe: comoDiaIso(alocacao.vigenteDe),
          }
        : null,
    };
  }
}
