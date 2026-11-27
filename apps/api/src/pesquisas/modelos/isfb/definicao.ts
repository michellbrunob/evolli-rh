import type { EstruturaFixa, PerguntaFixa } from "../estrutura-fixa";

/**
 * T216 — Saúde financeira: 15 perguntas que formam a nota (0 a 100) e 3
 * opcionais de autopercepção. Valores gravados:
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

const escala = (
  id: string,
  rotulos: readonly string[],
  obrigatoria = true,
): PerguntaFixa => ({
  id,
  tipo: "escala",
  obrigatoria,
  config: {
    minimo: 0,
    maximo: 4,
    rotuloMinimo: rotulos[0]!,
    rotuloMaximo: rotulos[4]!,
    rotulos: [...rotulos],
    somenteRotulos: true,
  },
});

const concordo = (id: string) => escala(id, ROTULOS_DA_CONCORDANCIA);

export const ESTRUTURA_ISFB: EstruturaFixa = {
  secoes: [
    {
      id: "seguranca",
      titulo: "Segurança Financeira",
      perguntas: [
        {
          id: "Q1",
          tipo: "escolha_unica",
          obrigatoria: true,
          config: { outro: false },
          opcoes: OPCOES_Q1,
        },
        concordo("Q2"),
        concordo("Q3"),
        concordo("Q4"),
      ],
    },
    {
      id: "habilidade",
      titulo: "Habilidade Financeira",
      perguntas: [concordo("Q5"), concordo("Q6"), concordo("Q7")],
    },
    {
      id: "comportamento",
      titulo: "Comportamento Financeiro",
      perguntas: [concordo("Q8"), concordo("Q9"), concordo("Q10")],
    },
    {
      id: "liberdade",
      titulo: "Liberdade Financeira",
      perguntas: [concordo("Q11"), concordo("Q12")],
    },
    {
      id: "base",
      titulo: "Base Financeira",
      perguntas: [
        // Quem não tem nenhum produto segue sem marcar (vale 0).
        {
          id: "Q13",
          tipo: "multipla_escolha",
          obrigatoria: false,
          config: { outro: false, maximo: null },
          opcoes: PRODUTOS,
        },
        {
          id: "Q14",
          tipo: "escolha_unica",
          obrigatoria: true,
          config: { outro: false },
          opcoes: OPCOES_Q14,
        },
        {
          id: "Q15",
          tipo: "escolha_unica",
          obrigatoria: true,
          config: { outro: false },
          opcoes: OPCOES_Q15,
        },
      ],
    },
    {
      id: "autopercepcao",
      titulo: "Autopercepção Financeira",
      opcional: true,
      perguntas: [
        escala("O1", ROTULOS_DA_FREQUENCIA, false),
        escala("O2", ROTULOS_DA_FREQUENCIA, false),
        escala("O3", ROTULOS_DA_FREQUENCIA, false),
      ],
    },
  ],
};
