import { Prisma } from "@prisma/client";
import {
  SQLSTATE_DEADLOCK,
  TENTATIVAS_APOS_DEADLOCK,
  comRepeticaoAposDeadlock,
  ehDeadlockDeBanco,
} from "./diagnostico-erro-banco";

/**
 * Repetição limitada após deadlock (T161).
 *
 * O que estes testes prendem é o **limite**, não a repetição. Repetir é a
 * parte fácil e a parte perigosa: um laço generoso esconde defeito de
 * verdade e transforma um banco em sofrimento. Aqui a regra é estreita —
 * uma repetição, só depois de `40P01` confirmado pelo diagnóstico, e só
 * nesta operação — e cada um desses limites tem um caso abaixo.
 *
 * As mensagens são as **medidas em PostgreSQL real** durante a investigação,
 * nos dois caminhos que o Prisma usa.
 */

/** Medido: 40P01 pelo caminho tipado, que é o que o service usa. */
const DEADLOCK_TIPADO =
  "Invalid `prisma.atribuicaoGestorEquipe.create()` invocation: " +
  'PostgresError { code: "40P01", message: "deadlock detected", ' +
  'severity: "ERROR", detail: Some("Process 61 waits for ShareLock") }';

/** Medido: 23P01 — a sobreposição que o classificador já traduz em 409. */
const EXCLUSION_TIPADA =
  "Invalid `prisma.atribuicaoGestorEquipe.create()` invocation: " +
  'PostgresError { code: "23P01", message: "conflicting key value violates ' +
  'exclusion constraint \\"atribuicao_gestor_equipe_sem_sobreposicao\\"" }';

function erroDeBanco(mensagem: string) {
  return new Prisma.PrismaClientUnknownRequestError(mensagem, {
    clientVersion: "5.22.0",
  });
}

describe("ehDeadlockDeBanco — o critério é o SQLSTATE, não a palavra", () => {
  it("reconhece 40P01 pelo caminho tipado", () => {
    expect(ehDeadlockDeBanco(erroDeBanco(DEADLOCK_TIPADO))).toBe(true);
  });

  it("reconhece 40P01 pelo caminho de consulta crua", () => {
    expect(
      ehDeadlockDeBanco(
        erroDeBanco("Raw query failed. Code: `40P01`. Message: `ERROR: ...`"),
      ),
    ).toBe(true);
  });

  it("NÃO se contenta com a palavra deadlock no texto", () => {
    // P2034 diz "deadlock" na mensagem e não traz SQLSTATE. Aceitá-lo aqui
    // seria repetir por causa de uma palavra, não de um fato.
    const p2034 = new Prisma.PrismaClientKnownRequestError(
      "Transaction failed due to a write conflict or a deadlock. Please retry.",
      { code: "P2034", clientVersion: "5.22.0" },
    );
    expect(ehDeadlockDeBanco(p2034)).toBe(false);
  });

  it("não confunde com a sobreposição, que já tem caminho próprio", () => {
    expect(ehDeadlockDeBanco(erroDeBanco(EXCLUSION_TIPADA))).toBe(false);
  });

  it("erro comum não é deadlock", () => {
    expect(ehDeadlockDeBanco(new Error("conexão caiu"))).toBe(false);
    expect(ehDeadlockDeBanco(undefined)).toBe(false);
  });

  it("o SQLSTATE é o declarado, e são duas tentativas no total", () => {
    expect(SQLSTATE_DEADLOCK).toBe("40P01");
    expect(TENTATIVAS_APOS_DEADLOCK).toBe(2);
  });
});

describe("comRepeticaoAposDeadlock — uma repetição, e só isso", () => {
  it("sucesso de primeira não repete", async () => {
    const operacao = jest.fn().mockResolvedValue("criado");
    await expect(comRepeticaoAposDeadlock(operacao)).resolves.toBe("criado");
    expect(operacao).toHaveBeenCalledTimes(1);
  });

  it("40P01 na primeira tentativa → a segunda É executada", async () => {
    const operacao = jest
      .fn()
      .mockRejectedValueOnce(erroDeBanco(DEADLOCK_TIPADO))
      .mockResolvedValueOnce("criado na segunda");

    await expect(comRepeticaoAposDeadlock(operacao)).resolves.toBe(
      "criado na segunda",
    );
    expect(operacao).toHaveBeenCalledTimes(2);
    expect(operacao).toHaveBeenNthCalledWith(1, 1);
    expect(operacao).toHaveBeenNthCalledWith(2, 2);
  });

  it("conflito normal na repetição propaga — e vira 409 lá fora", async () => {
    // O desfecho que a correção procura: depois que o vencedor commitou, a
    // segunda tentativa colide na EXCLUSION. O 409 continua vindo da
    // invariante do banco, não de tradução de 40P01.
    const sobreposicao = erroDeBanco(EXCLUSION_TIPADA);
    const operacao = jest
      .fn()
      .mockRejectedValueOnce(erroDeBanco(DEADLOCK_TIPADO))
      .mockRejectedValueOnce(sobreposicao);

    await expect(comRepeticaoAposDeadlock(operacao)).rejects.toBe(sobreposicao);
    expect(operacao).toHaveBeenCalledTimes(2);
  });

  it("segundo 40P01 → NÃO há terceira tentativa, e o erro segue técnico", async () => {
    // O limite que impede a correção de virar um laço que esconde defeito.
    const segundoDeadlock = erroDeBanco(DEADLOCK_TIPADO);
    const operacao = jest
      .fn()
      .mockRejectedValueOnce(erroDeBanco(DEADLOCK_TIPADO))
      .mockRejectedValueOnce(segundoDeadlock);

    await expect(comRepeticaoAposDeadlock(operacao)).rejects.toBe(
      segundoDeadlock,
    );
    expect(operacao).toHaveBeenCalledTimes(TENTATIVAS_APOS_DEADLOCK);
    expect(operacao).toHaveBeenCalledTimes(2);
  });

  it("SQLSTATE diferente → nenhuma repetição", async () => {
    const outro = erroDeBanco(EXCLUSION_TIPADA);
    const operacao = jest.fn().mockRejectedValue(outro);

    await expect(comRepeticaoAposDeadlock(operacao)).rejects.toBe(outro);
    expect(operacao).toHaveBeenCalledTimes(1);
  });

  it("erro que não é de banco → nenhuma repetição", async () => {
    const falha = new Error("conexão caiu");
    const operacao = jest.fn().mockRejectedValue(falha);

    await expect(comRepeticaoAposDeadlock(operacao)).rejects.toBe(falha);
    expect(operacao).toHaveBeenCalledTimes(1);
  });

  it("não dorme entre as tentativas", async () => {
    // O deadlock já foi resolvido pelo PostgreSQL no instante em que ele
    // abortou esta transação. Esperar só atrasaria a resposta — e um `sleep`
    // escondido aqui seria a semente do laço lento que ninguém mede.
    const operacao = jest
      .fn()
      .mockRejectedValueOnce(erroDeBanco(DEADLOCK_TIPADO))
      .mockResolvedValueOnce("ok");

    const inicio = Date.now();
    await comRepeticaoAposDeadlock(operacao);
    expect(Date.now() - inicio).toBeLessThan(50);
  });
});
