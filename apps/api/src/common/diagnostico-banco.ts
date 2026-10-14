/**
 * Diagnóstico técnico de erro de banco (T161).
 *
 * ## Por que existe, e por que mora em `common`
 *
 * A CI de `main` ficou 2/3 no squash `0db3d70`: uma criação concorrente de
 * gestor principal respondeu 500 em vez de 409. O log do runner trazia
 * apenas `errorName: "PrismaClientUnknownRequestError"` e `statusCode: 500` —
 * sem SQLSTATE, sem constraint. Com isso não dá para saber QUAL invariante
 * disparou, e a investigação morre aí.
 *
 * O consumidor é o `AllExceptionsFilter`, e isso não é detalhe: o E2E roda
 * com `LOG_LEVEL=silent`, então o `PinoLogger` dos services **não escreve
 * nada** na CI. O `Logger` do Nest, usado pelo filtro, escreve — foi ele que
 * produziu a única pista que existiu. Pôr o diagnóstico em qualquer outro
 * lugar seria pôr onde não se lê.
 *
 * ## O que pode sair daqui, e o que nunca sai
 *
 * Sai: a classe do erro, o código do Prisma, o SQLSTATE e o identificador da
 * constraint ou trigger. Os quatro são artefatos de **schema** — estão na
 * migration, versionados, iguais para todo mundo.
 *
 * **Não sai**: a mensagem do banco, o `DETAIL` (que carrega os VALORES da
 * chave que colidiu), parâmetros da consulta, conteúdo da requisição, stack
 * ou qualquer coisa derivada de quem chamou. O `DETAIL` de uma violação de
 * exclusão é literalmente o dado que a pessoa enviou; registrá-lo trocaria um
 * problema de diagnóstico por um de privacidade.
 *
 * Nada disto chega à resposta HTTP — o corpo continua sendo a mensagem
 * pública fixa por status, sem citar Prisma, PostgreSQL ou SQLSTATE.
 */
import { Prisma } from "@prisma/client";

/** Só artefatos de schema. Nenhum campo deriva do que a pessoa enviou. */
export interface DiagnosticoErroBanco {
  /** Classe do erro — `PrismaClientUnknownRequestError`, por exemplo. */
  readonly classe: string;
  /** Código do Prisma (`P2002`, `P2028`, `P2034`…), quando tipificado. */
  readonly prismaCode?: string;
  /** SQLSTATE de cinco caracteres (`23P01`, `40P01`, `23000`…). */
  readonly sqlstate?: string;
  /** Identificador da constraint, índice ou trigger que disparou. */
  readonly constraint?: string;
}

/** Identificador do PostgreSQL: até 63 caracteres, sem espaço nem aspas. */
const IDENTIFICADOR = "[a-z_][a-z0-9_$]{0,62}";

/**
 * SQLSTATE nas duas formas que o Prisma produz, medidas em PostgreSQL real:
 * `Code: \`23P01\`` no caminho de consulta crua, e `code: "23P01"` no caminho
 * tipado. A âncora da palavra `code` é o que impede casar um número solto da
 * mensagem.
 */
const PADROES_SQLSTATE: readonly RegExp[] = [
  /\bcode:\s*["'`]([0-9A-Z]{5})["'`]/i,
  /\bSQLSTATE[:\s(]+([0-9A-Z]{5})/i,
];

/**
 * Nome da constraint/trigger. Exige a palavra-chave antes, e só aceita um
 * identificador válido — assim o que sai daqui é sempre algo que está na
 * migration, nunca um trecho de texto vindo da requisição.
 */
const PADROES_CONSTRAINT: readonly RegExp[] = [
  new RegExp(`\\bconstraint\\s+\\\\?["'\`](${IDENTIFICADOR})\\\\?["'\`]`, "i"),
  new RegExp(
    `\\bconstraint:\\s*(?:Some\\()?\\\\?["'\`](${IDENTIFICADOR})`,
    "i",
  ),
  new RegExp(`\\btrigger\\s+\\\\?["'\`](${IDENTIFICADOR})\\\\?["'\`]`, "i"),
];

function primeiraCaptura(
  texto: string,
  padroes: readonly RegExp[],
): string | undefined {
  for (const padrao of padroes) {
    const encontrado = padrao.exec(texto);
    if (encontrado?.[1]) return encontrado[1];
  }
  return undefined;
}

/**
 * Descreve o erro para o log, com o mínimo que permite agir.
 *
 * Construído por **extração**, nunca por recorte da mensagem: cada campo sai
 * de um padrão estreito e é validado. O que não casar simplesmente não
 * aparece — um diagnóstico incompleto é melhor que um que vaza o `DETAIL`.
 */
export function descreverErroDeBanco(erro: unknown): DiagnosticoErroBanco {
  const classe = erro instanceof Error ? erro.constructor.name : typeof erro;

  const diagnostico: {
    classe: string;
    prismaCode?: string;
    sqlstate?: string;
    constraint?: string;
  } = { classe };

  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    /^P\d{4}$/.test(erro.code)
  ) {
    diagnostico.prismaCode = erro.code;
  }

  const mensagem = erro instanceof Error ? erro.message : "";
  if (mensagem) {
    const sqlstate = primeiraCaptura(mensagem, PADROES_SQLSTATE);
    if (sqlstate) diagnostico.sqlstate = sqlstate;

    const constraint = primeiraCaptura(mensagem, PADROES_CONSTRAINT);
    if (constraint) diagnostico.constraint = constraint;
  }

  return diagnostico;
}
