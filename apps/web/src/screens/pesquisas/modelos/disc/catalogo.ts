/**
 * T216 — Perfil comportamental (DISC): card, gaveta e página "Sobre o
 * modelo", com os 28 blocos de escolha forçada (`blocos.ts`, textos do
 * Evolli): cada bloco é um item fixo (`Pergunta.chave` `disc_01`…`disc_28`)
 * com 4 frases, uma por fator.
 */
import type { ModeloDaGaleria } from "../tipos";
import { BLOCOS_DISC, PERGUNTA_DO_BLOCO, chaveDoBloco } from "./blocos";
import { tempoParaResponder } from "../../tempoEstimado";

export const FATORES_DISC = [
  {
    letra: "D",
    titulo: "Dominância",
    cor: "--faixa-critico",
    foco: "Foco em resultados e desafios",
    chips: ["Decide rápido", "Foco em resultado", "Assume desafios"],
  },
  {
    letra: "I",
    titulo: "Influência",
    cor: "--faixa-atencao",
    foco: "Foco em pessoas e entusiasmo",
    chips: [
      "Comunicação envolvente",
      "Cria relações com facilidade",
      "Otimismo",
    ],
  },
  {
    letra: "S",
    titulo: "Estabilidade",
    cor: "--faixa-forte",
    foco: "Foco em constância e cooperação",
    chips: ["Escuta com atenção", "Dá constância às entregas", "Apoia o time"],
  },
  {
    letra: "C",
    titulo: "Conformidade",
    cor: "--grafico-1",
    foco: "Foco em qualidade e precisão",
    chips: ["Atenção a detalhes", "Decide com dados", "Segue critérios"],
  },
] as const;

export const PERFIL_COMPORTAMENTAL: ModeloDaGaleria = {
  id: "disc",
  modelo: "disc",
  nome: "Perfil comportamental (DISC)",
  categoria: "outros",
  icone: "perfil",
  tom: "ambar",
  descricao:
    "Como cada pessoa age, se comunica e decide, para montar times, dar feedback e desenvolver.",
  fatos: [
    { icone: "perguntas", texto: "28 perguntas" },
    { icone: "perfis", texto: "4 perfis" },
  ],
  ritmo: "Perfil · quando precisar",
  frequencia: "Na entrada e a cada ano",
  sobre:
    "28 blocos de 4 frases; em cada um, a pessoa escolhe a que mais combina com ela. O resultado é o % de cada fator.",
  nomeBase: "Perfil comportamental",
  boasVindas:
    "Em cada bloco, escolha a frase que mais combina com você. Não há resposta certa: responda pelo que você faz no dia a dia.",
  secoes: [
    {
      titulo: "Blocos de frases",
      cor: "--modelo-ambar",
      perguntas: BLOCOS_DISC.map((b, i) => ({
        chave: chaveDoBloco(i),
        tipo: "escolha_forcada" as const,
        texto: PERGUNTA_DO_BLOCO,
        rotulo: b.tema,
        obrigatoria: true,
        opcoes: b.frases.map((texto, j) => ({
          texto,
          fator: (["D", "I", "S", "C"] as const)[j]!,
        })),
      })),
    },
  ],
  comentarioFinal: null,
  perguntaPadrao: { tipo: "escolha_forcada", config: {} },
  limite: 28,
  fixo: true,
  pagina: {
    titulo: "DISC · Perfil comportamental",
    selo: "28 blocos",
    texto:
      "Mostra como cada pessoa age, se comunica e decide. Ajuda a montar times, dar feedback e planos de desenvolvimento.",
    metadados: [
      `${tempoParaResponder("disc", BLOCOS_DISC.length)} para responder`,
      "CPF, confidencial ou anônima",
      "Resultado individual e do time",
    ],
    botaoVer: "Ver os 28 blocos",
    botaoCriar: "Criar pesquisa",
    recebe: {
      titulo: "O perfil de cada pessoa e um retrato do time",
      itens: [
        {
          titulo: "Perfil individual",
          texto: "O fator predominante, as forças e os pontos de atenção.",
        },
        {
          titulo: "Mapa do time",
          texto: "A distribuição dos perfis e a diversidade do time.",
        },
        {
          titulo: "Leitura do perfil",
          texto: "Recomendações para a liderança conduzir cada pessoa.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 38 respostas",
        cartoes: [
          {
            titulo: "D Dominância",
            valor: "6",
            texto: "pessoas",
            cor: "--faixa-critico",
          },
          {
            titulo: "I Influência",
            valor: "15",
            texto: "pessoas",
            cor: "--faixa-atencao",
          },
          {
            titulo: "S Estabilidade",
            valor: "11",
            texto: "pessoas",
            cor: "--faixa-forte",
          },
          {
            titulo: "C Conformidade",
            valor: "6",
            texto: "pessoas",
            cor: "--grafico-1",
          },
        ],
      },
    },
    conteudo: [
      {
        tipo: "grupos",
        titulo: "Os 4 fatores",
        descricao:
          "Todo mundo tem os 4; o que muda é a intensidade de cada um.",
        itens: FATORES_DISC.map((f) => ({
          numero: f.letra,
          titulo: f.titulo,
          subtitulo: f.foco,
          cor: f.cor,
          chips: f.chips.map((texto) => ({ texto, cor: f.cor })),
        })),
      },
      {
        tipo: "texto",
        titulo: "Como a pessoa responde",
        paragrafos: [
          "Em cada bloco, escolhe a frase que mais combina com ela. São 28 blocos de 4 frases.",
        ],
      },
    ],
    ficha: [
      ["Formato", "28 blocos de 4 frases"],
      ["Tempo", tempoParaResponder("disc", BLOCOS_DISC.length)],
      ["Resultado", "% de D, I, S e C"],
      ["Identificação", "3 opções"],
    ],
    uso: "O perfil descreve comportamento, não capacidade. Use para conversa e desenvolvimento, nunca como critério único.",
  },
};
