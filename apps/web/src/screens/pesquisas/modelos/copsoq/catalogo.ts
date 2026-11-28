/**
 * T216 — Riscos psicossociais (NR-1): card, gaveta, página "Sobre o
 * modelo" e as 76 perguntas (8 domínios, 29 dimensões), com a chave de cada
 * item (`Q1`…) que a API confere. Itens e escalas em `./definicao`.
 */
import type { ModeloDaGaleria, PerguntaDoModelo } from "../tipos";
import {
  DOMINIOS_NR1,
  ESCALAS_NR1,
  dimensaoNr1,
  itensDoDominio,
  type ItemNr1,
} from "./definicao";

const pergunta = (i: ItemNr1): PerguntaDoModelo => {
  const rotulos = [...ESCALAS_NR1[i.escala].rotulos];
  return {
    chave: i.id,
    tipo: "escala",
    texto: i.texto,
    rotulo: `${i.id} · ${dimensaoNr1(i.dimensao).rotulo}`.slice(0, 40),
    obrigatoria: true,
    config: {
      minimo: 1,
      maximo: 5,
      rotuloMinimo: rotulos[0]!,
      rotuloMaximo: rotulos[4]!,
      rotulos,
    },
    selo: i.invertido
      ? `${ESCALAS_NR1[i.escala].nome} · invertida`
      : ESCALAS_NR1[i.escala].nome,
  };
};

const R = "--modelo-laranja";
const P = "--modelo-azul";

export const DOMINIOS_RISCOS = [
  {
    titulo: "Exigências Laborais",
    subtitulo: "O volume e o ritmo de trabalho",
    cor: "--grafico-5",
    quantidade: 8,
    dimensoes: [
      ["Exigências Quantitativas", R],
      ["Ritmo de Trabalho", R],
      ["Exigências Cognitivas", R],
      ["Exigências Emocionais", R],
    ],
  },
  {
    titulo: "Organização e Conteúdo do Trabalho",
    subtitulo: "Autonomia e sentido no trabalho",
    cor: "--grafico-2",
    quantidade: 12,
    dimensoes: [
      ["Influência no Trabalho", P],
      ["Possibilidades de Desenvolvimento", P],
      ["Significado do Trabalho", P],
      ["Compromisso com o Local de Trabalho", P],
    ],
  },
  {
    titulo: "Relações Sociais e Liderança",
    subtitulo: "Clareza, apoio e qualidade da liderança",
    cor: "--grafico-1",
    quantidade: 21,
    dimensoes: [
      ["Previsibilidade", P],
      ["Reconhecimento", P],
      ["Transparência do Papel", P],
      ["Conflitos de Papéis", R],
      ["Qualidade da Liderança", P],
      ["Apoio Social de Superiores", P],
      ["Apoio Social de Colegas", P],
    ],
  },
  {
    titulo: "Interface Trabalho-Indivíduo",
    subtitulo: "Segurança, satisfação e vida pessoal",
    cor: "--grafico-3",
    quantidade: 8,
    dimensoes: [
      ["Insegurança Laboral", R],
      ["Satisfação Laboral", P],
      ["Conflito Trabalho-Família", R],
    ],
  },
  {
    titulo: "Valores no Local de Trabalho",
    subtitulo: "Confiança, justiça e convivência",
    cor: "--grafico-6",
    quantidade: 12,
    dimensoes: [
      ["Confiança Vertical", P],
      ["Confiança Horizontal", P],
      ["Justiça e Respeito", P],
      ["Comunidade Social no Trabalho", P],
    ],
  },
  {
    titulo: "Personalidade",
    subtitulo: "Capacidade de lidar com problemas",
    cor: "--grafico-7",
    quantidade: 2,
    dimensoes: [["Autoeficácia", P]],
  },
  {
    titulo: "Saúde e Bem-Estar",
    subtitulo: "Como o trabalho afeta a saúde",
    cor: "--grafico-4",
    quantidade: 9,
    dimensoes: [
      ["Saúde Geral", P],
      ["Estresse", R],
      ["Esgotamento", R],
      ["Problemas para Dormir", R],
      ["Sintomas Depressivos", R],
    ],
  },
  {
    titulo: "Comportamentos Ofensivos",
    subtitulo: "Assédio, ameaças e violência nos últimos 12 meses",
    cor: "--faixa-critico",
    quantidade: 4,
    dimensoes: [["Comportamentos Ofensivos", R]],
  },
] as const;

export const RISCOS_PSICOSSOCIAIS: ModeloDaGaleria = {
  id: "copsoq",
  modelo: "copsoq",
  nome: "Riscos psicossociais (NR-1)",
  categoria: "saude",
  icone: "riscos",
  tom: "verde",
  selo: "nr1",
  descricao:
    "Avaliação dos riscos psicossociais com 76 perguntas padronizadas, pronta para o inventário do PGR.",
  fatos: [
    { icone: "perguntas", texto: "76 perguntas" },
    { icone: "dimensoes", texto: "8 domínios" },
  ],
  ritmo: "NR-1 · anual",
  frequencia: "Anual",
  sobre:
    "Mostra como a organização do trabalho afeta a saúde mental e entrega o inventário de riscos psicossociais que o PGR pede.",
  nomeBase: "Riscos psicossociais",
  boasVindas:
    "Esta pesquisa olha para como o trabalho afeta você, como pede a NR-1. Não há resposta certa ou errada: responda com sinceridade, pensando no seu dia a dia. Leva cerca de 15 minutos.",
  secoes: DOMINIOS_NR1.map((d, i) => ({
    titulo: d.rotulo,
    cor: DOMINIOS_RISCOS[i]!.cor,
    perguntas: itensDoDominio(d.id).map(pergunta),
  })),
  comentarioFinal: null,
  perguntaPadrao: { tipo: "escala", config: { minimo: 1, maximo: 5 } },
  limite: 76,
  minimo: 76,
  fixo: true,
  legendaDaEscala: [
    "5 escalas de resposta",
    "Frequência · Intensidade · Concordância · Satisfação · Saúde (do melhor para o pior)",
  ],
  pagina: {
    titulo: "NR-1 · Riscos psicossociais",
    selo: "76 perguntas",
    texto:
      "Avalia como a organização do trabalho afeta a saúde mental das pessoas e entrega o inventário de riscos psicossociais que o PGR exige.",
    metadados: [
      "Cerca de 15 minutos para responder",
      "Anônima ou por CPF",
      "Matriz de risco e plano de ação",
    ],
    botaoVer: "Ver as 76 perguntas",
    botaoCriar: "Criar pesquisa",
    recebe: {
      titulo: "Um inventário de riscos pronto para o PGR",
      itens: [
        {
          titulo: "Matriz de risco",
          texto: "Cada dimensão classificada por severidade e prevalência.",
        },
        {
          titulo: "Plano de ação",
          texto:
            "Medidas na ordem de controles da NR-1, com responsável e prazo.",
        },
        {
          titulo: "Relatório em PDF",
          texto:
            "Com a ficha técnica e espaço para a assinatura do profissional de SST.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 64 respostas",
        destaque: {
          valor: "8",
          texto: "de 29 dimensões em risco alto ou crítico",
          cor: "--faixa-critico",
        },
        barras: [
          {
            rotulo: "Ritmo de Trabalho",
            valor: 72,
            maximo: 100,
            texto: "72% em risco",
            cor: "--faixa-critico",
          },
          {
            rotulo: "Exigências Quantitativas",
            valor: 64,
            maximo: 100,
            texto: "64% em risco",
            cor: "--faixa-critico",
          },
          {
            rotulo: "Esgotamento",
            valor: 48,
            maximo: 100,
            texto: "48% em risco",
            cor: "--modelo-laranja",
          },
          {
            rotulo: "Conflito Trabalho-Família",
            valor: 41,
            maximo: 100,
            texto: "41% em risco",
            cor: "--modelo-laranja",
          },
        ],
      },
    },
    conteudo: [
      {
        tipo: "grupos",
        titulo: "O que a pesquisa avalia — 29 dimensões em 8 domínios",
        legenda: [
          { texto: "Fator de risco", cor: R },
          { texto: "Fator de proteção", cor: P },
        ],
        itens: DOMINIOS_RISCOS.map((d, i) => ({
          numero: String(i + 1).padStart(2, "0"),
          titulo: d.titulo,
          subtitulo: d.subtitulo,
          quantidade: `${d.quantidade} perguntas`,
          cor: d.cor,
          chips: d.dimensoes.map(([texto, cor]) => ({ texto, cor })),
        })),
      },
      {
        tipo: "tabela",
        titulo: "Como o risco é classificado",
        descricao:
          "Cada dimensão recebe um nível pelo cruzamento da intensidade média (severidade) com o % de pessoas na faixa de risco (prevalência).",
        colunas: [
          "Severidade",
          "Prevalência baixa",
          "",
          "",
          "Prevalência alta",
        ],
        linhas: [
          ["Mais alta", "Médio", "Alto", "Crítico", "Crítico"],
          ["", "Baixo", "Médio", "Alto", "Crítico"],
          ["", "Baixo", "Baixo", "Médio", "Alto"],
          ["Mais baixa", "Baixo", "Baixo", "Baixo", "Médio"],
        ],
      },
    ],
    ficha: [
      ["Instrumento", "Questionário padronizado de riscos psicossociais"],
      ["Perguntas", "76, fixas"],
      ["Tempo", "Cerca de 15 minutos"],
      ["Identificação", "Anônima ou por CPF"],
      ["Recortes", "A partir de 3 respostas"],
      ["Reaplicação", "Anual"],
    ],
    escalas: [
      { titulo: "Frequência", texto: "Nunca → Sempre" },
      { titulo: "Intensidade", texto: "Nada → Extremamente" },
      { titulo: "Concordância", texto: "Discordo → Concordo totalmente" },
      { titulo: "Satisfação", texto: "Muito insatisfeito → Muito satisfeito" },
      { titulo: "Saúde", texto: "Fraca → Excelente" },
    ],
    regua: {
      titulo: "Os níveis de risco",
      faixas: [
        {
          rotulo: "Crítico",
          intervalo: "ação imediata",
          cor: "--faixa-critico",
        },
        {
          rotulo: "Alto",
          intervalo: "ação prioritária",
          cor: "--modelo-laranja",
        },
        { rotulo: "Médio", intervalo: "acompanhar", cor: "--faixa-atencao" },
        { rotulo: "Baixo", intervalo: "manter", cor: "--faixa-forte" },
      ],
    },
  },
};
