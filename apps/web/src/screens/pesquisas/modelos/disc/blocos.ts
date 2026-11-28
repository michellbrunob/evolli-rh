/**
 * T216 — Perfil comportamental (DISC): os 28 blocos, com textos do Evolli.
 * Cada bloco mede um tema e traz 4 frases curtas, em 1ª pessoa, sempre na
 * ordem D, I, S, C (a página de resposta embaralha a ordem de cada bloco).
 * A empresa pode trocar os textos por outros que tenha licença para usar,
 * mantendo o fator de cada frase.
 */

/** O item fixo do bloco (`Pergunta.chave`): `disc_01` a `disc_28`. */
export const chaveDoBloco = (indice: number) =>
  `disc_${String(indice + 1).padStart(2, "0")}`;

/** O enunciado fixo de cada bloco. */
export const PERGUNTA_DO_BLOCO = "Qual frase combina mais com você?";

export interface BlocoDisc {
  /** O tema medido (aparece só para o RH). */
  readonly tema: string;
  /** D, I, S, C. */
  readonly frases: readonly [string, string, string, string];
}

export const BLOCOS_DISC: readonly BlocoDisc[] = [
  {
    tema: "O que gosta de fazer",
    frases: [
      "Gosto de assumir desafios que pedem iniciativa.",
      "Gosto de conversar e conhecer gente nova.",
      "Gosto de ajudar quem trabalha comigo.",
      "Gosto de entender como as coisas funcionam por dentro.",
    ],
  },
  {
    tema: "Estilo de conversa",
    frases: [
      "Vou direto ao ponto quando falo.",
      "Conto histórias e deixo a conversa animada.",
      "Escuto com calma antes de responder.",
      "Escolho as palavras com cuidado e precisão.",
    ],
  },
  {
    tema: "Papel preferido",
    frases: [
      "Prefiro conduzir e tomar as decisões do grupo.",
      "Prefiro animar o grupo e trazer ideias.",
      "Prefiro apoiar o grupo para que tudo ande bem.",
      "Prefiro revisar e garantir que nada saia errado.",
    ],
  },
  {
    tema: "O que motiva",
    frases: [
      "Metas ousadas e resultados visíveis me motivam.",
      "Reconhecimento e contato com pessoas me motivam.",
      "Segurança e um ambiente acolhedor me motivam.",
      "Trabalho bem feito e padrões claros me motivam.",
    ],
  },
  {
    tema: "O que lida bem",
    frases: [
      "Lido bem com pressão e prazos curtos.",
      "Lido bem com mudanças e novidades.",
      "Lido bem com rotina e tarefas contínuas.",
      "Lido bem com detalhes e tarefas minuciosas.",
    ],
  },
  {
    tema: "Como decide",
    frases: [
      "Decido rápido, mesmo com pouca informação.",
      "Decido pelo que sinto e pelo que o grupo pensa.",
      "Decido com calma, depois de ouvir todo mundo.",
      "Decido depois de analisar dados e alternativas.",
    ],
  },
  {
    tema: "Conflitos",
    frases: [
      "Num conflito, enfrento a questão de frente.",
      "Num conflito, tento aliviar o clima e convencer.",
      "Num conflito, busco acalmar e manter a paz.",
      "Num conflito, recorro a fatos e regras.",
    ],
  },
  {
    tema: "O que valoriza",
    frases: [
      "Valorizo autonomia para agir.",
      "Valorizo liberdade para me expressar.",
      "Valorizo lealdade e confiança.",
      "Valorizo exatidão e qualidade.",
    ],
  },
  {
    tema: "Traço marcante",
    frases: [
      "Gosto de competir e de vencer.",
      "Gosto de estar no meio das pessoas.",
      "Cumpro o que prometo, sempre.",
      "Cuido de cada detalhe.",
    ],
  },
  {
    tema: "Forma de trabalhar",
    frases: [
      "Trabalho melhor quando controlo o resultado.",
      "Trabalho melhor em equipe, trocando ideias.",
      "Trabalho melhor num ritmo constante e previsível.",
      "Trabalho melhor com processos bem definidos.",
    ],
  },
  {
    tema: "Estilo de comunicação",
    frases: [
      "Minha comunicação é firme e objetiva.",
      "Minha comunicação é expressiva e cheia de energia.",
      "Minha comunicação é gentil e paciente.",
      "Minha comunicação é clara e bem fundamentada.",
    ],
  },
  {
    tema: "Reação ao estresse",
    frases: [
      "Sob pressão, fico impaciente e exigente.",
      "Sob pressão, falo mais e perco o foco.",
      "Sob pressão, me recolho e evito o confronto.",
      "Sob pressão, passo a revisar e criticar tudo.",
    ],
  },
  {
    tema: "Risco e novidade",
    frases: [
      "Arrisco quando vejo chance de ganhar.",
      "Topo novidades com entusiasmo.",
      "Prefiro o que já é conhecido e testado.",
      "Só arrisco depois de medir as consequências.",
    ],
  },
  {
    tema: "Foco",
    frases: [
      "Meu foco é chegar ao resultado.",
      "Meu foco é envolver as pessoas.",
      "Meu foco é cooperar com o time.",
      "Meu foco é a qualidade da entrega.",
    ],
  },
  {
    tema: "Adaptação a mudanças",
    frases: [
      "Diante de uma mudança, tomo a frente.",
      "Diante de uma mudança, vejo oportunidades novas.",
      "Diante de uma mudança, preciso de tempo para me ajustar.",
      "Diante de uma mudança, quero entender o motivo e o plano.",
    ],
  },
  {
    tema: "Forma de influenciar",
    frases: [
      "Influencio pela firmeza.",
      "Influencio pelo carisma.",
      "Influencio pelo exemplo e pela constância.",
      "Influencio pelo conhecimento técnico.",
    ],
  },
  {
    tema: "O que gosta de garantir",
    frases: [
      "Gosto de garantir que a meta seja batida.",
      "Gosto de garantir que todo mundo esteja engajado.",
      "Gosto de garantir que ninguém fique para trás.",
      "Gosto de garantir que tudo siga o combinado.",
    ],
  },
  {
    tema: "O que busca sempre",
    frases: [
      "Busco sempre vencer o próximo desafio.",
      "Busco sempre novas conexões.",
      "Busco sempre estabilidade.",
      "Busco sempre fazer do jeito certo.",
    ],
  },
  {
    tema: "Ponto forte",
    frases: [
      "Meu ponto forte é a determinação.",
      "Meu ponto forte é a comunicação.",
      "Meu ponto forte é a paciência.",
      "Meu ponto forte é a organização.",
    ],
  },
  {
    tema: "Ambiente preferido",
    frases: [
      "Prefiro ambientes dinâmicos e competitivos.",
      "Prefiro ambientes alegres e colaborativos.",
      "Prefiro ambientes tranquilos e harmoniosos.",
      "Prefiro ambientes organizados e silenciosos.",
    ],
  },
  {
    tema: "Estilo ao liderar",
    frases: [
      "Ao liderar, cobro resultado e dou direção.",
      "Ao liderar, inspiro e animo o grupo.",
      "Ao liderar, apoio e cuido de cada pessoa.",
      "Ao liderar, defino padrões e acompanho a qualidade.",
    ],
  },
  {
    tema: "Condição ideal de trabalho",
    frases: [
      "Rendo mais quando tenho liberdade para decidir.",
      "Rendo mais quando posso interagir bastante.",
      "Rendo mais quando sei o que esperar.",
      "Rendo mais quando tenho tempo para fazer bem feito.",
    ],
  },
  {
    tema: "O que frustra",
    frases: [
      "Lentidão me frustra.",
      "Trabalhar sem contato com ninguém me frustra.",
      "Mudanças bruscas me frustram.",
      "Erros por descuido me frustram.",
    ],
  },
  {
    tema: "Crença",
    frases: [
      "Acredito que quem age primeiro sai na frente.",
      "Acredito que boas relações abrem portas.",
      "Acredito que juntos vamos mais longe.",
      "Acredito que o cuidado evita retrabalho.",
    ],
  },
  {
    tema: "Como é visto",
    frases: [
      "As pessoas dizem que tenho pulso firme.",
      "As pessoas dizem que tenho alegria contagiante.",
      "As pessoas dizem que transmito calma.",
      "As pessoas dizem que tenho muito cuidado.",
    ],
  },
  {
    tema: "Papel no time",
    frases: [
      "No time, puxo a execução.",
      "No time, uno e animo as pessoas.",
      "No time, dou suporte a quem precisa.",
      "No time, confiro os detalhes.",
    ],
  },
  {
    tema: "Maior receio",
    frases: [
      "Meu maior receio é perder o controle da situação.",
      "Meu maior receio é a rejeição.",
      "Meu maior receio é a instabilidade.",
      "Meu maior receio é errar.",
    ],
  },
  {
    tema: "O que precisa desenvolver",
    frases: [
      "Preciso desenvolver a paciência com os outros.",
      "Preciso desenvolver a atenção aos detalhes.",
      "Preciso desenvolver a coragem para mudar.",
      "Preciso desenvolver a flexibilidade.",
    ],
  },
];
