/**
 * T215 — as chamadas da página Políticas de férias (o shell liga o cliente
 * real; os testes, um falso) e as opções de "Só algumas pessoas".
 */
import {
  type ListaDePoliticasApi,
  type PoliticaFeriasApi,
  type PoliticaFeriasDto,
  alterarPoliticaFerias,
  criarPoliticaFerias,
  desativarPoliticaFerias,
  listarPoliticasFerias,
  obterPoliticaFerias,
  reativarPoliticaFerias,
} from "../../../../api/politicasFeriasClient";
import {
  listarDepartamentosParaEquipe,
  listarUnidadesParaEquipe,
} from "../../../../api/organizacaoClient";
import { listarColaboradores } from "../../../../api/colaboradoresClient";

export type TipoDeAlvo = "departamento" | "unidade" | "pessoa";

export interface ServicoDePoliticas {
  readonly listar: () => Promise<ListaDePoliticasApi>;
  readonly obter: (id: string) => Promise<PoliticaFeriasApi>;
  readonly criar: (dto: PoliticaFeriasDto) => Promise<PoliticaFeriasApi>;
  readonly alterar: (
    id: string,
    dto: PoliticaFeriasDto,
  ) => Promise<PoliticaFeriasApi>;
  readonly desativar: (id: string) => Promise<PoliticaFeriasApi>;
  readonly reativar: (id: string) => Promise<PoliticaFeriasApi>;
  /** As opções de cada "Por:" (departamentos, unidades ou pessoas). */
  readonly opcoesDeAlvo: (
    tipo: TipoDeAlvo,
  ) => Promise<readonly { readonly id: string; readonly nome: string }[]>;
}

export const servicoDePoliticasDoServidor: ServicoDePoliticas = {
  listar: () => listarPoliticasFerias(),
  obter: (id) => obterPoliticaFerias(id),
  criar: (dto) => criarPoliticaFerias(dto),
  alterar: (id, dto) => alterarPoliticaFerias(id, dto),
  desativar: (id) => desativarPoliticaFerias(id),
  reativar: (id) => reativarPoliticaFerias(id),
  opcoesDeAlvo: async (tipo) => {
    if (tipo === "departamento") {
      return (await listarDepartamentosParaEquipe()).itens.map((d) => ({
        id: d.id,
        nome: d.nome,
      }));
    }
    if (tipo === "unidade") {
      return (await listarUnidadesParaEquipe()).itens.map((u) => ({
        id: u.id,
        nome: u.nome,
      }));
    }
    const r = await listarColaboradores({
      pagina: 1,
      tamanhoPagina: 100,
      grupo: "ativos",
    });
    return r.itens.map((c) => ({ id: c.id, nome: c.nome }));
  },
};
