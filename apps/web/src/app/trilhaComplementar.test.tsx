/**
 * T216 — a trilha complementar aceita um nível (o nome na ficha) ou vários
 * (pesquisa › resposta): os intermediários levam a eles; o último é a
 * página atual. A barra superior monta a trilha inteira.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BarraSuperior } from "./BarraSuperior";
import {
  ProvedorDeTrilhaComplementar,
  useTrilhaComplementar,
  type NivelDaTrilha,
} from "./trilhaComplementar";

function Pagina({
  niveis,
  onVoltar,
}: {
  readonly niveis: string | readonly NivelDaTrilha[] | null | undefined;
  readonly onVoltar: () => void;
}) {
  useTrilhaComplementar(niveis, onVoltar);
  return null;
}

function montar(
  niveis: string | readonly NivelDaTrilha[] | null | undefined,
  onVoltar = vi.fn(),
) {
  render(
    <ProvedorDeTrilhaComplementar>
      <BarraSuperior
        inerte={{}}
        modoGaveta={false}
        gavetaAberta={false}
        botaoMenuRef={{ current: null }}
        onAlternarGaveta={vi.fn()}
        iconeMenu={null}
        trilha={[{ rotulo: "Pessoas" }, { rotulo: "Pesquisas" }]}
        onNavegar={vi.fn()}
        conta={null}
        mfaDisponivel={false}
        onMeuPerfil={vi.fn()}
        onSeguranca={vi.fn()}
        onSessoesAtivas={vi.fn()}
        onSair={vi.fn()}
      />
      <Pagina niveis={niveis} onVoltar={onVoltar} />
    </ProvedorDeTrilhaComplementar>,
  );
  return within(screen.getByRole("navigation", { name: "Trilha" }));
}

describe("trilha complementar com N níveis", () => {
  it("um nível (texto): o pai vira a volta e o nível é a página atual", () => {
    const onVoltar = vi.fn();
    const trilha = montar("Resultados", onVoltar);
    fireEvent.click(trilha.getByRole("button", { name: "Pesquisas" }));
    expect(onVoltar).toHaveBeenCalled();
    expect(trilha.getByText("Resultados")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("vários níveis: os intermediários levam a eles; o último é a página atual", () => {
    const onVoltar = vi.fn();
    const abrirPesquisa = vi.fn();
    const trilha = montar(
      [
        { rotulo: "Pulso de novembro", onSelecionar: abrirPesquisa },
        { rotulo: "Resposta anônima #3" },
      ],
      onVoltar,
    );
    expect(trilha.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["Pessoas", "Pesquisas", "Pulso de novembro", "Resposta anônima #3"],
    );
    fireEvent.click(trilha.getByRole("button", { name: "Pulso de novembro" }));
    expect(abrirPesquisa).toHaveBeenCalled();
    fireEvent.click(trilha.getByRole("button", { name: "Pesquisas" }));
    expect(onVoltar).toHaveBeenCalled();
    expect(trilha.getByText("Resposta anônima #3")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("`undefined` não mexe no que outra parte da página declarou", () => {
    const trilha = montar(undefined);
    expect(trilha.getAllByRole("listitem")).toHaveLength(2);
  });
});
