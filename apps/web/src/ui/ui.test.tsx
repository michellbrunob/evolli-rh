/**
 * T209 — contratos da camada `src/ui` (Tailwind 4 sem preflight, Radix para
 * menu, diálogo, painel lateral e tooltip). Foco, teclado, nome acessível,
 * guarda de alterações, rolagem travada e a integração sem reset global.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardSection,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Select,
  Sheet,
  Dialog,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TabsList,
  TabsPanel,
  TabsTrigger,
  Tooltip,
  TooltipProvider,
  usePedirFechamentoJanela,
} from "./index";

const proximoQuadro = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe("T209 — Button, IconButton, Card, Input, Select e Badge", () => {
  it("Button é type=button por padrão e marca a variante", () => {
    render(<Button variant="primary">Salvar</Button>);
    const b = screen.getByRole("button", { name: "Salvar" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveAttribute("data-variant", "primary");
    // T215 — altura padrão do botão de texto.
    expect(b.className).toMatch(/ev:min-h-\[var\(--altura-botao\)\]/);
    // T216 — o rótulo não quebra linha dentro do botão.
    expect(b.className).toMatch(/ev:whitespace-nowrap/);
  });

  it("IconButton exige rótulo; o ícone é decorativo", () => {
    render(<IconButton label="Fechar painel" icon={<svg data-testid="i" />} />);
    const b = screen.getByRole("button", { name: "Fechar painel" });
    expect(screen.getByTestId("i").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    // T215 — o botão de ícone é quadrado, no tamanho padrão.
    expect(b.className).toMatch(/ev:min-w-\[var\(--botao-icone\)\]/);
    expect(b.className).toMatch(/ev:min-h-\[var\(--botao-icone\)\]/);
    expect(b.className).not.toMatch(/--altura-botao/);
  });

  it("Card é uma seção com a borda de card; CardSection divide grupos", () => {
    render(
      <Card aria-label="Totais">
        <CardSection>Um</CardSection>
        <CardSection>Dois</CardSection>
      </Card>,
    );
    const card = screen.getByRole("region", { name: "Totais" });
    expect(card.className).toMatch(/ev:border-\[var\(--divisor-cor-forte\)\]/);
    expect(within(card).getByText("Dois").className).toMatch(
      /ev:border-t-\[length:var\(--borda-espessura\)\]/,
    );
  });

  it("Input e Select são controles nativos, com alvo de 44 px", () => {
    render(
      <>
        <label>
          Nome
          <Input defaultValue="x" />
        </label>
        <label>
          Tamanho
          <Select defaultValue="50">
            <option value="20">20</option>
            <option value="50">50</option>
          </Select>
        </label>
      </>,
    );
    expect(screen.getByLabelText("Nome").tagName).toBe("INPUT");
    const select = screen.getByLabelText("Tamanho");
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveValue("50");
    expect(select.className).toMatch(/ev:min-h-\[var\(--touch-target\)\]/);
  });

  it("Badge diz o estado em texto, no mesmo visual do status padrão (T216)", () => {
    render(<Badge variant="success">Ativo</Badge>);
    const badge = screen.getByText("Ativo").closest("[data-variant]");
    expect(badge).toHaveAttribute("data-variant", "success");
    expect(badge).toHaveClass("evolli-badge", "evolli-badge--success");
    expect(badge?.querySelector(".evolli-badge__ponto")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("T209 — Tabs (ativação manual)", () => {
  function Abas({ onTrocar }: { onTrocar: (v: string) => void }) {
    const [atual, setAtual] = useState("a");
    return (
      <>
        <TabsList label="Grupos">
          {["a", "b", "c"].map((v) => (
            <TabsTrigger
              key={v}
              id={`aba-${v}`}
              selected={v === atual}
              controls="painel"
              onClick={() => {
                onTrocar(v);
                setAtual(v);
              }}
            >
              Aba {v}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsPanel id="painel" labelledBy={`aba-${atual}`}>
          Conteúdo {atual}
        </TabsPanel>
      </>
    );
  }

  it("setas, Home e End só movem o foco; clique ativa; só a selecionada é tabulável", () => {
    const onTrocar = vi.fn();
    render(<Abas onTrocar={onTrocar} />);
    const abas = within(
      screen.getByRole("tablist", { name: "Grupos" }),
    ).getAllByRole("tab");
    expect(abas.map((a) => a.tabIndex)).toEqual([0, -1, -1]);
    abas[0]!.focus();
    fireEvent.keyDown(abas[0]!, { key: "ArrowRight" });
    expect(abas[1]).toHaveFocus();
    fireEvent.keyDown(abas[1]!, { key: "End" });
    expect(abas[2]).toHaveFocus();
    fireEvent.keyDown(abas[2]!, { key: "ArrowRight" });
    expect(abas[0]).toHaveFocus();
    fireEvent.keyDown(abas[0]!, { key: "ArrowLeft" });
    expect(abas[2]).toHaveFocus();
    fireEvent.keyDown(abas[2]!, { key: "Home" });
    expect(abas[0]).toHaveFocus();
    expect(onTrocar).not.toHaveBeenCalled();

    fireEvent.click(abas[1]!);
    expect(onTrocar).toHaveBeenCalledWith("b");
    expect(abas[1]).toHaveAttribute("aria-selected", "true");
    expect(abas[1]).toHaveAttribute("aria-controls", "painel");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Aba b");
  });

  it("T216 — cada aba leva a classe da aba sublinhada padrão, somada à de quem usa", () => {
    render(
      <TabsList label="Grupos">
        <TabsTrigger selected controls="p" className="tela__aba">
          Aba
        </TabsTrigger>
      </TabsList>,
    );
    expect(screen.getByRole("tab", { name: "Aba" })).toHaveClass(
      "evolli-aba",
      "tela__aba",
    );
  });
});

describe("T209 — DropdownMenu (Radix)", () => {
  function Menu({ onEscolher }: { onEscolher: (v: string) => void }) {
    return (
      <div style={{ overflow: "auto" }} data-testid="quadro">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Ações: Pessoa">
            Ações
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {["Dados", "Documentos", "Ponto"].map((r) => (
              <DropdownMenuItem key={r} onSelect={() => onEscolher(r)}>
                {r}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  it("teclado abre no primeiro item; setas com volta; Escape fecha e devolve o foco", async () => {
    render(<Menu onEscolher={vi.fn()} />);
    const gatilho = screen.getByRole("button", { name: "Ações: Pessoa" });
    gatilho.focus();
    fireEvent.keyDown(gatilho, { key: "Enter" });
    const menu = await screen.findByRole("menu", { name: "Ações: Pessoa" });
    const itens = within(menu).getAllByRole("menuitem");
    await vi.waitFor(() => expect(itens[0]).toHaveFocus());
    // O Radix aplica o foco das setas no ciclo seguinte.
    fireEvent.keyDown(itens[0]!, { key: "ArrowUp" });
    await vi.waitFor(() => expect(itens[2]).toHaveFocus());
    fireEvent.keyDown(itens[2]!, { key: "ArrowDown" });
    await vi.waitFor(() => expect(itens[0]).toHaveFocus());
    fireEvent.keyDown(itens[0]!, { key: "End" });
    await vi.waitFor(() => expect(itens[2]).toHaveFocus());
    fireEvent.keyDown(itens[2]!, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await vi.waitFor(() => expect(gatilho).toHaveFocus());
  });

  it("Tab fecha o menu e devolve o foco ao gatilho", async () => {
    render(<Menu onEscolher={vi.fn()} />);
    const gatilho = screen.getByRole("button", { name: "Ações: Pessoa" });
    gatilho.focus();
    fireEvent.keyDown(gatilho, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    await vi.waitFor(() =>
      expect(within(menu).getAllByRole("menuitem")[0]).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await vi.waitFor(() => expect(gatilho).toHaveFocus());
  });

  it("seta para cima no gatilho abre já no último item", async () => {
    render(<Menu onEscolher={vi.fn()} />);
    const gatilho = screen.getByRole("button", { name: "Ações: Pessoa" });
    gatilho.focus();
    fireEvent.keyDown(gatilho, { key: "ArrowUp" });
    const menu = await screen.findByRole("menu");
    const itens = within(menu).getAllByRole("menuitem");
    await vi.waitFor(() => expect(itens[2]).toHaveFocus());
  });

  it("o menu vai para um portal: o quadro que rola não o recorta", async () => {
    render(<Menu onEscolher={vi.fn()} />);
    const gatilho = screen.getByRole("button", { name: "Ações: Pessoa" });
    fireEvent.keyDown(gatilho, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(screen.getByTestId("quadro").contains(menu)).toBe(false);
  });

  it("escolher devolve o foco ao gatilho ANTES de executar a ação", async () => {
    let focoNaAcao: Element | null = null;
    render(
      <Menu
        onEscolher={() => {
          focoNaAcao = document.activeElement;
        }}
      />,
    );
    const gatilho = screen.getByRole("button", { name: "Ações: Pessoa" });
    fireEvent.keyDown(gatilho, { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: "Documentos" });
    fireEvent.click(item);
    expect(focoNaAcao).toBe(gatilho);
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("o ponteiro também abre", async () => {
    render(<Menu onEscolher={vi.fn()} />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Ações: Pessoa" }),
      {
        button: 0,
        ctrlKey: false,
        pointerType: "mouse",
      },
    );
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });
});

function Palco({
  alterado = false,
  bloqueado = false,
  onFechar = vi.fn(),
  lado = "direita",
}: {
  alterado?: boolean;
  bloqueado?: boolean;
  onFechar?: () => void;
  lado?: "direita" | "centro";
}) {
  const [aberto, setAberto] = useState(false);
  const Janela = lado === "direita" ? Sheet : Dialog;
  function Cancelar() {
    const pedir = usePedirFechamentoJanela();
    return <Button onClick={pedir}>Cancelar</Button>;
  }
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Abrir
      </button>
      <Janela
        aberto={aberto}
        titulo="Painel de teste"
        descricao="Descrição do painel."
        alterado={alterado}
        bloqueado={bloqueado}
        onFechar={() => {
          onFechar();
          setAberto(false);
        }}
        rodape={<Cancelar />}
      >
        <input aria-label="Campo" />
      </Janela>
    </>
  );
}

describe("T209 — Sheet e Dialog (Radix)", () => {
  async function abrir() {
    const gatilho = screen.getByRole("button", { name: "Abrir" });
    gatilho.focus();
    fireEvent.click(gatilho);
    await screen.findByRole("dialog", { name: "Painel de teste" });
    await proximoQuadro();
    return gatilho;
  }

  it("abre como diálogo modal nomeado e descrito, com o foco no título e a rolagem travada", async () => {
    render(<Palco />);
    await abrir();
    const dialogo = screen.getByRole("dialog", { name: "Painel de teste" });
    expect(dialogo).toHaveAccessibleDescription("Descrição do painel.");
    expect(dialogo).toHaveAttribute("data-lado", "direita");
    expect(dialogo).toHaveAttribute("data-state", "open");
    expect(
      screen.getByRole("heading", { name: "Painel de teste" }),
    ).toHaveFocus();
    expect(
      document.body.style.overflow === "hidden" ||
        document.body.hasAttribute("data-scroll-locked"),
    ).toBe(true);
  });

  it("Escape, Fechar, Cancelar e o fundo fecham; o foco volta ao gatilho", async () => {
    const onFechar = vi.fn();
    render(<Palco onFechar={onFechar} />);
    const gatilho = await abrir();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(gatilho).toHaveFocus());

    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalledTimes(2);

    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onFechar).toHaveBeenCalledTimes(3);

    await abrir();
    const fundo = document.querySelector(".ev-janela__fundo")!;
    fireEvent.pointerDown(fundo, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(fundo, { button: 0, pointerType: "mouse" });
    fireEvent.click(fundo);
    expect(onFechar).toHaveBeenCalledTimes(4);
  });

  it("guarda: com alteração, fechar pede confirmação; continuar devolve o foco; descartar fecha", async () => {
    const onFechar = vi.fn();
    render(<Palco alterado onFechar={onFechar} />);
    await abrir();
    const campo = screen.getByLabelText("Campo");
    campo.focus();
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(onFechar).not.toHaveBeenCalled();
    const confirmacao = screen.getByRole("alertdialog", {
      name: "Há alterações não salvas nesta janela. Descartar?",
    });
    await vi.waitFor(() =>
      expect(
        within(confirmacao).getByRole("button", { name: "Continuar editando" }),
      ).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(campo).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("bloqueado (envio em andamento): nada fecha", async () => {
    const onFechar = vi.fn();
    render(<Palco bloqueado onFechar={onFechar} />);
    await abrir();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("o resto da página fica fora do alcance do leitor de tela enquanto aberto", async () => {
    render(
      <>
        <main data-testid="pagina">Página</main>
        <Palco />
      </>,
    );
    await abrir();
    // O Radix oculta os irmãos do portal (o contêiner da página).
    expect(
      screen.getByTestId("pagina").closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it("Dialog central: mesma guarda e foco, outra posição", async () => {
    render(<Palco lado="centro" />);
    await abrir();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-lado", "centro");
  });
});

describe("T209 — Tooltip (Radix)", () => {
  it("o foco por teclado mostra a dica, que descreve o gatilho; Escape esconde", async () => {
    render(
      <TooltipProvider>
        <Tooltip content="Abre a ficha da pessoa">
          <button type="button">Ficha</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const botao = screen.getByRole("button", { name: "Ficha" });
    fireEvent.focus(botao);
    const dica = await screen.findByRole("tooltip");
    expect(dica).toHaveTextContent("Abre a ficha da pessoa");
    fireEvent.keyDown(botao, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});

describe("T209 — primitivas de tabela", () => {
  it("região focável nomeada, legenda acessível e cabeçalhos de coluna", () => {
    render(
      <TableContainer label="Colaboradores — Ativos">
        <Table>
          <TableCaption visible={false}>Colaboradores — Ativos</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Pessoa</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>,
    );
    const regiao = screen.getByRole("region", {
      name: "Colaboradores — Ativos",
    });
    expect(regiao).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByRole("table", { name: "Colaboradores — Ativos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Colaborador" }),
    ).toHaveAttribute("scope", "col");
  });
});

describe("T209 — integração do Tailwind sem regressão (contrato de CSS)", () => {
  const css = readFileSync("src/ui/estilos.css", "utf8").replace(/\r\n/g, "\n");

  it("sem preflight: só tema e utilidades, em camadas, com prefixo ev", () => {
    expect(css).not.toMatch(/@import "tailwindcss";/);
    expect(css).not.toMatch(/@import "tailwindcss\/preflight/);
    expect(css).toContain(
      '@import "tailwindcss/theme.css" layer(theme) prefix(ev);',
    );
    expect(css).toContain(
      '@import "tailwindcss/utilities.css" layer(utilities) prefix(ev);',
    );
    expect(css).toMatch(/@layer theme, utilities;/);
  });

  it("movimento do painel e do fundo; nada perceptível com movimento reduzido", () => {
    expect(css).toMatch(
      /\.ev-janela--lateral\[data-state="open"\] \{[^}]*animation: ev-painel-entra var\(--movimento-painel-entrada\)/,
    );
    expect(css).toMatch(
      /\.ev-janela--lateral\[data-state="closed"\] \{[^}]*animation: ev-painel-sai var\(--movimento-painel-saida\)/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.ev-janela__fundo\[data-state\],[^{]*\.ev-janela--lateral\[data-state\] \{[^}]*animation: none;/,
    );
  });

  it("o CSS só é carregado pela entrada da aplicação (nenhum reset em tela)", () => {
    expect(readFileSync("src/main.tsx", "utf8")).toContain(
      'import "./ui/estilos.css";',
    );
  });
});
