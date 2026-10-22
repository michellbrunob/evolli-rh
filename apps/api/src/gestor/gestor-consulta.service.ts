import { Injectable, NotFoundException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SessionRequestMetadata } from "../auth/session/session.service";
import { dataLocalDe } from "../ponto/competencia.util";
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
 *   0. a DATA sai do **servidor** (`hoje()`), nunca do cliente — ver
 *      `escopoDoAtor`. Quem pergunta não escolhe em que data é autorizado;
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

  /**
   * A data de autorização. **Única** fonte de "quando" nesta classe.
   *
   * Usa `dataLocalDe`, o mesmo utilitário de `FUSO_COMPETENCIA`
   * (`America/Sao_Paulo`) que o ponto já usa para decidir em que dia civil um
   * instante caiu. `toISOString().slice(0, 10)` — o que estava aqui antes —
   * responde em UTC: das 21h às 24h de Brasília o servidor já diria que é
   * amanhã, e uma atribuição que termina hoje expiraria três horas cedo.
   * Deslocar o dia desloca a fronteira de um escopo de autorização.
   *
   * O fuso é importado em vez de redeclarado: dois fusos no mesmo produto
   * fariam ponto e gestor discordarem sobre que dia é hoje. É uma função
   * pura, sem injeção — o acoplamento é de constante, não de módulo. A
   * limitação de fuso único para todas as empresas está registrada lá.
   */
  private hoje(): string {
    return dataLocalDe(new Date());
  }

  /**
   * Resolve o escopo do ator **no estado vigente**.
   *
   * `private` desde que o parâmetro de data saiu. Era público "para que o E2E
   * pudesse exercitar a resolução sem passar por HTTP" — mas nenhum teste o
   * chamava, e exercitá-lo direto é justamente o que deixaria de provar o que
   * importa: a garantia é que **não existe caminho** por onde uma data
   * entre, e isso só se verifica pela rota.
   *
   * NÃO RECEBE DATA, e isso é a correção de uma falha de autorização real.
   * Antes, a data vinha do cliente e governava os três passos abaixo — a
   * ligação conta-pessoa, as atribuições e as exceções —, todos sobre o
   * PRÓPRIO ator. Um gestor cuja atribuição terminou em junho voltava a ler a
   * equipe enviando `?dataReferencia=2026-05-15`: a fronteira temporal da
   * autorização era escolhida por quem pedia. A ADR 0015, decisão 8, diz o
   * contrário com todas as letras — *"Decisões de acesso usam o estado
   * vigente"*.
   *
   * Fechar isso por validação de intervalo (recusar datas fora da vigência)
   * seria circular: a vigência é justamente o que está sendo decidido. A
   * única fronteira que não se pode negociar é não haver parâmetro.
   *
   * `master_tecnico` e `rh` não têm atribuição de equipe — eles consultam para
   * conferir configuração, e o fazem informando o gestor explicitamente. Este
   * método é sempre sobre **o próprio ator**.
   *
   * `dataReferencia` é parâmetro, mas **não** é o `dataReferencia` que foi
   * removido da rota, e a diferença é toda: aquele vinha da query string;
   * este só pode vir de `consultarEscopo`, que o obteve de `hoje()` linhas
   * antes. O método é `private`, o único chamador é aquele, e nenhuma função
   * pública desta classe aceita data — então não há como um valor do cliente
   * chegar aqui. Ele existe para garantir o oposto do que o parâmetro antigo
   * permitia: que a requisição inteira use **uma única** leitura de relógio.
   */
  private async escopoDoAtor(
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
  private async consultarEscopo(ctx: GestorConsultaContext): Promise<{
    empresaId: string | null;
    dataReferencia: string;
    itens: ReturnType<GestorConsultaService["comoItem"]>[];
  }> {
    // RELÓGIO LIDO UMA VEZ POR REQUISIÇÃO, e esta é a única leitura.
    //
    // Os três usos abaixo — resolver o escopo, filtrar as alocações vigentes e
    // preencher o campo informativo da resposta — precisam concordar. Ler
    // `hoje()` de novo em qualquer um deles abriria uma janela estreita, mas
    // real, na virada do dia: o escopo seria resolvido em 31/01 e os vínculos
    // lidos em 01/02, e a resposta citaria uma terceira data. Uma requisição
    // que atravessa a meia-noite tem de responder por um instante só.
    const data = this.hoje();
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
          // `take: 1` sem ordem deixa o PostgreSQL escolher a linha, e o
          // plano pode mudar com o volume: o cargo e a lotação exibidos
          // passariam a variar entre chamadas idênticas. A alocação vigente
          // deve ser única por construção, mas o filtro acima aceita mais de
          // uma se houver sobreposição histórica — e, havendo, a correta é a
          // mais recente. `id` desempata para que a resposta seja estável
          // mesmo com duas na mesma data.
          orderBy: [{ vigenteDe: "desc" }, { id: "asc" }],
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
  async listarEquipe(ctx: GestorConsultaContext) {
    const { dataReferencia: data, itens } = await this.consultarEscopo(ctx);

    // A empresa vem do ATOR, não do escopo resolvido. Antes vinha do escopo, e
    // por isso a consulta de um gestor SEM ligação conta-pessoa não deixava
    // rastro nenhum: `escopoDoAtor` devolvia `null` antes de chegar à empresa,
    // a trilha era pulada, e a leitura — autorizada, respondida com 200 —
    // ficava invisível. Lista vazia é um resultado, não uma consulta que não
    // aconteceu, e quem varre à procura de acesso é exatamente quem recebe
    // vazio toda vez.
    if (ctx.actor.companyId) {
      await this.registrarConsulta(ctx, ctx.actor.companyId, null);
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
  async detalharVinculo(ctx: GestorConsultaContext, vinculoId: string) {
    // Usa `consultarEscopo`, não `listarEquipe`: esta é uma leitura de
    // DETALHE, e precisa deixar na trilha o id do vínculo consultado. Chamar a
    // listagem gravaria um evento com a forma de consulta de lista, perdendo
    // justamente a informação que torna a trilha útil depois.
    const lista = await this.consultarEscopo(ctx);
    const data = lista.dataReferencia;
    const item = lista.itens.find((i) => i.vinculoId === vinculoId);

    // Fora do escopo: 404, nunca 403 — e a TENTATIVA é registrada como
    // `denied`, não descartada.
    //
    // O comentário anterior dizia o contrário ("antes de qualquer evento, para
    // que a trilha não registre consulta a algo que o ator não podia ver") e
    // estava errado em relação ao padrão da casa. Ponto, documentos, pessoas,
    // horários, organização e solicitações têm todos um `negarAcesso` que
    // grava `authorization_denied` com o `resourceId` TÉCNICO tentado,
    // precisamente porque, nas palavras do ponto, é isso "que torna uma
    // varredura entre empresas detectável depois". Sem o registro, mil
    // tentativas de enumeração são indistinguíveis de nenhuma.
    //
    // O evento guarda só o id técnico tentado — nunca nome, matrícula ou
    // qualquer dado da pessoa, que o ator de todo modo não chegou a ver.
    if (!item) {
      await this.registrarNegacao(ctx, vinculoId);
      throw new NotFoundException();
    }

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

  /**
   * Tentativa de ler um vínculo fora do escopo.
   *
   * `authorization_denied` + `result: "denied"` é a mesma forma de
   * `PontoAuditoriaService.negarAcesso` e das cinco outras famílias que já
   * registram negação. A resposta pública continua 404 indistinguível; a
   * diferença está só na trilha interna, que é onde uma varredura aparece.
   *
   * **Best-effort**, como as demais negações (ADR 0004 §2): a recusa já foi
   * decidida e não é revertida se o evento não puder ser gravado.
   */
  private async registrarNegacao(
    ctx: GestorConsultaContext,
    vinculoIdTentado: string,
  ): Promise<void> {
    await this.auditService.record({
      actorType: "user",
      actorUserId: ctx.actor.id,
      actorRole: ctx.actor.role,
      companyId: ctx.actor.companyId,
      action: "authorization_denied",
      resource: "gestor_equipe",
      resourceId: vinculoIdTentado,
      ip: ctx.metadata.ip,
      userAgent: ctx.metadata.userAgent,
      result: "denied",
      requestId: ctx.metadata.requestId,
    });
  }

  /** Projeção fechada da decisão 7. Acrescentar campo aqui é decisão, não detalhe. */
  private comoItem(v: {
    id: string;
    /** T179 — opcional na Nova admissão: pode vir `null`. */
    matricula: string | null;
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
