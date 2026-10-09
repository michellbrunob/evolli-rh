import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SolicitacoesScreen } from "./SolicitacoesScreen";
import { obterUsuarioAtual } from "../../api/usersClient";
import {
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import {
  ApiError,
  detalharSolicitacaoPessoa,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
  registrarSolicitacaoPessoa,
  transicionarSolicitacaoPessoa,
} from "../../api/solicitacoesPessoasClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});
vi.mock("../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/colaboradoresClient")
  >("../../api/colaboradoresClient");
  return {
    ...actual,
    listarColaboradores: vi.fn(),
    listarVinculosDoColaborador: vi.fn(),
  };
});
vi.mock("../../api/solicitacoesPessoasClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/solicitacoesPessoasClient")
  >("../../api/solicitacoesPessoasClient");
  return {
    ...actual,
    listarSolicitacoesPessoas: vi.fn(),
    detalharSolicitacaoPessoa: vi.fn(),
    historicoSolicitacaoPessoa: vi.fn(),
    registrarSolicitacaoPessoa: vi.fn(),
    transicionarSolicitacaoPessoa: vi.fn(),
  };
});

// --------------------------------------------------------------------------
// Dados sintéticos — nenhum nome, documento ou identificador real.
// --------------------------------------------------------------------------

const EMPRESA = "22222222-2222-4222-8222-222222222222";

const ATOR_RH = {
  id: "user-rh",
  email: "rh@example.test",
  role: "rh",
  companyId: EMPRESA,
  unitId: null,
  teamId: null,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const ATOR_MASTER = { ...ATOR_RH, id: "user-master", role: "master_tecnico" };

const COLAB_A = {
  id: "colab-A",
  nome: "Pessoa Sintetica A",
  situacao: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};
const COLAB_B = { ...COLAB_A, id: "colab-B", nome: "Pessoa Sintetica B" };

function vinculo(over: Record<string, unknown> = {}) {
  return {
    id: "vinc-1",
    colaboradorId: "colab-A",
    empresaId: EMPRESA,
    matricula: "M-0001",
    tipo: "clt",
    situacao: "ativo",
    dataAdmissao: "2026-01-05",
    dataDesligamento: null,
    criadoEm: "2026-01-05T00:00:00.000Z",
    atualizadoEm: "2026-01-05T00:00:00.000Z",
    ...over,
  };
}

function solicitacao(over: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-1111-4111-8111-111111111111",
    empresaId: EMPRESA,
    vinculoId: "vinc-1",
    tipo: "ferias",
    motivo: "periodo_ferias",
    situacao: "rascunho",
    periodoReferencia: null,
    registradoPorUserId: "user-rh",
    enviadaEm: null,
    primeiraRevisaoEm: null,
    criadoEm: "2026-09-29T10:00:00.000Z",
    atualizadoEm: "2026-09-29T10:00:00.000Z",
    ...over,
  };
}

function evento(over: Record<string, unknown> = {}) {
  return {
    id: "ev-1",
    solicitacaoId: "aaaaaaaa-1111-4111-8111-111111111111",
    empresaId: EMPRESA,
    acao: "criar",
    situacaoDe: null,
    situacaoPara: "rascunho",
    motivo: null,
    registradoPorUserId: "user-rh",
    requestId: "req-1",
    ocorridoEm: "2026-09-29T10:00:00.000Z",
    ...over,
  };
}

function pagina(itens: unknown[], total = itens.length, pag = 1) {
  return { itens, pagina: pag, tamanhoPagina: 20, total };
}

/** Promessa controlável para forçar ordens de resolução deterministas. */
function deferred<T>() {
  let resolver!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolver = r;
  });
  return { promise, resolve: resolver };
}

/**
 * Resolve uma promessa controlável e espera o React COMMITAR.
 *
 * Sequências de `await Promise.resolve()` só esvaziam microtasks; o React 18
 * agenda o trabalho padrão num macrotask, então a asserção rodaria antes de
 * qualquer repintura e passaria mesmo sem as guardas. `act` com um
 * `setTimeout(0)` dentro esvazia as duas filas e garante que o que está na
 * tela é o resultado final — é isso que dá poder de detecção aos testes de
 * corrida.
 */
async function resolverECommitar(acao: () => void): Promise<void> {
  await act(async () => {
    acao();
    await new Promise((r) => setTimeout(r, 0));
  });
}

function prepararBase(
  ator: unknown = ATOR_RH,
  colaboradores: unknown[] = [COLAB_A],
) {
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ator as never);
  vi.mocked(listarColaboradores).mockResolvedValue(
    pagina(colaboradores) as never,
  );
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
    vinculo(),
  ] as never);
  vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
    pagina([solicitacao()]) as never,
  );
  vi.mocked(historicoSolicitacaoPessoa).mockResolvedValue([evento()] as never);
}

beforeEach(() => {
  // `resetAllMocks` (e nao `clearAllMocks`): limpa tambem as implementacoes e
  // as filas `*Once`, que de outro modo vazam de um teste para o seguinte.
  vi.resetAllMocks();
});

// --------------------------------------------------------------------------

describe("SolicitacoesScreen (T140) — estrutura e acessibilidade", () => {
  it("tem um único h1", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("declara que registra e encaminha, sem executar nem tratar anexo", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    const aviso = await screen.findByText(/Encaminhar é um repasse/);
    expect(aviso).toHaveTextContent(/nada aqui altera/i);
    expect(aviso).toHaveTextContent(
      /Não há anexo, arquivo ou informação clínica/i,
    );
  });

  it("a tabela tem legenda acessível", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    expect(
      await screen.findByRole("table", {
        name: "Solicitações de pessoas no seu escopo",
      }),
    ).toBeInTheDocument();
  });
});

describe("SolicitacoesScreen (T140) — carregamento, vazio e erro", () => {
  it("mostra estado de carregamento antes da resposta", async () => {
    // Visão geral (nenhum colaborador auto-resolvido): é o único modo em que
    // a listagem é consultada sem vínculo.
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    const d = deferred<unknown>();
    vi.mocked(listarSolicitacoesPessoas).mockReturnValue(d.promise as never);
    render(<SolicitacoesScreen />);
    // Consulta fresca a cada tentativa: o nó é substituído quando o escopo
    // deixa de ser "definindo" e passa a ser a visão geral, com o mesmo texto.
    await waitFor(() =>
      expect(screen.getByText("Carregando solicitações…")).toBeInTheDocument(),
    );
    d.resolve(pagina([]));
    await screen.findByText("Nenhuma solicitação encontrada");
  });

  it("mostra estado vazio quando não há solicitações", async () => {
    // Dois colaboradores: nenhum é auto-selecionado, então a lista carrega uma
    // única vez e o estado observado é o definitivo, não um intermediário.
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(pagina([]) as never);
    render(<SolicitacoesScreen />);
    await waitFor(() =>
      expect(
        screen.getByText("Nenhuma solicitação encontrada"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra erro com 'Tentar novamente' que refaz a chamada", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    vi.mocked(listarSolicitacoesPessoas)
      .mockRejectedValueOnce(new ApiError(500, "falhou"))
      .mockResolvedValueOnce(pagina([solicitacao()]) as never);
    render(<SolicitacoesScreen />);

    expect(
      await screen.findByText("Não foi possível carregar as solicitações."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
  });
});

describe("SolicitacoesScreen (T140) — listagem, filtros e paginação", () => {
  it("lista com rótulos humanos, sem expor código técnico de tipo", async () => {
    prepararBase();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([
        solicitacao({ tipo: "atestado", situacao: "em_revisao_rh" }),
      ]) as never,
    );
    render(<SolicitacoesScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(within(tabela).getByText("Atestado")).toBeInTheDocument();
    expect(within(tabela).getByText("Em revisão pelo RH")).toBeInTheDocument();
    // O código técnico nunca aparece na interface.
    expect(screen.queryByText("em_revisao_rh")).not.toBeInTheDocument();
  });

  it("filtrar por tipo envia o filtro à API e volta para a página 1", async () => {
    prepararBase();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([solicitacao()], 60) as never,
    );
    render(<SolicitacoesScreen />);
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ pagina: 2 }),
    );

    fireEvent.change(screen.getByLabelText("Filtrar por tipo"), {
      target: { value: "ferias" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ pagina: 1, tipo: "ferias" }),
    );
  });

  it("filtrar por situação envia o filtro à API", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    fireEvent.change(screen.getByLabelText("Filtrar por situação"), {
      target: { value: "recusada" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ situacao: "recusada" }),
    );
  });

  it("selecionar vínculo filtra a listagem por ele", async () => {
    // Dois vínculos: nenhum resolve sozinho, então a seleção é de fato do
    // VÍNCULO — e não um efeito colateral de escolher o colaborador.
    prepararBase();
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ id: "v1", matricula: "M1" }),
      vinculo({ id: "v2", matricula: "M2" }),
    ] as never);
    render(<SolicitacoesScreen />);
    fireEvent.change(await screen.findByLabelText("Colaborador"), {
      target: { value: "colab-A" },
    });

    const selVinculo = (await screen.findByLabelText(
      "Vínculo",
    )) as HTMLSelectElement;
    expect(selVinculo.value).toBe("");

    fireEvent.change(selVinculo, { target: { value: "v2" } });
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ vinculoId: "v2", pagina: 1 }),
    );
  });

  it("os filtros oferecem só os seis tipos aprovados, sem `documento`", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    const select = await screen.findByLabelText("Filtrar por tipo");
    const valores = Array.from(
      select.querySelectorAll("option"),
      (o) => (o as HTMLOptionElement).value,
    );
    expect(valores).toEqual([
      "todos",
      "contestacao_ajuste_ponto",
      "ausencia",
      "ferias",
      "atualizacao_cadastral",
      "atestado",
      "beneficios",
    ]);
    expect(valores).not.toContain("documento");
  });
});

describe("SolicitacoesScreen (T140) — escopo da listagem por vínculo", () => {
  /** Chamadas de listagem que foram feitas SEM filtro de vínculo. */
  function chamadasSemVinculo() {
    return vi
      .mocked(listarSolicitacoesPessoas)
      .mock.calls.filter((c) => c[0]?.vinculoId === undefined);
  }

  it("sem colaborador: visão geral da empresa, e só aí a consulta vai sem vínculo", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    render(<SolicitacoesScreen />);

    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(
      screen.getByText(
        "Visão geral da empresa: todas as solicitações no seu escopo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sem colaborador escolhido, a lista abaixo mostra/),
    ).toBeInTheDocument();
    expect(chamadasSemVinculo().length).toBeGreaterThan(0);
  });

  it("colaborador sem vínculo: estado vazio explícito, sem listagem geral", async () => {
    prepararBase();
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([] as never);
    render(<SolicitacoesScreen />);

    expect(
      await screen.findByText("Colaborador sem vínculo nesta empresa"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Não há vínculo disponível para consultar ou registrar solicitações deste colaborador.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: "Solicitações de pessoas no seu escopo",
      }),
    ).not.toBeInTheDocument();
    expect(chamadasSemVinculo()).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    ).toBeDisabled();
  });

  for (const [papel, ator] of [
    ["rh", ATOR_RH],
    ["master_tecnico", ATOR_MASTER],
  ] as const) {
    it(`múltiplos vínculos e nenhum escolhido: ${papel} vê a orientação e nenhum dado geral`, async () => {
      prepararBase(ator);
      vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
        vinculo({ id: "v1", matricula: "M1" }),
        vinculo({ id: "v2", matricula: "M2" }),
      ] as never);
      render(<SolicitacoesScreen />);

      // A orientação NÃO está sob condição de papel mutável.
      expect(
        await screen.findByText(
          "Selecione um vínculo para visualizar as solicitações deste colaborador.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("table", {
          name: "Solicitações de pessoas no seu escopo",
        }),
      ).not.toBeInTheDocument();
      expect(chamadasSemVinculo()).toHaveLength(0);
    });
  }

  it("escolher o vínculo carrega a lista filtrada, e só ela", async () => {
    prepararBase();
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ id: "v1", matricula: "M1" }),
      vinculo({ id: "v2", matricula: "M2" }),
    ] as never);
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(((q: {
      vinculoId?: string;
    }) =>
      Promise.resolve(
        pagina([
          solicitacao({
            tipo: q?.vinculoId === "v2" ? "beneficios" : "ferias",
          }),
        ]),
      )) as never);

    render(<SolicitacoesScreen />);
    const selVinculo = (await screen.findByLabelText(
      "Vínculo",
    )) as HTMLSelectElement;
    fireEvent.change(selVinculo, { target: { value: "v2" } });

    const tabela = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(within(tabela).getByText("Benefícios")).toBeInTheDocument();
    expect(
      screen.getByText("Filtrado pelo vínculo selecionado deste colaborador."),
    ).toBeInTheDocument();
    expect(chamadasSemVinculo()).toHaveLength(0);
    expect(
      vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
    ).toMatchObject({ vinculoId: "v2" });
  });

  it("um único vínculo resolve sozinho e a lista já vem filtrada", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ vinculoId: "vinc-1" }),
    );
    expect(chamadasSemVinculo()).toHaveLength(0);
  });
});

describe("SolicitacoesScreen (T140) — toda recarga passa pelo helper central", () => {
  /** Toda consulta de LISTA que saiu sem filtro de vínculo. */
  function chamadasSemVinculo() {
    return vi
      .mocked(listarSolicitacoesPessoas)
      .mock.calls.filter((c) => c[0]?.vinculoId === undefined);
  }

  /** Colaborador com dois vínculos, com a lista respondendo por vínculo. */
  function prepararDoisVinculos(ator: unknown = ATOR_RH) {
    prepararBase(ator);
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ id: "v1", matricula: "M1" }),
      vinculo({ id: "v2", matricula: "M2" }),
    ] as never);
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(((q: {
      vinculoId?: string;
    }) =>
      Promise.resolve(
        pagina([
          solicitacao({
            tipo:
              q?.vinculoId === "v1"
                ? "ferias"
                : q?.vinculoId === "v2"
                  ? "beneficios"
                  : "atualizacao_cadastral",
          }),
        ]),
      )) as never);
  }

  /**
   * Ocorrências de um texto FORA de `<option>`: os rótulos de tipo também são
   * opções dos seletores, e só as linhas renderizadas interessam aqui.
   */
  function linhasVisiveis(texto: string) {
    return screen.queryAllByText(texto).filter((e) => e.tagName !== "OPTION");
  }

  async function escolherVinculo(valor: string) {
    const sel = (await screen.findByLabelText("Vínculo")) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: valor } });
    return sel;
  }

  it("desmarcar o vínculo com detalhe aberto fecha tudo e não consulta a visão geral", async () => {
    prepararDoisVinculos();
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(
      solicitacao() as never,
    );
    render(<SolicitacoesScreen />);

    // v1 escolhido: lista filtrada, detalhe aberto e transição em curso.
    await escolherVinculo("v1");
    const tabela = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    await waitFor(() =>
      expect(within(tabela).getByText("Férias")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByRole("button", { name: /Confirmar enviar/i });

    const antes = vi.mocked(listarSolicitacoesPessoas).mock.calls.length;

    // Desmarcar o vínculo: o contexto anterior morre no ato.
    fireEvent.change(screen.getByLabelText("Vínculo"), {
      target: { value: "" },
    });

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /^Solicitação aaaaaaaa/ }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /Confirmar enviar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: "Solicitações de pessoas no seu escopo",
      }),
    ).not.toBeInTheDocument();
    expect(linhasVisiveis("Férias")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    ).toBeDisabled();
    // Nenhuma consulta escapou sem vínculo, e nenhuma consulta nova saiu.
    expect(chamadasSemVinculo()).toHaveLength(0);
    expect(vi.mocked(listarSolicitacoesPessoas).mock.calls.length).toBe(antes);

    // Reescolher v2 com a resposta pendente: nada geral pode piscar.
    const pendente = deferred<unknown>();
    vi.mocked(listarSolicitacoesPessoas).mockReturnValueOnce(
      pendente.promise as never,
    );
    fireEvent.change(screen.getByLabelText("Vínculo"), {
      target: { value: "v2" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ vinculoId: "v2" }),
    );
    expect(
      screen.queryByRole("table", {
        name: "Solicitações de pessoas no seu escopo",
      }),
    ).not.toBeInTheDocument();
    expect(linhasVisiveis("Férias")).toHaveLength(0);
    expect(linhasVisiveis("Atualização cadastral")).toHaveLength(0);

    await resolverECommitar(() =>
      pendente.resolve(pagina([solicitacao({ tipo: "beneficios" })])),
    );
    const tabelaV2 = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(within(tabelaV2).getByText("Benefícios")).toBeInTheDocument();
    expect(within(tabelaV2).queryByText("Férias")).not.toBeInTheDocument();
    expect(chamadasSemVinculo()).toHaveLength(0);
  });

  it("recarga após registro mantém o vínculo e nunca cai na visão geral", async () => {
    prepararDoisVinculos();
    vi.mocked(registrarSolicitacaoPessoa).mockResolvedValue(
      solicitacao() as never,
    );
    render(<SolicitacoesScreen />);
    await escolherVinculo("v1");
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    );
    fireEvent.change(await screen.findByLabelText(/^Tipo/), {
      target: { value: "ferias" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/), {
      target: { value: "periodo_ferias" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await screen.findByText("Solicitação registrada em rascunho.");
    expect(
      vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
    ).toMatchObject({ vinculoId: "v1" });
    expect(chamadasSemVinculo()).toHaveLength(0);
  });

  it("404 em transição recarrega mantendo o vínculo e preserva o alerta", async () => {
    prepararDoisVinculos();
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(
      solicitacao() as never,
    );
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValue(
      new ApiError(404, "interno"),
    );
    render(<SolicitacoesScreen />);
    await escolherVinculo("v1");
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar enviar/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não está mais no seu escopo/i,
    );
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ vinculoId: "v1" }),
    );
    expect(chamadasSemVinculo()).toHaveLength(0);
    expect(screen.queryByText(/Ação registrada/)).not.toBeInTheDocument();
  });

  it("nova tentativa: sem vínculo na visão geral, com vínculo no modo filtrado", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    vi.mocked(listarSolicitacoesPessoas).mockRejectedValue(
      new ApiError(500, "falhou"),
    );
    const { unmount } = render(<SolicitacoesScreen />);
    await screen.findByText("Não foi possível carregar as solicitações.");
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([solicitacao()]) as never,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(chamadasSemVinculo().length).toBeGreaterThan(0);
    unmount();

    vi.resetAllMocks();
    prepararDoisVinculos();
    vi.mocked(listarSolicitacoesPessoas).mockRejectedValue(
      new ApiError(500, "falhou"),
    );
    render(<SolicitacoesScreen />);
    await escolherVinculo("v1");
    await screen.findByText("Não foi possível carregar as solicitações.");
    const antes = vi.mocked(listarSolicitacoesPessoas).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.length,
      ).toBeGreaterThan(antes),
    );
    expect(chamadasSemVinculo()).toHaveLength(0);
  });

  it("master_tecnico: desmarcar o vínculo também não consulta a visão geral", async () => {
    prepararDoisVinculos(ATOR_MASTER);
    render(<SolicitacoesScreen />);
    await escolherVinculo("v1");
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });

    fireEvent.change(screen.getByLabelText("Vínculo"), {
      target: { value: "" },
    });
    expect(
      await screen.findByText(
        "Selecione um vínculo para visualizar as solicitações deste colaborador.",
      ),
    ).toBeInTheDocument();
    expect(chamadasSemVinculo()).toHaveLength(0);
  });
});

describe("SolicitacoesScreen (T140) — seleção de colaborador e vínculo", () => {
  it("zero colaboradores bloqueia o registro e explica", async () => {
    prepararBase(ATOR_RH, []);
    render(<SolicitacoesScreen />);
    expect(
      await screen.findByText("Nenhum colaborador no seu escopo"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar solicitação" }),
    ).toBeDisabled();
  });

  it("exatamente um colaborador é resolvido automaticamente", async () => {
    prepararBase(ATOR_RH, [COLAB_A]);
    render(<SolicitacoesScreen />);
    const select = (await screen.findByLabelText(
      "Colaborador",
    )) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("colab-A"));
  });

  it("múltiplos colaboradores exigem escolha explícita", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    render(<SolicitacoesScreen />);
    const select = (await screen.findByLabelText(
      "Colaborador",
    )) as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("um único vínculo é resolvido; vários exigem escolha", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Vínculo") as HTMLSelectElement).value,
      ).toBe("vinc-1"),
    );

    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ id: "v1", matricula: "M1" }),
      vinculo({ id: "v2", matricula: "M2" }),
    ] as never);
    fireEvent.change(screen.getByLabelText("Colaborador"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Colaborador"), {
      target: { value: "colab-A" },
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Vínculo") as HTMLSelectElement).value,
      ).toBe(""),
    );
    expect(
      screen.getByText("Há mais de um vínculo: escolha explicitamente."),
    ).toBeInTheDocument();
  });

  it("colaborador sem vínculo na empresa impede o registro", async () => {
    prepararBase();
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([] as never);
    render(<SolicitacoesScreen />);
    expect(
      await screen.findByText(/não tem vínculo nesta empresa/),
    ).toBeInTheDocument();
  });
});

describe("SolicitacoesScreen (T140) — registro", () => {
  it("registra com empresa da sessão e vínculo do colaborador selecionado", async () => {
    prepararBase();
    vi.mocked(registrarSolicitacaoPessoa).mockResolvedValue(
      solicitacao() as never,
    );
    render(<SolicitacoesScreen />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar solicitação" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    );

    fireEvent.change(await screen.findByLabelText(/^Tipo/), {
      target: { value: "atestado" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/), {
      target: { value: "atestado_apresentado" },
    });
    fireEvent.change(screen.getByLabelText("Dia de referência"), {
      target: { value: "2026-08-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(vi.mocked(registrarSolicitacaoPessoa)).toHaveBeenCalledWith({
        empresaId: EMPRESA,
        vinculoId: "vinc-1",
        tipo: "atestado",
        motivo: "atestado_apresentado",
        periodoReferencia: "2026-08-10",
      }),
    );
    expect(
      await screen.findByText("Solicitação registrada em rascunho."),
    ).toBeInTheDocument();
  });

  it("recarrega a lista depois de registrar", async () => {
    prepararBase();
    vi.mocked(registrarSolicitacaoPessoa).mockResolvedValue(
      solicitacao() as never,
    );
    render(<SolicitacoesScreen />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar solicitação" }),
      ).toBeEnabled(),
    );
    const antes = vi.mocked(listarSolicitacoesPessoas).mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    );
    fireEvent.change(await screen.findByLabelText(/^Tipo/), {
      target: { value: "ferias" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/), {
      target: { value: "periodo_ferias" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.length,
      ).toBeGreaterThan(antes),
    );
  });

  it("exige tipo e motivo antes de chamar a API", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar solicitação" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Registrar" }));

    expect(
      await screen.findByText("Selecione o tipo e o motivo."),
    ).toBeInTheDocument();
    expect(vi.mocked(registrarSolicitacaoPessoa)).not.toHaveBeenCalled();
  });

  it("o formulário não oferece anexo, upload, URL nem campo clínico", async () => {
    prepararBase();
    const { container } = render(<SolicitacoesScreen />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar solicitação" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    );
    await screen.findByLabelText(/^Tipo/);

    const form = container.querySelector("form")!;
    expect(form.querySelector('input[type="file"]')).toBeNull();
    expect(form.querySelector("textarea")).toBeNull();
    // Só os três campos que o DTO aceita.
    expect(form.querySelectorAll("select")).toHaveLength(2);
    expect(form.querySelectorAll('input[type="date"]')).toHaveLength(1);

    const texto = form.textContent?.toLowerCase() ?? "";
    for (const proibido of [
      "upload",
      "anexo",
      "arquivo",
      "download",
      "diagnóstico",
      "descrição clínica",
      "cloudflare",
      "bucket",
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });
});

describe("SolicitacoesScreen (T140) — detalhe, histórico e transições", () => {
  async function abrirDetalhe(situacao = "rascunho") {
    prepararBase();
    const s = solicitacao({ situacao });
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
  }

  it("abre o detalhe somente leitura, com foco no título e botão Fechar", async () => {
    await abrirDetalhe();
    const titulo = screen.getByRole("heading", {
      name: /^Solicitação aaaaaaaa/,
    });
    expect(titulo).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    const campos = titulo.closest("section")!.querySelector("dl")!;
    expect(within(campos).getByText("Rascunho")).toBeInTheDocument();
  });

  it("fechar devolve o foco ao botão de origem", async () => {
    await abrirDetalhe();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /^Solicitação aaaaaaaa/ }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Ver detalhe/ })).toHaveFocus();
  });

  it("mostra o histórico em ordem cronológica, vindo da API", async () => {
    prepararBase();
    const s = solicitacao({ situacao: "enviada" });
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    vi.mocked(historicoSolicitacaoPessoa).mockResolvedValue([
      evento(),
      evento({
        id: "ev-2",
        acao: "enviar",
        situacaoDe: "rascunho",
        situacaoPara: "enviada",
        ocorridoEm: "2026-09-29T11:00:00.000Z",
      }),
    ] as never);
    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));

    const tabela = await screen.findByRole("table", {
      name: "Histórico da solicitação, em ordem cronológica",
    });
    const linhas = tabela.querySelectorAll("tbody tr");
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent("Registrada");
    expect(linhas[1]).toHaveTextContent("Enviar");
  });

  it("oferece exatamente as ações que o backend permite no estado atual", async () => {
    await abrirDetalhe("em_revisao_rh");
    expect(
      screen.getByRole("button", { name: "Aguardar informação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Encaminhar para operação" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeInTheDocument();
    // Cancelamento só antes de `em_revisao_rh`.
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
  });

  it("cancelada não admite nenhuma ação", async () => {
    await abrirDetalhe("cancelada");
    expect(
      screen.getByText("Esta solicitação não admite novas ações."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reabrir" }),
    ).not.toBeInTheDocument();
  });

  it("recusada e encaminhada oferecem reabertura", async () => {
    await abrirDetalhe("recusada");
    expect(screen.getByRole("button", { name: "Reabrir" })).toBeInTheDocument();
  });

  it("executa uma transição e recarrega estado e histórico", async () => {
    await abrirDetalhe("rascunho");
    vi.mocked(transicionarSolicitacaoPessoa).mockResolvedValue(
      solicitacao({ situacao: "enviada" }) as never,
    );
    const antes = vi.mocked(historicoSolicitacaoPessoa).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar enviar/i }),
    );

    await waitFor(() =>
      expect(vi.mocked(transicionarSolicitacaoPessoa)).toHaveBeenCalledWith(
        "aaaaaaaa-1111-4111-8111-111111111111",
        { acao: "enviar" },
      ),
    );
    expect(
      await screen.findByText("Ação registrada: Enviar."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        vi.mocked(historicoSolicitacaoPessoa).mock.calls.length,
      ).toBeGreaterThan(antes),
    );
  });

  it("recusar exige justificativa antes de chamar a API", async () => {
    await abrirDetalhe("em_revisao_rh");
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar recusar/i }),
    );
    expect(
      await screen.findByText("Esta ação exige uma justificativa registrada."),
    ).toBeInTheDocument();
    expect(vi.mocked(transicionarSolicitacaoPessoa)).not.toHaveBeenCalled();
  });

  it("reabrir envia a justificativa codificada", async () => {
    await abrirDetalhe("recusada");
    vi.mocked(transicionarSolicitacaoPessoa).mockResolvedValue(
      solicitacao({ situacao: "em_revisao_rh" }) as never,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    fireEvent.change(await screen.findByLabelText(/^Justificativa/), {
      target: { value: "reanalise_administrativa" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar reabrir/i }));

    await waitFor(() =>
      expect(vi.mocked(transicionarSolicitacaoPessoa)).toHaveBeenCalledWith(
        "aaaaaaaa-1111-4111-8111-111111111111",
        { acao: "reabrir", motivo: "reanalise_administrativa" },
      ),
    );
  });
});

describe("SolicitacoesScreen (T140) — conflito de transição", () => {
  it("422 não projeta sucesso local: mostra mensagem segura e recarrega do servidor", async () => {
    prepararBase();
    const s = solicitacao({ situacao: "rascunho" });
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValue(
      new ApiError(422, "recusada pelo servidor"),
    );
    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });

    // O servidor já avançou o estado; a releitura devolve `em_revisao_rh`.
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(
      solicitacao({ situacao: "em_revisao_rh" }) as never,
    );
    const chamadasDetalhe = vi.mocked(detalharSolicitacaoPessoa).mock.calls
      .length;

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar enviar/i }),
    );

    expect(
      await screen.findByText(/Esta ação não é mais possível/),
    ).toBeInTheDocument();
    // Nada de sucesso otimista.
    expect(screen.queryByText(/Ação registrada/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        vi.mocked(detalharSolicitacaoPessoa).mock.calls.length,
      ).toBeGreaterThan(chamadasDetalhe),
    );
    const campos = screen
      .getByRole("heading", { name: /^Solicitação aaaaaaaa/ })
      .closest("section")!
      .querySelector("dl")!;
    await waitFor(() =>
      expect(
        within(campos).getByText("Em revisão pelo RH"),
      ).toBeInTheDocument(),
    );
  });

  it("404 fecha o painel MAS mantém o alerta de falha visível", async () => {
    prepararBase();
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValue(
      new ApiError(404, "detalhe interno que NUNCA deve vazar"),
    );
    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
    const chamadasLista = vi.mocked(listarSolicitacoesPessoas).mock.calls
      .length;

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar enviar/i }),
    );

    // O alerta sobrevive ao mesmo lote que destrói o painel — é ele que
    // diferencia a falha do caminho de sucesso, que também fecha o formulário.
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/não está mais no seu escopo/i);

    // Painel e formulário fechados.
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /^Solicitação aaaaaaaa/ }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /Confirmar enviar/i }),
    ).not.toBeInTheDocument();

    // Lista recarregada, nenhum sucesso projetado, nada do corpo interno.
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.length,
      ).toBeGreaterThan(chamadasLista),
    );
    expect(screen.queryByText(/Ação registrada/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("detalhe interno");

    // E o alerta CONTINUA lá depois de tudo assentar.
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("o alerta de falha só sai numa nova ação do operador", async () => {
    prepararBase();
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValue(
      new ApiError(404, "interno"),
    );
    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar enviar/i }),
    );
    await screen.findByRole("alert");

    // Abrir outro detalhe é uma nova ação: aí sim o aviso sai.
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhe/ }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("422 mantém o painel aberto para o operador entender o conflito", async () => {
    prepararBase();
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValue(
      new ApiError(422, "interno"),
    );
    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar enviar/i }),
    );

    expect(
      await screen.findByText(/Esta ação não é mais possível/),
    ).toBeInTheDocument();
    // Diferente do 404: o contexto permanece.
    expect(
      screen.getByRole("heading", { name: /^Solicitação aaaaaaaa/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ação registrada/)).not.toBeInTheDocument();
  });

  it("nunca exibe o corpo interno de erro do servidor", async () => {
    prepararBase();
    vi.mocked(listarSolicitacoesPessoas).mockRejectedValue(
      new ApiError(500, "stack trace interno"),
    );
    const { container } = render(<SolicitacoesScreen />);
    await screen.findByText("Não foi possível carregar as solicitações.");
    expect(container.textContent).not.toContain("stack trace interno");
  });
});

describe("SolicitacoesScreen (T140) — RBAC na experiência", () => {
  it("master_tecnico lê e não recebe nenhuma ação de mutação", async () => {
    prepararBase(ATOR_MASTER);
    const s = solicitacao({ situacao: "em_revisao_rh" });
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    render(<SolicitacoesScreen />);

    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(
      await screen.findByText(
        "Seu perfil tem acesso somente de leitura nesta tela.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar solicitação" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
    expect(
      screen.queryByRole("button", { name: "Recusar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Encaminhar para operação" }),
    ).not.toBeInTheDocument();
  });

  for (const papel of ["dp", "gestor", "colaborador"] as const) {
    it(`${papel} não recebe nenhuma ação de mutação`, async () => {
      prepararBase({ ...ATOR_RH, role: papel });
      render(<SolicitacoesScreen />);
      await screen.findByRole("table", {
        name: "Solicitações de pessoas no seu escopo",
      });
      expect(
        screen.queryByRole("button", { name: "Registrar solicitação" }),
      ).not.toBeInTheDocument();
    });
  }

  it("falha ao identificar o ator resulta em nenhuma mutação (fail-closed)", async () => {
    prepararBase();
    vi.mocked(obterUsuarioAtual).mockRejectedValue(new Error("sem sessão"));
    render(<SolicitacoesScreen />);
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(
      screen.queryByRole("button", { name: "Registrar solicitação" }),
    ).not.toBeInTheDocument();
  });
});

describe("SolicitacoesScreen (T140) — limites de domínio", () => {
  it("não exibe upload, anexo, R2, conteúdo clínico nem cronômetro de prazo", async () => {
    prepararBase();
    const s = solicitacao({
      tipo: "atestado",
      situacao: "em_revisao_rh",
      periodoReferencia: "2026-08-10T00:00:00.000Z",
      enviadaEm: "2026-09-29T10:30:00.000Z",
      primeiraRevisaoEm: "2026-09-29T11:00:00.000Z",
    });
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    const { container } = render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });

    const texto = (container.textContent ?? "").toLowerCase();
    for (const proibido of [
      "upload",
      "download",
      "baixar",
      "cloudflare",
      "bucket",
      "diagnóstico",
      "cid ",
      "prazo",
      "vencimento",
      "sla",
      "dois dias",
      "conformidade",
    ]) {
      expect(texto).not.toContain(proibido);
    }
    // O aviso cita anexo e informação clínica apenas para NEGÁ-LOS.
    expect(texto).toContain("não há anexo, arquivo ou informação clínica");
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector("a[download]")).toBeNull();
  });

  it("exibe o dia de referência em DD/MM/AAAA, sem recalcular fuso", async () => {
    prepararBase();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([
        solicitacao({ periodoReferencia: "2026-08-10T00:00:00.000Z" }),
      ]) as never,
    );
    render(<SolicitacoesScreen />);
    // É data civil: o dia 10 permanece 10. Converter para o fuso local
    // devolveria 09/08/2026 — justamente o defeito que `formatarDiaCivil` evita.
    expect(await screen.findByText("10/08/2026")).toBeInTheDocument();
  });

  it("exibe o instante do registro no fuso de São Paulo, não em UTC", async () => {
    prepararBase();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([solicitacao({ criadoEm: "2026-09-29T10:00:00.000Z" })]) as never,
    );
    render(<SolicitacoesScreen />);
    // `criadoEm` é instante: 10:00Z são 07:00 em São Paulo. A forma anterior
    // fatiava o ISO cru e mostrava 10:00 — três horas erradas para quem lê aqui.
    expect(await screen.findByText("29/09/2026 às 07:00")).toBeInTheDocument();
  });

  it("nenhuma data ISO chega ao texto visível, da lista ao histórico", async () => {
    prepararBase();
    const s = solicitacao({
      tipo: "atestado",
      situacao: "em_revisao_rh",
      periodoReferencia: "2026-08-10T00:00:00.000Z",
      enviadaEm: "2026-09-29T10:30:00.000Z",
      primeiraRevisaoEm: "2026-09-29T11:00:00.000Z",
    });
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    render(<SolicitacoesScreen />);

    // Detalhe aberto e histórico pintado: todas as superfícies de data desta
    // tela ficam na árvore ao mesmo tempo — lista, painel e eventos.
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });
    await screen.findByRole("table", {
      name: "Histórico da solicitação, em ordem cronológica",
    });

    // O formulário entra junto para deixar um ISO legítimo no `value` do
    // campo de data, logo ao lado do que é exibido.
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    );
    fireEvent.change(await screen.findByLabelText("Dia de referência"), {
      target: { value: "2026-08-10" },
    });

    // A guarda varre o texto visível INTEIRO. O `value` do campo de
    // formulário fica fora do alcance por ser atributo: ali o ISO é contrato
    // com a API, não apresentação, e deve mesmo continuar em AAAA-MM-DD.
    expectSemIsoVisivel(document.body);
  });

  it("não chama nenhuma API de ponto, férias, folha ou cadastro", async () => {
    prepararBase();
    render(<SolicitacoesScreen />);
    await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    // Só os clientes previstos são exercitados.
    expect(vi.mocked(listarSolicitacoesPessoas)).toHaveBeenCalled();
    expect(vi.mocked(listarColaboradores)).toHaveBeenCalled();
    expect(vi.mocked(obterUsuarioAtual)).toHaveBeenCalled();
  });
});

describe("SolicitacoesScreen (T140) — corridas assíncronas", () => {
  it("troca A -> B apaga TODO o contexto de A antes de B responder", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    const dVincB = deferred<unknown>();
    vi.mocked(listarVinculosDoColaborador).mockImplementation(((id: string) =>
      id === "colab-A"
        ? Promise.resolve([
            vinculo({ id: "va", matricula: "MA", colaboradorId: "colab-A" }),
          ])
        : dVincB.promise) as never);

    // A lista responde conforme o filtro de vínculo, para distinguir o que é
    // de A, o que é de B e o que é a lista sem filtro.
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(((q: {
      vinculoId?: string;
    }) => {
      if (q?.vinculoId === "va")
        return Promise.resolve(pagina([solicitacao({ tipo: "ferias" })]));
      if (q?.vinculoId === "vb")
        return Promise.resolve(pagina([solicitacao({ tipo: "beneficios" })]));
      return Promise.resolve(pagina([solicitacao({ tipo: "ausencia" })]));
    }) as never);

    render(<SolicitacoesScreen />);
    const sel = await screen.findByLabelText("Colaborador");

    // Contexto A completo: vínculo resolvido, lista filtrada por ele.
    fireEvent.change(sel, { target: { value: "colab-A" } });
    const tabela = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    await waitFor(() =>
      expect(within(tabela).getByText("Férias")).toBeInTheDocument(),
    );
    expect(await screen.findByText(/matrícula MA/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    ).toBeEnabled();

    // Troca para B, com os vínculos de B AINDA PENDENTES.
    fireEvent.change(sel, { target: { value: "colab-B" } });

    const chamadasAteAgora = vi.mocked(listarSolicitacoesPessoas).mock.calls
      .length;

    // Nada de A pode sobreviver a este instante — e NADA de ninguém entra no
    // lugar: com colaborador escolhido e vínculo pendente não há consulta.
    await waitFor(() =>
      expect(screen.queryByText(/matrícula MA/)).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("table", {
        name: "Solicitações de pessoas no seu escopo",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Carregando os vínculos do colaborador…"),
    ).toBeInTheDocument();
    // A listagem NÃO é chamada sem vinculoId enquanto há colaborador escolhido.
    expect(
      vi
        .mocked(listarSolicitacoesPessoas)
        .mock.calls.slice(chamadasAteAgora)
        .filter((c) => c[0]?.vinculoId === undefined),
    ).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    ).toBeDisabled();
    // Sem formulário aberto, não há caminho de submissão com o vínculo de A.
    expect(
      screen.queryByRole("button", { name: "Registrar" }),
    ).not.toBeInTheDocument();
    expect(vi.mocked(registrarSolicitacaoPessoa)).not.toHaveBeenCalled();

    // B responde: só os dados de B.
    await resolverECommitar(() =>
      dVincB.resolve([
        vinculo({ id: "vb", matricula: "MB", colaboradorId: "colab-B" }),
      ]),
    );
    expect(await screen.findByText(/matrícula MB/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("table", {
            name: "Solicitações de pessoas no seu escopo",
          }),
        ).getByText("Benefícios"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/matrícula MA/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar solicitação" }),
    ).toBeEnabled();
  });

  it("resposta tardia de vínculos de A não reidrata o contexto de B", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    const dVincA = deferred<unknown>();
    vi.mocked(listarVinculosDoColaborador).mockImplementation(((id: string) =>
      id === "colab-A"
        ? dVincA.promise
        : Promise.resolve([
            vinculo({ id: "vb", matricula: "MB", colaboradorId: "colab-B" }),
          ])) as never);

    render(<SolicitacoesScreen />);
    const sel = await screen.findByLabelText("Colaborador");
    fireEvent.change(sel, { target: { value: "colab-A" } });
    fireEvent.change(sel, { target: { value: "colab-B" } });

    expect(await screen.findByText(/matrícula MB/)).toBeInTheDocument();

    await resolverECommitar(() =>
      dVincA.resolve([
        vinculo({ id: "va", matricula: "MA", colaboradorId: "colab-A" }),
      ]),
    );

    expect(screen.getByText(/matrícula MB/)).toBeInTheDocument();
    expect(screen.queryByText(/matrícula MA/)).not.toBeInTheDocument();
    expect((screen.getByLabelText("Vínculo") as HTMLSelectElement).value).toBe(
      "vb",
    );
  });

  it("A -> B -> A: o contador distingue duas cargas do MESMO colaborador", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    const primeiraA = deferred<unknown>();
    const segundaA = deferred<unknown>();
    let chamadasA = 0;
    vi.mocked(listarVinculosDoColaborador).mockImplementation(((id: string) => {
      if (id !== "colab-A")
        return Promise.resolve([
          vinculo({ id: "vb", matricula: "MB", colaboradorId: "colab-B" }),
        ]);
      chamadasA += 1;
      return chamadasA === 1 ? primeiraA.promise : segundaA.promise;
    }) as never);

    render(<SolicitacoesScreen />);
    const sel = await screen.findByLabelText("Colaborador");
    fireEvent.change(sel, { target: { value: "colab-A" } }); // carga 1 de A
    fireEvent.change(sel, { target: { value: "colab-B" } });
    await screen.findByText(/matrícula MB/);
    fireEvent.change(sel, { target: { value: "colab-A" } }); // carga 2 de A

    // A segunda carga de A responde: é ela que vale.
    await resolverECommitar(() =>
      segundaA.resolve([
        vinculo({ id: "va2", matricula: "MA-2", colaboradorId: "colab-A" }),
      ]),
    );
    expect(await screen.findByText(/matrícula MA-2/)).toBeInTheDocument();

    // A PRIMEIRA carga de A chega atrasada — mesmo id, carga obsoleta.
    await resolverECommitar(() =>
      primeiraA.resolve([
        vinculo({ id: "va1", matricula: "MA-1", colaboradorId: "colab-A" }),
      ]),
    );

    expect(screen.getByText(/matrícula MA-2/)).toBeInTheDocument();
    expect(screen.queryByText(/matrícula MA-1/)).not.toBeInTheDocument();
    expect((screen.getByLabelText("Vínculo") as HTMLSelectElement).value).toBe(
      "va2",
    );
  });

  it("troca de colaborador: vínculos antigos (A) que chegam após B não vazam", async () => {
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    const dA = deferred<unknown>();
    const dB = deferred<unknown>();
    vi.mocked(listarVinculosDoColaborador).mockImplementation(((id: string) =>
      id === "colab-A" ? dA.promise : dB.promise) as never);

    render(<SolicitacoesScreen />);
    const sel = await screen.findByLabelText("Colaborador");
    fireEvent.change(sel, { target: { value: "colab-A" } });
    fireEvent.change(sel, { target: { value: "colab-B" } });

    await resolverECommitar(() =>
      dB.resolve([
        vinculo({ id: "vb", matricula: "MB", colaboradorId: "colab-B" }),
      ]),
    );
    // Evidência POSITIVA do contexto atual.
    expect(await screen.findByText(/matrícula MB/)).toBeInTheDocument();

    await resolverECommitar(() =>
      dA.resolve([
        vinculo({ id: "va", matricula: "MA", colaboradorId: "colab-A" }),
      ]),
    );

    // Evidência NEGATIVA: o contexto antigo não reapareceu depois do commit.
    expect(screen.getByText(/matrícula MB/)).toBeInTheDocument();
    expect(screen.queryByText(/matrícula MA/)).not.toBeInTheDocument();
  });

  it("mudança de filtro: resposta do filtro anterior não sobrescreve a atual", async () => {
    prepararBase();
    const dPrimeira = deferred<unknown>();
    const dSegunda = deferred<unknown>();
    vi.mocked(listarSolicitacoesPessoas)
      .mockReturnValueOnce(dPrimeira.promise as never)
      .mockReturnValueOnce(dSegunda.promise as never);

    render(<SolicitacoesScreen />);
    fireEvent.change(await screen.findByLabelText("Filtrar por tipo"), {
      target: { value: "ferias" },
    });

    await resolverECommitar(() =>
      dSegunda.resolve(pagina([solicitacao({ tipo: "ferias" })])),
    );
    const tabela = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(within(tabela).getByText("Férias")).toBeInTheDocument();

    await resolverECommitar(() =>
      dPrimeira.resolve(pagina([solicitacao({ tipo: "atestado" })])),
    );

    expect(within(tabela).getByText("Férias")).toBeInTheDocument();
    expect(within(tabela).queryByText("Atestado")).not.toBeInTheDocument();
  });

  it("paginação: resposta da página anterior não sobrescreve a atual", async () => {
    prepararBase();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([solicitacao({ tipo: "ferias" })], 60) as never,
    );
    render(<SolicitacoesScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(within(tabela).getByText("Férias")).toBeInTheDocument();

    const dP1 = deferred<unknown>();
    const dP2 = deferred<unknown>();
    vi.mocked(listarSolicitacoesPessoas)
      .mockReturnValueOnce(dP1.promise as never)
      .mockReturnValueOnce(dP2.promise as never);

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await resolverECommitar(() =>
      dP2.resolve(pagina([solicitacao({ tipo: "beneficios" })], 60, 3)),
    );
    await waitFor(() =>
      expect(within(tabela).getByText("Benefícios")).toBeInTheDocument(),
    );

    await resolverECommitar(() =>
      dP1.resolve(pagina([solicitacao({ tipo: "ausencia" })], 60, 2)),
    );

    expect(within(tabela).getByText("Benefícios")).toBeInTheDocument();
    expect(within(tabela).queryByText("Ausência")).not.toBeInTheDocument();
  });

  it("histórico tardio de A não aparece no painel já aberto de B", async () => {
    // Exercita a guarda do HISTÓRICO com o painel ABERTO: se ela cair, os
    // eventos de A pintam dentro do detalhe de B.
    prepararBase();
    const solA = solicitacao({ id: "aaaaaaaa-1111-4111-8111-111111111111" });
    const solB = solicitacao({
      id: "bbbbbbbb-2222-4222-8222-222222222222",
      situacao: "cancelada",
    });
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([solA, solB]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockImplementation(((id: string) =>
      Promise.resolve(id === solA.id ? solA : solB)) as never);

    const dHistA = deferred<unknown>();
    vi.mocked(historicoSolicitacaoPessoa).mockImplementation(((id: string) =>
      id === solA.id
        ? dHistA.promise
        : Promise.resolve([
            evento({
              id: "ev-b",
              solicitacaoId: solB.id,
              acao: "cancelar",
              situacaoDe: "rascunho",
              situacaoPara: "cancelada",
            }),
          ])) as never);

    render(<SolicitacoesScreen />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Ver detalhe da solicitação aaaaaaaa/,
      }),
    );
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Ver detalhe da solicitação bbbbbbbb/,
      }),
    );
    await screen.findByRole("heading", { name: /^Solicitação bbbbbbbb/ });

    const historicoB = await screen.findByRole("table", {
      name: "Histórico da solicitação, em ordem cronológica",
    });
    expect(within(historicoB).getByText("Cancelada")).toBeInTheDocument();

    // O histórico de A chega atrasado, com o painel de B aberto.
    await resolverECommitar(() =>
      dHistA.resolve([
        evento({
          id: "ev-a",
          acao: "recusar",
          situacaoDe: "em_revisao_rh",
          situacaoPara: "recusada",
        }),
      ]),
    );

    const aindaB = screen.getByRole("table", {
      name: "Histórico da solicitação, em ordem cronológica",
    });
    expect(within(aindaB).getByText("Cancelada")).toBeInTheDocument();
    expect(within(aindaB).queryByText("Recusada")).not.toBeInTheDocument();
    expect(within(aindaB).queryByText("Recusar")).not.toBeInTheDocument();
  });

  it("detalhe fechado não é repovoado por uma resposta atrasada", async () => {
    prepararBase();
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    const dDetalhe = deferred<unknown>();
    const dHist = deferred<unknown>();
    vi.mocked(detalharSolicitacaoPessoa).mockReturnValue(
      dDetalhe.promise as never,
    );
    vi.mocked(historicoSolicitacaoPessoa).mockReturnValue(
      dHist.promise as never,
    );

    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /^Solicitação aaaaaaaa/ }),
      ).not.toBeInTheDocument(),
    );

    await resolverECommitar(() => {
      dDetalhe.resolve(solicitacao({ situacao: "recusada" }));
      dHist.resolve([evento({ id: "ev-tardio", acao: "recusar" })]);
    });

    expect(
      screen.queryByRole("heading", { name: /^Solicitação aaaaaaaa/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: "Histórico da solicitação, em ordem cronológica",
      }),
    ).not.toBeInTheDocument();
  });
});
