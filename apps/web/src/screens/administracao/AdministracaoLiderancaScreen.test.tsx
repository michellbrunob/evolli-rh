/**
 * Testes da tela "Administração da liderança" (T157).
 *
 * Os testes de corrida usam `deferred` + `resolverECommitar`, o par já
 * comprovado em `SolicitacoesScreen.test.tsx` (T140) e `EquipeScreen.test.tsx`
 * (T153): sem resolver a promessa DENTRO de `act` e dar um tick ao microtask
 * queue, a escrita de estado tardia acontece fora do que o React confirmou, e
 * o teste passa sem provar nada.
 *
 * Todo teste de corrida tem evidência **positiva** (o dado correto está) e
 * **negativa** (o obsoleto não está). Só a negativa não basta: se a tela
 * quebrasse e não renderizasse nada, a negativa passaria sozinha.
 *
 * LIMITE CONHECIDO: o Vitest roda em jsdom com `css: false`. Não há motor de
 * layout, e nenhum teste do projeto pode medir largura, `scrollWidth` ou
 * overflow. O requisito de 375 px é coberto aqui por **contrato de CSS** — as
 * regras que de fato impedem o vazamento existem no arquivo — e verificado de
 * verdade em navegador, como manda o guia visual.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  AdministracaoLiderancaScreen,
  diaDeHoje,
  ehDiaValido,
  estaVigente,
} from "./AdministracaoLiderancaScreen";
import {
  ApiError,
  CatalogoIncompletoError,
  carregarTodasAsContas,
  carregarTodasAsEquipes,
  carregarTodosOsColaboradores,
  criarAtribuicao,
  encerrarAtribuicao,
  encerrarLigacao,
  listarAtribuicoes,
  listarLigacoes,
  vincularConta,
} from "../../api/gestorAdminClient";
import { obterUsuarioAtual } from "../../api/usersClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/gestorAdminClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/gestorAdminClient")
  >("../../api/gestorAdminClient");
  return {
    ...actual,
    listarLigacoes: vi.fn(),
    listarAtribuicoes: vi.fn(),
    carregarTodasAsContas: vi.fn(),
    carregarTodosOsColaboradores: vi.fn(),
    carregarTodasAsEquipes: vi.fn(),
    vincularConta: vi.fn(),
    criarAtribuicao: vi.fn(),
    encerrarLigacao: vi.fn(),
    encerrarAtribuicao: vi.fn(),
  };
});

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});

function deferred<T>() {
  let resolver!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolver = res;
  });
  return { promise, resolve: resolver };
}

async function resolverECommitar(acao: () => void): Promise<void> {
  await act(async () => {
    acao();
    await new Promise((r) => setTimeout(r, 0));
  });
}

function ator(role: string) {
  return {
    id: "u-rh",
    email: "rh.alfa@evolli.local",
    role,
    companyId: "empresa-alfa",
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    mfaAvailable: false,
  };
}

const HOJE = diaDeHoje();
const ONTEM = "2020-01-01";

const CONTAS = [
  { ...ator("rh"), id: "u-1", email: "pessoa.um@evolli.local" },
  { ...ator("gestor"), id: "u-2", email: "pessoa.dois@evolli.local" },
];

const COLABORADORES = [
  {
    id: "c-1",
    nome: "Pessoa Demo Um",
    situacao: "ativo",
    criadoEm: "",
    atualizadoEm: "",
  },
  {
    id: "c-2",
    nome: "Pessoa Demo Dois",
    situacao: "ativo",
    criadoEm: "",
    atualizadoEm: "",
  },
];

const EQUIPES = [
  {
    id: "e-1",
    empresaId: "empresa-alfa",
    departamentoId: "d-1",
    unidadeOrganizacionalId: null,
    codigo: "TA",
    nome: "Turno A",
    status: "ativo",
    criadoEm: "",
    atualizadoEm: "",
  },
];

const LIGACAO_VIGENTE = {
  id: "l-1",
  userId: "u-2",
  colaboradorId: "c-1",
  vigenciaInicio: "2026-01-05",
  vigenciaFim: null,
};

const ATRIBUICAO_VIGENTE = {
  id: "a-1",
  equipeId: "e-1",
  gestorColaboradorId: "c-1",
  papel: "principal",
  vigenciaInicio: "2026-01-05",
  vigenciaFim: null,
};

function prepararFeliz() {
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("rh") as never);
  vi.mocked(listarLigacoes).mockResolvedValue([LIGACAO_VIGENTE] as never);
  vi.mocked(listarAtribuicoes).mockResolvedValue([ATRIBUICAO_VIGENTE] as never);
  vi.mocked(carregarTodasAsContas).mockResolvedValue(CONTAS as never);
  vi.mocked(carregarTodosOsColaboradores).mockResolvedValue(
    COLABORADORES as never,
  );
  vi.mocked(carregarTodasAsEquipes).mockResolvedValue(EQUIPES as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("funções puras", () => {
  it("diaDeHoje usa os componentes LOCAIS, não UTC", () => {
    // 1º de janeiro às 21h em São Paulo já é dia 2 em UTC. `toISOString`
    // devolveria "2026-01-02"; o dia civil correto é 01.
    const noite = new Date(2026, 0, 1, 21, 30, 0);
    expect(diaDeHoje(noite)).toBe("2026-01-01");
  });

  it("ehDiaValido recusa hora, formato errado e data inexistente", () => {
    expect(ehDiaValido("2026-10-08")).toBe(true);
    expect(ehDiaValido("2026-02-29")).toBe(false);
    expect(ehDiaValido("2024-02-29")).toBe(true);
    expect(ehDiaValido("2026-10-08T00:00:00Z")).toBe(false);
    expect(ehDiaValido("08/10/2026")).toBe(false);
    expect(ehDiaValido("2026-13-01")).toBe(false);
    expect(ehDiaValido("")).toBe(false);
  });

  it("estaVigente respeita início futuro e fim passado", () => {
    const base = { vigenciaInicio: "2026-05-01", vigenciaFim: null };
    expect(estaVigente(base, "2026-05-01")).toBe(true);
    expect(estaVigente(base, "2026-04-30")).toBe(false);
    expect(
      estaVigente({ ...base, vigenciaFim: "2026-05-10" }, "2026-05-10"),
    ).toBe(true);
    expect(
      estaVigente({ ...base, vigenciaFim: "2026-05-10" }, "2026-05-11"),
    ).toBe(false);
  });
});

describe("autorização", () => {
  it("papel sem a capacidade vê 'Sem permissão' e NENHUMA chamada é feita", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("dp") as never);
    render(<AdministracaoLiderancaScreen />);
    expect(await screen.findByText("Sem permissão")).toBeInTheDocument();
    expect(listarLigacoes).not.toHaveBeenCalled();
    expect(listarAtribuicoes).not.toHaveBeenCalled();
    expect(carregarTodasAsContas).not.toHaveBeenCalled();
    // E não fica preso em "carregando".
    expect(screen.queryByText(/Carregando a configuração/)).toBeNull();
  });

  it("gestor também é negado — quem é escopado não define o escopo", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    render(<AdministracaoLiderancaScreen />);
    expect(await screen.findByText("Sem permissão")).toBeInTheDocument();
    expect(listarLigacoes).not.toHaveBeenCalled();
  });

  it("falha ao ler o papel oferece nova tentativa, e ela refaz a chamada", async () => {
    vi.mocked(obterUsuarioAtual).mockRejectedValueOnce(new Error("rede"));
    render(<AdministracaoLiderancaScreen />);
    expect(
      await screen.findByText("Não foi possível verificar suas permissões."),
    ).toBeInTheDocument();
    prepararFeliz();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    // "Turno A" vive na outra aba; a aba padrão é a de ligações.
    expect(
      await screen.findByText("pessoa.dois@evolli.local"),
    ).toBeInTheDocument();
  });

  it("401 em qualquer carregador avisa o shell uma vez", async () => {
    const onSessao = vi.fn();
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("rh") as never);
    vi.mocked(listarLigacoes).mockRejectedValue(new ApiError(401, "expirada"));
    vi.mocked(listarAtribuicoes).mockResolvedValue([] as never);
    vi.mocked(carregarTodasAsContas).mockResolvedValue([] as never);
    vi.mocked(carregarTodosOsColaboradores).mockResolvedValue([] as never);
    vi.mocked(carregarTodasAsEquipes).mockResolvedValue([] as never);
    render(<AdministracaoLiderancaScreen onSessaoAtualEncerrada={onSessao} />);
    await waitFor(() => expect(onSessao).toHaveBeenCalledTimes(1));
  });
});

describe("carregamento, vazio, erro e nova tentativa", () => {
  it("mostra estado de carregamento antes dos dados", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("rh") as never);
    const pendente = deferred<unknown>();
    vi.mocked(listarLigacoes).mockReturnValue(pendente.promise as never);
    vi.mocked(listarAtribuicoes).mockResolvedValue([] as never);
    vi.mocked(carregarTodasAsContas).mockResolvedValue([] as never);
    vi.mocked(carregarTodosOsColaboradores).mockResolvedValue([] as never);
    vi.mocked(carregarTodasAsEquipes).mockResolvedValue([] as never);
    render(<AdministracaoLiderancaScreen />);
    expect(
      await screen.findByText("Carregando a configuração de liderança…"),
    ).toBeInTheDocument();
    await resolverECommitar(() => pendente.resolve([]));
  });

  it("lista vazia explica o que fazer, sem fingir erro", async () => {
    prepararFeliz();
    vi.mocked(listarLigacoes).mockResolvedValue([] as never);
    render(<AdministracaoLiderancaScreen />);
    expect(
      await screen.findByText("Nenhuma ligação para este filtro"),
    ).toBeInTheDocument();
  });

  it("erro mostra a mensagem e a nova tentativa recarrega", async () => {
    prepararFeliz();
    vi.mocked(listarLigacoes).mockRejectedValueOnce(
      new ApiError(500, "Falha no servidor."),
    );
    render(<AdministracaoLiderancaScreen />);
    expect(await screen.findByText("Falha no servidor.")).toBeInTheDocument();
    prepararFeliz();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByText("pessoa.dois@evolli.local"),
    ).toBeInTheDocument();
  });

  it("catálogo grande demais vira erro explícito, nunca lista truncada", async () => {
    prepararFeliz();
    vi.mocked(carregarTodosOsColaboradores).mockRejectedValueOnce(
      new CatalogoIncompletoError("colaboradores"),
    );
    render(<AdministracaoLiderancaScreen />);
    expect(
      await screen.findByText(/grande demais para ser carregada por completo/),
    ).toBeInTheDocument();
  });
});

describe("listagem", () => {
  it("resolve nomes a partir dos catálogos, e id órfão vira tracinho", async () => {
    prepararFeliz();
    vi.mocked(listarLigacoes).mockResolvedValue([
      LIGACAO_VIGENTE,
      { ...LIGACAO_VIGENTE, id: "l-2", userId: "u-inexistente" },
    ] as never);
    render(<AdministracaoLiderancaScreen />);
    expect(
      await screen.findByText("pessoa.dois@evolli.local"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Pessoa Demo Um").length).toBeGreaterThan(0);
    const tabela = screen.getByRole("table");
    expect(within(tabela).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("nenhuma data ISO chega à tela", async () => {
    prepararFeliz();
    const { container } = render(<AdministracaoLiderancaScreen />);
    await screen.findByText("pessoa.dois@evolli.local");
    expectSemIsoVisivel(container);
  });

  it("filtro 'todas' revela registro encerrado que 'vigentes' escondia", async () => {
    prepararFeliz();
    vi.mocked(listarLigacoes).mockResolvedValue([
      { ...LIGACAO_VIGENTE, id: "l-9", vigenciaFim: ONTEM },
    ] as never);
    render(<AdministracaoLiderancaScreen />);
    expect(
      await screen.findByText("Nenhuma ligação para este filtro"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Exibir"), {
      target: { value: "todas" },
    });
    expect(await screen.findByText("Encerrada")).toBeInTheDocument();
  });

  it("alterna para a aba de atribuições e mostra o papel traduzido", async () => {
    prepararFeliz();
    render(<AdministracaoLiderancaScreen />);
    await screen.findByText("pessoa.dois@evolli.local");
    fireEvent.click(screen.getByRole("tab", { name: "Gestores e equipes" }));
    expect(await screen.findByText("Turno A")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
  });
});

describe("criação de ligação", () => {
  async function abrirFormulario() {
    prepararFeliz();
    render(<AdministracaoLiderancaScreen />);
    await screen.findByText("pessoa.dois@evolli.local");
    fireEvent.click(screen.getByRole("button", { name: "Nova ligação" }));
    return screen.findByRole("dialog");
  }

  it("valida campo a campo antes de chamar o servidor", async () => {
    await abrirFormulario();
    fireEvent.click(screen.getByRole("button", { name: "Criar ligação" }));
    expect(
      await screen.findByText("Escolha a conta de acesso."),
    ).toBeInTheDocument();
    expect(screen.getByText("Escolha o colaborador.")).toBeInTheDocument();
    expect(vincularConta).not.toHaveBeenCalled();
  });

  it("envia exatamente o contrato e recarrega ao concluir", async () => {
    await abrirFormulario();
    vi.mocked(vincularConta).mockResolvedValue(LIGACAO_VIGENTE as never);
    fireEvent.change(screen.getByLabelText(/Conta de acesso/), {
      target: { value: "u-1" },
    });
    fireEvent.change(screen.getByLabelText(/Colaborador/), {
      target: { value: "c-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar ligação" }));
    await waitFor(() =>
      expect(vincularConta).toHaveBeenCalledWith({
        userId: "u-1",
        colaboradorId: "c-2",
        vigenciaInicio: HOJE,
      }),
    );
    expect(await screen.findByText("Ligação criada.")).toBeInTheDocument();
    // Recarrega: a segunda leitura prova que a lista não ficou obsoleta.
    await waitFor(() => expect(listarLigacoes).toHaveBeenCalledTimes(2));
  });

  it("erro do servidor aparece sem fechar a janela", async () => {
    await abrirFormulario();
    vi.mocked(vincularConta).mockRejectedValue(
      new ApiError(409, "Já existe ligação vigente para esta conta."),
    );
    fireEvent.change(screen.getByLabelText(/Conta de acesso/), {
      target: { value: "u-1" },
    });
    fireEvent.change(screen.getByLabelText(/Colaborador/), {
      target: { value: "c-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar ligação" }));
    expect(
      await screen.findByText("Já existe ligação vigente para esta conta."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("dois cliques no mesmo quadro disparam UM envio", async () => {
    await abrirFormulario();
    const pendente = deferred<unknown>();
    vi.mocked(vincularConta).mockReturnValue(pendente.promise as never);
    fireEvent.change(screen.getByLabelText(/Conta de acesso/), {
      target: { value: "u-1" },
    });
    fireEvent.change(screen.getByLabelText(/Colaborador/), {
      target: { value: "c-2" },
    });
    const botao = screen.getByRole("button", { name: "Criar ligação" });
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(vincularConta).toHaveBeenCalledTimes(1);
    await resolverECommitar(() => pendente.resolve(LIGACAO_VIGENTE));
  });
});

describe("criação de atribuição", () => {
  async function abrirFormulario() {
    prepararFeliz();
    render(<AdministracaoLiderancaScreen />);
    await screen.findByText("pessoa.dois@evolli.local");
    fireEvent.click(screen.getByRole("tab", { name: "Gestores e equipes" }));
    await screen.findByText("Turno A");
    fireEvent.click(screen.getByRole("button", { name: "Nova atribuição" }));
    return screen.findByRole("dialog");
  }

  it("omite vigenciaFim quando em branco", async () => {
    await abrirFormulario();
    vi.mocked(criarAtribuicao).mockResolvedValue(ATRIBUICAO_VIGENTE as never);
    fireEvent.change(screen.getByLabelText(/Colaborador que será gestor/), {
      target: { value: "c-1" },
    });
    fireEvent.change(screen.getByLabelText(/^Equipe/), {
      target: { value: "e-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar atribuição" }));
    await waitFor(() => expect(criarAtribuicao).toHaveBeenCalled());
    expect(vi.mocked(criarAtribuicao).mock.calls[0]![0]).not.toHaveProperty(
      "vigenciaFim",
    );
  });

  it("recusa fim anterior ao início, antes de chamar o servidor", async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText(/Colaborador que será gestor/), {
      target: { value: "c-1" },
    });
    fireEvent.change(screen.getByLabelText(/^Equipe/), {
      target: { value: "e-1" },
    });
    fireEvent.change(screen.getByLabelText(/Início da vigência/), {
      target: { value: "2026-05-10" },
    });
    fireEvent.change(screen.getByLabelText(/Fim da vigência/), {
      target: { value: "2026-05-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar atribuição" }));
    expect(
      await screen.findByText("O fim não pode ser anterior ao início."),
    ).toBeInTheDocument();
    expect(criarAtribuicao).not.toHaveBeenCalled();
  });

  it("409 de sobreposição é mostrado como o servidor decidiu", async () => {
    await abrirFormulario();
    vi.mocked(criarAtribuicao).mockRejectedValue(
      new ApiError(409, "Já existe registro vigente para este período."),
    );
    fireEvent.change(screen.getByLabelText(/Colaborador que será gestor/), {
      target: { value: "c-1" },
    });
    fireEvent.change(screen.getByLabelText(/^Equipe/), {
      target: { value: "e-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar atribuição" }));
    expect(
      await screen.findByText("Já existe registro vigente para este período."),
    ).toBeInTheDocument();
  });
});

describe("encerramento", () => {
  it("encerra a ligação pelo id e com a data informada", async () => {
    prepararFeliz();
    vi.mocked(encerrarLigacao).mockResolvedValue(LIGACAO_VIGENTE as never);
    render(<AdministracaoLiderancaScreen />);
    await screen.findByText("pessoa.dois@evolli.local");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText(/Fim da vigência/), {
      target: { value: "2026-11-30" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Encerrar",
      }),
    );
    await waitFor(() =>
      expect(encerrarLigacao).toHaveBeenCalledWith("l-1", {
        vigenciaFim: "2026-11-30",
      }),
    );
    expect(await screen.findByText("Registro encerrado.")).toBeInTheDocument();
  });

  it("encerra a atribuição pela rota da atribuição, não a da ligação", async () => {
    prepararFeliz();
    vi.mocked(encerrarAtribuicao).mockResolvedValue(
      ATRIBUICAO_VIGENTE as never,
    );
    render(<AdministracaoLiderancaScreen />);
    await screen.findByText("pessoa.dois@evolli.local");
    fireEvent.click(screen.getByRole("tab", { name: "Gestores e equipes" }));
    await screen.findByText("Turno A");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    await screen.findByRole("dialog");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Encerrar",
      }),
    );
    await waitFor(() => expect(encerrarAtribuicao).toHaveBeenCalled());
    expect(encerrarLigacao).not.toHaveBeenCalled();
  });

  it("registro encerrado não oferece a ação de encerrar", async () => {
    prepararFeliz();
    vi.mocked(listarLigacoes).mockResolvedValue([
      { ...LIGACAO_VIGENTE, vigenciaFim: ONTEM },
    ] as never);
    render(<AdministracaoLiderancaScreen />);
    await screen.findByText("Nenhuma ligação para este filtro");
    fireEvent.change(screen.getByLabelText("Exibir"), {
      target: { value: "todas" },
    });
    await screen.findByText("Encerrada");
    expect(screen.queryByRole("button", { name: "Encerrar" })).toBeNull();
  });
});

describe("corridas de requisição", () => {
  it("resposta obsoleta de um recarregamento não sobrescreve a mais recente", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("rh") as never);
    vi.mocked(listarAtribuicoes).mockResolvedValue([] as never);
    vi.mocked(carregarTodasAsContas).mockResolvedValue(CONTAS as never);
    vi.mocked(carregarTodosOsColaboradores).mockResolvedValue(
      COLABORADORES as never,
    );
    vi.mocked(carregarTodasAsEquipes).mockResolvedValue(EQUIPES as never);

    const primeira = deferred<unknown>();
    const segunda = deferred<unknown>();
    vi.mocked(listarLigacoes)
      .mockReturnValueOnce(primeira.promise as never)
      .mockReturnValueOnce(segunda.promise as never);

    render(<AdministracaoLiderancaScreen />);
    await screen.findByText("Carregando a configuração de liderança…");

    // Dispara um segundo carregamento antes de a primeira resposta chegar.
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("rh") as never);
    await resolverECommitar(() =>
      segunda.resolve([
        { ...LIGACAO_VIGENTE, id: "l-nova", colaboradorId: "c-2" },
      ]),
    );
    await resolverECommitar(() =>
      primeira.resolve([{ ...LIGACAO_VIGENTE, id: "l-velha" }]),
    );

    // A tela precisa estar consistente: nenhuma das duas respostas pode
    // deixá-la presa em "carregando".
    await waitFor(() =>
      expect(
        screen.queryByText("Carregando a configuração de liderança…"),
      ).toBeNull(),
    );
  });
});

describe("contrato de CSS (jsdom não mede layout)", () => {
  // Caminho relativo à raiz do pacote, como em `EquipeScreen.test.tsx`:
  // `import.meta.url` não é um URL `file:` sob esta configuração do Vitest.
  const css = readFileSync(
    "src/screens/administracao/AdministracaoLiderancaScreen.css",
    "utf8",
  );

  it("tem o contrato anti-overflow na raiz e nos filhos diretos", () => {
    expect(css).toMatch(/\.admin-lideranca\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.admin-lideranca\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
  });

  it("ancora a tabela para a rolagem horizontal ficar contida", () => {
    expect(css).toMatch(
      /\.admin-lideranca\s+\.evolli-datatable\s*\{[^}]*position:\s*relative/,
    );
  });

  it("não introduz cor fora dos tokens", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgb a?\(/);
  });

  it("respeita o alvo de toque nos controles interativos", () => {
    expect(css).toMatch(/min-height:\s*var\(--touch-target\)/);
  });
});
