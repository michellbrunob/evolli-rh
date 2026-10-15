import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColaboradoresScreen } from "./ColaboradoresScreen";
import {
  type ColaboradorApi,
  type VinculoApi,
  admitirColaborador,
  buscarColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../api/colaboradoresClient";
import {
  type AreaApi,
  type CentroCustoApi,
  type DepartamentoApi,
  type EmpresaApi,
  type EquipeApi,
  type UnidadeOrganizacionalApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");

interface ResultadoPaginadoTeste<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

function paginado<T>(itens: T[]): ResultadoPaginadoTeste<T> {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

const colaborador1: ColaboradorApi = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Colaboradora (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
};

const colaborador2: ColaboradorApi = {
  id: "22222222-2222-2222-2222-222222222222",
  nome: "Bruno Colaborador (teste)",
  situacao: "inativo",
  criadoEm: "2025-02-05T12:00:00.000Z",
  atualizadoEm: "2025-02-05T12:00:00.000Z",
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

const empresa1: EmpresaApi = {
  id: "44444444-4444-4444-4444-444444444444",
  codigo: "EMP1",
  nome: "Empresa Um (teste)",
  status: "ativo",
};

const departamento1: DepartamentoApi = {
  id: "55555555-5555-5555-5555-555555555555",
  codigo: "DEP1",
  nome: "Departamento Um (teste)",
  empresaId: empresa1.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const area1: AreaApi = {
  id: "66666666-6666-6666-6666-666666666666",
  departamentoId: departamento1.id,
  codigo: "ARE1",
  nome: "Área Um (teste)",
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const unidade1: UnidadeOrganizacionalApi = {
  id: "77777777-7777-7777-7777-777777777777",
  codigo: "UNI1",
  nome: "Unidade Um (teste)",
  empresaId: empresa1.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const equipe1: EquipeApi = {
  id: "88888888-8888-8888-8888-888888888888",
  empresaId: empresa1.id,
  departamentoId: departamento1.id,
  unidadeOrganizacionalId: null,
  codigo: "EQU1",
  nome: "Equipe Um (teste)",
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const cargo1: CargoApi = {
  id: "99999999-9999-9999-9999-999999999999",
  codigo: "CAR1",
  nome: "Cargo Um (teste)",
  empresaId: empresa1.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const centroCusto1: CentroCustoApi = {
  id: "10101010-1010-1010-1010-101010101010",
  codigo: "CC1",
  nome: "Centro de Custo Um (teste)",
  empresaId: empresa1.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

beforeEach(() => {
  vi.mocked(listarColaboradores).mockResolvedValue(
    paginado([colaborador1, colaborador2]),
  );
  vi.mocked(buscarColaborador).mockResolvedValue(colaborador1);
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([vinculo1]);
  vi.mocked(admitirColaborador).mockResolvedValue(colaborador1);
  vi.mocked(retificarColaborador).mockResolvedValue(colaborador1);

  vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado([empresa1]));
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([departamento1]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([unidade1]));
  vi.mocked(listarEquipes).mockResolvedValue(paginado([equipe1]));
  vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([centroCusto1]));
  vi.mocked(listarAreas).mockResolvedValue(paginado([area1]));
  vi.mocked(listarCargos).mockResolvedValue(paginado([cargo1]));
});

async function abrirFormularioEAguardarOpcoes() {
  fireEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));
  await waitFor(() => expect(listarEmpresasMulti).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByLabelText(/Tipo de vínculo/i)).not.toBeDisabled(),
  );
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
    let resolver: (v: ResultadoPaginadoTeste<ColaboradorApi>) => void;
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
        name: "Nenhum colaborador cadastrado",
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

  it("abre e fecha o formulário de novo colaborador", async () => {
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    expect(
      screen.getByRole("form", { name: "Formulário de novo colaborador" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("form", { name: "Formulário de novo colaborador" }),
    ).not.toBeInTheDocument();
  });

  it("valida nome obrigatório", async () => {
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    expect(await screen.findByText("Nome é obrigatório.")).toBeInTheDocument();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("valida o padrão da matrícula", async () => {
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Teste" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "!!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    expect(
      await screen.findByText(
        "Use apenas letras maiúsculas, números, - e _ (2 a 32 caracteres).",
      ),
    ).toBeInTheDocument();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("exige tipo de vínculo, data de admissão e lotação inicial", async () => {
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Teste" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "MAT-0099" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    expect(
      await screen.findByText("Selecione o tipo de vínculo."),
    ).toBeInTheDocument();
    expect(screen.getByText("Informe a data de admissão.")).toBeInTheDocument();
    expect(
      screen.getByText("Escolha o tipo de referência organizacional."),
    ).toBeInTheDocument();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("admite um colaborador com sucesso (lotação por departamento) e recarrega a lista", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    const chamadasAntes = vi.mocked(listarColaboradores).mock.calls.length;
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Novo" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0099" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      {
        target: { value: "departamento" },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      {
        target: { value: departamento1.id },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    await waitFor(() =>
      expect(admitirColaborador).toHaveBeenCalledWith({
        nome: "Colaborador Novo",
        empresaId: empresa1.id,
        matricula: "MAT-0099",
        tipo: "clt",
        dataAdmissao: "2026-01-05",
        motivoCodigo: "admissao_inicial",
        departamentoId: departamento1.id,
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Formulário de novo colaborador" }),
      ).not.toBeInTheDocument(),
    );
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(
      chamadasAntes + 1,
    );
    expect(listarColaboradores).toHaveBeenLastCalledWith({
      pagina: 1,
      tamanhoPagina: 20,
    });
  });

  it("exige departamento antes de liberar a seleção de área, e envia ambos ao admitir", async () => {
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Área" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "MAT-0100" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      {
        target: { value: "area" },
      },
    );

    // O registro (a área) só libera depois do departamento que a qualifica —
    // e cada um tem rótulo permanente e próprio.
    expect(
      screen.getByLabelText(/Registro da referência organizacional/i),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Departamento da área/i), {
      target: { value: departamento1.id },
    });

    await waitFor(() =>
      expect(listarAreas).toHaveBeenCalledWith({
        departamentoId: departamento1.id,
        status: "ativo",
        tamanhoPagina: 100,
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText(/Registro da referência organizacional/i),
      ).not.toBeDisabled(),
    );

    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      {
        target: { value: area1.id },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    await waitFor(() =>
      expect(admitirColaborador).toHaveBeenCalledWith(
        expect.objectContaining({
          areaId: area1.id,
          departamentoId: departamento1.id,
        }),
      ),
    );
  });

  it("mostra o erro retornado pela API ao admitir", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      new Error("Matrícula já utilizada nesta empresa."),
    );

    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Novo" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "MAT-0099" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      {
        target: { value: "departamento" },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      {
        target: { value: departamento1.id },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    expect(
      await screen.findByText("Matrícula já utilizada nesta empresa."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Formulário de novo colaborador" }),
    ).toBeInTheDocument();
  });

  it("abre o detalhe de um colaborador e carrega seus vínculos", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
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

  it("abrir o formulário fecha um detalhe que estava aberto", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByRole("table", {
      name: `Vínculos — ${colaborador1.nome}`,
    });

    await abrirFormularioEAguardarOpcoes();

    expect(
      screen.queryByRole("table", { name: `Vínculos — ${colaborador1.nome}` }),
    ).not.toBeInTheDocument();
  });

  it("não contém CPF, senha, sessão ou outro dado sensível na tela", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    await abrirFormularioEAguardarOpcoes();

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
  // ---- T142 (piloto): o painel de trabalho precisa ser encontrável ---------

  it("ao abrir o formulário, o foco vai para o título do painel", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const abrir = screen.getByRole("button", { name: "Novo colaborador" });
    expect(abrir).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(abrir);

    const titulo = await screen.findByRole("heading", {
      name: "Novo colaborador",
      level: 2,
    });
    await waitFor(() => expect(document.activeElement).toBe(titulo));
    expect(abrir).toHaveAttribute("aria-expanded", "true");
    expect(abrir).toHaveAttribute("aria-haspopup", "dialog");
    // A janela é modal e é nomeada pelo título que recebeu o foco.
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAttribute("aria-labelledby", titulo.id);
  });

  it("Escape fecha a janela vazia e devolve o foco a quem a abriu", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const abrir = screen.getByRole("button", { name: "Novo colaborador" });
    fireEvent.click(abrir);
    await screen.findByRole("heading", { name: "Novo colaborador", level: 2 });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Novo colaborador", level: 2 }),
      ).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });

  it("o detalhe recebe o foco e fecha com Escape, devolvendo o foco", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    const verDetalhes = within(linha).getByRole("button", {
      name: /Ver detalhes/,
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
  it("admitir confirma o resultado e devolve o foco a quem abriu", async () => {
    vi.mocked(admitirColaborador).mockResolvedValue(colaborador1);
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const abrir = screen.getByRole("button", { name: "Novo colaborador" });
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Novo" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0099" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      {
        target: { value: "departamento" },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      {
        target: { value: departamento1.id },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    const confirmacao = await screen.findByRole("status");
    expect(confirmacao.textContent).toMatch(/admitido/i);
    await waitFor(() => expect(document.activeElement).toBe(abrir));

    // A confirmação sai de cena assim que outra tarefa começa.
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
  // ---- T142: o erro fica no campo que precisa ser preenchido --------------

  it("com o tipo escolhido e o registro vazio, o erro marca o REGISTRO, não o tipo", async () => {
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    // Só o tipo (a categoria) é escolhido; o registro fica vazio.
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      { target: { value: "cargo" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    const tipo = screen.getByLabelText(/Tipo de referência organizacional/i);
    const registro = screen.getByLabelText(
      /Registro da referência organizacional/i,
    );

    await waitFor(() =>
      expect(registro).toHaveAttribute("aria-invalid", "true"),
    );
    // O campo JÁ preenchido não pode ser acusado.
    expect(tipo).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Selecione o registro de cargo\./i)).toBeTruthy();
  });

  it("sem tipo escolhido, o erro marca o TIPO", async () => {
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    const tipo = screen.getByLabelText(/Tipo de referência organizacional/i);
    await waitFor(() => expect(tipo).toHaveAttribute("aria-invalid", "true"));
    expect(
      screen.getByText("Escolha o tipo de referência organizacional."),
    ).toBeTruthy();
  });

  it("cargo sozinho é referência suficiente e vai no DTO como cargoId", async () => {
    vi.mocked(admitirColaborador).mockResolvedValue(colaborador1);
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Cargo" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0101" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      { target: { value: "cargo" } },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      { target: { value: cargo1.id } },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    await waitFor(() =>
      expect(admitirColaborador).toHaveBeenCalledWith({
        nome: "Colaborador Cargo",
        empresaId: empresa1.id,
        matricula: "MAT-0101",
        tipo: "clt",
        dataAdmissao: "2026-01-05",
        motivoCodigo: "admissao_inicial",
        cargoId: cargo1.id,
      }),
    );
  });

  // ---- B2: a validação da referência organizacional precisa BLOQUEAR o
  // envio sozinha, sem depender de nenhum outro campo obrigatório estar
  // faltando — testes isolados, com todo o resto do formulário válido.
  it("com todos os demais campos válidos, sem tipo de referência escolhido, bloqueia o envio e marca o campo do TIPO", async () => {
    // Mocks não são limpos entre testes neste arquivo: a contagem de
    // chamadas é sempre relativa ao que já havia antes deste teste.
    const antes = vi.mocked(admitirColaborador).mock.calls.length;
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Sem Tipo" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0303" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    // Tipo de referência organizacional deliberadamente NÃO escolhido.

    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    const tipo = screen.getByLabelText(/Tipo de referência organizacional/i);
    await waitFor(() => expect(tipo).toHaveAttribute("aria-invalid", "true"));
    expect(
      screen.getByText("Escolha o tipo de referência organizacional."),
    ).toBeTruthy();
    expect(vi.mocked(admitirColaborador).mock.calls.length).toBe(antes);
  });

  it("com todos os demais campos válidos, tipo Área sem departamento escolhido, bloqueia o envio e marca o campo do DEPARTAMENTO", async () => {
    const antes = vi.mocked(admitirColaborador).mock.calls.length;
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Área Sem Departamento" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0304" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      { target: { value: "area" } },
    );
    // O registro (a área) só libera depois do departamento: continua vazio
    // e desabilitado — não há como escolhê-lo sem o departamento primeiro.
    expect(
      screen.getByLabelText(/Registro da referência organizacional/i),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    const departamentoArea = screen.getByLabelText(/Departamento da área/i);
    await waitFor(() =>
      expect(departamentoArea).toHaveAttribute("aria-invalid", "true"),
    );
    expect(screen.getByText("Selecione o departamento da área.")).toBeTruthy();
    expect(vi.mocked(admitirColaborador).mock.calls.length).toBe(antes);
  });

  it("cliques repetidos no envio não duplicam a admissão", async () => {
    // Objeto mutável, não `let`: o TypeScript não acompanha a atribuição de
    // `resolver` feita dentro do executor da Promise (closure separada) e, na
    // leitura abaixo, estreita a variável para `null` só por análise de fluxo
    // — dar `resolver?.()` nela vira `never` ("not callable"). Guardando em
    // `.current` o problema não existe: acesso a propriedade não sofre esse
    // estreitamento.
    const resolverRef: { current: ((v: ColaboradorApi) => void) | null } = {
      current: null,
    };
    vi.mocked(admitirColaborador).mockImplementation(
      () =>
        new Promise<ColaboradorApi>((res) => {
          resolverRef.current = res;
        }),
    );
    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Duplo" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0202" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      { target: { value: "cargo" } },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      { target: { value: cargo1.id } },
    );

    const antes = vi.mocked(admitirColaborador).mock.calls.length;
    const enviar = screen.getByRole("button", { name: "Admitir colaborador" });
    // Três cliques no mesmo quadro: o `disabled` só chega no próximo render,
    // então a trava tem de ser síncrona.
    fireEvent.click(enviar);
    fireEvent.click(enviar);
    fireEvent.click(enviar);

    await waitFor(() =>
      expect(vi.mocked(admitirColaborador).mock.calls.length - antes).toBe(1),
    );
    resolverRef.current?.(colaborador1);
  });

  // ---- B1: depois de uma falha, a trava síncrona de envio precisa ser
  // liberada — senão o formulário fica preso: o botão volta a aparecer
  // habilitado, mas o próximo clique não faz nada.
  it("depois de uma falha, preserva os dados, libera o reenvio e admite com sucesso ao corrigir o campo", async () => {
    // Mocks não são limpos entre testes neste arquivo (mesma convenção de
    // "cliques repetidos..." e "admite um colaborador..."): a contagem é
    // sempre relativa ao que já havia antes deste teste, nunca absoluta.
    const antes = vi.mocked(admitirColaborador).mock.calls.length;
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      new Error("Matrícula já utilizada nesta empresa."),
    );

    render(<ColaboradoresScreen />);
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Colaborador Reenvio" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0400" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      { target: { value: "departamento" } },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      { target: { value: departamento1.id } },
    );

    // Primeira tentativa: a API recusa.
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );
    expect(
      await screen.findByText("Matrícula já utilizada nesta empresa."),
    ).toBeInTheDocument();
    expect(vi.mocked(admitirColaborador).mock.calls.length - antes).toBe(1);

    // Os dados continuam no formulário — nada foi perdido na falha.
    expect(screen.getByLabelText(/Nome completo/i)).toHaveValue(
      "Colaborador Reenvio",
    );
    expect(screen.getByLabelText(/Matrícula/i)).toHaveValue("MAT-0400");
    expect(
      screen.getByRole("form", { name: "Formulário de novo colaborador" }),
    ).toBeInTheDocument();
    // O botão voltou ao estado normal — não ficou preso em "Admitindo…".
    expect(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    ).not.toBeDisabled();

    // Corrige só a matrícula, sem fechar o modal, e reenvia.
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "mat-0401" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    // Segunda tentativa: sucesso (mock volta ao `mockResolvedValue` padrão).
    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Formulário de novo colaborador" }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/admitido/i);

    // Uma chamada por tentativa: a primeira (recusada) e a segunda (aceita)
    // com o campo já corrigido — nunca uma terceira, nem a duplicação do
    // envio duplicado travado para sempre.
    const chamadas = vi.mocked(admitirColaborador).mock.calls.slice(antes);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]?.[0]).toEqual(
      expect.objectContaining({ matricula: "MAT-0400" }),
    );
    expect(chamadas[1]?.[0]).toEqual(
      expect.objectContaining({ matricula: "MAT-0401" }),
    );
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
    const atrasada = adiado<ResultadoPaginadoTeste<ColaboradorApi>>();

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
      within(linhaAna).getByRole("button", { name: /Ver detalhes/ }),
    );
    // Fecha o detalhe de Ana com a requisição dela ainda em voo.
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    const linhaBruno = screen
      .getByText("Bruno Colaborador (teste)")
      .closest("tr")!;
    fireEvent.click(
      within(linhaBruno).getByRole("button", { name: /Ver detalhes/ }),
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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
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
   * D5. A admissão nasce com colaborador `inativo` e vínculo `previsto`. Com o
   * filtro em "Ativo", o recém-admitido NÃO volta no refetch — e a confirmação
   * antiga afirmava, incondicionalmente, que ele já aparecia na lista.
   *
   * Falha na implementação anterior: a frase "já aparece na lista abaixo" era
   * exibida mesmo quando o filtro o escondia.
   */
  it("a confirmação não afirma visibilidade quando o filtro esconde o admitido", async () => {
    vi.mocked(admitirColaborador).mockResolvedValue({
      ...colaborador1,
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      nome: "Recem Admitido (teste)",
      situacao: "inativo",
    });

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBeGreaterThan(
        1,
      ),
    );

    await abrirFormularioEAguardarOpcoes();
    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Recem Admitido (teste)" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "MAT-0777" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      { target: { value: "departamento" } },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      { target: { value: departamento1.id } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    await waitFor(() => expect(admitirColaborador).toHaveBeenCalled());
    const confirmacao = await screen.findByText(/admitido/i);
    expect(confirmacao.textContent).toMatch(/não aparece na lista/i);
    expect(confirmacao.textContent).not.toMatch(/já aparece na lista/i);
  });

  /**
   * D6. Todo `onChange` fazia `erros: {}`. Como a mensagem do servidor vive em
   * `geral`, começar a corrigir apagava a explicação do que deu errado — no
   * momento exato em que ela é necessária.
   *
   * Falha na implementação anterior: um caractere digitado sumia com o texto.
   */
  it("corrigir um campo preserva a mensagem de erro devolvida pelo servidor", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      new Error("Conflito ao processar a requisição."),
    );

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });
    await abrirFormularioEAguardarOpcoes();

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Nome Teste (teste)" },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "MAT-0500" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/i), {
      target: { value: "clt" },
    });
    fireEvent.change(screen.getByLabelText(/Data de admissão/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(
      screen.getByLabelText(/Tipo de referência organizacional/i),
      { target: { value: "departamento" } },
    );
    fireEvent.change(
      screen.getByLabelText(/Registro da referência organizacional/i),
      { target: { value: departamento1.id } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Admitir colaborador" }),
    );

    const erro = await screen.findByText(/Conflito ao processar a requisição/i);
    expect(erro).toBeInTheDocument();

    // Corrige a matrícula — o motivo da recusa precisa continuar legível.
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: "MAT-0501" },
    });

    expect(
      screen.getByText(/Conflito ao processar a requisição/i),
    ).toBeInTheDocument();
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
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

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
  return { itens, pagina: paginaAtual, tamanhoPagina: 20, total };
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

  it("exibe a data de cadastro em padrão brasileiro, nunca ISO", async () => {
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });

    expect(
      screen.getByRole("columnheader", { name: "Cadastrado em" }),
    ).toBeInTheDocument();
    // `criadoEm` é 2025-01-10T12:00:00.000Z — meio-dia UTC é 09:00 em
    // São Paulo, o fuso de negócio do formatador central.
    expect(tabela).toHaveTextContent("10/01/2025");
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

describe("T164 — o que NÃO existe nesta fatia", () => {
  /**
   * A fatia é de consulta, e a API não oferece busca nem contagem por
   * situação. Controle aparente é promessa: uma caixa que não filtra ou um
   * contador que não conta são piores que a ausência deles, porque parecem
   * funcionar. Este bloco prende essa decisão.
   */
  it("não há caixa de busca — a API não tem busca por nome ou matrícula", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    for (const campo of screen.queryAllByRole("textbox")) {
      expect(campo.getAttribute("placeholder") ?? "").not.toMatch(
        /buscar|pesquisar/i,
      );
    }
  });

  it("não há contadores por situação — a API só devolve o total do filtro", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const corpo = document.body.textContent ?? "";
    expect(corpo).not.toMatch(/\bAtivos\s*\(?\d/i);
    expect(corpo).not.toMatch(/\bInativos\s*\(?\d/i);
  });

  it("a tabela não promete matrícula, cargo, departamento nem admissão", async () => {
    // Esses campos vivem no VÍNCULO, a uma chamada por pessoa. Entrariam só
    // por N+1 — proibido — ou por coluna vazia, que é promessa falsa.
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: "Colaboradores desta empresa" });

    const cabecalhos = screen
      .getAllByRole("columnheader")
      .map((c) => c.textContent?.trim() ?? "");
    expect(cabecalhos).toEqual(["Nome", "Situação", "Cadastrado em", "Ações"]);
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
    resposta: ResultadoPaginadoTeste<ColaboradorApi>,
  ) {
    let liberar!: () => void;
    const promessa = new Promise<ResultadoPaginadoTeste<ColaboradorApi>>(
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
