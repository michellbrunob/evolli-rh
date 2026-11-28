import { Prisma } from "@prisma/client";
import { semDesativacaoVigente } from "../pessoas/colaborador/desativacao";
import { distinguirNomesRepetidos } from "./nomes-dos-grupos";
import type { CampoGrupo } from "./pesquisas.types";

/**
 * T216 — as pessoas da pesquisa: quem está ativo na empresa (o "todos") e os
 * grupos da lotação vigente — departamento, centro de custo e unidade
 * (participantes e os recortes) — e os catálogos ativos da empresa (a
 * escolha de grupo na anônima).
 */

type Db = Prisma.TransactionClient;

export interface Grupo {
  id: string;
  nome: string;
}

export type GruposDaLotacao = Record<CampoGrupo, Grupo | null>;

/** Os colaboradores ativos na empresa (vínculo ativo, sem desativação). */
export async function ativosDaEmpresa(
  db: Db,
  empresaId: string,
): Promise<string[]> {
  const vinculos = await db.vinculoFuncional.findMany({
    where: {
      empresaId,
      situacao: "ativo",
      colaborador: semDesativacaoVigente(empresaId),
    },
    select: { colaboradorId: true },
  });
  return [...new Set(vinculos.map((v) => v.colaboradorId))];
}

/** Os grupos da lotação vigente de cada pessoa na empresa. */
export async function lotacoesVigentes(
  db: Db,
  empresaId: string,
  colaboradorIds: readonly string[],
): Promise<Map<string, GruposDaLotacao>> {
  const mapa = new Map<string, GruposDaLotacao>();
  if (colaboradorIds.length === 0) return mapa;
  const vinculos = await db.vinculoFuncional.findMany({
    where: { empresaId, colaboradorId: { in: [...colaboradorIds] } },
    orderBy: { dataAdmissao: "desc" },
    select: {
      colaboradorId: true,
      situacao: true,
      alocacoes: {
        where: { vigenteAte: null },
        take: 1,
        select: {
          departamento: { select: { id: true, nome: true } },
          centroCusto: { select: { id: true, nome: true } },
          unidadeOrganizacional: { select: { id: true, nome: true } },
        },
      },
    },
  });
  // O vínculo ativo primeiro; depois o mais recente (sort estável).
  const ordenados = [...vinculos].sort(
    (a, b) => Number(b.situacao === "ativo") - Number(a.situacao === "ativo"),
  );
  for (const v of ordenados) {
    if (mapa.has(v.colaboradorId)) continue;
    const a = v.alocacoes[0];
    mapa.set(v.colaboradorId, {
      departamento: a?.departamento ?? null,
      centroCusto: a?.centroCusto ?? null,
      unidade: a?.unidadeOrganizacional ?? null,
    });
  }
  return mapa;
}

/** O departamento da lotação vigente de cada pessoa na empresa. */
export async function departamentosVigentes(
  db: Db,
  empresaId: string,
  colaboradorIds: readonly string[],
): Promise<Map<string, Grupo | null>> {
  const lotacoes = await lotacoesVigentes(db, empresaId, colaboradorIds);
  return new Map([...lotacoes].map(([id, g]) => [id, g.departamento]));
}

/** Os itens ATIVOS de um catálogo da empresa, por nome (o repetido, com o código). */
export async function catalogoAtivo(
  db: Db,
  empresaId: string,
  campo: CampoGrupo,
): Promise<Grupo[]> {
  const where = { empresaId, status: "ativo" as const };
  const select = { id: true, nome: true, codigo: true };
  const orderBy = [{ nome: "asc" as const }, { codigo: "asc" as const }];
  // Nome repetido ganha o código, para quem escolhe diferenciar.
  switch (campo) {
    case "departamento":
      return distinguirNomesRepetidos(
        await db.departamento.findMany({ where, select, orderBy }),
      );
    case "centroCusto":
      return distinguirNomesRepetidos(
        await db.centroCusto.findMany({ where, select, orderBy }),
      );
    case "unidade":
      return distinguirNomesRepetidos(
        await db.unidadeOrganizacional.findMany({ where, select, orderBy }),
      );
  }
}

/** id → nome de grupos de qualquer catálogo da empresa. */
export async function nomesDosGrupos(
  db: Db,
  empresaId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const onde = { empresaId, id: { in: [...ids] } };
  const select = { id: true, nome: true };
  const [d, c, u] = await Promise.all([
    db.departamento.findMany({ where: onde, select }),
    db.centroCusto.findMany({ where: onde, select }),
    db.unidadeOrganizacional.findMany({ where: onde, select }),
  ]);
  return new Map([...d, ...c, ...u].map((g) => [g.id, g.nome]));
}
