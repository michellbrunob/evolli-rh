/**
 * T216 — Avaliação 180° (gestor + autoavaliação): card, gaveta e página
 * "Sobre o modelo". As 24 afirmações (as mesmas do 90°, na 1ª pessoa para a
 * autoavaliação), o assistente e o cálculo ficam com a frente das
 * avaliações: ela preenche `secoes` e tira `grupos`.
 */
import {
  BLOCO_DAS_COMPETENCIAS,
  GRUPOS_DAS_COMPETENCIAS,
  REGUA_DAS_AVALIACOES,
} from "../avaliacao90/catalogo";
import type { ModeloDaGaleria } from "../tipos";

export const AVALIACAO_180: ModeloDaGaleria = {
  id: "avaliacao180",
  modelo: "avaliacao180",
  nome: "Avaliação 180°",
  categoria: "desempenho",
  icone: "avaliacao180",
  tom: "celeste",
  selo: "novo",
  descricao:
    "O gestor avalia e cada pessoa faz a autoavaliação nas mesmas 8 competências; mostra onde as visões divergem.",
  fatos: [
    { icone: "perguntas", texto: "24 perguntas" },
    { icone: "duas_pessoas", texto: "Gestor + autoavaliação" },
  ],
  ritmo: "Desempenho · semestral",
  frequencia: "A cada 6 meses",
  sobre:
    "Gestor e pessoa respondem as mesmas 8 competências; o resultado mostra onde as visões se encontram e onde se afastam.",
  nomeBase: "Avaliação 180°",
  boasVindas: null,
  secoes: [],
  grupos: GRUPOS_DAS_COMPETENCIAS,
  comentarioFinal: null,
  perguntaPadrao: { tipo: "escala", config: { minimo: 1, maximo: 5 } },
  limite: 24,
  fixo: true,
  pagina: {
    titulo: "Avaliação 180° · Gestor e autoavaliação",
    selo: "24 afirmações",
    texto:
      "O gestor avalia e cada pessoa se avalia nas mesmas 8 competências. O resultado mostra onde as duas visões se encontram, onde divergem e o que levar para a conversa de feedback.",
    metadados: [
      "3 a 4 minutos por avaliação",
      "Nominal: o gestor só vê a autoavaliação depois de enviar a dele",
      "Sugestão: a cada 6 meses",
    ],
    botaoVer: "Ver as 24 afirmações",
    botaoCriar: "Criar avaliação",
    recebe: {
      titulo: "As duas visões lado a lado",
      itens: [
        {
          titulo: "Gestor × autoavaliação",
          texto: "As duas notas em cada competência, com a diferença.",
        },
        {
          titulo: "Mapa da conversa",
          texto:
            "Forças confirmadas, pontos cegos e forças que a pessoa não vê.",
        },
        {
          titulo: "Roteiro de feedback",
          texto: "A ordem da conversa e um plano, revisado pelo RH.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 26 avaliações completas",
        halteres: [
          { rotulo: "Liderança", a: 3.2, b: 3.7 },
          { rotulo: "Comunicação", a: 3.5, b: 3.9 },
          { rotulo: "Organização", a: 3.8, b: 4.0 },
          { rotulo: "Responsabilidade", a: 4.2, b: 4.1 },
        ],
        rodape: "12 pessoas se veem acima · 10 alinhadas · 4 abaixo",
      },
    },
    conteudo: [
      {
        tipo: "passos",
        titulo: "Como funciona",
        itens: [
          {
            rotulo: "1",
            titulo: "Você escolhe quem avalia",
            texto:
              "Gestores e times vêm do organograma; dá para mover pessoas e definir o prazo.",
          },
          {
            rotulo: "2",
            titulo: "Gestor e pessoa respondem",
            texto:
              "O gestor avalia o time; cada pessoa se avalia nas mesmas 24 afirmações, na 1ª pessoa.",
          },
          {
            rotulo: "3",
            titulo: "Você vê as duas visões",
            texto: "Por pessoa, competência e gestor.",
          },
          {
            rotulo: "4",
            titulo: "Conversa de feedback",
            texto:
              "Um roteiro por pessoa; o RH pode liberar o comparativo no Portal.",
          },
        ],
      },
      BLOCO_DAS_COMPETENCIAS,
    ],
    ficha: [
      ["Quem avalia", "Gestor direto e a própria pessoa"],
      ["Formato", "24 afirmações de 1 a 5, nos dois lados"],
      ["Tempo", "3 a 4 minutos por avaliação"],
      ["Identificação", "Nominal, por CPF"],
      ["Quem vê", "O RH; o gestor depois de enviar; a pessoa se liberado"],
      ["Resultado", "Comparativo por pessoa, gestor e time"],
    ],
    regua: REGUA_DAS_AVALIACOES,
    uso: "A diferença entre as visões é o ponto de partida da conversa, não um veredito.",
  },
};
