/**
 * T216 — textos e cores dos resultados da saúde financeira (faixas,
 * perfis, sinais de alerta, temas, abertura a apoio e renda).
 */
import type {
  AberturaIsfb,
  FaixaIsfb,
  PerfilIsfb,
  SaudeFinanceira,
  SinalIsfb,
  TemaIsfb,
} from "../../../../api/modelosDePesquisaClient";

export const FAIXAS_ISFB: readonly FaixaIsfb[] = [
  "ruim",
  "muito_baixa",
  "baixa",
  "ok",
  "boa",
  "muito_boa",
  "otima",
];

export const FAIXA_ISFB: Readonly<
  Record<
    FaixaIsfb,
    {
      readonly rotulo: string;
      readonly de: number;
      readonly ate: number;
      readonly cor: string;
      readonly frase: string;
    }
  >
> = {
  ruim: {
    rotulo: "Ruim",
    de: 0,
    ate: 36,
    cor: "#D93B3B",
    frase: "As contas não fecham e o estresse é constante; vale buscar apoio.",
  },
  muito_baixa: {
    rotulo: "Muito baixa",
    de: 37,
    ate: 49,
    cor: "#E8663D",
    frase: "Aperto frequente e pouca margem para imprevistos.",
  },
  baixa: {
    rotulo: "Baixa",
    de: 50,
    ate: 56,
    cor: "#E5952E",
    frase: "Há momentos de desequilíbrio; dá para melhorar.",
  },
  ok: {
    rotulo: "OK",
    de: 57,
    ate: 60,
    cor: "#C9A20C",
    frase: "No limite: fecha o mês, mas sem margem.",
  },
  boa: {
    rotulo: "Boa",
    de: 61,
    ate: 68,
    cor: "#6FA834",
    frase: "Contas em ordem e alguma folga.",
  },
  muito_boa: {
    rotulo: "Muito boa",
    de: 69,
    ate: 82,
    cor: "#2E9E5B",
    frase: "Equilíbrio, reserva e bons hábitos.",
  },
  otima: {
    rotulo: "Ótima",
    de: 83,
    ate: 100,
    cor: "#1A7F4E",
    frase: "Finanças em dia, com reserva e planejamento.",
  },
};

export const SAUDE: Readonly<
  Record<
    SaudeFinanceira,
    { readonly rotulo: string; readonly faixa: string; readonly cor: string }
  >
> = {
  baixa: { rotulo: "Baixa", faixa: "até 56", cor: "#E5484D" },
  no_limite: { rotulo: "No limite", faixa: "57 a 60", cor: "#F2B23E" },
  saudavel: { rotulo: "Saudável", faixa: "61 ou mais", cor: "#3DB46D" },
};

export const PERFIS: readonly PerfilIsfb[] = [
  "estaveis",
  "apertados_organizados",
  "confortaveis_sem_metodo",
  "em_risco",
];

export const PERFIL: Readonly<
  Record<
    PerfilIsfb,
    {
      readonly rotulo: string;
      readonly cor: string;
      readonly texto: string;
      readonly acao: string;
    }
  >
> = {
  estaveis: {
    rotulo: "Estáveis",
    cor: "#3DB36B",
    texto: "Contas em dia e bons hábitos.",
    acao: "Multiplicadores do tema",
  },
  apertados_organizados: {
    rotulo: "Apertados, mas organizados",
    cor: "#F2A33A",
    texto: "Controlam bem, mas a renda não cobre.",
    acao: "Benefícios e renda: aliviar o caixa",
  },
  confortaveis_sem_metodo: {
    rotulo: "Confortáveis sem método",
    cor: "#9ACD55",
    texto: "A renda cobre, mas falta controle.",
    acao: "Previdência e investimentos",
  },
  em_risco: {
    rotulo: "Em risco",
    cor: "#DC3B3B",
    texto: "Renda apertada e pouco controle.",
    acao: "Apoio individual e educação financeira",
  },
};

export const SINAIS: readonly SinalIsfb[] = [
  "gasta_mais",
  "estresse",
  "apertado",
  "sem_reserva",
];

export const SINAL: Readonly<
  Record<
    SinalIsfb,
    { readonly rotulo: string; readonly texto: string; readonly pessoa: string }
  >
> = {
  gasta_mais: {
    rotulo: "gastam mais do que ganham",
    texto: "Nos últimos 12 meses, os gastos passaram da renda.",
    pessoa: "Gasta mais do que ganha",
  },
  estresse: {
    rotulo: "dizem que dinheiro gera estresse em casa",
    texto: "Concordam muito ou totalmente.",
    pessoa: "Dinheiro gera estresse em casa",
  },
  apertado: {
    rotulo: "estão apertados financeiramente",
    texto: "Concordam muito ou totalmente.",
    pessoa: "Está com o dinheiro apertado",
  },
  sem_reserva: {
    rotulo: "não têm nenhuma reserva",
    texto: "Sem poupança e sem investimentos.",
    pessoa: "Sem reserva",
  },
};

export const TEMA: Readonly<Record<TemaIsfb, string>> = {
  orcamento: "Orçamento e controle do mês",
  reserva: "Reserva de emergência",
  aposentadoria: "Aposentadoria e futuro",
  investimentos: "Investimentos básicos",
  dividas: "Dívidas e uso do crédito",
  decidir: "Como decidir e pesquisar",
};

export const ABERTURAS: readonly AberturaIsfb[] = [
  "sabem_que_precisam",
  "ponto_cego",
  "bem_e_atentos",
  "bem_mas_desatentos",
];

export const ABERTURA: Readonly<
  Record<AberturaIsfb, { readonly rotulo: string; readonly acao: string }>
> = {
  sabem_que_precisam: {
    rotulo: "Sabem que precisam",
    acao: "Convite direto para consultoria individual.",
  },
  ponto_cego: {
    rotulo: "Ponto cego",
    acao: "Conteúdo em grupo, sem cobrança.",
  },
  bem_e_atentos: {
    rotulo: "Bem e atentos",
    acao: "Podem ser multiplicadores.",
  },
  bem_mas_desatentos: {
    rotulo: "Bem, mas desatentos",
    acao: "Lembretes periódicos.",
  },
};

export const RENDA: Readonly<Record<string, string>> = {
  ate_1_5: "Até R$ 1,5 mil",
  de_1_5_a_4_2: "R$ 1,5 a 4,2 mil",
  de_4_2_a_14_1: "R$ 4,2 a 14,1 mil",
  de_14_1_a_28_2: "R$ 14,1 a 28,2 mil",
  acima_28_2: "Acima de R$ 28,2 mil",
};

export const GRUPOS_DE_PRODUTOS: readonly {
  readonly rotulo: string;
  readonly produtos: readonly string[];
}[] = [
  {
    rotulo: "Reserva e futuro",
    produtos: ["poupanca", "investimentos", "previdencia", "capitalizacao"],
  },
  {
    rotulo: "Proteção",
    produtos: ["seguro_saude", "seguro_carro", "seguro_casa"],
  },
  {
    rotulo: "Crédito e financiamentos",
    produtos: [
      "cartao_credito",
      "financ_veiculo",
      "financ_imovel",
      "consorcio",
      "financ_estudantil",
    ],
  },
  { rotulo: "Dia a dia", produtos: ["conta_corrente", "cartao_debito"] },
];

/** Diferença com sinal e uma casa ("+2,3", "−3,7"). */
export function diferenca(n: number): string {
  const t = Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return n > 0 ? `+${t}` : n < 0 ? `−${t}` : t;
}

export const umaCasaBr = (n: number): string =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
