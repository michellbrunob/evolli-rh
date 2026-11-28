/**
 * T216 — telas da Avaliação 90°/180°: resultados do time (nota, ranking,
 * grupos, mapa de talentos, gestor × autoavaliação), a lista de pessoas e
 * o resultado de uma pessoa, análises, andamento, exportação, a resposta
 * pelo link (gestor e autoavaliação) e a ficha.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvaliacoesDaFicha } from "./AvaliacoesDaFicha";
import { ITENS, nota1, diferenca1 } from "./catalogo";
import { ErroDaAvaliacaoPublica, type Pendentes } from "./cliente";
import {
  avaliacaoDetalheFalsa,
  pessoaFalsa,
  resultadosFalsos,
} from "./dadosDeTeste";
import { planilhaDaAvaliacao, nomeDaPlanilha } from "./exportacaoDaAvaliacao";
import { ResponderAvaliacao } from "./ResponderAvaliacao";
import { ResultadosDaAvaliacao } from "./ResultadosDaAvaliacao";

afterEach(() => sessionStorage.clear());

function montarResultados(
  cliente: Partial<Parameters<typeof ResultadosDaAvaliacao>[0]["cliente"]> = {},
) {
  const c = {
    resultados: vi.fn(async () => resultadosFalsos()),
    obter: vi.fn(async () => avaliacaoDetalheFalsa()),
    pessoa: vi.fn(async () => pessoaFalsa()),
    ...cliente,
  };
  render(
    <ResultadosDaAvaliacao
      pesquisaId="pesq-1"
      nome="Avaliação 180°"
      modelo="avaliacao180"
      cliente={c}
    />,
  );
  return c;
}

describe("T216 — resultados da avaliação", () => {
  it("visão geral: nota do time, ranking, grupos, mapa e gestor × autoavaliação", async () => {
    montarResultados();
    expect(await screen.findByLabelText("Nota do time")).toHaveTextContent(
      "3,5",
    );
    expect(screen.getByLabelText("Nota do time")).toHaveTextContent("Bom");
    const ranking = screen.getByRole("region", {
      name: "Do mais forte ao mais fraco",
    });
    const itens = within(ranking).getAllByRole("listitem");
    expect(itens).toHaveLength(8);
    expect(itens[0]).toHaveTextContent("Comunicação");
    expect(itens[0]).toHaveTextContent("4,5");
    const grupos = screen.getByRole("region", { name: "Grupos pela nota" });
    expect(grupos).toHaveTextContent("Destaques · 1");
    expect(grupos).toHaveTextContent("Precisam de apoio · 1");
    const mapa = screen.getByRole("table", { name: "Mapa de talentos" });
    expect(mapa).toHaveTextContent("Referência · 1");
    expect(mapa).toHaveTextContent("Precisa de apoio · 1");
    const comp = screen.getByRole("region", { name: "Gestor × autoavaliação" });
    expect(comp).toHaveTextContent(
      "1 pessoa se vê acima · 0 alinhadas · 0 abaixo",
    );
    expect(comp).toHaveTextContent("+0,6");
    expect(
      screen.getByText(/nunca use como critério único/),
    ).toBeInTheDocument();
  });

  it("pessoas: nota, nível, mapa, autoavaliação, diferença e alertas; abre a pessoa", async () => {
    const c = montarResultados();
    fireEvent.click(await screen.findByRole("tab", { name: "Pessoas (2)" }));
    const linhaAna = screen.getByRole("row", { name: /Ana Teste/ });
    expect(linhaAna).toHaveTextContent("4,4");
    expect(linhaAna).toHaveTextContent("Excelente");
    expect(linhaAna).toHaveTextContent("+0,6 · Se vê acima");
    const linhaBruno = screen.getByRole("row", { name: /Bruno Sem Cpf/ });
    expect(linhaBruno).toHaveTextContent("Sem autoavaliação");
    expect(linhaBruno).toHaveTextContent("Todas as 24 notas iguais");
    fireEvent.click(
      within(linhaAna).getByRole("button", { name: "Ana Teste" }),
    );
    await waitFor(() => expect(c.pessoa).toHaveBeenCalledWith("pesq-1", "p1"));
    expect(
      await screen.findByRole("heading", { name: "Ana Teste" }),
    ).toBeInTheDocument();
    const conversa = screen.getByRole("region", {
      name: "Gestor × autoavaliação",
    });
    expect(conversa).toHaveTextContent("Ponto cego");
    expect(conversa).toHaveTextContent(
      "Comece pelo que as duas visões confirmam",
    );
    expect(
      screen.getByText("Conduz bem as reuniões de equipe."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para a avaliação" }),
    );
    expect(
      await screen.findByRole("tab", { name: "Visão geral" }),
    ).toBeInTheDocument();
  });

  it("análises: por competência, calibração e recortes ocultos abaixo de 3", async () => {
    montarResultados();
    fireEvent.click(await screen.findByRole("tab", { name: "Análises" }));
    expect(
      screen.getByRole("region", { name: "Por competência" }),
    ).toHaveTextContent("50%");
    expect(
      screen.getByRole("region", { name: "Calibração entre gestores" }),
    ).toHaveTextContent("Poucas avaliações (menos de 5)");
    expect(screen.getByRole("region", { name: "Recortes" })).toHaveTextContent(
      "1 a 3 anos",
    );
    expect(screen.getAllByText("Oculto · menos de 3")).toHaveLength(2);
  });

  it("andamento: quem avaliou e convites aguardando e-mail", async () => {
    montarResultados();
    fireEvent.click(await screen.findByRole("tab", { name: "Andamento" }));
    const a = screen.getByRole("region", { name: "Andamento" });
    expect(a).toHaveTextContent(
      "2 avaliações enviadas · 1 pendente · 2 convites aguardando e-mail",
    );
    expect(a).toHaveTextContent("Autoavaliação feita");
    expect(a).toHaveTextContent("Sem autoavaliação (sem CPF)");
  });

  it("sem acesso (403): explica que as notas são nominais", async () => {
    montarResultados({
      resultados: vi.fn(async () => {
        throw Object.assign(new Error("x"), { status: 403 });
      }),
    });
    expect(await screen.findByText(/só o RH e o DP veem/)).toBeInTheDocument();
  });

  it("sem avaliações ainda: estado vazio", async () => {
    const r = resultadosFalsos();
    montarResultados({
      resultados: vi.fn(async () => ({ ...r, avaliadas: 0 })),
    });
    expect(await screen.findByText("Ainda sem avaliações")).toBeInTheDocument();
  });
});

describe("T216 — números e exportação da avaliação", () => {
  it("1 casa com vírgula e diferença com sinal", () => {
    expect(nota1(3.56)).toBe("3,6");
    expect(nota1(null)).toBe("—");
    expect(diferenca1(0.5)).toBe("+0,5");
    expect(diferenca1(-0.1)).toBe("−0,1");
    expect(diferenca1(0)).toBe("0,0");
  });

  it("planilha com as abas do padrão do módulo (e a do comparativo na 180°)", () => {
    const bytes = planilhaDaAvaliacao("Avaliação 180°", resultadosFalsos());
    const texto = new TextDecoder().decode(bytes);
    for (const aba of [
      "Resumo",
      "Por pessoa",
      "Por competência",
      "Por afirmação",
      "Calibração",
      "Recortes",
      "Gestor x autoavaliação",
      "Metodologia",
    ]) {
      expect(texto).toContain(aba);
    }
    expect(texto).toContain("Ana Teste");
    expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    const sem180 = new TextDecoder().decode(
      planilhaDaAvaliacao("A", {
        ...resultadosFalsos(),
        modelo: "avaliacao90",
        comparativo: null,
      }),
    );
    expect(sem180).not.toContain("Gestor x autoavaliação");
    expect(nomeDaPlanilha("Avaliação 90° – Ciclo 2026.2")).toMatch(/\.xlsx$/);
  });
});

function pendentes(extra: Partial<Pendentes> = {}): Pendentes {
  return {
    modelo: "avaliacao180",
    comentarios: "extremos",
    prazo: null,
    prazoAutoavaliacao: null,
    itens: [
      {
        parId: "par-a",
        papel: "gestor",
        avaliado: { nome: "Ana Teste", cargo: "Analista" },
        respondida: false,
        aberta: true,
        comparativo: null,
      },
      {
        parId: "par-b",
        papel: "gestor",
        avaliado: { nome: "Bruno Teste", cargo: null },
        respondida: true,
        aberta: false,
        comparativo: null,
      },
    ],
    ...extra,
  };
}

function montarResposta(
  p = pendentes(),
  responder = vi.fn(
    async (
      _token: string,
      _parId: string,
      _corpo: {
        passe: string;
        respostas: { perguntaId: string; valor: number }[];
      },
    ) => ({ ok: true as const, restantes: 0 }),
  ),
) {
  const cliente = { pendentes: vi.fn(async () => p), responder };
  render(
    <ResponderAvaliacao
      token="tokenDeTesteComTamanhoSuficiente"
      passe="passe"
      primeiroNome="Gestora"
      cliente={cliente}
    />,
  );
  return cliente;
}

function marcarTodas(n: number) {
  for (let i = 0; i < ITENS.length; i += 1) {
    fireEvent.click(
      screen.getByRole("radio", { name: new RegExp(`^${n} · `) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próximo →" }));
  }
}

describe("T216 — avaliação pelo link", () => {
  it("lista o time; avalia uma pessoa por vez (24 afirmações) e envia", async () => {
    const cliente = montarResposta();
    expect(
      await screen.findByRole("heading", { name: "Olá, Gestora" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Seu time · 2 pessoas")).toBeInTheDocument();
    expect(screen.getByText("Enviada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Avaliar Ana Teste" }));
    expect(screen.getByText("1 de 24 · Comunicação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo →" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "4 · Excelente" }));
    expect(
      screen.getByText("4 · Excelente", {
        selector: "span:not(.pesquisas__so-leitor)",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo →" }));
    expect(screen.getByText("2 de 24 · Comunicação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Anterior" }));
    marcarTodas(4);
    expect(
      screen.getByRole("heading", { name: "Comentários" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    await waitFor(() => expect(cliente.responder).toHaveBeenCalled());
    const [, parId, corpo] = cliente.responder.mock.calls[0]!;
    expect(parId).toBe("par-a");
    expect(corpo.respostas).toHaveLength(24);
    expect(corpo.respostas.every((r: { valor: number }) => r.valor === 4)).toBe(
      true,
    );
    expect(corpo.passe).toBe("passe");
    await waitFor(() => expect(cliente.pendentes).toHaveBeenCalledTimes(2));
  });

  it("notas extremas pedem comentário antes de enviar", async () => {
    const cliente = montarResposta();
    fireEvent.click(
      await screen.findByRole("button", { name: "Avaliar Ana Teste" }),
    );
    marcarTodas(5);
    fireEvent.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Escreva um comentário em Comunicação/,
    );
    expect(cliente.responder).not.toHaveBeenCalled();
  });

  it("autoavaliação na 1ª pessoa; o progresso fica guardado na aba", async () => {
    montarResposta(
      pendentes({
        itens: [
          {
            parId: "par-auto",
            papel: "autoavaliacao",
            avaliado: { nome: "Ana Teste", cargo: null },
            respondida: false,
            aberta: true,
            comparativo: null,
          },
        ],
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Fazer a autoavaliação" }),
    );
    expect(
      screen.getByRole("heading", { name: ITENS[0]!.autoavaliacao }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "3 · Bom" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo →" }));
    expect(
      JSON.parse(sessionStorage.getItem("evolli-avaliacao-par-auto")!),
    ).toMatchObject({ posicao: 1, notas: { com_1: 3 } });
  });

  it("gestor vê a autoavaliação depois de enviar a dele (180°)", async () => {
    const comparativo = {
      gestor: Object.fromEntries(
        [
          "comunicacao",
          "trabalho_equipe",
          "proatividade",
          "organizacao",
          "responsabilidade",
          "adaptabilidade",
          "lideranca",
          "resolucao_problemas",
        ].map((c) => [c, 4]),
      ),
      autoavaliacao: Object.fromEntries(
        [
          "comunicacao",
          "trabalho_equipe",
          "proatividade",
          "organizacao",
          "responsabilidade",
          "adaptabilidade",
          "lideranca",
          "resolucao_problemas",
        ].map((c) => [c, 5]),
      ),
    } as NonNullable<Pendentes["itens"][number]["comparativo"]>;
    montarResposta(
      pendentes({
        itens: [
          {
            parId: "par-a",
            papel: "gestor",
            avaliado: { nome: "Ana Teste", cargo: null },
            respondida: true,
            aberta: false,
            comparativo,
          },
        ],
      }),
    );
    expect(
      await screen.findByText("Ver a autoavaliação de Ana Teste"),
    ).toBeInTheDocument();
    expect(screen.getByText("Tudo enviado. Obrigado!")).toBeInTheDocument();
  });

  it("passe vencido (401): pede para entrar de novo", async () => {
    const cliente = {
      pendentes: vi.fn(async () => {
        throw new ErroDaAvaliacaoPublica(401);
      }),
      responder: vi.fn(),
    };
    render(
      <ResponderAvaliacao
        token="t"
        passe="p"
        primeiroNome=""
        cliente={cliente}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/Entre de novo/);
  });
});

describe("T216 — avaliações na ficha", () => {
  it("lista as avaliações sobre a pessoa; sem nenhuma, não aparece", async () => {
    const carregar = vi.fn(async () => [
      {
        pesquisaId: "x",
        nome: "Avaliação 180° – Ciclo 2026.2",
        modelo: "avaliacao180",
        respondidaEm: "2026-11-27T12:00:00.000Z",
        gestor: "Gestora Teste",
        geral: 4,
        nivel: "excelente" as const,
        autoavaliacao: 4.5,
      },
    ]);
    const { unmount } = render(
      <AvaliacoesDaFicha colaboradorId="p1" carregar={carregar} />,
    );
    expect(
      await screen.findByText("Avaliação 180° – Ciclo 2026.2"),
    ).toBeInTheDocument();
    expect(screen.getByText("4,0 /5")).toBeInTheDocument();
    expect(screen.getByText("Autoavaliação 4,5")).toBeInTheDocument();
    unmount();
    const vazio = render(
      <AvaliacoesDaFicha colaboradorId="p1" carregar={vi.fn(async () => [])} />,
    );
    await waitFor(() => expect(vazio.container).toBeEmptyDOMElement());
  });
});
