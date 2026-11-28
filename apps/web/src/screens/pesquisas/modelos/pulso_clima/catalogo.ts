/**
 * T216 — Pulso e Clima: 8 dimensões de clima com 22 afirmações de
 * concordância (1 a 5), a recomendação do líder direto (LNPS) e a da
 * empresa (eNPS), de 0 a 10, com um comentário opcional por dimensão e por
 * recomendação. Metodologia fixa (a API confere os itens pela chave).
 */
import { semestreDe } from "../datas";
import type {
  ModeloDaGaleria,
  PerguntaDoModelo,
  SecaoDoModelo,
} from "../tipos";
import { perguntasParaOTempo, tempoParaResponder } from "../../tempoEstimado";

export const DIMENSOES_PULSO_CLIMA = [
  {
    chave: "alinhamento_estrategia",
    rotulo: "Alinhamento e Estratégia",
    texto:
      "Se as pessoas entendem a estratégia e as prioridades e ligam isso ao dia a dia.",
  },
  {
    chave: "lideranca",
    rotulo: "Liderança",
    texto: "Como o líder orienta, acompanha, desenvolve e apoia o time.",
  },
  {
    chave: "ambiente_colaboracao",
    rotulo: "Ambiente e Colaboração",
    texto: "As relações, a colaboração entre os times e o clima do dia a dia.",
  },
  {
    chave: "condicoes",
    rotulo: "Condições de Trabalho",
    texto: "Ferramentas, recursos e condições para trabalhar bem.",
  },
  {
    chave: "inovacao",
    rotulo: "Inovação e Melhoria Contínua",
    texto: "Espaço e autonomia para propor e testar melhorias.",
  },
  {
    chave: "desenvolvimento",
    rotulo: "Desenvolvimento e Carreira",
    texto: "Crescimento, aprendizado e oportunidades internas.",
  },
  {
    chave: "reconhecimento",
    rotulo: "Reconhecimento e Recompensas",
    texto: "Reconhecimento, remuneração e benefícios.",
  },
  {
    chave: "bem_estar",
    rotulo: "Bem-estar e Segurança Psicossocial",
    texto: "Equilíbrio entre trabalho e vida pessoal e a saúde mental.",
  },
] as const;

/** A cor de cada dimensão (paleta de gráfico, recicla). */
export function corDaDimensao(i: number): string {
  return `--grafico-${(i % 8) + 1}`;
}

const AFIRMACOES: Readonly<
  Record<string, readonly [string, string, string][]>
> = {
  alinhamento_estrategia: [
    [
      "pc_ae_01",
      "Estratégia",
      "Entendo a estratégia atual da {empresa} e como as prioridades afetam o meu trabalho.",
    ],
    [
      "pc_ae_02",
      "Contribuição",
      "Sei de que forma as minhas entregas ajudam nos resultados da {empresa}.",
    ],
    [
      "pc_ae_03",
      "Comunicação interna",
      "Os canais internos (reuniões, murais, e-mails e grupos) me mantêm bem informado.",
    ],
  ],
  lideranca: [
    [
      "pc_lid_01",
      "Alinhamentos",
      "Meu gestor faz encontros regulares para alinhar o trabalho do time.",
    ],
    [
      "pc_lid_02",
      "Metas",
      "A liderança trabalha com metas claras e acompanha os resultados.",
    ],
    [
      "pc_lid_03",
      "Retorno",
      "Meu gestor me dá retorno com frequência e de forma construtiva.",
    ],
    [
      "pc_lid_04",
      "Alta gestão",
      "Confio na alta gestão para conduzir a {empresa}.",
    ],
  ],
  ambiente_colaboracao: [
    [
      "pc_amb_01",
      "Respeito",
      "O ambiente é respeitoso, sem assédio, preconceito ou discriminação.",
    ],
    [
      "pc_amb_02",
      "Colaboração",
      "Colaboro bem com o meu time e com as outras áreas.",
    ],
    [
      "pc_amb_03",
      "Cultura",
      "As ações de cultura e de integração melhoram o meu dia a dia.",
    ],
  ],
  condicoes: [
    [
      "pc_cond_01",
      "Recursos",
      "Tenho as ferramentas e os recursos de que preciso para trabalhar.",
    ],
    [
      "pc_cond_02",
      "Jornada",
      "Consigo terminar as minhas atividades dentro da jornada.",
    ],
  ],
  inovacao: [
    [
      "pc_inov_01",
      "Novas ideias",
      "Tenho liberdade e apoio para propor e testar ideias novas.",
    ],
    [
      "pc_inov_02",
      "Cliente",
      "O nosso trabalho busca melhorar os produtos e a experiência do cliente.",
    ],
  ],
  desenvolvimento: [
    [
      "pc_desv_01",
      "Carreira",
      "Entendo os critérios e as oportunidades de crescimento na carreira.",
    ],
    [
      "pc_desv_02",
      "Vagas internas",
      "Fico sabendo das vagas internas e consigo me candidatar a elas.",
    ],
    [
      "pc_desv_03",
      "Desenvolvimento",
      "As ações de desenvolvimento atendem ao que eu preciso.",
    ],
  ],
  reconhecimento: [
    [
      "pc_rec_01",
      "Mérito",
      "Os critérios de mérito e de promoção são justos e claros.",
    ],
    [
      "pc_rec_02",
      "Remuneração",
      "Minha remuneração é compatível com a minha função.",
    ],
    [
      "pc_rec_03",
      "Benefícios",
      "Os benefícios são atrativos em comparação com o mercado.",
    ],
  ],
  bem_estar: [
    [
      "pc_bem_01",
      "Equilíbrio",
      "Consigo manter um equilíbrio saudável entre o trabalho e a vida pessoal.",
    ],
    [
      "pc_bem_02",
      "Saúde mental",
      "A rotina e o ambiente de trabalho não prejudicam o meu bem-estar mental e emocional.",
    ],
  ],
};

export function chaveDoComentario(dimensao: string): string {
  return `__comentario_${dimensao}__`;
}

const comentario = (dimensao: string, texto: string): PerguntaDoModelo => ({
  chave: chaveDoComentario(dimensao),
  tipo: "paragrafo",
  rotulo: "Comentário",
  texto,
  descricao:
    "Use este espaço para elogios, sugestões ou pontos de melhoria. Não é obrigatório.",
  obrigatoria: false,
});

const SECOES: SecaoDoModelo[] = [
  ...DIMENSOES_PULSO_CLIMA.map((d, i): SecaoDoModelo => ({
    titulo: d.rotulo,
    descricao: d.texto,
    cor: corDaDimensao(i),
    perguntas: [
      ...(AFIRMACOES[d.chave] ?? []).map(
        ([chave, rotulo, texto]): PerguntaDoModelo => ({
          chave,
          tipo: "concordancia",
          rotulo,
          texto,
        }),
      ),
      comentario(d.chave, `Quer comentar algo sobre ${d.rotulo}?`),
    ],
  })),
  {
    titulo: "LNPS · Liderança direta",
    descricao: "A recomendação do líder direto, pela experiência do dia a dia.",
    cor: "--modelo-celeste",
    perguntas: [
      {
        chave: "pc_lnps_01",
        tipo: "nota_0_10",
        rotulo: "LNPS",
        texto:
          "De 0 a 10, quanto você recomendaria o seu líder direto, pela experiência do dia a dia?",
        config: {
          enps: false,
          lnps: true,
          rotuloMinimo: "Pouco provável",
          rotuloMaximo: "Muito provável",
        },
      },
      comentario("lnps", "Quer comentar essa nota?"),
    ],
  },
  {
    titulo: "eNPS · Empresa",
    descricao: "A recomendação da empresa como lugar para trabalhar.",
    cor: "--modelo-coral",
    perguntas: [
      {
        chave: "pc_enps_01",
        tipo: "nota_0_10",
        rotulo: "eNPS",
        texto:
          "De 0 a 10, quanto você recomendaria a {empresa} como lugar para trabalhar?",
        config: {
          enps: true,
          rotuloMinimo: "Pouco provável",
          rotuloMaximo: "Muito provável",
        },
      },
      comentario("enps", "Quer comentar essa nota?"),
    ],
  },
];

export const PULSO_CLIMA: ModeloDaGaleria = {
  id: "pulso_clima",
  modelo: "pulso_clima",
  nome: "Pulso e Clima",
  categoria: "clima",
  icone: "pulso_clima",
  tom: "coral",
  selo: "novo",
  descricao:
    "Leitura completa do clima em 8 dimensões: 22 afirmações de 1 a 5, mais o eNPS e o LNPS.",
  fatos: [
    { icone: "perguntas", texto: "24 perguntas" },
    { icone: "dimensoes", texto: "8 dimensões" },
  ],
  ritmo: "Completa · semestral",
  frequencia: "Semestral",
  sobre:
    "8 dimensões de clima com 22 afirmações de 1 a 5, mais a recomendação da empresa (eNPS) e do líder direto (LNPS).",
  nomeBase: "Pulso e Clima",
  nomeDaPesquisa: (hoje) => `Pulso e Clima – ${semestreDe(hoje)}`,
  boasVindas: "Responda com sinceridade. Suas respostas são confidenciais.",
  secoes: SECOES,
  comentarioFinal: null,
  perguntaPadrao: { tipo: "concordancia", config: {} },
  limite: 40,
  minimo: 5,
  fixo: true,
  legendaDaEscala: [
    "Escala de concordância de 1 a 5 · eNPS e LNPS de 0 a 10",
    "1 = Discordo totalmente · 5 = Concordo totalmente · 4 e 5 contam como favoráveis",
  ],
  pagina: {
    titulo: "Pulso e Clima · Leitura completa do clima",
    selo: "24 perguntas",
    texto:
      "8 dimensões de clima em 22 afirmações de 1 a 5, mais o eNPS (empresa) e o LNPS (liderança direta). Mostra onde o clima está forte e onde pede ação, com os comentários de cada dimensão.",
    metadados: [
      `${tempoParaResponder(perguntasParaOTempo(SECOES))} para responder`,
      "Identificada, CPF confidencial ou anônima",
      "Score por dimensão, eNPS e LNPS",
    ],
    botaoVer: "Ver perguntas",
    botaoCriar: "Criar pesquisa",
    numeros: [
      { valor: "8", rotulo: "dimensões" },
      { valor: "22", rotulo: "afirmações de 1 a 5" },
      { valor: "2", rotulo: "recomendações: eNPS e LNPS" },
      { valor: "8", rotulo: "espaços para comentário" },
    ],
    conteudo: [
      {
        tipo: "grupos",
        titulo: "As 10 dimensões",
        descricao: "8 de clima e 2 de recomendação.",
        estilo: "cartoes",
        itens: [
          ...DIMENSOES_PULSO_CLIMA.map((d, i) => ({
            numero: String(i + 1).padStart(2, "0"),
            titulo: d.rotulo,
            subtitulo: d.texto,
            quantidade: `${(AFIRMACOES[d.chave] ?? []).length} afirmações`,
            cor: corDaDimensao(i),
          })),
          {
            numero: "09",
            titulo: "LNPS · Liderança direta",
            subtitulo: "Recomendação do líder direto.",
            quantidade: "1 pergunta de 0 a 10",
            cor: "--modelo-celeste",
          },
          {
            numero: "10",
            titulo: "eNPS · Empresa",
            subtitulo: "Recomendação da empresa.",
            quantidade: "1 pergunta de 0 a 10",
            cor: "--modelo-coral",
          },
        ],
      },
      {
        tipo: "reguas",
        titulo: "Como o resultado é calculado",
        paragrafos: [
          "Cada afirmação vai de 1 a 5, e a média dela vira um score de 0 a 100. O score da dimensão é a média das afirmações dela; o geral, a média das 22.",
          "O eNPS e o LNPS vão de −100 a 100: o % de notas 9 e 10 menos o % de notas de 0 a 6.",
        ],
        reguas: [
          {
            titulo: "Score de 0 a 100",
            descricao: "Geral e por dimensão.",
            faixas: [
              {
                rotulo: "Crítico",
                intervalo: "0 a 49",
                cor: "--faixa-critico",
              },
              {
                rotulo: "Atenção",
                intervalo: "50 a 69",
                cor: "--faixa-atencao",
              },
              {
                rotulo: "Saudável",
                intervalo: "70 a 84",
                cor: "--faixa-saudavel",
              },
              { rotulo: "Forte", intervalo: "85 a 100", cor: "--faixa-forte" },
            ],
          },
          {
            titulo: "eNPS e LNPS de −100 a 100",
            descricao: "Empresa e liderança direta.",
            faixas: [
              {
                rotulo: "Crítico",
                intervalo: "abaixo de 0",
                cor: "--faixa-critico",
              },
              {
                rotulo: "Em ajuste",
                intervalo: "0 a 29",
                cor: "--faixa-atencao",
              },
              { rotulo: "Bom", intervalo: "30 a 69", cor: "--faixa-saudavel" },
              {
                rotulo: "Excelente",
                intervalo: "70 ou mais",
                cor: "--faixa-forte",
              },
            ],
          },
        ],
      },
    ],
  },
};
