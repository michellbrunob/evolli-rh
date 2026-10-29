/**
 * T176/T178 — Gestão de Pessoas no shell: Colaboradores e Nova admissão.
 *
 * O teste da página (`NovaAdmissaoScreen.test.tsx`) prende o formulário. Este
 * prende o que só existe com o shell montado: "Colaboradores" como entrada do
 * grupo "Gestão de Pessoas" (e a Nova admissão como sub-página dela, aberta
 * pela listagem só para `rh` e `dp`), as duas URLs próprias
 * (`#/pessoas/colaboradores` e `#/pessoas/nova-admissao`), a trilha de
 * navegação, o "voltar" do navegador, o cancelar e a passagem da página para
 * a listagem relida e para a ficha do admitido.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { NOVA_ADMISSAO_TITULO_ID } from "../screens/pessoas";
import {
  type AdmissaoRegistradaApi,
  admitirColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../api/colaboradoresClient";
import {
  type DepartamentoApi,
  type EmpresaApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../api/organizacaoClient";
import { listarCargos } from "../api/cargoClient";
import { consultarContatosDoColaborador } from "../api/contatosColaboradorClient";

vi.mock("../api/colaboradoresClient");
vi.mock("../api/organizacaoClient");
vi.mock("../api/cargoClient");
vi.mock("../api/contatosColaboradorClient");

// T179 — fluxo integrado (App inteiro, admissão com confirmação, ficha): cada
// teste passa de 0,3 s isolado, mas na suíte completa, com a máquina carregada,
// alguns estouravam os 5 s padrão. O limite maior vale só para este arquivo;
// as asserções não mudam.
vi.setConfig({ testTimeout: 20_000 });

const ROTA = "#/pessoas/nova-admissao";

function paginado<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

const empresa: EmpresaApi = {
  id: "44444444-4444-4444-4444-444444444444",
  codigo: "EMP1",
  nome: "Empresa Sintética (teste)",
  status: "ativo",
};

const departamento: DepartamentoApi = {
  id: "55555555-5555-5555-5555-555555555555",
  codigo: "DEP1",
  nome: "Departamento Sintético (teste)",
  empresaId: empresa.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

// T179 — Departamento e Cargo são obrigatórios na Nova admissão; a Unidade,
// opcional desde 2026-10-21, segue escolhida aqui.
const cargo = {
  id: "77777777-7777-4777-8777-777777777777",
  codigo: "CAR1",
  nome: "Cargo Sintético (teste)",
  empresaId: empresa.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const unidade = {
  id: "88888888-8888-4888-8888-888888888888",
  codigo: "UNI1",
  nome: "Unidade Sintética (teste)",
  empresaId: empresa.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const resposta: AdmissaoRegistradaApi = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Pessoa Sintética Fluxo",
  situacao: "inativo",
  criadoEm: "2026-10-20T12:00:00.000Z",
  atualizadoEm: "2026-10-20T12:00:00.000Z",
  vinculo: {
    id: "abababab-abab-4bab-8bab-abababababab",
    empresaId: empresa.id,
    matricula: "MAT-FLX1",
    tipo: "clt",
    situacao: "previsto",
    dataAdmissao: "2026-10-20T00:00:00.000Z",
  },
  movimentacao: {
    id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
    tipo: "admissao",
    status: "solicitada",
    vigenciaInicio: "2026-10-20T00:00:00.000Z",
    destino: {
      unidadeOrganizacionalId: null,
      departamentoId: departamento.id,
      areaId: null,
      equipeId: null,
      cargoId: null,
      centroCustoId: null,
    },
  },
  // T177 — perfil obrigatório na admissão; T179 — contatos opcionais.
  perfilPessoal: {
    dataNascimento: "1990-05-20T00:00:00.000Z",
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
  endereco: null,
  contatos: {
    emailPessoal: "pessoa.fluxo@exemplo.test",
    celular: "+5531999990001",
    telefone: "3133330001",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  vi.mocked(listarColaboradores).mockResolvedValue({
    ...paginado([]),
    contadores: { ativos: 0, inativos: 0 },
  });
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([]);
  vi.mocked(admitirColaborador).mockResolvedValue(resposta);
  vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado([empresa]));
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([departamento]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([unidade]));
  vi.mocked(listarEquipes).mockResolvedValue(paginado([]));
  vi.mocked(listarCargos).mockResolvedValue(paginado([cargo]));
  vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([]));
  vi.mocked(listarAreas).mockResolvedValue(paginado([]));
  vi.mocked(consultarContatosDoColaborador).mockImplementation(
    async (colaboradorId) => ({
      colaboradorId,
      empresaId: empresa.id,
      situacao: "sem_registro",
      contatos: null,
    }),
  );
});

const ROTA_COLABORADORES = "#/pessoas/colaboradores";

/** T178 — a barra não tem mais item próprio de Nova admissão. */
function itemNovaAdmissaoNaBarra() {
  return within(
    screen.getByRole("navigation", { name: "Navegação do painel" }),
  ).queryByRole("button", { name: /Nova admissão/ });
}

function itemColaboradoresNaBarra() {
  return within(
    screen.getByRole("navigation", { name: "Navegação do painel" }),
  ).getByRole("button", { name: /^Colaboradores/ });
}

function trilha() {
  return screen.getByRole("navigation", { name: "Trilha de navegação" });
}

/** T178 — o caminho até a Nova admissão: a ação da listagem de Colaboradores. */
async function abrirNovaAdmissaoPelaListagem() {
  await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
  // Com a lista vazia há dois botões (barra de ações e estado vazio); o da
  // barra vem primeiro, e os dois abrem o mesmo painel (T194).
  const [daBarra] = await screen.findAllByRole("button", {
    name: "Adicionar colaborador",
  });
  fireEvent.click(daBarra!);
  fireEvent.click(
    await screen.findByRole("button", { name: "Iniciar cadastro" }),
  );
  await screen.findByRole("heading", { level: 1, name: "Nova admissão" });
}

async function admitirPelaPagina({ semContatos = false } = {}) {
  await screen.findByText("Empresa Sintética (teste)");
  fireEvent.change(screen.getByLabelText(/Nome completo/), {
    target: { value: "Pessoa Sintética Fluxo" },
  });
  fireEvent.change(screen.getByLabelText(/^Matrícula/), {
    target: { value: "MAT-FLX1" },
  });
  // T177 — a data de nascimento passou a ser obrigatória na admissão.
  fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
    target: { value: "1990-05-20" },
  });
  if (!semContatos) {
    fireEvent.change(screen.getByLabelText(/E-mail pessoal/), {
      target: { value: "pessoa.fluxo@exemplo.test" },
    });
    fireEvent.change(screen.getByLabelText(/^Celular/), {
      target: { value: "+5531999990001" },
    });
    fireEvent.change(screen.getByLabelText(/^Telefone/), {
      target: { value: "3133330001" },
    });
  }
  fireEvent.change(screen.getByLabelText(/Tipo de vínculo/), {
    target: { value: "clt" },
  });
  fireEvent.change(screen.getByLabelText(/Data de admissão/), {
    target: { value: "2026-10-20" },
  });
  fireEvent.change(screen.getByLabelText(/^Departamento/), {
    target: { value: departamento.id },
  });
  fireEvent.change(screen.getByLabelText(/^Cargo/), {
    target: { value: cargo.id },
  });
  fireEvent.change(screen.getByLabelText(/^Unidade/), {
    target: { value: unidade.id },
  });
  // T195 — quatro etapas: "Continuar" até a revisão. Nela, "Confirmar
  // admissão" só valida e abre a confirmação (T179); quem grava é
  // "Confirmar cadastro".
  for (const etapa of ["Dados básicos", "Dados profissionais", "Endereço"]) {
    expect(
      screen.getByRole("heading", { level: 2, name: new RegExp(etapa) }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Confirmar admissão" }));
  const confirmacao = await screen.findByRole("dialog", {
    name: "Confirmar cadastro de colaborador?",
  });
  fireEvent.click(
    within(confirmacao).getByRole("button", { name: "Confirmar cadastro" }),
  );
  await screen.findByText("Admissão registrada");
}

describe("T178 — Gestão de Pessoas › Colaboradores na barra lateral", () => {
  it.each(["rh", "dp", "master_tecnico"])(
    "%s vê o grupo 'Gestão de Pessoas' com 'Colaboradores', sem item próprio de Nova admissão",
    async (papel) => {
      render(<App papelDoAtor={papel} />);
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
      expect(
        screen.getByRole("button", { name: "Gestão de Pessoas" }),
      ).toHaveAttribute("aria-expanded", "true");
      expect(itemColaboradoresNaBarra()).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(itemNovaAdmissaoNaBarra()).toBeNull();
    },
  );

  it.each(["rh", "dp"])(
    "%s abre a Nova admissão pela listagem: URL própria, h1 no <main> e Colaboradores marcado",
    async (papel) => {
      render(<App papelDoAtor={papel} />);
      await abrirNovaAdmissaoPelaListagem();
      expect(window.location.hash).toBe(ROTA);
      expect(screen.getByRole("main")).toHaveAttribute(
        "aria-labelledby",
        NOVA_ADMISSAO_TITULO_ID,
      );
      // Sub-página de Colaboradores: a barra marca a área, não some a marca.
      expect(itemColaboradoresNaBarra()).toHaveAttribute(
        "aria-current",
        "page",
      );
      // Navegou: nenhuma janela abriu, e a listagem não fica montada por baixo.
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { level: 1, name: "Colaboradores" }),
      ).not.toBeInTheDocument();
    },
  );

  it("master_tecnico vê Colaboradores, mas sem 'Nova admissão' em lugar nenhum", async () => {
    render(<App papelDoAtor="master_tecnico" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    await screen.findByRole("heading", {
      name: "Nenhum colaborador cadastrado nesta empresa",
    });
    expect(
      screen.queryByRole("button", { name: "Nova admissão" }),
    ).not.toBeInTheDocument();
    // T194 — nem o botão novo, nem o painel.
    expect(
      screen.queryByRole("button", { name: "Adicionar colaborador" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(itemNovaAdmissaoNaBarra()).toBeNull();
  });
});

describe("T178 — trilha de navegação", () => {
  it("na listagem: Gestão de Pessoas › Colaboradores, com Colaboradores como atual", async () => {
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });

    const itens = within(trilha()).getAllByRole("listitem");
    expect(itens.map((i) => i.textContent?.replace("›", "").trim())).toEqual([
      "Gestão de Pessoas",
      "Colaboradores",
    ]);
    expect(within(trilha()).getByText("Colaboradores")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // O separador é desenho: fica fora da árvore de acessibilidade.
    for (const separador of trilha().querySelectorAll(
      ".evolli-trilha__separador",
    )) {
      expect(separador).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("numa aba interna, a trilha ganha o terceiro nível e 'Colaboradores' volta à aba", async () => {
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));

    expect(within(trilha()).getByText("Horário de trabalho")).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.click(
      within(trilha()).getByRole("button", { name: "Colaboradores" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveFocus();
  });

  it("na Nova admissão: Gestão de Pessoas › Colaboradores › Nova admissão", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();

    const itens = within(trilha()).getAllByRole("listitem");
    expect(itens.map((i) => i.textContent?.replace("›", "").trim())).toEqual([
      "Gestão de Pessoas",
      "Colaboradores",
      "Nova admissão",
    ]);
    expect(within(trilha()).getByText("Nova admissão")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // O módulo não é página: só texto. Colaboradores é acionável.
    expect(
      within(trilha()).queryByRole("button", { name: "Gestão de Pessoas" }),
    ).toBeNull();
    expect(
      within(trilha()).getByRole("button", { name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("'Colaboradores' da trilha, sem nada digitado, volta direto à listagem", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await screen.findByText("Empresa Sintética (teste)");

    fireEvent.click(
      within(trilha()).getByRole("button", { name: "Colaboradores" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
  });

  it("'Colaboradores' da trilha, com dados digitados, pede a confirmação de descarte", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await screen.findByText("Empresa Sintética (teste)");
    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "Pessoa Em Edição" },
    });

    fireEvent.click(
      within(trilha()).getByRole("button", { name: "Colaboradores" }),
    );
    const confirmacao = await screen.findByRole("dialog", {
      name: "Descartar esta admissão?",
    });
    // "Continuar preenchendo" fica na página, com o que foi digitado.
    fireEvent.click(
      within(confirmacao).getByRole("button", {
        name: "Continuar preenchendo",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Descartar esta admissão?" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue(
      "Pessoa Em Edição",
    );
    expect(window.location.hash).toBe(ROTA);

    // Pedir de novo e descartar: aí sim volta à listagem.
    fireEvent.click(
      within(trilha()).getByRole("button", { name: "Colaboradores" }),
    );
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Descartar esta admissão?" }),
      ).getByRole("button", { name: "Descartar e sair" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
    expect(admitirColaborador).not.toHaveBeenCalled();
  });
});

describe("T178 — rota própria da listagem (#/pessoas/colaboradores)", () => {
  it.each(["rh", "dp", "master_tecnico"])(
    "%s abrindo a URL da listagem monta Colaboradores, mesmo com outra escolha no Hub",
    async (papel) => {
      window.history.replaceState(null, "", `/${ROTA_COLABORADORES}`);
      render(<App papelDoAtor={papel} destinoInicial="ponto" />);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
      ).toBeInTheDocument();
      expect(window.location.hash).toBe(ROTA_COLABORADORES);
      expect(listarColaboradores).toHaveBeenCalled();
    },
  );

  it("recarregar na listagem volta à listagem (nova montagem, nova leitura)", async () => {
    const { unmount } = render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
    // "Recarregar": a URL fica e o shell remonta do zero. O desmonte limpa a
    // rota (saída do shell); recarregar não desmonta — reponho a URL.
    unmount();
    window.history.replaceState(null, "", `/${ROTA_COLABORADORES}`);
    const chamadasAntes = vi.mocked(listarColaboradores).mock.calls.length;

    render(<App papelDoAtor="rh" destinoInicial="cadastros" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBeGreaterThan(
      chamadasAntes,
    );
  });

  it("a aterrissagem comum escreve a rota no lugar, sem entrada nova no histórico", async () => {
    const entradasAntes = window.history.length;
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
    expect(window.history.length).toBe(entradasAntes);
  });

  it.each([
    ["gestor", /^Minha equipe/],
    ["colaborador", /^Visão geral/],
    ["financeiro", /^Visão geral/],
  ] as const)(
    "%s com a URL da listagem não monta Colaboradores, e a URL é corrigida",
    async (papel, telaInicial) => {
      window.history.replaceState(null, "", `/${ROTA_COLABORADORES}`);
      const entradasAntes = window.history.length;
      render(<App papelDoAtor={papel} />);
      expect(
        await screen.findByRole("button", { name: telaInicial }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        screen.queryByRole("heading", { level: 1, name: "Colaboradores" }),
      ).not.toBeInTheDocument();
      expect(listarColaboradores).not.toHaveBeenCalled();
      expect(window.location.hash).toBe("");
      expect(window.history.length).toBe(entradasAntes);
    },
  );

  it("gestor digitando a rota com o painel aberto fica na tela atual", async () => {
    render(<App papelDoAtor="gestor" />);
    const atual = await screen.findByRole("button", { name: /^Minha equipe/ });
    expect(atual).toHaveAttribute("aria-current", "page");
    act(() => {
      window.history.pushState(null, "", `/${ROTA_COLABORADORES}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(
      screen.getByRole("button", { name: /^Minha equipe/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(listarColaboradores).not.toHaveBeenCalled();
  });

  it("de outro destino, a URL da listagem digitada leva à listagem", async () => {
    render(<App papelDoAtor="rh" destinoInicial="ponto" />);
    await screen.findByRole("button", { name: /^Jornada Visão/ });
    act(() => {
      window.history.pushState(null, "", `/${ROTA_COLABORADORES}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("o link 'Pular para o conteúdo' é âncora: não tira a pessoa da listagem", async () => {
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    act(() => {
      window.history.pushState(null, "", "/#conteudo-principal");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(itemColaboradoresNaBarra()).toHaveAttribute("aria-current", "page");
  });

  it("ir para um destino sem rota tira a rota da URL, e 'voltar' retorna à listagem", async () => {
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    fireEvent.click(
      screen.getByRole("button", { name: /^Estrutura organizacional/ }),
    );
    await screen.findByRole("heading", {
      level: 1,
      name: "Estrutura organizacional",
    });
    expect(window.location.hash).toBe("");

    act(() => {
      window.history.replaceState(null, "", `/${ROTA_COLABORADORES}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });
});

describe("T176/T178 — Nova admissão: rota, voltar e cancelar", () => {
  it("master_tecnico com a URL da Nova admissão cai na listagem, com a URL dela", async () => {
    window.history.replaceState(null, "", `/${ROTA}`);
    render(<App papelDoAtor="master_tecnico" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Nova admissão" }),
    ).not.toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
  });

  it("rota que o papel não abre não sequestra a escolha do Hub", async () => {
    window.history.replaceState(null, "", `/${ROTA}`);
    render(<App papelDoAtor="master_tecnico" destinoInicial="ponto" />);
    expect(
      await screen.findByRole("button", { name: /^Jornada Visão/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(window.location.hash).toBe("");
  });

  it("a URL da Nova admissão abre a página direto para rh", async () => {
    window.history.replaceState(null, "", `/${ROTA}`);
    render(<App papelDoAtor="rh" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nova admissão" }),
    ).toBeInTheDocument();
    expect(itemColaboradoresNaBarra()).toHaveAttribute("aria-current", "page");
  });

  it("'Colaboradores' na barra, a partir da Nova admissão, volta à listagem e à rota dela", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    fireEvent.click(itemColaboradoresNaBarra());
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
  });

  it("o 'voltar' do navegador sai da Nova admissão para a listagem", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    expect(window.location.hash).toBe(ROTA);
    act(() => {
      // O que o navegador faz no "voltar": a URL anterior, e `popstate`.
      window.history.replaceState(null, "", `/${ROTA_COLABORADORES}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
  });

  it("o 'voltar' até a URL sem rota mostra a listagem e corrige a URL no lugar", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    act(() => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
  });

  it("Cancelar sem dados volta para a listagem, na rota dela", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await screen.findByText("Empresa Sintética (teste)");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
  });
});

describe("T176 — rota recusada para quem não admite", () => {
  /** Quem não recebe `colaborador`/`create` no servidor, e a tela em que aterrissa. */
  const SEM_ACESSO = [
    ["master_tecnico", /^Colaboradores/, ROTA_COLABORADORES],
    ["gestor", /^Minha equipe/, ""],
    ["colaborador", /^Visão geral/, ""],
  ] as const;

  it.each(SEM_ACESSO)(
    "%s com a URL direta não monta a página, e a URL não fica pendurada",
    async (papel, telaInicial, urlFinal) => {
      window.history.replaceState(null, "", `/${ROTA}`);
      const entradasAntes = window.history.length;
      render(<App papelDoAtor={papel} />);
      expect(
        await screen.findByRole("button", { name: telaInicial }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        screen.queryByRole("heading", { level: 1, name: "Nova admissão" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("form", { name: "Formulário de nova admissão" }),
      ).not.toBeInTheDocument();
      expect(window.location.hash).toBe(urlFinal);
      // Corrigida no lugar: a rota nunca exibida não vira entrada no histórico.
      expect(window.history.length).toBe(entradasAntes);
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["master_tecnico", "ponto", /^Jornada Visão/],
    ["gestor", "equipe", /^Minha equipe/],
    ["colaborador", "relatorios", /^Relatórios/],
  ] as const)(
    "%s digitando a rota com o painel aberto fica na tela atual (%s)",
    async (papel, destino, rotulo) => {
      render(<App papelDoAtor={papel} destinoInicial={destino} />);
      const atual = await screen.findByRole("button", { name: rotulo });
      expect(atual).toHaveAttribute("aria-current", "page");
      act(() => {
        window.history.pushState(null, "", `/${ROTA}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      await waitFor(() => expect(window.location.hash).toBe(""));
      expect(screen.getByRole("button", { name: rotulo })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(
        screen.queryByRole("heading", { level: 1, name: "Nova admissão" }),
      ).not.toBeInTheDocument();
    },
  );

  it("rh digitando a rota com o painel aberto vai à página", async () => {
    render(<App papelDoAtor="rh" destinoInicial="ponto" />);
    await screen.findByRole("button", { name: /^Jornada Visão/ });
    act(() => {
      window.history.pushState(null, "", `/${ROTA}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nova admissão" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA);
  });
});

describe("T176/T178 — da página à listagem e à ficha do admitido", () => {
  it("'Voltar para Colaboradores' mostra a listagem RELIDA do servidor", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await admitirPelaPagina();
    const chamadasAntes = vi.mocked(listarColaboradores).mock.calls.length;
    // O servidor já conhece o admitido.
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([
        {
          id: resposta.id,
          nome: resposta.nome,
          situacao: "inativo" as const,
          criadoEm: resposta.criadoEm,
          atualizadoEm: resposta.atualizadoEm,
          vinculos: [
            {
              id: resposta.vinculo.id,
              empresaId: empresa.id,
              matricula: "MAT-FLX1",
              situacao: "previsto" as const,
              dataAdmissao: "2026-10-20T00:00:00.000Z",
              dataDesligamento: null,
              // T184 — admissão ainda não efetivada: sem lotação vigente.
              lotacaoVigente: null,
              vigenciasDeJornada: [],
            },
          ],
        },
      ]),
      contadores: { ativos: 0, inativos: 1 },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );

    const tabela = await screen.findByRole("table", {
      name: "Colaboradores desta empresa",
    });
    expect(
      within(tabela).getByText("Pessoa Sintética Fluxo"),
    ).toBeInTheDocument();
    expect(within(tabela).getByText("MAT-FLX1")).toBeInTheDocument();
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBeGreaterThan(
      chamadasAntes,
    );
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
  });

  it("'Colaboradores' da trilha, depois da admissão, sai sem pedir confirmação", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await admitirPelaPagina();
    fireEvent.click(
      within(trilha()).getByRole("button", { name: "Colaboradores" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Descartar esta admissão?" }),
    ).not.toBeInTheDocument();
  });

  it("'Abrir ficha' leva a Colaboradores com a ficha do admitido aberta", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await admitirPelaPagina();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir ficha de Pessoa Sintética Fluxo",
      }),
    );
    const ficha = await screen.findByRole("dialog", {
      name: "Pessoa Sintética Fluxo",
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_COLABORADORES);
    expect(listarVinculosDoColaborador).toHaveBeenCalledWith(resposta.id);
    expect(within(ficha).getByLabelText("Nome")).toHaveValue(
      "Pessoa Sintética Fluxo",
    );
  });

  it("'Revisar contatos na ficha' abre a ficha com o foco no primeiro contato", async () => {
    render(<App papelDoAtor="dp" />);
    await abrirNovaAdmissaoPelaListagem();
    await admitirPelaPagina();
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar contatos na ficha" }),
    );
    await screen.findByRole("dialog", { name: "Pessoa Sintética Fluxo" });
    await waitFor(() =>
      expect(screen.getByLabelText(/E-mail pessoal/)).toHaveFocus(),
    );
    // T179 (revisão final) — o foco pula o título da seção: o estado "Nenhum
    // contato registrado" chega pela descrição do próprio campo focado.
    expect(screen.getByLabelText(/E-mail pessoal/)).toHaveAccessibleDescription(
      /Nenhum contato registrado/,
    );
    expect(consultarContatosDoColaborador).toHaveBeenCalledWith(resposta.id);
  });

  it("T179 — sem nenhum contato: salva sem aviso, não envia o bloco e a ficha mostra 'Nenhum contato registrado'", async () => {
    vi.mocked(admitirColaborador).mockResolvedValue({
      ...resposta,
      contatos: null,
    });
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await admitirPelaPagina({ semContatos: true });

    // Nenhum aviso, erro ou bloqueio pela ausência de contatos.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const [corpo] = vi.mocked(admitirColaborador).mock.calls[0]!;
    expect(corpo).not.toHaveProperty("contatos");
    expect(screen.getByRole("region", { name: "Contatos" })).toHaveTextContent(
      "Nenhum contato registrado.",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir ficha de Pessoa Sintética Fluxo",
      }),
    );
    const ficha = await screen.findByRole("dialog", {
      name: "Pessoa Sintética Fluxo",
    });
    const contatos = await within(ficha).findByRole("region", {
      name: "Contatos",
    });
    const estado = await within(contatos).findByText(
      /Nenhum contato registrado/,
    );
    expect(estado).toHaveAttribute("role", "status");
    expect(estado).toHaveTextContent(/^Nenhum contato registrado\./);
    expect(contatos).toHaveAccessibleDescription(/Nenhum contato registrado/);
    expect(within(contatos).queryByRole("alert")).not.toBeInTheDocument();
    expect(consultarContatosDoColaborador).toHaveBeenCalledWith(resposta.id);
  });

  it("a abertura vale uma vez: voltar a Colaboradores não reabre a ficha", async () => {
    render(<App papelDoAtor="rh" />);
    await abrirNovaAdmissaoPelaListagem();
    await admitirPelaPagina();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir ficha de Pessoa Sintética Fluxo",
      }),
    );
    const ficha = await screen.findByRole("dialog", {
      name: "Pessoa Sintética Fluxo",
    });
    fireEvent.click(within(ficha).getByRole("button", { name: /Fechar/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /^Estrutura organizacional/ }),
    );
    fireEvent.click(itemColaboradoresNaBarra());
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T179 — o shell repassa o papel à página: a ORIENTAÇÃO do aviso de empresa
// sem referências muda (T180 — o RH usa o "+" sem sair da página; o DP pede
// ao RH), e só o RH vê o "+" do cadastro rápido.
// ---------------------------------------------------------------------------
describe("T179 — empresa sem referências, pelo papel que o shell conhece", () => {
  it.each([
    ["rh", /Use o botão "\+" ao lado de Cargo/, true],
    // T179 — só o que falta, e só Departamento e Cargo contam.
    ["dp", /O RH precisa cadastrar Cargo nesta empresa/, false],
  ])(
    "%s vê a orientação certa e não consegue enviar",
    async (papel, texto, comMais) => {
      vi.mocked(listarCargos).mockResolvedValue(paginado([]));
      render(<App papelDoAtor={papel} />);
      await abrirNovaAdmissaoPelaListagem();
      const aviso = await screen.findByText(texto);
      expect(aviso).toHaveTextContent(/cadastro ativo de Cargo/);
      // T195 — a lotação é a etapa 2: a 1 é preenchida para chegar a ela.
      fireEvent.change(screen.getByLabelText(/Nome completo/), {
        target: { value: "Pessoa Sintética Fluxo" },
      });
      fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
        target: { value: "1990-05-20" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      // T180 — o "+" do cadastro rápido é só do RH.
      expect(
        screen.queryByRole("button", { name: "Cadastrar novo cargo" }) !== null,
      ).toBe(comMais);
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      await waitFor(() => expect(aviso).toHaveFocus());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );
});
