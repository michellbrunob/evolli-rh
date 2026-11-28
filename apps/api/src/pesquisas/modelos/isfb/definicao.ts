import type { EstruturaFixa, ItemFixo } from "../tipos";

/**
 * T216 — Saúde financeira: 15 perguntas que formam a nota (0 a 100) e 3
 * opcionais de autopercepção. Valores gravados:
 *
 * Cada pergunta leva a chave do item (Q1–Q15, O1–O3); as opções valem pela
 * posição (a 1ª opção de Q14 é a menor renda etc.).
 *
 * - escalas (Q2–Q12 e O1–O3): a posição do ponto como aparece (0 a 4);
 *   os itens negativos (Q2, Q3 e Q4) valem `4 − posição`;
 * - Q1, Q14 e Q15: a opção marcada (id), que vale os pontos daqui;
 * - Q13: as opções marcadas (cada produto conta 1).
 */

export const ETAPAS_ISFB = [
  { id: "seguranca", rotulo: "Segurança Financeira" },
  { id: "habilidade", rotulo: "Habilidade Financeira" },
  { id: "comportamento", rotulo: "Comportamento Financeiro" },
  { id: "liberdade", rotulo: "Liberdade Financeira" },
  { id: "base", rotulo: "Base Financeira" },
  { id: "autopercepcao", rotulo: "Autopercepção Financeira" },
] as const;

export const ROTULOS_DA_CONCORDANCIA = [
  "Nada",
  "Pouco",
  "Mais ou menos",
  "Muito",
  "Totalmente",
] as const;

export const ROTULOS_DA_FREQUENCIA = [
  "Nunca",
  "Raramente",
  "Às vezes",
  "Frequentemente",
  "Sempre",
] as const;

/** Q1: renda × gastos nos últimos 12 meses (pontos 0 a 4). */
export const OPCOES_Q1 = [
  "muito_maiores",
  "pouco_maiores",
  "iguais",
  "pouco_menores",
  "muito_menores",
] as const;

/** Q13: produtos financeiros da casa (cada um vale 1). */
export const PRODUTOS = [
  "conta_corrente",
  "cartao_credito",
  "seguro_casa",
  "poupanca",
  "cartao_debito",
  "financ_imovel",
  "investimentos",
  "previdencia",
  "financ_veiculo",
  "capitalizacao",
  "seguro_saude",
  "financ_estudantil",
  "consorcio",
  "seguro_carro",
] as const;
export type Produto = (typeof PRODUTOS)[number];

/** Q14: renda familiar mensal (7 faixas) e os pontos de cada uma. */
export const OPCOES_Q14 = [
  "renda_1",
  "renda_2",
  "renda_3",
  "renda_4",
  "renda_5",
  "renda_6",
  "renda_7",
] as const;
export const PONTOS_Q14 = [0, 1, 1, 2, 2, 3, 4] as const;

/** Q15: escolaridade (6 opções) e os pontos de cada uma. */
export const OPCOES_Q15 = [
  "esc_1",
  "esc_2",
  "esc_3",
  "esc_4",
  "esc_5",
  "esc_6",
] as const;
export const PONTOS_Q15 = [0, 0, 1, 2, 3, 4] as const;

/** Itens negativos (pontuação espelhada). */
export const INVERTIDOS_ISFB = new Set(["Q2", "Q3", "Q4"]);

const escala = (chave: string, obrigatoria = true): ItemFixo => ({
  chave,
  tipo: "escala",
  config: (c) => c.minimo === 0 && c.maximo === 4 && c.rotulos?.length === 5,
  obrigatoria,
});

const escolha = (
  chave: string,
  tipo: "escolha_unica" | "multipla_escolha",
  opcoes: number,
  obrigatoria: boolean,
): ItemFixo => ({
  chave,
  tipo,
  config: (c) => c.opcoes?.length === opcoes && c.outro !== true,
  obrigatoria,
});

/** As 18 perguntas, conferidas ao gravar; a autopercepção (O1–O3) é opcional. */
export const ESTRUTURA_ISFB: EstruturaFixa = {
  itens: [
    escolha("Q1", "escolha_unica", OPCOES_Q1.length, true),
    ...[
      "Q2",
      "Q3",
      "Q4",
      "Q5",
      "Q6",
      "Q7",
      "Q8",
      "Q9",
      "Q10",
      "Q11",
      "Q12",
    ].map((q) => escala(q)),
    // Quem não tem nenhum produto segue sem marcar (vale 0).
    escolha("Q13", "multipla_escolha", PRODUTOS.length, false),
    escolha("Q14", "escolha_unica", OPCOES_Q14.length, true),
    escolha("Q15", "escolha_unica", OPCOES_Q15.length, true),
  ],
  opcionais: ["O1", "O2", "O3"].map((q) => escala(q, false)),
};

/** As chaves de cada etapa, na ordem. */
export const CHAVES_DAS_ETAPAS: Readonly<Record<string, readonly string[]>> = {
  seguranca: ["Q1", "Q2", "Q3", "Q4"],
  habilidade: ["Q5", "Q6", "Q7"],
  comportamento: ["Q8", "Q9", "Q10"],
  liberdade: ["Q11", "Q12"],
  base: ["Q13", "Q14", "Q15"],
  autopercepcao: ["O1", "O2", "O3"],
};
