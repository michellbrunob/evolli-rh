import { Prisma } from "@prisma/client";
import { semDesativacaoVigente } from "../pessoas/colaborador/desativacao";

/**
 * T216 — as pessoas da pesquisa: quem está ativo na empresa (o "todos") e o
 * departamento da lotação vigente (participantes e o recorte).
 */

type Db = Prisma.TransactionClient;

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

/** O departamento da lotação vigente de cada pessoa na empresa. */
export async function departamentosVigentes(
  db: Db,
  empresaId: string,
  colaboradorIds: readonly string[],
): Promise<Map<string, { id: string; nome: string } | null>> {
  const mapa = new Map<string, { id: string; nome: string } | null>();
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
        select: { departamento: { select: { id: true, nome: true } } },
      },
    },
  });
  // O vínculo ativo primeiro; depois o mais recente (sort estável).
  const ordenados = [...vinculos].sort(
    (a, b) => Number(b.situacao === "ativo") - Number(a.situacao === "ativo"),
  );
  for (const v of ordenados) {
    if (mapa.has(v.colaboradorId)) continue;
    mapa.set(v.colaboradorId, v.alocacoes[0]?.departamento ?? null);
  }
  return mapa;
}
