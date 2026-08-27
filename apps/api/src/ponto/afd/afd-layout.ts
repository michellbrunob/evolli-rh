/**
 * Leiaute do AFD (perfil REP-C) — constantes de posição/tamanho.
 *
 * Fonte única de verdade das posições transcritas do **contrato técnico T040**
 * (`docs/modules/etapa3-parser-afd-contrato-tecnico-v1.md`), que por sua vez as
 * transcreveu do anexo oficial do MTE — **leiaute AFD versão "004"**, Portaria
 * MTP 671/2021.
 *
 * Apenas os registros **em escopo da V1** têm layout enforçado aqui: cabeçalho
 * (tipo `1`), marcação REP-C (tipo `3`) e trailer (tipo `9`). Os demais tipos
 * (`2`, `4`, `5`, `6`, `7`) são apenas **reconhecidos e contados** — seus
 * layouts internos **não** são enforçados por este núcleo (o contrato T040 só
 * transcreveu 1/3/9; enforçar os outros exigiria inventar posições, o que é
 * proibido).
 *
 * As posições do contrato são **1-based inclusivas**; aqui viram fatias
 * **0-based `[inicio, fim)`** para uso direto com `String.prototype.slice`.
 *
 * Este arquivo é **TypeScript puro**: sem NestJS, Prisma, I/O, log ou estado.
 */

/** Versão do leiaute AFD suportada por este núcleo (contrato T040, §1). */
export const VERSAO_AFD_SUPORTADA = "004";

/** Sentinela do campo 1 do cabeçalho (posições 001-009). */
export const SENTINELA_CABECALHO = "000000000";

/** Sentinela do campo 1 do trailer (posições 001-009). */
export const SENTINELA_TRAILER = "999999999";

/** Fim da terminação de linha exigida pelo anexo oficial (ASCII 13 + 10). */
export const TERMINADOR_LINHA = "\r\n";

/** Comprimento fixo de cada registro em escopo (inclui todos os campos). */
export const COMPRIMENTO = {
  cabecalho: 302,
  marcacao: 50,
  trailer: 64,
} as const;

/**
 * Menor comprimento para conseguir **ler o tipo** de um registro de dados
 * (posição 010). Abaixo disso a linha é ilegível — truncamento que impede
 * interpretar o arquivo (contrato §4.2).
 */
export const COMPRIMENTO_MINIMO_TIPO = 10;

/** Cabeçalho — tipo `1` (contrato §2.1). Só o necessário à validação. */
export const CABECALHO = {
  sentinela: [0, 9],
  tipo: [9, 10],
  versao: [250, 253],
} as const;

/** Marcação REP-C — tipo `3` (contrato §2.2). Fonte de batida da V1. */
export const MARCACAO = {
  nsr: [0, 9],
  tipo: [9, 10],
  dataHora: [10, 34],
  identificador: [34, 46],
  crc: [46, 50],
} as const;

/** Trailer — tipo `9` (contrato §2.3). Encerramento e conferência. */
export const TRAILER = {
  sentinela: [0, 9],
  contagemTipo2: [9, 18],
  contagemTipo3: [18, 27],
  contagemTipo4: [27, 36],
  contagemTipo5: [36, 45],
  contagemTipo6: [45, 54],
  contagemTipo7: [54, 63],
  tipo: [63, 64],
} as const;

/** Campo de tipo de registro (posição 010-010) em qualquer registro de dados. */
export const CAMPO_TIPO = [9, 10] as const;

/** Campo de NSR (posições 001-009) nos registros de dados (tipos 2 a 7). */
export const CAMPO_NSR = [0, 9] as const;

/** Tipos de registro de dados reconhecidos entre cabeçalho e trailer. */
export const TIPOS_DADOS_RECONHECIDOS = ["2", "3", "4", "5", "6", "7"] as const;

/** Tipo do registro de marcação REP-C (única fonte de batida da V1). */
export const TIPO_MARCACAO = "3";
