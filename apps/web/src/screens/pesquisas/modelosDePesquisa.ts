/**
 * T216 — a galeria de modelos: pontos de partida com perguntas escritas pelo
 * Evolli. Cada modelo é descrito de forma declarativa e vira seções e
 * perguntas com ids novos a cada uso (`secoesDoModelo`). A quantidade de
 * perguntas do card, da gaveta e do assistente sai da mesma descrição
 * (`totalDePerguntas`), sem número escrito à mão.
 *
 * O comentário final (opcional, sempre por último e fora das médias) fica
 * separado das demais perguntas: a gaveta e o assistente o mostram à parte.
 */
import type {
  ConfigPergunta,
  ModeloPesquisa,
  Pergunta,
  Secao,
  TipoPergunta,
} from "../../api/pesquisasClient";
import { novoId } from "./textosDasPesquisas";

export type CategoriaDoModelo = "clima" | "outros";

export const CATEGORIAS_DE_MODELO: Readonly<
  Record<CategoriaDoModelo, { readonly nome: string; readonly texto: string }>
> = {
  clima: {
    nome: "Clima e engajamento",
    texto: "Para acompanhar o time ao longo do tempo",
  },
  outros: {
    nome: "Outros",
    texto: "Para momentos específicos da jornada de cada pessoa",
  },
};

/** Categorias da página da pesquisa personalizada (pontos de partida menores). */
export type CategoriaPersonalizada = "integracao" | "satisfacao" | "saida";

export const CATEGORIAS_PERSONALIZADAS: Readonly<
  Record<CategoriaPersonalizada, string>
> = {
  integracao: "Integração",
  satisfacao: "Satisfação",
  saida: "Desligamento",
};

interface PerguntaDoModelo {
  readonly chave?: string;
  readonly tipo: TipoPergunta;
  readonly texto: string;
  /** Rótulo curto para as tabelas de análise (até 40). */
  readonly rotulo?: string;
  readonly descricao?: string;
  readonly obrigatoria?: boolean;
  /** Opções por texto (os ids nascem no uso). */
  readonly opcoes?: readonly string[];
  readonly config?: Omit<ConfigPergunta, "opcoes">;
  /** Só aparece para quem marcou a opção (índice, ou "sim"/"nao"). */
  readonly condicao?: {
    readonly chave: string;
    readonly opcao: number | "sim" | "nao";
  };
}

interface SecaoDoModelo {
  readonly titulo: string | null;
  readonly descricao?: string;
  readonly perguntas: readonly PerguntaDoModelo[];
}

/** A pergunta que "Adicionar pergunta" cria no assistente do modelo. */
export interface PerguntaPadrao {
  readonly tipo: TipoPergunta;
  readonly config: Omit<ConfigPergunta, "opcoes">;
}

export interface ModeloDaGaleria {
  /** Identificador do card (único na galeria). */
  readonly id: string;
  /** Modelo gravado na pesquisa (`personalizada` nos pontos de partida). */
  readonly modelo: ModeloPesquisa;
  readonly nome: string;
  readonly categoria: CategoriaDoModelo | CategoriaPersonalizada | null;
  readonly descricao: string;
  /** Token de cor do ícone (sem `var()`). */
  readonly cor: string;
  readonly selo?: "recomendado" | "novo";
  /** Destaques do card, além da quantidade ("Escala 1 a 10", "5 dimensões"). */
  readonly destaques: readonly string[];
  /** O que se mede, em uma frase (página "Sobre o modelo"). */
  readonly sobre: string;
  /** Selo curto da página "Sobre o modelo" ("Rápida · recorrente"). */
  readonly ritmo: string;
  /** Frequência sugerida ("Mensal", "Uma vez"). */
  readonly frequencia: string;
  /** Nome-base da pesquisa ("Pulso" → "Pulso – novembro de 2026"). */
  readonly nomeBase: string;
  readonly boasVindas: string | null;
  readonly secoes: readonly SecaoDoModelo[];
  /** Comentário final opcional (sempre por último, fora das médias). */
  readonly comentarioFinal: string | null;
  readonly perguntaPadrao: PerguntaPadrao;
  /** Teto de perguntas do assistente do modelo (sem o comentário). */
  readonly limite: number;
}

const ESCALA_1_10: Omit<ConfigPergunta, "opcoes"> = {
  minimo: 1,
  maximo: 10,
  rotuloMinimo: "Discordo totalmente",
  rotuloMaximo: "Concordo totalmente",
};

const PADRAO_ESCALA: PerguntaPadrao = { tipo: "escala", config: ESCALA_1_10 };
const PADRAO_CONCORDANCIA: PerguntaPadrao = {
  tipo: "concordancia",
  config: {},
};
const PADRAO_ESTRELAS: PerguntaPadrao = { tipo: "estrelas", config: {} };

const concordo = (texto: string, rotulo: string): PerguntaDoModelo => ({
  tipo: "concordancia",
  texto,
  rotulo,
});

const BENEFICIOS_COMUNS = [
  "Alimentação",
  "Saúde",
  "Odontológico",
  "Transporte",
  "Bem-estar",
  "Educação",
] as const;

export const MODELOS_DE_PESQUISA: readonly ModeloDaGaleria[] = [
  {
    id: "pulso",
    modelo: "pulso",
    nome: "Pulso",
    categoria: "clima",
    cor: "--turno-azul",
    selo: "recomendado",
    descricao:
      "Leitura rápida e frequente do time: seis afirmações de 1 a 10, o eNPS e um espaço para comentar.",
    destaques: ["Escala 1 a 10", "Com eNPS", "Cerca de 2 minutos"],
    ritmo: "Rápida · recorrente",
    frequencia: "Mensal",
    sobre:
      "Mede, em poucos minutos, clareza, carga de trabalho, retorno, segurança para opinar, ferramentas e pertencimento. Feito para repetir a cada mês ou trimestre.",
    nomeBase: "Pulso",
    boasVindas:
      "São poucas perguntas e leva cerca de dois minutos. Responda pensando nas últimas semanas.",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "escala",
            rotulo: "Clareza",
            texto: "Tenho clareza sobre o que se espera do meu trabalho agora.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            rotulo: "Carga de trabalho",
            texto:
              "Consigo dar conta das minhas tarefas sem sobrecarga constante.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            rotulo: "Retorno",
            texto: "Recebo retorno útil sobre o que faço.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            rotulo: "Segurança para opinar",
            texto: "Posso dar opiniões sem receio.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            rotulo: "Ferramentas",
            texto: "Tenho as ferramentas de que preciso para trabalhar bem.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            rotulo: "Pertencimento",
            texto: "Sinto que faço parte do time.",
            config: ESCALA_1_10,
          },
          {
            tipo: "nota_0_10",
            rotulo: "Recomendação",
            texto:
              "De 0 a 10, quanto você recomendaria a empresa como lugar para trabalhar?",
            config: { enps: true },
          },
        ],
      },
    ],
    comentarioFinal: "Quer comentar algo sobre as últimas semanas?",
    perguntaPadrao: PADRAO_ESCALA,
    limite: 15,
  },
  {
    id: "clima",
    modelo: "clima",
    nome: "Clima",
    categoria: "clima",
    cor: "--turno-verde",
    descricao:
      "Visão ampla do ambiente em cinco dimensões, com afirmações de concordância de 1 a 5.",
    destaques: ["Concordância 1 a 5", "5 dimensões", "Cerca de 8 minutos"],
    ritmo: "Completa · anual",
    frequencia: "Anual",
    sobre:
      "Cobre liderança, comunicação, ambiente, reconhecimento e bem-estar. Bom para um retrato anual ou semestral.",
    nomeBase: "Clima",
    boasVindas:
      "Queremos entender como é trabalhar aqui hoje. Leva cerca de oito minutos. Não existe resposta certa: vale a sua percepção.",
    secoes: [
      {
        titulo: "Liderança",
        descricao: "Pense na liderança direta do seu dia a dia.",
        perguntas: [
          concordo(
            "A liderança explica com clareza as prioridades da equipe.",
            "Prioridades claras",
          ),
          concordo(
            "Recebo apoio da liderança quando encontro dificuldades.",
            "Apoio da liderança",
          ),
          concordo(
            "A liderança trata todas as pessoas da equipe com respeito e imparcialidade.",
            "Respeito",
          ),
          concordo(
            "As decisões que afetam meu trabalho são explicadas.",
            "Decisões explicadas",
          ),
        ],
      },
      {
        titulo: "Comunicação",
        perguntas: [
          concordo(
            "Fico sabendo a tempo das mudanças que afetam meu trabalho.",
            "Mudanças a tempo",
          ),
          concordo(
            "As informações circulam bem entre as áreas.",
            "Entre áreas",
          ),
          concordo(
            "Sei a quem recorrer quando tenho uma dúvida.",
            "A quem recorrer",
          ),
        ],
      },
      {
        titulo: "Ambiente e colaboração",
        perguntas: [
          concordo(
            "Posso contar com colegas quando preciso de ajuda.",
            "Ajuda de colegas",
          ),
          concordo(
            "Conflitos na equipe são tratados de forma construtiva.",
            "Conflitos",
          ),
          concordo(
            "O ambiente de trabalho é seguro e respeitoso.",
            "Ambiente seguro",
          ),
        ],
      },
      {
        titulo: "Reconhecimento e crescimento",
        perguntas: [
          concordo("Meu esforço é reconhecido.", "Reconhecimento"),
          concordo(
            "Vejo possibilidades de aprender e crescer aqui.",
            "Crescimento",
          ),
          concordo(
            "Os critérios de promoção e de remuneração são claros.",
            "Critérios claros",
          ),
        ],
      },
      {
        titulo: "Bem-estar",
        perguntas: [
          concordo(
            "Consigo equilibrar o trabalho e a vida pessoal.",
            "Equilíbrio",
          ),
          concordo(
            "A carga de trabalho é razoável na maior parte do tempo.",
            "Carga razoável",
          ),
          concordo("Tenho orgulho de trabalhar aqui.", "Orgulho"),
        ],
      },
    ],
    comentarioFinal: "O que mais ajudaria a melhorar o dia a dia na empresa?",
    perguntaPadrao: PADRAO_CONCORDANCIA,
    limite: 30,
  },
  {
    id: "enps",
    modelo: "enps",
    nome: "eNPS",
    categoria: "clima",
    cor: "--turno-roxo",
    selo: "novo",
    descricao:
      "O índice de recomendação da empresa como lugar para trabalhar, com uma pergunta para entender a nota.",
    destaques: ["Nota 0 a 10", "Menos de 1 minuto"],
    ritmo: "Uma pergunta · recorrente",
    frequencia: "Trimestral",
    sobre:
      "Promotores (9 e 10) menos detratores (0 a 6), em pontos de −100 a 100. Simples de repetir e de comparar entre períodos.",
    nomeBase: "eNPS",
    boasVindas: "Leva menos de um minuto.",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "nota_0_10",
            rotulo: "Recomendação",
            texto:
              "Em uma escala de 0 a 10, quanto você indicaria a empresa como lugar para trabalhar?",
            config: { enps: true },
          },
          {
            tipo: "paragrafo",
            rotulo: "Motivo da nota",
            texto: "O que mais pesou na sua nota?",
            obrigatoria: false,
          },
        ],
      },
    ],
    comentarioFinal: "O que faria a sua nota subir?",
    perguntaPadrao: PADRAO_ESCALA,
    limite: 15,
  },
  {
    id: "onboarding",
    modelo: "onboarding",
    nome: "Onboarding · 30 dias",
    categoria: "clima",
    cor: "--turno-ciano",
    descricao:
      "Para quem chegou há pouco: como foram a chegada, as primeiras semanas e o que pode melhorar.",
    destaques: ["Perguntas variadas", "Para quem chegou há 30 dias"],
    ritmo: "Para quem chegou",
    frequencia: "30 dias após a admissão",
    sobre:
      "Confere se a chegada foi bem preparada, se as responsabilidades ficaram claras e se a realidade bate com o que foi apresentado.",
    nomeBase: "Onboarding",
    boasVindas:
      "Você chegou há pouco e a sua visão de quem está começando ajuda a receber melhor as próximas pessoas.",
    secoes: [
      {
        titulo: "A chegada",
        perguntas: [
          {
            tipo: "estrelas",
            rotulo: "Primeiro dia",
            texto: "Como foi o seu primeiro dia?",
          },
          {
            chave: "equipamento",
            tipo: "sim_nao",
            rotulo: "Estrutura pronta",
            texto:
              "Equipamentos e acessos estavam prontos quando você começou?",
            config: { respostaBoa: "sim" },
          },
          {
            tipo: "paragrafo",
            rotulo: "O que faltou",
            texto: "O que faltou?",
            condicao: { chave: "equipamento", opcao: "nao" },
          },
        ],
      },
      {
        titulo: "As primeiras semanas",
        perguntas: [
          concordo(
            "Entendo bem quais são as minhas responsabilidades.",
            "Responsabilidades",
          ),
          concordo(
            "Recebi o apoio necessário para aprender as rotinas.",
            "Apoio nas rotinas",
          ),
          concordo(
            "A liderança acompanhou de perto as minhas primeiras semanas.",
            "Acompanhamento",
          ),
          {
            tipo: "escolha_unica",
            rotulo: "Canal de informação",
            texto: "Por onde chegaram as informações mais importantes?",
            opcoes: [
              "Conversa com a liderança",
              "Colegas de equipe",
              "Material escrito ou sistema",
              "Ainda não sei onde encontrar",
            ],
            config: { outro: true },
          },
          {
            tipo: "nota_0_10",
            rotulo: "Expectativa",
            texto:
              "De 0 a 10, quanto o dia a dia corresponde ao que foi apresentado na contratação?",
            config: { enps: false },
          },
        ],
      },
    ],
    comentarioFinal: "O que poderia ter sido melhor na sua chegada?",
    perguntaPadrao: PADRAO_CONCORDANCIA,
    limite: 15,
  },
  {
    id: "desligamento",
    modelo: "desligamento",
    nome: "Entrevista de desligamento",
    categoria: "outros",
    cor: "--turno-laranja",
    descricao:
      "Entenda os motivos de quem está saindo e o que a empresa pode aprender com cada saída.",
    destaques: ["Perguntas variadas", "Melhor identificada"],
    ritmo: "Na saída",
    frequencia: "A cada desligamento",
    sobre:
      "Registra o motivo principal, o que fez falta e se a pessoa voltaria. Ajuda a achar padrões entre as saídas.",
    nomeBase: "Desligamento",
    boasVindas:
      "Agradecemos o seu tempo com a gente. As suas respostas ajudam a melhorar a experiência de quem fica.",
    secoes: [
      {
        titulo: "A saída",
        perguntas: [
          {
            tipo: "escolha_unica",
            rotulo: "Motivo principal",
            texto: "Qual o principal motivo da saída?",
            opcoes: [
              "Proposta com remuneração maior",
              "Crescimento profissional",
              "Relação com a liderança",
              "Ambiente de trabalho",
              "Carga de trabalho ou jornada",
              "Mudança de cidade ou motivos pessoais",
            ],
            config: { outro: true },
          },
          {
            tipo: "multipla_escolha",
            rotulo: "O que fez falta",
            texto: "O que mais fez falta durante o período na empresa?",
            descricao: "Marque até três.",
            opcoes: [
              "Reconhecimento",
              "Treinamento",
              "Flexibilidade",
              "Benefícios",
              "Comunicação",
              "Perspectiva de carreira",
            ],
            config: { outro: false, maximo: 3 },
          },
        ],
      },
      {
        titulo: "A experiência",
        perguntas: [
          concordo(
            "O tratamento que recebi foi respeitoso durante todo o período.",
            "Tratamento",
          ),
          {
            tipo: "estrelas",
            rotulo: "Liderança",
            texto: "Como você avalia a sua liderança direta?",
          },
          {
            chave: "voltaria",
            tipo: "sim_nao",
            rotulo: "Voltaria",
            texto: "Você voltaria a trabalhar aqui?",
            config: { respostaBoa: "sim" },
          },
          {
            tipo: "paragrafo",
            rotulo: "O que mudar",
            texto: "O que precisaria mudar?",
            obrigatoria: false,
            condicao: { chave: "voltaria", opcao: "nao" },
          },
        ],
      },
    ],
    comentarioFinal: "Deixe uma sugestão para quem fica.",
    perguntaPadrao: PADRAO_CONCORDANCIA,
    limite: 15,
  },
  {
    id: "beneficios",
    modelo: "beneficios",
    nome: "Satisfação com benefícios",
    categoria: "outros",
    cor: "--turno-verde-agua",
    descricao:
      "Quais benefícios as pessoas usam, quais valorizam mais e o que está faltando.",
    destaques: ["Perguntas variadas", "Cerca de 3 minutos"],
    ritmo: "Rápida · pontual",
    frequencia: "Anual",
    sobre:
      "Mostra o uso de cada benefício, o que é mais valorizado e onde as regras confundem.",
    nomeBase: "Benefícios",
    boasVindas: "Leva cerca de três minutos.",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "estrelas",
            rotulo: "Avaliação geral",
            texto: "No geral, como você avalia os benefícios oferecidos?",
          },
          {
            tipo: "multipla_escolha",
            rotulo: "Uso frequente",
            texto: "Quais benefícios você usa com frequência?",
            opcoes: BENEFICIOS_COMUNS,
            config: { outro: true },
          },
          {
            tipo: "escolha_unica",
            rotulo: "Mais importante",
            texto: "Qual deles é o mais importante para você?",
            opcoes: BENEFICIOS_COMUNS,
            config: { outro: true },
          },
          concordo(
            "As regras de cada benefício são fáceis de entender.",
            "Regras claras",
          ),
          concordo(
            "Sei como pedir ajuda quando um benefício não funciona.",
            "Onde pedir ajuda",
          ),
          {
            chave: "falta",
            tipo: "sim_nao",
            rotulo: "Falta algum",
            texto:
              "Existe algum benefício que você gostaria de ter e ainda não tem?",
            config: { respostaBoa: null },
          },
          {
            tipo: "texto_curto",
            rotulo: "Qual benefício",
            texto: "Qual?",
            condicao: { chave: "falta", opcao: "sim" },
          },
        ],
      },
    ],
    comentarioFinal: "Algo mais sobre os benefícios?",
    perguntaPadrao: PADRAO_ESTRELAS,
    limite: 15,
  },
  {
    id: "treinamento",
    modelo: "treinamento",
    nome: "Avaliação de treinamento",
    categoria: "outros",
    cor: "--turno-indigo",
    descricao:
      "Depois de um curso ou treinamento: conteúdo, condução e o quanto o aprendizado vai para a prática.",
    destaques: ["Perguntas variadas", "Logo depois da turma"],
    ritmo: "Logo após a turma",
    frequencia: "A cada turma",
    sobre:
      "Avalia conteúdo e condução e mede quanto do aprendizado chega ao dia a dia.",
    nomeBase: "Treinamento",
    boasVindas: null,
    secoes: [
      {
        titulo: "O treinamento",
        perguntas: [
          {
            tipo: "texto_curto",
            rotulo: "Treinamento",
            texto: "Qual treinamento você fez?",
          },
          {
            tipo: "data",
            rotulo: "Término",
            texto: "Em que dia ele terminou?",
            obrigatoria: false,
          },
          {
            tipo: "estrelas",
            rotulo: "Conteúdo",
            texto: "Como você avalia o conteúdo?",
          },
          {
            tipo: "estrelas",
            rotulo: "Condução",
            texto: "Como você avalia a condução?",
          },
        ],
      },
      {
        titulo: "Na prática",
        perguntas: [
          {
            tipo: "escala",
            rotulo: "Aplicação",
            texto: "Quanto do que você aprendeu vai usar no dia a dia?",
            config: {
              minimo: 1,
              maximo: 5,
              rotuloMinimo: "Quase nada",
              rotuloMaximo: "Quase tudo",
            },
          },
          {
            tipo: "numero",
            rotulo: "Horas dedicadas",
            texto:
              "Quantas horas você dedicou, contando o estudo fora das aulas?",
            obrigatoria: false,
            config: { minimo: 0, maximo: 500, inteiro: true },
          },
        ],
      },
    ],
    comentarioFinal: "O que pode melhorar para a próxima turma?",
    perguntaPadrao: PADRAO_ESTRELAS,
    limite: 15,
  },
  {
    id: "personalizada",
    modelo: "personalizada",
    nome: "Personalizada",
    categoria: "outros",
    cor: "--turno-cinza",
    descricao:
      "Comece em branco, copie uma pesquisa já feita ou parta de um roteiro curto, com os 11 tipos de pergunta.",
    destaques: ["11 tipos de pergunta", "Seções e condições"],
    ritmo: "Do seu jeito",
    frequencia: "Quando precisar",
    sobre:
      "Para o que os modelos prontos não cobrem: você monta as seções, as perguntas e as condições.",
    nomeBase: "Pesquisa",
    boasVindas: null,
    secoes: [{ titulo: null, perguntas: [] }],
    comentarioFinal: null,
    perguntaPadrao: PADRAO_ESCALA,
    limite: 60,
  },
];

/** Pontos de partida menores da página da pesquisa personalizada. */
export const ROTEIROS_PERSONALIZADOS: readonly ModeloDaGaleria[] = [
  {
    id: "integracao-semana",
    modelo: "personalizada",
    nome: "Primeira semana",
    categoria: "integracao",
    cor: "--turno-ciano",
    descricao: "Um retrato rápido dos primeiros dias de quem acabou de chegar.",
    destaques: ["Estrelas e sim ou não"],
    ritmo: "Rápida",
    frequencia: "Primeira semana",
    sobre: "Confere recepção, acessos e com quem a pessoa pode contar.",
    nomeBase: "Primeira semana",
    boasVindas: null,
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "estrelas",
            rotulo: "Recepção",
            texto: "Como foi a sua recepção?",
          },
          {
            tipo: "sim_nao",
            rotulo: "Acessos",
            texto: "Você já tem todos os acessos de que precisa?",
            config: { respostaBoa: "sim" },
          },
          {
            tipo: "sim_nao",
            rotulo: "Referência",
            texto: "Você sabe a quem procurar quando tem uma dúvida?",
            config: { respostaBoa: "sim" },
          },
        ],
      },
    ],
    comentarioFinal: "Algo que tornaria a sua semana mais fácil?",
    perguntaPadrao: PADRAO_ESTRELAS,
    limite: 60,
  },
  {
    id: "satisfacao-espaco",
    modelo: "personalizada",
    nome: "Espaço de trabalho",
    categoria: "satisfacao",
    cor: "--turno-verde",
    descricao:
      "Conforto, silêncio e estrutura do lugar onde o trabalho acontece.",
    destaques: ["Concordância 1 a 5"],
    ritmo: "Rápida",
    frequencia: "Semestral",
    sobre:
      "Para decidir ajustes no escritório, na fábrica ou no trabalho remoto.",
    nomeBase: "Espaço de trabalho",
    boasVindas: null,
    secoes: [
      {
        titulo: null,
        perguntas: [
          concordo("O lugar onde trabalho é confortável.", "Conforto"),
          concordo("Consigo me concentrar quando preciso.", "Concentração"),
          concordo("Os equipamentos funcionam bem.", "Equipamentos"),
        ],
      },
    ],
    comentarioFinal: "O que mudaria no seu espaço de trabalho?",
    perguntaPadrao: PADRAO_CONCORDANCIA,
    limite: 60,
  },
  {
    id: "satisfacao-evento",
    modelo: "personalizada",
    nome: "Avaliação de evento",
    categoria: "satisfacao",
    cor: "--turno-mostarda",
    descricao: "Para depois de uma confraternização, palestra ou encontro.",
    destaques: ["Estrelas e escolha"],
    ritmo: "Rápida",
    frequencia: "A cada evento",
    sobre: "Mede a avaliação geral e o que repetir no próximo encontro.",
    nomeBase: "Avaliação de evento",
    boasVindas: null,
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "estrelas",
            rotulo: "Avaliação geral",
            texto: "Como você avalia o evento?",
          },
          {
            tipo: "multipla_escolha",
            rotulo: "Destaques",
            texto: "O que funcionou melhor?",
            opcoes: [
              "Conteúdo",
              "Organização",
              "Local",
              "Horário",
              "Integração com colegas",
            ],
            config: { outro: true },
          },
        ],
      },
    ],
    comentarioFinal: "Alguma sugestão para o próximo?",
    perguntaPadrao: PADRAO_ESTRELAS,
    limite: 60,
  },
  {
    id: "saida-curta",
    modelo: "personalizada",
    nome: "Saída rápida",
    categoria: "saida",
    cor: "--turno-laranja",
    descricao: "Três perguntas para quem está saindo e prefere ser breve.",
    destaques: ["Escolha e nota"],
    ritmo: "Rápida",
    frequencia: "A cada desligamento",
    sobre: "O motivo, a recomendação e uma sugestão, sem tomar tempo.",
    nomeBase: "Saída rápida",
    boasVindas: null,
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "escolha_unica",
            rotulo: "Motivo",
            texto: "O que mais pesou na decisão de sair?",
            opcoes: [
              "Remuneração",
              "Carreira",
              "Liderança",
              "Rotina",
              "Motivos pessoais",
            ],
            config: { outro: true },
          },
          {
            tipo: "nota_0_10",
            rotulo: "Recomendação",
            texto:
              "De 0 a 10, quanto você recomendaria a empresa a uma pessoa conhecida?",
            config: { enps: false },
          },
        ],
      },
    ],
    comentarioFinal: "Quer deixar uma sugestão?",
    perguntaPadrao: PADRAO_ESCALA,
    limite: 60,
  },
];

export function modeloDaGaleria(id: string): ModeloDaGaleria {
  return (
    [...MODELOS_DE_PESQUISA, ...ROTEIROS_PERSONALIZADOS].find(
      (m) => m.id === id,
    ) ?? MODELOS_DE_PESQUISA[MODELOS_DE_PESQUISA.length - 1]!
  );
}

/** Perguntas do modelo sem o comentário final. */
export function perguntasPrincipais(m: ModeloDaGaleria): number {
  return m.secoes.reduce((t, s) => t + s.perguntas.length, 0);
}

/** Quantas perguntas o modelo traz, com o comentário (card = gaveta = assistente). */
export function totalDePerguntas(m: ModeloDaGaleria): number {
  return perguntasPrincipais(m) + (m.comentarioFinal ? 1 : 0);
}

/** A pergunta do comentário final (paragrafo opcional, sem condição). */
export function perguntaDeComentario(texto: string): Pergunta {
  return {
    id: novoId(),
    tipo: "paragrafo",
    texto,
    descricao: null,
    obrigatoria: false,
    config: {},
    condicao: null,
    rotulo: "Comentário",
  };
}

/**
 * As seções do modelo com ids novos (perguntas, opções e condições). O
 * comentário final vai por último, na última seção.
 */
export function secoesDoModelo(m: ModeloDaGaleria): Secao[] {
  const idDaChave = new Map<string, Pergunta>();
  const secoes: Secao[] = m.secoes.map((s) => ({
    id: novoId(),
    titulo: s.titulo,
    descricao: s.descricao ?? null,
    perguntas: s.perguntas.map((p) => {
      const config: ConfigPergunta = { ...(p.config ?? {}) };
      if (p.opcoes) {
        config.opcoes = p.opcoes.map((texto) => ({ id: novoId(), texto }));
        config.outro = config.outro ?? false;
      }
      let condicao: Pergunta["condicao"] = null;
      if (p.condicao) {
        const alvo = idDaChave.get(p.condicao.chave);
        const opcao = p.condicao.opcao;
        if (alvo) {
          const opcaoId =
            typeof opcao === "number"
              ? (alvo.config.opcoes?.[opcao]?.id ?? null)
              : opcao;
          if (opcaoId) condicao = { perguntaId: alvo.id, opcaoId };
        }
      }
      const pergunta: Pergunta = {
        id: novoId(),
        tipo: p.tipo,
        texto: p.texto,
        descricao: p.descricao ?? null,
        obrigatoria: p.obrigatoria ?? true,
        config,
        condicao,
        rotulo: p.rotulo ?? null,
      };
      if (p.chave) idDaChave.set(p.chave, pergunta);
      return pergunta;
    }),
  }));
  if (m.comentarioFinal) {
    const ultima = secoes[secoes.length - 1]!;
    ultima.perguntas.push(perguntaDeComentario(m.comentarioFinal));
  }
  return secoes;
}

/** O modelo pronto (assistente de 3 etapas) ou a personalizada (5 etapas). */
export function ehModeloPronto(modelo: ModeloPesquisa): boolean {
  return modelo !== "personalizada";
}
