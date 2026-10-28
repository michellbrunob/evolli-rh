import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PainelAdicionarColaborador,
  ROTULO_INICIAR_CADASTRO,
  TITULO_PAINEL_ADICIONAR,
} from "./PainelAdicionarColaborador";

/**
 * T194 — painel "Adicionar colaborador": só escolhe a forma de entrada. Uma
 * disponível (cadastro individual, já marcada), duas indisponíveis com o
 * motivo e o rádio desabilitado. Nunca chama API.
 */

const EMPRESA = { nome: "Empresa Sintética (teste)", codigo: "SINT01" };

function montar(
  props: Partial<Parameters<typeof PainelAdicionarColaborador>[0]> = {},
) {
  const onFechar = vi.fn();
  const onCadastroIndividual = vi.fn();
  const utils = render(
    <PainelAdicionarColaborador
      aberto
      empresaAtiva={EMPRESA}
      onFechar={onFechar}
      onCadastroIndividual={onCadastroIndividual}
      {...props}
    />,
  );
  return { ...utils, onFechar, onCadastroIndividual };
}

function painel() {
  return screen.getByRole("dialog", { name: TITULO_PAINEL_ADICIONAR });
}

function grupo() {
  return within(painel()).getByRole("group", {
    name: "Como você quer adicionar",
  });
}

function radio(nome: string) {
  return within(grupo()).getByRole("radio", { name: new RegExp(`^${nome}`) });
}

describe("PainelAdicionarColaborador (T194)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fechado, não renderiza nada", () => {
    montar({ aberto: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("é uma janela modal lateral, nomeada pelo título, com ícone decorativo e a empresa ativa", () => {
    montar();
    const dialogo = painel();
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo.closest(".evolli-modal")).toHaveClass(
      "evolli-modal--lateral",
    );
    expect(dialogo).toHaveAccessibleDescription(
      "Escolha o caminho mais prático para trazer alguém para a equipe.",
    );
    // O ícone ao lado do título é só ilustração.
    const icone = dialogo.querySelector(".evolli-modal__icone");
    expect(icone).toHaveAttribute("aria-hidden", "true");
    expect(
      within(dialogo).getByText(/Você está adicionando em/),
    ).toHaveTextContent(
      "Você está adicionando em Empresa Sintética (teste) (SINT01).",
    );
  });

  it("ao abrir, o foco vai ao título do painel", () => {
    montar();
    expect(document.activeElement).toBe(
      within(painel()).getByRole("heading", {
        level: 2,
        name: TITULO_PAINEL_ADICIONAR,
      }),
    );
  });

  it("três formas num grupo de escolha única, na ordem, com o cadastro individual já marcado", () => {
    montar();
    const radios = within(grupo()).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radio("Cadastro individual")).toBeChecked();
    expect(radio("Cadastro individual")).toBeEnabled();
    expect(radio("Cadastro individual")).toHaveAccessibleDescription(
      /confere tudo antes de salvar/,
    );
    // Todos no mesmo grupo de nome: escolher um desmarca os outros.
    expect(new Set(radios.map((r) => r.getAttribute("name"))).size).toBe(1);
    expect(grupo()).toHaveTextContent("Leva poucos minutos");
  });

  it("importar planilha e admissão digital: rádio desabilitado, motivo anunciado, nenhum outro controle", () => {
    montar();
    for (const [nome, motivo] of [
      ["Importar planilha", /Ainda estamos preparando a importação/],
      [
        "Admissão digital",
        /segurança, de proteção de dados \(LGPD\) e do convite/,
      ],
    ] as const) {
      const r = radio(nome);
      expect(r).toBeDisabled();
      expect(r).not.toBeChecked();
      expect(r).toHaveAccessibleDescription(motivo);
      const cartao = r.closest("label") as HTMLElement;
      expect(cartao).toHaveTextContent("Indisponível · em preparação");
      expect(cartao.querySelectorAll("button, a, [tabindex]")).toHaveLength(0);
      expect(cartao).toHaveClass("painel-adicionar__forma--indisponivel");
    }
  });

  it("clicar nas formas indisponíveis não muda a escolha nem chama ação ou rede", () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);
    const { onCadastroIndividual, onFechar } = montar();
    for (const nome of ["Importar planilha", "Admissão digital"]) {
      fireEvent.click(radio(nome).closest("label") as HTMLElement);
      fireEvent.click(radio(nome));
    }
    expect(radio("Cadastro individual")).toBeChecked();
    expect(fetchEspiao).not.toHaveBeenCalled();
    expect(onCadastroIndividual).not.toHaveBeenCalled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(painel()).toBeInTheDocument();
  });

  it("'Iniciar cadastro' inicia a forma escolhida: o cadastro individual", () => {
    const { onCadastroIndividual, onFechar } = montar();
    fireEvent.click(
      within(painel()).getByRole("button", { name: ROTULO_INICIAR_CADASTRO }),
    );
    expect(onCadastroIndividual).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
  });

  it("Fechar, Cancelar e Escape fecham o painel", () => {
    const { onFechar } = montar();
    fireEvent.click(within(painel()).getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    fireEvent.click(within(painel()).getByRole("button", { name: "Cancelar" }));
    expect(onFechar).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(3);
  });

  it("o foco fica preso no painel e passa só pelos controles habilitados", () => {
    montar();
    const focaveis = [
      ...painel().querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled])",
      ),
    ];
    expect(
      focaveis.map((e) =>
        e instanceof HTMLInputElement ? `radio:${e.value}` : e.textContent,
      ),
    ).toEqual(["Fechar", "radio:individual", "Cancelar", "Iniciar cadastro"]);
    const ultimo = focaveis[focaveis.length - 1]!;
    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(focaveis[0]);
  });

  it("sem empresa ativa informada, não mostra a linha da empresa", () => {
    montar({ empresaAtiva: null });
    expect(within(painel()).queryByText(/Você está adicionando em/)).toBeNull();
  });

  it("375 px e estados visuais: tela inteira, cartões que quebram linha, escolhida e indisponível distintas", () => {
    const cssModal = readFileSync("src/components/Modal.css", "utf8");
    expect(cssModal).toMatch(
      /\.evolli-modal--lateral \{[^}]*justify-content: flex-end/,
    );
    expect(cssModal).toMatch(
      /@media \(max-width: 640px\) \{[\s\S]*\.evolli-modal--lateral \.evolli-modal__caixa \{[^}]*max-width: none/,
    );
    const css = readFileSync(
      "src/screens/pessoas/PainelAdicionarColaborador.css",
      "utf8",
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma \{[^}]*overflow-wrap: anywhere/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma \{[^}]*grid-template-columns: auto minmax\(0, 1fr\) auto/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma--marcada \{[^}]*border-color: var\(--color-action\)/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma--indisponivel \{[^}]*cursor: default/,
    );
  });
});
