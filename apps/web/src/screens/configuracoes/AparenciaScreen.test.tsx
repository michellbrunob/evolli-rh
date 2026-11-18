/**
 * T210 — Configurações › Aparência: quatro cartões de tema num grupo de
 * opções; escolher aplica na hora (data-theme) e grava na conta; falha volta
 * ao tema anterior e avisa. Sem botão falso de salvar.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, atualizarAparenciaPropria } from "../../api/usersClient";
import { AparenciaScreen, APARENCIA_TITULO_ID } from "./AparenciaScreen";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, atualizarAparenciaPropria: vi.fn() };
});

const ATOR = {
  id: "conta-sintetica",
  email: "pessoa@example.test",
  role: "rh",
  companyId: null,
  unitId: null,
  teamId: null,
  status: "active",
  createdAt: "2026-11-01T12:00:00.000Z",
  temaAparencia: null,
};

function montar(temaAparencia: string | null = null) {
  const onContaAtualizada = vi.fn();
  render(
    <AparenciaScreen
      temaAtual={temaAparencia}
      onContaAtualizada={onContaAtualizada}
    />,
  );
  return { onContaAtualizada };
}

const grupo = () => screen.getByRole("radiogroup", { name: "Tema" });
const opcao = (nome: RegExp) =>
  within(grupo()).getByRole("radio", { name: nome });

beforeEach(() => {
  vi.mocked(atualizarAparenciaPropria).mockReset();
});
afterEach(() => document.documentElement.removeAttribute("data-theme"));

describe("T210 — Configurações › Aparência", () => {
  it("título, texto, navegação e quatro cartões; o tema da conta vem marcado, com 'Em uso'", () => {
    montar("verde_petroleo");
    expect(
      screen.getByRole("heading", { level: 1, name: "Configurações" }),
    ).toHaveAttribute("id", APARENCIA_TITULO_ID);
    expect(
      screen.getByRole("heading", { level: 2, name: "Aparência" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Escolha como o Evolli será exibido para você."),
    ).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    expect(
      within(nav).getByRole("link", { name: "Aparência" }),
    ).toHaveAttribute("aria-current", "page");
    expect(within(grupo()).getAllByRole("radio")).toHaveLength(4);
    expect(opcao(/^Verde Petróleo/)).toBeChecked();
    expect(opcao(/^Azul Institucional/)).not.toBeChecked();
    const cartao = opcao(/^Verde Petróleo/).closest("label")!;
    expect(cartao).toHaveTextContent("Em uso");
    expect(opcao(/^Alto Contraste/).closest("label")).not.toHaveTextContent(
      "Em uso",
    );
  });

  it("sem tema (ou desconhecido), o padrão Azul Institucional vem marcado", () => {
    montar("roxo");
    expect(opcao(/^Azul Institucional/)).toBeChecked();
  });

  it("escolher aplica na hora, grava na conta e anuncia o sucesso", async () => {
    let concluir: (v: unknown) => void = () => {};
    vi.mocked(atualizarAparenciaPropria).mockImplementation(
      () => new Promise((r) => (concluir = r)) as never,
    );
    const { onContaAtualizada } = montar(null);
    fireEvent.click(opcao(/^Evolli Claro/));
    // Aplicado antes da resposta do servidor.
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "evolli_claro",
    );
    expect(atualizarAparenciaPropria).toHaveBeenCalledWith("evolli_claro");
    await act(async () => concluir({ ...ATOR, temaAparencia: "evolli_claro" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tema Evolli Claro aplicado e salvo na sua conta.",
    );
    expect(onContaAtualizada).toHaveBeenCalledWith(
      expect.objectContaining({ temaAparencia: "evolli_claro" }),
    );
    expect(opcao(/^Evolli Claro/).closest("label")).toHaveTextContent("Em uso");
  });

  it("falha: volta ao tema anterior (na tela e no cartão) e avisa", async () => {
    vi.mocked(atualizarAparenciaPropria).mockRejectedValue(new Error("rede"));
    montar("verde_petroleo");
    document.documentElement.setAttribute("data-theme", "verde_petroleo");
    fireEvent.click(opcao(/^Alto Contraste/));
    expect(
      await screen.findByText(
        "Não foi possível salvar o tema. O tema anterior foi mantido.",
      ),
    ).toHaveAttribute("role", "alert");
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "verde_petroleo",
    );
    expect(opcao(/^Verde Petróleo/)).toBeChecked();
  });

  it("sessão expirada (401): volta ao tema anterior e pede nova entrada", async () => {
    vi.mocked(atualizarAparenciaPropria).mockRejectedValue(
      new ApiError(401, "Sessão expirada."),
    );
    montar(null);
    fireEvent.click(opcao(/^Verde Petróleo/));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sua sessão terminou. Entre de novo para escolher o tema; o tema anterior foi mantido.",
    );
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(opcao(/^Azul Institucional/)).toBeChecked();
  });

  it("escolher o tema que já está em uso não grava nada", () => {
    montar("evolli_claro");
    fireEvent.click(opcao(/^Evolli Claro/));
    expect(atualizarAparenciaPropria).not.toHaveBeenCalled();
  });

  it("enquanto grava, os outros cartões esperam (sem dupla gravação)", async () => {
    vi.mocked(atualizarAparenciaPropria).mockImplementation(
      () => new Promise(() => {}) as never,
    );
    montar(null);
    fireEvent.click(opcao(/^Evolli Claro/));
    fireEvent.click(opcao(/^Verde Petróleo/));
    await waitFor(() =>
      expect(atualizarAparenciaPropria).toHaveBeenCalledTimes(1),
    );
    expect(grupo()).toHaveAttribute("aria-busy", "true");
  });

  it("cada opção tem nome e descrição acessíveis; é um rádio nativo (teclado)", () => {
    montar(null);
    for (const r of within(grupo()).getAllByRole("radio")) {
      expect(r.tagName).toBe("INPUT");
      expect(r).toHaveAttribute("type", "radio");
      expect(r).toHaveAccessibleDescription(/.{10,}/);
    }
  });

  it("CSS: cartões em grade que quebra para uma coluna em 375 px, só com tokens", () => {
    const css = readFileSync(
      "src/screens/configuracoes/AparenciaScreen.css",
      "utf8",
    );
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fill, minmax\(/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /#[0-9a-fA-F]{3,8}\b|rgba?\(/,
    );
  });
});
