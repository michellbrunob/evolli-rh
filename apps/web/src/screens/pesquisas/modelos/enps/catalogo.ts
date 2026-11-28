/**
 * T216 — eNPS: a pergunta principal (0 a 10), 5 complementares de 1 a 5 e
 * 2 abertas. Zonas do eNPS: crítica < 0, aperfeiçoamento 0–49, qualidade
 * 50–74, excelência 75–100.
 */
import type { ModeloDaGaleria, PerguntaDoModelo } from "../tipos";

const complementar = (
  chave: string,
  rotulo: string,
  texto: string,
  pontas: [string, string],
): PerguntaDoModelo => ({
  chave,
  tipo: "escala",
  rotulo,
  texto,
  config: {
    minimo: 1,
    maximo: 5,
    rotuloMinimo: pontas[0],
    rotuloMaximo: pontas[1],
  },
});

export const ENPS: ModeloDaGaleria = {
  id: "enps",
  modelo: "enps",
  nome: "eNPS",
  categoria: "clima",
  icone: "enps",
  tom: "teal",
  descricao:
    "Satisfação e lealdade pelo eNPS: quanto as pessoas indicariam a empresa, com perguntas para entender a nota.",
  fatos: [{ icone: "perguntas", texto: "1 pergunta + complementares" }],
  ritmo: "Uma pergunta · recorrente",
  frequencia: "Trimestral",
  sobre:
    "Promotores (9 e 10) menos detratores (0 a 6), de −100 a 100, com 5 perguntas complementares e 2 abertas para entender a nota.",
  nomeBase: "eNPS",
  boasVindas: "É rápido: uma nota de 0 a 10 e algumas perguntas sobre ela.",
  secoes: [
    {
      titulo: "Principal",
      cor: "--modelo-teal",
      perguntas: [
        {
          chave: "enps_principal",
          tipo: "nota_0_10",
          rotulo: "eNPS",
          texto:
            "De 0 a 10, quanto você recomendaria a {empresa} como lugar para trabalhar?",
          config: {
            enps: true,
            rotuloMinimo: "Nada provável",
            rotuloMaximo: "Muito provável",
          },
        },
      ],
    },
    {
      titulo: "Complementares",
      cor: "--grafico-1",
      perguntas: [
        complementar(
          "enps_satisfacao",
          "Satisfação geral",
          "No geral, qual é a sua satisfação com a empresa?",
          ["Muito insatisfeito", "Muito satisfeito"],
        ),
        complementar(
          "enps_ambiente",
          "Ambiente",
          "Como você avalia o ambiente de trabalho?",
          ["Muito ruim", "Excelente"],
        ),
        complementar(
          "enps_lideranca",
          "Liderança direta",
          "Como você avalia a sua relação com a liderança direta?",
          ["Muito ruim", "Excelente"],
        ),
        complementar(
          "enps_crescimento",
          "Crescimento",
          "Como você avalia as suas oportunidades de crescimento aqui?",
          ["Muito ruins", "Excelentes"],
        ),
        complementar(
          "enps_reconhecimento",
          "Reconhecimento",
          "Quanto você se sente reconhecido pelo seu trabalho?",
          ["Nada", "Muito"],
        ),
      ],
    },
    {
      titulo: "Abertas",
      cor: "--modelo-cinza",
      perguntas: [
        {
          chave: "enps_gosta",
          tipo: "paragrafo",
          rotulo: "O que mais gosta",
          texto: "O que você mais gosta em trabalhar aqui?",
          obrigatoria: false,
        },
        {
          chave: "enps_melhoraria",
          tipo: "paragrafo",
          rotulo: "O que melhoraria",
          texto: "O que você melhoraria?",
          obrigatoria: false,
        },
      ],
    },
  ],
  comentarioFinal: null,
  perguntaPadrao: {
    tipo: "escala",
    config: {
      minimo: 1,
      maximo: 5,
      rotuloMinimo: "Muito ruim",
      rotuloMaximo: "Excelente",
    },
  },
  limite: 15,
  minimo: 1,
  pagina: {
    titulo: "eNPS · Recomendação da empresa",
    selo: "8 perguntas",
    texto:
      "Uma nota de 0 a 10 diz quanto as pessoas indicariam a empresa como lugar para trabalhar. As complementares e as abertas explicam a nota.",
    metadados: [
      "Cerca de 2 minutos para responder",
      "Identificada, CPF confidencial ou anônima",
      "eNPS de −100 a 100",
    ],
    botaoVer: "Ver as perguntas",
    botaoCriar: "Criar pesquisa",
    recebe: {
      titulo: "O índice e o porquê da nota",
      itens: [
        { titulo: "eNPS", texto: "Promotores menos detratores, com a zona." },
        {
          titulo: "Complementares",
          texto:
            "Satisfação, ambiente, liderança, crescimento e reconhecimento.",
        },
        {
          titulo: "Abertas",
          texto: "O que as pessoas mais gostam e o que melhorariam.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 37 respostas",
        destaque: {
          valor: "+38",
          texto: "eNPS · Zona de aperfeiçoamento",
          cor: "--faixa-atencao",
        },
        barras: [
          {
            rotulo: "Promotores",
            valor: 54,
            maximo: 100,
            texto: "54%",
            cor: "--faixa-forte",
          },
          {
            rotulo: "Neutros",
            valor: 30,
            maximo: 100,
            texto: "30%",
            cor: "--faixa-atencao",
          },
          {
            rotulo: "Detratores",
            valor: 16,
            maximo: 100,
            texto: "16%",
            cor: "--faixa-critico",
          },
        ],
      },
    },
    conteudo: [],
    ficha: [
      ["Perguntas", "1 principal, 5 complementares e 2 abertas"],
      ["Tempo", "Cerca de 2 minutos"],
      ["Frequência", "Trimestral"],
    ],
    regua: {
      titulo: "As zonas do eNPS",
      faixas: [
        { rotulo: "Crítica", intervalo: "−100 a −1", cor: "--faixa-critico" },
        {
          rotulo: "Aperfeiçoamento",
          intervalo: "0 a 49",
          cor: "--faixa-atencao",
        },
        { rotulo: "Qualidade", intervalo: "50 a 74", cor: "--faixa-saudavel" },
        { rotulo: "Excelência", intervalo: "75 a 100", cor: "--faixa-forte" },
      ],
    },
  },
};
