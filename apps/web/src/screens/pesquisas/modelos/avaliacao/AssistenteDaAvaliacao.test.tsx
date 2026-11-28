/**
 * T216 — assistente da Avaliação 90°/180°: nome padrão e validação,
 * competências fixas, comentários, times pelo organograma (tirar, mover,
 * deixar de fora, 180° com autoavaliação), validação dos times, prazos e o
 * que vai para a API (rascunho, times, configuração e publicação).
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistenteDaAvaliacao } from "./AssistenteDaAvaliacao";
import {
  avaliacaoDetalheFalsa,
  detalheFalso,
  organogramaFalso,
} from "./dadosDeTeste";
import { organogramaFalso as org } from "./dadosDeTeste";

/** O prazo como a API recebe (dia e hora de Brasília, sem fuso no texto). */
const prazoDaApi = (dia: string, hora: string) => `${dia}T${hora}`;

const HOJE = "2026-11-27";
const AGORA = () => new Date("2026-11-27T12:00:00-03:00");

function montar(
  modelo: "avaliacao90" | "avaliacao180" = "avaliacao90",
  organograma = organogramaFalso(),
) {
  const servico = {
    criarPesquisa: vi.fn(async () => detalheFalso({ modelo })),
    alterarPesquisa: vi.fn(async () => detalheFalso({ modelo })),
    publicarPesquisa: vi.fn(async () =>
      detalheFalso({
        modelo,
        status: "ativa",
        link: "#/p/tokenDeTesteComTamanhoSuficiente",
      }),
    ),
  };
  const cliente = {
    organograma: vi.fn(async () => organograma),
    salvar: vi.fn(
      async (_id: string, _corpo: { config: Record<string, unknown> }) =>
        avaliacaoDetalheFalsa(),
    ),
  };
  const onAcompanhar = vi.fn();
  render(
    <AssistenteDaAvaliacao
      modelo={modelo}
      servico={servico}
      cliente={cliente}
      hoje={HOJE}
      agora={AGORA}
      onVoltar={() => {}}
      onAcompanhar={onAcompanhar}
    />,
  );
  return { servico, cliente, onAcompanhar };
}

const proximo = (rotulo: RegExp) =>
  fireEvent.click(screen.getByRole("button", { name: rotulo }));

describe("T216 — assistente da Avaliação 90°", () => {
  it("nome padrão do ciclo, 3 etapas e o catálogo fixo de 24 afirmações", async () => {
    montar();
    expect(
      screen.getByRole("heading", { name: "Nova Avaliação 90°" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da avaliação")).toHaveValue(
      "Avaliação 90° – Ciclo 2026.2",
    );
    expect(
      screen.getByText("8 competências · 24 afirmações"),
    ).toBeInTheDocument();
    expect(screen.getByText("Gestores e times")).toBeInTheDocument();
    expect(screen.getByText("Prazo e envio")).toBeInTheDocument();
    // A primeira competência aberta mostra as 3 afirmações numeradas.
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(
      screen.getByText("Expõe ideias e informações de forma clara e direta."),
    ).toBeInTheDocument();
    // Padrão: comentários pedidos nas notas extremas.
    expect(
      screen.getByRole("radio", { name: /Pedidos nas notas extremas/ }),
    ).toBeChecked();
  });

  it("valida o nome (obrigatório e até 120) antes de gravar o rascunho", async () => {
    const { servico } = montar();
    fireEvent.change(screen.getByLabelText("Nome da avaliação"), {
      target: { value: "  " },
    });
    proximo(/Próximo: Gestores e times/);
    expect(
      await screen.findByText("Dê um nome para a avaliação."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome da avaliação"), {
      target: { value: "x".repeat(121) },
    });
    proximo(/Próximo: Gestores e times/);
    expect(
      await screen.findByText("Use até 120 caracteres."),
    ).toBeInTheDocument();
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
  });

  it("monta os times pelo organograma; tirar, adicionar e deixar de fora", async () => {
    const { servico } = montar();
    proximo(/Próximo: Gestores e times/);
    await waitFor(() => expect(servico.criarPesquisa).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("1 gestor · 2 pessoas", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 pessoas sem gestor")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver o time de Gestora Teste" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tirar Bruno Sem Cpf do time" }),
    );
    expect(
      screen.getByText("1 gestor · 1 pessoa", { selector: "strong" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Adicionar pessoa ao time de Gestora Teste/,
      }),
    );
    const caixa = screen.getByRole("group", {
      name: "Adicionar ao time de Gestora Teste",
    });
    // A gestora não aparece (ninguém se avalia na 90°); Ana já está no time.
    expect(within(caixa).queryByText("Gestora Teste")).not.toBeInTheDocument();
    expect(within(caixa).queryByText("Ana Teste")).not.toBeInTheDocument();
    fireEvent.click(within(caixa).getByRole("button", { name: /Dora Livre/ }));
    expect(
      screen.getByText("1 gestor · 2 pessoas", { selector: "strong" }),
    ).toBeInTheDocument();
    const semGestor = screen.getByRole("region", {
      name: "Pessoas sem gestor no cadastro",
    });
    fireEvent.click(
      within(semGestor).getAllByRole("button", { name: "Deixar de fora" })[0]!,
    );
    expect(
      within(semGestor).getAllByRole("button", { name: "Deixar de fora" }),
    ).toHaveLength(1);
  });

  it("sem gestor com pessoa, não avança", async () => {
    montar();
    proximo(/Próximo: Gestores e times/);
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Incluir Gestora Teste" }),
    );
    proximo(/Próximo: Prazo e envio/);
    expect(
      await screen.findByText(
        "Escolha pelo menos um gestor com uma pessoa no time.",
      ),
    ).toBeInTheDocument();
  });

  it("sem colaborador ativo, avisa", async () => {
    montar("avaliacao90", { times: [], semGestor: [], ativos: [] });
    proximo(/Próximo: Gestores e times/);
    await screen.findByRole("button", { name: /Próximo: Prazo e envio/ });
    proximo(/Próximo: Prazo e envio/);
    expect(
      await screen.findByText("Não há colaboradores ativos para avaliar."),
    ).toBeInTheDocument();
  });

  it("prazo: padrão +30 dias às 23:59, valida e cria (times, configuração e publicação)", async () => {
    const { servico, cliente } = montar();
    proximo(/Próximo: Gestores e times/);
    await screen.findByText("1 gestor · 2 pessoas", { selector: "strong" });
    proximo(/Próximo: Prazo e envio/);
    expect(screen.getByLabelText("Data limite")).toHaveValue("2026-12-27");
    expect(screen.getByLabelText("Horário")).toHaveValue("23:59");
    expect(screen.getByText("30 dias a partir de hoje")).toBeInTheDocument();
    expect(
      screen.getByText(/lembretes 7 e 3 dias antes e no dia/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data limite"), {
      target: { value: "2026-11-27" },
    });
    fireEvent.change(screen.getByLabelText("Horário"), {
      target: { value: "12:30" },
    });
    proximo(/Criar e enviar aos gestores/);
    expect(
      await screen.findByText(
        "O prazo precisa ser pelo menos 1 hora a partir de agora.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data limite"), {
      target: { value: "2026-12-27" },
    });
    fireEvent.change(screen.getByLabelText("Horário"), {
      target: { value: "23:59" },
    });
    proximo(/Criar e enviar aos gestores/);
    await waitFor(() =>
      expect(servico.publicarPesquisa).toHaveBeenCalledWith("pesq-1"),
    );
    expect(servico.alterarPesquisa).toHaveBeenCalledWith(
      "pesq-1",
      expect.objectContaining({
        encerraEm: prazoDaApi("2026-12-27", "23:59"),
        modelo: "avaliacao90",
        identificacao: "identificada",
      }),
    );
    expect(cliente.salvar).toHaveBeenCalledWith("pesq-1", {
      config: expect.objectContaining({
        comentarios: "extremos",
        envio: "email",
        lembretes: ["7_dias", "3_dias", "no_dia"],
        prazoAutoavaliacao: null,
      }),
      times: [{ gestorId: "g1", avaliadoIds: ["p1", "p2"] }],
    });
    expect(
      await screen.findByText(/os convites ficam aguardando e-mail/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copiar link" }),
    ).toBeInTheDocument();
  });

  it("só o link: o botão vira Criar avaliação e sem lembretes", async () => {
    const { cliente } = montar();
    proximo(/Próximo: Gestores e times/);
    await screen.findByText("1 gestor · 2 pessoas", { selector: "strong" });
    proximo(/Próximo: Prazo e envio/);
    fireEvent.click(screen.getByRole("radio", { name: /Só gerar o link/ }));
    fireEvent.click(
      screen.getByRole("switch", { name: /Lembrar quem não terminou/ }),
    );
    expect(screen.getByText(/sem lembretes/)).toBeInTheDocument();
    proximo(/^Criar avaliação$/);
    await waitFor(() => expect(cliente.salvar).toHaveBeenCalled());
    expect(cliente.salvar.mock.calls[0]![1].config).toMatchObject({
      envio: "link",
      lembretes: [],
    });
  });
});

describe("T216 — assistente da Avaliação 180°", () => {
  it("autoavaliação: quem vê o quê, contagem e prazo da autoavaliação antes", async () => {
    const { cliente } = montar("avaliacao180", org());
    expect(
      screen.getByRole("heading", { name: "Nova Avaliação 180°" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Depois que o gestor enviar/ }),
    ).toBeChecked();
    expect(
      screen.getByText(
        "A pessoa nunca vê a nota do gestor antes de enviar a autoavaliação.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("radio", { name: /Só o RH vê o comparativo/ }),
    );
    proximo(/Próximo: Gestores e times/);
    expect(
      await screen.findByText("1 gestor · 2 pessoas · 1 autoavaliação", {
        selector: "strong",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 pessoa sem CPF: só o gestor avalia"),
    ).toBeInTheDocument();
    proximo(/Próximo: Prazo e envio/);
    fireEvent.click(
      screen.getByRole("button", { name: "Autoavaliação termina antes" }),
    );
    expect(screen.getByLabelText("Prazo da autoavaliação")).toHaveValue(
      "2026-12-20",
    );
    fireEvent.change(screen.getByLabelText("Prazo da autoavaliação"), {
      target: { value: "2026-12-30" },
    });
    proximo(/Criar e enviar convites/);
    expect(
      await screen.findByText(
        "O prazo da autoavaliação precisa terminar antes do prazo do gestor.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Prazo da autoavaliação"), {
      target: { value: "2026-12-20" },
    });
    proximo(/Criar e enviar convites/);
    await waitFor(() => expect(cliente.salvar).toHaveBeenCalled());
    expect(cliente.salvar.mock.calls[0]![1].config).toMatchObject({
      visibilidade: "so_rh",
      prazoAutoavaliacao: prazoDaApi("2026-12-20", "23:59"),
    });
  });
});
