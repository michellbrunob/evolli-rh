/**
 * T216 — ligação das telas próprias da Avaliação 90°/180° e do Onboarding
 * automático com o módulo Pesquisas (assistente na rota do modelo e
 * resultados na página da pesquisa). As telas compartilhadas só perguntam
 * `ehModeloComTelaPropria` e montam estes componentes.
 */
import { useEffect, useState } from "react";
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
  base,
  hoje,
  onRascunhoCriado,
  onVoltar,
  onAbrirResultados,
}: {
  readonly modelo: string;
  readonly servico: Pick<
    ServicoDePesquisas,
    "criarPesquisa" | "alterarPesquisa" | "publicarPesquisa"
  > &
    Partial<Pick<ServicoDePesquisas, "empresaAtiva">>;
  /** O rascunho retomado (`<id>/rascunho`). */
  readonly base?: PesquisaDetalhe;
  readonly hoje: string;
  /** O rascunho foi gravado pela primeira vez (a rota passa a `<id>/rascunho`). */
  readonly onRascunhoCriado?: (id: string) => void;
  readonly onVoltar: () => void;
  readonly onAbrirResultados: (pesquisaId: string) => void;
}) {
  // O nome da empresa ativa vai para a prévia dos e-mails.
  const [empresa, setEmpresa] = useState<string | null>(null);
  useEffect(() => {
    if (!servico.empresaAtiva) return;
    let vivo = true;
    Promise.resolve(servico.empresaAtiva())
      .then((e) => {
        if (vivo) setEmpresa(e?.nome ?? null);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [servico]);
  const comuns = {
    servico,
    ...(base ? { base } : {}),
    empresa,
    hoje,
    ...(onRascunhoCriado ? { onRascunhoCriado } : {}),
    onVoltar,
  };
  if (ehAvaliacao(modelo)) {
    return (
      <AssistenteDaAvaliacao
        {...comuns}
        modelo={modelo}
        cliente={clienteDaAvaliacao}
        onAcompanhar={onAbrirResultados}
      />
    );
  }
  return (
    <AssistenteDoOnboarding
      {...comuns}
      cliente={clienteDoOnboarding}
      listarGrupos={listarGruposDoPublico}
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
