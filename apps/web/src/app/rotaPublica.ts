/**
 * T216 — rotas públicas: abertas por link, sem login e FORA do shell
 * autenticado. Hoje só uma: `#/p/<token>` (responder pesquisa).
 *
 * A decisão acontece antes do portão de sessão (`AutenticacaoApp`): com rota
 * pública, o portão nem monta — nenhuma verificação de sessão, nenhum
 * `GET /v1/auth/csrf`, nenhuma tela de login.
 */

/** `#/p/<token>` (barra final opcional) → o token; qualquer outra → `null`. */
export function tokenDaPesquisaPublica(hash: string): string | null {
  const casado = /^#\/p\/([^/?#]+)\/?$/.exec(hash);
  if (!casado) return null;
  try {
    const token = decodeURIComponent(casado[1]!).trim();
    return token === "" ? null : token;
  } catch {
    return null;
  }
}
