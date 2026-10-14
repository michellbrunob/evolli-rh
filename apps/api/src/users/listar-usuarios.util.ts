import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import {
  atorOperaEmEscopoGlobal,
  papelTemPoliticaGlobal,
} from "../auth/session/contexto-empresarial";

/**
 * Escopo de leitura de `GET /v1/users` (T120) — mesmo desenho de
 * `EscopoLeituraPonto` (`ponto/escopo-ponto.util.ts`): variante global
 * exclusiva do `master_tecnico`; `rh`/`dp` presos à própria empresa.
 *
 * Diferença deliberada: aqui a variante global carrega um `companyId`
 * **opcional** (contrato aprovado — T119/T120: "master_tecnico pode filtrar
 * por companyId"). Para `rh`/`dp` não existe campo de filtro de empresa no
 * escopo — a empresa É a da sessão, sempre; um `companyId` de requisição para
 * esses papéis nunca chega a este tipo.
 */
export type EscopoListagemUsuarios =
  | { global: true; companyId: string | undefined }
  | { global: false; companyId: string };

/**
 * Deriva o escopo **da sessão autenticada** — nunca da query. `companyId`
 * só é aceito como filtro quando o ator é `master_tecnico`; para `rh`/`dp`,
 * qualquer valor recebido é ignorado nesta função (mesmo antes de chegar
 * aqui, o parâmetro nem é lido para esses papéis) — a empresa vem sempre de
 * `actor.companyId`.
 *
 * O `AuthorizationGuard` já nega, antes deste método rodar, qualquer papel
 * sem a capacidade `other_account`/`read` (rbac.evaluator.ts). Esta função é
 * defesa em profundidade — mesmo critério de `resolverEscopoLeituraPonto`.
 */
export function resolverEscopoListagemUsuarios(
  actor: AccessUser,
  companyIdFiltroSolicitado: string | undefined,
): EscopoListagemUsuarios {
  // T163 — global é condição de CONTEXTO, não de papel.
  //
  // Antes desta tarefa a condição era `actor.role === "master_tecnico"`, e o
  // E2E da T163 mediu o efeito: o Master selecionava a empresa D e continuava
  // enxergando as duas, porque o ramo global curto-circuitava o contexto. Com
  // empresa ativa, o Master opera DENTRO dela — sem seleção, `companyId` é
  // nulo e o comportamento é idêntico ao anterior.
  if (atorOperaEmEscopoGlobal(actor)) {
    return { global: true, companyId: companyIdFiltroSolicitado };
  }
  // T163 — Master COM empresa ativa lista contas daquela empresa. O filtro
  // `companyId` de query e ignorado aqui de proposito: dentro de um contexto
  // escolhido, o escopo e o contexto, nunca o parametro do cliente.
  if (papelTemPoliticaGlobal(actor.role)) {
    if (actor.companyId === null) {
      throw new ForbiddenException();
    }
    return { global: false, companyId: actor.companyId };
  }
  if (actor.role === "rh" || actor.role === "dp") {
    if (actor.companyId === null) {
      throw new ForbiddenException();
    }
    return { global: false, companyId: actor.companyId };
  }
  throw new ForbiddenException();
}

/** Filtro Prisma por `companyId`. Global sem filtro explícito: sem cláusula. */
export function filtroEmpresaListagemUsuarios(escopo: EscopoListagemUsuarios): {
  companyId?: string;
} {
  if (escopo.global) {
    return escopo.companyId !== undefined
      ? { companyId: escopo.companyId }
      : {};
  }
  return { companyId: escopo.companyId };
}

/** `companyId` para o evento de auditoria — `null` quando a consulta é global e sem filtro (mesmo critério de `ponto_consultado`/`master_consulta_global`: a consulta atravessa empresas, então o evento não fixa uma). */
export function empresaParaAuditoriaListagem(
  escopo: EscopoListagemUsuarios,
): string | null {
  if (escopo.global) {
    return escopo.companyId ?? null;
  }
  return escopo.companyId;
}

export const LISTAR_USUARIOS_LIMITE_PADRAO = 25;
export const LISTAR_USUARIOS_LIMITE_MAXIMO = 100;

/** Posição keyset determinística: `(createdAt DESC, id DESC)`. */
export interface CursorListagemUsuarios {
  createdAt: Date;
  id: string;
}

const SEPARADOR = "|";

/**
 * Cursor opaco: base64url de `<ISO-8601 de createdAt>|<id>`. Não é um
 * segredo (não concede acesso a nada que a consulta em si já não concedesse),
 * só evita expor ao cliente o formato interno da posição de paginação.
 */
export function codificarCursorListagemUsuarios(
  cursor: CursorListagemUsuarios,
): string {
  const payload = `${cursor.createdAt.toISOString()}${SEPARADOR}${cursor.id}`;
  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * Decodifica e valida o cursor recebido do cliente. Qualquer formato
 * inesperado (base64 inválido, separador ausente, data não parseável) responde
 * `400` genérico (`AllExceptionsFilter` já fixa a mensagem pública — nenhum
 * detalhe do motivo da falha é exposto).
 */
export function decodificarCursorListagemUsuarios(
  cursor: string,
): CursorListagemUsuarios {
  let payload: string;
  try {
    payload = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new BadRequestException();
  }

  const indiceSeparador = payload.indexOf(SEPARADOR);
  if (indiceSeparador <= 0 || indiceSeparador === payload.length - 1) {
    throw new BadRequestException();
  }

  const dataBruta = payload.slice(0, indiceSeparador);
  const id = payload.slice(indiceSeparador + 1);

  const createdAt = new Date(dataBruta);
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
    throw new BadRequestException();
  }

  return { createdAt, id };
}
