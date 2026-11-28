/**
 * T216 — 4ª revisão: os assistentes limitam o nome a 120 caracteres e a
 * descrição (boas-vindas) a 1000, os mesmos limites da API. Dados
 * sintéticos.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistenteDePesquisa } from "./AssistenteDePesquisa";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import { servicoFalso } from "./dadosDeTeste";
import { LIMITES } from "./textosDasPesquisas";

describe("R4-B-11 — limites de nome e descrição nos assistentes", () => {
  it("os limites são os da API: 120 e 1000", () => {
    expect(LIMITES.nome).toBe(120);
    expect(LIMITES.boasVindas).toBe(1000);
  });

  it("assistente do modelo (Clima): nome até 120 e descrição até 1000", () => {
    render(
      <AssistenteDoModelo
        servico={servicoFalso()}
        modeloId="clima"
        hoje="2026-11-28"
        agora={() => new Date(2026, 10, 28, 9, 5)}
        atrasoDoRascunho={0}
        onCancelar={vi.fn()}
        onConcluir={vi.fn()}
        onVerResultados={vi.fn()}
        onEditarGerada={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Nome da pesquisa")).toHaveAttribute(
      "maxLength",
      "120",
    );
    expect(screen.getByLabelText(/^Descrição/)).toHaveAttribute(
      "maxLength",
      "1000",
    );
  });

  it("assistente da personalizada: nome até 120 e boas-vindas até 1000", () => {
    render(
      <AssistenteDePesquisa
        servico={servicoFalso()}
        modelo="personalizada"
        hoje="2026-11-28"
        onSair={vi.fn()}
        onVerResultados={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Nome")).toHaveAttribute("maxLength", "120");
    expect(screen.getByLabelText("Mensagem de boas-vindas")).toHaveAttribute(
      "maxLength",
      "1000",
    );
  });
});
