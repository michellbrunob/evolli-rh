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
  RespostaResumo,
  ResultadosPesquisa,
  Secao,
} from "../../../api/pesquisasClient";
import type { ServicoDePesquisas } from "../servicoDePesquisas";
import { AnalisesClima } from "./clima/AnalisesClima";
import { temTelasDoClima } from "./clima/catalogo";
import { AnalisesEnps } from "./enps/AnalisesEnps";
import { IndividualEnps, RespostasEnps } from "./enps/RespostasEnps";
import { VisaoGeralEnps } from "./enps/VisaoGeralEnps";
import { ResultadoClimaVisao } from "./clima/ResultadoClima";
import {
  ListaDeRespostasClima,
  VisaoIndividualClima,
} from "./clima/RespostasClima";
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
import { IndividualNr1Tela } from "./copsoq/IndividualNr1";
import { IndividualIsfb, VisaoGeralIsfb } from "./isfb/VisaoGeralIsfb";
import { painelDe, VisaoGeralNr1DoRegistro } from "./registro";

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
    case "copsoq":
      return <VisaoGeralNr1DoRegistro detalhe={detalhe} geral={geral} />;
    case "isfb":
      return <VisaoGeralIsfb resultado={painelDe(detalhe, geral)} />;
    case "enps":
      return <VisaoGeralEnps detalhe={detalhe} geral={geral} r={r} />;
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
    case "copsoq":
      return <IndividualNr1Tela p={r} />;
    case "isfb":
      return <IndividualIsfb p={r} />;
    default:
      return null;
  }
}

/** A aba Análises própria do modelo (Clima, eNPS), ou `null` (usa a comum). */
export function analisesDoModelo(x: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly respostas: readonly RespostaResumo[] | null;
  readonly onDuplicar?: () => void;
}): ReactNode | null {
  const r = x.geral.modelo;
  if (r?.modelo === "enps")
    return (
      <AnalisesEnps
        servico={x.servico}
        detalhe={x.detalhe}
        geral={x.geral}
        r={r}
      />
    );
  if (!temTelasDoClima(x.detalhe, x.geral)) return null;
  return (
    <AnalisesClima
      servico={x.servico}
      detalhe={x.detalhe}
      geral={x.geral}
      respostas={x.respostas}
      {...(x.onDuplicar ? { onDuplicar: x.onDuplicar } : {})}
    />
  );
}

/** A lista da aba Respostas própria do modelo (Clima, eNPS), ou `null`. */
export function listaDeRespostasDoModelo(x: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly respostas: readonly RespostaResumo[] | null;
  readonly onAbrir: (id: string) => void;
}): ReactNode | null {
  if (x.detalhe.modelo === "enps")
    return (
      <RespostasEnps
        detalhe={x.detalhe}
        respostas={x.respostas}
        onAbrir={x.onAbrir}
      />
    );
  if (!temTelasDoClima(x.detalhe, x.geral)) return null;
  return (
    <ListaDeRespostasClima
      detalhe={x.detalhe}
      respostas={x.respostas}
      onAbrir={x.onAbrir}
    />
  );
}

/**
 * A visão geral própria do resultado individual (Clima, eNPS), no lugar dos
 * indicadores comuns (média de 0 a 10, recomendação), ou `null`.
 */
export function visaoIndividualDoModelo(
  resposta: RespostaDetalhe,
  secoes: readonly Secao[],
): ReactNode | null {
  const r = resposta.modelo;
  if (r?.modelo === "enps")
    return <IndividualEnps p={r} resposta={resposta} secoes={secoes} />;
  if (r?.modelo !== "clima") return null;
  return <VisaoIndividualClima resposta={resposta} p={r} secoes={secoes} />;
}
