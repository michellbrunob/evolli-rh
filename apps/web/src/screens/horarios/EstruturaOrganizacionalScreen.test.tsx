import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DepartamentoApi,
  EmpresaApi,
  ResultadoPaginado,
  UnidadeOrganizacionalApi,
} from "../../api/organizacaoClient";
import { EstruturaOrganizacionalScreen } from "./EstruturaOrganizacionalScreen";

vi.mock("../../api/organizacaoClient");

import {
  atualizarDepartamento,
  atualizarUnidade,
  criarDepartamento,
  criarUnidade,
  listarDepartamentos,
  listarEmpresas,
  listarEmpresasMulti,
  listarUnidades,
} from "../../api/organizacaoClient";

const mockListarEmpresas = vi.mocked(listarEmpresas);
const mockListarUnidades = vi.mocked(listarUnidades);
const mockCriarUnidade = vi.mocked(criarUnidade);
const mockAtualizarUnidade = vi.mocked(atualizarUnidade);
const mockListarEmpresasMulti = vi.mocked(listarEmpresasMulti);
const mockListarDepartamentos = vi.mocked(listarDepartamentos);
const mockCriarDepartamento = vi.mocked(criarDepartamento);
const mockAtualizarDepartamento = vi.mocked(atualizarDepartamento);

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

async function ativarAbaDepartamentos() {
  fireEvent.click(screen.getByRole("tab", { name: "Departamentos" }));
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

  it("estrutura de abas é acessível: tablist com dois tabs, aba ativa marcada", async () => {
    mockSucesso();
    render(<EstruturaOrganizacionalScreen />);
    await screen.findByRole("table", { name: "Unidades organizacionais" });

    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();

    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(2);

    const abaUnidades = within(tablist).getByRole("tab", { name: "Unidades" });
    expect(abaUnidades).toHaveAttribute("aria-selected", "true");

    const abaDeps = within(tablist).getByRole("tab", { name: "Departamentos" });
    expect(abaDeps).toHaveAttribute("aria-selected", "false");
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
