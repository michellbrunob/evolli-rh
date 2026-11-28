/**
 * T216 — o relatório em PDF dos modelos com tela própria (Avaliação
 * 90°/180° e Onboarding), montado pela rota `#/pesquisas/<id>/relatorio`
 * como os demais, com os dados das rotas próprias de cada modelo.
 */
import type { PesquisaDetalhe } from "../../../api/pesquisasClient";
import { ehAvaliacao } from "./avaliacao/catalogo";
import { clienteDaAvaliacao } from "./avaliacao/cliente";
import { RelatorioDaAvaliacao } from "./avaliacao/RelatorioDaAvaliacao";
import { clienteDoOnboarding } from "./onboarding/cliente";
import { RelatorioDoOnboarding } from "./onboarding/RelatorioDoOnboarding";

export function RelatorioProprio({
  detalhe,
  empresa,
  imprimir,
  hoje,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly empresa: string;
  readonly imprimir: boolean;
  readonly hoje: string;
}) {
  if (ehAvaliacao(detalhe.modelo)) {
    return (
      <RelatorioDaAvaliacao
        pesquisaId={detalhe.id}
        nome={detalhe.nome}
        modelo={detalhe.modelo}
        empresa={empresa}
        imprimir={imprimir}
        hoje={hoje}
        cliente={clienteDaAvaliacao}
      />
    );
  }
  return (
    <RelatorioDoOnboarding
      pesquisaId={detalhe.id}
      nome={detalhe.nome}
      secoes={detalhe.secoes}
      empresa={empresa}
      imprimir={imprimir}
      hoje={hoje}
      cliente={clienteDoOnboarding}
    />
  );
}
