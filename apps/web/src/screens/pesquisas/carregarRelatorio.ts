/**
 * T216 — carrega o que o relatório de resultados precisa (planilha e PDF):
 * a pesquisa, os resultados gerais, a empresa ativa, a lista de respostas
 * (nunca na confidencial) e o mapa por grupo, quando há recorte.
 */
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  RespostaResumo,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import {
  montarRelatorio,
  type RelatorioDeResultados,
} from "./dadosDoRelatorio";
import type { ServicoDePesquisas } from "./servicoDePesquisas";

export interface RelatorioCarregado {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly empresa: string;
  /** `null` na confidencial (sem respostas individuais). */
  readonly lista: readonly RespostaResumo[] | null;
  readonly rel: RelatorioDeResultados;
}

export async function carregarRelatorio(
  servico: ServicoDePesquisas,
  pesquisaId: string,
  hoje: string,
): Promise<RelatorioCarregado> {
  const [detalhe, geral, empresa] = await Promise.all([
    Promise.resolve(servico.obterPesquisa(pesquisaId)),
    Promise.resolve(servico.resultadosDaPesquisa(pesquisaId)),
    Promise.resolve(servico.empresaAtiva()).catch(() => null),
  ]);
  const lista =
    detalhe.identificacao === "confidencial"
      ? null
      : ((await Promise.resolve(servico.respostasDaPesquisa(pesquisaId)).catch(
          () => [],
        )) ?? []);
  const campo =
    geral.recortes?.[0] ??
    (geral.departamentos.length > 0 ? ("departamento" as const) : null);
  const analises = campo
    ? await Promise.resolve(
        servico.analisesDaPesquisa(pesquisaId, campo),
      ).catch(() => null)
    : null;
  const nomeDaEmpresa = empresa?.nome ?? "";
  return {
    detalhe,
    geral,
    empresa: nomeDaEmpresa,
    lista,
    rel: montarRelatorio({
      detalhe,
      geral,
      empresa: nomeDaEmpresa,
      hoje,
      respostas: lista,
      analises: analises ?? null,
    }),
  };
}

/** As respostas completas (para a aba Participantes). */
export async function respostasCompletas(
  servico: ServicoDePesquisas,
  pesquisaId: string,
  lista: readonly RespostaResumo[] | null,
): Promise<RespostaDetalhe[] | null> {
  if (!lista) return null;
  return Promise.all(
    lista.map((r) => servico.respostaDaPesquisa(pesquisaId, r.id)),
  );
}
