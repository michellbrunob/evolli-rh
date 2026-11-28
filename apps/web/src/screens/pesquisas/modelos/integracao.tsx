/**
 * T216 — ligação das telas próprias da Avaliação 90°/180° e do Onboarding
 * automático com o módulo Pesquisas (assistente na rota do modelo e
 * resultados na página da pesquisa). As telas compartilhadas só perguntam
 * `ehModeloComTelaPropria` e montam estes componentes.
 */
import type {
  ModeloPesquisa,
  PesquisaDetalhe,
} from "../../../api/pesquisasClient";
import type { ServicoDePesquisas } from "../servicoDePesquisas";
import { AssistenteDaAvaliacao } from "./avaliacao/AssistenteDaAvaliacao";
import { ehAvaliacao } from "./avaliacao/catalogo";
import { clienteDaAvaliacao } from "./avaliacao/cliente";
import { ResultadosDaAvaliacao } from "./avaliacao/ResultadosDaAvaliacao";
import { AssistenteDoOnboarding } from "./onboarding/AssistenteDoOnboarding";
import { clienteDoOnboarding } from "./onboarding/cliente";
import { listarGruposDoPublico } from "./onboarding/gruposDoPublico";
import { ResultadosDoOnboarding } from "./onboarding/ResultadosDoOnboarding";

export function ehModeloComTelaPropria(
  modelo: ModeloPesquisa | string,
): boolean {
  return ehAvaliacao(modelo) || modelo === "onboarding";
}

export function AssistenteProprio({
  modelo,
  servico,
  hoje,
  onVoltar,
  onAbrirResultados,
}: {
  readonly modelo: string;
  readonly servico: Pick<
    ServicoDePesquisas,
    "criarPesquisa" | "alterarPesquisa" | "publicarPesquisa"
  >;
  readonly hoje: string;
  readonly onVoltar: () => void;
  readonly onAbrirResultados: (pesquisaId: string) => void;
}) {
  if (ehAvaliacao(modelo)) {
    return (
      <AssistenteDaAvaliacao
        modelo={modelo}
        servico={servico}
        cliente={clienteDaAvaliacao}
        hoje={hoje}
        onVoltar={onVoltar}
        onAcompanhar={onAbrirResultados}
      />
    );
  }
  return (
    <AssistenteDoOnboarding
      servico={servico}
      cliente={clienteDoOnboarding}
      listarGrupos={listarGruposDoPublico}
      hoje={hoje}
      onVoltar={onVoltar}
      onVerEnvios={onAbrirResultados}
    />
  );
}

export function ResultadosProprios({
  detalhe,
  hoje,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly hoje: string;
}) {
  if (ehAvaliacao(detalhe.modelo)) {
    return (
      <ResultadosDaAvaliacao
        pesquisaId={detalhe.id}
        nome={detalhe.nome}
        modelo={detalhe.modelo}
        cliente={clienteDaAvaliacao}
      />
    );
  }
  return (
    <ResultadosDoOnboarding
      pesquisaId={detalhe.id}
      nome={detalhe.nome}
      secoes={detalhe.secoes}
      cliente={clienteDoOnboarding}
      hoje={hoje}
    />
  );
}
