import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CentroCustoApi,
  EmpresaApi,
  ResultadoPaginado,
} from "../../api/organizacaoClient";
import { CentrosCustoScreen } from "./CentrosCustoScreen";

vi.mock("../../api/organizacaoClient");

import {
  atualizarCentroCusto,
  criarCentroCusto,
  listarCentrosCusto,
  listarEmpresasParaCentroCusto,
} from "../../api/organizacaoClient";

const mockListarEmpresas = vi.mocked(listarEmpresasParaCentroCusto);
const mockListarCentrosCusto = vi.mocked(listarCentrosCusto);
const mockCriarCentroCusto = vi.mocked(criarCentroCusto);
const mockAtualizarCentroCusto = vi.mocked(atualizarCentroCusto);

const empresaFixture: EmpresaApi = {
  id: "00000000-0000-0000-0000-000000000001",
  codigo: "EMP-01",
  nome: "Empresa Exemplo (teste)",
  status: "ativo",
};

const empresaB: EmpresaApi = {
  id: "00000000-0000-0000-0000-000000000002",
  codigo: "EMP-02",
  nome: "Empresa B (teste)",
  status: "ativo",
};

const cc1: CentroCustoApi = {
  id: "00000000-0000-0000-0000-000000000011",
  empresaId: empresaFixture.id,
  codigo: "CC_ADM",
  nome: "Centro Administrativo (teste)",
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const cc2: CentroCustoApi = {
  id: "00000000-0000-0000-0000-000000000012",
  empresaId: empresaFixture.id,
  codigo: "CC_OPS",
  nome: "Centro Operacional (teste)",
  status: "inativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

function mockSucesso(lista: CentroCustoApi[] = [cc1, cc2]) {
  mockListarEmpresas.mockResolvedValue({
    itens: [empresaFixture],
    pagina: 1,
    tamanhoPagina: 100,
    total: 1,
  } satisfies ResultadoPaginado<EmpresaApi>);
  mockListarCentrosCusto.mockResolvedValue({
    itens: lista,
    pagina: 1,
    tamanhoPagina: 50,
    total: lista.length,
  } satisfies ResultadoPaginado<CentroCustoApi>);
}

function mockMultiEmpresa() {
  mockListarEmpresas.mockResolvedValue({
    itens: [empresaFixture, empresaB],
    pagina: 1,
    tamanhoPagina: 100,
    total: 2,
  } satisfies ResultadoPaginado<EmpresaApi>);
  mockListarCentrosCusto.mockResolvedValue({
    itens: [cc1],
    pagina: 1,
    tamanhoPagina: 50,
    total: 1,
  } satisfies ResultadoPaginado<CentroCustoApi>);
}

describe("CentrosCustoScreen (T109 — funcional)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tem um único h1", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Centros de custo" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("exibe os avisos de escopo, auditoria e referências organizacionais", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);

    await waitFor(() =>
      expect(screen.getByText("Somente RH")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Somente o RH da própria empresa administra centros/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Auditado")).toBeInTheDocument();
    expect(
      screen.getByText(/geram trilha de auditoria automática/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Referências organizacionais")).toBeInTheDocument();
    expect(
      screen.getByText(
        /cargo, função, departamento, centro de custo e estrutura são referências distintas/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista centros de custo com código, nome, situação e botão Editar", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);

    const tabela = await screen.findByRole("table", {
      name: "Centros de custo",
    });
    expect(within(tabela).getByText("CC_ADM")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Centro Administrativo (teste)"),
    ).toBeInTheDocument();
    expect(within(tabela).getByText("Ativo")).toBeInTheDocument();
    expect(within(tabela).getByText("CC_OPS")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Centro Operacional (teste)"),
    ).toBeInTheDocument();
    expect(within(tabela).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(tabela).getAllByRole("button", { name: "Editar" }),
    ).toHaveLength(2);
  });

  it("status 'ativo' exibe rótulo 'Ativo' e 'inativo' exibe 'Inativo'", async () => {
    mockSucesso([cc1, cc2]);
    render(<CentrosCustoScreen />);

    const tabela = await screen.findByRole("table", {
      name: "Centros de custo",
    });
    const linhaAtivo = within(tabela).getByText("CC_ADM").closest("tr")!;
    expect(within(linhaAtivo).getByText("Ativo")).toBeInTheDocument();
    const linhaInativo = within(tabela).getByText("CC_OPS").closest("tr")!;
    expect(within(linhaInativo).getByText("Inativo")).toBeInTheDocument();
  });

  it("mostra EmptyState quando não há centros de custo", async () => {
    mockSucesso([]);
    render(<CentrosCustoScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Nenhum centro de custo cadastrado",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("table", { name: "Centros de custo" }),
    ).not.toBeInTheDocument();
  });

  it("mostra erro e permite tentar novamente", async () => {
    mockListarEmpresas.mockRejectedValue(new Error("falha de rede"));
    mockListarCentrosCusto.mockRejectedValue(new Error("falha de rede"));
    render(<CentrosCustoScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Não foi possível carregar os centros de custo",
        }),
      ).toBeInTheDocument(),
    );

    mockSucesso();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Centros de custo" });
  });

  it("filtra por situação chamando a API com o parâmetro status correto", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    mockListarCentrosCusto.mockResolvedValue({
      itens: [cc1],
      pagina: 1,
      tamanhoPagina: 50,
      total: 1,
    } satisfies ResultadoPaginado<CentroCustoApi>);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });

    await waitFor(() =>
      expect(mockListarCentrosCusto).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ativo" }),
      ),
    );
  });

  it("o filtro envia 'inativo' (não 'inativa') para a API", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    mockListarCentrosCusto.mockResolvedValue({
      itens: [cc2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 1,
    } satisfies ResultadoPaginado<CentroCustoApi>);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "inativo" },
    });

    await waitFor(() =>
      expect(mockListarCentrosCusto).toHaveBeenCalledWith(
        expect.objectContaining({ status: "inativo" }),
      ),
    );
  });

  it("abre formulário de criação, valida campos e salva via API (empresa única auto-determinada)", async () => {
    mockSucesso();
    mockCriarCentroCusto.mockResolvedValue({
      ...cc1,
      id: "00000000-0000-0000-0000-000000000099",
      codigo: "CC_FIN",
      nome: "Centro Financeiro (teste)",
    });
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Novo centro de custo" })[0]!,
    );

    const form = screen.getByRole("form", {
      name: "Formulário de novo centro de custo",
    });

    // Sem empresa selector (única empresa no escopo)
    expect(
      within(form).queryByLabelText("Empresa", { exact: false }),
    ).not.toBeInTheDocument();

    // Submeter sem preencher → erros de validação
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    expect(
      await screen.findByText("Código é obrigatório."),
    ).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "CC_FIN" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Centro Financeiro (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockCriarCentroCusto).toHaveBeenCalledWith({
      codigo: "CC_FIN",
      nome: "Centro Financeiro (teste)",
      empresaId: empresaFixture.id,
    });
  });

  it("código inválido exibe mensagem de erro", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Novo centro de custo" })[0]!,
    );
    const form = screen.getByRole("form", {
      name: "Formulário de novo centro de custo",
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
    expect(mockCriarCentroCusto).not.toHaveBeenCalled();
  });

  it("exige seleção explícita de empresa quando há mais de uma no escopo", async () => {
    mockMultiEmpresa();
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Novo centro de custo" })[0]!,
    );
    const form = screen.getByRole("form", {
      name: "Formulário de novo centro de custo",
    });

    // Seletor de empresa deve estar visível
    expect(
      within(form).getByLabelText("Empresa", { exact: false }),
    ).toBeInTheDocument();

    // Submeter sem selecionar empresa → erro
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "CC_FIN" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Centro Financeiro (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione a empresa.")).toBeInTheDocument();
    expect(mockCriarCentroCusto).not.toHaveBeenCalled();
  });

  it("permite criar com seleção explícita de empresa em escopo multi-empresa", async () => {
    mockMultiEmpresa();
    mockCriarCentroCusto.mockResolvedValue({
      ...cc1,
      empresaId: empresaB.id,
      codigo: "CC_FIN",
      nome: "Centro Financeiro (teste)",
    });
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Novo centro de custo" })[0]!,
    );
    const form = screen.getByRole("form", {
      name: "Formulário de novo centro de custo",
    });

    fireEvent.change(within(form).getByLabelText("Empresa", { exact: false }), {
      target: { value: empresaB.id },
    });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "CC_FIN" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Centro Financeiro (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockCriarCentroCusto).toHaveBeenCalledWith({
      codigo: "CC_FIN",
      nome: "Centro Financeiro (teste)",
      empresaId: empresaB.id,
    });
  });

  it("abre formulário de edição com código somente leitura e salva nome via API", async () => {
    mockSucesso();
    mockAtualizarCentroCusto.mockResolvedValue({
      ...cc1,
      nome: "Centro Administrativo Pleno (teste)",
    });
    mockListarCentrosCusto.mockResolvedValue({
      itens: [{ ...cc1, nome: "Centro Administrativo Pleno (teste)" }, cc2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 2,
    } satisfies ResultadoPaginado<CentroCustoApi>);

    render(<CentrosCustoScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Centros de custo",
    });

    const linhaAdm = within(tabela).getByText("CC_ADM").closest("tr")!;
    fireEvent.click(within(linhaAdm).getByRole("button", { name: "Editar" }));

    const form = screen.getByRole("form", {
      name: "Formulário de edição de centro de custo",
    });
    const campoCodigo = within(form).getByLabelText("Código", { exact: false });
    expect(campoCodigo).toHaveAttribute("readonly");
    expect(campoCodigo).toHaveValue("CC_ADM");

    const campoNome = within(form).getByLabelText("Nome", { exact: false });
    fireEvent.change(campoNome, {
      target: { value: "Centro Administrativo Pleno (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockAtualizarCentroCusto).toHaveBeenCalledWith(cc1.id, {
      nome: "Centro Administrativo Pleno (teste)",
    });
  });

  it("cancelar fecha o formulário sem chamar a API", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Novo centro de custo" })[0]!,
    );
    expect(
      screen.getByRole("form", {
        name: "Formulário de novo centro de custo",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mockCriarCentroCusto).not.toHaveBeenCalled();
  });

  it("a lista é atualizada após criar um centro de custo", async () => {
    mockSucesso([cc1]);
    mockCriarCentroCusto.mockResolvedValue({
      ...cc2,
      id: "00000000-0000-0000-0000-000000000099",
    });
    mockListarCentrosCusto
      .mockResolvedValueOnce({
        itens: [cc1],
        pagina: 1,
        tamanhoPagina: 50,
        total: 1,
      } satisfies ResultadoPaginado<CentroCustoApi>)
      .mockResolvedValue({
        itens: [cc1, cc2],
        pagina: 1,
        tamanhoPagina: 50,
        total: 2,
      } satisfies ResultadoPaginado<CentroCustoApi>);

    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Novo centro de custo" })[0]!,
    );
    const form = screen.getByRole("form", {
      name: "Formulário de novo centro de custo",
    });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "CC_OPS" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Centro Operacional (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const tabela = screen.getByRole("table", { name: "Centros de custo" });
      expect(within(tabela).getByText("CC_OPS")).toBeInTheDocument();
    });
  });

  it("não contém dados sensíveis, marca de terceiro ou valor financeiro", async () => {
    mockSucesso();
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

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
    render(<CentrosCustoScreen />);
    await screen.findByRole("table", { name: "Centros de custo" });

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
