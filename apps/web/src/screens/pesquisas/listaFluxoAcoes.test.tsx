/**
 * T216 — revisão 3 (lista, fluxo e ações): publicar um rascunho retomado
 * mostra a tela final, avisos de erro com tom de erro, recorte que falha
 * sem números antigos, contadores e estado vazio da lista, trilha com os
 * níveis, finalizada com Editar e "Copiar link" desabilitado, menus com
 * respiro, seletor dos resultados abrindo para baixo, volta ao topo no
 * assistente e rotas inválidas. Servidor simulado; dados sintéticos.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PesquisaDetalhe,
  PesquisaResumo,
} from "../../api/pesquisasClient";
import {
  ProvedorDeTrilhaComplementar,
  useComplementoDaTrilha,
} from "../../app/trilhaComplementar";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import { EditarPesquisa } from "./EditarPesquisa";
import {
  DETALHE,
  RESPOSTA_DETALHE,
  RESULTADOS,
  RESUMO,
  lista,
  servicoFalso,
} from "./dadosDeTeste";
import { PesquisasModulo } from "./PesquisasModulo";
import { ResultadoIndividual } from "./ResultadoIndividual";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";
import type { RotaDePesquisas } from "./rotasDePesquisas";

const abrirMenu = (nome: string | RegExp) =>
  fireEvent.pointerDown(screen.getByRole("button", { name: nome }), {
    button: 0,
    ctrlKey: false,
  });

const css = (arquivo: string) =>
  readFileSync(resolve(__dirname, arquivo), "utf8").replace(/\s+/g, " ");

afterEach(() => {
  vi.restoreAllMocks();
});

const RASCUNHO: PesquisaDetalhe = {
  ...DETALHE,
  id: "p-r",
  nome: "Pulso retomado",
  modelo: "pulso",
  status: "rascunho",
  identificacao: "anonima",
  participantes: null,
  temRespostas: false,
  link: null,
};

describe("R3-A-02 — publicar um rascunho retomado", () => {
  it("mostra 'Pesquisa criada e ativa' mesmo se a pesquisa for relida", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(RASCUNHO)),
    });
    const onNavegar = vi.fn();
    const rota: RotaDePesquisas = { tela: "rascunho", id: "p-r" };
    const { rerender } = render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={rota}
        onNavegar={onNavegar}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Próximo/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Gerar pesquisa/ }),
    );
    await screen.findByRole("region", { name: "Pesquisa criada e ativa" });
    // O shell recria o serviço (ou a tela é relida): agora a pesquisa está
    // ativa. A tela final continua, sem pular para Editar.
    const relido = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({ ...RASCUNHO, status: "ativa" as const }),
      ),
    });
    rerender(
      <PesquisasModulo
        servico={relido}
        podeEditar
        rota={{ tela: "rascunho", id: "p-r" }}
        onNavegar={onNavegar}
      />,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(
      screen.getByRole("region", { name: "Pesquisa criada e ativa" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeEnabled();
    expect(onNavegar).not.toHaveBeenCalledWith(
      expect.objectContaining({ tela: "editar" }),
      expect.anything(),
    );
  });

  it("aberta pela rota uma pesquisa já publicada, segue para Editar", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({ ...RASCUNHO, status: "ativa" as const }),
      ),
    });
    const onNavegar = vi.fn();
    render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "rascunho", id: "p-r" }}
        onNavegar={onNavegar}
      />,
    );
    await waitFor(() =>
      expect(onNavegar).toHaveBeenCalledWith(
        { tela: "editar", id: "p-r" },
        { substituir: true },
      ),
    );
  });
});

describe("R3-A-04 — aviso de erro com tom de erro", () => {
  it("falha ao mudar o status: alerta com o tom de erro (não o verde)", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(DETALHE)),
      alterarStatusDaPesquisa: vi.fn(() => Promise.reject(new Error("x"))),
    });
    render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "resultados", id: "p-1", aba: "geral" }}
        onNavegar={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: DETALHE.nome });
    abrirMenu(/Mudar status/);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Pausada/ }));
    const alerta = await screen.findByRole("alert", {
      name: "Não foi possível mudar o status.",
    });
    expect(alerta).toHaveClass("aviso-flutuante", "aviso-flutuante--erro");
  });

  it("sucesso continua no tom de sucesso", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(DETALHE)),
    });
    render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "resultados", id: "p-1", aba: "geral" }}
        onNavegar={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: DETALHE.nome });
    abrirMenu(/Mudar status/);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Pausada/ }));
    const aviso = await screen.findByRole("status", {
      name: "Pesquisa pausada.",
    });
    expect(aviso).not.toHaveClass("aviso-flutuante--erro");
  });

  it("falha ao duplicar: o erro aparece na própria gaveta, sem aviso por cima", async () => {
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([RESUMO]))),
      duplicarPesquisa: vi.fn(() => Promise.reject(new Error("x"))),
    });
    render(<PesquisasModulo servico={servico} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    abrirMenu(`Ações de ${RESUMO.nome}`);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicar" }));
    const gaveta = await screen.findByRole("dialog", {
      name: /Duplicar pesquisa/,
    });
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Confirmar duplicação" }),
    );
    expect(await within(gaveta).findByRole("alert")).toHaveTextContent(
      "Não foi possível duplicar a pesquisa. Tente de novo.",
    );
    expect(document.querySelector(".aviso-flutuante")).toBeNull();
    // Cancelar e abrir de novo: a falha antiga não fica.
    fireEvent.click(within(gaveta).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    abrirMenu(`Ações de ${RESUMO.nome}`);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicar" }));
    const deNovo = await screen.findByRole("dialog", {
      name: /Duplicar pesquisa/,
    });
    expect(within(deNovo).queryByRole("alert")).toBeNull();
  });

  it("falha ao finalizar pela janela de exclusão: o erro na própria janela", async () => {
    const servico = servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista([RESUMO]))),
      alterarStatusDaPesquisa: vi.fn(() => Promise.reject(new Error("x"))),
    });
    render(<PesquisasModulo servico={servico} podeEditar />);
    await screen.findByRole("table", { name: "Pesquisas" });
    abrirMenu(`Ações de ${RESUMO.nome}`);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Excluir pesquisa" }),
    );
    const janela = await screen.findByRole("dialog", { name: /Excluir/ });
    fireEvent.click(
      within(janela).getByRole("button", { name: "Finalizar pesquisa" }),
    );
    expect(await within(janela).findByRole("alert")).toHaveTextContent(
      "Não foi possível finalizar a pesquisa. Tente de novo.",
    );
    expect(document.querySelector(".aviso-flutuante")).toBeNull();
  });
});

describe("R3-A-29 — o aviso não cobre o rodapé de uma gaveta", () => {
  it("com uma janela aberta, o aviso sobe acima do rodapé dela", () => {
    expect(css("../../ui/AvisoFlutuante.css")).toMatch(
      /body:has\(\.ev-janela__rodape\) \.aviso-flutuante \{[^}]*bottom: calc\(var\(--altura-rodape-pagina\)/,
    );
  });
});

describe("R3-A-06 — recorte que falha", () => {
  function montarResultados(resultados: ReturnType<typeof vi.fn>) {
    const servico = servicoFalso({ resultadosDaPesquisa: resultados as never });
    render(
      <ResultadosDaPesquisa
        servico={servico}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    return servico;
  }

  it("mostra o erro com 'Tentar novamente' e nunca os números gerais sob o filtro", async () => {
    let falhar = true;
    const resultados = vi.fn((_id: string, recorte?: unknown) =>
      recorte
        ? falhar
          ? Promise.reject(Object.assign(new Error("x"), { status: 500 }))
          : Promise.resolve({ ...RESULTADOS, respostas: 6 })
        : Promise.resolve(RESULTADOS),
    );
    montarResultados(resultados);
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(screen.getByRole("option", { name: "Operações" }));
    const erro = await screen.findByRole("alert");
    expect(erro).toHaveTextContent(
      "Não foi possível carregar os resultados deste filtro.",
    );
    expect(screen.queryByText(/Mostrando/)).toBeNull();
    expect(
      document.querySelectorAll(".pesquisas__resultados .pesquisas__cartao")
        .length,
    ).toBe(0);
    falhar = false;
    fireEvent.click(
      within(erro).getByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      await screen.findByText(/Mostrando 6 respostas de 8/),
    ).toBeInTheDocument();
    expect(resultados).toHaveBeenLastCalledWith("p-1", "d-1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uma resposta atrasada de um filtro antigo não substitui a do filtro atual", async () => {
    let soltarAntigo: (v: unknown) => void = () => undefined;
    const resultados = vi.fn((_id: string, recorte?: unknown) => {
      if (recorte === "d-1")
        return new Promise((r) => {
          soltarAntigo = r;
        });
      if (recorte === "d-2")
        return Promise.resolve({
          ...RESULTADOS,
          respostas: 2,
          filtro: { departamentoId: "d-2", visivel: true },
        });
      return Promise.resolve(RESULTADOS);
    });
    montarResultados(resultados);
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(screen.getByRole("option", { name: "Operações" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(screen.getByRole("option", { name: "Financeiro" }));
    expect(
      await screen.findByText(/Mostrando 2 respostas de 8/),
    ).toBeInTheDocument();
    soltarAntigo({ ...RESULTADOS, respostas: 6 });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByText(/Mostrando 2 respostas de 8/)).toBeInTheDocument();
  });
});

describe("R3-A-27 — o seletor dos resultados", () => {
  it("abre para baixo mesmo perto do pé da tela, e mais largo", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso()}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    const campo = screen.getByRole("combobox", { name: "Departamento" });
    vi.spyOn(campo, "getBoundingClientRect").mockReturnValue({
      top: window.innerHeight - 50,
      bottom: window.innerHeight - 10,
      left: 0,
      right: 100,
      width: 100,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.click(campo);
    const listaAberta = screen.getByRole("listbox");
    expect(listaAberta).not.toHaveClass("lista-escolha__lista--acima");
    const regras = css("Pesquisas.css");
    expect(regras).toMatch(
      /\.pesquisas__secao-cabeca \.pesquisas__filtro-lista \.lista-escolha \{[^}]*min-width: 12rem/,
    );
    expect(regras).toMatch(
      /\.pesquisas__secao-cabeca \.pesquisas__filtro-lista \.lista-escolha__lista \{[^}]*right: 0;[^}]*left: auto;[^}]*width: max-content/,
    );
  });
});

describe("R3-A-28 — menus de status e Exportar com respiro", () => {
  it("os menus com duas linhas por item levam a classe de respiro", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso()}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    abrirMenu("Exportar");
    expect(await screen.findByRole("menu")).toHaveClass(
      "pesquisas__menu--opcoes",
    );
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    abrirMenu(/Mudar status/);
    expect(await screen.findByRole("menu")).toHaveClass(
      "pesquisas__menu--opcoes",
    );
    expect(css("Pesquisas.css")).toMatch(
      /\.pesquisas__menu--opcoes \[role="menuitem"\] \{[^}]*padding-block: var\(--space-xs\)/,
    );
    expect(css("Pesquisas.css")).toMatch(
      /\.pesquisas__menu--opcoes \{[^}]*gap: var\(--space-xxs\)/,
    );
  });
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

describe("R3-A-07 e R3-A-08 — contadores e estado vazio da lista", () => {
  const comLista = (itens: PesquisaResumo[]) =>
    servicoFalso({
      listarPesquisas: vi.fn(() => Promise.resolve(lista(itens))),
    });
  const contagens = () =>
    within(screen.getByRole("group", { name: "Status" }))
      .getAllByRole("button")
      .map((b) => b.textContent);

  it("as pílulas contam só o que a busca encontra; sem resultado, todas zeram", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    await screen.findByRole("table", { name: "Pesquisas" });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar pesquisa" }),
      {
        target: { value: "pulso" },
      },
    );
    expect(contagens()).toEqual([
      "Todas1",
      "Ativas0",
      "Pausadas1",
      "Finalizadas0",
      "Canceladas0",
    ]);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar pesquisa" }),
      {
        target: { value: "zzz" },
      },
    );
    expect(contagens()).toEqual([
      "Todas0",
      "Ativas0",
      "Pausadas0",
      "Finalizadas0",
      "Canceladas0",
    ]);
  });

  it("sem resultado: ícone, título, ajuda e 'Limpar filtros' que devolve tudo", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar pesquisa" }),
      {
        target: { value: "zzz" },
      },
    );
    const vazio = within(tabela).getByRole("heading", {
      name: "Nenhuma pesquisa encontrada",
    });
    const caixa = vazio.closest(".evolli-empty-state")!;
    expect(caixa.querySelector(".evolli-empty-state__icon svg")).not.toBeNull();
    expect(caixa).toHaveTextContent(
      "Tente outra busca ou limpe os filtros para ver todas as pesquisas.",
    );
    fireEvent.click(
      within(tabela).getByRole("button", { name: "Limpar filtros" }),
    );
    expect(
      screen.getByRole("searchbox", { name: "Buscar pesquisa" }),
    ).toHaveValue("");
    expect(within(tabela).getAllByRole("row")).toHaveLength(3);
  });

  it("pílula sem pesquisas também usa o estado vazio; colunas com largura fixa", async () => {
    render(
      <PesquisasModulo servico={comLista([RESUMO, ANONIMA])} podeEditar />,
    );
    const tabela = await screen.findByRole("table", { name: "Pesquisas" });
    fireEvent.click(screen.getByRole("button", { name: /Finalizadas/ }));
    expect(
      within(tabela).getByRole("heading", {
        name: "Nenhuma pesquisa encontrada",
      }),
    ).toBeInTheDocument();
    expect(tabela).toHaveClass("pesquisas__tabela--colunas-fixas");
    expect(tabela.querySelectorAll("colgroup col")).toHaveLength(5);
    fireEvent.click(
      within(tabela).getByRole("button", { name: "Limpar filtros" }),
    );
    expect(screen.getByRole("button", { name: /Todas/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(css("Pesquisas.css")).toMatch(
      /\.pesquisas__tabela--colunas-fixas \{[^}]*table-layout: fixed/,
    );
  });
});

function LeitorDaTrilha() {
  const c = useComplementoDaTrilha();
  return (
    <nav aria-label="Trilha">
      <button type="button" onClick={c?.onVoltar}>
        Pesquisas
      </button>
      {c?.niveis.map((n, i) =>
        n.onSelecionar && i < c.niveis.length - 1 ? (
          <button key={i} type="button" onClick={n.onSelecionar}>
            {n.rotulo}
          </button>
        ) : (
          <span key={i} aria-current="page">
            {n.rotulo}
          </span>
        ),
      )}
    </nav>
  );
}

describe("R3-A-09 — trilha com vários níveis", () => {
  function montarNaRota(rota: RotaDePesquisas, extra = {}) {
    const onNavegar = vi.fn();
    const servico = servicoFalso(extra);
    render(
      <ProvedorDeTrilhaComplementar>
        <PesquisasModulo
          servico={servico}
          podeEditar
          rota={rota}
          onNavegar={onNavegar}
        />
        <LeitorDaTrilha />
      </ProvedorDeTrilhaComplementar>,
    );
    return {
      onNavegar,
      trilha: screen.getByRole("navigation", { name: "Trilha" }),
    };
  }
  const textos = (trilha: HTMLElement) =>
    [...trilha.children].map((n) => n.textContent);

  it("sobre o modelo: Pesquisas / Nova pesquisa / o modelo", async () => {
    const { trilha, onNavegar } = montarNaRota({
      tela: "sobre",
      modelo: "pulso",
    });
    await waitFor(() =>
      expect(textos(trilha)).toEqual([
        "Pesquisas",
        "Nova pesquisa",
        "Pesquisa Pulso",
      ]),
    );
    fireEvent.click(
      within(trilha).getByRole("button", { name: "Nova pesquisa" }),
    );
    expect(onNavegar).toHaveBeenLastCalledWith({ tela: "nova" }, undefined);
  });

  it("assistente do modelo: Pesquisas / Nova pesquisa / o modelo", async () => {
    const { trilha } = montarNaRota({ tela: "modelo", modelo: "enps" });
    await waitFor(() =>
      expect(textos(trilha)).toEqual(["Pesquisas", "Nova pesquisa", "eNPS"]),
    );
  });

  it("rascunho retomado: o modelo do rascunho", async () => {
    const { trilha } = montarNaRota(
      { tela: "rascunho", id: "p-r" },
      { obterPesquisa: vi.fn(() => Promise.resolve(RASCUNHO)) },
    );
    await waitFor(() =>
      expect(textos(trilha)).toEqual([
        "Pesquisas",
        "Nova pesquisa",
        "Pesquisa Pulso",
      ]),
    );
  });

  it("rascunho de uma personalizada: Pesquisa personalizada", async () => {
    const { trilha } = montarNaRota(
      { tela: "rascunho", id: "p-r" },
      {
        obterPesquisa: vi.fn(() =>
          Promise.resolve({ ...RASCUNHO, modelo: "personalizada" as const }),
        ),
      },
    );
    await waitFor(() =>
      expect(textos(trilha)).toEqual([
        "Pesquisas",
        "Nova pesquisa",
        "Pesquisa personalizada",
      ]),
    );
  });

  it("personalizada (página e assistente): Pesquisas / Nova pesquisa / Pesquisa personalizada", async () => {
    const { trilha } = montarNaRota({ tela: "aberta", roteiro: "branco" });
    await waitFor(() =>
      expect(textos(trilha)).toEqual([
        "Pesquisas",
        "Nova pesquisa",
        "Pesquisa personalizada",
      ]),
    );
  });

  it("resultados: o nome da pesquisa; 'Pesquisas' volta à lista", async () => {
    const { trilha, onNavegar } = montarNaRota({
      tela: "resultados",
      id: "p-1",
      aba: "geral",
    });
    await waitFor(() =>
      expect(textos(trilha)).toEqual(["Pesquisas", DETALHE.nome]),
    );
    fireEvent.click(within(trilha).getByRole("button", { name: "Pesquisas" }));
    expect(onNavegar).toHaveBeenLastCalledWith({ tela: "lista" }, undefined);
  });
});

describe("R3-A-25 — finalizada", () => {
  const FINALIZADA: PesquisaResumo = { ...RESUMO, status: "finalizada" };

  it("o menu da linha mantém Editar e mostra 'Copiar link' desabilitado", async () => {
    render(
      <PesquisasModulo
        servico={servicoFalso({
          listarPesquisas: vi.fn(() => Promise.resolve(lista([FINALIZADA]))),
        })}
        podeEditar
      />,
    );
    // Espera a linha (e não só a tabela): a lista ainda pode redesenhar.
    await screen.findByRole("button", { name: `Ações de ${RESUMO.nome}` });
    abrirMenu(`Ações de ${RESUMO.nome}`);
    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: "Editar pesquisa" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Copiar link" }),
      ).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("o cabeçalho dos resultados mantém Editar e 'Copiar link' desabilitado", async () => {
    const onEditar = vi.fn();
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() =>
            Promise.resolve({ ...DETALHE, status: "finalizada" as const }),
          ),
        })}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={onEditar}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEditar).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeDisabled();
  });

  it("editar a finalizada: o encerramento fica e o prazo vencido não trava salvar", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() =>
        Promise.resolve({
          ...DETALHE,
          status: "finalizada" as const,
          encerraEm: "2026-11-21T02:59:00.000Z",
        }),
      ),
    });
    const onSalvo = vi.fn();
    render(
      <EditarPesquisa
        servico={servico}
        pesquisaId="p-1"
        hoje="2026-11-27"
        onVoltar={vi.fn()}
        onSalvo={onSalvo}
      />,
    );
    const nome = await screen.findByLabelText("Nome da pesquisa");
    expect(
      screen.getByText(
        "Pesquisa finalizada: o encerramento não muda e o link não volta a aceitar respostas.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Encerrar automaticamente" }),
    ).toBeNull();
    fireEvent.change(nome, { target: { value: "Clima renomeado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    const [, entrada] = servico.alterarPesquisa.mock.calls.at(-1)!;
    expect(entrada.nome).toBe("Clima renomeado");
    // O valor do campo da API (dia e hora de Brasília), o mesmo de antes.
    expect(entrada.encerraEm).toBe(["2026-11-20", "23:59"].join("T"));
  });

  it("cancelada continua sem Editar", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() =>
            Promise.resolve({ ...DETALHE, status: "cancelada" as const }),
          ),
        })}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar link" })).toBeNull();
  });
});

describe("R3-A-30 — assistente volta ao topo; rodapé no pé da tela", () => {
  it("trocar de etapa e gerar levam ao topo da página", async () => {
    const rolar = vi.fn();
    const original = Element.prototype.scrollTo;
    Element.prototype.scrollTo = rolar as never;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((f) => {
      f(0);
      return 0;
    });
    try {
      render(
        <AssistenteDoModelo
          servico={servicoFalso()}
          base={RASCUNHO}
          hoje="2026-11-27"
          onCancelar={vi.fn()}
          onConcluir={vi.fn()}
          onVerResultados={vi.fn()}
          onEditarGerada={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
      expect(rolar).toHaveBeenLastCalledWith({ top: 0 });
      const chamadas = rolar.mock.calls.length;
      fireEvent.click(
        await screen.findByRole("button", { name: /Gerar pesquisa/ }),
      );
      await screen.findByRole("region", { name: "Pesquisa criada e ativa" });
      expect(rolar.mock.calls.length).toBeGreaterThan(chamadas);
      expect(rolar).toHaveBeenLastCalledWith({ top: 0 });
    } finally {
      Element.prototype.scrollTo = original;
    }
  });

  it("com conteúdo curto, o rodapé fica no pé da tela", () => {
    const regras = css("Pesquisas.css");
    expect(regras).toMatch(
      /\.pesquisas\.pesquisas--com-rodape \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*min-height: calc\( ?100dvh - var\(--altura-barra-superior, 60px\) - var\(--main-recuo-y, 0px\) ?\)/,
    );
    expect(regras).toMatch(
      /\.pesquisas--com-rodape > \.pesquisas__rodape \{[^}]*margin-top: auto/,
    );
  });
});

describe("R3-A-34 — rotas inválidas", () => {
  it("pesquisa inexistente: 'Pesquisa não encontrada' com volta à lista", async () => {
    const onVoltar = vi.fn();
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() =>
            Promise.reject(Object.assign(new Error("x"), { status: 400 })),
          ),
        })}
        pesquisaId="personalizada"
        podeEditar
        onVoltar={onVoltar}
        onEditar={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Pesquisa não encontrada",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver todas as pesquisas" }),
    );
    expect(onVoltar).toHaveBeenCalled();
  });

  it("404 também é 'não encontrada'; outra falha oferece tentar de novo", async () => {
    let status = 404;
    const obter = vi.fn(() =>
      Promise.reject(Object.assign(new Error("x"), { status })),
    );
    const { unmount } = render(
      <ResultadosDaPesquisa
        servico={servicoFalso({ obterPesquisa: obter })}
        pesquisaId="p-x"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Pesquisa não encontrada" }),
    ).toBeInTheDocument();
    unmount();
    status = 500;
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({ obterPesquisa: obter })}
        pesquisaId="p-x"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("Não foi possível carregar os resultados."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();
  });

  it("rascunho com endereço inválido: 'não encontrada' com volta à lista", async () => {
    const onNavegar = vi.fn();
    render(
      <PesquisasModulo
        servico={servicoFalso({
          obterPesquisa: vi.fn(() =>
            Promise.reject(Object.assign(new Error("x"), { status: 400 })),
          ),
        })}
        podeEditar
        rota={{ tela: "rascunho", id: "qualquer" }}
        onNavegar={onNavegar}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Pesquisa não encontrada" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver todas as pesquisas" }),
    );
    expect(onNavegar).toHaveBeenLastCalledWith({ tela: "lista" }, undefined);
  });

  it("resultado individual com falha: tentar de novo e voltar", async () => {
    let falhar = true;
    const obter = vi.fn(() =>
      falhar
        ? Promise.reject(Object.assign(new Error("x"), { status: 500 }))
        : Promise.resolve(DETALHE),
    );
    const onVoltar = vi.fn();
    render(
      <ResultadoIndividual
        servico={servicoFalso({ obterPesquisa: obter })}
        pesquisaId="p-1"
        respostaId="r-1"
        onVoltar={onVoltar}
        onLista={vi.fn()}
        onIr={vi.fn()}
      />,
    );
    const erro = await screen.findByRole("alert");
    expect(erro).toHaveTextContent("Não foi possível carregar a pesquisa.");
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para os resultados" }),
    );
    expect(onVoltar).toHaveBeenCalled();
    falhar = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(obter).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("resultado individual de pesquisa inexistente: 'não encontrada'", async () => {
    render(
      <ResultadoIndividual
        servico={servicoFalso({
          obterPesquisa: vi.fn(() =>
            Promise.reject(Object.assign(new Error("x"), { status: 404 })),
          ),
        })}
        pesquisaId="p-x"
        respostaId="r-1"
        onVoltar={vi.fn()}
        onLista={vi.fn()}
        onIr={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Pesquisa não encontrada" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).toBeNull();
  });

  it("a resposta que falha também oferece tentar de novo", async () => {
    let falhar = true;
    const carregar = vi.fn((_p: string, id: string) =>
      falhar
        ? Promise.reject(new Error("x"))
        : Promise.resolve({ ...RESPOSTA_DETALHE, id }),
    );
    render(
      <ResultadoIndividual
        servico={servicoFalso({ respostaDaPesquisa: carregar })}
        pesquisaId="p-1"
        respostaId="r-1"
        onVoltar={vi.fn()}
        onLista={vi.fn()}
        onIr={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("Não foi possível carregar a resposta."),
    ).toBeInTheDocument();
    falhar = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(carregar).toHaveBeenCalledTimes(2));
  });
});
