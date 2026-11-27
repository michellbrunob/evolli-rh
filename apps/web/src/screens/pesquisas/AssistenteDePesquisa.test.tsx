/**
 * T216 — assistente "Nova pesquisa" em 5 etapas: validação por etapa,
 * rascunho gravado no servidor, editor das perguntas (tipos, opções,
 * condicionais, mover e excluir), participantes, prazo, pré-visualização e
 * Publicar. Servidor simulado; dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PesquisaDetalhe,
  PesquisaEntrada,
} from "../../api/pesquisasClient";
import { AssistenteDePesquisa } from "./AssistenteDePesquisa";
import { DETALHE, servicoFalso, type ServicoFalso } from "./dadosDeTeste";

const HOJE = "2026-11-27";

const avancar = () =>
  fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));

const ultimaEntrada = (fn: {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}): PesquisaEntrada => {
  const chamada = fn.mock.calls.at(-1)!;
  return (chamada.length === 1 ? chamada[0] : chamada[1]) as PesquisaEntrada;
};

function montar(
  props: Partial<Parameters<typeof AssistenteDePesquisa>[0]> = {},
) {
  const servico = (props.servico as ServicoFalso | undefined) ?? servicoFalso();
  const onSair = vi.fn();
  const onVerResultados = vi.fn();
  render(
    <AssistenteDePesquisa
      servico={servico}
      modelo="personalizada"
      hoje={HOJE}
      onSair={onSair}
      onVerResultados={onVerResultados}
      {...props}
    />,
  );
  return { servico, onSair, onVerResultados };
}

/** Adiciona uma pergunta do tipo na seção 1 e escreve o texto. */
function adicionar(tipo: string, texto: string) {
  fireEvent.click(
    screen.getByRole("button", { name: "Adicionar pergunta na seção 1" }),
  );
  fireEvent.click(
    within(
      screen.getByRole("group", { name: "Tipo da nova pergunta" }),
    ).getByRole("button", { name: new RegExp(`^${tipo}`) }),
  );
  const campos = screen.getAllByLabelText("Texto da pergunta");
  fireEvent.change(campos.at(-1)!, { target: { value: texto } });
}

async function irParaPerguntas(nome = "Pesquisa de teste") {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: nome } });
  avancar();
  await screen.findByRole("heading", { name: /Etapa 2 de 5/ });
}

describe("Assistente de pesquisa — etapa 1", () => {
  it("exige o nome e não grava nada sem ele", async () => {
    const { servico } = montar();
    avancar();
    expect(await screen.findByText("Dê um nome à pesquisa.")).toBeVisible();
    expect(screen.getByLabelText("Nome")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
  });

  it("com o nome, grava o rascunho no servidor e avança", async () => {
    const { servico } = montar();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Pesquisa de teste" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Anônima/ }));
    avancar();
    await screen.findByRole("heading", { name: /Etapa 2 de 5/ });
    const entrada = ultimaEntrada(servico.criarPesquisa);
    expect(entrada.nome).toBe("Pesquisa de teste");
    expect(entrada.identificacao).toBe("anonima");
    expect(entrada.modelo).toBe("personalizada");
    expect(entrada.participantes).toEqual({ todos: true });
    expect(entrada.minimoPorGrupo).toBe(3);
  });

  it("nome acima de 120 caracteres é recusado", async () => {
    const { servico } = montar();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "x".repeat(121) },
    });
    avancar();
    expect(
      await screen.findByText("O nome pode ter até 120 caracteres."),
    ).toBeVisible();
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
  });
});

describe("Assistente de pesquisa — perguntas", () => {
  it("exige ao menos uma pergunta", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    avancar();
    expect(
      await screen.findByText("Inclua pelo menos uma pergunta."),
    ).toBeVisible();
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
  });

  it("pergunta sem texto e opção vazia barram o avanço", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Escolha única", "");
    fireEvent.change(screen.getByLabelText("Opção 2"), {
      target: { value: "" },
    });
    avancar();
    const erro = await screen.findByText(/Escreva a pergunta\./);
    expect(erro).toHaveTextContent("Preencha o texto de todas as opções.");
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
  });

  it("monta escolha única com 'Outro', obrigatória desligada e grava", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Escolha única", "Qual turno você prefere?");
    fireEvent.change(screen.getByLabelText("Opção 1"), {
      target: { value: "Manhã" },
    });
    fireEvent.change(screen.getByLabelText("Opção 2"), {
      target: { value: "Tarde" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar opção" }));
    fireEvent.change(screen.getByLabelText("Opção 3"), {
      target: { value: "Noite" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Outro/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Obrigatória" }));
    avancar();
    await screen.findByRole("heading", { name: /Etapa 3 de 5/ });
    const p = ultimaEntrada(servico.alterarPesquisa).secoes[0]!.perguntas[0]!;
    expect(p.tipo).toBe("escolha_unica");
    expect(p.texto).toBe("Qual turno você prefere?");
    expect(p.obrigatoria).toBe(false);
    expect(p.config.outro).toBe(true);
    expect(p.config.opcoes!.map((o) => o.texto)).toEqual([
      "Manhã",
      "Tarde",
      "Noite",
    ]);
  });

  it("condicional: só aparece para quem marcou a opção de uma pergunta anterior", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Sim ou não", "Usa o refeitório?");
    adicionar("Parágrafo", "O que pode melhorar no refeitório?");
    fireEvent.click(
      screen.getByRole("combobox", { name: "Mostrar a pergunta 2" }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /Só para quem marcou "Sim"/ }),
    );
    avancar();
    await screen.findByRole("heading", { name: /Etapa 3 de 5/ });
    const [p1, p2] = ultimaEntrada(servico.alterarPesquisa).secoes[0]!
      .perguntas;
    expect(p2!.condicao).toEqual({ perguntaId: p1!.id, opcaoId: "sim" });
  });

  it("a primeira pergunta não oferece condição (nada vem antes dela)", async () => {
    montar();
    await irParaPerguntas();
    adicionar("Parágrafo", "Comentário");
    fireEvent.click(
      screen.getByRole("combobox", { name: "Mostrar a pergunta 1" }),
    );
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Sempre",
    ]);
  });

  it("excluir a pergunta de origem tira a condição de quem dependia dela", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Sim ou não", "Usa o refeitório?");
    adicionar("Parágrafo", "O que pode melhorar?");
    fireEvent.click(
      screen.getByRole("combobox", { name: "Mostrar a pergunta 2" }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /Só para quem marcou "Não"/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir pergunta 1" }));
    avancar();
    await screen.findByRole("heading", { name: /Etapa 3 de 5/ });
    const perguntas = ultimaEntrada(servico.alterarPesquisa).secoes[0]!
      .perguntas;
    expect(perguntas).toHaveLength(1);
    expect(perguntas[0]!.condicao).toBeNull();
  });

  it("mover a origem para depois invalida a condição", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Sim ou não", "Usa o refeitório?");
    adicionar("Parágrafo", "O que pode melhorar?");
    fireEvent.click(
      screen.getByRole("combobox", { name: "Mostrar a pergunta 2" }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /Só para quem marcou "Sim"/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Descer pergunta 1" }));
    avancar();
    expect(
      await screen.findByText(
        /A condição precisa apontar para uma pergunta anterior/,
      ),
    ).toBeVisible();
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
  });

  it("duplicar e mover perguntas", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Estrelas", "Como foi o atendimento?");
    adicionar("Data", "Quando foi?");
    fireEvent.click(
      screen.getByRole("button", { name: "Duplicar pergunta 1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Subir pergunta 3" }));
    avancar();
    await screen.findByRole("heading", { name: /Etapa 3 de 5/ });
    const perguntas = ultimaEntrada(servico.alterarPesquisa).secoes[0]!
      .perguntas;
    expect(perguntas.map((p) => p.texto)).toEqual([
      "Como foi o atendimento?",
      "Quando foi?",
      "Como foi o atendimento?",
    ]);
    expect(new Set(perguntas.map((p) => p.id)).size).toBe(3);
  });

  it("os 11 tipos aparecem para escolher", async () => {
    montar();
    await irParaPerguntas();
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar pergunta na seção 1" }),
    );
    expect(
      within(
        screen.getByRole("group", { name: "Tipo da nova pergunta" }),
      ).getAllByRole("button"),
    ).toHaveLength(11);
  });

  it("escala valida o fim entre 2 e 10", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Escala", "Quanto você recomendaria?");
    fireEvent.change(screen.getByLabelText("Termina em"), {
      target: { value: "11" },
    });
    avancar();
    expect(
      await screen.findByText(/A escala termina entre 2 e 10\./),
    ).toBeVisible();
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
  });

  it("seções: adicionar e excluir", async () => {
    const { servico } = montar();
    await irParaPerguntas();
    adicionar("Texto curto", "Qual seu setor?");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar seção" }));
    fireEvent.change(screen.getByLabelText("Nome da seção 2"), {
      target: { value: "Extra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Excluir seção 2" }));
    avancar();
    await screen.findByRole("heading", { name: /Etapa 3 de 5/ });
    expect(ultimaEntrada(servico.alterarPesquisa).secoes).toHaveLength(1);
  });
});

describe("Assistente de pesquisa — participantes, prazo e publicação", () => {
  async function ateParticipantes(servico = servicoFalso()) {
    montar({ servico, modelo: "enps" });
    avancar();
    await screen.findByRole("heading", { name: /Etapa 2 de 5/ });
    avancar();
    await screen.findByRole("heading", { name: /Etapa 3 de 5/ });
    return servico;
  }

  it("escolher pessoas exige ao menos uma; a escolhida vai no envio", async () => {
    const servico = await ateParticipantes();
    fireEvent.click(screen.getByRole("radio", { name: /Escolher pessoas/ }));
    avancar();
    expect(
      await screen.findByText("Escolha pelo menos uma pessoa."),
    ).toBeVisible();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: /Ana Exemplo/ }),
    );
    expect(
      screen.getByText("1 selecionado de 2 colaboradores"),
    ).toBeInTheDocument();
    avancar();
    await screen.findByRole("heading", { name: /Etapa 4 de 5/ });
    expect(ultimaEntrada(servico.alterarPesquisa).participantes).toEqual({
      todos: false,
      colaboradorIds: ["c-1"],
    });
  });

  it("filtro por departamento e busca vão ao servidor", async () => {
    const servico = await ateParticipantes();
    fireEvent.click(screen.getByRole("radio", { name: /Escolher pessoas/ }));
    fireEvent.change(
      await screen.findByRole("searchbox", { name: "Buscar pessoa" }),
      { target: { value: "Ana" } },
    );
    await waitFor(() =>
      expect(servico.listarAtivos).toHaveBeenLastCalledWith(
        expect.objectContaining({ busca: "Ana" }),
      ),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(await screen.findByRole("option", { name: "Financeiro" }));
    await waitFor(() =>
      expect(servico.listarAtivos).toHaveBeenLastCalledWith(
        expect.objectContaining({ departamentos: ["d-2"] }),
      ),
    );
  });

  it("prazo no passado e mínimo fora de 3 a 10 são recusados", async () => {
    const servico = await ateParticipantes();
    avancar();
    await screen.findByRole("heading", { name: /Etapa 4 de 5/ });
    const chamadas = servico.alterarPesquisa.mock.calls.length;
    fireEvent.click(
      screen.getByRole("radio", { name: /Encerrar em uma data/ }),
    );
    fireEvent.change(screen.getByLabelText("Data de encerramento"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("Mínimo de respostas por grupo"), {
      target: { value: "2" },
    });
    avancar();
    expect(
      await screen.findByText(
        "A data de encerramento não pode ser anterior a hoje.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Informe um número de 3 a 10.")).toBeVisible();
    expect(servico.alterarPesquisa.mock.calls.length).toBe(chamadas);
  });

  it("revisão, pré-visualização e Publicar mostram o link", async () => {
    const escrever = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: escrever },
      configurable: true,
    });
    const servico = await ateParticipantes();
    avancar();
    await screen.findByRole("heading", { name: /Etapa 4 de 5/ });
    fireEvent.click(
      screen.getByRole("radio", { name: /Encerrar em uma data/ }),
    );
    fireEvent.change(screen.getByLabelText("Data de encerramento"), {
      target: { value: "2026-12-15" },
    });
    avancar();
    await screen.findByRole("heading", { name: /Etapa 5 de 5/ });
    const resumo = screen.getByRole("region", { name: "Resumo da pesquisa" });
    expect(resumo).toHaveTextContent("eNPS");
    expect(resumo).toHaveTextContent("3 perguntas");
    expect(resumo).toHaveTextContent("15/12/2026");
    expect(resumo).toHaveTextContent("Identificada");

    fireEvent.click(
      screen.getByRole("button", { name: "Pré-visualizar como quem responde" }),
    );
    const previa = await screen.findByRole("dialog", {
      name: "Pré-visualização",
    });
    expect(previa).toHaveTextContent("O que mais pesou na sua nota?");
    expect(previa).toHaveTextContent("3 perguntas");
    fireEvent.click(within(previa).getByRole("button", { name: "Fechar" }));

    fireEvent.click(screen.getByRole("button", { name: "Publicar pesquisa" }));
    const final = await screen.findByRole("region", {
      name: "Pesquisa criada e ativa",
    });
    expect(
      within(final).getByRole("heading", {
        name: "Pesquisa criada e ativa",
      }),
    ).toBeInTheDocument();
    expect(within(final).getByRole("link", { name: /^Abrir/ })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(
      within(final).getByRole("button", { name: /Acompanhar respostas/ }),
    ).toBeInTheDocument();
    expect(
      within(final).getByRole("button", { name: "Concluir" }),
    ).toBeInTheDocument();
    // Sem `naoIdentificaveis` na resposta: nenhum aviso.
    expect(
      screen.queryByRole("region", { name: /não conseguem se identificar/ }),
    ).toBeNull();
    expect(servico.publicarPesquisa).toHaveBeenCalledWith("p-novo");
    expect(ultimaEntrada(servico.alterarPesquisa).encerraEm).toBe("2026-12-15");
    expect(
      (screen.getByLabelText("Link da pesquisa") as HTMLInputElement).value,
    ).toMatch(/#\/p\/token-publicado$/);
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    await waitFor(() => expect(escrever).toHaveBeenCalled());
  });

  it("falha ao publicar avisa e não mostra o link", async () => {
    const servico = servicoFalso({
      publicarPesquisa: vi.fn(() => Promise.reject(new Error("rede"))),
    });
    await ateParticipantes(servico);
    avancar();
    await screen.findByRole("heading", { name: /Etapa 4 de 5/ });
    avancar();
    await screen.findByRole("heading", { name: /Etapa 5 de 5/ });
    fireEvent.click(screen.getByRole("button", { name: "Publicar pesquisa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível publicar",
    );
    expect(
      screen.queryByRole("heading", { name: "Pesquisa criada e ativa" }),
    ).toBeNull();
  });
});

describe("Assistente de pesquisa — quem não consegue se identificar", () => {
  const SEM_CPF = {
    naoIdentificaveis: 2,
    participantesLista: [
      {
        colaboradorId: "c-1",
        nome: "Ana Exemplo",
        departamento: "Operações",
        respondeu: false,
        identificavel: false,
      },
      {
        colaboradorId: "c-2",
        nome: "Bruno Exemplo",
        departamento: null,
        respondeu: false,
        identificavel: false,
      },
      {
        colaboradorId: "c-3",
        nome: "Caio Exemplo",
        departamento: null,
        respondeu: false,
        identificavel: true,
      },
    ],
  };

  function servicoSemCpf(identificacao: "confidencial" | "anonima") {
    const comAviso = (d: PesquisaDetalhe) =>
      Promise.resolve({ ...d, ...SEM_CPF, identificacao } as PesquisaDetalhe);
    const base = servicoFalso();
    return servicoFalso({
      criarPesquisa: vi.fn(async (e) => comAviso(await base.criarPesquisa(e))),
      alterarPesquisa: vi.fn(async (id, e) =>
        comAviso(await base.alterarPesquisa(id, e)),
      ),
      publicarPesquisa: vi.fn(async (id) =>
        comAviso(await base.publicarPesquisa(id)),
      ),
    });
  }

  async function ateRevisao(identificacao: "confidencial" | "anonima") {
    const servico = servicoSemCpf(identificacao);
    montar({ servico, modelo: "enps" });
    if (identificacao === "anonima")
      fireEvent.click(screen.getByRole("radio", { name: /^Anônima/ }));
    for (let i = 2; i <= 5; i += 1) {
      avancar();
      await screen.findByRole("heading", {
        name: new RegExp(`Etapa ${i} de 5`),
      });
    }
    return servico;
  }

  it("revisão avisa, lista os nomes com atalho para a ficha e não bloqueia", async () => {
    await ateRevisao("confidencial");
    const aviso = screen.getByRole("region", {
      name: "Pessoas que não conseguem se identificar",
    });
    expect(aviso).toHaveTextContent(
      "2 pessoas não têm CPF ou data de nascimento na ficha e não conseguem confirmar quem são no link. Complete o cadastro antes de enviar.",
    );
    const ana = within(aviso).getByRole("link", { name: /Ana Exemplo/ });
    expect(ana).toHaveAttribute("href", "#/pessoas/colaboradores/c-1/dados");
    expect(ana).toHaveAttribute("target", "_blank");
    expect(within(aviso).queryByText(/Caio Exemplo/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Publicar pesquisa" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Publicar pesquisa" }));
    const final = await screen.findByRole("region", {
      name: "Pesquisa criada e ativa",
    });
    expect(
      within(final).getByRole("region", {
        name: "Pessoas que não conseguem se identificar",
      }),
    ).toBeInTheDocument();
  });

  it("na anônima não há aviso (ninguém confirma quem é)", async () => {
    await ateRevisao("anonima");
    expect(
      screen.queryByRole("region", {
        name: "Pessoas que não conseguem se identificar",
      }),
    ).toBeNull();
  });
});

describe("Assistente de pesquisa — edição depois de publicar", () => {
  it("identificação travada e perguntas só leitura quando já há respostas", async () => {
    const servico = servicoFalso();
    render(
      <AssistenteDePesquisa
        servico={servico}
        base={DETALHE}
        hoje={HOJE}
        onSair={vi.fn()}
        onVerResultados={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Editar Clima de novembro",
      }),
    ).toBeInTheDocument();
    for (const nome of ["Identificada", "Confidencial", "Anônima"]) {
      expect(
        screen.getByRole("radio", { name: new RegExp(`^${nome}`) }),
      ).toBeDisabled();
    }
    avancar();
    await screen.findByRole("heading", { name: /Etapa 2 de 5/ });
    expect(
      screen.getByText(/já tem respostas: as perguntas não mudam mais/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Adicionar pergunta na seção 1" }),
    ).toBeNull();
    // Publicada: nada é gravado ao trocar de etapa.
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
  });

  it("Salvar alterações grava sem publicar de novo", async () => {
    const servico = servicoFalso();
    const onVerResultados = vi.fn();
    render(
      <AssistenteDePesquisa
        servico={servico}
        base={DETALHE}
        hoje={HOJE}
        onSair={vi.fn()}
        onVerResultados={onVerResultados}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Clima de dezembro" },
    });
    for (let i = 2; i <= 5; i += 1) {
      avancar();
      await screen.findByRole("heading", {
        name: new RegExp(`Etapa ${i} de 5`),
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(onVerResultados).toHaveBeenCalledWith("p-1", "Alterações salvas."),
    );
    expect(ultimaEntrada(servico.alterarPesquisa).nome).toBe(
      "Clima de dezembro",
    );
    expect(servico.publicarPesquisa).not.toHaveBeenCalled();
  });
});
