/**
 * T215 — as chamadas reais da aba Férias e ausências: o cliente
 * `ausenciasClient` e, para escolher quem se ausenta, a listagem de
 * Colaboradores (só quem está ativo, pela busca de sempre).
 */
import {
  aprovarAusencia,
  cancelarAusencia,
  listarAusencias,
  recusarAusencia,
  registrarAusencia,
  simularAusencia,
} from "../../../api/ausenciasClient";
import { listarColaboradores } from "../../../api/colaboradoresClient";
import type { ServicoDeAusencias } from "./tiposAusencia";

export const servicoDeAusenciasDoServidor: ServicoDeAusencias = {
  listar: (consulta) => listarAusencias(consulta),
  registrar: (nova) => registrarAusencia(nova),
  simular: (consulta) => simularAusencia(consulta),
  aprovar: (id) => aprovarAusencia(id),
  recusar: (id, motivo) => recusarAusencia(id, motivo),
  cancelar: (id) => cancelarAusencia(id),
  buscarPessoas: async (termo, opcoes) => {
    const resp = await listarColaboradores(
      {
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "ativos",
        ...(termo ? { busca: termo } : {}),
      },
      opcoes?.signal ? { signal: opcoes.signal } : undefined,
    );
    return resp.itens.map((c) => ({
      id: c.id,
      nome: c.nome,
      cargo:
        c.vinculos.find((v) => v.situacao === "ativo")?.lotacaoVigente?.cargo
          ?.nome ?? null,
    }));
  },
};
