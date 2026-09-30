import {
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
    expect(listarColaboradores).toHaveBeenLastCalledWith({});
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
    // O gatilho aponta para o painel, e o painel é nomeado pelo título focado.
    const painel = titulo.closest("section");
    expect(abrir.getAttribute("aria-controls")).toBe(painel?.id);
    expect(painel).toHaveAttribute("aria-labelledby", titulo.id);
  });

  it("Escape fecha o painel e devolve o foco a quem o abriu", async () => {
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

  it("o detalhe também recebe o foco e fecha com Escape", async () => {
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
});
