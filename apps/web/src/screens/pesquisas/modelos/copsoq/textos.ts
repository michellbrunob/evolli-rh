/**
 * T216 — textos e cores dos resultados da NR-1 (níveis, faixas, matriz,
 * etapas de conformidade e controles do plano de ação).
 */
import type {
  ControleNr1,
  EtapaNr1,
  FaixaNr1,
  NivelNr1,
  SituacaoDaMedida,
} from "../../../../api/modelosDePesquisaClient";

export const NIVEIS: readonly NivelNr1[] = [
  "critico",
  "alto",
  "medio",
  "baixo",
];

export const NIVEL: Readonly<
  Record<
    NivelNr1,
    {
      readonly rotulo: string;
      readonly cor: string;
      readonly acao: string;
      readonly frase: string;
      readonly comoAgir: string;
    }
  >
> = {
  critico: {
    rotulo: "Crítico",
    cor: "#DC2626",
    acao: "Ação imediata",
    frase: "Muita gente afetada e com intensidade alta.",
    comoAgir:
      "Agir já, de preferência eliminando ou substituindo a causa, com acompanhamento mensal.",
  },
  alto: {
    rotulo: "Alto",
    cor: "#EA580C",
    acao: "Ação em até 90 dias",
    frase: "Parte relevante do time afetada.",
    comoAgir:
      "Planejar a medida em até 90 dias, com responsável e indicador de acompanhamento.",
  },
  medio: {
    rotulo: "Médio",
    cor: "#D9A30B",
    acao: "Monitorar",
    frase: "Sinais de alerta em parte do time.",
    comoAgir: "Acompanhar de perto e incluir medidas preventivas no plano.",
  },
  baixo: {
    rotulo: "Baixo",
    cor: "#22A055",
    acao: "Situação controlada",
    frase: "Poucas pessoas afetadas.",
    comoAgir: "Manter o que funciona e reavaliar na próxima aplicação.",
  },
};

export const FAIXA: Readonly<
  Record<FaixaNr1, { readonly rotulo: string; readonly cor: string }>
> = {
  risco: { rotulo: "Risco", cor: "#E5484D" },
  intermediario: { rotulo: "Intermediário", cor: "#F2B23E" },
  favoravel: { rotulo: "Favorável", cor: "#3DB46D" },
};

export const COR_DO_FATOR = { risco: "#EA580C", protecao: "#3B6FE0" } as const;

export const ROTULO_DO_GRAU = ["", "Baixa", "Média", "Alta", "Muito alta"];

export const ROTULO_DA_PREVALENCIA = [
  "",
  "< 20% em risco",
  "20–39% em risco",
  "40–59% em risco",
  "≥ 60% em risco",
];

/** Linhas da matriz: severidade 4 (topo) a 1; colunas: prevalência 1 a 4. */
export const MATRIZ: readonly (readonly NivelNr1[])[] = [
  ["medio", "alto", "critico", "critico"],
  ["baixo", "medio", "alto", "critico"],
  ["baixo", "baixo", "medio", "alto"],
  ["baixo", "baixo", "baixo", "medio"],
];

export const ROTULO_DO_INDICADOR: Readonly<
  Record<string, { readonly titulo: string; readonly texto: string }>
> = {
  burnout: { titulo: "Burnout", texto: "Esgotamento emocional e físico" },
  stress: { titulo: "Stress", texto: "Tensão e sobrecarga" },
  problemas_dormir: { titulo: "Sono", texto: "Dificuldade para dormir" },
  sintomas_depressivos: {
    titulo: "Sintomas depressivos",
    texto: "Tristeza e desânimo",
  },
  saude_geral: { titulo: "Saúde geral", texto: "Autoavaliação da saúde" },
};

export interface EtapaDaConformidade {
  readonly id: EtapaNr1;
  readonly titulo: string;
  readonly texto: string;
  readonly itens: readonly string[];
  readonly evidencias?: string;
}

export const ETAPAS_DA_CONFORMIDADE: readonly EtapaDaConformidade[] = [
  {
    id: "mapear",
    titulo: "Mapear os riscos psicossociais",
    texto:
      "Conclui sozinha: na anônima, com a primeira resposta; nas outras, quando todos os convidados respondem.",
    itens: [],
  },
  {
    id: "plano",
    titulo: "Elaborar o plano de ação",
    texto:
      "Conclui sozinha quando o plano de ação tem a primeira medida registrada.",
    itens: [],
  },
  {
    id: "comunicar",
    titulo: "Comunicar os resultados às pessoas",
    texto: "Apresente o que foi medido e o que a empresa vai fazer.",
    itens: [
      "Marcar uma reunião com o time ou com cada área",
      "Apresentar os resultados e as medidas do plano",
      "Registrar a ata com a lista de presença",
    ],
    evidencias: "Ata, lista de presença e apresentação",
  },
  {
    id: "validar",
    titulo: "Validar com o profissional de SST e levar ao PGR",
    texto:
      "O inventário e o plano entram no Programa de Gerenciamento de Riscos.",
    itens: [
      "Consultar o engenheiro, técnico de segurança ou médico do trabalho",
      "Levar o relatório e o plano de ação para a análise",
      "Guardar o PGR atualizado e assinado",
    ],
    evidencias: "PGR assinado e registro do profissional",
  },
  {
    id: "treinar",
    titulo: "Treinar lideranças, CIPA e time",
    texto: "Preparar quem vai sustentar as medidas no dia a dia.",
    itens: [
      "Lideranças em saúde mental e gestão da carga de trabalho",
      "CIPA em prevenção do assédio moral e sexual",
      "Divulgar o canal de denúncia e o código de conduta",
    ],
    evidencias: "Certificados, listas de presença e conteúdo dos treinamentos",
  },
  {
    id: "implementar",
    titulo: "Implementar e acompanhar",
    texto: "Colocar as medidas em prática e medir o efeito.",
    itens: [
      "Pôr em prática as medidas do plano, com responsável e prazo",
      "Acompanhar os indicadores de cada medida",
      "Ajustar o que não estiver funcionando",
    ],
    evidencias: "Registros de acompanhamento e indicadores",
  },
  {
    id: "revisar",
    titulo: "Revisar e reaplicar",
    texto: "A avaliação se repete a cada ano ou quando o trabalho mudar.",
    itens: [
      "Revisar o plano com os resultados das medidas",
      "Reaplicar a pesquisa",
    ],
    evidencias: "Nova aplicação e plano revisado",
  },
];

export const CONTROLES: readonly {
  readonly id: ControleNr1;
  readonly rotulo: string;
  readonly texto: string;
}[] = [
  {
    id: "eliminacao",
    rotulo: "Eliminação",
    texto: "Tirar a causa do risco do trabalho.",
  },
  {
    id: "substituicao",
    rotulo: "Substituição",
    texto: "Trocar o processo ou a condição por outra menos arriscada.",
  },
  {
    id: "administrativo",
    rotulo: "Controles administrativos",
    texto: "Mudar organização, jornada, regras e capacitação.",
  },
  {
    id: "protecao",
    rotulo: "Proteção individual e coletiva",
    texto: "Apoio direto às pessoas expostas (escuta, acolhimento, pausas).",
  },
];

export const ROTULO_DO_CONTROLE = Object.fromEntries(
  CONTROLES.map((c) => [c.id, c.rotulo]),
) as Record<ControleNr1, string>;

export const ROTULO_DA_SITUACAO: Readonly<Record<SituacaoDaMedida, string>> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

/** "3,2". */
export const decimal = (n: number | null, casas = 1): string =>
  n === null
    ? "—"
    : (Math.round(n * 10 ** casas) / 10 ** casas)
        .toFixed(casas)
        .replace(".", ",");

/** Cores das frequências dos comportamentos ofensivos. */
export const COR_DA_FREQUENCIA = {
  raramente: "#F2B23E",
  asVezes: "#EA580C",
  frequente: "#DC2626",
} as const;

/** "33%". */
export const porcento = (n: number | null): string =>
  n === null ? "—" : `${Math.round(n)}%`;
