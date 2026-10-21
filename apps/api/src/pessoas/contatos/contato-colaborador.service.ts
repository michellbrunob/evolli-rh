import { ConflitoDeCamposException } from "../../common/erros/recusa-por-campo";
import { ConflictException, Injectable } from "@nestjs/common";
import {
  AcaoContatoColaborador,
  AuditAction,
  AuditResult,
  CampoContatoColaborador,
  Prisma,
  ResultadoEventoContato,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { podeAcessarPessoas } from "../escopo-pessoas.util";
import { PessoasAuditContext } from "../pessoas.types";
import { RegistrarContatosColaboradorDto } from "./contato-colaborador.dto";
import { resolverEscopoContatos } from "./escopo-contatos.util";

/**
 * Estado dos contatos do colaborador na empresa.
 *
 * - `sem_registro` — o colaborador existe no escopo e não tem contato gravado.
 *   É o estado de todo colaborador admitido antes desta fatia: a ausência de
 *   registro nunca é erro.
 * - `registrado` — contato gravado e em uso operacional.
 * - `bloqueado` — nenhum vínculo do colaborador na empresa segue previsto ou
 *   ativo. A ficha manda **bloquear o uso operacional** após o desligamento:
 *   o valor não é respondido e não pode ser editado. Não há exclusão nem
 *   anonimização automática (retenção alinhada em 2026-10-20, §7 da ficha):
 *   o valor vigente e a trilha de auditoria ficam preservados.
 */
export type SituacaoContatos = "sem_registro" | "registrado" | "bloqueado";

/**
 * T179 — os três contatos são opcionais (decisão da proprietária de
 * 2026-10-21): cada um pode vir `null`. O formato continua conferido quando o
 * valor existe.
 */
export interface ValoresContatos {
  emailPessoal: string | null;
  celular: string | null;
  telefone: string | null;
  atualizadoEm: Date;
}

/** Resposta de leitura. Projeção explícita: nada além destes campos. */
export interface ContatosDoColaborador {
  colaboradorId: string;
  /** Empresa REAL do colaborador em que o contato vale — resolvida no servidor. */
  empresaId: string;
  situacao: SituacaoContatos;
  contatos: ValoresContatos | null;
}

export type ResultadoRegistroContatos =
  "criado" | "atualizado" | "sem_alteracao";

export interface ContatosRegistrados extends ContatosDoColaborador {
  resultado: ResultadoRegistroContatos;
}

/** Os três campos — gravados na criação, devolvidos na leitura. */
const TODOS_OS_CAMPOS: readonly CampoContatoColaborador[] = [
  "email_pessoal",
  "celular",
  "telefone",
];

const NENHUM_CAMPO: readonly CampoContatoColaborador[] = [];

/** Projeção do registro: sem autoria, sem ids de conta. */
const PROJECAO_CONTATO = {
  id: true,
  emailPessoal: true,
  celular: true,
  telefone: true,
  atualizadoEm: true,
} as const satisfies Prisma.ContatoColaboradorSelect;

type ContatoProjetado = Prisma.ContatoColaboradorGetPayload<{
  select: typeof PROJECAO_CONTATO;
}>;

/** Colaborador no escopo, com a empresa REAL resolvida pelo vínculo. */
interface AlvoResolvido {
  tipo: "resolvido";
  colaboradorId: string;
  empresaId: string;
  /** Há vínculo previsto ou ativo na empresa — uso operacional permitido. */
  operacional: boolean;
}

/**
 * `master_tecnico` sem empresa ativa diante de colaborador com vínculo em mais
 * de uma empresa. NENHUMA empresa foi resolvida — e não há como resolver
 * naquele ponto —, então nada é lido nem gravado.
 */
interface AlvoAmbiguo {
  tipo: "ambiguo";
  colaboradorId: string;
}

type AlvoContatos = AlvoResolvido | AlvoAmbiguo;

/** O que um evento de tratamento registra — nunca um valor de contato. */
interface EventoContato {
  acao: AcaoContatoColaborador;
  resultado: ResultadoEventoContato;
  campos: readonly CampoContatoColaborador[];
  auditAction: AuditAction;
  auditResult: AuditResult;
}

/** T179 — os três contatos como valores: o que não veio vale `null`. */
export type ContatosInformados = Pick<
  ValoresContatos,
  "emailPessoal" | "celular" | "telefone"
>;

/**
 * T179 — contatos opcionais (decisão da proprietária de 2026-10-21): o que não
 * veio, ou veio vazio, vale `null`. O PUT substitui os três.
 */
export function contatosInformados(
  dto: RegistrarContatosColaboradorDto | undefined | null,
): ContatosInformados {
  return {
    emailPessoal: dto?.emailPessoal ?? null,
    celular: dto?.celular ?? null,
    telefone: dto?.telefone ?? null,
  };
}

/** T179 — NOMES dos campos com valor, para o evento de criação. */
export function camposPreenchidos(
  valores: ContatosInformados,
): CampoContatoColaborador[] {
  const campos: CampoContatoColaborador[] = [];
  if (valores.emailPessoal !== null) campos.push("email_pessoal");
  if (valores.celular !== null) campos.push("celular");
  if (valores.telefone !== null) campos.push("telefone");
  return campos;
}

/**
 * Campos cujo valor normalizado mudou. Só os NOMES saem daqui — é o que o
 * evento de edição registra.
 */
export function camposAlterados(
  atual: ContatosInformados,
  novo: ContatosInformados,
): CampoContatoColaborador[] {
  const campos: CampoContatoColaborador[] = [];
  if (atual.emailPessoal !== novo.emailPessoal) {
    campos.push("email_pessoal");
  }
  if (atual.celular !== novo.celular) {
    campos.push("celular");
  }
  if (atual.telefone !== novo.telefone) {
    campos.push("telefone");
  }
  return campos;
}

function valores(contato: ContatoProjetado): ValoresContatos {
  return {
    emailPessoal: contato.emailPessoal,
    celular: contato.celular,
    telefone: contato.telefone,
    atualizadoEm: contato.atualizadoEm,
  };
}

/** T179 — a unicidade violada é a do e-mail pessoal na empresa? */
function eUnicidadeDoEmail(erro: unknown): boolean {
  if (!eUnicidadeVioladaNoBanco(erro)) return false;
  const alvo = (erro as Prisma.PrismaClientKnownRequestError).meta?.["target"];
  const texto = Array.isArray(alvo) ? alvo.join(",") : String(alvo ?? "");
  return /email_pessoal|emailPessoal/.test(texto);
}

function eUnicidadeVioladaNoBanco(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

/**
 * Contatos do colaborador (T169) — agregado próprio, fora de `Colaborador`.
 *
 * Toda operação resolve, no servidor, a **empresa real** do colaborador pelo
 * vínculo, e é ela que vai para a autorização, para o registro e para a
 * trilha. Nenhum id de empresa vem do navegador.
 *
 * TRILHA DE TODA CONSULTA (ficha; Emenda 1 da ADR 0012). Cada operação que
 * chega ao serviço com o colaborador no escopo deixa `audit_event` (trilha
 * formal) e `contato_colaborador_evento` (resultado e nomes dos campos), na
 * MESMA transação do dado — com valor devolvido ou não:
 *
 *   GET com valor            consultado/success      leitura  valores_devolvidos
 *   GET sem registro         consultado/success      leitura  sem_registro
 *   GET bloqueado            consultado/success      leitura  bloqueado
 *   GET empresa ambígua      consultado/failure      leitura  empresa_ambigua
 *   PUT criação              criado/success          criacao  gravado
 *   PUT edição               atualizado/success      edicao   gravado
 *   PUT sem alteração        consultado/success      leitura  sem_alteracao
 *   PUT bloqueado            atualizado/failure      edicao   bloqueado
 *   PUT empresa ambígua      atualizado/failure      edicao   empresa_ambigua
 *
 * O PUT sem alteração é registrado como LEITURA: nada é gravado, e os três
 * valores gravados voltam na resposta. Inexistente, fora do escopo e perfil
 * sem acesso deixam `authorization_denied` pela regra existente (ADR 0004).
 *
 * Em `audit_event`, o recurso é `contato_colaborador` e o `resourceId` é o id
 * do COLABORADOR — o mesmo da negação, e o único que existe em todos os
 * casos. O id do contato, quando há, fica no evento de tratamento.
 */
@Injectable()
export class ContatoColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  async consultar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<ContatosDoColaborador> {
    const alvo = await this.resolverAlvo(colaboradorId, ctx, "read");
    if (alvo.tipo === "ambiguo") {
      await this.registrarAmbiguidade(ctx, alvo, "leitura");
      throw new ConflictException();
    }

    // Leitura e evento na mesma transação: se a trilha não puder ser gravada,
    // nada é respondido (fail-safe) — nem valor, nem estado.
    return this.prisma.$transaction(async (tx) => {
      if (!alvo.operacional) {
        // Só o id: o valor de um contato bloqueado não é lido.
        const existente = await this.idDoContato(tx, alvo);
        await this.registrarEvento(tx, ctx, alvo, existente, {
          acao: "leitura",
          resultado: "bloqueado",
          campos: NENHUM_CAMPO,
          auditAction: "pessoas_contato_consultado",
          auditResult: "success",
        });
        return this.resposta(alvo, "bloqueado", null);
      }

      const contato = await tx.contatoColaborador.findUnique({
        where: {
          colaboradorId_empresaId: {
            colaboradorId: alvo.colaboradorId,
            empresaId: alvo.empresaId,
          },
        },
        select: PROJECAO_CONTATO,
      });
      if (!contato) {
        await this.registrarEvento(tx, ctx, alvo, null, {
          acao: "leitura",
          resultado: "sem_registro",
          campos: NENHUM_CAMPO,
          auditAction: "pessoas_contato_consultado",
          auditResult: "success",
        });
        return this.resposta(alvo, "sem_registro", null);
      }

      await this.registrarEvento(tx, ctx, alvo, contato.id, {
        acao: "leitura",
        resultado: "valores_devolvidos",
        campos: TODOS_OS_CAMPOS,
        auditAction: "pessoas_contato_consultado",
        auditResult: "success",
      });
      return this.resposta(alvo, "registrado", valores(contato));
    });
  }

  async registrar(
    colaboradorId: string,
    dto: RegistrarContatosColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<ContatosRegistrados> {
    const alvo = await this.resolverAlvo(colaboradorId, ctx, "alter");
    if (alvo.tipo === "ambiguo") {
      await this.registrarAmbiguidade(ctx, alvo, "edicao");
      throw new ConflictException();
    }
    if (!alvo.operacional) {
      // Uso operacional bloqueado após o desligamento (ficha). A tentativa
      // fica na trilha ANTES da recusa: a transação confirma o evento, e só
      // então a resposta é 409.
      await this.prisma.$transaction(async (tx) => {
        const existente = await this.idDoContato(tx, alvo);
        await this.registrarEvento(tx, ctx, alvo, existente, {
          acao: "edicao",
          resultado: "bloqueado",
          campos: NENHUM_CAMPO,
          auditAction: "pessoas_contato_atualizado",
          auditResult: "failure",
        });
      });
      throw new ConflictException();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // T179 — e-mail pessoal único na MESMA empresa: outro colaborador da
        // empresa já o usa? A restrição do banco é a garantia (corrida chega
        // como P2002, abaixo); a consulta só diz qual campo conflita. Só a
        // empresa do vínculo: "em uso" nunca revela alguém de outra.
        const novos = contatosInformados(dto);
        const emailEmUso =
          novos.emailPessoal === null
            ? null
            : await tx.contatoColaborador.findFirst({
                where: {
                  empresaId: alvo.empresaId,
                  emailPessoal: novos.emailPessoal,
                  NOT: { colaboradorId: alvo.colaboradorId },
                },
                select: { id: true },
              });
        if (emailEmUso) {
          throw new ConflitoDeCamposException([
            { campo: "emailPessoal", motivo: "em_uso" },
          ]);
        }

        const atual = await tx.contatoColaborador.findUnique({
          where: {
            colaboradorId_empresaId: {
              colaboradorId: alvo.colaboradorId,
              empresaId: alvo.empresaId,
            },
          },
          select: PROJECAO_CONTATO,
        });

        if (!atual) {
          const preenchidos = camposPreenchidos(novos);
          if (preenchidos.length === 0) {
            // T179 — nada gravado antes e nada informado agora: não há o que
            // criar. Responde como a leitura de quem não tem contato.
            await this.registrarEvento(tx, ctx, alvo, null, {
              acao: "leitura",
              resultado: "sem_registro",
              campos: NENHUM_CAMPO,
              auditAction: "pessoas_contato_consultado",
              auditResult: "success",
            });
            return {
              ...this.resposta(alvo, "sem_registro", null),
              resultado: "sem_alteracao" as const,
            };
          }
          const criado = await tx.contatoColaborador.create({
            data: {
              empresaId: alvo.empresaId,
              colaboradorId: alvo.colaboradorId,
              ...novos,
              criadoPorUserId: ctx.actor.id,
              atualizadoPorUserId: ctx.actor.id,
            },
            select: PROJECAO_CONTATO,
          });
          await this.registrarEvento(tx, ctx, alvo, criado.id, {
            acao: "criacao",
            resultado: "gravado",
            campos: preenchidos,
            auditAction: "pessoas_contato_criado",
            auditResult: "success",
          });
          return {
            ...this.resposta(alvo, "registrado", valores(criado)),
            resultado: "criado" as const,
          };
        }

        const campos = camposAlterados(atual, novos);
        if (campos.length === 0) {
          // Nada a gravar, mas os valores gravados voltam na resposta: é uma
          // LEITURA, e fica na trilha como tal.
          await this.registrarEvento(tx, ctx, alvo, atual.id, {
            acao: "leitura",
            resultado: "sem_alteracao",
            campos: TODOS_OS_CAMPOS,
            auditAction: "pessoas_contato_consultado",
            auditResult: "success",
          });
          return {
            ...this.resposta(alvo, "registrado", valores(atual)),
            resultado: "sem_alteracao" as const,
          };
        }

        const atualizado = await tx.contatoColaborador.update({
          where: { id: atual.id },
          data: {
            ...novos,
            atualizadoPorUserId: ctx.actor.id,
          },
          select: PROJECAO_CONTATO,
        });
        await this.registrarEvento(tx, ctx, alvo, atualizado.id, {
          acao: "edicao",
          resultado: "gravado",
          campos,
          auditAction: "pessoas_contato_atualizado",
          auditResult: "success",
        });
        return {
          ...this.resposta(alvo, "registrado", valores(atualizado)),
          resultado: "atualizado" as const,
        };
      });
    } catch (erro) {
      // T179 — e-mail que outro colaborador da empresa gravou ao mesmo tempo:
      // a unicidade (empresa, e-mail) do banco barra, e o campo volta na
      // resposta, sem o valor.
      if (eUnicidadeDoEmail(erro)) {
        throw new ConflitoDeCamposException([
          { campo: "emailPessoal", motivo: "em_uso" },
        ]);
      }
      // Duas criações simultâneas do mesmo par: a segunda perde na unicidade
      // do banco. Conflito, não erro interno.
      if (eUnicidadeVioladaNoBanco(erro)) {
        throw new ConflictException();
      }
      throw erro;
    }
  }

  /**
   * T177 — contatos gravados na ADMISSÃO, dentro da transação dela. O
   * colaborador e o vínculo acabaram de nascer na mesma transação: não há
   * contato anterior. Mesmo registro, mesmo evento e mesma trilha da rota
   * própria — uma só fonte para e-mail pessoal, celular e telefone.
   */
  async criarNaAdmissao(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: { colaboradorId: string; empresaId: string },
    dto: RegistrarContatosColaboradorDto | undefined,
  ): Promise<ValoresContatos | null> {
    // T179 — contatos opcionais: sem nenhum valor, nenhum registro nasce.
    const novos = contatosInformados(dto);
    const preenchidos = camposPreenchidos(novos);
    if (preenchidos.length === 0) return null;
    const criado = await tx.contatoColaborador.create({
      data: {
        empresaId: alvo.empresaId,
        colaboradorId: alvo.colaboradorId,
        ...novos,
        criadoPorUserId: ctx.actor.id,
        atualizadoPorUserId: ctx.actor.id,
      },
      select: PROJECAO_CONTATO,
    });
    await this.registrarEvento(
      tx,
      ctx,
      { tipo: "resolvido", ...alvo, operacional: true },
      criado.id,
      {
        acao: "criacao",
        resultado: "gravado",
        campos: preenchidos,
        auditAction: "pessoas_contato_criado",
        auditResult: "success",
      },
    );
    return valores(criado);
  }

  /**
   * Resolve o colaborador no escopo e a empresa REAL em que a operação vale.
   *
   * - Escopado (`rh`, `dp`, `master_tecnico` com empresa ativa): só vínculos
   *   da empresa da sessão.
   * - Global (`master_tecnico` sem empresa ativa): os vínculos do colaborador
   *   em qualquer empresa. Se houver mais de uma empresa, a operação seria
   *   ambígua — o chamador registra a tentativa e responde 409; a empresa se
   *   escolhe pelo contexto ativo (T163).
   *
   * Inexistente e fora do escopo respondem igual (404, `negarAcesso`): a
   * distinção vazaria a existência de uma pessoa em outra empresa.
   *
   * A fase 2 (`podeAcessarPessoas` com a empresa do vínculo) é defesa em
   * profundidade: com o filtro acima, ela não nega nenhum caso alcançável hoje.
   * Protege o dia em que o filtro mudar — e tem teste próprio que a isola.
   */
  private async resolverAlvo(
    colaboradorId: string,
    ctx: PessoasAuditContext,
    action: "read" | "alter",
  ): Promise<AlvoContatos> {
    const escopo = resolverEscopoContatos(ctx.actor);

    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: {
        colaboradorId,
        ...(escopo.global ? {} : { empresaId: escopo.empresaId }),
      },
      select: { empresaId: true, situacao: true },
    });

    if (vinculos.length === 0) {
      return this.auditoria.negarAcesso(
        ctx,
        "contato_colaborador",
        colaboradorId,
        escopo.global ? null : escopo.empresaId,
      );
    }

    const [empresaId, ...outras] = [
      ...new Set(vinculos.map((v) => v.empresaId)),
    ];
    if (empresaId === undefined) {
      return this.auditoria.negarAcesso(
        ctx,
        "contato_colaborador",
        colaboradorId,
        null,
      );
    }
    if (outras.length > 0) {
      return { tipo: "ambiguo", colaboradorId };
    }

    // Fase 2: a permissão reavaliada com a empresa do vínculo.
    if (
      !podeAcessarPessoas(ctx.actor, "contato_colaborador", action, empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "contato_colaborador",
        colaboradorId,
        empresaId,
      );
    }

    return {
      tipo: "resolvido",
      colaboradorId,
      empresaId,
      operacional: vinculos.some((v) => v.situacao !== "encerrado"),
    };
  }

  /** Id do contato do par, sem ler valor nenhum. */
  private async idDoContato(
    tx: Prisma.TransactionClient,
    alvo: AlvoResolvido,
  ): Promise<string | null> {
    const existente = await tx.contatoColaborador.findUnique({
      where: {
        colaboradorId_empresaId: {
          colaboradorId: alvo.colaboradorId,
          empresaId: alvo.empresaId,
        },
      },
      select: { id: true },
    });
    return existente?.id ?? null;
  }

  /**
   * Tentativa recusada por empresa ambígua. Registrada SEM empresa — nenhuma
   * foi resolvida —, com resultado `failure`, e confirmada antes da recusa: se
   * a trilha falhar, a resposta é erro, nunca o 409 silencioso.
   */
  private async registrarAmbiguidade(
    ctx: PessoasAuditContext,
    alvo: AlvoAmbiguo,
    acao: "leitura" | "edicao",
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.auditoria.registrarNaTransacao(tx, ctx, {
        action:
          acao === "leitura"
            ? "pessoas_contato_consultado"
            : "pessoas_contato_atualizado",
        resource: "contato_colaborador",
        resourceId: alvo.colaboradorId,
        empresaId: null,
        result: "failure",
      });
      await tx.contatoColaboradorEvento.create({
        data: {
          colaboradorId: alvo.colaboradorId,
          empresaId: null,
          contatoId: null,
          acao,
          resultado: "empresa_ambigua",
          campos: [],
          atorUserId: ctx.actor.id,
          requestId: ctx.metadata.requestId,
        },
      });
    });
  }

  private async registrarEvento(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: AlvoResolvido,
    contatoId: string | null,
    evento: EventoContato,
  ): Promise<void> {
    await this.auditoria.registrarNaTransacao(tx, ctx, {
      action: evento.auditAction,
      resource: "contato_colaborador",
      resourceId: alvo.colaboradorId,
      empresaId: alvo.empresaId,
      result: evento.auditResult,
    });

    await tx.contatoColaboradorEvento.create({
      data: {
        colaboradorId: alvo.colaboradorId,
        empresaId: alvo.empresaId,
        contatoId,
        acao: evento.acao,
        resultado: evento.resultado,
        campos: [...evento.campos],
        atorUserId: ctx.actor.id,
        requestId: ctx.metadata.requestId,
      },
    });
  }

  private resposta(
    alvo: AlvoResolvido,
    situacao: SituacaoContatos,
    contatos: ValoresContatos | null,
  ): ContatosDoColaborador {
    return {
      colaboradorId: alvo.colaboradorId,
      empresaId: alvo.empresaId,
      situacao,
      contatos,
    };
  }
}
