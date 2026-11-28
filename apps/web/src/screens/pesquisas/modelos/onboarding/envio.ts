/**
 * T216 — Onboarding (tela): o que o assistente e os resultados precisam
 * além do catálogo (`catalogo.ts`, 17 perguntas em 8 blocos): os 7 tipos de
 * pergunta do onboarding (concordância e satisfação de 4 pontos, sem
 * meio-termo; escolha única; múltipla escolha; nota de 0 a 10; resposta
 * curta; parágrafo), as faixas do índice (0–100), as rodadas (30, 60 e 90
 * dias), horários, prazos e lembretes. As perguntas com papel no resultado
 * são achadas pela chave (`q12`…`q17`).
 */
import type { Pergunta, Secao } from "../../../../api/pesquisasClient";
import type { StatusVariant } from "../../../../components";
import { secoesDoModelo } from "../../modelosDePesquisa";
import { minutosDaPesquisa } from "../../tempoEstimado";
import { novoId } from "../../textosDasPesquisas";
import { ONBOARDING, ROTULOS_DAS_INTENCOES } from "./catalogo";

export const TIPOS_DO_ONBOARDING = [
  {
    valor: "concord4",
    rotulo: "Concordância · 4 pontos",
    ajuda:
      "Escala de 4 pontos, sem meio-termo: a pessoa precisa pender para um lado.",
  },
  {
    valor: "satisf4",
    rotulo: "Satisfação · 4 pontos",
    ajuda: "De muito insatisfeito a muito satisfeito, sem meio-termo.",
  },
  {
    valor: "unica",
    rotulo: "Escolha única",
    ajuda: "A pessoa marca uma opção (com “Outro”, se quiser).",
  },
  {
    valor: "multi",
    rotulo: "Múltipla escolha",
    ajuda: "A pessoa marca quantas opções quiser.",
  },
  {
    valor: "nota",
    rotulo: "Nota de 0 a 10",
    ajuda: "De 0 (nada provável) a 10 (muito provável).",
  },
  { valor: "curta", rotulo: "Resposta curta", ajuda: "Uma linha de texto." },
  {
    valor: "paragrafo",
    rotulo: "Parágrafo",
    ajuda: "Texto livre, em várias linhas.",
  },
] as const;
export type TipoDoOnboarding = (typeof TIPOS_DO_ONBOARDING)[number]["valor"];

/** O tipo do onboarding de uma pergunta gravada. */
export function tipoDaPergunta(p: Pergunta): TipoDoOnboarding {
  switch (p.tipo) {
    case "concordancia_4":
      return "concord4";
    case "satisfacao_4":
      return "satisf4";
    case "escolha_unica":
      return "unica";
    case "multipla_escolha":
      return "multi";
    case "nota_0_10":
      return "nota";
    case "paragrafo":
      return "paragrafo";
    default:
      return "curta";
  }
}

/** Troca o tipo de uma pergunta (mantém o texto, o id e a obrigatoriedade). */
export function comTipo(p: Pergunta, tipo: TipoDoOnboarding): Pergunta {
  const opcoes = p.config.opcoes?.length
    ? p.config.opcoes
    : [
        { id: novoId(), texto: "Opção 1" },
        { id: novoId(), texto: "Opção 2" },
      ];
  const base = { ...p, condicao: null };
  switch (tipo) {
    case "concord4":
      return { ...base, tipo: "concordancia_4", config: {} };
    case "satisf4":
      return { ...base, tipo: "satisfacao_4", config: {} };
    case "unica":
      return {
        ...base,
        tipo: "escolha_unica",
        config: { opcoes, outro: p.config.outro ?? false },
      };
    case "multi":
      return {
        ...base,
        tipo: "multipla_escolha",
        config: { opcoes, outro: p.config.outro ?? false },
      };
    case "nota":
      return { ...base, tipo: "nota_0_10", config: { enps: true } };
    case "paragrafo":
      return { ...base, tipo: "paragrafo", config: {} };
    case "curta":
      return { ...base, tipo: "texto_curto", config: {} };
  }
}

/** As seções do onboarding (catálogo da galeria, com ids novos). */
export function secoesDoOnboarding(): Secao[] {
  return secoesDoModelo(ONBOARDING);
}

export const TOTAL_DE_PERGUNTAS = ONBOARDING.secoes.reduce(
  (t, s) => t + s.perguntas.length,
  0,
);

/** Rótulos curtos da intenção (q13), na ordem das opções. */
export const ROTULOS_DA_INTENCAO = ROTULOS_DAS_INTENCOES;

/** A pergunta de um papel do resultado, pela chave (ou pelo id). */
export function perguntaDaChave(
  secoes: readonly Secao[],
  chave: string,
): Pergunta | null {
  for (const s of secoes) {
    const p = s.perguntas.find((x) => (x.chave ?? x.id) === chave);
    if (p) return p;
  }
  return null;
}

/** Os minutos do Onboarding no mapa único (`tempoEstimado.ts`). */
export function minutosDoOnboarding(perguntas: number): number {
  return minutosDaPesquisa("onboarding", perguntas);
}

export type Faixa = "critico" | "atencao" | "saudavel" | "forte";

export const FAIXAS: Readonly<
  Record<Faixa, { rotulo: string; faixa: string; tom: StatusVariant }>
> = {
  critico: { rotulo: "Crítico", faixa: "abaixo de 50", tom: "danger" },
  atencao: { rotulo: "Atenção", faixa: "50 a 69", tom: "warning" },
  saudavel: { rotulo: "Saudável", faixa: "70 a 84", tom: "success" },
  forte: { rotulo: "Forte", faixa: "85 ou mais", tom: "success" },
};

export const RODADAS = [
  {
    valor: 30,
    titulo: "30 dias após a admissão",
    selo: "Recomendado",
    texto: "Primeiras impressões: chegada, treinamento e liderança",
  },
  {
    valor: 60,
    titulo: "60 dias após a admissão",
    selo: "Recomendado",
    texto: "As mesmas perguntas, para ver o que mudou desde os 30 dias",
  },
  {
    valor: 90,
    titulo: "90 dias após a admissão",
    selo: "Opcional",
    texto: "Fim do contrato de experiência",
  },
] as const;
export type RodadaAutomatica = (typeof RODADAS)[number]["valor"];

export function rotuloDaRodada(r: number): string {
  return r === 0 ? "Envio único" : `${r} dias`;
}

/** Horários de envio: 06:00 a 21:00, de 30 em 30 minutos. */
export const HORARIOS: readonly string[] = Array.from(
  { length: 31 },
  (_, i) => {
    const m = 6 * 60 + i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  },
);

export const PRAZOS = [3, 5, 7, 10, 15] as const;
export const LEMBRETES = [2, 3, 5] as const;

/** O texto de cada opção das perguntas (pelo id da opção). */
export function textosDasOpcoes(
  secoes: readonly Secao[],
): ReadonlyMap<string, string> {
  const m = new Map<string, string>();
  for (const s of secoes)
    for (const p of s.perguntas)
      for (const o of p.config.opcoes ?? []) m.set(o.id, o.texto);
  return m;
}

/** O rótulo curto da intenção de ficar (q13), na ordem das opções. */
export function rotuloDaIntencao(
  secoes: readonly Secao[],
  opcaoId: string,
): string {
  const q13 = perguntaDaChave(secoes, "q13");
  const i = q13?.config.opcoes?.findIndex((o) => o.id === opcaoId) ?? -1;
  return i >= 0 && i < ROTULOS_DA_INTENCAO.length
    ? ROTULOS_DA_INTENCAO[i]!
    : (textosDasOpcoes(secoes).get(opcaoId) ?? "");
}
