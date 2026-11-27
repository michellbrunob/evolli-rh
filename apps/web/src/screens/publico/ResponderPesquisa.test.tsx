import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErroPesquisaPublica,
  type AberturaPublica,
  type ClientePesquisaPublica,
  type Identificacao,
  type Pergunta,
  type PesquisaPublica,
} from "../../api/pesquisaPublicaClient";
import { ResponderPesquisa } from "./ResponderPesquisa";

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
              maximo: 5,
              rotuloMinimo: "Muito ruim",
              rotuloMaximo: "Excelente",
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

function grupo(nome: RegExp) {
  return screen.getByRole("group", { name: nome });
}

function marcar(nomeDoGrupo: RegExp, opcao: string) {
  fireEvent.click(
    within(grupo(nomeDoGrupo)).getByRole("radio", { name: opcao }),
  );
}

function continuar() {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

function enviar() {
  fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
}

/** O texto está dentro de uma região role=alert. */
function emAlerta(texto: string) {
  return screen.getByText(texto).closest("[role='alert']");
}

/** Preenche a seção 1 válida (sem treinamento). */
function preencherSecao1() {
  marcar(/Tenho clareza/, "Concordo");
  marcar(/Participou de algum treinamento/, "Não");
  marcar(/De 0 a 10/, "9");
}

function preencherSecao2() {
  marcar(/comunicação interna/, "4");
  marcar(/Qual o seu turno/, "Tarde");
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("T216 — abertura", () => {
  it("mostra empresa, nome, boas-vindas em parágrafos, perguntas, tempo e Começar", async () => {
    const { cliente } = await abrir();
    expect(cliente.abrir).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText("Empresa Exemplo Ltda")).toBeInTheDocument();
    expect(screen.getByText("Queremos ouvir você.")).toBeInTheDocument();
    expect(screen.getByText("Leva poucos minutos.")).toBeInTheDocument();
    expect(
      screen.getByText("11 perguntas · cerca de 5 minutos"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar" })).toBeEnabled();
    expect(screen.getByRole("img", { name: "Evolli" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Pulso do trimestre" }),
    ).toHaveFocus();
  });

  it("concorda no singular: 1 pergunta, cerca de 1 minuto", async () => {
    await abrir(
      criarCliente(
        pesquisaDeTeste("anonima", { totalPerguntas: 1, minutosEstimados: 1 }),
      ),
    );
    expect(
      screen.getByText("1 pergunta · cerca de 1 minuto"),
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
    ["encerrada", "Esta pesquisa foi encerrada"],
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
        screen.queryByRole("button", { name: "Começar" }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("T216 — identificação", () => {
  async function irParaIdentificacao(
    identificacao: Identificacao = "identificada",
    cliente = criarCliente(pesquisaDeTeste(identificacao)),
  ) {
    await abrir(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
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

  it("aplica as máscaras e identifica com CPF em dígitos e data ISO", async () => {
    const cliente = await irParaIdentificacao();
    preencher();
    expect(screen.getByLabelText("CPF")).toHaveValue("207.431.958-41");
    expect(screen.getByLabelText("Data de nascimento")).toHaveValue(
      "15/04/1990",
    );
    continuar();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Sobre o trabalho",
      }),
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
      screen.getByText(/as respostas não ficam ligadas ao seu nome/),
    ).toBeInTheDocument();
  });

  it("identificada: avisa na abertura que o RH vê o nome", async () => {
    await abrir(criarCliente(pesquisaDeTeste("identificada")));
    expect(
      screen.getByText(
        /o RH da empresa vê as suas respostas junto com o seu nome/,
      ),
    ).toBeInTheDocument();
  });
});

describe("T216 — seções, progresso e obrigatórias", () => {
  async function comecarAnonima(cliente = criarCliente()) {
    await abrir(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    return cliente;
  }

  it("uma seção por vez, com progresso e foco no título", async () => {
    await comecarAnonima();
    expect(
      screen.getByRole("heading", { level: 1, name: "Sobre o trabalho" }),
    ).toHaveFocus();
    expect(screen.getByText("Pense nas últimas semanas.")).toBeInTheDocument();
    const barra = screen.getByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "1");
    expect(barra).toHaveAttribute("aria-valuemax", "3");
    expect(screen.getByText("Seção 1 de 3")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Voltar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Como avalia a comunicação interna?"),
    ).not.toBeInTheDocument();
  });

  it("não avança sem as obrigatórias e mostra cada erro com role=alert", async () => {
    await comecarAnonima();
    continuar();
    expect(
      screen.getByText("Revise as perguntas indicadas antes de continuar."),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getAllByText("Escolha uma opção para continuar."),
    ).toHaveLength(3);
    expect(grupo(/Tenho clareza/)).toHaveAttribute("aria-invalid", "true");
    // O foco vai ao primeiro campo com erro.
    expect(
      within(grupo(/Tenho clareza/)).getByRole("radio", {
        name: "Discordo totalmente",
      }),
    ).toHaveFocus();
    expect(screen.getByText("Seção 1 de 3")).toBeInTheDocument();
  });

  it("o erro some ao responder a pergunta", async () => {
    await comecarAnonima();
    continuar();
    marcar(/Tenho clareza/, "Concordo");
    expect(grupo(/Tenho clareza/)).not.toHaveAttribute("aria-invalid");
    expect(
      screen.getAllByText("Escolha uma opção para continuar."),
    ).toHaveLength(2);
  });

  it("avança, volta e mantém o que foi preenchido", async () => {
    await comecarAnonima();
    preencherSecao1();
    continuar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Detalhes" }),
    ).toHaveFocus();
    expect(screen.getByText("Seção 2 de 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Sobre o trabalho" }),
    ).toHaveFocus();
    expect(
      within(grupo(/Tenho clareza/)).getByRole("radio", { name: "Concordo" }),
    ).toBeChecked();
    expect(
      within(grupo(/De 0 a 10/)).getByRole("radio", { name: "9" }),
    ).toBeChecked();
  });

  it("seção sem título usa 'Seção N' e a última envia", async () => {
    await comecarAnonima();
    preencherSecao1();
    continuar();
    preencherSecao2();
    continuar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Seção 3" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar respostas" }),
    ).toBeInTheDocument();
  });
});

describe("T216 — tipos de pergunta", () => {
  async function irParaSecao(n: 1 | 2 | 3) {
    const cliente = criarCliente();
    await abrir(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    if (n >= 2) {
      preencherSecao1();
      continuar();
    }
    if (n === 3) {
      preencherSecao2();
      continuar();
    }
    return cliente;
  }

  it("concordância: cinco opções, de discordo totalmente a concordo totalmente", async () => {
    await irParaSecao(1);
    const radios = within(grupo(/Tenho clareza/)).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("value"))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(
      within(grupo(/Tenho clareza/)).getByRole("radio", {
        name: "Concordo totalmente",
      }),
    ).toBeInTheDocument();
  });

  it("nota 0–10 (eNPS): onze opções e os extremos explicados", async () => {
    await irParaSecao(1);
    const g = grupo(/De 0 a 10/);
    expect(within(g).getAllByRole("radio")).toHaveLength(11);
    expect(g).toHaveAccessibleDescription(
      expect.stringContaining("0: nada provável"),
    );
  });

  it("escala: do mínimo ao máximo, com os rótulos dos extremos", async () => {
    await irParaSecao(2);
    const g = grupo(/comunicação interna/);
    expect(
      within(g)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual(["1", "2", "3", "4", "5"]);
    expect(within(g).getByText("1: Muito ruim")).toBeInTheDocument();
    expect(within(g).getByText("5: Excelente")).toBeInTheDocument();
  });

  it("estrelas: de 1 a 5, com nome acessível e resumo da escolha", async () => {
    await irParaSecao(2);
    const g = grupo(/refeitório/);
    fireEvent.click(within(g).getByRole("radio", { name: "3 estrelas" }));
    expect(within(g).getByRole("radio", { name: "3 estrelas" })).toBeChecked();
    expect(
      within(g).getByText("Você deu 3 de 5 estrelas."),
    ).toBeInTheDocument();
    expect(
      within(g).getByRole("radio", { name: "1 estrela" }),
    ).toBeInTheDocument();
  });

  it("escolha única com Outro: pede o texto da outra opção", async () => {
    await irParaSecao(2);
    marcar(/comunicação interna/, "4");
    marcar(/Qual o seu turno/, "Outro");
    const campo = screen.getByLabelText("Qual é a outra opção?");
    continuar();
    expect(
      within(grupo(/Qual o seu turno/)).getByRole("alert"),
    ).toHaveTextContent("Escreva qual é a outra opção.");
    fireEvent.change(campo, { target: { value: "Noite" } });
    continuar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Seção 3" }),
    ).toBeInTheDocument();
  });

  it("múltipla escolha respeita o máximo (Outro conta como escolha)", async () => {
    await irParaSecao(2);
    const g = grupo(/benefícios/);
    expect(within(g).getByText("Escolha até 2 opções.")).toBeInTheDocument();
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
    await irParaSecao(3);
    const campo = screen.getByLabelText(/última avaliação/);
    fireEvent.change(campo, { target: { value: "3102202" } });
    expect(campo).toHaveValue("31/02/202");
    enviar();
    expect(
      emAlerta("Informe uma data válida, no formato dd/mm/aaaa."),
    ).not.toBeNull();
    fireEvent.change(campo, { target: { value: "31022024" } });
    enviar();
    expect(
      screen.getByText("Informe uma data válida, no formato dd/mm/aaaa."),
    ).toBeInTheDocument();
  });

  it.each([
    ["abc", "Informe um número."],
    ["2,5", "Informe um número inteiro, sem casas decimais."],
    ["41", "Informe um número entre 0 e 40."],
    ["-1", "Informe um número entre 0 e 40."],
  ])("número %s: %s", async (digitado, mensagem) => {
    await irParaSecao(3);
    const campo = screen.getByLabelText(/horas de treinamento/);
    expect(
      screen.getByText("Número inteiro, entre 0 e 40."),
    ).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: digitado } });
    enviar();
    expect(emAlerta(mensagem)).not.toBeNull();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveFocus();
  });

  it("textos têm limite de caracteres no campo", async () => {
    await irParaSecao(3);
    expect(screen.getByLabelText(/comentário/)).toHaveAttribute(
      "maxlength",
      "3000",
    );
    expect(screen.getByLabelText(/comentário/).tagName).toBe("TEXTAREA");
  });

  it("envia cada tipo na forma do contrato", async () => {
    const cliente = await irParaSecao(1);
    preencherSecao1();
    // Troca para Sim: a condicional aparece e é respondida.
    marcar(/Participou de algum treinamento/, "Sim");
    fireEvent.change(screen.getByLabelText(/Qual treinamento/), {
      target: { value: "  Segurança no trabalho  " },
    });
    continuar();
    marcar(/comunicação interna/, "2");
    fireEvent.click(
      within(grupo(/refeitório/)).getByRole("radio", { name: "5 estrelas" }),
    );
    marcar(/Qual o seu turno/, "Manhã");
    const g = grupo(/benefícios/);
    fireEvent.click(within(g).getByRole("checkbox", { name: "Academia" }));
    fireEvent.click(within(g).getByRole("checkbox", { name: "Outro" }));
    fireEvent.change(screen.getByLabelText("Qual é a outra opção?"), {
      target: { value: "Creche" },
    });
    continuar();
    fireEvent.change(screen.getByLabelText(/última avaliação/), {
      target: { value: "29022024" },
    });
    fireEvent.change(screen.getByLabelText(/horas de treinamento/), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText(/comentário/), {
      target: { value: "Tudo certo." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    await screen.findByRole("heading", { name: "Respostas enviadas" });
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
  it("a pergunta aparece com Sim, some com Não, e escondida não é exigida nem enviada", async () => {
    const cliente = criarCliente();
    await abrir(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    expect(screen.queryByLabelText(/Qual treinamento/)).not.toBeInTheDocument();

    marcar(/Tenho clareza/, "Concordo");
    marcar(/De 0 a 10/, "9");
    marcar(/Participou de algum treinamento/, "Sim");
    const campo = screen.getByLabelText(/Qual treinamento/);
    fireEvent.change(campo, { target: { value: "Primeiros socorros" } });

    marcar(/Participou de algum treinamento/, "Não");
    expect(screen.queryByLabelText(/Qual treinamento/)).not.toBeInTheDocument();
    continuar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Detalhes" }),
    ).toBeInTheDocument();

    preencherSecao2();
    continuar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    await screen.findByRole("heading", { name: "Respostas enviadas" });
    const [, envio] = cliente.enviarRespostas.mock.calls[0] as unknown as [
      string,
      { respostas: { perguntaId: string }[] },
    ];
    expect(envio.respostas.map((r) => r.perguntaId)).not.toContain("q-cond");
  });

  it("visível e obrigatória, a condicional é exigida", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    marcar(/Tenho clareza/, "Concordo");
    marcar(/De 0 a 10/, "9");
    marcar(/Participou de algum treinamento/, "Sim");
    continuar();
    expect(emAlerta("Escreva uma resposta para continuar.")).not.toBeNull();
    expect(screen.getByLabelText(/Qual treinamento/)).toHaveFocus();
  });
});

describe("T216 — envio", () => {
  async function ateOFim(cliente = criarCliente()) {
    await abrir(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    preencherSecao1();
    continuar();
    preencherSecao2();
    continuar();
    return cliente;
  }

  it("sucesso: agradece, foca o título e limpa o rascunho", async () => {
    await ateOFim();
    expect(
      window.sessionStorage.getItem(`evolli.pesquisa.${TOKEN}.rascunho`),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Respostas enviadas",
      }),
    ).toHaveFocus();
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
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar suas respostas agora. Elas continuam preenchidas; tente de novo.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(
      within(grupo(/comunicação interna/)).getByRole("radio", { name: "4" }),
    ).toBeChecked();
    continuar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    await screen.findByRole("heading", { name: "Respostas enviadas" });
    expect(cliente.enviarRespostas).toHaveBeenCalledTimes(2);
    expect(cliente.enviarRespostas.mock.calls[1]).toEqual(
      cliente.enviarRespostas.mock.calls[0],
    );
  });

  it("identificada: envia o passe da identificação", async () => {
    const cliente = criarCliente(pesquisaDeTeste("identificada"));
    await abrir(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    continuar();
    await screen.findByRole("heading", { name: "Sobre o trabalho" });
    preencherSecao1();
    continuar();
    preencherSecao2();
    continuar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    await screen.findByRole("heading", { name: "Respostas enviadas" });
    expect(cliente.enviarRespostas).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ passe: "passe-1" }),
    );
  });

  it("422: volta à seção da pergunta recusada e a marca", async () => {
    const cliente = criarCliente();
    cliente.enviarRespostas.mockImplementationOnce(() =>
      Promise.reject(
        new ErroPesquisaPublica(422, [{ campo: "q-esc", motivo: "x" }]),
      ),
    );
    await ateOFim(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Detalhes" }),
    ).toBeInTheDocument();
    expect(grupo(/comunicação interna/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Revise esta resposta.")).toBeInTheDocument();
  });

  it("409 no envio: já respondeu", async () => {
    const cliente = criarCliente();
    cliente.enviarRespostas.mockImplementationOnce(() =>
      Promise.reject(new ErroPesquisaPublica(409)),
    );
    await ateOFim(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(
      await screen.findByRole("heading", {
        name: "Esta pesquisa está pausada",
      }),
    ).toBeInTheDocument();
  });

  it("passe vencido (401): pede os dados de novo e volta ao fim com as respostas", async () => {
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
      continuar();
    };
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    identificar();
    await screen.findByRole("heading", { name: "Sobre o trabalho" });
    preencherSecao1();
    continuar();
    preencherSecao2();
    continuar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(
      await screen.findByText(/confirme seus dados de novo para enviar/),
    ).toBeInTheDocument();
    identificar();
    fireEvent.click(
      await screen.findByRole("button", { name: "Enviar respostas" }),
    );
    await screen.findByRole("heading", { name: "Respostas enviadas" });
    expect(cliente.enviarRespostas).toHaveBeenLastCalledWith(
      TOKEN,
      expect.objectContaining({ passe: "passe-2" }),
    );
  });
});

describe("T216 — anônima", () => {
  const CHAVE = `evolli.pesquisa.${TOKEN}.respondida`;

  it("avisa que é anônima, não pede identificação e marca o navegador ao enviar", async () => {
    const cliente = criarCliente();
    await abrir(cliente);
    expect(screen.getByText(/Esta pesquisa é anônima/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    expect(screen.queryByLabelText("CPF")).not.toBeInTheDocument();
    preencherSecao1();
    continuar();
    preencherSecao2();
    continuar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    await screen.findByRole("heading", { name: "Respostas enviadas" });
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
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    expect(
      screen.getByRole("heading", { name: "Sobre o trabalho" }),
    ).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    preencherSecao1();
    continuar();
    preencherSecao2();
    continuar();
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(
      await screen.findByRole("heading", { name: "Respostas enviadas" }),
    ).toBeInTheDocument();
  });
});

describe("T216 — rascunho no sessionStorage", () => {
  it("recarregar a página mantém as respostas (e nunca guarda o CPF)", async () => {
    const cliente = criarCliente(pesquisaDeTeste("identificada"));
    const primeira = renderizar(cliente);
    await screen.findByRole("heading", { name: "Pulso do trimestre" });
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    continuar();
    await screen.findByRole("heading", { name: "Sobre o trabalho" });
    marcar(/Tenho clareza/, "Concordo totalmente");
    const guardado = window.sessionStorage.getItem(
      `evolli.pesquisa.${TOKEN}.rascunho`,
    );
    expect(guardado).toContain("q-conc");
    expect(guardado).not.toContain(CPF_TESTE);
    expect(guardado).not.toContain("passe");
    primeira.unmount();

    await abrir(cliente);
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: CPF_TESTE },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "15041990" },
    });
    continuar();
    await screen.findByRole("heading", { name: "Sobre o trabalho" });
    expect(
      within(grupo(/Tenho clareza/)).getByRole("radio", {
        name: "Concordo totalmente",
      }),
    ).toBeChecked();
  });

  it("rascunho corrompido é ignorado", async () => {
    window.sessionStorage.setItem(`evolli.pesquisa.${TOKEN}.rascunho`, "{x");
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    expect(
      within(grupo(/Tenho clareza/)).getByRole("radio", { name: "Concordo" }),
    ).not.toBeChecked();
  });
});

describe("T216 — sem chamadas autenticadas", () => {
  it("a página só usa o cliente público", async () => {
    const espiao = vi.spyOn(globalThis, "fetch");
    await abrir();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Começar" })).toBeEnabled(),
    );
    expect(espiao).not.toHaveBeenCalled();
  });
});
