/**
 * T216 — módulo Pesquisas: lista por status, boas-vindas sem pesquisas,
 * galeria de modelos (card = gaveta = assistente), ações por linha e
 * permissões (o master técnico só lê). Servidor simulado; dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MODELOS_DE_PESQUISA,
  modeloDaGaleria,
  totalDePerguntas,
} from "./modelosDePesquisa";
import { PesquisasModulo } from "./PesquisasModulo";
import { RESUMO, lista, servicoFalso } from "./dadosDeTeste";

const abrirMenu = (nome: string) =>
  fireEvent.pointerDown(screen.getByRole("button", { name: nome }), {
    button: 0,
    ctrlKey: false,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Lista de pesquisas", () => {
  it("abas por status com contagem e a linha com participação", async () => {
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() =>
        Promise.resolve(
          lista([RESUMO], {
            todas: 4,
            ativa: 1,
            pausada: 1,
            finalizada: 2,
            cancelada: 0,
          }),
        ),
      ),
    });
    render(<PesquisasModulo servico={servico} podeEditar />);
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    const abas = screen.getByRole("tablist", { name: "Status" });
    expect(
      within(abas)
        .getAllByRole("tab")
        .map((a) => a.textContent),
    ).toEqual([
      "Todas4",
      "Ativas1",
      "Pausadas1",
      "Finalizadas2",
      "Canceladas0",
    ]);
    const linha = within(tabela).getAllByRole("row")[1]!;
    expect(linha).toHaveTextContent("Clima de novembro");
    expect(linha).toHaveTextContent("Clima · Confidencial");
    expect(linha).toHaveTextContent("8/10");
    expect(linha).toHaveTextContent("80%");
    expect(linha).toHaveTextContent("02/11/2026");
    expect(linha).toHaveTextContent("Ativa");
  });

  it("trocar de aba pede a lista do status", async () => {
    const servico = servicoFalso();
    render(<PesquisasModulo servico={servico} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    fireEvent.click(screen.getByRole("tab", { name: /Pausadas/ }));
    await waitFor(() =>
      expect(servico.listarPesquisas).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "pausada" }),
      ),
    );
  });

  it("sem pesquisas: boas-vindas com os três passos e a galeria", async () => {
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([]))),
    });
    render(<PesquisasModulo servico={servico} podeEditar />);
    const passos = await screen.findByRole("list", {
      name: "Como funciona",
    });
    expect(within(passos).getAllByRole("listitem")).toHaveLength(3);
    expect(passos).toHaveTextContent("Escolha um modelo");
    expect(passos).toHaveTextContent("Defina quem responde");
    expect(passos).toHaveTextContent("Envie e acompanhe");
    expect(
      screen.getByRole("button", { name: "Usar o modelo Pulso" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("excluir pede confirmação explicando o que se perde", async () => {
    const servico = servicoFalso();
    render(<PesquisasModulo servico={servico} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    abrirMenu("Ações de Clima de novembro");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    const janela = await screen.findByRole("dialog", {
      name: "Excluir Clima de novembro?",
    });
    expect(janela).toHaveTextContent("o link deixa de funcionar");
    expect(janela).toHaveTextContent("8 respostas");
    expect(janela).toHaveTextContent("Não é possível desfazer");
    expect(servico.excluirPesquisa).not.toHaveBeenCalled();
    fireEvent.click(
      within(janela).getByRole("button", { name: "Excluir pesquisa" }),
    );
    await waitFor(() =>
      expect(servico.excluirPesquisa).toHaveBeenCalledWith("p-1"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Pesquisa excluída.",
    );
  });

  it("duplicar cria um rascunho e avisa", async () => {
    const servico = servicoFalso();
    render(<PesquisasModulo servico={servico} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    abrirMenu("Ações de Clima de novembro");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicar" }));
    await waitFor(() =>
      expect(servico.duplicarPesquisa).toHaveBeenCalledWith("p-1"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Clima de novembro (cópia)",
    );
  });

  it("copiar link usa o endereço completo do link público", async () => {
    const escrever = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: escrever },
      configurable: true,
    });
    render(<PesquisasModulo servico={servicoFalso()} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    abrirMenu("Ações de Clima de novembro");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Copiar link" }),
    );
    await waitFor(() =>
      expect(escrever).toHaveBeenCalledWith(
        expect.stringMatching(/#\/p\/token-de-teste$/),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Link copiado.",
    );
  });

  it("master técnico só lê: sem Nova pesquisa e sem menu de ações", async () => {
    render(<PesquisasModulo servico={servicoFalso()} podeEditar={false} />);
    await screen.findByRole("table", { name: "Pesquisas" });
    expect(screen.queryByRole("button", { name: "Nova pesquisa" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Ações de Clima de novembro" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Ver resultados de Clima de novembro",
      }),
    ).toBeInTheDocument();
  });

  it("master técnico sem pesquisas não vê a galeria para criar", async () => {
    render(
      <PesquisasModulo
        servico={servicoFalso({
          listarPesquisas: vi.fn(() => Promise.resolve(lista([]))),
        })}
        podeEditar={false}
      />,
    );
    expect(
      await screen.findByText(/Quem cria pesquisas é o RH ou o DP/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar o modelo/ })).toBeNull();
  });

  it("falha ao carregar oferece tentar de novo", async () => {
    const listar = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("rede")))
      .mockImplementation(() => Promise.resolve(lista([RESUMO])));
    render(
      <PesquisasModulo
        servico={servicoFalso({ listarPesquisas: listar })}
        podeEditar
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      await screen.findByRole("table", { name: "Pesquisas" }),
    ).toBeInTheDocument();
  });
});

describe("Galeria de modelos", () => {
  it("8 modelos, cada um com a quantidade de perguntas do modelo", async () => {
    render(<PesquisasModulo servico={servicoFalso()} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova pesquisa" }),
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(8);
    for (const m of MODELOS_DE_PESQUISA) {
      const card = screen.getByRole("article", { name: m.nome });
      const n = totalDePerguntas(m);
      expect(card).toHaveTextContent(
        n === 0 ? "Em branco" : `${n} ${n === 1 ? "pergunta" : "perguntas"}`,
      );
    }
  });

  it("filtra por categoria e por busca", async () => {
    render(<PesquisasModulo servico={servicoFalso()} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova pesquisa" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Outros" }));
    expect(screen.getAllByRole("article")).toHaveLength(4);
    fireEvent.click(
      screen.getByRole("button", { name: "Clima e engajamento" }),
    );
    expect(screen.getAllByRole("article")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar modelo" }), {
      target: { value: "desligamento" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar modelo" }), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("Nenhum modelo encontrado.")).toBeInTheDocument();
  });

  it("a gaveta mostra as mesmas perguntas que o card conta", async () => {
    render(<PesquisasModulo servico={servicoFalso()} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova pesquisa" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ver perguntas de Clima" }),
    );
    const gaveta = await screen.findByRole("dialog", { name: "Clima" });
    const n = totalDePerguntas(modeloDaGaleria("clima"));
    expect(within(gaveta).getAllByRole("listitem")).toHaveLength(n);
    expect(gaveta).toHaveTextContent(`${n} perguntas`);
    expect(gaveta).toHaveTextContent("Liderança");
  });

  it("usar o modelo abre o assistente com as perguntas do modelo", async () => {
    render(<PesquisasModulo servico={servicoFalso()} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova pesquisa" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Usar o modelo eNPS" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nova pesquisa" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("eNPS");
    expect(screen.getByText("3 perguntas de até 60")).toBeInTheDocument();
  });
});
