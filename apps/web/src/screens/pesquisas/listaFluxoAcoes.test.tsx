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
