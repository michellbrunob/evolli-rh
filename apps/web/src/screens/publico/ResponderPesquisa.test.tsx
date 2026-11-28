import { readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErroPesquisaPublica,
  type AberturaPublica,
  type ClientePesquisaPublica,
  type Identificacao,
  type Pergunta,
  type PesquisaPublica,
} from "../../api/pesquisaPublicaClient";
import { ResponderPesquisa, montarPreviaPublica } from "./ResponderPesquisa";

// CPF sintético com dígitos verificadores válidos.
const CPF_TESTE = "20743195841";
const TOKEN = "tok-exemplo";

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

function pesquisaDeTeste(
  identificacao: Identificacao = "anonima",
  extra: Partial<PesquisaPublica> = {},
): PesquisaPublica {
  return {
    empresa: "Empresa Exemplo Ltda",
    nome: "Pulso do trimestre",
    boasVindas: "Queremos ouvir você.\n\nLeva poucos minutos.",
    identificacao,
    totalPerguntas: 11,
    minutosEstimados: 5,
    secoes: [
      {
        id: "s1",
        titulo: "Sobre o trabalho",
        descricao: "Pense nas últimas semanas.",
        perguntas: [
          pergunta(
            "q-conc",
            "concordancia",
            "Tenho clareza sobre o que se espera do meu trabalho.",
            { obrigatoria: true },
          ),
          pergunta(
            "q-sn",
            "sim_nao",
            "Participou de algum treinamento neste ano?",
            { obrigatoria: true },
          ),
          pergunta("q-cond", "texto_curto", "Qual treinamento?", {
            obrigatoria: true,
            condicao: { perguntaId: "q-sn", opcaoId: "sim" },
          }),
          pergunta(
            "q-nota",
            "nota_0_10",
            "De 0 a 10, quanto recomendaria a empresa como lugar para trabalhar?",
            { obrigatoria: true, config: { enps: true } },
          ),
        ],
      },
      {
        id: "s2",
        titulo: "Detalhes",
        descricao: null,
        perguntas: [
          pergunta("q-esc", "escala", "Como avalia a comunicação interna?", {
            obrigatoria: true,
            config: {
              minimo: 1,
              maximo: 10,
              rotuloMinimo: "Muito ruim",
              rotuloMaximo: "",
            },
          }),
          pergunta("q-est", "estrelas", "Que nota dá para o refeitório?"),
          pergunta("q-uni", "escolha_unica", "Qual o seu turno?", {
            obrigatoria: true,
            config: {
              opcoes: [
                { id: "manha", texto: "Manhã" },
                { id: "tarde", texto: "Tarde" },
              ],
              outro: true,
            },
          }),
          pergunta("q-mul", "multipla_escolha", "Que benefícios mais usa?", {
            config: {
              opcoes: [
                { id: "vr", texto: "Vale-refeição" },
                { id: "saude", texto: "Plano de saúde" },
                { id: "academia", texto: "Academia" },
              ],
              outro: true,
              maximo: 2,
            },
          }),
        ],
      },
      {
        id: "s3",
        titulo: null,
        descricao: null,
        perguntas: [
          pergunta("q-data", "data", "Quando foi sua última avaliação?"),
          pergunta("q-num", "numero", "Quantas horas de treinamento teve?", {
            config: { minimo: 0, maximo: 40, inteiro: true },
          }),
          pergunta("q-par", "paragrafo", "Quer deixar um comentário?"),
        ],
      },
    ],
    ...extra,
  };
}

const GRUPOS: NonNullable<PesquisaPublica["grupos"]> = [
  {
    campo: "departamento",
    rotulo: "Departamento",
    opcoes: [
      { id: "d1", nome: "Financeiro" },
      { id: "d2", nome: "Operações" },
    ],
  },
  {
    campo: "unidade",
    rotulo: "Unidade",
    opcoes: [{ id: "u1", nome: "Matriz" }],
  },
];

function criarCliente(
  abertura: AberturaPublica | Promise<AberturaPublica> = pesquisaDeTeste(),
) {
  return {
    abrir: vi.fn(() => Promise.resolve(abertura)),
    identificar: vi.fn(() =>
      Promise.resolve({ passe: "passe-1", primeiroNome: "Alex" }),
    ),
    enviarRespostas: vi.fn(() => Promise.resolve()),
  } satisfies ClientePesquisaPublica;
}

function renderizar(cliente: ClientePesquisaPublica = criarCliente()) {
  const r = render(<ResponderPesquisa token={TOKEN} cliente={cliente} />);
  return { ...r, cliente };
}

async function abrir(cliente?: ClientePesquisaPublica) {
  const r = renderizar(cliente);
  await screen.findByRole("heading", { level: 1, name: "Pulso do trimestre" });
  return r;
}

function iniciar() {
  fireEvent.click(screen.getByRole("button", { name: "Iniciar pesquisa" }));
}

function proximo() {
  fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
}

function enviar() {
  fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
}

function radios(nome: RegExp) {
  return screen.getByRole("radiogroup", { name: nome });
}

function marcar(nome: RegExp, opcao: string) {
  fireEvent.click(within(radios(nome)).getByRole("radio", { name: opcao }));
}

/** O título da pergunta na tela (h1 com o texto dela). */
function tituloAtual() {
  return screen.getByRole("heading", { level: 1 });
}

function idAtual(): string {
  return tituloAtual()
    .closest("[data-pergunta]")!
    .getAttribute("data-pergunta")!;
}

/** O texto está dentro de uma região role=alert. */
function emAlerta(texto: string) {
  return screen.getByText(texto).closest("[role='alert']");
}

/** Resposta válida padrão de cada pergunta (opcional: deixa em branco). */
const PADRAO: Record<string, () => void> = {
  "q-conc": () => marcar(/Tenho clareza/, "Concordo"),
  "q-sn": () => marcar(/Participou de algum treinamento/, "Não"),
  "q-cond": () =>
    fireEvent.change(screen.getByLabelText(/Qual treinamento/), {
      target: { value: "Primeiros socorros" },
    }),
  "q-nota": () => marcar(/De 0 a 10/, "9"),
  "q-esc": () => marcar(/comunicação interna/, "4"),
  "q-uni": () => marcar(/Qual o seu turno/, "Tarde"),
};

/** Responde do jeito padrão até chegar à pergunta `alvo` (sem respondê-la). */
function irAte(alvo: string) {
  for (let i = 0; i < 20 && idAtual() !== alvo; i++) {
    PADRAO[idAtual()]?.();
    proximo();
  }
  expect(idAtual()).toBe(alvo);
}

/** Responde tudo do jeito padrão e para na última (botão Enviar). */
function irAoFim() {
  irAte("q-par");
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("T216 — abertura", () => {
  it("cartão com empresa, nome, boas-vindas, metadados e Iniciar pesquisa", async () => {
    const { cliente } = await abrir();
    expect(cliente.abrir).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText("Empresa Exemplo Ltda")).toBeInTheDocument();
    expect(screen.getByText("Queremos ouvir você.")).toBeInTheDocument();
    expect(screen.getByText("Leva poucos minutos.")).toBeInTheDocument();
    const meta = screen.getByRole("list", { name: "Sobre esta pesquisa" });
    expect(
      within(meta)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["11 perguntas", "cerca de 3 minutos", "Anônima"]);
    expect(
      screen.getByRole("button", { name: "Iniciar pesquisa" }),
    ).toBeEnabled();
    expect(screen.getByRole("img", { name: "Evolli" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Pulso do trimestre" }),
    ).toHaveFocus();
    // Sem barra de progresso fora das perguntas.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("concorda no singular: 1 pergunta (tempo no mínimo da regra)", async () => {
    await abrir(
      criarCliente(
        pesquisaDeTeste("anonima", { totalPerguntas: 1, minutosEstimados: 1 }),
      ),
    );
    expect(screen.getByText("1 pergunta")).toBeInTheDocument();
    expect(screen.getByText("cerca de 3 minutos")).toBeInTheDocument();
  });

  it("mostra a identificação certa nos metadados", async () => {
    await abrir(criarCliente(pesquisaDeTeste("confidencial")));
    const meta = screen.getByRole("list", { name: "Sobre esta pesquisa" });
    expect(within(meta).getByText("Confidencial")).toBeInTheDocument();
    expect(
      screen.getByText(/as respostas não ficam ligadas ao seu nome/),
    ).toBeInTheDocument();
  });

  it("mostra o carregamento antes da resposta", () => {
    renderizar(criarCliente(new Promise<AberturaPublica>(() => {})));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando a pesquisa…",
    );
  });

  it("falha ao carregar: avisa e tenta de novo", async () => {
    const cliente = criarCliente();
    cliente.abrir
      .mockImplementationOnce(() => Promise.reject(new Error("rede")))
      .mockImplementationOnce(() => Promise.resolve(pesquisaDeTeste()));
    renderizar(cliente);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verifique sua conexão",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(
      await screen.findByRole("heading", { name: "Pulso do trimestre" }),
    ).toBeInTheDocument();
    expect(cliente.abrir).toHaveBeenCalledTimes(2);
  });
});

describe("T216 — pesquisa indisponível", () => {
  it.each([
    ["pausada", "Esta pesquisa está pausada"],
    ["encerrada", "O prazo desta pesquisa terminou"],
    ["finalizada", "Esta pesquisa foi encerrada pelo RH"],
    ["cancelada", "Esta pesquisa foi cancelada"],
    ["inexistente", "Pesquisa não encontrada"],
  ] as const)(
    "%s: mostra o aviso e não deixa começar",
    async (motivo, titulo) => {
      renderizar(criarCliente({ indisponivel: motivo }));
      expect(
        await screen.findByRole("heading", { level: 1, name: titulo }),
      ).toHaveFocus();
      expect(
        screen.queryByRole("button", { name: "Iniciar pesquisa" }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("T216 — separação por grupo (anônima)", () => {
  it("escolhe os grupos antes de começar: sem pré-seleção, 'Prefiro não informar' é uma escolha", async () => {
    const cliente = criarCliente(
      pesquisaDeTeste("anonima", { grupos: GRUPOS }),
    );
    await abrir(cliente);
    const depto = screen.getByRole("combobox", { name: "Departamento" });
    const unidade = screen.getByRole("combobox", { name: "Unidade" });
    expect(depto).toHaveTextContent("Escolha uma opção");
    expect(unidade).toHaveTextContent("Escolha uma opção");
    expect(depto).toHaveAccessibleDescription(
      expect.stringContaining("A resposta continua anônima."),
    );
    // Sem escolher, não começa.
    iniciar();
    expect(
      screen.getByRole("button", { name: "Iniciar pesquisa" }),
    ).toBeInTheDocument();
    expect(depto).toHaveAttribute("aria-invalid", "true");
    expect(unidade).toHaveAccessibleDescription(
      expect.stringContaining("Escolha uma opção ou “Prefiro não informar”."),
    );
    fireEvent.click(depto);
    fireEvent.click(screen.getByRole("option", { name: "Operações" }));
    expect(depto).toHaveTextContent("Operações");
    expect(depto).not.toHaveAttribute("aria-invalid");
    iniciar();
    expect(
      screen.getByRole("button", { name: "Iniciar pesquisa" }),
    ).toBeInTheDocument();
    fireEvent.click(unidade);
    fireEvent.click(
      screen.getByRole("option", { name: "Prefiro não informar" }),
    );
    expect(unidade).toHaveTextContent("Prefiro não informar");

    iniciar();
    irAoFim();
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    expect(cliente.enviarRespostas).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({
        grupos: { departamento: "d2", unidade: null },
      }),
    );
  });

  it("sem grupos no contrato, não mostra a escolha nem envia o campo", async () => {
    const cliente = criarCliente();
    await abrir(cliente);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    iniciar();
    irAoFim();
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    const [, envio] = cliente.enviarRespostas.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(envio).not.toHaveProperty("grupos");
  });

  it("fora da anônima, grupos vindos da API são ignorados", async () => {
    await abrir(
      criarCliente(pesquisaDeTeste("identificada", { grupos: GRUPOS })),
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("T216 — identificação", () => {
  async function irParaIdentificacao(
    identificacao: Identificacao = "identificada",
    cliente = criarCliente(pesquisaDeTeste(identificacao)),
  ) {
    await abrir(cliente);
    iniciar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Confirme seus dados" }),
    ).toHaveFocus();
    return cliente;
  }

  function preencher(cpf = CPF_TESTE, nascimento = "15041990") {
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: cpf },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: nascimento },
    });
  }

  function continuar() {
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  }

  it("aplica as máscaras, identifica e foca a primeira pergunta", async () => {
    const cliente = await irParaIdentificacao();
    preencher();
    expect(screen.getByLabelText("CPF")).toHaveValue("207.431.958-41");
    expect(screen.getByLabelText("Data de nascimento")).toHaveValue(
      "15/04/1990",
    );
    continuar();
    expect(
      await screen.findByRole("heading", { level: 1, name: /Tenho clareza/ }),
    ).toHaveFocus();
    expect(cliente.identificar).toHaveBeenCalledWith(TOKEN, {
      cpf: CPF_TESTE,
      dataNascimento: "1990-04-15",
    });
    expect(screen.getByText(/Olá, Alex/)).toBeInTheDocument();
  });

  it("recusa CPF inválido e data inexistente sem chamar o servidor", async () => {
    const cliente = await irParaIdentificacao();
    preencher("20743195842", "31022000");
    continuar();
    const alertas = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alertas).toEqual([
      "Informe um CPF válido, com 11 números.",
      "Informe a data de nascimento no formato dd/mm/aaaa.",
    ]);
    expect(screen.getByLabelText("CPF")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("CPF")).toHaveFocus();
    expect(cliente.identificar).not.toHaveBeenCalled();
  });

  it("dado que não bate: erro genérico, sem dizer qual campo falhou", async () => {
    const cliente = criarCliente(pesquisaDeTeste("identificada"));
    cliente.identificar.mockImplementation(() =>
      Promise.reject(new ErroPesquisaPublica(401)),
    );
    await irParaIdentificacao("identificada", cliente);
    preencher();
    continuar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não encontramos você nesta pesquisa. Confira o CPF e a data de nascimento.",
    );
    expect(screen.getByLabelText("CPF")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Data de nascimento")).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("429: muitas tentativas", async () => {
    const cliente = criarCliente(pesquisaDeTeste("identificada"));
    cliente.identificar.mockImplementation(() =>
      Promise.reject(new ErroPesquisaPublica(429)),
    );
    await irParaIdentificacao("identificada", cliente);
    preencher();
    continuar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas. Tente de novo em alguns minutos.",
    );
  });

  it("409: a pessoa já respondeu", async () => {
    const cliente = criarCliente(pesquisaDeTeste("identificada"));
    cliente.identificar.mockImplementation(() =>
      Promise.reject(new ErroPesquisaPublica(409)),
    );
    await irParaIdentificacao("identificada", cliente);
    preencher();
    continuar();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Você já respondeu esta pesquisa",
      }),
    ).toHaveFocus();
  });

  it("confidencial: explica que as respostas não ficam ligadas ao nome", async () => {
    await irParaIdentificacao("confidencial");
    expect(
      screen.getByText(/depois da confirmação, as respostas não ficam ligadas/),
    ).toBeInTheDocument();
  });
});

describe("T216 — uma pergunta por tela", () => {
  async function comecar(cliente = criarCliente()) {
    await abrir(cliente);
    iniciar();
    return cliente;
  }

  it("contador, progresso fino, título focado e só a pergunta atual", async () => {
    await comecar();
    expect(tituloAtual()).toHaveAccessibleName(
      /Tenho clareza sobre o que se espera do meu trabalho/,
    );
    expect(tituloAtual()).toHaveFocus();
    expect(screen.getByText(/Pergunta 1 de 10/)).toBeInTheDocument();
    expect(screen.getByText(/Sobre o trabalho/)).toBeInTheDocument();
    expect(screen.getByText("Pense nas últimas semanas.")).toBeInTheDocument();
    const barra = screen.getByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "1");
    expect(barra).toHaveAttribute("aria-valuemax", "10");
    expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
    expect(
      screen.queryByText(/Participou de algum treinamento/),
    ).not.toBeInTheDocument();
  });

  it("Próximo fica desabilitado até responder a obrigatória", async () => {
    await comecar();
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    marcar(/Tenho clareza/, "Concordo");
    expect(screen.getByRole("button", { name: "Próximo" })).toBeEnabled();
    proximo();
    expect(tituloAtual()).toHaveAccessibleName(/Participou de algum/);
    expect(tituloAtual()).toHaveFocus();
    expect(screen.getByText(/Pergunta 2 de 10/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
    // A descrição da seção aparece só na primeira pergunta dela.
    expect(
      screen.queryByText("Pense nas últimas semanas."),
    ).not.toBeInTheDocument();
  });

  it("opcional: mostra (opcional) e deixa avançar em branco", async () => {
    await comecar();
    irAte("q-est");
    expect(tituloAtual()).toHaveTextContent("(opcional)");
    expect(screen.getByRole("button", { name: "Próximo" })).toBeEnabled();
    proximo();
    expect(idAtual()).toBe("q-uni");
    expect(tituloAtual()).not.toHaveTextContent("(opcional)");
  });

  it("Anterior volta e mantém o que foi respondido", async () => {
    await comecar();
    irAte("q-nota");
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(idAtual()).toBe("q-sn");
    expect(tituloAtual()).toHaveFocus();
    expect(
      within(radios(/Participou/)).getByRole("radio", { name: "Não" }),
    ).toBeChecked();
  });

  it("Enter avança quando a resposta é válida", async () => {
    await comecar();
    marcar(/Tenho clareza/, "Concordo");
    fireEvent.keyDown(
      within(radios(/Tenho clareza/)).getByRole("radio", { name: "Concordo" }),
      { key: "Enter" },
    );
    expect(idAtual()).toBe("q-sn");
  });

  it("Enter sem resposta válida mostra o erro e não avança", async () => {
    await comecar();
    fireEvent.keyDown(
      within(radios(/Tenho clareza/)).getByRole("radio", { name: "Concordo" }),
      { key: "Enter" },
    );
    expect(idAtual()).toBe("q-conc");
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    expect(emAlerta("Escolha uma opção para continuar.")).not.toBeNull();
    expect(radios(/Tenho clareza/)).toHaveAttribute("aria-invalid", "true");
  });

  it("Enter no parágrafo não avança (é quebra de linha)", async () => {
    const cliente = await comecar();
    irAoFim();
    const campo = screen.getByLabelText(/comentário/);
    fireEvent.change(campo, { target: { value: "Linha" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(idAtual()).toBe("q-par");
    expect(cliente.enviarRespostas).not.toHaveBeenCalled();
  });

  it("a última pergunta envia", async () => {
    await comecar();
    irAoFim();
    expect(screen.getByText(/Pergunta 10 de 10/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar respostas" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Próximo" }),
    ).not.toBeInTheDocument();
  });
});

describe("T216 — tipos de pergunta", () => {
  async function irPara(id: string) {
    const cliente = criarCliente();
    await abrir(cliente);
    iniciar();
    irAte(id);
    return cliente;
  }

  it("concordância: cinco opções, de discordo totalmente a concordo totalmente", async () => {
    await irPara("q-conc");
    const opcoes = within(radios(/Tenho clareza/)).getAllByRole("radio");
    expect(opcoes.map((r) => r.getAttribute("value"))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(
      within(radios(/Tenho clareza/)).getByRole("radio", {
        name: "Concordo totalmente",
      }),
    ).toBeInTheDocument();
  });

  it("nota 0–10 (eNPS): onze opções e os extremos explicados", async () => {
    await irPara("q-nota");
    const g = radios(/De 0 a 10/);
    expect(within(g).getAllByRole("radio")).toHaveLength(11);
    expect(g).toHaveAccessibleDescription(
      expect.stringContaining("Nada provável"),
    );
  });

  it("escala: quadrados do mínimo ao máximo, com os extremos", async () => {
    await irPara("q-esc");
    const g = radios(/comunicação interna/);
    expect(
      within(g)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(within(g).getByText("Muito ruim")).toBeInTheDocument();
    // Sem rótulo próprio, o extremo diz "Máximo".
    expect(within(g).getByText("Máximo")).toBeInTheDocument();
  });

  it("estrelas: de 1 a 5, com nome acessível e resumo da escolha", async () => {
    await irPara("q-est");
    const g = radios(/refeitório/);
    fireEvent.click(within(g).getByRole("radio", { name: "3 estrelas" }));
    expect(within(g).getByRole("radio", { name: "3 estrelas" })).toBeChecked();
    expect(screen.getByText("Você deu 3 de 5 estrelas.")).toBeInTheDocument();
    expect(
      within(g).getByRole("radio", { name: "1 estrela" }),
    ).toBeInTheDocument();
  });

  it("escolha única com Outro: pede o texto da outra opção", async () => {
    await irPara("q-uni");
    marcar(/Qual o seu turno/, "Outro");
    const campo = screen.getByLabelText("Qual é a outra opção?");
    proximo();
    expect(emAlerta("Escreva qual é a outra opção.")).not.toBeNull();
    expect(idAtual()).toBe("q-uni");
    fireEvent.change(campo, { target: { value: "Noite" } });
    proximo();
    expect(idAtual()).toBe("q-mul");
  });

  it("múltipla escolha respeita o máximo (Outro conta como escolha)", async () => {
    await irPara("q-mul");
    const g = screen.getByRole("group", { name: /benefícios/ });
    expect(screen.getByText("Escolha até 2 opções.")).toBeInTheDocument();
    fireEvent.click(within(g).getByRole("checkbox", { name: "Vale-refeição" }));
    fireEvent.click(within(g).getByRole("checkbox", { name: "Outro" }));
    expect(
      within(g).getByRole("checkbox", { name: "Plano de saúde" }),
    ).toBeDisabled();
    expect(
      within(g).getByRole("checkbox", { name: "Academia" }),
    ).toBeDisabled();
    fireEvent.click(within(g).getByRole("checkbox", { name: "Outro" }));
    expect(
      within(g).getByRole("checkbox", { name: "Plano de saúde" }),
    ).toBeEnabled();
  });

  it("data: valida dd/mm/aaaa e dia que existe", async () => {
    await irPara("q-data");
    const campo = screen.getByLabelText(/última avaliação/);
    fireEvent.change(campo, { target: { value: "3102202" } });
    expect(campo).toHaveValue("31/02/202");
    proximo();
    expect(
      emAlerta("Informe uma data válida, no formato dd/mm/aaaa."),
    ).not.toBeNull();
    fireEvent.change(campo, { target: { value: "31022024" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(idAtual()).toBe("q-data");
    fireEvent.change(campo, { target: { value: "29022024" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(idAtual()).toBe("q-num");
  });

  it.each([
    ["abc", "Informe um número."],
    ["2,5", "Informe um número inteiro, sem casas decimais."],
    ["41", "Informe um número entre 0 e 40."],
    ["-1", "Informe um número entre 0 e 40."],
  ])("número %s: %s", async (digitado, mensagem) => {
    await irPara("q-num");
    const campo = screen.getByLabelText(/horas de treinamento/);
    expect(
      screen.getByText("Número inteiro, entre 0 e 40."),
    ).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: digitado } });
    proximo();
    expect(emAlerta(mensagem)).not.toBeNull();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveFocus();
    expect(idAtual()).toBe("q-num");
  });

  it("parágrafo tem limite de caracteres", async () => {
    await irPara("q-par");
    const campo = screen.getByLabelText(/comentário/);
    expect(campo.tagName).toBe("TEXTAREA");
    expect(campo).toHaveAttribute("maxlength", "3000");
  });

  it("envia cada tipo na forma do contrato", async () => {
    const cliente = await irPara("q-conc");
    marcar(/Tenho clareza/, "Concordo");
    proximo();
    marcar(/Participou/, "Sim");
    proximo();
    fireEvent.change(screen.getByLabelText(/Qual treinamento/), {
      target: { value: "  Segurança no trabalho  " },
    });
    proximo();
    marcar(/De 0 a 10/, "9");
    proximo();
    marcar(/comunicação interna/, "2");
    proximo();
    fireEvent.click(
      within(radios(/refeitório/)).getByRole("radio", { name: "5 estrelas" }),
    );
    proximo();
    marcar(/Qual o seu turno/, "Manhã");
    proximo();
    const g = screen.getByRole("group", { name: /benefícios/ });
    fireEvent.click(within(g).getByRole("checkbox", { name: "Academia" }));
    fireEvent.click(within(g).getByRole("checkbox", { name: "Outro" }));
    fireEvent.change(screen.getByLabelText("Qual é a outra opção?"), {
      target: { value: "Creche" },
    });
    proximo();
    fireEvent.change(screen.getByLabelText(/última avaliação/), {
      target: { value: "29022024" },
    });
    proximo();
    fireEvent.change(screen.getByLabelText(/horas de treinamento/), {
      target: { value: "12" },
    });
    proximo();
    fireEvent.change(screen.getByLabelText(/comentário/), {
      target: { value: "Tudo certo." },
    });
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    expect(cliente.enviarRespostas).toHaveBeenCalledWith(TOKEN, {
      respostas: [
        { perguntaId: "q-conc", valor: 4 },
        { perguntaId: "q-sn", valor: "sim" },
        { perguntaId: "q-cond", valor: "Segurança no trabalho" },
        { perguntaId: "q-nota", valor: 9 },
        { perguntaId: "q-esc", valor: 2 },
        { perguntaId: "q-est", valor: 5 },
        { perguntaId: "q-uni", valor: { opcao: "manha" } },
        {
          perguntaId: "q-mul",
          valor: { opcoes: ["academia"], outro: "Creche" },
        },
        { perguntaId: "q-data", valor: "2024-02-29" },
        { perguntaId: "q-num", valor: 12 },
        { perguntaId: "q-par", valor: "Tudo certo." },
      ],
    });
  });
});

describe("T216 — lógica condicional", () => {
  it("Sim inclui a pergunta na contagem; Não a tira, e o valor não é enviado", async () => {
    const cliente = criarCliente();
    await abrir(cliente);
    iniciar();
    irAte("q-sn");
    expect(screen.getByText(/Pergunta 2 de 10/)).toBeInTheDocument();
    marcar(/Participou/, "Sim");
    expect(screen.getByText(/Pergunta 2 de 11/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "11",
    );
    proximo();
    expect(idAtual()).toBe("q-cond");
    // Obrigatória e visível: Próximo espera a resposta.
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Qual treinamento/), {
      target: { value: "Primeiros socorros" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    marcar(/Participou/, "Não");
    expect(screen.getByText(/Pergunta 2 de 10/)).toBeInTheDocument();
    proximo();
    expect(idAtual()).toBe("q-nota");
    irAoFim();
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    const [, envio] = cliente.enviarRespostas.mock.calls[0] as unknown as [
      string,
      { respostas: { perguntaId: string }[] },
    ];
    expect(envio.respostas.map((r) => r.perguntaId)).not.toContain("q-cond");
  });
});

describe("T216 — envio", () => {
  async function ateOFim(cliente = criarCliente()) {
    await abrir(cliente);
    iniciar();
    irAoFim();
    return cliente;
  }

  it("sucesso: cartão de agradecimento focado e rascunho limpo", async () => {
    await ateOFim();
    expect(
      window.sessionStorage.getItem(`evolli.pesquisa.${TOKEN}.rascunho`),
    ).not.toBeNull();
    enviar();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Agradecemos a sua participação!",
      }),
    ).toHaveFocus();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      window.sessionStorage.getItem(`evolli.pesquisa.${TOKEN}.rascunho`),
    ).toBeNull();
  });

  it("falha: avisa, mantém as respostas e permite tentar de novo", async () => {
    const cliente = criarCliente();
    cliente.enviarRespostas
      .mockImplementationOnce(() => Promise.reject(new Error("rede")))
      .mockImplementationOnce(() => Promise.resolve());
    await ateOFim(cliente);
    enviar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar suas respostas agora. Elas continuam preenchidas; tente de novo.",
    );
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    }
    expect(idAtual()).toBe("q-esc");
    expect(
      within(radios(/comunicação interna/)).getByRole("radio", { name: "4" }),
    ).toBeChecked();
    irAoFim();
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    expect(cliente.enviarRespostas).toHaveBeenCalledTimes(2);
    expect(cliente.enviarRespostas.mock.calls[1]).toEqual(
      cliente.enviarRespostas.mock.calls[0],
    );
  });

  it("identificada: envia o passe da identificação", async () => {
    const cliente = criarCliente(pesquisaDeTeste("identificada"));
    await abrir(cliente);
    iniciar();
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: /Tenho clareza/ });
    irAoFim();
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    expect(cliente.enviarRespostas).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ passe: "passe-1" }),
    );
  });

  it("422: volta à pergunta recusada e a marca", async () => {
    const cliente = criarCliente();
    cliente.enviarRespostas.mockImplementationOnce(() =>
      Promise.reject(
        new ErroPesquisaPublica(422, [{ campo: "q-esc", motivo: "x" }]),
      ),
    );
    await ateOFim(cliente);
    enviar();
    expect(
      await screen.findByRole("heading", { name: /comunicação interna/ }),
    ).toBeInTheDocument();
    expect(radios(/comunicação interna/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(emAlerta("Revise esta resposta.")).not.toBeNull();
  });

  it("409 no envio: já respondeu", async () => {
    const cliente = criarCliente();
    cliente.enviarRespostas.mockImplementationOnce(() =>
      Promise.reject(new ErroPesquisaPublica(409)),
    );
    await ateOFim(cliente);
    enviar();
    expect(
      await screen.findByRole("heading", {
        name: "Você já respondeu esta pesquisa",
      }),
    ).toBeInTheDocument();
  });

  it("410 no envio: a pesquisa deixou de aceitar respostas", async () => {
    const cliente = criarCliente();
    cliente.enviarRespostas.mockImplementationOnce(() =>
      Promise.reject(new ErroPesquisaPublica(410, [], "pausada")),
    );
    await ateOFim(cliente);
    enviar();
    expect(
      await screen.findByRole("heading", {
        name: "Esta pesquisa está pausada",
      }),
    ).toBeInTheDocument();
  });

  it("passe vencido (401): pede os dados de novo e volta à última pergunta", async () => {
    const cliente = criarCliente(pesquisaDeTeste("confidencial"));
    cliente.enviarRespostas
      .mockImplementationOnce(() =>
        Promise.reject(new ErroPesquisaPublica(401)),
      )
      .mockImplementationOnce(() => Promise.resolve());
    cliente.identificar
      .mockImplementationOnce(() =>
        Promise.resolve({ passe: "passe-1", primeiroNome: "Alex" }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ passe: "passe-2", primeiroNome: "Alex" }),
      );
    await abrir(cliente);
    const identificar = () => {
      fireEvent.change(screen.getByLabelText("CPF"), {
        target: { value: CPF_TESTE },
      });
      fireEvent.change(screen.getByLabelText("Data de nascimento"), {
        target: { value: "15041990" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    };
    iniciar();
    identificar();
    await screen.findByRole("heading", { name: /Tenho clareza/ });
    irAoFim();
    enviar();
    expect(
      await screen.findByText(/confirme seus dados de novo para enviar/),
    ).toBeInTheDocument();
    identificar();
    fireEvent.click(
      await screen.findByRole("button", { name: "Enviar respostas" }),
    );
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    expect(cliente.enviarRespostas).toHaveBeenLastCalledWith(
      TOKEN,
      expect.objectContaining({ passe: "passe-2" }),
    );
  });
});

describe("T216 — anônima", () => {
  const CHAVE = `evolli.pesquisa.${TOKEN}.respondida`;

  it("não pede identificação e marca o navegador ao enviar", async () => {
    const cliente = criarCliente();
    await abrir(cliente);
    expect(screen.getByText(/Ninguém pede seus dados/)).toBeInTheDocument();
    iniciar();
    expect(screen.queryByLabelText("CPF")).not.toBeInTheDocument();
    irAoFim();
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    expect(cliente.identificar).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CHAVE)).toBe("1");
    const [, envio] = cliente.enviarRespostas.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(envio).not.toHaveProperty("passe");
  });

  it("navegador que já respondeu: mostra o aviso, mas deixa começar", async () => {
    window.localStorage.setItem(CHAVE, "1");
    await abrir();
    expect(
      screen.getByText(/Este navegador já enviou uma resposta/),
    ).toBeInTheDocument();
    iniciar();
    expect(idAtual()).toBe("q-conc");
  });

  it("identificada não mostra o aviso do navegador", async () => {
    window.localStorage.setItem(CHAVE, "1");
    await abrir(criarCliente(pesquisaDeTeste("identificada")));
    expect(
      screen.queryByText(/Este navegador já enviou uma resposta/),
    ).not.toBeInTheDocument();
  });

  it("armazenamento bloqueado não quebra a página", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    await abrir();
    iniciar();
    irAoFim();
    enviar();
    expect(
      await screen.findByRole("heading", {
        name: "Agradecemos a sua participação!",
      }),
    ).toBeInTheDocument();
  });
});

describe("T216 — rascunho no sessionStorage", () => {
  it("recarregar mantém as respostas (e nunca guarda o CPF)", async () => {
    const cliente = criarCliente(pesquisaDeTeste("identificada"));
    const primeira = renderizar(cliente);
    await screen.findByRole("heading", { name: "Pulso do trimestre" });
    iniciar();
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: /Tenho clareza/ });
    marcar(/Tenho clareza/, "Concordo totalmente");
    const guardado = window.sessionStorage.getItem(
      `evolli.pesquisa.${TOKEN}.rascunho`,
    );
    expect(guardado).toContain("q-conc");
    expect(guardado).not.toContain(CPF_TESTE);
    expect(guardado).not.toContain("passe");
    primeira.unmount();

    await abrir(cliente);
    iniciar();
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: /Tenho clareza/ });
    expect(
      within(radios(/Tenho clareza/)).getByRole("radio", {
        name: "Concordo totalmente",
      }),
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Próximo" })).toBeEnabled();
  });

  it("a escolha de grupo também volta ao recarregar", async () => {
    const cliente = criarCliente(
      pesquisaDeTeste("anonima", { grupos: GRUPOS }),
    );
    const primeira = renderizar(cliente);
    await screen.findByRole("heading", { name: "Pulso do trimestre" });
    fireEvent.click(screen.getByRole("combobox", { name: "Unidade" }));
    fireEvent.click(screen.getByRole("option", { name: "Matriz" }));
    primeira.unmount();
    await abrir(cliente);
    expect(screen.getByRole("combobox", { name: "Unidade" })).toHaveTextContent(
      "Matriz",
    );
  });

  it("rascunho corrompido é ignorado", async () => {
    window.sessionStorage.setItem(`evolli.pesquisa.${TOKEN}.rascunho`, "{x");
    window.sessionStorage.setItem(`evolli.pesquisa.${TOKEN}.grupos`, "[1]");
    await abrir();
    iniciar();
    expect(
      within(radios(/Tenho clareza/)).getByRole("radio", { name: "Concordo" }),
    ).not.toBeChecked();
  });
});

describe("T216 — revisão lado a lado", () => {
  it("o título da aba é '<nome> | Pesquisa' e volta ao sair", async () => {
    document.title = "Antes";
    const { unmount } = await abrir();
    expect(document.title).toBe("Pulso do trimestre | Pesquisa");
    unmount();
    expect(document.title).toBe("Antes");
  });

  it("o tempo estimado segue a regra única, não o número da API", async () => {
    await abrir(
      criarCliente(
        pesquisaDeTeste("anonima", { totalPerguntas: 30, minutosEstimados: 2 }),
      ),
    );
    expect(screen.getByText("cerca de 9 minutos")).toBeInTheDocument();
  });

  it("Continuar fica desabilitado até CPF e data estarem completos", async () => {
    await abrir(criarCliente(pesquisaDeTeste("identificada")));
    iniciar();
    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    expect(continuar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "150419" },
    });
    expect(continuar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    expect(continuar).toBeEnabled();
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: "2074319584" },
    });
    expect(continuar).toBeDisabled();
  });

  it("Mínimo e Máximo ficam acima da fileira da escala", async () => {
    await abrir();
    iniciar();
    irAte("q-esc");
    const g = radios(/comunicação interna/);
    const extremo = within(g).getByText("Muito ruim");
    const primeiro = within(g).getAllByRole("radio")[0]!;
    expect(
      extremo.compareDocumentPosition(primeiro) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("o foco programático nos títulos não desenha contorno", () => {
    const css = readFileSync(
      "src/screens/publico/ResponderPesquisa.css",
      "utf8",
    ).replace(/\r\n/g, "\n");
    const regra =
      /\.pesquisa-publica__titulo:focus-visible,\n\.pesquisa-pergunta__texto:focus,\n\.pesquisa-pergunta__texto:focus-visible \{\n {2}outline: none;/;
    expect(css).toMatch(regra);
  });
});

describe("T216 — Personalizada: uma seção por vez", () => {
  const PERSONALIZADA = pesquisaDeTeste("anonima", { modelo: "personalizada" });

  async function comecar(cliente = criarCliente(PERSONALIZADA)) {
    await abrir(cliente);
    iniciar();
    return cliente;
  }

  it("mostra a seção inteira, com 'Seção N de M' e o título focado", async () => {
    await comecar();
    expect(screen.getByText("Seção 1 de 3")).toBeInTheDocument();
    const titulo = screen.getByRole("heading", {
      level: 1,
      name: "Sobre o trabalho",
    });
    expect(titulo).toHaveFocus();
    expect(screen.getByText("Pense nas últimas semanas.")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.id),
    ).toEqual(["q-q-conc-titulo", "q-q-sn-titulo", "q-q-nota-titulo"]);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Seção 1 de 3",
    );
  });

  it("Próximo espera todas as obrigatórias da seção, inclusive a condicional", async () => {
    await comecar();
    const proximoBotao = () => screen.getByRole("button", { name: "Próximo" });
    // Seção inteira: o botão fica ativo e a tela diz quantas faltam.
    const faltam = () => screen.queryByText(/^Falta responder/)?.textContent;
    marcar(/Tenho clareza/, "Concordo");
    marcar(/De 0 a 10/, "9");
    expect(faltam()).toBe("Falta responder 1 pergunta obrigatória.");
    marcar(/Participou/, "Sim");
    expect(screen.getByLabelText(/Qual treinamento/)).toBeInTheDocument();
    expect(faltam()).toBe("Falta responder 1 pergunta obrigatória.");
    fireEvent.change(screen.getByLabelText(/Qual treinamento/), {
      target: { value: "Primeiros socorros" },
    });
    expect(faltam()).toBeUndefined();
    expect(proximoBotao()).toBeEnabled();
    marcar(/Participou/, "Não");
    expect(screen.queryByLabelText(/Qual treinamento/)).not.toBeInTheDocument();
    proximo();
    expect(screen.getByText("Seção 2 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Detalhes" }),
    ).toHaveFocus();
  });

  it("valida a seção inteira e mostra o resumo do erro", async () => {
    await comecar();
    marcar(/Tenho clareza/, "Concordo");
    marcar(/Participou/, "Não");
    marcar(/De 0 a 10/, "9");
    proximo();
    marcar(/comunicação interna/, "4");
    marcar(/Qual o seu turno/, "Outro");
    proximo();
    expect(
      screen.getByText("Revise a pergunta indicada antes de continuar."),
    ).toHaveAttribute("role", "alert");
    expect(emAlerta("Escreva qual é a outra opção.")).not.toBeNull();
    expect(screen.getByText("Seção 2 de 3")).toBeInTheDocument();
  });

  it("Anterior volta à seção anterior e a última envia tudo", async () => {
    const cliente = await comecar();
    marcar(/Tenho clareza/, "Concordo");
    marcar(/Participou/, "Não");
    marcar(/De 0 a 10/, "9");
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("Seção 1 de 3")).toBeInTheDocument();
    expect(
      within(radios(/De 0 a 10/)).getByRole("radio", { name: "9" }),
    ).toBeChecked();
    proximo();
    marcar(/comunicação interna/, "4");
    marcar(/Qual o seu turno/, "Tarde");
    proximo();
    expect(
      screen.getByRole("heading", { level: 1, name: "Seção 3" }),
    ).toBeInTheDocument();
    enviar();
    await screen.findByRole("heading", {
      name: "Agradecemos a sua participação!",
    });
    const [, envio] = cliente.enviarRespostas.mock.calls[0] as unknown as [
      string,
      { respostas: { perguntaId: string }[] },
    ];
    expect(envio.respostas.map((r) => r.perguntaId)).toEqual([
      "q-conc",
      "q-sn",
      "q-nota",
      "q-esc",
      "q-uni",
    ]);
  });

  it("modelo pronto continua com uma pergunta por tela", async () => {
    await abrir(criarCliente(pesquisaDeTeste("anonima", { modelo: "pulso" })));
    iniciar();
    expect(screen.getByText(/Pergunta 1 de 10/)).toBeInTheDocument();
  });
});

describe("T216 — pré-visualização do RH", () => {
  function previa(identificacao: Identificacao = "identificada") {
    const p = pesquisaDeTeste(identificacao);
    return montarPreviaPublica({
      empresa: p.empresa,
      nome: p.nome,
      boasVindas: p.boasVindas,
      identificacao,
      modelo: "pulso",
      secoes: p.secoes,
    });
  }

  it("monta a estrutura com a contagem e o tempo da regra única", () => {
    const p = previa();
    expect(p.totalPerguntas).toBe(11);
    expect(p.minutosEstimados).toBe(3);
    expect(p.modelo).toBe("pulso");
    expect(p).not.toHaveProperty("grupos");
  });

  it("faixa, diálogo inicial, fluxo real e agradecimento sem gravar nada", async () => {
    const espiao = vi.spyOn(globalThis, "fetch");
    const sair = vi.fn();
    render(<ResponderPesquisa previa={previa()} aoSairDaPrevia={sair} />);
    expect(screen.getByRole("note")).toHaveTextContent(
      "Pré-visualização: nada do que for respondido aqui é gravado.",
    );
    const dialogo = screen.getByRole("dialog", {
      name: "Esta é uma pré-visualização",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", {
        name: "Começar a pré-visualização",
      }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Pulso do trimestre",
      }),
    ).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    iniciar();
    expect(screen.getByText(/a confirmação é simulada/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "01012000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(idAtual()).toBe("q-conc");
    marcar(/Tenho clareza/, "Concordo");
    proximo();
    marcar(/Participou/, "Sim");
    proximo();
    expect(idAtual()).toBe("q-cond");
    PADRAO["q-cond"]!();
    proximo();
    irAoFim();
    enviar();
    expect(
      screen.getByRole("heading", {
        name: "Agradecemos a sua participação!",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Esta foi uma pré-visualização: nenhuma resposta foi gravada.",
      ),
    ).toBeInTheDocument();
    expect(espiao).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Sair da pré-visualização" }),
    );
    expect(sair).toHaveBeenCalledTimes(1);
  });

  it("CPF inválido continua recusado na prévia", () => {
    render(<ResponderPesquisa previa={previa()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Começar a pré-visualização" }),
    );
    iniciar();
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: "20743195842" },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "01012000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(emAlerta("Informe um CPF válido, com 11 números.")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sair da pré-visualização" }),
    ).not.toBeInTheDocument();
  });
});
