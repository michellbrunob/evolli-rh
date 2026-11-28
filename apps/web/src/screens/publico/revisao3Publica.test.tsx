/**
 * T216 — 3ª revisão, página pública: a seção da personalizada diz o que
 * falta e leva à primeira pendente; o comentário final dos modelos é uma
 * caixa de várias linhas; a barra de progresso fecha na última tela.
 * Dados sintéticos.
 */
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type {
  ClientePesquisaPublica,
  Pergunta,
  PesquisaPublica,
} from "../../api/pesquisaPublicaClient";
import { ResponderPesquisa } from "./ResponderPesquisa";

function pergunta(
  id: string,
  tipo: Pergunta["tipo"],
  texto: string,
  extra: Partial<Pergunta> = {},
): Pergunta {
  return {
    id,
    tipo,
    texto,
    descricao: null,
    obrigatoria: false,
    config: {},
    condicao: null,
    ...extra,
  };
}

function pesquisa(extra: Partial<PesquisaPublica>): PesquisaPublica {
  return {
    empresa: "Empresa Exemplo",
    nome: "Pesquisa de teste",
    boasVindas: null,
    identificacao: "anonima",
    totalPerguntas: 0,
    minutosEstimados: 1,
    secoes: [],
    ...extra,
  };
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
  const c = cliente(p);
  render(<ResponderPesquisa token="tok-r3" cliente={c} />);
  await screen.findByRole("heading", { level: 1, name: p.nome });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar pesquisa" }));
  return c;
}

const marcar = (grupo: RegExp, opcao: string) =>
  fireEvent.click(
    within(screen.getByRole("radiogroup", { name: grupo })).getByRole("radio", {
      name: opcao,
    }),
  );

afterEach(() => {
  vi.restoreAllMocks();
  // O rascunho das respostas fica na sessão: cada teste começa do zero.
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("R3-A-17 — seção da personalizada diz o que falta", () => {
  const PERSONALIZADA = pesquisa({
    modelo: "personalizada",
    secoes: [
      {
        id: "s1",
        titulo: "Seu dia a dia",
        descricao: null,
        perguntas: [
          pergunta("q-a", "sim_nao", "Tem as ferramentas de que precisa?", {
            obrigatoria: true,
          }),
          pergunta("q-b", "texto_curto", "Qual ferramenta falta?"),
          pergunta("q-c", "concordancia", "Sinto que meu trabalho importa.", {
            obrigatoria: true,
          }),
          pergunta("q-d", "paragrafo", "O que mudaria primeiro?", {
            obrigatoria: true,
          }),
        ],
      },
    ],
  });

  it("Enviar fica ativo e a tela conta as obrigatórias que faltam", async () => {
    await comecar(PERSONALIZADA);
    const botao = screen.getByRole("button", { name: "Enviar respostas" });
    expect(botao).toBeEnabled();
    expect(
      screen.getByText("Falta responder 3 perguntas obrigatórias."),
    ).toHaveAttribute("aria-live", "polite");
    marcar(/ferramentas/, "Sim");
    expect(
      screen.getByText("Falta responder 2 perguntas obrigatórias."),
    ).toBeInTheDocument();
    marcar(/meu trabalho importa/, "Concordo");
    expect(
      screen.getByText("Falta responder 1 pergunta obrigatória."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/O que mudaria/), {
      target: { value: "Mais treinamento" },
    });
    expect(screen.queryByText(/^Falta responder/)).not.toBeInTheDocument();
  });

  it("no clique, marca as pendentes, foca e rola até a primeira, sem enviar", async () => {
    const rolar = vi.fn();
    // O jsdom não rola: um espião no lugar, retirado ao fim do teste.
    Element.prototype.scrollIntoView = rolar;
    onTestFinished(() => {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });
    const c = await comecar(PERSONALIZADA);
    marcar(/ferramentas/, "Sim");
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(c.enviarRespostas).not.toHaveBeenCalled();
    expect(
      screen.getByText("Revise as perguntas indicadas antes de continuar."),
    ).toHaveAttribute("role", "alert");
    const grupo = screen.getByRole("radiogroup", {
      name: /meu trabalho importa/,
    });
    expect(grupo).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/O que mudaria/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    // A primeira pendente (na ordem da tela) recebe o foco e vem à vista.
    expect(within(grupo).getAllByRole("radio")).toContain(
      document.activeElement,
    );
    expect(rolar).toHaveBeenCalledWith({ block: "center" });
    expect(rolar.mock.contexts.at(-1)).toBe(
      document.querySelector('[data-pergunta="q-c"]'),
    );
  });

  it("uma pergunta por tela (modelo pronto) continua esperando a resposta", async () => {
    await comecar(
      pesquisa({
        modelo: "pulso",
        secoes: [
          {
            id: "s1",
            titulo: null,
            descricao: null,
            perguntas: [
              pergunta("q-a", "sim_nao", "Tem o que precisa?", {
                obrigatoria: true,
              }),
              pergunta("q-b", "sim_nao", "Recomendaria?", {
                obrigatoria: true,
              }),
            ],
          },
        ],
      }),
    );
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    expect(screen.queryByText(/^Falta responder/)).not.toBeInTheDocument();
  });
});

describe("R3-A-23 — comentário final em caixa de várias linhas", () => {
  const PULSO = (comentario: Pergunta) =>
    pesquisa({
      modelo: "pulso",
      secoes: [
        {
          id: "s1",
          titulo: null,
          descricao: null,
          perguntas: [
            pergunta("q-a", "sim_nao", "Tem o que precisa?", {
              obrigatoria: true,
            }),
            comentario,
          ],
        },
      ],
    });

  it("resposta curta opcional no fim de um modelo: textarea com placeholder e o mesmo limite", async () => {
    await comecar(
      PULSO(pergunta("q-com", "texto_curto", "Quer deixar algum comentário?")),
    );
    marcar(/Tem o que precisa/, "Sim");
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    const caixa = screen.getByLabelText(/Quer deixar algum comentário/);
    expect(caixa.tagName).toBe("TEXTAREA");
    expect(caixa).toHaveAttribute("rows", "4");
    expect(caixa).toHaveAttribute("maxLength", "300");
    expect(caixa).toHaveAttribute("placeholder", "Escreva aqui, se quiser.");
  });

  it("obrigatória ou no meio da pesquisa, a resposta curta segue em uma linha", async () => {
    await comecar(
      pesquisa({
        modelo: "pulso",
        secoes: [
          {
            id: "s1",
            titulo: null,
            descricao: null,
            perguntas: [
              pergunta("q-meio", "texto_curto", "Qual é a sua área?"),
              pergunta("q-fim", "texto_curto", "Qual é o seu turno?", {
                obrigatoria: true,
              }),
            ],
          },
        ],
      }),
    );
    expect(screen.getByLabelText(/Qual é a sua área/).tagName).toBe("INPUT");
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    const fim = screen.getByLabelText(/Qual é o seu turno/);
    expect(fim.tagName).toBe("INPUT");
    expect(fim).not.toHaveAttribute("placeholder");
  });

  it("na personalizada (seção inteira) a resposta curta não vira caixa", async () => {
    await comecar(
      pesquisa({
        modelo: "personalizada",
        secoes: [
          {
            id: "s1",
            titulo: "Única",
            descricao: null,
            perguntas: [pergunta("q-x", "texto_curto", "Algo a dizer?")],
          },
        ],
      }),
    );
    expect(screen.getByLabelText(/Algo a dizer/).tagName).toBe("INPUT");
  });
});

describe("R3-A-24 — a barra de progresso fecha na última tela", () => {
  it("cheia na última pergunta e sem transição de largura", async () => {
    await comecar(
      pesquisa({
        modelo: "pulso",
        secoes: [
          {
            id: "s1",
            titulo: null,
            descricao: null,
            perguntas: ["a", "b", "c"].map((id) =>
              pergunta(`q-${id}`, "sim_nao", `Pergunta ${id}?`),
            ),
          },
        ],
      }),
    );
    const preenchido = () =>
      document.querySelector<HTMLElement>(".pesquisa-progresso__preenchido")!;
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Pergunta 3 de 3",
    );
    expect(preenchido().style.width).toBe("100%");
    const css = readFileSync(
      "src/screens/publico/ResponderPesquisa.css",
      "utf8",
    );
    const regras = css.match(/\.pesquisa-progresso__preenchido\s*\{[^}]*\}/g);
    expect(regras).not.toBeNull();
    for (const r of regras!) expect(r).not.toMatch(/transition/);
  });
});
