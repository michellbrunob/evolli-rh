/**
 * T215 — a lotação vigente de um vínculo, com os nomes: cargo e departamento
 * pelo id (sem o teto dos catálogos), área, centro de custo e unidade pelos
 * catálogos ativos. Falha em qualquer leitura deixa o nome vazio; o resto
 * segue.
 */
import { useEffect, useState } from "react";
import { listarAlocacoesVinculo } from "../../../api/vinculoContratualClient";
import { buscarCargo } from "../../../api/cargoClient";
import {
  buscarDepartamento,
  listarAreas,
  listarCentrosCusto,
  listarUnidades,
} from "../../../api/organizacaoClient";

export interface LotacaoVigente {
  readonly cargo: string;
  readonly departamento: string;
  readonly area: string;
  readonly centroCusto: string;
  readonly unidade: string;
  /** A leitura terminou (com ou sem lotação). */
  readonly carregada: boolean;
}

const VAZIA: LotacaoVigente = {
  cargo: "",
  departamento: "",
  area: "",
  centroCusto: "",
  unidade: "",
  carregada: false,
};

type Listar = (consulta: {
  status: "ativo";
  tamanhoPagina: number;
}) => Promise<{ itens?: readonly { id: string; nome: string }[] }>;

async function nomeNoCatalogo(id: string | null, listar: Listar) {
  if (!id) return "";
  try {
    const pagina = await listar({ status: "ativo", tamanhoPagina: 100 });
    return pagina.itens?.find((i) => i.id === id)?.nome ?? "";
  } catch {
    return "";
  }
}

export function useLotacaoVigente(vinculoId: string | null): LotacaoVigente {
  const [lotacao, setLotacao] = useState<LotacaoVigente>(VAZIA);
  useEffect(() => {
    setLotacao(VAZIA);
    if (!vinculoId) return;
    let vivo = true;
    void (async () => {
      try {
        const alocacoes = await listarAlocacoesVinculo(vinculoId);
        const v = alocacoes.find((a) => a.vigenteAte === null);
        if (!v) {
          if (vivo) setLotacao({ ...VAZIA, carregada: true });
          return;
        }
        const [cargo, departamento, area, centroCusto, unidade] =
          await Promise.all([
            v.cargoId
              ? buscarCargo(v.cargoId)
                  .then((c) => c.nome)
                  .catch(() => "")
              : "",
            v.departamentoId
              ? buscarDepartamento(v.departamentoId)
                  .then((d) => d.nome)
                  .catch(() => "")
              : "",
            nomeNoCatalogo(v.areaId, listarAreas as unknown as Listar),
            nomeNoCatalogo(
              v.centroCustoId,
              listarCentrosCusto as unknown as Listar,
            ),
            nomeNoCatalogo(
              v.unidadeOrganizacionalId,
              listarUnidades as unknown as Listar,
            ),
          ]);
        if (vivo) {
          setLotacao({
            cargo,
            departamento,
            area,
            centroCusto,
            unidade,
            carregada: true,
          });
        }
      } catch {
        if (vivo) setLotacao({ ...VAZIA, carregada: true });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vinculoId]);
  return lotacao;
}
