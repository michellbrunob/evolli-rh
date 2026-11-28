/**
 * T216 — as abas da planilha (.xlsx) próprias de cada modelo com cálculo:
 * Pulso e Clima ("Dimensões": score 0–100, classificação, respostas,
 * perguntas, o geral, o eNPS e o LNPS), Clima ("Dimensões" com as
 * subdimensões, % favorável, neutro e desfavorável) e TAD ("Pilares":
 * time, pilares e as pessoas por nível), NR-1 e saúde financeira
 * (`planilhasDosModelos.ts`). Entram logo depois do Resumo.
 */
import type {
  DimensaoDoModelo,
  RecomendacaoDoModelo,
  RespostaDetalhe,
  ResultadosPesquisa,
  Secao,
} from "../../../api/pesquisasClient";
import { abasDaPlanilhaIsfb, abasDaPlanilhaNr1 } from "./planilhasDosModelos";
import type {
  AbaXlsx,
  CelulaXlsx,
} from "../../pessoas/importacao/planilhaXlsx";
import {
  ROTULO_DA_FAIXA,
  ROTULO_DA_RECOMENDACAO,
  ROTULO_DO_NIVEL,
  pct,
} from "./resultadoComum";

const porcento = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: v / 100, formato: "percentual" };
const duas = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: Math.round(v * 100) / 100, formato: "decimal" };

function cabecalho(
  titulo: string,
  empresa: string,
  nome: string,
): CelulaXlsx[][] {
  return [[titulo], [`${empresa || "Empresa"} · ${nome}`], []];
}

function linhaDaRecomendacao(
  rotulo: string,
  r: RecomendacaoDoModelo,
): CelulaXlsx[] {
  return [
    rotulo,
    r.indice ?? "—",
    r.faixa ? ROTULO_DA_RECOMENDACAO[r.faixa] : "—",
    r.respostas,
    porcento(pct(r.promotores, r.respostas)),
    porcento(pct(r.neutros, r.respostas)),
    porcento(pct(r.detratores, r.respostas)),
  ];
}

function linhaDaDimensao(d: DimensaoDoModelo, recuo = ""): CelulaXlsx[] {
  return [
    `${recuo}${d.rotulo}`,
    d.score ?? "—",
    d.faixa ? ROTULO_DA_FAIXA[d.faixa] : "—",
    d.respostas,
    d.afirmacoes,
    porcento(d.favoravel),
    porcento(d.neutro),
    porcento(d.desfavoravel),
  ];
}

/** As abas do modelo, ou nenhuma (modelo sem cálculo próprio). */
export function abasDoModelo(
  geral: ResultadosPesquisa,
  empresa: string,
  nome: string,
  /** NR-1 e saúde financeira: o mínimo por grupo, as respostas e as perguntas. */
  extra: {
    readonly minimoPorGrupo?: number;
    readonly respostas?: readonly RespostaDetalhe[] | null;
    readonly secoes?: readonly Secao[];
  } = {},
): AbaXlsx[] {
  const r = geral.modelo;
  if (!r) return [];
  const colunas = [
    "Dimensão",
    "Score (0 a 100)",
    "Classificação",
    "Respostas",
    "Perguntas",
    "Favorável",
    "Neutro",
    "Desfavorável",
  ];
  switch (r.modelo) {
    case "pulso_clima": {
      const linhas: CelulaXlsx[][] = [
        ...cabecalho("Dimensões", empresa, nome),
        colunas,
        ...r.dimensoes.map((d) => linhaDaDimensao(d)),
        [
          "Score geral",
          r.score ?? "—",
          r.faixa ? ROTULO_DA_FAIXA[r.faixa] : "—",
          "",
          r.afirmacoes.length,
          porcento(r.favoravel),
          porcento(r.neutro),
          porcento(r.desfavoravel),
        ],
        [],
        [
          "Recomendação",
          "Índice",
          "Classificação",
          "Respostas",
          "Promotores",
          "Neutros",
          "Detratores",
        ],
        linhaDaRecomendacao("eNPS · empresa", r.enps),
        linhaDaRecomendacao("LNPS · liderança direta", r.lnps),
      ];
      return [
        {
          nome: "Dimensões",
          larguras: [36, 14, 14, 11, 11, 11, 10, 13],
          titulo: true,
          linhasDeCabecalho: [3, 3 + r.dimensoes.length + 3],
          linhas,
        },
      ];
    }
    case "clima": {
      const linhas: CelulaXlsx[][] = [
        ...cabecalho("Dimensões", empresa, nome),
        colunas,
        ...r.dimensoes.flatMap((d) => [
          linhaDaDimensao(d),
          ...(d.subdimensoes ?? []).map((s) => linhaDaDimensao(s, "   ")),
        ]),
        [
          "Geral",
          r.score ?? "—",
          r.faixa ? ROTULO_DA_FAIXA[r.faixa] : "—",
          "",
          r.afirmacoes.length,
          porcento(r.favoravel),
          porcento(r.neutro),
          porcento(r.desfavoravel),
        ],
        [],
        [
          "A classificação vem do % favorável (4 e 5): abaixo de 50% crítico, 50% a 69% atenção, 70% a 84% saudável, 85% ou mais forte.",
        ],
      ];
      return [
        {
          nome: "Dimensões",
          larguras: [36, 14, 14, 11, 11, 11, 10, 13],
          titulo: true,
          linhasDeCabecalho: [3],
          linhas,
        },
      ];
    }
    case "tad": {
      const linhas: CelulaXlsx[][] = [
        ...cabecalho("Pilares", empresa, nome),
        ["Pilar", "Score (1 a 7)", "Nível", "Perguntas"],
        ...r.pilares.map((p): CelulaXlsx[] => [
          p.rotulo,
          duas(p.score),
          p.nivel ? ROTULO_DO_NIVEL[p.nivel] : "—",
          p.perguntas,
        ]),
        [
          "Score geral",
          duas(r.geral),
          r.nivel ? ROTULO_DO_NIVEL[r.nivel] : "—",
          "",
        ],
        [],
        ["Nível", "Pessoas"],
        ["Alto (5,5 a 7,0)", r.niveis.alto],
        ["Moderado (3,5 a 5,4)", r.niveis.moderado],
        ["Baixo (1,0 a 3,4)", r.niveis.baixo],
        ["Respondentes", r.respondentes],
        [],
        [
          "Item invertido conta 8 − resposta; pilar = média dos itens; geral = média dos 3 pilares; time = média das pessoas.",
        ],
      ];
      return [
        {
          nome: "Pilares",
          larguras: [28, 14, 12, 11],
          titulo: true,
          linhasDeCabecalho: [3, 3 + r.pilares.length + 3],
          linhas,
        },
      ];
    }
    case "copsoq":
      return abasDaPlanilhaNr1({
        empresa,
        nome,
        resultado: r,
        minimoPorGrupo: extra.minimoPorGrupo ?? 3,
      });
    case "isfb":
      return abasDaPlanilhaIsfb({
        empresa,
        nome,
        resultado: r,
        minimoPorGrupo: extra.minimoPorGrupo ?? 3,
        respostas: extra.respostas ?? null,
        secoes: extra.secoes ?? [],
      });
    default:
      return [];
  }
}
