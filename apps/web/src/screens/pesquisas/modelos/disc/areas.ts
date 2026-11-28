/**
 * T216 — Perfil comportamental (DISC): as 13 áreas do mapa de talentos e a
 * compatibilidade entre os fatores (textos do Evolli). A geometria é a mesma
 * da API: plano 0–100, x de extroversão (0) a introversão (100), y de
 * emoção (0) a razão (100).
 */
import type { FatorDisc } from "./fatores";
import type { TipoDoPar } from "./tiposDisc";

export interface AreaDeTalento {
  readonly id: number;
  readonly nome: string;
  readonly fator: FatorDisc;
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly frase: string;
  readonly cargos: readonly [string, string, string];
  readonly forcas: readonly [string, string, string];
  readonly atencoes: readonly [string, string, string];
}

export const AREAS: readonly AreaDeTalento[] = [
  {
    id: 4,
    nome: "Catalisador",
    fator: "I",
    x: [0, 33],
    y: [0, 33],
    frase: "Dá partida nas coisas com energia e poder de convencimento.",
    cargos: ["Vendas", "Relações públicas", "Eventos"],
    forcas: ["Entusiasmo", "Persuasão", "Iniciativa social"],
    atencoes: ["Dispersão", "Pouco acompanhamento", "Promessas demais"],
  },
  {
    id: 7,
    nome: "Inspirador",
    fator: "I",
    x: [33, 75],
    y: [0, 33],
    frase: "Engaja as pessoas em torno de um propósito.",
    cargos: ["Comunicação interna", "Treinamento", "Cultura e engajamento"],
    forcas: ["Visão de propósito", "Carisma", "Otimismo"],
    atencoes: ["Detalhes", "Prazos", "Decisões difíceis"],
  },
  {
    id: 8,
    nome: "Harmonizador",
    fator: "S",
    x: [75, 100],
    y: [0, 33],
    frase: "Cuida do clima e mantém o ritmo do grupo.",
    cargos: ["Atendimento", "Gente e gestão", "Suporte ao cliente"],
    forcas: ["Empatia", "Calma", "Escuta"],
    atencoes: ["Conflitos evitados", "Mudanças", "Dizer não"],
  },
  {
    id: 3,
    nome: "Mobilizador",
    fator: "D",
    x: [0, 33],
    y: [33, 75],
    frase: "Puxa a mudança e coloca o time em movimento.",
    cargos: [
      "Gestão de projetos",
      "Expansão de negócios",
      "Liderança de times",
    ],
    forcas: ["Coragem", "Ação rápida", "Influência"],
    atencoes: ["Impaciência", "Atropelar processos", "Escuta"],
  },
  {
    id: 5,
    nome: "Articulador",
    fator: "I",
    x: [33, 50],
    y: [33, 50],
    frase: "Vende ideias e liga áreas que não conversam.",
    cargos: ["Parcerias", "Produto", "Relacionamento com clientes"],
    forcas: ["Negociação", "Rede de contatos", "Flexibilidade"],
    atencoes: ["Foco", "Documentação", "Excesso de frentes"],
  },
  {
    id: 6,
    nome: "Conector",
    fator: "I",
    x: [50, 67],
    y: [33, 50],
    frase: "Constrói pontes entre pessoas e times.",
    cargos: ["Recursos humanos", "Sucesso do cliente", "Facilitação"],
    forcas: ["Relacionamento", "Colaboração", "Mediação"],
    atencoes: ["Dizer não", "Prioridades", "Conversas difíceis"],
  },
  {
    id: 9,
    nome: "Facilitador",
    fator: "S",
    x: [67, 83],
    y: [33, 50],
    frase: "Sustenta o time com um ritmo estável e prestativo.",
    cargos: ["Operações", "Administrativo", "Coordenação de equipe"],
    forcas: ["Constância", "Apoio", "Organização do dia a dia"],
    atencoes: ["Resistência a mudanças", "Iniciativa", "Exposição"],
  },
  {
    id: 10,
    nome: "Mentor",
    fator: "C",
    x: [83, 100],
    y: [33, 75],
    frase: "Ajuda as pessoas a crescer, com critério e paciência.",
    cargos: ["Qualidade", "Treinamento técnico", "Coordenação técnica"],
    forcas: ["Didática", "Paciência", "Critério"],
    atencoes: ["Velocidade", "Exigência alta", "Delegar"],
  },
  {
    id: 2,
    nome: "Realizador",
    fator: "D",
    x: [33, 67],
    y: [50, 75],
    frase: "Entrega resultado com método e equilíbrio.",
    cargos: ["Gestão de área", "Planejamento", "Coordenação de projetos"],
    forcas: ["Equilíbrio", "Entrega", "Adaptação"],
    atencoes: ["Falta de marca própria", "Sobrecarga", "Indecisão em empates"],
  },
  {
    id: 12,
    nome: "Estrategista",
    fator: "C",
    x: [67, 83],
    y: [50, 75],
    frase: "Pensa no longo prazo e antecipa cenários.",
    cargos: ["Estratégia", "Controladoria", "Inteligência de mercado"],
    forcas: ["Visão de futuro", "Análise", "Planejamento"],
    atencoes: ["Ritmo lento", "Distância das pessoas", "Excesso de análise"],
  },
  {
    id: 1,
    nome: "Executor",
    fator: "D",
    x: [0, 33],
    y: [75, 100],
    frase: "Age rápido e não deixa a entrega parar.",
    cargos: ["Operações comerciais", "Produção", "Implantação"],
    forcas: ["Velocidade", "Foco", "Determinação"],
    atencoes: ["Impaciência", "Qualidade", "Escuta"],
  },
  {
    id: 13,
    nome: "Analista",
    fator: "D",
    x: [33, 75],
    y: [75, 100],
    frase: "Decide com base em dados e números.",
    cargos: ["Finanças", "Dados e indicadores", "Auditoria"],
    forcas: ["Objetividade", "Raciocínio lógico", "Decisão com dados"],
    atencoes: ["Frieza aparente", "Pouca flexibilidade", "Comunicação"],
  },
  {
    id: 11,
    nome: "Guardião",
    fator: "C",
    x: [75, 100],
    y: [75, 100],
    frase: "Protege regras, padrões e a qualidade da entrega.",
    cargos: ["Compliance", "Contabilidade", "Engenharia de qualidade"],
    forcas: ["Rigor", "Organização", "Confiabilidade"],
    atencoes: ["Perfeccionismo", "Rigidez", "Lentidão para decidir"],
  },
];

export const areaPorId = (id: number) => AREAS.find((a) => a.id === id);

export interface ParDeFatoresTexto {
  readonly resumo: string;
  readonly dica: string;
}

/** A relação de cada par (chave em ordem D, I, S, C: "DS", "IC"…). */
export const PARES: Readonly<Record<string, ParDeFatoresTexto>> = {
  DD: {
    resumo: "Disputa pelo comando",
    dica: "Defina quem decide o quê antes de começar.",
  },
  DI: {
    resumo: "Ação com energia",
    dica: "Bom par para abrir frentes; garanta quem acompanha os detalhes.",
  },
  DS: {
    resumo: "Ritmos diferentes",
    dica: "Combine prazos e explique o contexto antes de cobrar.",
  },
  DC: {
    resumo: "Velocidade e precisão",
    dica: "Use a análise de C para diminuir o risco das decisões rápidas.",
  },
  II: {
    resumo: "Muita troca e entusiasmo",
    dica: "Registre o combinado para a ideia virar entrega.",
  },
  IS: {
    resumo: "Clima bom e cooperação",
    dica: "Cuidem juntos das conversas difíceis que ambos evitam.",
  },
  IC: {
    resumo: "Emoção e dados",
    dica: "Traga fatos para a conversa e espaço para as ideias.",
  },
  SS: {
    resumo: "Constância e confiança",
    dica: "Provoquem melhorias de propósito, para não acomodar.",
  },
  SC: {
    resumo: "Rotina com qualidade",
    dica: "Ótimo para processos; combinem como reagir a mudanças.",
  },
  CC: {
    resumo: "Excesso de análise",
    dica: "Combinem um prazo para decidir com a informação que houver.",
  },
};

export const ROTULO_DO_PAR: Readonly<Record<TipoDoPar, string>> = {
  mesma_linguagem: "Mesma linguagem",
  complementar: "Complementar",
  pede_atencao: "Pede atenção",
};

export const ROTULO_DA_RELACAO = {
  sinergia: "Sinergia",
  neutro: "Neutra",
  atrito: "Atrito",
} as const;
