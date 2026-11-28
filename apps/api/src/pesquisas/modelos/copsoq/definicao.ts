import type { EstruturaFixa, ItemFixo } from "../tipos";

/**
 * T216 — Riscos psicossociais (NR-1): 76 perguntas em 8 domínios e 29
 * dimensões, cinco escalas de 5 pontos. Cada pergunta leva a chave do item
 * (`Q1` a `Q76`). O valor gravado é o número do ponto (1 a 5); itens
 * invertidos valem `6 − valor`. A escala de saúde grava 5 = "Excelente" e
 * aparece do melhor para o pior (`decrescente`); as pesquisas gravadas antes
 * (1º rótulo "Excelente": 1 = Excelente) continuam espelhadas no cálculo
 * (`saudeLegadaDe`). Metodologia fixa: a API confere os itens (escala de 1 a
 * 5 com os 5 rótulos, obrigatória).
 */

export type EscalaNr1 =
  "frequencia" | "intensidade" | "concordancia" | "satisfacao" | "saude";

/** Rótulos dos pontos, na ordem em que aparecem (posição 1 a 5). */
export const ROTULOS_DA_ESCALA: Readonly<Record<EscalaNr1, readonly string[]>> =
  {
    frequencia: [
      "Nunca / Quase nunca",
      "Raramente",
      "Às vezes",
      "Frequentemente",
      "Sempre",
    ],
    intensidade: [
      "Nada / Quase nada",
      "Um pouco",
      "Moderadamente",
      "Muito",
      "Extremamente",
    ],
    concordancia: [
      "Discordo totalmente",
      "Discordo",
      "Nem concordo nem discordo",
      "Concordo",
      "Concordo totalmente",
    ],
    satisfacao: [
      "Muito insatisfeito(a)",
      "Insatisfeito(a)",
      "Moderadamente satisfeito(a)",
      "Satisfeito(a)",
      "Muito satisfeito(a)",
    ],
    // Do pior ao melhor (5 = Excelente); aparece de 5 a 1 (`decrescente`).
    saude: ["Fraca", "Regular", "Boa", "Muito boa", "Excelente"],
  };

/** A saúde das pesquisas gravadas antes: 1 = "Excelente" (espelhada). */
export const ROTULOS_DA_SAUDE_LEGADA: readonly string[] = [
  "Excelente",
  "Muito boa",
  "Boa",
  "Regular",
  "Fraca",
];

/** O item da autoavaliação de saúde. */
export const ITEM_DA_SAUDE = "Q64";

export const DOMINIOS_NR1 = [
  { id: "exigencias_laborais", rotulo: "Exigências Laborais" },
  {
    id: "organizacao_conteudo",
    rotulo: "Organização e Conteúdo do Trabalho",
  },
  {
    id: "relacoes_sociais_lideranca",
    rotulo: "Relações Sociais e Liderança",
  },
  {
    id: "interface_trabalho_individuo",
    rotulo: "Interface Trabalho-Indivíduo",
  },
  { id: "valores_local_trabalho", rotulo: "Valores no Local de Trabalho" },
  { id: "personalidade", rotulo: "Personalidade" },
  { id: "saude_bem_estar", rotulo: "Saúde e Bem-Estar" },
  { id: "comportamentos_ofensivos", rotulo: "Comportamentos Ofensivos" },
] as const;
export type DominioNr1 = (typeof DOMINIOS_NR1)[number]["id"];

export type TipoDeDimensao = "risco" | "protecao";

export interface DimensaoNr1 {
  readonly id: string;
  readonly rotulo: string;
  readonly dominio: DominioNr1;
  readonly tipo: TipoDeDimensao;
}

const d = (
  id: string,
  rotulo: string,
  dominio: DominioNr1,
  tipo: TipoDeDimensao,
): DimensaoNr1 => ({ id, rotulo, dominio, tipo });

/** As 29 dimensões, na ordem do questionário. */
export const DIMENSOES_NR1: readonly DimensaoNr1[] = [
  d(
    "exigencias_quantitativas",
    "Exigências Quantitativas",
    "exigencias_laborais",
    "risco",
  ),
  d("ritmo_trabalho", "Ritmo de Trabalho", "exigencias_laborais", "risco"),
  d(
    "exigencias_cognitivas",
    "Exigências Cognitivas",
    "exigencias_laborais",
    "risco",
  ),
  d(
    "exigencias_emocionais",
    "Exigências Emocionais",
    "exigencias_laborais",
    "risco",
  ),
  d(
    "influencia_trabalho",
    "Influência no Trabalho",
    "organizacao_conteudo",
    "protecao",
  ),
  d(
    "possibilidades_desenvolvimento",
    "Possibilidades de Desenvolvimento",
    "organizacao_conteudo",
    "protecao",
  ),
  d(
    "significado_trabalho",
    "Significado do Trabalho",
    "organizacao_conteudo",
    "protecao",
  ),
  d(
    "compromisso_local_trabalho",
    "Compromisso com o Local de Trabalho",
    "organizacao_conteudo",
    "protecao",
  ),
  d(
    "previsibilidade",
    "Previsibilidade",
    "relacoes_sociais_lideranca",
    "protecao",
  ),
  d(
    "reconhecimento",
    "Reconhecimento (Recompensas)",
    "relacoes_sociais_lideranca",
    "protecao",
  ),
  d(
    "transparencia_papel",
    "Transparência do Papel Laboral",
    "relacoes_sociais_lideranca",
    "protecao",
  ),
  d(
    "conflitos_papeis",
    "Conflitos de Papéis Laborais",
    "relacoes_sociais_lideranca",
    "risco",
  ),
  d(
    "qualidade_lideranca",
    "Qualidade da Liderança",
    "relacoes_sociais_lideranca",
    "protecao",
  ),
  d(
    "apoio_social_superiores",
    "Apoio Social de Superiores",
    "relacoes_sociais_lideranca",
    "protecao",
  ),
  d(
    "apoio_social_colegas",
    "Apoio Social de Colegas",
    "relacoes_sociais_lideranca",
    "protecao",
  ),
  d(
    "inseguranca_laboral",
    "Insegurança Laboral",
    "interface_trabalho_individuo",
    "risco",
  ),
  d(
    "satisfacao_laboral",
    "Satisfação Laboral",
    "interface_trabalho_individuo",
    "protecao",
  ),
  d(
    "conflito_trabalho_familia",
    "Conflito Trabalho-Família",
    "interface_trabalho_individuo",
    "risco",
  ),
  d(
    "confianca_vertical",
    "Confiança Vertical",
    "valores_local_trabalho",
    "protecao",
  ),
  d(
    "confianca_horizontal",
    "Confiança Horizontal",
    "valores_local_trabalho",
    "protecao",
  ),
  d(
    "justica_respeito",
    "Justiça e Respeito",
    "valores_local_trabalho",
    "protecao",
  ),
  d(
    "comunidade_social",
    "Comunidade Social no Trabalho",
    "valores_local_trabalho",
    "protecao",
  ),
  d("autoeficacia", "Autoeficácia", "personalidade", "protecao"),
  d("saude_geral", "Saúde Geral", "saude_bem_estar", "protecao"),
  d("stress", "Stress", "saude_bem_estar", "risco"),
  d("burnout", "Burnout (Esgotamento)", "saude_bem_estar", "risco"),
  d("problemas_dormir", "Problemas em Dormir", "saude_bem_estar", "risco"),
  d("sintomas_depressivos", "Sintomas Depressivos", "saude_bem_estar", "risco"),
  d(
    "comportamentos_ofensivos",
    "Comportamentos Ofensivos",
    "comportamentos_ofensivos",
    "risco",
  ),
];

export interface ItemNr1 {
  readonly id: string;
  readonly escala: EscalaNr1;
  readonly dimensao: string;
  /** Pontuação espelhada (`6 − posição`). */
  readonly invertido: boolean;
}

/** [dimensão, escala, quantidade de itens] em sequência: Q1, Q2, … Q76. */
const BLOCOS: readonly (readonly [string, EscalaNr1, number])[] = [
  ["exigencias_quantitativas", "frequencia", 3],
  ["ritmo_trabalho", "frequencia", 1],
  ["exigencias_cognitivas", "frequencia", 3],
  ["exigencias_emocionais", "frequencia", 1],
  ["influencia_trabalho", "frequencia", 4],
  ["possibilidades_desenvolvimento", "frequencia", 3],
  ["significado_trabalho", "frequencia", 3],
  ["compromisso_local_trabalho", "frequencia", 2],
  ["previsibilidade", "frequencia", 2],
  ["reconhecimento", "frequencia", 3],
  ["transparencia_papel", "frequencia", 3],
  ["conflitos_papeis", "frequencia", 3],
  ["qualidade_lideranca", "frequencia", 4],
  ["apoio_social_superiores", "frequencia", 3],
  ["apoio_social_colegas", "frequencia", 3],
  ["inseguranca_laboral", "frequencia", 1],
  ["satisfacao_laboral", "satisfacao", 4],
  ["conflito_trabalho_familia", "frequencia", 3],
  ["confianca_vertical", "concordancia", 3],
  ["confianca_horizontal", "concordancia", 3],
  ["justica_respeito", "concordancia", 3],
  ["comunidade_social", "concordancia", 3],
  ["autoeficacia", "concordancia", 2],
  ["saude_geral", "saude", 1],
  ["stress", "intensidade", 2],
  ["burnout", "intensidade", 2],
  ["problemas_dormir", "intensidade", 2],
  ["sintomas_depressivos", "intensidade", 2],
  ["comportamentos_ofensivos", "frequencia", 4],
];

/** Itens com a pontuação espelhada. */
const INVERTIDOS = new Set(["Q53", "Q54"]);

export const ITENS_NR1: readonly ItemNr1[] = (() => {
  const itens: ItemNr1[] = [];
  for (const [dimensao, escala, quantidade] of BLOCOS) {
    for (let i = 0; i < quantidade; i += 1) {
      const id = `Q${itens.length + 1}`;
      itens.push({ id, escala, dimensao, invertido: INVERTIDOS.has(id) });
    }
  }
  return itens;
})();

/** Os quatro tipos de comportamento ofensivo (últimos 12 meses). */
export const ITENS_OFENSIVOS = ["Q73", "Q74", "Q75", "Q76"] as const;

const dimensaoDe = new Map(DIMENSOES_NR1.map((x) => [x.id, x]));

export function dimensaoNr1(id: string): DimensaoNr1 {
  return dimensaoDe.get(id)!;
}

/** Os 76 itens, conferidos ao gravar (chave, escala de 1 a 5, 5 rótulos). */
export const ESTRUTURA_NR1: EstruturaFixa = {
  itens: ITENS_NR1.map((i): ItemFixo => ({
    chave: i.id,
    tipo: "escala",
    config: (c) => c.minimo === 1 && c.maximo === 5 && c.rotulos?.length === 5,
    obrigatoria: true,
  })),
  opcionais: [],
};
