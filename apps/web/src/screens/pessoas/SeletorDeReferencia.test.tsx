import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type ListarReferencias,
  type ReferenciaEscolhida,
  SeletorDeReferencia,
} from "./SeletorDeReferencia";

/**
 * T196 — o seletor pesquisável das referências da lotação. A consulta é
 * dublê; valores sintéticos.
 */

function ref(i: number): ReferenciaEscolhida {
  const n = String(i).padStart(3, "0");
  return { id: `id-${n}`, codigo: `R${n}`, nome: `Referencia ${n}` };
}

const TODAS = Array.from({ length: 45 }, (_, k) => ref(k + 1));

/** Servidor dublê: busca por código ou nome, 20 por página. */
function servidor(itens: readonly ReferenciaEscolhida[] = TODAS) {
  return vi.fn<ListarReferencias>(async ({ busca, pagina }) => {
    const termo = (busca ?? "").toLowerCase();
    const filtrados = itens.filter(
      (r) =>
        r.codigo.toLowerCase().includes(termo) ||
        r.nome.toLowerCase().includes(termo),
    );
    return {
      itens: filtrados.slice((pagina - 1) * 20, pagina * 20),
      total: filtrados.length,
      pagina,
      tamanhoPagina: 20,
    };
  });
}

function Montado({
  listar,
  inicial = null,
  obrigatorio = true,
}: {
  listar: ListarReferencias;
  inicial?: ReferenciaEscolhida | null;
  obrigatorio?: boolean;
}) {
  const [escolhida, setEscolhida] = useState(inicial);
  return (
    <form aria-label="Formulário" onSubmit={(e) => e.preventDefault()}>
      <SeletorDeReferencia
        id="campo-departamento"
        rotulo="Departamento"
        rotuloVisivel={obrigatorio ? "Departamento" : "Departamento (opcional)"}
        plural="departamentos"
        nenhum="Nenhum"
        ativo="ativo"
        obrigatorio={obrigatorio}
        escolhida={escolhida}
        onEscolher={setEscolhida}
        listar={listar}
      />
      <button type="submit">Continuar</button>
    </form>
  );
}

const campo = () => screen.getByRole("combobox", { name: /^Departamento/ });
const lista = () => screen.getByRole("listbox", { hidden: true });
const opcoes = () =>
  within(lista())
    .queryAllByRole("option", { hidden: true })
    .map((o) => o.textContent);
const escolha = () => document.getElementById("campo-departamento-escolha")!;
const status = () => screen.getByRole("status");

describe("T196 — SeletorDeReferencia: abrir e ler", () => {
  it("é um combobox com lista, ligado à escolha atual, e começa fechado sem consultar", () => {
    const listar = servidor();
    render(<Montado listar={listar} />);
    expect(campo()).toHaveAttribute("aria-expanded", "false");
    expect(campo()).toHaveAttribute("aria-autocomplete", "list");
    expect(campo()).toHaveAttribute("aria-controls", lista().id);
    expect(campo()).toHaveAccessibleDescription(/Nenhuma escolha\./);
    expect(campo()).toHaveAttribute("aria-required", "true");
    expect(lista()).toHaveAccessibleName("Resultados de Departamento");
    // Foco (Tab ou erro) não abre nem consulta.
    campo().focus();
    expect(listar).not.toHaveBeenCalled();
  });

  it("seta para baixo abre e mostra os 20 primeiros, anunciando a contagem uma vez", async () => {
    const listar = servidor();
    render(<Montado listar={listar} />);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith({ pagina: 1 });
    expect(campo()).toHaveAttribute("aria-expanded", "true");
    expect(opcoes()[0]).toBe("R001 — Referencia 001");
    expect(status().textContent).toBe("45 resultados; 20 exibidos.");
  });

  it("o botão 'Mostrar opções' também abre, e o foco fica no campo", async () => {
    const listar = servidor();
    render(<Montado listar={listar} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mostrar opções de Departamento" }),
    );
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    expect(campo()).toHaveFocus();
  });

  it("'Mostrar mais' traz a próxima página; sem mais páginas, o botão some e o foco volta ao campo", async () => {
    const listar = servidor();
    render(<Montado listar={listar} />);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    const mais = screen.getByRole("button", { name: "Mostrar mais" });
    mais.focus();
    fireEvent.click(mais);
    await waitFor(() => expect(opcoes()).toHaveLength(40));
    expect(listar).toHaveBeenLastCalledWith({ pagina: 2 });
    expect(status().textContent).toBe("45 resultados; 40 exibidos.");
    expect(screen.getByRole("button", { name: "Mostrar mais" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar mais" }));
    await waitFor(() => expect(opcoes()).toHaveLength(45));
    expect(status().textContent).toBe("45 resultados; 45 exibidos.");
    expect(screen.queryByRole("button", { name: "Mostrar mais" })).toBeNull();
    await waitFor(() => expect(campo()).toHaveFocus());
  });
});

describe("T196 — SeletorDeReferencia: buscar e escolher", () => {
  it("digitar consulta o servidor com o termo, depois de uma espera curta", async () => {
    const listar = servidor();
    render(<Montado listar={listar} />);
    fireEvent.change(campo(), { target: { value: " r04 " } });
    await waitFor(() =>
      expect(listar).toHaveBeenCalledWith({ busca: "r04", pagina: 1 }),
    );
    await waitFor(() =>
      expect(opcoes()).toEqual(
        Array.from({ length: 6 }, (_, k) => `R04${k} — Referencia 04${k}`),
      ),
    );
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it("teclado: setas percorrem (aria-activedescendant), Enter escolhe sem enviar o formulário", async () => {
    const enviar = vi.fn((e: Event) => e.preventDefault());
    const listar = servidor();
    render(<Montado listar={listar} />);
    screen.getByRole("form").addEventListener("submit", enviar);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    fireEvent.keyDown(campo(), { key: "ArrowUp" });
    const ativa = document.getElementById(
      campo().getAttribute("aria-activedescendant")!,
    );
    expect(ativa).toHaveTextContent("R001 — Referencia 001");
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(enviar).not.toHaveBeenCalled();
    expect(escolha()).toHaveTextContent("Escolha atual: R001 — Referencia 001");
    expect(campo()).toHaveAttribute("aria-expanded", "false");
    expect(campo()).toHaveValue("");
    expect(campo()).toHaveFocus();
    expect(status()).toHaveTextContent(
      "Departamento escolhido: R001 — Referencia 001.",
    );
  });

  it("clique numa opção escolhe; a escolhida aparece marcada por texto na lista", async () => {
    render(<Montado listar={servidor()} />);
    fireEvent.click(campo());
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    fireEvent.click(
      within(lista()).getByRole("option", { name: /^R003/, hidden: true }),
    );
    expect(escolha()).toHaveTextContent("R003 — Referencia 003");
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    const marcada = within(lista()).getByRole("option", {
      name: /^R003/,
      hidden: true,
    });
    expect(marcada).toHaveAttribute("aria-selected", "true");
    expect(marcada).toHaveTextContent("(escolha atual)");
  });

  it("Escape fecha a lista e mantém a escolha já feita", async () => {
    render(<Montado listar={servidor()} inicial={ref(7)} />);
    fireEvent.change(campo(), { target: { value: "r01" } });
    await waitFor(() => expect(opcoes().length).toBeGreaterThan(0));
    fireEvent.keyDown(campo(), { key: "Escape" });
    expect(campo()).toHaveAttribute("aria-expanded", "false");
    expect(campo()).toHaveValue("");
    expect(escolha()).toHaveTextContent("R007 — Referencia 007");
  });

  it("a escolha atual segue visível mesmo fora da página mostrada", async () => {
    render(<Montado listar={servidor()} inicial={ref(44)} />);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    expect(opcoes()).not.toContain("R044 — Referencia 044");
    expect(escolha()).toHaveTextContent("Escolha atual: R044 — Referencia 044");
  });

  it("opcional: 'Limpar' remove a escolha; obrigatório não tem 'Limpar'", () => {
    const { unmount } = render(
      <Montado listar={servidor()} inicial={ref(2)} obrigatorio={false} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Limpar Departamento" }),
    );
    expect(escolha()).toHaveTextContent("Nenhuma escolha.");
    expect(campo()).toHaveFocus();
    unmount();
    render(<Montado listar={servidor()} inicial={ref(2)} />);
    expect(
      screen.queryByRole("button", { name: "Limpar Departamento" }),
    ).toBeNull();
  });
});

describe("T196 — SeletorDeReferencia: vazio, falha e respostas fora de ordem", () => {
  it("busca sem resultado diz isso; sem nenhum item, diz que não há ativo", async () => {
    render(<Montado listar={servidor()} />);
    fireEvent.change(campo(), { target: { value: "inexistente" } });
    expect(
      await screen.findByText(
        "Nenhum departamento ativo encontrado para a busca.",
      ),
    ).toBeInTheDocument();
    expect(status()).toHaveTextContent("Nenhum departamento encontrado.");
  });

  it("falha: mensagem, escolha mantida e 'Tentar de novo' consulta outra vez, com o foco no campo", async () => {
    const listar = vi
      .fn<ListarReferencias>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(servidor());
    render(<Montado listar={listar} inicial={ref(5)} />);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar departamentos. A escolha atual foi mantida.",
    );
    expect(escolha()).toHaveTextContent("R005 — Referencia 005");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    expect(listar).toHaveBeenCalledTimes(2);
    expect(campo()).toHaveFocus();
  });

  it("resposta atrasada de uma busca anterior é descartada", async () => {
    let liberarAntiga: () => void = () => {};
    const listar = vi.fn<ListarReferencias>(({ busca, pagina }) => {
      if (busca === "r01") {
        return new Promise((resolve) => {
          liberarAntiga = () =>
            resolve({
              itens: [ref(10)],
              total: 1,
              pagina,
              tamanhoPagina: 20,
            });
        });
      }
      return Promise.resolve({
        itens: [ref(30)],
        total: 1,
        pagina,
        tamanhoPagina: 20,
      });
    });
    render(<Montado listar={listar} />);
    fireEvent.change(campo(), { target: { value: "r01" } });
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
    fireEvent.change(campo(), { target: { value: "r03" } });
    await waitFor(() => expect(opcoes()).toEqual(["R030 — Referencia 030"]));
    await act(async () => liberarAntiga());
    expect(opcoes()).toEqual(["R030 — Referencia 030"]);
  });

  it("desmontado (empresa trocada) antes da resposta: nada é aplicado", async () => {
    let liberar: () => void = () => {};
    const listar = vi.fn<ListarReferencias>(
      () =>
        new Promise((resolve) => {
          liberar = () =>
            resolve({
              itens: [ref(1)],
              total: 1,
              pagina: 1,
              tamanhoPagina: 20,
            });
        }),
    );
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<Montado listar={listar} />);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    unmount();
    await act(async () => liberar());
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });

  it("sair do campo com Tab fecha a lista sem mudar a escolha", async () => {
    render(<Montado listar={servidor()} inicial={ref(9)} />);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    await waitFor(() => expect(opcoes()).toHaveLength(20));
    fireEvent.blur(campo(), {
      relatedTarget: screen.getByRole("button", { name: "Continuar" }),
    });
    expect(campo()).toHaveAttribute("aria-expanded", "false");
    expect(escolha()).toHaveTextContent("R009 — Referencia 009");
  });
});

describe("T196 — SeletorDeReferencia: contrato de CSS (375 px e 44 px)", () => {
  const css = readFileSync(
    "src/screens/pessoas/SeletorDeReferencia.css",
    "utf8",
  );

  it("controles com alvo de toque de 44 px", () => {
    for (const seletor of [
      ".seletor-referencia__linha > input",
      ".seletor-referencia__opcao",
      ".seletor-referencia__acao",
      ".seletor-referencia__limpar",
    ]) {
      const bloco = css.slice(css.indexOf(`${seletor} {`));
      expect(bloco.slice(0, bloco.indexOf("}"))).toMatch(
        /min-height: var\(--touch-target\)/,
      );
    }
    expect(css).toMatch(
      /width: var\(--touch-target\);\s*height: var\(--touch-target\);/,
    );
  });

  it("nada força largura: campo e lista encolhem (min-width: 0) e quebram texto longo", () => {
    expect(css).toMatch(
      /\.seletor-referencia__linha > input \{[^}]*min-width: 0;/,
    );
    expect(css).toMatch(
      /\.seletor-referencia__opcao \{[^}]*overflow-wrap: anywhere;/,
    );
    expect(css).not.toMatch(/position: (fixed|sticky)/);
    expect(css).toMatch(
      /\.seletor-referencia__painel\[hidden\] \{\s*display: none;/,
    );
  });
});

describe("T197 — SeletorDeReferencia: criação inline", () => {
  /** Seletor com a oferta de criação, dentro de um formulário espionado. */
  function MontadoComCriacao({
    listar,
    onCriar,
    aviso,
  }: {
    listar: ListarReferencias;
    onCriar?: (nome: string) => void;
    aviso?: { id: number; texto: string };
  }) {
    const [escolhida, setEscolhida] = useState<ReferenciaEscolhida | null>(
      null,
    );
    return (
      <form aria-label="Formulário" onSubmit={enviar}>
        <SeletorDeReferencia
          id="campo-departamento"
          rotulo="Departamento"
          rotuloVisivel="Departamento"
          plural="departamentos"
          nenhum="Nenhum"
          ativo="ativo"
          obrigatorio
          escolhida={escolhida}
          onEscolher={setEscolhida}
          listar={listar}
          criacao={onCriar ? { onCriar } : undefined}
          aviso={aviso}
        />
      </form>
    );
  }
  const enviar = vi.fn((e: { preventDefault: () => void }) =>
    e.preventDefault(),
  );
  const criarOpcao = () =>
    within(lista()).queryByRole("option", { hidden: true, name: /^Criar / });

  async function digitar(termo: string) {
    fireEvent.change(campo(), { target: { value: termo } });
    await waitFor(() => expect(status().textContent).not.toBe(""));
  }

  it("sem `criacao`, nenhuma oferta (o DP não recebe a propriedade)", async () => {
    render(<MontadoComCriacao listar={servidor()} />);
    await digitar("Inexistente");
    expect(criarOpcao()).toBeNull();
    expect(status().textContent).not.toMatch(/criar/i);
  });

  it("no fim dos resultados: seta chega ao «Criar», Enter pede a criação com o nome normalizado, a lista fecha e o termo fica, sem enviar o formulário", async () => {
    const onCriar = vi.fn();
    render(<MontadoComCriacao listar={servidor()} onCriar={onCriar} />);
    await digitar("  Referencia 04 ");
    // Casa "Referencia 040" a "Referencia 045"; nenhum tem exatamente o nome.
    expect(opcoes()).toHaveLength(7);
    expect(opcoes().at(-1)).toBe("Criar departamento «Referencia 04»");
    expect(status().textContent).toContain(
      "A opção de criar «Referencia 04» está no fim da lista.",
    );
    for (let i = 0; i < opcoes().length; i += 1) {
      fireEvent.keyDown(campo(), { key: "ArrowDown" });
    }
    expect(campo()).toHaveAttribute("aria-activedescendant", criarOpcao()!.id);
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(onCriar).toHaveBeenCalledWith("Referencia 04");
    expect(enviar).not.toHaveBeenCalled();
    expect(campo()).toHaveAttribute("aria-expanded", "false");
    expect(campo()).toHaveValue("  Referencia 04 ");
  });

  it("nome idêntico entre os resultados, sem diferenciar maiúsculas: sem oferta", async () => {
    render(<MontadoComCriacao listar={servidor()} onCriar={vi.fn()} />);
    await digitar("REFERENCIA 007");
    expect(opcoes()).toEqual(["R007 — Referencia 007"]);
    expect(criarOpcao()).toBeNull();
  });

  it("no vazio, a oferta é a única opção; clique pede a criação", async () => {
    const onCriar = vi.fn();
    render(<MontadoComCriacao listar={servidor()} onCriar={onCriar} />);
    await digitar("Inexistente");
    expect(opcoes()).toEqual(["Criar departamento «Inexistente»"]);
    fireEvent.click(criarOpcao()!);
    expect(onCriar).toHaveBeenCalledWith("Inexistente");
  });

  it("enquanto a nova busca espera, a oferta do termo anterior some", async () => {
    let liberar: () => void = () => undefined;
    const servidorReal = servidor();
    const listar = vi.fn<ListarReferencias>(async (consulta) => {
      if (consulta.busca === "Inexistente mais") {
        await new Promise<void>((r) => {
          liberar = r;
        });
      }
      return servidorReal(consulta);
    });
    render(<MontadoComCriacao listar={listar} onCriar={vi.fn()} />);
    await digitar("Inexistente");
    expect(criarOpcao()).not.toBeNull();
    fireEvent.change(campo(), { target: { value: "Inexistente mais" } });
    expect(criarOpcao()).toBeNull();
    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith({
        busca: "Inexistente mais",
        pagina: 1,
      }),
    );
    await act(async () => liberar());
    await waitFor(() =>
      expect(criarOpcao()).toHaveTextContent(
        "Criar departamento «Inexistente mais»",
      ),
    );
  });

  it("o aviso de fora é anunciado uma vez por id", () => {
    const { rerender } = render(
      <MontadoComCriacao
        listar={servidor()}
        aviso={{ id: 1, texto: "Criado e escolhido: R099 — Nova." }}
      />,
    );
    expect(status()).toHaveTextContent("Criado e escolhido: R099 — Nova.");
    rerender(
      <MontadoComCriacao
        listar={servidor()}
        aviso={{ id: 2, texto: "Escolhido: R100 — Outra." }}
      />,
    );
    expect(status().textContent).toBe("Escolhido: R100 — Outra.");
  });
});
