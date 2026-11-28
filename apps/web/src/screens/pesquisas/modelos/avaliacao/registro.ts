/**
 * T216 — o registro da Avaliação 90° e da 180° (o que a galeria, a página
 * "Sobre o modelo", o assistente, os resultados, a página pública e a ficha
 * precisam saber). A galeria lê `definicao` de `modelos/<id>/definicao.ts`.
 */
import type { ModeloDeAvaliacao } from "./catalogo";
import { secoesDaAvaliacao } from "./catalogo";
import { AssistenteDaAvaliacao } from "./AssistenteDaAvaliacao";
import { ResultadosDaAvaliacao } from "./ResultadosDaAvaliacao";
import { ResponderAvaliacao } from "./ResponderAvaliacao";
import { AvaliacoesDaFicha } from "./AvaliacoesDaFicha";

export interface DefinicaoDaAvaliacao {
  readonly id: ModeloDeAvaliacao;
  readonly modelo: ModeloDeAvaliacao;
  readonly nome: string;
  readonly categoria: "desempenho";
  readonly descricao: string;
  /** Token de cor do ícone (sem `var()`). */
  readonly cor: string;
  readonly selo: "novo";
  /** Fatos do card ("24 perguntas", "8 competências"). */
  readonly destaques: readonly string[];
  readonly totalDePerguntas: 24;
  /** A identificação é sempre nominal (por CPF). */
  readonly identificacao: "identificada";
  readonly sobre: {
    readonly titulo: string;
    readonly texto: string;
    readonly metadados: readonly string[];
    readonly recebe: readonly { titulo: string; texto: string }[];
    readonly comoFunciona: readonly string[];
    readonly fichaTecnica: readonly (readonly [string, string])[];
    readonly usoRecomendado: string;
  };
  readonly secoes: typeof secoesDaAvaliacao;
  readonly Assistente: typeof AssistenteDaAvaliacao;
  readonly Resultados: typeof ResultadosDaAvaliacao;
  readonly Responder: typeof ResponderAvaliacao;
  readonly Ficha: typeof AvaliacoesDaFicha;
}

const comum = {
  categoria: "desempenho" as const,
  selo: "novo" as const,
  totalDePerguntas: 24 as const,
  identificacao: "identificada" as const,
  secoes: secoesDaAvaliacao,
  Assistente: AssistenteDaAvaliacao,
  Resultados: ResultadosDaAvaliacao,
  Responder: ResponderAvaliacao,
  Ficha: AvaliacoesDaFicha,
};

export const AVALIACAO_90: DefinicaoDaAvaliacao = {
  ...comum,
  id: "avaliacao90",
  modelo: "avaliacao90",
  nome: "Avaliação 90°",
  descricao: "O gestor direto avalia cada pessoa do time em 8 competências.",
  cor: "--turno-verde",
  destaques: ["24 perguntas", "8 competências"],
  sobre: {
    titulo: "Avaliação 90° · Avaliação de desempenho",
    texto:
      "O gestor direto avalia cada pessoa do time em 8 competências. Você vê os destaques, o que desenvolver e se os gestores avaliam com o mesmo critério.",
    metadados: [
      "3 a 4 min por pessoa",
      "Nominal: só o RH vê as notas",
      "Sugestão: a cada 6 meses",
    ],
    recebe: [
      {
        titulo: "Nota por pessoa e por competência",
        texto: "De 1 a 5, em 5 níveis, de Insuficiente a Excepcional.",
      },
      {
        titulo: "Mapa de talentos",
        texto: "Entrega × Pessoas: quem é referência e quem precisa de apoio.",
      },
      {
        titulo: "O que desenvolver",
        texto:
          "As competências abaixo de 3 de cada pessoa, para o plano com o RH.",
      },
    ],
    comoFunciona: [
      "Você escolhe quem avalia: gestores e times vêm da liderança cadastrada; dá para mover pessoas e definir o prazo.",
      "Cada gestor avalia o time pelo link, com CPF: uma pessoa por vez, 24 afirmações de 1 a 5.",
      "Você vê o resultado: nota por pessoa e competência, mapa de talentos e calibração entre gestores.",
      "Feedback e plano: a conversa com cada pessoa parte do que ela precisa desenvolver.",
    ],
    fichaTecnica: [
      ["Quem avalia", "Gestor direto"],
      ["Formato", "24 afirmações de 1 a 5"],
      ["Tempo", "3 a 4 min por pessoa"],
      ["Identificação", "Nominal, por CPF"],
      ["Quem vê", "RH e quem edita a avaliação"],
      ["Resultado", "Por pessoa, gestor e time"],
    ],
    usoRecomendado:
      "A nota é a percepção de um gestor: nunca use como critério único para promover ou desligar.",
  },
};

export const AVALIACAO_180: DefinicaoDaAvaliacao = {
  ...comum,
  id: "avaliacao180",
  modelo: "avaliacao180",
  nome: "Avaliação 180°",
  descricao:
    "O gestor avalia e cada pessoa faz a autoavaliação nas mesmas 8 competências; mostra onde as visões divergem.",
  cor: "--turno-azul",
  destaques: ["24 perguntas", "Gestor + autoavaliação"],
  sobre: {
    titulo: "Avaliação 180° · Gestor e autoavaliação",
    texto:
      "O gestor avalia e cada pessoa se avalia nas mesmas 8 competências. Você vê onde as visões se encontram, onde divergem e o que levar para o feedback.",
    metadados: [
      "3 a 4 min por avaliação",
      "Nominal: o gestor só vê a autoavaliação depois de enviar a dele",
      "Sugestão: a cada 6 meses",
    ],
    recebe: [
      {
        titulo: "Gestor × autoavaliação",
        texto:
          "As duas notas lado a lado em cada competência, com a diferença.",
      },
      {
        titulo: "Mapa da conversa",
        texto: "Forças confirmadas, pontos cegos e forças que a pessoa não vê.",
      },
      {
        titulo: "Roteiro de feedback",
        texto: "A ordem da conversa com cada pessoa.",
      },
    ],
    comoFunciona: [
      "Você escolhe quem avalia: gestores e times vêm da liderança cadastrada; dá para mover pessoas e definir prazos.",
      "Gestor e pessoa respondem pelo mesmo link: o gestor avalia o time e cada pessoa se avalia nas mesmas 24 afirmações, na 1ª pessoa.",
      "Você vê as duas visões por pessoa, competência e gestor.",
      "Conversa de feedback com o roteiro de cada pessoa.",
    ],
    fichaTecnica: [
      ["Quem avalia", "Gestor direto e a própria pessoa"],
      ["Formato", "24 afirmações de 1 a 5, nos dois lados"],
      ["Tempo", "3 a 4 min por avaliação"],
      ["Identificação", "Nominal, por CPF"],
      ["Quem vê", "RH; gestor depois de enviar; pessoa se liberar"],
      ["Resultado", "Comparativo por pessoa, gestor e time"],
    ],
    usoRecomendado:
      "A diferença é ponto de partida para a conversa, não veredito.",
  },
};
