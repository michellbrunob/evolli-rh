import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  GestorAdminService,
  CHECKS_DA_FAMILIA_GESTOR,
} from "./gestor-admin.service";

/**
 * Tradução de erro de banco em resposta HTTP (T151).
 *
 * Esta é a fronteira em que um defeito vira silêncio: traduzir demais
 * transforma qualquer falha num 409 tranquilizador ("já existe"), e quem lê o
 * log nunca descobre que havia bug. Traduzir de menos devolve 500 para pedidos
 * que o cliente podia ter corrigido.
 *
 * O método é privado de propósito — ninguém fora da classe deve chamá-lo — e
 * aqui é alcançado por índice para que a regra seja testável sem afrouxar a
 * API pública. O service é instanciado sem dependências reais: `comoConflito`
 * é pura, não toca Prisma nem auditoria.
 */
describe("GestorAdminService.comoConflito", () => {
  const service = new GestorAdminService(
    undefined as never,
    undefined as never,
  );

  const traduzir = (erro: unknown): unknown => {
    try {
      (
        service as unknown as { comoConflito(e: unknown, m: string): never }
      ).comoConflito(erro, "mensagem de teste");
    } catch (lancado) {
      return lancado;
    }
    throw new Error("comoConflito deveria sempre lançar");
  };

  const desconhecido = (mensagem: string) =>
    new Prisma.PrismaClientUnknownRequestError(mensagem, {
      clientVersion: "5.22.0",
    });

  describe("traduz para 409 o que é colisão de vigência", () => {
    it("P2002 — índice único parcial sobre a vigência aberta", () => {
      const erro = new Prisma.PrismaClientKnownRequestError("colidiu", {
        code: "P2002",
        clientVersion: "5.22.0",
      });
      expect(traduzir(erro)).toBeInstanceOf(ConflictException);
    });

    it("23P01 — EXCLUSION, que o Prisma não tipifica", () => {
      // O SQLSTATE chega só no texto: este erro não tem `.code`, e procurá-lo
      // ali deixava todo 409 escapar como 500.
      expect(
        traduzir(
          desconhecido(
            'ERROR: conflicting key value violates exclusion constraint "atribuicao_gestor_equipe_sem_sobreposicao"\ncode: 23P01',
          ),
        ),
      ).toBeInstanceOf(ConflictException);
    });

    it("23505 — unicidade", () => {
      expect(
        traduzir(desconhecido("violates unique constraint (23505)")),
      ).toBeInstanceOf(ConflictException);
    });

    it.each(CHECKS_DA_FAMILIA_GESTOR)(
      "23514 no CHECK reconhecido %s",
      (nome) => {
        expect(
          traduzir(
            desconhecido(
              `ERROR: new row violates check constraint "${nome}"\ncode: 23514`,
            ),
          ),
        ).toBeInstanceOf(ConflictException);
      },
    );
  });

  describe("NÃO traduz — e é isso que impede o 409 tranquilizador", () => {
    it("23514 de uma constraint de OUTRA família propaga", () => {
      // O caso que mais importa: um CHECK violado em qualquer outra tabela é
      // defeito, e precisa chegar como 500. Casar só o SQLSTATE converteria
      // uma classe inteira de bugs futuros em "já existe".
      const erro = desconhecido(
        'ERROR: new row violates check constraint "vinculo_funcional_situacao_valida"\ncode: 23514',
      );
      expect(traduzir(erro)).toBe(erro);
    });

    it("erro genérico propaga intacto", () => {
      const erro = new Error("conexão caiu");
      expect(traduzir(erro)).toBe(erro);
    });

    it("erro Prisma desconhecido sem SQLSTATE propaga", () => {
      const erro = desconhecido("algo inesperado aconteceu no driver");
      expect(traduzir(erro)).toBe(erro);
    });

    it("P2025 (registro não encontrado) propaga — não é conflito", () => {
      const erro = new Prisma.PrismaClientKnownRequestError("sumiu", {
        code: "P2025",
        clientVersion: "5.22.0",
      });
      expect(traduzir(erro)).toBe(erro);
    });
  });

  describe("exceções já decididas pelo service atravessam intactas", () => {
    it("o 409 do encerramento perdido não é re-traduzido", () => {
      const erro = new ConflictException("O registro já está encerrado.");
      expect(traduzir(erro)).toBe(erro);
    });

    it("o 404 anti-enumeração não vira 409", () => {
      // Virar 409 aqui revelaria que o recurso existe — exatamente o que o
      // 404 indistinguível esconde.
      const erro = new NotFoundException();
      expect(traduzir(erro)).toBe(erro);
    });
  });

  /**
   * Guarda contra uma lista que mente.
   *
   * Um nome de constraint errado em `CHECKS_DA_FAMILIA_GESTOR` não quebra
   * nada visivelmente: a entrada simplesmente nunca casa, e o 409 esperado
   * volta a ser 500 — em produção, no dia em que alguém encerrar com data
   * incoerente. É o mesmo fail-open silencioso que a guarda de coluna
   * inexistente fecha no lado do banco.
   */
  it("todo CHECK declarado existe mesmo nas migrations", () => {
    const migrations = join(__dirname, "..", "..", "prisma", "migrations");
    const sql = [
      "20261006120000_fundacao_gestor_consultivo",
      "20261007120000_gestor_historico_imutavel",
    ]
      .map((dir) =>
        readFileSync(join(migrations, dir, "migration.sql"), "utf8"),
      )
      .join("\n");

    for (const nome of CHECKS_DA_FAMILIA_GESTOR) {
      expect(sql).toContain(nome);
    }
  });
});
