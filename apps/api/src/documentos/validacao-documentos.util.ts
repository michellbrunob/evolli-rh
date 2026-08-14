import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Confirma que o colaborador tem **algum vínculo** na empresa do documento.
 *
 * O colaborador não carrega `empresa_id` próprio (ADR 0007), então a coerência
 * empresa↔sujeito não pode ser uma FK — é validada aqui. Um colaborador sem
 * vínculo na empresa do ator é tratado como inexistente para este ator (o
 * chamador responde 404 anti-enumeração), nunca revelando que a pessoa existe
 * em outra empresa.
 */
export async function colaboradorTemVinculoNaEmpresa(
  tx: Prisma.TransactionClient,
  empresaId: string,
  colaboradorId: string,
): Promise<boolean> {
  const vinculo = await tx.vinculoFuncional.findFirst({
    where: { colaboradorId, empresaId },
    select: { id: true },
  });
  return vinculo !== null;
}

/**
 * Carrega um tipo documental **dentro da empresa** (ou `null`). A FK composta
 * `(tipo_documento_id, empresa_id)` já garante mesma empresa no banco; esta
 * checagem antecipa o 404 anti-enumeração antes do insert, sem depender de
 * traduzir um erro de FK.
 */
export async function buscarTipoNaEmpresa(
  tx: Prisma.TransactionClient,
  empresaId: string,
  tipoDocumentoId: string,
): Promise<{ id: string } | null> {
  return tx.tipoDocumento.findFirst({
    where: { id: tipoDocumentoId, empresaId },
    select: { id: true },
  });
}

/**
 * Traduz falha de restrição do banco em erro HTTP estável, sem vazar nome de
 * tabela, coluna, constraint ou SQL — mesmo padrão de `traduzirErroPessoas`.
 */
export function traduzirErroDocumentos(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: unicidade — código de tipo repetido na empresa.
    if (error.code === "P2002") {
      throw new ConflictException();
    }
    // P2003: FK — inclui as FKs compostas que garantem "mesma empresa".
    if (error.code === "P2003") {
      throw new UnprocessableEntityException();
    }
  }
  throw error;
}
