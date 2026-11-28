/**
 * T216 — 4ª revisão, recorte A (base e fluxo): gravação automática que falha
 * aparece no cabeçalho e tenta de novo sozinha com recuo (sem laço), status
 * com a mensagem da falha, resultado individual na ordem nova, filtros e
 * recortes, página "Sobre" do Pulso com a prévia funcionando e o nome da
 * empresa no painel. Servidor simulado; dados sintéticos.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/colaboradoresClient";
import { CsrfSessionExpiredError } from "../../api/csrfClient";
import type {
  PesquisaDetalhe,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import { CartaoDeEncerramento } from "./CartaoDeEncerramento";
import { ANALISES, DETALHE, RESULTADOS, servicoFalso } from "./dadosDeTeste";
import { falhaPassageira } from "./falhasDaGravacao";
import { PesquisasModulo } from "./PesquisasModulo";
import { PaginaDaResposta, ResultadoIndividual } from "./ResultadoIndividual";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";

const css = (arquivo: string) =>
  readFileSync(resolve(__dirname, arquivo), "utf8").replace(/\s+/g, " ");

const HOJE = "2026-11-27";
const AGORA = () => new Date(2026, 10, 27, 9, 5);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const esperar = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

function montarAssistente(
  servico = servicoFalso(),
  extra: Partial<Parameters<typeof AssistenteDoModelo>[0]> = {},
) {
  render(
    <AssistenteDoModelo
      servico={servico}
      modeloId="pulso"
      hoje={HOJE}
      agora={AGORA}
      atrasoDoRascunho={0}
      recuoDoRascunho={10}
      onCancelar={vi.fn()}
      onConcluir={vi.fn()}
      onVerResultados={vi.fn()}
      onEditarGerada={vi.fn()}
      {...extra}
    />,
  );
  return servico;
}

describe("R4-A-01 — falha passageira", () => {
  it("rede, servidor e página desatualizada são passageiras; sessão, permissão e campo, não", () => {
    expect(falhaPassageira(new Error("rede"))).toBe(true);
    expect(falhaPassageira(new ApiError(503, "x"))).toBe(true);
    expect(
      falhaPassageira(new ApiError(403, "x", { codigo: "csrf_invalido" })),
    ).toBe(true);
    expect(falhaPassageira(new ApiError(401, "x"))).toBe(false);
    expect(falhaPassageira(new CsrfSessionExpiredError())).toBe(false);
    expect(falhaPassageira(new ApiError(403, "x"))).toBe(false);
    expect(falhaPassageira(new ApiError(409, "x"))).toBe(false);
    expect(falhaPassageira(new ApiError(422, "x"))).toBe(false);
  });
});

describe("R4-A-01 — gravação automática do assistente com falha", () => {
  it("troca 'Rascunho salvo às' pela falha e tenta de novo sozinha, com limite", async () => {
    const servico = servicoFalso();
    montarAssistente(servico);
    await screen.findByText("Rascunho salvo às 09:05");
    servico.alterarPesquisa.mockRejectedValue(new Error("fora do ar"));
    fireEvent.change(screen.getByLabelText(/Nome da pesquisa/), {
      target: { value: "Pulso do time" },
    });
    const estado = await screen.findByText(/Rascunho não salvo/);
    expect(estado).toHaveTextContent("Rascunho não salvo · tentando de novo");
    expect(screen.queryByText(/Rascunho salvo às/)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível salvar o rascunho. Verifique a conexão e tente de novo.",
    );
    // 1 tentativa + 3 automáticas (10, 20 e 40 ms), e para.
    await waitFor(() =>
      expect(servico.alterarPesquisa).toHaveBeenCalledTimes(4),
    );
    await esperar(150);
    expect(servico.alterarPesquisa).toHaveBeenCalledTimes(4);
    expect(screen.getByText(/Rascunho não salvo/)).not.toHaveTextContent(
      "tentando de novo",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A próxima mudança tenta de novo.",
    );
  });

  it("a nova tentativa que dá certo volta a mostrar a hora", async () => {
    const servico = servicoFalso();
    montarAssistente(servico);
    await screen.findByText("Rascunho salvo às 09:05");
    servico.alterarPesquisa.mockRejectedValueOnce(new ApiError(502, "x"));
    fireEvent.change(screen.getByLabelText(/Nome da pesquisa/), {
      target: { value: "Pulso do time" },
    });
    await screen.findByText(/Rascunho não salvo/);
    expect(
      await screen.findByText("Rascunho salvo às 09:05"),
    ).toBeInTheDocument();
    expect(servico.alterarPesquisa).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sessão expirada não tenta de novo sozinha", async () => {
    const servico = servicoFalso();
    servico.criarPesquisa.mockRejectedValue(new ApiError(401, "x"));
    montarAssistente(servico);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "sua sessão expirou",
    );
    await esperar(120);
    expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Rascunho não salvo/)).not.toHaveTextContent(
      "tentando de novo",
    );
  });
});

describe("R3-A-14 — a lista de tipos desconta a barra fixa do topo", () => {
  it("o espaço de cima começa embaixo da barra do topo", async () => {
    const { posicaoDaLista } = await import("./EditorDePerguntas");
    // Sem barra: cabe em cima (300 − 8 = 292).
    expect(posicaoDaLista({ top: 300, bottom: 330 }, 420, 600)).toEqual({
      acima: true,
      alturaMaxima: 292,
    });
    // Barra de 60 px: sobra 232 em cima, ainda mais que os 82 de baixo.
    expect(posicaoDaLista({ top: 300, bottom: 330 }, 420, 600, 60)).toEqual({
      acima: true,
      alturaMaxima: 232,
    });
    // Barra alta: embaixo passa a ter mais espaço.
    expect(posicaoDaLista({ top: 200, bottom: 230 }, 420, 600, 120)).toEqual({
      acima: false,
      alturaMaxima: 182,
    });
  });
});

describe("R3-A-28 e R4-A-08 — textos que não quebram e que quebram", () => {
  it("a legenda do eNPS no cartão fica numa linha; os cartões da tela final quebram", () => {
    const regras = css("Pesquisas.css");
    expect(regras).toMatch(
      /\.pesquisas__indicador \.pesquisas__legenda \{[^}]*flex-wrap: nowrap/,
    );
    expect(regras).toMatch(
      /\.pesquisas__indicador \.pesquisas__legenda li \{[^}]*white-space: nowrap/,
    );
    const textoDoCartao = /\.pesquisas__proximas-texto \{([^}]*)\}/.exec(
      regras,
    );
    expect(textoDoCartao?.[1]).not.toMatch(/nowrap|ellipsis/);
  });
});

describe("R3-A-30 — personalizada com pouco conteúdo", () => {
  it("o rodapé Voltar/Próximo fica no pé da tela", () => {
    const regras = css("Pesquisas.css");
    expect(regras).toMatch(
      /\.cadastro-etapas\.pesquisas__personalizada \{[^}]*min-height: calc\(\s?100dvh - var\(--altura-barra-superior, 60px\)/,
    );
    expect(regras).toMatch(
      /\.pesquisas__personalizada \.cadastro-etapas__rodape \{[^}]*margin-top: auto/,
    );
  });
});

describe("R4-A-01 — mudança de status com a falha explicada", () => {
  it("sessão expirada: o aviso diz o motivo", async () => {
    const servico = servicoFalso({
      alterarStatusDaPesquisa: vi.fn(() =>
        Promise.reject(new ApiError(401, "x")),
      ),
    });
    render(
      <ResultadosDaPesquisa
        servico={servico}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: DETALHE.nome });
    fireEvent.pointerDown(
      screen.getByRole("button", { name: /Mudar status/ }),
      {
        button: 0,
        ctrlKey: false,
      },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: /Pausada/ }));
    const alerta = await screen.findByRole("alert", {
      name: "Não foi possível mudar o status.",
    });
    expect(alerta).toHaveTextContent(
      "Sua sessão expirou. Entre de novo para continuar.",
    );
  });
});

/** Pulso identificado, com a recomendação e a régua de 1 a 5 da concordância. */
const PULSO_IDENTIFICADO: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "pulso",
  identificacao: "identificada",
};

function abrirIndividual(detalhe: PesquisaDetalhe = PULSO_IDENTIFICADO) {
  render(
    <ResultadoIndividual
      servico={servicoFalso({
        obterPesquisa: vi.fn(() => Promise.resolve(detalhe)),
      })}
      pesquisaId="p-1"
      respostaId="r-1"
      onVoltar={vi.fn()}
      onLista={vi.fn()}
      onIr={vi.fn()}
    />,
  );
}

const antes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("R4-A-03 — resultado individual: a ordem das seções", () => {
  it("4 cartões, Respostas por pergunta e só depois o histórico e o comentário", async () => {
    abrirIndividual();
    const cartoes = await screen.findByRole("region", {
      name: "Indicadores da resposta",
    });
    const porPergunta = screen.getByRole("region", {
      name: "Respostas por pergunta",
    });
    const historico = screen.getByRole("region", {
      name: "Histórico e comentário",
    });
    expect(
      within(cartoes)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([
      "Média geral",
      "Recomendação",
      "Nota mais alta",
      "Nota mais baixa",
    ]);
    expect(antes(cartoes, porPergunta)).toBe(true);
    expect(antes(porPergunta, historico)).toBe(true);
    expect(
      within(historico)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Média nos últimos pulsos", "Comentário livre"]);
    expect(historico).toHaveTextContent("Sem pulsos anteriores para comparar.");
  });

  it.each(["anonima", "confidencial"] as const)(
    "%s: ainda sem histórico, só nas identificadas",
    async (identificacao) => {
      abrirIndividual({ ...PULSO_IDENTIFICADO, identificacao });
      const historico = await screen.findByRole("region", {
        name: "Histórico e comentário",
      });
      expect(historico).toHaveTextContent("Ainda sem histórico");
      expect(historico).toHaveTextContent(
        "O histórico de cada pessoa só existe nas pesquisas identificadas.",
      );
      expect(historico).not.toHaveTextContent("Sem pulsos anteriores");
    },
  );
});

describe("R4-A-04 — resultado individual: cores, selos e a tabela", () => {
  it("média geral e recomendação em cor neutra, com o selo ao lado; só os extremos coloridos", async () => {
    abrirIndividual();
    const cartoes = await screen.findByRole("region", {
      name: "Indicadores da resposta",
    });
    const [media, recomendacao, alta, baixa] = within(cartoes)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.closest(".pesquisas__indicador") as HTMLElement);
    const numero = (cartao: Element) =>
      cartao.querySelector(".pesquisas__indicador-numero")!;
    expect(numero(media!)).not.toHaveAttribute("data-faixa");
    expect(numero(recomendacao!)).not.toHaveAttribute("data-faixa");
    expect(
      media!.querySelector(
        ".pesquisas__indicador-valor .pesquisas__nota-colorida",
      ),
    ).toHaveTextContent("8 ou mais");
    expect(
      recomendacao!.querySelector(
        ".pesquisas__indicador-valor .pesquisas__nota-colorida",
      ),
    ).toHaveTextContent("Promotor");
    expect(numero(alta!)).toHaveAttribute("data-faixa");
    expect(numero(baixa!)).toHaveAttribute("data-faixa");
    // A média geral não tem régua; o texto compara com o time.
    expect(within(media!).queryByRole("img")).toBeNull();
    expect(media).toHaveTextContent("+1,5 acima do time (8,5)");
    expect(alta).toHaveTextContent("+0,8 acima do time (4,3)");
  });

  it("a nota da tabela num quadrado colorido; legenda e pontas no cabeçalho; diferença por extenso", async () => {
    abrirIndividual();
    const tabela = await screen.findByRole("table", {
      name: "Comparação com o time",
    });
    const cabecalho = within(tabela).getAllByRole("columnheader");
    expect(cabecalho[2]).toHaveTextContent("Resposta");
    expect(cabecalho[2]).toHaveTextContent("Média do time");
    expect(cabecalho[2]).toHaveTextContent("1 … 10");
    const linhas = within(tabela).getAllByRole("row").slice(1);
    const quadrado = linhas[0]!.querySelector(".pesquisas__nota-quadrado");
    expect(quadrado).toHaveTextContent("5");
    expect(quadrado).toHaveAttribute("data-faixa", "alta");
    expect(linhas[0]).toHaveTextContent("+0,8 acima do time");
    // A recomendação fecha a tabela.
    expect(linhas.at(-1)).toHaveTextContent("+1,6 acima do time");
  });
});

describe("R3-A-34 — resposta inexistente", () => {
  it.each([400, 404])(
    "%i: 'Resposta não encontrada' só com a volta",
    async (status) => {
      const onVoltar = vi.fn();
      render(
        <PaginaDaResposta
          nomeDaPesquisa="Pulso"
          identificacao="anonima"
          secoes={DETALHE.secoes}
          respostaId="r-x"
          carregar={() => Promise.reject(new ApiError(status, "x"))}
          rotuloVoltar="Voltar para os resultados"
          onVoltar={onVoltar}
        />,
      );
      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: "Resposta não encontrada",
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Tentar novamente" }),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Voltar para os resultados" }),
      );
      expect(onVoltar).toHaveBeenCalled();
    },
  );

  it("outra falha continua com 'Tentar novamente'", async () => {
    render(
      <PaginaDaResposta
        nomeDaPesquisa="Pulso"
        identificacao="anonima"
        secoes={DETALHE.secoes}
        respostaId="r-1"
        carregar={() => Promise.reject(new ApiError(500, "x"))}
        rotuloVoltar="Voltar"
        onVoltar={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();
  });
});

/** Anônima que só separa por departamento. */
const ANONIMA: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "pulso",
  identificacao: "anonima",
  separarPor: ["departamento"],
};
const GERAL_ANONIMA: ResultadosPesquisa = {
  ...RESULTADOS,
  recortes: ["departamento"],
  grupos: {
    departamento: [
      { id: "d-1", nome: "Operações", respostas: 6, visivel: true },
      {
        id: "d-2",
        nome: "Financeiro",
        respostas: 2,
        visivel: false,
        oculto: "minimo",
      },
    ],
  },
};

function abrirResultados(
  extra: Partial<Parameters<typeof servicoFalso>[0]> = {},
) {
  const servico = servicoFalso({
    obterPesquisa: vi.fn(() => Promise.resolve(ANONIMA)),
    resultadosDaPesquisa: vi.fn((_id: string, filtro: unknown) =>
      Promise.resolve(
        filtro
          ? {
              ...GERAL_ANONIMA,
              filtro: {
                ...GERAL_ANONIMA.filtro,
                visivel: false,
                respostas: 2,
              },
              perguntas: [],
            }
          : GERAL_ANONIMA,
      ),
    ),
    ...extra,
  });
  render(
    <ResultadosDaPesquisa
      servico={servico}
      pesquisaId="p-1"
      podeEditar
      onVoltar={vi.fn()}
      onEditar={vi.fn()}
    />,
  );
  return servico;
}

describe("R4-A-09 — os três filtros, mesmo fora da separação", () => {
  it("Centro de custo e Unidade aparecem com 'Todos', desabilitados", async () => {
    abrirResultados();
    const depto = await screen.findByRole("combobox", {
      name: "Departamento",
    });
    const centro = screen.getByRole("combobox", { name: "Centro de custo" });
    const unidade = screen.getByRole("combobox", { name: "Unidade" });
    expect(depto).toBeEnabled();
    for (const lista of [centro, unidade]) {
      expect(lista).toBeDisabled();
      expect(lista).toHaveTextContent("Todos");
    }
  });
});

describe("R4-A-11 — recorte pequeno no filtro", () => {
  it("cartão com borda, ícone em círculo e 'Recorte com poucas respostas'", async () => {
    abrirResultados();
    fireEvent.click(
      await screen.findByRole("combobox", { name: "Departamento" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Financeiro" }));
    const titulo = await screen.findByText("Recorte com poucas respostas");
    const cartao = titulo.closest(".pesquisas__recorte-pequeno")!;
    expect(cartao).not.toBeNull();
    expect(
      cartao.querySelector(".pesquisas__recorte-pequeno-icone svg"),
    ).not.toBeNull();
    expect(cartao).toHaveTextContent(
      "Este recorte tem menos de 3 respostas. Para proteger quem respondeu, os números não aparecem.",
    );
    expect(css("Pesquisas.css")).toMatch(
      /\.pesquisas__recorte-pequeno \{[^}]*border: 1px solid var\(--divisor-cor\)/,
    );
  });
});

describe("R3-A-26 — contagem do grupo oculto para proteger um menor", () => {
  it("o mapa das Análises mostra a contagem; os números seguem ocultos", async () => {
    abrirResultados({
      analisesDaPesquisa: vi.fn(() =>
        Promise.resolve({
          ...ANALISES,
          linhas: [
            ANALISES.linhas[0]!,
            {
              ...ANALISES.linhas[1]!,
              respostas: 3,
              visivel: false,
              oculto: "protege_grupo_menor" as const,
              media: null,
              medias: [null],
            },
            { ...ANALISES.linhas[2]!, oculto: "minimo" as const },
          ],
        }),
      ),
    });
    fireEvent.click(await screen.findByRole("tab", { name: /Análises/ }));
    const mapa = await screen.findByRole("table", {
      name: "Médias por departamento",
    });
    const operacoes = within(mapa).getByRole("rowheader", {
      name: /Operações/,
    });
    expect(operacoes).toHaveTextContent("3 respostas");
    expect(operacoes.closest("tr")).toHaveTextContent(
      "Oculto · protege um grupo menor",
    );
    expect(operacoes.closest("tr")).not.toHaveTextContent("6,1");
  });
});

describe("R4-A-10 — prazo inválido sem o texto de apoio com a data", () => {
  it("data passada: a frase não promete encerrar numa data", () => {
    render(
      <CartaoDeEncerramento
        data="2026-11-01"
        hora="23:59"
        hoje="2026-11-27"
        onMudar={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const nota = screen.getByRole("note");
    expect(nota).not.toHaveTextContent("01/11/2026");
    expect(nota).toHaveTextContent(
      "Depois da data e da hora escolhidas, o link avisa que a pesquisa encerrou",
    );
  });

  it("data válida: a frase com a data continua", () => {
    render(
      <CartaoDeEncerramento
        data="2026-12-10"
        hora="23:59"
        hoje="2026-11-27"
        onMudar={vi.fn()}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "Depois de 10/12/2026 às 23:59",
    );
  });
});

const comMarcadorNoOrgulho = (d: PesquisaDetalhe): PesquisaDetalhe => ({
  ...d,
  secoes: d.secoes.map((s) => ({
    ...s,
    perguntas: s.perguntas.map((p) =>
      p.id === "q-conc" ? { ...p, texto: "Tenho orgulho da {empresa}." } : p,
    ),
  })),
});

describe("R4-A-12 — o nome da empresa ativa no painel", () => {
  it("Sobre o modelo: a pergunta com o nome da empresa", async () => {
    render(
      <PesquisasModulo
        servico={servicoFalso()}
        podeEditar
        rota={{ tela: "sobre", modelo: "pulso" }}
        onNavegar={vi.fn()}
        nomeDaEmpresa="Empresa Alfa"
      />,
    );
    const perguntas = await screen.findByRole("region", {
      name: "As perguntas",
    });
    expect(perguntas).toHaveTextContent(
      "Tenho orgulho de fazer parte da Empresa Alfa.",
    );
    expect(perguntas).not.toHaveTextContent("nossa empresa");
  });

  it("resultados e resultado individual com o nome; a pesquisa gravada fica com o marcador", async () => {
    const comMarcador = comMarcadorNoOrgulho(PULSO_IDENTIFICADO);
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(comMarcador)),
    });
    const { unmount } = render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "resultados", id: "p-1", aba: "geral" }}
        onNavegar={vi.fn()}
        nomeDaEmpresa="Empresa Alfa"
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    expect(
      screen.getAllByText("Tenho orgulho da Empresa Alfa.").length,
    ).toBeGreaterThan(0);
    unmount();
    render(
      <PesquisasModulo
        servico={servico}
        podeEditar
        rota={{ tela: "resposta", id: "p-1", respostaId: "r-1" }}
        onNavegar={vi.fn()}
        nomeDaEmpresa="Empresa Alfa"
      />,
    );
    expect(
      await screen.findByRole("table", { name: "Comparação com o time" }),
    ).toHaveTextContent("Tenho orgulho da Empresa Alfa.");
    expect(comMarcador.secoes[0]!.perguntas[1]!.texto).toBe(
      "Tenho orgulho da {empresa}.",
    );
  });

  it("fora do módulo (sem o nome), continua 'nossa empresa'", async () => {
    abrirIndividual(comMarcadorNoOrgulho(PULSO_IDENTIFICADO));
    expect(
      await screen.findByRole("table", { name: "Comparação com o time" }),
    ).toHaveTextContent("Tenho orgulho da nossa empresa.");
  });
});
