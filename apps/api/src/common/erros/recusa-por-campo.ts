import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";

/**
 * T179 — erro por campo no contrato HTTP, **sem refletir o valor** enviado
 * (ADR 0016, `DP-ADM-15`, resolvido para a admissão e a edição de contatos).
 *
 * A resposta continua com a mensagem pública fixa do status; o que se soma é
 * a lista `erros`, com o caminho do campo no corpo da requisição e o motivo.
 * Nunca o valor, nunca dado de outra pessoa: a checagem que gera o erro é só
 * na empresa ativa, então "em uso" não confirma ninguém fora do escopo.
 */

/** Motivos públicos de recusa por campo. */
export type MotivoDoCampo = "em_uso";

/**
 * Caminhos públicos de campo. Lista fechada: só estes saem na resposta, e o
 * tipo impede que um nome montado a partir de entrada do usuário vaze.
 */
export type CampoPublico =
  | "matricula"
  | "contatos.emailPessoal"
  | "emailPessoal"
  // T182 — código de jornada repetido na empresa.
  | "codigo";

export interface ErroDeCampo {
  campo: CampoPublico;
  motivo: MotivoDoCampo;
}

/** 409 com a lista dos campos que conflitam com dado já gravado na empresa. */
export class ConflitoDeCamposException extends ConflictException {
  constructor(readonly erros: readonly ErroDeCampo[]) {
    super();
  }
}

/** Códigos públicos de recusa sem campo próprio. */
export type CodigoDeRecusa =
  "idempotencia_conteudo_divergente" | "csrf_invalido";

/**
 * 422 com um código estável. Hoje só um caso: a mesma chave de idempotência
 * reenviada com conteúdo diferente do que ela já registrou.
 */
export class RecusaDeNegocioException extends UnprocessableEntityException {
  constructor(readonly codigo: CodigoDeRecusa) {
    super();
  }
}

/**
 * T179 — 403 do `CsrfGuard`, com código estável (`csrf_invalido`) para a tela
 * distinguir sessão ou token de página vencido de falta de permissão (403 sem
 * código). Mesmo status e mesma negação de antes: nada é liberado.
 */
export class RecusaCsrfException extends ForbiddenException {
  readonly codigo = "csrf_invalido" as const;
}
