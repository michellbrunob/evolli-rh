import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Traduz falha de restrição do banco em erro HTTP estável, sem vazar nome de
 * tabela, coluna, constraint ou SQL — o `AllExceptionsFilter` (ADR 0001) já
 * substitui a mensagem por texto público fixo, e nada aqui reintroduz detalhe
 * interno na resposta.
 *
 * Aplica-se, entre outros, ao caso em que a FK composta de `equipe` recusa
 * departamento ou unidade de outra empresa (spec R5): o banco é a última
 * linha de defesa, mesmo quando a validação de aplicação já checou antes.
 */
export function traduzirErroPrisma(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: violação de unicidade (código já usado no escopo).
    if (error.code === "P2002") {
      throw new ConflictException();
    }
    // P2003: violação de chave estrangeira — inclui a FK composta que garante
    // "mesma empresa" em `equipe`.
    if (error.code === "P2003") {
      throw new UnprocessableEntityException();
    }
  }
  throw error;
}
