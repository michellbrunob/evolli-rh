import { escaparCuringas } from "../common/busca.util";

/**
 * T196 — busca nas referências usadas na lotação (Departamento, Cargo,
 * Unidade e Centro de custo): o termo casa com parte do **código** ou do
 * **nome**, sem diferenciar maiúsculas (sem remover acentos — regra desta
 * entrega). Entra no `where` junto do escopo e da situação, portanto ANTES da
 * paginação: o `total` conta só o que casa.
 *
 * Sem termo, nenhuma condição: a listagem é a de sempre. O termo nunca vai
 * para log, auditoria ou mensagem de erro — só para a consulta.
 */
export function filtroDeBuscaPorCodigoOuNome(busca: string | undefined): {
  OR?: {
    codigo?: { contains: string; mode: "insensitive" };
    nome?: { contains: string; mode: "insensitive" };
  }[];
} {
  if (!busca) return {};
  const termo = escaparCuringas(busca);
  return {
    OR: [
      { codigo: { contains: termo, mode: "insensitive" } },
      { nome: { contains: termo, mode: "insensitive" } },
    ],
  };
}
