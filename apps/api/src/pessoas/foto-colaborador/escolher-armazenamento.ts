import {
  ArmazenamentoEmMemoria,
  type ArmazenamentoDeObjetos,
} from "./armazenamento-de-objetos";
import { ArmazenamentoR2 } from "./armazenamento-r2";

/**
 * T209 — o armazenamento da foto do colaborador (ADR 0020).
 *
 * Padrão: o R2 privado. `EVOLLI_FOTO_ARMAZENAMENTO=memoria` troca por um
 * armazenamento em memória (perdido ao reiniciar) para a prévia local sem
 * tocar no bucket; em produção essa troca é recusada e a API não sobe.
 * Qualquer outro valor também é recusado, para nunca cair no R2 por engano.
 */
export function escolherArmazenamentoDeFotos(
  ambiente: Readonly<Record<string, string | undefined>> = process.env,
): ArmazenamentoDeObjetos {
  const modo = ambiente.EVOLLI_FOTO_ARMAZENAMENTO?.trim() ?? "";
  if (modo === "") return new ArmazenamentoR2();
  if (modo !== "memoria") {
    throw new Error("EVOLLI_FOTO_ARMAZENAMENTO: valor desconhecido.");
  }
  if (ambiente.NODE_ENV === "production") {
    throw new Error(
      "EVOLLI_FOTO_ARMAZENAMENTO=memoria não é permitido em produção.",
    );
  }
  return new ArmazenamentoEmMemoria();
}
