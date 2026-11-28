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
import { ResultadoIndividualDisc } from "./disc/ResultadoIndividualDisc";
import { ResultadosDisc, type AbaDisc } from "./disc/ResultadosDisc";
import type { CarregarPerfil } from "./disc/tiposDisc";

/**
 * Modelos com tela própria em todas as abas (o resultado vem de uma rota
 * própria, não de `ResultadosPesquisa.modelo`): Perfil comportamental
 * (DISC). `null` quando o modelo usa as abas comuns.
 */
export function abasDoModelo(x: {
  readonly detalhe: PesquisaDetalhe;
  readonly aba: AbaDisc;
  readonly carregarPerfil?: CarregarPerfil | undefined;
  readonly onAbrirResposta: (respostaId: string) => void;
  readonly onIrParaAnalises: () => void;
}): ReactNode | null {
  if (x.detalhe.modelo !== "disc") return null;
  return (
    <ResultadosDisc
      detalhe={x.detalhe}
      aba={x.aba}
      {...(x.carregarPerfil ? { carregar: x.carregarPerfil } : {})}
      onAbrirResposta={x.onAbrirResposta}
      onIrParaAnalises={x.onIrParaAnalises}
    />
  );
}

/** A página do resultado individual própria do modelo (DISC), ou `null`. */
export function paginaIndividualDoModelo(x: {
  readonly pesquisa: PesquisaDetalhe;
  readonly respostaId: string;
  readonly carregarPerfil?: CarregarPerfil | undefined;
  readonly onVoltar: () => void;
  readonly onIr?: ((respostaId: string) => void) | undefined;
}): ReactNode | null {
  if (x.pesquisa.modelo !== "disc") return null;
  return (
    <ResultadoIndividualDisc
      pesquisa={x.pesquisa}
      respostaId={x.respostaId}
      {...(x.carregarPerfil ? { carregar: x.carregarPerfil } : {})}
      onVoltar={x.onVoltar}
      onIr={x.onIr}
    />
  );
}

/**
 * Avaliação 90°/180° e Onboarding automático: resultados inteiros
 * próprios (rotas próprias da API), no lugar das abas da pesquisa.
 */
export { ResultadosProprios, ehModeloComTelaPropria } from "./integracao";

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
