import { BadRequestException } from "@nestjs/common";
import { Prisma, StatusOrganizacional } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { escaparCuringas } from "../common/busca.util";
import { ConflitoDeReferenciaException } from "../common/erros/recusa-por-campo";
import { traduzirErroPrisma } from "./prisma-erro.util";

/**
 * T197 — criação inline de referência na Nova admissão: o RH digita só o
 * nome, e o SERVIDOR decide o código, a unicidade e a empresa (a da sessão,
 * já resolvida por quem chama). Vale para Departamento, Unidade, Cargo e
 * Centro de custo; Área e Equipe ficam fora.
 *
 * Nada aqui grava ou registra o nome, o código gerado ou o termo em log ou
 * auditoria: a trilha recebe só ids, pelo `auditar` de quem chama.
 */

/** Limite do nome, o mesmo do cadastro manual. */
export const NOME_MAXIMO_DA_REFERENCIA = 160;
/** Tamanho máximo do código (`CODIGO_PATTERN`). */
const CODIGO_MAXIMO = 32;
/** Candidatos de código: `BASE`, `BASE_2` … `BASE_50`. */
export const LIMITE_DE_CODIGOS_CANDIDATOS = 50;
/**
 * Novas tentativas da transação inteira quando outro pedido, com outro nome,
 * gravou o mesmo código entre a escolha e a gravação (violação de unicidade).
 */
const TENTATIVAS_DA_TRANSACAO = 5;

/** Prefixo do código quando o nome não rende ao menos 2 caracteres. */
export type PrefixoDoTipo = "DEP" | "CAR" | "UNI" | "CC";

// eslint-disable-next-line no-control-regex
const CARACTERE_DE_CONTROLE = /[\u0000-\u001F\u007F]/;

/**
 * Nome como será gravado: extremidades aparadas e espaços repetidos reduzidos
 * a um. Maiúsculas, minúsculas e acentos ficam como digitados. `null` quando
 * vazio, com caractere de controle ou acima do limite.
 */
export function normalizarNomeDaReferencia(nome: string): string | null {
  if (CARACTERE_DE_CONTROLE.test(nome)) return null;
  const normalizado = nome.trim().replace(/\s+/g, " ");
  if (!normalizado || normalizado.length > NOME_MAXIMO_DA_REFERENCIA) {
    return null;
  }
  return normalizado;
}

/**
 * Chave de comparação de nomes: o nome normalizado, sem diferenciar
 * maiúsculas. Acentos contam (mesma regra da busca da T196).
 */
export function chaveDoNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Base do código: ASCII em maiúsculas, `_` como separador, até 32. */
function baseDoCodigo(nome: string, prefixo: PrefixoDoTipo): string {
  const ascii = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base =
    ascii.length >= 2 ? ascii : ascii ? `${prefixo}_${ascii}` : prefixo;
  return cortar(base, CODIGO_MAXIMO);
}

/** Corta e retira `_` que tenha sobrado no fim. */
function cortar(texto: string, limite: number): string {
  return texto.slice(0, limite).replace(/_+$/, "");
}

/**
 * Os códigos tentados, em ordem: `BASE`, `BASE_2`, `BASE_3`… até o limite. A
 * base é cortada para o sufixo caber em 32. Todos satisfazem `CODIGO_PATTERN`.
 */
export function codigosCandidatos(
  nome: string,
  prefixo: PrefixoDoTipo,
): string[] {
  const base = baseDoCodigo(nome, prefixo);
  const candidatos = [base];
  for (let n = 2; n <= LIMITE_DE_CODIGOS_CANDIDATOS; n += 1) {
    const sufixo = `_${n}`;
    candidatos.push(`${cortar(base, CODIGO_MAXIMO - sufixo.length)}${sufixo}`);
  }
  return candidatos;
}

/** A palavra mais longa do nome: o filtro do banco antes da comparação exata. */
function palavraMaisLonga(nome: string): string {
  return nome
    .split(" ")
    .reduce((maior, palavra) =>
      palavra.length > maior.length ? palavra : maior,
    );
}

interface ReferenciaGravada {
  id: string;
  codigo: string;
  nome: string;
  status: StatusOrganizacional;
  empresaId: string;
}

export interface CriacaoAutomatica<T extends ReferenciaGravada> {
  readonly prisma: PrismaService;
  /** Tipo da referência: entra só na chave da trava. */
  readonly tipo: string;
  readonly prefixo: PrefixoDoTipo;
  /** Empresa já resolvida pelo escopo da sessão. */
  readonly empresaId: string;
  /** Nome como veio no corpo; normalizado aqui. */
  readonly nome: string;
  /** Referências da empresa cujo nome contém `trecho` (sem maiúsculas). */
  readonly porNome: (
    tx: Prisma.TransactionClient,
    filtro: { empresaId: string; nome: Prisma.StringFilter },
  ) => Promise<T[]>;
  /** Códigos já usados na empresa, de qualquer status. */
  readonly codigosUsados: (
    tx: Prisma.TransactionClient,
    empresaId: string,
    codigos: string[],
  ) => Promise<{ codigo: string }[]>;
  readonly criar: (
    tx: Prisma.TransactionClient,
    dados: { empresaId: string; codigo: string; nome: string },
  ) => Promise<T>;
  /** Auditoria da criação, só com ids (ação de criação já existente). */
  readonly auditar: (tx: Prisma.TransactionClient, criada: T) => Promise<void>;
}

function violouUnicidade(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

/**
 * Cria com código gerado no servidor. Numa transação:
 *
 * 1. trava consultiva por tipo + empresa + nome normalizado — dois pedidos
 *    com o mesmo nome esperam um pelo outro, e o segundo vê o primeiro;
 * 2. nome igual na empresa: ativa → 409 `nome_em_uso` com a existente;
 *    só inativa → 409 `nome_inativo` (sem reativar);
 * 3. o primeiro código livre entre os candidatos, ou 409
 *    `codigo_indisponivel`;
 * 4. grava e audita.
 *
 * Pedidos com nomes diferentes que geram o mesmo código não se travam: a
 * unicidade do banco recusa o segundo, e a transação inteira roda de novo,
 * já vendo o código ocupado.
 */
export async function criarComCodigoAutomatico<T extends ReferenciaGravada>(
  criacao: CriacaoAutomatica<T>,
): Promise<T> {
  const nome = normalizarNomeDaReferencia(criacao.nome);
  if (nome === null) throw new BadRequestException();
  const chave = chaveDoNome(nome);
  const trava = `organizacao:${criacao.tipo}:${criacao.empresaId}:${chave}`;

  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await criacao.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trava}))`;

        const mesmoNome = (
          await criacao.porNome(tx, {
            empresaId: criacao.empresaId,
            nome: {
              contains: escaparCuringas(palavraMaisLonga(nome)),
              mode: "insensitive",
            },
          })
        ).filter((r) => chaveDoNome(r.nome) === chave);
        const ativa = mesmoNome.find((r) => r.status === "ativo");
        if (ativa) {
          throw new ConflitoDeReferenciaException("nome_em_uso", {
            id: ativa.id,
            codigo: ativa.codigo,
            nome: ativa.nome,
          });
        }
        if (mesmoNome.length > 0) {
          throw new ConflitoDeReferenciaException("nome_inativo");
        }

        const candidatos = codigosCandidatos(nome, criacao.prefixo);
        const usados = new Set(
          (await criacao.codigosUsados(tx, criacao.empresaId, candidatos)).map(
            (r) => r.codigo,
          ),
        );
        const codigo = candidatos.find((c) => !usados.has(c));
        if (!codigo) {
          throw new ConflitoDeReferenciaException("codigo_indisponivel");
        }

        const criada = await criacao.criar(tx, {
          empresaId: criacao.empresaId,
          codigo,
          nome,
        });
        await criacao.auditar(tx, criada);
        return criada;
      });
    } catch (erro) {
      if (violouUnicidade(erro) && tentativa < TENTATIVAS_DA_TRANSACAO) {
        continue;
      }
      if (erro instanceof ConflitoDeReferenciaException) throw erro;
      traduzirErroPrisma(erro);
    }
  }
}
