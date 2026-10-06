/**
 * Núcleo puro do escopo do gestor (T151, ADR 0015).
 *
 * Isolado de Prisma e de HTTP de propósito: a regra que decide **quem um
 * gestor pode ver** é a peça mais sensível desta entrega, e precisa ser
 * testável sem banco, sem sessão e sem mock de ORM. O service traduz o
 * resultado em consulta; este arquivo não sabe o que é uma consulta.
 *
 * O ESCOPO, EM UMA FRASE: um gestor vê os vínculos cuja **alocação vigente**
 * aponta para uma **equipe que ele gerencia naquela data**, mais os vínculos
 * cobertos por **exceção individual vigente**. Nada além disso — e, na
 * ausência de atribuição, nada.
 *
 * O QUE ESTE MÓDULO NUNCA FAZ, por decisão e não por esquecimento:
 *
 *   - não deriva escopo de cargo, nome, e-mail, papel ou de `AccessUser`
 *     `team_id`/`unit_id` (ADR 0003 d. 8: são TEXT sem FK, sem validação de
 *     empresa e sem semântica definida);
 *   - não sobe para departamento, unidade ou empresa quando o gestor não tem
 *     equipe — **lista vazia nunca vira "tudo"**, que é o modo clássico de um
 *     filtro virar vazamento;
 *   - não enxerga subordinado indireto: a ADR 0015, decisão 3, limita a
 *     subordinados DIRETOS das equipes atribuídas, e hierarquia recursiva
 *     continua inexistente (ADR 0006, decisão 8).
 */

/** Papel da atribuição. Espelha o enum `PapelGestorEquipe` do banco. */
export type PapelGestorEquipe = "principal" | "substituto";

/** Período fechado à esquerda e aberto à direita: `[inicio, fim)`. */
export interface Vigencia {
  /** `YYYY-MM-DD`. */
  readonly inicio: string;
  /** `YYYY-MM-DD`, ou `null` para período em aberto. */
  readonly fim: string | null;
}

export interface AtribuicaoDeEquipe extends Vigencia {
  readonly equipeId: string;
  readonly papel: PapelGestorEquipe;
}

export interface ExcecaoIndividual extends Vigencia {
  readonly vinculoId: string;
  /** Exceção revogada antes do prazo: deixa de valer na data da revogação. */
  readonly encerradaEm: string | null;
}

export interface EscopoDoGestor {
  /** Equipes que o gestor gerencia na data de referência. */
  readonly equipeIds: readonly string[];
  /** Vínculos alcançados por exceção individual vigente. */
  readonly vinculoIdsPorExcecao: readonly string[];
  /** `true` quando o gestor não alcança ninguém — a consulta deve ser vazia. */
  readonly vazio: boolean;
}

/**
 * Um período `[inicio, fim)` contém a data?
 *
 * Mesma semântica do `daterange(inicio, fim, '[)')` que o banco usa nas
 * EXCLUSION CONSTRAINTS: início **inclusivo**, fim **exclusivo**. Encerrar em
 * D e recomeçar em D é sucessão, não sobreposição — e, no dia D, só o novo
 * período vale. Comparar `YYYY-MM-DD` como string é correto e proposital:
 * a ordem lexicográfica do formato ISO é a ordem cronológica, sem fuso.
 */
export function vigenteEm(periodo: Vigencia, data: string): boolean {
  if (data < periodo.inicio) return false;
  if (periodo.fim !== null && data >= periodo.fim) return false;
  return true;
}

/**
 * Resolve o escopo do gestor numa data.
 *
 * `principal` e `substituto` dão **o mesmo alcance**: o substituto existe para
 * cobrir ausência, e cobertura que enxerga menos não cobre (ADR 0015,
 * decisão 4). A diferença entre os dois é de registro e auditoria — quem
 * respondia pela equipe e em que período —, nunca de visibilidade.
 */
export function resolverEscopo(
  atribuicoes: readonly AtribuicaoDeEquipe[],
  excecoes: readonly ExcecaoIndividual[],
  dataReferencia: string,
): EscopoDoGestor {
  const equipeIds = [
    ...new Set(
      atribuicoes
        .filter((a) => vigenteEm(a, dataReferencia))
        .map((a) => a.equipeId),
    ),
  ];

  const vinculoIdsPorExcecao = [
    ...new Set(
      excecoes
        .filter((e) => {
          if (!vigenteEm(e, dataReferencia)) return false;
          // Revogação antecipada encurta o período: a exceção vale até o dia
          // em que foi revogada, exclusive. Sem isto, revogar não revogaria
          // nada até o prazo original vencer.
          if (e.encerradaEm !== null && dataReferencia >= e.encerradaEm) {
            return false;
          }
          return true;
        })
        .map((e) => e.vinculoId),
    ),
  ];

  return {
    equipeIds,
    vinculoIdsPorExcecao,
    vazio: equipeIds.length === 0 && vinculoIdsPorExcecao.length === 0,
  };
}

/**
 * Normaliza uma coluna `@db.Date` do Prisma para `YYYY-MM-DD`.
 *
 * Prisma devolve `@db.Date` como `DateTime` em UTC meia-noite
 * (`2026-01-05T00:00:00.000Z`). Formatar com fuso local deslocaria o dia para
 * trás em qualquer fuso a oeste de Greenwich — e deslocar o dia aqui
 * deslocaria a fronteira de um escopo de autorização.
 */
export function comoDiaIso(valor: Date | string | null): string | null {
  if (valor === null) return null;
  return (typeof valor === "string" ? valor : valor.toISOString()).slice(0, 10);
}
