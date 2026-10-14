import { Prisma } from "@prisma/client";
import { descreverErroDeBanco } from "./diagnostico-banco";

/**
 * Descritor técnico de erro de banco (T161).
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

describe("descreverErroDeBanco — diz o necessário, e só isso", () => {
  it("extrai SQLSTATE e constraint da forma crua medida", () => {
    expect(descreverErroDeBanco(desconhecido(EXCLUSION_CRUA))).toEqual({
      classe: "PrismaClientUnknownRequestError",
      sqlstate: "23P01",
      constraint: "atribuicao_gestor_equipe_sem_sobreposicao",
    });
  });

  it("extrai SQLSTATE e constraint da forma tipada", () => {
    expect(descreverErroDeBanco(desconhecido(EXCLUSION_TIPADA))).toEqual({
      classe: "PrismaClientUnknownRequestError",
      sqlstate: "23P01",
      constraint: "atribuicao_gestor_equipe_sem_sobreposicao",
    });
  });

  it("extrai o SQLSTATE do deadlock, que é o dado que faltava na CI", () => {
    expect(descreverErroDeBanco(desconhecido(DEADLOCK_CRUO))).toMatchObject({
      sqlstate: "40P01",
    });
  });

  it("extrai 23000 de trigger, mesmo sem nome de constraint", () => {
    const diagnostico = descreverErroDeBanco(desconhecido(TRIGGER_23000));
    expect(diagnostico).toMatchObject({ sqlstate: "23000" });
    expect(diagnostico.constraint).toBeUndefined();
  });

  it("registra o código do Prisma quando existe", () => {
    const erro = new Prisma.PrismaClientKnownRequestError("x", {
      code: "P2028",
      clientVersion: "5.22.0",
    });
    expect(descreverErroDeBanco(erro)).toMatchObject({ prismaCode: "P2028" });
  });

  describe("o que NUNCA sai daqui", () => {
    // Esta é a metade que protege quem usa o sistema. O `DETAIL` de uma
    // violação é o VALOR que a pessoa enviou; o diagnóstico não pode
    // carregá-lo para o log sob pretexto de ajudar.
    it.each([EXCLUSION_CRUA, EXCLUSION_TIPADA, DEADLOCK_CRUO, TRIGGER_23000])(
      "não vaza mensagem, DETAIL nem valores (%#)",
      (mensagem) => {
        const serializado = JSON.stringify(
          descreverErroDeBanco(desconhecido(mensagem)),
        );
        expect(serializado).not.toMatch(/DETAIL|detail/i);
        expect(serializado).not.toContain("EQP-123");
        expect(serializado).not.toContain("EQP-SEGREDO-999");
        expect(serializado).not.toContain("conflicting key value");
        expect(serializado).not.toContain("deadlock detected");
        expect(serializado).not.toContain("sem vinculo");
      },
    );

    it("só expõe as quatro chaves previstas", () => {
      const chaves = Object.keys(
        descreverErroDeBanco(desconhecido(EXCLUSION_CRUA)),
      ).sort();
      expect(chaves).toEqual(["classe", "constraint", "sqlstate"]);
    });

    it("um identificador inválido não é aceito como constraint", () => {
      // Se o texto não trouxer um identificador do PostgreSQL, o campo
      // simplesmente não aparece — melhor incompleto do que inventado.
      const diagnostico = descreverErroDeBanco(
        desconhecido('violates constraint "nome com espaco e acento á"'),
      );
      expect(diagnostico.constraint).toBeUndefined();
    });

    it("erro que não é Error não quebra o diagnóstico", () => {
      expect(descreverErroDeBanco("texto solto")).toEqual({
        classe: "string",
      });
      expect(descreverErroDeBanco(null)).toEqual({ classe: "object" });
    });
  });
});
