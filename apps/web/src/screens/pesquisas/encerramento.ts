/**
 * T216 — encerramento automático com data e HORA de Brasília. Ligar o
 * interruptor já sugere daqui a 14 dias, às 23:59. A API recebe o instante
 * com o fuso de Brasília (`AAAA-MM-DDTHH:MM:00-03:00`); respostas antigas
 * só com a data (`AAAA-MM-DD`) contam como 23:59 daquele dia.
 */
import { formatarDiaCivil, formatarInstante } from "../../format/data";

export const HORA_PADRAO = "23:59";
export const DIAS_PADRAO = 14;

export interface PartesDoEncerramento {
  readonly data: string;
  readonly hora: string;
}

/** O dia civil `dias` depois de `dia` (`AAAA-MM-DD`). */
export function diasDepois(dia: string, dias: number): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const alvo = new Date(Date.UTC(a, m - 1, d + dias));
  const ano = String(alvo.getUTCFullYear()).padStart(4, "0");
  const mes = String(alvo.getUTCMonth() + 1).padStart(2, "0");
  const diaDoMes = String(alvo.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${diaDoMes}`;
}

/** O que vai para a API. */
export function encerraEmParaApi(partes: PartesDoEncerramento): string {
  return `${partes.data}T${partes.hora}`;
}

/** Data e hora (de Brasília) do valor da API; `null` sem prazo. */
export function partesDoEncerramento(
  valor: string | null | undefined,
): PartesDoEncerramento | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor))
    return { data: valor, hora: HORA_PADRAO };
  const casado = /^(\d{2})\/(\d{2})\/(\d{4}) às (\d{2}:\d{2})$/.exec(
    formatarInstante(valor),
  );
  if (!casado) return null;
  return { data: `${casado[3]}-${casado[2]}-${casado[1]}`, hora: casado[4]! };
}

/** "11/12/2026 às 23:59" (ou "Sem prazo"). */
export function textoDoEncerramento(valor: string | null | undefined): string {
  const partes = partesDoEncerramento(valor);
  return partes
    ? `${formatarDiaCivil(partes.data)} às ${partes.hora}`
    : "Sem prazo";
}
