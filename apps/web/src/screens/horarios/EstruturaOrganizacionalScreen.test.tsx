import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AreaApi,
  DepartamentoApi,
  EquipeApi,
  EmpresaApi,
  ResultadoPaginado,
  UnidadeOrganizacionalApi,
} from "../../api/organizacaoClient";
import { EstruturaOrganizacionalScreen } from "./EstruturaOrganizacionalScreen";

vi.mock("../../api/organizacaoClient");

import {
  atualizarArea,
  atualizarDepartamento,
  atualizarEquipe,
  atualizarUnidade,
  criarArea,
  criarDepartamento,
  criarEquipe,
  criarUnidade,
  listarAreas,
  listarDepartamentos,
  listarDepartamentosParaArea,
  listarDepartamentosParaEquipe,
  listarEmpresas,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
  listarUnidadesParaEquipe,
} from "../../api/organizacaoClient";

const mockListarEmpresas = vi.mocked(listarEmpresas);
const mockListarUnidades = vi.mocked(listarUnidades);
const mockCriarUnidade = vi.mocked(criarUnidade);
const mockAtualizarUnidade = vi.mocked(atualizarUnidade);
const mockListarEmpresasMulti = vi.mocked(listarEmpresasMulti);
const mockListarDepartamentos = vi.mocked(listarDepartamentos);
const mockCriarDepartamento = vi.mocked(criarDepartamento);
const mockAtualizarDepartamento = vi.mocked(atualizarDepartamento);
const mockListarDepartamentosParaArea = vi.mocked(listarDepartamentosParaArea);
const mockListarAreas = vi.mocked(listarAreas);
const mockCriarArea = vi.mocked(criarArea);
const mockAtualizarArea = vi.mocked(atualizarArea);
const mockListarDepartamentosParaEquipe = vi.mocked(
  listarDepartamentosParaEquipe,
);
const mockListarUnidadesParaEquipe = vi.mocked(listarUnidadesParaEquipe);
const mockListarEquipes = vi.mocked(listarEquipes);
const mockCriarEquipe = vi.mocked(criarEquipe);
const mockAtualizarEquipe = vi.mocked(atualizarEquipe);

const empresaFixture: EmpresaApi = {
  id: "00000000-0000-0000-0000-000000000001",
  codigo: "EMP-01",
  nome: "Empresa Exemplo (teste)",
  status: "ativo",
};

const empresa2Fixture: EmpresaApi = {
  id: "00000000-0000-0000-0000-000000000002",
  codigo: "EMP-02",
  nome: "Empresa Dois (teste)",
  status: "ativo",
};

const dep1: DepartamentoApi = {
  id: "00000000-0000-0000-0000-000000000021",
  codigo: "FIN",
  nome: "Financeiro (teste)",
  empresaId: empresaFixture.id,
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const dep2: DepartamentoApi = {
  id: "00000000-0000-0000-0000-000000000022",
  codigo: "RH",
  nome: "Recursos Humanos (teste)",
  empresaId: empresaFixture.id,
  status: "inativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const dep3: DepartamentoApi = {
  id: "00000000-0000-0000-0000-000000000023",
  codigo: "LEGAL",
  nome: "Juridico (teste)",
  empresaId: empresaFixture.id,
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const area1: AreaApi = {
  id: "00000000-0000-0000-0000-000000000031",
  codigo: "CONTAS",
  nome: "Contas a Pagar (teste)",
  departamentoId: dep1.id,
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const area2: AreaApi = {
  id: "00000000-0000-0000-0000-000000000032",
  codigo: "SUPORTE",
  nome: "Suporte Interno (teste)",
  departamentoId: dep1.id,
  status: "inativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const unidade1: UnidadeOrganizacionalApi = {
  id: "00000000-0000-0000-0000-000000000011",
  codigo: "UNID_SP",
  nome: "Unidade São Paulo (teste)",
  empresaId: empresaFixture.id,
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const unidade2: UnidadeOrganizacionalApi = {
  id: "00000000-0000-0000-0000-000000000012",
  codigo: "UNID_RJ",
  nome: "Unidade Rio de Janeiro (teste)",
  empresaId: empresaFixture.id,
  status: "inativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const equipe1: EquipeApi = {
  id: "00000000-0000-0000-0000-000000000041",
  empresaId: empresaFixture.id,
  departamentoId: dep1.id,
  unidadeOrganizacionalId: unidade1.id,
  codigo: "EQUIPE_FIN",
  nome: "Equipe Financeira (teste)",
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const equipe2: EquipeApi = {
  id: "00000000-0000-0000-0000-000000000042",
  empresaId: empresaFixture.id,
  departamentoId: dep1.id,
  unidadeOrganizacionalId: null,
  codigo: "EQUIPE_RH",
  nome: "Equipe RH (teste)",
  status: "inativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

function mockSucesso(
  unidades: UnidadeOrganizacionalApi[] = [unidade1, unidade2],
) {
  mockListarEmpresas.mockResolvedValue({
    itens: [empresaFixture],
    pagina: 1,
    tamanhoPagina: 1,
    total: 1,
  } satisfies ResultadoPaginado<EmpresaApi>);
  mockListarUnidades.mockResolvedValue({
    itens: unidades,
    pagina: 1,
    tamanhoPagina: 50,
    total: unidades.length,
  } satisfies ResultadoPaginado<UnidadeOrganizacionalApi>);
}

function mockSucessoDep(
  deps: DepartamentoApi[] = [dep1, dep2],
  empresas: EmpresaApi[] = [empresaFixture],
) {
  mockListarEmpresasMulti.mockResolvedValue({
    itens: empresas,
    pagina: 1,
    tamanhoPagina: 100,
    total: empresas.length,
  } satisfies ResultadoPaginado<EmpresaApi>);
  mockListarDepartamentos.mockResolvedValue({
    itens: deps,
    pagina: 1,
    tamanhoPagina: 50,
    total: deps.length,
  } satisfies ResultadoPaginado<DepartamentoApi>);
}

function mockSucessoArea(
  areas: AreaApi[] = [area1, area2],
  deps: DepartamentoApi[] = [dep1],
) {
  mockListarDepartamentosParaArea.mockResolvedValue({
    itens: deps,
    pagina: 1,
    tamanhoPagina: 100,
    total: deps.length,
  } satisfies ResultadoPaginado<DepartamentoApi>);
  mockListarAreas.mockResolvedValue({
    itens: areas,
    pagina: 1,
    tamanhoPagina: 50,
    total: areas.length,
  } satisfies ResultadoPaginado<AreaApi>);
}

async function ativarAbaDepartamentos() {
  fireEvent.click(screen.getByRole("tab", { name: "Departamentos" }));
}

async function ativarAbaAreas() {
  fireEvent.click(screen.getByRole("tab", { name: "Áreas" }));
}

function mockSucessoEquipe(
  equipes: EquipeApi[] = [equipe1, equipe2],
  deps: DepartamentoApi[] = [dep1],
  unids: UnidadeOrganizacionalApi[] = [unidade1],
) {
  mockListarDepartamentosParaEquipe.mockResolvedValue({
    itens: deps,
    pagina: 1,
    tamanhoPagina: 100,
    total: deps.length,
  } satisfies ResultadoPaginado<DepartamentoApi>);
  mockListarUnidadesParaEquipe.mockResolvedValue({
    itens: unids,
    pagina: 1,
    tamanhoPagina: 100,
    total: unids.length,
  } satisfies ResultadoPaginado<UnidadeOrganizacionalApi>);
  mockListarEquipes.mockResolvedValue({
    itens: equipes,
    pagina: 1,
    tamanhoPagina: 50,
    total: equipes.length,
  } satisfies ResultadoPaginado<EquipeApi>);
}

async function ativarAbaEquipes() {
  fireEvent.click(screen.getByRole("tab", { name: "Equipes" }));
}

describe("EstruturaOrganizacionalScreen (T104 — funcional)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tem um único h1", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Estrutura organizacional",
        }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("exibe o aviso 'Somente RH' com texto de escopo e o aviso 'Auditado' com trilha de auditoria", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);

    await waitFor(() =>
      expect(screen.getByText("Somente RH")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Somente o RH da própria empresa administra/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Auditado")).toBeInTheDocument();
    expect(
      screen.getByText(/geram trilha de auditoria automática/i),
    ).toBeInTheDocument();
  });

  it("lista unidades com código, nome, situação e botão Editar", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);

    const tabela = await screen.findByRole("table", {
      name: "Unidades organizacionais",
    });
    expect(within(tabela).getByText("UNID_SP")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Unidade São Paulo (teste)"),
    ).toBeInTheDocument();
    expect(within(tabela).getByText("Ativa")).toBeInTheDocument();
    expect(within(tabela).getByText("UNID_RJ")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Unidade Rio de Janeiro (teste)"),
    ).toBeInTheDocument();
    expect(within(tabela).getByText("Inativa")).toBeInTheDocument();
    expect(
      within(tabela).getAllByRole("button", { name: "Editar" }),
    ).toHaveLength(2);
  });

  it("mostra EmptyState quando não há unidades cadastradas", async () => {
    mockSucesso([]);
    render(<EstruturaOrganizacionalScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Nenhuma unidade organizacional cadastrada",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("table", { name: "Unidades organizacionais" }),
    ).not.toBeInTheDocument();
  });

  it("mostra erro e permite tentar novamente", async () => {
    mockListarEmpresas.mockRejectedValue(new Error("falha de rede"));
    mockListarUnidades.mockRejectedValue(new Error("falha de rede"));
    render(<EstruturaOrganizacionalScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Não foi possível carregar a estrutura organizacional",
        }),
      ).toBeInTheDocument(),
    );

    mockSucesso();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Unidades organizacionais" });
  });

  it("filtra por situação chamando a API com o parâmetro status", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    mockListarUnidades.mockResolvedValue({
      itens: [unidade1],
      pagina: 1,
      tamanhoPagina: 50,
      total: 1,
    } satisfies ResultadoPaginado<UnidadeOrganizacionalApi>);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });

    await waitFor(() =>
      expect(mockListarUnidades).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ativo" }),
      ),
    );
  });

  it("abre formulário de criação, valida campos e salva via API", async () => {
    mockSucesso();
    mockCriarUnidade.mockResolvedValue({
      ...unidade1,
      id: "00000000-0000-0000-0000-000000000099",
      codigo: "UNID_TESTE",
      nome: "Unidade Teste",
    });
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    fireEvent.click(screen.getByRole("button", { name: "Nova unidade" }));

    const form = screen.getByRole("form", {
      name: "Formulário de nova unidade organizacional",
    });

    // Submeter sem preencher → erros de validação
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    expect(
      await screen.findByText("Código é obrigatório."),
    ).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "UNID_TESTE" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Unidade Teste" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockCriarUnidade).toHaveBeenCalledWith({
      codigo: "UNID_TESTE",
      nome: "Unidade Teste",
      empresaId: empresaFixture.id,
    });
  });

  it("código inválido no formulário de criação exibe mensagem de erro", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    fireEvent.click(screen.getByRole("button", { name: "Nova unidade" }));

    const form = screen.getByRole("form", {
      name: "Formulário de nova unidade organizacional",
    });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "invalido com espaço" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        /Código deve conter apenas letras maiúsculas, dígitos e _/,
      ),
    ).toBeInTheDocument();
    expect(mockCriarUnidade).not.toHaveBeenCalled();
  });

  it("abre formulário de edição com código somente leitura e salva nome via API", async () => {
    mockSucesso();
    mockAtualizarUnidade.mockResolvedValue({
      ...unidade1,
      nome: "Unidade SP Atualizada",
    });
    mockListarUnidades.mockResolvedValue({
      itens: [{ ...unidade1, nome: "Unidade SP Atualizada" }, unidade2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 2,
    } satisfies ResultadoPaginado<UnidadeOrganizacionalApi>);

    render(<EstruturaOrganizacionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Unidades organizacionais",
    });

    const linhaUnidade1 = within(tabela).getByText("UNID_SP").closest("tr")!;
    fireEvent.click(
      within(linhaUnidade1).getByRole("button", { name: "Editar" }),
    );

    const form = screen.getByRole("form", {
      name: "Formulário de edição de unidade organizacional",
    });
    const campoCodigo = within(form).getByLabelText("Código", { exact: false });
    expect(campoCodigo).toHaveAttribute("readonly");
    expect(campoCodigo).toHaveValue("UNID_SP");

    const campoNome = within(form).getByLabelText("Nome", { exact: false });
    fireEvent.change(campoNome, { target: { value: "Unidade SP Atualizada" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockAtualizarUnidade).toHaveBeenCalledWith(unidade1.id, {
      nome: "Unidade SP Atualizada",
    });
  });

  it("cancelar fecha o formulário sem chamar a API", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    fireEvent.click(screen.getByRole("button", { name: "Nova unidade" }));
    expect(
      screen.getByRole("form", {
        name: "Formulário de nova unidade organizacional",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mockCriarUnidade).not.toHaveBeenCalled();
  });

  it("não contém razão social, CNPJ, nome de pessoa, endereço, documento ou valor financeiro", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "r$",
      ".pdf",
      "localstorage",
      "logradouro",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "clt",
      "cct",
      "portaria 671",
      "lgpd",
      "esocial",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("estrutura de abas é acessível: tablist com quatro tabs, aba ativa marcada", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();

    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(4);

    const abaUnidades = within(tablist).getByRole("tab", { name: "Unidades" });
    expect(abaUnidades).toHaveAttribute("aria-selected", "true");

    const abaDeps = within(tablist).getByRole("tab", { name: "Departamentos" });
    expect(abaDeps).toHaveAttribute("aria-selected", "false");

    const abaAreas = within(tablist).getByRole("tab", { name: "Áreas" });
    expect(abaAreas).toHaveAttribute("aria-selected", "false");

    const abaEquipes = within(tablist).getByRole("tab", { name: "Equipes" });
    expect(abaEquipes).toHaveAttribute("aria-selected", "false");
  });
});

describe("EstruturaOrganizacionalScreen — Departamentos (T106)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seleciona a aba Departamentos e exibe a lista", async () => {
    mockSucesso();
    mockSucessoDep();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();

    const tabela = await screen.findByRole("table", { name: "Departamentos" });
    expect(within(tabela).getByText("FIN")).toBeInTheDocument();
    expect(within(tabela).getByText("Financeiro (teste)")).toBeInTheDocument();
    expect(within(tabela).getByText("RH")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Recursos Humanos (teste)"),
    ).toBeInTheDocument();
    expect(
      within(tabela).getAllByRole("button", { name: "Editar" }),
    ).toHaveLength(2);
  });

  it("aba Departamentos marcada como ativa após seleção", async () => {
    mockSucesso();
    mockSucessoDep();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    const tablist = screen.getByRole("tablist");
    expect(
      within(tablist).getByRole("tab", { name: "Departamentos" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(tablist).getByRole("tab", { name: "Unidades" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("exibe EmptyState quando não há departamentos cadastrados", async () => {
    mockSucesso();
    mockSucessoDep([]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Nenhum departamento cadastrado",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("table", { name: "Departamentos" }),
    ).not.toBeInTheDocument();
  });

  it("exibe erro ao carregar departamentos e permite tentar novamente", async () => {
    mockSucesso();
    mockListarEmpresasMulti.mockRejectedValue(new Error("falha"));
    mockListarDepartamentos.mockRejectedValue(new Error("falha"));
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Não foi possível carregar os departamentos",
        }),
      ).toBeInTheDocument(),
    );

    mockSucessoDep();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Departamentos" });
  });

  it("abre formulário de criação, valida campos obrigatórios e salva via API", async () => {
    mockSucesso();
    mockSucessoDep([dep1]);
    mockCriarDepartamento.mockResolvedValue({
      ...dep1,
      id: "00000000-0000-0000-0000-000000000099",
      codigo: "MKT",
      nome: "Marketing",
    });
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));

    const form = screen.getByRole("form", {
      name: "Formulário de novo departamento",
    });

    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    expect(
      await screen.findByText("Código é obrigatório."),
    ).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "MKT" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Marketing" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockCriarDepartamento).toHaveBeenCalledWith({
      codigo: "MKT",
      nome: "Marketing",
      empresaId: empresaFixture.id,
    });
  });

  it("código inválido no formulário de departamento exibe mensagem de erro", async () => {
    mockSucesso();
    mockSucessoDep([dep1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));
    const form = screen.getByRole("form", {
      name: "Formulário de novo departamento",
    });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "invalido com espaco" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        /Código deve conter apenas letras maiúsculas, dígitos e _/,
      ),
    ).toBeInTheDocument();
    expect(mockCriarDepartamento).not.toHaveBeenCalled();
  });

  it("sem empresa selector quando há empresa única no criar", async () => {
    mockSucesso();
    mockSucessoDep([dep1], [empresaFixture]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));
    const form = screen.getByRole("form", {
      name: "Formulário de novo departamento",
    });

    expect(
      within(form).queryByLabelText("Empresa", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("mostra selector de empresa quando há múltiplas empresas no criar", async () => {
    mockSucesso();
    mockSucessoDep([dep1], [empresaFixture, empresa2Fixture]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));
    const form = screen.getByRole("form", {
      name: "Formulário de novo departamento",
    });

    expect(
      within(form).getByLabelText("Empresa", { exact: false }),
    ).toBeInTheDocument();
  });

  it("abre formulário de edição com código somente leitura e empresa imutável", async () => {
    mockSucesso();
    mockSucessoDep();
    mockAtualizarDepartamento.mockResolvedValue({
      ...dep1,
      nome: "Financeiro Atualizado",
    });
    mockListarDepartamentos.mockResolvedValue({
      itens: [{ ...dep1, nome: "Financeiro Atualizado" }, dep2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 2,
    } satisfies ResultadoPaginado<DepartamentoApi>);

    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    const tabela = await screen.findByRole("table", { name: "Departamentos" });

    const linhaFin = within(tabela).getByText("FIN").closest("tr")!;
    fireEvent.click(within(linhaFin).getByRole("button", { name: "Editar" }));

    const form = screen.getByRole("form", {
      name: "Formulário de edição de departamento",
    });

    const campoCodigo = within(form).getByLabelText("Código", { exact: false });
    expect(campoCodigo).toHaveAttribute("readonly");
    expect(campoCodigo).toHaveValue("FIN");

    expect(
      within(form).queryByLabelText("Empresa", { exact: false }),
    ).not.toBeInTheDocument();

    const campoNome = within(form).getByLabelText("Nome", { exact: false });
    fireEvent.change(campoNome, { target: { value: "Financeiro Atualizado" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockAtualizarDepartamento).toHaveBeenCalledWith(dep1.id, {
      nome: "Financeiro Atualizado",
    });
  });

  it("a lista é atualizada após criar um departamento", async () => {
    mockSucesso();
    mockSucessoDep([dep1]);
    const novoDep: DepartamentoApi = {
      id: "00000000-0000-0000-0000-000000000099",
      codigo: "GESTOR",
      nome: "Gestores (teste)",
      empresaId: empresaFixture.id,
      status: "ativo",
      criadoEm: "2026-01-01T00:00:00.000Z",
      atualizadoEm: "2026-01-01T00:00:00.000Z",
    };
    mockCriarDepartamento.mockResolvedValue(novoDep);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    mockListarDepartamentos.mockResolvedValue({
      itens: [dep1, novoDep],
      pagina: 1,
      tamanhoPagina: 50,
      total: 2,
    } satisfies ResultadoPaginado<DepartamentoApi>);

    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));
    const form = screen.getByRole("form", {
      name: "Formulário de novo departamento",
    });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "GESTOR" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Gestores (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const tabela = screen.getByRole("table", { name: "Departamentos" });
      expect(within(tabela).getByText("GESTOR")).toBeInTheDocument();
    });
  });

  it("cancelar formulário de departamento fecha sem chamar a API", async () => {
    mockSucesso();
    mockSucessoDep([dep1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo departamento" }));
    expect(
      screen.getByRole("form", { name: "Formulário de novo departamento" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mockCriarDepartamento).not.toHaveBeenCalled();
  });

  it("não regressão — aba Unidades funciona após ativar e retornar da aba Departamentos", async () => {
    mockSucesso();
    mockSucessoDep();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    fireEvent.click(screen.getByRole("tab", { name: "Unidades" }));

    await screen.findByRole("table", { name: "Unidades organizacionais" });
    expect(
      screen.queryByRole("table", { name: "Departamentos" }),
    ).not.toBeInTheDocument();
  });

  it("não contém razão social, CNPJ, nome de pessoa, endereço ou valor financeiro (departamentos)", async () => {
    mockSucesso();
    mockSucessoDep();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "r$",
      ".pdf",
      "localstorage",
      "logradouro",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("EstruturaOrganizacionalScreen — Áreas (T107)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seleciona a aba Áreas e exibe a lista com referência de departamento", async () => {
    mockSucesso();
    mockSucessoArea();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();

    const tabela = await screen.findByRole("table", { name: "Áreas" });
    expect(within(tabela).getByText("CONTAS")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Contas a Pagar (teste)"),
    ).toBeInTheDocument();
    expect(within(tabela).getByText("SUPORTE")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Suporte Interno (teste)"),
    ).toBeInTheDocument();
    // Departamento pai visível (código FIN aparece em ambas as linhas)
    expect(within(tabela).getAllByText("FIN")).toHaveLength(2);
    expect(
      within(tabela).getAllByRole("button", { name: "Editar" }),
    ).toHaveLength(2);
  });

  it("aba Áreas marcada como ativa após seleção", async () => {
    mockSucesso();
    mockSucessoArea();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    const tablist = screen.getByRole("tablist");
    expect(within(tablist).getByRole("tab", { name: "Áreas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      within(tablist).getByRole("tab", { name: "Unidades" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(
      within(tablist).getByRole("tab", { name: "Departamentos" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("exibe EmptyState quando não há áreas cadastradas", async () => {
    mockSucesso();
    mockSucessoArea([]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Nenhuma área cadastrada" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("table", { name: "Áreas" }),
    ).not.toBeInTheDocument();
  });

  it("exibe erro ao carregar áreas e permite tentar novamente", async () => {
    mockSucesso();
    mockListarDepartamentosParaArea.mockRejectedValue(new Error("falha"));
    mockListarAreas.mockRejectedValue(new Error("falha"));
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Não foi possível carregar as áreas",
        }),
      ).toBeInTheDocument(),
    );

    mockSucessoArea();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Áreas" });
  });

  it("abre formulário de criação, valida campos obrigatórios e salva via API", async () => {
    mockSucesso();
    mockSucessoArea([area1]);
    mockCriarArea.mockResolvedValue({
      ...area1,
      id: "00000000-0000-0000-0000-000000000099",
      codigo: "FISCAL",
      nome: "Fiscal (teste)",
    });
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    fireEvent.click(screen.getByRole("button", { name: "Nova área" }));

    const form = screen.getByRole("form", {
      name: "Formulário de nova área",
    });

    // Submeter sem preencher → erros de validação
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    expect(
      await screen.findByText("Código é obrigatório."),
    ).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "FISCAL" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Fiscal (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockCriarArea).toHaveBeenCalledWith({
      codigo: "FISCAL",
      nome: "Fiscal (teste)",
      departamentoId: dep1.id,
    });
  });

  it("código inválido no formulário de área exibe mensagem de erro", async () => {
    mockSucesso();
    mockSucessoArea([area1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    fireEvent.click(screen.getByRole("button", { name: "Nova área" }));
    const form = screen.getByRole("form", { name: "Formulário de nova área" });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "invalido com espaco" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        /Código deve conter apenas letras maiúsculas, dígitos e _/,
      ),
    ).toBeInTheDocument();
    expect(mockCriarArea).not.toHaveBeenCalled();
  });

  it("sem departamento selector quando há departamento único no criar", async () => {
    mockSucesso();
    mockSucessoArea([area1], [dep1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    fireEvent.click(screen.getByRole("button", { name: "Nova área" }));
    const form = screen.getByRole("form", {
      name: "Formulário de nova área",
    });

    expect(
      within(form).queryByLabelText("Departamento", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("mostra selector de departamento quando há múltiplos departamentos no criar", async () => {
    mockSucesso();
    mockSucessoArea([area1], [dep1, dep3]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    fireEvent.click(screen.getByRole("button", { name: "Nova área" }));
    const form = screen.getByRole("form", {
      name: "Formulário de nova área",
    });

    expect(
      within(form).getByLabelText("Departamento", { exact: false }),
    ).toBeInTheDocument();
  });

  it("nenhuma criação silenciosa no primeiro departamento quando há múltiplos", async () => {
    mockSucesso();
    mockSucessoArea([area1], [dep1, dep3]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    fireEvent.click(screen.getByRole("button", { name: "Nova área" }));
    const form = screen.getByRole("form", {
      name: "Formulário de nova área",
    });

    // Preenche código e nome, mas não seleciona departamento
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "NOVA" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Nova (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Selecione o departamento."),
    ).toBeInTheDocument();
    expect(mockCriarArea).not.toHaveBeenCalled();
  });

  it("abre formulário de edição com código somente leitura e departamento imutável", async () => {
    mockSucesso();
    mockSucessoArea([area1]);
    mockAtualizarArea.mockResolvedValue({
      ...area1,
      nome: "Contas Atualizado (teste)",
    });
    mockListarAreas.mockResolvedValue({
      itens: [{ ...area1, nome: "Contas Atualizado (teste)" }],
      pagina: 1,
      tamanhoPagina: 50,
      total: 1,
    } satisfies ResultadoPaginado<AreaApi>);

    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    const tabela = await screen.findByRole("table", { name: "Áreas" });

    const linhaArea1 = within(tabela).getByText("CONTAS").closest("tr")!;
    fireEvent.click(within(linhaArea1).getByRole("button", { name: "Editar" }));

    const form = screen.getByRole("form", {
      name: "Formulário de edição de área",
    });

    const campoCodigo = within(form).getByLabelText("Código", { exact: false });
    expect(campoCodigo).toHaveAttribute("readonly");
    expect(campoCodigo).toHaveValue("CONTAS");

    // Departamento não tem selector em modo edição (imutável)
    expect(within(form).queryByRole("combobox")).not.toBeInTheDocument();

    const campoNome = within(form).getByLabelText("Nome", { exact: false });
    fireEvent.change(campoNome, {
      target: { value: "Contas Atualizado (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockAtualizarArea).toHaveBeenCalledWith(area1.id, {
      nome: "Contas Atualizado (teste)",
    });
  });

  it("a lista é atualizada após criar uma área", async () => {
    mockSucesso();
    mockSucessoArea([area1]);
    const novaArea: AreaApi = {
      id: "00000000-0000-0000-0000-000000000099",
      codigo: "TESOU",
      nome: "Tesouraria (teste)",
      departamentoId: dep1.id,
      status: "ativo",
      criadoEm: "2026-01-01T00:00:00.000Z",
      atualizadoEm: "2026-01-01T00:00:00.000Z",
    };
    mockCriarArea.mockResolvedValue(novaArea);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    mockListarAreas.mockResolvedValue({
      itens: [area1, novaArea],
      pagina: 1,
      tamanhoPagina: 50,
      total: 2,
    } satisfies ResultadoPaginado<AreaApi>);

    fireEvent.click(screen.getByRole("button", { name: "Nova área" }));
    const form = screen.getByRole("form", { name: "Formulário de nova área" });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "TESOU" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Tesouraria (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const tabela = screen.getByRole("table", { name: "Áreas" });
      expect(within(tabela).getByText("TESOU")).toBeInTheDocument();
    });
  });

  it("cancelar formulário de área fecha sem chamar a API", async () => {
    mockSucesso();
    mockSucessoArea([area1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    fireEvent.click(screen.getByRole("button", { name: "Nova área" }));
    expect(
      screen.getByRole("form", { name: "Formulário de nova área" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mockCriarArea).not.toHaveBeenCalled();
  });

  it("não regressão — aba Unidades e aba Departamentos funcionam após navegar pela aba Áreas", async () => {
    mockSucesso();
    mockSucessoDep();
    mockSucessoArea();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    // Volta para Unidades
    fireEvent.click(screen.getByRole("tab", { name: "Unidades" }));
    await screen.findByRole("table", { name: "Unidades organizacionais" });
    expect(
      screen.queryByRole("table", { name: "Áreas" }),
    ).not.toBeInTheDocument();

    // Vai para Departamentos
    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });
    expect(
      screen.queryByRole("table", { name: "Áreas" }),
    ).not.toBeInTheDocument();
  });

  it("não contém razão social, CNPJ, nome de pessoa, endereço ou valor financeiro (áreas)", async () => {
    mockSucesso();
    mockSucessoArea();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "r$",
      ".pdf",
      "localstorage",
      "logradouro",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("EstruturaOrganizacionalScreen — Equipes (T108)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ativa aba Equipes e exibe lista com colunas Departamento e Unidade", async () => {
    mockSucesso();
    mockSucessoEquipe();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();

    const tabela = await screen.findByRole("table", { name: "Equipes" });
    expect(within(tabela).getByText("EQUIPE_FIN")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Equipe Financeira (teste)"),
    ).toBeInTheDocument();
    expect(within(tabela).getByText("EQUIPE_RH")).toBeInTheDocument();
    expect(within(tabela).getByText("Equipe RH (teste)")).toBeInTheDocument();
    expect(within(tabela).getAllByText("FIN").length).toBeGreaterThanOrEqual(1);
    expect(within(tabela).getByText("UNID_SP")).toBeInTheDocument();
  });

  it("equipes não são carregadas enquanto a aba estiver inativa", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    expect(mockListarDepartamentosParaEquipe).not.toHaveBeenCalled();
    expect(mockListarUnidadesParaEquipe).not.toHaveBeenCalled();
    expect(mockListarEquipes).not.toHaveBeenCalled();
  });

  it("exibe EmptyState quando não há equipes cadastradas", async () => {
    mockSucesso();
    mockSucessoEquipe([]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Nenhuma equipe cadastrada" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("table", { name: "Equipes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Nova equipe" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("exibe erro e botão Tentar novamente quando o carregamento falha", async () => {
    mockSucesso();
    mockListarDepartamentosParaEquipe.mockRejectedValue(new Error("falha"));
    mockListarUnidadesParaEquipe.mockRejectedValue(new Error("falha"));
    mockListarEquipes.mockRejectedValue(new Error("falha"));
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar as equipes"),
      ).toBeInTheDocument(),
    );
    const btnRetry = screen.getByRole("button", { name: "Tentar novamente" });
    expect(btnRetry).toBeInTheDocument();

    mockSucessoEquipe();
    fireEvent.click(btnRetry);
    await screen.findByRole("table", { name: "Equipes" });
  });

  it("botão Nova equipe desabilitado quando não há departamentos ativos", async () => {
    mockSucesso();
    mockSucessoEquipe([], [dep2], []);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(screen.getByText("Nenhuma equipe cadastrada")).toBeInTheDocument(),
    );

    const botao = screen.getByRole("button", { name: "Nova equipe" });
    expect(botao).toBeDisabled();
  });

  it("com único departamento ativo: abre formulário sem seletor de departamento", async () => {
    mockSucesso();
    mockSucessoEquipe([], [dep1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(screen.getByText("Nenhuma equipe cadastrada")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Nova equipe" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de nova equipe",
    });
    expect(form).toBeInTheDocument();
    expect(
      within(form).queryByLabelText(/departamento/i, { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("com múltiplos departamentos ativos: seletor obrigatório sem seleção silenciosa", async () => {
    mockSucesso();
    mockSucessoEquipe([], [dep1, dep3]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(screen.getByText("Nenhuma equipe cadastrada")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Nova equipe" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de nova equipe",
    });
    const selectDep = within(form).getByLabelText(/departamento/i, {
      exact: false,
    });
    expect(selectDep).toHaveValue("");

    const inputCodigo = within(form).getByLabelText(/código/i, {
      exact: false,
    });
    const inputNome = within(form).getByLabelText(/nome/i, { exact: false });
    fireEvent.change(inputCodigo, { target: { value: "EQ_TESTE" } });
    fireEvent.change(inputNome, { target: { value: "Equipe Teste (teste)" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByText("Selecione o departamento.")).toBeInTheDocument(),
    );
    expect(mockCriarEquipe).not.toHaveBeenCalled();
  });

  it("cria equipe com único departamento e sem unidade", async () => {
    mockSucesso();
    mockSucessoEquipe([], [dep1], []);
    mockCriarEquipe.mockResolvedValue({
      ...equipe2,
      id: "00000000-0000-0000-0000-000000000099",
    });
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Nenhuma equipe cadastrada" }),
      ).toBeInTheDocument(),
    );

    mockSucessoEquipe([equipe2], [dep1], []);
    fireEvent.click(screen.getAllByRole("button", { name: "Nova equipe" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de nova equipe",
    });

    fireEvent.change(within(form).getByLabelText(/código/i, { exact: false }), {
      target: { value: "EQ_TEST" },
    });
    fireEvent.change(within(form).getByLabelText(/nome/i, { exact: false }), {
      target: { value: "Nova Equipe (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockCriarEquipe).toHaveBeenCalledWith({
        codigo: "EQ_TEST",
        nome: "Nova Equipe (teste)",
        departamentoId: dep1.id,
      }),
    );
    await screen.findByRole("table", { name: "Equipes" });
  });

  it("cria equipe com unidade selecionada", async () => {
    mockSucesso();
    mockSucessoEquipe([], [dep1], [unidade1]);
    mockCriarEquipe.mockResolvedValue(equipe1);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Nenhuma equipe cadastrada" }),
      ).toBeInTheDocument(),
    );

    mockSucessoEquipe([equipe1], [dep1], [unidade1]);
    fireEvent.click(screen.getAllByRole("button", { name: "Nova equipe" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de nova equipe",
    });

    fireEvent.change(within(form).getByLabelText(/código/i, { exact: false }), {
      target: { value: "EQUIPE_FIN" },
    });
    fireEvent.change(within(form).getByLabelText(/nome/i, { exact: false }), {
      target: { value: "Equipe Financeira (teste)" },
    });
    const selectUnidade = within(form).getByLabelText(/unidade/i, {
      exact: false,
    });
    fireEvent.change(selectUnidade, { target: { value: unidade1.id } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockCriarEquipe).toHaveBeenCalledWith({
        codigo: "EQUIPE_FIN",
        nome: "Equipe Financeira (teste)",
        departamentoId: dep1.id,
        unidadeOrganizacionalId: unidade1.id,
      }),
    );
    await screen.findByRole("table", { name: "Equipes" });
  });

  it("valida código vazio na criação", async () => {
    mockSucesso();
    mockSucessoEquipe([], [dep1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Nenhuma equipe cadastrada" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Nova equipe" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de nova equipe",
    });
    fireEvent.change(within(form).getByLabelText(/nome/i, { exact: false }), {
      target: { value: "Equipe Válida (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByText("Código é obrigatório.")).toBeInTheDocument(),
    );
    expect(mockCriarEquipe).not.toHaveBeenCalled();
  });

  it("valida nome vazio na criação", async () => {
    mockSucesso();
    mockSucessoEquipe([], [dep1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Nenhuma equipe cadastrada" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Nova equipe" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de nova equipe",
    });
    fireEvent.change(within(form).getByLabelText(/código/i, { exact: false }), {
      target: { value: "EQ_OK" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByText("Nome é obrigatório.")).toBeInTheDocument(),
    );
    expect(mockCriarEquipe).not.toHaveBeenCalled();
  });

  it("abre formulário de edição com código somente leitura e departamento/unidade imutáveis", async () => {
    mockSucesso();
    mockSucessoEquipe([equipe1], [dep1], [unidade1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await screen.findByRole("table", { name: "Equipes" });

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de edição de equipe",
    });
    expect(form).toBeInTheDocument();

    const inputCodigo = within(form).getByDisplayValue("EQUIPE_FIN");
    expect(inputCodigo).toHaveAttribute("readonly");

    expect(
      within(form).getByDisplayValue("Equipe Financeira (teste)"),
    ).toBeInTheDocument();

    expect(
      within(form).queryByLabelText(/departamento/i, { exact: false }),
    ).not.toBeInTheDocument();
    expect(
      within(form).queryByLabelText(/unidade/i, { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("edita apenas o nome da equipe", async () => {
    mockSucesso();
    mockSucessoEquipe([equipe1], [dep1], [unidade1]);
    mockAtualizarEquipe.mockResolvedValue({
      ...equipe1,
      nome: "Equipe Financeira Editada (teste)",
    });
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await screen.findByRole("table", { name: "Equipes" });

    mockSucessoEquipe(
      [{ ...equipe1, nome: "Equipe Financeira Editada (teste)" }],
      [dep1],
      [unidade1],
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
    const form = screen.getByRole("form", {
      name: "Formulário de edição de equipe",
    });

    const inputNome = within(form).getByDisplayValue(
      "Equipe Financeira (teste)",
    );
    fireEvent.change(inputNome, {
      target: { value: "Equipe Financeira Editada (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockAtualizarEquipe).toHaveBeenCalledWith(equipe1.id, {
        nome: "Equipe Financeira Editada (teste)",
      }),
    );
    await screen.findByText("Equipe Financeira Editada (teste)");
  });

  it("cancelar formulário de equipe fecha sem chamar a API", async () => {
    mockSucesso();
    mockSucessoEquipe([equipe1]);
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await screen.findByRole("table", { name: "Equipes" });

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
    expect(
      screen.getByRole("form", { name: "Formulário de edição de equipe" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mockAtualizarEquipe).not.toHaveBeenCalled();
  });

  it("não regressão — Unidades, Departamentos e Áreas funcionam após navegar pela aba Equipes", async () => {
    mockSucesso();
    mockSucessoDep();
    mockSucessoArea();
    mockSucessoEquipe();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await screen.findByRole("table", { name: "Equipes" });

    fireEvent.click(screen.getByRole("tab", { name: "Unidades" }));
    await screen.findByRole("table", { name: "Unidades organizacionais" });
    expect(
      screen.queryByRole("table", { name: "Equipes" }),
    ).not.toBeInTheDocument();

    await ativarAbaDepartamentos();
    await screen.findByRole("table", { name: "Departamentos" });

    await ativarAbaAreas();
    await screen.findByRole("table", { name: "Áreas" });
    expect(
      screen.queryByRole("table", { name: "Equipes" }),
    ).not.toBeInTheDocument();
  });

  it("não contém razão social, CNPJ, nome de pessoa, endereço ou valor financeiro (equipes)", async () => {
    mockSucesso();
    mockSucessoEquipe();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    await ativarAbaEquipes();
    await screen.findByRole("table", { name: "Equipes" });

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "r$",
      ".pdf",
      "localstorage",
      "logradouro",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
