/**
 * T216 — módulo Pesquisas: página inicial (sem pesquisas), lista com
 * pílulas, busca, tipo e linha clicável, galeria (passo 1), gaveta "Ver
 * perguntas", "Sobre o modelo", ações por linha e permissões. Servidor
 * simulado; dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PesquisaResumo } from "../../api/pesquisasClient";
import {
  MODELOS_DE_PESQUISA,
  modeloDaGaleria,
  totalDePerguntas,
} from "./modelosDePesquisa";
import { PesquisasModulo } from "./PesquisasModulo";
import { DETALHE, RESUMO, lista, servicoFalso } from "./dadosDeTeste";

const abrirMenu = (nome: string) =>
  fireEvent.pointerDown(screen.getByRole("button", { name: nome }), {
    button: 0,
    ctrlKey: false,
  });

const ANONIMA: PesquisaResumo = {
  ...RESUMO,
  id: "p-2",
  nome: "Pulso anônimo",
  modelo: "pulso",
  identificacao: "anonima",
  status: "pausada",
  participantes: null,
  respostas: 3,
  criadaEm: "2026-11-10T13:00:00Z",
};
const RASCUNHO: PesquisaResumo = {
  ...RESUMO,
  id: "p-3",
  nome: "Rascunho escondido",
  status: "rascunho",
};

const comLista = (itens: PesquisaResumo[]) =>
  servicoFalso({ listarPesquisas: vi.fn(() => Promise.resolve(lista(itens))) });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Lista de pesquisas", () => {
  it("pílulas com contagem, rascunho fora da lista e rodapé da tabela", async () => {
    render(
      <PesquisasModulo
        servico={comLista([RESUMO, ANONIMA, RASCUNHO])}
        podeEditar
      />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    const pilulas = screen.getByRole("group", { name: "Status" });
    expect(
      within(pilulas)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "Todas2",
      "Ativas1",
      "Pausadas1",
      "Finalizadas0",
      "Canceladas0",
    ]);
    expect(tabela).not.toHaveTextContent("Rascunho escondido");
    expect(screen.getByText("2 pesquisas")).toBeInTheDocument();
    expect(
      screen.getByText("Clique numa linha para ver os resultados"),
    ).toBeInTheDocument();
  });

  it("participação: fração e % na identificada; respostas e 'link aberto' na anônima", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    const [, primeira, segunda] = within(tabela).getAllByRole("row");
    // A mais recente primeiro (Criada em ▾).
    expect(primeira).toHaveTextContent("Pulso anônimo");
    expect(primeira).toHaveTextContent("3 respostas");
    expect(primeira).toHaveTextContent("link aberto");
    expect(segunda).toHaveTextContent("8/10");
    expect(segunda).toHaveTextContent("80%");
    expect(segunda).toHaveTextContent("Clima · Confidencial");
    expect(segunda).toHaveTextContent("02/11/2026");
  });

  it("linha: ícone e cor do modelo, status com ponto e filtros numa linha só", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    const [, pulso, clima] = within(tabela).getAllByRole("row");
    // Cada linha leva o ícone do próprio modelo, na cor dele.
    const corDe = (linha: HTMLElement) =>
      (
        linha.querySelector(".pesquisas__icone-modelo") as HTMLElement
      ).style.getPropertyValue("--cor-do-modelo");
    expect(corDe(pulso!)).not.toBe(corDe(clima!));
    // Status em pílula com ponto colorido (nada de selo com ícone).
    const status = clima!.querySelector(".pesquisas__status--ativa")!;
    expect(status).toHaveTextContent("Ativa");
    expect(status.querySelector(".pesquisas__ponto")).not.toBeNull();
    expect(
      pulso!.querySelector(".pesquisas__status--pausada"),
    ).toHaveTextContent("Pausada");
    // Pílulas, busca e Tipo no mesmo contêiner de linha.
    const linha = document.querySelector(".pesquisas__filtros--linha")!;
    expect(
      within(linha as HTMLElement).getByRole("group", { name: "Status" }),
    ).toBeInTheDocument();
    expect(
      within(linha as HTMLElement).getByRole("searchbox", {
        name: "Buscar pesquisa",
      }),
    ).toBeInTheDocument();
    expect(
      within(linha as HTMLElement).getByRole("button", { name: /^Tipo/ }),
    ).toBeInTheDocument();
    // O "⋯" com ícone em cada ação.
    abrirMenu("Ações de Clima de novembro");
    for (const item of await screen.findAllByRole("menuitem"))
      expect(item.querySelector("svg")).not.toBeNull();
  });

  it("ordenar por Criada em inverte a ordem", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    const ordenar = screen.getByRole("button", { name: /Criada em/ });
    expect(ordenar.closest("th")).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(ordenar);
    expect(ordenar.closest("th")).toHaveAttribute("aria-sort", "ascending");
    expect(within(tabela).getAllByRole("row")[1]).toHaveTextContent(
      "Clima de novembro",
    );
  });

  it("busca e pílula filtram na hora", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar pesquisa" }),
      {
        target: { value: "anonimo" },
      },
    );
    expect(within(tabela).getAllByRole("row")).toHaveLength(2);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar pesquisa" }),
      {
        target: { value: "" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /^Ativas/ }));
    expect(within(tabela).getAllByRole("row")).toHaveLength(2);
    expect(tabela).toHaveTextContent("Clima de novembro");
  });

  it("filtro por tipo (modelo)", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    // Botão com ícone na mesma linha da busca; abre os modelos presentes.
    fireEvent.click(screen.getByRole("button", { name: /^Tipo/ }));
    const modelos = screen.getByRole("group", { name: "Modelos" });
    expect(
      within(modelos)
        .getAllByRole("checkbox")
        .map((c) => c.closest("label")!.textContent),
    ).toEqual(["Clima", "Pulso"]);
    fireEvent.click(within(modelos).getByRole("checkbox", { name: "Pulso" }));
    expect(within(tabela).getAllByRole("row")).toHaveLength(2);
    expect(tabela).toHaveTextContent("Pulso anônimo");
    expect(screen.getByRole("button", { name: /^Tipo/ })).toHaveTextContent(
      "1",
    );
  });

  it("a linha inteira abre os resultados", async () => {
    const servico = comLista([RESUMO]);
    render(<PesquisasModulo servico={servico} podeEditar />);
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    fireEvent.click(
      within(tabela).getAllByRole("row")[1]!.querySelector("td:nth-child(3)")!,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Clima de novembro",
      }),
    ).toBeInTheDocument();
    expect(servico.resultadosDaPesquisa).toHaveBeenCalled();
  });

  it("excluir pede confirmação explicando o que se perde", async () => {
    const servico = comLista([RESUMO]);
    render(<PesquisasModulo servico={servico} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    abrirMenu("Ações de Clima de novembro");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Excluir pesquisa" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Excluir Clima de novembro?",
    });
    expect(janela).toHaveTextContent("o link deixa de funcionar");
    expect(janela).toHaveTextContent("não é possível desfazer");
    expect(within(janela).getByLabelText("O que se perde")).toHaveTextContent(
      "Respostas8 respostas",
    );
    // Ainda ativa: sugere finalizar no lugar de excluir.
    expect(
      within(janela).getByRole("button", { name: "Finalizar pesquisa" }),
    ).toBeInTheDocument();
    expect(servico.excluirPesquisa).not.toHaveBeenCalled();
    fireEvent.click(
      within(janela).getByRole("button", { name: "Excluir pesquisa" }),
    );
    await waitFor(() =>
      expect(servico.excluirPesquisa).toHaveBeenCalledWith("p-1"),
    );
    expect(
      await screen.findByText('"Clima de novembro" foi excluída.'),
    ).toBeInTheDocument();
  });

  it("menu da linha: editar, duplicar e copiar link", async () => {
    const escrever = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: escrever },
      configurable: true,
    });
    const servico = comLista([RESUMO]);
    render(<PesquisasModulo servico={servico} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    abrirMenu("Ações de Clima de novembro");
    expect(
      (await screen.findAllByRole("menuitem")).map((m) => m.textContent),
    ).toEqual([
      "Ver resultados",
      "Editar pesquisa",
      "Duplicar",
      "Copiar link",
      "Excluir pesquisa",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Copiar link" }));
    await waitFor(() =>
      expect(escrever).toHaveBeenCalledWith(
        expect.stringMatching(/#\/p\/token-de-teste$/),
      ),
    );
    expect(await screen.findByText("Link copiado.")).toBeInTheDocument();
    abrirMenu("Ações de Clima de novembro");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicar" }));
    // Confirma na gaveta, escolhendo outra empresa: a lista continua.
    const gaveta = await screen.findByRole("dialog", {
      name: "Duplicar pesquisa",
    });
    fireEvent.click(
      await within(gaveta).findByRole("combobox", {
        name: "Empresa de destino",
      }),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "Empresa Beta" }),
    );
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Confirmar duplicação" }),
    );
    await waitFor(() =>
      expect(servico.duplicarPesquisa).toHaveBeenCalledWith("p-1", "e-2"),
    );
    expect(
      await screen.findByText("Pesquisa duplicada com sucesso!"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Pesquisas" }),
    ).toBeInTheDocument();
  });

  it("master técnico só lê: sem Nova pesquisa e sem menu de ações", async () => {
    render(<PesquisasModulo servico={comLista([RESUMO])} podeEditar={false} />);
    await screen.findByRole("table", { name: "Pesquisas" });
    expect(screen.queryByRole("button", { name: /Nova pesquisa/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Ações de Clima de novembro" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Ver resultados de Clima de novembro",
      }),
    ).toBeInTheDocument();
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

describe("Página inicial (sem pesquisas)", () => {
  it("título, os três passos na barra e a galeria com o modelo recomendado", async () => {
    render(<PesquisasModulo servico={comLista([RASCUNHO])} podeEditar />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Crie sua primeira pesquisa",
      }),
    ).toBeInTheDocument();
    const passos = screen.getByRole("list", { name: "Como funciona" });
    expect(within(passos).getAllByRole("listitem")).toHaveLength(3);
    const pulso = screen.getByRole("article", { name: "Pulso" });
    expect(pulso).toHaveTextContent("Recomendado para começar");
    expect(screen.getByText(/Sem saber por onde começar/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("master técnico sem pesquisas não vê a galeria", async () => {
    render(<PesquisasModulo servico={comLista([])} podeEditar={false} />);
    expect(
      await screen.findByText(/Quem cria pesquisas é o RH ou o DP/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar o modelo/ })).toBeNull();
  });
});

describe("Galeria de modelos", () => {
  async function abrirGaleria() {
    render(<PesquisasModulo servico={comLista([RESUMO])} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Nova pesquisa/ }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Que pesquisa você quer aplicar?",
      }),
    ).toBeInTheDocument();
  }

  it("é o passo 1 de 4; cada card mostra a quantidade do modelo", async () => {
    await abrirGaleria();
    expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();
    expect(document.querySelectorAll(".pesquisas__pontos > span")).toHaveLength(
      4,
    );
    expect(screen.getAllByRole("article")).toHaveLength(
      MODELOS_DE_PESQUISA.length,
    );
    for (const m of MODELOS_DE_PESQUISA) {
      const n = totalDePerguntas(m);
      expect(screen.getByRole("article", { name: m.nome })).toHaveTextContent(
        n === 0
          ? "Você escolhe as perguntas"
          : `${n} ${n === 1 ? "pergunta" : "perguntas"}`,
      );
    }
    // Fora da página inicial, sem o selo de recomendado.
    expect(
      screen.getByRole("article", { name: "Pulso" }),
    ).not.toHaveTextContent("Recomendado para começar");
  });

  it("pílulas com contador, seções por categoria e busca", async () => {
    await abrirGaleria();
    const pilulas = screen.getByRole("group", { name: "Categoria" });
    expect(
      within(pilulas)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Todos8", "Clima e engajamento4", "Outros4"]);
    expect(
      screen.getByRole("heading", { name: "Clima e engajamento" }),
    ).toBeInTheDocument();
    fireEvent.click(within(pilulas).getByRole("button", { name: /^Outros/ }));
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(
      screen.queryByRole("heading", { name: "Clima e engajamento" }),
    ).toBeNull();
    fireEvent.click(within(pilulas).getByRole("button", { name: /^Todos/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar modelo" }), {
      target: { value: "desligamento" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar modelo" }), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("Nenhum modelo encontrado.")).toBeInTheDocument();
  });

  it("a gaveta numera as perguntas e separa o comentário final", async () => {
    await abrirGaleria();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver perguntas de Pulso" }),
    );
    const gaveta = await screen.findByRole("dialog", { name: "Pulso" });
    const m = modeloDaGaleria("pulso");
    const n = totalDePerguntas(m);
    expect(gaveta).toHaveTextContent(`${n} perguntas prontas`);
    const principais = within(gaveta).getByRole("list", { name: "Perguntas" });
    expect(within(principais).getAllByRole("listitem")).toHaveLength(n - 1);
    expect(principais).toHaveTextContent("01");
    const comentario = within(gaveta).getByRole("list", {
      name: "Comentário final",
    });
    expect(comentario).toHaveTextContent(String(n).padStart(2, "0"));
    expect(gaveta).toHaveTextContent("Comentário final (opcional)");
    expect(
      within(gaveta).getByRole("button", { name: "Sobre o modelo" }),
    ).toBeInTheDocument();
    expect(
      within(gaveta).getByRole("button", { name: "Usar modelo →" }),
    ).toBeInTheDocument();
  });

  it("'Sobre o modelo' abre a página com as perguntas agrupadas e 'Criar pesquisa'", async () => {
    await abrirGaleria();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver perguntas de Clima" }),
    );
    const gaveta = await screen.findByRole("dialog", { name: "Clima" });
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Sobre o modelo" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: /Clima/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "As perguntas" }),
    ).toHaveTextContent("Concordância · 1 a 5");
    expect(
      screen.getByRole("button", { name: "Criar pesquisa →" }),
    ).toBeInTheDocument();
  });

  it("usar o modelo abre o assistente de 3 etapas e grava o rascunho", async () => {
    const servico = comLista([RESUMO]);
    render(<PesquisasModulo servico={servico} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Nova pesquisa/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Usar o modelo eNPS" }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Nova pesquisa eNPS",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Etapas" })).toHaveTextContent(
      "Configurar",
    );
    await waitFor(() => expect(servico.criarPesquisa).toHaveBeenCalled());
  });

  it("um rascunho do mesmo modelo é retomado", async () => {
    const rascunho = {
      ...RESUMO,
      id: "p-r",
      modelo: "enps" as const,
      status: "rascunho" as const,
    };
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([RESUMO, rascunho]))),
    });
    render(<PesquisasModulo servico={servico} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Nova pesquisa/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Usar o modelo eNPS" }),
    );
    await waitFor(() =>
      expect(servico.obterPesquisa).toHaveBeenCalledWith("p-r"),
    );
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
  });

  it("a personalizada abre a página de entrada", async () => {
    await abrirGaleria();
    fireEvent.click(
      screen.getByRole("button", { name: "Usar o modelo Personalizada" }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Pesquisa personalizada",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copiar uma pesquisa/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Começar em branco/ }),
    ).toBeInTheDocument();
  });
});

describe("Página da pesquisa personalizada", () => {
  async function abrirEntrada(servico = comLista([RESUMO])) {
    render(<PesquisasModulo servico={servico} podeEditar />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Nova pesquisa/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Usar o modelo Personalizada",
      }),
    );
    await screen.findByRole("heading", {
      level: 1,
      name: "Pesquisa personalizada",
    });
    return servico;
  }

  it("mostra o rascunho em andamento e o retoma", async () => {
    const rascunho = {
      ...RESUMO,
      id: "p-pr",
      nome: "Rascunho aberto",
      modelo: "personalizada" as const,
      status: "rascunho" as const,
    };
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([RESUMO, rascunho]))),
      obterPesquisa: vi.fn(() =>
        Promise.resolve({
          ...DETALHE,
          id: "p-pr",
          nome: "Rascunho aberto",
          modelo: "personalizada" as const,
          status: "rascunho" as const,
        }),
      ),
    });
    await abrirEntrada(servico);
    const aviso = await screen.findByRole("region", {
      name: "Rascunho em andamento",
    });
    expect(aviso).toHaveTextContent("Rascunho aberto");
    fireEvent.click(
      within(aviso).getByRole("button", { name: "Continuar rascunho" }),
    );
    await waitFor(() =>
      expect(servico.obterPesquisa).toHaveBeenCalledWith("p-pr"),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Nova pesquisa personalizada",
      }),
    ).toBeInTheDocument();
  });

  it("copiar uma pesquisa lista só personalizadas; vazio explica", async () => {
    await abrirEntrada();
    fireEvent.click(
      screen.getByRole("button", { name: /Copiar uma pesquisa/ }),
    );
    const gaveta = await screen.findByRole("dialog", {
      name: "Copiar uma pesquisa",
    });
    expect(
      await within(gaveta).findByText("Nenhuma pesquisa personalizada ainda"),
    ).toBeInTheDocument();
  });

  it("começar em branco abre o assistente de 5 etapas", async () => {
    await abrirEntrada();
    fireEvent.click(screen.getByRole("button", { name: /Começar em branco/ }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Nova pesquisa personalizada",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pré-visualizar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Etapas do cadastro" }),
    ).toHaveTextContent("Revisão");
  });
});

describe("Rotas do módulo", () => {
  it("cada tela pede a própria rota; o rascunho criado troca a rota no lugar", async () => {
    const servico = comLista([RESUMO]);
    const onNavegar = vi.fn();
    const { rerender } = render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "lista" }}
        onNavegar={onNavegar}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Nova pesquisa/ }),
    );
    expect(onNavegar).toHaveBeenLastCalledWith({ tela: "nova" }, undefined);
    rerender(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "modelo", modelo: "enps" }}
        onNavegar={onNavegar}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Nova pesquisa eNPS",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(onNavegar).toHaveBeenLastCalledWith(
        { tela: "rascunho", id: "p-novo" },
        { substituir: true },
      ),
    );
    // A rota passa ao rascunho: o mesmo assistente continua (sem recarregar).
    rerender(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "rascunho", id: "p-novo" }}
        onNavegar={onNavegar}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Nova pesquisa eNPS" }),
    ).toBeInTheDocument();
    expect(servico.obterPesquisa).not.toHaveBeenCalledWith("p-novo");
  });

  it("resultados abrem direto pela rota, com a aba", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({ ...DETALHE, identificacao: "identificada" as const }),
      ),
    });
    render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "resultados", id: "p-1", aba: "respostas" }}
        onNavegar={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("table", { name: "Respostas" }),
    ).toBeInTheDocument();
  });

  it("sem empresa ativa (acesso global): pede a escolha e não consulta nada", async () => {
    const servico = comLista([RESUMO]);
    render(<PesquisasModulo servico={servico} podeEditar={false} semEmpresa />);
    expect(
      screen.getByText(
        "Escolha uma empresa ativa no menu para ver as pesquisas.",
      ),
    ).toBeInTheDocument();
    expect(servico.listarPesquisas).not.toHaveBeenCalled();
  });

  it("403 ao listar também pede a escolha da empresa", async () => {
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() =>
        Promise.reject(Object.assign(new Error("proibido"), { status: 403 })),
      ),
    });
    render(<PesquisasModulo servico={servico} podeEditar={false} />);
    expect(
      await screen.findByText(
        "Escolha uma empresa ativa no menu para ver as pesquisas.",
      ),
    ).toBeInTheDocument();
  });
});
