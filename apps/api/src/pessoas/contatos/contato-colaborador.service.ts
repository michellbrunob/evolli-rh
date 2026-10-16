import { ConflictException, Injectable } from "@nestjs/common";
import {
  AcaoContatoColaborador,
  AuditAction,
  CampoContatoColaborador,
  Prisma,
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
 *   o valor não é respondido e não pode ser editado. A guarda por 2 anos e a
 *   eliminação seguem a ficha, por processo que esta fatia não implementa.
 */
export type SituacaoContatos = "sem_registro" | "registrado" | "bloqueado";

export interface ValoresContatos {
  emailPessoal: string;
  celular: string;
  telefone: string;
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

/** Leitura e criação afetam os três campos. */
const TODOS_OS_CAMPOS: readonly CampoContatoColaborador[] = [
  "email_pessoal",
  "celular",
  "telefone",
];

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

interface AlvoContatos {
  colaboradorId: string;
  empresaId: string;
  /** Há vínculo previsto ou ativo na empresa — uso operacional permitido. */
  operacional: boolean;
}

/**
 * Campos cujo valor normalizado mudou. Só os NOMES saem daqui — é o que o
 * evento de edição registra.
 */
export function camposAlterados(
  atual: Pick<ValoresContatos, "emailPessoal" | "celular" | "telefone">,
  novo: RegistrarContatosColaboradorDto,
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
 * Auditoria (ficha): criação, leitura e edição, cada uma com `audit_event`
 * (trilha formal) e `contato_colaborador_evento` (campos afetados), na MESMA
 * transação do dado. Nenhum dos dois carrega valor de contato.
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
    if (!alvo.operacional) {
      return this.resposta(alvo, "bloqueado", null);
    }

    // Leitura e evento na mesma transação: se a trilha não puder ser gravada,
    // o valor não é respondido (fail-safe).
    return this.prisma.$transaction(async (tx) => {
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
        // Nada foi lido: não há valor a auditar.
        return this.resposta(alvo, "sem_registro", null);
      }

      await this.registrarEvento(tx, ctx, alvo, contato.id, {
        acao: "leitura",
        campos: TODOS_OS_CAMPOS,
        auditAction: "pessoas_contato_consultado",
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
    if (!alvo.operacional) {
      // Uso operacional bloqueado após o desligamento (ficha).
      throw new ConflictException();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
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
          const criado = await tx.contatoColaborador.create({
            data: {
              empresaId: alvo.empresaId,
              colaboradorId: alvo.colaboradorId,
              emailPessoal: dto.emailPessoal,
              celular: dto.celular,
              telefone: dto.telefone,
              criadoPorUserId: ctx.actor.id,
              atualizadoPorUserId: ctx.actor.id,
            },
            select: PROJECAO_CONTATO,
          });
          await this.registrarEvento(tx, ctx, alvo, criado.id, {
            acao: "criacao",
            campos: TODOS_OS_CAMPOS,
            auditAction: "pessoas_contato_criado",
          });
          return {
            ...this.resposta(alvo, "registrado", valores(criado)),
            resultado: "criado" as const,
          };
        }

        const campos = camposAlterados(atual, dto);
        if (campos.length === 0) {
          // Nada mudou: nada a gravar, nada a auditar.
          return {
            ...this.resposta(alvo, "registrado", valores(atual)),
            resultado: "sem_alteracao" as const,
          };
        }

        const atualizado = await tx.contatoColaborador.update({
          where: { id: atual.id },
          data: {
            emailPessoal: dto.emailPessoal,
            celular: dto.celular,
            telefone: dto.telefone,
            atualizadoPorUserId: ctx.actor.id,
          },
          select: PROJECAO_CONTATO,
        });
        await this.registrarEvento(tx, ctx, alvo, atualizado.id, {
          acao: "edicao",
          campos,
          auditAction: "pessoas_contato_atualizado",
        });
        return {
          ...this.resposta(alvo, "registrado", valores(atualizado)),
          resultado: "atualizado" as const,
        };
      });
    } catch (erro) {
      // Duas criações simultâneas do mesmo par: a segunda perde na unicidade
      // do banco. Conflito, não erro interno.
      if (eUnicidadeVioladaNoBanco(erro)) {
        throw new ConflictException();
      }
      throw erro;
    }
  }

  /**
   * Resolve o colaborador no escopo e a empresa REAL em que a operação vale.
   *
   * - Escopado (`rh`, `dp`, `master_tecnico` com empresa ativa): só vínculos
   *   da empresa da sessão.
   * - Global (`master_tecnico` sem empresa ativa): os vínculos do colaborador
   *   em qualquer empresa. Se houver mais de uma empresa, a operação seria
   *   ambígua — 409, e a empresa se escolhe pelo contexto ativo (T163).
   *
   * Inexistente e fora do escopo respondem igual (404, `negarAcesso`): a
   * distinção vazaria a existência de uma pessoa em outra empresa.
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
    if (empresaId === undefined || outras.length > 0) {
      throw new ConflictException();
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
      colaboradorId,
      empresaId,
      operacional: vinculos.some((v) => v.situacao !== "encerrado"),
    };
  }

  private async registrarEvento(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: AlvoContatos,
    contatoId: string,
    evento: {
      acao: AcaoContatoColaborador;
      campos: readonly CampoContatoColaborador[];
      auditAction: AuditAction;
    },
  ): Promise<void> {
    if (evento.acao === "leitura") {
      await this.auditoria.registrarLeitura(
        tx,
        ctx,
        evento.auditAction,
        "contato_colaborador",
        contatoId,
        alvo.empresaId,
      );
    } else {
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        evento.auditAction,
        "contato_colaborador",
        contatoId,
        alvo.empresaId,
      );
    }

    await tx.contatoColaboradorEvento.create({
      data: {
        contatoId,
        empresaId: alvo.empresaId,
        acao: evento.acao,
        campos: [...evento.campos],
        atorUserId: ctx.actor.id,
        requestId: ctx.metadata.requestId,
      },
    });
  }

  private resposta(
    alvo: AlvoContatos,
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
