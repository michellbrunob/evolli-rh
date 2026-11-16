/**
 * T209 — armazenamento de objetos da foto do colaborador (ADR 0020).
 *
 * Uma porta pequena — gravar, ler e apagar UM objeto pela chave — para o
 * serviço não conhecer o provedor. Em produção, o Cloudflare R2 privado
 * (`ArmazenamentoR2`); nos testes, a versão em memória com falhas
 * injetáveis (`ArmazenamentoEmMemoria`). Nenhum teste fala com o bucket.
 */
export const ARMAZENAMENTO_DE_FOTOS = Symbol("ARMAZENAMENTO_DE_FOTOS");

export interface ArmazenamentoDeObjetos {
  gravar(chave: string, corpo: Buffer, tipo: string): Promise<void>;
  /** `null` quando o objeto não existe. */
  ler(chave: string): Promise<Buffer | null>;
  /** Idempotente: apagar o que não existe não é erro. */
  apagar(chave: string): Promise<void>;
}

/** O armazenamento não respondeu, recusou ou não está configurado. */
export class ArmazenamentoIndisponivel extends Error {
  constructor(motivo = "armazenamento_indisponivel") {
    super(motivo);
    this.name = "ArmazenamentoIndisponivel";
  }
}

export type OperacaoDoArmazenamento = "gravar" | "ler" | "apagar";

/** Para os testes: objetos em memória e falhas sob encomenda. */
export class ArmazenamentoEmMemoria implements ArmazenamentoDeObjetos {
  readonly objetos = new Map<string, { corpo: Buffer; tipo: string }>();
  /** Devolva `true` para a operação falhar naquela chave. */
  falhar: (operacao: OperacaoDoArmazenamento, chave: string) => boolean = () =>
    false;

  async gravar(chave: string, corpo: Buffer, tipo: string): Promise<void> {
    if (this.falhar("gravar", chave)) throw new ArmazenamentoIndisponivel();
    this.objetos.set(chave, { corpo: Buffer.from(corpo), tipo });
  }

  async ler(chave: string): Promise<Buffer | null> {
    if (this.falhar("ler", chave)) throw new ArmazenamentoIndisponivel();
    return this.objetos.get(chave)?.corpo ?? null;
  }

  async apagar(chave: string): Promise<void> {
    if (this.falhar("apagar", chave)) throw new ArmazenamentoIndisponivel();
    this.objetos.delete(chave);
  }
}
