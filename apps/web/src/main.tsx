import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AutenticacaoApp } from "./app/AutenticacaoApp";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Elemento #root não encontrado.");
}

createRoot(container).render(
  <StrictMode>
    <AutenticacaoApp />
  </StrictMode>,
);
