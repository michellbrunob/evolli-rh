/**
 * T216 — resultados de uma pesquisa: cabeçalho com status e ações, faixa de
 * informações, indicadores, cartões por pergunta (rosca, % favorável,
 * faixas, eNPS com zona, comentários), recortes com o mínimo por grupo,
 * Análises (mapa de médias e evolução), Respostas (identificada e anônima,
 * nunca na confidencial) e Exportar (Excel e PDF) respeitando a
 * identificação. Servidor simulado; dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Identificacao, PesquisaDetalhe } from "../../api/pesquisasClient";
import { baixarArquivo } from "../dashboard/exportacao";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import { DETALHE, RESULTADOS, servicoFalso } from "./dadosDeTeste";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";

vi.mock("../dashboard/exportacao", async (original) => {
  const actual = await original<typeof import("../dashboard/exportacao")>();
  return { ...actual, baixarArquivo: vi.fn() };
});

const abrirMenu = (nome: string | RegExp) =>
  fireEvent.pointerDown(screen.getByRole("button", { name: nome }), {
    button: 0,
    ctrlKey: false,
  });

beforeEach(() => {
  vi.mocked(baixarArquivo).mockClear();
});

const comIdentificacao = (
  identificacao: Identificacao,
  extra: Partial<PesquisaDetalhe> = {},
) => ({
  obterPesquisa: vi.fn(() =>
    Promise.resolve({
      ...DETALHE,
      identificacao,
      ...(identificacao === "anonima" ? { participantes: null } : {}),
      ...extra,
    } as PesquisaDetalhe),
  ),
});

function montar(
  extra: Parameters<typeof servicoFalso>[0] = {},
  podeEditar = true,
) {
  const servico = servicoFalso(extra);
  const handlers = {
    onVoltar: vi.fn(),
    onEditar: vi.fn(),
    onDuplicada: vi.fn(),
    onSobreOModelo: vi.fn(),
    onAbrirResposta: vi.fn(),
  };
  render(
    <ResultadosDaPesquisa
      servico={servico}
      pesquisaId="p-1"
      podeEditar={podeEditar}
      {...handlers}
    />,
  );
  return { servico, ...handlers };
}

describe("Resultados — cabeçalho e faixa", () => {
  it("status com menu, modelo e respostas; faixa com 4 informações", async () => {
    montar();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Clima de novembro",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mudar status, hoje Ativa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Clima · 8 respostas até agora"),
    ).toBeInTheDocument();
    const info = screen.getByLabelText("Sobre a pesquisa");
    expect(info).toHaveTextContent("ModeloClima");
    expect(info).toHaveTextContent("Criada em02/11/2026");
    expect(info).toHaveTextContent("IdentificaçãoConfidencial");
    expect(info).toHaveTextContent("Participação8 de 10 pessoas · 80%");
  });

  it("na anônima, a participação é 'respostas · link aberto'", async () => {
    montar(comIdentificacao("anonima"));
    const info = await screen.findByLabelText("Sobre a pesquisa");
    expect(info).toHaveTextContent("8 respostas · link aberto");
  });

  it("⋯: duplicar abre a cópia; excluir pede confirmação", async () => {
    const { servico, onDuplicada, onVoltar } = montar();
    await screen.findByRole("heading", { level: 1, name: "Clima de novembro" });
    abrirMenu("Mais ações");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Duplicar pesquisa" }),
    );
    // Gaveta de confirmação: empresa de destino e o aviso do link novo.
    const gaveta = await screen.findByRole("dialog", {
      name: "Duplicar pesquisa",
    });
    expect(
      await within(gaveta).findByRole("combobox", {
        name: "Empresa de destino",
      }),
    ).toHaveTextContent("Empresa Alfa");
    expect(gaveta).toHaveTextContent("link novo");
    expect(servico.duplicarPesquisa).not.toHaveBeenCalled();
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Confirmar duplicação" }),
    );
    await waitFor(() =>
      // A cópia nasce ativa e abre (na empresa ativa).
      expect(onDuplicada).toHaveBeenCalledWith(
        expect.objectContaining({ id: "p-copia", status: "ativa" }),
      ),
    );
    // Na própria empresa, o corpo vai sem empresaId.
    expect(servico.duplicarPesquisa).toHaveBeenCalledWith("p-1", undefined);
    expect(
      await screen.findByText("Pesquisa duplicada com sucesso!"),
    ).toBeInTheDocument();
    abrirMenu("Mais ações");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Excluir pesquisa" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Excluir Clima de novembro?",
    });
    // O que se perde e a sugestão de finalizar (ainda ativa).
    const perdas = within(janela).getByLabelText("O que se perde");
    expect(perdas).toHaveTextContent("Respostas8 respostas");
    expect(perdas).toHaveTextContent("Participantes10 pessoas");
    expect(
      await within(perdas).findByText(/^\d+ perguntas?$/),
    ).toBeInTheDocument();
    expect(
      within(janela).getByRole("button", { name: "Finalizar pesquisa" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(janela).getByRole("button", { name: "Excluir pesquisa" }),
    );
    await waitFor(() =>
      expect(servico.excluirPesquisa).toHaveBeenCalledWith("p-1"),
    );
    expect(onVoltar).toHaveBeenCalled();
  });

  it("pausar muda o status direto; finalizar pede confirmação", async () => {
    const { servico } = montar();
    await screen.findByRole("heading", { level: 1, name: "Clima de novembro" });
    abrirMenu(/Mudar status/);
    expect(await screen.findByText("Mudar status")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Pausada/ }));
    await waitFor(() =>
      expect(servico.alterarStatusDaPesquisa).toHaveBeenCalledWith(
        "p-1",
        "pausada",
      ),
    );
    expect(await screen.findByText("Pesquisa pausada.")).toBeInTheDocument();
    // Pausada: o link não está recebendo respostas.
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeDisabled();
    abrirMenu(/Mudar status/);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /^Finalizada/ }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Finalizar a pesquisa?",
    });
    expect(janela).toHaveTextContent("não volta a ficar ativa");
    expect(servico.alterarStatusDaPesquisa).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(janela).getByRole("button", { name: "Finalizar pesquisa" }),
    );
    await waitFor(() =>
      expect(servico.alterarStatusDaPesquisa).toHaveBeenLastCalledWith(
        "p-1",
        "finalizada",
      ),
    );
  });

  it("master técnico: sem menu de status, sem Editar, sem Respostas e ⋯ só com 'Sobre o modelo'", async () => {
    montar(comIdentificacao("identificada"), false);
    await screen.findByRole("heading", { level: 1, name: "Clima de novembro" });
    expect(screen.queryByRole("button", { name: /Mudar status/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Respostas/ })).toBeNull();
    abrirMenu("Mais ações");
    expect(
      (await screen.findAllByRole("menuitem")).map((m) => m.textContent),
    ).toEqual(["Sobre o modelo Clima"]);
  });
});

describe("Resultados — Visão geral", () => {
  it("indicadores calculados quando o servidor ainda não os manda", async () => {
    montar();
    const ind = await screen.findByRole("region", { name: "Indicadores" });
    // Concordância 4,25 de 5 = 8,5 de 10; o eNPS fica fora da média geral.
    expect(ind).toHaveTextContent("Média geral8,5 /10");
    expect(ind).toHaveTextContent("eNPS50Zona de qualidade");
    expect(ind).toHaveTextContent(
      "Maior média8,5 /10Tenho clareza das prioridades.",
    );
  });

  it("indicadores do servidor têm precedência", async () => {
    montar({
      resultadosDaPesquisa: vi.fn(() =>
        Promise.resolve({
          ...RESULTADOS,
          indicadores: {
            mediaGeral: 7.3,
            perguntasDeEscala: 5,
            maiorMedia: { perguntaId: "q-conc", media: 7.8 },
            menorMedia: { perguntaId: "q-conc", media: 6.5 },
            enps: {
              indice: -10,
              zona: "critica" as const,
              promotores: 1,
              neutros: 2,
              detratores: 3,
            },
          },
        }),
      ),
    });
    const ind = await screen.findByRole("region", { name: "Indicadores" });
    expect(ind).toHaveTextContent("Média geral7,3 /10");
    expect(ind).toHaveTextContent(
      "Média das 5 perguntas de escala, com 8 respostas",
    );
    expect(ind).toHaveTextContent("-10Zona crítica");
  });

  it("cartão de escala: média, % favorável, faixas e barras por nota", async () => {
    montar();
    const cartao = await screen.findByRole("region", {
      name: "2. Tenho clareza das prioridades.",
    });
    // A média fica na rosca; embaixo, só o rótulo (sem repetir o número).
    expect(cartao).toHaveTextContent("4,3/5Média do time");
    expect(cartao).not.toHaveTextContent("Média 4,3");
    expect(cartao).toHaveTextContent("100% favorável");
    expect(cartao).toHaveTextContent("Favorável = notas 4 e 5");
    expect(
      within(cartao).getByRole("img", {
        name: /Faixas: 1 a 2 0%, 3 a 3 0%, 4 a 5 100%/,
      }),
    ).toBeInTheDocument();
    expect(
      within(cartao).getByRole("table", { name: /Notas de/ }),
    ).toBeInTheDocument();
  });

  it("cartão do eNPS: zona, grupos e a fórmula", async () => {
    montar();
    const cartao = await screen.findByRole("region", {
      name: "1. Quanto você indicaria a empresa?",
    });
    const enps = within(cartao).getByRole("region", { name: "eNPS" });
    expect(enps).toHaveTextContent("Zona de qualidade");
    expect(enps).toHaveTextContent("Promotores (9–10)5 · 63%");
    expect(enps).toHaveTextContent("Detratores (0–6)1 · 13%");
    expect(cartao).toHaveTextContent(
      "eNPS = % de promotores − % de detratores",
    );
  });

  it("comentários livres sem autor fora da identificada; com autor na identificada", async () => {
    montar();
    const cartao = await screen.findByRole("region", {
      name: "5. Comentários",
    });
    expect(cartao).toHaveTextContent("Comentários livres");
    expect(cartao).toHaveTextContent("2 comentários");
    expect(cartao).toHaveTextContent("2 pessoas viram esta pergunta");
    expect(cartao).not.toHaveTextContent("Pessoa Exemplo");
  });

  it("na identificada, o comentário mostra quem escreveu", async () => {
    montar(comIdentificacao("identificada"));
    const cartao = await screen.findByRole("region", {
      name: "5. Comentários",
    });
    expect(cartao).toHaveTextContent("Pessoa Exemplo");
  });

  it("recorte abaixo do mínimo: 'Poucas respostas para mostrar'", async () => {
    const { servico } = montar({
      resultadosDaPesquisa: vi.fn((_id: string, recorte?: unknown) =>
        Promise.resolve(
          recorte
            ? {
                ...RESULTADOS,
                filtro: { departamentoId: "d-2", visivel: false },
                perguntas: [],
              }
            : RESULTADOS,
        ),
      ),
    });
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(screen.getByRole("option", { name: "Financeiro" }));
    expect(
      await screen.findByText("Poucas respostas para mostrar"),
    ).toBeInTheDocument();
    expect(servico.resultadosDaPesquisa).toHaveBeenLastCalledWith("p-1", "d-2");
    expect(screen.queryByRole("region", { name: "eNPS" })).toBeNull();
  });

  it("com recortes do servidor, filtra por campo e grupo", async () => {
    const { servico } = montar({
      resultadosDaPesquisa: vi.fn(() =>
        Promise.resolve({ ...RESULTADOS, recortes: ["unidade" as const] }),
      ),
    });
    await screen.findByRole("region", { name: "Indicadores" });
    expect(screen.queryByRole("combobox", { name: "Departamento" })).toBeNull();
    fireEvent.click(screen.getByRole("combobox", { name: "Unidade" }));
    fireEvent.click(await screen.findByRole("option", { name: "Filial Sul" }));
    await waitFor(() =>
      expect(servico.resultadosDaPesquisa).toHaveBeenLastCalledWith("p-1", {
        campo: "unidade",
        grupoId: "u-2",
      }),
    );
  });
});

describe("Resultados — sem respostas e recortes", () => {
  it("sem respostas: Exportar desligado, sem filtros e o cartão 'Ainda sem respostas'", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({
          ...DETALHE,
          identificacao: "identificada",
          respostas: 0,
          participantes: 1,
          participantesLista: [
            {
              colaboradorId: "c-1",
              nome: "Ana Exemplo",
              departamento: "Operações",
              respondeu: false,
            },
          ],
        } as PesquisaDetalhe),
      ),
      resultadosDaPesquisa: vi.fn(() =>
        Promise.resolve({
          ...RESULTADOS,
          respostas: 0,
          participantes: 1,
          perguntas: [],
        }),
      ),
    });
    render(
      <ResultadosDaPesquisa
        servico={servico}
        pesquisaId="p-1"
        podeEditar
        hoje="2026-11-02"
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("Clima · criada hoje · nenhuma resposta ainda"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Departamento" })).toBeNull();
    expect(screen.getByLabelText("Sobre a pesquisa")).toHaveTextContent(
      "0 de 1 pessoa · 0%",
    );
    const vazio = screen.getByRole("region", { name: "Ainda sem respostas" });
    expect(
      within(vazio).getByRole("button", { name: "Copiar link" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(vazio).getByRole("button", { name: "Ver quem foi convidado" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Quem foi convidado" }),
    ).toHaveTextContent("Ana Exemplo");
  });

  it("média geral com a faixa; recorte mostra 'Mostrando N de M · Limpar filtros'", async () => {
    const { servico } = montar({
      resultadosDaPesquisa: vi.fn((_id: string, recorte?: unknown) =>
        Promise.resolve(recorte ? { ...RESULTADOS, respostas: 6 } : RESULTADOS),
      ),
    });
    const ind = await screen.findByRole("region", { name: "Indicadores" });
    expect(ind).toHaveTextContent("8 ou mais");
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(screen.getByRole("option", { name: "Operações" }));
    expect(
      await screen.findByText(/Mostrando 6 respostas de 8/),
    ).toBeInTheDocument();
    const chamadas = servico.resultadosDaPesquisa.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    // Limpar volta ao geral já carregado, sem nova consulta.
    expect(servico.resultadosDaPesquisa.mock.calls.length).toBe(chamadas);
    await waitFor(() => expect(screen.queryByText(/Mostrando/)).toBeNull());
  });
});

describe("Resultados — Análises e Respostas", () => {
  it("mapa de médias com 'Toda a empresa', faixa por cor e grupo oculto", async () => {
    montar();
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("tab", { name: /Análises/ }));
    const mapa = await screen.findByRole("table", {
      name: "Médias por departamento",
    });
    const [cabeca, empresa, operacoes, financeiro] =
      within(mapa).getAllByRole("row");
    expect(cabeca).toHaveTextContent("Prioridades");
    expect(empresa).toHaveTextContent("Toda a empresa (8 respostas)8,58,5");
    expect(within(operacoes!).getAllByRole("cell")[0]).toHaveAttribute(
      "data-faixa",
      "baixa",
    );
    expect(financeiro).toHaveTextContent("Oculto · menos de 3 respostas");
    expect(
      screen.getByText(/A evolução aparece a partir da segunda pesquisa/),
    ).toBeInTheDocument();
  });

  it("confidencial nunca tem a aba Respostas", async () => {
    const { servico } = montar();
    await screen.findByRole("region", { name: "Indicadores" });
    expect(screen.queryByRole("tab", { name: /Respostas/ })).toBeNull();
    expect(servico.respostasDaPesquisa).not.toHaveBeenCalled();
  });

  it("identificada: lista com nome, média e data; abre o resultado individual", async () => {
    const { onAbrirResposta } = montar(comIdentificacao("identificada"));
    fireEvent.click(await screen.findByRole("tab", { name: /Respostas/ }));
    const tabela = await screen.findByRole("table", { name: "Respostas" });
    // Da mais recente para a mais antiga.
    const [, bruno, ana] = within(tabela).getAllByRole("row");
    expect(bruno).toHaveTextContent("Bruno Exemplo");
    expect(ana).toHaveTextContent("Ana Exemplo");
    expect(ana).toHaveTextContent("9,0 /10");
    expect(ana).toHaveTextContent("20/11 · 11:23");
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: "Ver resultado de Ana Exemplo",
      }),
    );
    expect(onAbrirResposta).toHaveBeenCalledWith("r-1");
  });

  it("anônima: respostas numeradas, sem pessoa", async () => {
    montar(comIdentificacao("anonima"));
    fireEvent.click(await screen.findByRole("tab", { name: /Respostas/ }));
    const tabela = await screen.findByRole("table", { name: "Respostas" });
    expect(tabela).toHaveTextContent("Resposta anônima #1");
    expect(tabela).not.toHaveTextContent("Ana Exemplo");
  });
});

describe("Resultados — Exportar", () => {
  async function exportarExcel() {
    await screen.findByRole("region", { name: "Indicadores" });
    abrirMenu("Exportar");
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excel/ }));
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalledTimes(1));
    const [bytes, nome] = vi.mocked(baixarArquivo).mock.calls[0]!;
    return { abas: await lerAbasXlsx(bytes as Uint8Array), nome };
  }

  it("Excel na confidencial: as abas do relatório, sem autor nem respostas individuais", async () => {
    const { servico } = montar();
    const { abas, nome } = await exportarExcel();
    expect(nome).toBe("clima-de-novembro-resultados.xlsx");
    expect(Object.keys(abas)).toEqual([
      "Resumo",
      "Perguntas",
      "eNPS",
      "Comentários",
      "Alertas",
      "Metodologia",
    ]);
    expect(JSON.stringify(abas)).toContain("Mais retorno, por favor.");
    expect(JSON.stringify(abas)).not.toContain("Pessoa Exemplo");
    expect(servico.respostaDaPesquisa).not.toHaveBeenCalled();
    expect(servico.respostasDaPesquisa).not.toHaveBeenCalled();
  });

  it("Excel na identificada leva os participantes com o nome e a data como data", async () => {
    montar(comIdentificacao("identificada"));
    const { abas } = await exportarExcel();
    const [cabecalho, ana] = abas["Participantes"]!.slice(3);
    expect(cabecalho![2]).toBe("Respondida em");
    expect(ana![0]).toBe("Ana Exemplo");
    // 20/11/2026 11:23 (Brasília) como data serial do Excel.
    expect(Number(ana![2])).toBeCloseTo(46346 + (11 * 60 + 23) / 1440, 5);
    const nota = cabecalho!.findIndex((c) => c.startsWith("1."));
    expect(ana![nota]).toBe("10");
  });

  it("Excel na anônima numera os participantes, sem nome", async () => {
    montar(comIdentificacao("anonima"));
    const { abas } = await exportarExcel();
    expect(abas["Participantes"]![4]![0]).toBe("Participante 1");
    expect(JSON.stringify(abas["Participantes"])).not.toContain("Ana Exemplo");
  });

  it("PDF: abre o relatório imprimível em outra aba", async () => {
    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    montar();
    await screen.findByRole("region", { name: "Indicadores" });
    abrirMenu("Exportar");
    fireEvent.click(await screen.findByRole("menuitem", { name: /PDF/ }));
    expect(abrir).toHaveBeenCalledWith(
      expect.stringMatching(/#\/pesquisas\/p-1\/relatorio$/),
      "_blank",
      "noopener",
    );
    expect(baixarArquivo).not.toHaveBeenCalled();
    abrir.mockRestore();
  });
});
