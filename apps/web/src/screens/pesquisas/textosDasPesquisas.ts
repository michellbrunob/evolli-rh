/**
 * T216 — textos e regras pequenas do módulo Pesquisas: rótulos de status,
 * identificação, modelo e tipo de pergunta; a configuração inicial de cada
 * tipo; ids gerados no navegador; datas e percentuais.
 */
import type {
  ConfigPergunta,
  Identificacao,
  ModeloPesquisa,
  Pergunta,
  StatusPesquisa,
  TipoPergunta,
} from "../../api/pesquisasClient";
import { diaCivilDeHoje, formatarDiaCivil } from "../../format/data";
import type { StatusVariant } from "../../components";

export const ROTULO_DO_STATUS: Readonly<Record<StatusPesquisa, string>> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  pausada: "Pausada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export const TOM_DO_STATUS: Readonly<Record<StatusPesquisa, StatusVariant>> = {
  rascunho: "neutral",
  ativa: "success",
  pausada: "warning",
  finalizada: "info",
  cancelada: "danger",
};

export const IDENTIFICACOES: readonly {
  readonly valor: Identificacao;
  readonly rotulo: string;
  readonly texto: string;
}[] = [
  {
    valor: "identificada",
    rotulo: "Identificada",
    texto:
      "Quem responde confirma quem é. O RH vê quem respondeu o quê e as respostas aparecem na ficha da pessoa.",
  },
  {
    valor: "confidencial",
    rotulo: "Confidencial",
    texto:
      "Quem responde confirma quem é, mas a resposta não fica ligada à pessoa. O RH vê só os números agrupados.",
  },
  {
    valor: "anonima",
    rotulo: "Anônima",
    texto:
      "Sem identificação: quem tem o link responde. O RH vê só os números agrupados.",
  },
];

/** "Oculto · menos de 3 respostas" ou "Oculto · protege um grupo menor". */
export function textoDoOculto(
  motivo: "minimo" | "protege_grupo_menor" | null | undefined,
  minimo: number,
): string {
  return motivo === "protege_grupo_menor"
    ? "Oculto · protege um grupo menor"
    : `Oculto · menos de ${minimo === 1 ? "1 resposta" : `${minimo} respostas`}`;
}

export const ROTULO_DA_IDENTIFICACAO: Readonly<Record<Identificacao, string>> =
  {
    identificada: "Identificada",
    confidencial: "Confidencial",
    anonima: "Anônima",
  };

export const ROTULO_DO_MODELO: Readonly<Record<ModeloPesquisa, string>> = {
  pulso: "Pulso",
  clima: "Clima",
  enps: "eNPS",
  onboarding: "Onboarding · 30 dias",
  desligamento: "Entrevista de desligamento",
  beneficios: "Satisfação com benefícios",
  treinamento: "Avaliação de treinamento",
  personalizada: "Personalizada",
  pulso_clima: "Pulso e Clima",
  tad: "Motivação (TAD)",
  copsoq: "Riscos psicossociais (NR-1)",
  isfb: "Saúde financeira",
  avaliacao90: "Avaliação 90°",
  avaliacao180: "Avaliação 180°",
  disc: "Perfil comportamental (DISC)",
};

export const TIPOS_DE_PERGUNTA: readonly {
  readonly valor: TipoPergunta;
  readonly rotulo: string;
  readonly texto: string;
}[] = [
  {
    valor: "texto_curto",
    rotulo: "Texto curto",
    texto: "Uma linha, até 300 caracteres.",
  },
  {
    valor: "paragrafo",
    rotulo: "Parágrafo",
    texto: "Resposta longa, até 3000 caracteres.",
  },
  {
    valor: "escolha_unica",
    rotulo: "Escolha única",
    texto: "Marca uma opção.",
  },
  {
    valor: "multipla_escolha",
    rotulo: "Múltipla escolha",
    texto: "Marca uma ou mais opções.",
  },
  {
    valor: "sim_nao",
    rotulo: "Sim ou não",
    texto: "Duas respostas possíveis.",
  },
  {
    valor: "concordancia",
    rotulo: "Concordância",
    texto: "De discordo totalmente (1) a concordo totalmente (5).",
  },
  {
    valor: "concordancia_4",
    rotulo: "Concordância · 4 pontos",
    texto: "Sem meio-termo: de discordo totalmente a concordo totalmente.",
  },
  {
    valor: "satisfacao_4",
    rotulo: "Satisfação · 4 pontos",
    texto: "Sem meio-termo: de muito insatisfeito a muito satisfeito.",
  },
  {
    valor: "nota_0_10",
    rotulo: "Nota de 0 a 10",
    texto: "Pode calcular o eNPS.",
  },
  { valor: "estrelas", rotulo: "Estrelas", texto: "De 1 a 5 estrelas." },
  {
    valor: "escala",
    rotulo: "Escala",
    texto: "Intervalo numérico com rótulos nas pontas.",
  },
  { valor: "data", rotulo: "Data", texto: "Um dia do calendário." },
  {
    valor: "numero",
    rotulo: "Número",
    texto: "Valor numérico, com limites opcionais.",
  },
];

export const ROTULO_DO_TIPO: Readonly<Record<TipoPergunta, string>> =
  Object.fromEntries(
    TIPOS_DE_PERGUNTA.map((t) => [t.valor, t.rotulo]),
  ) as Record<TipoPergunta, string>;

export const ROTULOS_DA_CONCORDANCIA = [
  "Discordo totalmente",
  "Discordo",
  "Neutro",
  "Concordo",
  "Concordo totalmente",
] as const;

/** Concordância de 4 pontos, sem ponto neutro. */
export const ROTULOS_DA_CONCORDANCIA_4 = [
  "Discordo totalmente",
  "Discordo parcialmente",
  "Concordo parcialmente",
  "Concordo totalmente",
] as const;

/** Satisfação de 4 pontos, sem ponto neutro. */
export const ROTULOS_DA_SATISFACAO_4 = [
  "Muito insatisfeito",
  "Insatisfeito",
  "Satisfeito",
  "Muito satisfeito",
] as const;

/**
 * O rótulo de cada ponto da pergunta (do menor ao maior), quando ela tem:
 * concordância (5 e 4 pontos), satisfação de 4 pontos e a escala com os
 * rótulos de todos os pontos. `null` nas demais.
 */
export function rotulosDosPontos(p: {
  readonly tipo: TipoPergunta;
  readonly config: { readonly rotulos?: readonly string[] | null };
}): readonly string[] | null {
  switch (p.tipo) {
    case "concordancia":
      return ROTULOS_DA_CONCORDANCIA;
    case "concordancia_4":
      return ROTULOS_DA_CONCORDANCIA_4;
    case "satisfacao_4":
      return ROTULOS_DA_SATISFACAO_4;
    case "escala":
      return p.config.rotulos && p.config.rotulos.length > 0
        ? p.config.rotulos
        : null;
    default:
      return null;
  }
}

export const LIMITES = {
  nome: 120,
  boasVindas: 1000,
  textoPergunta: 300,
  rotulo: 40,
  descricaoPergunta: 500,
  textoOpcao: 200,
  opcoesMinimo: 2,
  opcoesMaximo: 20,
  perguntas: 60,
  secoes: 20,
  minimoPorGrupoMenor: 3,
  minimoPorGrupoMaior: 10,
} as const;

/** Id curto e único, gerado no navegador (até 40 caracteres). */
export function novoId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Tipos cujas opções podem disparar uma pergunta condicional. */
export function podeSerCondicao(tipo: TipoPergunta): boolean {
  return (
    tipo === "escolha_unica" ||
    tipo === "multipla_escolha" ||
    tipo === "sim_nao"
  );
}

export function temOpcoes(tipo: TipoPergunta): boolean {
  return tipo === "escolha_unica" || tipo === "multipla_escolha";
}

/** A configuração inicial de cada tipo (ao criar ou trocar o tipo). */
export function configInicial(tipo: TipoPergunta): ConfigPergunta {
  switch (tipo) {
    case "escolha_unica":
      return {
        opcoes: [
          { id: novoId(), texto: "Opção 1" },
          { id: novoId(), texto: "Opção 2" },
        ],
        outro: false,
      };
    case "multipla_escolha":
      return {
        opcoes: [
          { id: novoId(), texto: "Opção 1" },
          { id: novoId(), texto: "Opção 2" },
        ],
        outro: false,
      };
    case "sim_nao":
      return { respostaBoa: null };
    case "nota_0_10":
      return { enps: false };
    case "escala":
      return { minimo: 1, maximo: 5, rotuloMinimo: "", rotuloMaximo: "" };
    case "numero":
      return { inteiro: false };
    default:
      return {};
  }
}

export function novaPergunta(tipo: TipoPergunta): Pergunta {
  return {
    id: novoId(),
    tipo,
    texto: "",
    descricao: null,
    obrigatoria: true,
    config: configInicial(tipo),
    condicao: null,
  };
}

/** As opções que uma pergunta oferece como condição ("sim"/"nao" no sim/não). */
export function opcoesDaCondicao(
  p: Pergunta,
): readonly { id: string; texto: string }[] {
  if (p.tipo === "sim_nao") {
    return [
      { id: "sim", texto: "Sim" },
      { id: "nao", texto: "Não" },
    ];
  }
  return p.config.opcoes ?? [];
}

/** ISO (instante) → dd/mm/aaaa no fuso de negócio. */
export function dataDoInstante(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatarDiaCivil(iso);
  return formatarDiaCivil(diaCivilDeHoje(d));
}

/** Percentual inteiro (0 quando a base é zero). */
export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** Número com uma casa, no formato brasileiro ("7,8"). */
export function umaCasa(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
}

/** Participação: respostas ÷ participantes, até 100%. */
export function participacao(respostas: number, participantes: number): number {
  return Math.min(100, percentual(respostas, participantes));
}

/** O endereço completo do link público (o caminho `#/p/<token>`). */
export function enderecoDoLink(link: string): string {
  if (/^https?:\/\//.test(link)) return link;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${link.startsWith("#") ? link : `#${link}`}`;
}

/** Copia o link; devolve se deu certo. */
export async function copiarLink(link: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(enderecoDoLink(link));
    return true;
  } catch {
    return false;
  }
}

/** Status que se pode escolher a partir do atual (finalizada e cancelada não voltam). */
export function proximosStatus(atual: StatusPesquisa): StatusPesquisa[] {
  switch (atual) {
    case "ativa":
      return ["pausada", "finalizada", "cancelada"];
    case "pausada":
      return ["ativa", "finalizada", "cancelada"];
    default:
      return [];
  }
}

/** Só rascunho, ativa e pausada editam. */
export function podeEditarPesquisa(status: StatusPesquisa): boolean {
  return status === "rascunho" || status === "ativa" || status === "pausada";
}
