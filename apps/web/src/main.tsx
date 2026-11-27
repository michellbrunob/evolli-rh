import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AutenticacaoApp } from "./app/AutenticacaoApp";
// T209 — fundação de interface (Tailwind sem preflight, prefixo `ev`).
import "./ui/estilos.css";
import "./ui/movimento.css";
import { iniciarMovimentoDaInterface } from "./ui/movimentoDaInterface";
// T209 — fonte do ecossistema, do pacote local (sem Google Fonts); só os
// pesos usados.
import "@fontsource/parkinsans/latin-400.css";
import "@fontsource/parkinsans/latin-500.css";
import "@fontsource/parkinsans/latin-600.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Elemento #root não encontrado.");
}

createRoot(container).render(
  <StrictMode>
    <AutenticacaoApp />
  </StrictMode>,
);

// T215 — o sublinhado de todas as abas desliza; o conteúdo novo (aba,
// seção, etapa, formulário, página) entra suave, como na aba Dados.
iniciarMovimentoDaInterface();
