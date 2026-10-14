import { Prisma } from "@prisma/client";
import {
  CHECKS_DA_FAMILIA_GESTOR,
  classificarErroDeBanco,
} from "./diagnostico-erro-banco";

/**
 * Diagnóstico de erro de banco (T161).
 *
 * As mensagens usadas aqui **não são inventadas**: foram medidas em
 * PostgreSQL 16 real e efêmero (Testcontainers) durante a investigação da
 * falha de `main` em `0db3d70`, nos dois caminhos que o Prisma usa — consulta
 * crua e cliente tipado. Um extrator testado contra texto imaginado não prova
 * nada sobre o texto que o driver realmente produz.
 */

/** Medido: 23P01 pelo caminho de consulta crua. */
const EXCLUSION_CRUA =
  "\nInvalid `prisma.$executeRawUnsafe()` invocation:\n\n\n" +
  "Raw query failed. Code: `23P01`. Message: `ERROR: conflicting key value " +
  'violates exclusion constraint "atribuicao_gestor_equipe_sem_sobreposicao" ' +
  "DETAIL: Key (equipe_id, papel, daterange(vigencia_inicio, vigencia_fim, " +
  "'[)'::text))=(EQP-123, principal, [2026-01-01,)) conflicts with existing key`";

/** Medido: 40P01 (deadlock) pelo caminho de consulta crua. */
const DEADLOCK_CRUO =
  "Raw query failed. Code: `40P01`. Message: `ERROR: deadlock detected " +
  "DETAIL: Process 68 waits for ShareLock on transaction 734; blocked by " +
  "process 69.`";

/**
 * Medido: 40P01 pelo caminho TIPADO — que é o que o service usa, e a forma
 * que de fato aparece na corrida por atribuição. Chega como `Unknown`, não
 * como `Known`: foi essa diferença que quase fez descartar a causa certa.
 */
const DEADLOCK_TIPADO =
  "Invalid `prisma.atribuicaoGestorEquipe.create()` invocation: " +
  'PostgresError { code: "40P01", message: "deadlock detected", ' +
  'severity: "ERROR", detail: Some("Process 61 waits for ShareLock") }';

/** Forma do caminho tipado: o SQLSTATE vem em `code: "…"`. */
const EXCLUSION_TIPADA =
  "Invalid `prisma.atribuicaoGestorEquipe.create()` invocation: " +
  'Error occurred during query execution: PostgresError { code: "23P01", ' +
  'message: "conflicting key value violates exclusion constraint ' +
  '\\"atribuicao_gestor_equipe_sem_sobreposicao\\"", severity: "ERROR", ' +
  'detail: Some("Key (equipe_id)=(EQP-SEGREDO-999)"), hint: None }';

/** Trigger do próprio módulo: levanta 23000, sem nome de constraint. */
const TRIGGER_23000 =
  'PostgresError { code: "23000", message: "colaborador sem vinculo na ' +
  'empresa", severity: "ERROR", detail: None }';

function desconhecido(mensagem: string) {
  return new Prisma.PrismaClientUnknownRequestError(mensagem, {
    clientVersion: "5.22.0",
  });
}

describe("classificarErroDeBanco — a regra NÃO mudou na T161", () => {
  it("P2002 é conflito", () => {
    const erro = new Prisma.PrismaClientKnownRequestError("colidiu", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    expect(classificarErroDeBanco(erro)).toBe("conflito");
  });

  it("23P01 é conflito, nas duas formas medidas", () => {
    expect(classificarErroDeBanco(desconhecido(EXCLUSION_CRUA))).toBe(
      "conflito",
    );
    expect(classificarErroDeBanco(desconhecido(EXCLUSION_TIPADA))).toBe(
      "conflito",
    );
  });

  it("23505 é conflito", () => {
    expect(
      classificarErroDeBanco(
        desconhecido("violates unique constraint (23505)"),
      ),
    ).toBe("conflito");
  });

  it.each(CHECKS_DA_FAMILIA_GESTOR)("23514 no CHECK %s é conflito", (nome) => {
    expect(
      classificarErroDeBanco(
        desconhecido(`violates check constraint "${nome}" code: 23514`),
      ),
    ).toBe("conflito");
  });

  describe("o que a T161 se recusou a mapear", () => {
    // Medido: nenhum destes é a colisão de vigência. Chamá-los de conflito
    // transformaria lentidão e defeito em "já existe atribuição vigente".
    it("deadlock (40P01) continua desconhecido", () => {
      expect(classificarErroDeBanco(desconhecido(DEADLOCK_CRUO))).toBe(
        "desconhecido",
      );
      // A forma que REALMENTE aparece na corrida: caminho tipado, `Unknown`.
      // Foi o diagnóstico da T161 que a revelou, na primeira reprodução
      // local do cenário concorrente.
      expect(classificarErroDeBanco(desconhecido(DEADLOCK_TIPADO))).toBe(
        "desconhecido",
      );
    });

    it("P2034 (conflito de escrita) continua desconhecido", () => {
      const erro = new Prisma.PrismaClientKnownRequestError(
        "Transaction failed due to a write conflict or a deadlock.",
        { code: "P2034", clientVersion: "5.22.0" },
      );
      expect(classificarErroDeBanco(erro)).toBe("desconhecido");
    });

    it("P2028 (transação expirada) continua desconhecido", () => {
      const erro = new Prisma.PrismaClientKnownRequestError(
        "Transaction already closed: A query cannot be executed on an " +
          "expired transaction. The timeout for this transaction was 5000 ms",
        { code: "P2028", clientVersion: "5.22.0" },
      );
      expect(classificarErroDeBanco(erro)).toBe("desconhecido");
    });

    it("23000 de trigger continua desconhecido", () => {
      expect(classificarErroDeBanco(desconhecido(TRIGGER_23000))).toBe(
        "desconhecido",
      );
    });

    it("23514 de OUTRA família continua desconhecido", () => {
      expect(
        classificarErroDeBanco(
          desconhecido(
            'violates check constraint "vinculo_funcional_situacao_valida" code: 23514',
          ),
        ),
      ).toBe("desconhecido");
    });
  });
});
