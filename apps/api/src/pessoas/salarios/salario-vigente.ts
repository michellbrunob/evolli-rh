import { Prisma } from "@prisma/client";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";

/** T215 — o que a edição do contrato faz com o salário. */
export type DecisaoDoSalarioDoContrato =
  /** Há linha do tempo: o contrato só espelha o período vigente. */
  | { acao: "manter" }
  /** Sem linha do tempo (admitido antes da regra): o enviado abre a admissão. */
  | { acao: "abrir_admissao"; salarioBruto: string }
  /** Sem linha do tempo e sem salário: nada muda no salário. */
  | { acao: "nenhuma" };

/**
 * T215 — o salário na edição do contrato (Dados profissionais). Com linha do
 * tempo, o salário NÃO muda por aqui: mudar é registrar uma alteração com
 * data na aba Salários (o período anterior fica como estava). Por isso:
 * ausente ou igual ao vigente mantém; diferente é recusado (`nao_se_aplica`,
 * em vez de reescrever o período vigente — um aumento viraria retroativo e o
 * valor antigo sumiria); apagado (`null`) é recusado (`obrigatorio`).
 *
 * `vigente` e `enviado` em reais com 2 casas ("2000.00"); `enviado`
 * `undefined` é o campo ausente do corpo.
 */
export function decidirSalarioDoContrato(
  vigente: string | null,
  enviado: string | null | undefined,
): DecisaoDoSalarioDoContrato {
  if (vigente !== null) {
    if (enviado === undefined || enviado === vigente) return { acao: "manter" };
    throw new CamposRecusadosException([
      {
        campo: "salarioBruto",
        motivo: enviado === null ? "obrigatorio" : "nao_se_aplica",
      },
    ]);
  }
  return enviado === undefined || enviado === null
    ? { acao: "nenhuma" }
    : { acao: "abrir_admissao", salarioBruto: enviado };
}

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
  /** O cargo da contratação, pelo nome (ausente: o da 1ª lotação, na leitura). */
  cargo: string | null = null,
): Promise<string | null> {
  if (salarioBruto === null) return null;
  const linha = await tx.alteracaoSalarial.create({
    data: {
      vinculoId: alvo.vinculoId,
      empresaId: alvo.empresaId,
      origem: "admissao",
      vigenciaInicio: alvo.dataAdmissao,
      salarioBruto,
      cargo,
      registradaPorUserId: alvo.registradaPorUserId,
    },
    select: { id: true },
  });
  return linha.id;
}
