/**
 * T216 — as chamadas do módulo Pesquisas (o shell liga o cliente real; os
 * testes, um falso). Participantes e recortes usam os clientes de
 * colaboradores e da estrutura organizacional que já existem.
 */
import {
  listarColaboradores,
  type ColaboradorListadoApi,
  type ListagemColaboradoresApi,
  type ListarColaboradoresQuery,
} from "../../api/colaboradoresClient";
import {
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarUnidades,
  type DepartamentoApi,
} from "../../api/organizacaoClient";
import { listarEmpresasDoContexto } from "../../api/contextoEmpresarialClient";
import { listarEmpresas } from "../../api/organizacaoClient";
import * as cliente from "../../api/pesquisasClient";
import type { CampoGrupo } from "../../api/pesquisasClient";
import { distinguirNomesRepetidos } from "./nomesDosGrupos";
import {
  perfilComportamental,
  type CarregarPerfil,
} from "./modelos/disc/tiposDisc";

/** Uma opção de recorte (departamento, centro de custo, unidade ou área). */
export interface OpcaoDeGrupo {
  readonly id: string;
  readonly nome: string;
}

/** As opções de cada campo da estrutura (a área entra só no filtro de pessoas). */
export type GruposDaEmpresa = Readonly<
  Record<CampoGrupo | "area", readonly OpcaoDeGrupo[]>
>;

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
  | "analisesDaPesquisa"
  | "respostaDaPesquisa"
  | "listarCandidatos"
  | "contagemDoTime"
> & {
  /** Todos os candidatos (para "Todo o time": contagem, grupos e lista). */
  readonly listarTodosCandidatos: () => Promise<
    readonly cliente.CandidatoPesquisa[]
  >;
  /** Colaboradores ativos da empresa (busca, filtros e página). */
  readonly listarAtivos: (
    query: Pick<
      ListarColaboradoresQuery,
      | "busca"
      | "departamentoId"
      | "departamentos"
      | "centrosCusto"
      | "areas"
      | "pagina"
      | "tamanhoPagina"
    >,
  ) => Promise<ListagemColaboradoresApi>;
  /** Todos os colaboradores ativos (para "Todo o time": contagem e grupos). */
  readonly listarTodosAtivos: () => Promise<readonly ColaboradorListadoApi[]>;
  /** Departamentos ativos da empresa. */
  readonly listarDepartamentos: () => Promise<readonly DepartamentoApi[]>;
  /** Departamentos, centros de custo, unidades e áreas ativos. */
  readonly listarGrupos: () => Promise<GruposDaEmpresa>;
  /** Empresas em que a pessoa pode criar a cópia (duplicar). */
  readonly listarEmpresas: () => Promise<
    readonly { id: string; nome: string }[]
  >;
  /** A empresa ativa (para cadastrar um grupo na hora). */
  readonly empresaAtiva: () => Promise<{ id: string; nome: string } | null>;
  /** Perfil comportamental (DISC); sem ele, a tela usa o cliente real. */
  readonly perfilComportamental?: CarregarPerfil;
};

const TETO_DE_PESSOAS = 5000;

/** Todas as páginas de candidatos de um filtro (até o teto). */
export async function todosOsCandidatos(
  listar: ServicoDePesquisas["listarCandidatos"],
  filtro: Omit<cliente.ListarCandidatosQuery, "pagina" | "tamanhoPagina"> = {},
): Promise<cliente.CandidatoPesquisa[]> {
  const todos: cliente.CandidatoPesquisa[] = [];
  for (let pagina = 1; todos.length < TETO_DE_PESSOAS; pagina += 1) {
    const r = await listar({ ...filtro, pagina, tamanhoPagina: 100 });
    todos.push(...(r?.itens ?? []));
    if (!r || r.itens.length === 0 || todos.length >= r.total) break;
  }
  return todos;
}

const ativos = (query: Parameters<ServicoDePesquisas["listarAtivos"]>[0]) =>
  listarColaboradores({ ...query, grupo: "ativos" });

/** Nomes repetidos ganham o código do cadastro (ex.: "Comercial (D02)"). */
const opcoes = (
  itens: readonly { id: string; nome: string; codigo?: string | null }[],
) => distinguirNomesRepetidos(itens);

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
  analisesDaPesquisa: cliente.analisesDaPesquisa,
  respostaDaPesquisa: cliente.respostaDaPesquisa,
  listarCandidatos: cliente.listarCandidatos,
  contagemDoTime: cliente.contagemDoTime,
  perfilComportamental,
  listarTodosCandidatos: () => todosOsCandidatos(cliente.listarCandidatos),
  listarAtivos: ativos,
  listarTodosAtivos: async () => {
    const todos: ColaboradorListadoApi[] = [];
    for (let pagina = 1; todos.length < TETO_DE_PESSOAS; pagina += 1) {
      const r = await ativos({ pagina, tamanhoPagina: 100 });
      todos.push(...r.itens);
      if (r.itens.length === 0 || todos.length >= r.total) break;
    }
    return todos;
  },
  listarDepartamentos: async () =>
    (await listarDepartamentos({ status: "ativo", tamanhoPagina: 100 })).itens,
  listarGrupos: async () => {
    const [dep, cc, un, ar] = await Promise.all([
      listarDepartamentos({ status: "ativo", tamanhoPagina: 100 }),
      listarCentrosCusto({ status: "ativo", tamanhoPagina: 100 }),
      listarUnidades({ status: "ativo", tamanhoPagina: 100 }),
      listarAreas({ status: "ativo", tamanhoPagina: 100 }),
    ]);
    return {
      departamento: opcoes(dep.itens),
      centroCusto: opcoes(cc.itens),
      unidade: opcoes(un.itens),
      area: opcoes(ar.itens),
    };
  },
  listarEmpresas: async () => opcoes(await listarEmpresasDoContexto()),
  empresaAtiva: async () => {
    const r = await listarEmpresas();
    const e = r.itens[0];
    return e ? { id: e.id, nome: e.nome } : null;
  },
};
