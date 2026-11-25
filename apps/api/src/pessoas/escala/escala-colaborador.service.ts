import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, SituacaoVinculo } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
  ErroDeCampo,
} from "../../common/erros/recusa-por-campo";
import {
  formatarHora,
  numeroParaDia,
} from "../../horarios/validacao-horarios.util";
import { escolherVinculoPrincipal } from "../colaborador/vinculo-principal";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { DefinirEscalaDto, EncerrarEscalaDto } from "./escala-colaborador.dto";
import { conferirPadrao, diasOrdenados, mesmoPadrao } from "./padrao-escala";

/** Um turno (jornada da empresa), com a grade de hoje. */
export interface TurnoDaEscala {
  id: string;
  codigo: string | null;
  nome: string;
  ativo: boolean;
  periodos: { dia: string; inicio: string; fim: string }[];
  /** T215 — intervalo do período corrido (minutos), cor e sigla do quadro. */
  intervaloMinutos: number;
  cor: string | null;
  sigla: string | null;
}

export interface EscalaProjetada {
  id: string;
  modelo: string;
  turno: TurnoDaEscala | null;
  turnoNoite: TurnoDaEscala | null;
  folgaSemanal: number | null;
  diasTrabalho: number[];
  inicioCiclo: string | null;
  vigenciaInicio: string;
  /** O primeiro dia SEM a escala, ou `null` (aberta). */
  vigenciaFim: string | null;
  /** Quando e por quem o padrão foi definido (só o nome de exibição). */
  definidaEm: string;
  definidaPor: string | null;
}

/** T215 — a aba Escala da ficha. */
export interface EscalasDoColaborador {
  colaboradorId: string;
  empresaId: string;
  vinculo: { dataAdmissao: string; situacao: SituacaoVinculo };
  /** A escala informada no contrato (código do modelo), ou `null`. */
  escalaDoCadastro: string | null;
  /** Da mais nova para a mais antiga. */
  escalas: EscalaProjetada[];
}

const TURNO = {
  select: {
    id: true,
    codigo: true,
    nome: true,
    ativo: true,
    intervaloMinutos: true,
    cor: true,
    sigla: true,
    periodos: {
      select: { diaSemana: true, inicioMinuto: true, fimMinuto: true },
      orderBy: [{ diaSemana: "asc" }, { inicioMinuto: "asc" }],
    },
  },
} as const satisfies Prisma.TabelaHorarioDefaultArgs;

export const PROJECAO = {
  id: true,
  modelo: true,
  folgaSemanal: true,
  diasTrabalho: true,
  inicioCiclo: true,
  vigenciaInicio: true,
  vigenciaFim: true,
  criadoEm: true,
  criadoPor: { select: { nomeExibicao: true } },
  turno: TURNO,
  turnoNoite: TURNO,
} as const satisfies Prisma.EscalaColaboradorSelect;

type LinhaDeEscala = Prisma.EscalaColaboradorGetPayload<{
  select: typeof PROJECAO;
}>;
type LinhaDeTurno = NonNullable<LinhaDeEscala["turno"]>;

function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function dataDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

function recusar(...erros: ErroDeCampo[]): never {
  throw new CamposRecusadosException(erros);
}

function projetarTurno(t: LinhaDeTurno | null): TurnoDaEscala | null {
  if (t === null) return null;
  return {
    id: t.id,
    codigo: t.codigo,
    nome: t.nome,
    ativo: t.ativo,
    intervaloMinutos: t.intervaloMinutos,
    cor: t.cor,
    sigla: t.sigla,
    periodos: t.periodos.map((p) => ({
      dia: numeroParaDia(p.diaSemana),
      inicio: formatarHora(p.inicioMinuto),
      fim: formatarHora(p.fimMinuto),
    })),
  };
}

export function projetar(l: LinhaDeEscala): EscalaProjetada {
  return {
    id: l.id,
    modelo: l.modelo,
    turno: projetarTurno(l.turno),
    turnoNoite: projetarTurno(l.turnoNoite),
    folgaSemanal: l.folgaSemanal,
    diasTrabalho: diasOrdenados(l.diasTrabalho),
    inicioCiclo: l.inicioCiclo ? diaCivil(l.inicioCiclo) : null,
    vigenciaInicio: diaCivil(l.vigenciaInicio),
    vigenciaFim: l.vigenciaFim ? diaCivil(l.vigenciaFim) : null,
    definidaEm: l.criadoEm.toISOString(),
    definidaPor: l.criadoPor.nomeExibicao,
  };
}

/** Sobreposição de vigências (EXCLUSION 23P01 ou o índice da aberta, P2002). */
function eSobreposta(erro: unknown): boolean {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    return true;
  }
  return (
    (erro instanceof Prisma.PrismaClientUnknownRequestError ||
      erro instanceof Prisma.PrismaClientKnownRequestError) &&
    (/23P01/.test(erro.message) || /exclusion constraint/i.test(erro.message))
  );
}

interface Resolvido {
  empresaId: string;
  dataAdmissao: Date;
  situacao: SituacaoVinculo;
}

/**
 * T215 — escala do colaborador (aba Escala da ficha): o padrão de escala
 * com vigência `[início, fim)`.
 *
 * - `rh` e `dp` leem, definem e encerram na empresa ativa; o
 *   `master_tecnico` lê na empresa ativa ou, sem ela, na empresa do vínculo
 *   (leitura global auditada).
 * - Definir com escala aberta é TROCAR: a aberta termina no novo início
 *   (que precisa vir depois do início dela) e a nova começa ali, numa
 *   transação; trocar pelo mesmo padrão é recusado.
 * - A vigência não começa antes da admissão; os turnos são jornadas ATIVAS
 *   da empresa; quais campos cada modelo pede é `conferirPadrao`.
 * - Nenhuma sobreposição (o banco garante; aqui vira 409 no início).
 * - Depois do desligamento, só leitura.
 *
 * A trilha leva só ação, recurso, empresa e o id da ESCALA.
 */
@Injectable()
export class EscalaColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  async consultar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<EscalasDoColaborador> {
    const escopo = resolverEscopoContatos(ctx.actor);
    const resolvido = await this.resolver(
      colaboradorId,
      ctx,
      escopo.global ? null : escopo.empresaId,
    );
    if (escopo.global) {
      await this.auditoria.registrarConsultaGlobal(
        ctx,
        "escala_colaborador",
        colaboradorId,
      );
    }
    return this.montar(this.prisma, colaboradorId, resolvido);
  }

  async definir(
    colaboradorId: string,
    dto: DefinirEscalaDto,
    ctx: PessoasAuditContext,
  ): Promise<EscalasDoColaborador> {
    const resolvido = await this.resolverParaGravar(colaboradorId, ctx);
    const { empresaId } = resolvido;

    const regras = conferirPadrao(dto);
    if (regras.length > 0) recusar(...regras);

    for (const campo of ["tabelaHorarioId", "turnoNoiteId"] as const) {
      const id = dto[campo];
      if (id === undefined || id === null) continue;
      const turno = await this.prisma.tabelaHorario.findFirst({
        where: { id, empresaId, ativo: true },
        select: { id: true },
      });
      if (turno === null) recusar({ campo, motivo: "indisponivel" });
    }

    const inicio = dataDoDia(dto.vigenciaInicio);
    if (inicio < resolvido.dataAdmissao) {
      recusar({ campo: "vigenciaInicio", motivo: "antes_da_admissao" });
    }

    const padrao = {
      modelo: dto.modelo,
      tabelaHorarioId: dto.tabelaHorarioId ?? null,
      turnoNoiteId: dto.turnoNoiteId ?? null,
      folgaSemanal: dto.folgaSemanal ?? null,
      diasTrabalho: diasOrdenados(dto.diasTrabalho),
      inicioCiclo: dto.inicioCiclo ?? null,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const aberta = await tx.escalaColaborador.findFirst({
          where: { colaboradorId, empresaId, vigenciaFim: null },
        });
        if (aberta !== null) {
          if (inicio < aberta.vigenciaInicio) {
            recusar({ campo: "vigenciaInicio", motivo: "fora_de_ordem" });
          }
          const atual = {
            ...aberta,
            inicioCiclo: aberta.inicioCiclo
              ? diaCivil(aberta.inicioCiclo)
              : null,
          };
          if (mesmoPadrao(atual, padrao)) {
            recusar({ campo: "modelo", motivo: "igual_a_vigente" });
          }
          if (inicio.getTime() === aberta.vigenciaInicio.getTime()) {
            // Mesma data de início: o padrão aberto é substituído (correção),
            // sem período de um dia só no histórico.
            await tx.escalaColaborador.update({
              where: { id: aberta.id },
              data: {
                modelo: padrao.modelo,
                tabelaHorarioId: padrao.tabelaHorarioId,
                turnoNoiteId: padrao.turnoNoiteId,
                folgaSemanal: padrao.folgaSemanal,
                diasTrabalho: padrao.diasTrabalho,
                inicioCiclo: padrao.inicioCiclo
                  ? dataDoDia(padrao.inicioCiclo)
                  : null,
                criadoPorUserId: ctx.actor.id,
              },
            });
            await this.auditoria.registrarMutacao(
              tx,
              ctx,
              "pessoas_escala_definida",
              "escala_colaborador",
              aberta.id,
              empresaId,
            );
            return this.montar(tx, colaboradorId, resolvido);
          }
          await tx.escalaColaborador.update({
            where: { id: aberta.id },
            data: { vigenciaFim: inicio },
          });
          await this.auditoria.registrarMutacao(
            tx,
            ctx,
            "pessoas_escala_encerrada",
            "escala_colaborador",
            aberta.id,
            empresaId,
          );
        }
        const nova = await tx.escalaColaborador.create({
          data: {
            colaboradorId,
            empresaId,
            modelo: padrao.modelo,
            tabelaHorarioId: padrao.tabelaHorarioId,
            turnoNoiteId: padrao.turnoNoiteId,
            folgaSemanal: padrao.folgaSemanal,
            diasTrabalho: padrao.diasTrabalho,
            inicioCiclo: padrao.inicioCiclo
              ? dataDoDia(padrao.inicioCiclo)
              : null,
            vigenciaInicio: inicio,
            vigenciaFim: null,
            criadoPorUserId: ctx.actor.id,
          },
          select: { id: true },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_escala_definida",
          "escala_colaborador",
          nova.id,
          empresaId,
        );
        return this.montar(tx, colaboradorId, resolvido);
      });
    } catch (erro) {
      if (eSobreposta(erro)) {
        throw new ConflitoDeCamposException([
          { campo: "vigenciaInicio", motivo: "sobreposta" },
        ]);
      }
      throw erro;
    }
  }

  async encerrar(
    colaboradorId: string,
    escalaId: string,
    dto: EncerrarEscalaDto,
    ctx: PessoasAuditContext,
  ): Promise<EscalasDoColaborador> {
    const resolvido = await this.resolverParaGravar(colaboradorId, ctx);
    const { empresaId } = resolvido;
    const escala = await this.prisma.escalaColaborador.findFirst({
      where: { id: escalaId, colaboradorId, empresaId },
      select: { id: true, vigenciaInicio: true, vigenciaFim: true },
    });
    if (escala === null) {
      return this.auditoria.negarAcesso(
        ctx,
        "escala_colaborador",
        escalaId,
        empresaId,
      );
    }
    if (escala.vigenciaFim !== null) {
      recusar({ campo: "vigenciaFim", motivo: "ja_encerrada" });
    }
    const fim = dataDoDia(dto.vigenciaFim);
    if (fim <= escala.vigenciaInicio) {
      recusar({ campo: "vigenciaFim", motivo: "fora_de_ordem" });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.escalaColaborador.update({
        where: { id: escala.id },
        data: { vigenciaFim: fim },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_escala_encerrada",
        "escala_colaborador",
        escala.id,
        empresaId,
      );
      return this.montar(tx, colaboradorId, resolvido);
    });
  }

  private async montar(
    db: Prisma.TransactionClient,
    colaboradorId: string,
    r: Resolvido,
  ): Promise<EscalasDoColaborador> {
    const [linhas, contrato] = await Promise.all([
      db.escalaColaborador.findMany({
        where: { colaboradorId, empresaId: r.empresaId },
        orderBy: [{ vigenciaInicio: "desc" }, { id: "asc" }],
        select: PROJECAO,
      }),
      db.contratoVinculo.findFirst({
        where: {
          empresaId: r.empresaId,
          vinculo: { colaboradorId },
          escala: { not: null },
        },
        orderBy: { atualizadoEm: "desc" },
        select: { escala: true },
      }),
    ]);
    return {
      colaboradorId,
      empresaId: r.empresaId,
      vinculo: {
        dataAdmissao: diaCivil(r.dataAdmissao),
        situacao: r.situacao,
      },
      escalaDoCadastro: contrato?.escala ?? null,
      escalas: linhas.map(projetar),
    };
  }

  private async resolverParaGravar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<Resolvido> {
    const escopo = resolverEscopoContatos(ctx.actor);
    // O master técnico não grava (o guard já o recusa).
    if (escopo.global) {
      return this.auditoria.negarAcesso(
        ctx,
        "escala_colaborador",
        colaboradorId,
        null,
      );
    }
    const resolvido = await this.resolver(colaboradorId, ctx, escopo.empresaId);
    if (resolvido.situacao === "encerrado") {
      throw new ConflictException();
    }
    return resolvido;
  }

  /**
   * O vínculo principal do colaborador na empresa (a ativa da sessão, ou a
   * do vínculo para o master sem empresa). Sem vínculo no escopo: 404
   * auditado; vínculos em mais de uma empresa sem empresa ativa: 409.
   */
  private async resolver(
    colaboradorId: string,
    ctx: PessoasAuditContext,
    empresaDaSessao: string | null,
  ): Promise<Resolvido> {
    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: {
        colaboradorId,
        ...(empresaDaSessao === null ? {} : { empresaId: empresaDaSessao }),
      },
      select: {
        empresaId: true,
        situacao: true,
        dataAdmissao: true,
        matricula: true,
      },
    });
    const empresas = [...new Set(vinculos.map((v) => v.empresaId))];
    const empresaId = empresas[0];
    if (empresaId === undefined) {
      return this.auditoria.negarAcesso(
        ctx,
        "escala_colaborador",
        colaboradorId,
        empresaDaSessao,
      );
    }
    if (empresas.length > 1) {
      throw new ConflictException();
    }
    const principal = escolherVinculoPrincipal(vinculos)!;
    return {
      empresaId,
      dataAdmissao: principal.dataAdmissao,
      situacao: principal.situacao,
    };
  }
}
