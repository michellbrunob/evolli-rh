/**
 * T216 — Saúde financeira: card, gaveta e página "Sobre o modelo". As 18
 * perguntas (15 + 3 opcionais), as tabelas de conversão e o score 0–100
 * ficam com a frente deste modelo: ela preenche `secoes` e tira `grupos`.
 */
import type { ModeloDaGaleria } from "../tipos";

export const SAUDE_FINANCEIRA: ModeloDaGaleria = {
  id: "isfb",
  modelo: "isfb",
  nome: "Saúde financeira",
  categoria: "saude",
  icone: "saude_financeira",
  tom: "laranja",
  selo: "complementa_nr1",
  descricao:
    "Um índice de saúde financeira de 0 a 100 por pessoa, comparável com a média do país.",
  fatos: [
    { icone: "perguntas", texto: "18 perguntas" },
    { icone: "escala", texto: "Score 0–100" },
  ],
  ritmo: "Saúde financeira · semestral",
  frequencia: "Semestral",
  sobre:
    "15 perguntas viram uma nota de 0 a 100, com 3 perguntas opcionais de autopercepção.",
  nomeBase: "Saúde financeira",
  boasVindas: null,
  secoes: [],
  grupos: [
    { titulo: "Segurança", cor: "--grafico-5", quantidade: 4 },
    { titulo: "Habilidade", cor: "--grafico-1", quantidade: 3 },
    { titulo: "Comportamento", cor: "--grafico-8", quantidade: 3 },
    { titulo: "Liberdade", cor: "--grafico-2", quantidade: 2 },
    { titulo: "Base financeira", cor: "--grafico-3", quantidade: 3 },
    { titulo: "Autopercepção (opcional)", cor: "--grafico-7", quantidade: 3 },
  ],
  comentarioFinal: null,
  perguntaPadrao: { tipo: "escala", config: { minimo: 0, maximo: 4 } },
  limite: 18,
  fixo: true,
  pagina: {
    titulo: "Saúde financeira · Índice de 0 a 100",
    selo: "5 a 8 min",
    texto:
      "15 perguntas viram uma nota de 0 a 100 por pessoa, que dá para comparar com a média do país. As 3 de autopercepção são opcionais.",
    metadados: [
      "De 5 a 8 minutos para responder",
      "Identificada, CPF confidencial ou anônima",
      "Score de 0 a 100 e perfis do time",
    ],
    botaoVer: "Ver as 18 perguntas",
    botaoCriar: "Criar pesquisa",
    numeros: [
      { valor: "15", rotulo: "perguntas formam o índice" },
      { valor: "3", rotulo: "opcionais de autopercepção" },
      { valor: "4", rotulo: "dimensões da saúde financeira" },
      { valor: "Semestral", rotulo: "frequência sugerida" },
    ],
    recebe: {
      titulo: "O que o RH recebe",
      itens: [
        {
          titulo: "Índice do time",
          texto: "De 0 a 100, com a faixa e a média do país.",
        },
        {
          titulo: "4 dimensões",
          texto: "Segurança, habilidade, comportamento e liberdade.",
        },
        {
          titulo: "Perfis do time",
          texto: "Quem está estável, apertado ou em risco.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 46 respostas",
        destaque: {
          valor: "58",
          sufixo: "/100",
          texto: "índice do time · OK (57 a 60)",
          cor: "--faixa-atencao",
        },
        barras: [
          { rotulo: "Segurança", valor: 49, maximo: 100, texto: "49" },
          { rotulo: "Habilidade", valor: 61, maximo: 100, texto: "61" },
          { rotulo: "Comportamento", valor: 66, maximo: 100, texto: "66" },
          { rotulo: "Liberdade", valor: 44, maximo: 100, texto: "44" },
        ],
      },
    },
    conteudo: [
      {
        tipo: "grupos",
        titulo: "O que a pesquisa mede",
        descricao:
          "4 dimensões formam a nota; a base financeira ajusta o cálculo; a autopercepção é opcional.",
        itens: [
          {
            titulo: "Segurança",
            selo: "Forma a nota",
            subtitulo: "Renda que cobre os gastos, aperto e estresse.",
            quantidade: "4 perguntas",
            cor: "--grafico-5",
          },
          {
            titulo: "Habilidade",
            selo: "Forma a nota",
            subtitulo: "Decidir, buscar informação e reconhecer investimentos.",
            quantidade: "3 perguntas",
            cor: "--grafico-1",
          },
          {
            titulo: "Comportamento",
            selo: "Forma a nota",
            subtitulo: "Controlar gastos, poupar e cumprir metas.",
            quantidade: "3 perguntas",
            cor: "--grafico-8",
          },
          {
            titulo: "Liberdade",
            selo: "Forma a nota",
            subtitulo: "Garantir o futuro e aproveitar a vida.",
            quantidade: "2 perguntas",
            cor: "--grafico-2",
          },
          {
            titulo: "Base financeira",
            selo: "Ajusta o cálculo",
            subtitulo: "Produtos financeiros da casa, renda e escolaridade.",
            quantidade: "3 perguntas",
            cor: "--grafico-3",
          },
          {
            titulo: "Autopercepção",
            selo: "Opcional",
            subtitulo:
              "Perceber quando falta informação ou as contas saem do controle.",
            quantidade: "3 perguntas",
            cor: "--grafico-7",
          },
        ],
      },
    ],
    ficha: [
      ["Perguntas", "15 + 3 opcionais"],
      ["Tempo", "De 5 a 8 minutos"],
      ["Resultado", "Score de 0 a 100 por pessoa"],
      ["Frequência", "Semestral"],
    ],
    regua: {
      titulo: "A régua do índice · 7 faixas",
      descricao: "Média do país: 56,7.",
      faixas: [
        { rotulo: "Ruim", intervalo: "0–36", cor: "--faixa-critico" },
        { rotulo: "Muito baixa", intervalo: "37–49", cor: "--faixa-critico" },
        { rotulo: "Baixa", intervalo: "50–56", cor: "--faixa-atencao" },
        { rotulo: "OK", intervalo: "57–60", cor: "--faixa-atencao" },
        { rotulo: "Boa", intervalo: "61–68", cor: "--faixa-saudavel" },
        { rotulo: "Muito boa", intervalo: "69–82", cor: "--faixa-saudavel" },
        { rotulo: "Ótima", intervalo: "83–100", cor: "--faixa-forte" },
      ],
    },
    uso: "Os perfis do time (em risco, apertados mas organizados, confortáveis sem método e estáveis) são calculados pelo Evolli a partir das dimensões.",
  },
};
