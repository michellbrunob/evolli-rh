import { readFileSync } from "node:fs";
import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SeletorColaboradorPaginado,
  type ColaboradorEscolhido,
} from "./SeletorColaboradorPaginado";
import {
  listarColaboradores,
  type ColaboradorListadoApi,
  type ListagemColaboradoresApi,
  type ListarColaboradoresQuery,
} from "../../api/colaboradoresClient";

vi.mock("../../api/colaboradoresClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/colaboradoresClient")>()),
  listarColaboradores: vi.fn(),
}));

/**
 * T188 — escolha de colaborador por busca paginada no servidor, sem o teto de
 * 100. O dublê do servidor pagina, busca (nome ou matrícula, sem diferenciar
 * maiúsculas) e filtra por situação, como `GET /v1/colaboradores` (T178).
 */

function sintetico(n: number, situacao: "ativo" | "inativo" = "ativo") {
  const numero = String(n).padStart(3, "0");
  return {
    id: `c-${numero}`,
    nome: `Pessoa Teste ${numero}`,
    situacao,
    criadoEm: "2026-01-01T12:00:00.000Z",
    atualizadoEm: "2026-01-01T12:00:00.000Z",
    vinculos: [
      {
        id: `v-${numero}`,
        empresaId: "e-1",
        matricula: `MAT-${numero}`,
        situacao: "ativo",
        dataAdmissao: "2025-01-01",
        dataDesligamento: null,
        lotacaoVigente: null,
        vigenciasDeJornada: [],
      },
    ],
  } as ColaboradorListadoApi;
}

/** 150 pessoas: acima do antigo teto de 100. A 130ª é a prova. */
const EMPRESA_GRANDE = Array.from({ length: 150 }, (_, i) => sintetico(i + 1));

function servidor(lista: readonly ColaboradorListadoApi[]) {
  vi.mocked(listarColaboradores).mockImplementation(
    async (q: ListarColaboradoresQuery = {}) => {
      const termo = (q.busca ?? "").toLowerCase();
      const filtrada = lista.filter(
        (c) =>
          (!q.situacao || c.situacao === q.situacao) &&
          (!termo ||
            c.nome.toLowerCase().includes(termo) ||
            c.vinculos.some((v) =>
              (v.matricula ?? "").toLowerCase().includes(termo),
            )),
      );
      const pagina = q.pagina ?? 1;
      const tamanho = q.tamanhoPagina ?? 20;
      return {
        itens: filtrada.slice((pagina - 1) * tamanho, pagina * tamanho),
        pagina,
        tamanhoPagina: tamanho,
        total: filtrada.length,
        contadores: { ativos: 0, inativos: 0 },
      } as ListagemColaboradoresApi;
    },
  );
}

function Contenedor(props: {
  inicial?: ColaboradorEscolhido | null;
  onSelecionar?: (c: ColaboradorEscolhido | null) => void;
  situacao?: "ativo";
  autoSelecionarUnico?: boolean;
  rotuloLimpar?: string;
}) {
  // Estado de verdade, como nas telas: a seleção é do contêiner.
  const [selecionado, setSelecionado] = useState<ColaboradorEscolhido | null>(
    props.inicial ?? null,
  );
  return (
    <SeletorColaboradorPaginado
      id="teste"
      selecionado={selecionado}
      onSelecionar={(c) => {
        setSelecionado(c);
        props.onSelecionar?.(c);
      }}
      {...(props.situacao ? { situacao: props.situacao } : {})}
      {...(props.autoSelecionarUnico ? { autoSelecionarUnico: true } : {})}
      {...(props.rotuloLimpar ? { rotuloLimpar: props.rotuloLimpar } : {})}
    />
  );
}

const campo = () =>
  screen.getByLabelText("Buscar colaborador por nome ou matrícula");
const resultados = () =>
  screen.findByRole("list", { name: "Colaboradores encontrados" });

async function buscar(termo: string) {
  fireEvent.change(campo(), { target: { value: termo } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  servidor(EMPRESA_GRANDE);
});

describe("T188 — seletor: acima do antigo teto de 100", () => {
  it("encontra e escolhe a 130ª pessoa pelo nome", async () => {
    const onSelecionar = vi.fn();
    render(<Contenedor onSelecionar={onSelecionar} />);
    await resultados();
    await buscar("Pessoa Teste 130");
    const lista = await resultados();
    fireEvent.click(
      within(lista).getByRole("button", { name: /^Pessoa Teste 130/ }),
    );
    expect(onSelecionar).toHaveBeenCalledWith({
      id: "c-130",
      nome: "Pessoa Teste 130",
    });
    expect(
      screen.getByText("Pessoa Teste 130", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("encontra pela matrícula, consultando o servidor", async () => {
    render(<Contenedor />);
    await resultados();
    await buscar("mat-121");
    const lista = await resultados();
    expect(
      within(lista)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Pessoa Teste 121 · MAT-121"]);
    expect(listarColaboradores).toHaveBeenLastCalledWith({
      pagina: 1,
      tamanhoPagina: 10,
      busca: "mat-121",
    });
  });

  it("navega página a página até depois da centésima posição", async () => {
    render(<Contenedor />);
    await resultados();
    expect(screen.getByText("Página 1 de 15")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    for (let i = 0; i < 10; i++) {
      fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
      await screen.findByText(`Página ${i + 2} de 15`);
    }
    const lista = await resultados();
    // Página 11: posições 101 a 110 — antes, inalcançáveis.
    expect(within(lista).getAllByRole("button")[0]).toHaveTextContent(
      "Pessoa Teste 101",
    );
    expect(listarColaboradores).toHaveBeenLastCalledWith({
      pagina: 11,
      tamanhoPagina: 10,
    });
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
      await screen.findByText(`Página ${12 + i} de 15`);
    }
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("a paginação é uma navegação rotulada, com a posição anunciada", async () => {
    render(<Contenedor />);
    await resultados();
    const nav = screen.getByRole("navigation", {
      name: "Páginas de colaboradores encontrados",
    });
    expect(within(nav).getByText("Página 1 de 15")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});

describe("T188 — seletor: estados", () => {
  it("busca sem resultado diz o termo; escopo vazio diz que não há ninguém", async () => {
    render(<Contenedor />);
    await resultados();
    await buscar("zzz");
    expect(
      await screen.findByText("Nenhum colaborador encontrado para “zzz”."),
    ).toBeInTheDocument();

    servidor([]);
    const { unmount } = render(<Contenedor />);
    expect(
      await screen.findAllByText("Nenhum colaborador no seu escopo."),
    ).toHaveLength(1);
    unmount();
  });

  it("carregando aparece como status; erro do servidor oferece nova tentativa sem dado", async () => {
    vi.mocked(listarColaboradores).mockRejectedValueOnce(
      Object.assign(new Error("recusado"), { status: 403 }),
    );
    render(<Contenedor />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Buscando colaboradores…",
    );
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Não foi possível buscar os colaboradores.",
    );
    expect(screen.queryByText(/Pessoa Teste/)).toBeNull();
    fireEvent.click(
      within(alerta).getByRole("button", { name: "Tentar novamente" }),
    );
    await resultados();
  });

  it("a seleção continua quando a busca muda e ela some dos resultados", async () => {
    render(<Contenedor rotuloLimpar="Limpar seleção" />);
    const lista = await resultados();
    fireEvent.click(
      within(lista).getByRole("button", { name: /^Pessoa Teste 003/ }),
    );
    await buscar("Pessoa Teste 140");
    const nova = await resultados();
    expect(within(nova).queryByText(/Pessoa Teste 003/)).toBeNull();
    expect(
      screen.getByText("Pessoa Teste 003", { selector: "strong" }),
    ).toBeInTheDocument();
    // Desfazer é explícito.
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(
      screen.getByText("Nenhum colaborador selecionado."),
    ).toBeInTheDocument();
  });

  it("o escolhido aparece pressionado na lista", async () => {
    render(<Contenedor inicial={{ id: "c-002", nome: "Pessoa Teste 002" }} />);
    const lista = await resultados();
    expect(
      within(lista).getByRole("button", { name: /^Pessoa Teste 002/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(lista).getByRole("button", { name: /^Pessoa Teste 001/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("troca de empresa: montagem nova só mostra quem a outra empresa devolve", async () => {
    const { unmount } = render(
      <Contenedor inicial={{ id: "c-001", nome: "Pessoa Teste 001" }} />,
    );
    await resultados();
    unmount();
    // O shell remonta a árvore na troca; a outra empresa devolve outra lista.
    servidor([sintetico(900)]);
    render(<Contenedor />);
    const lista = await resultados();
    expect(
      within(lista)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Pessoa Teste 900 · MAT-900"]);
    expect(
      screen.getByText("Nenhum colaborador selecionado."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pessoa Teste 001/)).toBeNull();
  });

  it("resposta atrasada de uma busca antiga é descartada", async () => {
    let resolverAntiga: (v: ListagemColaboradoresApi) => void = () => {};
    render(<Contenedor />);
    await resultados();
    vi.mocked(listarColaboradores).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverAntiga = resolve;
        }),
    );
    await buscar("antiga");
    servidor(EMPRESA_GRANDE);
    await buscar("Pessoa Teste 050");
    await screen.findByRole("button", { name: /^Pessoa Teste 050/ });
    await act(async () => {
      resolverAntiga({
        itens: [sintetico(77)],
        pagina: 1,
        tamanhoPagina: 10,
        total: 1,
        contadores: { ativos: 0, inativos: 0 },
      });
    });
    expect(screen.queryByText(/Pessoa Teste 077/)).toBeNull();
  });
});

describe("T188 — seletor: regras das abas", () => {
  it("filtro de situação vai ao servidor (Horário: só ativos)", async () => {
    servidor([sintetico(1), sintetico(2, "inativo")]);
    render(<Contenedor situacao="ativo" />);
    const lista = await resultados();
    expect(within(lista).getAllByRole("button")).toHaveLength(1);
    expect(listarColaboradores).toHaveBeenLastCalledWith({
      pagina: 1,
      tamanhoPagina: 10,
      situacao: "ativo",
    });
  });

  it("um só no escopo: escolhido sozinho na carga inicial", async () => {
    servidor([sintetico(1)]);
    const onSelecionar = vi.fn();
    render(<Contenedor autoSelecionarUnico onSelecionar={onSelecionar} />);
    await resultados();
    expect(onSelecionar).toHaveBeenCalledWith({
      id: "c-001",
      nome: "Pessoa Teste 001",
    });
  });

  it("buscar nunca escolhe sozinho, nem com um só resultado", async () => {
    const onSelecionar = vi.fn();
    render(<Contenedor autoSelecionarUnico onSelecionar={onSelecionar} />);
    await resultados();
    await buscar("Pessoa Teste 042");
    await screen.findByRole("button", { name: /^Pessoa Teste 042/ });
    expect(onSelecionar).not.toHaveBeenCalled();
  });

  it("Enter no campo busca, sem enviar o formulário de fora", async () => {
    const enviar = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    render(
      <form onSubmit={enviar}>
        <Contenedor />
      </form>,
    );
    await resultados();
    fireEvent.change(campo(), { target: { value: "Pessoa Teste 099" } });
    fireEvent.keyDown(campo(), { key: "Enter" });
    await screen.findByRole("button", { name: /^Pessoa Teste 099/ });
    expect(enviar).not.toHaveBeenCalled();
    for (const botao of screen.getAllByRole("button")) {
      expect(botao).toHaveAttribute("type", "button");
    }
  });
});

describe("T188 — contrato de CSS para 375 px", () => {
  const css = readFileSync(
    "src/screens/pessoas/SeletorColaboradorPaginado.css",
    "utf8",
  );
  const historico = readFileSync(
    "src/screens/pessoas/HistoricoFuncionalScreen.css",
    "utf8",
  );
  const corpo = (texto: string, seletor: string) => {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
      "m",
    ).exec(texto);
    return m ? (m[1] ?? "") : null;
  };

  it("seletor, busca, lista e paginação encolhem e quebram linha", () => {
    expect(corpo(css, ".pessoas-seletor-colaborador")).toMatch(
      /min-width:\s*0;/,
    );
    expect(corpo(css, ".pessoas-seletor-colaborador__busca")).toMatch(
      /flex-wrap:\s*wrap;/,
    );
    expect(
      corpo(css, ".pessoas-seletor-colaborador__lista .evolli-button"),
    ).toMatch(/overflow-wrap:\s*anywhere;/);
    expect(corpo(css, ".pessoas-paginacao")).toMatch(/flex-wrap:\s*wrap;/);
  });

  it("resultado é bloco: nome e matrícula correm juntos, sem virar colunas", () => {
    const regra = corpo(
      css,
      ".pessoas-seletor-colaborador__lista .evolli-button",
    );
    expect(regra).toMatch(/display:\s*block;/);
    expect(regra).toMatch(/width:\s*100%;/);
  });

  it("Histórico funcional no celular: cada filtro ocupa só o próprio conteúdo", () => {
    // Em coluna, `flex-basis: 12rem` virava altura (192 px por campo).
    expect(historico).toMatch(
      /@media \(max-width: 640px\)[\s\S]*__filtros > \.evolli-field,[\s\S]*?flex:\s*0 0 auto;/,
    );
  });

  it("Histórico funcional: o quadro da tabela contém os textos de leitor de tela", () => {
    // Causa medida do transbordamento antigo (T115): `.sr-only` absoluto
    // escapava do quadro rolável. Posicionado, o quadro os contém.
    expect(
      corpo(historico, ".historico-funcional-screen .evolli-datatable"),
    ).toMatch(/position:\s*relative;/);
  });
});
