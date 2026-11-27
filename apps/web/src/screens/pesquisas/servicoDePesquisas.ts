/**
 * T216 — as chamadas do módulo Pesquisas (o shell liga o cliente real; os
 * testes, um falso). Participantes usam os clientes de colaboradores e de
 * departamentos que já existem.
 */
import {
  listarColaboradores,
  type ListagemColaboradoresApi,
  type ListarColaboradoresQuery,
} from "../../api/colaboradoresClient";
import {
  listarDepartamentos,
  type DepartamentoApi,
} from "../../api/organizacaoClient";
import * as cliente from "../../api/pesquisasClient";

export type ServicoDePesquisas = Pick<
  typeof cliente,
  | "listarPesquisas"
  | "criarPesquisa"
  | "obterPesquisa"
  | "alterarPesquisa"
  | "publicarPesquisa"
  | "alterarStatusDaPesquisa"
  | "duplicarPesquisa"
  | "excluirPesquisa"
  | "resultadosDaPesquisa"
  | "respostasDaPesquisa"
> & {
  /** Colaboradores ativos da empresa (busca, departamento, página). */
  readonly listarAtivos: (
    query: Pick<
      ListarColaboradoresQuery,
      "busca" | "departamentoId" | "pagina" | "tamanhoPagina"
    >,
  ) => Promise<ListagemColaboradoresApi>;
  /** Departamentos ativos da empresa (filtro dos participantes). */
  readonly listarDepartamentos: () => Promise<readonly DepartamentoApi[]>;
};

export const servicoDePesquisasDoServidor: ServicoDePesquisas = {
  listarPesquisas: cliente.listarPesquisas,
  criarPesquisa: cliente.criarPesquisa,
  obterPesquisa: cliente.obterPesquisa,
  alterarPesquisa: cliente.alterarPesquisa,
  publicarPesquisa: cliente.publicarPesquisa,
  alterarStatusDaPesquisa: cliente.alterarStatusDaPesquisa,
  duplicarPesquisa: cliente.duplicarPesquisa,
  excluirPesquisa: cliente.excluirPesquisa,
  resultadosDaPesquisa: cliente.resultadosDaPesquisa,
  respostasDaPesquisa: cliente.respostasDaPesquisa,
  listarAtivos: (query) => listarColaboradores({ ...query, grupo: "ativos" }),
  listarDepartamentos: async () =>
    (await listarDepartamentos({ status: "ativo", tamanhoPagina: 100 })).itens,
};
