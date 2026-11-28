/**
 * T216 — Saúde financeira: o catálogo do modelo na tela.
 *
 * Estrutura igual à do servidor (`apps/api/.../modelos/isfb/definicao.ts`):
 * 15 perguntas que formam a nota de 0 a 100 (Q1 a Q15) e 3 opcionais de
 * autopercepção (O1 a O3). Enunciados do Evolli, medindo o mesmo ponto de
 * cada item; a empresa pode trocá-los pela redação oficial se tiver licença.
 */
import type { PerguntaDoModelo, SecaoDoModelo } from "../tipos";

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

export type DimensaoIsfb =
  "seguranca" | "habilidade" | "comportamento" | "liberdade" | "autopercepcao";

export interface EtapaIsfb {
  readonly id: DimensaoIsfb | "base";
  readonly rotulo: string;
  readonly curto: string;
  readonly cor: string;
  /** Token de cor do grupo (gaveta e assistente). */
  readonly corDoGrafico: string;
  readonly papel: "nota" | "ajusta" | "opcional";
  readonly texto: string;
}

export const ETAPAS_ISFB: readonly EtapaIsfb[] = [
  {
    id: "seguranca",
    rotulo: "Segurança Financeira",
    curto: "Segurança",
    cor: "#DC2626",
    corDoGrafico: "--grafico-5",
    papel: "nota",
    texto: "Se a renda cobre os gastos, o aperto e o estresse com dinheiro.",
  },
  {
    id: "habilidade",
    rotulo: "Habilidade Financeira",
    curto: "Habilidade",
    cor: "#2563EB",
    corDoGrafico: "--grafico-1",
    papel: "nota",
    texto: "Decidir, buscar informação e reconhecer bons investimentos.",
  },
  {
    id: "comportamento",
    rotulo: "Comportamento Financeiro",
    curto: "Comportamento",
    cor: "#059669",
    corDoGrafico: "--grafico-8",
    papel: "nota",
    texto: "Controlar gastos, poupar e cumprir metas.",
  },
  {
    id: "liberdade",
    rotulo: "Liberdade Financeira",
    curto: "Liberdade",
    cor: "#7C3AED",
    corDoGrafico: "--grafico-2",
    papel: "nota",
    texto: "Garantir o futuro e conseguir aproveitar a vida.",
  },
  {
    id: "base",
    rotulo: "Base Financeira",
    curto: "Base",
    cor: "#D97706",
    corDoGrafico: "--grafico-3",
    papel: "ajusta",
    texto: "Produtos financeiros da casa, renda e escolaridade.",
  },
  {
    id: "autopercepcao",
    rotulo: "Autopercepção Financeira",
    curto: "Autopercepção",
    cor: "#EC4899",
    corDoGrafico: "--grafico-7",
    papel: "opcional",
    texto: "Perceber quando falta informação ou as contas saem do controle.",
  },
];

export const etapaIsfb = (id: string): EtapaIsfb =>
  ETAPAS_ISFB.find((e) => e.id === id)!;

export const PRODUTOS: readonly { id: string; texto: string }[] = [
  { id: "conta_corrente", texto: "Conta corrente" },
  { id: "cartao_credito", texto: "Cartão de crédito" },
  { id: "seguro_casa", texto: "Seguro de casa" },
  { id: "poupanca", texto: "Poupança" },
  { id: "cartao_debito", texto: "Cartão de débito" },
  { id: "financ_imovel", texto: "Financiamento de imóvel" },
  { id: "investimentos", texto: "Investimentos (ações, fundos ou títulos)" },
  { id: "previdencia", texto: "Previdência privada" },
  { id: "financ_veiculo", texto: "Financiamento de veículo" },
  { id: "capitalizacao", texto: "Título de Capitalização" },
  { id: "seguro_saude", texto: "Seguro saúde / convênio" },
  { id: "financ_estudantil", texto: "Financiamento estudantil" },
  { id: "consorcio", texto: "Consórcio" },
  { id: "seguro_carro", texto: "Seguro de carro" },
];

export const OPCOES_Q1: readonly { id: string; texto: string }[] = [
  { id: "muito_maiores", texto: "Os gastos foram muito maiores que a renda" },
  {
    id: "pouco_maiores",
    texto: "Os gastos foram um pouco maiores que a renda",
  },
  { id: "iguais", texto: "Os gastos e a renda ficaram mais ou menos iguais" },
  {
    id: "pouco_menores",
    texto: "Os gastos foram um pouco menores que a renda",
  },
  { id: "muito_menores", texto: "Os gastos foram muito menores que a renda" },
];

export const OPCOES_Q14: readonly { id: string; texto: string }[] = [
  { id: "renda_1", texto: "Até R$ 1.518" },
  { id: "renda_2", texto: "De R$ 1.518 a R$ 2.824" },
  { id: "renda_3", texto: "De R$ 2.825 a R$ 4.236" },
  { id: "renda_4", texto: "De R$ 4.237 a R$ 7.060" },
  { id: "renda_5", texto: "De R$ 7.061 a R$ 14.120" },
  { id: "renda_6", texto: "De R$ 14.121 a R$ 28.240" },
  { id: "renda_7", texto: "Acima de R$ 28.240" },
];

export const OPCOES_Q15: readonly { id: string; texto: string }[] = [
  { id: "esc_1", texto: "Analfabeto / Fundamental 1 incompleto" },
  { id: "esc_2", texto: "Fundamental 1 completo" },
  { id: "esc_3", texto: "Fundamental 2 / Médio incompleto" },
  { id: "esc_4", texto: "Médio completo / Superior incompleto" },
  { id: "esc_5", texto: "Superior completo" },
  { id: "esc_6", texto: "Pós-graduação" },
];

export interface ItemIsfb {
  readonly id: string;
  readonly etapa: EtapaIsfb["id"];
  readonly texto: string;
  /** Rótulo curto, sempre no sentido positivo (tabelas de resultado). */
  readonly rotulo: string;
  readonly tipo: "concordancia" | "frequencia" | "opcoes" | "produtos";
  readonly invertido: boolean;
}

const item = (
  id: string,
  etapa: EtapaIsfb["id"],
  tipo: ItemIsfb["tipo"],
  texto: string,
  rotulo: string,
  invertido = false,
): ItemIsfb => ({ id, etapa, tipo, texto, rotulo, invertido });

export const ITENS_ISFB: readonly ItemIsfb[] = [
  item(
    "Q1",
    "seguranca",
    "opcoes",
    "Nos últimos 12 meses, como a renda da sua casa se comparou aos gastos?",
    "Renda da casa cobre os gastos",
  ),
  item(
    "Q2",
    "seguranca",
    "concordancia",
    "A preocupação com as despesas traz estresse para dentro de casa.",
    "Dinheiro não gera estresse em casa",
    true,
  ),
  item(
    "Q3",
    "seguranca",
    "concordancia",
    "Por causa dos compromissos financeiros, o padrão de vida da casa caiu.",
    "Padrão de vida mantido",
    true,
  ),
  item(
    "Q4",
    "seguranca",
    "concordancia",
    "Estou com o dinheiro apertado.",
    "Não estou apertado(a)",
    true,
  ),
  item(
    "Q5",
    "habilidade",
    "concordancia",
    "Sei tomar decisões financeiras mais complicadas.",
    "Sei tomar decisões complicadas",
  ),
  item(
    "Q6",
    "habilidade",
    "concordancia",
    "Consigo identificar quando um investimento é bom.",
    "Reconheço um bom investimento",
  ),
  item(
    "Q7",
    "habilidade",
    "concordancia",
    "Sei onde buscar informação antes de decidir sobre dinheiro.",
    "Sei me informar antes de decidir",
  ),
  item(
    "Q8",
    "comportamento",
    "concordancia",
    "Tenho controle dos meus gastos.",
    "Controlo os gastos",
  ),
  item(
    "Q9",
    "comportamento",
    "concordancia",
    "Consigo guardar uma parte do que ganho.",
    "Consigo poupar",
  ),
  item(
    "Q10",
    "comportamento",
    "concordancia",
    "Consigo cumprir as metas financeiras que defino.",
    "Cumpro metas financeiras",
  ),
  item(
    "Q11",
    "liberdade",
    "concordancia",
    "Estou me preparando para ter segurança financeira no futuro.",
    "Estou garantindo meu futuro",
  ),
  item(
    "Q12",
    "liberdade",
    "concordancia",
    "O cuidado que tenho com o dinheiro me deixa aproveitar a vida.",
    "Consigo aproveitar a vida",
  ),
  item(
    "Q13",
    "base",
    "produtos",
    "Quais destes produtos financeiros alguém da sua casa tem? Marque todos que tiver.",
    "Produtos financeiros da casa",
  ),
  item(
    "Q14",
    "base",
    "opcoes",
    "Qual é a renda mensal da sua casa, somando todas as pessoas?",
    "Renda da casa",
  ),
  item("Q15", "base", "opcoes", "Qual é a sua escolaridade?", "Escolaridade"),
  item(
    "O1",
    "autopercepcao",
    "frequencia",
    "Percebo quando me falta informação para tomar uma decisão sobre dinheiro.",
    "Percebo quando falta informação",
  ),
  item(
    "O2",
    "autopercepcao",
    "frequencia",
    "Percebo quando não estou cuidando bem do meu dinheiro.",
    "Percebo quando não cuido bem do dinheiro",
  ),
  item(
    "O3",
    "autopercepcao",
    "frequencia",
    "Percebo quando as contas começam a sair do controle.",
    "Percebo quando as contas saem do controle",
  ),
];

export const itemIsfb = (id: string): ItemIsfb =>
  ITENS_ISFB.find((i) => i.id === id)!;

const OPCOES_DE: Readonly<
  Record<string, readonly { id: string; texto: string }[]>
> = {
  Q1: OPCOES_Q1,
  Q13: PRODUTOS,
  Q14: OPCOES_Q14,
  Q15: OPCOES_Q15,
};

/** Seção de autopercepção (opcional) no assistente. */
export const SECAO_OPCIONAL_ISFB = "autopercepcao";

function perguntaDoItem(i: ItemIsfb): PerguntaDoModelo {
  const opcoes = OPCOES_DE[i.id];
  const rotulos =
    i.tipo === "frequencia"
      ? [...ROTULOS_DA_FREQUENCIA]
      : [...ROTULOS_DA_CONCORDANCIA];
  const base = {
    chave: i.id,
    texto: i.texto,
    rotulo: i.rotulo.slice(0, 40),
    obrigatoria: i.etapa !== "autopercepcao",
  };
  if (opcoes) {
    return {
      ...base,
      tipo:
        i.tipo === "produtos"
          ? ("multipla_escolha" as const)
          : ("escolha_unica" as const),
      opcoes: opcoes.map((o) => o.texto),
      config: { outro: false },
    };
  }
  return {
    ...base,
    tipo: "escala" as const,
    config: {
      minimo: 0,
      maximo: 4,
      rotuloMinimo: rotulos[0]!,
      rotuloMaximo: rotulos[4]!,
      rotulos,
      somenteRotulos: true,
    },
    ...(i.invertido ? { selo: "Invertida" } : {}),
  };
}

/** As 6 etapas com as perguntas (o assistente pode tirar a autopercepção). */
export const SECOES_ISFB: readonly SecaoDoModelo[] = ETAPAS_ISFB.map((e) => ({
  titulo: e.rotulo,
  cor: e.corDoGrafico,
  perguntas: ITENS_ISFB.filter((i) => i.etapa === e.id).map(perguntaDoItem),
}));
