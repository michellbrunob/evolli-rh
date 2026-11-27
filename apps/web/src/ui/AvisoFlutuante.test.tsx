import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvisoFlutuante } from "./AvisoFlutuante";

describe("T215 — aviso flutuante", () => {
  it("anuncia título e texto; Fechar fecha", () => {
    const onFechar = vi.fn();
    render(
      <AvisoFlutuante
        aviso={{ id: 1, titulo: "Salvo", texto: "Vale a partir de hoje." }}
        onFechar={onFechar}
      />,
    );
    const aviso = screen.getByRole("status", { name: "Salvo" });
    expect(aviso).toHaveTextContent("Vale a partir de hoje.");
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("com ação: o botão executa a ação e fecha o aviso", () => {
    const onFechar = vi.fn();
    const desfazer = vi.fn();
    render(
      <AvisoFlutuante
        aviso={{
          id: 2,
          titulo: "Folga em 2/3 no rascunho",
          acao: { rotulo: "Desfazer", onClick: desfazer },
        }}
        onFechar={onFechar}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(desfazer).toHaveBeenCalledTimes(1);
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("sem aviso, nada", () => {
    const { container } = render(
      <AvisoFlutuante aviso={null} onFechar={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
