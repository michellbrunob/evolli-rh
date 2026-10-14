/**
 * Classificação e diagnóstico de erro de banco na família do gestor (T161).
 *
 * ## Por que este arquivo existe
 *
 * A CI de `main` ficou 2/3 no squash `0db3d70`: o cenário de duas criações
 * simultâneas de gestor principal devolveu **um 201 e nenhum 409** — o
 * perdedor da corrida recebeu outra coisa. O log do runner trazia apenas
 * `errorName: "PrismaClientUnknownRequestError"` e `statusCode: 500`, sem
 * SQLSTATE, sem constraint e sem correlação com o teste.
 *
 * Com isso não dava para corrigir: não se sabia **qual** invariante
 * disparou. O diagnóstico acrescentado pela T161 respondeu na primeira
 * reprodução — **40P01, deadlock**, chegando como
 * `PrismaClientUnknownRequestError`.
 *
 * Duas medições erradas valem registro, porque custaram tempo:
 *
 *  - expiração de transação por espera de lock **não** é a causa: 9s de
 *    contenção forçada pelo caminho real da API devolveram 409;
 *  - deadlock chega como `PrismaClientKnownRequestError` (P2010) **apenas no
 *    caminho de consulta crua**. Pelo caminho tipado, que é o que o service
 *    usa, chega como `Unknown` com `40P01` no texto. Medir pelo caminho
 *    errado quase descartou a causa verdadeira.
 *
 * Então a T161 **não inventa mapeamento**. Ela preserva a regra que já
 * funciona — este arquivo — e põe o diagnóstico do que escapa onde ele é
 * lido: no `AllExceptionsFilter` (ver `common/diagnostico-banco.ts`).
 * Transformar 40P01 em 409 é decisão de produto, não de implementação, e
 * depende de autorização que esta tarefa não tem.
 *
 * A regra virou função pura para poder ser exercitada sem subir Nest nem
 * banco: o que decide entre 409 e 500 é forte demais para só ser testado de
 * ponta a ponta.
 */
import { Prisma } from "@prisma/client";

/**
 * CHECKs desta família cuja violação é conflito de negócio, não defeito.
 *
 * Lista fechada, conferida contra a migration 20261006120000. Nomes de
 * constraint de outras tabelas não entram aqui, e por isso continuam virando
 * 500 — que é a resposta honesta para "isto não devia ter acontecido".
 */
export const CHECKS_DA_FAMILIA_GESTOR = [
  "access_user_colaborador_intervalo_coerente",
  "atribuicao_gestor_equipe_intervalo_coerente",
  "excecao_acesso_gestor_intervalo_coerente",
  "excecao_acesso_gestor_justificativa_nao_vazia",
] as const;

/** `conflito` vira 409; `desconhecido` continua 500 e é diagnosticado. */
export type ClassificacaoErroBanco = "conflito" | "desconhecido";

/**
 * Decide se o erro é a colisão de negócio conhecida.
 *
 * Transcrição fiel da regra que já existia no service — nenhum SQLSTATE novo
 * entrou na T161. Virou função pura para poder ser exercitada diretamente,
 * sem subir Nest nem banco: a regra que decide entre 409 e 500 é forte demais
 * para só ser testada de through-and-through.
 */
export function classificarErroDeBanco(erro: unknown): ClassificacaoErroBanco {
  // `P2002` é o único dos dois que o Prisma tipifica.
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    return "conflito";
  }

  if (erro instanceof Prisma.PrismaClientUnknownRequestError) {
    // 23P01 — EXCLUSION: períodos de vigência se sobrepõem.
    // 23505 — UNIQUE: índice parcial sobre a vigência aberta.
    if (
      /23P01/.test(erro.message) ||
      /violates exclusion constraint/i.test(erro.message) ||
      /23505/.test(erro.message) ||
      /violates unique constraint/i.test(erro.message)
    ) {
      return "conflito";
    }

    // 23514 — CHECK, e SÓ os desta família. Traduzir a classe inteira para
    // 409 transformaria qualquer defeito futuro de outra tabela numa
    // resposta tranquilizadora.
    if (
      /23514/.test(erro.message) &&
      CHECKS_DA_FAMILIA_GESTOR.some((nome) => erro.message.includes(nome))
    ) {
      return "conflito";
    }
  }

  return "desconhecido";
}
