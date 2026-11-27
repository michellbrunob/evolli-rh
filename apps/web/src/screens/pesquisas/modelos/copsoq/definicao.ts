/**
 * T216 — Riscos psicossociais (NR-1): o catálogo do modelo na tela.
 *
 * Estrutura igual à do servidor (`apps/api/.../modelos/copsoq/definicao.ts`):
 * 76 perguntas (Q1 a Q76) em 8 domínios e 29 dimensões, cinco escalas de 5
 * pontos. Os enunciados são do Evolli e medem o mesmo ponto de cada item; a
 * empresa pode trocá-los pela redação oficial do instrumento, se tiver
 * licença — o servidor guarda só o texto e mantém ids, escalas e ordem.
 */
import type { ModeloDaGaleria } from "../../modelosDePesquisa";

export type EscalaNr1 =
  "frequencia" | "intensidade" | "concordancia" | "satisfacao" | "saude";

export const ESCALAS_NR1: Readonly<
  Record<
    EscalaNr1,
    { readonly nome: string; readonly rotulos: readonly string[] }
  >
> = {
  frequencia: {
    nome: "Frequência",
    rotulos: [
      "Nunca / Quase nunca",
      "Raramente",
      "Às vezes",
      "Frequentemente",
      "Sempre",
    ],
  },
  intensidade: {
    nome: "Intensidade",
    rotulos: [
      "Nada / Quase nada",
      "Um pouco",
      "Moderadamente",
      "Muito",
      "Extremamente",
    ],
  },
  concordancia: {
    nome: "Concordância",
    rotulos: [
      "Discordo totalmente",
      "Discordo",
      "Nem concordo nem discordo",
      "Concordo",
      "Concordo totalmente",
    ],
  },
  satisfacao: {
    nome: "Satisfação",
    rotulos: [
      "Muito insatisfeito(a)",
      "Insatisfeito(a)",
      "Moderadamente satisfeito(a)",
      "Satisfeito(a)",
      "Muito satisfeito(a)",
    ],
  },
  // Do melhor para o pior, como aparece para quem responde.
  saude: {
    nome: "Saúde",
    rotulos: ["Excelente", "Muito boa", "Boa", "Regular", "Fraca"],
  },
};

export interface DominioNr1 {
  readonly id: string;
  readonly rotulo: string;
  readonly subtitulo: string;
  /** Cor do domínio (hex, só para gráficos e marcadores). */
  readonly cor: string;
}

export const DOMINIOS_NR1: readonly DominioNr1[] = [
  {
    id: "exigencias_laborais",
    rotulo: "Exigências Laborais",
    subtitulo: "O volume e o ritmo de trabalho",
    cor: "#EF4444",
  },
  {
    id: "organizacao_conteudo",
    rotulo: "Organização e Conteúdo do Trabalho",
    subtitulo: "Autonomia e sentido no trabalho",
    cor: "#8B5CF6",
  },
  {
    id: "relacoes_sociais_lideranca",
    rotulo: "Relações Sociais e Liderança",
    subtitulo: "Clareza, apoio e qualidade da liderança",
    cor: "#3B82F6",
  },
  {
    id: "interface_trabalho_individuo",
    rotulo: "Interface Trabalho-Indivíduo",
    subtitulo: "Segurança, satisfação e vida pessoal",
    cor: "#F59E0B",
  },
  {
    id: "valores_local_trabalho",
    rotulo: "Valores no Local de Trabalho",
    subtitulo: "Confiança, justiça e convivência",
    cor: "#14B8A6",
  },
  {
    id: "personalidade",
    rotulo: "Personalidade",
    subtitulo: "Capacidade de lidar com problemas",
    cor: "#EC4899",
  },
  {
    id: "saude_bem_estar",
    rotulo: "Saúde e Bem-Estar",
    subtitulo: "Como o trabalho afeta a saúde",
    cor: "#10B981",
  },
  {
    id: "comportamentos_ofensivos",
    rotulo: "Comportamentos Ofensivos",
    subtitulo: "Assédio, ameaças e violência nos últimos 12 meses",
    cor: "#DC2626",
  },
];

export type TipoDeDimensao = "risco" | "protecao";

export interface DimensaoNr1 {
  readonly id: string;
  readonly rotulo: string;
  readonly dominio: string;
  readonly tipo: TipoDeDimensao;
  /** O que a dimensão observa, em uma frase. */
  readonly definicao: string;
}

const d = (
  id: string,
  rotulo: string,
  dominio: string,
  tipo: TipoDeDimensao,
  definicao: string,
): DimensaoNr1 => ({ id, rotulo, dominio, tipo, definicao });

export const DIMENSOES_NR1: readonly DimensaoNr1[] = [
  d(
    "exigencias_quantitativas",
    "Exigências Quantitativas",
    "exigencias_laborais",
    "risco",
    "Quanto trabalho há para o tempo disponível.",
  ),
  d(
    "ritmo_trabalho",
    "Ritmo de Trabalho",
    "exigencias_laborais",
    "risco",
    "A velocidade e a pressão de tempo ao longo da jornada.",
  ),
  d(
    "exigencias_cognitivas",
    "Exigências Cognitivas",
    "exigencias_laborais",
    "risco",
    "O quanto o trabalho pede decisões, memória e criação.",
  ),
  d(
    "exigencias_emocionais",
    "Exigências Emocionais",
    "exigencias_laborais",
    "risco",
    "Lidar com as emoções de clientes, pacientes ou alunos.",
  ),
  d(
    "influencia_trabalho",
    "Influência no Trabalho",
    "organizacao_conteudo",
    "protecao",
    "Poder decidir sobre as tarefas, o jeito de trabalhar e as pausas.",
  ),
  d(
    "possibilidades_desenvolvimento",
    "Possibilidades de Desenvolvimento",
    "organizacao_conteudo",
    "protecao",
    "Aprender e usar as próprias habilidades no trabalho.",
  ),
  d(
    "significado_trabalho",
    "Significado do Trabalho",
    "organizacao_conteudo",
    "protecao",
    "Ver sentido e importância no que se faz.",
  ),
  d(
    "compromisso_local_trabalho",
    "Compromisso com o Local de Trabalho",
    "organizacao_conteudo",
    "protecao",
    "Orgulho da empresa e vontade de recomendá-la.",
  ),
  d(
    "previsibilidade",
    "Previsibilidade",
    "relacoes_sociais_lideranca",
    "protecao",
    "Saber das mudanças com antecedência e ter a informação necessária.",
  ),
  d(
    "reconhecimento",
    "Reconhecimento (Recompensas)",
    "relacoes_sociais_lideranca",
    "protecao",
    "Valorização, respeito e justiça por parte da direção.",
  ),
  d(
    "transparencia_papel",
    "Transparência do Papel Laboral",
    "relacoes_sociais_lideranca",
    "protecao",
    "Clareza sobre o que se espera, as responsabilidades e os objetivos.",
  ),
  d(
    "conflitos_papeis",
    "Conflitos de Papéis Laborais",
    "relacoes_sociais_lideranca",
    "risco",
    "Tarefas contraditórias, desnecessárias ou sem os recursos certos.",
  ),
  d(
    "qualidade_lideranca",
    "Qualidade da Liderança",
    "relacoes_sociais_lideranca",
    "protecao",
    "A liderança planeja, desenvolve as pessoas e resolve conflitos.",
  ),
  d(
    "apoio_social_superiores",
    "Apoio Social de Superiores",
    "relacoes_sociais_lideranca",
    "protecao",
    "Ajuda, escuta e conversa sobre o trabalho com a liderança.",
  ),
  d(
    "apoio_social_colegas",
    "Apoio Social de Colegas",
    "relacoes_sociais_lideranca",
    "protecao",
    "Ajuda, escuta e reconhecimento entre colegas.",
  ),
  d(
    "inseguranca_laboral",
    "Insegurança Laboral",
    "interface_trabalho_individuo",
    "risco",
    "O receio de perder o emprego.",
  ),
  d(
    "satisfacao_laboral",
    "Satisfação Laboral",
    "interface_trabalho_individuo",
    "protecao",
    "Satisfação com perspectivas, condições, uso das habilidades e o trabalho.",
  ),
  d(
    "conflito_trabalho_familia",
    "Conflito Trabalho-Família",
    "interface_trabalho_individuo",
    "risco",
    "O trabalho tomando o espaço da vida pessoal e familiar.",
  ),
  d(
    "confianca_vertical",
    "Confiança Vertical",
    "valores_local_trabalho",
    "protecao",
    "Confiança entre a direção e as pessoas.",
  ),
  d(
    "confianca_horizontal",
    "Confiança Horizontal",
    "valores_local_trabalho",
    "protecao",
    "Confiança e abertura entre colegas.",
  ),
  d(
    "justica_respeito",
    "Justiça e Respeito",
    "valores_local_trabalho",
    "protecao",
    "Conflitos, sugestões e tarefas tratados com justiça.",
  ),
  d(
    "comunidade_social",
    "Comunidade Social no Trabalho",
    "valores_local_trabalho",
    "protecao",
    "Cooperação e bom convívio no ambiente de trabalho.",
  ),
  d(
    "autoeficacia",
    "Autoeficácia",
    "personalidade",
    "protecao",
    "A confiança em resolver os problemas que aparecem.",
  ),
  d(
    "saude_geral",
    "Saúde Geral",
    "saude_bem_estar",
    "protecao",
    "Como a pessoa avalia a própria saúde.",
  ),
  d(
    "stress",
    "Stress",
    "saude_bem_estar",
    "risco",
    "Tensão e a sensação de exigência acima do possível.",
  ),
  d(
    "burnout",
    "Burnout (Esgotamento)",
    "saude_bem_estar",
    "risco",
    "Esgotamento emocional e físico.",
  ),
  d(
    "problemas_dormir",
    "Problemas em Dormir",
    "saude_bem_estar",
    "risco",
    "O trabalho atrapalhando o sono.",
  ),
  d(
    "sintomas_depressivos",
    "Sintomas Depressivos",
    "saude_bem_estar",
    "risco",
    "Tristeza, desânimo e perda de interesse.",
  ),
  d(
    "comportamentos_ofensivos",
    "Comportamentos Ofensivos",
    "comportamentos_ofensivos",
    "risco",
    "Assédio, conduta sexual indesejada, ameaças e violência no último ano.",
  ),
];

export interface ItemNr1 {
  readonly id: string;
  readonly dimensao: string;
  readonly escala: EscalaNr1;
  readonly invertido: boolean;
  readonly texto: string;
}

/** [dimensão, escala, enunciados] em sequência: Q1, Q2, … Q76. */
const BLOCOS: readonly (readonly [string, EscalaNr1, readonly string[]])[] = [
  [
    "exigencias_quantitativas",
    "frequencia",
    [
      "Com que frequência o tempo não é suficiente para concluir todas as suas tarefas?",
      "Com que frequência você precisa trabalhar muito depressa?",
      "Com que frequência o trabalho que fica por fazer se acumula?",
    ],
  ],
  [
    "ritmo_trabalho",
    "frequencia",
    [
      "Com que frequência você precisa manter um ritmo acelerado durante toda a jornada?",
    ],
  ],
  [
    "exigencias_cognitivas",
    "frequencia",
    [
      "Com que frequência o seu trabalho pede decisões difíceis?",
      "Com que frequência você precisa guardar de memória muitas informações para trabalhar?",
      "Com que frequência o seu trabalho pede ideias novas e criatividade?",
    ],
  ],
  [
    "exigencias_emocionais",
    "frequencia",
    [
      "Com que frequência você precisa lidar com as emoções e os problemas de clientes, pacientes, alunos ou outras pessoas atendidas?",
    ],
  ],
  [
    "influencia_trabalho",
    "frequencia",
    [
      "Com que frequência você pode influenciar a quantidade de trabalho que recebe?",
      "Com que frequência você participa da decisão sobre o que vai fazer no trabalho?",
      "Com que frequência você pode decidir como fazer o seu trabalho?",
      "Com que frequência você pode escolher o momento de fazer uma pausa?",
    ],
  ],
  [
    "possibilidades_desenvolvimento",
    "frequencia",
    [
      "Com que frequência o seu trabalho permite aprender algo novo?",
      "Com que frequência você consegue usar no trabalho o que sabe e o que sabe fazer?",
      "Com que frequência o seu trabalho pede que você tome a iniciativa?",
    ],
  ],
  [
    "significado_trabalho",
    "frequencia",
    [
      "Com que frequência você sente que o seu trabalho faz sentido?",
      "Com que frequência você sente que o que faz no trabalho é importante?",
      "Com que frequência você se sente motivado(a) e envolvido(a) com o seu trabalho?",
    ],
  ],
  [
    "compromisso_local_trabalho",
    "frequencia",
    [
      "Com que frequência você indicaria a empresa como um bom lugar para trabalhar?",
      "Com que frequência você sente orgulho de fazer parte da empresa?",
    ],
  ],
  [
    "previsibilidade",
    "frequencia",
    [
      "Com que frequência você fica sabendo com antecedência das mudanças importantes que afetam o seu trabalho?",
      "Com que frequência você recebe as informações de que precisa para fazer bem o seu trabalho?",
    ],
  ],
  [
    "reconhecimento",
    "frequencia",
    [
      "Com que frequência a direção reconhece e valoriza o seu trabalho?",
      "Com que frequência você é tratado(a) com respeito pela direção?",
      "Com que frequência você é tratado(a) com justiça no trabalho?",
    ],
  ],
  [
    "transparencia_papel",
    "frequencia",
    [
      "Com que frequência você sabe exatamente o que se espera de você no trabalho?",
      "Com que frequência você tem clareza sobre as suas responsabilidades?",
      "Com que frequência você conhece os objetivos do seu trabalho?",
    ],
  ],
  [
    "conflitos_papeis",
    "frequencia",
    [
      "Com que frequência você precisa fazer tarefas que parecem desnecessárias?",
      "Com que frequência você faz coisas que, na sua opinião, deveriam ser feitas de outro jeito?",
      "Com que frequência você recebe tarefas sem os recursos suficientes para realizá-las?",
    ],
  ],
  [
    "qualidade_lideranca",
    "frequencia",
    [
      "Com que frequência a sua liderança direta cuida para que as pessoas tenham chance de se desenvolver?",
      "Com que frequência a sua liderança direta dá prioridade ao bem-estar no trabalho?",
      "Com que frequência a sua liderança direta organiza bem o trabalho?",
      "Com que frequência a sua liderança direta resolve bem os conflitos?",
    ],
  ],
  [
    "apoio_social_superiores",
    "frequencia",
    [
      "Com que frequência a sua liderança direta ajuda você quando precisa?",
      "Com que frequência a sua liderança direta conversa com você sobre como está o seu trabalho?",
      "Com que frequência a sua liderança direta escuta os seus problemas no trabalho?",
    ],
  ],
  [
    "apoio_social_colegas",
    "frequencia",
    [
      "Com que frequência os colegas ajudam você quando precisa?",
      "Com que frequência os colegas escutam os seus problemas no trabalho?",
      "Com que frequência os colegas comentam positivamente o seu trabalho?",
    ],
  ],
  [
    "inseguranca_laboral",
    "frequencia",
    ["Com que frequência você sente receio de perder o emprego?"],
  ],
  [
    "satisfacao_laboral",
    "satisfacao",
    [
      "Quão satisfeito(a) você está com as suas perspectivas de crescimento no trabalho?",
      "Quão satisfeito(a) você está com as condições físicas do seu local de trabalho?",
      "Quão satisfeito(a) você está com o uso que o trabalho faz das suas habilidades?",
      "De forma geral, quão satisfeito(a) você está com o seu trabalho?",
    ],
  ],
  [
    "conflito_trabalho_familia",
    "frequencia",
    [
      "Com que frequência o trabalho atrapalha a sua vida familiar ou social?",
      "Com que frequência você deixa de fazer tarefas de casa por causa do trabalho?",
      "Com que frequência o trabalho prejudica a sua vida pessoal?",
    ],
  ],
  [
    "confianca_vertical",
    "concordancia",
    [
      "A direção confia que as pessoas fazem bem o seu trabalho.",
      "A direção confia nas informações que recebe das pessoas.",
      "A direção trata as pessoas com confiança e respeito.",
    ],
  ],
  [
    "confianca_horizontal",
    "concordancia",
    [
      "Aqui as pessoas escondem informações umas das outras.",
      "Falta confiança entre as pessoas que trabalham aqui.",
      "Aqui as pessoas falam abertamente sobre os problemas.",
    ],
  ],
  [
    "justica_respeito",
    "concordancia",
    [
      "Os conflitos são resolvidos de forma justa.",
      "As sugestões das pessoas são levadas a sério.",
      "O trabalho é distribuído de forma justa.",
    ],
  ],
  [
    "comunidade_social",
    "concordancia",
    [
      "Existe um clima de cooperação entre as pessoas.",
      "O ambiente entre os colegas é bom.",
      "A relação entre as pessoas e a direção é boa.",
    ],
  ],
  [
    "autoeficacia",
    "concordancia",
    [
      "Consigo resolver os problemas difíceis se me esforçar o suficiente.",
      "Consigo lidar com os problemas que aparecem no trabalho.",
    ],
  ],
  ["saude_geral", "saude", ["De forma geral, como você avalia a sua saúde?"]],
  [
    "stress",
    "intensidade",
    [
      "Nas últimas 4 semanas, o quanto você se sentiu tenso(a)?",
      "Nas últimas 4 semanas, o quanto as exigências pareceram maiores do que você consegue dar conta?",
    ],
  ],
  [
    "burnout",
    "intensidade",
    [
      "Nas últimas 4 semanas, o quanto você se sentiu emocionalmente esgotado(a)?",
      "Nas últimas 4 semanas, o quanto você se sentiu fisicamente esgotado(a)?",
    ],
  ],
  [
    "problemas_dormir",
    "intensidade",
    [
      "Nas últimas 4 semanas, o quanto as preocupações dificultaram o seu sono?",
      "Nas últimas 4 semanas, o quanto você acordou à noite pensando no trabalho?",
    ],
  ],
  [
    "sintomas_depressivos",
    "intensidade",
    [
      "Nas últimas 4 semanas, o quanto você se sentiu triste ou desanimado(a)?",
      "Nas últimas 4 semanas, o quanto você perdeu o interesse pelas coisas do dia a dia?",
    ],
  ],
  [
    "comportamentos_ofensivos",
    "frequencia",
    [
      "Nos últimos 12 meses, com que frequência você sofreu humilhação, perseguição ou intimidação no trabalho?",
      "Nos últimos 12 meses, com que frequência você passou por comentários ou condutas de natureza sexual que não queria no trabalho?",
      "Nos últimos 12 meses, com que frequência você recebeu ameaças de violência no trabalho?",
      "Nos últimos 12 meses, com que frequência você sofreu violência física no trabalho?",
    ],
  ],
];

const INVERTIDOS = new Set(["Q53", "Q54"]);

export const ITENS_NR1: readonly ItemNr1[] = (() => {
  const itens: ItemNr1[] = [];
  for (const [dimensao, escala, textos] of BLOCOS) {
    for (const texto of textos) {
      const id = `Q${itens.length + 1}`;
      itens.push({
        id,
        dimensao,
        escala,
        invertido: INVERTIDOS.has(id),
        texto,
      });
    }
  }
  return itens;
})();

const POR_DIMENSAO = new Map(DIMENSOES_NR1.map((x) => [x.id, x]));
const POR_DOMINIO = new Map(DOMINIOS_NR1.map((x) => [x.id, x]));

export const dimensaoNr1 = (id: string): DimensaoNr1 => POR_DIMENSAO.get(id)!;
export const dominioNr1 = (id: string): DominioNr1 => POR_DOMINIO.get(id)!;

export const itensDoDominio = (dominio: string): ItemNr1[] =>
  ITENS_NR1.filter((i) => dimensaoNr1(i.dimensao).dominio === dominio);

export const dimensoesDoDominio = (dominio: string): DimensaoNr1[] =>
  DIMENSOES_NR1.filter((x) => x.dominio === dominio);

/** Os quatro tipos de comportamento ofensivo (Q73 a Q76). */
export const TIPOS_DE_OFENSA: readonly { id: string; rotulo: string }[] = [
  { id: "Q73", rotulo: "Assédio moral" },
  { id: "Q74", rotulo: "Conduta sexual indesejada" },
  { id: "Q75", rotulo: "Ameaça de violência" },
  { id: "Q76", rotulo: "Violência física" },
];

/** O modelo na galeria (a ligação com a galeria é feita à parte). */
export const MODELO_NR1: ModeloDaGaleria = {
  id: "copsoq",
  modelo: "copsoq",
  nome: "Riscos psicossociais (NR-1)",
  categoria: null,
  descricao:
    "76 perguntas padronizadas em 8 domínios para mapear os riscos psicossociais do trabalho.",
  cor: "--turno-verde",
  destaques: ["8 domínios", "Matriz de risco"],
  sobre:
    "Avalia como a organização do trabalho afeta a saúde mental e monta o inventário de riscos psicossociais que vai para o PGR.",
  ritmo: "Anual",
  frequencia: "Anual",
  nomeBase: "NR-1 · Riscos psicossociais",
  boasVindas:
    "Esta pesquisa olha para como o trabalho afeta você, como pede a NR-1. Não há resposta certa ou errada: responda com sinceridade, pensando no seu dia a dia. Leva cerca de 15 minutos.",
  secoes: DOMINIOS_NR1.map((dom) => ({
    id: dom.id,
    titulo: dom.rotulo,
    perguntas: itensDoDominio(dom.id).map((i) => {
      const rotulos = [...ESCALAS_NR1[i.escala].rotulos];
      return {
        id: i.id,
        tipo: "escala" as const,
        texto: i.texto,
        rotulo: `${i.id} · ${dimensaoNr1(i.dimensao).rotulo}`.slice(0, 40),
        config: {
          minimo: 1,
          maximo: 5,
          rotuloMinimo: rotulos[0]!,
          rotuloMaximo: rotulos[4]!,
          rotulos,
        },
      };
    }),
  })),
  comentarioFinal: null,
  perguntaPadrao: { tipo: "escala", config: { minimo: 1, maximo: 5 } },
  limite: ITENS_NR1.length,
};
