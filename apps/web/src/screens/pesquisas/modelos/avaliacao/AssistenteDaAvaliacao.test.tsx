/**
 * T216 — assistente da Avaliação 90°/180°: nome padrão e validação,
 * competências fixas, comentários, times pelo organograma (tirar, mover,
 * deixar de fora, 180° com autoavaliação), validação dos times, prazos e o
 * que vai para a API (rascunho, times, configuração e publicação), o
 * rascunho gravado ao abrir e retomado na etapa em que parou, e a prévia
 * dos e-mails.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import { lembrarRascunho, memoriaDoRascunho } from "../../rascunhosLocais";
import { AssistenteDaAvaliacao } from "./AssistenteDaAvaliacao";
import type { AvaliacaoDetalhe } from "./cliente";
import {
  ANA,
  GESTORA,
  avaliacaoDetalheFalsa,
  detalheFalso,
  organogramaFalso,
} from "./dadosDeTeste";
import { organogramaFalso as org } from "./dadosDeTeste";

/** O prazo como a API recebe (dia e hora de Brasília, sem fuso no texto). */
const prazoDaApi = (dia: string, hora: string) => `${dia}T${hora}`;

const HOJE = "2026-11-27";
const AGORA = () => new Date("2026-11-27T12:00:00-03:00");

afterEach(() => localStorage.clear());

function montar(
  modelo: "avaliacao90" | "avaliacao180" = "avaliacao90",
  organograma = organogramaFalso(),
  extra: {
    base?: PesquisaDetalhe;
    gravada?: AvaliacaoDetalhe;
    empresa?: string;
    organogramaDepois?: boolean;
  } = {},
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
    organograma: vi.fn(async () => {
      // Organograma lento: chega depois do rascunho gravado.
      if (extra.organogramaDepois) await new Promise((r) => setTimeout(r, 30));
      return organograma;
    }),
    salvar: vi.fn(
      async (_id: string, _corpo: { config: Record<string, unknown> }) =>
        avaliacaoDetalheFalsa(),
    ),
    obter: vi.fn(
      async (_id: string) => extra.gravada ?? avaliacaoDetalheFalsa(),
    ),
  };
  const onAcompanhar = vi.fn();
  const onRascunhoCriado = vi.fn();
  render(
    <AssistenteDaAvaliacao
      modelo={modelo}
      servico={servico}
      cliente={cliente}
      {...(extra.base ? { base: extra.base } : {})}
      empresa={extra.empresa ?? null}
      hoje={HOJE}
      agora={AGORA}
      onRascunhoCriado={onRascunhoCriado}
      onVoltar={() => {}}
      onAcompanhar={onAcompanhar}
    />,
  );
  return { servico, cliente, onAcompanhar, onRascunhoCriado };
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

  it("valida o nome (obrigatório e até 120) antes de regravar o rascunho", async () => {
    const { servico } = montar();
    // O rascunho nasce ao abrir, com o nome padrão.
    await waitFor(() => expect(servico.criarPesquisa).toHaveBeenCalledTimes(1));
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
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
    expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
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
    expect(await screen.findByLabelText("Data limite")).toHaveValue(
      "2026-12-27",
    );
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
    const { cliente, servico } = montar();
    proximo(/Próximo: Gestores e times/);
    await screen.findByText("1 gestor · 2 pessoas", { selector: "strong" });
    proximo(/Próximo: Prazo e envio/);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Só gerar o link/ }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: /Lembrar quem não terminou/ }),
    );
    expect(screen.getByText(/sem lembretes/)).toBeInTheDocument();
    proximo(/^Criar avaliação$/);
    await waitFor(() => expect(servico.publicarPesquisa).toHaveBeenCalled());
    expect(cliente.salvar.mock.calls.at(-1)![1].config).toMatchObject({
      envio: "link",
      lembretes: [],
    });
  });

  it("grava o rascunho ao abrir e, a cada etapa, o mesmo rascunho com a configuração e os times", async () => {
    const { servico, cliente, onRascunhoCriado } = montar();
    await waitFor(() =>
      expect(onRascunhoCriado).toHaveBeenCalledWith("pesq-1"),
    );
    expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Rascunho salvo às/)).toBeInTheDocument();
    expect(memoriaDoRascunho("pesq-1")?.etapa).toBe(1);
    await screen.findByRole("button", { name: /Próximo: Gestores e times/ });
    // Espera o organograma, para os times irem junto.
    await waitFor(() => expect(screen.getByText("01")).toBeInTheDocument());
    proximo(/Próximo: Gestores e times/);
    await screen.findByText("1 gestor · 2 pessoas", { selector: "strong" });
    expect(servico.alterarPesquisa).toHaveBeenCalledWith(
      "pesq-1",
      expect.objectContaining({ encerraEm: null }),
    );
    expect(cliente.salvar).toHaveBeenLastCalledWith("pesq-1", {
      config: expect.objectContaining({ prazoAutoavaliacao: null }),
      times: [{ gestorId: "g1", avaliadoIds: ["p1", "p2"] }],
    });
    expect(memoriaDoRascunho("pesq-1")?.etapa).toBe(2);
    proximo(/Próximo: Prazo e envio/);
    await screen.findByLabelText("Data limite");
    expect(memoriaDoRascunho("pesq-1")?.etapa).toBe(3);
    expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
    expect(onRascunhoCriado).toHaveBeenCalledTimes(1);
  });

  it("reabre o rascunho na etapa em que parou, com a configuração e os times gravados", async () => {
    lembrarRascunho("pesq-9", {
      etapa: 3,
      totalDeEtapas: 3,
      salvoEm: "2026-11-27T15:00:00.000Z",
    });
    const gravada = avaliacaoDetalheFalsa();
    const { servico, cliente, onRascunhoCriado } = montar(
      "avaliacao90",
      organogramaFalso(),
      {
        base: detalheFalso({ id: "pesq-9", nome: "Ciclo retomado" }),
        gravada: {
          ...gravada,
          modelo: "avaliacao90",
          config: { ...gravada.config, envio: "link", lembretes: [] },
          times: [
            {
              gestor: GESTORA,
              pessoas: [
                { ...ANA, gestorRespondeu: false, autoavaliacao: null },
              ],
            },
          ],
        },
      },
    );
    expect(await screen.findByLabelText("Data limite")).toBeInTheDocument();
    expect(
      await screen.findByRole("radio", { name: /Só gerar o link/ }),
    ).toBeChecked();
    expect(cliente.obter).toHaveBeenCalledWith("pesq-9");
    expect(
      screen.getByText(/Ciclo retomado · 8 competências/),
    ).toBeInTheDocument();
    expect(screen.getByText(/sem lembretes/)).toBeInTheDocument();
    proximo(/^Criar avaliação$/);
    await waitFor(() =>
      expect(servico.publicarPesquisa).toHaveBeenCalledWith("pesq-9"),
    );
    expect(servico.alterarPesquisa).toHaveBeenNthCalledWith(
      1,
      "pesq-9",
      expect.anything(),
    );
    expect(cliente.salvar).toHaveBeenLastCalledWith(
      "pesq-9",
      expect.objectContaining({
        times: [{ gestorId: "g1", avaliadoIds: ["p1"] }],
      }),
    );
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
    expect(onRascunhoCriado).not.toHaveBeenCalled();
  });

  it("prévia do e-mail: para quem, a empresa, a saudação e o botão", async () => {
    montar("avaliacao90", organogramaFalso(), { empresa: "Empresa Alfa" });
    await waitFor(() => expect(screen.getByText("01")).toBeInTheDocument());
    proximo(/Próximo: Gestores e times/);
    await screen.findByText("1 gestor · 2 pessoas", { selector: "strong" });
    proximo(/Próximo: Prazo e envio/);
    const previa = await screen.findByRole("group", {
      name: "Prévia do e-mail do gestor",
    });
    expect(previa).toHaveTextContent("Para: Gestora Teste");
    expect(previa).toHaveTextContent("De: Empresa Alfa");
    expect(previa).toHaveTextContent("Avalie o seu time até 27/12");
    expect(previa).toHaveTextContent("Oi, Gestora.");
    expect(previa).toHaveTextContent(
      "A Empresa Alfa abriu a Avaliação 90° – Ciclo 2026.2. Você vai avaliar 2 pessoas do seu time em 8 competências.",
    );
    expect(previa).toHaveTextContent("Começar a avaliar");
    // Tempo pela mesma regra da página pública: por pessoa × quantidade.
    expect(previa).toHaveTextContent(
      "São cerca de 8 minutos (4 por pessoa avaliada)",
    );
    expect(previa).toHaveTextContent(
      "Você entra com o seu CPF e a sua data de nascimento.",
    );
    expect(
      screen.queryByRole("group", {
        name: "Prévia do e-mail da pessoa avaliada",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("T216 — assistente da Avaliação 180°", () => {
  it("autoavaliação: quem vê o quê, contagem e prazo da autoavaliação antes", async () => {
    const { cliente, servico } = montar("avaliacao180", org());
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
      await screen.findByRole("button", {
        name: "Autoavaliação termina antes",
      }),
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
    await waitFor(() => expect(servico.publicarPesquisa).toHaveBeenCalled());
    expect(cliente.salvar.mock.calls.at(-1)![1].config).toMatchObject({
      visibilidade: "so_rh",
      prazoAutoavaliacao: prazoDaApi("2026-12-20", "23:59"),
    });
  });

  it("prévias do gestor e da pessoa avaliada; quem vê a autoavaliação", async () => {
    montar("avaliacao180", org(), { empresa: "Empresa Alfa" });
    await waitFor(() => expect(screen.getByText("01")).toBeInTheDocument());
    proximo(/Próximo: Gestores e times/);
    await screen.findByText("1 gestor · 2 pessoas · 1 autoavaliação", {
      selector: "strong",
    });
    proximo(/Próximo: Prazo e envio/);
    const gestor = await screen.findByRole("group", {
      name: "Prévia do e-mail do gestor",
    });
    expect(gestor).toHaveTextContent(
      "Avaliação 180°: avalie o seu time até 27/12",
    );
    expect(gestor).toHaveTextContent(
      "cada uma também responde à própria autoavaliação",
    );
    expect(gestor).toHaveTextContent(
      "A autoavaliação de cada pessoa aparece para você depois",
    );
    const pessoa = screen.getByRole("group", {
      name: "Prévia do e-mail da pessoa avaliada",
    });
    expect(pessoa).toHaveTextContent("Para: Ana Teste");
    expect(pessoa).toHaveTextContent(
      "Avaliação 180°: faça a sua autoavaliação até 27/12",
    );
    expect(pessoa).toHaveTextContent("Oi, Ana.");
    expect(pessoa).toHaveTextContent("Começar a autoavaliação");
    expect(pessoa).toHaveTextContent("São cerca de 4 minutos");
    expect(pessoa).toHaveTextContent(
      "Você entra com o seu CPF e a sua data de nascimento.",
    );
    // Autoavaliação antes: a pessoa vê o prazo dela.
    fireEvent.click(
      screen.getByRole("button", { name: "Autoavaliação termina antes" }),
    );
    expect(pessoa).toHaveTextContent("faça a sua autoavaliação até 20/12");
    // Só o RH vê o comparativo: o gestor não é avisado da autoavaliação.
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Só o RH vê o comparativo/ }),
    );
    proximo(/Próximo: Gestores e times/);
    await screen.findByText("1 gestor · 2 pessoas · 1 autoavaliação", {
      selector: "strong",
    });
    proximo(/Próximo: Prazo e envio/);
    expect(
      await screen.findByRole("group", { name: "Prévia do e-mail do gestor" }),
    ).not.toHaveTextContent("aparece para você depois");
  });
});

describe("T216 — rascunho da avaliação com o organograma lento", () => {
  it("os times gravados não são trocados pelo organograma que chega depois", async () => {
    const gravada = avaliacaoDetalheFalsa();
    const { cliente } = montar("avaliacao90", organogramaFalso(), {
      base: detalheFalso({ id: "pesq-9" }),
      organogramaDepois: true,
      gravada: {
        ...gravada,
        modelo: "avaliacao90",
        times: [
          {
            gestor: GESTORA,
            pessoas: [{ ...ANA, gestorRespondeu: false, autoavaliacao: null }],
          },
        ],
      },
    });
    proximo(/Próximo: Gestores e times/);
    expect(
      await screen.findByText("1 gestor · 1 pessoa", { selector: "strong" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(cliente.organograma).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 60));
    expect(
      screen.getByText("1 gestor · 1 pessoa", { selector: "strong" }),
    ).toBeInTheDocument();
  });
});
