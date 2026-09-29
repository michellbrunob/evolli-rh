import {
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
    prepararBase();
    const d = deferred<unknown>();
    vi.mocked(listarSolicitacoesPessoas).mockReturnValue(d.promise as never);
    render(<SolicitacoesScreen />);
    expect(
      await screen.findByText("Carregando solicitações…"),
    ).toBeInTheDocument();
    d.resolve(pagina([]));
    await screen.findByText("Nenhuma solicitação encontrada");
  });

  it("mostra estado vazio quando não há solicitações", async () => {
    // Dois colaboradores: nenhum é auto-selecionado, então a lista carrega uma
    // única vez e o estado observado é o definitivo, não um intermediário.
    prepararBase(ATOR_RH, [COLAB_A, COLAB_B]);
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(pagina([]) as never);
    render(<SolicitacoesScreen />);
    expect(
      await screen.findByText("Nenhuma solicitação encontrada"),
    ).toBeInTheDocument();
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
    prepararBase();
    render(<SolicitacoesScreen />);
    await screen.findByLabelText("Colaborador");
    fireEvent.change(screen.getByLabelText("Colaborador"), {
      target: { value: "colab-A" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesPessoas).mock.calls.at(-1)?.[0],
      ).toMatchObject({ vinculoId: "vinc-1" }),
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

  it("404 fecha o detalhe e atualiza a lista, sem revelar existência", async () => {
    prepararBase();
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([s]) as never,
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValue(s as never);
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValue(
      new ApiError(404, "nao encontrado"),
    );
    render(<SolicitacoesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhe/ }));
    await screen.findByRole("heading", { name: /^Solicitação aaaaaaaa/ });

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirmar enviar/i }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /^Solicitação aaaaaaaa/ }),
      ).not.toBeInTheDocument(),
    );
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

  it("reexibe o dia de referência como foi gravado, sem recalcular fuso", async () => {
    prepararBase();
    vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(
      pagina([
        solicitacao({ periodoReferencia: "2026-08-10T00:00:00.000Z" }),
      ]) as never,
    );
    render(<SolicitacoesScreen />);
    expect(await screen.findByText("2026-08-10")).toBeInTheDocument();
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

    dB.resolve([
      vinculo({ id: "vb", matricula: "MB", colaboradorId: "colab-B" }),
    ]);
    await screen.findByText(/matrícula MB/);

    dA.resolve([
      vinculo({ id: "va", matricula: "MA", colaboradorId: "colab-A" }),
    ]);
    await Promise.resolve();
    await Promise.resolve();

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

    dSegunda.resolve(pagina([solicitacao({ tipo: "ferias" })]));
    const tabela = await screen.findByRole("table", {
      name: "Solicitações de pessoas no seu escopo",
    });
    expect(within(tabela).getByText("Férias")).toBeInTheDocument();

    dPrimeira.resolve(pagina([solicitacao({ tipo: "atestado" })]));
    await Promise.resolve();
    await Promise.resolve();

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

    dP2.resolve(pagina([solicitacao({ tipo: "beneficios" })], 60, 3));
    await waitFor(() =>
      expect(within(tabela).getByText("Benefícios")).toBeInTheDocument(),
    );

    dP1.resolve(pagina([solicitacao({ tipo: "ausencia" })], 60, 2));
    await Promise.resolve();
    await Promise.resolve();

    expect(within(tabela).getByText("Benefícios")).toBeInTheDocument();
    expect(within(tabela).queryByText("Ausência")).not.toBeInTheDocument();
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

    dDetalhe.resolve(solicitacao({ situacao: "recusada" }));
    dHist.resolve([evento({ id: "ev-tardio", acao: "recusar" })]);
    await Promise.resolve();
    await Promise.resolve();

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
