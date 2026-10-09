import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PessoasDocumentosScreen } from "./PessoasDocumentosScreen";
import { obterUsuarioAtual } from "../../api/usersClient";
import {
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import {
  ApiError,
  criarDocumento,
  criarSolicitacaoDocumento,
  listarDocumentos,
  listarSolicitacoesDocumento,
  listarTiposDocumento,
  substituirDocumento,
} from "../../api/documentosClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});

vi.mock("../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/colaboradoresClient")
  >("../../api/colaboradoresClient");
  return {
    ...actual,
    listarColaboradores: vi.fn(),
    listarVinculosDoColaborador: vi.fn(),
  };
});

vi.mock("../../api/documentosClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/documentosClient")
  >("../../api/documentosClient");
  return {
    ...actual,
    listarTiposDocumento: vi.fn(),
    listarDocumentos: vi.fn(),
    listarSolicitacoesDocumento: vi.fn(),
    criarDocumento: vi.fn(),
    substituirDocumento: vi.fn(),
    criarSolicitacaoDocumento: vi.fn(),
  };
});

const RH = {
  id: "rh-1",
  email: "rh@example.test",
  role: "rh",
  companyId: "emp-1",
  unitId: null,
  teamId: null,
  status: "active",
  createdAt: "2026-01-01T10:00:00.000Z",
};

const COLAB_1 = {
  id: "colab-1",
  nome: "Colaborador Um",
  situacao: "ativo" as const,
  criadoEm: "2026-01-01T10:00:00.000Z",
  atualizadoEm: "2026-01-01T10:00:00.000Z",
};
const COLAB_2 = { ...COLAB_1, id: "colab-2", nome: "Colaborador Dois" };

const TIPO = {
  id: "tipo-1",
  empresaId: "emp-1",
  codigo: "RG",
  nome: "Documento de identidade",
  classificacao: "restrito",
  criadoEm: "2026-01-01T10:00:00.000Z",
  atualizadoEm: "2026-01-01T10:00:00.000Z",
};

const DOC = {
  id: "doc-1",
  empresaId: "emp-1",
  colaboradorId: "colab-1",
  tipoDocumentoId: "tipo-1",
  estado: "upload_desabilitado" as const,
  substituiDocumentoId: null,
  criadoEm: "2026-02-01T09:00:00.000Z",
  atualizadoEm: "2026-02-01T09:00:00.000Z",
};

const SOLIC = {
  id: "solic-1",
  empresaId: "emp-1",
  colaboradorId: "colab-1",
  tipoDocumentoId: "tipo-1",
  estado: "pendente" as const,
  solicitanteUserId: "rh-1",
  solicitadaEm: "2026-02-02T09:00:00.000Z",
  criadoEm: "2026-02-02T09:00:00.000Z",
  atualizadoEm: "2026-02-02T09:00:00.000Z",
};

function pagina<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 20, total: itens.length };
}

function configurarPadrao(overrides?: {
  ator?: unknown;
  colaboradores?: unknown[];
}) {
  vi.mocked(obterUsuarioAtual).mockResolvedValue(
    (overrides?.ator ?? RH) as never,
  );
  vi.mocked(listarTiposDocumento).mockResolvedValue(pagina([TIPO]) as never);
  vi.mocked(listarColaboradores).mockResolvedValue(
    pagina(overrides?.colaboradores ?? [COLAB_1, COLAB_2]) as never,
  );
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([] as never);
  vi.mocked(listarDocumentos).mockResolvedValue(pagina([DOC]) as never);
  vi.mocked(listarSolicitacoesDocumento).mockResolvedValue(
    pagina([SOLIC]) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  configurarPadrao();
});

describe("PessoasDocumentosScreen (T133 — funcional)", () => {
  it("tem um único h1 'Documentos'", async () => {
    render(<PessoasDocumentosScreen />);
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Documentos" }),
    ).toHaveLength(1);
    await screen.findByLabelText("Selecione o colaborador");
  });

  it("múltiplos colaboradores: não seleciona em silêncio (nenhuma lista carregada)", async () => {
    render(<PessoasDocumentosScreen />);
    const select = (await screen.findByLabelText(
      "Selecione o colaborador",
    )) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(listarDocumentos).not.toHaveBeenCalled();
  });

  it("um único colaborador: seleciona-o e carrega documentos e solicitações", async () => {
    configurarPadrao({ colaboradores: [COLAB_1] });
    render(<PessoasDocumentosScreen />);
    await waitFor(() =>
      expect(listarDocumentos).toHaveBeenCalledWith(
        expect.objectContaining({ colaboradorId: "colab-1" }),
      ),
    );
    expect(
      (await screen.findAllByText("Documento de identidade (RG)")).length,
    ).toBeGreaterThan(0);
  });

  it("zero colaboradores: estado vazio, sem seleção", async () => {
    configurarPadrao({ colaboradores: [] });
    render(<PessoasDocumentosScreen />);
    expect(
      await screen.findByText("Nenhum colaborador no seu escopo"),
    ).toBeInTheDocument();
  });

  it("erro ao carregar colaboradores mostra nova tentativa e recarrega", async () => {
    vi.mocked(listarColaboradores)
      .mockRejectedValueOnce(new ApiError(500, "x"))
      .mockResolvedValueOnce(pagina([COLAB_1]) as never);
    render(<PessoasDocumentosScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      await screen.findByLabelText("Selecione o colaborador"),
    ).toBeInTheDocument();
  });

  it("seleção de colaborador lista documentos com tipo, estado e detalhe só leitura", async () => {
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    expect(
      (await screen.findAllByText("Documento de identidade (RG)")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Registrado (sem conteúdo)").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /Ver detalhe/ })[0]!);
    expect(
      await screen.findByRole("heading", { name: "Detalhe do documento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nenhum conteúdo, arquivo, upload, download/i),
    ).toBeInTheDocument();

    // Asserção POSITIVA de data — e vem ANTES da guarda, de propósito.
    // A guarda só sabe dizer que não há ISO na tela; ela passa igualmente se
    // TODAS as datas virarem `—`. Sem a linha abaixo, apertar a gramática do
    // formatador até quebrar esta tela não faria nenhum teste falhar.
    // `criadoEm` é `2026-02-01T09:00:00.000Z`; em São Paulo são 06:00 do dia 1.
    expect(screen.getAllByText("01/02/2026 às 06:00").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText(/^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/).length,
    ).toBeGreaterThanOrEqual(2);

    // Guarda da T154: varre o texto visível inteiro da tela — tabela de
    // documentos, tabela de solicitações e o detalhe aberto acima —, não só
    // os trechos que este teste nomeia. O `value` de campo de formulário fica
    // fora do alcance por ser atributo: ali o ISO é contrato, não
    // apresentação, e deve continuar cru.
    expectSemIsoVisivel(document.body);
  });

  it("documentos vazios mostram estado vazio", async () => {
    vi.mocked(listarDocumentos).mockResolvedValue(pagina([]) as never);
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    expect(
      await screen.findByText("Nenhum documento para este colaborador"),
    ).toBeInTheDocument();
  });

  it("filtro por estado envia o estado ao backend", async () => {
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    await screen.findAllByText("Documento de identidade (RG)");
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "substituido" },
    });
    await waitFor(() =>
      expect(listarDocumentos).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "substituido" }),
      ),
    );
  });

  it("RH registra documento e a lista é recarregada", async () => {
    vi.mocked(criarDocumento).mockResolvedValue(DOC as never);
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    await screen.findAllByText("Documento de identidade (RG)");
    const chamadasAntes = vi.mocked(listarDocumentos).mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar documento" }),
    );
    fireEvent.change(
      await screen.findByLabelText(/Tipo do documento a registrar/, {
        selector: "select",
      }),
      { target: { value: "tipo-1" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(criarDocumento).toHaveBeenCalledWith({
        empresaId: "emp-1",
        colaboradorId: "colab-1",
        tipoDocumentoId: "tipo-1",
      }),
    );
    await waitFor(() =>
      expect(vi.mocked(listarDocumentos).mock.calls.length).toBeGreaterThan(
        chamadasAntes,
      ),
    );
    expect(
      await screen.findByText("Documento registrado (sem conteúdo)."),
    ).toBeInTheDocument();
  });

  it("substituição em conflito (409) mostra mensagem de conflito clara", async () => {
    vi.mocked(substituirDocumento).mockRejectedValue(new ApiError(409, "x"));
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    await screen.findAllByText("Documento de identidade (RG)");
    fireEvent.click(screen.getByRole("button", { name: "Substituir" }));
    fireEvent.change(
      await screen.findByLabelText(/Novo tipo documental/, {
        selector: "select",
      }),
      { target: { value: "tipo-1" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar substituição" }),
    );
    expect(await screen.findByText(/já foi substituído/i)).toBeInTheDocument();
  });

  it("RH solicita documento e a lista de solicitações é recarregada", async () => {
    vi.mocked(criarSolicitacaoDocumento).mockResolvedValue(SOLIC as never);
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    await screen.findByText("Solicitações de documento");
    const antes = vi.mocked(listarSolicitacoesDocumento).mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar documento" }),
    );
    fireEvent.change(
      await screen.findByLabelText(/Tipo do documento a solicitar/, {
        selector: "select",
      }),
      { target: { value: "tipo-1" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Solicitar" }));

    await waitFor(() =>
      expect(criarSolicitacaoDocumento).toHaveBeenCalledWith({
        empresaId: "emp-1",
        colaboradorId: "colab-1",
        tipoDocumentoId: "tipo-1",
      }),
    );
    await waitFor(() =>
      expect(
        vi.mocked(listarSolicitacoesDocumento).mock.calls.length,
      ).toBeGreaterThan(antes),
    );
  });

  it("papel sem mutação (master_tecnico) não vê ações de registrar/substituir/solicitar", async () => {
    configurarPadrao({
      ator: { ...RH, role: "master_tecnico", companyId: null },
      colaboradores: [COLAB_1],
    });
    render(<PessoasDocumentosScreen />);
    await screen.findAllByText("Documento de identidade (RG)");
    expect(
      screen.queryByRole("button", { name: "Registrar documento" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Substituir" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Solicitar documento" }),
    ).not.toBeInTheDocument();
  });

  it("nunca oferece upload, download, visualização ou input de arquivo", async () => {
    const { container } = render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    await screen.findAllByText("Documento de identidade (RG)");
    expect(container.querySelector('input[type="file"]')).toBeNull();
    const texto = container.textContent ?? "";
    for (const termo of [
      "Upload",
      "Baixar",
      "Download",
      "Visualizar arquivo",
    ]) {
      expect(texto).not.toContain(termo);
    }
  });

  it("exibe os vínculos do colaborador como relação autorizada", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      {
        id: "v1",
        colaboradorId: "colab-1",
        empresaId: "emp-1",
        matricula: "M-001",
        tipo: "clt",
        situacao: "ativo",
        dataAdmissao: "2026-01-01",
        dataDesligamento: null,
        criadoEm: "2026-01-01T10:00:00.000Z",
        atualizadoEm: "2026-01-01T10:00:00.000Z",
      },
    ] as never);
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    const vinculos = await screen.findByText(/matrícula M-001/);
    expect(within(vinculos).getByText(/matrícula M-001/)).toBeInTheDocument();
  });

  it("erro ao carregar documentos mostra nova tentativa", async () => {
    vi.mocked(listarDocumentos)
      .mockRejectedValueOnce(new ApiError(500, "x"))
      .mockResolvedValueOnce(pagina([DOC]) as never);
    render(<PessoasDocumentosScreen />);
    fireEvent.change(await screen.findByLabelText("Selecione o colaborador"), {
      target: { value: "colab-1" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      (await screen.findAllByText("Documento de identidade (RG)")).length,
    ).toBeGreaterThan(0);
  });
});
