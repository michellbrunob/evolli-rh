import { SituacaoVinculo } from "@prisma/client";

/**
 * T215 — o vínculo PRINCIPAL do colaborador, com a mesma ordem da listagem
 * (`ordenarVinculosListados`) e da ficha (`vinculoPrincipal` na web): ativo,
 * depois previsto, depois encerrado; dentro da mesma situação, a admissão
 * mais recente; empate, matrícula informada antes da ausente e, entre duas,
 * a ordem alfabética. Não reordena a lista recebida.
 */
const ORDEM_SITUACAO: Record<SituacaoVinculo, number> = {
  ativo: 0,
  previsto: 1,
  encerrado: 2,
};

function compararMatriculas(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

export interface VinculoOrdenavel {
  situacao: SituacaoVinculo;
  dataAdmissao: Date;
  matricula: string | null;
}

export function escolherVinculoPrincipal<T extends VinculoOrdenavel>(
  vinculos: readonly T[],
): T | null {
  const ordenados = [...vinculos].sort(
    (a, b) =>
      ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] ||
      b.dataAdmissao.getTime() - a.dataAdmissao.getTime() ||
      compararMatriculas(a.matricula, b.matricula),
  );
  return ordenados[0] ?? null;
}
