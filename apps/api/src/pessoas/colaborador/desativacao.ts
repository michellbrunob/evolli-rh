import { Prisma } from "@prisma/client";
import { GrupoColaborador } from "../dto/pessoas.dto";

/**
 * T215 — a desativação do colaborador NA EMPRESA (lixeira do "Editar
 * colaborador"), como filtro de consulta. Só a desativação VIGENTE conta
 * (`reativadoEm` nulo). Escopado, a da empresa da sessão; global (master sem
 * empresa ativa), uma vigente em qualquer empresa.
 */
function vigente(
  empresaId: string | undefined,
): Prisma.DesativacaoColaboradorWhereInput {
  return empresaId !== undefined
    ? { empresaId, reativadoEm: null }
    : { reativadoEm: null };
}

/** Sem desativação vigente no escopo. */
export function semDesativacaoVigente(
  empresaId: string | undefined,
): Prisma.ColaboradorWhereInput {
  return { desativacoes: { none: vigente(empresaId) } };
}

/** Com desativação vigente no escopo. */
export function comDesativacaoVigente(
  empresaId: string | undefined,
): Prisma.ColaboradorWhereInput {
  return { desativacoes: { some: vigente(empresaId) } };
}

/**
 * Ativos, Em admissão e Desligados não mostram o desativado; ele fica só em
 * Todos (sem grupo), marcado.
 */
export function grupoExcluiDesativados(
  grupo: GrupoColaborador | undefined,
): boolean {
  return (
    grupo === "ativos" || grupo === "em_admissao" || grupo === "desligados"
  );
}

/** Para o `select` da listagem: a desativação vigente, se houver. */
export function selecaoDaDesativacaoVigente(empresaId: string | undefined) {
  return {
    where: vigente(empresaId),
    take: 1,
    select: { desativadoEm: true },
  } as const;
}
