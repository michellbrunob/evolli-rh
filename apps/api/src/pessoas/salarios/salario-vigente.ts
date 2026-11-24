import { Prisma } from "@prisma/client";

/**
 * T215 — o salário VIGENTE (a linha viva de maior vigência) espelhado em
 * `contrato_vinculo.salario_bruto`, que a lista de Colaboradores e a edição
 * já leem. Sem linha viva, o contrato fica sem salário. Na transação de quem
 * mudou a linha do tempo.
 */
export async function espelharSalarioVigente(
  tx: Prisma.TransactionClient,
  alvo: { vinculoId: string; empresaId: string },
): Promise<void> {
  const vigente = await tx.alteracaoSalarial.findFirst({
    where: { vinculoId: alvo.vinculoId, removidaEm: null },
    orderBy: { vigenciaInicio: "desc" },
    select: { salarioBruto: true },
  });
  const salarioBruto = vigente?.salarioBruto ?? null;
  const contrato = await tx.contratoVinculo.findUnique({
    where: { vinculoId: alvo.vinculoId },
    select: { vinculoId: true },
  });
  if (contrato) {
    await tx.contratoVinculo.update({
      where: { vinculoId: alvo.vinculoId },
      data: { salarioBruto },
    });
  } else if (salarioBruto !== null) {
    await tx.contratoVinculo.create({
      data: {
        vinculoId: alvo.vinculoId,
        empresaId: alvo.empresaId,
        salarioBruto,
      },
    });
  }
}

/**
 * T215 — o salário gravado pela admissão vira a linha da admissão, na data
 * de admissão do vínculo. Sem salário, a linha do tempo começa vazia.
 */
export async function registrarSalarioDaAdmissao(
  tx: Prisma.TransactionClient,
  alvo: {
    vinculoId: string;
    empresaId: string;
    dataAdmissao: Date;
    registradaPorUserId: string;
  },
  salarioBruto: string | null,
): Promise<string | null> {
  if (salarioBruto === null) return null;
  const linha = await tx.alteracaoSalarial.create({
    data: {
      vinculoId: alvo.vinculoId,
      empresaId: alvo.empresaId,
      origem: "admissao",
      vigenciaInicio: alvo.dataAdmissao,
      salarioBruto,
      registradaPorUserId: alvo.registradaPorUserId,
    },
    select: { id: true },
  });
  return linha.id;
}
