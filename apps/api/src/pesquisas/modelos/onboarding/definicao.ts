import type { Pergunta, Secao } from "../../pesquisas.types";

/**
 * T216 — Onboarding: o que a API precisa saber do questionário (17 perguntas
 * em 8 blocos; o texto é montado pela tela e pode ser editado). Os blocos são
 * as seções (`b1`…`b8`) e algumas perguntas têm um papel fixo no resultado,
 * pelo id: o motivo para ficar, a intenção nos próximos 6 meses, o contato
 * com o RH, a recomendação (0–10) e as duas abertas do fim.
 */

export const RODADAS_AUTOMATICAS = [30, 60, 90] as const;
export type RodadaAutomatica = (typeof RODADAS_AUTOMATICAS)[number];
/** 0 = envio único (agora ou agendado). */
export type Rodada = 0 | RodadaAutomatica;

export const BLOCOS = [
  { id: "b1", titulo: "Onboarding e treinamento" },
  { id: "b2", titulo: "Liderança" },
  { id: "b3", titulo: "Colegas" },
  { id: "b4", titulo: "Remuneração" },
  { id: "b5", titulo: "Ferramentas e feedback" },
  { id: "b6", titulo: "Rotina e crescimento" },
  { id: "b7", titulo: "Motivação e permanência" },
  { id: "b8", titulo: "Para fechar" },
] as const;

export const PAPEIS = {
  motivo: "q12",
  intencao: "q13",
  contato: "q14",
  recomendacao: "q15",
  melhorar: "q16",
  gosta: "q17",
} as const;

export type Papel = keyof typeof PAPEIS;

/** As 4 frases da intenção (q13), da mais à menos favorável a ficar. */
export const ROTULOS_DA_INTENCAO = [
  "Quer ficar",
  "Fica, mas pensa em opções",
  "Considera sair",
  "Buscando outro lugar",
] as const;

export const CONCORDANCIA_4 = [
  "Discordo totalmente",
  "Discordo parcialmente",
  "Concordo parcialmente",
  "Concordo totalmente",
] as const;

export const SATISFACAO_4 = [
  "Muito insatisfeito",
  "Insatisfeito",
  "Satisfeito",
  "Muito satisfeito",
] as const;

/**
 * Uma pergunta de 4 pontos (concordância ou satisfação, sem meio-termo),
 * que entra no índice: os tipos de 4 pontos ou uma escala de 1 a 4.
 */
export function ehItemDe4Pontos(p: Pergunta): boolean {
  if (p.tipo === "concordancia_4" || p.tipo === "satisfacao_4") return true;
  return (
    p.tipo === "escala" &&
    (p.config.minimo ?? 1) === 1 &&
    (p.config.maximo ?? 5) === 4
  );
}

/**
 * A pergunta de um papel, se ainda existir na estrutura: pela chave do item
 * do modelo (`Pergunta.chave`) ou, sem chave, pelo id.
 */
export function perguntaDoPapel(
  secoes: readonly Secao[],
  papel: Papel,
): Pergunta | null {
  const chave = PAPEIS[papel];
  for (const s of secoes) {
    const p = s.perguntas.find((x) => (x.chave ?? x.id) === chave);
    if (p) return p;
  }
  return null;
}
