/**
 * T216 — as faixas do índice do Clima (% favorável): crítica < 50 ·
 * atenção 50–64 · boa 65–79 · excelente ≥ 80. A mesma régua na tela, no
 * "Sobre o modelo", na planilha e no PDF.
 */
import type { FaixaClima } from "../../../../api/pesquisasClient";
import type { FaixaVisual } from "../resultadoComum";

export const ROTULO_DA_FAIXA_CLIMA: Readonly<Record<FaixaClima, string>> = {
  critica: "Crítica",
  atencao: "Atenção",
  boa: "Boa",
  excelente: "Excelente",
};

/** A cor de cada faixa (as mesmas peças visuais dos outros modelos). */
export const VISUAL_DA_FAIXA_CLIMA: Readonly<Record<FaixaClima, FaixaVisual>> =
  {
    critica: "critico",
    atencao: "atencao",
    boa: "saudavel",
    excelente: "forte",
  };

/** As faixas na ordem da régua, com o intervalo e o token da cor. */
export const FAIXAS_CLIMA: readonly {
  readonly faixa: FaixaClima;
  readonly rotulo: string;
  readonly intervalo: string;
  readonly curto: string;
  readonly de: number;
  readonly ate: number;
  readonly cor: string;
}[] = [
  {
    faixa: "critica",
    rotulo: "Crítica",
    intervalo: "abaixo de 50%",
    curto: "< 50%",
    de: 0,
    ate: 50,
    cor: "--faixa-critico",
  },
  {
    faixa: "atencao",
    rotulo: "Atenção",
    intervalo: "50% a 64%",
    curto: "50–64%",
    de: 50,
    ate: 65,
    cor: "--faixa-atencao",
  },
  {
    faixa: "boa",
    rotulo: "Boa",
    intervalo: "65% a 79%",
    curto: "65–79%",
    de: 65,
    ate: 80,
    cor: "--faixa-saudavel",
  },
  {
    faixa: "excelente",
    rotulo: "Excelente",
    intervalo: "80% ou mais",
    curto: "≥ 80%",
    de: 80,
    ate: 100,
    cor: "--faixa-forte",
  },
];

/** < 50 crítica · 50–64 atenção · 65–79 boa · ≥ 80 excelente. */
export function faixaDoClima(favoravel: number): FaixaClima {
  if (favoravel < 50) return "critica";
  if (favoravel < 65) return "atencao";
  if (favoravel < 80) return "boa";
  return "excelente";
}

/** O que a faixa do índice quer dizer, numa frase. */
export const FRASE_DA_FAIXA_CLIMA: Readonly<Record<FaixaClima, string>> = {
  critica:
    "Menos da metade das respostas é favorável: o clima pede ação imediata.",
  atencao:
    "Metade ou um pouco mais das respostas é favorável: há pontos para cuidar.",
  boa: "A maior parte das respostas é favorável: o clima é bom, com espaço para crescer.",
  excelente: "Quatro em cada cinco respostas ou mais são favoráveis.",
};

/** A frase que explica as faixas (planilha e PDF). */
export const TEXTO_DAS_FAIXAS_CLIMA =
  "Crítica abaixo de 50%, atenção de 50% a 64%, boa de 65% a 79% e excelente a partir de 80% de respostas favoráveis.";
