/**
 * T216 — rotas públicas: abertas por link, sem login e FORA do shell
 * autenticado. Hoje só uma: `#/p/<token>` (responder pesquisa).
 *
 * A decisão acontece antes do portão de sessão (`AutenticacaoApp`): com rota
 * pública, o portão nem monta — nenhuma verificação de sessão, nenhum
 * `GET /v1/auth/csrf`, nenhuma tela de login.
 */

/**
 * `#/p/<token>` (barra final opcional; T216: `?rodada=N` do convite do
 * onboarding) → o token; qualquer outra → `null`.
 */
const ROTA = /^#\/p\/([^/?#]+)\/?(?:\?rodada=(\d{1,2}))?$/;

/** T216 — a rodada do convite do onboarding (`?rodada=30`), ou `null`. */
export function rodadaDaPesquisaPublica(hash: string): number | null {
  const casado = ROTA.exec(hash);
  return casado?.[2] ? Number(casado[2]) : null;
}

export function tokenDaPesquisaPublica(hash: string): string | null {
  const casado = ROTA.exec(hash);
  if (!casado) return null;
  try {
    const token = decodeURIComponent(casado[1]!).trim();
    return token === "" ? null : token;
  } catch {
    return null;
  }
}
