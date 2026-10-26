import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CargoApi,
  EmpresaApi,
  ResultadoPaginado,
} from "../../api/cargoClient";
import { FuncoesCargosScreen } from "./FuncoesCargosScreen";

vi.mock("../../api/cargoClient");

import {
  atualizarCargo,
  criarCargo,
  listarCargos,
  listarEmpresas,
} from "../../api/cargoClient";

const mockListarEmpresas = vi.mocked(listarEmpresas);
const mockListarCargos = vi.mocked(listarCargos);
const mockCriarCargo = vi.mocked(criarCargo);
const mockAtualizarCargo = vi.mocked(atualizarCargo);

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

const cargo1: CargoApi = {
  id: "00000000-0000-0000-0000-000000000011",
  codigo: "ANALISTA",
  nome: "Analista (teste)",
  empresaId: empresaFixture.id,
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

const cargo2: CargoApi = {
  id: "00000000-0000-0000-0000-000000000012",
  codigo: "GESTOR",
  nome: "Gestor (teste)",
  empresaId: empresaFixture.id,
  status: "inativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

function mockSucesso(cargosLista: CargoApi[] = [cargo1, cargo2]) {
  mockListarEmpresas.mockResolvedValue({
    itens: [empresaFixture],
    pagina: 1,
    tamanhoPagina: 100,
    total: 1,
  } satisfies ResultadoPaginado<EmpresaApi>);
  mockListarCargos.mockResolvedValue({
    itens: cargosLista,
    pagina: 1,
    tamanhoPagina: 50,
    total: cargosLista.length,
  } satisfies ResultadoPaginado<CargoApi>);
}

function mockMultiEmpresa() {
  mockListarEmpresas.mockResolvedValue({
    itens: [empresaFixture, empresaB],
    pagina: 1,
    tamanhoPagina: 100,
    total: 2,
  } satisfies ResultadoPaginado<EmpresaApi>);
  mockListarCargos.mockResolvedValue({
    itens: [cargo1],
    pagina: 1,
    tamanhoPagina: 50,
    total: 1,
  } satisfies ResultadoPaginado<CargoApi>);
}

describe("FuncoesCargosScreen (T105 — funcional)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tem um único h1", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Funções e cargos" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("exibe os avisos de escopo, auditoria e referências organizacionais", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);

    await waitFor(() =>
      expect(screen.getByText("Somente RH")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        /Somente o RH da própria empresa administra o catálogo/i,
      ),
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

  it("exibe a seção de Funções como referência não operacional sem formulário", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);

    await waitFor(() =>
      expect(
        screen.getByText("Funções — referência pendente"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Funções não possuem ainda um modelo de domínio/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("form", {
        name: /formulário.*função/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("lista cargos com código, nome, situação e botão Editar", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);

    const tabela = await screen.findByRole("table", { name: "Cargos" });
    expect(within(tabela).getByText("ANALISTA")).toBeInTheDocument();
    expect(within(tabela).getByText("Analista (teste)")).toBeInTheDocument();
    expect(within(tabela).getByText("Ativa")).toBeInTheDocument();
    expect(within(tabela).getByText("GESTOR")).toBeInTheDocument();
    expect(within(tabela).getByText("Gestor (teste)")).toBeInTheDocument();
    expect(within(tabela).getByText("Inativa")).toBeInTheDocument();
    expect(
      within(tabela).getAllByRole("button", { name: "Editar" }),
    ).toHaveLength(2);
  });

  it("status 'ativo' exibe rótulo 'Ativa' e 'inativo' exibe 'Inativa'", async () => {
    mockSucesso([cargo1, cargo2]);
    render(<FuncoesCargosScreen podeOperar />);

    const tabela = await screen.findByRole("table", { name: "Cargos" });
    const linhaAtivo = within(tabela).getByText("ANALISTA").closest("tr")!;
    expect(within(linhaAtivo).getByText("Ativa")).toBeInTheDocument();
    const linhaInativo = within(tabela).getByText("GESTOR").closest("tr")!;
    expect(within(linhaInativo).getByText("Inativa")).toBeInTheDocument();
  });

  it("mostra EmptyState quando não há cargos", async () => {
    mockSucesso([]);
    render(<FuncoesCargosScreen podeOperar />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Nenhum cargo cadastrado" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("table", { name: "Cargos" }),
    ).not.toBeInTheDocument();
  });

  it("mostra erro e permite tentar novamente", async () => {
    mockListarEmpresas.mockRejectedValue(new Error("falha de rede"));
    mockListarCargos.mockRejectedValue(new Error("falha de rede"));
    render(<FuncoesCargosScreen podeOperar />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Não foi possível carregar os cargos",
        }),
      ).toBeInTheDocument(),
    );

    mockSucesso();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Cargos" });
  });

  it("filtra por situação chamando a API com o parâmetro status correto", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    mockListarCargos.mockResolvedValue({
      itens: [cargo1],
      pagina: 1,
      tamanhoPagina: 50,
      total: 1,
    } satisfies ResultadoPaginado<CargoApi>);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });

    await waitFor(() =>
      expect(mockListarCargos).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ativo" }),
      ),
    );
  });

  it("o filtro envia 'inativo' (não 'inativa') para a API", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    mockListarCargos.mockResolvedValue({
      itens: [cargo2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 1,
    } satisfies ResultadoPaginado<CargoApi>);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "inativo" },
    });

    await waitFor(() =>
      expect(mockListarCargos).toHaveBeenCalledWith(
        expect.objectContaining({ status: "inativo" }),
      ),
    );
  });

  it("abre formulário de criação, valida campos e salva via API (empresa única auto-determinada)", async () => {
    mockSucesso();
    mockCriarCargo.mockResolvedValue({
      ...cargo1,
      id: "00000000-0000-0000-0000-000000000099",
      codigo: "COORD",
      nome: "Coordenador (teste)",
    });
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo cargo" }));

    const form = screen.getByRole("form", {
      name: "Formulário de novo cargo",
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
      target: { value: "COORD" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Coordenador (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockCriarCargo).toHaveBeenCalledWith({
      codigo: "COORD",
      nome: "Coordenador (teste)",
      empresaId: empresaFixture.id,
    });
  });

  it("código inválido exibe mensagem de erro", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo cargo" }));
    const form = screen.getByRole("form", { name: "Formulário de novo cargo" });

    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "invalido com espaco" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        /Código deve conter apenas letras maiúsculas, dígitos e _/,
      ),
    ).toBeInTheDocument();
    expect(mockCriarCargo).not.toHaveBeenCalled();
  });

  it("exige seleção explícita de empresa quando há mais de uma no escopo", async () => {
    mockMultiEmpresa();
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo cargo" }));
    const form = screen.getByRole("form", { name: "Formulário de novo cargo" });

    // Seletor de empresa deve estar visível
    expect(
      within(form).getByLabelText("Empresa", { exact: false }),
    ).toBeInTheDocument();

    // Submeter sem selecionar empresa → erro
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "COORD" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Coordenador (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione a empresa.")).toBeInTheDocument();
    expect(mockCriarCargo).not.toHaveBeenCalled();
  });

  it("permite criar com seleção explícita de empresa em escopo multi-empresa", async () => {
    mockMultiEmpresa();
    mockCriarCargo.mockResolvedValue({
      ...cargo1,
      empresaId: empresaB.id,
      codigo: "COORD",
      nome: "Coordenador (teste)",
    });
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo cargo" }));
    const form = screen.getByRole("form", { name: "Formulário de novo cargo" });

    fireEvent.change(within(form).getByLabelText("Empresa", { exact: false }), {
      target: { value: empresaB.id },
    });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "COORD" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Coordenador (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockCriarCargo).toHaveBeenCalledWith({
      codigo: "COORD",
      nome: "Coordenador (teste)",
      empresaId: empresaB.id,
    });
  });

  it("abre formulário de edição com código somente leitura e salva nome via API", async () => {
    mockSucesso();
    mockAtualizarCargo.mockResolvedValue({
      ...cargo1,
      nome: "Analista Pleno (teste)",
    });
    mockListarCargos.mockResolvedValue({
      itens: [{ ...cargo1, nome: "Analista Pleno (teste)" }, cargo2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 2,
    } satisfies ResultadoPaginado<CargoApi>);

    render(<FuncoesCargosScreen podeOperar />);
    const tabela = await screen.findByRole("table", { name: "Cargos" });

    const linhaAnalista = within(tabela).getByText("ANALISTA").closest("tr")!;
    fireEvent.click(
      within(linhaAnalista).getByRole("button", { name: "Editar" }),
    );

    const form = screen.getByRole("form", {
      name: "Formulário de edição de cargo",
    });
    const campoCodigo = within(form).getByLabelText("Código", { exact: false });
    expect(campoCodigo).toHaveAttribute("readonly");
    expect(campoCodigo).toHaveValue("ANALISTA");

    const campoNome = within(form).getByLabelText("Nome", { exact: false });
    fireEvent.change(campoNome, {
      target: { value: "Analista Pleno (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );
    expect(mockAtualizarCargo).toHaveBeenCalledWith(cargo1.id, {
      nome: "Analista Pleno (teste)",
    });
  });

  it("cancelar fecha o formulário sem chamar a API", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo cargo" }));
    expect(
      screen.getByRole("form", { name: "Formulário de novo cargo" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mockCriarCargo).not.toHaveBeenCalled();
  });

  it("a lista é atualizada após criar um cargo", async () => {
    mockSucesso([cargo1]);
    mockCriarCargo.mockResolvedValue({
      ...cargo2,
      id: "00000000-0000-0000-0000-000000000099",
    });
    // Após criar, a listagem retorna os dois cargos
    mockListarCargos
      .mockResolvedValueOnce({
        itens: [cargo1],
        pagina: 1,
        tamanhoPagina: 50,
        total: 1,
      } satisfies ResultadoPaginado<CargoApi>)
      .mockResolvedValue({
        itens: [cargo1, cargo2],
        pagina: 1,
        tamanhoPagina: 50,
        total: 2,
      } satisfies ResultadoPaginado<CargoApi>);

    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

    fireEvent.click(screen.getByRole("button", { name: "Novo cargo" }));
    const form = screen.getByRole("form", { name: "Formulário de novo cargo" });
    fireEvent.change(within(form).getByLabelText("Código", { exact: false }), {
      target: { value: "GESTOR" },
    });
    fireEvent.change(within(form).getByLabelText("Nome", { exact: false }), {
      target: { value: "Gestor (teste)" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const tabela = screen.getByRole("table", { name: "Cargos" });
      expect(within(tabela).getByText("GESTOR")).toBeInTheDocument();
    });
  });

  it("não contém dados sensíveis, marca de terceiro ou valor financeiro", async () => {
    mockSucesso();
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

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
    render(<FuncoesCargosScreen podeOperar />);
    await screen.findByRole("table", { name: "Cargos" });

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

/**
 * T182 — controles de escrita visíveis: criar ("Nova…"/"Novo…"), editar,
 * inativar e reativar. Para um perfil leitor, como o DP, a lista é vazia.
 */
function botoesDeEscrita(): HTMLElement[] {
  return screen
    .queryAllByRole("button")
    .filter((b) =>
      /^(Nova|Novo|Editar|Inativar|Reativar)\b/.test(
        b.textContent?.trim() ?? "",
      ),
    );
}

describe("FuncoesCargosScreen — perfil leitor, como o DP (T182)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSucesso();
  });

  it("diz 'Somente consulta' e lista sem nenhum controle de escrita", async () => {
    render(<FuncoesCargosScreen />);

    expect(screen.getByText("Somente consulta")).toBeInTheDocument();
    expect(screen.queryByText("Somente RH")).toBeNull();
    expect(
      await screen.findAllByRole("cell", { name: cargo1.nome }),
    ).not.toHaveLength(0);
    expect(botoesDeEscrita()).toEqual([]);
    expect(screen.queryByRole("columnheader", { name: "Ações" })).toBeNull();
    expect(mockCriarCargo).not.toHaveBeenCalled();
  });

  it("estado vazio para o leitor não oferece criar", async () => {
    mockSucesso([]);
    render(<FuncoesCargosScreen />);
    await screen.findByText("Nenhum cargo cadastrado");
    expect(botoesDeEscrita()).toEqual([]);
  });

  it("o RH (quem opera) mantém criar, editar e inativar", async () => {
    render(<FuncoesCargosScreen podeOperar />);
    expect(
      await screen.findAllByRole("cell", { name: cargo1.nome }),
    ).not.toHaveLength(0);
    const rotulos = botoesDeEscrita().map((b) => b.textContent?.trim());
    expect(rotulos).toContain("Novo cargo");
    expect(rotulos).toContain("Editar");
    expect(rotulos.some((r) => /^(Inativar|Reativar)/.test(r ?? ""))).toBe(
      true,
    );
  });
});
