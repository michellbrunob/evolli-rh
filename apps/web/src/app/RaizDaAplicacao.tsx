/**
 * T216 — a raiz montada por `main.tsx`. Decide, pelo endereço, entre a página
 * pública (sem sessão) e o portão de sessão de sempre (`AutenticacaoApp`).
 *
 * Acompanha a troca do hash: colar outro link de pesquisa, ou sair dela para
 * o sistema, troca a árvore inteira — a página pública e o shell nunca
 * convivem.
 */
import { useEffect, useState } from "react";
import { AutenticacaoApp } from "./AutenticacaoApp";
import { tokenDaPesquisaPublica } from "./rotaPublica";
import { ResponderPesquisa } from "../screens/publico/ResponderPesquisa";

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

  if (token !== null) return <ResponderPesquisa key={token} token={token} />;
  return <AutenticacaoApp />;
}
