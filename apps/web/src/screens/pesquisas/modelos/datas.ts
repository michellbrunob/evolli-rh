/** T216 — nomes sugeridos pelos modelos a partir do dia (AAAA-MM-DD). */
import { formatarDiaCivil } from "../../../format/data";

/** "1º semestre 2026" (janeiro a junho) ou "2º semestre 2026". */
export function semestreDe(hoje: string): string {
  const ano = hoje.slice(0, 4);
  const mes = Number(hoje.slice(5, 7));
  return `${mes <= 6 ? "1º" : "2º"} semestre ${ano}`;
}

/** "27/11/2026" (o formatador de datas do sistema). */
export function diaPorExtenso(hoje: string): string {
  return formatarDiaCivil(hoje);
}
