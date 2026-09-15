import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EmpresaApi,
  ResultadoPaginado,
  UnidadeOrganizacionalApi,
} from "../../api/organizacaoClient";
import { EstruturaOrganizacionalScreen } from "./EstruturaOrganizacionalScreen";

vi.mock("../../api/organizacaoClient");

import {
  atualizarUnidade,
  criarUnidade,
  listarEmpresas,
  listarUnidades,
} from "../../api/organizacaoClient";

const mockListarEmpresas = vi.mocked(listarEmpresas);
const mockListarUnidades = vi.mocked(listarUnidades);
const mockCriarUnidade = vi.mocked(criarUnidade);
const mockAtualizarUnidade = vi.mocked(atualizarUnidade);

const empresaFixture: EmpresaApi = {
  id: "00000000-0000-0000-0000-000000000001",
  codigo: "EMP-01",
  nome: "Empresa Exemplo (teste)",
  status: "ativa",
};

const unidade1: UnidadeOrganizacionalApi = {
  id: "00000000-0000-0000-0000-000000000011",
  codigo: "UNID_SP",
  nome: "Unidade São Paulo (teste)",
  empresaId: empresaFixture.id,
  status: "ativa",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const unidade2: UnidadeOrganizacionalApi = {
  id: "00000000-0000-0000-0000-000000000012",
  codigo: "UNID_RJ",
  nome: "Unidade Rio de Janeiro (teste)",
  empresaId: empresaFixture.id,
  status: "inativa",
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
      target: { value: "ativa" },
    });

    await waitFor(() =>
      expect(mockListarUnidades).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ativa" }),
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
});
