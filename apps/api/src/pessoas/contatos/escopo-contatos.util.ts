import { ForbiddenException } from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { atorOperaEmEscopoGlobal } from "../../auth/session/contexto-empresarial";

/**
 * Escopo de contatos do colaborador (T169) — leitura E edição.
 *
 * Diferente de `resolverEscopoPessoas`, aqui existe variante global também
 * para EDIÇÃO, e só do `master_tecnico` sem empresa ativa: a ficha de
 * tratamento o fez administrador global confiável nesta categoria (Emenda 1 da
 * ADR 0012). Com empresa ativa, ele atua dentro dela, como em todo o resto.
 *
 * O escopo global NÃO é "sem empresa": o service resolve a empresa REAL do
 * colaborador pelo vínculo e audita cada operação com ela.
 */
export type EscopoContatos =
  { global: true } | { global: false; empresaId: string };

/** Deriva o escopo da sessão — nunca do corpo, da query ou da rota. */
export function resolverEscopoContatos(actor: AccessUser): EscopoContatos {
  if (actor.role === "master_tecnico") {
    if (atorOperaEmEscopoGlobal(actor)) {
      return { global: true };
    }
  } else if (actor.role !== "rh" && actor.role !== "dp") {
    // gestor, colaborador, financeiro, admin_tecnico, auditor, dpo. O guard
    // já os nega; isto é defesa em profundidade.
    throw new ForbiddenException();
  }

  if (actor.companyId === null) {
    throw new ForbiddenException();
  }
  return { global: false, empresaId: actor.companyId };
}
