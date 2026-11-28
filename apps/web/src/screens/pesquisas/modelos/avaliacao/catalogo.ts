/**
 * T216 — Avaliação 90° e 180° (tela): o catálogo fixo — 8 competências × 3
 * afirmações de 1 a 5, com a redação do gestor (sobre a pessoa) e a da
 * autoavaliação (1ª pessoa) —, os níveis, o mapa de talentos e as leituras
 * do comparativo. É o mesmo catálogo que a API grava (ids, ordem e grupos
 * fixos para comparar times e ciclos); os textos são do Evolli.
 */
import type {
  ModeloPesquisa,
  Pergunta,
  Secao,
} from "../../../../api/pesquisasClient";
import type { StatusVariant } from "../../../../components";
import type { SecaoDoModelo } from "../tipos";

export const MODELOS_DE_AVALIACAO = ["avaliacao90", "avaliacao180"] as const;
export type ModeloDeAvaliacao = (typeof MODELOS_DE_AVALIACAO)[number];

export function ehAvaliacao(
  modelo: ModeloPesquisa | string,
): modelo is ModeloDeAvaliacao {
  return (MODELOS_DE_AVALIACAO as readonly string[]).includes(modelo);
}

export type Eixo = "entrega" | "pessoas";

/**
 * Tempo da avaliação: 4 minutos por pessoa avaliada (as 24 afirmações de
 * uma pessoa), vezes a quantidade. A MESMA regra nos e-mails do assistente
 * e na página pública.
 */
export const MINUTOS_POR_AVALIACAO = 4;

/** "cerca de 12 minutos (4 por pessoa avaliada)"; sem quantidade, por pessoa. */
export function textoDoTempoDaAvaliacao(pessoas: number): string {
  if (pessoas <= 0)
    return `cerca de ${MINUTOS_POR_AVALIACAO} minutos por pessoa avaliada`;
  const total = `cerca de ${MINUTOS_POR_AVALIACAO * pessoas} minutos`;
  return pessoas === 1
    ? total
    : `${total} (${MINUTOS_POR_AVALIACAO} por pessoa avaliada)`;
}

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
  readonly gestor: string;
  readonly autoavaliacao: string;
  readonly rotulo: string;
}

export interface CompetenciaDaAvaliacao {
  readonly id: Competencia;
  /** Token de cor (sem `var()`). */
  readonly cor: string;
  readonly rotulo: string;
  readonly eixo: Eixo;
  readonly itens: readonly [ItemDaAvaliacao, ItemDaAvaliacao, ItemDaAvaliacao];
}

export const CATALOGO: readonly CompetenciaDaAvaliacao[] = [
  {
    id: "comunicacao",
    cor: "--turno-azul",
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
    cor: "--turno-violeta",
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
    cor: "--turno-mostarda",
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
    cor: "--turno-verde",
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
    cor: "--status-danger-ink",
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
    cor: "--turno-ciano",
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
    cor: "--turno-indigo",
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
    cor: "--turno-roxo",
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

export const ROTULOS_DA_ESCALA = [
  "Insuficiente",
  "Em desenvolvimento",
  "Bom",
  "Excelente",
  "Excepcional",
] as const;

export const ITENS = CATALOGO.flatMap((c, ic) =>
  c.itens.map((i, ii) => ({ ...i, competencia: c.id, ordem: ic * 3 + ii })),
);

export function competencia(id: Competencia): CompetenciaDaAvaliacao {
  return CATALOGO.find((c) => c.id === id)!;
}

export function item(id: string) {
  return ITENS.find((i) => i.id === id) ?? null;
}

export const EIXOS: Readonly<Record<Eixo, { titulo: string; texto: string }>> =
  {
    entrega: { titulo: "Entrega", texto: "O que a pessoa faz acontecer" },
    pessoas: {
      titulo: "Pessoas",
      texto: "Como a pessoa trabalha com os outros",
    },
  };

export type Nivel =
  "insuficiente" | "em_desenvolvimento" | "bom" | "excelente" | "excepcional";

export const NIVEIS: Readonly<
  Record<
    Nivel,
    {
      rotulo: string;
      curto: string;
      faixa: string;
      tom: StatusVariant;
      cor: string;
    }
  >
> = {
  insuficiente: {
    rotulo: "Insuficiente",
    curto: "Insuficiente",
    faixa: "1,0 a 1,9",
    tom: "danger",
    cor: "--status-danger-ink",
  },
  em_desenvolvimento: {
    rotulo: "Em desenvolvimento",
    curto: "Em desenv.",
    faixa: "2,0 a 2,9",
    tom: "warning",
    cor: "--turno-laranja",
  },
  bom: {
    rotulo: "Bom",
    curto: "Bom",
    faixa: "3,0 a 3,9",
    tom: "warning",
    cor: "--turno-mostarda",
  },
  excelente: {
    rotulo: "Excelente",
    curto: "Excelente",
    faixa: "4,0 a 4,4",
    tom: "success",
    cor: "--turno-verde",
  },
  excepcional: {
    rotulo: "Excepcional",
    curto: "Excepcional",
    faixa: "4,5 a 5,0",
    tom: "success",
    cor: "--turno-verde-agua",
  },
};

export const ORDEM_DOS_NIVEIS: readonly Nivel[] = [
  "insuficiente",
  "em_desenvolvimento",
  "bom",
  "excelente",
  "excepcional",
];

/** O nível de uma nota (1 a 5), pelo valor com 1 casa. */
export function nivelDaNota(nota: number): Nivel {
  const n = Math.round(nota * 10) / 10;
  if (n < 2) return "insuficiente";
  if (n < 3) return "em_desenvolvimento";
  if (n < 4) return "bom";
  if (n < 4.5) return "excelente";
  return "excepcional";
}

export type Quadrante =
  | "referencia"
  | "forte_na_entrega"
  | "entrega_sozinho"
  | "forte_com_pessoas"
  | "solido"
  | "relacao_a_desenvolver"
  | "conecta_entrega_pouco"
  | "entrega_abaixo"
  | "precisa_de_apoio";

/** Mapa de talentos: linhas = Entrega (alta → baixa); colunas = Pessoas (baixa → alta). */
export const MAPA: readonly (readonly Quadrante[])[] = [
  ["entrega_sozinho", "forte_na_entrega", "referencia"],
  ["relacao_a_desenvolver", "solido", "forte_com_pessoas"],
  ["precisa_de_apoio", "entrega_abaixo", "conecta_entrega_pouco"],
];

export const QUADRANTES: Readonly<
  Record<Quadrante, { rotulo: string; regra: string }>
> = {
  referencia: {
    rotulo: "Referência",
    regra: "4 ou mais em Entrega e em Pessoas",
  },
  forte_na_entrega: {
    rotulo: "Forte na entrega",
    regra: "Entrega 4 ou mais; Pessoas de 3 a 3,9",
  },
  entrega_sozinho: {
    rotulo: "Entrega, mas sozinho",
    regra: "Entrega 4 ou mais; Pessoas abaixo de 3",
  },
  forte_com_pessoas: {
    rotulo: "Forte com pessoas",
    regra: "Pessoas 4 ou mais; Entrega de 3 a 3,9",
  },
  solido: { rotulo: "Sólido", regra: "Entrega e Pessoas de 3 a 3,9" },
  relacao_a_desenvolver: {
    rotulo: "Relação a desenvolver",
    regra: "Pessoas abaixo de 3; Entrega de 3 a 3,9",
  },
  conecta_entrega_pouco: {
    rotulo: "Conecta, mas entrega pouco",
    regra: "Pessoas 4 ou mais; Entrega abaixo de 3",
  },
  entrega_abaixo: {
    rotulo: "Entrega abaixo",
    regra: "Pessoas de 3 a 3,9; Entrega abaixo de 3",
  },
  precisa_de_apoio: {
    rotulo: "Precisa de apoio",
    regra: "Abaixo de 3 em Entrega e em Pessoas",
  },
};

export const GRUPOS_DA_NOTA = {
  destaque: { rotulo: "Destaques", regra: "Nota 4 ou mais" },
  esperado: { rotulo: "Dentro do esperado", regra: "Nota de 3 a 3,9" },
  apoio: { rotulo: "Precisam de apoio", regra: "Nota abaixo de 3" },
} as const;

export const CALIBRACAO = {
  poucas: "Poucas avaliações (menos de 5)",
  generoso: "Mais generoso que a média",
  exigente: "Mais exigente que a média",
  alinhado: "Alinhado à média",
} as const;

export const ALINHAMENTO = {
  acima: "Se vê acima",
  alinhada: "Alinhada",
  abaixo: "Se vê abaixo",
} as const;

export const LEITURAS = {
  forca_confirmada: {
    rotulo: "Força confirmada",
    texto: "As duas visões dão 4 ou mais.",
  },
  forca_nao_vista: {
    rotulo: "Força que a pessoa não vê",
    texto: "O gestor dá 1 ponto ou mais acima da pessoa.",
  },
  ponto_cego: {
    rotulo: "Ponto cego",
    texto: "A pessoa se dá 1 ponto ou mais acima do gestor.",
  },
  a_desenvolver: {
    rotulo: "A desenvolver juntos",
    texto: "As duas visões abaixo de 3.",
  },
  alinhada: {
    rotulo: "Visões próximas",
    texto: "Diferença menor que 1 ponto.",
  },
} as const;

export const PASSOS_DO_ROTEIRO = {
  forcas_confirmadas: "Comece pelo que as duas visões confirmam",
  forcas_nao_vistas: "Mostre as forças que a pessoa não enxerga",
  pontos_cegos: "Converse sobre os pontos cegos, com exemplos",
  a_desenvolver: "Combine o que desenvolver juntos",
  plano: "Feche com um plano: o que fazer, até quando e como acompanhar",
} as const;

export const TEMPO_DE_CASA = {
  ate_6_meses: "Menos de 6 meses",
  "6_meses_a_1_ano": "6 meses a 1 ano",
  "1_a_3_anos": "1 a 3 anos",
  "3_a_5_anos": "3 a 5 anos",
  mais_de_5_anos: "Mais de 5 anos",
} as const;

export const REGRAS_DE_COMENTARIOS = [
  {
    valor: "opcionais",
    titulo: "Opcionais",
    texto: "Escreve quem quiser, em qualquer competência.",
  },
  {
    valor: "extremos",
    titulo: "Pedidos nas notas extremas",
    texto:
      "Obrigatório quando a média da competência fica abaixo de 2,5 ou em 5,0.",
  },
  {
    valor: "obrigatorios",
    titulo: "Obrigatórios",
    texto: "Um comentário por competência, para todas as pessoas.",
  },
] as const;
export type RegraDeComentarios =
  (typeof REGRAS_DE_COMENTARIOS)[number]["valor"];

/** Comentário obrigatório? (pela regra e pela média da competência). */
export function exigeComentario(
  regra: RegraDeComentarios,
  media: number | null,
): boolean {
  if (regra === "obrigatorios") return true;
  if (regra === "opcionais" || media === null) return false;
  const m = Math.round(media * 10) / 10;
  return m < 2.5 || m === 5;
}

/** As seções que a pesquisa grava (a API confere e impõe o catálogo). */
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
 * As 24 afirmações para a galeria (gaveta, assistente e página "Sobre o
 * modelo"): uma seção por competência, com a chave de cada item.
 */
export const SECOES_DA_AVALIACAO: readonly SecaoDoModelo[] = CATALOGO.map(
  (c) => ({
    titulo: c.rotulo,
    cor: c.cor,
    perguntas: c.itens.map((i) => ({
      chave: i.id,
      tipo: "escala" as const,
      texto: i.gestor,
      rotulo: i.rotulo,
      obrigatoria: true,
      config: {
        minimo: 1,
        maximo: 5,
        rotuloMinimo: ROTULOS_DA_ESCALA[0],
        rotuloMaximo: ROTULOS_DA_ESCALA[4],
        rotulos: [...ROTULOS_DA_ESCALA],
      },
    })),
  }),
);

/** Nome padrão: "Avaliação 90° – Ciclo 2026.2" (1 = jan–jun, 2 = jul–dez). */
export function nomePadrao(modelo: ModeloDeAvaliacao, hoje: string): string {
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];
  const grau = modelo === "avaliacao90" ? "90°" : "180°";
  return `Avaliação ${grau} – Ciclo ${ano}.${mes <= 6 ? 1 : 2}`;
}

export const MENSAGEM_PADRAO: Readonly<Record<ModeloDeAvaliacao, string>> = {
  avaliacao90:
    "Avalie cada pessoa pensando nos últimos 6 meses. Nos comentários, use exemplos concretos: eles viram a base da conversa de feedback.",
  avaliacao180:
    "Pense nos últimos 6 meses. Os gestores avaliam o time e cada pessoa responde as mesmas afirmações sobre si. As duas visões viram a base da conversa de feedback.",
};

/** 1 casa, com vírgula ("3,6"); sem valor, travessão. */
export function nota1(n: number | null | undefined): string {
  return n === null || n === undefined
    ? "—"
    : (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
}

/** Diferença com sinal ("+0,5", "−0,1", "0,0"). */
export function diferenca1(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "0,0";
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1).replace(".", ",")}`;
}
