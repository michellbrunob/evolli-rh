/**
 * T216 — eNPS: a pergunta principal (0 a 10, fixa: é ela que calcula o
 * eNPS), 5 complementares na mesma escala de 0 a 10 e 2 abertas
 * obrigatórias. "Adicionar pergunta" oferece escala de 0 a 10 ou texto
 * livre. Zonas do eNPS: crítica < 0, aperfeiçoamento 0–49, qualidade
 * 50–74, excelência 75–100.
 */
import type { Pergunta } from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import type {
  ModeloDaGaleria,
  PerguntaDoModelo,
  PerguntaPadrao,
} from "../tipos";
import { CalculoDoEnps, PrincipalDoEnps } from "./SobreEnps";

export const CHAVE_PRINCIPAL_DO_ENPS = "enps_principal";

/** As pontas da escala de 0 a 10 (a principal e as complementares). */
export const PONTAS_DO_ENPS = ["Nada provável", "Muito provável"] as const;

const ESCALA_0_10: PerguntaPadrao = {
  tipo: "escala",
  config: {
    minimo: 0,
    maximo: 10,
    rotuloMinimo: PONTAS_DO_ENPS[0],
    rotuloMaximo: PONTAS_DO_ENPS[1],
  },
};

const complementar = (
  chave: string,
  rotulo: string,
  texto: string,
): PerguntaDoModelo => ({
  chave,
  tipo: "escala",
  rotulo,
  texto,
  config: { ...ESCALA_0_10.config },
});

/** "4º trimestre 2026". */
export function trimestreDe(hoje: string): string {
  const mes = Number(hoje.slice(5, 7));
  return `${Math.ceil(mes / 3)}º trimestre ${hoje.slice(0, 4)}`;
}

/** A principal: nota 0–10 marcada como eNPS. */
export const ehPrincipalDoEnps = (p: Pergunta): boolean =>
  p.tipo === "nota_0_10" && p.config.enps === true;

/** Uma complementar: nota de 0 a 10 que não é de recomendação. */
export const ehComplementarDoEnps = (p: Pergunta): boolean =>
  (p.tipo === "escala" &&
    (p.config.minimo ?? 1) === 0 &&
    (p.config.maximo ?? 5) === 10) ||
  (p.tipo === "nota_0_10" && !p.config.enps && !p.config.lnps);

/** "1 principal · 5 complementares · 2 abertas" (sem os grupos vazios). */
export function resumoDasPerguntasDoEnps(perguntas: readonly Pergunta[]) {
  const principais = perguntas.filter(ehPrincipalDoEnps).length;
  const complementares = perguntas.filter(ehComplementarDoEnps).length;
  const abertas = perguntas.filter(
    (p) => p.tipo === "paragrafo" || p.tipo === "texto_curto",
  ).length;
  return [
    principais > 0 ? `${principais} principal` : null,
    complementares > 0
      ? plural(complementares, "complementar", "complementares")
      : null,
    abertas > 0 ? plural(abertas, "aberta", "abertas") : null,
  ]
    .filter((x): x is string => x !== null)
    .join(" · ");
}

export const ENPS: ModeloDaGaleria = {
  id: "enps",
  modelo: "enps",
  nome: "eNPS",
  categoria: "clima",
  icone: "enps",
  tom: "teal",
  descricao:
    "Satisfação e lealdade pelo eNPS: quanto as pessoas indicariam a empresa, com perguntas para entender a nota.",
  fatos: [{ icone: "perguntas", texto: "1 pergunta + complementares" }],
  ritmo: "Uma pergunta · recorrente",
  frequencia: "Trimestral",
  sobre:
    "Promotores (9 e 10) menos detratores (0 a 6), de −100 a 100, com 5 perguntas complementares e 2 abertas para entender a nota.",
  nomeBase: "eNPS",
  nomeDaPesquisa: (hoje) => `eNPS – ${trimestreDe(hoje)}`,
  boasVindas: "É rápido: uma nota de 0 a 10 e algumas perguntas sobre ela.",
  secoes: [
    {
      titulo: "Principal",
      cor: "--modelo-teal",
      perguntas: [
        {
          chave: CHAVE_PRINCIPAL_DO_ENPS,
          tipo: "nota_0_10",
          rotulo: "eNPS",
          texto:
            "De 0 a 10, quanto você recomendaria a {empresa} como lugar para trabalhar?",
          config: {
            enps: true,
            rotuloMinimo: PONTAS_DO_ENPS[0],
            rotuloMaximo: PONTAS_DO_ENPS[1],
          },
        },
      ],
    },
    {
      titulo: "Complementares",
      cor: "--grafico-1",
      perguntas: [
        complementar(
          "enps_satisfacao",
          "Satisfação geral",
          "De 0 a 10, qual é a sua satisfação geral com a empresa?",
        ),
        complementar(
          "enps_ambiente",
          "Ambiente",
          "De 0 a 10, como você avalia o ambiente de trabalho?",
        ),
        complementar(
          "enps_lideranca",
          "Liderança direta",
          "De 0 a 10, como você avalia a sua relação com a liderança direta?",
        ),
        complementar(
          "enps_crescimento",
          "Crescimento",
          "De 0 a 10, como você avalia as suas oportunidades de crescimento aqui?",
        ),
        complementar(
          "enps_reconhecimento",
          "Reconhecimento",
          "De 0 a 10, quanto o seu trabalho é reconhecido aqui?",
        ),
      ],
    },
    {
      titulo: "Abertas",
      cor: "--modelo-cinza",
      perguntas: [
        {
          chave: "enps_gosta",
          tipo: "paragrafo",
          rotulo: "O que mais gosta",
          texto: "O que você mais gosta em trabalhar aqui?",
          obrigatoria: true,
        },
        {
          chave: "enps_melhoraria",
          tipo: "paragrafo",
          rotulo: "O que melhoraria",
          texto: "O que você melhoraria aqui?",
          obrigatoria: true,
        },
      ],
    },
  ],
  comentarioFinal: null,
  perguntaPadrao: ESCALA_0_10,
  tiposParaAdicionar: [
    { rotulo: "Escala de 0 a 10", pergunta: ESCALA_0_10 },
    { rotulo: "Texto livre", pergunta: { tipo: "paragrafo", config: {} } },
  ],
  chavesFixas: [CHAVE_PRINCIPAL_DO_ENPS],
  resumoDasPerguntas: resumoDasPerguntasDoEnps,
  limite: 15,
  minimo: 1,
  pagina: {
    titulo: "eNPS · Recomendação da empresa",
    selo: "8 perguntas",
    texto:
      "Uma nota de 0 a 10 diz quanto as pessoas indicariam a empresa como lugar para trabalhar. As complementares e as abertas explicam a nota.",
    metadados: [
      "Cerca de 3 minutos para responder",
      "Identificada, CPF confidencial ou anônima",
      "eNPS de −100 a 100",
    ],
    botaoVer: "Ver as perguntas",
    botaoCriar: "Criar pesquisa",
    numeros: [
      { valor: "1", rotulo: "pergunta principal de 0 a 10" },
      { valor: "5", rotulo: "complementares de 0 a 10" },
      { valor: "2", rotulo: "perguntas abertas" },
      { valor: "−100 a 100", rotulo: "a escala do eNPS" },
    ],
    conteudo: [
      {
        tipo: "componente",
        titulo: "A pergunta principal",
        Componente: PrincipalDoEnps,
      },
      {
        tipo: "grupos",
        titulo: "Perguntas complementares",
        descricao:
          "Na mesma escala de 0 a 10: mostram o que puxa a nota para cima ou para baixo.",
        itens: [
          ["Satisfação geral", "A satisfação com a empresa, no geral."],
          ["Ambiente", "Como é o ambiente de trabalho."],
          ["Liderança direta", "A relação com a liderança direta."],
          ["Crescimento", "As oportunidades de crescimento."],
          ["Reconhecimento", "O quanto o trabalho é reconhecido."],
        ].map(([titulo, subtitulo], i) => ({
          titulo: titulo!,
          subtitulo: subtitulo!,
          numero: String(i + 2).padStart(2, "0"),
          quantidade: "0 a 10",
          cor: "--grafico-1",
        })),
      },
      {
        tipo: "grupos",
        titulo: "Perguntas abertas",
        descricao:
          "Texto livre: o porquê da nota, nas palavras de cada pessoa.",
        itens: [
          ["O que mais gosta", "O que a pessoa mais valoriza na empresa."],
          ["O que melhoraria", "O que mudaria para a nota subir."],
        ].map(([titulo, subtitulo], i) => ({
          titulo: titulo!,
          subtitulo: subtitulo!,
          numero: String(i + 7).padStart(2, "0"),
          quantidade: "Texto livre",
          cor: "--modelo-cinza",
        })),
      },
      {
        tipo: "componente",
        titulo: "Como o eNPS é calculado",
        Componente: CalculoDoEnps,
      },
    ],
  },
};
