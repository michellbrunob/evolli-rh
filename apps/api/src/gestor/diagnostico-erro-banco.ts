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
import { descreverErroDeBanco } from "../common/diagnostico-banco";

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

/** SQLSTATE de `deadlock detected`. */
export const SQLSTATE_DEADLOCK = "40P01";

/**
 * O erro é um deadlock confirmado pelo diagnóstico?
 *
 * Decidido pelo **SQLSTATE extraído**, nunca por procurar a palavra
 * "deadlock" no texto: a mensagem varia com a versão do driver e com o
 * caminho usado, e casar texto solto é como a T161 quase descartou a causa
 * certa. `descreverErroDeBanco` já faz a extração estreita e validada.
 */
export function ehDeadlockDeBanco(erro: unknown): boolean {
  return descreverErroDeBanco(erro).sqlstate === SQLSTATE_DEADLOCK;
}

/** Quantas vezes a operação pode rodar no total. Duas: a original e UMA repetição. */
export const TENTATIVAS_APOS_DEADLOCK = 2;

/**
 * Repete a operação **uma única vez**, e só depois de um deadlock.
 *
 * ## Por que repetir, e por que isto não é mascarar
 *
 * Medido na T161: quando duas requisições disputam a mesma atribuição de
 * gestor principal, o PostgreSQL às vezes resolve a disputa matando uma
 * delas com `40P01` em vez de deixá-la esperar e falhar na EXCLUSION. As
 * duas saídas descrevem o mesmo fato — alguém perdeu a corrida —, mas só a
 * segunda chega ao classificador como conflito.
 *
 * A repetição **não decide nada sobre o resultado**. Ela devolve a operação
 * ao caminho normal: na segunda tentativa o vencedor já commitou, a linha
 * dele já está lá, e a inserção colide na EXCLUSION — `23P01`, que o
 * classificador já traduz em 409 desde a T157. O 409 continua vindo da
 * invariante do banco, nunca de uma tradução direta de `40P01`.
 *
 * ## Os limites, que são a parte importante
 *
 * **Uma repetição, nunca duas.** Se a segunda tentativa também morrer em
 * deadlock, o erro é preservado como está e a resposta continua 500 — porque
 * aí não se trata mais de uma corrida comum, e insistir esconderia um
 * problema de verdade.
 *
 * **Só deadlock.** Qualquer outro erro sai na primeira tentativa, intacto.
 *
 * **Sem espera entre as tentativas.** O deadlock já foi resolvido pelo
 * PostgreSQL no instante em que ele abortou esta transação; o vencedor
 * commitou ou está prestes a commitar. Dormir aqui só atrasaria a resposta.
 *
 * Nada disto é genérico: quem chama é exclusivamente a criação de atribuição
 * de gestor, onde a disputa possível é uma só e está declarada em
 * constraint.
 */
export async function comRepeticaoAposDeadlock<T>(
  operacao: (tentativa: number) => Promise<T>,
): Promise<T> {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await operacao(tentativa);
    } catch (erro) {
      const ultima = tentativa >= TENTATIVAS_APOS_DEADLOCK;
      if (ultima || !ehDeadlockDeBanco(erro)) throw erro;
    }
  }
}
