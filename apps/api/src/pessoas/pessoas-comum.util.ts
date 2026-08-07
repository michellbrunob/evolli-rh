import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma, SituacaoColaborador } from "@prisma/client";
import { DestinoOrganizacional } from "./pessoas.types";
import { DestinoOrganizacionalDto } from "./dto/pessoas.dto";

/**
 * Normaliza o destino do DTO para o formato interno, trocando `undefined` por
 * `null` explícito — a mesma disciplina já usada em `AuditService`, para que
 * "campo ausente" e "campo nulo" nunca signifiquem coisas diferentes ao longo
 * do fluxo.
 */
export function extrairDestino(
  dto: DestinoOrganizacionalDto,
): DestinoOrganizacional {
  return {
    unidadeOrganizacionalId: dto.unidadeOrganizacionalId ?? null,
    departamentoId: dto.departamentoId ?? null,
    areaId: dto.areaId ?? null,
    equipeId: dto.equipeId ?? null,
    cargoId: dto.cargoId ?? null,
    centroCustoId: dto.centroCustoId ?? null,
  };
}

/**
 * Traduz falha de restrição do banco em erro HTTP estável, sem vazar nome de
 * tabela, coluna, constraint ou SQL.
 *
 * Cobre, entre outros, as garantias que só o banco impõe nesta fatia:
 * matrícula duplicada na empresa, segundo vínculo ativo para o mesmo par
 * (colaborador, empresa), segunda alocação aberta para o mesmo vínculo, e
 * referência organizacional cruzando empresa via FK composta.
 */
export function traduzirErroPessoas(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: unicidade — matrícula repetida, vínculo ativo duplicado (índice
    // parcial), alocação aberta duplicada, retificação duplicada.
    if (error.code === "P2002") {
      throw new ConflictException();
    }
    // P2003: FK — inclui as FKs compostas que garantem "mesma empresa".
    if (error.code === "P2003") {
      throw new UnprocessableEntityException();
    }
  }
  // P0001/23514 (CHECK) chegam como erro não tipado do Prisma; mapear para 422
  // mantém a resposta estável sem revelar qual restrição falhou.
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    /violates check constraint/i.test(error.message)
  ) {
    throw new UnprocessableEntityException();
  }
  throw error;
}

/**
 * Recalcula e materializa `colaborador.situacao` a partir dos vínculos, dentro
 * da mesma transação que os alterou.
 *
 * A situação é **derivada**, nunca comandada: não existe "inativar
 * colaborador" como ação isolada (spec §8). Materializá-la evita recalcular em
 * toda leitura e mantém a listagem filtrável por índice.
 */
export async function recalcularSituacaoColaborador(
  tx: Prisma.TransactionClient,
  colaboradorId: string,
): Promise<void> {
  const ativos = await tx.vinculoFuncional.count({
    where: { colaboradorId, situacao: "ativo" },
  });

  await tx.colaborador.update({
    where: { id: colaboradorId },
    data: {
      situacao:
        ativos > 0 ? SituacaoColaborador.ativo : SituacaoColaborador.inativo,
    },
  });
}
