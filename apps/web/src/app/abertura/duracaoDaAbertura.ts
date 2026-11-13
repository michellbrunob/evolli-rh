/**
 * Duração mínima da tela de abertura (T209).
 *
 * Não é espera artificial: a abertura some assim que o acesso está pronto. A
 * duração mínima só evita que ela pisque — aparecer e sumir em poucos
 * milissegundos. Vale contada desde que a abertura apareceu; se o acesso
 * demorou mais que isso, nada é acrescentado. Login recusado, sessão expirada
 * e falha ao carregar o acesso nunca esperam por ela.
 */
export const DURACAO_MINIMA_DA_ABERTURA_MS = 300;

let duracaoMinimaMs = DURACAO_MINIMA_DA_ABERTURA_MS;

export function duracaoMinimaDaAbertura(): number {
  return duracaoMinimaMs;
}

/**
 * Só para o ambiente de teste: as suítes do shell rodam sem a duração mínima
 * (`src/test/setup.ts`); as da abertura a religam para medi-la.
 */
export function definirDuracaoMinimaDaAbertura(ms: number): void {
  duracaoMinimaMs = ms;
}
