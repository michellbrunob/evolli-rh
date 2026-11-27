/**
 * T216 — a galeria de modelos: 8 pontos de partida com perguntas escritas
 * pelo Evolli. Cada modelo é descrito de forma declarativa e vira seções e
 * perguntas com ids novos a cada uso (`secoesDoModelo`). A quantidade de
 * perguntas do card, da gaveta e do assistente sai da mesma descrição
 * (`totalDePerguntas`), sem número escrito à mão.
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

export const CATEGORIAS_DE_MODELO: Readonly<Record<CategoriaDoModelo, string>> =
  {
    clima: "Clima e engajamento",
    outros: "Outros",
  };

interface PerguntaDoModelo {
  readonly chave?: string;
  readonly tipo: TipoPergunta;
  readonly texto: string;
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

export interface ModeloDaGaleria {
  readonly modelo: ModeloPesquisa;
  readonly nome: string;
  readonly categoria: CategoriaDoModelo;
  readonly descricao: string;
  /** Nome sugerido para a pesquisa criada a partir do modelo. */
  readonly nomeSugerido: string;
  readonly boasVindas: string | null;
  readonly secoes: readonly SecaoDoModelo[];
}

const ESCALA_1_10: Omit<ConfigPergunta, "opcoes"> = {
  minimo: 1,
  maximo: 10,
  rotuloMinimo: "Discordo totalmente",
  rotuloMaximo: "Concordo totalmente",
};

const concordo = (texto: string): PerguntaDoModelo => ({
  tipo: "concordancia",
  texto,
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
    modelo: "pulso",
    nome: "Pulso",
    categoria: "clima",
    descricao:
      "Leitura rápida e frequente do time: seis afirmações de 1 a 10, o eNPS e um espaço para comentar.",
    nomeSugerido: "Pulso do time",
    boasVindas:
      "São poucas perguntas e leva cerca de dois minutos. Responda pensando nas últimas semanas.",
    secoes: [
      {
        titulo: "Como estão as últimas semanas",
        perguntas: [
          {
            tipo: "escala",
            texto: "Tenho clareza sobre o que se espera do meu trabalho agora.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            texto:
              "Consigo dar conta das minhas tarefas sem sobrecarga constante.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            texto: "Recebo retorno útil sobre o que faço.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            texto: "Posso dar opiniões sem receio.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            texto: "Tenho as ferramentas de que preciso para trabalhar bem.",
            config: ESCALA_1_10,
          },
          {
            tipo: "escala",
            texto: "Sinto que faço parte do time.",
            config: ESCALA_1_10,
          },
          {
            tipo: "nota_0_10",
            texto:
              "De 0 a 10, quanto você recomendaria a empresa como lugar para trabalhar?",
            config: { enps: true },
          },
          {
            tipo: "paragrafo",
            texto: "Quer comentar algo sobre as últimas semanas?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    modelo: "clima",
    nome: "Clima",
    categoria: "clima",
    descricao:
      "Visão ampla do ambiente em cinco dimensões, com afirmações de concordância de 1 a 5.",
    nomeSugerido: "Pesquisa de clima",
    boasVindas:
      "Queremos entender como é trabalhar aqui hoje. Leva cerca de oito minutos. Não existe resposta certa: vale a sua percepção.",
    secoes: [
      {
        titulo: "Liderança",
        descricao: "Pense na liderança direta do seu dia a dia.",
        perguntas: [
          concordo("A liderança explica com clareza as prioridades da equipe."),
          concordo("Recebo apoio da liderança quando encontro dificuldades."),
          concordo(
            "A liderança trata todas as pessoas da equipe com respeito e imparcialidade.",
          ),
          concordo("As decisões que afetam meu trabalho são explicadas."),
        ],
      },
      {
        titulo: "Comunicação",
        perguntas: [
          concordo(
            "Fico sabendo a tempo das mudanças que afetam meu trabalho.",
          ),
          concordo("As informações circulam bem entre as áreas."),
          concordo("Sei a quem recorrer quando tenho uma dúvida."),
        ],
      },
      {
        titulo: "Ambiente e colaboração",
        perguntas: [
          concordo("Posso contar com colegas quando preciso de ajuda."),
          concordo("Conflitos na equipe são tratados de forma construtiva."),
          concordo("O ambiente de trabalho é seguro e respeitoso."),
        ],
      },
      {
        titulo: "Reconhecimento e crescimento",
        perguntas: [
          concordo("Meu esforço é reconhecido."),
          concordo("Vejo possibilidades de aprender e crescer aqui."),
          concordo("Os critérios de promoção e de remuneração são claros."),
        ],
      },
      {
        titulo: "Bem-estar",
        perguntas: [
          concordo("Consigo equilibrar o trabalho e a vida pessoal."),
          concordo("A carga de trabalho é razoável na maior parte do tempo."),
          concordo("Tenho orgulho de trabalhar aqui."),
          {
            tipo: "paragrafo",
            texto: "O que mais ajudaria a melhorar o dia a dia na empresa?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    modelo: "enps",
    nome: "eNPS",
    categoria: "clima",
    descricao:
      "O índice de recomendação da empresa como lugar para trabalhar, com duas perguntas para entender a nota.",
    nomeSugerido: "eNPS",
    boasVindas: "Leva menos de um minuto.",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "nota_0_10",
            texto:
              "Em uma escala de 0 a 10, quanto você indicaria a empresa como lugar para trabalhar?",
            config: { enps: true },
          },
          {
            tipo: "paragrafo",
            texto: "O que mais pesou na sua nota?",
            obrigatoria: false,
          },
          {
            tipo: "paragrafo",
            texto: "O que faria a sua nota subir?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    modelo: "onboarding",
    nome: "Onboarding · 30 dias",
    categoria: "clima",
    descricao:
      "Para quem chegou há pouco: como foram a chegada, as primeiras semanas e o que pode melhorar.",
    nomeSugerido: "Onboarding · 30 dias",
    boasVindas:
      "Você chegou há pouco e a sua visão de quem está começando ajuda a receber melhor as próximas pessoas.",
    secoes: [
      {
        titulo: "A chegada",
        perguntas: [
          { tipo: "estrelas", texto: "Como foi o seu primeiro dia?" },
          {
            chave: "equipamento",
            tipo: "sim_nao",
            texto:
              "Equipamentos e acessos estavam prontos quando você começou?",
            config: { respostaBoa: "sim" },
          },
          {
            tipo: "paragrafo",
            texto: "O que faltou?",
            condicao: { chave: "equipamento", opcao: "nao" },
          },
        ],
      },
      {
        titulo: "As primeiras semanas",
        perguntas: [
          concordo("Entendo bem quais são as minhas responsabilidades."),
          concordo("Recebi o apoio necessário para aprender as rotinas."),
          concordo(
            "A liderança acompanhou de perto as minhas primeiras semanas.",
          ),
          {
            tipo: "escolha_unica",
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
            texto:
              "De 0 a 10, quanto o dia a dia corresponde ao que foi apresentado na contratação?",
            config: { enps: false },
          },
          {
            tipo: "paragrafo",
            texto: "O que poderia ter sido melhor na sua chegada?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    modelo: "desligamento",
    nome: "Entrevista de desligamento",
    categoria: "outros",
    descricao:
      "Entenda os motivos de quem está saindo e o que a empresa pode aprender com cada saída.",
    nomeSugerido: "Entrevista de desligamento",
    boasVindas:
      "Agradecemos o seu tempo com a gente. As suas respostas ajudam a melhorar a experiência de quem fica.",
    secoes: [
      {
        titulo: "A saída",
        perguntas: [
          {
            tipo: "escolha_unica",
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
          ),
          {
            tipo: "estrelas",
            texto: "Como você avalia a sua liderança direta?",
          },
          {
            chave: "voltaria",
            tipo: "sim_nao",
            texto: "Você voltaria a trabalhar aqui?",
            config: { respostaBoa: "sim" },
          },
          {
            tipo: "paragrafo",
            texto: "O que precisaria mudar?",
            obrigatoria: false,
            condicao: { chave: "voltaria", opcao: "nao" },
          },
          {
            tipo: "paragrafo",
            texto: "Deixe uma sugestão para quem fica.",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    modelo: "beneficios",
    nome: "Satisfação com benefícios",
    categoria: "outros",
    descricao:
      "Quais benefícios as pessoas usam, quais valorizam mais e o que está faltando.",
    nomeSugerido: "Satisfação com benefícios",
    boasVindas: "Leva cerca de três minutos.",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "estrelas",
            texto: "No geral, como você avalia os benefícios oferecidos?",
          },
          {
            tipo: "multipla_escolha",
            texto: "Quais benefícios você usa com frequência?",
            opcoes: BENEFICIOS_COMUNS,
            config: { outro: true },
          },
          {
            tipo: "escolha_unica",
            texto: "Qual deles é o mais importante para você?",
            opcoes: BENEFICIOS_COMUNS,
            config: { outro: true },
          },
          concordo("As regras de cada benefício são fáceis de entender."),
          concordo("Sei como pedir ajuda quando um benefício não funciona."),
          {
            chave: "falta",
            tipo: "sim_nao",
            texto:
              "Existe algum benefício que você gostaria de ter e ainda não tem?",
            config: { respostaBoa: null },
          },
          {
            tipo: "texto_curto",
            texto: "Qual?",
            condicao: { chave: "falta", opcao: "sim" },
          },
        ],
      },
    ],
  },
  {
    modelo: "treinamento",
    nome: "Avaliação de treinamento",
    categoria: "outros",
    descricao:
      "Depois de um curso ou treinamento: conteúdo, condução e o quanto o aprendizado vai para a prática.",
    nomeSugerido: "Avaliação de treinamento",
    boasVindas: null,
    secoes: [
      {
        titulo: "O treinamento",
        perguntas: [
          { tipo: "texto_curto", texto: "Qual treinamento você fez?" },
          {
            tipo: "data",
            texto: "Em que dia ele terminou?",
            obrigatoria: false,
          },
          { tipo: "estrelas", texto: "Como você avalia o conteúdo?" },
          { tipo: "estrelas", texto: "Como você avalia a condução?" },
        ],
      },
      {
        titulo: "Na prática",
        perguntas: [
          {
            tipo: "escala",
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
            texto:
              "Quantas horas você dedicou, contando o estudo fora das aulas?",
            obrigatoria: false,
            config: { minimo: 0, maximo: 500, inteiro: true },
          },
          {
            tipo: "paragrafo",
            texto: "O que pode melhorar para a próxima turma?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    modelo: "personalizada",
    nome: "Personalizada",
    categoria: "outros",
    descricao:
      "Comece em branco e monte as seções e perguntas do seu jeito, com os 11 tipos de pergunta.",
    nomeSugerido: "",
    boasVindas: null,
    secoes: [{ titulo: null, perguntas: [] }],
  },
];

export function modeloDaGaleria(modelo: ModeloPesquisa): ModeloDaGaleria {
  return (
    MODELOS_DE_PESQUISA.find((m) => m.modelo === modelo) ??
    MODELOS_DE_PESQUISA[MODELOS_DE_PESQUISA.length - 1]!
  );
}

/** Quantas perguntas o modelo traz (card = gaveta = assistente). */
export function totalDePerguntas(m: ModeloDaGaleria): number {
  return m.secoes.reduce((t, s) => t + s.perguntas.length, 0);
}

/** As seções do modelo com ids novos (perguntas, opções e condições). */
export function secoesDoModelo(m: ModeloDaGaleria): Secao[] {
  const idDaChave = new Map<string, Pergunta>();
  return m.secoes.map((s) => ({
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
      };
      if (p.chave) idDaChave.set(p.chave, pergunta);
      return pergunta;
    }),
  }));
}
