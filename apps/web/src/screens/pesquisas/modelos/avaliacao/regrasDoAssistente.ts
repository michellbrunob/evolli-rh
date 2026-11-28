/**
 * T216 — Avaliação 90°/180°: as regras puras do assistente (times a partir
 * do organograma, contagens, validações de nome e prazos, textos do resumo).
 */
import { plural } from "../../../../format/plural";
import type {
  Lembrete,
  Organograma,
  PessoaResumida,
  TimeInformado,
} from "./cliente";
import type { ModeloDeAvaliacao } from "./catalogo";

export interface TimeNoAssistente {
  gestor: PessoaResumida;
  pessoas: PessoaResumida[];
  incluido: boolean;
}

/** Os times iniciais: os do organograma, todos incluídos. */
export function timesDoOrganograma(o: Organograma): TimeNoAssistente[] {
  return o.times.map((t) => ({
    gestor: t.gestor,
    pessoas: [...t.pessoas],
    incluido: true,
  }));
}

/** Quem já está em algum time (como pessoa avaliada). */
export function emAlgumTime(times: readonly TimeNoAssistente[]): Set<string> {
  return new Set(times.flatMap((t) => t.pessoas.map((p) => p.id)));
}

/**
 * Quem pode entrar no time de um gestor: ativos que ainda não estão em
 * nenhum time e que não são o próprio gestor (ninguém se avalia na 90°).
 */
export function candidatosAoTime(
  ativos: readonly PessoaResumida[],
  times: readonly TimeNoAssistente[],
  gestorId: string,
): PessoaResumida[] {
  const ja = emAlgumTime(times);
  return ativos.filter((p) => p.id !== gestorId && !ja.has(p.id));
}

/** Os times que vão para a API: só os incluídos e com pessoa. */
export function timesParaEnviar(
  times: readonly TimeNoAssistente[],
): TimeInformado[] {
  return times
    .filter((t) => t.incluido && t.pessoas.length > 0)
    .map((t) => ({
      gestorId: t.gestor.id,
      avaliadoIds: t.pessoas.map((p) => p.id),
    }));
}

export interface Contagem {
  gestores: number;
  pessoas: number;
  autoavaliacoes: number;
  pessoasSemCpf: number;
  gestoresComEmail: number;
  pessoasComEmail: number;
}

export function contar(
  modelo: ModeloDeAvaliacao,
  times: readonly TimeNoAssistente[],
): Contagem {
  const validos = times.filter((t) => t.incluido && t.pessoas.length > 0);
  const pessoas = validos.flatMap((t) => t.pessoas);
  const auto = modelo === "avaliacao180" ? pessoas.filter((p) => p.identificavel) : [];
  return {
    gestores: validos.length,
    pessoas: pessoas.length,
    autoavaliacoes: auto.length,
    pessoasSemCpf: modelo === "avaliacao180" ? pessoas.length - auto.length : 0,
    gestoresComEmail: validos.filter((t) => t.gestor.temEmail).length,
    pessoasComEmail: auto.filter((p) => p.temEmail).length,
  };
}

/** "1 gestor · 3 pessoas" (+ "· 2 autoavaliações" na 180°). */
export function textoDaContagem(
  modelo: ModeloDeAvaliacao,
  c: Contagem,
): string {
  const partes = [
    plural(c.gestores, "gestor", "gestores"),
    plural(c.pessoas, "pessoa", "pessoas"),
  ];
  if (modelo === "avaliacao180") {
    partes.push(plural(c.autoavaliacoes, "autoavaliação", "autoavaliações"));
  }
  return partes.join(" · ");
}

export function erroDoNome(nome: string): string | null {
  const n = nome.trim();
  if (!n) return "Dê um nome para a avaliação.";
  if (n.length > 120) return "Use até 120 caracteres.";
  return null;
}

/** `AAAA-MM-DD` + `HH:mm` (Brasília) → instante. */
export function instante(dia: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^\d{2}:\d{2}$/.test(hora)) {
    return null;
  }
  const d = new Date(`${dia}T${hora}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const UMA_HORA = 60 * 60 * 1000;

export function erroDoPrazo(
  dia: string,
  hora: string,
  agora: Date,
): string | null {
  const d = instante(dia, hora);
  if (!d) return "Escolha a data e o horário do prazo.";
  if (d.getTime() < agora.getTime() + UMA_HORA) {
    return "O prazo precisa ser pelo menos 1 hora a partir de agora.";
  }
  return null;
}

export function erroDoPrazoDaAutoavaliacao(
  dia: string,
  hora: string,
  prazoDoGestor: Date | null,
  agora: Date,
): string | null {
  const d = instante(dia, hora);
  if (!d) return "Escolha a data e o horário da autoavaliação.";
  if (d.getTime() < agora.getTime() + UMA_HORA) {
    return "O prazo da autoavaliação precisa ser pelo menos 1 hora a partir de agora.";
  }
  if (prazoDoGestor && d.getTime() >= prazoDoGestor.getTime()) {
    return "O prazo da autoavaliação precisa terminar antes do prazo do gestor.";
  }
  return null;
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dias corridos entre hoje e o dia (para "N dias a partir de hoje"). */
export function diasAte(hoje: string, dia: string): number {
  return Math.round(
    (Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) /
      86_400_000,
  );
}

export function legendaDoPrazo(hoje: string, dia: string): string {
  const n = diasAte(hoje, dia);
  if (n === 0) return "Hoje";
  if (n < 0) return "Data no passado";
  return `${plural(n, "dia", "dias")} a partir de hoje`;
}

/** "DD/MM". */
export function diaMes(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export const ROTULO_DO_LEMBRETE: Readonly<Record<Lembrete, string>> = {
  "7_dias": "7 dias antes",
  "3_dias": "3 dias antes",
  no_dia: "No dia do prazo",
  depois: "Depois do prazo",
};

/** "lembretes 7 e 3 dias antes, no dia e depois do prazo" / "sem lembretes". */
export function textoDosLembretes(lembretes: readonly Lembrete[]): string {
  if (lembretes.length === 0) return "sem lembretes";
  const partes: string[] = [];
  const antes = (["7_dias", "3_dias"] as const)
    .filter((l) => lembretes.includes(l))
    .map((l) => (l === "7_dias" ? "7" : "3"));
  if (antes.length) partes.push(`${antes.join(" e ")} dias antes`);
  if (lembretes.includes("no_dia")) partes.push("no dia");
  if (lembretes.includes("depois")) partes.push("depois do prazo");
  const ultimo = partes.pop()!;
  const texto = partes.length ? `${partes.join(", ")} e ${ultimo}` : ultimo;
  return `${lembretes.length === 1 ? "lembrete" : "lembretes"} ${texto}`;
}
