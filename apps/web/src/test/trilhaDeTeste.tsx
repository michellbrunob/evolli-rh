/**
 * T209 — a trilha é a da barra superior: a ficha declara o último nível
 * (`useTrilhaComplementar`). Em teste de tela montada sem o shell, esta é a
 * barra em miniatura — o pai clicável ("Colaboradores") e o nível atual.
 */
import type { ReactElement, ReactNode } from "react";
import { screen, within } from "@testing-library/react";
import {
  ProvedorDeTrilhaComplementar,
  useComplementoDaTrilha,
} from "../app/trilhaComplementar";

export function TrilhaDeTeste() {
  const complemento = useComplementoDaTrilha();
  if (!complemento) return null;
  return (
    <nav aria-label="Trilha">
      <button type="button" onClick={complemento.onVoltar}>
        Colaboradores
      </button>
      <span aria-current="page">{complemento.rotulo}</span>
    </nav>
  );
}

/** A tela com o provedor da trilha e a barra em miniatura. */
export function comTrilha(ui: ReactNode): ReactElement {
  return (
    <ProvedorDeTrilhaComplementar>
      {ui}
      <TrilhaDeTeste />
    </ProvedorDeTrilhaComplementar>
  );
}

/** O "Colaboradores" da trilha (a volta da ficha para a listagem). */
export function voltarPelaTrilha(): HTMLElement {
  return within(screen.getByRole("navigation", { name: "Trilha" })).getByRole(
    "button",
    { name: "Colaboradores" },
  );
}
