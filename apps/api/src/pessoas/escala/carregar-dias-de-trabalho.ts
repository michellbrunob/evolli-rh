import { Prisma } from "@prisma/client";
import { ausenciasQueValem } from "./ausencias-que-valem";
import {
  type EscalaProjetada,
  PROJECAO,
  projetar,
} from "./escala-colaborador.service";
import { type DiasDeTrabalho, diasDeTrabalhoNoMes } from "./dias-de-trabalho";

/** Quem conta: a pessoa com a unidade, a escala do cadastro e o vínculo. */
export interface PessoaDosDias {
  readonly colaboradorId: string;
  readonly unidadeId: string | null;
  readonly escalaDoCadastro: string | null;
  /** AAAA-MM-DD, ou `null`. */
  readonly admissao: string | null;
  readonly desligamento: string | null;
}

/** UF da empresa e os feriados municipais do mês (com as unidades). */
export interface CalendarioDoMes {
  readonly uf: string | null;
  readonly municipais: readonly { data: string; unidadeIds: string[] }[];
}

function diaCivil(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function inicioDoMes(competencia: string): Date {
  return new Date(`${competencia}-01T00:00:00.000Z`);
}

function fimDoMes(competencia: string): Date {
  const [a, m] = competencia.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0));
}

/** UF da empresa e os feriados municipais do mês (Regras da escala). */
export async function carregarCalendarioDoMes(
  db: Prisma.TransactionClient,
  empresaId: string,
  competencia: string,
): Promise<CalendarioDoMes> {
  const [empresa, feriados] = await Promise.all([
    db.empresa.findUnique({ where: { id: empresaId }, select: { uf: true } }),
    db.escalaFeriadoLocal.findMany({
      where: {
        empresaId,
        arquivadoEm: null,
        tipo: "municipal",
        data: { gte: inicioDoMes(competencia), lte: fimDoMes(competencia) },
      },
      select: { data: true, unidadeIds: true },
    }),
  ]);
  return {
    uf: empresa?.uf ?? null,
    municipais: feriados.map((f) => ({
      data: diaCivil(f.data),
      unidadeIds: f.unidadeIds,
    })),
  };
}

/** Os feriados municipais que valem para a unidade (sem unidade: todos). */
export function municipaisDaUnidade(
  cal: CalendarioDoMes,
  unidadeId: string | null,
): string[] {
  return cal.municipais
    .filter(
      (f) =>
        f.unidadeIds.length === 0 ||
        (unidadeId !== null && f.unidadeIds.includes(unidadeId)),
    )
    .map((f) => f.data);
}

/**
 * T215 — os dias de trabalho de cada pessoa no mês (`diasDeTrabalhoNoMes`),
 * com o que o banco guarda: os padrões que tocam o mês, os dias PUBLICADOS
 * e as ausências que valem. Três consultas para todas as pessoas.
 */
export async function carregarDiasDeTrabalho(
  db: Prisma.TransactionClient,
  empresaId: string,
  competencia: string,
  pessoas: readonly PessoaDosDias[],
  cal: CalendarioDoMes,
): Promise<Map<string, DiasDeTrabalho>> {
  const resultado = new Map<string, DiasDeTrabalho>();
  if (pessoas.length === 0) return resultado;
  const ids = pessoas.map((p) => p.colaboradorId);
  const inicio = inicioDoMes(competencia);
  const fim = fimDoMes(competencia);
  const [escalas, publicados, ausencias] = await Promise.all([
    db.escalaColaborador.findMany({
      where: {
        empresaId,
        colaboradorId: { in: ids },
        vigenciaInicio: { lte: fim },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gt: inicio } }],
      },
      orderBy: [{ vigenciaInicio: "desc" }],
      select: { ...PROJECAO, colaboradorId: true },
    }),
    db.escalaDia.findMany({
      where: {
        empresaId,
        camada: "publicado",
        colaboradorId: { in: ids },
        dia: { gte: inicio, lte: fim },
      },
      select: { colaboradorId: true, dia: true, tipo: true },
    }),
    db.ausencia.findMany({
      where: ausenciasQueValem(empresaId, ids, inicio, fim),
      select: { colaboradorId: true, inicio: true, fim: true },
    }),
  ]);
  const escalasDe = new Map<string, EscalaProjetada[]>();
  for (const e of escalas) {
    escalasDe.set(e.colaboradorId, [
      ...(escalasDe.get(e.colaboradorId) ?? []),
      projetar(e),
    ]);
  }
  const publicadosDe = new Map<string, Map<string, string>>();
  for (const d of publicados) {
    const m = publicadosDe.get(d.colaboradorId) ?? new Map<string, string>();
    m.set(diaCivil(d.dia), d.tipo);
    publicadosDe.set(d.colaboradorId, m);
  }
  const ausenciasDe = new Map<
    string,
    { inicio: string; fim: string | null }[]
  >();
  for (const a of ausencias) {
    ausenciasDe.set(a.colaboradorId, [
      ...(ausenciasDe.get(a.colaboradorId) ?? []),
      { inicio: diaCivil(a.inicio), fim: a.fim ? diaCivil(a.fim) : null },
    ]);
  }
  for (const p of pessoas) {
    resultado.set(
      p.colaboradorId,
      diasDeTrabalhoNoMes({
        competencia,
        escalas: escalasDe.get(p.colaboradorId) ?? [],
        publicados: publicadosDe.get(p.colaboradorId) ?? new Map(),
        ausencias: ausenciasDe.get(p.colaboradorId) ?? [],
        escalaDoCadastro: p.escalaDoCadastro,
        uf: cal.uf,
        feriadosMunicipais: municipaisDaUnidade(cal, p.unidadeId),
        admissao: p.admissao,
        desligamento: p.desligamento,
      }),
    );
  }
  return resultado;
}
