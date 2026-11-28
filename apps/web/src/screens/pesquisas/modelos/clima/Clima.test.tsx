/**
 * T216 — Pesquisa de Clima: faixas próprias do índice, perguntas
 * editáveis no assistente (abertas obrigatórias), Visão geral, Respostas
 * (índice e departamento), resultado individual, Análises, a planilha
 * (Resumo, Dimensões, Ranking, Respostas individuais) e o PDF próprio.
 * Caso de referência: 3 respostas (todas 5; todas 3; 1–5 alternando) →
 * índice 47%, dimensões 44/47/47/44/50.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  RespostaResumo,
  ResultadoClima,
  ResultadoIndividualClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import {
  DETALHE,
  RESULTADOS,
  RESPOSTA_DETALHE,
  RESUMO,
  lista,
  servicoFalso,
} from "../../dadosDeTeste";
import { montarRelatorio } from "../../dadosDoRelatorio";
import { estadoDoModelo, perguntasEmOrdem } from "../../estadoDaPesquisa";
import { GarantirAvisos } from "../../avisos";
import { modeloDaGaleria } from "../../modelosDePesquisa";
import {
  analisesDoModelo,
  contagemIndividualDoModelo,
  listaDeRespostasDoModelo,
  visaoGeralDoModelo,
  visaoIndividualDoModelo,
} from "../resultados";
import {
  DIMENSOES_CLIMA,
  chaveNova,
  dimensaoDaChave,
  nomeDaPesquisaDeClima,
  temTelasDoClima,
} from "./catalogo";
import { faixaDoClima } from "./faixas";
import {
  PerguntasDoClima,
  acrescentarNoClima,
  resumoDasPerguntasDoClima,
} from "./PerguntasDoClima";
import { abasDaPlanilhaClima, rankingDoClima } from "./planilhaClima";
import { conclusoesDoClima, DocumentoClima } from "./RelatorioClima";
import {
  departamentoDaResposta,
  diferencaDoTime,
  diferencasDoTime,
} from "./RespostasClima";

const DIMS = [
  ["credibilidade", "Credibilidade", 44, "critica"],
  ["respeito", "Respeito", 47, "critica"],
  ["imparcialidade", "Imparcialidade", 47, "critica"],
  ["orgulho", "Orgulho", 44, "critica"],
  ["camaradagem", "Camaradagem", 50, "atencao"],
] as const;

function detalheDoClima(extra: Partial<PesquisaDetalhe> = {}): PesquisaDetalhe {
  return {
    ...DETALHE,
    modelo: "clima",
    identificacao: "anonima",
    secoes: [...estadoDoModelo("clima").secoes],
    ...extra,
  };
}

/** O resultado do caso de referência, sobre as perguntas do detalhe. */
function resultadoReal(d: PesquisaDetalhe): ResultadoClima {
  const afirmacoes = perguntasEmOrdem(d.secoes)
    .filter((p) => p.tipo === "concordancia")
    .map((p, i) => {
      const n = (i % 5) + 1;
      return {
        chave: p.chave!,
        perguntaId: p.id,
        dimensao: dimensaoDaChave(p.chave)!,
        subdimensao: null,
        respostas: 3,
        media: Math.round(((5 + 3 + n) / 3) * 100) / 100,
        score: null,
        favoravel: n >= 4 ? 67 : 33,
        neutro: n === 3 ? 67 : 33,
        desfavoravel: n <= 2 ? 33 : 0,
      };
    });
  return {
    modelo: "clima",
    favoravel: 47,
    neutro: 40,
    desfavoravel: 13,
    notas: { favoraveis: 84, neutras: 72, desfavoraveis: 24 },
    score: 63,
    faixa: "critica",
    dimensoes: DIMS.map(([chave, rotulo, favoravel, faixa]) => ({
      chave,
      rotulo,
      afirmacoes: 12,
      respostas: 36,
      score: 60,
      faixa,
      favoravel,
      neutro: 40,
      desfavoravel: 100 - favoravel - 40,
      comentarios: 0,
    })),
    afirmacoes,
  };
}

function geralDo(d: PesquisaDetalhe, extra: Partial<ResultadosPesquisa> = {}) {
  const abertas = perguntasEmOrdem(d.secoes).filter(
    (p) => p.tipo === "paragrafo",
  );
  return {
    ...RESULTADOS,
    respostas: 3,
    perguntas: abertas.map((p, i) => ({
      perguntaId: p.id,
      tipo: "paragrafo" as const,
      respondidas: 3,
      viram: 3,
      textos: ["A", "B", "C"].map((l) => ({
        texto: `texto ${i + 1}${l}`,
        autor: null,
      })),
    })),
    modelo: resultadoReal(d),
    ...extra,
  } as ResultadosPesquisa;
}

describe("T216 — Clima: faixas, catálogo e nome", () => {
  it("faixas do índice: < 50 crítica · 50–64 atenção · 65–79 boa · ≥ 80 excelente", () => {
    expect([0, 49, 50, 64, 65, 79, 80, 100].map(faixaDoClima)).toEqual([
      "critica",
      "critica",
      "atencao",
      "atencao",
      "boa",
      "boa",
      "excelente",
      "excelente",
    ]);
  });

  it("perguntas editáveis, abertas obrigatórias e o nome com o mês", () => {
    const m = modeloDaGaleria("clima");
    expect(m.fixo).toBeFalsy();
    const p = perguntasEmOrdem(estadoDoModelo("clima").secoes);
    expect(p).toHaveLength(62);
    expect(p.slice(60).every((x) => x.obrigatoria)).toBe(true);
    expect(nomeDaPesquisaDeClima("2026-11-28")).toBe(
      "Pesquisa de Clima – Novembro 2026",
    );
    expect(estadoDoModelo("clima", "2026-03-02").nome).toBe(
      "Pesquisa de Clima – Março 2026",
    );
  });

  it("chaves: as 60 do modelo, as acrescentadas e as abertas", () => {
    expect(dimensaoDaChave("clima_01")).toBe("credibilidade");
    expect(dimensaoDaChave("clima_12")).toBe("credibilidade");
    expect(dimensaoDaChave("clima_13")).toBe("respeito");
    expect(dimensaoDaChave("clima_60")).toBe("camaradagem");
    expect(dimensaoDaChave("clima_61")).toBeNull();
    expect(dimensaoDaChave("clima_orgulho_abc")).toBe("orgulho");
    expect(dimensaoDaChave("clima_lideranca_abc")).toBeNull();
    expect(dimensaoDaChave("clima_aberta_01")).toBeNull();
    expect(chaveNova("respeito", "a1b2-c3")).toBe("clima_respeito_a1b2-c3");
    expect(chaveNova(null, "x9")).toBe("clima_aberta_x9");
    expect(
      chaveNova("imparcialidade", "123456789012345").length,
    ).toBeLessThanOrEqual(40);
  });

  it("Sobre o modelo: números, as 5 dimensões, o cálculo e a régua do índice", () => {
    const p = modeloDaGaleria("clima").pagina!;
    expect(p.recebe).toBeUndefined();
    expect(p.ficha).toBeUndefined();
    expect(p.numeros).toHaveLength(4);
    expect(p.conteudo.map((b) => b.titulo)).toEqual([
      "As 5 dimensões",
      "Como o resultado é calculado",
    ]);
    expect(p.regua!.faixas.map((f) => `${f.rotulo} ${f.intervalo}`)).toEqual([
      "Crítica abaixo de 50%",
      "Atenção 50% a 64%",
      "Boa 65% a 79%",
      "Excelente 80% ou mais",
    ]);
  });

  it("telas próprias só com o resultado do modelo na resposta da API", () => {
    const d = detalheDoClima();
    expect(temTelasDoClima(d, { modelo: null })).toBe(true);
    expect(temTelasDoClima(d, {})).toBe(false);
    expect(temTelasDoClima({ modelo: "pulso" }, { modelo: null })).toBe(false);
  });
});

describe("T216 — Clima: perguntas no assistente", () => {
  function montar(travado = false) {
    const onMudar = vi.fn();
    const secoes = estadoDoModelo("clima").secoes;
    render(
      <GarantirAvisos>
        <PerguntasDoClima secoes={secoes} travado={travado} onMudar={onMudar} />
      </GarantirAvisos>,
    );
    return { onMudar, secoes };
  }

  it("agrupadas por dimensão com 12 afirmações e as abertas com o selo Texto livre", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Expandir todas" }));
    for (const [, rotulo] of DIMS)
      expect(screen.getByRole("region", { name: rotulo })).toHaveTextContent(
        `${rotulo} · 12 afirmações`,
      );
    const abertas = screen.getByRole("region", { name: "Perguntas abertas" });
    expect(abertas).toHaveTextContent("Perguntas abertas · 2 perguntas");
    expect(within(abertas).getAllByText("Texto livre")).toHaveLength(2);
    expect(screen.queryByText(/Metodologia fixa/)).toBeNull();
  });

  it("acrescenta uma afirmação na dimensão escolhida e uma de texto livre", () => {
    const { onMudar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nova pergunta" }), {
      target: { value: "Sinto que meu trabalho é valorizado." },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Dimensão" }), {
      target: { value: "orgulho" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const secoes = onMudar.mock.calls[0]![0] as ReturnType<
      typeof estadoDoModelo
    >["secoes"];
    const orgulho = secoes.find((s) => s.titulo === "Orgulho")!;
    const nova = orgulho.perguntas.at(-1)!;
    expect(nova).toMatchObject({
      tipo: "concordancia",
      texto: "Sinto que meu trabalho é valorizado.",
      obrigatoria: true,
    });
    expect(dimensaoDaChave(nova.chave)).toBe("orgulho");
    const comLivre = acrescentarNoClima(secoes, null, "Algo mais?");
    const ultima = perguntasEmOrdem(comLivre).at(-1)!;
    expect(ultima).toMatchObject({ tipo: "paragrafo", obrigatoria: true });
    expect(ultima.chave!.startsWith("clima_aberta_")).toBe(true);
    expect(resumoDasPerguntasDoClima(perguntasEmOrdem(comLivre))).toBe(
      "61 afirmações · 3 abertas",
    );
  });

  it("grupos recolhíveis: só o primeiro aberto, com a faixa das afirmações, e 'Expandir todas'", () => {
    montar();
    const gatilho = (nome: string) =>
      screen.getByRole("button", { name: new RegExp(`^${nome}`) });
    expect(gatilho("Credibilidade")).toHaveAttribute("aria-expanded", "true");
    expect(gatilho("Respeito")).toHaveAttribute("aria-expanded", "false");
    expect(gatilho("Credibilidade")).toHaveTextContent("Afirmações 1–12");
    expect(gatilho("Respeito")).toHaveTextContent("Afirmações 13–24");
    expect(gatilho("Perguntas abertas")).toHaveTextContent("Perguntas 61–62");
    expect(
      screen.queryByRole("button", { name: "Editar pergunta 13" }),
    ).toBeNull();
    fireEvent.click(gatilho("Respeito"));
    expect(
      screen.getByRole("button", { name: "Editar pergunta 13" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir todas" }));
    expect(
      screen.getByRole("button", { name: "Editar pergunta 62" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recolher todas" }));
    expect(
      screen.queryByRole("button", { name: /Editar pergunta/ }),
    ).toBeNull();
  });

  it("arrastar reordena dentro da dimensão; para outra dimensão, não", () => {
    const { onMudar, secoes } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Expandir todas" }));
    const ids = perguntasEmOrdem(secoes).map((p) => p.id);
    const linha = (n: number) =>
      screen
        .getByRole("button", { name: `Arrastar pergunta ${n}` })
        .closest("li")!;
    expect(linha(3)).toHaveAttribute("draggable", "true");
    fireEvent.dragStart(linha(3));
    fireEvent.dragOver(linha(1));
    fireEvent.drop(linha(1));
    const ordem = perguntasEmOrdem(onMudar.mock.calls[0]![0]).map((p) => p.id);
    expect(ordem.slice(0, 3)).toEqual([ids[2], ids[0], ids[1]]);
    // Para a dimensão vizinha, nada muda.
    fireEvent.dragStart(linha(12));
    fireEvent.drop(linha(13));
    expect(onMudar).toHaveBeenCalledTimes(1);
  });

  it("pelo teclado: a alça sobe e desce dentro da dimensão, sem sair dela", () => {
    const { onMudar, secoes } = montar();
    const ids = perguntasEmOrdem(secoes).map((p) => p.id);
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Arrastar pergunta 2" }),
      { key: "ArrowUp" },
    );
    expect(
      perguntasEmOrdem(onMudar.mock.calls[0]![0])
        .slice(0, 2)
        .map((p) => p.id),
    ).toEqual([ids[1], ids[0]]);
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Arrastar pergunta 1" }),
      { key: "ArrowDown" },
    );
    expect(
      perguntasEmOrdem(onMudar.mock.calls[1]![0])
        .slice(0, 2)
        .map((p) => p.id),
    ).toEqual([ids[1], ids[0]]);
    // A 1ª não sobe e a 12ª não desce para a dimensão seguinte.
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Arrastar pergunta 1" }),
      { key: "ArrowUp" },
    );
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Arrastar pergunta 12" }),
      { key: "ArrowDown" },
    );
    expect(onMudar).toHaveBeenCalledTimes(2);
  });

  it("travado: sem a alça de arrastar", () => {
    montar(true);
    expect(
      screen.queryByRole("button", { name: /Arrastar pergunta/ }),
    ).toBeNull();
  });

  it("dimensão sem afirmações volta como seção nova antes das abertas", () => {
    const secoes = estadoDoModelo("clima").secoes.filter(
      (s) => s.titulo !== "Respeito",
    );
    const com = acrescentarNoClima(secoes, "respeito", "Sou ouvido.");
    expect(com.map((s) => s.titulo)).toEqual([
      "Credibilidade",
      "Imparcialidade",
      "Orgulho",
      "Camaradagem",
      "Respeito",
      "Perguntas abertas",
    ]);
  });

  it("edita e remove (com desfazer); com respostas, nada muda", () => {
    const { onMudar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar pergunta 1" }));
    const campo = screen.getByRole("textbox", { name: "Texto da pergunta 1" });
    fireEvent.change(campo, { target: { value: "Texto novo" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(perguntasEmOrdem(onMudar.mock.calls[0]![0])[0]!.texto).toBe(
      "Texto novo",
    );
    fireEvent.click(screen.getByRole("button", { name: "Expandir todas" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Remover pergunta 62" }),
    );
    expect(perguntasEmOrdem(onMudar.mock.calls[1]![0])).toHaveLength(61);
  });

  it("travado: sem adicionar, editar e remover", () => {
    montar(true);
    expect(
      screen.queryByRole("button", { name: "Adicionar pergunta" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Editar pergunta/ }),
    ).toBeNull();
    expect(screen.getByText(/já tem respostas/)).toBeInTheDocument();
  });

  it("a última afirmação não sai", () => {
    const secoes = [
      {
        id: "s",
        titulo: "Credibilidade",
        descricao: null,
        perguntas: perguntasEmOrdem(estadoDoModelo("clima").secoes).filter(
          (p) => p.chave === "clima_01" || p.tipo === "paragrafo",
        ),
      },
    ];
    render(
      <GarantirAvisos>
        <PerguntasDoClima secoes={secoes} travado={false} onMudar={vi.fn()} />
      </GarantirAvisos>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expandir todas" }));
    expect(
      screen.getByRole("button", { name: "Remover pergunta 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remover pergunta 2" }),
    ).toBeEnabled();
  });
});

describe("T216 — Clima: Visão geral", () => {
  const d = detalheDoClima();
  const geral = geralDo(d);

  it("índice no medidor com a faixa, a frase e todas as notas; sem score", () => {
    render(<>{visaoGeralDoModelo(d, geral)}</>);
    expect(
      screen.getByRole("img", { name: "Índice do time: 47%, Crítica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Menos da metade das respostas/),
    ).toBeInTheDocument();
    const notas = screen.getByRole("region", { name: "Todas as respostas" });
    expect(notas).toHaveTextContent("Todas as respostas · 180 notas");
    expect(notas).toHaveTextContent("Favoráveis (4 e 5)8447%");
    expect(notas).toHaveTextContent("Neutras (3)7240%");
    expect(notas).toHaveTextContent("Desfavoráveis (1 e 2)2413%");
    expect(screen.queryByText(/Score/)).toBeNull();
    expect(screen.queryByText("Comunicação")).toBeNull();
  });

  it("dimensões por resultado (empate pela ordem do modelo) ou na ordem do modelo", () => {
    render(<>{visaoGeralDoModelo(d, geral)}</>);
    const nomes = () =>
      within(screen.getByRole("list", { name: "Dimensões" }))
        .getAllByRole("listitem")
        .map((li) => li.querySelector(":scope > strong")!.textContent);
    expect(nomes()).toEqual([
      "Camaradagem",
      "Respeito",
      "Imparcialidade",
      "Credibilidade",
      "Orgulho",
    ]);
    const itens = within(
      screen.getByRole("list", { name: "Dimensões" }),
    ).getAllByRole("listitem");
    expect(itens[0]).toHaveTextContent("1º lugar");
    expect(itens[0]).toHaveTextContent("Atenção");
    expect(itens[4]).toHaveTextContent("5º lugar");
    const cima = screen.getByText("Puxa para cima").parentElement!;
    expect(cima).toHaveTextContent("Camaradagem · 50% favorável");
    // O que a dimensão representa.
    expect(cima).toHaveTextContent(DIMENSOES_CLIMA[4]!.texto);
    // Empate no menor valor: as duas dimensões, abaixo da faixa Boa, e a
    // afirmação mais baixa delas.
    const atencao = screen.getByText("Pede atenção").parentElement!;
    expect(atencao).toHaveTextContent(
      "Credibilidade e Orgulho · 44% favorável · abaixo da faixa Boa",
    );
    expect(atencao).toHaveTextContent("Empatam no menor resultado.");
    expect(atencao).toHaveTextContent(
      `Afirmação mais baixa: “${perguntasEmOrdem(d.secoes)[0]!.texto}” (33%)`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ordem do modelo" }));
    expect(nomes()).toEqual(DIMS.map((x) => x[1]));
  });

  it("todas as dimensões empatadas: nenhuma se destaca e todas pedem atenção", () => {
    const base = resultadoReal(d);
    const empatado = geralDo(d, {
      modelo: {
        ...base,
        dimensoes: base.dimensoes.map((x) => ({
          ...x,
          favoravel: 47,
          faixa: "critica" as const,
        })),
      },
    });
    render(<>{visaoGeralDoModelo(d, empatado)}</>);
    expect(screen.getByText("Puxa para cima").parentElement).toHaveTextContent(
      "Nenhuma dimensão se destaca: todas têm 47% favorável.",
    );
    expect(screen.getByText("Pede atenção").parentElement).toHaveTextContent(
      "Todas as dimensões · 47% favorável · abaixo da faixa Boa",
    );
  });

  it("layout: o medidor e todas as respostas à esquerda, os anéis à direita", () => {
    render(<>{visaoGeralDoModelo(d, geral)}</>);
    const topo = document.querySelector(".clima-topo")!;
    const [esquerda, direita] = [...topo.children];
    expect(
      within(esquerda as HTMLElement).getByRole("img", {
        name: "Índice do time: 47%, Crítica",
      }),
    ).toBeInTheDocument();
    expect(
      within(esquerda as HTMLElement).getByRole("region", {
        name: "Todas as respostas",
      }),
    ).toBeInTheDocument();
    expect(
      within(direita as HTMLElement).getByRole("list", { name: "Dimensões" }),
    ).toBeInTheDocument();
  });

  it("destaques: 'Ver todas as afirmações' leva ao resultado por afirmação, com todas", () => {
    render(<>{visaoGeralDoModelo(d, geral)}</>);
    fireEvent.click(screen.getByRole("button", { name: /^Orgulho/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ver todas as afirmações" }),
    );
    expect(screen.getByText("60 afirmações")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Resultado por afirmação" }),
    ).toHaveFocus();
  });

  it("destaques: as 3 mais e as 3 menos favoráveis", () => {
    render(<>{visaoGeralDoModelo(d, geral)}</>);
    const textos = perguntasEmOrdem(d.secoes).map((p) => p.texto);
    const mais = within(
      screen.getByRole("list", { name: "Mais favoráveis" }),
    ).getAllByRole("listitem");
    expect(mais.map((li) => li.textContent)).toEqual([
      expect.stringContaining(textos[3]!),
      expect.stringContaining(textos[4]!),
      expect.stringContaining(textos[8]!),
    ]);
    const menos = within(
      screen.getByRole("list", { name: "Menos favoráveis" }),
    ).getAllByRole("listitem");
    expect(menos[0]).toHaveTextContent(textos[0]!);
    expect(menos[0]).toHaveTextContent("33%");
  });

  it("resultado por afirmação: filtro por dimensão, menor primeiro (já ligado) e 8 por página", () => {
    render(<>{visaoGeralDoModelo(d, geral)}</>);
    const linhas = () =>
      within(screen.getByRole("list", { name: "Afirmações" })).getAllByRole(
        "listitem",
      );
    expect(linhas()).toHaveLength(8);
    // Abre com o menor favorável primeiro.
    expect(
      screen.getByRole("checkbox", { name: "Menor favorável primeiro" }),
    ).toBeChecked();
    expect(linhas()[0]).toHaveTextContent("Crítica");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Menor favorável primeiro" }),
    );
    expect(screen.getByRole("button", { name: /Todas/ })).toHaveTextContent(
      "60",
    );
    fireEvent.click(screen.getByRole("button", { name: /^Orgulho/ }));
    expect(screen.getByText("12 afirmações")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(linhas()).toHaveLength(4);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Menor favorável primeiro" }),
    );
    expect(linhas()).toHaveLength(8);
    expect(linhas()[0]).toHaveTextContent("Crítica");
  });

  it("respostas abertas: um bloco por pergunta com a contagem e o atalho para Análises", () => {
    const onTrocarAba = vi.fn();
    render(<>{visaoGeralDoModelo(d, geral, onTrocarAba)}</>);
    const abertas = screen.getByRole("region", { name: "Respostas abertas" });
    const blocos = within(abertas).getAllByRole("group");
    expect(blocos).toHaveLength(2);
    expect(blocos[0]).toHaveTextContent("3 respostas");
    // Fora da identificada: a ordem do servidor (alfabética).
    expect(
      within(blocos[0]!)
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual(["texto 1A", "texto 1B", "texto 1C"]);
    fireEvent.click(
      within(abertas).getByRole("button", { name: "Ver temas em Análises" }),
    );
    expect(onTrocarAba).toHaveBeenCalledWith("analises");
  });

  it("respostas abertas na identificada: as mais recentes primeiro", () => {
    const ident = detalheDoClima({ identificacao: "identificada" });
    render(<>{visaoGeralDoModelo(ident, geralDo(ident))}</>);
    const bloco = within(
      screen.getByRole("region", { name: "Respostas abertas" }),
    ).getAllByRole("group")[0]!;
    expect(
      within(bloco)
        .getAllByRole("listitem")
        .map((l) => l.querySelector("blockquote")!.textContent),
    ).toEqual(["texto 1C", "texto 1B", "texto 1A"]);
  });
});

describe("T216 — Clima: Respostas e resultado individual", () => {
  const resumo = (
    numero: number,
    indice: number,
    extra: Partial<RespostaResumo> = {},
  ): RespostaResumo => ({
    id: `r-${numero}`,
    numero,
    colaboradorId: null,
    nome: null,
    departamento: null,
    respondidaEm: "2026-11-28T06:22:00Z",
    media: 6,
    resumoDoModelo: { modelo: "clima", indice, faixa: faixaDoClima(indice) },
    ...extra,
  });

  it("lista com o índice de cada resposta e a coluna Departamento", () => {
    const d = detalheDoClima();
    const onAbrir = vi.fn();
    render(
      <>
        {listaDeRespostasDoModelo({
          detalhe: d,
          geral: geralDo(d),
          respostas: [
            resumo(3, 40, {
              grupos: [
                { campo: "departamento", grupo: "Operações", oculto: null },
              ],
            }),
            resumo(2, 0, {
              grupos: [
                { campo: "departamento", grupo: null, oculto: "minimo" },
              ],
            }),
            resumo(1, 100),
          ],
          onAbrir,
        })}
      </>,
    );
    expect(
      within(screen.getByRole("group", { name: "Respostas" })).getByRole(
        "button",
        { name: "Todos 3" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
    const linhas = within(
      screen.getByRole("table", { name: "Respostas" }),
    ).getAllByRole("row");
    expect(
      within(linhas[0]!)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["Resposta", "Departamento", "Respondeu em", "Índice", "Abrir"]);
    // A data com o ano.
    expect(linhas[1]).toHaveTextContent(
      "Resposta anônima #3Operações28/11/2026 · 03:2240%Crítica",
    );
    expect(linhas[2]).toHaveTextContent("Oculto28/11/2026 · 03:220%Crítica");
    expect(linhas[3]).toHaveTextContent("—28/11/2026 · 03:22100%Excelente");
    expect(screen.queryByText(/\/10/)).toBeNull();
    fireEvent.click(linhas[1]!);
    expect(onAbrir).toHaveBeenCalledWith("r-3");
    expect(
      listaDeRespostasDoModelo({
        detalhe: d,
        geral: RESULTADOS,
        respostas: [],
        onAbrir,
      }),
    ).toBeNull();
  });

  it("departamento: identificada pela ficha; anônima pelo grupo", () => {
    const r = resumo(1, 50, { departamento: "Financeiro" });
    expect(departamentoDaResposta(r, true)).toBe("Financeiro");
    expect(departamentoDaResposta(r, false)).toBe("—");
    expect(diferencaDoTime(40, 47)).toBe("7 p.p. abaixo do time (47%)");
    expect(diferencaDoTime(52, 47)).toBe("5 p.p. acima do time (47%)");
    expect(diferencaDoTime(47, 47)).toBe("igual ao time (47%)");
  });

  it("individual: índice × time, notas, dimensões, onde difere, distribuição e abertas", () => {
    const d = detalheDoClima();
    const todas = perguntasEmOrdem(d.secoes);
    const afirmacoes = todas.filter((p) => p.tipo === "concordancia");
    const p: ResultadoIndividualClima = {
      modelo: "clima",
      indice: 40,
      faixa: "critica",
      favoraveis: 24,
      neutras: 12,
      desfavoraveis: 24,
      time: { indice: 47, faixa: "critica" },
      dimensoes: DIMS.map(([chave, rotulo, time]) => ({
        chave,
        rotulo,
        indice: 33,
        faixa: "critica" as const,
        time,
      })),
      afirmacoes: afirmacoes.map((x, i) => ({
        chave: x.chave!,
        perguntaId: x.id,
        dimensao: dimensaoDaChave(x.chave)!,
        nota: (i % 5) + 1,
        mediaTime: Math.round(((5 + 3 + (i % 5) + 1) / 3) * 100) / 100,
        favoravelTime: i % 2 === 0 ? 33 : 67,
      })),
      distribuicao: { resposta: [12, 12, 12, 12, 12], time: [7, 7, 40, 7, 40] },
    };
    const abertas = todas.filter((x) => x.tipo === "paragrafo");
    const resposta: RespostaDetalhe = {
      ...RESPOSTA_DETALHE,
      valores: [
        { perguntaId: abertas[0]!.id, valor: "Manter o café", mediaTime: null },
      ],
      modelo: p,
    };
    const onVerRespostas = vi.fn();
    render(<>{visaoIndividualDoModelo(resposta, d.secoes, onVerRespostas)}</>);
    expect(
      screen.getByRole("img", { name: "Índice desta resposta: 40%, Crítica" }),
    ).toBeInTheDocument();
    expect(screen.getByText("7 p.p. abaixo do time (47%)")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Esta resposta" }),
    ).toHaveTextContent("Esta resposta · 60 notas");
    expect(
      within(
        screen.getByRole("list", { name: "Dimensões da resposta" }),
      ).getAllByRole("listitem")[4],
    ).toHaveTextContent("Time 50% · −17 p.p.");
    // Favorável aqui, mas menos da metade do time favorável; e o contrário.
    const positivas = within(
      screen.getByRole("list", { name: "Mais positivo que o time" }),
    ).getAllByRole("listitem");
    expect(positivas).toHaveLength(5);
    expect(positivas[0]).toHaveTextContent(afirmacoes[4]!.texto);
    expect(positivas[0]).toHaveTextContent(
      "Favorável (nota 5) · time: 33% favorável",
    );
    const negativas = within(
      screen.getByRole("list", { name: "Mais negativo que o time" }),
    ).getAllByRole("listitem");
    expect(negativas).toHaveLength(5);
    expect(negativas[0]).toHaveTextContent(afirmacoes[1]!.texto);
    expect(negativas[0]).toHaveTextContent(
      "Desfavorável (nota 2) · time: 67% favorável",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ver todas as respostas" }),
    );
    expect(onVerRespostas).toHaveBeenCalledTimes(1);
    expect(
      screen.getByLabelText("Nota 3: 12 respostas (20%), time 40%"),
    ).toBeInTheDocument();
    expect(screen.getByText("Manter o café")).toBeInTheDocument();
    expect(screen.getByText("Sem resposta.")).toBeInTheDocument();
    expect(screen.queryByText(/Média geral/)).toBeNull();
    const { maisPositivas, maisNegativas } = diferencasDoTime(p, 50);
    expect(maisPositivas.map((a) => a.nota)).toEqual(
      expect.arrayContaining([4, 5]),
    );
    expect(maisPositivas.every((a) => a.favoravelTime! < 50)).toBe(true);
    expect(maisNegativas.every((a) => a.nota! <= 2)).toBe(true);
    expect(maisNegativas.every((a) => a.favoravelTime! >= 50)).toBe(true);
    // Neutra (3) nunca entra.
    expect([...maisPositivas, ...maisNegativas].some((a) => a.nota === 3)).toBe(
      false,
    );
    // Em ordem da maior distância: a resposta favorável com o time mais
    // baixo vem primeiro.
    const comTimes = {
      ...p,
      afirmacoes: p.afirmacoes.map((a, i) =>
        i === 9 ? { ...a, favoravelTime: 10 } : a,
      ),
    };
    expect(diferencasDoTime(comTimes).maisPositivas[0]!.chave).toBe(
      p.afirmacoes[9]!.chave,
    );
    expect(visaoIndividualDoModelo(RESPOSTA_DETALHE, d.secoes)).toBeNull();
  });
});

describe("R4-B-07 — Clima individual: vazios e contagem", () => {
  it("sem diferença para nenhum dos lados: os dois vazios explicados", () => {
    const d = detalheDoClima();
    const afirmacoes = perguntasEmOrdem(d.secoes).filter(
      (p) => p.tipo === "concordancia",
    );
    const p: ResultadoIndividualClima = {
      modelo: "clima",
      indice: 0,
      faixa: "critica",
      favoraveis: 0,
      neutras: 60,
      desfavoraveis: 0,
      time: { indice: 50, faixa: "atencao" },
      dimensoes: [],
      afirmacoes: afirmacoes.map((x) => ({
        chave: x.chave!,
        perguntaId: x.id,
        dimensao: dimensaoDaChave(x.chave)!,
        nota: 3,
        mediaTime: 3,
        favoravelTime: 50,
      })),
      distribuicao: { resposta: [0, 0, 60, 0, 0], time: null },
    };
    render(
      <>
        {visaoIndividualDoModelo(
          { ...RESPOSTA_DETALHE, valores: [], modelo: p },
          d.secoes,
        )}
      </>,
    );
    expect(
      screen.getByText(
        "Nenhuma afirmação em que esta resposta fique acima do time.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nenhuma afirmação em que esta resposta fique abaixo do time.",
      ),
    ).toBeInTheDocument();
    // Sem o atalho, sem o botão.
    expect(
      screen.queryByRole("button", { name: "Ver todas as respostas" }),
    ).toBeNull();
    // A aba Respostas do individual conta as afirmações (as abertas à parte).
    expect(contagemIndividualDoModelo({ ...RESPOSTA_DETALHE, modelo: p })).toBe(
      60,
    );
    expect(contagemIndividualDoModelo(RESPOSTA_DETALHE)).toBeNull();
  });
});

describe("T216 — Clima: Análises", () => {
  it("por departamento (ocultos), evolução desde a anterior e duplicar", async () => {
    const d = detalheDoClima({ publicadaEm: "2026-11-20T10:00:00Z" });
    const geral = geralDo(d, {
      recortes: ["departamento"],
      grupos: {
        departamento: [
          { id: "d-1", nome: "Operações", respostas: 3, visivel: true },
          {
            id: "d-2",
            nome: "Financeiro",
            respostas: 1,
            visivel: false,
            oculto: "minimo",
          },
        ],
      },
    });
    const anterior = {
      ...RESUMO,
      id: "p-antes",
      nome: "Clima de 2025",
      modelo: "clima" as const,
      publicadaEm: "2025-11-10T10:00:00Z",
    };
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() =>
        Promise.resolve(lista([anterior, { ...RESUMO, modelo: "pulso" }])),
      ),
      resultadosDaPesquisa: vi.fn((id: string, recorte?: unknown) =>
        Promise.resolve(
          id === "p-antes"
            ? { ...geral, modelo: { ...resultadoReal(d), favoravel: 40 } }
            : recorte
              ? {
                  ...geral,
                  modelo: {
                    ...resultadoReal(d),
                    favoravel: 60,
                    faixa: "atencao" as const,
                  },
                }
              : geral,
        ),
      ),
    });
    const onDuplicar = vi.fn();
    render(
      <>
        {analisesDoModelo({
          servico,
          detalhe: d,
          geral,
          respostas: null,
          onDuplicar,
        })}
      </>,
    );
    const tabela = await screen.findByRole("table", {
      name: "Resultado por departamento",
    });
    const linhas = within(tabela).getAllByRole("row");
    expect(linhas[1]).toHaveTextContent(
      "Todo o time (3 respostas)47% Crítica44%47%47%44%50%",
    );
    expect(linhas[2]).toHaveTextContent("Operações (3 respostas)60% Atenção");
    expect(linhas[3]).toHaveTextContent("Oculto para proteger quem respondeu");
    expect(
      await screen.findByText(/Clima de 2025: 40% → agora 47%/),
    ).toHaveTextContent("+7 p.p.");
    expect(screen.getByRole("note")).toHaveTextContent(
      "precisam de pesquisa identificada",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Duplicar para o próximo ciclo" }),
    );
    expect(onDuplicar).toHaveBeenCalled();
  });

  it("primeira pesquisa, sem recorte; identificada mostra pessoas por faixa", async () => {
    const d = detalheDoClima({ identificacao: "identificada" });
    const geral = geralDo(d, { recortes: [] });
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([]))),
    });
    render(
      <>
        {analisesDoModelo({
          servico,
          detalhe: d,
          geral,
          respostas: [
            {
              ...RESPOSTA_DETALHE,
              resumoDoModelo: { modelo: "clima", indice: 40, faixa: "critica" },
            },
            {
              ...RESPOSTA_DETALHE,
              id: "x",
              resumoDoModelo: {
                modelo: "clima",
                indice: 90,
                faixa: "excelente",
              },
            },
          ],
        })}
      </>,
    );
    expect(
      await screen.findByText(/primeira Pesquisa de Clima/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sem departamento informado para agrupar as respostas."),
    ).toBeInTheDocument();
    const faixas = within(
      screen.getByRole("list", { name: "Pessoas por faixa" }),
    ).getAllByRole("listitem");
    expect(faixas.map((li) => li.textContent)).toEqual([
      expect.stringContaining("1 pessoa"),
      expect.stringContaining("0 pessoas"),
      expect.stringContaining("0 pessoas"),
      expect.stringContaining("1 pessoa"),
    ]);
    expect(screen.queryByRole("button", { name: /Duplicar/ })).toBeNull();
    expect(
      analisesDoModelo({
        servico,
        detalhe: d,
        geral: RESULTADOS,
        respostas: null,
      }),
    ).toBeNull();
  });
});

describe("R4-B-12 — Clima: agrupar por e segmentação", () => {
  it("anônima sem recorte: o seletor de departamento aparece e o vazio leva a duplicar", async () => {
    const d = detalheDoClima({ identificacao: "anonima" });
    const geral = geralDo(d, { recortes: [] });
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([]))),
    });
    const onDuplicar = vi.fn();
    render(
      <>
        {analisesDoModelo({
          servico,
          detalhe: d,
          geral,
          respostas: null,
          onDuplicar,
        })}
      </>,
    );
    const agrupar = await screen.findByRole("group", { name: "Agrupar por" });
    expect(
      within(agrupar).getByRole("button", { name: "Agrupar por Departamento" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Sem departamento informado para agrupar as respostas."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ativar segmentação na próxima pesquisa",
      }),
    );
    expect(onDuplicar).toHaveBeenCalledTimes(1);
  });

  it("com recorte, sem o botão de ativar a segmentação", async () => {
    const d = detalheDoClima({ identificacao: "identificada" });
    const geral = geralDo(d, {
      recortes: ["departamento"],
      grupos: { departamento: [] },
    });
    render(
      <>
        {analisesDoModelo({
          servico: servicoFalso({
            listarPesquisas: vi.fn(() => Promise.resolve(lista([]))),
          }),
          detalhe: d,
          geral,
          respostas: null,
          onDuplicar: vi.fn(),
        })}
      </>,
    );
    expect(
      await screen.findByRole("group", { name: "Agrupar por" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Ativar segmentação na próxima pesquisa",
      }),
    ).toBeNull();
  });
});

describe("T216 — Clima: planilha", () => {
  const d = detalheDoClima();
  const rel = montarRelatorio({
    detalhe: d,
    geral: geralDo(d),
    empresa: "Empresa Alfa",
    hoje: "2026-11-28",
    respostas: null,
    analises: null,
  });
  const r = resultadoReal(d);
  const respostas: RespostaDetalhe[] = [5, 3].map((nota, i) => ({
    ...RESPOSTA_DETALHE,
    id: `r-${i}`,
    numero: i + 1,
    valores: perguntasEmOrdem(d.secoes).map((p) => ({
      perguntaId: p.id,
      valor: p.tipo === "concordancia" ? nota : `texto ${i}`,
      mediaTime: null,
    })),
  }));

  it("Resumo, Dimensões, Ranking e Respostas individuais (anônima, sem data)", () => {
    const abas = abasDaPlanilhaClima({ rel, detalhe: d, r, respostas });
    expect(abas.map((a) => a.nome)).toEqual([
      "Resumo",
      "Dimensões",
      "Ranking",
      "Respostas individuais",
    ]);
    const resumo = JSON.stringify(abas[0]!.linhas);
    expect(resumo).toContain(
      '"Índice do time",{"numero":0.47,"formato":"percentual"},"Crítica"',
    );
    expect(resumo).toContain(
      '"Camaradagem",{"numero":0.5,"formato":"percentual"},"Atenção",12',
    );
    expect(resumo).toContain("boa de 65% a 79%");
    expect(abas[1]!.linhas[4]).toEqual([
      "Credibilidade",
      perguntasEmOrdem(d.secoes)[0]!.texto,
      { numero: 0.33, formato: "percentual" },
      { numero: 3, formato: "decimal" },
    ]);
    expect(abas[2]!.linhas.slice(4).map((l) => l[1])).toEqual([
      "Camaradagem",
      "Respeito",
      "Imparcialidade",
      "Credibilidade",
      "Orgulho",
    ]);
    const ind = abas[3]!.linhas;
    expect(ind[3]![0]).toBe("Resposta");
    expect(ind[3]).toHaveLength(63);
    expect(ind[4]!.slice(0, 2)).toEqual(["Resposta 1", 5]);
    expect(ind[4]!.at(-1)).toBe("texto 0");
    expect(ind.at(-1)![0]).toBe("Média");
    expect(ind.at(-1)![1]).toEqual({ numero: 3, formato: "decimal" });
  });

  it("confidencial sem respostas individuais; números ocultos só no Resumo", () => {
    const conf = { ...d, identificacao: "confidencial" as const };
    expect(
      abasDaPlanilhaClima({ rel, detalhe: conf, r, respostas }).map(
        (a) => a.nome,
      ),
    ).toEqual(["Resumo", "Dimensões", "Ranking"]);
    const ocultos = abasDaPlanilhaClima({
      rel: { ...rel, numerosOcultos: true },
      detalhe: d,
      r,
      respostas,
    });
    expect(ocultos.map((a) => a.nome)).toEqual(["Resumo"]);
    expect(JSON.stringify(ocultos[0]!.linhas)).toContain("Números ocultos");
    expect(rankingDoClima({ ...r, dimensoes: [] })).toEqual([]);
  });
});

describe("T216 — Clima: relatório em PDF", () => {
  it("capa com o índice, sumário de 7 seções, conclusões e metodologia", () => {
    const d = detalheDoClima();
    const geral = geralDo(d);
    const carregado: RelatorioCarregado = {
      detalhe: d,
      geral,
      empresa: "Empresa Alfa",
      lista: null,
      rel: montarRelatorio({
        detalhe: d,
        geral,
        empresa: "Empresa Alfa",
        hoje: "2026-11-28",
        respostas: null,
        analises: null,
      }),
    };
    render(<DocumentoClima carregado={carregado} servico={servicoFalso()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Pesquisa de Clima" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: "Índice do time: 47%, Crítica" }),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole("list", { name: "Sumário" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(7);
    expect(
      screen.getByRole("list", { name: "Principais conclusões" }),
    ).toHaveTextContent("O índice do time é 47%, na faixa Crítica.");
    expect(
      screen.getByRole("list", { name: "Afirmações por faixa" }),
    ).toHaveTextContent("0Excelente24Boa0Atenção36Crítica");
    expect(
      screen.getByText("Sem departamento informado para agrupar as respostas."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Média geral/)).toBeNull();
    expect(screen.getByText(/excelente a partir de 80%/)).toBeInTheDocument();
  });

  it("conclusões: a faixa, o ponto forte e as que pedem atenção (empate)", () => {
    const r = resultadoReal(detalheDoClima());
    expect(conclusoesDoClima(r)).toEqual([
      "O índice do time é 47%, na faixa Crítica.",
      "Camaradagem (50%) é a dimensão mais favorável.",
      "Credibilidade (44%) e Orgulho (44%) pedem mais atenção.",
    ]);
    expect(conclusoesDoClima({ ...r, favoravel: null, faixa: null })).toEqual(
      [],
    );
  });
});
