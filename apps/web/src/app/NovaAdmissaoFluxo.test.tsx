/**
 * T176 — Nova admissão no shell: rota, papéis e o caminho até a ficha.
 *
 * O teste da página (`NovaAdmissaoScreen.test.tsx`) prende o formulário. Este
 * prende o que só existe com o shell montado: o destino na navegação para `rh`
 * e `dp` (e não para `master_tecnico`, que não admite), a URL própria
 * (`#/pessoas/nova-admissao`), o "voltar" do navegador e a passagem da página
 * para a ficha do admitido — inclusive direto nos contatos aprovados.
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
  // T177 — perfil e contatos passaram a ser obrigatórios na admissão.
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
  vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([]);
  vi.mocked(admitirColaborador).mockResolvedValue(resposta);
  vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado([empresa]));
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([departamento]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
  vi.mocked(listarEquipes).mockResolvedValue(paginado([]));
  vi.mocked(listarCargos).mockResolvedValue(paginado([]));
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

function itemNovaAdmissao() {
  return screen.queryByRole("button", { name: /^Nova admissão/ });
}

async function admitirPelaPagina() {
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
  fireEvent.change(screen.getByLabelText(/E-mail pessoal/), {
    target: { value: "pessoa.fluxo@exemplo.test" },
  });
  fireEvent.change(screen.getByLabelText(/^Celular/), {
    target: { value: "+5531999990001" },
  });
  fireEvent.change(screen.getByLabelText(/^Telefone/), {
    target: { value: "3133330001" },
  });
  fireEvent.change(screen.getByLabelText(/Tipo de vínculo/), {
    target: { value: "clt" },
  });
  fireEvent.change(screen.getByLabelText(/Data de admissão/), {
    target: { value: "2026-10-20" },
  });
  fireEvent.change(screen.getByLabelText(/Tipo de referência organizacional/), {
    target: { value: "departamento" },
  });
  fireEvent.change(
    screen.getByLabelText(/Registro da referência organizacional/),
    { target: { value: departamento.id } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Admitir colaborador" }));
  await screen.findByText("Admissão registrada");
}

describe("T176 — Nova admissão na navegação", () => {
  it.each(["rh", "dp"])(
    "%s abre a página pela navegação, com URL própria e h1 no <main>",
    async (papel) => {
      render(<App papelDoAtor={papel} />);
      fireEvent.click(itemNovaAdmissao()!);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Nova admissão" }),
      ).toBeInTheDocument();
      expect(window.location.hash).toBe(ROTA);
      expect(screen.getByRole("main")).toHaveAttribute(
        "aria-labelledby",
        NOVA_ADMISSAO_TITULO_ID,
      );
      expect(itemNovaAdmissao()).toHaveAttribute("aria-current", "page");
      // A tela de Colaboradores não fica montada por baixo.
      expect(
        screen.queryByRole("heading", { level: 1, name: "Colaboradores" }),
      ).not.toBeInTheDocument();
    },
  );

  it("master_tecnico não vê o destino: o servidor recusaria a admissão", () => {
    render(<App papelDoAtor="master_tecnico" />);
    expect(itemNovaAdmissao()).not.toBeInTheDocument();
  });

  it("master_tecnico com a URL da rota cai no destino inicial, sem a página", async () => {
    window.history.replaceState(null, "", `/${ROTA}`);
    render(<App papelDoAtor="master_tecnico" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Nova admissão" }),
    ).not.toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("rota que o papel não abre não sequestra a escolha do Hub", async () => {
    window.history.replaceState(null, "", `/${ROTA}`);
    render(<App papelDoAtor="master_tecnico" destinoInicial="ponto" />);
    expect(
      await screen.findByRole("button", { name: /^Jornada/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(window.location.hash).toBe("");
  });

  it("a URL da rota abre a página direto para rh", async () => {
    window.history.replaceState(null, "", `/${ROTA}`);
    render(<App papelDoAtor="rh" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nova admissão" }),
    ).toBeInTheDocument();
  });

  it("sair para outro destino tira a rota da URL", async () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(itemNovaAdmissao()!);
    await screen.findByRole("heading", { level: 1, name: "Nova admissão" });
    fireEvent.click(
      screen.getByRole("button", { name: "Pessoas Colaboradores" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("o 'voltar' do navegador sai da página para onde a pessoa estava", async () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(itemNovaAdmissao()!);
    await screen.findByRole("heading", { level: 1, name: "Nova admissão" });
    act(() => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("Cancelar sem dados volta para Colaboradores", async () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(itemNovaAdmissao()!);
    await screen.findByText("Empresa Sintética (teste)");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });
});

describe("T177 — 'Novo colaborador' em Pessoas leva à página de Nova admissão", () => {
  it.each(["rh", "dp"])(
    "%s aciona 'Novo colaborador' e chega à página, com a URL própria",
    async (papel) => {
      render(<App papelDoAtor={papel} />);
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
      // A lista vazia mostra o botão no cabeçalho e no estado vazio; os dois
      // levam ao mesmo lugar. O do cabeçalho vem primeiro.
      const [doCabecalho] = await screen.findAllByRole("button", {
        name: "Novo colaborador",
      });
      fireEvent.click(doCabecalho!);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Nova admissão" }),
      ).toBeInTheDocument();
      expect(window.location.hash).toBe(ROTA);
      // Navegou: nenhuma janela de admissão abriu sobre a lista.
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { level: 1, name: "Colaboradores" }),
      ).not.toBeInTheDocument();
    },
  );

  it("master_tecnico vê Colaboradores, mas sem 'Novo colaborador'", async () => {
    render(<App papelDoAtor="master_tecnico" />);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    await screen.findByRole("heading", {
      name: "Nenhum colaborador cadastrado",
    });
    expect(
      screen.queryByRole("button", { name: "Novo colaborador" }),
    ).not.toBeInTheDocument();
  });
});

describe("T176 — rota recusada para quem não admite", () => {
  /** Quem não recebe `colaborador`/`create` no servidor, e a tela em que aterrissa. */
  const SEM_ACESSO = [
    ["master_tecnico", /^Pessoas/],
    ["gestor", /^Minha equipe/],
    ["colaborador", /^Visão geral/],
  ] as const;

  it.each(SEM_ACESSO)(
    "%s com a URL direta não monta a página, e a URL não fica pendurada",
    async (papel, telaInicial) => {
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
      expect(window.location.hash).toBe("");
      // Corrigida no lugar: a rota nunca exibida não vira entrada no histórico.
      expect(window.history.length).toBe(entradasAntes);
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["master_tecnico", "ponto", /^Jornada/],
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
    await screen.findByRole("button", { name: /^Jornada/ });
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

describe("T176 — da página à ficha do admitido", () => {
  it("'Abrir ficha' leva a Colaboradores com a ficha do admitido aberta", async () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(itemNovaAdmissao()!);
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
    expect(window.location.hash).toBe("");
    expect(listarVinculosDoColaborador).toHaveBeenCalledWith(resposta.id);
    expect(within(ficha).getByLabelText("Nome")).toHaveValue(
      "Pessoa Sintética Fluxo",
    );
  });

  it("'Revisar contatos na ficha' abre a ficha com o foco no primeiro contato", async () => {
    render(<App papelDoAtor="dp" />);
    fireEvent.click(itemNovaAdmissao()!);
    await admitirPelaPagina();
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar contatos na ficha" }),
    );
    await screen.findByRole("dialog", { name: "Pessoa Sintética Fluxo" });
    await waitFor(() =>
      expect(screen.getByLabelText(/E-mail pessoal/)).toHaveFocus(),
    );
    expect(consultarContatosDoColaborador).toHaveBeenCalledWith(resposta.id);
  });

  it("a abertura vale uma vez: voltar a Pessoas não reabre a ficha", async () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(itemNovaAdmissao()!);
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
    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Pessoas Colaboradores" }),
    );
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
