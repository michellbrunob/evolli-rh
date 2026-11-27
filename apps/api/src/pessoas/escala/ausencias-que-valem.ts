import { Prisma, TipoAusencia } from "@prisma/client";

/**
 * T215 — as ausências que vencem o turno no quadro da escala (e que tiram o
 * dia dos benefícios pagos pela escala): aprovadas, ou com cancelamento
 * pedido (ainda vale até a decisão), não excluídas. Home office não é
 * ausência do trabalho: fica fora.
 */
export const STATUS_QUE_VALEM = ["aprovada", "cancelamento_pedido"] as const;

export const TIPOS_FORA_DO_QUADRO: TipoAusencia[] = ["home_office"];

/** As ausências que valem das pessoas e que tocam `[inicio, fim]`. */
export function ausenciasQueValem(
  empresaId: string,
  colaboradorIds: readonly string[],
  inicio: Date,
  fim: Date,
): Prisma.AusenciaWhereInput {
  return {
    empresaId,
    colaboradorId: { in: [...colaboradorIds] },
    status: { in: [...STATUS_QUE_VALEM] },
    excluidaEm: null,
    tipo: { notIn: TIPOS_FORA_DO_QUADRO },
    inicio: { lte: fim },
    OR: [{ fim: null }, { fim: { gte: inicio } }],
  };
}
