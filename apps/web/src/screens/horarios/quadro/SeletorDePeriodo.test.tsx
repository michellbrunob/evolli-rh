import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../../../ui";
import {
  SeletorDePeriodo,
  type TamanhoDoPeriodo,
  diasDoCalendario,
  deslocarPeriodo,
  periodoQueContem,
  rotuloDoPeriodo,
} from "./SeletorDePeriodo";

function Seletor({
  tamanho = "semana",
  onFecharJanela = () => {},
}: {
  tamanho?: TamanhoDoPeriodo;
  onFecharJanela?: () => void;
}) {
  const [ancora, setAncora] = useState("2026-11-25");
  return (
    <Dialog aberto titulo="Janela" onFechar={onFecharJanela}>
      <SeletorDePeriodo
        tamanho={tamanho}
        ancora={ancora}
        semanaComeca={1}
        onEscolher={setAncora}
        hoje="2026-11-25"
      />
    </Dialog>
  );
}

const abrir = (rotulo: string) =>
  fireEvent.click(
    screen.getByRole("button", {
      name: `Período: ${rotulo}. Abrir calendário`,
    }),
  );

describe("T215 — seletor de período", () => {
  it("funções: período, deslocar, rótulo e as 6 semanas do mês", () => {
    expect(periodoQueContem("dia", "2026-11-25", 1)).toEqual({
      inicio: "2026-11-25",
      fim: "2026-11-25",
    });
    expect(periodoQueContem("semana", "2026-11-25", 7)).toEqual({
      inicio: "2026-11-22",
      fim: "2026-11-28",
    });
    expect(deslocarPeriodo("dia", "2026-11-30", 1, 1)).toBe("2026-12-01");
    expect(deslocarPeriodo("mes", "2026-11-25", -1, 1)).toBe("2026-10-01");
    expect(rotuloDoPeriodo("dia", "2026-11-25", 1)).toBe("25/11/2026");
    expect(rotuloDoPeriodo("mes", "2026-11-25", 1)).toBe("Novembro de 2026");
    const dias = diasDoCalendario("2026-11-25", 1);
    expect(dias).toHaveLength(42);
    expect(dias[0]).toBe("2026-10-26");
    expect(diasDoCalendario("2026-11-25", 7)[0]).toBe("2026-11-01");
  });

  it("abre o calendário com a semana marcada; um dia escolhe a semana dele e fecha", () => {
    render(<Seletor />);
    abrir("23 a 29 de novembro de 2026");
    const calendario = screen.getByRole("dialog", {
      name: "Escolher o período",
    });
    expect(calendario).toHaveTextContent("Novembro de 2026");
    const marcados = screen
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("aria-selected") === "true");
    expect(marcados.map((c) => c.textContent)).toEqual([
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
    ]);
    expect(
      screen.getByRole("button", { name: "25/11/2026, hoje" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "03/12/2026" }));
    expect(
      screen.queryByRole("dialog", { name: "Escolher o período" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Período: 30 de novembro a 6 de dezembro de 2026. Abrir calendário",
      }),
    ).toHaveFocus();
  });

  it("anterior e próximo período; mês anterior e próximo; setas", () => {
    render(<Seletor />);
    abrir("23 a 29 de novembro de 2026");
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }));
    expect(
      screen.getByRole("dialog", { name: "Escolher o período" }),
    ).toHaveTextContent("30 de novembro a 6 de dezembro de 2026");
    fireEvent.click(screen.getByRole("button", { name: "Período anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(
      screen.getByRole("dialog", { name: "Escolher o período" }),
    ).toHaveTextContent("Dezembro de 2026");
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    // O mês muda o dia em destaque (1º do mês); setas: uma semana e um dia.
    const calendario = screen.getByRole("dialog", {
      name: "Escolher o período",
    });
    fireEvent.keyDown(calendario, { key: "ArrowDown" });
    fireEvent.keyDown(calendario, { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: "07/11/2026" })).toHaveFocus();
    fireEvent.keyDown(calendario, { key: "ArrowRight" });
    fireEvent.keyDown(calendario, { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: "01/11/2026" })).toHaveFocus();
  });

  it("Esc fecha só o calendário, não a janela; clique fora também fecha", () => {
    const onFecharJanela = vi.fn();
    render(<Seletor tamanho="mes" onFecharJanela={onFecharJanela} />);
    abrir("Novembro de 2026");
    fireEvent.keyDown(
      screen.getByRole("button", { name: "25/11/2026, hoje" }),
      {
        key: "Escape",
      },
    );
    expect(
      screen.queryByRole("dialog", { name: "Escolher o período" }),
    ).toBeNull();
    expect(onFecharJanela).not.toHaveBeenCalled();
    abrir("Novembro de 2026");
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole("dialog", { name: "Escolher o período" }),
    ).toBeNull();
  });
});
