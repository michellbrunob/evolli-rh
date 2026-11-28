/**
 * T216 — Pulso e Clima na página pública: abertura de cada dimensão (trilha,
 * selo, o que avalia), o selo e "Pergunta N de 24" contando só as
 * perguntas, a tela "Comentário (opcional)" e o comentário do LNPS e do
 * eNPS na mesma tela da nota, com o contador.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ResponderPesquisa,
  montarPreviaPublica,
} from "../../../publico/ResponderPesquisa";
import { perguntasEmOrdem } from "../../../publico/regrasDaPesquisa";
import { secoesDoModelo } from "../../modelosDePesquisa";
import { PULSO_CLIMA } from "./catalogo";
import { telasDoPulsoClima } from "./telasPublicas";

function secoesPublicas() {
  return montarPreviaPublica({
    empresa: "Empresa Sintética",
    nome: "Pulso e Clima",
    boasVindas: null,
    identificacao: "anonima",
    modelo: "pulso_clima",
    secoes: secoesDoModelo(PULSO_CLIMA),
  });
}

describe("T216 — Pulso e Clima: telas da página pública", () => {
  const previa = secoesPublicas();
  const secoes = previa.secoes;
  const todas = new Set(secoes.flatMap((s) => s.perguntas.map((p) => p.id)));
  const telas = telasDoPulsoClima(perguntasEmOrdem(secoes, todas));

  it("10 aberturas, 24 perguntas contadas e 8 comentários em tela própria", () => {
    expect(telas.filter((t) => t.abertura)).toHaveLength(10);
    const contadas = telas.filter((t) => t.contagem);
    expect(contadas).toHaveLength(24);
    expect(contadas.map((t) => t.contagem!.posicao)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
    expect(contadas.every((t) => t.contagem!.total === 24)).toBe(true);
    expect(
      telas.filter((t) => t.sobretitulo === "Comentário (opcional)"),
    ).toHaveLength(8);
    // 10 aberturas + 24 perguntas + 8 comentários (os 2 da nota vão junto).
    expect(telas).toHaveLength(42);
  });

  it("LNPS e eNPS: o comentário fica na tela da nota", () => {
    const daNota = telas.filter((t) => t.comentarioJunto);
    expect(daNota.map((t) => t.perguntas[0]!.pergunta.chave)).toEqual([
      "pc_lnps_01",
      "pc_enps_01",
    ]);
    expect(daNota.map((t) => t.comentarioJunto!.pergunta.chave)).toEqual([
      "__comentario_lnps__",
      "__comentario_enps__",
    ]);
  });

  it("abertura com a dimensão atual e a próxima; a barra aponta a próxima pergunta", () => {
    expect(telas[0]!.abertura).toEqual({
      titulo: "Alinhamento e Estratégia",
      texto: PULSO_CLIMA.secoes[0]!.descricao,
      proxima: "Liderança",
    });
    expect(telas[0]!.progresso).toEqual({ posicao: 1, total: 24 });
    const ultima = telas.filter((t) => t.abertura).at(-1)!;
    expect(ultima.abertura!.proxima).toBeNull();
    // A abertura da Liderança: 3 perguntas já respondidas, a próxima é a 4ª.
    const lideranca = telas.find((t) => t.abertura?.titulo === "Liderança")!;
    expect(lideranca.progresso).toEqual({ posicao: 4, total: 24 });
  });
});

describe("T216 — Pulso e Clima: resposta pelo link (prévia)", () => {
  it("abertura, selo, contagem só das perguntas, comentário e a nota com a caixa", () => {
    const espiao = vi.spyOn(globalThis, "fetch");
    render(<ResponderPesquisa previa={secoesPublicas()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Começar a pré-visualização" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    // Abertura da 1ª dimensão.
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Alinhamento e Estratégia",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Dimensões" })).toHaveTextContent(
      "Alinhamento e EstratégiaPróxima: Liderança",
    );
    expect(screen.queryByText(/Pergunta 1 de/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    // As 3 afirmações da dimensão, com o selo e a contagem de 24.
    for (let i = 1; i <= 3; i++) {
      const contador = screen.getByText(`Pergunta ${i} de 24`, {
        exact: false,
      });
      expect(contador).toHaveTextContent(
        `Alinhamento e Estratégia Pergunta ${i} de 24`,
      );
      const radios = within(screen.getByRole("radiogroup")).getAllByRole(
        "radio",
      );
      expect(radios).toHaveLength(5);
      fireEvent.click(radios[3]!);
      fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    }
    // O comentário da dimensão, em tela própria e opcional.
    expect(screen.getByText("Comentário (opcional)")).toBeInTheDocument();
    expect(screen.queryByText(/Pergunta \d+ de 24/)).toBeNull();
    expect(screen.getByRole("button", { name: /Próximo/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Liderança" }),
    ).toBeInTheDocument();
    // Até o LNPS: 7 dimensões restantes (abertura, afirmações, comentário).
    for (let guarda = 0; guarda < 60; guarda++) {
      if (screen.queryByRole("heading", { level: 1, name: /LNPS/ })) break;
      const grupo = screen.queryByRole("radiogroup");
      if (grupo) fireEvent.click(within(grupo).getAllByRole("radio")[4]!);
      fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    expect(
      screen.getByText("Pergunta 23 de 24", { exact: false }),
    ).toBeInTheDocument();
    const notas = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    expect(notas).toHaveLength(11);
    fireEvent.click(notas[9]!);
    // O comentário da nota na mesma tela, com o contador de 2000.
    const caixa = screen.getByRole("textbox", { name: /comentar essa nota/ });
    expect(screen.getByText("0/2000")).toBeInTheDocument();
    fireEvent.change(caixa, { target: { value: "Líder presente" } });
    expect(screen.getByText("14/2000")).toBeInTheDocument();
    expect(caixa).toHaveAttribute("maxLength", "2000");
    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    // Abertura do eNPS e a última pergunta.
    expect(
      screen.getByRole("heading", { level: 1, name: /eNPS/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    expect(
      screen.getByText("Pergunta 24 de 24", { exact: false }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("radiogroup")).getAllByRole("radio")[10]!,
    );
    fireEvent.click(screen.getByRole("button", { name: /Enviar respostas/ }));
    expect(
      screen.getByRole("heading", {
        name: "Agradecemos a sua participação!",
      }),
    ).toBeInTheDocument();
    expect(espiao).not.toHaveBeenCalled();
  });
});
