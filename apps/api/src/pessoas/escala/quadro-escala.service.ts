import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  MotivoAfastamento,
  SituacaoVinculo,
  TipoAusencia,
  TipoVinculo,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";
import { semDesativacaoVigente } from "../colaborador/desativacao";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditContext } from "../pessoas.types";
import { ConsultarQuadroDto } from "./quadro-escala.dto";
import { ausenciasQueValem } from "./ausencias-que-valem";
import {
  EscalaProjetada,
  PROJECAO,
  projetar,
} from "./escala-colaborador.service";
import {
  type DiaGravado,
  PROJECAO_DO_DIA,
  projetarDia,
} from "./escala-dia.service";
import {
  type PublicacaoDaEscala,
  PROJECAO_DA_PUBLICACAO,
  projetarPublicacao,
} from "./escala-publicacao.service";
import {
  EscalaRegrasService,
  type RegrasDaEscala,
} from "./escala-regras.service";

/** Até seis semanas: o mês inteiro com as semanas das pontas. */
export const DIAS_NO_QUADRO = 42;

interface Referencia {
  id: string;
  nome: string;
}

/**
 * Uma ausência aprovada que toca o período (Férias e ausências). Ausência
 * vence o turno: o dia é da ausência e só muda em Férias e ausências.
 */
export interface AusenciaNoQuadro {
  id: string;
  tipo: TipoAusencia;
  motivoAfastamento: MotivoAfastamento | null;
  inicio: string;
  /** `null`: afastamento sem data de volta. */
  fim: string | null;
}

/** Uma pessoa do quadro: o vínculo no período, a lotação e os padrões. */
export interface PessoaDoQuadro {
  colaboradorId: string;
  nome: string;
  tipoVinculo: TipoVinculo;
  situacao: SituacaoVinculo;
  dataAdmissao: string;
  /** O último dia do vínculo, ou `null`. */
  dataDesligamento: string | null;
  departamento: Referencia | null;
  unidade: Referencia | null;
  cargo: Referencia | null;
  area: Referencia | null;
  centroCusto: Referencia | null;
  gestor: Referencia | null;
  /** Nível de carreira do contrato (código), ou `null`. */
  nivel: string | null;
  /**
   * Gênero do perfil pessoal (código), ou `null`. Quem lê o quadro (rh, dp
   * e master_tecnico na empresa ativa) lê os dados pessoais pela mesma matriz.
   */
  genero: string | null;
  /** A escala do contrato (código do modelo), ou `null`. */
  escalaDoCadastro: string | null;
  /** Para o aviso de menor de 18 anos em turno noturno (CLT, art. 404). */
  dataNascimento: string | null;
  jornadaSemanalHoras: number | null;
  /** Os padrões que tocam o período, do mais novo ao mais antigo. */
  escalas: EscalaProjetada[];
  /** Os dias gravados no período (rascunho e publicado), por dia. */
  dias: DiaGravado[];
  /** As ausências aprovadas que tocam o período, por início. */
  ausencias: AusenciaNoQuadro[];
}

export interface QuadroDaEscala {
  empresaId: string;
  inicio: string;
  fim: string;
  /** A publicação mais recente que toca o período, ou `null`. */
  publicacao: PublicacaoDaEscala | null;
  /** As Regras da escala (avisos, convenção, transição, feriados locais). */
  regras: RegrasDaEscala;
  pessoas: PessoaDoQuadro[];
}

const MS_DIA = 24 * 60 * 60 * 1000;

function dataDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * T215 — o quadro "Escala de trabalho" (semana ou mês): as pessoas da
 * empresa ativa com vínculo no período (previsto, ativo ou encerrado dentro
 * dele; sem quem está desativado), a lotação vigente, o gestor e a jornada do
 * contrato, e os padrões de escala que tocam o período. Os dias de cada pessoa
 * saem dos padrões, no cliente, pelas mesmas regras da aba Escala da ficha.
 *
 * Só na empresa ativa: `rh` e `dp`, e o `master_tecnico` com empresa ativa;
 * sem empresa ativa não há quadro (403). Leitura sem trilha, como a listagem.
 */
@Injectable()
export class QuadroEscalaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regras: EscalaRegrasService,
  ) {}

  async consultar(
    dto: ConsultarQuadroDto,
    ctx: PessoasAuditContext,
  ): Promise<QuadroDaEscala> {
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) throw new ForbiddenException();
    const { empresaId } = escopo;

    const inicio = dataDoDia(dto.inicio);
    const fim = dataDoDia(dto.fim);
    const dias = Math.round((fim.getTime() - inicio.getTime()) / MS_DIA) + 1;
    if (dias < 1) {
      throw new CamposRecusadosException([
        { campo: "fim", motivo: "fora_de_ordem" },
      ]);
    }
    if (dias > DIAS_NO_QUADRO) {
      throw new CamposRecusadosException([
        { campo: "fim", motivo: "invalido" },
      ]);
    }

    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: {
        empresaId,
        dataAdmissao: { lte: fim },
        OR: [
          { situacao: { in: ["previsto", "ativo"] } },
          { situacao: "encerrado", dataDesligamento: { gte: inicio } },
        ],
        colaborador: semDesativacaoVigente(empresaId),
      },
      orderBy: [{ dataAdmissao: "desc" }, { id: "asc" }],
      select: {
        colaboradorId: true,
        tipo: true,
        situacao: true,
        dataAdmissao: true,
        dataDesligamento: true,
        colaborador: {
          select: {
            nome: true,
            perfisPessoais: {
              where: { empresaId },
              take: 1,
              select: { genero: true, dataNascimento: true },
            },
          },
        },
        alocacoes: {
          where: { vigenteAte: null },
          take: 1,
          select: {
            departamento: { select: { id: true, nome: true } },
            unidadeOrganizacional: { select: { id: true, nome: true } },
            cargo: { select: { id: true, nome: true } },
            area: { select: { id: true, nome: true } },
            centroCusto: { select: { id: true, nome: true } },
          },
        },
        contrato: {
          select: {
            escala: true,
            jornadaSemanalHoras: true,
            nivel: true,
            gestorDireto: { select: { id: true, nome: true } },
          },
        },
      },
    });

    // Readmissão: um colaborador, uma linha — o vínculo mais recente.
    const porColaborador = new Map<string, (typeof vinculos)[number]>();
    for (const v of vinculos) {
      if (!porColaborador.has(v.colaboradorId)) {
        porColaborador.set(v.colaboradorId, v);
      }
    }
    const ids = [...porColaborador.keys()];

    const escalas =
      ids.length === 0
        ? []
        : await this.prisma.escalaColaborador.findMany({
            where: {
              empresaId,
              colaboradorId: { in: ids },
              vigenciaInicio: { lte: fim },
              OR: [{ vigenciaFim: null }, { vigenciaFim: { gt: inicio } }],
            },
            orderBy: [{ vigenciaInicio: "desc" }],
            select: { ...PROJECAO, colaboradorId: true },
          });
    const escalasPorColaborador = new Map<string, EscalaProjetada[]>();
    for (const e of escalas) {
      const lista = escalasPorColaborador.get(e.colaboradorId) ?? [];
      lista.push(projetar(e));
      escalasPorColaborador.set(e.colaboradorId, lista);
    }

    const gravados =
      ids.length === 0
        ? []
        : await this.prisma.escalaDia.findMany({
            where: {
              empresaId,
              colaboradorId: { in: ids },
              dia: { gte: inicio, lte: fim },
            },
            orderBy: [{ dia: "asc" }, { camada: "asc" }],
            select: { ...PROJECAO_DO_DIA, colaboradorId: true },
          });
    const diasPorColaborador = new Map<string, DiaGravado[]>();
    for (const d of gravados) {
      const lista = diasPorColaborador.get(d.colaboradorId) ?? [];
      lista.push(projetarDia(d));
      diasPorColaborador.set(d.colaboradorId, lista);
    }

    const ausencias =
      ids.length === 0
        ? []
        : await this.prisma.ausencia.findMany({
            where: ausenciasQueValem(empresaId, ids, inicio, fim),
            orderBy: [{ inicio: "asc" }, { id: "asc" }],
            select: {
              id: true,
              colaboradorId: true,
              tipo: true,
              motivoAfastamento: true,
              inicio: true,
              fim: true,
            },
          });
    const ausenciasPorColaborador = new Map<string, AusenciaNoQuadro[]>();
    for (const a of ausencias) {
      const lista = ausenciasPorColaborador.get(a.colaboradorId) ?? [];
      lista.push({
        id: a.id,
        tipo: a.tipo,
        motivoAfastamento: a.motivoAfastamento,
        inicio: diaCivil(a.inicio),
        fim: a.fim ? diaCivil(a.fim) : null,
      });
      ausenciasPorColaborador.set(a.colaboradorId, lista);
    }

    const pessoas: PessoaDoQuadro[] = [...porColaborador.entries()].map(
      ([colaboradorId, v]) => {
        const lotacao = v.alocacoes[0];
        return {
          colaboradorId,
          nome: v.colaborador.nome,
          tipoVinculo: v.tipo,
          situacao: v.situacao,
          dataAdmissao: diaCivil(v.dataAdmissao),
          dataDesligamento: v.dataDesligamento
            ? diaCivil(v.dataDesligamento)
            : null,
          departamento: lotacao?.departamento ?? null,
          unidade: lotacao?.unidadeOrganizacional ?? null,
          cargo: lotacao?.cargo ?? null,
          area: lotacao?.area ?? null,
          centroCusto: lotacao?.centroCusto ?? null,
          gestor: v.contrato?.gestorDireto ?? null,
          nivel: v.contrato?.nivel ?? null,
          genero: v.colaborador.perfisPessoais[0]?.genero ?? null,
          dataNascimento: v.colaborador.perfisPessoais[0]?.dataNascimento
            ? diaCivil(v.colaborador.perfisPessoais[0].dataNascimento)
            : null,
          escalaDoCadastro: v.contrato?.escala ?? null,
          jornadaSemanalHoras: v.contrato?.jornadaSemanalHoras ?? null,
          escalas: escalasPorColaborador.get(colaboradorId) ?? [],
          dias: diasPorColaborador.get(colaboradorId) ?? [],
          ausencias: ausenciasPorColaborador.get(colaboradorId) ?? [],
        };
      },
    );
    pessoas.sort(
      (a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR") ||
        a.colaboradorId.localeCompare(b.colaboradorId),
    );

    const publicacao = await this.prisma.escalaPublicacao.findFirst({
      where: { empresaId, inicio: { lte: fim }, fim: { gte: inicio } },
      orderBy: [{ publicadoEm: "desc" }],
      select: PROJECAO_DA_PUBLICACAO,
    });

    return {
      empresaId,
      inicio: dto.inicio,
      fim: dto.fim,
      publicacao: publicacao ? projetarPublicacao(publicacao) : null,
      regras: await this.regras.montar(this.prisma, empresaId),
      pessoas,
    };
  }
}
