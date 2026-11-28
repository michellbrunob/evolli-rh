/**
 * T216 — o que este navegador lembra de cada rascunho: a etapa em que a
 * pessoa parou e quando foi salvo (para "Parou na etapa 4 de 5 · salvo em
 * …"). Conveniência local: se o armazenamento falhar, nada quebra.
 */
const CHAVE = "evolli-pesquisas-rascunhos";

export interface MemoriaDoRascunho {
  readonly etapa: number;
  readonly totalDeEtapas: number;
  /** Instante ISO da última gravação. */
  readonly salvoEm: string;
}

function ler(): Record<string, MemoriaDoRascunho> {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto
      ? (JSON.parse(bruto) as Record<string, MemoriaDoRascunho>)
      : {};
  } catch {
    return {};
  }
}

export function lembrarRascunho(id: string, memoria: MemoriaDoRascunho): void {
  try {
    window.localStorage.setItem(
      CHAVE,
      JSON.stringify({ ...ler(), [id]: memoria }),
    );
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

export function memoriaDoRascunho(id: string): MemoriaDoRascunho | null {
  return ler()[id] ?? null;
}

export function esquecerRascunho(id: string): void {
  try {
    const todas = ler();
    delete todas[id];
    window.localStorage.setItem(CHAVE, JSON.stringify(todas));
  } catch {
    /* nada a fazer */
  }
}
