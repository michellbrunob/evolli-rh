/**
 * T201 — aba Documentos da ficha do colaborador. O que se prova aqui é a
 * seção: só registros e solicitações desta pessoa na empresa da sessão, as
 * ações de RH e DP com os contratos que já existiam, `master_tecnico` só
 * lendo (e, sem empresa ativa, sem ler nada), nenhum arquivo, os estados de
 * carga, vazio, falha e nova tentativa, o foco e os anúncios. A rota, as abas
 * e a guarda de saída no shell estão em `App.ficha.test.tsx`.
 */
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
import {
  obterUsuarioAtual,
  type SafeAccessUserApi,
} from "../../api/usersClient";
import {
  ApiError,
  criarDocumento,
  criarSolicitacaoDocumento,
  listarDocumentos,
  listarSolicitacoesDocumento,
  listarTiposDocumento,
  substituirDocumento,
  type DocumentoMetadadoApi,
  type SolicitacaoDocumentoApi,
  type TipoDocumentoApi,
} from "../../api/documentosClient";
import {
  DocumentosColaboradorSecao,
  TAMANHO_PAGINA_DOCUMENTOS,
} from "./DocumentosColaboradorSecao";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, obterUsuarioAtual: vi.fn() };
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
    detalharDocumento: vi.fn(),
    detalharSolicitacaoDocumento: vi.fn(),
  };
});

const EMPRESA = "44444444-4444-4444-4444-444444444444";
const OUTRA_EMPRESA = "66666666-6666-4666-8666-666666666666";
const ANA = "11111111-1111-4111-8111-111111111111";
const BRUNO = "22222222-2222-4222-8222-222222222222";
const NOME_ANA = "Ana Sintética (teste)";

function ator(parcial: Partial<SafeAccessUserApi> = {}): SafeAccessUserApi {
  return {
    id: "ator-sintetico",
    email: "pessoa.teste@example.test",
    role: "rh",
    companyId: EMPRESA,
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...parcial,
  };
}

function paginado<T>(itens: T[], total = itens.length, pagina = 1) {
  return { itens, pagina, tamanhoPagina: TAMANHO_PAGINA_DOCUMENTOS, total };
}

const RG: TipoDocumentoApi = {
  id: "t-rg",
  empresaId: EMPRESA,
  codigo: "RG",
  nome: "Identidade (teste)",
  classificacao: "restrito",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};
const CTPS: TipoDocumentoApi = {
  ...RG,
  id: "t-ctps",
  codigo: "CTPS",
  nome: "Carteira de trabalho (teste)",
};

function documento(
  parcial: Partial<DocumentoMetadadoApi> = {},
): DocumentoMetadadoApi {
  return {
    id: "d-1",
    empresaId: EMPRESA,
    colaboradorId: ANA,
    tipoDocumentoId: RG.id,
    estado: "upload_desabilitado",
    substituiDocumentoId: null,
    criadoEm: "2026-03-10T12:00:00.000Z",
    atualizadoEm: "2026-03-10T12:00:00.000Z",
    ...parcial,
  };
}

function solicitacao(
  parcial: Partial<SolicitacaoDocumentoApi> = {},
): SolicitacaoDocumentoApi {
  return {
    id: "s-1",
    empresaId: EMPRESA,
    colaboradorId: ANA,
    tipoDocumentoId: CTPS.id,
    estado: "pendente",
    solicitanteUserId: "ator-sintetico",
    solicitadaEm: "2026-04-02T12:00:00.000Z",
    criadoEm: "2026-04-02T12:00:00.000Z",
    atualizadoEm: "2026-04-02T12:00:00.000Z",
    ...parcial,
  };
}

/** Promessa resolvida (ou recusada) quando o teste mandar. */
function adiada<T>() {
  let resolver!: (v: T) => void;
  let recusar!: (e: unknown) => void;
  const promessa = new Promise<T>((ok, falha) => {
    resolver = ok;
    recusar = falha;
  });
  return { promessa, resolver, recusar };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ator());
  vi.mocked(listarTiposDocumento).mockResolvedValue(paginado([RG, CTPS]));
  vi.mocked(listarDocumentos).mockResolvedValue(paginado([documento()]));
  vi.mocked(listarSolicitacoesDocumento).mockResolvedValue(
    paginado([solicitacao()]),
  );
  vi.mocked(criarDocumento).mockResolvedValue(documento({ id: "d-novo" }));
  vi.mocked(substituirDocumento).mockResolvedValue(documento({ id: "d-2" }));
  vi.mocked(criarSolicitacaoDocumento).mockResolvedValue(
    solicitacao({ id: "s-novo" }),
  );
});

function Secao(
  props: Partial<Parameters<typeof DocumentosColaboradorSecao>[0]> = {},
) {
  return (
    <DocumentosColaboradorSecao
      colaboradorId={ANA}
      nomeColaborador={NOME_ANA}
      {...props}
    />
  );
}

const tabelaDocumentos = () =>
  screen.findByRole("table", { name: `Documentos registrados — ${NOME_ANA}` });
const tabelaSolicitacoes = () =>
  screen.findByRole("table", {
    name: `Solicitações de documento — ${NOME_ANA}`,
  });
const ESCRITA = /registrar|solicitar|corrigir/i;
const ARQUIVO =
  /upload|download|baixar|anexar|anexo|visualizar|pré-visualiz|enviar arquivo|abrir arquivo/i;

/** Nenhum controle, link ou campo de arquivo na seção. */
function semArquivo(raiz: HTMLElement) {
  expect(raiz.querySelector('input[type="file"]')).toBeNull();
  expect(raiz.querySelector("a[href], a[download]")).toBeNull();
  expect(within(raiz).queryAllByRole("link")).toHaveLength(0);
  for (const botao of within(raiz).queryAllByRole("button")) {
    expect(botao.textContent ?? "").not.toMatch(ARQUIVO);
  }
}

describe("T201 — leitura e isolamento", () => {
  it("lista só os registros e solicitações desta pessoa, na empresa da sessão", async () => {
    vi.mocked(listarDocumentos).mockResolvedValue(
      paginado([
        documento(),
        // Defesa além do servidor: outra pessoa e outra empresa não entram.
        documento({
          id: "d-bruno",
          colaboradorId: BRUNO,
          tipoDocumentoId: CTPS.id,
        }),
        documento({
          id: "d-outra",
          empresaId: OUTRA_EMPRESA,
          tipoDocumentoId: CTPS.id,
        }),
      ]),
    );
    vi.mocked(listarSolicitacoesDocumento).mockResolvedValue(
      paginado([
        solicitacao(),
        solicitacao({
          id: "s-outra",
          empresaId: OUTRA_EMPRESA,
          tipoDocumentoId: RG.id,
        }),
      ]),
    );
    render(<Secao />);
    const docs = await tabelaDocumentos();
    const linhasDocs = within(docs).getAllByRole("row").slice(1);
    expect(linhasDocs).toHaveLength(1);
    expect(linhasDocs[0]).toHaveTextContent("Identidade (teste) (RG)");
    expect(linhasDocs[0]).toHaveTextContent("Registrado (sem conteúdo)");
    const solics = await tabelaSolicitacoes();
    const linhasSolic = within(solics).getAllByRole("row").slice(1);
    expect(linhasSolic).toHaveLength(1);
    expect(linhasSolic[0]).toHaveTextContent(
      "Carteira de trabalho (teste) (CTPS)",
    );
    expect(linhasSolic[0]).toHaveTextContent("Pendente");

    // A consulta é por esta pessoa; a empresa nunca vai na leitura.
    expect(listarDocumentos).toHaveBeenCalledWith({
      colaboradorId: ANA,
      pagina: 1,
      tamanhoPagina: TAMANHO_PAGINA_DOCUMENTOS,
    });
    expect(listarSolicitacoesDocumento).toHaveBeenCalledWith({
      colaboradorId: ANA,
      pagina: 1,
      tamanhoPagina: TAMANHO_PAGINA_DOCUMENTOS,
    });
  });

  it("aviso fixo: só o registro; nenhum arquivo, envio, download ou visualização", async () => {
    const { container } = render(<Secao />);
    await tabelaDocumentos();
    expect(
      screen.getByText(/O Evolli guarda só o registro do documento/),
    ).toHaveTextContent(
      "Arquivo, envio, download e visualização não estão disponíveis.",
    );
    semArquivo(container);
  });

  it("vazio: diz que ainda não há nada para a pessoa, sem sugerir arquivo", async () => {
    vi.mocked(listarDocumentos).mockResolvedValue(paginado([]));
    vi.mocked(listarSolicitacoesDocumento).mockResolvedValue(paginado([]));
    const { container } = render(<Secao />);
    expect(
      await screen.findByText(
        `Ainda não há documentos registrados para ${NOME_ANA}.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Ainda não há solicitações de documento para ${NOME_ANA}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    semArquivo(container);
  });

  it("master_tecnico sem empresa ativa: orienta a escolher a empresa e não lê nenhum documento", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(
      ator({ role: "master_tecnico", companyId: null }),
    );
    const { container } = render(<Secao />);
    expect(
      await screen.findByText(
        `Escolha uma empresa ativa para consultar os documentos de ${NOME_ANA}.`,
      ),
    ).toBeInTheDocument();
    // Dá tempo a qualquer leitura indevida.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(listarDocumentos).not.toHaveBeenCalled();
    expect(listarSolicitacoesDocumento).not.toHaveBeenCalled();
    expect(listarTiposDocumento).not.toHaveBeenCalled();
    expect(within(container).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("master_tecnico com empresa ativa: lê, sem botão, formulário ou chamada de escrita", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(
      ator({ role: "master_tecnico", companyId: EMPRESA }),
    );
    const { container } = render(<Secao />);
    await tabelaDocumentos();
    await tabelaSolicitacoes();
    expect(
      screen.getByText(
        /Somente consulta: registrar, corrigir o tipo e solicitar documento são ações do RH e do DP\./,
      ),
    ).toBeInTheDocument();
    expect(within(container).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Ações" })).toBeNull();
    expect(criarDocumento).not.toHaveBeenCalled();
    expect(substituirDocumento).not.toHaveBeenCalled();
    expect(criarSolicitacaoDocumento).not.toHaveBeenCalled();
    semArquivo(container);
  });

  it.each(["gestor", "colaborador", "financeiro"])(
    "%s (que nem abre a ficha) não recebe ação de escrita, se a seção for montada",
    async (papel) => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ role: papel }));
      const { container } = render(<Secao />);
      await tabelaDocumentos();
      for (const botao of within(container).queryAllByRole("button")) {
        expect(botao.textContent ?? "").not.toMatch(ESCRITA);
      }
    },
  );

  it.each(["rh", "dp"])(
    "%s tem registrar, corrigir o tipo e solicitar",
    async (papel) => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ role: papel }));
      render(<Secao />);
      await tabelaDocumentos();
      expect(
        screen.getByRole("button", { name: "Registrar documento" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Solicitar documento" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /^Corrigir tipo de Identidade \(teste\) \(RG\), registrado em /,
        }),
      ).toBeInTheDocument();
    },
  );

  it("registro já substituído não oferece nova correção", async () => {
    vi.mocked(listarDocumentos).mockResolvedValue(
      paginado([documento({ estado: "substituido" })]),
    );
    render(<Secao />);
    const docs = await tabelaDocumentos();
    expect(within(docs).getByText("Substituído")).toBeInTheDocument();
    expect(within(docs).queryByRole("button")).toBeNull();
  });

  it("sem tipos cadastrados: registrar e solicitar ficam fora, com o motivo", async () => {
    vi.mocked(listarTiposDocumento).mockResolvedValue(paginado([]));
    render(<Secao />);
    await tabelaDocumentos();
    expect(
      screen.queryByRole("button", { name: "Registrar documento" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Solicitar documento" }),
    ).toBeNull();
    expect(
      screen.getByText(
        /Não há tipos de documento cadastrados na empresa ativa/,
      ),
    ).toBeInTheDocument();
  });
});

describe("T201 — ações de RH e DP (contratos existentes)", () => {
  it("registrar: foco no tipo; sem tipo, erro no campo; com tipo, grava com a empresa da sessão, anuncia uma vez e leva o foco ao bloco", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ role: "dp" }));
    render(<Secao />);
    await tabelaDocumentos();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar documento" }),
    );
    const campo = screen.getByLabelText(/^Tipo do documento/);
    expect(campo).toHaveFocus();
    // Só um formulário por vez: os outros botões saem.
    expect(
      screen.queryByRole("button", { name: "Solicitar documento" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(
      await screen.findByText("Escolha o tipo do documento."),
    ).toBeInTheDocument();
    expect(campo).toHaveFocus();
    expect(campo).toHaveAccessibleDescription(/Escolha o tipo do documento\./);
    expect(criarDocumento).not.toHaveBeenCalled();

    vi.mocked(listarDocumentos).mockResolvedValue(
      paginado([
        documento({ id: "d-novo", tipoDocumentoId: CTPS.id }),
        documento(),
      ]),
    );
    fireEvent.change(campo, { target: { value: CTPS.id } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Documentos registrados" }),
      ).toHaveFocus(),
    );
    expect(criarDocumento).toHaveBeenCalledWith({
      empresaId: EMPRESA,
      colaboradorId: ANA,
      tipoDocumentoId: CTPS.id,
    });
    const avisos = screen.getAllByRole("status");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toHaveTextContent(
      "Documento Carteira de trabalho (teste) (CTPS) registrado, sem arquivo.",
    );
    const docs = await tabelaDocumentos();
    expect(within(docs).getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("corrigir o tipo: sem o tipo atual nas opções; substitui e mantém o anterior como substituído", async () => {
    render(<Secao />);
    await tabelaDocumentos();
    fireEvent.click(screen.getByRole("button", { name: /^Corrigir tipo de / }));
    const campo = screen.getByLabelText(/^Tipo correto/);
    expect(campo).toHaveFocus();
    const opcoes = within(campo)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opcoes).toEqual([
      "Selecione",
      "Carteira de trabalho (teste) (CTPS)",
    ]);
    fireEvent.change(campo, { target: { value: CTPS.id } });
    fireEvent.click(screen.getByRole("button", { name: "Corrigir tipo" }));
    await waitFor(() =>
      expect(substituirDocumento).toHaveBeenCalledWith("d-1", CTPS.id),
    );
    expect(
      await screen.findByText(
        "Tipo corrigido para Carteira de trabalho (teste) (CTPS). O registro anterior fica como substituído.",
      ),
    ).toHaveAttribute("role", "status");
  });

  it("corrigir com conflito (409): diz que nada foi salvo, foca o erro e relê a lista", async () => {
    vi.mocked(substituirDocumento).mockRejectedValue(new ApiError(409, "x"));
    render(<Secao />);
    await tabelaDocumentos();
    fireEvent.click(screen.getByRole("button", { name: /^Corrigir tipo de / }));
    fireEvent.change(screen.getByLabelText(/^Tipo correto/), {
      target: { value: CTPS.id },
    });
    vi.mocked(listarDocumentos).mockResolvedValue(
      paginado([
        documento({ estado: "substituido" }),
        documento({ id: "d-3", tipoDocumentoId: CTPS.id }),
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Corrigir tipo" }));
    const erro = await screen.findByText(/já foi corrigido por outra pessoa/);
    await waitFor(() => expect(erro).toHaveFocus());
    expect(erro).toHaveTextContent("nada foi salvo");
    await waitFor(() => expect(listarDocumentos).toHaveBeenCalledTimes(2));
    // Cancelar: o botão de origem sumiu (registro substituído), o foco vai ao bloco.
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.getByRole("heading", { name: "Documentos registrados" }),
    ).toHaveFocus();
  });

  it("solicitar: grava o pedido com a empresa da sessão; o foco vai às solicitações", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ role: "dp" }));
    render(<Secao />);
    await tabelaSolicitacoes();
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar documento" }),
    );
    const campo = screen.getByLabelText(/^Tipo do documento a solicitar/);
    expect(campo).toHaveFocus();
    fireEvent.change(campo, { target: { value: RG.id } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Solicitações de documento" }),
      ).toHaveFocus(),
    );
    expect(criarSolicitacaoDocumento).toHaveBeenCalledWith({
      empresaId: EMPRESA,
      colaboradorId: ANA,
      tipoDocumentoId: RG.id,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Solicitação de Identidade (teste) (RG) registrada como pendente.",
    );
  });

  it.each([
    [403, /Seu perfil não tem permissão/],
    [404, /não encontrados na empresa ativa/],
    [422, /O tipo escolhido foi recusado/],
  ])(
    "recusa %i do servidor: mensagem própria, foco no erro, o tipo escolhido fica",
    async (status, texto) => {
      vi.mocked(criarSolicitacaoDocumento).mockRejectedValue(
        new ApiError(status, "x"),
      );
      render(<Secao />);
      await tabelaSolicitacoes();
      fireEvent.click(
        screen.getByRole("button", { name: "Solicitar documento" }),
      );
      const campo = screen.getByLabelText(/^Tipo do documento a solicitar/);
      fireEvent.change(campo, { target: { value: RG.id } });
      fireEvent.click(screen.getByRole("button", { name: "Solicitar" }));
      const erro = await screen.findByText(texto);
      await waitFor(() => expect(erro).toHaveFocus());
      expect(campo).toHaveValue(RG.id);
      // Um evento, um anúncio: o erro é lido pelo foco, sem região viva extra.
      expect(erro).not.toHaveAttribute("role");
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("falha sem resposta: não afirma nem nega a gravação", async () => {
    vi.mocked(criarDocumento).mockRejectedValue(new TypeError("rede"));
    render(<Secao />);
    await tabelaDocumentos();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar documento" }),
    );
    fireEvent.change(screen.getByLabelText(/^Tipo do documento/), {
      target: { value: RG.id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(
      await screen.findByText(
        "Não foi possível confirmar se o documento foi salvo. Atualize a lista para conferir antes de tentar de novo.",
      ),
    ).toBeInTheDocument();
  });

  it("cancelar devolve o foco ao botão que abriu o formulário", async () => {
    render(<Secao />);
    await tabelaDocumentos();
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar documento" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.getByRole("button", { name: "Solicitar documento" }),
    ).toHaveFocus();
  });

  it("guarda de saída: tipo escolhido conta como pendente; gravação em curso como salvando", async () => {
    const alterado = vi.fn();
    const salvando = vi.fn();
    const gravacao = adiada<DocumentoMetadadoApi>();
    vi.mocked(criarDocumento).mockReturnValue(gravacao.promessa);
    const { unmount } = render(
      <Secao onAlteradoChange={alterado} onSalvandoChange={salvando} />,
    );
    await tabelaDocumentos();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar documento" }),
    );
    // Formulário aberto e vazio: nada a perder.
    expect(alterado).not.toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText(/^Tipo do documento/), {
      target: { value: RG.id },
    });
    expect(alterado).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(salvando).toHaveBeenLastCalledWith(true));
    // Botões ficam no lugar durante a gravação (o foco não cai no `body`).
    expect(screen.getByRole("button", { name: "Salvando…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await act(async () => {
      gravacao.resolver(documento({ id: "d-novo" }));
    });
    await waitFor(() => expect(salvando).toHaveBeenLastCalledWith(false));
    expect(alterado).toHaveBeenLastCalledWith(false);
    unmount();
    expect(alterado).toHaveBeenLastCalledWith(false);
  });
});

describe("T201 — carga, falha, nova tentativa e atraso", () => {
  it("B3: de 'sessão carregando' a 'conteúdo carregando', o mesmo nó de status fica montado (um anúncio só)", async () => {
    const sessao = adiada<SafeAccessUserApi>();
    vi.mocked(obterUsuarioAtual).mockReturnValue(sessao.promessa);
    const documentos =
      adiada<ReturnType<typeof paginado<DocumentoMetadadoApi>>>();
    vi.mocked(listarDocumentos).mockReturnValue(documentos.promessa);
    render(<Secao />);

    // Sessão carregando: um único status.
    const statusDaSessao = screen.getByRole("status");
    expect(statusDaSessao).toHaveTextContent("Carregando documentos…");
    expect(listarDocumentos).not.toHaveBeenCalled();

    // A sessão chega: a seção passa a ler o conteúdo, ainda carregando.
    await act(async () => {
      sessao.resolver(ator());
    });
    await waitFor(() => expect(listarDocumentos).toHaveBeenCalledTimes(1));
    const statusDoConteudo = screen.getAllByRole("status");
    expect(statusDoConteudo).toHaveLength(1);
    // O mesmo nó: não foi desmontado e montado de novo (anúncio repetido).
    expect(statusDoConteudo[0]).toBe(statusDaSessao);
    expect(statusDaSessao).toBeInTheDocument();
    expect(statusDaSessao).toHaveTextContent("Carregando documentos…");

    await act(async () => {
      documentos.resolver(paginado([documento()]));
    });
    expect(await tabelaDocumentos()).toBeInTheDocument();
    expect(screen.queryByText("Carregando documentos…")).toBeNull();
  });

  it("carga anunciada; falha com alerta e nova tentativa que mantém o foco no botão; sucesso foca o título", async () => {
    const primeira =
      adiada<ReturnType<typeof paginado<DocumentoMetadadoApi>>>();
    vi.mocked(listarDocumentos).mockReturnValueOnce(primeira.promessa);
    render(<Secao />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Carregando documentos…",
    );
    await act(async () => {
      primeira.recusar(new ApiError(500, "x"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os documentos.",
    );
    const botao = screen.getByRole("button", { name: "Tentar de novo" });
    botao.focus();

    const segunda = adiada<ReturnType<typeof paginado<DocumentoMetadadoApi>>>();
    vi.mocked(listarDocumentos).mockReturnValueOnce(segunda.promessa);
    fireEvent.click(botao);
    // Relendo: o botão fica no lugar, focado e indisponível.
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveFocus();
    expect(screen.queryByText("Carregando documentos…")).toBeNull();
    await act(async () => {
      segunda.recusar(new ApiError(500, "x"));
    });
    // Nova falha: um alerta novo (anunciado de novo), o foco segue no botão.
    await waitFor(() =>
      expect(botao).toHaveAttribute("aria-disabled", "false"),
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(botao).toHaveFocus();

    fireEvent.click(botao);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Documentos" }),
      ).toHaveFocus(),
    );
    expect(await tabelaDocumentos()).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falha ao conferir o acesso: alerta e nova tentativa; nenhum documento é lido antes", async () => {
    vi.mocked(obterUsuarioAtual).mockRejectedValueOnce(new Error("rede"));
    render(<Secao />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conferir o seu acesso aos documentos.",
    );
    expect(listarDocumentos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await tabelaDocumentos()).toBeInTheDocument();
  });

  it("gravação ok e releitura com falha: o aviso de sucesso fica, e o foco vai ao 'Tentar de novo'", async () => {
    render(<Secao />);
    await tabelaDocumentos();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar documento" }),
    );
    fireEvent.change(screen.getByLabelText(/^Tipo do documento/), {
      target: { value: RG.id },
    });
    vi.mocked(listarDocumentos).mockRejectedValueOnce(new ApiError(500, "x"));
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Tentar de novo" }),
      ).toHaveFocus(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Documento Identidade (teste) (RG) registrado, sem arquivo.",
    );
    expect(document.activeElement).not.toBe(document.body);
  });

  it("resposta atrasada de outra pessoa não substitui a lista atual", async () => {
    const daAna = adiada<ReturnType<typeof paginado<DocumentoMetadadoApi>>>();
    vi.mocked(listarDocumentos).mockImplementation((consulta) =>
      consulta?.colaboradorId === ANA
        ? daAna.promessa
        : Promise.resolve(
            paginado([
              documento({
                id: "d-b",
                colaboradorId: BRUNO,
                tipoDocumentoId: CTPS.id,
              }),
            ]),
          ),
    );
    const { rerender } = render(<Secao />);
    await waitFor(() => expect(listarDocumentos).toHaveBeenCalledTimes(1));
    rerender(
      <Secao colaboradorId={BRUNO} nomeColaborador="Bruno Sintético (teste)" />,
    );
    const docs = await screen.findByRole("table", {
      name: "Documentos registrados — Bruno Sintético (teste)",
    });
    await act(async () => {
      daAna.resolver(paginado([], 0));
    });
    // Relido da tela: a lista de Bruno segue, com a mesma tabela.
    const depois = screen.getByRole("table", {
      name: "Documentos registrados — Bruno Sintético (teste)",
    });
    expect(depois).toBe(docs);
    expect(within(depois).getAllByRole("row")).toHaveLength(2);
    expect(depois).toHaveTextContent("Carteira de trabalho (teste) (CTPS)");
  });

  it("desmontada antes da resposta (troca de empresa remonta a árvore): nada é desenhado depois", async () => {
    const pendente =
      adiada<ReturnType<typeof paginado<DocumentoMetadadoApi>>>();
    vi.mocked(listarDocumentos).mockReturnValue(pendente.promessa);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount, container } = render(<Secao />);
    await waitFor(() => expect(listarDocumentos).toHaveBeenCalled());
    unmount();
    await act(async () => {
      pendente.resolver(paginado([documento()]));
    });
    expect(container.textContent).toBe("");
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });
});

describe("T201 — paginação", () => {
  it("mais de uma página: anda pelo servidor, com o foco estável e a posição anunciada; falha avisa", async () => {
    const vinte = Array.from({ length: TAMANHO_PAGINA_DOCUMENTOS }, (_, i) =>
      documento({ id: `d-${i}` }),
    );
    vi.mocked(listarDocumentos).mockResolvedValue(paginado(vinte, 25));
    render(<Secao />);
    await tabelaDocumentos();
    const nav = screen.getByRole("navigation", {
      name: "Páginas de documentos registrados",
    });
    expect(screen.getByText("Página 1 de 2.")).toHaveAttribute(
      "role",
      "status",
    );
    const proxima = within(nav).getByRole("button", { name: "Próxima" });
    proxima.focus();

    vi.mocked(listarDocumentos).mockRejectedValueOnce(new ApiError(500, "x"));
    fireEvent.click(proxima);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a página 2.",
    );
    expect(proxima).toHaveFocus();

    vi.mocked(listarDocumentos).mockResolvedValueOnce(
      paginado([documento({ id: "d-20" })], 25, 2),
    );
    fireEvent.click(proxima);
    await waitFor(() =>
      expect(screen.getByText("Página 2 de 2.")).toBeInTheDocument(),
    );
    expect(listarDocumentos).toHaveBeenLastCalledWith({
      colaboradorId: ANA,
      pagina: 2,
      tamanhoPagina: TAMANHO_PAGINA_DOCUMENTOS,
    });
    expect(within(await tabelaDocumentos()).getAllByRole("row")).toHaveLength(
      2,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe("T201 — largura (375 px e tabelas largas)", () => {
  const css = readFileSync(
    "src/screens/pessoas/FichaColaboradorScreen.css",
    "utf8",
  );
  const corpo = (seletor: string) => {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
      "m",
    ).exec(css);
    return m ? (m[1] ?? "") : null;
  };

  it("as tabelas rolam no próprio quadro, que também contém o texto só para leitor (posicionado)", async () => {
    render(<Secao />);
    const docs = await tabelaDocumentos();
    const solics = await tabelaSolicitacoes();
    for (const tabela of [docs, solics]) {
      expect(tabela.closest(".ficha-colaborador__quadro")).not.toBeNull();
    }
    // O texto extra do "Corrigir tipo" é absoluto (só para leitor): sem um
    // quadro posicionado, ele escapa da rolagem do quadro e alarga a página.
    expect(
      within(docs)
        .getAllByRole("button")[0]!
        .querySelector(".ficha-colaborador__so-leitor"),
    ).not.toBeNull();
    const quadro = corpo(".ficha-colaborador__quadro");
    expect(quadro).toMatch(/overflow-x:\s*auto/);
    expect(quadro).toMatch(/position:\s*relative/);
  });
});
