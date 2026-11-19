import {
  ArmazenamentoEmMemoria,
  type ArmazenamentoDeObjetos,
} from "../foto-colaborador/armazenamento-de-objetos";
import { ArmazenamentoR2 } from "../foto-colaborador/armazenamento-r2";

/**
 * T213 — armazenamento dos arquivos dos documentos do colaborador (ADR 0021).
 * A mesma porta e o mesmo cliente R2 privado da foto (ADR 0020), com token
 * próprio; nos testes, o armazenamento em memória. Nenhum teste fala com o
 * bucket.
 */
export const ARMAZENAMENTO_DE_DOCUMENTOS = Symbol(
  "ARMAZENAMENTO_DE_DOCUMENTOS",
);

/**
 * Padrão: o R2 privado. `EVOLLI_DOCUMENTOS_ARMAZENAMENTO=memoria` troca por
 * um armazenamento em memória (perdido ao reiniciar), só fora de produção;
 * qualquer outro valor é recusado, para nunca cair no R2 por engano.
 */
export function escolherArmazenamentoDeDocumentos(
  ambiente: Readonly<Record<string, string | undefined>> = process.env,
): ArmazenamentoDeObjetos {
  const modo = ambiente.EVOLLI_DOCUMENTOS_ARMAZENAMENTO?.trim() ?? "";
  if (modo === "") return new ArmazenamentoR2();
  if (modo !== "memoria") {
    throw new Error("EVOLLI_DOCUMENTOS_ARMAZENAMENTO: valor desconhecido.");
  }
  if (ambiente.NODE_ENV === "production") {
    throw new Error(
      "EVOLLI_DOCUMENTOS_ARMAZENAMENTO=memoria não é permitido em produção.",
    );
  }
  return new ArmazenamentoEmMemoria();
}
