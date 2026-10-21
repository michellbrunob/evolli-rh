import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColaboradoresScreen } from "./ColaboradoresScreen";
import {
  ApiError,
  type ColaboradorApi,
  type ColaboradorListadoApi,
  type ContadoresColaboradoresApi,
  type VinculoApi,
  buscarColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../api/colaboradoresClient";
import {
  type ContatosDoColaboradorApi,
  type ContatosRegistradosApi,
  consultarContatosDoColaborador,
  registrarContatosDoColaborador,
} from "../../api/contatosColaboradorClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/contatosColaboradorClient");

/**
 * T178 — o envelope de `GET /v1/colaboradores` traz `contadores` do escopo
 * inteiro. Por padrão, contados sobre os itens dados; os testes que provam
 * que a tela NÃO soma a página passam números diferentes de propósito.
 */
interface ResultadoPaginadoTeste<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
  contadores: ContadoresColaboradoresApi;
}

function contados(
  itens: readonly { situacao: string }[],
): ContadoresColaboradoresApi {
  return {
    ativos: itens.filter((c) => c.situacao === "ativo").length,
    inativos: itens.filter((c) => c.situacao === "inativo").length,
  };
}

function paginado<T extends { situacao: string }>(
  itens: T[],
): ResultadoPaginadoTeste<T> {
  return {
    itens,
    pagina: 1,
    tamanhoPagina: 100,
    total: itens.length,
    contadores: contados(itens),
  };
}

const colaborador1: ColaboradorListadoApi = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Colaboradora (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
  vinculos: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      empresaId: "44444444-4444-4444-4444-444444444444",
      matricula: "MAT-0001",
      situacao: "ativo",
      dataAdmissao: "2025-01-10T00:00:00.000Z",
      dataDesligamento: null,
    },
  ],
};

const colaborador2: ColaboradorListadoApi = {
  id: "22222222-2222-2222-2222-222222222222",
  nome: "Bruno Colaborador (teste)",
  situacao: "inativo",
  criadoEm: "2025-02-05T12:00:00.000Z",
  atualizadoEm: "2025-02-05T12:00:00.000Z",
  // Sem vínculo na empresa ativa: matrícula e admissão ficam "—".
  vinculos: [],
};

const vinculo1: VinculoApi = {
  id: "33333333-3333-3333-3333-333333333333",
  colaboradorId: colaborador1.id,
  empresaId: "44444444-4444-4444-4444-444444444444",
  matricula: "MAT-0001",
  tipo: "clt",
  situacao: "ativo",
  dataAdmissao: "2025-01-10",
  dataDesligamento: null,
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
};

/**
 * Recusa do servidor com o status real. O módulo do cliente é automockado: o
 * construtor de `ApiError` não roda, então `status` e `message` são postos
 * aqui — a tela decide pelo `status`, como faria com o erro verdadeiro.
 */
function recusa(status: number, message: string): ApiError {
  const erro = new ApiError(status, message);
  Object.assign(erro, { status, message });
  return erro;
}

beforeEach(() => {
  vi.mocked(listarColaboradores).mockResolvedValue(
    paginado([colaborador1, colaborador2]),
  );
  vi.mocked(buscarColaborador).mockResolvedValue(colaborador1);
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([vinculo1]);
  vi.mocked(retificarColaborador).mockResolvedValue(colaborador1);

  // T169 — por padrão, o colaborador aberto não tem contato registrado.
  vi.mocked(consultarContatosDoColaborador).mockImplementation(
    async (colaboradorId) => semContatos(colaboradorId),
  );
});

function semContatos(colaboradorId: string): ContatosDoColaboradorApi {
  return {
    colaboradorId,
    empresaId: "44444444-4444-4444-4444-444444444444",
    situacao: "sem_registro",
    contatos: null,
  };
}

describe("ColaboradoresScreen (T111 — funcional)", () => {
  it("tem um único h1 e exibe o aviso RH e DP", async () => {
    render(<ColaboradoresScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toHaveLength(1);
    expect(screen.getByText("RH e DP")).toBeInTheDocument();

    await waitFor(() => expect(listarColaboradores).toHaveBeenCalled());
  });

  it("lista colaboradores reais retornados pela API", async () => {
    render(<ColaboradoresScreen />);

    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });
    const dentro = within(tabela);
    expect(dentro.getByText("Ana Colaboradora (teste)")).toBeInTheDocument();
    expect(dentro.getByText("Bruno Colaborador (teste)")).toBeInTheDocument();
    expect(dentro.getByText("Ativo")).toBeInTheDocument();
    expect(dentro.getByText("Inativo")).toBeInTheDocument();
  });

  it("mostra o estado de carregamento antes dos dados chegarem", async () => {
    let resolver: (v: ResultadoPaginadoTeste<ColaboradorListadoApi>) => void;
    vi.mocked(listarColaboradores).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve;
      }) as ReturnType<typeof listarColaboradores>,
    );

    render(<ColaboradoresScreen />);

    expect(screen.getByText("Carregando colaboradores…")).toBeInTheDocument();

    resolver!(paginado([colaborador1]));
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
  });

  it("mostra erro de carregamento e permite tentar novamente", async () => {
    vi.mocked(listarColaboradores).mockRejectedValueOnce(new Error("falha"));

    render(<ColaboradoresScreen />);

    await screen.findByRole("heading", {
      name: "Não foi possível carregar os colaboradores",
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
  });

  it("mostra EmptyState quando não há colaboradores", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));

    render(<ColaboradoresScreen />);

    expect(
      await screen.findByRole("heading", {
        name: "Nenhum colaborador cadastrado nesta empresa",
      }),
    ).toBeInTheDocument();
  });

  it("filtra por situação, enviando o parâmetro correto à API", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        situacao: "ativo",
        // T164 — a paginacao viaja JUNTO com o filtro, e volta a pagina 1:
        // filtrar muda o conjunto, e a posicao dentro dele nao sobrevive.
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
  });

  it("filtra por situação do vínculo, enviando o parâmetro correto à API", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    fireEvent.change(screen.getByLabelText("Situação do vínculo"), {
      target: { value: "previsto" },
    });

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        situacaoVinculo: "previsto",
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
  });

  it("abre o detalhe de um colaborador e carrega seus vínculos", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));

    expect(listarVinculosDoColaborador).toHaveBeenCalledWith(colaborador1.id);

    const tabelaVinculos = await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });
    const dentro = within(tabelaVinculos);
    expect(dentro.getByText("MAT-0001")).toBeInTheDocument();
    expect(dentro.getByText("CLT")).toBeInTheDocument();
    // Admissão e desligamento são os únicos dias exibidos nesta tela, e vivem
    // aqui no detalhe — por isso a guarda da T154 é chamada com a lista E o
    // detalhe na tela, e não só com a listagem.
    expect(dentro.getByText("10/01/2025")).toBeInTheDocument();

    // Guarda da T154: varre o texto visível INTEIRO — cabeçalho, filtros,
    // tabela da lista e painel de detalhe entram junto. O `value` de campo de
    // formulário fica fora do alcance por ser atributo, e não texto: ali o ISO
    // é contrato com o `<input type="date">`, não apresentação.
    expectSemIsoVisivel(document.body);
  });

  it("não expõe campos para alterar matrícula, tipo ou data de admissão no detalhe", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));

    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });

    expect(screen.queryByLabelText("Matrícula")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de vínculo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Data de admissão")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("mostra erro ao carregar vínculos, com opção de tentar novamente", async () => {
    vi.mocked(listarVinculosDoColaborador).mockRejectedValueOnce(
      new Error("falha"),
    );

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));

    expect(
      await screen.findByText(
        "Não foi possível carregar os vínculos deste colaborador.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });
  });

  it("edita o nome do colaborador com sucesso e atualiza a listagem", async () => {
    const atualizado: ColaboradorApi = {
      ...colaborador1,
      nome: "Ana Renomeada (teste)",
    };
    vi.mocked(retificarColaborador).mockResolvedValueOnce(atualizado);

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Renomeada (teste)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

    await waitFor(() =>
      expect(retificarColaborador).toHaveBeenCalledWith(colaborador1.id, {
        nome: "Ana Renomeada (teste)",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Ana Renomeada (teste)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Colaboradores desta empresa" }),
    ).toHaveTextContent("Ana Renomeada (teste)");
  });

  it("mostra erro ao falhar a alteração de nome", async () => {
    vi.mocked(retificarColaborador).mockRejectedValueOnce(
      new Error("Não foi possível salvar."),
    );

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Outro Nome (teste)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

    expect(
      await screen.findByText("Não foi possível salvar."),
    ).toBeInTheDocument();
  });

  it("fecha o painel de detalhe", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(
      screen.queryByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).not.toBeInTheDocument();
  });

  // ---- T144 (R1): o detalhe edita o nome, logo também tem o que perder.
  // Fechar com alteração pendente precisa perguntar antes de descartar.
  async function abrirDetalheDeAna() {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });
  }

  it("sem alterar o nome, o detalhe fecha direto — nada a confirmar", async () => {
    await abrirDetalheDeAna();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    expect(
      screen.queryByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).not.toBeInTheDocument();
  });

  it("com o nome alterado, fechar pelo botão pede confirmação em vez de descartar", async () => {
    // Mocks não são limpos entre testes neste arquivo: contagem por delta.
    const antes = vi.mocked(retificarColaborador).mock.calls.length;
    await abrirDetalheDeAna();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Corrigida (teste)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument();
    // Não fechou: o detalhe continua aberto.
    expect(
      screen.getByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).toBeInTheDocument();
    expect(vi.mocked(retificarColaborador).mock.calls.length).toBe(antes);
  });

  it("com o nome alterado, Escape também pede confirmação", async () => {
    await abrirDetalheDeAna();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Corrigida (teste)" },
    });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).toBeInTheDocument();
  });

  it("'Continuar editando' preserva o que foi digitado e devolve o foco ao campo", async () => {
    await abrirDetalheDeAna();

    const campo = screen.getByLabelText("Nome");
    fireEvent.change(campo, { target: { value: "Ana Corrigida (teste)" } });
    campo.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));

    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    // O valor digitado continua lá, e o foco volta para onde se estava editando.
    expect(screen.getByLabelText("Nome")).toHaveValue("Ana Corrigida (teste)");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Nome")),
    );
    expect(
      screen.getByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).toBeInTheDocument();
  });

  it("'Descartar alterações' fecha o detalhe sem gravar", async () => {
    const antes = vi.mocked(retificarColaborador).mock.calls.length;
    await abrirDetalheDeAna();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Corrigida (teste)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("table", {
          name: `Vínculos — ${colaborador1.nome}`,
        }),
      ).not.toBeInTheDocument(),
    );
    expect(vi.mocked(retificarColaborador).mock.calls.length).toBe(antes);
    // A lista preserva o nome original: nada foi gravado.
    expect(
      screen.getByRole("table", { name: "Colaboradores desta empresa" }),
    ).toHaveTextContent("Ana Colaboradora (teste)");
  });

  it("durante a retificação, nenhuma forma de fechamento funciona", async () => {
    const pendente: { current: ((v: ColaboradorApi) => void) | null } = {
      current: null,
    };
    vi.mocked(retificarColaborador).mockImplementationOnce(
      () =>
        new Promise<ColaboradorApi>((res) => {
          pendente.current = res;
        }),
    );
    await abrirDetalheDeAna();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Corrigida (teste)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled(),
    );

    // Escape não fecha e não abre a confirmação; o botão Fechar fica inerte.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
    expect(
      screen.getByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).toBeInTheDocument();

    pendente.current?.({ ...colaborador1, nome: "Ana Corrigida (teste)" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salvar nome" }),
      ).toBeInTheDocument(),
    );
  });

  it("depois de salvar, o nome deixa de contar como alteração pendente", async () => {
    const atualizado: ColaboradorApi = {
      ...colaborador1,
      nome: "Ana Corrigida (teste)",
    };
    vi.mocked(retificarColaborador).mockResolvedValueOnce(atualizado);
    await abrirDetalheDeAna();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Corrigida (teste)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await screen.findByRole("heading", { name: "Ana Corrigida (teste)" });

    // Salvo: o botão volta a ficar inerte e fechar não pergunta mais nada.
    expect(screen.getByRole("button", { name: "Salvar nome" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    expect(
      screen.queryByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).not.toBeInTheDocument();
  });

  it("só espaços em volta do nome não contam como alteração", async () => {
    await abrirDetalheDeAna();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: `  ${colaborador1.nome}  ` },
    });

    expect(screen.getByRole("button", { name: "Salvar nome" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
  });

  it("não contém CPF, senha, sessão ou outro dado sensível na tela", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "senha",
      "sessão",
      "localstorage",
      "r$",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("o detalhe recebe o foco e fecha com Escape, devolvendo o foco", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    const verDetalhes = within(linha).getByRole("button", {
      name: /Abrir ficha/,
    });
    fireEvent.click(verDetalhes);

    const titulo = await screen.findByRole("heading", {
      name: colaborador1.nome,
      level: 2,
    });
    await waitFor(() => expect(document.activeElement).toBe(titulo));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(verDetalhes));
  });

  it("o título da página não é repetido pela seção da lista", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const titulos = screen
      .getAllByRole("heading")
      .map((h) => h.textContent?.trim());
    const repetidos = titulos.filter((t) => t === "Colaboradores");
    expect(repetidos).toHaveLength(1);
  });
});

// ---- T177: a admissão mora só na página de Nova admissão -----------------

describe("ColaboradoresScreen (T177 — Nova admissão leva à página de Nova admissão)", () => {
  it("'Nova admissão' chama onNovaAdmissao e não abre janela nenhuma", async () => {
    const onNovaAdmissao = vi.fn();
    render(<ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const botao = screen.getByRole("button", { name: "Nova admissão" });
    // Navega, não abre janela: nada de semântica de diálogo.
    expect(botao).not.toHaveAttribute("aria-haspopup");
    expect(botao).not.toHaveAttribute("aria-expanded");

    fireEvent.click(botao);

    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("form", { name: "Formulário de novo colaborador" }),
    ).toBeNull();
  });

  it("sem onNovaAdmissao, não há botão 'Nova admissão' no cabeçalho", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(screen.queryByRole("button", { name: "Nova admissão" })).toBeNull();
  });

  it("sem onNovaAdmissao, o estado vazio também não oferece o botão", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    render(<ColaboradoresScreen />);

    await screen.findByRole("heading", {
      name: "Nenhum colaborador cadastrado nesta empresa",
    });
    expect(screen.queryByRole("button", { name: "Nova admissão" })).toBeNull();
    expect(
      screen.queryByText(/Registre a admissão do primeiro colaborador/i),
    ).toBeNull();
  });

  it("o botão do estado vazio também chama onNovaAdmissao", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    const onNovaAdmissao = vi.fn();
    render(<ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} />);

    const vazio = (
      await screen.findByRole("heading", {
        name: "Nenhum colaborador cadastrado nesta empresa",
      })
    ).closest(".evolli-empty-state");
    expect(vazio).not.toBeNull();
    // Um no cabeçalho e outro no estado vazio — os dois levam à página.
    const botoes = screen.getAllByRole("button", { name: "Nova admissão" });
    expect(botoes).toHaveLength(2);
    const doVazio = within(vazio as HTMLElement).getByRole("button", {
      name: "Nova admissão",
    });

    fireEvent.click(doVazio);

    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ---- T147: homologação da admissão — regressões provadas -----------------

/**
 * Promessa que o teste resolve na hora que quiser — é assim que se encena uma
 * resposta que chega ATRASADA. Declarar o  com `!` evita o
 * estreitamento para `never` que o TypeScript faz quando a variável só é
 * atribuída dentro do callback do construtor.
 */
function adiado<T>(): { promessa: Promise<T>; resolver: (valor: T) => void } {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promessa, resolver };
}

describe("ColaboradoresScreen (T147 — homologação da admissão)", () => {
  /**
   * D1. Trocar o filtro duas vezes dispara duas listagens. Se a PRIMEIRA
   * resposta chegar depois da segunda, ela não pode sobrescrever a lista: o
   * usuário veria registros que não correspondem ao filtro selecionado.
   *
   * Falha na implementação anterior: sem o contador de sequência,
   * `setColaboradores` era aplicado por qualquer resposta que chegasse.
   */
  it("resposta obsoleta da lista não sobrescreve a resposta do filtro atual", async () => {
    const atrasada = adiado<ResultadoPaginadoTeste<ColaboradorListadoApi>>();

    vi.mocked(listarColaboradores)
      // 1ª: carga inicial, resolve normalmente.
      .mockResolvedValueOnce(paginado([colaborador1, colaborador2]))
      // 2ª: filtro "Ativo" — fica PENDENTE de propósito.
      .mockImplementationOnce(() => atrasada.promessa)
      // 3ª: filtro "Inativo" — resolve antes da anterior.
      .mockResolvedValueOnce(paginado([colaborador2]));

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const filtro = screen.getByLabelText("Situação");
    fireEvent.change(filtro, { target: { value: "ativo" } });
    fireEvent.change(filtro, { target: { value: "inativo" } });

    // A terceira chamada já respondeu: só Bruno está na tela.
    await waitFor(() =>
      expect(screen.queryByText("Ana Colaboradora (teste)")).toBeNull(),
    );

    // Agora a resposta ATRASADA do filtro "Ativo" chega, trazendo Ana.
    atrasada.resolver(paginado([colaborador1]));

    // Ela precisa ser descartada: a tela continua mostrando o filtro atual.
    await waitFor(() =>
      expect(screen.getByText("Bruno Colaborador (teste)")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Ana Colaboradora (teste)")).toBeNull();
  });

  /**
   * D2. Abrir o detalhe de A, fechar, abrir o de B e a resposta atrasada de A
   * chegar depois: os vínculos de A não podem aparecer na ficha de B — é dado
   * de uma pessoa exibido na ficha de outra.
   *
   * Falha na implementação anterior: `setDetalhe` escrevia em `prev` sem
   * conferir de quem era a resposta.
   */
  it("vínculos de um colaborador não contaminam o detalhe de outro", async () => {
    const vinculoDeBruno: VinculoApi = {
      ...vinculo1,
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      colaboradorId: colaborador2.id,
      matricula: "MAT-0002",
    };

    const deAna = adiado<VinculoApi[]>();
    vi.mocked(listarVinculosDoColaborador).mockImplementation(
      (colaboradorId: string) =>
        colaboradorId === colaborador1.id
          ? deAna.promessa
          : Promise.resolve([vinculoDeBruno]),
    );

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linhaAna = screen
      .getByText("Ana Colaboradora (teste)")
      .closest("tr")!;
    fireEvent.click(
      within(linhaAna).getByRole("button", { name: /Abrir ficha/ }),
    );
    // Fecha o detalhe de Ana com a requisição dela ainda em voo.
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    const linhaBruno = screen
      .getByText("Bruno Colaborador (teste)")
      .closest("tr")!;
    fireEvent.click(
      within(linhaBruno).getByRole("button", { name: /Abrir ficha/ }),
    );

    const tabela = await screen.findByRole("table", {
      name: `Vínculos — ${colaborador2.nome}`,
    });
    expect(within(tabela).getByText("MAT-0002")).toBeInTheDocument();

    // A resposta atrasada de Ana chega AGORA, com o detalhe de Bruno aberto.
    deAna.resolver([vinculo1]);

    await waitFor(() =>
      expect(within(tabela).getByText("MAT-0002")).toBeInTheDocument(),
    );
    // A matrícula de Ana não pode ter entrado na ficha de Bruno.
    expect(within(tabela).queryByText("MAT-0001")).toBeNull();
  });

  /**
   * D3. `disabled` depende de um `setState`, que só chega no próximo render:
   * dois cliques no mesmo quadro escapam dele. A admissão já tinha trava
   * síncrona; salvar o nome no detalhe, não.
   *
   * Falha na implementação anterior: dois PATCH para um duplo clique.
   */
  it("duplo clique em salvar nome dispara uma única requisição", async () => {
    const patch = adiado<ColaboradorApi>();
    vi.mocked(retificarColaborador).mockImplementation(() => patch.promessa);

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Corrigida (teste)" },
    });

    // Os mocks não são limpos entre os testes deste arquivo: conta a partir
    // daqui, como já faz o teste de envio duplicado da admissão.
    const antes = vi.mocked(retificarColaborador).mock.calls.length;
    const salvar = screen.getByRole("button", { name: "Salvar nome" });

    // Os três cliques acontecem dentro do MESMO `act`, sem render entre eles —
    // é o que um duplo clique real faz. Com `fireEvent.click` o React
    // re-renderiza a cada evento, o botão já volta `disabled` e a corrida nunca
    // chega a existir: o teste mediria o `disabled`, não a trava síncrona.
    await act(async () => {
      salvar.click();
      salvar.click();
      salvar.click();
    });

    expect(
      vi.mocked(retificarColaborador).mock.calls.slice(antes),
    ).toHaveLength(1);
    patch.resolver({ ...colaborador1, nome: "Ana Corrigida (teste)" });
  });

  /**
   * D4. `dataAdmissao` é coluna `@db.Date`, mas o Prisma a devolve como `Date`:
   * chega ao navegador como datetime ISO completo. Dados contratuais
   * normalizava; Colaboradores e Histórico funcional exibiam cru — a mesma
   * admissão aparecia em formatos diferentes em telas diferentes.
   *
   * Falha na implementação anterior: a célula mostrava
   * "2026-01-05T00:00:00.000Z".
   *
   * T154: o dia passa a ser exibido em `DD/MM/AAAA`. O corte continua sendo
   * textual — nada de `new Date()` —, então `2026-01-05T00:00:00.000Z` vira
   * `05/01/2026` e não recua para 04/01 no fuso brasileiro.
   */
  it("exibe a data de admissão como dia brasileiro, no formato do servidor real", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      { ...vinculo1, dataAdmissao: "2026-01-05T00:00:00.000Z" },
    ]);

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));

    const tabela = await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });
    expect(within(tabela).getByText("05/01/2026")).toBeInTheDocument();
    expect(within(tabela).queryByText("2026-01-05")).toBeNull();
    expect(within(tabela).queryByText("2026-01-05T00:00:00.000Z")).toBeNull();
    // O dia NÃO recua: 05, nunca 04/01/2026.
    expect(within(tabela).queryByText("04/01/2026")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T164 — primeira fatia operacional: paginação real, total do servidor,
// data de cadastro e contexto de empresa.
//
// O defeito que esta fatia corrige é silencioso e por isso perigoso: a tela
// pedia a lista SEM página, recebia a primeira e descartava o `total`. A
// partir do vigésimo primeiro colaborador, as pessoas seguintes simplesmente
// não existiam na interface — e nada sugeria que houvesse mais. Uma lista que
// esconde registros é pior que uma vazia, porque parece completa.
// ---------------------------------------------------------------------------

/** Resposta paginada com página e total escolhidos — o servidor manda. */
function pagina<T>(
  itens: T[],
  paginaAtual: number,
  total: number,
): ResultadoPaginadoTeste<T> {
  // T178 — contadores do escopo fixos e diferentes do total e da página: a
  // tela os exibe como vieram, sem derivá-los.
  return {
    itens,
    pagina: paginaAtual,
    tamanhoPagina: 20,
    total,
    contadores: { ativos: 30, inativos: 15 },
  };
}

describe("T164 — paginação real", () => {
  it("pede a primeira página com tamanho explícito já na montagem", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(listarColaboradores).toHaveBeenCalledWith({
      pagina: 1,
      tamanhoPagina: 20,
    });
  });

  it("mostra a posição e avança para a página seguinte", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    // 45 registros em páginas de 20 são três páginas — a terceira com cinco.
    // Re-consultado a cada asserção: a referência capturada antes do
    // re-render aponta para um nó que o React já substituiu.
    const navegacao = () =>
      screen.getByRole("navigation", { name: "Paginação de colaboradores" });
    expect(navegacao()).toHaveTextContent("Página 1 de 3");

    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador2], 2, 45),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        pagina: 2,
        tamanhoPagina: 20,
      }),
    );
    await waitFor(() => expect(navegacao()).toHaveTextContent("Página 2 de 3"));
  });

  it("a posição vem da RESPOSTA, não do que a tela pediu", async () => {
    // Servidor devolve a página 1 embora a tela tenha pedido a 2 — pode
    // acontecer se o conjunto encolher entre uma leitura e outra. Guardar o
    // que foi pedido deixaria o rodapé mentindo sobre onde a pessoa está.
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 21),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 1 de 2"),
    );
  });

  it("nos extremos, o botão correspondente fica desabilitado", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 25),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    // `aria-disabled`, e nao `disabled`: um botao desabilitado de verdade sai
    // da ordem de tabulacao e PERDE o foco ao ser desabilitado — que e
    // exatamente o defeito da R-2. Inerte, mas focalizavel.
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Próxima página" }),
    ).toHaveAttribute("aria-disabled", "false");

    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador2], 2, 25),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Próxima página" }),
      ).toHaveAttribute("aria-disabled", "true"),
    );
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("com uma página só, não desenha navegação que não navega", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 2),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(
      screen.queryByRole("navigation", { name: "Paginação de colaboradores" }),
    ).not.toBeInTheDocument();
  });

  it("trocar de filtro volta para a página 1", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 3, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });

    // Sem isto, filtrar na página 3 pediria a página 3 de um conjunto que
    // talvez tenha uma só — e a lista vazia pareceria "nenhum ativo".
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        situacao: "ativo",
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
  });
});

describe("T164 — total, data e contexto de empresa", () => {
  it("mostra o total do SERVIDOR, não o tamanho da página", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    // Dois na tela, quarenta e cinco no conjunto. Exibir "2" como total faria
    // o número mentir sobre o tamanho da empresa.
    expect(
      await screen.findByText("45 colaboradores no filtro atual"),
    ).toBeInTheDocument();
  });

  it("concorda o singular quando há um só", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 1),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(
      await screen.findByText("1 colaborador no filtro atual"),
    ).toBeInTheDocument();
  });

  it("T178 — a admissão do vínculo principal aparece como dia brasileiro, nunca ISO", async () => {
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });

    // "Cadastrado em" saiu: a admissão agora vem do vínculo, na mesma resposta.
    expect(
      screen.queryByRole("columnheader", { name: "Cadastrado em" }),
    ).toBeNull();
    const linhaAna = within(tabela)
      .getByText("Ana Colaboradora (teste)")
      .closest("tr")!;
    expect(linhaAna).toHaveTextContent("10/01/2025");
    expectSemIsoVisivel(tabela);
  });

  it("nomeia a empresa ativa quando o shell a informa", async () => {
    render(
      <ColaboradoresScreen
        empresaAtiva={{ nome: "Empresa Demo Alfa", codigo: "DEMOALFA" }}
      />,
    );
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(
      screen.getByRole("heading", {
        name: "Colaboradores de Empresa Demo Alfa",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("(DEMOALFA)")).toBeInTheDocument();
  });

  it("sem empresa informada, não inventa nome", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(
      screen.getByRole("heading", { name: "Colaboradores desta empresa" }),
    ).toBeInTheDocument();
  });
});

describe("T164/T178 — o que a tabela promete, e a que custo", () => {
  /**
   * T178 — matrícula e admissão chegaram na MESMA resposta da lista (os
   * vínculos da empresa ativa), por isso viraram colunas. Cargo, departamento
   * e Banco de Horas continuam fora: a lotação não é resolvida pela listagem,
   * e coluna vazia ou montada por N+1 é promessa falsa.
   */
  it("colunas: Nome, Matrícula, Situação, Admissão e Ações — sem cargo nem departamento", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const cabecalhos = screen
      .getAllByRole("columnheader")
      .map((c) => c.textContent?.trim() ?? "");
    expect(cabecalhos).toEqual([
      "Nome",
      "Matrícula",
      "Situação",
      "Admissão",
      "Ações",
    ]);
  });

  it("não há botões de importar, exportar ou pedir preenchimento", async () => {
    render(<ColaboradoresScreen onNovaAdmissao={() => {}} />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    for (const termo of [/importar/i, /exportar/i, /preenchimento/i]) {
      expect(screen.queryByRole("button", { name: termo })).toBeNull();
    }
  });

  it("uma montagem da lista é UMA requisição — nada de N+1 por pessoa", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 2),
    );
    // Delta, e não total: este arquivo não limpa os mocks entre casos, então
    // um número absoluto mediria a suíte inteira em vez desta montagem.
    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    const antesVinculos = vi.mocked(listarVinculosDoColaborador).mock.calls
      .length;
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(vi.mocked(listarColaboradores).mock.calls.length - antes).toBe(1);
    // O vínculo só é lido quando alguém abre o detalhe de UMA pessoa — montar
    // a lista com duas não dispara nenhuma leitura de vínculo.
    expect(
      vi.mocked(listarVinculosDoColaborador).mock.calls.length - antesVinculos,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-1 e R-2 — ressalvas da revisão adversarial da PR #156.
//
// Os dois blocos abaixo FALHAM na versão anterior da tela: o primeiro porque
// a contagem de páginas usava uma constante local em vez do tamanho que o
// servidor aplicou; o segundo porque a navegação vivia dentro do ramo que
// desmonta durante o carregamento, levando o foco junto.
// ---------------------------------------------------------------------------

describe("R-1 — a contagem de páginas segue o tamanho que o SERVIDOR aplicou", () => {
  it("servidor servindo de 10 em 10: 45 registros são 5 páginas, não 3", async () => {
    // Pedimos 20 e o servidor aplicou 10. Contar com a constante daria
    // ceil(45/20) = 3 — e as páginas 4 e 5 ficariam inalcançáveis.
    vi.mocked(listarColaboradores).mockResolvedValue({
      itens: [colaborador1],
      pagina: 1,
      tamanhoPagina: 10,
      total: 45,
      contadores: { ativos: 30, inativos: 15 },
    });
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(
      screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
    ).toHaveTextContent("Página 1 de 5");
  });

  it("servidor servindo de 50 em 50: 45 registros são uma página só", async () => {
    // Com a constante, ceil(45/20) = 3 páginas — e as duas últimas voltariam
    // vazias, porque o servidor já mandou tudo na primeira.
    vi.mocked(listarColaboradores).mockResolvedValue({
      itens: [colaborador1, colaborador2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 45,
      contadores: { ativos: 30, inativos: 15 },
    });
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(
      screen.queryByRole("navigation", { name: "Paginação de colaboradores" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["ausente", undefined],
    ["zero", 0],
    ["negativo", -20],
    ["fracionário", 7.5],
    ["não numérico", "20"],
    ["não finito", Number.POSITIVE_INFINITY],
  ])(
    "tamanhoPagina %s cai no tamanho pedido, sem inventar paginação",
    async (_nome, valor) => {
      vi.mocked(listarColaboradores).mockResolvedValue({
        itens: [colaborador1],
        pagina: 1,
        tamanhoPagina: valor,
        total: 45,
        contadores: { ativos: 30, inativos: 15 },
      } as never);
      render(<ColaboradoresScreen />);
      await screen.findByRole("table", { name: "Colaboradores desta empresa" });

      // Volta ao tamanho que a tela pediu: ceil(45/20) = 3. Nunca Infinity,
      // NaN ou divisão por zero.
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 1 de 3");
    },
  );
});

describe("R-2 — trocar de página não derruba o foco", () => {
  /** Resolve a próxima listagem só quando quisermos — segura o carregamento. */
  function listagemControlada(
    resposta: ResultadoPaginadoTeste<ColaboradorListadoApi>,
  ) {
    let liberar!: () => void;
    const promessa = new Promise<ResultadoPaginadoTeste<ColaboradorListadoApi>>(
      (r) => {
        liberar = () => r(resposta);
      },
    );
    vi.mocked(listarColaboradores).mockReturnValue(promessa as never);
    return liberar;
  }

  it("a navegação NÃO desmonta durante o carregamento", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    // Enquanto a resposta não chega, a navegação continua na tela.
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveAttribute("aria-busy", "true"),
    );
    expect(
      screen.getByRole("button", { name: "Próxima página" }),
    ).toBeInTheDocument();

    liberar();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
  });

  it("o foco permanece no botão acionado — nunca cai no body", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const proxima = screen.getByRole("button", { name: "Próxima página" });
    proxima.focus();
    expect(document.activeElement).toBe(proxima);

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    fireEvent.click(proxima);

    // Durante o carregamento: o foco segue onde a pessoa o deixou.
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveAttribute("aria-busy", "true"),
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Próxima página" }),
    );

    liberar();
    // E depois do carregamento também.
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
    expect(document.activeElement).not.toBe(document.body);
  });

  it("durante o carregamento, acionar de novo NÃO dispara outra requisição", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    const proxima = screen.getByRole("button", { name: "Próxima página" });
    fireEvent.click(proxima);
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveAttribute("aria-busy", "true"),
    );

    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));

    // Inerte por `aria-disabled` + guarda em `irParaPagina`: o controle segue
    // focalizável, mas nenhuma ação nova atravessa.
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(antes);
    expect(
      screen.getByRole("button", { name: "Próxima página" }),
    ).toHaveAttribute("aria-disabled", "true");

    liberar();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
  });

  it("a posição anuncia o carregamento em vez de mentir a página antiga", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Carregando página…"),
    );

    liberar();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
  });
});

// ---------------------------------------------------------------------------
// T169 — contatos do colaborador, no detalhe.
//
// Valores sintéticos: domínio reservado `example.test` e números sem titular.
// ---------------------------------------------------------------------------
describe("ColaboradoresScreen (T169 — contatos do colaborador)", () => {
  const registrado: ContatosDoColaboradorApi = {
    colaboradorId: colaborador1.id,
    empresaId: "44444444-4444-4444-4444-444444444444",
    situacao: "registrado",
    contatos: {
      emailPessoal: "ana.contato@example.test",
      celular: "+5511987650001",
      telefone: "+551133330001",
      atualizadoEm: "2026-10-16T12:00:00.000Z",
    },
  };

  function gravacao(
    resultado: ContatosRegistradosApi["resultado"],
    contatos: ContatosRegistradosApi["contatos"],
  ): ContatosRegistradosApi {
    return { ...registrado, situacao: "registrado", resultado, contatos };
  }

  async function abrirDetalheDeAna() {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    return screen.findByRole("region", { name: "Contatos" });
  }

  const email = () => screen.getByLabelText(/^E-mail pessoal/);
  const celular = () => screen.getByLabelText(/^Celular/);
  const telefone = () => screen.getByLabelText(/^Telefone/);

  it("a lista não pede contatos: só o detalhe, pela rota própria e sem empresa", async () => {
    const antes = vi.mocked(consultarContatosDoColaborador).mock.calls.length;
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    expect(vi.mocked(consultarContatosDoColaborador).mock.calls.length).toBe(
      antes,
    );

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    await screen.findByRole("region", { name: "Contatos" });
    const chamadas = vi.mocked(consultarContatosDoColaborador).mock.calls;
    expect(chamadas[chamadas.length - 1]).toEqual([colaborador1.id]);
  });

  it("T179 — sem registro: três campos OPCIONAIS, vazios, com aviso — e sem erro", async () => {
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);

    for (const campo of [email(), celular(), telefone()]) {
      expect(campo).toHaveValue("");
      expect(campo).not.toHaveAttribute("aria-required");
      expect(campo).toHaveAccessibleName(/\(opcional\)$/);
      // O vazio mostra o estado: não informado.
      expect(campo).toHaveAttribute("placeholder", "Não informado");
    }
    expect(
      within(secao).queryAllByText("(obrigatório)", { exact: false }),
    ).toHaveLength(0);
    expect(within(secao).queryByRole("alert")).toBeNull();
  });

  it("T179 — registrado com contato nulo: o campo fica vazio, como 'Não informado'", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce({
      ...registrado,
      contatos: {
        emailPessoal: null,
        celular: "+5511987650001",
        telefone: null,
        atualizadoEm: "2026-10-16T12:00:00.000Z",
      },
    });
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("(11) 98765-0001"));
    expect(email()).toHaveValue("");
    expect(telefone()).toHaveValue("");
    expect(email()).toHaveAttribute("placeholder", "Não informado");
    expect(secao).not.toHaveTextContent("null");
    expect(within(secao).queryByText(/Nenhum contato registrado/)).toBeNull();
  });

  it("T179 — apagar um contato gravado envia null nele, e o resto como está", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("atualizado", {
        emailPessoal: "ana.contato@example.test",
        celular: "+5511987650001",
        telefone: null,
        atualizadoEm: "2026-10-16T12:00:00.000Z",
      }),
    );
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(telefone()).toHaveValue("(11) 3333-0001"));
    fireEvent.change(telefone(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    expect(chamadas[chamadas.length - 1]).toEqual([
      colaborador1.id,
      {
        emailPessoal: "ana.contato@example.test",
        celular: "+5511987650001",
        telefone: null,
      },
    ]);
    expect(telefone()).toHaveValue("");
  });

  it("T179 — só o celular, sem e-mail nem telefone, é salvo com os outros null", async () => {
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("criado", {
        emailPessoal: null,
        celular: "+5511987650001",
        telefone: null,
        atualizadoEm: "2026-10-16T12:00:00.000Z",
      }),
    );
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    fireEvent.change(celular(), { target: { value: "11987650001" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    expect(chamadas[chamadas.length - 1]).toEqual([
      colaborador1.id,
      { emailPessoal: null, celular: "+5511987650001", telefone: null },
    ]);
  });

  it("registrado: os campos chegam preenchidos com o valor gravado, telefones na máscara brasileira", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    await abrirDetalheDeAna();
    await waitFor(() =>
      expect(email()).toHaveValue("ana.contato@example.test"),
    );
    // T179 — gravados em `+55` + DDD + número; exibidos formatados.
    expect(celular()).toHaveValue("(11) 98765-0001");
    expect(telefone()).toHaveValue("(11) 3333-0001");
    // Nada a salvar enquanto nada mudou.
    expect(
      screen.getByRole("button", { name: "Salvar contatos" }),
    ).toBeDisabled();
  });

  it("bloqueado (desligado): nenhum valor nem campo, só o aviso", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce({
      ...registrado,
      situacao: "bloqueado",
      contatos: null,
    });
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/estão bloqueados/);
    expect(within(secao).queryByRole("textbox")).toBeNull();
    expect(
      within(secao).queryByRole("button", { name: "Salvar contatos" }),
    ).toBeNull();
  });

  // ---- T172 — o aviso da seção tem classe PRÓPRIA --------------------------
  //
  // `colaboradores-screen__aviso-texto` (T111) tem `flex: 1 1 16rem`, feito
  // para dividir a linha com o selo no banner. Dentro da seção Contatos, que é
  // uma coluna flex, o `flex-basis` virava ALTURA: o aviso ocupava 256 px e
  // abria um vão sob o texto. O jsdom não mede layout, então o teste prende o
  // que o causa — a classe — e o contrato de CSS (bloco no fim do arquivo)
  // prende o que a classe nova NÃO pode ter.

  it("T172 — sem registro: o aviso usa a classe própria e não a flexível da T111", async () => {
    const secao = await abrirDetalheDeAna();
    const aviso = await within(secao).findByText(/Nenhum contato registrado/);

    expect(aviso.tagName).toBe("P");
    expect(aviso).toHaveClass("colaboradores-screen__contatos-aviso");
    expect(aviso).not.toHaveClass("colaboradores-screen__aviso-texto");
    // Nada na seção inteira — incluindo o formulário — usa a classe da T111.
    expect(
      secao.querySelector(".colaboradores-screen__aviso-texto"),
    ).toBeNull();
    // T179 — o texto diz que os três são opcionais.
    expect(aviso).toHaveTextContent(
      "Nenhum contato registrado. Os três campos são opcionais: informe os que tiver.",
    );
    expect(email()).not.toHaveAttribute("aria-required");
  });

  it("T172 — bloqueado: o aviso usa a classe própria, mantém o status e não usa a da T111", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce({
      ...registrado,
      situacao: "bloqueado",
      contatos: null,
    });
    const secao = await abrirDetalheDeAna();
    const aviso = await within(secao).findByText(/estão bloqueados/);

    expect(aviso.tagName).toBe("P");
    expect(aviso).toHaveClass("colaboradores-screen__contatos-aviso");
    expect(aviso).not.toHaveClass("colaboradores-screen__aviso-texto");
    expect(
      secao.querySelector(".colaboradores-screen__aviso-texto"),
    ).toBeNull();
    // O anúncio para leitor de tela é o de antes.
    expect(aviso).toHaveAttribute("role", "status");
  });

  it("T172 — com contatos: não há aviso de vazio, e a seção segue sem a classe da T111", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    const secao = await abrirDetalheDeAna();
    await waitFor(() =>
      expect(email()).toHaveValue("ana.contato@example.test"),
    );

    expect(within(secao).queryByText(/Nenhum contato registrado/)).toBeNull();
    expect(
      secao.querySelector(".colaboradores-screen__contatos-aviso"),
    ).toBeNull();
    expect(
      secao.querySelector(".colaboradores-screen__aviso-texto"),
    ).toBeNull();
  });

  it("leitura recusada mostra o motivo e permite tentar de novo", async () => {
    vi.mocked(consultarContatosDoColaborador).mockRejectedValueOnce(
      recusa(403, "Acesso negado."),
    );
    const secao = await abrirDetalheDeAna();
    expect(await within(secao).findByRole("alert")).toHaveTextContent(
      "Seu perfil não tem acesso aos contatos deste colaborador.",
    );
    fireEvent.click(
      within(secao).getByRole("button", { name: "Tentar novamente" }),
    );
    await within(secao).findByText(/Nenhum contato registrado/);
  });

  it("T179 — sem registro, enviar vazio: pede ao menos um contato, sem erro nos campos, nada enviado", async () => {
    const antes = vi.mocked(registrarContatosDoColaborador).mock.calls.length;
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);

    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

    const alerta = await within(secao).findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Nenhum contato preenchido: informe ao menos um para salvar.",
    );
    expect(within(secao).queryByText(/é obrigatório/)).toBeNull();
    for (const campo of [email(), celular(), telefone()]) {
      expect(campo).not.toHaveAttribute("aria-invalid");
    }
    await waitFor(() => expect(document.activeElement).toBe(alerta));
    expect(vi.mocked(registrarContatosDoColaborador).mock.calls.length).toBe(
      antes,
    );
  });

  it("um campo inválido: erro só nele, foco nele, o resto preservado", async () => {
    await abrirDetalheDeAna();
    await screen.findByText(/Nenhum contato registrado/);
    fireEvent.change(email(), { target: { value: "ana@example.test" } });
    // T179 — a máscara só deixa entrar dígitos: o número fica incompleto.
    fireEvent.change(celular(), { target: { value: "11 9876-ABCD" } });
    expect(celular()).toHaveValue("(11) 9876");
    fireEvent.change(telefone(), { target: { value: "(11) 3333-0001" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

    expect(
      await screen.findByText(/Celular precisa do DDD e do número/),
    ).toBeInTheDocument();
    expect(email()).not.toHaveAttribute("aria-invalid");
    expect(telefone()).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(document.activeElement).toBe(celular()));
    expect(email()).toHaveValue("ana@example.test");
  });

  it("salvar envia os valores normalizados, confirma e mostra o que foi gravado", async () => {
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("criado", {
        emailPessoal: "ana@example.test",
        celular: "+5511987650001",
        telefone: "+551133330001",
        atualizadoEm: "2026-10-16T12:00:00.000Z",
      }),
    );
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    fireEvent.change(email(), { target: { value: "  Ana@EXAMPLE.test " } });
    fireEvent.change(celular(), { target: { value: "+55 (11) 98765-0001" } });
    fireEvent.change(telefone(), { target: { value: "(11) 3333-0001" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

    expect(await within(secao).findByText("Contatos salvos.")).toHaveAttribute(
      "role",
      "status",
    );
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    // Só o colaborador e os três campos — nenhuma empresa sai do navegador.
    expect(chamadas[chamadas.length - 1]).toEqual([
      colaborador1.id,
      {
        emailPessoal: "ana@example.test",
        celular: "+5511987650001",
        telefone: "+551133330001",
      },
    ]);
    expect(celular()).toHaveValue("(11) 98765-0001");
    expect(telefone()).toHaveValue("(11) 3333-0001");

    // Salvo: fechar não pede confirmação.
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
  });

  it("gravação recusada: mensagem geral, foco nela e os dados digitados ficam", async () => {
    vi.mocked(registrarContatosDoColaborador).mockRejectedValueOnce(
      recusa(409, "Conflito ao processar a requisição."),
    );
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    fireEvent.change(email(), { target: { value: "ana@example.test" } });
    fireEvent.change(celular(), { target: { value: "11987650001" } });
    fireEvent.change(telefone(), { target: { value: "1133330001" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

    const alerta = await within(secao).findByRole("alert");
    expect(alerta).toHaveTextContent(/Os contatos não foram salvos/);
    await waitFor(() => expect(document.activeElement).toBe(alerta));
    expect(email()).toHaveValue("ana@example.test");
    expect(celular()).toHaveValue("(11) 98765-0001");
    expect(telefone()).toHaveValue("(11) 3333-0001");
    expect(email()).not.toHaveAttribute("aria-invalid");
  });

  it("T179 — 409 de e-mail em uso: a mensagem vai para o campo, com foco, e nada se perde", async () => {
    vi.mocked(registrarContatosDoColaborador).mockRejectedValueOnce(
      Object.assign(recusa(409, "Conflito."), {
        erros: [{ campo: "emailPessoal", motivo: "em_uso" }],
      }),
    );
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    fireEvent.change(email(), { target: { value: "repetido@example.test" } });
    fireEvent.change(celular(), { target: { value: "11987650001" } });
    fireEvent.change(telefone(), { target: { value: "1133330001" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

    await waitFor(() => expect(email()).toHaveFocus());
    expect(email()).toHaveAttribute("aria-invalid", "true");
    expect(email()).toHaveAccessibleDescription(
      "Este e-mail pessoal já está em uso nesta empresa.",
    );
    // A mensagem não repete o valor, e não há mensagem geral de bloqueio.
    expect(within(secao).queryByText(/não foram salvos/)).toBeNull();
    expect(email()).toHaveValue("repetido@example.test");
    expect(celular()).toHaveValue("(11) 98765-0001");
  });

  it("T179 — celular e telefone com máscara brasileira, dica de formato e colagem com +55", async () => {
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    expect(celular()).toHaveAttribute("type", "tel");
    expect(celular()).toHaveAttribute("inputmode", "tel");
    expect(celular()).toHaveAccessibleDescription(/\(00\) 00000-0000/);
    expect(telefone()).toHaveAccessibleDescription(/\(00\) 0000-0000/);

    fireEvent.change(celular(), { target: { value: "1198765" } });
    expect(celular()).toHaveValue("(11) 9876-5");
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.paste(celular(), {
      clipboardData: { getData: () => "+55 11 98765-0001" },
    });
    expect(celular()).toHaveValue("(11) 98765-0001");
    fireEvent.change(telefone(), { target: { value: "551133330001" } });
    expect(telefone()).toHaveValue("(11) 3333-0001");
  });

  it("contato editado e não salvo: fechar pede confirmação; descartar fecha sem gravar", async () => {
    const antes = vi.mocked(registrarContatosDoColaborador).mock.calls.length;
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    await abrirDetalheDeAna();
    await waitFor(() =>
      expect(email()).toHaveValue("ana.contato@example.test"),
    );

    fireEvent.change(telefone(), { target: { value: "1133330002" } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(telefone()).toHaveValue("(11) 3333-0002");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Contatos" })).toBeNull(),
    );
    expect(vi.mocked(registrarContatosDoColaborador).mock.calls.length).toBe(
      antes,
    );
  });

  it("durante a gravação, a janela não fecha", async () => {
    let concluir: (v: ContatosRegistradosApi) => void = () => {};
    vi.mocked(registrarContatosDoColaborador).mockImplementationOnce(
      () =>
        new Promise<ContatosRegistradosApi>((resolve) => {
          concluir = resolve;
        }),
    );
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    fireEvent.change(email(), { target: { value: "ana@example.test" } });
    fireEvent.change(celular(), { target: { value: "11987650001" } });
    fireEvent.change(telefone(), { target: { value: "1133330001" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

    await within(secao).findByRole("button", { name: "Salvando…" });
    // A janela fica TRAVADA, não apenas pedindo confirmação: "Fechar" está
    // desabilitado e clicar nele não abre o diálogo de descarte nem fecha.
    // (Sem a trava, o mesmo clique abriria a confirmação — há edição não
    // salva —, e o teste falharia aqui.)
    const fechar = screen.getByRole("button", { name: "Fechar" });
    expect(fechar).toBeDisabled();
    fireEvent.click(fechar);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    expect(
      screen.getByRole("region", { name: "Contatos" }),
    ).toBeInTheDocument();

    await act(async () => {
      concluir(
        gravacao("criado", {
          emailPessoal: "ana@example.test",
          celular: "11987650001",
          telefone: "1133330001",
          atualizadoEm: "2026-10-16T12:00:00.000Z",
        }),
      );
    });
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T172 — contrato de CSS da seção Contatos (jsdom não mede layout)
//
// O vão de 256 px nasceu de uma regra de CSS, não de lógica. Estes casos
// prendem a regra: a classe própria do aviso NÃO pode ter nenhuma propriedade
// `flex*` (com `flex-basis` numa coluna flex, ela voltaria a virar altura), e a
// regra compartilhada da T111 NÃO pode ter sido alterada para consertar o
// problema por cima dela.
// ---------------------------------------------------------------------------
describe("T172 — contrato de CSS da seção Contatos", () => {
  // Caminho relativo à raiz do pacote, como nos demais testes de CSS:
  // `import.meta.url` não é um URL `file:` sob esta configuração do Vitest.
  const css = readFileSync(
    "src/screens/pessoas/ColaboradoresScreen.css",
    "utf8",
  );

  /** Corpo da regra cujo seletor é exatamente `seletor`, ou `null`. */
  function corpoDaRegra(seletor: string): string | null {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
      "m",
    ).exec(css);
    return m ? (m[1] ?? "") : null;
  }

  it("a classe própria do aviso existe e não tem nenhuma propriedade flex", () => {
    const corpo = corpoDaRegra(".colaboradores-screen__contatos-aviso");
    expect(corpo).not.toBeNull();
    expect(corpo).not.toMatch(/(?:^|[;\s])flex(?:-grow|-basis|-shrink)?\s*:/);
    expect(corpo).not.toMatch(/(?:^|[;\s])height\s*:|min-height\s*:/);
  });

  it("a classe própria usa só token de cor e não define margem além de zero", () => {
    const corpo = corpoDaRegra(".colaboradores-screen__contatos-aviso") ?? "";
    expect(corpo).toMatch(/color:\s*var\(--/);
    expect(corpo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(corpo).toMatch(/margin:\s*0\s*;/);
  });

  it("a regra compartilhada da T111 continua intacta, com o flex que ela sempre teve", () => {
    const corpo = corpoDaRegra(".colaboradores-screen__aviso-texto");
    expect(corpo).not.toBeNull();
    expect(corpo).toMatch(/flex:\s*1\s+1\s+16rem\s*;/);
    expect(corpo).toMatch(/color:\s*var\(--color-ink\)\s*;/);
  });

  it("a seção e o formulário de Contatos continuam colunas flex, que é o que explica o vão", () => {
    // Documenta a premissa do defeito: se a seção deixasse de ser coluna flex, a
    // classe flexível não abriria vão, e a regra própria perderia o motivo.
    const m =
      /\.colaboradores-screen__contatos,\s*\.colaboradores-screen__contatos-form\s*\{([^}]*)\}/.exec(
        css,
      );
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/display:\s*flex/);
    expect(m?.[1]).toMatch(/flex-direction:\s*column/);
  });
});

// ---------------------------------------------------------------------------
// T178 — Colaboradores como porta principal de Gestão de Pessoas: colunas do
// vínculo principal, busca no servidor, contadores do escopo, estados vazios
// distintos e a ficha aberta a partir da linha.
// ---------------------------------------------------------------------------

/** Colaborador da listagem com os vínculos dados (já na ordem do servidor). */
function listado(
  base: Partial<ColaboradorListadoApi> & { id: string; nome: string },
  vinculos: ColaboradorListadoApi["vinculos"] = [],
): ColaboradorListadoApi {
  return {
    situacao: "ativo",
    criadoEm: "2026-01-01T12:00:00.000Z",
    atualizadoEm: "2026-01-01T12:00:00.000Z",
    ...base,
    vinculos,
  };
}

function vinculoListado(
  id: string,
  matricula: string,
  situacao: "previsto" | "ativo" | "encerrado",
  dataAdmissao: string,
): ColaboradorListadoApi["vinculos"][number] {
  return {
    id,
    empresaId: "44444444-4444-4444-4444-444444444444",
    matricula,
    situacao,
    dataAdmissao,
    dataDesligamento: situacao === "encerrado" ? "2025-12-31" : null,
  };
}

const campoBusca = () =>
  screen.getByRole("searchbox", { name: "Buscar por nome ou matrícula" });

function buscar(termo: string) {
  fireEvent.change(campoBusca(), { target: { value: termo } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

describe("T178 — colunas e vínculo principal", () => {
  it("T179 — matrícula nula aparece como 'Sem matrícula', na lista e na ficha", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        {
          ...colaborador1,
          vinculos: [{ ...colaborador1.vinculos[0]!, matricula: null }],
        },
        colaborador2,
      ]),
    );
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      { ...vinculo1, matricula: null },
    ]);
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });
    const ana = within(tabela).getByText(colaborador1.nome).closest("tr")!;
    expect(within(ana).getAllByRole("cell")[1]).toHaveTextContent(
      "Sem matrícula",
    );
    expect(tabela).not.toHaveTextContent("null");

    fireEvent.click(within(ana).getByRole("button", { name: /Abrir ficha/ }));
    const vinculos = await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });
    expect(within(vinculos).getByText("Sem matrícula")).toBeInTheDocument();
    expect(vinculos).not.toHaveTextContent("null");
  });

  it("cada linha mostra nome, matrícula, situação e admissão do vínculo principal", async () => {
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });

    const ana = within(tabela).getByText(colaborador1.nome).closest("tr")!;
    const celulasAna = within(ana).getAllByRole("cell");
    expect(celulasAna[0]).toHaveTextContent(colaborador1.nome);
    expect(celulasAna[1]).toHaveTextContent("MAT-0001");
    expect(celulasAna[2]).toHaveTextContent("Ativo");
    expect(celulasAna[3]).toHaveTextContent("10/01/2025");

    // Sem vínculo na empresa ativa: traço, nunca dado inventado.
    const bruno = within(tabela).getByText(colaborador2.nome).closest("tr")!;
    const celulasBruno = within(bruno).getAllByRole("cell");
    expect(celulasBruno[1]).toHaveTextContent("—");
    expect(celulasBruno[2]).toHaveTextContent("Inativo");
    expect(celulasBruno[3]).toHaveTextContent("—");
  });

  it("com mais de um vínculo, mostra o principal e '+N' com frase acessível", async () => {
    const carla = listado(
      {
        id: "55555555-5555-4555-8555-555555555555",
        nome: "Carla Dois Vínculos",
      },
      [
        vinculoListado(
          "v-2",
          "DEMO-A-0002",
          "ativo",
          "2026-03-02T00:00:00.000Z",
        ),
        vinculoListado(
          "v-1",
          "DEMO-A-0001",
          "encerrado",
          "2024-02-01T00:00:00.000Z",
        ),
      ],
    );
    const davi = listado(
      {
        id: "66666666-6666-4666-8666-666666666666",
        nome: "Davi Três Vínculos",
      },
      [
        vinculoListado(
          "v-5",
          "DEMO-B-0005",
          "previsto",
          "2026-11-01T00:00:00.000Z",
        ),
        vinculoListado(
          "v-4",
          "DEMO-B-0004",
          "encerrado",
          "2025-01-01T00:00:00.000Z",
        ),
        vinculoListado(
          "v-3",
          "DEMO-B-0003",
          "encerrado",
          "2023-01-01T00:00:00.000Z",
        ),
      ],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([carla, davi]));
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });

    const linhaCarla = within(tabela)
      .getByText("Carla Dois Vínculos")
      .closest("tr")!;
    const celulaCarla = within(linhaCarla).getAllByRole("cell")[1]!;
    // O principal é o PRIMEIRO da resposta — o cliente não reordena.
    expect(celulaCarla).toHaveTextContent("DEMO-A-0002");
    expect(celulaCarla).not.toHaveTextContent("DEMO-A-0001");
    expect(within(celulaCarla).getByText("+1")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(within(celulaCarla).getByText("e mais 1 vínculo")).toHaveClass(
      "sr-only",
    );
    // A admissão é a do vínculo principal.
    expect(linhaCarla).toHaveTextContent("02/03/2026");

    const linhaDavi = within(tabela)
      .getByText("Davi Três Vínculos")
      .closest("tr")!;
    const celulaDavi = within(linhaDavi).getAllByRole("cell")[1]!;
    expect(celulaDavi).toHaveTextContent("DEMO-B-0005");
    expect(
      within(celulaDavi).getByText("e mais 2 vínculos"),
    ).toBeInTheDocument();
  });
});

describe("T178 — busca por nome ou matrícula, no servidor", () => {
  it("o campo é rotulado e fica num formulário de busca", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const formulario = screen.getByRole("search", {
      name: "Buscar colaboradores",
    });
    expect(within(formulario).getByRole("searchbox")).toBe(campoBusca());
    expect(campoBusca()).toHaveAttribute("maxLength", "160");
    // Sem termo, não há o que limpar.
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
  });

  it("envia o termo aparado, na página 1, e nunca filtra a página no cliente", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    // O servidor devolve só Bruno; a tela mostra o que ele mandou.
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([colaborador2]));
    buscar("  bruno  ");

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        busca: "bruno",
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
    expect(campoBusca()).toHaveValue("bruno");
    await waitFor(() =>
      expect(screen.queryByText(colaborador1.nome)).toBeNull(),
    );
    expect(screen.getByText(colaborador2.nome)).toBeInTheDocument();
  });

  it("digitar não consulta: só enviar consulta", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    const antes = vi.mocked(listarColaboradores).mock.calls.length;

    fireEvent.change(campoBusca(), { target: { value: "an" } });
    fireEvent.change(campoBusca(), { target: { value: "ana" } });

    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(antes);
  });

  it("convive com os filtros e, buscando na página 3, volta à página 1", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 3, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        situacao: "ativo",
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    buscar("MAT-00");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        situacao: "ativo",
        busca: "MAT-00",
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
  });

  it("só espaços é 'sem busca': a chave nem vai ao servidor", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    buscar("     ");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
    expect(campoBusca()).toHaveValue("");
  });

  it("termo acima de 160 caracteres vai cortado no teto do servidor", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    buscar("a".repeat(200));
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        busca: "a".repeat(160),
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
  });

  it("'Limpar busca' volta ao conjunto inteiro e devolve o foco ao campo", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    buscar("ana");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        busca: "ana",
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
    expect(campoBusca()).toHaveValue("");
    expect(campoBusca()).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
  });

  it("resposta obsoleta de uma busca não sobrescreve a da busca atual", async () => {
    const atrasada = adiado<ResultadoPaginadoTeste<ColaboradorListadoApi>>();
    vi.mocked(listarColaboradores)
      .mockResolvedValueOnce(paginado([colaborador1, colaborador2]))
      .mockImplementationOnce(() => atrasada.promessa)
      .mockResolvedValueOnce({
        ...paginado([colaborador2]),
        contadores: { ativos: 7, inativos: 2 },
      });

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    buscar("ana");
    buscar("bruno");

    await waitFor(() =>
      expect(screen.queryByText(colaborador1.nome)).toBeNull(),
    );
    expect(screen.getByText(colaborador2.nome)).toBeInTheDocument();

    // A busca "ana" responde AGORA, depois da "bruno": é descartada inteira —
    // linhas e contadores.
    await act(async () => {
      atrasada.resolver({
        ...paginado([colaborador1]),
        contadores: { ativos: 99, inativos: 99 },
      });
    });
    expect(screen.queryByText(colaborador1.nome)).toBeNull();
    expect(screen.getByText(colaborador2.nome)).toBeInTheDocument();
    const contadores = screen.getByRole("group", { name: /sem filtros/ });
    expect(within(contadores).getByText("7")).toBeInTheDocument();
    expect(within(contadores).queryByText("99")).toBeNull();
  });
});

describe("T178 — estados vazios distintos", () => {
  it("empresa sem colaborador: título claro e 'Nova admissão' para quem pode", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    const onNovaAdmissao = vi.fn();
    render(<ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} />);

    const titulo = await screen.findByRole("heading", {
      name: "Nenhum colaborador cadastrado nesta empresa",
    });
    const vazio = titulo.closest(".evolli-empty-state") as HTMLElement;
    fireEvent.click(
      within(vazio).getByRole("button", { name: "Nova admissão" }),
    );
    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Limpar busca e filtros" }),
    ).toBeNull();
  });

  it("busca sem resultado: 'Nenhum colaborador encontrado', com o termo, sem oferecer admissão", async () => {
    render(<ColaboradoresScreen onNovaAdmissao={() => {}} />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    // A empresa tem gente (contadores > 0); a busca é que não achou.
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([]),
      contadores: { ativos: 3, inativos: 1 },
    });
    buscar("zzz-inexistente");

    const titulo = await screen.findByRole("heading", {
      name: "Nenhum colaborador encontrado",
    });
    const vazio = titulo.closest(".evolli-empty-state") as HTMLElement;
    expect(vazio).toHaveTextContent("zzz-inexistente");
    expect(
      within(vazio).queryByRole("button", { name: "Nova admissão" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Nenhum colaborador cadastrado nesta empresa",
      }),
    ).toBeNull();
  });

  it("'Limpar busca e filtros' zera busca e filtros e relê o conjunto inteiro", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([]),
      contadores: { ativos: 3, inativos: 1 },
    });
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "inativo" },
    });
    await screen.findByRole("heading", {
      name: "Nenhum colaborador encontrado",
    });
    expect(
      screen.getByText(
        "Nenhum colaborador corresponde aos filtros selecionados.",
      ),
    ).toBeInTheDocument();
    buscar("ana");
    await screen.findByText(/corresponde a “ana” com os filtros selecionados/);

    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([colaborador1, colaborador2]),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Limpar busca e filtros" }),
    );

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith({
        pagina: 1,
        tamanhoPagina: 20,
      }),
    );
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    expect(screen.getByLabelText("Situação")).toHaveValue("todos");
    expect(campoBusca()).toHaveValue("");
  });
});

describe("T178 — contadores do escopo, do servidor", () => {
  it("vêm de `contadores` da resposta, não da página", async () => {
    // Dois na página (um ativo, um inativo); o escopo tem 30 e 15.
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const grupo = screen.getByRole("group", {
      name: "No seu escopo, sem filtros",
    });
    const termos = within(grupo)
      .getAllByRole("term")
      .map((t) => t.textContent);
    const valores = within(grupo)
      .getAllByRole("definition")
      .map((d) => d.textContent);
    expect(termos).toEqual(["Ativos", "Inativos"]);
    expect(valores).toEqual(["30", "15"]);
  });

  it("com empresa ativa, o rótulo diz que é da empresa ativa", async () => {
    render(
      <ColaboradoresScreen
        empresaAtiva={{ nome: "Empresa Demo Alfa", codigo: "DEMOALFA" }}
      />,
    );
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    expect(
      screen.getByRole("group", { name: "Na empresa ativa, sem filtros" }),
    ).toBeInTheDocument();
  });

  it("antes da primeira resposta, reticências — nunca zero inventado", async () => {
    const pendente = adiado<ResultadoPaginadoTeste<ColaboradorListadoApi>>();
    vi.mocked(listarColaboradores).mockImplementationOnce(
      () => pendente.promessa,
    );
    render(<ColaboradoresScreen />);

    const grupo = screen.getByRole("group", { name: /sem filtros/ });
    expect(
      within(grupo)
        .getAllByRole("definition")
        .map((d) => d.textContent),
    ).toEqual(["…", "…"]);
    expect(within(grupo).queryByText("0")).toBeNull();

    await act(async () => {
      pendente.resolver(paginado([colaborador1]));
    });
    expect(
      within(screen.getByRole("group", { name: /sem filtros/ }))
        .getAllByRole("definition")
        .map((d) => d.textContent),
    ).toEqual(["1", "0"]);
  });

  it("ficam no cabeçalho da página, sem região viva própria", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const grupo = screen.getByRole("group", { name: /sem filtros/ });
    expect(grupo.closest(".evolli-page-header")).not.toBeNull();
    expect(grupo.closest("[role=status]")).toBeNull();
    expect(grupo.querySelector("[role=status]")).toBeNull();
  });
});

describe("T178 — 'Nova admissão' e a ficha a partir da linha", () => {
  it("'Nova admissão' é a ação principal, ao lado da busca", async () => {
    const onNovaAdmissao = vi.fn();
    render(<ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const botao = screen.getByRole("button", { name: "Nova admissão" });
    const barra = botao.closest(".colaboradores-screen__barra-acoes");
    expect(barra).not.toBeNull();
    expect(
      within(barra as HTMLElement).getByRole("search"),
    ).toBeInTheDocument();
    expect(botao).toHaveClass("evolli-button--primary");
    fireEvent.click(botao);
    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
  });

  it("'Abrir ficha' abre a ficha do colaborador da linha", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    fireEvent.click(
      screen.getByRole("button", {
        name: `Abrir ficha de ${colaborador2.nome}`,
      }),
    );

    const ficha = await screen.findByRole("dialog", {
      name: colaborador2.nome,
    });
    expect(listarVinculosDoColaborador).toHaveBeenLastCalledWith(
      colaborador2.id,
    );
    expect(within(ficha).getByLabelText("Nome")).toHaveValue(colaborador2.nome);
    // A situação da ficha é a da linha (na empresa ativa).
    expect(within(ficha).getByText("Inativo")).toBeInTheDocument();
  });

  it("retificar o nome troca só o nome: a situação na empresa e a matrícula ficam", async () => {
    const elisa = listado(
      {
        id: "77777777-7777-4777-8777-777777777777",
        nome: "Elisa Antes (teste)",
        situacao: "inativo",
      },
      [
        vinculoListado(
          "v-9",
          "MAT-0009",
          "encerrado",
          "2024-05-02T00:00:00.000Z",
        ),
      ],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([elisa]));
    // O PATCH devolve a situação GLOBAL — aqui "ativo", por outra empresa.
    vi.mocked(retificarColaborador).mockResolvedValueOnce({
      id: elisa.id,
      nome: "Elisa Depois (teste)",
      situacao: "ativo",
      criadoEm: elisa.criadoEm,
      atualizadoEm: "2026-10-20T12:00:00.000Z",
    });

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir ficha de Elisa Antes (teste)",
      }),
    );
    const ficha = await screen.findByRole("dialog", {
      name: "Elisa Antes (teste)",
    });
    fireEvent.change(within(ficha).getByLabelText("Nome"), {
      target: { value: "Elisa Depois (teste)" },
    });
    fireEvent.click(within(ficha).getByRole("button", { name: "Salvar nome" }));

    await screen.findByRole("heading", { name: "Elisa Depois (teste)" });
    const linha = within(
      screen.getByRole("table", { name: "Colaboradores desta empresa" }),
    )
      .getByText("Elisa Depois (teste)")
      .closest("tr")!;
    const celulas = within(linha).getAllByRole("cell");
    expect(celulas[1]).toHaveTextContent("MAT-0009");
    expect(celulas[2]).toHaveTextContent("Inativo");
    // A ficha aberta também segue com a situação da linha.
    expect(
      within(screen.getByRole("dialog")).getByText("Inativo"),
    ).toBeInTheDocument();
  });

  it("cada montagem relê o servidor: nada de lista guardada entre montagens", async () => {
    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    const { unmount } = render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    unmount();

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    expect(vi.mocked(listarColaboradores).mock.calls.length - antes).toBe(2);
  });
});
