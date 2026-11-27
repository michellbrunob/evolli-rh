import {
  act,
  fireEvent,
  render as renderSemGuarda,
  screen,
  waitFor,
  within,
  type RenderOptions,
} from "@testing-library/react";
import { comTrilha, voltarPelaTrilha } from "../../test/trilhaDeTeste";

import { ComGuardaDeSaida } from "../../test/ComGuardaDeSaida";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  ColaboradoresScreen,
  paginasDaJanela,
  textoDoIntervalo,
} from "./ColaboradoresScreen";
import { PessoasScreen } from "./PessoasScreen";
import {
  type EstadoDaListagem,
  type FiltrosDaListagem,
  type OpcoesDaMudancaDaListagem,
  type RotaDaFicha,
  type TipoDeVinculo,
  FILTROS_VAZIOS,
} from "../../app/rotasDoShell";

/** T215 — filtros da gaveta só com tipos de contrato. */
const soTipos = (...tipos: TipoDeVinculo[]): FiltrosDaListagem => ({
  ...FILTROS_VAZIOS,
  tipos,
});
/** T215 — a última leitura da LISTA (a contagem da gaveta pede 1 linha). */
function ultimaLeituraDaLista() {
  const leituras = vi
    .mocked(listarColaboradores)
    .mock.calls.filter(([c]) => c?.tamanhoPagina !== 1);
  return leituras.at(-1)?.[0] ?? {};
}

/** T215 — abre a gaveta "Filtrar" e devolve o diálogo. */
async function abrirGaveta() {
  fireEvent.click(screen.getByRole("button", { name: /^Filtrar/ }));
  return screen.findByRole("dialog", { name: "Filtrar" });
}

/** T215 — "Ver N resultados" (ou "Ver resultados", contando). */
function aplicarGaveta(gaveta: HTMLElement) {
  fireEvent.click(
    within(gaveta).getByRole("button", { name: /^Ver (d+ )?resultados?$/ }),
  );
}

/** T215 — abre a gaveta, marca cada [grupo, opção] e aplica. */
async function filtrarPelaGaveta(...marcas: [string, string][]) {
  const gaveta = await abrirGaveta();
  for (const [grupo, opcao] of marcas) {
    const g = await within(gaveta).findByRole("group", { name: grupo });
    const caixa = await within(g)
      .findByRole("checkbox", { name: opcao }, { timeout: 200 })
      .catch(() => null);
    fireEvent.click(caixa ?? within(g).getByRole("button", { name: opcao }));
  }
  aplicarGaveta(gaveta);
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Filtrar" })).toBeNull(),
  );
}

/** T215 — filtros da gaveta com o que o caso pede. */
const filtrosCom = (
  parcial: Partial<FiltrosDaListagem>,
): FiltrosDaListagem => ({ ...FILTROS_VAZIOS, ...parcial });
import { listarVinculosHorario } from "../../api/vinculoHorarioClient";
import { listarTabelasHorario } from "../../api/horariosClient";
import {
  type ColaboradorListadoApi,
  type ContadoresColaboradoresApi,
  type VinculoApi,
  buscarColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../api/colaboradoresClient";
import {
  type ContatosDoColaboradorApi,
  consultarContatosDoColaborador,
} from "../../api/contatosColaboradorClient";
import {
  type DadosPessoaisDoColaboradorApi,
  consultarDadosPessoaisDoColaborador,
} from "../../api/dadosPessoaisClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";
import { buscarLinhaDoTempo } from "../../api/movimentacaoClient";
import { listarAlocacoesVinculo } from "../../api/vinculoContratualClient";
import {
  buscarDepartamento,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarUnidades,
} from "../../api/organizacaoClient";
import { buscarCargo, listarCargos } from "../../api/cargoClient";
import {
  ProvedorDeEdicoes,
  RegistroDeEdicoes,
} from "../../app/edicoesPendentes";

vi.mock("../../api/colaboradoresClient");

/** T209 — a listagem de Colaboradores passa o sinal de cancelamento. */
const COM_SINAL = expect.objectContaining({
  signal: expect.any(AbortSignal),
});
// T183 — a seção "Jornada de trabalho" da ficha lê os vínculos de horário.
vi.mock("../../api/vinculoHorarioClient");
vi.mock("../../api/horariosClient");
vi.mock("../../api/contatosColaboradorClient");
// T181 — a ficha edita dados pessoais e endereço pela rota própria.
vi.mock("../../api/dadosPessoaisClient");
// T187 — a "Vida funcional" da ficha lê linha do tempo e alocações.
vi.mock("../../api/movimentacaoClient");
vi.mock("../../api/vinculoContratualClient");
// T190 — os filtros de lotação leem os catálogos de departamentos e cargos.
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");

/**
 * T178 — o envelope de `GET /v1/colaboradores` traz `contadores` do escopo
 * inteiro. Por padrão, contados sobre os itens dados; os testes que provam
 * que a tela NÃO soma a página passam números diferentes de propósito.
 */
interface ResultadoPaginadoTeste<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
  contadores: ContadoresColaboradoresApi;
}

function contados(
  itens: readonly {
    situacao: string;
    vinculos?: readonly { situacao: string; tipo?: string }[];
  }[],
): ContadoresColaboradoresApi {
  // T199 — os grupos pela regra do servidor (ativo > previsto > encerrado);
  // sem vínculos no item, vale a situação dele.
  const grupo = (c: (typeof itens)[number]) => {
    const v = c.vinculos ?? [];
    if (
      v.some((x) => x.situacao === "ativo") ||
      (!v.length && c.situacao === "ativo")
    )
      return "ativo";
    if (v.some((x) => x.situacao === "previsto")) return "previsto";
    return "encerrado";
  };
  const ativosPorTipo = {
    clt: 0,
    estagio: 0,
    aprendiz: 0,
    pj: 0,
    temporario: 0,
    outro_controlado: 0,
    part_time: 0,
    freelancer: 0,
    trainee: 0,
  };
  for (const c of itens) {
    if (grupo(c) !== "ativo") continue;
    const tipo = (c.vinculos?.find((x) => x.situacao === "ativo")?.tipo ??
      "clt") as keyof typeof ativosPorTipo;
    ativosPorTipo[tipo] += 1;
  }
  const ativos = itens.filter((c) => grupo(c) === "ativo").length;
  return {
    ativos,
    inativos: itens.length - ativos,
    emAdmissao: itens.filter((c) => grupo(c) === "previsto").length,
    desligados: itens.filter((c) => grupo(c) === "encerrado").length,
    total: itens.length,
    ativosPorTipo,
  };
}

function paginado<T extends { situacao: string }>(
  itens: T[],
): ResultadoPaginadoTeste<T> {
  return {
    itens,
    pagina: 1,
    tamanhoPagina: 100,
    total: itens.length,
    contadores: contados(itens),
  };
}

/** T184 — lotação vigente de um vínculo ativo (cargo e departamento). */
const LOTACAO_ATIVA = {
  cargo: { id: "c-1", codigo: "ANALISTA", nome: "Analista (teste)" },
  departamento: { id: "d-1", codigo: "ADM", nome: "Administrativo (teste)" },
};

/** T185 — jornada vigente desde sempre, sem término. */
const JORNADA_VIGENTE = {
  vigenciaInicio: "2020-01-01",
  vigenciaFim: null,
  jornada: {
    id: "j-1",
    codigo: "COMERCIAL_44H",
    nome: "Comercial 44 horas (teste)",
    ativo: true,
  },
};

const colaborador1: ColaboradorListadoApi = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Colaboradora (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
  vinculos: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      empresaId: "44444444-4444-4444-4444-444444444444",
      matricula: "MAT-0001",
      tipo: "clt",
      situacao: "ativo",
      dataAdmissao: "2025-01-10T00:00:00.000Z",
      dataDesligamento: null,
      lotacaoVigente: LOTACAO_ATIVA,
      vigenciasDeJornada: [JORNADA_VIGENTE],
    },
  ],
};

const colaborador2: ColaboradorListadoApi = {
  id: "22222222-2222-2222-2222-222222222222",
  nome: "Bruno Colaborador (teste)",
  situacao: "inativo",
  criadoEm: "2025-02-05T12:00:00.000Z",
  atualizadoEm: "2025-02-05T12:00:00.000Z",
  // Sem vínculo na empresa ativa: matrícula e admissão ficam "—".
  vinculos: [],
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

beforeEach(() => {
  // T187 — por padrão, vínculo sem movimentação e sem lotação vigente.
  vi.mocked(buscarLinhaDoTempo).mockResolvedValue([]);
  vi.mocked(listarAlocacoesVinculo).mockResolvedValue([]);
  // T198 — a ficha resolve cargo e departamento da alocação vigente por id.
  vi.mocked(buscarCargo).mockImplementation(
    async (id) =>
      ({
        ...LOTACAO_ATIVA.cargo,
        id,
        status: "ativo",
      }) as Awaited<ReturnType<typeof buscarCargo>>,
  );
  vi.mocked(buscarDepartamento).mockImplementation(
    async (id) =>
      ({
        ...LOTACAO_ATIVA.departamento,
        id,
        status: "ativo",
      }) as Awaited<ReturnType<typeof buscarDepartamento>>,
  );
  vi.mocked(listarVinculosHorario).mockResolvedValue({
    itens: [],
    pagina: 1,
    tamanhoPagina: 100,
    total: 0,
  });
  vi.mocked(listarTabelasHorario).mockResolvedValue({
    itens: [],
    pagina: 1,
    tamanhoPagina: 100,
    total: 0,
  });
  vi.mocked(listarColaboradores).mockResolvedValue(
    paginado([colaborador1, colaborador2]),
  );
  // T198 — a ficha lê o colaborador pelo id: por padrão, o da lista que o
  // teste montou; fora dela, 404 (fora da empresa ativa).
  vi.mocked(buscarColaborador).mockImplementation(async (id) => {
    const listar = vi.mocked(listarColaboradores).getMockImplementation();
    const pagina = listar ? await listar({}) : null;
    const achado = pagina?.itens.find((c) => c.id === id);
    if (achado) return achado;
    throw Object.assign(new Error("Recurso não encontrado."), { status: 404 });
  });
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([vinculo1]);
  vi.mocked(retificarColaborador).mockResolvedValue(colaborador1);
  // T190 — por padrão, catálogos vazios: os filtros ficam só com "Todos".
  vi.mocked(listarDepartamentos).mockResolvedValue({
    itens: [],
    pagina: 1,
    tamanhoPagina: 100,
    total: 0,
  });
  vi.mocked(listarCargos).mockResolvedValue({
    itens: [],
    pagina: 1,
    tamanhoPagina: 100,
    total: 0,
  });
  // T215 — os outros catálogos da gaveta "Filtrar", vazios por padrão.
  for (const listar of [listarAreas, listarCentrosCusto, listarUnidades]) {
    vi.mocked(listar).mockResolvedValue({
      itens: [],
      pagina: 1,
      tamanhoPagina: 100,
      total: 0,
    } as never);
  }

  // T169 — por padrão, o colaborador aberto não tem contato registrado.
  vi.mocked(consultarContatosDoColaborador).mockImplementation(
    async (colaboradorId) => semContatos(colaboradorId),
  );
  // T181 — por padrão, dados pessoais e endereço gravados (sintéticos).
  vi.mocked(consultarDadosPessoaisDoColaborador).mockImplementation(
    async (colaboradorId) => dadosPessoaisDe(colaboradorId),
  );
});

function dadosPessoaisDe(colaboradorId: string): DadosPessoaisDoColaboradorApi {
  return {
    colaboradorId,
    empresaId: "44444444-4444-4444-4444-444444444444",
    situacao: "registrado",
    perfilPessoal: {
      dataNascimento: "1990-05-20",
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
    endereco: {
      pais: "Brasil",
      cep: "30140071",
      logradouro: "Rua Sintética",
      numero: "10",
      complemento: null,
      bairro: "Centro",
      cidade: "Cidade Sintética",
      estado: "MG",
      atualizadoEm: "2026-10-20T12:00:00.000Z",
    },
  };
}

function semContatos(colaboradorId: string): ContatosDoColaboradorApi {
  return {
    colaboradorId,
    empresaId: "44444444-4444-4444-4444-444444444444",
    situacao: "sem_registro",
    contatos: null,
  };
}

/**
 * T198 — a ficha deixou de ser modal: é página própria, aberta pela rota. O
 * shell guarda a rota; aqui, um estado local faz esse papel, e o contêiner de
 * Pessoas monta a listagem e a ficha exatamente como no produto.
 */
function ComFicha({
  podeEditarFicha = false,
  podeOperarJornada = false,
  empresaAtiva = null,
  onNovaAdmissao,
}: {
  podeEditarFicha?: boolean;
  podeOperarJornada?: boolean;
  empresaAtiva?: { nome: string; codigo: string } | null;
  onNovaAdmissao?: () => void;
}) {
  const [ficha, setFicha] = useState<RotaDaFicha | null>(null);
  return (
    <PessoasScreen
      empresaAtiva={empresaAtiva}
      ficha={ficha}
      onAbrirFicha={(colaboradorId, aba = "dados") =>
        setFicha({ colaboradorId, aba })
      }
      onTrocarAbaDaFicha={(aba) =>
        setFicha((atual) => (atual ? { ...atual, aba } : atual))
      }
      onFecharFicha={() => setFicha(null)}
      podeEditarFicha={podeEditarFicha}
      podeOperarJornada={podeOperarJornada}
      {...(onNovaAdmissao ? { onNovaAdmissao } : {})}
    />
  );
}

/** T198 — a ficha aberta (a página, não mais um diálogo). T215 — no desenho da referência. */
function fichaAberta(): HTMLElement {
  const ficha = document.querySelector<HTMLElement>(".ficha-ref");
  if (!ficha) throw new Error("A ficha não está aberta.");
  return ficha;
}

/** T198 — espera a ficha carregar (o nome no título). */
async function esperarFicha(): Promise<HTMLElement> {
  await screen.findByRole("tablist", { name: "Seções da ficha" });
  await waitFor(() =>
    expect(document.querySelector(".ficha-ref__nome")?.textContent).not.toBe(
      "Ficha do colaborador",
    ),
  );
  return fichaAberta();
}

/** T198 — volta da ficha à listagem pela trilha. */
function voltarDaFicha() {
  fireEvent.click(voltarPelaTrilha());
}

describe("ColaboradoresScreen (T111 — funcional)", () => {
  it("tem um único h1 e a descrição da página (T215: sem o aviso RH e DP)", async () => {
    render(<ComFicha />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toHaveLength(1);
    expect(
      screen.getByText("Gerencie contratos, dados e documentos do time."),
    ).toBeInTheDocument();
    expect(screen.queryByText("RH e DP")).toBeNull();

    await waitFor(() => expect(listarColaboradores).toHaveBeenCalled());
  });

  it("lista colaboradores reais retornados pela API", async () => {
    render(<ComFicha />);

    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    const dentro = within(tabela);
    expect(dentro.getByText("Ana Colaboradora (teste)")).toBeInTheDocument();
    expect(dentro.getByText("Bruno Colaborador (teste)")).toBeInTheDocument();
    // T215 — o cargo vigente embaixo do nome; sem lotação, "Sem cargo".
    expect(dentro.getByText("Analista (teste)")).toBeInTheDocument();
    expect(dentro.getByText("Sem cargo")).toBeInTheDocument();
  });

  it("mostra o estado de carregamento antes dos dados chegarem", async () => {
    let resolver: (v: ResultadoPaginadoTeste<ColaboradorListadoApi>) => void;
    vi.mocked(listarColaboradores).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve;
      }) as ReturnType<typeof listarColaboradores>,
    );

    render(<ComFicha />);

    expect(screen.getByText("Carregando colaboradores…")).toBeInTheDocument();

    resolver!(paginado([colaborador1]));
    await screen.findByRole("table", { name: /^Colaboradores — / });
  });

  it("mostra erro de carregamento e permite tentar novamente", async () => {
    vi.mocked(listarColaboradores).mockRejectedValueOnce(new Error("falha"));

    render(<ComFicha />);

    await screen.findByRole("heading", {
      name: "Não foi possível carregar os colaboradores",
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: /^Colaboradores — / });
  });

  it("mostra EmptyState quando não há colaboradores", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));

    render(<ComFicha />);

    expect(
      await screen.findByRole("heading", {
        name: "Nenhum colaborador ativo no seu escopo",
      }),
    ).toBeInTheDocument();
  });

  it("cada aba pede o próprio grupo ao servidor, na página 1", async () => {
    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    // N-6 — a aba inicial é Ativos.
    expect(listarColaboradores).toHaveBeenLastCalledWith(
      {
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "ativos",
      },
      COM_SINAL,
    );

    abrirAba("Desligados");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          grupo: "desligados",
          // T164 — a paginação viaja junto, na página 1.
          pagina: 1,
          tamanhoPagina: 20,
        },
        COM_SINAL,
      ),
    );
    abrirAba("Todos");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
        },
        COM_SINAL,
      ),
    );
  });

  it("a aba Em admissão (só pela URL, T215) pede os previstos sem vínculo ativo", async () => {
    render(
      <ColaboradoresScreen
        estado={{
          aba: "em-admissao",
          pagina: 1,
          tamanho: 20,
          filtros: FILTROS_VAZIOS,
        }}
        onEstadoChange={vi.fn()}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(
      screen.getByRole("tab", { name: /^Em admissão/, selected: true }),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          grupo: "em_admissao",
          pagina: 1,
          tamanhoPagina: 20,
        },
        COM_SINAL,
      ),
    );
    // N-3 — sem os controles antigos.
    expect(screen.queryByLabelText("Situação do vínculo")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Inativos/ })).toBeNull();
  });

  // ---- T198 — a ficha é página própria (D17, D22): abrir pela linha, voltar
  // pela trilha, e a mesma proteção de antes para o que não foi salvo.
  async function abrirDetalheDeAna() {
    render(<ComFicha podeEditarFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    const abrir = within(linha).getByRole("button", { name: /Abrir ficha/ });
    abrir.focus();
    fireEvent.click(abrir);
    await esperarFicha();
    return abrir;
  }

  it("abre a ficha pela linha: vínculo principal, admissão e nenhum dia em ISO", async () => {
    await abrirDetalheDeAna();

    expect(listarVinculosDoColaborador).toHaveBeenCalledWith(colaborador1.id);
    const ficha = fichaAberta();
    expect(
      within(ficha).getByRole("heading", { level: 1, name: colaborador1.nome }),
    ).toBeInTheDocument();
    // T215 — o cabeçalho da referência: o contrato e o tempo de casa.
    expect(ficha).toHaveTextContent("CLT");
    expect(ficha).toHaveTextContent("Tempo de casa");
    // A listagem fica por baixo, escondida: fora da árvore acessível.
    expect(
      screen.queryByRole("table", { name: /^Colaboradores — / }),
    ).toBeNull();
    expectSemIsoVisivel(ficha);
  });

  it("não expõe campos editáveis na ficha (T215: editar é na página Editar colaborador)", async () => {
    await abrirDetalheDeAna();

    const ficha = within(fichaAberta());
    expect(ficha.queryByLabelText("Matrícula")).not.toBeInTheDocument();
    expect(ficha.queryByLabelText("Tipo de vínculo")).not.toBeInTheDocument();
    expect(ficha.queryByLabelText("Data de admissão")).not.toBeInTheDocument();
    expect(ficha.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("falha ao ler a ficha: aviso e 'Tentar de novo', que relê", async () => {
    vi.mocked(listarVinculosDoColaborador).mockRejectedValueOnce(
      new Error("falha"),
    );
    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));

    expect(
      await screen.findByText("Não foi possível abrir a ficha do colaborador."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await esperarFicha();
  });

  it("voltar pela trilha mostra a listagem e devolve o foco ao 'Abrir ficha'", async () => {
    const abrir = await abrirDetalheDeAna();

    voltarDaFicha();

    expect(document.querySelector(".ficha-colaborador")).toBeNull();
    expect(
      screen.getByRole("table", { name: /^Colaboradores — / }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });

  it("sem alterar o nome, voltar não pergunta nada", async () => {
    await abrirDetalheDeAna();

    voltarDaFicha();

    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    expect(document.querySelector(".ficha-colaborador")).toBeNull();
  });

  it("Escape na página não sai da ficha: ela não é mais uma janela", async () => {
    await abrirDetalheDeAna();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(fichaAberta()).toBeInTheDocument();
  });

  it("não contém senha, sessão ou dado que o servidor não mandou", async () => {
    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    // T215 — CPF e salário são colunas (desenho da referência), mas só
    // aparecem quando o servidor os manda; aqui não mandou.
    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of ["senha", "sessão", "localstorage", "r$"]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("a ficha leva o foco ao título (h1); voltar o devolve ao 'Abrir ficha'", async () => {
    const abrir = await abrirDetalheDeAna();

    const titulo = screen.getByRole("heading", {
      name: colaborador1.nome,
      level: 1,
    });
    await waitFor(() => expect(document.activeElement).toBe(titulo));

    voltarDaFicha();
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });

  it("o título da página não é repetido pela seção da lista", async () => {
    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const titulos = screen
      .getAllByRole("heading")
      .map((h) => h.textContent?.trim());
    const repetidos = titulos.filter((t) => t === "Colaboradores");
    expect(repetidos).toHaveLength(1);
  });
});

// ---- T177: a admissão mora só na página de Nova admissão -----------------

describe("ColaboradoresScreen (T177 — Nova admissão leva à página de Nova admissão)", () => {
  it("T194 — 'Adicionar colaborador' abre o painel; o cadastro individual chama onNovaAdmissao", async () => {
    const onNovaAdmissao = vi.fn();
    render(<ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const botao = screen.getByRole("button", { name: "Novo colaborador" });
    // Abre uma janela (o painel), não navega.
    expect(botao).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(botao);
    expect(onNovaAdmissao).not.toHaveBeenCalled();
    const painel = screen.getByRole("dialog", {
      name: "Adicionar colaborador",
    });

    fireEvent.click(
      within(painel).getByRole("button", {
        name: "Iniciar cadastro",
      }),
    );

    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("form", { name: "Formulário de novo colaborador" }),
    ).toBeNull();
  });

  it("sem onNovaAdmissao, não há botão 'Nova admissão' no cabeçalho", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(
      screen.queryByRole("button", { name: "Novo colaborador" }),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sem onNovaAdmissao, o estado vazio também não oferece o botão", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    render(<ColaboradoresScreen />);

    await screen.findByRole("heading", {
      name: "Nenhum colaborador ativo no seu escopo",
    });
    expect(
      screen.queryByRole("button", { name: "Novo colaborador" }),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByText(/Registre a admissão do primeiro colaborador/i),
    ).toBeNull();
  });

  it("o botão do estado vazio também abre o painel, que leva à Nova admissão", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    const onNovaAdmissao = vi.fn();
    render(<ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} />);

    const vazio = (
      await screen.findByRole("heading", {
        name: "Nenhum colaborador ativo no seu escopo",
      })
    ).closest(".evolli-empty-state");
    expect(vazio).not.toBeNull();
    // Um no cabeçalho e outro no estado vazio — os dois abrem o painel.
    const botoes = screen.getAllByRole("button", {
      name: "Novo colaborador",
    });
    expect(botoes).toHaveLength(2);
    const doVazio = within(vazio as HTMLElement).getByRole("button", {
      name: "Novo colaborador",
    });

    fireEvent.click(doVazio);
    expect(onNovaAdmissao).not.toHaveBeenCalled();
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Adicionar colaborador" }),
      ).getByRole("button", { name: "Iniciar cadastro" }),
    );

    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ---- T147: homologação da admissão — regressões provadas -----------------

/**
 * Promessa que o teste resolve na hora que quiser — é assim que se encena uma
 * resposta que chega ATRASADA. Declarar o  com `!` evita o
 * estreitamento para `never` que o TypeScript faz quando a variável só é
 * atribuída dentro do callback do construtor.
 */
function adiado<T>(): { promessa: Promise<T>; resolver: (valor: T) => void } {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promessa, resolver };
}

describe("ColaboradoresScreen (T147 — homologação da admissão)", () => {
  /**
   * D1. Trocar o filtro duas vezes dispara duas listagens. Se a PRIMEIRA
   * resposta chegar depois da segunda, ela não pode sobrescrever a lista: o
   * usuário veria registros que não correspondem ao filtro selecionado.
   *
   * Falha na implementação anterior: sem o contador de sequência,
   * `setColaboradores` era aplicado por qualquer resposta que chegasse.
   */
  it("resposta obsoleta da lista não sobrescreve a resposta do filtro atual", async () => {
    const atrasada = adiado<ResultadoPaginadoTeste<ColaboradorListadoApi>>();

    vi.mocked(listarColaboradores)
      // 1ª: carga inicial, resolve normalmente.
      .mockResolvedValueOnce(paginado([colaborador1, colaborador2]))
      // 2ª: aba "Desligados" — fica PENDENTE de propósito.
      .mockImplementationOnce(() => atrasada.promessa)
      // 3ª: aba "Todos" — resolve antes da anterior.
      .mockResolvedValueOnce(paginado([colaborador2]));

    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    abrirAba("Desligados");
    abrirAba("Todos");

    // A terceira chamada já respondeu: só Bruno está na tela.
    await waitFor(() =>
      expect(screen.queryByText("Ana Colaboradora (teste)")).toBeNull(),
    );

    // Agora a resposta ATRASADA de "Desligados" chega, trazendo Ana.
    atrasada.resolver(paginado([colaborador1]));

    // Ela precisa ser descartada: a tela continua mostrando o filtro atual.
    await waitFor(() =>
      expect(screen.getByText("Bruno Colaborador (teste)")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Ana Colaboradora (teste)")).toBeNull();
  });

  /**
   * D2. Abrir o detalhe de A, fechar, abrir o de B e a resposta atrasada de A
   * chegar depois: os vínculos de A não podem aparecer na ficha de B — é dado
   * de uma pessoa exibido na ficha de outra.
   *
   * Falha na implementação anterior: `setDetalhe` escrevia em `prev` sem
   * conferir de quem era a resposta.
   */
  it("vínculos de um colaborador não contaminam o detalhe de outro", async () => {
    const vinculoDeBruno: VinculoApi = {
      ...vinculo1,
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      colaboradorId: colaborador2.id,
      matricula: "MAT-0002",
      // T215 — a ficha mostra o tipo de contrato (não a matrícula).
      tipo: "pj",
    };

    const deAna = adiado<VinculoApi[]>();
    vi.mocked(listarVinculosDoColaborador).mockImplementation(
      (colaboradorId: string) =>
        colaboradorId === colaborador1.id
          ? deAna.promessa
          : Promise.resolve([vinculoDeBruno]),
    );

    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const linhaAna = screen
      .getByText("Ana Colaboradora (teste)")
      .closest("tr")!;
    fireEvent.click(
      within(linhaAna).getByRole("button", { name: /Abrir ficha/ }),
    );
    // T198 — volta da ficha de Ana com a requisição dela ainda em voo.
    voltarDaFicha();

    const linhaBruno = screen
      .getByText("Bruno Colaborador (teste)")
      .closest("tr")!;
    fireEvent.click(
      within(linhaBruno).getByRole("button", { name: /Abrir ficha/ }),
    );

    await screen.findByRole("heading", { level: 1, name: colaborador2.nome });
    await waitFor(() =>
      expect(
        fichaAberta().querySelector(".ficha-ref__contrato"),
      ).toHaveTextContent("PJ"),
    );

    // A resposta atrasada de Ana chega AGORA, com a ficha de Bruno aberta.
    await act(async () => deAna.resolver([vinculo1]));

    expect(
      fichaAberta().querySelector(".ficha-ref__contrato"),
    ).toHaveTextContent("PJ");
    // Nada de Ana pode ter entrado na ficha de Bruno.
    expect(
      fichaAberta().querySelector(".ficha-ref__contrato"),
    ).not.toHaveTextContent("CLT");
    expect(fichaAberta()).not.toHaveTextContent(colaborador1.nome);
  });

  /**
   * D4. `dataAdmissao` é coluna `@db.Date`, mas o Prisma a devolve como `Date`:
   * chega ao navegador como datetime ISO completo. Dados contratuais
   * normalizava; Colaboradores e Histórico funcional exibiam cru — a mesma
   * admissão aparecia em formatos diferentes em telas diferentes.
   *
   * Falha na implementação anterior: a célula mostrava
   * "2026-01-05T00:00:00.000Z".
   *
   * T154: o dia passa a ser exibido em `DD/MM/AAAA`. O corte continua sendo
   * textual — nada de `new Date()` —, então `2026-01-05T00:00:00.000Z` vira
   * `05/01/2026` e não recua para 04/01 no fuso brasileiro.
   */
  it("a admissão do servidor real nunca aparece em ISO na ficha", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      { ...vinculo1, dataAdmissao: "2026-01-05T00:00:00.000Z" },
    ]);

    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Abrir ficha/ }));

    // T215 — a ficha mostra o tempo de casa (não a data); nunca o ISO.
    const tabela = await esperarFicha();
    expect(tabela).toHaveTextContent("Tempo de casa");
    expect(within(tabela).queryByText("2026-01-05")).toBeNull();
    expect(within(tabela).queryByText("2026-01-05T00:00:00.000Z")).toBeNull();
    expectSemIsoVisivel(tabela);
  });
});

// ---------------------------------------------------------------------------
// T164 — primeira fatia operacional: paginação real, total do servidor,
// data de cadastro e contexto de empresa.
//
// O defeito que esta fatia corrige é silencioso e por isso perigoso: a tela
// pedia a lista SEM página, recebia a primeira e descartava o `total`. A
// partir do vigésimo primeiro colaborador, as pessoas seguintes simplesmente
// não existiam na interface — e nada sugeria que houvesse mais. Uma lista que
// esconde registros é pior que uma vazia, porque parece completa.
// ---------------------------------------------------------------------------

/** Resposta paginada com página e total escolhidos — o servidor manda. */
function pagina<T>(
  itens: T[],
  paginaAtual: number,
  total: number,
): ResultadoPaginadoTeste<T> {
  // T178 — contadores do escopo fixos e diferentes do total e da página: a
  // tela os exibe como vieram, sem derivá-los.
  return {
    itens,
    pagina: paginaAtual,
    tamanhoPagina: 20,
    total,
    contadores: {
      ...contados([]),
      ativos: 30,
      inativos: 15,
      desligados: 15,
      total: 30 + 15,
    },
  };
}

describe("T164 — paginação real", () => {
  it("pede a primeira página com tamanho explícito já na montagem", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(listarColaboradores).toHaveBeenCalledWith(
      {
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "ativos",
      },
      COM_SINAL,
    );
  });

  it("mostra a posição e avança para a página seguinte", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    // 45 registros em páginas de 20 são três páginas — a terceira com cinco.
    // Re-consultado a cada asserção: a referência capturada antes do
    // re-render aponta para um nó que o React já substituiu.
    const navegacao = () =>
      screen.getByRole("navigation", { name: "Paginação de colaboradores" });
    expect(navegacao()).toHaveTextContent("Página 1 de 3");

    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador2], 2, 45),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 2,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
    await waitFor(() => expect(navegacao()).toHaveTextContent("Página 2 de 3"));
  });

  it("a posição vem da RESPOSTA, não do que a tela pediu", async () => {
    // Servidor devolve a página 1 embora a tela tenha pedido a 2 — pode
    // acontecer se o conjunto encolher entre uma leitura e outra. Guardar o
    // que foi pedido deixaria o rodapé mentindo sobre onde a pessoa está.
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 21),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 1 de 2"),
    );
  });

  it("nos extremos, o botão correspondente fica desabilitado", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 25),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    // `aria-disabled`, e nao `disabled`: um botao desabilitado de verdade sai
    // da ordem de tabulacao e PERDE o foco ao ser desabilitado — que e
    // exatamente o defeito da R-2. Inerte, mas focalizavel.
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Próxima página" }),
    ).toHaveAttribute("aria-disabled", "false");

    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador2], 2, 25),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Próxima página" }),
      ).toHaveAttribute("aria-disabled", "true"),
    );
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("com uma página só, não desenha navegação que não navega", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 2),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(
      screen.queryByRole("navigation", { name: "Paginação de colaboradores" }),
    ).not.toBeInTheDocument();
  });

  it("trocar de aba ou de filtro volta para a página 1", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 3, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        expect.objectContaining({ pagina: 2 }),
        COM_SINAL,
      ),
    );

    abrirAba("Todos");

    // Sem isto, a aba nova pediria a página 2 de um conjunto que talvez
    // tenha uma só — e a lista vazia pareceria "ninguém aqui".
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
        },
        COM_SINAL,
      ),
    );
  });
});

describe("T164 — total, data e contexto de empresa", () => {
  it("mostra o total do SERVIDOR, não o tamanho da página", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    // Dois na tela, quarenta e cinco no conjunto. Exibir "2" como total faria
    // o número mentir sobre o tamanho da empresa. T215 — "N resultados".
    expect(await screen.findByText("45 resultados")).toBeInTheDocument();
  });

  it("concorda o singular quando há um só", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 1),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(await screen.findByText("1 resultado")).toBeInTheDocument();
  });

  it("T178 — nenhum dia em ISO na tabela (T215: a admissão saiu das colunas)", async () => {
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });

    // "Cadastrado em" saiu: a admissão agora vem do vínculo, na mesma resposta.
    expect(
      screen.queryByRole("columnheader", { name: "Cadastrado em" }),
    ).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Admissão" })).toBeNull();
    expectSemIsoVisivel(tabela);
  });

  // T215 — os cartões não repetem o nome da empresa; o escopo aparece nos
  // estados vazios.
  it('com empresa ativa, o vazio diz "nesta empresa"', async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    render(
      <ColaboradoresScreen
        empresaAtiva={{ nome: "Empresa Demo Alfa", codigo: "DEMOALFA" }}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Nenhum colaborador ativo nesta empresa",
      }),
    ).toBeInTheDocument();
  });

  it('sem empresa ativa (master global): "no seu escopo", nunca "nesta empresa" (D-6)', async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    render(<ColaboradoresScreen />);
    expect(
      await screen.findByRole("heading", {
        name: "Nenhum colaborador ativo no seu escopo",
      }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/nesta empresa/);
  });
});

describe("T164/T178 — o que a tabela promete, e a que custo", () => {
  /**
   * T178 — matrícula e admissão chegaram na MESMA resposta da lista (os
   * vínculos da empresa ativa), por isso viraram colunas. Cargo, departamento
   * e Banco de Horas continuam fora: a lotação não é resolvida pela listagem,
   * e coluna vazia ou montada por N+1 é promessa falsa.
   */
  it("T215 — colunas da referência: seleção, Colaborador, CPF, Contatos, Salário e Contrato", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const cabecalhos = screen
      .getAllByRole("columnheader")
      .map((c) => c.textContent?.trim() ?? "");
    expect(cabecalhos).toEqual([
      "Selecionar todos desta página",
      "Colaborador",
      "CPF",
      "Contatos",
      "Salário",
      "Contrato",
    ]);
  });

  it("T215 — Exportar no cabeçalho; nada de importar ou pedir preenchimento fora do painel", async () => {
    render(<ColaboradoresScreen onNovaAdmissao={() => {}} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(
      screen.getByRole("button", { name: "Exportar" }),
    ).toBeInTheDocument();
    for (const termo of [/importar/i, /preenchimento/i]) {
      expect(screen.queryByRole("button", { name: termo })).toBeNull();
    }
  });

  it("uma montagem da lista é UMA requisição — nada de N+1 por pessoa", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1, colaborador2], 1, 2),
    );
    // Delta, e não total: este arquivo não limpa os mocks entre casos, então
    // um número absoluto mediria a suíte inteira em vez desta montagem.
    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    const antesVinculos = vi.mocked(listarVinculosDoColaborador).mock.calls
      .length;
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(vi.mocked(listarColaboradores).mock.calls.length - antes).toBe(1);
    // O vínculo só é lido quando alguém abre o detalhe de UMA pessoa — montar
    // a lista com duas não dispara nenhuma leitura de vínculo.
    expect(
      vi.mocked(listarVinculosDoColaborador).mock.calls.length - antesVinculos,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-1 e R-2 — ressalvas da revisão adversarial da PR #156.
//
// Os dois blocos abaixo FALHAM na versão anterior da tela: o primeiro porque
// a contagem de páginas usava uma constante local em vez do tamanho que o
// servidor aplicou; o segundo porque a navegação vivia dentro do ramo que
// desmonta durante o carregamento, levando o foco junto.
// ---------------------------------------------------------------------------

describe("R-1 — a contagem de páginas segue o tamanho que o SERVIDOR aplicou", () => {
  it("servidor servindo de 10 em 10: 45 registros são 5 páginas, não 3", async () => {
    // Pedimos 20 e o servidor aplicou 10. Contar com a constante daria
    // ceil(45/20) = 3 — e as páginas 4 e 5 ficariam inalcançáveis.
    vi.mocked(listarColaboradores).mockResolvedValue({
      itens: [colaborador1],
      pagina: 1,
      tamanhoPagina: 10,
      total: 45,
      contadores: {
        ...contados([]),
        ativos: 30,
        inativos: 15,
        desligados: 15,
        total: 30 + 15,
      },
    });
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(
      screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
    ).toHaveTextContent("Página 1 de 5");
  });

  it("servidor servindo de 50 em 50: 45 registros são uma página só", async () => {
    // Com a constante, ceil(45/20) = 3 páginas — e as duas últimas voltariam
    // vazias, porque o servidor já mandou tudo na primeira.
    vi.mocked(listarColaboradores).mockResolvedValue({
      itens: [colaborador1, colaborador2],
      pagina: 1,
      tamanhoPagina: 50,
      total: 45,
      contadores: {
        ...contados([]),
        ativos: 30,
        inativos: 15,
        desligados: 15,
        total: 30 + 15,
      },
    });
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    expect(
      screen.queryByRole("navigation", { name: "Paginação de colaboradores" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["ausente", undefined],
    ["zero", 0],
    ["negativo", -20],
    ["fracionário", 7.5],
    ["não numérico", "20"],
    ["não finito", Number.POSITIVE_INFINITY],
  ])(
    "tamanhoPagina %s cai no tamanho pedido, sem inventar paginação",
    async (_nome, valor) => {
      vi.mocked(listarColaboradores).mockResolvedValue({
        itens: [colaborador1],
        pagina: 1,
        tamanhoPagina: valor,
        total: 45,
        contadores: {
          ...contados([]),
          ativos: 30,
          inativos: 15,
          desligados: 15,
          total: 30 + 15,
        },
      } as never);
      render(<ColaboradoresScreen />);
      await screen.findByRole("table", { name: /^Colaboradores — / });

      // Volta ao tamanho que a tela pediu: ceil(45/20) = 3. Nunca Infinity,
      // NaN ou divisão por zero.
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 1 de 3");
    },
  );
});

describe("R-2 — trocar de página não derruba o foco", () => {
  /** Resolve a próxima listagem só quando quisermos — segura o carregamento. */
  function listagemControlada(
    resposta: ResultadoPaginadoTeste<ColaboradorListadoApi>,
  ) {
    let liberar!: () => void;
    const promessa = new Promise<ResultadoPaginadoTeste<ColaboradorListadoApi>>(
      (r) => {
        liberar = () => r(resposta);
      },
    );
    vi.mocked(listarColaboradores).mockReturnValue(promessa as never);
    return liberar;
  }

  it("a navegação NÃO desmonta durante o carregamento", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    // Enquanto a resposta não chega, a navegação continua na tela.
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveAttribute("aria-busy", "true"),
    );
    expect(
      screen.getByRole("button", { name: "Próxima página" }),
    ).toBeInTheDocument();

    liberar();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
  });

  it("o foco permanece no botão acionado — nunca cai no body", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const proxima = screen.getByRole("button", { name: "Próxima página" });
    proxima.focus();
    expect(document.activeElement).toBe(proxima);

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    fireEvent.click(proxima);

    // Durante o carregamento: o foco segue onde a pessoa o deixou.
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveAttribute("aria-busy", "true"),
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Próxima página" }),
    );

    liberar();
    // E depois do carregamento também.
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
    expect(document.activeElement).not.toBe(document.body);
  });

  it("durante o carregamento, acionar de novo NÃO dispara outra requisição", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    const proxima = screen.getByRole("button", { name: "Próxima página" });
    fireEvent.click(proxima);
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveAttribute("aria-busy", "true"),
    );

    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));

    // Inerte por `aria-disabled` + guarda em `irParaPagina`: o controle segue
    // focalizável, mas nenhuma ação nova atravessa.
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(antes);
    expect(
      screen.getByRole("button", { name: "Próxima página" }),
    ).toHaveAttribute("aria-disabled", "true");

    liberar();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
  });

  it("a posição anuncia o carregamento em vez de mentir a página antiga", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const liberar = listagemControlada(pagina([colaborador2], 2, 45));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Carregando página…"),
    );

    liberar();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
      ).toHaveTextContent("Página 2 de 3"),
    );
  });
});

// ---------------------------------------------------------------------------
// T172 — contrato de CSS da seção Contatos (jsdom não mede layout)
//
// O vão de 256 px nasceu de uma regra de CSS, não de lógica. Estes casos
// prendem a regra: a classe própria do aviso NÃO pode ter nenhuma propriedade
// `flex*` (com `flex-basis` numa coluna flex, ela voltaria a virar altura), e a
// regra compartilhada da T111 NÃO pode ter sido alterada para consertar o
// problema por cima dela.
// ---------------------------------------------------------------------------
describe("T172 — contrato de CSS da seção Contatos", () => {
  // Caminho relativo à raiz do pacote, como nos demais testes de CSS:
  // `import.meta.url` não é um URL `file:` sob esta configuração do Vitest.
  const css = readFileSync(
    "src/screens/pessoas/ColaboradoresScreen.css",
    "utf8",
  );

  /** Corpo da regra cujo seletor é exatamente `seletor`, ou `null`. */
  function corpoDaRegra(seletor: string): string | null {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
      "m",
    ).exec(css);
    return m ? (m[1] ?? "") : null;
  }

  it("a classe própria do aviso existe e não tem nenhuma propriedade flex", () => {
    const corpo = corpoDaRegra(".colaboradores-screen__contatos-aviso");
    expect(corpo).not.toBeNull();
    expect(corpo).not.toMatch(/(?:^|[;\s])flex(?:-grow|-basis|-shrink)?\s*:/);
    expect(corpo).not.toMatch(/(?:^|[;\s])height\s*:|min-height\s*:/);
  });

  it("a classe própria usa só token de cor e não define margem além de zero", () => {
    const corpo = corpoDaRegra(".colaboradores-screen__contatos-aviso") ?? "";
    expect(corpo).toMatch(/color:\s*var\(--/);
    expect(corpo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(corpo).toMatch(/margin:\s*0\s*;/);
  });

  it("a regra compartilhada da T111 continua intacta, com o flex que ela sempre teve", () => {
    const corpo = corpoDaRegra(".colaboradores-screen__aviso-texto");
    expect(corpo).not.toBeNull();
    expect(corpo).toMatch(/flex:\s*1\s+1\s+16rem\s*;/);
    expect(corpo).toMatch(/color:\s*var\(--color-ink\)\s*;/);
  });

  it("a seção e o formulário de Contatos continuam colunas flex, que é o que explica o vão", () => {
    // Documenta a premissa do defeito: se a seção deixasse de ser coluna flex, a
    // classe flexível não abriria vão, e a regra própria perderia o motivo.
    const m =
      /\.colaboradores-screen__contatos,\s*\.colaboradores-screen__contatos-form\s*\{([^}]*)\}/.exec(
        css,
      );
    expect(m).not.toBeNull();
    expect(m?.[1]).toMatch(/display:\s*flex/);
    expect(m?.[1]).toMatch(/flex-direction:\s*column/);
  });
});

// ---------------------------------------------------------------------------
// T178 — Colaboradores como porta principal de Gestão de Pessoas: colunas do
// vínculo principal, busca no servidor, contadores do escopo, estados vazios
// distintos e a ficha aberta a partir da linha.
// ---------------------------------------------------------------------------

/** Colaborador da listagem com os vínculos dados (já na ordem do servidor). */
function listado(
  base: Partial<ColaboradorListadoApi> & { id: string; nome: string },
  vinculos: ColaboradorListadoApi["vinculos"] = [],
): ColaboradorListadoApi {
  return {
    situacao: "ativo",
    criadoEm: "2026-01-01T12:00:00.000Z",
    atualizadoEm: "2026-01-01T12:00:00.000Z",
    ...base,
    vinculos,
  };
}

function vinculoListado(
  id: string,
  matricula: string,
  situacao: "previsto" | "ativo" | "encerrado",
  dataAdmissao: string,
): ColaboradorListadoApi["vinculos"][number] {
  return {
    tipo: "clt",
    id,
    empresaId: "44444444-4444-4444-4444-444444444444",
    matricula,
    situacao,
    dataAdmissao,
    dataDesligamento: situacao === "encerrado" ? "2025-12-31" : null,
    // T184 — só o vínculo ativo tem lotação vigente.
    lotacaoVigente: situacao === "ativo" ? LOTACAO_ATIVA : null,
    // T185 — a API só projeta jornada para o vínculo ativo.
    vigenciasDeJornada: situacao === "ativo" ? [JORNADA_VIGENTE] : [],
  };
}

/**
 * T199 — as abas do dashboard substituem os seletores de situação e o select
 * "Situação do vínculo" (N-3): cada aba pede o próprio grupo ao servidor.
 */
function abrirAba(
  rotulo:
    | "Ativos"
    | "Em admissão"
    | "Férias e ausências"
    | "Escala de trabalho"
    | "Desligados"
    | "Todos",
) {
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${rotulo}`) }));
}

// T215 — a busca da referência: um campo só, enviado com Enter.
const campoBusca = () =>
  screen.getByRole("searchbox", { name: "Buscar por nome, CPF, e-mail ou ID" });

function buscar(termo: string) {
  fireEvent.change(campoBusca(), { target: { value: termo } });
  fireEvent.submit(campoBusca().closest("form")!);
}

describe("T178 — colunas e vínculo principal", () => {
  it("cada linha mostra nome e cargo, CPF, contatos, salário e contrato do vínculo principal (T215)", async () => {
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });

    // [0] seleção, [1] colaborador, [2] CPF, [3] contatos, [4] salário,
    // [5] contrato.
    const ana = within(tabela).getByText(colaborador1.nome).closest("tr")!;
    const celulasAna = within(ana).getAllByRole("cell");
    expect(celulasAna[1]).toHaveTextContent(colaborador1.nome);
    // T184 — o cargo da lotação vigente, embaixo do nome.
    expect(celulasAna[1]).toHaveTextContent("Analista (teste)");
    // Sem o dado do servidor: traço ou "Sem contato", nunca inventado.
    expect(celulasAna[2]).toHaveTextContent("—");
    expect(celulasAna[3]).toHaveTextContent("Sem contato");
    expect(celulasAna[4]).toHaveTextContent("—");
    // T199 — tipo do vínculo da linha.
    expect(celulasAna[5]).toHaveTextContent("CLT");

    // Sem vínculo na empresa ativa: traço, nunca dado inventado.
    const bruno = within(tabela).getByText(colaborador2.nome).closest("tr")!;
    const celulasBruno = within(bruno).getAllByRole("cell");
    expect(celulasBruno[1]).toHaveTextContent("Sem cargo");
    expect(celulasBruno[2]).toHaveTextContent("—");
    expect(celulasBruno[5]).toHaveTextContent("—");
  });

  it("T184 — sem lotação vigente (previsto ou encerrado): 'Sem cargo' (T215)", async () => {
    const previsto = listado(
      {
        id: "66666666-6666-4666-8666-666666666661",
        nome: "Pessoa Prevista (teste)",
      },
      [vinculoListado("v-p", "DEMO-P-0001", "previsto", "2026-11-03")],
    );
    const encerrado = listado(
      {
        id: "66666666-6666-4666-8666-666666666662",
        nome: "Pessoa Desligada (teste)",
      },
      [vinculoListado("v-e", "DEMO-E-0001", "encerrado", "2024-01-02")],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([previsto, encerrado]),
    );
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    for (const nome of [
      "Pessoa Prevista (teste)",
      "Pessoa Desligada (teste)",
    ]) {
      const celulas = within(
        within(tabela).getByText(nome).closest("tr")!,
      ).getAllByRole("cell");
      expect(celulas[1]).toHaveTextContent("Sem cargo");
    }
  });

  it("T184 — lotação vigente sem cargo: 'Sem cargo' (T215)", async () => {
    const semCargo = listado(
      {
        id: "66666666-6666-4666-8666-666666666663",
        nome: "Pessoa Sem Cargo (teste)",
      },
      [
        {
          ...vinculoListado("v-s", "DEMO-S-0001", "ativo", "2025-02-03"),
          lotacaoVigente: {
            cargo: null,
            departamento: LOTACAO_ATIVA.departamento,
          },
        },
      ],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([semCargo]));
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    const celulas = within(
      within(tabela).getByText("Pessoa Sem Cargo (teste)").closest("tr")!,
    ).getAllByRole("cell");
    expect(celulas[1]).toHaveTextContent("Sem cargo");
  });

  it("T184 — com mais de um vínculo, a lotação é a do vínculo principal", async () => {
    const dois = listado(
      {
        id: "66666666-6666-4666-8666-666666666664",
        nome: "Pessoa Dois Vínculos (teste)",
      },
      [
        vinculoListado("v-a", "DEMO-A-0009", "ativo", "2025-01-01"),
        vinculoListado("v-b", "DEMO-B-0009", "previsto", "2026-03-01"),
      ],
    );
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([dois]));
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    const celulas = within(
      within(tabela).getByText("Pessoa Dois Vínculos (teste)").closest("tr")!,
    ).getAllByRole("cell");
    expect(celulas[1]).toHaveTextContent("Analista (teste)");
    expect(celulas[5]).toHaveTextContent("CLT");
  });

  // T215 — as colunas "Jornada de trabalho" (T185) e "Matrícula" (com o
  // "+N" dos vínculos a mais) saíram da lista, como na referência: a
  // jornada e os vínculos ficam na ficha e na aba Escala de trabalho.
});

describe("T178/T215 — busca por nome, CPF, e-mail ou ID, no servidor", () => {
  it("o campo é rotulado e fica num formulário de busca", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const formulario = screen.getByRole("search", {
      name: "Buscar colaboradores",
    });
    expect(within(formulario).getByRole("searchbox")).toBe(campoBusca());
    expect(campoBusca()).toHaveAttribute("maxLength", "160");
    // T215 — sem botões "Buscar" e "Limpar busca": Enter ou a pausa.
    expect(screen.queryByRole("button", { name: "Buscar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
  });

  it("envia o termo aparado, na página 1, e nunca filtra a página no cliente", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    // O servidor devolve só Bruno; a tela mostra o que ele mandou.
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([colaborador2]));
    buscar("  bruno  ");

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          busca: "bruno",
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
    expect(campoBusca()).toHaveValue("bruno");
    await waitFor(() =>
      expect(screen.queryByText(colaborador1.nome)).toBeNull(),
    );
    expect(screen.getByText(colaborador2.nome)).toBeInTheDocument();
  });

  it("T215 — digitar consulta só depois da pausa: uma leitura, com o termo final", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const antes = vi.mocked(listarColaboradores).mock.calls.length;

    fireEvent.change(campoBusca(), { target: { value: "an" } });
    fireEvent.change(campoBusca(), { target: { value: "ana" } });

    // Na hora, nada; a cada tecla, nada.
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(antes);
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        { busca: "ana", pagina: 1, tamanhoPagina: 20, grupo: "ativos" },
        COM_SINAL,
      ),
    );
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(antes + 1);
  });

  it("convive com a aba e os filtros e, buscando na página 3, volta à página 1", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([colaborador1], 3, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    abrirAba("Desligados");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          grupo: "desligados",
          pagina: 1,
          tamanhoPagina: 20,
        },
        COM_SINAL,
      ),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });

    buscar("MAT-00");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          grupo: "desligados",
          busca: "MAT-00",
          pagina: 1,
          tamanhoPagina: 20,
        },
        COM_SINAL,
      ),
    );
  });

  it("só espaços é 'sem busca': a chave nem vai ao servidor", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    buscar("     ");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
    expect(campoBusca()).toHaveValue("");
  });

  it("termo acima de 160 caracteres vai cortado no teto do servidor", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    buscar("a".repeat(200));
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          busca: "a".repeat(160),
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
  });

  it("apagar o termo volta ao conjunto inteiro, com o foco no campo (T215: sem 'Limpar busca')", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    buscar("ana");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          busca: "ana",
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });

    campoBusca().focus();
    buscar("");

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
    expect(campoBusca()).toHaveValue("");
    expect(campoBusca()).toHaveFocus();
  });

  it("resposta obsoleta de uma busca não sobrescreve a da busca atual", async () => {
    const atrasada = adiado<ResultadoPaginadoTeste<ColaboradorListadoApi>>();
    vi.mocked(listarColaboradores)
      .mockResolvedValueOnce(paginado([colaborador1, colaborador2]))
      .mockImplementationOnce(() => atrasada.promessa)
      .mockResolvedValueOnce({
        ...paginado([colaborador2]),
        contadores: { ...contados([]), ativos: 7, inativos: 2, total: 9 },
      });

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    buscar("ana");
    buscar("bruno");

    await waitFor(() =>
      expect(screen.queryByText(colaborador1.nome)).toBeNull(),
    );
    expect(screen.getByText(colaborador2.nome)).toBeInTheDocument();

    // A busca "ana" responde AGORA, depois da "bruno": é descartada inteira —
    // linhas e contadores.
    await act(async () => {
      atrasada.resolver({
        ...paginado([colaborador1]),
        contadores: { ...contados([]), ativos: 99, inativos: 99, total: 198 },
      });
    });
    expect(screen.queryByText(colaborador1.nome)).toBeNull();
    expect(screen.getByText(colaborador2.nome)).toBeInTheDocument();
    const indicadores = screen.getByRole("group", {
      name: "Colaboradores ativos",
    });
    expect(within(indicadores).getByText("7")).toBeInTheDocument();
    expect(within(indicadores).queryByText("99")).toBeNull();
  });
});

describe("T178 — estados vazios distintos", () => {
  it("empresa sem colaborador: título claro e 'Adicionar colaborador' para quem pode", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    const onNovaAdmissao = vi.fn();
    render(<ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} />);

    const titulo = await screen.findByRole("heading", {
      name: "Nenhum colaborador ativo no seu escopo",
    });
    const vazio = titulo.closest(".evolli-empty-state") as HTMLElement;
    fireEvent.click(
      within(vazio).getByRole("button", { name: "Novo colaborador" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Iniciar cadastro" }));
    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Limpar busca e filtros" }),
    ).toBeNull();
  });

  it("busca sem resultado: 'Nenhum colaborador encontrado', com o termo, sem oferecer admissão", async () => {
    render(<ColaboradoresScreen onNovaAdmissao={() => {}} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    // A empresa tem gente (contadores > 0); a busca é que não achou.
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([]),
      contadores: {
        ...contados([]),
        ativos: 3,
        inativos: 1,
        desligados: 1,
        total: 3 + 1,
      },
    });
    buscar("zzz-inexistente");

    const titulo = await screen.findByRole("heading", {
      name: "Nenhum colaborador encontrado",
    });
    const vazio = titulo.closest(".evolli-empty-state") as HTMLElement;
    expect(vazio).toHaveTextContent("zzz-inexistente");
    expect(
      within(vazio).queryByRole("button", { name: "Novo colaborador" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Nenhum colaborador ativo no seu escopo",
      }),
    ).toBeNull();
  });

  it("'Limpar busca e filtros' zera busca e filtros e relê o grupo inteiro", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([]),
      contadores: { ...contados([]), ativos: 3, inativos: 1, total: 4 },
    });
    await filtrarPelaGaveta(["Tipo de contrato", "PJ"]);
    await screen.findByRole("heading", {
      name: "Nenhum colaborador com estes filtros",
    });
    buscar("ana");
    await screen.findByRole("heading", {
      name: "Nenhum colaborador encontrado com estes filtros",
    });
    expect(
      screen.getByText(
        "Nenhum colaborador corresponde a “ana” com os filtros selecionados.",
      ),
    ).toBeInTheDocument();

    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([colaborador1, colaborador2]),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Limpar busca e filtros" }),
    );

    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).toBeNull();
    expect(campoBusca()).toHaveValue("");
  });
});

describe("T178 — 'Nova admissão' e a ficha a partir da linha", () => {
  it("'Adicionar colaborador' (T194) é a ação principal, no cabeçalho da página", async () => {
    const onNovaAdmissao = vi.fn();
    render(<ComFicha onNovaAdmissao={onNovaAdmissao} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    const botao = screen.getByRole("button", { name: "Novo colaborador" });
    expect(botao.closest(".evolli-page-header")).not.toBeNull();
    expect(botao).toHaveClass("evolli-button--primary");
    fireEvent.click(botao);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar cadastro" }));
    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
  });

  it("'Abrir ficha' abre a ficha do colaborador da linha", async () => {
    // Bruno não tem vínculo na empresa ativa.
    vi.mocked(listarVinculosDoColaborador).mockResolvedValueOnce([]);
    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });

    fireEvent.click(
      screen.getByRole("button", {
        name: `Abrir ficha de ${colaborador2.nome}`,
      }),
    );

    const ficha = await esperarFicha();
    expect(
      within(ficha).getByRole("heading", { level: 1, name: colaborador2.nome }),
    ).toBeInTheDocument();
    expect(listarVinculosDoColaborador).toHaveBeenLastCalledWith(
      colaborador2.id,
    );
    // T215 — sem vínculo na empresa ativa, a situação é a do cadastro.
    expect(ficha.querySelector(".ficha-ref__status-selo")).toHaveTextContent(
      "Inativo",
    );
    expect(ficha.querySelector(".ficha-ref__contrato")).toBeNull();
  });

  it("cada montagem relê o servidor: nada de lista guardada entre montagens", async () => {
    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    const { unmount } = render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    unmount();

    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(vi.mocked(listarColaboradores).mock.calls.length - antes).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T186 — os contadores viram os filtros de situação da listagem.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T190 — filtros por Departamento e Cargo, pela lotação vigente.
// ---------------------------------------------------------------------------

describe("T215 — gaveta 'Filtrar' (substitui os filtros de Departamento, Cargo e Tipo da T190)", () => {
  const EMPRESA = "44444444-4444-4444-4444-444444444444";
  function referencia(
    id: string,
    codigo: string,
    nome: string,
    status = "ativo",
  ) {
    return {
      id,
      codigo,
      nome,
      empresaId: EMPRESA,
      status,
      criadoEm: "2025-01-01T12:00:00.000Z",
      atualizadoEm: "2025-01-01T12:00:00.000Z",
    };
  }
  const DEP_ADM = referencia("d-1", "ADM", "Administrativo (teste)");
  const DEP_OPS = referencia("d-2", "OPS", "Operações (teste)");
  const DEP_INATIVO = referencia("d-9", "OLD", "Antigo (teste)", "inativo");
  const ARE_FIS = referencia("a-1", "FIS", "Fiscal (teste)");
  const CEN_100 = referencia("cc-1", "CC100", "Centro 100 (teste)");
  const UNI_SP = referencia("u-1", "SP", "Unidade SP (teste)");
  const CAR_ANA = referencia("c-1", "ANALISTA", "Analista (teste)");
  const CAR_TEC = referencia("c-2", "TECNICO", "Técnico (teste)");

  function pagina<T>(itens: T[]) {
    return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
  }

  beforeEach(() => {
    vi.mocked(listarDepartamentos).mockResolvedValue(
      pagina([DEP_ADM, DEP_OPS, DEP_INATIVO]) as never,
    );
    vi.mocked(listarAreas).mockResolvedValue(pagina([ARE_FIS]) as never);
    vi.mocked(listarCentrosCusto).mockResolvedValue(pagina([CEN_100]) as never);
    vi.mocked(listarUnidades).mockResolvedValue(pagina([UNI_SP]) as never);
    vi.mocked(listarCargos).mockResolvedValue(
      pagina([CAR_ANA, CAR_TEC]) as never,
    );
  });

  async function montarPronto() {
    render(<ColaboradoresScreen />);
    await screen.findByText(colaborador1.nome);
  }

  it("lê só referências ATIVAS dos 5 catálogos, uma página de 100; grupos na ordem", async () => {
    await montarPronto();
    for (const listar of [
      listarDepartamentos,
      listarAreas,
      listarCentrosCusto,
      listarUnidades,
      listarCargos,
    ]) {
      expect(listar).toHaveBeenCalledWith({
        status: "ativo",
        tamanhoPagina: 100,
      });
    }
    const gaveta = await abrirGaveta();
    expect(gaveta).toHaveAttribute("aria-modal", "true");
    await within(gaveta).findByRole("checkbox", {
      name: "Administrativo (teste) (ADM)",
    });
    expect(
      within(gaveta)
        .getAllByRole("group")
        .map((g) => g.querySelector("legend")?.textContent),
    ).toEqual([
      "Departamento",
      "Área",
      "Centro de custo",
      "Unidade",
      "Cargo",
      "Nível",
      "Tipo de contrato",
      "Gênero",
    ]);
    const deps = within(
      within(gaveta).getByRole("group", { name: "Departamento" }),
    )
      .getAllByRole("checkbox")
      .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);
    expect(deps).toEqual([
      "Administrativo (teste) (ADM)",
      "Operações (teste) (OPS)",
    ]);
    expect(
      within(within(gaveta).getByRole("group", { name: "Nível" }))
        .getAllByRole("checkbox")
        .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent),
    ).toEqual([
      "Primeiro emprego",
      "Júnior",
      "Pleno",
      "Sênior",
      "Líder técnico",
      "Coordenador",
      "Gerente",
      "Head",
      "Diretor",
      "VP",
      "C-Level",
    ]);
    expect(
      within(within(gaveta).getByRole("group", { name: "Tipo de contrato" }))
        .getAllByRole("button")
        .map((b) => [b.textContent, b.getAttribute("aria-pressed")]),
    ).toEqual(
      [
        "CLT",
        "Estágio",
        "Aprendiz",
        "PJ",
        "Temporário",
        "Outro controlado",
        "Part-time",
        "Freelancer",
        "Trainee",
      ].map((t) => [t, "false"]),
    );
    expect(
      within(within(gaveta).getByRole("group", { name: "Gênero" }))
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Feminino", "Masculino", "Outro", "Prefiro não informar"]);
  });

  it("departamento vai ao servidor só em 'Ver N resultados', na página 1, e o filtro fica à vista", async () => {
    await montarPronto();
    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    const gaveta = await abrirGaveta();
    fireEvent.click(
      await within(gaveta).findByRole("checkbox", {
        name: "Operações (teste) (OPS)",
      }),
    );
    // Rascunho: a listagem não muda enquanto se marca.
    expect(
      vi
        .mocked(listarColaboradores)
        .mock.calls.slice(antes)
        .filter(([c]) => c?.tamanhoPagina !== 1),
    ).toHaveLength(0);
    aplicarGaveta(gaveta);
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "ativos",
        departamentos: [DEP_OPS.id],
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Filtrar" })).toBeNull();
    const ativos = await screen.findByRole("group", {
      name: "Filtros ativos",
    });
    expect(
      within(ativos).getByRole("button", {
        name: "Remover filtro Departamento: Operações (teste) (OPS)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filtrar, 1 filtro ativo" }),
    ).toBeInTheDocument();
  });

  it("'Ver N resultados': contagem ao vivo no servidor (aba, busca e rascunho, uma linha só)", async () => {
    await montarPronto();
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) =>
      consulta?.tamanhoPagina === 1
        ? { ...paginado([colaborador1]), total: 7 }
        : paginado([colaborador1, colaborador2]),
    );
    const gaveta = await abrirGaveta();
    fireEvent.click(
      await within(gaveta).findByRole("checkbox", { name: "Pleno" }),
    );
    fireEvent.click(within(gaveta).getByRole("button", { name: "Feminino" }));
    expect(
      await within(gaveta).findByRole("button", { name: "Ver 7 resultados" }),
    ).toBeInTheDocument();
    expect(listarColaboradores).toHaveBeenLastCalledWith(
      {
        pagina: 1,
        tamanhoPagina: 1,
        grupo: "ativos",
        niveis: ["pleno"],
        generos: ["feminino"],
      },
      COM_SINAL,
    );
    expect(
      within(gaveta).getByRole("button", { name: "Feminino" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("contagem que falha: 'Ver resultados' ainda aplica", async () => {
    await montarPronto();
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => {
      if (consulta?.tamanhoPagina === 1) throw new Error("rede");
      return paginado([colaborador1]);
    });
    const gaveta = await abrirGaveta();
    fireEvent.click(within(gaveta).getByRole("button", { name: "PJ" }));
    await waitFor(() =>
      expect(
        vi
          .mocked(listarColaboradores)
          .mock.calls.some(([c]) => c?.tamanhoPagina === 1),
      ).toBe(true),
    );
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Ver resultados" }),
    );
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toMatchObject({ tipos: ["pj"] }),
    );
  });

  it("fechar sem aplicar descarta o rascunho; 'Limpar filtros' zera o rascunho; Escape devolve o foco ao botão", async () => {
    await montarPronto();
    const botao = screen.getByRole("button", { name: /^Filtrar/ });
    botao.focus();
    let gaveta = await abrirGaveta();
    fireEvent.click(within(gaveta).getByRole("button", { name: "CLT" }));
    fireEvent.keyDown(gaveta, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Filtrar" })).toBeNull(),
    );
    expect(botao).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).toBeNull();

    gaveta = await abrirGaveta();
    expect(within(gaveta).getByRole("button", { name: "CLT" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(within(gaveta).getByRole("button", { name: "CLT" }));
    fireEvent.click(
      await within(gaveta).findByRole("checkbox", {
        name: "Analista (teste) (ANALISTA)",
      }),
    );
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Limpar filtros" }),
    );
    expect(within(gaveta).getByRole("button", { name: "CLT" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      within(gaveta).getByRole("checkbox", {
        name: "Analista (teste) (ANALISTA)",
      }),
    ).not.toBeChecked();
  });

  it("combina busca, aba e todos os grupos, numa só consulta", async () => {
    await montarPronto();
    buscar("Ana");
    await waitFor(() => expect(ultimaLeituraDaLista().busca).toBe("Ana"));
    abrirAba("Todos");
    await waitFor(() => expect(ultimaLeituraDaLista().grupo).toBeUndefined());
    await filtrarPelaGaveta(
      ["Departamento", "Administrativo (teste) (ADM)"],
      ["Área", "Fiscal (teste) (FIS)"],
      ["Centro de custo", "Centro 100 (teste) (CC100)"],
      ["Unidade", "Unidade SP (teste) (SP)"],
      ["Cargo", "Técnico (teste) (TECNICO)"],
      ["Nível", "Sênior"],
      ["Tipo de contrato", "CLT"],
      ["Tipo de contrato", "PJ"],
      ["Gênero", "Outro"],
    );
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        busca: "Ana",
        departamentos: [DEP_ADM.id],
        areas: [ARE_FIS.id],
        centrosCusto: [CEN_100.id],
        unidades: [UNI_SP.id],
        cargos: [CAR_TEC.id],
        niveis: ["senior"],
        tipos: ["clt", "pj"],
        generos: ["outro"],
      }),
    );
    expect(
      within(screen.getByRole("group", { name: "Filtros ativos" }))
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Remover filtro Departamento: Administrativo (teste) (ADM)",
      "Remover filtro Área: Fiscal (teste) (FIS)",
      "Remover filtro Centro de custo: Centro 100 (teste) (CC100)",
      "Remover filtro Unidade: Unidade SP (teste) (SP)",
      "Remover filtro Cargo: Técnico (teste) (TECNICO)",
      "Remover filtro Nível: Sênior",
      "Remover filtro Tipo: CLT",
      "Remover filtro Tipo: PJ",
      "Remover filtro Gênero: Outro",
    ]);
    expect(
      screen.getByRole("button", { name: "Filtrar, 9 filtros ativos" }),
    ).toBeInTheDocument();
  });

  it("dois do mesmo grupo: qualquer um deles; remover um chip mantém o outro, a busca e a aba", async () => {
    await montarPronto();
    await filtrarPelaGaveta(
      ["Departamento", "Administrativo (teste) (ADM)"],
      ["Departamento", "Operações (teste) (OPS)"],
      ["Cargo", "Analista (teste) (ANALISTA)"],
    );
    await waitFor(() =>
      expect(ultimaLeituraDaLista().departamentos).toEqual([
        DEP_ADM.id,
        DEP_OPS.id,
      ]),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remover filtro Departamento: Administrativo (teste) (ADM)",
      }),
    );
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "ativos",
        departamentos: [DEP_OPS.id],
        cargos: [CAR_ANA.id],
      }),
    );
    // A gaveta abre com o que está aplicado.
    const gaveta = await abrirGaveta();
    expect(
      await within(gaveta).findByRole("checkbox", {
        name: "Operações (teste) (OPS)",
      }),
    ).toBeChecked();
    expect(
      within(gaveta).getByRole("checkbox", {
        name: "Administrativo (teste) (ADM)",
      }),
    ).not.toBeChecked();
  });

  it("os contadores seguem os do servidor, sem filtro: não mudam com a lotação", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([colaborador1]),
      contadores: { ...contados([]), ativos: 40, inativos: 7, total: 47 },
    });
    await montarPronto();
    await filtrarPelaGaveta(["Departamento", "Operações (teste) (OPS)"]);
    await waitFor(() =>
      expect(ultimaLeituraDaLista().departamentos).toEqual([DEP_OPS.id]),
    );
    expect(
      await screen.findByRole("tab", { name: /^Ativos,\s*40/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /^Todos,\s*47/ }),
    ).toBeInTheDocument();
  });

  it("paginar mantém os filtros", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      itens: [colaborador1],
      pagina: 1,
      tamanhoPagina: 20,
      total: 45,
      contadores: {
        ...contados([]),
        ativos: 45,
        inativos: 0,
        desligados: 0,
        total: 45,
      },
    });
    await montarPronto();
    await filtrarPelaGaveta(
      ["Departamento", "Administrativo (teste) (ADM)"],
      ["Gênero", "Masculino"],
    );
    await waitFor(() =>
      expect(ultimaLeituraDaLista().departamentos).toEqual([DEP_ADM.id]),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Próxima página" }),
    );
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toEqual({
        pagina: 2,
        tamanhoPagina: 20,
        grupo: "ativos",
        departamentos: [DEP_ADM.id],
        generos: ["masculino"],
      }),
    );
  });

  it("vazio com filtro e busca: “Limpar busca e filtros” tira tudo", async () => {
    await montarPronto();
    buscar("Bruno");
    await waitFor(() => expect(ultimaLeituraDaLista().busca).toBe("Bruno"));
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    await filtrarPelaGaveta(["Departamento", "Operações (teste) (OPS)"]);
    expect(
      await screen.findByText(
        "Nenhum colaborador encontrado com estes filtros",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Limpar busca e filtros" }),
    );
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "ativos",
      }),
    );
  });

  it("vazio só por filtro (sem busca): mensagem de filtros e “Limpar filtros”", async () => {
    await montarPronto();
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    await filtrarPelaGaveta(["Nível", "Diretor"]);
    expect(
      await screen.findByText("Nenhum colaborador com estes filtros"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "ativos",
      }),
    );
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).toBeNull();
  });

  it("abas sem lotação (Em admissão, Desligados): só Tipo de contrato e Gênero", async () => {
    await montarPronto();
    abrirAba("Desligados");
    await screen.findByRole("table", { name: /^Colaboradores — Desligados/ });
    const gaveta = await abrirGaveta();
    expect(
      within(gaveta)
        .getAllByRole("group")
        .map((g) => g.querySelector("legend")?.textContent),
    ).toEqual(["Tipo de contrato", "Gênero"]);
    fireEvent.click(within(gaveta).getByRole("button", { name: "Estágio" }));
    aplicarGaveta(gaveta);
    await waitFor(() =>
      expect(ultimaLeituraDaLista()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        grupo: "desligados",
        tipos: ["estagio"],
      }),
    );
  });

  it("catálogos indisponíveis: aviso e 'Recarregar' na gaveta; Tipo e Gênero seguem livres; a lista continua", async () => {
    vi.mocked(listarDepartamentos).mockRejectedValueOnce(new Error("rede"));
    render(<ColaboradoresScreen />);
    await screen.findByText(colaborador1.nome);
    const gaveta = await abrirGaveta();
    expect(
      await within(gaveta).findByText(
        "Não foi possível carregar departamentos, áreas, centros de custo, unidades e cargos.",
      ),
    ).toBeInTheDocument();
    expect(
      within(gaveta).queryByRole("group", { name: "Departamento" }),
    ).toBeNull();
    expect(
      within(gaveta).getByRole("group", { name: "Tipo de contrato" }),
    ).toBeInTheDocument();
    expect(screen.getByText(colaborador1.nome)).toBeInTheDocument();

    const leituras = vi.mocked(listarDepartamentos).mock.calls.length;
    fireEvent.click(within(gaveta).getByRole("button", { name: "Recarregar" }));
    expect(
      await within(gaveta).findByRole("checkbox", {
        name: "Administrativo (teste) (ADM)",
      }),
    ).toBeInTheDocument();
    expect(vi.mocked(listarDepartamentos).mock.calls.length).toBe(leituras + 1);
  });

  it("375 px: o resumo dos filtros quebra linha, sem alargar a página", () => {
    const css = readFileSync(
      "src/screens/pessoas/ColaboradoresScreen.css",
      "utf8",
    );
    const bloco = (seletor: string) =>
      new RegExp(`${seletor.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`).exec(
        css,
      )?.[1] ?? "";
    expect(bloco(".colaboradores-screen__filtros-ativos")).toMatch(
      /flex-wrap: wrap/,
    );
    expect(bloco(".colaboradores-screen__filtros-ativos")).toMatch(
      /min-width: 0/,
    );
    expect(bloco(".colaboradores-screen__filtro-ativo")).toMatch(
      /overflow-wrap: anywhere/,
    );
    expect(bloco(".colaboradores-screen__filtro-ativo")).toMatch(
      /white-space: normal/,
    );
    // Os chips de Tipo e Gênero quebram linha; as opções longas também.
    expect(bloco(".gaveta-filtros__chips")).toMatch(/flex-wrap: wrap/);
    expect(bloco(".gaveta-filtros__opcoes li")).toMatch(
      /overflow-wrap: anywhere/,
    );
  });
});

// ---------------------------------------------------------------------------
// T194 — "Adicionar colaborador": o botão abre um painel lateral com as formas
// de entrada; a tela de trás (busca, filtros, página, empresa) fica intacta, o
// foco volta ao botão de origem e o painel nunca vira edição pendente.
// ---------------------------------------------------------------------------

describe("T194 — painel 'Adicionar colaborador' na listagem", () => {
  const botaoAdicionar = () =>
    screen.getByRole("button", { name: "Novo colaborador" });

  async function montarComTabela(
    props: Partial<Parameters<typeof ColaboradoresScreen>[0]> = {},
  ) {
    const onNovaAdmissao = vi.fn();
    const utils = render(
      <ColaboradoresScreen onNovaAdmissao={onNovaAdmissao} {...props} />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    return { ...utils, onNovaAdmissao };
  }

  it.each([
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
    [
      "Fechar",
      () =>
        fireEvent.click(
          within(screen.getByRole("dialog")).getByRole("button", {
            name: "Fechar",
          }),
        ),
    ],
    [
      "Cancelar",
      () =>
        fireEvent.click(
          within(screen.getByRole("dialog")).getByRole("button", {
            name: "Cancelar",
          }),
        ),
    ],
  ])(
    "fechar por %s devolve o foco ao botão 'Adicionar colaborador'",
    async (_, fechar) => {
      const { onNovaAdmissao } = await montarComTabela();
      botaoAdicionar().focus();
      fireEvent.click(botaoAdicionar());
      const painel = screen.getByRole("dialog", {
        name: "Adicionar colaborador",
      });
      expect(document.activeElement).toBe(
        within(painel).getByRole("heading", { level: 2 }),
      );
      fechar();
      // T209 — o Sheet (Radix) desmonta e devolve o foco no ciclo seguinte.
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() =>
        expect(document.activeElement).toBe(botaoAdicionar()),
      );
      expect(onNovaAdmissao).not.toHaveBeenCalled();
    },
  );

  it("abrir e fechar não mexe na busca, nos filtros nem na página, e não relê nada", async () => {
    await montarComTabela();
    buscar("Ana");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        expect.objectContaining({ busca: "Ana" }),
        COM_SINAL,
      ),
    );
    abrirAba("Todos");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          busca: "Ana",
          pagina: 1,
          tamanhoPagina: 20,
        },
        COM_SINAL,
      ),
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const chamadas = vi.mocked(listarColaboradores).mock.calls.length;

    fireEvent.click(botaoAdicionar());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(chamadas);
    expect(campoBusca()).toHaveValue("Ana");
    expect(
      screen.getByRole("tab", { name: /^Todos/, selected: true }),
    ).toBeInTheDocument();
  });

  it("abrir o painel não registra edição pendente (a troca de empresa segue livre)", async () => {
    const registro = new RegistroDeEdicoes();
    render(
      <ProvedorDeEdicoes registro={registro}>
        <ColaboradoresScreen onNovaAdmissao={vi.fn()} />
      </ProvedorDeEdicoes>,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(botaoAdicionar());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(registro.obter()).toEqual({ pendentes: [], salvando: [] });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(registro.obter()).toEqual({ pendentes: [], salvando: [] });
  });

  it("empresa trocada (árvore remontada): o painel some e reabre só com a empresa nova", async () => {
    const { rerender } = render(
      <ColaboradoresScreen
        key="empresa-a"
        onNovaAdmissao={vi.fn()}
        empresaAtiva={{ nome: "Empresa Alfa Sintética", codigo: "ALFA" }}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(botaoAdicionar());
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Empresa Alfa Sintética",
    );

    rerender(
      comTrilha(
        <ColaboradoresScreen
          key="empresa-b"
          onNovaAdmissao={vi.fn()}
          empresaAtiva={{ nome: "Empresa Beta Sintética", codigo: "BETA" }}
        />,
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(botaoAdicionar());
    const painel = screen.getByRole("dialog");
    expect(painel).toHaveTextContent("Empresa Beta Sintética (BETA)");
    expect(painel).not.toHaveTextContent("Alfa");
  });

  it("o cadastro individual fecha o painel e segue para a Nova admissão uma vez só", async () => {
    const { onNovaAdmissao } = await montarComTabela();
    fireEvent.click(botaoAdicionar());
    fireEvent.click(screen.getByRole("button", { name: "Iniciar cadastro" }));
    expect(onNovaAdmissao).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("formas indisponíveis no painel não chamam nada", async () => {
    const { onNovaAdmissao } = await montarComTabela();
    const chamadas = vi.mocked(listarColaboradores).mock.calls.length;
    fireEvent.click(botaoAdicionar());
    const painel = screen.getByRole("dialog");
    for (const titulo of ["Importar planilha", "Admissão digital"]) {
      const radio = within(painel).getByRole("radio", {
        name: new RegExp(`^${titulo}`),
      });
      expect(radio).toBeDisabled();
      fireEvent.click(within(painel).getByText(titulo));
    }
    // A forma escolhida continua sendo o cadastro individual.
    expect(
      within(painel).getByRole("radio", { name: /^Cadastro individual/ }),
    ).toBeChecked();
    expect(onNovaAdmissao).not.toHaveBeenCalled();
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(chamadas);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Validação local — abrir a ficha pela linha: enquanto ela carrega, o foco
// não fica no "Abrir ficha" (já escondido com a listagem), e sim no título.
// ---------------------------------------------------------------------------
describe("T198 — foco ao abrir a ficha pela linha", () => {
  it("durante o carregamento, o foco vai ao título, nunca a um botão escondido", async () => {
    vi.mocked(buscarColaborador).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<ComFicha />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    const abrir = within(
      within(tabela).getByText(colaborador1.nome).closest("tr")!,
    ).getByRole("button", { name: /Abrir ficha/ });
    abrir.focus();
    fireEvent.click(abrir);

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Ficha do colaborador",
    });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(document.activeElement).not.toBe(abrir);
    expect(document.activeElement?.closest("[hidden]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T199 — dashboard de Colaboradores: indicadores do escopo, distribuição dos
// ativos por tipo (com legenda em texto), abas por grupo com teclado, a aba
// de jornada (a visão existente, com as mesmas permissões), colunas por aba e
// o estado controlado pelo shell (a URL).
// ---------------------------------------------------------------------------
describe("T199 — dashboard de Colaboradores", () => {
  const EMPRESA = { nome: "Empresa Teste A", codigo: "TA" };
  const CONTADORES: ContadoresColaboradoresApi = {
    ativos: 7,
    inativos: 5,
    emAdmissao: 2,
    desligados: 3,
    total: 12,
    ativosPorTipo: {
      clt: 5,
      estagio: 0,
      aprendiz: 0,
      pj: 2,
      temporario: 0,
      outro_controlado: 0,
      part_time: 0,
      freelancer: 0,
      trainee: 0,
    },
  };
  const ESTADO_ATIVOS = {
    aba: "ativos" as const,
    pagina: 1,
    tamanho: 20 as const,
    filtros: FILTROS_VAZIOS,
  };
  const tablist = () =>
    screen.getByRole("tablist", { name: "Grupos de colaboradores" });
  const aba = (nome: RegExp) =>
    within(tablist()).getByRole("tab", { name: nome });
  const cabecalhos = () =>
    within(screen.getByRole("table", { name: /^Colaboradores — / }))
      .getAllByRole("columnheader")
      .map((c) => c.textContent ?? "");

  it("T215 — o número de Férias e ausências é quem está fora hoje (como a referência), desde a abertura", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([colaborador1]),
      contadores: CONTADORES,
    });
    const listar = vi.fn(async () => ({
      itens: [],
      pagina: 1,
      tamanhoPagina: 1,
      total: 0,
      indicadores: {
        emFeriasAgora: 1,
        licencasEAfastamentos: 1,
        faltasEsteMes: 0,
        proximasFerias: 0,
        pendentes: 9,
        ausentesHoje: 3,
      },
    }));
    render(
      <ColaboradoresScreen
        empresaAtiva={EMPRESA}
        servicoDeAusencias={{ listar } as never}
      />,
    );
    await waitFor(() =>
      expect(aba(/^Férias e ausências/)).toHaveAccessibleName(
        "Férias e ausências, 3",
      ),
    );
    expect(listar.mock.calls[0]).toEqual([
      { pagina: 1, tamanhoPagina: 1 },
      { signal: expect.any(AbortSignal) },
    ]);
  });

  it("T215 — cartões com os números do servidor e a distribuição por tipo de contrato em texto", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([colaborador1]),
      contadores: CONTADORES,
    });
    render(<ColaboradoresScreen empresaAtiva={EMPRESA} />);
    const ativos = await screen.findByRole("group", {
      name: "Colaboradores ativos",
    });
    await waitFor(() => expect(within(ativos).getByText("7")).toBeVisible());
    expect(within(ativos).getByText("12 cadastrados")).toBeInTheDocument();

    const tipos = screen.getByRole("group", { name: "Por tipo de contrato" });
    expect(
      within(tipos)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["CLT 5", "PJ 2", "Estágio 0", "Aprendiz 0", "Outros 0"]);
    // A barra é só visual: a legenda diz os mesmos números.
    expect(
      tipos.querySelector(".colaboradores-screen__barra-contratos"),
    ).toHaveAttribute("aria-hidden", "true");
    // As abas mostram o total de cada grupo; Escala de trabalho não tem
    // número, e Férias e ausências fica em zero até o módulo.
    expect(aba(/^Ativos/)).toHaveAccessibleName("Ativos, 7");
    expect(aba(/^Desligados/)).toHaveAccessibleName("Desligados, 3");
    expect(aba(/^Todos/)).toHaveAccessibleName("Todos, 12");
    expect(aba(/^Férias e ausências/)).toHaveAccessibleName(
      "Férias e ausências, 0",
    );
    expect(aba(/^Escala de trabalho/)).toHaveTextContent(
      /^Escala de trabalho$/,
    );
    // T215 — "Em admissão" saiu da faixa de abas.
    expect(
      within(tablist()).queryByRole("tab", { name: /^Em admissão/ }),
    ).toBeNull();
  });

  it("sem ativos: o cartão diz zero, a legenda zera e a barra não tem faixa", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([]),
      contadores: {
        ...CONTADORES,
        ativos: 0,
        ativosPorTipo: contados([]).ativosPorTipo,
      },
    });
    render(<ColaboradoresScreen empresaAtiva={EMPRESA} />);
    const ativos = await screen.findByRole("group", {
      name: "Colaboradores ativos",
    });
    await waitFor(() => expect(within(ativos).getByText("0")).toBeVisible());
    const tipos = screen.getByRole("group", { name: "Por tipo de contrato" });
    expect(
      within(tipos)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["CLT 0", "PJ 0", "Estágio 0", "Aprendiz 0", "Outros 0"]);
    expect(
      tipos.querySelectorAll(".colaboradores-screen__barra-contrato"),
    ).toHaveLength(0);
  });

  it("teclado nas abas: setas, Home e End movem o foco; só a aba selecionada fica na ordem de tabulação", async () => {
    render(<ColaboradoresScreen empresaAtiva={EMPRESA} />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    // T215 — cinco abas aqui: Ativos, Férias e ausências, Escala de
    // trabalho, Desligados e Todos (sem "Em admissão"; sem destino, sem
    // Organograma).
    const abas = within(tablist()).getAllByRole("tab");
    expect(abas.map((a) => a.tabIndex)).toEqual([0, -1, -1, -1, -1]);

    abas[0]!.focus();
    fireEvent.keyDown(abas[0]!, { key: "ArrowRight" });
    expect(abas[1]).toHaveFocus();
    fireEvent.keyDown(abas[1]!, { key: "End" });
    expect(abas[4]).toHaveFocus();
    fireEvent.keyDown(abas[4]!, { key: "ArrowRight" });
    expect(abas[0]).toHaveFocus();
    fireEvent.keyDown(abas[0]!, { key: "ArrowLeft" });
    expect(abas[4]).toHaveFocus();
    fireEvent.keyDown(abas[4]!, { key: "Home" });
    expect(abas[0]).toHaveFocus();
    // Mover o foco não troca de aba (ativação manual: Enter, Espaço ou clique).
    expect(abas[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.click(abas[3]!);
    await screen.findByRole("table", { name: /^Colaboradores — Desligados/ });
    const depois = within(tablist()).getAllByRole("tab");
    expect(depois[3]).toHaveAttribute("aria-selected", "true");
    expect(depois.map((a) => a.tabIndex)).toEqual([-1, -1, -1, 0, -1]);
    // O painel é rotulado pela aba selecionada.
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      depois[3]!.id,
    );
  });

  it.each([
    [true, "Somente RH"],
    [false, "Somente consulta"],
  ])(
    "aba Escala de trabalho: a visão de jornadas existente, embutida (opera: %s)",
    async (podeOperarJornada, selo) => {
      render(
        <ColaboradoresScreen
          empresaAtiva={EMPRESA}
          podeOperarJornada={podeOperarJornada}
        />,
      );
      await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
      const chamadas = vi.mocked(listarColaboradores).mock.calls.length;
      abrirAba("Escala de trabalho");
      const painel = screen.getByRole("tabpanel");
      expect(
        await within(painel).findByRole("heading", {
          level: 2,
          name: "Jornada de trabalho",
        }),
      ).toBeInTheDocument();
      expect(within(painel).getByText(selo)).toBeInTheDocument();
      // Sem tabela de colaboradores, busca nem filtros do dashboard.
      expect(
        screen.queryByRole("table", { name: /^Colaboradores — / }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: /^Filtrar($|,)/ }),
      ).toBeNull();
      // A aba de jornada não relê a listagem (a visão de jornadas só confere,
      // como sempre, quantos ativos há); os indicadores continuam.
      const novas = vi
        .mocked(listarColaboradores)
        .mock.calls.slice(chamadas)
        .map(([consulta]) => consulta);
      for (const consulta of novas) {
        expect(consulta).toEqual({ situacao: "ativo", tamanhoPagina: 1 });
      }
      expect(
        screen.getByRole("group", { name: "Colaboradores ativos" }),
      ).toBeInTheDocument();
      // Um único h1 na página.
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    },
  );

  it("aba Jornada aberta direto: os indicadores vêm de uma leitura mínima, sem grupo nem filtros", async () => {
    const chamadas = vi.mocked(listarColaboradores).mock.calls.length;
    render(
      <ColaboradoresScreen
        empresaAtiva={EMPRESA}
        estado={{ ...ESTADO_ATIVOS, aba: "jornada" }}
        onEstadoChange={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 1,
        },
        COM_SINAL,
      ),
    );
    // Nenhuma consulta da tabela do dashboard (grupo, página de 20).
    for (const [consulta] of vi
      .mocked(listarColaboradores)
      .mock.calls.slice(chamadas)) {
      expect(consulta).not.toHaveProperty("grupo");
      expect(consulta?.tamanhoPagina).toBe(1);
    }
  });

  it("lotação só em Ativos e Todos; Tipo em todas (T215: sem coluna Desligamento)", async () => {
    render(<ColaboradoresScreen empresaAtiva={EMPRESA} />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    expect(cabecalhos()).not.toContain("Desligamento");
    // T215 — os grupos vivem na gaveta "Filtrar".
    const gruposDaGaveta = async () => {
      const gaveta = await abrirGaveta();
      const nomes = within(gaveta)
        .getAllByRole("group")
        .map((g) => g.querySelector("legend")?.textContent);
      fireEvent.keyDown(gaveta, { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Filtrar" })).toBeNull(),
      );
      return nomes;
    };
    expect(await gruposDaGaveta()).toContain("Departamento");

    abrirAba("Desligados");
    await screen.findByRole("table", { name: "Colaboradores — Desligados" });
    expect(await gruposDaGaveta()).toEqual(["Tipo de contrato", "Gênero"]);
    expect(cabecalhos()).not.toContain("Desligamento");

    abrirAba("Todos");
    await screen.findByRole("table", { name: "Colaboradores — Todos" });
    expect(cabecalhos()).not.toContain("Desligamento");
    expect(await gruposDaGaveta()).toContain("Cargo");
  });

  it("na aba Desligados, a linha mostra o contrato do vínculo encerrado (T215)", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        listado(
          {
            id: "c-des",
            nome: "Pessoa Desligada (teste)",
            situacao: "inativo",
          },
          [
            {
              ...vinculoListado("v-des", "MAT-0900", "encerrado", "2024-03-01"),
              tipo: "pj",
            },
          ],
        ),
      ]),
    );
    render(
      <ColaboradoresScreen
        empresaAtiva={EMPRESA}
        estado={{ ...ESTADO_ATIVOS, aba: "desligados" }}
        onEstadoChange={vi.fn()}
      />,
    );
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores — Desligados",
    });
    const linha = within(tabela).getAllByRole("row")[1]!;
    const celulas = within(linha).getAllByRole("cell");
    const indice = (nome: string) => cabecalhos().indexOf(nome);
    expect(celulas[indice("Contrato")]).toHaveTextContent("PJ");
    expect(celulas[indice("Colaborador")]).toHaveTextContent("Sem cargo");
  });

  it("T215 — em Todos, quem foi desativado aparece como Inativo, mesmo com o vínculo ativo", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        {
          ...listado(
            {
              id: "c-off",
              nome: "Pessoa Desativada (teste)",
              situacao: "ativo",
            },
            [vinculoListado("v-off", "MAT-0901", "ativo", "2025-01-02")],
          ),
          desativado: true,
        },
      ]),
    );
    render(
      <ColaboradoresScreen
        empresaAtiva={EMPRESA}
        estado={{ ...ESTADO_ATIVOS, aba: "todos" }}
        onEstadoChange={vi.fn()}
      />,
    );
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores — Todos",
    });
    const linha = within(tabela).getAllByRole("row")[1]!;
    const celulas = within(linha).getAllByRole("cell");
    // T215 — sem coluna Situação: a etiqueta "Inativo" fica junto do nome.
    expect(celulas[cabecalhos().indexOf("Colaborador")]).toHaveTextContent(
      /Inativo$/,
    );
  });

  it("controlado pelo shell: aba, página e filtros sobem por onEstadoChange; a busca não sobe", async () => {
    const onEstadoChange = vi.fn();
    render(
      <ColaboradoresScreen
        empresaAtiva={EMPRESA}
        estado={ESTADO_ATIVOS}
        onEstadoChange={onEstadoChange}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });

    abrirAba("Desligados");
    expect(onEstadoChange).toHaveBeenLastCalledWith({
      ...ESTADO_ATIVOS,
      aba: "desligados",
    });
    await filtrarPelaGaveta(["Tipo de contrato", "Estágio"]);
    expect(onEstadoChange).toHaveBeenLastCalledWith({
      ...ESTADO_ATIVOS,
      filtros: soTipos("estagio"),
    });

    const antes = onEstadoChange.mock.calls.length;
    buscar("Ana");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        expect.objectContaining({ busca: "Ana" }),
        COM_SINAL,
      ),
    );
    expect(onEstadoChange.mock.calls.length).toBe(antes);
    for (const [estado] of onEstadoChange.mock.calls) {
      expect(JSON.stringify(estado)).not.toMatch(/Ana/);
    }
  });

  it("o nome abre a ficha; as mesmas colunas da referência em todas as abas (T215)", async () => {
    const onAbrirFicha = vi.fn();
    render(
      <ColaboradoresScreen
        empresaAtiva={EMPRESA}
        onAbrirFicha={onAbrirFicha}
      />,
    );
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — Ativos/,
    });
    fireEvent.click(
      within(tabela).getByRole("button", {
        name: `Abrir ficha de ${colaborador1.nome}`,
      }),
    );
    expect(onAbrirFicha).toHaveBeenCalledWith(colaborador1.id);
    for (const rotulo of ["Ativos", "Desligados", "Todos"] as const) {
      abrirAba(rotulo);
      await screen.findByRole("table", { name: `Colaboradores — ${rotulo}` });
      expect(cabecalhos()).toEqual([
        "Selecionar todos desta página",
        "Colaborador",
        "CPF",
        "Contatos",
        "Salário",
        "Contrato",
        "Ações",
      ]);
    }
  });
});

describe("T199 — contrato de CSS do dashboard (375 px)", () => {
  const css = readFileSync(
    "src/screens/pessoas/ColaboradoresScreen.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const inicio = css.indexOf("/* ---- T199 — dashboard de Colaboradores");
  const bloco = css.slice(inicio, css.indexOf("/* T178 — barra de ações:"));
  const midia =
    /@media \(max-width: 40rem\) \{([\s\S]*?)\n\}/.exec(bloco)?.[1] ?? "";

  it("o bloco do dashboard existe e usa só tokens: nenhuma cor literal", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(bloco).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });

  it("até 40rem, as abas viram grade de duas colunas, sem rolagem lateral", () => {
    expect(midia).toMatch(
      /\.colaboradores-screen__abas \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*overflow-x: visible;/,
    );
    expect(midia).toMatch(
      /\.colaboradores-screen__aba \{[^}]*white-space: normal;/,
    );
  });

  it("até 40rem, cartões dois a dois; contêineres com min-width 0 (não alargam a página)", () => {
    expect(midia).toMatch(
      /\.colaboradores-screen__cartoes \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    for (const classe of [
      "indicadores",
      "cartoes",
      "cartao",
      "painel",
      "abas",
      "painel-conteudo",
    ]) {
      expect(bloco).toMatch(
        new RegExp(`\\.colaboradores-screen__${classe} \\{[^}]*min-width: 0;`),
      );
    }
  });

  it("aba ativa não depende só de cor: peso e barra inferior", () => {
    expect(bloco).toMatch(
      /\.colaboradores-screen__aba--ativa \{[^}]*border-bottom-color: var\(--color-action\);[^}]*font-weight: var\(--weight-strong\);/,
    );
  });
});

// ---------------------------------------------------------------------------
// T199 (revisão) — id de lotação vindo da URL: só vira consulta depois de
// conferido nos catálogos da empresa ativa; desconhecido cai no padrão, com a
// correção pedida "no lugar" (sem entrada no histórico).
// ---------------------------------------------------------------------------
describe("T199 — ids de lotação da URL conferidos nos catálogos", () => {
  const DEP = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    codigo: "ADM",
    nome: "Administrativo (teste)",
    empresaId: "44444444-4444-4444-4444-444444444444",
    status: "ativo",
    criadoEm: "2025-01-01T12:00:00.000Z",
    atualizadoEm: "2025-01-01T12:00:00.000Z",
  };
  const CAR = { ...DEP, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
  const DEP_INATIVO = {
    ...DEP,
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "inativo",
  };
  const DE_OUTRA_EMPRESA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const pagina = <T,>(itens: T[]) => ({
    itens,
    pagina: 1,
    tamanhoPagina: 100,
    total: itens.length,
  });
  const ARE = { ...DEP, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" };
  const ESTADO: EstadoDaListagem = {
    aba: "ativos",
    pagina: 3,
    tamanho: 20,
    filtros: soTipos("clt"),
  };
  const comFiltros = (
    parcial: Partial<FiltrosDaListagem>,
  ): EstadoDaListagem => ({
    ...ESTADO,
    filtros: { ...ESTADO.filtros, ...parcial },
  });

  beforeEach(() => {
    vi.mocked(listarDepartamentos).mockResolvedValue(
      pagina([DEP, DEP_INATIVO]) as never,
    );
    vi.mocked(listarCargos).mockResolvedValue(pagina([CAR]) as never);
    vi.mocked(listarAreas).mockResolvedValue(pagina([ARE]) as never);
  });

  const consultasCom = (
    campo: "departamentos" | "cargos" | "areas",
    id: string,
  ) =>
    vi
      .mocked(listarColaboradores)
      .mock.calls.filter(([consulta]) => consulta?.[campo]?.includes(id));

  it.each([
    ["de outra empresa", DE_OUTRA_EMPRESA],
    ["inativo", DEP_INATIVO.id],
  ])(
    "departamento %s: nenhuma consulta com ele; cai no padrão, corrigido no lugar",
    async (_caso, id) => {
      const onEstadoChange = vi.fn();
      render(
        <ColaboradoresScreen
          estado={comFiltros({ departamentos: [id], cargos: [CAR.id] })}
          onEstadoChange={onEstadoChange}
        />,
      );
      await waitFor(() =>
        expect(onEstadoChange).toHaveBeenCalledWith(
          { ...comFiltros({ cargos: [CAR.id] }), pagina: 1 },
          { substituir: true },
        ),
      );
      expect(consultasCom("departamentos", id)).toHaveLength(0);
    },
  );

  it("cargo desconhecido: o mesmo, mantendo o departamento conhecido", async () => {
    const onEstadoChange = vi.fn();
    render(
      <ColaboradoresScreen
        estado={comFiltros({
          departamentos: [DEP.id],
          cargos: [DE_OUTRA_EMPRESA],
        })}
        onEstadoChange={onEstadoChange}
      />,
    );
    await waitFor(() =>
      expect(onEstadoChange).toHaveBeenCalledWith(
        { ...comFiltros({ departamentos: [DEP.id] }), pagina: 1 },
        { substituir: true },
      ),
    );
    expect(consultasCom("cargos", DE_OUTRA_EMPRESA)).toHaveLength(0);
  });

  it("T215 — na lista, só o id desconhecido sai; os conhecidos e os outros catálogos ficam", async () => {
    const onEstadoChange = vi.fn();
    render(
      <ColaboradoresScreen
        estado={comFiltros({
          departamentos: [DEP.id, DE_OUTRA_EMPRESA],
          areas: [DE_OUTRA_EMPRESA, ARE.id],
        })}
        onEstadoChange={onEstadoChange}
      />,
    );
    await waitFor(() =>
      expect(onEstadoChange).toHaveBeenCalledWith(
        {
          ...comFiltros({ departamentos: [DEP.id], areas: [ARE.id] }),
          pagina: 1,
        },
        { substituir: true },
      ),
    );
    expect(consultasCom("departamentos", DE_OUTRA_EMPRESA)).toHaveLength(0);
    expect(consultasCom("areas", DE_OUTRA_EMPRESA)).toHaveLength(0);
  });

  it("a correção perdida (o shell reaplica a mesma URL inválida) é pedida de novo", async () => {
    const onEstadoChange = vi.fn();
    const invalido = comFiltros({ departamentos: [DE_OUTRA_EMPRESA] });
    const { rerender } = render(
      <ColaboradoresScreen estado={invalido} onEstadoChange={onEstadoChange} />,
    );
    await waitFor(() => expect(onEstadoChange).toHaveBeenCalledTimes(1));
    // O shell ignorou a correção e reaplicou a URL: objeto novo, mesmos valores.
    rerender(
      comTrilha(
        <ColaboradoresScreen
          estado={{ ...invalido }}
          onEstadoChange={onEstadoChange}
        />,
      ),
    );
    await waitFor(() => expect(onEstadoChange).toHaveBeenCalledTimes(2));
    expect(onEstadoChange).toHaveBeenLastCalledWith(
      { ...ESTADO, pagina: 1 },
      { substituir: true },
    );
    expect(consultasCom("departamentos", DE_OUTRA_EMPRESA)).toHaveLength(0);
  });

  it("enquanto os catálogos carregam, espera; id conhecido vira consulta depois", async () => {
    const departamentos =
      adiado<Awaited<ReturnType<typeof listarDepartamentos>>>();
    vi.mocked(listarDepartamentos).mockReturnValue(departamentos.promessa);
    const onEstadoChange = vi.fn();
    const antes = vi.mocked(listarColaboradores).mock.calls.length;
    render(
      <ColaboradoresScreen
        estado={comFiltros({ departamentos: [DEP.id] })}
        onEstadoChange={onEstadoChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(antes);

    departamentos.resolver(pagina([DEP]) as never);
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenCalledWith(
        expect.objectContaining({ departamentos: [DEP.id], pagina: 3 }),
        COM_SINAL,
      ),
    );
    expect(onEstadoChange).not.toHaveBeenCalled();
  });

  it("sem filtro de lotação, não espera os catálogos", async () => {
    vi.mocked(listarDepartamentos).mockReturnValue(new Promise(() => {}));
    render(<ColaboradoresScreen estado={ESTADO} onEstadoChange={vi.fn()} />);
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenCalledWith(
        expect.objectContaining({ pagina: 3, tipos: ["clt"] }),
        COM_SINAL,
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// T199 (revisão final da PR) — B1: página fora do intervalo, com ou sem
// filtros e busca; B2: "Limpar busca e filtros" numa única mudança; cartões
// que se recuperam de falha na aba Jornada; título da seção da tabela.
// ---------------------------------------------------------------------------

/** O dashboard com o estado guardado por fora, como o shell faz com a URL. */
function DashboardComEstado({
  inicial,
  onMudanca,
  atualizacao = 0,
}: {
  readonly inicial: EstadoDaListagem;
  readonly onMudanca: (
    estado: EstadoDaListagem,
    opcoes?: OpcoesDaMudancaDaListagem,
  ) => void;
  readonly atualizacao?: number;
}) {
  const [estado, setEstado] = useState(inicial);
  return (
    <ColaboradoresScreen
      estado={estado}
      atualizacao={atualizacao}
      onEstadoChange={(novo, opcoes) => {
        if (opcoes) onMudanca(novo, opcoes);
        else onMudanca(novo);
        setEstado(novo);
      }}
    />
  );
}

const ESTADO_PADRAO: EstadoDaListagem = {
  aba: "ativos",
  pagina: 1,
  tamanho: 20,
  filtros: FILTROS_VAZIOS,
};

const CONTADORES_CHEIOS: ContadoresColaboradoresApi = {
  ...contados([]),
  ativos: 30,
  inativos: 3,
  desligados: 3,
  total: 33,
};

describe("T199 (revisão) — B1: página fora do intervalo", () => {
  it("com aba Todos, tipo PJ e página 4 (servidor: vazia, total 3): 'nesta página', e a primeira página mantém o PJ", async () => {
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) =>
      consulta?.pagina === 4
        ? {
            itens: [],
            pagina: 4,
            tamanhoPagina: 20,
            total: 3,
            contadores: CONTADORES_CHEIOS,
          }
        : { ...paginado([colaborador1]), contadores: CONTADORES_CHEIOS },
    );
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado
        inicial={{
          ...ESTADO_PADRAO,
          aba: "todos",
          filtros: soTipos("pj"),
          pagina: 4,
        }}
        onMudanca={onMudanca}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Nenhum colaborador nesta página",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Nenhum colaborador com estes filtros",
      }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    // O filtro continua à vista e removível.
    expect(
      screen.getByRole("button", {
        name: "Remover filtro Tipo: PJ",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    );
    expect(onMudanca).toHaveBeenLastCalledWith({
      ...ESTADO_PADRAO,
      aba: "todos",
      filtros: soTipos("pj"),
      pagina: 1,
    });
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
          tipos: ["pj"],
        },
        COM_SINAL,
      ),
    );
    await screen.findByRole("table", { name: "Colaboradores — Todos" });
  });

  it("com busca: 'nesta página', e a primeira página mantém a busca", async () => {
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => ({
      itens: [colaborador1],
      pagina: consulta?.pagina ?? 1,
      tamanhoPagina: 20,
      total: 45,
      contadores: CONTADORES_CHEIOS,
    }));
    render(<DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    buscar("Ana");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        expect.objectContaining({ busca: "Ana", pagina: 1 }),
        COM_SINAL,
      ),
    );
    await screen.findByText("Página 1 de 3");
    // O conjunto encolheu entre uma página e outra.
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => ({
      itens: [],
      pagina: consulta?.pagina ?? 1,
      tamanhoPagina: 20,
      total: 3,
      contadores: CONTADORES_CHEIOS,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    const titulo = await screen.findByRole("heading", {
      name: "Nenhum colaborador nesta página",
    });
    expect(
      screen.queryByRole("heading", { name: "Nenhum colaborador encontrado" }),
    ).toBeNull();
    // O estado vazio oferece a primeira página, não "Limpar busca".
    const vazio = titulo.closest(".evolli-empty-state") as HTMLElement;
    expect(
      within(vazio)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Ir para a primeira página"]);

    fireEvent.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    );
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
          busca: "Ana",
        },
        COM_SINAL,
      ),
    );
  });

  it("sem busca nem filtros: o mesmo estado, pelo total da consulta", async () => {
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) =>
      consulta?.pagina === 4
        ? {
            itens: [],
            pagina: 4,
            tamanhoPagina: 20,
            total: 3,
            contadores: CONTADORES_CHEIOS,
          }
        : { ...paginado([colaborador1]), contadores: CONTADORES_CHEIOS },
    );
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, aba: "desligados", pagina: 4 }}
        onMudanca={onMudanca}
      />,
    );
    await screen.findByRole("heading", {
      name: "Nenhum colaborador nesta página",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ir para a primeira página" }),
    );
    expect(onMudanca).toHaveBeenLastCalledWith({
      ...ESTADO_PADRAO,
      aba: "desligados",
    });
  });
});

describe("T199 (revisão) — B2: 'Limpar busca e filtros' numa única mudança", () => {
  const DEP = {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    codigo: "ADM",
    nome: "Administrativo (teste)",
    empresaId: "44444444-4444-4444-4444-444444444444",
    status: "ativo",
    criadoEm: "2025-01-01T12:00:00.000Z",
    atualizadoEm: "2025-01-01T12:00:00.000Z",
  };
  const CAR = { ...DEP, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" };
  const pagina1 = <T,>(itens: T[]) => ({
    itens,
    pagina: 1,
    tamanhoPagina: 100,
    total: itens.length,
  });

  it("na página 2, com busca, departamento, cargo e tipo: volta à página 1 sem nenhum deles, e nada os restaura", async () => {
    vi.mocked(listarDepartamentos).mockResolvedValue(pagina1([DEP]) as never);
    vi.mocked(listarCargos).mockResolvedValue(pagina1([CAR]) as never);
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => ({
      itens: [colaborador1],
      pagina: consulta?.pagina ?? 1,
      tamanhoPagina: 20,
      total: 45,
      contadores: CONTADORES_CHEIOS,
    }));
    const onMudanca = vi.fn();
    const inicial: EstadoDaListagem = {
      ...ESTADO_PADRAO,
      filtros: filtrosCom({
        departamentos: [DEP.id],
        cargos: [CAR.id],
        tipos: ["pj"],
      }),
    };
    const { rerender } = render(
      <DashboardComEstado inicial={inicial} onMudanca={onMudanca} />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    buscar("Ana");
    await screen.findByText("Página 1 de 3");
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 2,
          tamanhoPagina: 20,
          grupo: "ativos",
          tipos: ["pj"],
          busca: "Ana",
          departamentos: [DEP.id],
          cargos: [CAR.id],
        },
        COM_SINAL,
      ),
    );
    await screen.findByText("Página 2 de 3");

    // Volta da ficha: a página 2 relida chega vazia, sem ninguém.
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => ({
      itens: [],
      pagina: consulta?.pagina ?? 1,
      tamanhoPagina: 20,
      total: 0,
      contadores: CONTADORES_CHEIOS,
    }));
    rerender(
      comTrilha(
        <DashboardComEstado
          inicial={inicial}
          onMudanca={onMudanca}
          atualizacao={1}
        />,
      ),
    );
    const limpar = await screen.findByRole("button", {
      name: "Limpar busca e filtros",
    });

    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => ({
      itens: [colaborador1],
      pagina: consulta?.pagina ?? 1,
      tamanhoPagina: 20,
      total: 1,
      contadores: CONTADORES_CHEIOS,
    }));
    const antes = onMudanca.mock.calls.length;
    const consultasAntes = vi.mocked(listarColaboradores).mock.calls.length;
    fireEvent.click(limpar);

    // Uma única mudança, já completa.
    expect(onMudanca.mock.calls.slice(antes)).toEqual([[ESTADO_PADRAO]]);
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 1,
          tamanhoPagina: 20,
          grupo: "ativos",
        },
        COM_SINAL,
      ),
    );
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    expect(campoBusca()).toHaveValue("");
    expect(campoBusca()).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).toBeNull();
    // Nenhuma atualização seguinte devolveu os filtros.
    await act(async () => {
      await Promise.resolve();
    });
    expect(onMudanca.mock.calls.length).toBe(antes + 1);
    const depois = vi
      .mocked(listarColaboradores)
      .mock.calls.slice(consultasAntes);
    expect(depois).toHaveLength(1);
    for (const [consulta] of depois) {
      expect(consulta).not.toHaveProperty("tipos");
      expect(consulta).not.toHaveProperty("departamentos");
      expect(consulta).not.toHaveProperty("busca");
    }
  });
});

describe("T199 (revisão) — cartões que se recuperam de falha na aba Jornada", () => {
  const JORNADA: EstadoDaListagem = { ...ESTADO_PADRAO, aba: "jornada" };
  const anuncio = () =>
    document.querySelector(".colaboradores-screen__anuncio-totais");

  function dublê(falhar: { valor: boolean }) {
    vi.mocked(listarColaboradores).mockImplementation(async (consulta) => {
      // Só a leitura mínima dos contadores (sem situação) falha; a da visão
      // de jornadas (situação "ativo") segue normal.
      if (consulta?.tamanhoPagina === 1 && !consulta.situacao) {
        if (falhar.valor) throw new Error("falha");
        return { ...paginado([]), contadores: CONTADORES_CHEIOS };
      }
      return paginado([colaborador1]);
    });
  }

  it("falha: aviso e 'Tentar novamente' no lugar dos '…'; a repetição relê só os contadores, sem remontar a Jornada", async () => {
    const falhar = { valor: true };
    dublê(falhar);
    render(<DashboardComEstado inicial={JORNADA} onMudanca={vi.fn()} />);
    // T215 — os três cartões, numa seção "Resumo de colaboradores".
    const regiao = screen.getByRole("region", {
      name: "Resumo de colaboradores",
    });
    expect(
      await within(regiao).findByText(
        "Não foi possível carregar os totais de colaboradores.",
        { selector: ".colaboradores-screen__totais-falha-texto" },
      ),
    ).toBeVisible();
    expect(within(regiao).queryByText("…")).toBeNull();
    expect(anuncio()).toHaveTextContent(
      "Não foi possível carregar os totais de colaboradores.",
    );
    const tituloDaJornada = screen.getByRole("heading", {
      level: 2,
      name: "Jornada de trabalho",
    });
    const leiturasDaJornada = vi.mocked(listarVinculosHorario).mock.calls
      .length;
    const leiturasAntes = vi.mocked(listarColaboradores).mock.calls.length;

    falhar.valor = false;
    const repetir = within(regiao).getByRole("button", {
      name: "Tentar novamente",
    });
    repetir.focus();
    fireEvent.click(repetir);

    await waitFor(() => expect(ativosDe(regiao)).toBe("30"));
    expect(regiao).toHaveTextContent("33 cadastrados");
    // Só os contadores foram relidos; a Jornada é o mesmo nó, sem releitura.
    expect(
      vi
        .mocked(listarColaboradores)
        .mock.calls.slice(leiturasAntes)
        .map(([c]) => c),
    ).toEqual([{ pagina: 1, tamanhoPagina: 1 }]);
    expect(vi.mocked(listarVinculosHorario).mock.calls.length).toBe(
      leiturasDaJornada,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Jornada de trabalho" }),
    ).toBe(tituloDaJornada);
    // O botão sumiu: o foco vai ao título dos totais, e a volta é anunciada.
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Resumo de colaboradores",
      }),
    ).toHaveFocus();
    expect(anuncio()).toHaveTextContent("Totais de colaboradores carregados.");
  });

  it("nova falha: o botão fica com o foco e a falha é anunciada de novo", async () => {
    dublê({ valor: true });
    render(<DashboardComEstado inicial={JORNADA} onMudanca={vi.fn()} />);
    const repetir = await screen.findByRole("button", {
      name: "Tentar novamente",
    });
    repetir.focus();
    fireEvent.click(repetir);
    // Durante a nova leitura, o botão continua focado e indisponível.
    expect(repetir).toHaveAttribute("aria-disabled", "true");
    expect(anuncio()?.textContent).toBe("");
    await waitFor(() =>
      expect(anuncio()).toHaveTextContent(
        "Não foi possível carregar os totais de colaboradores.",
      ),
    );
    expect(repetir).toHaveFocus();
    expect(repetir).not.toHaveAttribute("aria-disabled", "true");
  });

  /** T215 — o número do cartão "Colaboradores ativos". */
  function ativosDe(regiao: HTMLElement): string | null {
    const cartao = within(regiao).queryByRole("group", {
      name: "Colaboradores ativos",
    });
    return (
      cartao?.querySelector(".colaboradores-screen__cartao-numero")
        ?.textContent ?? null
    );
  }
});

describe("T199 (revisão) — título da seção da tabela", () => {
  /** Os títulos em ordem de documento: [nível, texto]. */
  function titulos(): [number, string][] {
    return [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => [
      Number(h.tagName.slice(1)),
      h.textContent ?? "",
    ]);
  }
  /** O h2 de que um título depende, na estrutura da página. */
  function h2Acima(texto: string): string | undefined {
    const lista = titulos();
    const i = lista.findIndex(([, t]) => t === texto);
    return lista
      .slice(0, i)
      .reverse()
      .find(([nivel]) => nivel === 2)?.[1];
  }

  it("estado vazio em h3 sob o h2 da aba, não sob 'Totais…'; o h2 é só para leitor de tela", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));
    render(<ColaboradoresScreen />);
    await screen.findByRole("heading", {
      level: 3,
      name: "Nenhum colaborador ativo no seu escopo",
    });
    const painel = screen.getByRole("tabpanel");
    const titulo = within(painel).getByRole("heading", {
      level: 2,
      name: "Colaboradores — Ativos",
    });
    expect(titulo).toHaveClass("colaboradores-screen__so-leitor");
    expect(h2Acima("Nenhum colaborador ativo no seu escopo")).toBe(
      "Colaboradores — Ativos",
    );
  });

  it("o título acompanha a aba, e o erro da tabela também fica abaixo dele (h3)", async () => {
    vi.mocked(listarColaboradores).mockRejectedValue(new Error("falha"));
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, aba: "desligados" }}
        onMudanca={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Não foi possível carregar os colaboradores",
      }),
    ).toBeInTheDocument();
    expect(h2Acima("Não foi possível carregar os colaboradores")).toBe(
      "Colaboradores — Desligados",
    );
  });

  it("na aba Jornada, o h2 é o da própria visão: nenhum título de tabela a mais", async () => {
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, aba: "jornada" }}
        onMudanca={vi.fn()}
      />,
    );
    const painel = screen.getByRole("tabpanel");
    expect(
      within(painel)
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent),
    ).toEqual(["Jornada de trabalho"]);
  });
});

// ---------------------------------------------------------------------------
// T199 (revisão B3) — ações do estado vazio: o estado vazio fica montado
// durante a nova leitura, o botão conserva o foco (indisponível), cliques
// repetidos são ignorados; no sucesso o foco vai a um destino estável; numa
// nova falha fica no botão e a falha é anunciada uma vez. E nenhuma
// paginação "Página X de Y" com X > Y.
// ---------------------------------------------------------------------------
describe("T199 (revisão B3) — ações do estado vazio e paginação fora do intervalo", () => {
  type Resposta = Awaited<ReturnType<typeof listarColaboradores>>;
  const anuncioDaLista = () =>
    document.querySelector(".colaboradores-screen__anuncio-lista");
  const tituloDaSecao = (rotulo: string) =>
    screen.getByRole("heading", {
      level: 2,
      name: `Colaboradores — ${rotulo}`,
    });

  function vazia(pagina: number, total: number): Resposta {
    return {
      itens: [],
      pagina,
      tamanhoPagina: 20,
      total,
      contadores: CONTADORES_CHEIOS,
    };
  }
  function comAna(): Resposta {
    return {
      itens: [colaborador1],
      pagina: 1,
      tamanhoPagina: 20,
      total: 1,
      contadores: CONTADORES_CHEIOS,
    };
  }

  /** Primeira leitura: a dada; as seguintes, uma a uma, controladas. */
  function servidor(primeira: Resposta) {
    const pendentes: {
      resolver: (r: Resposta) => void;
      rejeitar: (e: unknown) => void;
    }[] = [];
    let lidas = 0;
    vi.mocked(listarColaboradores).mockImplementation(() => {
      lidas += 1;
      if (lidas === 1) return Promise.resolve(primeira);
      return new Promise<Resposta>((resolver, rejeitar) => {
        pendentes.push({ resolver, rejeitar });
      });
    });
    return {
      leituras: () => lidas,
      async responder(r: Resposta) {
        await act(async () => {
          pendentes.shift()!.resolver(r);
        });
      },
      async falhar() {
        await act(async () => {
          pendentes.shift()!.rejeitar(new Error("falha"));
        });
      },
    };
  }

  it("'Ir para a primeira página': vazio montado, foco no botão indisponível, clique repetido ignorado; no sucesso, foco no campo de busca visível e página 1 anunciada", async () => {
    const srv = servidor(vazia(4, 3));
    render(
      <DashboardComEstado
        inicial={{
          ...ESTADO_PADRAO,
          aba: "todos",
          filtros: soTipos("pj"),
          pagina: 4,
        }}
        onMudanca={vi.fn()}
      />,
    );
    const ir = await screen.findByRole("button", {
      name: "Ir para a primeira página",
    });
    ir.focus();
    fireEvent.click(ir);
    await waitFor(() => expect(srv.leituras()).toBe(2));
    // Durante a leitura: o mesmo botão, indisponível e com o foco.
    expect(ir).toBeInTheDocument();
    expect(ir).toHaveAttribute("aria-disabled", "true");
    expect(ir).toHaveFocus();
    expect(
      screen.getByRole("heading", { name: "Nenhum colaborador nesta página" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Carregando colaboradores…")).toBeNull();
    fireEvent.click(ir);
    fireEvent.click(ir);
    expect(srv.leituras()).toBe(2);

    await srv.responder(comAna());
    await screen.findByRole("table", { name: "Colaboradores — Todos" });
    // O foco vai a um controle VISÍVEL: nunca a um título só para leitor.
    await waitFor(() => expect(campoBusca()).toHaveFocus());
    expect(campoBusca().closest(".colaboradores-screen__so-leitor")).toBeNull();
    expect(document.activeElement).not.toBe(tituloDaSecao("Todos"));
    expect(anuncioDaLista()?.textContent).toBe(
      "Página 1 carregada: 1 colaborador nesta consulta, com os filtros mantidos.",
    );
    expect(
      screen.getByRole("button", { name: "Remover filtro Tipo: PJ" }),
    ).toBeInTheDocument();
    // O h2 da seção continua, só para leitor de tela, acima dos h3.
    expect(tituloDaSecao("Todos")).toHaveClass(
      "colaboradores-screen__so-leitor",
    );
  });

  it("'Ir para a primeira página' com busca e filtro: o anúncio diz que os dois ficaram, e o foco vai ao campo com a busca", async () => {
    const srv = servidor({
      ...comAna(),
      total: 45,
    });
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, aba: "todos", filtros: soTipos("pj") }}
        onMudanca={vi.fn()}
      />,
    );
    await screen.findByRole("table", { name: "Colaboradores — Todos" });
    buscar("Ana");
    await waitFor(() => expect(srv.leituras()).toBe(2));
    await srv.responder({ ...comAna(), total: 45 });
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(srv.leituras()).toBe(3));
    await srv.responder(vazia(2, 3));
    const ir = await screen.findByRole("button", {
      name: "Ir para a primeira página",
    });
    ir.focus();
    fireEvent.click(ir);
    await waitFor(() => expect(srv.leituras()).toBe(4));
    expect(vi.mocked(listarColaboradores).mock.lastCall?.[0]).toEqual({
      pagina: 1,
      tamanhoPagina: 20,
      tipos: ["pj"],
      busca: "Ana",
    });
    await srv.responder(comAna());
    await waitFor(() => expect(campoBusca()).toHaveFocus());
    expect(campoBusca()).toHaveValue("Ana");
    expect(anuncioDaLista()?.textContent).toBe(
      "Página 1 carregada: 1 colaborador nesta consulta, com a busca e os filtros mantidos.",
    );
  });

  it("'Ir para a primeira página' com nova falha: foco segue no botão, falha anunciada uma vez; repetir e conseguir leva ao campo de busca", async () => {
    const srv = servidor(vazia(4, 3));
    render(
      <DashboardComEstado
        inicial={{
          ...ESTADO_PADRAO,
          aba: "todos",
          filtros: soTipos("pj"),
          pagina: 4,
        }}
        onMudanca={vi.fn()}
      />,
    );
    const ir = await screen.findByRole("button", {
      name: "Ir para a primeira página",
    });
    ir.focus();
    fireEvent.click(ir);
    await waitFor(() => expect(srv.leituras()).toBe(2));
    await srv.falhar();

    expect(ir).toBeInTheDocument();
    expect(ir).toHaveFocus();
    expect(ir).not.toHaveAttribute("aria-disabled", "true");
    expect(anuncioDaLista()?.textContent).toBe(
      "Não foi possível carregar os colaboradores.",
    );
    // O estado vazio segue montado e diz o que houve; nenhum aviso a mais.
    expect(
      screen.getByRole("heading", { name: "Nenhum colaborador nesta página" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(ir);
    // A nova tentativa limpa o anúncio, para a próxima falha ser lida de novo.
    expect(anuncioDaLista()?.textContent).toBe("");
    await waitFor(() => expect(srv.leituras()).toBe(3));
    await srv.responder(comAna());
    await waitFor(() => expect(campoBusca()).toHaveFocus());
  });

  it("'Limpar filtros' a partir do vazio: o foco não cai no body; no sucesso vai ao campo de busca; uma única mudança de estado", async () => {
    const srv = servidor(vazia(1, 0));
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, filtros: soTipos("pj") }}
        onMudanca={onMudanca}
      />,
    );
    const limpar = await screen.findByRole("button", {
      name: "Limpar filtros",
    });
    limpar.focus();
    fireEvent.click(limpar);
    await waitFor(() => expect(srv.leituras()).toBe(2));
    expect(limpar).toBeInTheDocument();
    expect(limpar).toHaveAttribute("aria-disabled", "true");
    expect(limpar).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
    fireEvent.click(limpar);
    expect(srv.leituras()).toBe(2);
    expect(onMudanca.mock.calls).toEqual([[ESTADO_PADRAO]]);

    await srv.responder(comAna());
    await screen.findByRole("table", { name: "Colaboradores — Ativos" });
    await waitFor(() => expect(campoBusca()).toHaveFocus());
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).toBeNull();
  });

  it("'Limpar filtros' com nova falha: foco no botão e falha anunciada uma vez; repetir relê sem mudar o estado de novo", async () => {
    const srv = servidor(vazia(1, 0));
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, filtros: soTipos("pj") }}
        onMudanca={onMudanca}
      />,
    );
    const limpar = await screen.findByRole("button", {
      name: "Limpar filtros",
    });
    limpar.focus();
    fireEvent.click(limpar);
    await waitFor(() => expect(srv.leituras()).toBe(2));
    await srv.falhar();
    expect(limpar).toHaveFocus();
    expect(limpar).not.toHaveAttribute("aria-disabled", "true");
    expect(anuncioDaLista()?.textContent).toBe(
      "Não foi possível carregar os colaboradores.",
    );

    // O estado já está sem filtros: repetir relê direto.
    fireEvent.click(limpar);
    await waitFor(() => expect(srv.leituras()).toBe(3));
    expect(onMudanca).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listarColaboradores).mock.lastCall?.[0]).toEqual({
      pagina: 1,
      tamanhoPagina: 20,
      grupo: "ativos",
    });
    await srv.responder(comAna());
    await waitFor(() => expect(campoBusca()).toHaveFocus());
  });

  it("página 4 quando só há 2 páginas: 'nesta página', sem paginação 'Página 4 de 2'", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(vazia(4, 24));
    render(
      <DashboardComEstado
        inicial={{
          ...ESTADO_PADRAO,
          aba: "todos",
          filtros: soTipos("pj"),
          pagina: 4,
        }}
        onMudanca={vi.fn()}
      />,
    );
    await screen.findByRole("heading", {
      name: "Nenhum colaborador nesta página",
    });
    expect(screen.queryByText(/Página 4 de/)).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Paginação de colaboradores" }),
    ).toBeNull();
  });

  it("página dentro do intervalo: a paginação normal continua", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      itens: [colaborador1],
      pagina: 2,
      tamanhoPagina: 20,
      total: 45,
      contadores: CONTADORES_CHEIOS,
    });
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, pagina: 2 }}
        onMudanca={vi.fn()}
      />,
    );
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Paginação de colaboradores" }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T199 (revisão B4/B5) — nada de "Contando…" depois de uma falha; e o
// "Tentar novamente" do erro da tabela no mesmo padrão seguro das ações do
// estado vazio: bloco de erro montado, mesmo botão focado e indisponível,
// cliques repetidos ignorados, foco no campo de busca no sucesso, anúncio
// único numa nova falha.
// ---------------------------------------------------------------------------
describe("T199 (revisão B4/B5) — falha sem 'Contando…' e repetição do erro da tabela", () => {
  type Resposta = Awaited<ReturnType<typeof listarColaboradores>>;
  const anuncioDaLista = () =>
    document.querySelector(".colaboradores-screen__anuncio-lista");
  const respostaComAna = (): Resposta => ({
    itens: [colaborador1],
    pagina: 1,
    tamanhoPagina: 20,
    total: 1,
    contadores: CONTADORES_CHEIOS,
  });

  /**
   * Primeira leitura: a dada (ou uma falha); as seguintes, uma a uma,
   * controladas pelo teste.
   */
  function servidor(primeira: Resposta | "falha") {
    const pendentes: {
      resolver: (r: Resposta) => void;
      rejeitar: (e: unknown) => void;
    }[] = [];
    let lidas = 0;
    vi.mocked(listarColaboradores).mockImplementation(() => {
      lidas += 1;
      if (lidas === 1) {
        return primeira === "falha"
          ? Promise.reject(new Error("falha"))
          : Promise.resolve(primeira);
      }
      return new Promise<Resposta>((resolver, rejeitar) => {
        pendentes.push({ resolver, rejeitar });
      });
    });
    return {
      leituras: () => lidas,
      async responder(r: Resposta) {
        await act(async () => {
          pendentes.shift()!.resolver(r);
        });
      },
      async falhar() {
        await act(async () => {
          pendentes.shift()!.rejeitar(new Error("falha"));
        });
      },
    };
  }

  it.each([
    [
      "Ir para a primeira página",
      {
        ...ESTADO_PADRAO,
        aba: "todos" as const,
        filtros: soTipos("pj"),
        pagina: 4,
      },
      { itens: [], pagina: 4, tamanhoPagina: 20, total: 3 },
    ],
    [
      "Limpar filtros",
      { ...ESTADO_PADRAO, filtros: soTipos("pj") },
      { itens: [], pagina: 1, tamanhoPagina: 20, total: 0 },
    ],
  ])(
    "B4 — '%s' que falha: aviso e botão à vista, sem 'Contando…' nem total",
    async (rotulo, inicial, vazia) => {
      const srv = servidor({ ...vazia, contadores: CONTADORES_CHEIOS });
      render(<DashboardComEstado inicial={inicial} onMudanca={vi.fn()} />);
      const botao = await screen.findByRole("button", { name: rotulo });
      botao.focus();
      fireEvent.click(botao);
      await waitFor(() => expect(srv.leituras()).toBe(2));
      await srv.falhar();

      expect(
        screen.getByText(
          "Não foi possível carregar os colaboradores. Verifique sua conexão e tente novamente.",
        ),
      ).toBeInTheDocument();
      expect(botao).toBeInTheDocument();
      expect(botao).toHaveFocus();
      expect(screen.queryByText("Contando…")).toBeNull();
      expect(screen.queryByText(/nesta consulta$/)).toBeNull();
    },
  );

  it("B5 — 'Tentar novamente': bloco de erro montado, mesmo botão focado e indisponível, cliques repetidos ignorados; no sucesso, foco no campo de busca", async () => {
    const srv = servidor("falha");
    render(<ColaboradoresScreen />);
    const tentar = await screen.findByRole("button", {
      name: "Tentar novamente",
    });
    const tituloDoErro = screen.getByRole("heading", {
      name: "Não foi possível carregar os colaboradores",
    });
    tentar.focus();
    fireEvent.click(tentar);
    await waitFor(() => expect(srv.leituras()).toBe(2));

    // Durante a leitura: o mesmo bloco, o mesmo botão, focado.
    expect(tentar).toBeInTheDocument();
    expect(tentar).toHaveAttribute("aria-disabled", "true");
    expect(tentar).toHaveFocus();
    expect(tituloDoErro).toBeInTheDocument();
    expect(screen.queryByText("Carregando colaboradores…")).toBeNull();
    expect(
      screen.queryByRole("table", { name: /^Colaboradores — / }),
    ).toBeNull();
    fireEvent.click(tentar);
    fireEvent.click(tentar);
    expect(srv.leituras()).toBe(2);

    await srv.responder(respostaComAna());
    await screen.findByRole("table", { name: /^Colaboradores — / });
    await waitFor(() => expect(campoBusca()).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("B5 — nova falha: foco segue no botão e a falha é anunciada uma vez; a próxima tentativa limpa o anúncio", async () => {
    const srv = servidor("falha");
    render(<ColaboradoresScreen />);
    const tentar = await screen.findByRole("button", {
      name: "Tentar novamente",
    });
    tentar.focus();
    fireEvent.click(tentar);
    await waitFor(() => expect(srv.leituras()).toBe(2));
    await srv.falhar();

    expect(tentar).toBeInTheDocument();
    expect(tentar).toHaveFocus();
    expect(tentar).not.toHaveAttribute("aria-disabled", "true");
    expect(anuncioDaLista()?.textContent).toBe(
      "Não foi possível carregar os colaboradores.",
    );
    expect(screen.queryByText("Contando…")).toBeNull();

    fireEvent.click(tentar);
    expect(anuncioDaLista()?.textContent).toBe("");
    await waitFor(() => expect(srv.leituras()).toBe(3));
    await srv.responder(respostaComAna());
    await waitFor(() => expect(campoBusca()).toHaveFocus());
  });
});

// ---------------------------------------------------------------------------
// T199 (revisão B6/B7) — filtros que não perdem o foco; remover um chip leva
// o foco ao próximo chip ou ao campo de busca; a recarga dos catálogos no
// padrão seguro. T215 — os filtros moram na gaveta "Filtrar": aplicar fecha a
// gaveta e devolve o foco ao botão, que nunca fica indisponível na releitura.
// ---------------------------------------------------------------------------
describe("T199 (revisão B6/B7) — foco nos filtros, nos chips e na recarga dos catálogos", () => {
  type Resposta = Awaited<ReturnType<typeof listarColaboradores>>;
  type Catalogo = Awaited<ReturnType<typeof listarDepartamentos>>;
  const anuncioDaGaveta = () =>
    document.querySelector(".gaveta-filtros__anuncio");
  const DEP = {
    id: "abababab-abab-4bab-8bab-abababababab",
    codigo: "ADM",
    nome: "Administrativo (teste)",
    empresaId: "44444444-4444-4444-4444-444444444444",
    status: "ativo",
    criadoEm: "2025-01-01T12:00:00.000Z",
    atualizadoEm: "2025-01-01T12:00:00.000Z",
  };
  const CAR = { ...DEP, id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd" };
  const catalogo = <T,>(itens: T[]) =>
    ({ itens, pagina: 1, tamanhoPagina: 100, total: itens.length }) as never;
  const botaoFiltrar = () => screen.getByRole("button", { name: /^Filtrar/ });
  const comAna = (nome = colaborador1.nome): Resposta => ({
    itens: [{ ...colaborador1, nome }],
    pagina: 1,
    tamanhoPagina: 20,
    total: 1,
    contadores: CONTADORES_CHEIOS,
  });

  /**
   * A primeira leitura da lista responde; as seguintes ficam pendentes, uma
   * a uma. A contagem da gaveta (uma linha) responde na hora e não conta.
   */
  function listagem() {
    const pendentes: ((r: Resposta) => void)[] = [];
    let lidas = 0;
    vi.mocked(listarColaboradores).mockImplementation((consulta) => {
      if (consulta?.tamanhoPagina === 1) return Promise.resolve(comAna());
      lidas += 1;
      if (lidas === 1) return Promise.resolve(comAna());
      return new Promise<Resposta>((resolver) => pendentes.push(resolver));
    });
    return {
      leituras: () => lidas,
      async responder(indice: number, r: Resposta) {
        await act(async () => {
          pendentes[indice]!(r);
        });
      },
    };
  }

  beforeEach(() => {
    vi.mocked(listarDepartamentos).mockResolvedValue(catalogo([DEP]));
    vi.mocked(listarCargos).mockResolvedValue(catalogo([CAR]));
  });

  it.each([
    ["Tipo de contrato", "PJ"],
    ["Departamento", "Administrativo (teste) (ADM)"],
    ["Cargo", "Administrativo (teste) (ADM)"],
  ])(
    "B6 — aplicar %s com a resposta pendente: o botão Filtrar segue habilitado e com o foco",
    async (grupo, opcao) => {
      const srv = listagem();
      render(
        <DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={vi.fn()} />,
      );
      await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
      botaoFiltrar().focus();
      await filtrarPelaGaveta([grupo, opcao]);
      await waitFor(() => expect(srv.leituras()).toBe(2));
      expect(botaoFiltrar()).not.toBeDisabled();
      expect(botaoFiltrar()).not.toHaveAttribute("aria-disabled", "true");
      await waitFor(() => expect(botaoFiltrar()).toHaveFocus());
      expect(botaoFiltrar()).toHaveAccessibleName("Filtrar, 1 filtro ativo");
    },
  );

  it("B6 — duas aplicações seguidas: a resposta antiga, que chega depois, não muda o resultado", async () => {
    const srv = listagem();
    render(<DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    await filtrarPelaGaveta(["Tipo de contrato", "PJ"]);
    await waitFor(() => expect(srv.leituras()).toBe(2));
    // A segunda escolha é possível durante a leitura da primeira.
    await filtrarPelaGaveta(
      ["Tipo de contrato", "PJ"],
      ["Tipo de contrato", "CLT"],
    );
    await waitFor(() => expect(srv.leituras()).toBe(3));
    expect(ultimaLeituraDaLista()).toMatchObject({ tipos: ["clt"] });

    await srv.responder(1, comAna("Pessoa da escolha nova (teste)"));
    await srv.responder(0, comAna("Pessoa da escolha antiga (teste)"));
    expect(
      await screen.findByText("Pessoa da escolha nova (teste)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pessoa da escolha antiga (teste)")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remover filtro Tipo: CLT" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remover filtro Tipo: PJ" }),
    ).toBeNull();
  });

  it("B6 — catálogo em erro bloqueia só os grupos de lotação; Tipo de contrato segue livre", async () => {
    vi.mocked(listarDepartamentos).mockRejectedValue(new Error("rede"));
    render(<ColaboradoresScreen />);
    await screen.findByText(colaborador1.nome);
    const gaveta = await abrirGaveta();
    await within(gaveta).findByText(
      "Não foi possível carregar departamentos, áreas, centros de custo, unidades e cargos.",
    );
    for (const grupo of [
      "Departamento",
      "Área",
      "Centro de custo",
      "Unidade",
      "Cargo",
    ]) {
      expect(within(gaveta).queryByRole("group", { name: grupo })).toBeNull();
    }
    const pj = within(gaveta).getByRole("button", { name: "PJ" });
    expect(pj).toBeEnabled();
    fireEvent.click(pj);
    expect(pj).toHaveAttribute("aria-pressed", "true");
  });

  it("B7 — remover chips: o foco vai ao próximo chip; sem nenhum, ao campo de busca; uma mudança por remoção", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([colaborador1]));
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado
        inicial={{
          ...ESTADO_PADRAO,
          filtros: filtrosCom({
            departamentos: [DEP.id],
            cargos: [CAR.id],
            tipos: ["pj"],
          }),
        }}
        onMudanca={onMudanca}
      />,
    );
    const chipDep = await screen.findByRole("button", {
      name: /^Remover filtro Departamento:/,
    });
    chipDep.focus();
    fireEvent.click(chipDep);
    const chipCargo = screen.getByRole("button", {
      name: /^Remover filtro Cargo:/,
    });
    await waitFor(() => expect(chipCargo).toHaveFocus());

    fireEvent.click(chipCargo);
    const chipTipo = screen.getByRole("button", {
      name: "Remover filtro Tipo: PJ",
    });
    await waitFor(() => expect(chipTipo).toHaveFocus());

    fireEvent.click(chipTipo);
    await waitFor(() => expect(campoBusca()).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
    expect(onMudanca.mock.calls.map(([e]) => e)).toEqual([
      {
        ...ESTADO_PADRAO,
        filtros: filtrosCom({ cargos: [CAR.id], tipos: ["pj"] }),
      },
      { ...ESTADO_PADRAO, filtros: soTipos("pj") },
      ESTADO_PADRAO,
    ]);
  });

  it("B7 — remover o último chip da fila com outro antes dele: o foco vai ao anterior", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([colaborador1]));
    render(
      <DashboardComEstado
        inicial={{
          ...ESTADO_PADRAO,
          filtros: filtrosCom({ departamentos: [DEP.id], tipos: ["pj"] }),
        }}
        onMudanca={vi.fn()}
      />,
    );
    const chipTipo = await screen.findByRole("button", {
      name: "Remover filtro Tipo: PJ",
    });
    chipTipo.focus();
    fireEvent.click(chipTipo);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /^Remover filtro Departamento:/,
        }),
      ).toHaveFocus(),
    );
  });

  /** Departamentos: a primeira leitura falha; as seguintes ficam pendentes. */
  function catalogoDeDepartamentos() {
    const pendentes: {
      resolver: (c: Catalogo) => void;
      rejeitar: (e: unknown) => void;
    }[] = [];
    let lidas = 0;
    vi.mocked(listarDepartamentos).mockImplementation(() => {
      lidas += 1;
      if (lidas === 1) return Promise.reject(new Error("rede"));
      return new Promise<Catalogo>((resolver, rejeitar) =>
        pendentes.push({ resolver, rejeitar }),
      );
    });
    return {
      leituras: () => lidas,
      async responder() {
        await act(async () => {
          pendentes.shift()!.resolver(catalogo([DEP]));
        });
      },
      async falhar() {
        await act(async () => {
          pendentes.shift()!.rejeitar(new Error("rede"));
        });
      },
    };
  }

  it("B7 — 'Recarregar' na gaveta: botão montado, focado e indisponível; clique repetido ignorado; no sucesso, foco nos grupos de lotação; a listagem não é relida", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([colaborador1]));
    const deps = catalogoDeDepartamentos();
    render(<ColaboradoresScreen />);
    await screen.findByText(colaborador1.nome);
    const gaveta = await abrirGaveta();
    const recarregar = await within(gaveta).findByRole("button", {
      name: "Recarregar",
    });
    const leiturasDaLista = vi
      .mocked(listarColaboradores)
      .mock.calls.filter(([c]) => c?.tamanhoPagina !== 1).length;
    recarregar.focus();
    fireEvent.click(recarregar);
    await waitFor(() => expect(deps.leituras()).toBe(2));
    expect(recarregar).toBeInTheDocument();
    expect(recarregar).toHaveAttribute("aria-disabled", "true");
    expect(recarregar).not.toBeDisabled();
    expect(recarregar).toHaveFocus();
    fireEvent.click(recarregar);
    fireEvent.click(recarregar);
    expect(deps.leituras()).toBe(2);

    await deps.responder();
    const grupos = gaveta.querySelector(".gaveta-filtros__lotacao")!;
    await waitFor(() => expect(grupos).toHaveFocus());
    expect(
      within(
        within(gaveta).getByRole("group", { name: "Departamento" }),
      ).getByRole("checkbox", { name: "Administrativo (teste) (ADM)" }),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(listarColaboradores)
        .mock.calls.filter(([c]) => c?.tamanhoPagina !== 1).length,
    ).toBe(leiturasDaLista);
  });

  it("B7 — recarga com nova falha: foco no botão e falha anunciada uma vez, dentro da gaveta", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([colaborador1]));
    const deps = catalogoDeDepartamentos();
    render(<ColaboradoresScreen />);
    await screen.findByText(colaborador1.nome);
    const gaveta = await abrirGaveta();
    const recarregar = await within(gaveta).findByRole("button", {
      name: "Recarregar",
    });
    recarregar.focus();
    fireEvent.click(recarregar);
    await waitFor(() => expect(deps.leituras()).toBe(2));
    await deps.falhar();
    expect(recarregar).toBeInTheDocument();
    expect(recarregar).toHaveFocus();
    expect(recarregar).not.toHaveAttribute("aria-disabled", "true");
    expect(anuncioDaGaveta()?.textContent).toBe(
      "Não foi possível carregar departamentos, áreas, centros de custo, unidades e cargos.",
    );
    expect(anuncioDaGaveta()).toHaveAttribute("role", "status");
    fireEvent.click(recarregar);
    expect(anuncioDaGaveta()?.textContent).toBe("");
  });
});

// ---------------------------------------------------------------------------
// T209 — Bloco A: listagem operacional (tamanho da página na URL, paginação
// numerada com primeira e última, "Mostrando X–Y de Z", cancelamento das
// leituras antigas e aviso de auditoria fiel).
// ---------------------------------------------------------------------------
function pessoasSinteticas(
  quantidade: number,
  inicio = 0,
): ColaboradorListadoApi[] {
  return Array.from({ length: quantidade }, (_, i) =>
    listado(
      {
        id: `9${String(inicio + i).padStart(7, "0")}-0000-4000-8000-000000000000`,
        nome: `Pessoa sintética ${inicio + i + 1}`,
      },
      [
        vinculoListado(
          `8${String(inicio + i).padStart(7, "0")}-0000-4000-8000-000000000000`,
          `MAT-${inicio + i + 1}`,
          "ativo",
          "2025-01-10",
        ),
      ],
    ),
  );
}

function respostaDaPagina(
  itens: ColaboradorListadoApi[],
  paginaAtual: number,
  total: number,
  tamanho = 20,
): ResultadoPaginadoTeste<ColaboradorListadoApi> {
  return {
    itens,
    pagina: paginaAtual,
    tamanhoPagina: tamanho,
    total,
    contadores: { ...contados([]), ativos: total, total },
  };
}

const navegacaoDaPaginacao = () =>
  screen.getByRole("navigation", { name: "Paginação de colaboradores" });

/** O sinal de cancelamento passado à leitura de número `n` (0 = primeira). */
function sinalDaLeitura(n: number): AbortSignal {
  const chamada = vi.mocked(listarColaboradores).mock.calls[n];
  const opcoes = chamada?.[1] as { signal?: AbortSignal } | undefined;
  if (!opcoes?.signal) throw new Error(`A leitura ${n} não tem sinal.`);
  return opcoes.signal;
}

describe("T209 — Bloco A: tamanho da página (C-2)", () => {
  beforeEach(() => {
    vi.mocked(listarColaboradores).mockClear();
  });

  // T215 — o seletor "Itens por página" saiu da tela (desenho da
  // referência): trocar o tamanho pela tela deixou de existir; o tamanho
  // do estado (URL) continua valendo.
  it("o tamanho vindo do shell (URL) vale já na primeira leitura", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(100), 1, 250, 100),
    );
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, tamanho: 100 }}
        onMudanca={vi.fn()}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(listarColaboradores).toHaveBeenNthCalledWith(
      1,
      { pagina: 1, tamanhoPagina: 100, grupo: "ativos" },
      expect.anything(),
    );
    expect(
      screen.queryByRole("combobox", { name: "Itens por página" }),
    ).toBeNull();
    expect(navegacaoDaPaginacao()).toHaveTextContent("Página 1 de 3");
  });

  it("a aba Jornada não tem seletor de tamanho (paginação própria)", async () => {
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, aba: "jornada" }}
        onMudanca={vi.fn()}
      />,
    );
    await screen.findByRole("tabpanel");
    expect(
      screen.queryByRole("combobox", { name: "Itens por página" }),
    ).toBeNull();
  });
});

describe("T209/T215 — Bloco A: paginação numerada e 'N resultados' (C-3)", () => {
  beforeEach(() => {
    vi.mocked(listarColaboradores).mockClear();
  });

  it("mostra o total da consulta e a posição na paginação", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20, 20), 2, 45),
    );
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, pagina: 2 }}
        onMudanca={vi.fn()}
      />,
    );
    expect(await screen.findByText("45 resultados")).toBeInTheDocument();
    expect(navegacaoDaPaginacao()).toHaveTextContent("Página 2 de 3");
  });

  it("na última página, a posição é a última; um só item diz '1 resultado'", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(5, 40), 3, 45),
    );
    const { unmount } = render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, pagina: 3 }}
        onMudanca={vi.fn()}
      />,
    );
    expect(await screen.findByText("45 resultados")).toBeInTheDocument();
    expect(navegacaoDaPaginacao()).toHaveTextContent("Página 3 de 3");
    unmount();

    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(1), 1, 1),
    );
    render(<ColaboradoresScreen />);
    expect(await screen.findByText("1 resultado")).toBeInTheDocument();
  });

  it("botões numerados, com a página atual marcada, e primeira e última página", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20, 100), 6, 205),
    );
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, pagina: 6 }}
        onMudanca={onMudanca}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const nav = navegacaoDaPaginacao();

    // 205 em páginas de 20: 11 páginas; janela de cinco em volta da atual.
    expect(
      within(nav)
        .getAllByRole("button", { name: /^Página \d+$/ })
        .map((b) => b.textContent),
    ).toEqual(["4", "5", "6", "7", "8"]);
    expect(
      within(nav).getByRole("button", { name: "Página 6" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("button", { name: "Página 5" }),
    ).not.toHaveAttribute("aria-current");

    fireEvent.click(within(nav).getByRole("button", { name: "Última página" }));
    expect(onMudanca).toHaveBeenLastCalledWith({
      ...ESTADO_PADRAO,
      pagina: 11,
    });
  });

  it("primeira página e números levam à página pedida, com filtros e busca preservados", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20, 60), 4, 205),
    );
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado
        inicial={{
          ...ESTADO_PADRAO,
          aba: "todos",
          pagina: 4,
          filtros: soTipos("clt"),
        }}
        onMudanca={onMudanca}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    buscar("sintética");
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        expect.objectContaining({ busca: "sintética" }),
        expect.anything(),
      ),
    );
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20, 40), 3, 205),
    );
    await screen.findByRole("button", { name: "Página 3" });

    fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        {
          pagina: 3,
          tamanhoPagina: 20,
          tipos: ["clt"],
          busca: "sintética",
        },
        expect.anything(),
      ),
    );
    expect(onMudanca).toHaveBeenLastCalledWith({
      ...ESTADO_PADRAO,
      aba: "todos",
      pagina: 3,
      filtros: soTipos("clt"),
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Página 3" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Primeira página" }));
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        expect.objectContaining({ pagina: 1, busca: "sintética" }),
        expect.anything(),
      ),
    );
  });

  it("nos extremos, primeira e anterior (ou última e próxima) ficam inertes, mas focalizáveis", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20), 1, 45),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const nav = navegacaoDaPaginacao();
    expect(
      within(nav).getByRole("button", { name: "Primeira página" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(nav).getByRole("button", { name: "Última página" }),
    ).toHaveAttribute("aria-disabled", "false");
    const chamadas = vi.mocked(listarColaboradores).mock.calls.length;
    fireEvent.click(
      within(nav).getByRole("button", { name: "Primeira página" }),
    );
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(chamadas);
  });

  it("a página atual marcada não relê nada ao ser clicada", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20), 1, 100),
    );
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={onMudanca} />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const leituras = vi.mocked(listarColaboradores).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Página 1" }));
    expect(onMudanca).not.toHaveBeenCalled();
    expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(leituras);
  });

  it("o botão numerado clicado conserva o foco enquanto a página nova chega", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20), 1, 100),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const adiada = adiado<ResultadoPaginadoTeste<ColaboradorListadoApi>>();
    vi.mocked(listarColaboradores).mockReturnValue(adiada.promessa as never);
    const tres = screen.getByRole("button", { name: "Página 3" });
    tres.focus();
    fireEvent.click(tres);
    expect(tres).toHaveFocus();
    await act(async () => {
      adiada.resolver(respostaDaPagina(pessoasSinteticas(20, 40), 3, 100));
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Página 3" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    expect(screen.getByRole("button", { name: "Página 3" })).toHaveFocus();
  });
});

describe("T209 — janela de páginas e intervalo (funções puras)", () => {
  it.each([
    [1, 1, [1]],
    [1, 2, [1, 2]],
    [2, 5, [1, 2, 3, 4, 5]],
    [1, 11, [1, 2, 3, 4, 5]],
    [2, 11, [1, 2, 3, 4, 5]],
    [3, 11, [1, 2, 3, 4, 5]],
    [4, 11, [2, 3, 4, 5, 6]],
    [6, 11, [4, 5, 6, 7, 8]],
    [9, 11, [7, 8, 9, 10, 11]],
    [10, 11, [7, 8, 9, 10, 11]],
    [11, 11, [7, 8, 9, 10, 11]],
    [6, 6, [2, 3, 4, 5, 6]],
  ])("página %i de %i: %j", (atual, total, esperado) => {
    expect(paginasDaJanela(atual, total)).toEqual(esperado);
  });

  it.each([
    [1, 20, 20, 45, "Mostrando 1–20 de 45 colaboradores"],
    [2, 20, 20, 45, "Mostrando 21–40 de 45 colaboradores"],
    [3, 20, 5, 45, "Mostrando 41–45 de 45 colaboradores"],
    [2, 50, 50, 120, "Mostrando 51–100 de 120 colaboradores"],
    [1, 100, 1, 1, "Mostrando 1–1 de 1 colaborador"],
  ])(
    "página %i, tamanho %i, %i na página, total %i",
    (pagina, tamanho, naPagina, total, esperado) => {
      expect(textoDoIntervalo(pagina, tamanho, naPagina, total)).toBe(esperado);
    },
  );
});

describe("T209 — Bloco A: leituras antigas canceladas", () => {
  beforeEach(() => {
    vi.mocked(listarColaboradores).mockClear();
  });

  it("trocar página, aba ou busca cancela a leitura anterior (T215: sem seletor de tamanho)", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20), 1, 100),
    );
    render(<DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(sinalDaLeitura(0).aborted).toBe(false);

    // Leitura que nunca termina: cada troca precisa cancelar a anterior.
    vi.mocked(listarColaboradores).mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(2),
    );
    abrirAba("Desligados");
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(3),
    );
    expect(sinalDaLeitura(1).aborted).toBe(true);
    abrirAba("Todos");
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(4),
    );
    expect(sinalDaLeitura(2).aborted).toBe(true);
    buscar("Pessoa");
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(5),
    );
    expect(sinalDaLeitura(3).aborted).toBe(true);
    expect(sinalDaLeitura(4).aborted).toBe(false);
  });

  it("desmontar a tela (troca de empresa, saída do módulo) cancela a leitura em voo", async () => {
    vi.mocked(listarColaboradores).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<ColaboradoresScreen />);
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(1),
    );
    expect(sinalDaLeitura(0).aborted).toBe(false);
    unmount();
    expect(sinalDaLeitura(0).aborted).toBe(true);
  });

  it("a leitura cancelada não vira erro na tela", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20), 1, 100),
    );
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    let rejeitar: (erro: unknown) => void = () => {};
    vi.mocked(listarColaboradores).mockReturnValueOnce(
      new Promise((_, r) => {
        rejeitar = r;
      }) as never,
    );
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(2),
    );
    vi.mocked(listarColaboradores).mockResolvedValue(
      respostaDaPagina(pessoasSinteticas(20), 1, 100),
    );
    abrirAba("Todos");
    await waitFor(() =>
      expect(vi.mocked(listarColaboradores).mock.calls.length).toBe(3),
    );
    expect(sinalDaLeitura(1).aborted).toBe(true);
    await act(async () => {
      rejeitar(new DOMException("Cancelada.", "AbortError"));
    });
    expect(await screen.findByText("100 resultados")).toBeInTheDocument();
    expect(
      screen.queryByText("Não foi possível carregar os colaboradores"),
    ).toBeNull();
  });

  it("os totais da aba Jornada também são cancelados ao desmontar", async () => {
    vi.mocked(listarColaboradores).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(
      <DashboardComEstado
        inicial={{ ...ESTADO_PADRAO, aba: "jornada" }}
        onMudanca={vi.fn()}
      />,
    );
    // A visão de jornadas lê colaboradores por conta própria: o que conta
    // aqui é a leitura mínima dos totais (uma linha).
    const daLeituraDosTotais = () =>
      vi
        .mocked(listarColaboradores)
        .mock.calls.find(
          ([q]) => q?.tamanhoPagina === 1 && q.situacao === undefined,
        );
    await waitFor(() => expect(daLeituraDosTotais()).toBeDefined());
    const sinal = (daLeituraDosTotais()![1] as { signal: AbortSignal }).signal;
    expect(sinal.aborted).toBe(false);
    unmount();
    expect(sinal.aborted).toBe(true);
  });
});

// T215 — o aviso "RH e DP" (C-6) saiu da página, como na referência.

// ---------------------------------------------------------------------------
// T209 — Bloco B: menu "Ações" por linha. T215 — o "⋯" da linha com "Ver
// ficha" e, para quem edita, "Editar colaborador". Nada de desligar, excluir
// ou agir em lote.
// ---------------------------------------------------------------------------

function botaoDeAcoes(nome: string): HTMLElement {
  return screen.getByRole("button", { name: `Ações: ${nome}` });
}

/** O menu do Radix abre no ponteiro (botão principal), como no navegador. */
async function abrirMenu(botao: HTMLElement): Promise<HTMLElement> {
  fireEvent.pointerDown(botao, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  return screen.findByRole("menu", {
    name: botao.getAttribute("aria-label") ?? "",
  });
}

function itensDoMenu(): string[] {
  return within(screen.getByRole("menu"))
    .getAllByRole("menuitem")
    .map((item) => item.textContent ?? "");
}

describe("T209 — Bloco B: menu 'Ações' por linha (C-4)", () => {
  beforeEach(() => {
    vi.mocked(listarColaboradores).mockClear();
  });

  it("cada linha tem um botão de menu com nome próprio; sem ficha, não há menu", async () => {
    const { unmount } = render(<ColaboradoresScreen onAbrirFicha={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const botao = botaoDeAcoes(colaborador1.nome);
    expect(botao).toHaveAttribute("aria-haspopup", "menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botaoDeAcoes(colaborador2.nome)).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Ações" }),
    ).toBeInTheDocument();
    unmount();

    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(screen.queryByRole("button", { name: /^Ações: / })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Ações" })).toBeNull();
  });

  it("T215 — Ver ficha e, só para quem edita, Editar colaborador; o gatilho é o ⋯", async () => {
    const { unmount } = render(<ColaboradoresScreen onAbrirFicha={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const botao = botaoDeAcoes(colaborador1.nome);
    // O "⋯": só o ícone à vista; o nome vem do rótulo.
    expect(botao.textContent).toBe("");
    await abrirMenu(botao);
    expect(itensDoMenu()).toEqual(["Ver ficha"]);
    unmount();

    render(
      <ColaboradoresScreen
        onAbrirFicha={vi.fn()}
        onEditarColaborador={vi.fn()}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    await abrirMenu(botaoDeAcoes(colaborador1.nome));
    expect(itensDoMenu()).toEqual(["Ver ficha", "Editar colaborador"]);
    // Nada que desligue, exclua, aja em lote ou exporte.
    for (const proibido of [/deslig/i, /exclu/i, /lote/i, /export/i]) {
      expect(itensDoMenu().some((t) => proibido.test(t))).toBe(false);
    }
    // Cada item com o seu ícone, decorativo.
    for (const item of within(screen.getByRole("menu")).getAllByRole(
      "menuitem",
    )) {
      expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("teclado abre no primeiro atalho; setas com volta, Home e End; Escape devolve o foco", async () => {
    render(
      <ColaboradoresScreen
        onAbrirFicha={vi.fn()}
        onEditarColaborador={vi.fn()}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const botao = botaoDeAcoes(colaborador1.nome);
    botao.focus();
    fireEvent.keyDown(botao, { key: "Enter" });
    const menu = await screen.findByRole("menu", {
      name: `Ações: ${colaborador1.nome}`,
    });
    const itens = within(menu).getAllByRole("menuitem");
    expect(botao).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(itens[0]).toHaveFocus());

    const tecla = async (key: string, alvo: HTMLElement) => {
      fireEvent.keyDown(document.activeElement!, { key });
      await waitFor(() => expect(alvo).toHaveFocus());
    };
    await tecla("ArrowDown", itens[1]!);
    await tecla("End", itens[itens.length - 1]!);
    await tecla("ArrowDown", itens[0]!);
    await tecla("ArrowUp", itens[itens.length - 1]!);
    await tecla("Home", itens[0]!);

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(botao).toHaveFocus());
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });

  it("seta para cima no botão abre no último atalho; para baixo, no primeiro", async () => {
    render(<ColaboradoresScreen onAbrirFicha={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const botao = botaoDeAcoes(colaborador1.nome);
    botao.focus();
    fireEvent.keyDown(botao, { key: "ArrowUp" });
    let itens = within(await screen.findByRole("menu")).getAllByRole(
      "menuitem",
    );
    await waitFor(() => expect(itens[itens.length - 1]).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    fireEvent.keyDown(botao, { key: "ArrowDown" });
    itens = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(itens[0]).toHaveFocus());
  });

  it("clique fora fecha o menu; só um menu aberto por vez", async () => {
    render(<ColaboradoresScreen onAbrirFicha={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    await abrirMenu(botaoDeAcoes(colaborador1.nome));
    fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await abrirMenu(botaoDeAcoes(colaborador1.nome));
    await abrirMenu(botaoDeAcoes(colaborador2.nome));
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(1));
    expect(screen.getByRole("menu")).toHaveAccessibleName(
      `Ações: ${colaborador2.nome}`,
    );
  });

  it("Ver ficha abre a ficha; Editar colaborador pede a edição; o foco volta ao ⋯", async () => {
    const onAbrirFicha = vi.fn();
    const onEditarColaborador = vi.fn();
    render(
      <ColaboradoresScreen
        onAbrirFicha={onAbrirFicha}
        onEditarColaborador={onEditarColaborador}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const botao = botaoDeAcoes(colaborador1.nome);
    await abrirMenu(botao);
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver ficha" }));
    expect(botao).toHaveFocus();
    expect(onAbrirFicha).toHaveBeenLastCalledWith(colaborador1.id);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await abrirMenu(botao);
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Editar colaborador" }),
    );
    expect(botao).toHaveFocus();
    expect(onEditarColaborador).toHaveBeenLastCalledWith(colaborador1.id);
    expect(onAbrirFicha).toHaveBeenCalledTimes(1);
  });

  it("Enter num atalho escolhe pelo teclado", async () => {
    const onEditarColaborador = vi.fn();
    render(
      <ColaboradoresScreen
        onAbrirFicha={vi.fn()}
        onEditarColaborador={onEditarColaborador}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const botao = botaoDeAcoes(colaborador2.nome);
    botao.focus();
    fireEvent.keyDown(botao, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    const ultimo = within(menu).getByRole("menuitem", {
      name: "Editar colaborador",
    });
    await waitFor(() =>
      expect(within(menu).getAllByRole("menuitem")[0]).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    await waitFor(() => expect(ultimo).toHaveFocus());
    fireEvent.keyDown(ultimo, { key: "Enter" });
    await waitFor(() =>
      expect(onEditarColaborador).toHaveBeenLastCalledWith(colaborador2.id),
    );
  });

  it("no contêiner de Pessoas, Ver ficha abre a ficha nos dados", async () => {
    render(<ComFicha />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    await abrirMenu(botaoDeAcoes(colaborador1.nome));
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver ficha" }));
    const ficha = await esperarFicha();
    expect(
      within(ficha).getByRole("tab", { name: /Dados do colaborador/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("o nome continua abrindo a ficha nos dados, como antes", async () => {
    const onAbrirFicha = vi.fn();
    render(<ColaboradoresScreen onAbrirFicha={onAbrirFicha} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(
      screen.getByRole("button", {
        name: `Abrir ficha de ${colaborador1.nome}`,
      }),
    );
    expect(onAbrirFicha).toHaveBeenLastCalledWith(colaborador1.id);
  });
});

describe("T209 — contrato de CSS da listagem operacional e do menu (375 px)", () => {
  const css = readFileSync(
    "src/screens/pessoas/ColaboradoresScreen.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const inicio = css.indexOf("/* ---- T209 — listagem operacional");
  const bloco = inicio > -1 ? css.slice(inicio) : "";

  it("o bloco existe e usa só tokens: nenhuma cor literal", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(bloco).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });

  it("rodapé e paginação quebram linha (sem rolagem lateral) e têm alvo de 44 px", () => {
    expect(bloco).toMatch(
      /\.colaboradores-screen__rodape-tabela \{[^}]*flex-wrap: wrap;[^}]*min-width: 0;/,
    );
    expect(bloco).toMatch(
      /\.colaboradores-screen__paginacao \{[^}]*flex-wrap: wrap;/,
    );
    expect(bloco).toMatch(
      /\.colaboradores-screen__pagina-numero \{[^}]*min-width: var\(--touch-target\);[^}]*min-height: var\(--touch-target\);/,
    );
  });

  it("página atual não depende só de cor; menu cabe na tela e fica abaixo do cabeçalho fixo", () => {
    expect(bloco).toMatch(
      /\.colaboradores-screen__pagina-numero\[aria-current="page"\] \{[^}]*font-weight: var\(--weight-strong\);[^}]*border-color: var\(--color-action\);/,
    );
    // O menu é o da camada `src/ui` (portal do Radix): cabe na tela e fica
    // numa camada abaixo do cabeçalho fixo (z-index 20 < 30).
    const menu = readFileSync("src/ui/DropdownMenu.tsx", "utf8");
    expect(menu).toContain("ev:z-20");
    expect(menu).toContain("ev:max-w-[calc(100vw-2*var(--space-md))]");
    expect(menu).toContain("<RadixMenu.Portal>");
  });
});

// ---------------------------------------------------------------------------
// T209 — refinamento da listagem: cabeçalho enxuto com só as ações reais,
// faixa de indicadores (ativos em destaque e a distribuição por tipo) e barra
// de busca e filtros em linha. Nada de indicador, aba ou ação sem contrato.
// ---------------------------------------------------------------------------
describe("T209 — refinamento: cabeçalho, faixa de indicadores e filtros", () => {
  const CONTADORES_REAIS: ContadoresColaboradoresApi = {
    ativos: 7,
    inativos: 5,
    emAdmissao: 2,
    desligados: 3,
    total: 12,
    ativosPorTipo: {
      clt: 5,
      estagio: 0,
      aprendiz: 0,
      pj: 2,
      temporario: 0,
      outro_controlado: 0,
      part_time: 0,
      freelancer: 0,
      trainee: 0,
    },
  };

  it("T215 — cabeçalho: título, a descrição da referência, Exportar e Novo colaborador", async () => {
    render(<ColaboradoresScreen onNovaAdmissao={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const titulo = screen.getByRole("heading", {
      level: 1,
      name: "Colaboradores",
    });
    const cabecalho = titulo.closest(".evolli-page-header") as HTMLElement;
    expect(cabecalho).toHaveTextContent(
      "Gerencie contratos, dados e documentos do time.",
    );
    expect(
      within(cabecalho)
        .getAllByRole("button")
        .map((b) => b.textContent?.trim()),
    ).toEqual(["Exportar", "Novo colaborador"]);
  });

  it("T215 — três cartões, na ordem da referência", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([colaborador1]),
      contadores: CONTADORES_REAIS,
    });
    render(
      <ColaboradoresScreen
        empresaAtiva={{ nome: "Empresa Teste A", codigo: "TA" }}
      />,
    );
    const regiao = await screen.findByRole("region", {
      name: "Resumo de colaboradores",
    });
    await waitFor(() =>
      expect(
        within(regiao).getByRole("group", { name: "Colaboradores ativos" }),
      ).toHaveTextContent("7"),
    );
    expect(
      within(regiao)
        .getAllByRole("group")
        .map((g) => g.querySelector("h3")?.textContent),
    ).toEqual([
      "Colaboradores ativos",
      "Por tipo de contrato",
      "Ausentes hoje",
    ]);
  });

  it("T215 — o que a referência tem: Exportar e Ausentes hoje; sem destino, sem Organograma; sem 'Em admissão'", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([colaborador1]),
      contadores: CONTADORES_REAIS,
    });
    render(
      <ColaboradoresScreen onNovaAdmissao={vi.fn()} onAbrirFicha={vi.fn()} />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const visivel = document.body.textContent ?? "";
    expect(visivel).toMatch(/Ausentes hoje/);
    expect(visivel).toMatch(/Exportar/);
    expect(visivel).not.toMatch(/organograma/i);
    expect(
      within(screen.getByRole("tablist", { name: "Grupos de colaboradores" }))
        .getAllByRole("tab")
        .map((t) => t.textContent?.replace(/\d+$/, "")),
    ).toEqual([
      "Ativos",
      "Férias e ausências",
      "Escala de trabalho",
      "Desligados",
      "Todos",
    ]);
  });

  it("T215 — a barra de busca e filtros: o campo com o nome da referência e só o botão Filtrar", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const barra = document.querySelector(".colaboradores-screen__filtros")!;
    expect(barra.querySelectorAll("label")).toHaveLength(0);
    expect(
      within(barra as HTMLElement).getByRole("searchbox", {
        name: "Buscar por nome, CPF, e-mail ou ID",
      }),
    ).toHaveAttribute("placeholder", "Buscar por nome, CPF, e-mail ou ID");
    // T215 — os filtros moram na gaveta: na barra, só o botão "Filtrar".
    expect(
      within(barra as HTMLElement)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Filtrar"]);
    expect(
      within(barra as HTMLElement).getByRole("button", { name: "Filtrar" }),
    ).toHaveAttribute("aria-haspopup", "dialog");
  });
});

describe("T209 — contrato de CSS da faixa de indicadores e da barra de filtros", () => {
  const css = readFileSync(
    "src/screens/pessoas/ColaboradoresScreen.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const inicio = css.indexOf("/* ---- T209 — faixa de indicadores");
  const bloco = inicio > -1 ? css.slice(inicio) : "";

  it("o bloco existe e usa só tokens", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(bloco).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });

  it("faixa: uma coluna por padrão; dois painéis lado a lado quando o contêiner tem espaço, com divisória", () => {
    expect(bloco).toMatch(
      /\.colaboradores-screen__indicadores \{[^}]*container-type: inline-size;/,
    );
    expect(bloco).toMatch(
      /\.colaboradores-screen__faixa \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*min-width: 0;/,
    );
    expect(bloco).toMatch(
      /@container \(min-width: 36rem\) \{[^@]*\.colaboradores-screen__faixa \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/,
    );
    expect(bloco).toMatch(
      /@container \(min-width: 36rem\) \{[^@]*\.colaboradores-screen__distribuicao \{[^}]*border-left: 1px solid var\(--divider-soft\);/,
    );
  });

  it("'Ativos' em destaque ocupa a linha toda; os demais totais são menores", () => {
    expect(bloco).toMatch(
      /\.colaboradores-screen__cartao--destaque \{[^}]*grid-column: 1 \/ -1;/,
    );
    expect(bloco).toMatch(
      /\.colaboradores-screen__cartao--destaque dd \{[^}]*font-size: var\(--text-display\);/,
    );
  });

  it("a barra em linha vale só acima de 640 px: no celular, a coluna da T178 continua", () => {
    const linha =
      /@media \(min-width: 641px\) \{([\s\S]*?)\n\}/.exec(bloco)?.[1] ?? "";
    expect(linha).toMatch(
      /\.colaboradores-screen__filtros \{[^}]*align-items: flex-end;/,
    );
    expect(linha).toMatch(
      /\.colaboradores-screen__filtros > \.evolli-field \{[^}]*flex: 1 1 10rem;/,
    );
    expect(linha).toMatch(
      /\.colaboradores-screen__filtros > \.colaboradores-screen__busca \{[^}]*flex: 2 1 18rem;/,
    );
    // Fora da mídia, nenhuma regra de flex nos filtros (anularia a coluna).
    const foraDaMidia = bloco.replace(
      /@media \(min-width: 641px\) \{[\s\S]*?\n\}/,
      "",
    );
    expect(foraDaMidia).not.toMatch(
      /\.colaboradores-screen__filtros[^{]*\{[^}]*flex:/,
    );
    expect(foraDaMidia).not.toMatch(
      /\.colaboradores-screen__filtros \{[^}]*align-items:/,
    );
  });

  it("barra de filtros: campos alinhados pela base, que quebram linha e encolhem", () => {
    expect(bloco).toMatch(
      /\.colaboradores-screen__filtros \{[^}]*align-items: flex-end;[^}]*min-width: 0;/,
    );
    expect(bloco).toMatch(
      /\.colaboradores-screen__filtros > \.evolli-field \{[^}]*flex: 1 1 10rem;[^}]*min-width: 0;/,
    );
    expect(bloco).toMatch(
      /\.colaboradores-screen__filtros > \.colaboradores-screen__busca \{[^}]*flex: 2 1 18rem;/,
    );
  });
});

// ---------------------------------------------------------------------------
// T209 — Aprendiz como tipo de vínculo (fatia mínima): filtro, distribuição,
// coluna da tabela e URL, logo depois de Estágio. Nenhuma regra legal.
// ---------------------------------------------------------------------------
describe("T209 — Aprendiz na listagem de Colaboradores", () => {
  const APRENDIZ = listado(
    { id: "a1a1a1a1-0000-4000-8000-000000000001", nome: "Teste Aprendiz Um" },
    [
      {
        ...vinculoListado(
          "a1a1a1a1-0000-4000-8000-0000000000v1",
          "APR-001",
          "ativo",
          "2026-02-02",
        ),
        tipo: "aprendiz",
      },
    ],
  );

  it("o filtro 'Tipo de contrato' da gaveta oferece Aprendiz depois de Estágio", async () => {
    render(<ColaboradoresScreen />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    const gaveta = await abrirGaveta();
    expect(
      within(within(gaveta).getByRole("group", { name: "Tipo de contrato" }))
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "CLT",
      "Estágio",
      "Aprendiz",
      "PJ",
      "Temporário",
      "Outro controlado",
      // T209 — etapa 2 do Novo colaborador.
      "Part-time",
      "Freelancer",
      "Trainee",
    ]);
  });

  it("filtrar por Aprendiz sobe na URL e vai ao servidor em tipos", async () => {
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={onMudanca} />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — / });
    await filtrarPelaGaveta(["Tipo de contrato", "Aprendiz"]);
    expect(onMudanca).toHaveBeenLastCalledWith({
      ...ESTADO_PADRAO,
      filtros: soTipos("aprendiz"),
    });
    await waitFor(() =>
      expect(listarColaboradores).toHaveBeenLastCalledWith(
        expect.objectContaining({ tipos: ["aprendiz"] }),
        expect.anything(),
      ),
    );
    expect(
      await screen.findByRole("button", {
        name: "Remover filtro Tipo: Aprendiz",
      }),
    ).toBeInTheDocument();
  });

  it("o contrato da linha e o cartão por tipo mostram 'Aprendiz', com a cor própria (T215)", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue({
      ...paginado([APRENDIZ]),
      contadores: {
        ...contados([APRENDIZ]),
        ativosPorTipo: {
          clt: 2,
          estagio: 1,
          aprendiz: 3,
          pj: 0,
          temporario: 0,
          outro_controlado: 0,
          part_time: 0,
          freelancer: 0,
          trainee: 0,
        },
      },
    });
    render(<ColaboradoresScreen />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    const linha = within(tabela).getByText("Teste Aprendiz Um").closest("tr")!;
    expect(within(linha).getByText("Aprendiz")).toBeInTheDocument();
    const tipos = screen.getByRole("group", { name: "Por tipo de contrato" });
    expect(
      within(tipos)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["CLT 2", "PJ 0", "Estágio 1", "Aprendiz 3", "Outros 0"]);
    expect(
      tipos.querySelector(
        ".colaboradores-screen__barra-contratos .colaboradores-screen__grupo-contrato--aprendiz",
      ),
    ).not.toBeNull();
  });
});

describe("T209 — Colaboradores sobre a camada de interface (src/ui)", () => {
  it("busca e filtros são os controles nativos da camada (T215: sem seletor de tamanho)", async () => {
    render(<ColaboradoresScreen onAbrirFicha={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    expect(campoBusca()).toHaveAttribute("data-ui", "input");
    // T215 — a gaveta "Filtrar" é o Sheet da camada (role dialog, modal).
    const gaveta = await abrirGaveta();
    expect(gaveta).toHaveAttribute("aria-modal", "true");
    expect(gaveta).toHaveAttribute("data-lado", "direita");
  });

  it("abas e tabela vêm da camada, com as mesmas classes e semântica", async () => {
    render(<ColaboradoresScreen onAbrirFicha={vi.fn()} />);
    const tabela = await screen.findByRole("table", {
      name: /^Colaboradores — /,
    });
    const abas = within(
      screen.getByRole("tablist", { name: "Grupos de colaboradores" }),
    ).getAllByRole("tab");
    expect(abas[0]).toHaveAttribute("data-state", "active");
    expect(abas[1]).toHaveAttribute("data-state", "inactive");
    // T215 — os cartões saíram do Card da camada: são a faixa da referência.
    expect(tabela.closest('[role="region"]')).toHaveClass("evolli-datatable");
    expect(within(tabela).getAllByRole("columnheader")[0]).toHaveAttribute(
      "scope",
      "col",
    );
  });

  it("o painel 'Adicionar colaborador' é o Sheet da camada", async () => {
    render(<ColaboradoresScreen onNovaAdmissao={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — / });
    fireEvent.click(
      screen.getAllByRole("button", { name: /Novo colaborador/ })[0]!,
    );
    const painel = await screen.findByRole("dialog", {
      name: "Adicionar colaborador",
    });
    expect(painel).toHaveAttribute("data-lado", "direita");
    expect(painel).toHaveAttribute("aria-modal", "true");
  });
});

/**
 * T200 — as telas montadas como no shell: com o registro de edições e a
 * guarda de saída (sem ela, a saída não pergunta).
 */
function render(
  ui: Parameters<typeof renderSemGuarda>[0],
  opcoes?: Omit<RenderOptions, "wrapper">,
) {
  // T209 — com a barra em miniatura: a ficha declara o último nível da trilha.
  return renderSemGuarda(comTrilha(ui), {
    wrapper: ComGuardaDeSaida,
    ...opcoes,
  });
}

// ---------------------------------------------------------------------------
// T209 — divisões sutis em Colaboradores, com os tokens de divisão (sem cor
// nova): cabeçalho da página, faixa de indicadores (divisores entre os
// totais), abas e busca/filtros, tabela (cabeçalho, linhas e hover) e o
// rodapé da paginação. Escopadas à tela: o componente de tabela compartilhado
// não muda para as demais telas.
// ---------------------------------------------------------------------------
describe("T209 — contrato de CSS das divisões em Colaboradores", () => {
  const css = readFileSync(
    "src/screens/pessoas/ColaboradoresScreen.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const inicio = css.indexOf("/* ---- T209 — divisões");
  const bloco = inicio > -1 ? css.slice(inicio) : "";
  const regra = (seletor: string) => {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
      new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`).exec(bloco)?.[2] ?? ""
    );
  };

  it("o bloco existe e usa só tokens (nenhuma cor literal nem borda em px solta)", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(bloco).not.toMatch(/\brgba?\(|\bhsla?\(/);
    expect(bloco).not.toMatch(/\d+px solid/);
  });

  it("cabeçalho da página e faixa de ações separados do resto por um divisor", () => {
    expect(regra(".colaboradores-screen > .evolli-page-header")).toMatch(
      /padding-bottom: var\(--secao-espaco-compacto\);[^]*border-bottom: var\(--divisor\);/,
    );
  });

  it("indicadores: divisores entre os totais menores; o painel inteiro com a borda de card", () => {
    expect(regra(".colaboradores-screen__indicadores")).toMatch(
      /border: var\(--borda-card\);/,
    );
    expect(
      regra(".colaboradores-screen__fato + .colaboradores-screen__fato"),
    ).toMatch(
      /padding-left: var\(--space-sm\);[^]*border-left: var\(--divisor\);/,
    );
  });

  it("abas e área de busca/filtros separadas por divisores", () => {
    expect(regra(".colaboradores-screen__abas")).toMatch(
      /border-bottom: var\(--divisor-forte\);/,
    );
    expect(regra(".colaboradores-screen__filtros")).toMatch(
      /padding-bottom: var\(--secao-espaco-compacto\);[^]*border-bottom: var\(--divisor\);/,
    );
  });

  it("tabela: borda e linhas com os tokens; hover da linha só aqui", () => {
    expect(regra(".colaboradores-screen .evolli-datatable")).toMatch(
      /border: var\(--borda-tabela\);/,
    );
    expect(regra(".colaboradores-screen .evolli-datatable__th")).toMatch(
      /border-bottom: var\(--divisor-forte\);/,
    );
    expect(regra(".colaboradores-screen .evolli-datatable__td")).toMatch(
      /border-bottom: var\(--divisor\);/,
    );
    expect(
      regra(".colaboradores-screen .evolli-datatable__table tbody tr:hover"),
    ).toMatch(/background: var\(--estado-hover-superficie\);/);
  });

  it("rodapé da paginação separado da tabela por um divisor", () => {
    expect(regra(".colaboradores-screen__rodape-tabela")).toMatch(
      /padding-top: var\(--secao-espaco-compacto\);[^]*border-top: var\(--divisor\);/,
    );
  });

  it("o componente de tabela compartilhado não ganha hover para as outras telas", () => {
    const dataTable = readFileSync(
      "src/components/DataTable.css",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(dataTable).not.toMatch(/tr:hover/);
  });
});

// ---------------------------------------------------------------------------
// T209 — a foto do colaborador na listagem: a versão de 96 px pela rota
// autenticada, preguiçosa, só nas linhas que têm foto; sem foto, iniciais.
// ---------------------------------------------------------------------------
describe("T209 — foto na listagem de Colaboradores", () => {
  const celula = (nome: string) =>
    screen
      .getByRole("button", { name: `Abrir ficha de ${nome}` })
      .closest(".colaboradores-screen__pessoa") as HTMLElement;

  it("linha com foto: avatar de 96 px pela rota autenticada; sem foto, iniciais", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([
        { ...colaborador1, foto: { versao: 4 } },
        { ...colaborador2, foto: null },
      ]),
    );
    render(<ComFicha />);
    await screen.findByRole("button", {
      name: "Abrir ficha de Ana Colaboradora (teste)",
    });
    const img = celula("Ana Colaboradora (teste)").querySelector("img");
    expect(img).toHaveAttribute(
      "src",
      `/v1/colaboradores/${colaborador1.id}/foto?tamanho=96&v=4`,
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("alt", "");
    const semFoto = celula("Bruno Colaborador (teste)");
    expect(semFoto.querySelector("img")).toBeNull();
    expect(semFoto).toHaveTextContent("BT");
  });

  it("só as linhas com foto pedem imagem; nada do armazenamento no HTML", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([{ ...colaborador1, foto: { versao: 1 } }, colaborador2]),
    );
    const { container } = render(<ComFicha />);
    await screen.findByRole("button", {
      name: "Abrir ficha de Ana Colaboradora (teste)",
    });
    const imagens = container.querySelectorAll(
      ".colaboradores-screen__avatar img",
    );
    expect(imagens).toHaveLength(1);
    // A única origem de imagem é a rota autenticada do Evolli.
    for (const img of imagens) {
      expect(img.getAttribute("src")).toMatch(
        /^\/v1\/colaboradores\/[0-9a-f-]+\/foto\?tamanho=96&v=\d+$/,
      );
    }
    expect(container.innerHTML).not.toMatch(
      /v1\/empresas|foto-(96|256|512)\.webp|cloudflare|bucket/i,
    );
  });

  it("falha ao ler a foto da linha: volta às iniciais, a listagem segue", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      paginado([{ ...colaborador1, foto: { versao: 1 } }, colaborador2]),
    );
    render(<ComFicha />);
    await screen.findByRole("button", {
      name: "Abrir ficha de Ana Colaboradora (teste)",
    });
    fireEvent.error(celula("Ana Colaboradora (teste)").querySelector("img")!);
    expect(celula("Ana Colaboradora (teste)").querySelector("img")).toBeNull();
    expect(celula("Ana Colaboradora (teste)")).toHaveTextContent("AT");
    expect(
      screen.getByRole("button", {
        name: "Abrir ficha de Bruno Colaborador (teste)",
      }),
    ).toBeInTheDocument();
  });

  it("contrato de CSS: a foto preenche o avatar redondo sem deformar", () => {
    const css = readFileSync(
      "src/screens/pessoas/ColaboradoresScreen.css",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(css).toMatch(
      /\.colaboradores-screen__avatar img \{[^}]*object-fit: cover;[^}]*\}/,
    );
    expect(css).toMatch(
      /\.colaboradores-screen__avatar \{[^}]*overflow: hidden;/,
    );
  });
});

// ---------------------------------------------------------------------------
// T215 — as abas da listagem: Ativos, Em admissão, Férias e ausências, Escala
// de trabalho, Organograma (atalho para a estrutura), Desligados e Todos.
// ---------------------------------------------------------------------------
describe("T215 — abas da listagem", () => {
  const nomesDasAbas = () =>
    within(screen.getByRole("tablist", { name: "Grupos de colaboradores" }))
      .getAllByRole("tab")
      .map((t) => t.textContent?.replace(/\d+$/, ""));

  it("com destino para o Organograma: seis abas, na ordem (T215: sem Em admissão)", async () => {
    render(<ColaboradoresScreen onAbrirOrganograma={vi.fn()} />);
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    expect(nomesDasAbas()).toEqual([
      "Ativos",
      "Férias e ausências",
      "Escala de trabalho",
      "Organograma",
      "Desligados",
      "Todos",
    ]);
  });

  it("Organograma abre a estrutura: chama o destino e não troca a aba", async () => {
    const onAbrirOrganograma = vi.fn();
    const onMudanca = vi.fn();
    render(
      <ColaboradoresScreen
        estado={ESTADO_PADRAO}
        onEstadoChange={onMudanca}
        onAbrirOrganograma={onAbrirOrganograma}
      />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    const organograma = screen.getByRole("tab", { name: "Organograma" });
    expect(organograma).toHaveAttribute("aria-selected", "false");
    fireEvent.click(organograma);
    expect(onAbrirOrganograma).toHaveBeenCalledTimes(1);
    expect(onMudanca).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /^Ativos/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("Férias e ausências: painel próprio, sem tabela, busca nem filtros; não relê a listagem por grupo", async () => {
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={onMudanca} />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    const chamadas = vi.mocked(listarColaboradores).mock.calls.length;
    abrirAba("Férias e ausências");
    expect(onMudanca).toHaveBeenLastCalledWith({
      ...ESTADO_PADRAO,
      aba: "ferias",
    });
    const painel = screen.getByRole("tabpanel");
    expect(
      within(painel).getByRole("heading", {
        level: 2,
        name: "Férias e ausências",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /^Colaboradores — / }),
    ).toBeNull();
    expect(screen.queryByLabelText("Buscar por nome ou matrícula")).toBeNull();
    for (const [consulta] of vi
      .mocked(listarColaboradores)
      .mock.calls.slice(chamadas)) {
      expect(consulta).not.toHaveProperty("grupo");
      expect(consulta).not.toHaveProperty("situacao");
    }
  });

  it("Escala de trabalho é a visão de jornadas (aba 'jornada' na URL)", async () => {
    const onMudanca = vi.fn();
    render(
      <DashboardComEstado inicial={ESTADO_PADRAO} onMudanca={onMudanca} />,
    );
    await screen.findByRole("table", { name: /^Colaboradores — Ativos/ });
    abrirAba("Escala de trabalho");
    expect(onMudanca).toHaveBeenLastCalledWith({
      ...ESTADO_PADRAO,
      aba: "jornada",
    });
    expect(
      await within(screen.getByRole("tabpanel")).findByRole("heading", {
        level: 2,
        name: "Jornada de trabalho",
      }),
    ).toBeInTheDocument();
  });
});
