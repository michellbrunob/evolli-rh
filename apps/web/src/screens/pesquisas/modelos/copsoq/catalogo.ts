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
  dimensoesDoDominio,
  itensDoDominio,
  type ItemNr1,
} from "./definicao";
import { NIVEIS, NIVEL } from "./textos";

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
      // Saúde: 5 = Excelente, mostrada do melhor para o pior.
      ...(i.escala === "saude" ? { decrescente: true } : {}),
    },
    selo: i.invertido
      ? `${ESCALAS_NR1[i.escala].nome} · invertida`
      : ESCALAS_NR1[i.escala].nome,
  };
};

const R = "--modelo-laranja";
const P = "--modelo-azul";

/** O token de cor de cada domínio, na ordem de `DOMINIOS_NR1`. */
const COR_DO_DOMINIO = [
  "--grafico-5",
  "--grafico-2",
  "--grafico-1",
  "--grafico-3",
  "--grafico-6",
  "--grafico-7",
  "--grafico-4",
  "--faixa-critico",
] as const;

/**
 * Os 8 domínios na página "Sobre o modelo", com os MESMOS nomes de
 * dimensão dos resultados (vindos da definição).
 */
export const DOMINIOS_RISCOS = DOMINIOS_NR1.map((d, i) => ({
  titulo: d.rotulo,
  subtitulo: d.subtitulo,
  cor: COR_DO_DOMINIO[i]!,
  quantidade: itensDoDominio(d.id).length,
  dimensoes: dimensoesDoDominio(d.id).map(
    (x) => [x.rotulo, x.tipo === "risco" ? R : P] as const,
  ),
}));

/** Token de cor de cada nível no exemplo (mesma ordem dos resultados). */
const TOKEN_DO_NIVEL = {
  critico: "--faixa-critico",
  alto: "--modelo-laranja",
  medio: "--faixa-atencao",
  baixo: "--faixa-forte",
} as const;

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
    "Esta pesquisa olha para como o trabalho afeta você, como pede a NR-1. Não há resposta certa ou errada: responda com sinceridade, pensando no seu dia a dia. Leva cerca de 23 minutos.",
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
      "Cerca de 23 minutos para responder",
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
        // 29 quadradinhos do maior risco ao menor: 3 críticas, 5 altas, 9
        // médias e 12 baixas (dados fictícios).
        quadradinhos: [
          ...Array.from({ length: 3 }, () => TOKEN_DO_NIVEL.critico),
          ...Array.from({ length: 5 }, () => TOKEN_DO_NIVEL.alto),
          ...Array.from({ length: 9 }, () => TOKEN_DO_NIVEL.medio),
          ...Array.from({ length: 12 }, () => TOKEN_DO_NIVEL.baixo),
        ],
        matriz: {
          titulo: "Severidade × prevalência",
          // Severidade da mais alta para a mais baixa; prevalência crescente.
          celulas: [
            [
              { valor: 0, cor: TOKEN_DO_NIVEL.medio },
              { valor: 1, cor: TOKEN_DO_NIVEL.alto },
              { valor: 2, cor: TOKEN_DO_NIVEL.critico },
              { valor: 1, cor: TOKEN_DO_NIVEL.critico },
            ],
            [
              { valor: 2, cor: TOKEN_DO_NIVEL.baixo },
              { valor: 3, cor: TOKEN_DO_NIVEL.medio },
              { valor: 3, cor: TOKEN_DO_NIVEL.alto },
              { valor: 0, cor: TOKEN_DO_NIVEL.critico },
            ],
            [
              { valor: 4, cor: TOKEN_DO_NIVEL.baixo },
              { valor: 2, cor: TOKEN_DO_NIVEL.baixo },
              { valor: 4, cor: TOKEN_DO_NIVEL.medio },
              { valor: 1, cor: TOKEN_DO_NIVEL.alto },
            ],
            [
              { valor: 3, cor: TOKEN_DO_NIVEL.baixo },
              { valor: 1, cor: TOKEN_DO_NIVEL.baixo },
              { valor: 0, cor: TOKEN_DO_NIVEL.baixo },
              { valor: 2, cor: TOKEN_DO_NIVEL.medio },
            ],
          ],
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
      ["Tempo", "Cerca de 23 minutos"],
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
    // Os mesmos rótulos e ações dos resultados.
    regua: {
      titulo: "Os níveis de risco",
      faixas: NIVEIS.map((n) => ({
        rotulo: NIVEL[n].rotulo,
        intervalo: NIVEL[n].acao,
        texto: NIVEL[n].frase,
        cor: TOKEN_DO_NIVEL[n],
      })),
    },
  },
};
