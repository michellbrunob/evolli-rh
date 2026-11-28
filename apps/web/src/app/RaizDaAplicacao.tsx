/**
 * T216 — a raiz montada por `main.tsx`. Decide, pelo endereço, entre a página
 * pública (sem sessão) e o portão de sessão de sempre (`AutenticacaoApp`).
 *
 * Acompanha a troca do hash: colar outro link de pesquisa, ou sair dela para
 * o sistema, troca a árvore inteira — a página pública e o shell nunca
 * convivem.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { tokenDaPesquisaPublica } from "./rotaPublica";

// T216 — cada lado num pacote próprio: o link público baixa só a página de
// resposta (leve), sem o shell autenticado e as telas do sistema.
const AutenticacaoApp = lazy(() =>
  import("./AutenticacaoApp").then((m) => ({ default: m.AutenticacaoApp })),
);
const ResponderPesquisa = lazy(() =>
  import("../screens/publico/ResponderPesquisa").then((m) => ({
    default: m.ResponderPesquisa,
  })),
);

export function RaizDaAplicacao() {
  const [token, setToken] = useState(() =>
    tokenDaPesquisaPublica(window.location.hash),
  );

  useEffect(() => {
    const aoMudar = () =>
      setToken(tokenDaPesquisaPublica(window.location.hash));
    // Colar o link na barra troca só o fragmento: o navegador avisa com
    // `popstate` e `hashchange` (a ordem varia); os dois valem.
    window.addEventListener("popstate", aoMudar);
    window.addEventListener("hashchange", aoMudar);
    return () => {
      window.removeEventListener("popstate", aoMudar);
      window.removeEventListener("hashchange", aoMudar);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {token !== null ? (
        <ResponderPesquisa key={token} token={token} />
      ) : (
        <AutenticacaoApp />
      )}
    </Suspense>
  );
}
