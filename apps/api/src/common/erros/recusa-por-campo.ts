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

/**
 * Motivos públicos de recusa por campo.
 *
 * T183 — jornada do colaborador: `indisponivel` (jornada inativa ou fora da
 * empresa ativa — os dois respondem igual, para não revelar outra empresa),
 * `igual_a_vigente` (trocar para a jornada que já vale), `fora_de_ordem`
 * (data que não vem depois da que precisa vir), `ja_encerrada` (encerrar uma
 * vigência que já terminou) e `sobreposta` (a vigência cruza outra do mesmo
 * colaborador).
 */
export type MotivoDoCampo =
  | "em_uso"
  | "indisponivel"
  | "igual_a_vigente"
  | "fora_de_ordem"
  | "ja_encerrada"
  | "sobreposta";

/**
 * Caminhos públicos de campo. Lista fechada: só estes saem na resposta, e o
 * tipo impede que um nome montado a partir de entrada do usuário vaze.
 */
export type CampoPublico =
  | "matricula"
  | "contatos.emailPessoal"
  | "emailPessoal"
  // T182 — código de jornada repetido na empresa.
  | "codigo"
  // T183 — jornada do colaborador e a sua vigência.
  | "tabelaHorarioId"
  | "vigenciaInicio"
  | "vigenciaFim";

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

/**
 * T183 — 422 com a lista dos campos recusados por regra de negócio (não por
 * conflito com dado gravado, que é o 409 acima). Mesmo formato: campo e
 * motivo, nunca o valor.
 */
export class CamposRecusadosException extends UnprocessableEntityException {
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
 * T197 — motivos do 409 da criação de referência com código automático (nome
 * já usado por referência ativa ou inativa da empresa, ou sem código livre).
 */
export type CodigoDeConflitoDeReferencia =
  "nome_em_uso" | "nome_inativo" | "codigo_indisponivel";

/**
 * T197 — a referência ativa da própria empresa que já tem o nome pedido. Só
 * sai no 409 `nome_em_uso`, para o RH escolhê-la em vez de criar outra; a
 * consulta é sempre na empresa da sessão.
 */
export interface ReferenciaExistente {
  id: string;
  codigo: string;
  nome: string;
}

/** T197 — 409 da criação com código automático, com código estável. */
export class ConflitoDeReferenciaException extends ConflictException {
  constructor(
    readonly codigo: CodigoDeConflitoDeReferencia,
    readonly referencia?: ReferenciaExistente,
  ) {
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
