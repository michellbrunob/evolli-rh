/**
 * T216 — 4ª revisão, página pública do Clima: a pergunta aparece sem o nome
 * e a descrição da dimensão (a seção do modelo); as outras pesquisas
 * seguem com a seção no contador. Dados sintéticos.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ClientePesquisaPublica,
  PesquisaPublica,
} from "../../api/pesquisaPublicaClient";
import { ResponderPesquisa } from "./ResponderPesquisa";

function pesquisa(extra: Partial<PesquisaPublica>): PesquisaPublica {
  return {
    empresa: "Empresa Exemplo",
    nome: "Pesquisa de teste",
    boasVindas: null,
    identificacao: "anonima",
    totalPerguntas: 1,
    minutosEstimados: 3,
    secoes: [
      {
        id: "s-1",
        titulo: "Credibilidade",
        descricao: "O que a liderança comunica e entrega.",
        perguntas: [
          {
            id: "q-1",
            tipo: "concordancia",
            texto: "Entendo as prioridades da empresa.",
            descricao: null,
            obrigatoria: true,
            config: {},
            condicao: null,
          },
        ],
      },
    ],
    ...extra,
  } as PesquisaPublica;
}

const cliente = (p: PesquisaPublica) =>
  ({
    abrir: vi.fn(() => Promise.resolve(p)),
    identificar: vi.fn(() =>
      Promise.resolve({ passe: "passe-1", primeiroNome: "Alex" }),
    ),
    enviarRespostas: vi.fn(() => Promise.resolve()),
  }) satisfies ClientePesquisaPublica;

async function comecar(p: PesquisaPublica) {
  render(<ResponderPesquisa token="tok-clima" cliente={cliente(p)} />);
  await screen.findByRole("heading", { level: 1, name: p.nome });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar pesquisa" }));
  await screen.findByText("Entendo as prioridades da empresa.");
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("R4-B-11 — página pública do Clima sem a dimensão", () => {
  it("Clima: o contador sem a dimensão e sem a descrição dela", async () => {
    await comecar(pesquisa({ modelo: "clima" }));
    expect(screen.getByText("Pergunta 1 de 1")).toBeInTheDocument();
    expect(screen.queryByText(/Credibilidade/)).toBeNull();
    expect(
      screen.queryByText("O que a liderança comunica e entrega."),
    ).toBeNull();
  });

  it("outras pesquisas: a seção segue no contador, com a descrição", async () => {
    await comecar(pesquisa({ modelo: "pulso" }));
    expect(screen.getByText(/Credibilidade/)).toBeInTheDocument();
    expect(
      screen.getByText("O que a liderança comunica e entrega."),
    ).toBeInTheDocument();
  });
});
