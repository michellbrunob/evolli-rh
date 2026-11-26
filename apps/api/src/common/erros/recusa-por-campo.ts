import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
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
  // T209 — valor com formato certo e conteúdo recusado (CNPJ com verificador
  // errado).
  | "invalido"
  | "indisponivel"
  | "igual_a_vigente"
  | "fora_de_ordem"
  | "ja_encerrada"
  | "sobreposta"
  // T215 — Férias e ausências.
  | "obrigatorio"
  | "nao_se_aplica"
  | "fim_antes_do_inicio"
  | "sobreposicao"
  | "saldo_insuficiente"
  | "venda_acima_do_limite"
  // T215 — Salários: data de vigência depois de hoje.
  | "futura"
  // T215 — Escala: vigência antes da admissão do colaborador.
  | "antes_da_admissao"
  // T215 — Quadro da escala: dia fora do vínculo da pessoa na empresa.
  | "fora_do_vinculo"
  // T215 — Ajustar período (reinício da contagem de férias).
  | "ja_existe"
  // T215 — Sugerir outras datas: o mesmo período pedido.
  | "igual_ao_pedido"
  | "sem_saldo_calculado"
  | "abaixo_das_ferias"
  | "ferias_sem_periodo"
  // T215 — Visões salvas: o teto de visões por pessoa.
  | "limite";

/**
 * Caminhos públicos de campo. Lista fechada: só estes saem na resposta, e o
 * tipo impede que um nome montado a partir de entrada do usuário vaze.
 */
export type CampoPublico =
  | "matricula"
  | "contatos.emailPessoal"
  | "emailPessoal"
  // T209 — CPF já usado na empresa.
  | "perfilPessoal.cpf"
  // T209 — CNPJ da Nova empresa (inválido ou já cadastrado).
  | "cnpj"
  // T209 — gestor direto sem vínculo na empresa.
  | "contrato.gestorDiretoId"
  // T215 — o primeiro salário é obrigatório na admissão.
  | "contrato.salarioBruto"
  // T215 — o mesmo campo na edição do contrato (corpo sem o bloco).
  | "gestorDiretoId"
  // T182 — código de jornada repetido na empresa.
  | "codigo"
  // T183 — jornada do colaborador e a sua vigência.
  | "tabelaHorarioId"
  | "vigenciaInicio"
  | "vigenciaFim"
  // T215 — registro de ausência.
  | "colaboradorId"
  | "motivoAfastamento"
  | "inicio"
  | "fim"
  | "diasVendidos"
  | "periodoAquisitivoInicio"
  // T215 — Ajustar período: os dias que o período encurtado deu.
  | "diasPeriodoAnterior"
  // T215 — Salários: o salário do contrato com linha do tempo.
  | "salarioBruto"
  // T215 — férias para quem não tem férias (PJ e Freelancer).
  | "tipo"
  // T215 — Escala: o padrão de escala do colaborador.
  | "modelo"
  | "turnoNoiteId"
  | "folgaSemanal"
  | "diasTrabalho"
  | "inicioCiclo"
  // T215 — Turnos: a unidade do turno.
  | "unidadeOrganizacionalId"
  // T215 — Quadro da escala: o dia gravado.
  | "dia"
  | "periodos"
  | "sobreaviso"
  | "intervaloMinutos"
  | "observacao"
  // T215 — Regras da escala.
  | "convencao"
  | "avisos"
  // T215 — Visões salvas do quadro.
  | "nome"
  | "filtros";

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
  | "idempotencia_conteudo_divergente"
  | "csrf_invalido"
  // T208 — foto de perfil recusada pelo conteúdo (ADR 0018).
  | "foto_formato_invalido"
  | "foto_pequena"
  | "foto_grande_demais"
  | "foto_invalida"
  // T209 — foto do colaborador (ADR 0020): tipo declarado, extensão e
  // conteúdo que não concordam, e tamanho de versão pedido fora da lista.
  | "foto_tipo_divergente"
  | "foto_tamanho_invalido"
  // T213 — documentos do colaborador (ADR 0021).
  | "documento_arquivo_vazio"
  | "documento_arquivo_grande_demais"
  | "documento_formato_invalido"
  | "documento_arquivo_malformado"
  | "documento_categoria_invalida"
  | "documento_nome_obrigatorio"
  | "documento_nome_invalido"
  | "documento_nome_nao_permitido"
  | "documento_limite_categoria"
  | "documento_limite_colaborador"
  | "documento_nao_disponivel"
  // T215 — anexo da ausência (atestado ou documento).
  | "anexo_arquivo_vazio"
  | "anexo_arquivo_grande_demais"
  | "anexo_formato_invalido"
  | "anexo_arquivo_malformado"
  | "anexo_com_macro"
  | "anexo_reprovado_antivirus"
  // T215 — Publicar a escala sem mudança no rascunho do período.
  | "escala_nada_para_publicar";

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
 * T213 — serviço de que a operação depende está fora do ar (503). A resposta
 * leva só um código de uma lista fechada, para a tela dizer o que fazer;
 * nunca host, porta, nome do serviço ou mensagem interna.
 */
export type CodigoDeIndisponibilidade =
  | "documento_verificacao_indisponivel"
  // T215 — anexo da ausência.
  | "anexo_verificacao_indisponivel"
  | "anexo_armazenamento_indisponivel";

export class IndisponibilidadeException extends ServiceUnavailableException {
  constructor(readonly codigo: CodigoDeIndisponibilidade) {
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
