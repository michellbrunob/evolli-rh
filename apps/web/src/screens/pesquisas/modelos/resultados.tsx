/**
 * T216 — o registro das telas de resultado dos modelos com cálculo próprio.
 * A Visão geral usa a tela do modelo quando a API manda
 * `ResultadosPesquisa.modelo`; o resultado individual usa a do modelo
 * quando vem `RespostaDetalhe.modelo`. Cada frente acrescenta a sua linha.
 */
import type { ReactNode } from "react";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadosPesquisa,
} from "../../../api/pesquisasClient";
import { ResultadoClimaVisao } from "./clima/ResultadoClima";
import { ResultadoPulsoClima } from "./pulso_clima/ResultadoPulsoClima";
import { PainelTad, ResultadoTadVisao } from "./tad/ResultadoTad";

/** A Visão geral própria do modelo, ou `null` (usa a visão por pergunta). */
export function visaoGeralDoModelo(
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
): ReactNode | null {
  const r = geral.modelo;
  if (!r) return null;
  switch (r.modelo) {
    case "pulso_clima":
      return <ResultadoPulsoClima detalhe={detalhe} geral={geral} r={r} />;
    case "clima":
      return <ResultadoClimaVisao detalhe={detalhe} geral={geral} r={r} />;
    case "tad":
      return <ResultadoTadVisao r={r} />;
    default:
      return null;
  }
}

/** O resultado da pessoa no modelo (resultado individual), ou `null`. */
export function resultadoIndividualDoModelo(
  resposta: RespostaDetalhe,
): ReactNode | null {
  const r = resposta.modelo;
  if (!r) return null;
  switch (r.modelo) {
    case "tad":
      return <PainelTad r={r} titulo="Score geral de motivação" />;
    default:
      return null;
  }
}
