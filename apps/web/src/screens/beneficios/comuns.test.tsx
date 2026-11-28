/**
 * T216 — a pessoa na tabela de benefícios: o alerta de situação (ex.:
 * "Desligado") é o status padrão do sistema, não texto colorido solto.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PessoaNaLinha } from "./comuns";

describe("T216 — PessoaNaLinha", () => {
  it("o alerta aparece no status padrão de perigo, depois do detalhe", () => {
    render(
      <PessoaNaLinha nome="Ana Teste" detalhe="Analista" alerta="Desligado" />,
    );
    const selo = screen.getByText("Desligado").closest(".evolli-badge");
    expect(selo).toHaveClass("evolli-badge--danger");
    expect(selo?.parentElement).toHaveTextContent("Analista · Desligado");
  });

  it("sem alerta, nenhum selo", () => {
    const { container } = render(
      <PessoaNaLinha nome="Ana Teste" detalhe="Analista" />,
    );
    expect(container.querySelector(".evolli-badge")).toBeNull();
  });
});
