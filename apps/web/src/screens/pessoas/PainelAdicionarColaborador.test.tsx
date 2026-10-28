import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PainelAdicionarColaborador,
  TITULO_PAINEL_ADICIONAR,
} from "./PainelAdicionarColaborador";

/**
 * T194 — painel "Adicionar colaborador": só escolhe a forma de entrada. Uma
 * disponível (cadastro individual), duas indisponíveis com o motivo e sem
 * nenhum controle. Nunca chama API.
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

function formas() {
  return within(
    within(painel()).getByRole("list", { name: "Formas de adicionar" }),
  ).getAllByRole("listitem");
}

describe("PainelAdicionarColaborador (T194)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fechado, não renderiza nada", () => {
    montar({ aberto: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("é uma janela modal lateral, nomeada pelo título, com a empresa ativa", () => {
    montar();
    const dialogo = painel();
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo.closest(".evolli-modal")).toHaveClass(
      "evolli-modal--lateral",
    );
    expect(dialogo).toHaveAccessibleDescription(
      /Escolha como iniciar a entrada de uma pessoa/,
    );
    expect(within(dialogo).getByText(/Empresa ativa:/)).toHaveTextContent(
      "Empresa ativa: Empresa Sintética (teste) (SINT01)",
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

  it("três formas, na ordem: cadastro individual, importar planilha, admissão digital", () => {
    montar();
    expect(
      formas().map(
        (f) => within(f).getByRole("heading", { level: 3 }).textContent,
      ),
    ).toEqual(["Cadastro individual", "Importar planilha", "Admissão digital"]);
    // Cada cartão é nomeado pelo próprio título.
    expect(formas()[0]).toHaveAccessibleName("Cadastro individual");
  });

  it("cadastro individual: disponível, com uma ação que chama onCadastroIndividual", () => {
    const { onCadastroIndividual, onFechar } = montar();
    const [individual] = formas();
    expect(within(individual!).getByText("Disponível")).toBeInTheDocument();
    const acao = within(individual!).getByRole("button", {
      name: "Iniciar cadastro individual",
    });
    expect(acao).toHaveAccessibleDescription(/página de Nova admissão/);
    fireEvent.click(acao);
    expect(onCadastroIndividual).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
  });

  it("importar planilha e admissão digital: indisponíveis, com o motivo e sem nenhum controle", () => {
    montar();
    const [, importar, digital] = formas();
    for (const forma of [importar!, digital!]) {
      expect(within(forma).getByText("Indisponível")).toBeInTheDocument();
      expect(
        within(forma).getByText("Por que está indisponível:"),
      ).toBeInTheDocument();
      // Nada clicável: nem botão, nem link, nem campo.
      expect(within(forma).queryAllByRole("button")).toHaveLength(0);
      expect(within(forma).queryAllByRole("link")).toHaveLength(0);
      expect(
        forma.querySelectorAll("button, a, input, [tabindex]"),
      ).toHaveLength(0);
    }
    expect(importar).toHaveTextContent(
      /importação está em preparação e ainda não foi liberada/,
    );
    expect(digital).toHaveTextContent(
      /segurança, de proteção de dados \(LGPD\) e do convite/,
    );
  });

  it("clicar nas formas indisponíveis não chama ação nem rede", () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);
    const { onCadastroIndividual, onFechar } = montar();
    const [, importar, digital] = formas();
    for (const forma of [importar!, digital!]) {
      fireEvent.click(forma);
      fireEvent.click(within(forma).getByRole("heading", { level: 3 }));
    }
    expect(fetchEspiao).not.toHaveBeenCalled();
    expect(onCadastroIndividual).not.toHaveBeenCalled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(painel()).toBeInTheDocument();
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

  it("o foco fica preso no painel: Tab no último volta ao primeiro controle", () => {
    montar();
    const botoes = within(painel()).getAllByRole("button");
    const ultimo = botoes[botoes.length - 1]!;
    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(botoes[0]);
    expect(botoes.map((b) => b.textContent)).toEqual([
      "Fechar",
      "Iniciar cadastro individual",
      "Cancelar",
    ]);
  });

  it("sem empresa ativa informada, não mostra a linha da empresa", () => {
    montar({ empresaAtiva: null });
    expect(within(painel()).queryByText(/Empresa ativa:/)).toBeNull();
  });

  it("375 px: o painel lateral ocupa a tela inteira e a ação disponível ocupa a largura", () => {
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
      /@media \(max-width: 640px\) \{[\s\S]*\.painel-adicionar__acao \{[^}]*width: 100%/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma \{[^}]*overflow-wrap: anywhere/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma--indisponivel \{[^}]*cursor: default/,
    );
  });
});
