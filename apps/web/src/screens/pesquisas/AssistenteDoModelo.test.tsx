/**
 * T216 — assistente dos modelos prontos (barra horizontal de etapas):
 * rascunho gravado sozinho com a hora, identificação em três cartões,
 * anônima com 2 etapas e "Separar respostas por", lista de perguntas
 * (adicionar na própria lista, editar, excluir, comentário fixo),
 * Colaboradores (todo o time ou escolher pessoas), Enviar (revisão e
 * encerramento automático) e a tela final. Servidor simulado.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PesquisaEntrada } from "../../api/pesquisasClient";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import type { CandidatoPesquisa } from "../../api/pesquisasClient";
import {
  listarCandidatosFalso,
  servicoFalso,
  type ServicoFalso,
} from "./dadosDeTeste";
import { modeloDaGaleria, perguntasPrincipais } from "./modelosDePesquisa";

/**
 * O prazo como a API recebe: dia e hora de Brasília, sem fuso no texto
 * (contrato da T216); montado aqui para não virar literal de instante.
 */
const prazoDaApi = (dia: string, hora: string) => `${dia}T${hora}`;

const HOJE = "2026-11-27";
const AGORA = () => new Date(2026, 10, 27, 9, 5);

const ultimaEntrada = (fn: {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}): PesquisaEntrada => {
  const chamada = fn.mock.calls.at(-1)!;
  return (chamada.length === 1 ? chamada[0] : chamada[1]) as PesquisaEntrada;
};

function montar(
  props: Partial<Parameters<typeof AssistenteDoModelo>[0]> & {
    servico?: ServicoFalso;
  } = {},
) {
  const servico = props.servico ?? servicoFalso();
  const handlers = {
    onCancelar: vi.fn(),
    onConcluir: vi.fn(),
    onVerResultados: vi.fn(),
    onEditarGerada: vi.fn(),
  };
  render(
    <AssistenteDoModelo
      servico={servico}
      modeloId="pulso"
      hoje={HOJE}
      agora={AGORA}
      atrasoDoRascunho={0}
      {...handlers}
      {...props}
    />,
  );
  return { servico, ...handlers };
}

const proximo = (rotulo: RegExp) =>
  fireEvent.click(screen.getByRole("button", { name: rotulo }));

describe("Assistente do modelo — Configurar", () => {
  it("grava o rascunho ao abrir e mostra a hora", async () => {
    const { servico } = montar();
    expect(
      await screen.findByText("Rascunho salvo às 09:05"),
    ).toBeInTheDocument();
    const entrada = ultimaEntrada(servico.criarPesquisa);
    expect(entrada.modelo).toBe("pulso");
    expect(entrada.nome).toBe("Pulso – novembro de 2026");
    expect(entrada.identificacao).toBe("identificada");
    expect(
      screen.getByRole("heading", { level: 1, name: "Nova pesquisa Pulso" }),
    ).toBeInTheDocument();
  });

  it("barra de etapas: Configurar, Colaboradores e Enviar", async () => {
    montar();
    const etapas = screen.getByRole("list", { name: "Etapas" });
    expect(
      within(etapas)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining("Configurar"),
      expect.stringContaining("Colaboradores"),
      expect.stringContaining("Enviar"),
    ]);
    expect(
      screen.getByRole("button", { name: "Próximo: Colaboradores →" }),
    ).toBeInTheDocument();
  });

  it("identificação em três cartões; a anônima tira a etapa de colaboradores e oferece separar por grupo", async () => {
    const { servico } = montar();
    const grupo = screen.getByRole("radiogroup", { name: "Identificação" });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(3);
    fireEvent.click(within(grupo).getByRole("radio", { name: /Anônima/ }));
    expect(
      within(screen.getByRole("list", { name: "Etapas" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Próximo: Enviar →" }),
    ).toBeInTheDocument();
    const separar = await screen.findByRole("list", {
      name: "Separar respostas por",
    });
    expect(await within(separar).findAllByText("2 opções")).toHaveLength(2);
    fireEvent.click(
      within(separar).getByRole("checkbox", { name: /Departamento/ }),
    );
    // Marcado: as opções que quem responde vai ver, e como criar outra.
    const opcoes = within(separar).getByRole("list", {
      name: "Opções de departamento",
    });
    expect(
      within(opcoes)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Operações", "Financeiro", "Prefiro não informar"]);
    expect(
      within(separar).getByRole("button", { name: "Adicionar departamento" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(separar).getByRole("checkbox", { name: /Centro de custo/ }),
    );
    expect(
      within(separar).getByRole("checkbox", { name: /Unidade/ }),
    ).toBeDisabled();
    expect(separar).toHaveTextContent(
      "Até 2 campos, para ninguém ser reconhecido pela combinação.",
    );
    await waitFor(() =>
      expect(ultimaEntrada(servico.alterarPesquisa).separarPor).toEqual([
        "departamento",
        "centroCusto",
      ]),
    );
    expect(ultimaEntrada(servico.alterarPesquisa).identificacao).toBe(
      "anonima",
    );
  });

  it("perguntas: contador com o limite, selos do tipo e o comentário fixo", async () => {
    montar();
    const m = modeloDaGaleria("pulso");
    const perguntas = screen.getByRole("region", { name: "Perguntas" });
    expect(perguntas).toHaveTextContent(
      `${perguntasPrincipais(m)} de ${m.limite} · + comentário`,
    );
    const lista = within(perguntas).getByRole("list", {
      name: "Perguntas da pesquisa",
    });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(
      perguntasPrincipais(m),
    );
    expect(lista).toHaveTextContent("Escala 1–10");
    expect(lista).toHaveTextContent("eNPS 0–10");
    expect(perguntas).toHaveTextContent("Sempre opcional · fixa");
    expect(perguntas).toHaveTextContent("Escala de 1 a 10");
  });

  it("adicionar na própria lista: entra antes do comentário, com o tipo do modelo", async () => {
    const { servico } = montar();
    await screen.findByText("Rascunho salvo às 09:05");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar pergunta/ }));
    const caixa = screen.getByRole("textbox", { name: "Nova pergunta" });
    const adicionar = screen.getByRole("button", { name: "Adicionar" });
    expect(adicionar).toBeDisabled();
    fireEvent.change(caixa, {
      target: { value: "Consigo descansar nas folgas." },
    });
    expect(screen.getByText("29/300")).toBeInTheDocument();
    fireEvent.click(adicionar);
    await waitFor(() => {
      const perguntas = ultimaEntrada(servico.alterarPesquisa).secoes[0]!
        .perguntas;
      expect(perguntas.at(-2)!.texto).toBe("Consigo descansar nas folgas.");
      expect(perguntas.at(-2)!.tipo).toBe("escala");
      expect(perguntas.at(-1)!.tipo).toBe("paragrafo");
    });
  });

  it("editar e excluir uma pergunta", async () => {
    const { servico } = montar();
    await screen.findByText("Rascunho salvo às 09:05");
    fireEvent.click(screen.getByRole("button", { name: "Editar pergunta 1" }));
    const caixa = screen.getByRole("textbox", {
      name: "Texto da pergunta 1",
    }) as HTMLInputElement;
    // O texto já vem selecionado, com o atalho e o contador.
    expect(caixa).toHaveFocus();
    expect(caixa.selectionStart).toBe(0);
    expect(caixa.selectionEnd).toBe(caixa.value.length);
    expect(
      screen.getByText(`Enter salva · Esc cancela · ${caixa.value.length}/300`),
    ).toBeInTheDocument();
    // Esc cancela sem mudar nada.
    fireEvent.change(caixa, { target: { value: "Descartado." } });
    fireEvent.keyDown(caixa, { key: "Escape" });
    expect(
      screen.queryByRole("textbox", { name: "Texto da pergunta 1" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Editar pergunta 1" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Texto da pergunta 1" }),
      {
        target: { value: "Texto novo." },
      },
    );
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Texto da pergunta 1" }),
      { key: "Enter" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir pergunta 2" }));
    await waitFor(() => {
      const perguntas = ultimaEntrada(servico.alterarPesquisa).secoes[0]!
        .perguntas;
      expect(perguntas[0]!.texto).toBe("Texto novo.");
      expect(perguntas).toHaveLength(
        perguntasPrincipais(modeloDaGaleria("pulso")),
      );
    });
    // Excluir avisa e permite desfazer.
    expect(await screen.findByText("Pergunta excluída.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() =>
      expect(
        ultimaEntrada(servico.alterarPesquisa).secoes[0]!.perguntas,
      ).toHaveLength(perguntasPrincipais(modeloDaGaleria("pulso")) + 1),
    );
  });

  it("nome vazio barra o avanço", async () => {
    montar();
    fireEvent.change(screen.getByLabelText("Nome da pesquisa"), {
      target: { value: "" },
    });
    proximo(/Próximo: Colaboradores/);
    expect(
      await screen.findByText("Dê um nome à pesquisa."),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Etapas" })).toHaveTextContent(
      "Configurar",
    );
    expect(
      screen.queryByRole("radiogroup", { name: "Quem vai responder" }),
    ).toBeNull();
  });
});

describe("Assistente do modelo — Colaboradores e Enviar", () => {
  it("todo o time: contagem, departamentos e lista", async () => {
    const { servico } = montar();
    proximo(/Próximo: Colaboradores/);
    expect(
      await screen.findByText("2 pessoas vão receber a pesquisa"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Todos os colaboradores ativos, de 2 departamentos"),
    ).toBeInTheDocument();
    const chips = screen.getByRole("list", {
      name: "Pessoas por departamento",
    });
    expect(chips).toHaveTextContent("Operações1");
    expect(screen.getByText("2 pessoas vão receber")).toBeInTheDocument();
    // A contagem vem do servidor; a lista inteira só ao abrir "Ver lista".
    expect(servico.contagemDoTime).toHaveBeenCalled();
    expect(servico.listarTodosCandidatos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver lista" }));
    expect(
      await screen.findByRole("dialog", { name: "Quem vai receber" }),
    ).toHaveTextContent("Bruno Exemplo");
  });

  it("escolher pessoas: filtros, seleção e 'Selecionar todos'", async () => {
    const { servico } = montar();
    proximo(/Próximo: Colaboradores/);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Escolher pessoas/ }),
    );
    proximo(/Próximo: Enviar/);
    expect(
      await screen.findByText("Escolha pelo menos uma pessoa."),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Ana Exemplo" }),
    );
    expect(
      screen.getByText("1 selecionado de 2 colaboradores"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Centro de custo" }));
    fireEvent.click(
      await screen.findByRole("option", { name: "Administrativo" }),
    );
    await waitFor(() =>
      expect(servico.listarCandidatos).toHaveBeenLastCalledWith(
        expect.objectContaining({ centroCustoId: "cc-1" }),
      ),
    );
    // No centro de custo Administrativo só está a Ana (já marcada).
    expect(
      await screen.findByText("1 selecionado de 1 colaborador"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Centro de custo" }));
    fireEvent.click(
      await screen.findByRole("option", { name: "Centro de custo: todos" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Selecionar todos os 2" }),
    );
    expect(
      await screen.findByText("2 selecionados de 2 colaboradores"),
    ).toBeInTheDocument();
    proximo(/Próximo: Enviar/);
    await waitFor(() =>
      expect(ultimaEntrada(servico.alterarPesquisa).participantes).toEqual({
        todos: false,
        colaboradorIds: ["c-1", "c-2"],
      }),
    );
  });

  it("escolher pessoas começa sem ninguém; marcar todos, limpar e a contagem dentro do filtro", async () => {
    const servico = servicoFalso();
    montar({ servico });
    proximo(/Próximo: Colaboradores/);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Escolher pessoas/ }),
    );
    // Ninguém vem marcado ao trocar para "Escolher pessoas".
    expect(
      await screen.findByText("0 selecionados de 2 colaboradores"),
    ).toBeInTheDocument();
    const todos = screen.getByRole("checkbox", {
      name: "Marcar todos do filtro",
    });
    expect(todos).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Ana Exemplo" }),
    ).not.toBeChecked();
    fireEvent.click(todos);
    expect(
      await screen.findByText("2 selecionados de 2 colaboradores"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(
      await screen.findByText("0 selecionados de 2 colaboradores"),
    ).toBeInTheDocument();
    // Marca a Ana e filtra o Financeiro: a contagem é a do filtro.
    fireEvent.click(screen.getByRole("checkbox", { name: "Ana Exemplo" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(await screen.findByRole("option", { name: "Financeiro" }));
    expect(
      await screen.findByText("0 selecionados de 1 colaborador"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 pessoa vai receber")).toBeInTheDocument();
  });

  it("escolher pessoas: colunas da lotação vindas dos candidatos e 'Selecionar todos' sobre o total do filtro", async () => {
    // 150 ativos de Operações (duas páginas de 100) e a Bruna no Financeiro.
    const muitos: CandidatoPesquisa[] = [
      ...Array.from({ length: 150 }, (_, i) => ({
        colaboradorId: `c-op-${i}`,
        nome: `Pessoa ${String(i).padStart(3, "0")}`,
        cargo: "Operador",
        departamento: "Operações",
        centroCusto: "Administrativo",
        unidade: "Matriz",
      })),
      {
        colaboradorId: "c-fi",
        nome: "Bruna Exemplo",
        cargo: "Analista",
        departamento: "Financeiro",
        centroCusto: null,
        unidade: "Filial Sul",
      },
    ];
    const servico = servicoFalso({
      listarCandidatos: vi.fn(listarCandidatosFalso(muitos)),
      listarTodosCandidatos: vi.fn(() => Promise.resolve(muitos)),
    });
    montar({ servico });
    proximo(/Próximo: Colaboradores/);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Escolher pessoas/ }),
    );
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores ativos",
    });
    expect(
      within(tabela)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual([
      "Selecionar",
      "Colaborador",
      "Departamento",
      "Centro de custo",
      "Unidade",
    ]);
    const bruna = within(tabela)
      .getByRole("checkbox", { name: "Bruna Exemplo" })
      .closest("tr")!;
    expect(bruna).toHaveTextContent("Analista");
    expect(
      within(bruna)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["", "BEBruna ExemploAnalista", "Financeiro", "—", "Filial Sul"]);
    // Filtro por unidade vai ao servidor; a contagem é a do filtro.
    fireEvent.click(screen.getByRole("combobox", { name: "Unidade" }));
    fireEvent.click(await screen.findByRole("option", { name: "Matriz" }));
    await waitFor(() =>
      expect(servico.listarCandidatos).toHaveBeenLastCalledWith(
        expect.objectContaining({ unidadeId: "u-1", pagina: 2 }),
      ),
    );
    expect(
      await screen.findByText("0 selecionados de 150 colaboradores"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Selecionar todos os 150" }),
    );
    expect(
      await screen.findByText("150 selecionados de 150 colaboradores"),
    ).toBeInTheDocument();
    expect(screen.getByText("150 pessoas vão receber")).toBeInTheDocument();
  });

  it("enviar: revisão, encerramento automático validado e gerar", async () => {
    const escrever = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: escrever },
      configurable: true,
    });
    const { servico, onConcluir, onVerResultados } = montar();
    proximo(/Próximo: Colaboradores/);
    await screen.findByText("2 pessoas vão receber a pesquisa");
    proximo(/Próximo: Enviar/);
    const resumo = await screen.findByRole("region", {
      name: "Revise antes de gerar",
    });
    expect(resumo).toHaveTextContent("Identificada");
    expect(resumo).toHaveTextContent("2 colaboradores");
    expect(resumo).toHaveTextContent("escala 1–10 + eNPS 0–10");
    fireEvent.click(
      screen.getByRole("switch", { name: "Encerrar automaticamente" }),
    );
    fireEvent.change(screen.getByLabelText("Data de encerramento"), {
      target: { value: "2026-11-01" },
    });
    proximo(/Gerar pesquisa/);
    expect(
      await screen.findByText(
        "A data de encerramento não pode ser anterior a hoje.",
      ),
    ).toBeInTheDocument();
    expect(servico.publicarPesquisa).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Data de encerramento"), {
      target: { value: "2026-12-20" },
    });
    proximo(/Gerar pesquisa/);
    const final = await screen.findByRole("region", {
      name: "Pesquisa criada e ativa",
    });
    expect(servico.publicarPesquisa).toHaveBeenCalledWith("p-novo");
    expect(ultimaEntrada(servico.alterarPesquisa).encerraEm).toBe(
      prazoDaApi("2026-12-20", "23:59"),
    );
    expect(final).toHaveTextContent("Ativa");
    expect(within(final).getByRole("link", { name: /^Abrir/ })).toHaveAttribute(
      "target",
      "_blank",
    );
    const proximas = within(final).getByRole("list", {
      name: "Próximas ações",
    });
    expect(
      within(proximas)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      expect.stringContaining("Acompanhar respostas"),
      expect.stringContaining("Editar pesquisa"),
      expect.stringContaining("Ver todas as pesquisas"),
    ]);
    fireEvent.click(
      within(proximas).getByRole("button", { name: /Acompanhar respostas/ }),
    );
    expect(onVerResultados).toHaveBeenCalledWith("p-novo");
    fireEvent.click(within(final).getByRole("button", { name: "Concluir" }));
    expect(onConcluir).toHaveBeenCalled();
  });

  it("cancelar guarda o rascunho e avisa", async () => {
    const { onCancelar } = montar();
    await screen.findByText("Rascunho salvo às 09:05");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(onCancelar).toHaveBeenCalledWith(
        "Rascunho guardado. Você pode continuar depois.",
      ),
    );
  });

  it("anônima: participantes não valem e o resumo diz 'quem tiver o link'", async () => {
    const { servico } = montar({ modeloId: "enps" });
    fireEvent.click(screen.getByRole("radio", { name: /Anônima/ }));
    proximo(/Próximo: Enviar/);
    const resumo = await screen.findByRole("region", {
      name: "Revise antes de gerar",
    });
    expect(resumo).toHaveTextContent("Quem tiver o link (anônima)");
    await waitFor(() => {
      const fn =
        servico.alterarPesquisa.mock.calls.length > 0
          ? servico.alterarPesquisa
          : servico.criarPesquisa;
      expect(ultimaEntrada(fn).participantes).toEqual({ todos: true });
      expect(ultimaEntrada(fn).identificacao).toBe("anonima");
    });
  });
});
