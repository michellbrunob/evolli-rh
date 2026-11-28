import type { Pergunta, Secao } from "../../pesquisas.types";
import type { EstruturaFixa } from "../tipos";

/**
 * T216 — Avaliação 90° e 180°: o catálogo fixo (8 competências × 3
 * afirmações, escala de 1 a 5). O mesmo banco serve aos dois modelos. Cada
 * afirmação tem duas redações: a do gestor (sobre a pessoa) e a da
 * autoavaliação (na 1ª pessoa). Os textos são do Evolli; ids, ordem e grupos
 * são fixos para comparar times e ciclos.
 */

export const MODELOS_DE_AVALIACAO = ["avaliacao90", "avaliacao180"] as const;
export type ModeloDeAvaliacao = (typeof MODELOS_DE_AVALIACAO)[number];

export function ehAvaliacao(modelo: string): modelo is ModeloDeAvaliacao {
  return (MODELOS_DE_AVALIACAO as readonly string[]).includes(modelo);
}

export type Eixo = "entrega" | "pessoas";

export const COMPETENCIAS = [
  "comunicacao",
  "trabalho_equipe",
  "proatividade",
  "organizacao",
  "responsabilidade",
  "adaptabilidade",
  "lideranca",
  "resolucao_problemas",
] as const;
export type Competencia = (typeof COMPETENCIAS)[number];

export interface ItemDaAvaliacao {
  readonly id: string;
  /** Como o gestor lê (sobre a pessoa avaliada). */
  readonly gestor: string;
  /** Como a pessoa lê na autoavaliação (1ª pessoa). */
  readonly autoavaliacao: string;
  /** Rótulo curto (tabelas). */
  readonly rotulo: string;
}

export interface CompetenciaDaAvaliacao {
  readonly id: Competencia;
  readonly rotulo: string;
  readonly eixo: Eixo;
  readonly itens: readonly [ItemDaAvaliacao, ItemDaAvaliacao, ItemDaAvaliacao];
}

export const CATALOGO: readonly CompetenciaDaAvaliacao[] = [
  {
    id: "comunicacao",
    rotulo: "Comunicação",
    eixo: "pessoas",
    itens: [
      {
        id: "com_1",
        gestor: "Expõe ideias e informações de forma clara e direta.",
        autoavaliacao: "Exponho ideias e informações de forma clara e direta.",
        rotulo: "Clareza",
      },
      {
        id: "com_2",
        gestor:
          "Ouve com atenção e considera o ponto de vista dos outros antes de responder.",
        autoavaliacao:
          "Ouço com atenção e considero o ponto de vista dos outros antes de responder.",
        rotulo: "Escuta",
      },
      {
        id: "com_3",
        gestor:
          "Dá e recebe retornos sobre o trabalho com respeito e abertura.",
        autoavaliacao:
          "Dou e recebo retornos sobre o trabalho com respeito e abertura.",
        rotulo: "Retorno sobre o trabalho",
      },
    ],
  },
  {
    id: "trabalho_equipe",
    rotulo: "Trabalho em equipe",
    eixo: "pessoas",
    itens: [
      {
        id: "teq_1",
        gestor: "Colabora com o time para alcançar objetivos em comum.",
        autoavaliacao: "Colaboro com o time para alcançar objetivos em comum.",
        rotulo: "Colaboração",
      },
      {
        id: "teq_2",
        gestor: "Ajuda colegas quando precisam, sem esperar que insistam.",
        autoavaliacao:
          "Ajudo colegas quando precisam, sem esperar que insistam.",
        rotulo: "Ajuda aos colegas",
      },
      {
        id: "teq_3",
        gestor: "Contribui para um ambiente de confiança e respeito no time.",
        autoavaliacao:
          "Contribuo para um ambiente de confiança e respeito no time.",
        rotulo: "Confiança",
      },
    ],
  },
  {
    id: "proatividade",
    rotulo: "Proatividade",
    eixo: "entrega",
    itens: [
      {
        id: "pro_1",
        gestor: "Toma a iniciativa sem esperar que alguém peça.",
        autoavaliacao: "Tomo a iniciativa sem esperar que alguém peça.",
        rotulo: "Iniciativa",
      },
      {
        id: "pro_2",
        gestor: "Sugere melhorias para o trabalho e para os processos.",
        autoavaliacao: "Sugiro melhorias para o trabalho e para os processos.",
        rotulo: "Melhorias",
      },
      {
        id: "pro_3",
        gestor: "Antecipa riscos e problemas antes que aconteçam.",
        autoavaliacao: "Antecipo riscos e problemas antes que aconteçam.",
        rotulo: "Antecipação",
      },
    ],
  },
  {
    id: "organizacao",
    rotulo: "Organização",
    eixo: "entrega",
    itens: [
      {
        id: "org_1",
        gestor: "Cumpre os prazos combinados.",
        autoavaliacao: "Cumpro os prazos combinados.",
        rotulo: "Prazos",
      },
      {
        id: "org_2",
        gestor: "Planeja as atividades e define prioridades com critério.",
        autoavaliacao:
          "Planejo as atividades e defino prioridades com critério.",
        rotulo: "Planejamento",
      },
      {
        id: "org_3",
        gestor: "Mantém as próprias demandas organizadas e sob controle.",
        autoavaliacao:
          "Mantenho as minhas demandas organizadas e sob controle.",
        rotulo: "Controle das demandas",
      },
    ],
  },
  {
    id: "responsabilidade",
    rotulo: "Responsabilidade",
    eixo: "entrega",
    itens: [
      {
        id: "res_1",
        gestor: "Demonstra compromisso com as entregas e os resultados.",
        autoavaliacao: "Demonstro compromisso com as entregas e os resultados.",
        rotulo: "Compromisso",
      },
      {
        id: "res_2",
        gestor: "Busca qualidade em tudo o que entrega.",
        autoavaliacao: "Busco qualidade em tudo o que entrego.",
        rotulo: "Qualidade",
      },
      {
        id: "res_3",
        gestor: "Reconhece os próprios erros e age para corrigi-los.",
        autoavaliacao: "Reconheço os meus erros e ajo para corrigi-los.",
        rotulo: "Correção de erros",
      },
    ],
  },
  {
    id: "adaptabilidade",
    rotulo: "Adaptabilidade",
    eixo: "pessoas",
    itens: [
      {
        id: "ada_1",
        gestor: "Lida bem com mudanças no trabalho.",
        autoavaliacao: "Lido bem com mudanças no trabalho.",
        rotulo: "Mudanças",
      },
      {
        id: "ada_2",
        gestor: "Mostra disposição para aprender coisas novas.",
        autoavaliacao: "Mostro disposição para aprender coisas novas.",
        rotulo: "Aprendizado",
      },
      {
        id: "ada_3",
        gestor: "Ajusta a forma de trabalhar quando as prioridades mudam.",
        autoavaliacao:
          "Ajusto a forma de trabalhar quando as prioridades mudam.",
        rotulo: "Flexibilidade",
      },
    ],
  },
  {
    id: "lideranca",
    rotulo: "Liderança",
    eixo: "pessoas",
    itens: [
      {
        id: "lid_1",
        gestor: "Influencia o time de forma positiva.",
        autoavaliacao: "Influencio o time de forma positiva.",
        rotulo: "Influência",
      },
      {
        id: "lid_2",
        gestor: "Motiva e inspira as pessoas ao redor.",
        autoavaliacao: "Motivo e inspiro as pessoas ao meu redor.",
        rotulo: "Motivação",
      },
      {
        id: "lid_3",
        gestor: "Orienta os outros com clareza e empatia.",
        autoavaliacao: "Oriento os outros com clareza e empatia.",
        rotulo: "Orientação",
      },
    ],
  },
  {
    id: "resolucao_problemas",
    rotulo: "Resolução de problemas",
    eixo: "entrega",
    itens: [
      {
        id: "rpr_1",
        gestor: "Analisa os fatos com lógica antes de decidir.",
        autoavaliacao: "Analiso os fatos com lógica antes de decidir.",
        rotulo: "Análise",
      },
      {
        id: "rpr_2",
        gestor: "Encontra alternativas criativas para resolver problemas.",
        autoavaliacao:
          "Encontro alternativas criativas para resolver problemas.",
        rotulo: "Criatividade",
      },
      {
        id: "rpr_3",
        gestor: "Toma decisões com segurança e bons argumentos.",
        autoavaliacao: "Tomo decisões com segurança e bons argumentos.",
        rotulo: "Decisão",
      },
    ],
  },
];

/** Os 5 pontos da escala (1 a 5), na ordem. */
export const ROTULOS_DA_ESCALA = [
  "Insuficiente",
  "Em desenvolvimento",
  "Bom",
  "Excelente",
  "Excepcional",
] as const;

/** Todas as afirmações na ordem global (competência × 3 + item). */
export const ITENS: readonly (ItemDaAvaliacao & {
  readonly competencia: Competencia;
  readonly ordem: number;
})[] = CATALOGO.flatMap((c, ic) =>
  c.itens.map((i, ii) => ({ ...i, competencia: c.id, ordem: ic * 3 + ii })),
);

export const TOTAL_DE_AFIRMACOES = ITENS.length; // 24

const COMPETENCIA_DO_ITEM = new Map(ITENS.map((i) => [i.id, i.competencia]));

export function competenciaDoItem(itemId: string): Competencia | null {
  return COMPETENCIA_DO_ITEM.get(itemId) ?? null;
}

export function competenciaPorId(id: Competencia): CompetenciaDaAvaliacao {
  return CATALOGO.find((c) => c.id === id)!;
}

/**
 * As seções gravadas na pesquisa: uma por competência, com as 3 afirmações na
 * redação do gestor (a autoavaliação usa a do catálogo, pelo id).
 */
export function secoesDaAvaliacao(): Secao[] {
  return CATALOGO.map((c) => ({
    id: c.id,
    titulo: c.rotulo,
    descricao: null,
    perguntas: c.itens.map((i): Pergunta => ({
      id: i.id,
      chave: i.id,
      tipo: "escala",
      texto: i.gestor,
      rotulo: i.rotulo,
      descricao: null,
      obrigatoria: true,
      config: {
        minimo: 1,
        maximo: 5,
        rotuloMinimo: ROTULOS_DA_ESCALA[0],
        rotuloMaximo: ROTULOS_DA_ESCALA[4],
        rotulos: [...ROTULOS_DA_ESCALA],
      },
      condicao: null,
    })),
  }));
}

/**
 * A metodologia fixa para o registro dos modelos: as 24 afirmações (pela
 * chave), escala de 1 a 5, todas obrigatórias.
 */
export const ESTRUTURA_DA_AVALIACAO: EstruturaFixa = {
  itens: ITENS.map((i) => ({
    chave: i.id,
    tipo: "escala",
    obrigatoria: true,
    config: (c) => (c.minimo ?? 1) === 1 && (c.maximo ?? 5) === 5,
  })),
  opcionais: [],
};
