/**
 * T216 — o estado do documento usa o status padrão do sistema: pílula de
 * fundo suave com o ponto, na variante que diz o estado.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EstadoDoDocumento } from "./PecasDosDocumentos";

describe("T216 — estado do documento no status padrão", () => {
  it.each([
    ["pendente", "Pendente", "warning"],
    ["em_verificacao", "Em verificação", "info"],
    ["aprovado", "Aprovado", "success"],
    ["reprovado", "Reprovado", "danger"],
    ["nao_enviado", "Não enviado", "danger"],
  ] as const)("%s → %s (%s)", (estado, rotulo, variante) => {
    render(<EstadoDoDocumento estado={estado} />);
    const selo = screen.getByText(rotulo).closest(".evolli-badge");
    expect(selo).toHaveClass(`evolli-badge--${variante}`);
    expect(selo?.querySelector("svg")).toBeNull();
  });

  it("aceita um rótulo no lugar do padrão (ex.: enviando)", () => {
    render(<EstadoDoDocumento estado="em_verificacao" rotulo="Enviando…" />);
    expect(screen.getByText("Enviando…").closest(".evolli-badge")).toHaveClass(
      "evolli-badge--info",
    );
  });
});
