import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IsBoolean, IsDateString, Matches } from "class-validator";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  RecusaDeNegocioException,
} from "../../common/erros/recusa-por-campo";
import { semDesativacaoVigente } from "../colaborador/desativacao";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { resolverDiaDoPadrao, somarDias } from "./dia-do-padrao";
import {
  type EscalaProjetada,
  PROJECAO,
  projetar,
} from "./escala-colaborador.service";
import { DIAS_NO_QUADRO } from "./quadro-escala.service";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 24 * 60 * 60 * 1000;

/** T215 — "Publicar a escala": o período (os dois dias contam) e o aviso. */
export class PublicarEscalaDto {
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicio!: string;

  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  fim!: string;

  /** Avisar as pessoas pelo Portal e por e-mail (só quem teve mudança). */
  @IsBoolean()
  avisar!: boolean;
}

/** A publicação como o quadro mostra ("Publicada em 25/11 por Ana"). */
export interface PublicacaoDaEscala {
  id: string;
  inicio: string;
  fim: string;
  novas: number;
  alteradas: number;
  pessoas: number;
  avisar: boolean;
  publicadaEm: string;
  publicadaPor: string | null;
}

export const PROJECAO_DA_PUBLICACAO = {
  id: true,
  inicio: true,
  fim: true,
  novas: true,
  alteradas: true,
  pessoas: true,
  avisar: true,
  publicadoEm: true,
  publicadoPor: { select: { nomeExibicao: true } },
} as const satisfies Prisma.EscalaPublicacaoSelect;

export function projetarPublicacao(
  l: Prisma.EscalaPublicacaoGetPayload<{
    select: typeof PROJECAO_DA_PUBLICACAO;
  }>,
): PublicacaoDaEscala {
  return {
    id: l.id,
    inicio: l.inicio.toISOString().slice(0, 10),
    fim: l.fim.toISOString().slice(0, 10),
    novas: l.novas,
    alteradas: l.alteradas,
    pessoas: l.pessoas,
    avisar: l.avisar,
    publicadaEm: l.publicadoEm.toISOString(),
    publicadaPor: l.publicadoPor.nomeExibicao,
  };
}

function dataDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Linhas por comando (bem abaixo do limite de parâmetros do PostgreSQL). */
const LINHAS_POR_COMANDO = 1000;

function emBlocos<T>(lista: readonly T[]): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < lista.length; i += LINHAS_POR_COMANDO) {
    blocos.push(lista.slice(i, i + LINHAS_POR_COMANDO));
  }
  return blocos;
}

/** O que um dia gravado guarda (sem a pessoa, o dia e a camada). */
interface DadosDoDia {
  tipo: string;
  tabelaHorarioId: string | null;
  periodos: Prisma.InputJsonValue;
  intervaloMinutos: number;
  sobreaviso: Prisma.InputJsonValue;
  unidadeOrganizacionalId: string | null;
  observacao: string | null;
}

/** Uma pessoa do quadro no período: os dias do vínculo e os padrões. */
interface PessoaDoPeriodo {
  colaboradorId: string;
  /** Primeiro e último dia do vínculo dentro do período. */
  de: string;
  ate: string;
  escalas: EscalaProjetada[];
}

/**
 * T215 — publicar a escala do período: TODO dia resolvido das pessoas do
 * quadro vira PUBLICADO, para que a escala publicada (exportação, mural,
 * Benefícios) fique completa e não mude quando o padrão mudar depois:
 *
 * - dia com rascunho: o rascunho vira o publicado (troca o publicado do dia
 *   ou cria) e sai do rascunho;
 * - dia sem rascunho e sem publicado: o dia pelo padrão da pessoa (a mesma
 *   regra da célula do quadro) é gravado como publicado — trabalho com o
 *   turno e o horário do dia, folga ou DSR. Dia sem padrão ("sem escala") e
 *   trabalho sem turno fixo (ou com mais de 2 períodos no dia) não têm forma
 *   de dia gravado e continuam pelo padrão;
 * - dia já publicado sem rascunho: fica como está;
 * - fora do vínculo (antes da admissão, depois do desligamento) e quem está
 *   desativado: nada se grava. Ausência aprovada não muda o dia gravado (no
 *   quadro, a ausência continua vencendo o turno).
 *
 * Em lote (poucos comandos para qualquer tamanho), numa transação de até
 * 60 s, como `gravarLote` e `limparLote`.
 *
 * - `rh` e `dp` na empresa ativa (o guard nega os demais).
 * - Nada a gravar no período: 422 `escala_nada_para_publicar`.
 * - O aviso às pessoas fica registrado; o envio depende do Portal e do
 *   e-mail (fora desta fatia; ligação pendente em
 *   docs/decisions/ligacoes-pendentes-modulos-futuros.md, item 3).
 * - A trilha leva só ação, recurso, empresa e o id da publicação.
 */
@Injectable()
export class EscalaPublicacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  async publicar(
    dto: PublicarEscalaDto,
    ctx: PessoasAuditContext,
  ): Promise<PublicacaoDaEscala> {
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

    return this.prisma.$transaction(
      async (tx) => {
        const noPeriodo = { empresaId, dia: { gte: inicio, lte: fim } };
        const rascunhos = await tx.escalaDia.findMany({
          where: { ...noPeriodo, camada: "rascunho" },
        });
        const publicados = await tx.escalaDia.findMany({
          where: { ...noPeriodo, camada: "publicado" },
          select: { id: true, colaboradorId: true, dia: true },
        });
        const chave = (colaboradorId: string, dia: string) =>
          `${colaboradorId}|${dia}`;
        const publicadoDe = new Map(
          publicados.map((p) => [
            chave(p.colaboradorId, diaCivil(p.dia)),
            p.id,
          ]),
        );
        const comRascunho = new Set(
          rascunhos.map((r) => chave(r.colaboradorId, diaCivil(r.dia))),
        );

        const criar: Prisma.EscalaDiaCreateManyInput[] = [];
        /** Publicados trocados pelo rascunho, agrupados pelo mesmo valor. */
        const trocar = new Map<string, { dados: DadosDoDia; ids: string[] }>();
        const pessoasComMudanca = new Set<string>();
        const novo = (
          colaboradorId: string,
          dia: Date,
          dados: DadosDoDia,
        ): Prisma.EscalaDiaCreateManyInput => ({
          ...dados,
          colaboradorId,
          empresaId,
          dia,
          camada: "publicado",
          criadoPorUserId: ctx.actor.id,
          atualizadoPorUserId: ctx.actor.id,
        });

        for (const r of rascunhos) {
          const dados: DadosDoDia = {
            tipo: r.tipo,
            tabelaHorarioId: r.tabelaHorarioId,
            periodos: r.periodos as Prisma.InputJsonValue,
            intervaloMinutos: r.intervaloMinutos,
            sobreaviso: r.sobreaviso as Prisma.InputJsonValue,
            unidadeOrganizacionalId: r.unidadeOrganizacionalId,
            observacao: r.observacao,
          };
          pessoasComMudanca.add(r.colaboradorId);
          const id = publicadoDe.get(chave(r.colaboradorId, diaCivil(r.dia)));
          if (id) {
            const k = JSON.stringify(dados);
            const grupo = trocar.get(k) ?? { dados, ids: [] };
            grupo.ids.push(id);
            trocar.set(k, grupo);
          } else {
            criar.push(novo(r.colaboradorId, r.dia, dados));
          }
        }

        // Os dias que seguem o padrão viram publicados também.
        const pessoas = await this.pessoasDoPeriodo(tx, empresaId, inicio, fim);
        for (const p of pessoas) {
          for (let dia = p.de; dia <= p.ate; dia = somarDias(dia, 1)) {
            const k = chave(p.colaboradorId, dia);
            if (comRascunho.has(k) || publicadoDe.has(k)) continue;
            const r = resolverDiaDoPadrao(p.escalas, dia);
            if (r === null) continue;
            const semForma =
              r.tipo === "trabalho" &&
              (r.periodos.length === 0 || r.periodos.length > 2);
            if (semForma) continue;
            pessoasComMudanca.add(p.colaboradorId);
            criar.push(
              novo(p.colaboradorId, dataDoDia(dia), {
                tipo: r.tipo,
                tabelaHorarioId: r.tabelaHorarioId,
                periodos: r.periodos,
                intervaloMinutos: r.intervaloMinutos,
                sobreaviso: [],
                unidadeOrganizacionalId: null,
                observacao: null,
              }),
            );
          }
        }

        const alteradas = [...trocar.values()].reduce(
          (t, g) => t + g.ids.length,
          0,
        );
        if (criar.length === 0 && alteradas === 0) {
          throw new RecusaDeNegocioException("escala_nada_para_publicar");
        }

        // O publicado não se apaga (gatilho do banco): a troca é UPDATE, um
        // comando por valor distinto (as ações em massa repetem o mesmo dia).
        for (const { dados, ids } of trocar.values()) {
          for (const bloco of emBlocos(ids)) {
            await tx.escalaDia.updateMany({
              where: { id: { in: bloco } },
              data: { ...dados, atualizadoPorUserId: ctx.actor.id },
            });
          }
        }
        for (const bloco of emBlocos(criar)) {
          await tx.escalaDia.createMany({ data: bloco });
        }
        for (const bloco of emBlocos(rascunhos.map((r) => r.id))) {
          await tx.escalaDia.deleteMany({
            where: { id: { in: bloco }, camada: "rascunho" },
          });
        }

        const linha = await tx.escalaPublicacao.create({
          data: {
            empresaId,
            inicio,
            fim,
            novas: criar.length,
            alteradas,
            pessoas: pessoasComMudanca.size,
            avisar: dto.avisar,
            publicadoPorUserId: ctx.actor.id,
          },
          select: PROJECAO_DA_PUBLICACAO,
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_escala_publicada",
          "escala_colaborador",
          linha.id,
          empresaId,
        );
        return projetarPublicacao(linha);
      },
      { timeout: 60_000 },
    );
  }

  /**
   * As pessoas do quadro no período com padrão (a mesma seleção do quadro:
   * vínculo no período, sem desativação; na readmissão, o vínculo mais
   * recente), com os dias do vínculo dentro do período e os padrões.
   */
  private async pessoasDoPeriodo(
    tx: Prisma.TransactionClient,
    empresaId: string,
    inicio: Date,
    fim: Date,
  ): Promise<PessoaDoPeriodo[]> {
    const vinculos = await tx.vinculoFuncional.findMany({
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
        dataAdmissao: true,
        dataDesligamento: true,
      },
    });
    const porColaborador = new Map<string, (typeof vinculos)[number]>();
    for (const v of vinculos) {
      if (!porColaborador.has(v.colaboradorId)) {
        porColaborador.set(v.colaboradorId, v);
      }
    }
    if (porColaborador.size === 0) return [];
    const escalas = await tx.escalaColaborador.findMany({
      where: {
        empresaId,
        colaboradorId: { in: [...porColaborador.keys()] },
        vigenciaInicio: { lte: fim },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gt: inicio } }],
      },
      orderBy: [{ vigenciaInicio: "desc" }],
      select: { ...PROJECAO, colaboradorId: true },
    });
    const escalasDe = new Map<string, EscalaProjetada[]>();
    for (const e of escalas) {
      escalasDe.set(e.colaboradorId, [
        ...(escalasDe.get(e.colaboradorId) ?? []),
        projetar(e),
      ]);
    }
    const primeiro = diaCivil(inicio);
    const ultimo = diaCivil(fim);
    const pessoas: PessoaDoPeriodo[] = [];
    for (const v of porColaborador.values()) {
      const padroes = escalasDe.get(v.colaboradorId);
      if (!padroes) continue;
      const admissao = diaCivil(v.dataAdmissao);
      const saida = v.dataDesligamento ? diaCivil(v.dataDesligamento) : null;
      pessoas.push({
        colaboradorId: v.colaboradorId,
        de: admissao > primeiro ? admissao : primeiro,
        ate: saida !== null && saida < ultimo ? saida : ultimo,
        escalas: padroes,
      });
    }
    return pessoas;
  }
}
