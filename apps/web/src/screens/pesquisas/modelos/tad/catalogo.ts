/**
 * T216 — Motivação (TAD): 21 afirmações de 1 a 7 em 3 pilares (autonomia,
 * competência e relacionamento), 9 delas invertidas (`8 − resposta`).
 * Metodologia fixa: a ordem mistura os pilares; a gaveta e o assistente
 * agrupam pelo pilar (`agrupamento`).
 */
import { diaPorExtenso } from "../datas";
import type { ModeloDaGaleria, PerguntaDoModelo } from "../tipos";
import { tempoParaResponder } from "../../tempoEstimado";

export const ROTULOS_TAD = [
  "Nada verdadeiro",
  "Quase nunca verdadeiro",
  "Raramente verdadeiro",
  "Neutro",
  "Frequentemente verdadeiro",
  "Quase sempre verdadeiro",
  "Totalmente verdadeiro",
] as const;

export const PILARES_TAD = [
  {
    chave: "autonomia",
    rotulo: "Autonomia",
    letra: "A",
    cor: "--modelo-roxo",
    texto: "Liberdade para decidir e agir no trabalho.",
  },
  {
    chave: "competencia",
    rotulo: "Competência",
    letra: "C",
    cor: "--modelo-esmeralda",
    texto: "Sensação de evolução e de ser capaz.",
  },
  {
    chave: "relacionamento",
    rotulo: "Relacionamento",
    letra: "R",
    cor: "--modelo-azul",
    texto: "Conexão e vínculo com o time.",
  },
] as const;

type Pilar = (typeof PILARES_TAD)[number]["chave"];

/** As 21 afirmações na ordem: pilar, invertida e o texto. */
export const ITENS_TAD: readonly {
  chave: string;
  pilar: Pilar;
  invertido: boolean;
  texto: string;
}[] = (
  [
    [
      "autonomia",
      false,
      "Posso opinar nas decisões sobre como o meu trabalho é feito.",
    ],
    ["relacionamento", false, "Gosto das pessoas com quem trabalho."],
    ["competencia", true, "Muitas vezes não me sinto competente no trabalho."],
    [
      "competencia",
      false,
      "As pessoas do trabalho dizem que eu sou bom no que faço.",
    ],
    ["autonomia", true, "Eu me sinto pressionado no trabalho."],
    ["relacionamento", false, "Eu me dou bem com as pessoas do trabalho."],
    [
      "relacionamento",
      true,
      "No trabalho, fico mais na minha e me relaciono pouco.",
    ],
    ["autonomia", false, "Sinto-me livre para dizer o que penso no trabalho."],
    [
      "relacionamento",
      false,
      "Considero os meus colegas de trabalho meus amigos.",
    ],
    [
      "competencia",
      false,
      "Tenho aprendido coisas novas e interessantes no trabalho.",
    ],
    ["autonomia", true, "No trabalho, preciso fazer o que me mandam."],
    [
      "competencia",
      false,
      "Quase sempre sinto que realizo algo com o meu trabalho.",
    ],
    ["autonomia", false, "O que eu sinto é levado em conta no trabalho."],
    [
      "competencia",
      true,
      "No trabalho, tenho poucas chances de mostrar do que sou capaz.",
    ],
    ["relacionamento", false, "As pessoas do trabalho se importam comigo."],
    ["relacionamento", true, "Tenho poucas pessoas próximas no trabalho."],
    ["autonomia", false, "No trabalho, posso ser eu mesmo."],
    [
      "relacionamento",
      true,
      "As pessoas do trabalho não parecem gostar muito de mim.",
    ],
    ["competencia", true, "Com frequência, não me sinto capaz no trabalho."],
    [
      "autonomia",
      true,
      "Tenho pouca chance de decidir como fazer o meu trabalho.",
    ],
    ["relacionamento", false, "As pessoas do trabalho são simpáticas comigo."],
  ] as const
).map(([pilar, invertido, texto], i) => ({
  chave: `tad_${String(i + 1).padStart(2, "0")}`,
  pilar,
  invertido,
  texto,
}));

const pergunta = (i: (typeof ITENS_TAD)[number]): PerguntaDoModelo => ({
  chave: i.chave,
  tipo: "escala",
  rotulo: `${PILARES_TAD.find((p) => p.chave === i.pilar)!.rotulo} ${i.chave.slice(4)}`,
  texto: i.texto,
  config: {
    minimo: 1,
    maximo: 7,
    rotuloMinimo: ROTULOS_TAD[0],
    rotuloMaximo: ROTULOS_TAD[6],
    rotulos: [...ROTULOS_TAD],
  },
  ...(i.invertido ? { selo: "Invertida" } : {}),
});

export const TAD: ModeloDaGaleria = {
  id: "tad",
  modelo: "tad",
  nome: "Motivação (TAD)",
  categoria: "clima",
  icone: "motivacao",
  tom: "roxo",
  descricao:
    "Mede a motivação pela Teoria da Autodeterminação: autonomia, competência e relacionamento.",
  fatos: [
    { icone: "perguntas", texto: "21 perguntas" },
    { icone: "dimensoes", texto: "3 pilares" },
  ],
  ritmo: "Motivação · semestral",
  frequencia: "Semestral",
  sobre:
    "21 afirmações de 1 a 7 em 3 necessidades: autonomia, competência e relacionamento. Mostra o nível de cada uma, por pessoa e no time.",
  nomeBase: "Pesquisa de Motivação",
  nomeDaPesquisa: (hoje) => `Pesquisa de Motivação - ${diaPorExtenso(hoje)}`,
  boasVindas:
    "Responda com calma e sinceridade, pensando no seu trabalho hoje. Não existe resposta certa.",
  secoes: [{ titulo: null, perguntas: ITENS_TAD.map(pergunta) }],
  agrupamento: PILARES_TAD.map((p) => ({
    titulo: p.rotulo,
    cor: p.cor,
    chaves: ITENS_TAD.filter((i) => i.pilar === p.chave).map((i) => i.chave),
  })),
  comentarioFinal: null,
  perguntaPadrao: { tipo: "escala", config: { minimo: 1, maximo: 7 } },
  limite: 21,
  minimo: 21,
  fixo: true,
  legendaDaEscala: [
    "Escala de 1 a 7",
    "1 = Nada verdadeiro · 4 = Neutro · 7 = Totalmente verdadeiro · as invertidas contam 8 − resposta",
  ],
  pagina: {
    titulo: "Motivação (TAD) · As 3 necessidades",
    selo: "21 afirmações",
    texto:
      "Pela Teoria da Autodeterminação, a motivação que vem de dentro depende de 3 necessidades: autonomia, competência e relacionamento. As 21 afirmações, de 1 a 7, mostram quanto cada uma está satisfeita.",
    metadados: [
      `${tempoParaResponder(ITENS_TAD.length)} para responder`,
      "Identificada, CPF confidencial ou anônima",
      "Score de 1 a 7, por pessoa e no time",
    ],
    botaoVer: "Ver as 21 afirmações",
    botaoCriar: "Criar pesquisa",
    recebe: {
      titulo: "O nível de cada necessidade, por pessoa e no time",
      itens: [
        {
          titulo: "Score geral",
          texto: "A média dos 3 pilares, de 1 a 7, com o nível.",
        },
        {
          titulo: "Os 3 pilares",
          texto: "Autonomia, competência e relacionamento.",
        },
        {
          titulo: "Resultado da pessoa",
          texto: "Quem responde vê o próprio resultado.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 18 respostas",
        destaque: {
          valor: "5,04",
          sufixo: "/7",
          texto: "score geral · Moderado",
          cor: "--faixa-atencao",
        },
        barras: [
          {
            rotulo: "Autonomia",
            valor: 5.05,
            maximo: 7,
            texto: "5,05",
            cor: "--modelo-roxo",
          },
          {
            rotulo: "Competência",
            valor: 4.62,
            maximo: 7,
            texto: "4,62",
            cor: "--modelo-esmeralda",
          },
          {
            rotulo: "Relacionamento",
            valor: 5.46,
            maximo: 7,
            texto: "5,46",
            cor: "--modelo-azul",
          },
        ],
      },
    },
    conteudo: [
      {
        tipo: "texto",
        titulo: "O que é a TAD?",
        paragrafos: [
          "A Teoria da Autodeterminação, proposta pelos psicólogos Edward Deci e Richard Ryan, estuda a motivação que vem de dentro: aquela em que a pessoa se envolve com o trabalho porque ele faz sentido, e não só por cobrança ou recompensa.",
          "Segundo a teoria, essa motivação depende de 3 necessidades psicológicas básicas. Autonomia: sentir liberdade para decidir como fazer o próprio trabalho. Competência: sentir que evolui e dá conta do que faz. Relacionamento: sentir conexão e pertencimento com as pessoas ao redor.",
          "O questionário segue a escala de satisfação das necessidades básicas no trabalho (Deci, Ryan, Gagné e colegas, 2001): 21 afirmações de 1 a 7, de “nada verdadeiro” a “totalmente verdadeiro”, 9 delas escritas ao contrário para evitar respostas no automático.",
          "Leituras de referência: Deci e Ryan (2000), sobre a teoria; Van den Broeck e colegas (2010), sobre as necessidades no trabalho; Cordeiro, Paixão, Lens, Lacante e Luyckx (2016), sobre a versão em português.",
        ],
      },
      {
        tipo: "grupos",
        titulo: "Os 3 pilares",
        itens: PILARES_TAD.map((p) => ({
          numero: p.letra,
          titulo: p.rotulo,
          subtitulo: p.texto,
          quantidade: `${ITENS_TAD.filter((i) => i.pilar === p.chave).length} perguntas`,
          cor: p.cor,
        })),
      },
      {
        tipo: "passos",
        titulo: "Como funciona",
        itens: [
          {
            rotulo: "1",
            titulo: "Crie a pesquisa",
            texto:
              "Dê um nome e revise as 21 afirmações, já classificadas por pilar.",
          },
          {
            rotulo: "2",
            titulo: "Envie para o time",
            texto:
              "Escolha quem responde e compartilhe o link. Cada afirmação vai de 1 a 7.",
          },
          {
            rotulo: "3",
            titulo: "Analise",
            texto:
              "Veja o score geral, cada pilar e as necessidades que pedem atenção.",
          },
        ],
      },
      {
        tipo: "texto",
        titulo: "A fórmula",
        paragrafos: [
          "O score de cada pilar é a média das respostas dele, de 1 a 7. Nas afirmações invertidas, a resposta conta como 8 menos o valor marcado.",
          "O score geral é a média dos 3 pilares. O resultado do time é a média dos scores de cada pessoa.",
        ],
      },
    ],
    ficha: [
      ["Perguntas", "21 afirmações, fixas"],
      ["Escala", "1 a 7"],
      ["Invertidas", "9 afirmações"],
      ["Resultado", "Por pessoa e no time"],
    ],
    escalas: [
      {
        titulo: "Escala de 1 a 7",
        texto: ROTULOS_TAD.map((r, i) => `${i + 1} ${r}`).join(" · "),
      },
    ],
    regua: {
      titulo: "A régua",
      faixas: [
        {
          rotulo: "Alto",
          intervalo: "5,5 a 7,0",
          texto: "Necessidade bem satisfeita",
          cor: "--faixa-forte",
        },
        {
          rotulo: "Moderado",
          intervalo: "3,5 a 5,4",
          texto: "Satisfação parcial: vale acompanhar",
          cor: "--faixa-atencao",
        },
        {
          rotulo: "Baixo",
          intervalo: "1,0 a 3,4",
          texto: "Necessidade frustrada: pede ação",
          cor: "--faixa-critico",
        },
      ],
    },
  },
};
