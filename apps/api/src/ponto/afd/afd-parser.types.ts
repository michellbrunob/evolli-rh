/**
 * Tipos do núcleo do parser AFD sintético (Ponto V1, perfil REP-C).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, log ou persistência. O resultado
 * é retornado **em memória** para a etapa futura; este núcleo nunca grava,
 * nunca loga e nunca associa a marcação a um colaborador.
 *
 * Contrato de referência: `docs/modules/etapa3-parser-afd-contrato-tecnico-v1.md`
 * (T040). Regras de segurança: contrato §5 (fail-closed), §7 (erro por linha
 * sem expor CPF), §8 (auditoria/erros sem valor sensível).
 */

/**
 * Códigos de erro **seguros** — rótulos técnicos estáveis, nunca contêm valor.
 *
 * Um código de erro **jamais** carrega CPF, nome, conteúdo integral da linha,
 * data/hora bruta ou hash (contrato §5, §8). O endereçamento seguro é feito por
 * `posicaoLinha` e/ou `nsr` técnico (contrato §7).
 */
export type AfdCodigoErro =
  // ---- Fatais (fail-closed): arquivo rejeitado, nenhum registro aceito ------
  /** Arquivo sem nenhum byte. */
  | "AFD_ARQUIVO_VAZIO"
  /** Bytes incompatíveis com texto ASCII ISO 8859-1 (BOM, nulos, controle). */
  | "AFD_ENCODING_INVALIDO"
  /** Terminação de linha ausente/divergente (não CR+LF) — truncado/corrompido. */
  | "AFD_TERMINACAO_LINHA_INVALIDA"
  /** Linha em branco (o anexo proíbe linhas vazias). */
  | "AFD_LINHA_EM_BRANCO"
  /** Primeira linha não é um cabeçalho (tipo `1`, sentinela). */
  | "AFD_CABECALHO_AUSENTE"
  /** Cabeçalho presente porém com comprimento/estrutura inválidos. */
  | "AFD_CABECALHO_INVALIDO"
  /** Versão do leiaute diferente da suportada ("004"). */
  | "AFD_VERSAO_NAO_SUPORTADA"
  /** Última linha não é um trailer (tipo `9`, sentinela). */
  | "AFD_TRAILER_AUSENTE"
  /** Trailer presente porém com comprimento/estrutura inválidos. */
  | "AFD_TRAILER_INVALIDO"
  /** Contagens declaradas no trailer divergem das efetivamente lidas. */
  | "AFD_TRAILER_CONTAGEM_DIVERGENTE"
  /** Registro de dados com tipo fora de {2,3,4,5,6,7} (inclui 1/9 fora de lugar). */
  | "AFD_TIPO_REGISTRO_DESCONHECIDO"
  /** Linha curta demais para ler o tipo — truncamento que impede interpretar. */
  | "AFD_LINHA_TAMANHO_INVALIDO"
  /** NSR de registro de dados não é numérico de 9 posições. */
  | "AFD_NSR_INVALIDO"
  /** NSR fora da ordem exigida pelo anexo (não crescente). */
  | "AFD_NSR_FORA_DE_ORDEM"
  /** NSR repetido — violação estrutural (contrato §4.9). */
  | "AFD_NSR_DUPLICADO"
  // ---- Por marcação (§7): pendência, o restante do lote continua ------------
  /** Marcação tipo `3` com comprimento diferente do esperado (50). */
  | "AFD_MARCACAO_TAMANHO_INVALIDO"
  /** Data/hora da marcação fora do formato oficial (DH). */
  | "AFD_MARCACAO_DATAHORA_INVALIDA"
  /** Identificador (CPF) ausente/não numérico no campo de 12 posições. */
  | "AFD_MARCACAO_IDENTIFICADOR_INVALIDO";

/**
 * Marcação tipo `3` **aceita** — dados mínimos entregues, em memória, à etapa
 * futura de associação/apuração (fora deste núcleo).
 *
 * Contém o identificador **como veio** (contrato §2.2 — sem normalização; a
 * normalização do campo de 12 posições é pendente) e a data/hora **preservando
 * o fuso** (contrato §4.3 — sem conversão). Este objeto **não** é log nem erro:
 * é o insumo da próxima etapa.
 */
export interface MarcacaoAfdAceita {
  /** NSR do registro, como veio (9 posições). */
  readonly nsr: string;
  /** Data/hora da marcação, string DH bruta com o fuso preservado. */
  readonly momentoMarcacao: string;
  /** Identificador do trabalhador (CPF) como veio — campo de 12 posições. */
  readonly identificadorBruto: string;
  /** Número da linha no arquivo (1-based) para rastreabilidade técnica. */
  readonly posicaoLinha: number;
}

/**
 * Pendência de uma marcação **rejeitada por linha** (contrato §7). Só
 * endereçamento técnico — **nunca** CPF, nome, data/hora bruta, conteúdo ou
 * hash.
 */
export interface PendenciaMarcacaoAfd {
  readonly codigo: AfdCodigoErro;
  /** NSR técnico, quando legível; `null` se não pôde ser lido com segurança. */
  readonly nsr: string | null;
  readonly posicaoLinha: number;
}

/**
 * Erro **estrutural fatal** (fail-closed). Só endereçamento técnico seguro.
 */
export interface ErroEstruturalAfd {
  readonly codigo: AfdCodigoErro;
  /** Linha do problema (1-based), quando aplicável; `null` se for do arquivo. */
  readonly posicaoLinha: number | null;
  /** NSR técnico, quando aplicável e legível; `null` caso contrário. */
  readonly nsr: string | null;
}

/** Resumo estatístico do processamento (sem dado pessoal). */
export interface ResumoParseAfd {
  readonly totalLinhas: number;
  readonly marcacoesAceitas: number;
  readonly marcacoesRejeitadas: number;
}

/**
 * Resultado do parser — união discriminada por `status`.
 *
 * - `rejeitado`: erro estrutural fatal (§5). **Nenhum** registro é aceito.
 * - `processado`: arquivo estruturalmente válido; marcações aceitas e
 *   pendências por linha convivem (rejeição parcial autorizada, §7).
 */
export type ResultadoParseAfd =
  | {
      readonly status: "rejeitado";
      readonly erro: ErroEstruturalAfd;
      readonly marcacoes: readonly [];
      readonly pendencias: readonly [];
    }
  | {
      readonly status: "processado";
      readonly marcacoes: readonly MarcacaoAfdAceita[];
      readonly pendencias: readonly PendenciaMarcacaoAfd[];
      readonly resumo: ResumoParseAfd;
    };
