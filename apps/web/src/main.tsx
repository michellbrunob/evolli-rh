import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AutenticacaoApp } from "./app/AutenticacaoApp";
// T209 — fundação de interface (Tailwind sem preflight, prefixo `ev`).
import "./ui/estilos.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Elemento #root não encontrado.");
}

createRoot(container).render(
  <StrictMode>
    <AutenticacaoApp />
  </StrictMode>,
);
