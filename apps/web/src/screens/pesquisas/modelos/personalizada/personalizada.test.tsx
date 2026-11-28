/**
 * T216 — modelos prontos da Personalizada: as seções de Benefícios,
 * Treinamento e Desligamento, o tempo de cada card e a gaveta do modelo
 * (cabeçalho com perguntas, tempo e formato; "Quando usar"; "Seção N ·
 * título"; o tipo de cada pergunta, "Mostra outra pergunta" e "Opcional";
 * "Fechar" e "Usar este modelo").
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { servicoFalso } from "../../dadosDeTeste";
import { EntradaPersonalizada } from "../../EntradaPersonalizada";
import { SUBMODELOS_PERSONALIZADA } from "./catalogo";

const doId = (id: string) => SUBMODELOS_PERSONALIZADA.find((m) => m.id === id)!;

function montar() {
  const onComecar = vi.fn();
  render(
    <EntradaPersonalizada
      servico={servicoFalso()}
      onVoltar={vi.fn()}
      onComecar={onComecar}
    />,
  );
  return { onComecar };
}

describe("Personalizada — modelos prontos", () => {
  it("Benefícios, Treinamento e Desligamento em 2 seções com título", () => {
    const secoes = (id: string) =>
      doId(id).secoes.map((s) => [s.titulo, s.perguntas.length]);
    expect(secoes("beneficios")).toEqual([
      ["O que você usa", 3],
      ["O que mudaria", 3],
    ]);
    expect(secoes("treinamento")).toEqual([
      ["O treinamento", 4],
      ["Para melhorar", 3],
    ]);
    expect(secoes("desligamento")).toEqual([
      ["Sua saída", 3],
      ["Sua experiência", 5],
    ]);
  });

  it("os tempos dos cards: 2, 3, 2, 1, 2 e 2 minutos", () => {
    montar();
    const tempos = SUBMODELOS_PERSONALIZADA.map((m) => {
      const card = screen.getByRole("article", { name: m.nome });
      return /· (\d+) min/.exec(card.textContent ?? "")?.[1];
    });
    expect(tempos).toEqual(["2", "3", "2", "1", "2", "2"]);
  });

  it("o card mostra o formato do modelo", () => {
    montar();
    expect(
      screen.getByRole("article", { name: "Experiência · 90 dias" }),
    ).toHaveTextContent("Gestor avalia o time");
    expect(
      screen.getByRole("article", { name: "Avaliação 180°" }),
    ).toHaveTextContent("Gestor e autoavaliação (180°)");
    expect(
      screen.getByRole("article", { name: "Entrevista de desligamento" }),
    ).toHaveTextContent("Cada pessoa responde");
  });

  it("a gaveta do modelo: cabeçalho, seções, tipos, condição e opcional", () => {
    const { onComecar } = montar();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver perguntas de Entrevista de desligamento",
      }),
    );
    const gaveta = screen.getByRole("dialog", {
      name: "Entrevista de desligamento",
    });
    expect(gaveta).toHaveTextContent(
      "8 perguntas · 2 min · Cada pessoa responde",
    );
    expect(gaveta).toHaveTextContent(doId("desligamento").descricao);
    expect(gaveta).toHaveTextContent("Quando usar: na última semana");
    const saida = within(gaveta).getByRole("region", {
      name: "Seção 1 · Sua saída",
    });
    const itens = within(saida).getAllByRole("listitem");
    expect(itens).toHaveLength(3);
    expect(itens[0]).toHaveTextContent("Escolha única");
    // Sem `obrigatoria` no modelo, a pergunta nasce obrigatória.
    expect(itens[0]).not.toHaveTextContent("Opcional");
    expect(itens[1]).toHaveTextContent("Sim ou não");
    expect(itens[1]).toHaveTextContent("Mostra outra pergunta");
    expect(itens[2]).not.toHaveTextContent("Mostra outra pergunta");
    expect(itens[2]).toHaveTextContent("Parágrafo");
    const experiencia = within(gaveta).getByRole("region", {
      name: "Seção 2 · Sua experiência",
    });
    const outros = within(experiencia).getAllByRole("listitem");
    expect(outros[0]).toHaveTextContent("Concordância 1 a 5");
    expect(outros[3]).toHaveTextContent("Nota 0 a 10");
    expect(outros[4]).toHaveTextContent("Opcional");
    expect(outros[0]).not.toHaveTextContent("Opcional");
    expect(gaveta).toHaveTextContent(
      "Tudo pode ser editado depois de usar o modelo.",
    );
    expect(
      within(gaveta).queryByRole("button", { name: "Sobre o modelo" }),
    ).toBeNull();
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Usar este modelo" }),
    );
    expect(onComecar).toHaveBeenCalledWith({ roteiro: "desligamento" });
  });

  it("os tipos de pergunta na gaveta (estrelas, escala, curta, múltipla)", () => {
    montar();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver perguntas de Avaliação de treinamento",
      }),
    );
    const gaveta = screen.getByRole("dialog", {
      name: "Avaliação de treinamento",
    });
    expect(gaveta).toHaveTextContent("7 perguntas · 2 min");
    expect(gaveta).toHaveTextContent("Estrelas 1 a 5");
    expect(gaveta).toHaveTextContent("Escala personalizada");
    expect(gaveta).toHaveTextContent("Resposta curta");
    const fechar = within(gaveta).getAllByRole("button", { name: "Fechar" });
    fireEvent.click(fechar[fechar.length - 1]!);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver perguntas de Satisfação com benefícios",
      }),
    );
    const beneficios = screen.getByRole("dialog", {
      name: "Satisfação com benefícios",
    });
    expect(beneficios).toHaveTextContent("6 perguntas · 1 min");
    expect(beneficios).toHaveTextContent("Múltipla escolha");
    expect(
      within(beneficios).getByRole("region", {
        name: "Seção 2 · O que mudaria",
      }),
    ).toBeInTheDocument();
  });
});
