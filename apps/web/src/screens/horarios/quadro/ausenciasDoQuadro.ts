/**
 * T215 — as ausências aprovadas no quadro da escala (Férias e ausências).
 *
 * Como a referência: ausência vence o turno. O dia mostra a ausência (na
 * semana, o tipo e "Aprovada"; no mês, a sigla com a dica do período), não
 * conta como trabalhado e só muda em Férias e ausências. O atalho "De férias
 * ou afastados" pega quem tem qualquer ausência aprovada no período.
 */
import type {
  AusenciaNoQuadroApi,
  PessoaDoQuadroApi,
} from "../../../api/escalaClient";
import { diaMesComZero } from "../../../format/data";
import { ROTULO_DO_TIPO } from "../../pessoas/ferias/tiposAusencia";

/** A ausência aprovada que cobre o dia, ou `null`. */
export function ausenciaDoDia(
  p: PessoaDoQuadroApi,
  dia: string,
): AusenciaNoQuadroApi | null {
  return (
    (p.ausencias ?? []).find(
      (a) => a.inicio <= dia && (a.fim === null || dia <= a.fim),
    ) ?? null
  );
}

export function rotuloDaAusencia(a: AusenciaNoQuadroApi): string {
  return ROTULO_DO_TIPO[a.tipo];
}

/** A letra do mês: a inicial do tipo; day off é "O" (o "D" é do DSR). */
export function siglaDaAusencia(a: AusenciaNoQuadroApi): string {
  if (a.tipo === "day_off") return "O";
  return rotuloDaAusencia(a).charAt(0).toUpperCase();
}

/** A dica do mês: "Falta justificada de 19/11 a 19/11". */
export function tituloDaAusencia(a: AusenciaNoQuadroApi): string {
  const rotulo = rotuloDaAusencia(a);
  return a.fim === null
    ? `${rotulo} desde ${diaMesComZero(a.inicio)}, sem data de volta`
    : `${rotulo} de ${diaMesComZero(a.inicio)} a ${diaMesComZero(a.fim)}`;
}

/** Os dias do período em que a pessoa está ausente. */
export function diasComAusencia(
  p: PessoaDoQuadroApi,
  dias: readonly string[],
): Set<string> {
  return new Set(dias.filter((d) => ausenciaDoDia(p, d) !== null));
}

/** Quem tem alguma ausência aprovada no período. */
export function idsComAusencia(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
): Set<string> {
  return new Set(
    pessoas
      .filter((p) => dias.some((d) => ausenciaDoDia(p, d) !== null))
      .map((p) => p.colaboradorId),
  );
}

/**
 * A linha da coluna de horas: a última ausência do período ("Falta
 * justificada até 19/11"; sem volta, "Afastamento desde 18/11"), ou `null`.
 */
export function resumoDasAusencias(
  p: PessoaDoQuadroApi,
  dias: readonly string[],
): string | null {
  const noPeriodo = (p.ausencias ?? []).filter((a) =>
    dias.some((d) => a.inicio <= d && (a.fim === null || d <= a.fim)),
  );
  const ultima = noPeriodo[noPeriodo.length - 1];
  if (!ultima) return null;
  return ultima.fim === null
    ? `${rotuloDaAusencia(ultima)} desde ${diaMesComZero(ultima.inicio)}`
    : `${rotuloDaAusencia(ultima)} até ${diaMesComZero(ultima.fim)}`;
}
