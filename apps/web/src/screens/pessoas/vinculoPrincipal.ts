/**
 * T187 — o vínculo principal da ficha, com a MESMA ordem que o servidor usa
 * para a listagem (`ordenarVinculosListados`, T178/T179): ativo, depois
 * previsto, depois encerrado; dentro da mesma situação, a admissão mais
 * recente; empate, matrícula informada antes da ausente e, entre duas
 * informadas, a ordem alfabética. Assim a "Vida funcional" fala do mesmo
 * vínculo que Matrícula, Cargo, Departamento e Jornada mostram na linha.
 *
 * Os vínculos chegam de `GET /colaboradores/:id/vinculos`, já no escopo da
 * sessão (a empresa ativa, ou todas só para o master sem empresa): nenhum
 * vínculo de fora entra na escolha.
 */
import type {
  SituacaoVinculo,
  VinculoApi,
} from "../../api/colaboradoresClient";

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

export function vinculoPrincipal(
  vinculos: readonly VinculoApi[],
): VinculoApi | null {
  const ordenados = [...vinculos].sort(
    (a, b) =>
      ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] ||
      Date.parse(b.dataAdmissao) - Date.parse(a.dataAdmissao) ||
      compararMatriculas(a.matricula, b.matricula),
  );
  return ordenados[0] ?? null;
}
