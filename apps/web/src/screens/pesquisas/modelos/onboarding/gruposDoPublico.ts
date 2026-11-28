/**
 * T216 — Onboarding: os catálogos ativos para "Por grupo" (departamento,
 * cargo, unidade e centro de custo).
 */
import { listarCargos } from "../../../../api/cargoClient";
import {
  listarCentrosCusto,
  listarDepartamentos,
  listarUnidades,
} from "../../../../api/organizacaoClient";
import type { CampoDoPublico } from "./cliente";

export type GruposDoPublico = Readonly<
  Record<CampoDoPublico, readonly { id: string; nome: string }[]>
>;

export const ROTULO_DO_CAMPO: Readonly<Record<CampoDoPublico, string>> = {
  departamento: "Departamento",
  cargo: "Cargo",
  unidade: "Unidade",
  centroCusto: "Centro de custo",
};

const opcoes = (itens: readonly { id: string; nome: string }[]) =>
  itens.map(({ id, nome }) => ({ id, nome }));

export async function listarGruposDoPublico(): Promise<GruposDoPublico> {
  const [dep, car, un, cc] = await Promise.all([
    listarDepartamentos({ status: "ativo", tamanhoPagina: 100 }),
    listarCargos({ status: "ativo", tamanhoPagina: 100 }),
    listarUnidades({ status: "ativo", tamanhoPagina: 100 }),
    listarCentrosCusto({ status: "ativo", tamanhoPagina: 100 }),
  ]);
  return {
    departamento: opcoes(dep.itens),
    cargo: opcoes(car.itens),
    unidade: opcoes(un.itens),
    centroCusto: opcoes(cc.itens),
  };
}
