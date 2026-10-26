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
import { diaDeHoje, proximoDiaCivil } from "./jornadaColaborador";
import { listarVinculosHorario } from "../../api/vinculoHorarioClient";
import { listarTabelasHorario } from "../../api/horariosClient";
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
import {
  CsrfRequestError,
  CsrfSessionExpiredError,
} from "../../api/csrfClient";
import {
  type DadosPessoaisDoColaboradorApi,
  consultarDadosPessoaisDoColaborador,
  registrarDadosPessoaisDoColaborador,
} from "../../api/dadosPessoaisClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";
import { AVISO_DE_RECUSA } from "../../format/mascaras";

vi.mock("../../api/colaboradoresClient");
// T183 — a seção "Jornada de trabalho" da ficha lê os vínculos de horário.
vi.mock("../../api/vinculoHorarioClient");
vi.mock("../../api/horariosClient");
vi.mock("../../api/contatosColaboradorClient");
// T181 — a ficha edita dados pessoais e endereço pela rota própria.
vi.mock("../../api/dadosPessoaisClient");

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

/** T184 — lotação vigente de um vínculo ativo (cargo e departamento). */
const LOTACAO_ATIVA = {
  cargo: { id: "c-1", codigo: "ANALISTA", nome: "Analista (teste)" },
  departamento: { id: "d-1", codigo: "ADM", nome: "Administrativo (teste)" },
};

/** T185 — jornada vigente desde sempre, sem término. */
const JORNADA_VIGENTE = {
  vigenciaInicio: "2020-01-01",
  vigenciaFim: null,
  jornada: {
    id: "j-1",
    codigo: "COMERCIAL_44H",
    nome: "Comercial 44 horas (teste)",
    ativo: true,
  },
};

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
      lotacaoVigente: LOTACAO_ATIVA,
      vigenciasDeJornada: [JORNADA_VIGENTE],
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
  vi.mocked(listarVinculosHorario).mockResolvedValue({
    itens: [],
    pagina: 1,
    tamanhoPagina: 100,
    total: 0,
  });
  vi.mocked(listarTabelasHorario).mockResolvedValue({
    itens: [],
    pagina: 1,
    tamanhoPagina: 100,
    total: 0,
  });
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
  // T181 — por padrão, dados pessoais e endereço gravados (sintéticos).
  vi.mocked(consultarDadosPessoaisDoColaborador).mockImplementation(
    async (colaboradorId) => dadosPessoaisDe(colaboradorId),
  );
});

function dadosPessoaisDe(colaboradorId: string): DadosPessoaisDoColaboradorApi {
  return {
    colaboradorId,
    empresaId: "44444444-4444-4444-4444-444444444444",
    situacao: "registrado",
    perfilPessoal: {
      dataNascimento: "1990-05-20",
      sexo: null,
      saudacao: null,
      estadoCivil: null,
      nacionalidade: null,
      naturalidade: null,
      escolaridade: null,
      curso: null,
      nomePai: null,
      nomeMae: null,
      atualizadoEm: "2026-10-20T12:00:00.000Z",
    },
    endereco: {
      pais: "Brasil",
      cep: "30140071",
      logradouro: "Rua Sintética",
      numero: "10",
      complemento: null,
      bairro: "Centro",
      cidade: "Cidade Sintética",
      estado: "MG",
      atualizadoEm: "2026-10-20T12:00:00.000Z",
    },
  };
}

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
  it("colunas: Nome, Matrícula, Cargo, Departamento, Jornada de trabalho, Situação, Admissão e Ações (T185)", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const cabecalhos = screen
      .getAllByRole("columnheader")
      .map((c) => c.textContent?.trim() ?? "");
    expect(cabecalhos).toEqual([
      "Nome",
      "Matrícula",
      "Cargo",
      "Departamento",
      "Jornada de trabalho",
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
    render(<ColaboradoresScreen podeEditarFicha />);
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
    render(<ColaboradoresScreen podeEditarFicha />);
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
    // T179 — o texto diz que não há contato cadastrado e que os três são
    // opcionais.
    expect(aviso).toHaveTextContent(
      "Nenhum contato registrado. Este colaborador não tem e-mail pessoal, celular nem telefone cadastrados. Os três campos são opcionais: informe os que tiver.",
    );
    expect(email()).not.toHaveAttribute("aria-required");
  });

  it("T179 — 'Nenhum contato registrado' é estado acessível: status, descrição da seção e nenhum erro", async () => {
    const secao = await abrirDetalheDeAna();
    const estado = await within(secao).findByText(/Nenhum contato registrado/);
    expect(estado).toHaveAttribute("role", "status");
    expect(estado).toHaveTextContent(/^Nenhum contato registrado\./);
    expect(estado).toHaveTextContent(
      "não tem e-mail pessoal, celular nem telefone cadastrados",
    );
    // A seção aponta para o estado: o leitor de tela o ouve com o título.
    expect(secao).toHaveAccessibleDescription(
      "Nenhum contato registrado. Este colaborador não tem e-mail pessoal, celular nem telefone cadastrados. Os três campos são opcionais: informe os que tiver.",
    );
    // Estado, não erro: nada de alerta nem campo inválido.
    expect(within(secao).queryByRole("alert")).toBeNull();
    for (const campo of [email(), celular(), telefone()]) {
      expect(campo).not.toHaveAttribute("aria-invalid", "true");
    }
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
    // T179 — o número fica incompleto. (Letras nem entram: a máscara as
    // recusa — ver "T179 (revisão final)".)
    fireEvent.change(celular(), { target: { value: "11 9876" } });
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

  // T179 (revisão final) — sessão expirada e falha ao preparar o envio têm
  // mensagem própria; o 403 sem código continua sendo de permissão.
  it.each([
    [
      "401",
      () => recusa(401, "Não autenticado."),
      "Sua sessão expirou e os contatos não foram salvos. Entre de novo para continuar; os dados digitados foram mantidos nesta ficha.",
    ],
    [
      "CsrfSessionExpiredError",
      () => new CsrfSessionExpiredError(),
      "Sua sessão expirou e os contatos não foram salvos. Entre de novo para continuar; os dados digitados foram mantidos nesta ficha.",
    ],
    [
      "403 csrf_invalido",
      () =>
        Object.assign(recusa(403, "Token CSRF inválido."), {
          codigo: "csrf_invalido",
        }),
      // T179 (revisão definitiva) — sessão válida, token desta aba renovado
      // por outra: página desatualizada, não sessão expirada.
      "Esta página ficou desatualizada. Salve novamente; seus dados foram mantidos.",
    ],
    [
      "403 sem código",
      () => recusa(403, "Proibido."),
      "Seu perfil não tem permissão para alterar contatos. Nada foi salvo.",
    ],
    [
      "CsrfRequestError",
      () => new CsrfRequestError("Não foi possível obter o token CSRF."),
      "Não foi possível preparar o envio e os contatos não foram salvos. Confira a conexão e salve de novo.",
    ],
  ])(
    "T179 — gravação recusada por %s: mensagem certa, foco nela e os dados ficam",
    async (_, erro, mensagem) => {
      vi.mocked(registrarContatosDoColaborador).mockRejectedValueOnce(erro());
      const secao = await abrirDetalheDeAna();
      await within(secao).findByText(/Nenhum contato registrado/);
      fireEvent.change(email(), { target: { value: "ana@example.test" } });
      fireEvent.change(celular(), { target: { value: "11987650001" } });

      fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

      const alerta = await within(secao).findByRole("alert");
      expect(alerta).toHaveTextContent(mensagem);
      await waitFor(() => expect(document.activeElement).toBe(alerta));
      expect(email()).toHaveValue("ana@example.test");
      expect(celular()).toHaveValue("(11) 98765-0001");
    },
  );

  // T181 — rede ou 5xx: o servidor pode ter gravado. A mensagem não afirma
  // nem nega, e o que foi digitado fica.
  it.each([
    ["rede", () => new TypeError("Failed to fetch")],
    ["500", () => recusa(500, "Erro interno.")],
    ["503", () => recusa(503, "Indisponível.")],
  ])(
    "T181 — gravação sem resposta certa (%s): não afirma nem nega, e os dados ficam",
    async (_, erro) => {
      vi.mocked(registrarContatosDoColaborador).mockRejectedValueOnce(erro());
      const secao = await abrirDetalheDeAna();
      await within(secao).findByText(/Nenhum contato registrado/);
      fireEvent.change(email(), { target: { value: "ana@example.test" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
      const alerta = await within(secao).findByRole("alert");
      expect(alerta).toHaveTextContent(
        "Não foi possível confirmar se os contatos foram salvos. O que você digitou foi mantido; salvar de novo é seguro.",
      );
      expect(alerta).not.toHaveTextContent(/não foram salvos/);
      expect(email()).toHaveValue("ana@example.test");
    },
  );

  it("T181 — Cancelar volta aos contatos gravados, sem enviar nada", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    const antes = vi.mocked(registrarContatosDoColaborador).mock.calls.length;
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("(11) 98765-0001"));
    const cancelar = within(secao).getByRole("button", { name: "Cancelar" });
    // Nada digitado: nada a descartar.
    expect(cancelar).toBeDisabled();
    fireEvent.change(email(), { target: { value: "outro@example.test" } });
    fireEvent.change(celular(), { target: { value: "" } });
    expect(cancelar).toBeEnabled();
    fireEvent.click(cancelar);
    expect(email()).toHaveValue("ana.contato@example.test");
    expect(celular()).toHaveValue("(11) 98765-0001");
    expect(email()).toHaveFocus();
    expect(cancelar).toBeDisabled();
    expect(vi.mocked(registrarContatosDoColaborador).mock.calls.length).toBe(
      antes,
    );
  });

  it("T181 — sem registro, Cancelar limpa o digitado e o estado 'Nenhum contato registrado' continua", async () => {
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    fireEvent.change(celular(), { target: { value: "11987650001" } });
    fireEvent.click(within(secao).getByRole("button", { name: "Cancelar" }));
    expect(celular()).toHaveValue("");
    expect(
      within(secao).getByText(/Nenhum contato registrado/),
    ).toBeInTheDocument();
  });

  it("T179 (revisão definitiva) — 403 csrf_invalido (outra aba renovou o token): página desatualizada; salvar de novo conclui com os mesmos dados", async () => {
    vi.mocked(registrarContatosDoColaborador)
      .mockRejectedValueOnce(
        Object.assign(recusa(403, "Token CSRF inválido."), {
          codigo: "csrf_invalido",
        }),
      )
      .mockResolvedValueOnce(
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
    const alerta = await within(secao).findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Esta página ficou desatualizada. Salve novamente; seus dados foram mantidos.",
    );
    expect(alerta).not.toHaveTextContent(/sessão expirou/);
    expect(celular()).toHaveValue("(11) 98765-0001");
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    await within(secao).findByText("Contatos salvos.");
    // As duas últimas chamadas (a recusada e a que concluiu) levam o mesmo
    // corpo: nada se perdeu entre elas.
    const [recusada, concluida] = vi
      .mocked(registrarContatosDoColaborador)
      .mock.calls.slice(-2);
    expect(concluida).toEqual(recusada);
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
    // T179 (revisão final) — o erro vem primeiro; sem registro, o estado
    // "Nenhum contato registrado" segue junto na descrição do primeiro campo.
    expect(email()).toHaveAccessibleDescription(
      /^Este e-mail pessoal já está em uso nesta empresa\. Nenhum contato registrado\./,
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

  // -------------------------------------------------------------------------
  // T179 (revisão final) — remover todos os contatos e o estado único
  // "Nenhum contato registrado", também na descrição do primeiro campo.
  // -------------------------------------------------------------------------

  function removido(): ContatosRegistradosApi {
    return {
      colaboradorId: colaborador1.id,
      empresaId: "44444444-4444-4444-4444-444444444444",
      situacao: "sem_registro",
      contatos: null,
      resultado: "removido",
    };
  }

  it("T179 — com registro, limpar os três e salvar REMOVE: 'Contatos removidos.' e o estado sem registro", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(removido());
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("(11) 98765-0001"));
    expect(within(secao).queryByText(/Nenhum contato registrado/)).toBeNull();

    fireEvent.change(email(), { target: { value: "" } });
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.change(telefone(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));

    expect(
      await within(secao).findByText("Contatos removidos."),
    ).toHaveAttribute("role", "status");
    // Nenhuma validação local barrou a remoção: os três foram como null.
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    expect(chamadas[chamadas.length - 1]).toEqual([
      colaborador1.id,
      { emailPessoal: null, celular: null, telefone: null },
    ]);

    const estado = within(secao).getByText(/Nenhum contato registrado/);
    expect(estado).toHaveAttribute("role", "status");
    expect(estado).toHaveAttribute("id", "contatos-colaborador-sem-registro");
    expect(secao).toHaveAccessibleDescription(/^Nenhum contato registrado\./);
    expect(email()).toHaveAccessibleDescription(/Nenhum contato registrado/);
    // Estado, não erro: nada de alerta nem campo inválido depois da remoção.
    expect(within(secao).queryByRole("alert")).toBeNull();
    for (const campo of [email(), celular(), telefone()]) {
      expect(campo).toHaveValue("");
      expect(campo).not.toHaveAttribute("aria-invalid");
    }
    expect(
      screen.getByRole("button", { name: "Salvar contatos" }),
    ).toBeEnabled();
  });

  it("T179 — depois da remoção, salvar os três vazios de novo não envia: pede ao menos um", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(removido());
    const secao = await abrirDetalheDeAna();
    await waitFor(() =>
      expect(email()).toHaveValue("ana.contato@example.test"),
    );
    fireEvent.change(email(), { target: { value: "" } });
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.change(telefone(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    await within(secao).findByText("Contatos removidos.");
    const antes = vi.mocked(registrarContatosDoColaborador).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText(
        "Nenhum contato preenchido: informe ao menos um para salvar.",
      ),
    ).toBeInTheDocument();
    expect(vi.mocked(registrarContatosDoColaborador).mock.calls.length).toBe(
      antes,
    );
  });

  it("T179 — 'sem_alteracao' com sem_registro não quebra a ficha", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce({
      ...removido(),
      resultado: "sem_alteracao",
    });
    const secao = await abrirDetalheDeAna();
    await waitFor(() =>
      expect(email()).toHaveValue("ana.contato@example.test"),
    );
    fireEvent.change(email(), { target: { value: "" } });
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.change(telefone(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText(
        "Nada mudou: este colaborador já não tinha contatos.",
      ),
    ).toBeInTheDocument();
    expect(
      within(secao).getByText(/Nenhum contato registrado/),
    ).toHaveAttribute("role", "status");
    expect(within(secao).queryByRole("alert")).toBeNull();
  });

  it("T179 — sem registro: o e-mail pessoal descreve o estado 'Nenhum contato registrado'", async () => {
    await abrirDetalheDeAna();
    await screen.findByText(/Nenhum contato registrado/);
    expect(email()).toHaveAccessibleDescription(/Nenhum contato registrado/);
    expect(email().getAttribute("aria-describedby")?.split(" ")).toContain(
      "contatos-colaborador-sem-registro",
    );
  });

  it("T179 — sem registro e com erro no e-mail: a descrição tem o erro E o estado", async () => {
    const secao = await abrirDetalheDeAna();
    await within(secao).findByText(/Nenhum contato registrado/);
    fireEvent.change(email(), { target: { value: "sem-arroba" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    await waitFor(() =>
      expect(email()).toHaveAttribute("aria-invalid", "true"),
    );
    const ids = email().getAttribute("aria-describedby")!.split(" ");
    expect(ids).toContain("contatos-colaborador-email-pessoal-error");
    expect(ids).toContain("contatos-colaborador-sem-registro");
  });

  it("T179 — com contatos registrados, o id do estado não entra na descrição do e-mail", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    await abrirDetalheDeAna();
    await waitFor(() =>
      expect(email()).toHaveValue("ana.contato@example.test"),
    );
    expect(email().getAttribute("aria-describedby") ?? "").not.toContain(
      "contatos-colaborador-sem-registro",
    );
    expect(email()).not.toHaveAccessibleDescription(
      /Nenhum contato registrado/,
    );
  });

  it("T179 — 'Revisar contatos na ficha': o foco cai no e-mail, e o estado vem na descrição dele", async () => {
    render(
      <ColaboradoresScreen
        aberturaInicial={{ colaborador: colaborador1, foco: "contatos" }}
        podeEditarFicha
      />,
    );
    await waitFor(() => expect(email()).toHaveFocus());
    expect(email()).toHaveAccessibleDescription(/Nenhum contato registrado/);
  });

  // -------------------------------------------------------------------------
  // T179 (revisão final) — telefone LEGADO (gravado fora da forma atual):
  // exibido como gravado, marcado, e fora do `PUT` enquanto intacto.
  // Números sintéticos.
  // -------------------------------------------------------------------------

  const DICA_LEGADO =
    /Formato antigo, mantido exatamente como gravado\. Para trocar, apague e digite um número brasileiro\./;

  /** Registro com o celular no formato antigo e o telefone na forma atual. */
  function comCelularLegado(bruto: string): ContatosDoColaboradorApi {
    return {
      ...registrado,
      contatos: { ...registrado.contatos!, celular: bruto },
    };
  }

  it.each(["+55119876543210", "55919876543210", "119876543210"])(
    "T179 — legado %p aparece exatamente como gravado, marcado como formato antigo",
    async (bruto) => {
      vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(
        comCelularLegado(bruto),
      );
      const secao = await abrirDetalheDeAna();
      await waitFor(() => expect(celular()).toHaveValue(bruto));
      expect(celular()).toHaveAccessibleDescription(DICA_LEGADO);
      expect(celular().getAttribute("aria-describedby")?.split(" ")).toContain(
        "contatos-colaborador-celular-legado",
      );
      // O da forma atual continua mascarado e sem a marca.
      expect(telefone()).toHaveValue("(11) 3333-0001");
      expect(telefone()).not.toHaveAccessibleDescription(DICA_LEGADO);
      // Abrir não é alterar.
      expect(
        screen.getByRole("button", { name: "Salvar contatos" }),
      ).toBeDisabled();
      expect(within(secao).queryByRole("alert")).toBeNull();
    },
  );

  it("T179 — salvar só o e-mail NÃO envia a chave do telefone legado", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(
      comCelularLegado("55919876543210"),
    );
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("atualizado", {
        emailPessoal: "ana.nova@example.test",
        celular: "55919876543210",
        telefone: "+551133330001",
        atualizadoEm: "2026-10-16T12:00:00.000Z",
      }),
    );
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("55919876543210"));
    fireEvent.change(email(), { target: { value: "ana.nova@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    const [id, corpo] = chamadas[chamadas.length - 1]!;
    expect(id).toBe(colaborador1.id);
    expect(corpo).toEqual({
      emailPessoal: "ana.nova@example.test",
      telefone: "+551133330001",
    });
    expect(corpo).not.toHaveProperty("celular");
    // Gravado de novo como estava: continua legado, exibido como veio.
    expect(celular()).toHaveValue("55919876543210");
    expect(celular()).toHaveAccessibleDescription(DICA_LEGADO);
  });

  it("T179 — legado editado para um número válido: vai normalizado, e a marca sai", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(
      comCelularLegado("+55119876543210"),
    );
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("atualizado", {
        ...registrado.contatos!,
        celular: "+5511987650002",
      }),
    );
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("+55119876543210"));
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.change(celular(), { target: { value: "11987650002" } });
    expect(celular()).toHaveValue("(11) 98765-0002");
    expect(celular()).not.toHaveAccessibleDescription(DICA_LEGADO);
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    expect(chamadas[chamadas.length - 1]).toEqual([
      colaborador1.id,
      {
        emailPessoal: "ana.contato@example.test",
        celular: "+5511987650002",
        telefone: "+551133330001",
      },
    ]);
  });

  it("T179 — legado editado para um valor inválido: recusado aqui, nada é enviado", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(
      comCelularLegado("55919876543210"),
    );
    await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("55919876543210"));
    const antes = vi.mocked(registrarContatosDoColaborador).mock.calls.length;
    // Backspace no primeiro dígito: o resto fica como veio, sem máscara.
    fireEvent.change(celular(), { target: { value: "5919876543210" } });
    expect(celular()).toHaveValue("5919876543210");
    expect(
      screen.getByRole("button", { name: "Salvar contatos" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await screen.findByText(/Celular precisa do DDD e do número/),
    ).toBeInTheDocument();
    await waitFor(() => expect(celular()).toHaveFocus());
    expect(vi.mocked(registrarContatosDoColaborador).mock.calls.length).toBe(
      antes,
    );
  });

  it("T179 — apagar o legado envia null nele", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(
      comCelularLegado("119876543210"),
    );
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("atualizado", { ...registrado.contatos!, celular: null }),
    );
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("119876543210"));
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    expect(chamadas[chamadas.length - 1]).toEqual([
      colaborador1.id,
      {
        emailPessoal: "ana.contato@example.test",
        celular: null,
        telefone: "+551133330001",
      },
    ]);
  });

  it("T179 — telefones na forma atual seguem mascarados e vão no PUT como antes", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("atualizado", {
        ...registrado.contatos!,
        emailPessoal: "ana.nova@example.test",
      }),
    );
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("(11) 98765-0001"));
    expect(celular()).not.toHaveAccessibleDescription(DICA_LEGADO);
    fireEvent.change(email(), { target: { value: "ana.nova@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
    const chamadas = vi.mocked(registrarContatosDoColaborador).mock.calls;
    expect(chamadas[chamadas.length - 1]).toEqual([
      colaborador1.id,
      {
        emailPessoal: "ana.nova@example.test",
        celular: "+5511987650001",
        telefone: "+551133330001",
      },
    ]);
  });

  // -------------------------------------------------------------------------
  // T179 (revisão final) — aviso da máscara não sobrevive a salvar ou remover.
  // -------------------------------------------------------------------------

  it("T179 — aviso de excedente no celular some depois de salvar o e-mail", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(
      gravacao("atualizado", {
        ...registrado.contatos!,
        emailPessoal: "ana.nova@example.test",
      }),
    );
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("(11) 98765-0001"));
    fireEvent.change(celular(), { target: { value: "(11) 98765-00019" } });
    expect(celular()).toHaveValue("(11) 98765-0001");
    expect(celular()).toHaveAccessibleDescription(
      /O número não pode passar de 11 dígitos/,
    );
    fireEvent.change(email(), { target: { value: "ana.nova@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos salvos."),
    ).toBeInTheDocument();
    expect(celular()).toHaveValue("(11) 98765-0001");
    expect(celular()).not.toHaveAccessibleDescription(
      /O número não pode passar de 11 dígitos/,
    );
    expect(
      within(secao).queryByText(AVISO_DE_RECUSA.telefoneExcedente),
    ).toBeNull();
  });

  it("T179 — depois de 'Contatos removidos.', nenhum aviso da máscara fica", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce(registrado);
    vi.mocked(registrarContatosDoColaborador).mockResolvedValueOnce(removido());
    const secao = await abrirDetalheDeAna();
    await waitFor(() => expect(celular()).toHaveValue("(11) 98765-0001"));
    fireEvent.change(email(), { target: { value: "" } });
    fireEvent.change(telefone(), { target: { value: "" } });
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.paste(celular(), {
      clipboardData: { getData: () => "ramal 25" },
    });
    expect(celular()).toHaveValue("");
    expect(
      within(secao).getByText(AVISO_DE_RECUSA.telefoneFormato),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar contatos" }));
    expect(
      await within(secao).findByText("Contatos removidos."),
    ).toBeInTheDocument();
    expect(
      within(secao).queryByText(AVISO_DE_RECUSA.telefoneFormato),
    ).toBeNull();
    for (const campo of [celular(), telefone()]) {
      expect(campo).not.toHaveAccessibleDescription(
        /Use um telefone brasileiro|não pode passar/,
      );
    }
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
    // T184 — só o vínculo ativo tem lotação vigente.
    lotacaoVigente: situacao === "ativo" ? LOTACAO_ATIVA : null,
    // T185 — a API só projeta jornada para o vínculo ativo.
    vigenciasDeJornada: situacao === "ativo" ? [JORNADA_VIGENTE] : [],
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
    // T184 — cargo e departamento da lotação vigente.
    expect(celulasAna[2]).toHaveTextContent("Analista (teste)");
    expect(celulasAna[3]).toHaveTextContent("Administrativo (teste)");
    // T185 — jornada vigente: código e nome.
    expect(celulasAna[4]).toHaveTextContent(
      "COMERCIAL_44H — Comercial 44 horas (teste)",
    );
    expect(celulasAna[5]).toHaveTextContent("Ativo");
    expect(celulasAna[6]).toHaveTextContent("10/01/2025");

    // Sem vínculo na empresa ativa: traço, nunca dado inventado.
    const bruno = within(tabela).getByText(colaborador2.nome).closest("tr")!;
    const celulasBruno = within(bruno).getAllByRole("cell");
    expect(celulasBruno[1]).toHaveTextContent("—");
    expect(celulasBruno[2]).toHaveTextContent("—");
    expect(celulasBruno[3]).toHaveTextContent("—");
    expect(celulasBruno[4]).toHaveTextContent("—");
    expect(celulasBruno[5]).toHaveTextContent("Inativo");
    expect(celulasBruno[6]).toHaveTextContent("—");
  });

  it("T184 — sem lotação vigente (previsto ou encerrado): texto neutro nas duas colunas", async () => {
    const previsto = listado(
      {
        id: "66666666-6666-4666-8666-666666666661",
        nome: "Pessoa Prevista (teste)",
      },
      [vinculoListado("v-p", "DEMO-P-0001", "previsto", "2026-11-03")],
    );
    const encerrado = listado(
      {
        id: "66666666-6666-4666-8666-666666666662",
        nome: "Pessoa Desligada (teste)",
      },
      [vinculoListado("v-e", "DEMO-E-0001", "encerrado", "2024-01-02")],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([previsto, encerrado]),
    );
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });
    for (const nome of [
      "Pessoa Prevista (teste)",
      "Pessoa Desligada (teste)",
    ]) {
      const celulas = within(
        within(tabela).getByText(nome).closest("tr")!,
      ).getAllByRole("cell");
      expect(celulas[2]).toHaveTextContent("Sem lotação vigente");
      expect(celulas[3]).toHaveTextContent("Sem lotação vigente");
    }
  });

  it("T184 — lotação vigente sem cargo: 'Não informado' só no cargo", async () => {
    const semCargo = listado(
      {
        id: "66666666-6666-4666-8666-666666666663",
        nome: "Pessoa Sem Cargo (teste)",
      },
      [
        {
          ...vinculoListado("v-s", "DEMO-S-0001", "ativo", "2025-02-03"),
          lotacaoVigente: {
            cargo: null,
            departamento: LOTACAO_ATIVA.departamento,
          },
        },
      ],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([semCargo]));
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });
    const celulas = within(
      within(tabela).getByText("Pessoa Sem Cargo (teste)").closest("tr")!,
    ).getAllByRole("cell");
    expect(celulas[2]).toHaveTextContent("Não informado");
    expect(celulas[3]).toHaveTextContent("Administrativo (teste)");
  });

  it("T184 — com mais de um vínculo, a lotação é a do vínculo principal", async () => {
    const dois = listado(
      {
        id: "66666666-6666-4666-8666-666666666664",
        nome: "Pessoa Dois Vínculos (teste)",
      },
      [
        vinculoListado("v-a", "DEMO-A-0009", "ativo", "2025-01-01"),
        vinculoListado("v-b", "DEMO-B-0009", "previsto", "2026-03-01"),
      ],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([dois]));
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });
    const celulas = within(
      within(tabela).getByText("Pessoa Dois Vínculos (teste)").closest("tr")!,
    ).getAllByRole("cell");
    expect(celulas[2]).toHaveTextContent("Analista (teste)");
    expect(celulas[3]).toHaveTextContent("Administrativo (teste)");
  });

  /**
   * T185 — a coluna "Jornada de trabalho": a vigência que contém o dia civil
   * do navegador, do vínculo principal ativo. As datas da troca são
   * calculadas a partir do mesmo `diaDeHoje` que a tela usa.
   */
  function comJornada(
    nome: string,
    sufixo: string,
    vigencias: ColaboradorListadoApi["vinculos"][number]["vigenciasDeJornada"],
    situacao: "previsto" | "ativo" | "encerrado" = "ativo",
  ): ColaboradorListadoApi {
    return listado(
      { id: `66666666-6666-4666-8666-6666666667${sufixo}`, nome },
      [
        {
          ...vinculoListado(
            `v-j${sufixo}`,
            `DEMO-J-00${sufixo}`,
            situacao,
            "2025-01-01",
          ),
          vigenciasDeJornada: vigencias,
        },
      ],
    );
  }

  async function celulaDaJornadaDe(nome: string): Promise<HTMLElement> {
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });
    return within(within(tabela).getByText(nome).closest("tr")!).getAllByRole(
      "cell",
    )[4]!;
  }

  it("T185 — troca hoje: mostra a jornada que começa hoje, não a que terminou ontem", async () => {
    const hoje = diaDeHoje();
    const antiga = {
      ...JORNADA_VIGENTE,
      vigenciaFim: hoje,
      jornada: { ...JORNADA_VIGENTE.jornada, id: "j-a", codigo: "ANTIGA" },
    };
    const nova = {
      vigenciaInicio: hoje,
      vigenciaFim: null,
      jornada: { id: "j-n", codigo: "NOVA", nome: "Nova (teste)", ativo: true },
    };
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([comJornada("Pessoa Troca (teste)", "01", [antiga, nova])]),
    );
    render(<ColaboradoresScreen />);
    const celula = await celulaDaJornadaDe("Pessoa Troca (teste)");
    expect(celula).toHaveTextContent("NOVA — Nova (teste)");
    expect(celula).not.toHaveTextContent("ANTIGA");
  });

  it("T185 — sem jornada, só futura (começa amanhã) ou encerrada: 'Sem jornada vigente'", async () => {
    const amanha = proximoDiaCivil(diaDeHoje());
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        comJornada("Pessoa Sem Jornada (teste)", "02", []),
        comJornada("Pessoa Futura (teste)", "03", [
          { ...JORNADA_VIGENTE, vigenciaInicio: amanha },
        ]),
        comJornada("Pessoa Encerrada (teste)", "04", [
          { ...JORNADA_VIGENTE, vigenciaFim: diaDeHoje() },
        ]),
      ]),
    );
    render(<ColaboradoresScreen />);
    for (const nome of [
      "Pessoa Sem Jornada (teste)",
      "Pessoa Futura (teste)",
      "Pessoa Encerrada (teste)",
    ]) {
      const celula = await celulaDaJornadaDe(nome);
      expect(celula).toHaveTextContent("Sem jornada vigente");
      expect(celula).not.toHaveTextContent("COMERCIAL_44H");
    }
  });

  it("T185 — vínculo principal previsto ou encerrado: 'Sem jornada vigente', mesmo com vigência", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        comJornada(
          "Pessoa Prevista J (teste)",
          "05",
          [JORNADA_VIGENTE],
          "previsto",
        ),
        comJornada(
          "Pessoa Desligada J (teste)",
          "06",
          [JORNADA_VIGENTE],
          "encerrado",
        ),
      ]),
    );
    render(<ColaboradoresScreen />);
    for (const nome of [
      "Pessoa Prevista J (teste)",
      "Pessoa Desligada J (teste)",
    ]) {
      const celula = await celulaDaJornadaDe(nome);
      expect(celula).toHaveTextContent("Sem jornada vigente");
      expect(celula).not.toHaveTextContent("COMERCIAL_44H");
    }
  });

  it("T185 — jornada inativada: nome com a indicação 'Jornada inativa'", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        comJornada("Pessoa Jornada Inativa (teste)", "07", [
          {
            ...JORNADA_VIGENTE,
            jornada: { ...JORNADA_VIGENTE.jornada, ativo: false },
          },
        ]),
      ]),
    );
    render(<ColaboradoresScreen />);
    const celula = await celulaDaJornadaDe("Pessoa Jornada Inativa (teste)");
    expect(celula).toHaveTextContent(
      "COMERCIAL_44H — Comercial 44 horas (teste)",
    );
    expect(within(celula).getByText("Jornada inativa")).toBeInTheDocument();
  });

  it("T185 — jornada sem código: só o nome", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        comJornada("Pessoa Sem Codigo (teste)", "08", [
          {
            ...JORNADA_VIGENTE,
            jornada: { ...JORNADA_VIGENTE.jornada, codigo: null },
          },
        ]),
      ]),
    );
    render(<ColaboradoresScreen />);
    const celula = await celulaDaJornadaDe("Pessoa Sem Codigo (teste)");
    expect(celula.textContent?.trim()).toBe("Comercial 44 horas (teste)");
  });

  it("T185 — com mais de um vínculo, a jornada é a do vínculo principal", async () => {
    const dois = listado(
      {
        id: "66666666-6666-4666-8666-666666666709",
        nome: "Pessoa Principal Previsto (teste)",
      },
      [
        vinculoListado("v-p9", "DEMO-P-0009", "previsto", "2026-03-01"),
        vinculoListado("v-e9", "DEMO-E-0009", "encerrado", "2024-01-01"),
      ],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([dois]));
    render(<ColaboradoresScreen />);
    const celula = await celulaDaJornadaDe("Pessoa Principal Previsto (teste)");
    expect(celula).toHaveTextContent("Sem jornada vigente");
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
    expect(celulas[5]).toHaveTextContent("Inativo");
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

// ---------------------------------------------------------------------------
// T181 — a ficha com dados pessoais e endereço editáveis: o modal pede
// confirmação antes de descartar o que está sendo editado nesses blocos, não
// fecha no meio da gravação, e a consulta de CEP só aparece para quem o
// servidor a aceita.
// ---------------------------------------------------------------------------
describe("T181 — ficha: dados pessoais e endereço editáveis no detalhe", () => {
  async function abrirFicha(props: { podeEditarFicha?: boolean } = {}) {
    render(<ColaboradoresScreen podeEditarFicha {...props} />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));
    return screen.findByRole("region", { name: "Endereço" });
  }

  it("o aviso do detalhe diz o que pode ser corrigido", async () => {
    await abrirFicha();
    expect(
      screen.getByText(
        /O nome, os dados pessoais, o endereço e os contatos podem ser\s+corrigidos abaixo\./,
      ),
    ).toBeInTheDocument();
  });

  it("endereço em edição com alteração: fechar pede confirmação, e descartar não grava", async () => {
    const endereco = await abrirFicha();
    fireEvent.click(
      within(endereco).getByRole("button", { name: "Editar endereço" }),
    );
    fireEvent.change(screen.getByLabelText(/^Número/), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });

  it("dados pessoais só abertos, sem alteração: fecha direto", async () => {
    await abrirFicha();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar dados pessoais" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
  });

  it("durante a gravação de um bloco, o detalhe não fecha", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockReturnValueOnce(
      new Promise(() => undefined),
    );
    await abrirFicha();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar dados pessoais" }),
    );
    fireEvent.change(screen.getByLabelText(/^Curso/), {
      target: { value: "Curso Sintético" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar dados pessoais" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled(),
    );
  });

  it("quem edita a ficha (RH ou DP) tem 'Buscar CEP' na edição do endereço", async () => {
    const endereco = await abrirFicha();
    fireEvent.click(
      within(endereco).getByRole("button", { name: "Editar endereço" }),
    );
    expect(
      within(endereco).getAllByRole("button", { name: "Buscar CEP" }),
    ).toHaveLength(1);
  });

  // T181 — a edição da ficha é só de RH e DP (decisão de 2026-10-23): quem
  // só lê (o master_tecnico) vê os três blocos sem nenhum botão de edição.
  it("sem permissão de editar: dados pessoais, endereço e contatos só para leitura", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValueOnce({
      colaboradorId: colaborador1.id,
      empresaId: "44444444-4444-4444-4444-444444444444",
      situacao: "registrado",
      contatos: {
        emailPessoal: "ana.leitura@example.test",
        celular: "+5511987650001",
        telefone: null,
        atualizadoEm: "2026-10-16T12:00:00.000Z",
      },
    });
    await abrirFicha({ podeEditarFicha: false });
    const contatos = await screen.findByRole("region", { name: "Contatos" });
    await within(contatos).findByText("ana.leitura@example.test");
    expect(within(contatos).getByText("(11) 98765-0001")).toBeInTheDocument();
    for (const nome of ["Dados pessoais", "Endereço", "Contatos"]) {
      const regiao = screen.getByRole("region", { name: nome });
      expect(within(regiao).queryByRole("button")).toBeNull();
      expect(within(regiao).queryByRole("textbox")).toBeNull();
    }
    expect(
      screen.queryByRole("button", {
        name: /^(Preencher|Editar) (dados pessoais|endereço)$|^Salvar contatos$|^Cancelar$/,
      }),
    ).toBeNull();
  });

  it("sem permissão de editar e sem contatos: 'Nenhum contato registrado', sem campos", async () => {
    await abrirFicha({ podeEditarFicha: false });
    const contatos = await screen.findByRole("region", { name: "Contatos" });
    expect(
      await within(contatos).findByText("Nenhum contato registrado."),
    ).toBeInTheDocument();
    expect(within(contatos).queryByRole("textbox")).toBeNull();
  });
});
