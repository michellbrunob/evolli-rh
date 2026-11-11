/**
 * T205 — tela do Dashboard (D-1 a D-12): o que se prova aqui é a tela —
 * leituras, números, unidades, frase, atalhos, série, teto, estados, foco e
 * anúncios. Rota, histórico, aterrissagem e papéis no shell estão em
 * `App.dashboard.test.tsx` e `AutenticacaoApp.test.tsx`.
 *
 * T207 — as cinco abas (V-3), os cards sem dado (V-2), "Como calculamos"
 * (V-5) e a nova Visão Geral (V-1). As garantias da T205 continuam aqui,
 * reescritas sobre a estrutura nova: nenhuma foi removida.
 */
import { readFileSync } from "node:fs";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listarColaboradores,
  type ColaboradorListadoApi,
  type ContadoresColaboradoresApi,
  type ListagemColaboradoresApi,
  type ListarColaboradoresQuery,
} from "../../api/colaboradoresClient";
import {
  listarMovimentacoes,
  type ListarMovimentacoesQuery,
  type MovimentacaoApi,
  type ResultadoPaginado,
  type TipoMovimentacao,
} from "../../api/movimentacaoClient";
import {
  ESTADO_INICIAL_DA_LISTAGEM,
  rotaDaListagem,
} from "../../app/rotasDoShell";
import {
  DashboardScreen,
  LIMITE_DA_SERIE,
  LIMITE_DA_SERIE_TEXTO,
} from "./DashboardScreen";
import { posicaoDoPainel } from "./GraficoMensal";

vi.mock("../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/colaboradoresClient")
  >("../../api/colaboradoresClient");
  return { ...actual, listarColaboradores: vi.fn() };
});

vi.mock("../../api/movimentacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/movimentacaoClient")
  >("../../api/movimentacaoClient");
  return { ...actual, listarMovimentacoes: vi.fn() };
});

/** 9 de novembro de 2026, meio-dia (relógio do navegador). */
const AGORA = new Date(2026, 10, 9, 12, 0, 0);
const EMPRESA = { nome: "Empresa Sintética Alfa" };

function contadores(
  parcial: Partial<ContadoresColaboradoresApi> = {},
): ContadoresColaboradoresApi {
  return {
    ativos: 12,
    inativos: 3,
    emAdmissao: 2,
    desligados: 3,
    total: 17,
    ativosPorTipo: {
      clt: 9,
      estagio: 3,
      pj: 0,
      temporario: 0,
      outro_controlado: 0,
    },
    ...parcial,
  };
}

function listagem(c: ContadoresColaboradoresApi): ListagemColaboradoresApi {
  return {
    itens: [],
    pagina: 1,
    tamanhoPagina: 1,
    total: c.total,
    contadores: c,
  };
}

/**
 * T207 — o mesmo endpoint serve duas leituras: os contadores (uma página
 * mínima) e as pessoas ativas de hoje (`grupo: "ativos"`, de 100 em 100).
 * Cada uma tem o seu "servidor", para que as garantias da T205 sobre os
 * contadores continuem medidas só nos contadores.
 */
const servidorDosContadores =
  vi.fn<(q?: ListarColaboradoresQuery) => Promise<ListagemColaboradoresApi>>();
const servidorDosAtivos =
  vi.fn<(q?: ListarColaboradoresQuery) => Promise<ListagemColaboradoresApi>>();

function ativo(
  id: string,
  dataAdmissao: string,
  departamento: string | null,
): ColaboradorListadoApi {
  return {
    id,
    nome: `Pessoa sintética ${id}`,
    situacao: "ativo",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    vinculos: [
      {
        id: `v-${id}`,
        empresaId: "empresa-sintetica",
        matricula: null,
        tipo: "clt",
        situacao: "ativo",
        dataAdmissao,
        dataDesligamento: null,
        lotacaoVigente: departamento
          ? {
              cargo: null,
              departamento: {
                id: `d-${departamento}`,
                codigo: departamento.slice(0, 3).toUpperCase(),
                nome: departamento,
              },
            }
          : null,
        vigenciasDeJornada: [],
      },
    ],
  };
}

/**
 * Time sintético de hoje (9/11/2026): 5 em Operações há 18 meses, 3 em
 * Vendas há 6, 1 em Jurídico há 10 anos (departamento pequeno) e 1 sem
 * lotação vigente há 1 mês.
 */
const TIME_PADRAO = () => [
  ...Array.from({ length: 5 }, (_, i) =>
    ativo(`op-${i}`, "2025-05-09", "Operações"),
  ),
  ...Array.from({ length: 3 }, (_, i) =>
    ativo(`ve-${i}`, "2026-05-09", "Vendas"),
  ),
  ativo("ju-0", "2016-11-09", "Jurídico"),
  ativo("sem-0", "2026-10-09", null),
];

/** Pessoas ativas do "servidor", de 100 em 100. */
function servidorDeAtivos(todas: ColaboradorListadoApi[]) {
  servidorDosAtivos.mockImplementation(async (q = {}) => {
    const tamanho = q.tamanhoPagina ?? 20;
    const pagina = q.pagina ?? 1;
    return {
      itens: todas.slice((pagina - 1) * tamanho, pagina * tamanho),
      pagina,
      tamanhoPagina: tamanho,
      total: todas.length,
      contadores: contadores(),
    };
  });
}

let n = 0;
function mov(tipo: TipoMovimentacao, vigenciaInicio: string): MovimentacaoApi {
  n += 1;
  return {
    id: `m-${n}`,
    vinculoId: `v-${n}`,
    empresaId: "empresa-sintetica",
    tipo,
    status: "efetivada",
    motivoCodigo: "admissao_inicial",
    registradaEm: "2026-01-01T00:00:00.000Z",
    solicitanteUserId: "u-1",
    vigenciaInicio,
    efetivadaEm: "2026-01-01T00:00:00.000Z",
    executorUserId: "u-1",
    retificaId: null,
    destinoUnidadeOrganizacionalId: null,
    destinoDepartamentoId: null,
    destinoAreaId: null,
    destinoEquipeId: null,
    destinoCargoId: null,
    destinoCentroCustoId: null,
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
  } as MovimentacaoApi;
}

/** Movimentações do "servidor", já em ordem decrescente de vigência. */
function servidorDeMovimentacoes(todas: MovimentacaoApi[]) {
  vi.mocked(listarMovimentacoes).mockImplementation(
    async (q: ListarMovimentacoesQuery = {}) => {
      const doTipo = todas
        .filter((m) => m.tipo === q.tipo && m.status === q.status)
        .sort((a, b) => (a.vigenciaInicio < b.vigenciaInicio ? 1 : -1));
      const tamanho = q.tamanhoPagina ?? 20;
      const pagina = q.pagina ?? 1;
      return {
        itens: doTipo.slice((pagina - 1) * tamanho, pagina * tamanho),
        pagina,
        tamanhoPagina: tamanho,
        total: doTipo.length,
      };
    },
  );
}

const MOVIMENTACOES_PADRAO = () => [
  mov("admissao", "2026-01-10"),
  mov("admissao", "2026-01-20"),
  mov("admissao", "2026-03-05"),
  mov("admissao", "2026-11-09"),
  mov("admissao", "2026-11-10"), // amanhã: fora
  mov("admissao", "2025-12-30"), // ano anterior: fora
  mov("desligamento", "2026-03-31"),
];

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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  n = 0;
  servidorDosContadores.mockReset();
  servidorDosAtivos.mockReset();
  vi.mocked(listarColaboradores).mockImplementation((q = {}) =>
    q.grupo === "ativos" ? servidorDosAtivos(q) : servidorDosContadores(q),
  );
  servidorDosContadores.mockResolvedValue(listagem(contadores()));
  servidorDeAtivos(TIME_PADRAO());
  servidorDeMovimentacoes(MOVIMENTACOES_PADRAO());
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Deixa terminar, dentro de `act`, as leituras que o teste não esperou (as
 * que não ficaram pendentes de propósito) — nenhum desenho fora de `act`.
 */
async function assentar() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function Tela(props: Partial<Parameters<typeof DashboardScreen>[0]> = {}) {
  return (
    <DashboardScreen
      ano={2026}
      empresaAtiva={EMPRESA}
      onTrocarAno={() => {}}
      onAbrirListagem={() => {}}
      {...props}
    />
  );
}

/** Espera a primeira leitura terminar. */
async function lido() {
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(/lido em/),
  );
}

const bloco = (nome: RegExp | string) =>
  screen.getByRole("region", { name: nome });
const indicador = (nome: string) => screen.getByRole("article", { name: nome });
const SERIE = "Quadro de colaboradores";
/** T207 — o grupo neutro da Distribuição do time. */
const GRUPO_NEUTRO_DO_TESTE = "Outros (agrupados por privacidade)";
/** T207 — o quadro na vista de tabela (gráfico é a vista padrão). */
const EM_TABELA = { quadro: "tabela" } as const;
/** "—" à vista e "indisponível" ao leitor: o texto da célula sem fonte. */
const SEM_FONTE = "—indisponível";

function textosDoStatus(status: HTMLElement) {
  const textos: string[] = [];
  const observador = new MutationObserver(() =>
    textos.push(status.textContent ?? ""),
  );
  observador.observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return { textos, parar: () => observador.disconnect() };
}

describe("T205 — sem empresa ativa (D-6)", () => {
  it("orienta a escolher a empresa e não consulta nada", async () => {
    render(<Tela empresaAtiva={null} />);
    expect(
      screen.getByText(
        "Escolha uma empresa ativa no menu para ver o Dashboard.",
      ),
    ).toBeVisible();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(listarColaboradores).not.toHaveBeenCalled();
    expect(listarMovimentacoes).not.toHaveBeenCalled();
    // Nenhum controle sem dado por trás.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("T205 — leitura e resumo (E-2)", () => {
  it("lê os contadores (uma página mínima) e as movimentações efetivadas de cada tipo", async () => {
    render(<Tela />);
    await lido();
    expect(servidorDosContadores).toHaveBeenCalledTimes(1);
    expect(servidorDosContadores).toHaveBeenCalledWith({ tamanhoPagina: 1 });
    // T207 — e as pessoas ativas de hoje, uma página de 100 (são 10).
    expect(servidorDosAtivos).toHaveBeenCalledTimes(1);
    expect(servidorDosAtivos).toHaveBeenCalledWith({
      grupo: "ativos",
      pagina: 1,
      tamanhoPagina: 100,
    });
    const consultas = vi.mocked(listarMovimentacoes).mock.calls.map(([q]) => q);
    expect(consultas).toEqual(
      expect.arrayContaining([
        {
          tipo: "admissao",
          status: "efetivada",
          pagina: 1,
          tamanhoPagina: 100,
        },
        {
          tipo: "desligamento",
          status: "efetivada",
          pagina: 1,
          tamanhoPagina: 100,
        },
      ]),
    );
  });

  it("pessoas hoje × vínculos no ano, até hoje; diferença e frase com os mesmos números", async () => {
    render(<Tela />);
    await lido();
    const ativos = indicador("Colaboradores ativos");
    expect(ativos).toHaveTextContent("12 pessoas");
    expect(ativos).toHaveTextContent(
      "Com vínculo ativo hoje · +3 vínculos em 2026, até hoje",
    );
    const hoje = bloco("Pessoas hoje");
    const situacao = (rotulo: RegExp) =>
      within(hoje).getByText(rotulo).closest("a, div") as HTMLElement;
    expect(situacao(/^Ativas$/)).toHaveTextContent("12");
    expect(situacao(/^Em admissão$/)).toHaveTextContent("2");
    expect(situacao(/^Desligadas$/)).toHaveTextContent("3");
    expect(situacao(/^Inativas/)).toHaveTextContent(
      "Inativasem admissão ou desligadas3",
    );
    const totais =
      bloco(SERIE).querySelector<HTMLElement>(".dashboard__totais")!;
    const total = (rotulo: string) =>
      within(totais).getByText(rotulo).closest("li") as HTMLElement;
    expect(total("Entradas")).toHaveTextContent("4");
    expect(total("Saídas")).toHaveTextContent("1");
    expect(total("Saldo")).toHaveTextContent("+3");
    expect(
      within(bloco("Resumo")).getByText(
        "Hoje há 12 pessoas ativas e 2 pessoas em admissão. Em 2026, até hoje, houve 4 admissões e 1 desligamento de vínculos efetivados.",
      ),
    ).toBeVisible();
  });

  it("zero é zero; sem pessoas nem movimentações, frases próprias e nada de gráfico", async () => {
    servidorDosContadores.mockResolvedValue(
      listagem(
        contadores({
          ativos: 0,
          emAdmissao: 0,
          ativosPorTipo: {
            clt: 0,
            estagio: 0,
            pj: 0,
            temporario: 0,
            outro_controlado: 0,
          },
        }),
      ),
    );
    servidorDeMovimentacoes([]);
    render(<Tela />);
    await lido();
    expect(indicador("Colaboradores ativos")).toHaveTextContent("0 pessoas");
    expect(
      within(bloco("Pessoas ativas por tipo de vínculo")).getByText(
        "Nenhuma pessoa ativa hoje.",
      ),
    ).toBeVisible();
    const serie = bloco(SERIE);
    expect(
      within(serie.querySelector<HTMLElement>(".dashboard__totais")!)
        .getByText("Saldo")
        .closest("li"),
    ).toHaveTextContent("0");
    expect(
      within(serie).getByText(
        "Nenhuma entrada ou saída efetivada em 2026, até hoje.",
      ),
    ).toBeVisible();
    expect(within(serie).queryByRole("table")).toBeNull();
  });
});

describe("T205 — atalhos (D-5)", () => {
  it("ativos, em admissão, desligadas e cada tipo abrem a listagem filtrada; admissões e desligamentos não são links", async () => {
    const onAbrirListagem = vi.fn();
    render(<Tela onAbrirListagem={onAbrirListagem} />);
    await lido();
    const ativosEstado = { ...ESTADO_INICIAL_DA_LISTAGEM, aba: "ativos" };
    const doCard = within(indicador("Colaboradores ativos")).getByRole("link", {
      name: "Abrir na listagem de Colaboradores: pessoas ativas",
    });
    expect(doCard).toHaveAttribute(
      "href",
      rotaDaListagem(ativosEstado as never),
    );
    fireEvent.click(doCard);
    expect(onAbrirListagem).toHaveBeenLastCalledWith(ativosEstado);

    const hoje = bloco("Pessoas hoje");
    fireEvent.click(within(hoje).getByRole("link", { name: /^Ativas/ }));
    expect(onAbrirListagem).toHaveBeenLastCalledWith(ativosEstado);
    fireEvent.click(within(hoje).getByRole("link", { name: /^Em admissão/ }));
    expect(onAbrirListagem).toHaveBeenLastCalledWith({
      ...ESTADO_INICIAL_DA_LISTAGEM,
      aba: "em-admissao",
    });
    fireEvent.click(within(hoje).getByRole("link", { name: /^Desligadas/ }));
    expect(onAbrirListagem).toHaveBeenLastCalledWith({
      ...ESTADO_INICIAL_DA_LISTAGEM,
      aba: "desligados",
    });
    // "Inativas" não tem aba própria na listagem: não é link.
    expect(within(hoje).queryByRole("link", { name: /^Inativas/ })).toBeNull();

    const tipos = bloco("Pessoas ativas por tipo de vínculo");
    const links = within(tipos).getAllByRole("link");
    // Só os tipos com alguém: CLT e Estágio.
    expect(links.map((l) => l.textContent)).toEqual([
      "CLT: 9 pessoas (75%)",
      "Estágio: 3 pessoas (25%)",
    ]);
    fireEvent.click(links[1]!);
    expect(onAbrirListagem).toHaveBeenLastCalledWith({
      ...ESTADO_INICIAL_DA_LISTAGEM,
      aba: "ativos",
      tipo: "estagio",
    });
    expect(links[1]).toHaveAttribute(
      "href",
      rotaDaListagem({
        ...ESTADO_INICIAL_DA_LISTAGEM,
        aba: "ativos",
        tipo: "estagio",
      }),
    );

    expect(within(bloco(SERIE)).queryByRole("link")).toBeNull();
  });

  it("clique com modificador (nova aba) não é interceptado", async () => {
    const onAbrirListagem = vi.fn();
    render(<Tela onAbrirListagem={onAbrirListagem} />);
    await lido();
    fireEvent.click(
      within(bloco("Pessoas hoje")).getByRole("link", { name: /^Ativas/ }),
      { ctrlKey: true },
    );
    expect(onAbrirListagem).not.toHaveBeenCalled();
  });
});

describe("T205 — série mensal (E-4)", () => {
  it("tabela: meses do ano até o atual, entradas, saídas e total; ativos no fim e turnover sem fonte", async () => {
    render(<Tela vistas={EM_TABELA} />);
    await lido();
    const serie = bloco(SERIE);
    const tabela = within(serie).getByRole("table", {
      name: "Quadro de colaboradores por mês, em 2026, até hoje",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent));
    expect(linhas[0]).toEqual([
      "Mês",
      "Ativos no fim",
      "Entradas",
      "Saídas",
      "Turnover",
    ]);
    // Janeiro a novembro (até hoje), mais o total.
    expect(linhas.slice(1, -1).map((l) => l[0])).toEqual([
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
    ]);
    expect(linhas[1]).toEqual(["Janeiro", SEM_FONTE, "2", "0", SEM_FONTE]);
    expect(linhas[3]).toEqual(["Março", SEM_FONTE, "1", "1", SEM_FONTE]);
    expect(linhas[11]).toEqual(["Novembro", SEM_FONTE, "1", "0", SEM_FONTE]);
    expect(linhas.at(-1)).toEqual(["Total", SEM_FONTE, "4", "1", SEM_FONTE]);
    // Sem fonte nunca vira zero nem porcentagem.
    expect(tabela.textContent).not.toMatch(/%/);
    // Na vista de tabela, nenhum gráfico.
    expect(within(serie).queryByRole("group", { name: /por mês/ })).toBeNull();
  });

  it("gráfico: um botão por mês até hoje; barras ocultas ao leitor; nenhuma tabela", async () => {
    render(<Tela />);
    await lido();
    const serie = bloco(SERIE);
    const meses = within(serie).getByRole("group", { name: /por mês/ });
    expect(within(meses).getAllByRole("button")).toHaveLength(11);
    for (const barras of serie.querySelectorAll(".dashboard__barras")) {
      expect(barras).toHaveAttribute("aria-hidden", "true");
    }
    expect(within(serie).queryByRole("table")).toBeNull();
  });

  it("ano passado: os doze meses, sem 'até hoje'", async () => {
    servidorDeMovimentacoes([
      mov("admissao", "2025-12-31"),
      mov("desligamento", "2025-02-01"),
    ]);
    render(<Tela ano={2025} vistas={EM_TABELA} />);
    await lido();
    const tabela = screen.getByRole("table", {
      name: "Quadro de colaboradores por mês, em 2025",
    });
    expect(within(tabela).getAllByRole("row")).toHaveLength(1 + 12 + 1);
    expect(indicador("Colaboradores ativos")).toHaveTextContent(
      "vínculos em 2025",
    );
    expect(indicador("Colaboradores ativos")).not.toHaveTextContent("até hoje");
  });

  it("teto excedido: nenhum número de admissões ou desligamentos, aviso claro e anúncio", async () => {
    vi.mocked(listarMovimentacoes).mockImplementation(async (q = {}) => ({
      itens: Array.from({ length: 100 }, () =>
        mov(q.tipo as TipoMovimentacao, "2026-06-01"),
      ),
      pagina: q.pagina ?? 1,
      tamanhoPagina: 100,
      total: 9999,
    }));
    render(<Tela />);
    await lido();
    expect(screen.getByRole("status")).toHaveTextContent(
      "passa do limite desta visão",
    );
    expect(within(bloco("Resumo")).queryByText(/^Hoje há/)).toBeNull();
    const serie = bloco(SERIE);
    expect(serie.querySelector(".dashboard__totais")).toBeNull();
    // Sem números, sem menu de ações (nada a trocar nem a exportar).
    expect(within(serie).queryByRole("button", { name: /^Ações/ })).toBeNull();
    expect(serie).toHaveTextContent(
      "Admissões e desligamentos: mais de 2.000 vínculos efetivados em 2026, até hoje, o limite desta visão. Os números não são exibidos para não mostrar um total incompleto.",
    );
    expect(within(serie).queryByRole("table")).toBeNull();
    // Sem saldo do ano no card; os totais de pessoas (outra fonte) continuam.
    expect(indicador("Colaboradores ativos")).not.toHaveTextContent(
      /vínculos em 2026/,
    );
    expect(indicador("Colaboradores ativos")).toHaveTextContent("12 pessoas");
  });
});

describe("T205 — falhas e nova tentativa", () => {
  it("nova tentativa dos totais, troca de aba antes da resposta: o foco não pula para um título depois", async () => {
    servidorDosContadores.mockRejectedValueOnce(new Error("rede"));
    const { rerender } = render(<Tela aba="visao-geral" />);
    await lido();
    const pendente = adiada<ListagemColaboradoresApi>();
    servidorDosContadores.mockReturnValueOnce(pendente.promessa);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo os totais de pessoas",
      }),
    );
    rerender(<Tela aba="movimentacao" />);
    await act(async () => {
      pendente.resolver(listagem(contadores()));
    });
    const atualizar = screen.getByRole("button", { name: "Atualizar" });
    act(() => atualizar.focus());
    // A aba Pessoas tem o título que a nova tentativa pediria (mesmo id).
    rerender(<Tela aba="pessoas" />);
    await assentar();
    expect(atualizar).toHaveFocus();
    rerender(<Tela aba="visao-geral" />);
    await assentar();
    expect(atualizar).toHaveFocus();
  });

  it("nova tentativa dos totais e troca direta para Pessoas (que tem o mesmo título): o foco não é levado", async () => {
    servidorDosContadores.mockRejectedValueOnce(new Error("rede"));
    const { rerender } = render(<Tela aba="visao-geral" />);
    await lido();
    const pendente = adiada<ListagemColaboradoresApi>();
    servidorDosContadores.mockReturnValueOnce(pendente.promessa);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo os totais de pessoas",
      }),
    );
    rerender(<Tela aba="pessoas" />);
    const atualizar = screen.getByRole("button", { name: "Atualizar" });
    act(() => atualizar.focus());
    await act(async () => {
      pendente.resolver(listagem(contadores()));
    });
    await assentar();
    // O título "Pessoas ativas por tipo de vínculo" existe nesta aba, mas o
    // pedido foi feito na Visão Geral: o foco fica onde a pessoa está.
    expect(atualizar).toHaveFocus();
  });

  it("nova tentativa da série com o alvo ausente na aba atual: o pedido de foco é descartado", async () => {
    vi.mocked(listarMovimentacoes).mockRejectedValueOnce(new Error("rede"));
    const { rerender } = render(<Tela aba="movimentacao" />);
    await lido();
    servidorDeMovimentacoes(MOVIMENTACOES_PADRAO());
    const pendente = adiada<ResultadoPaginado<MovimentacaoApi>>();
    vi.mocked(listarMovimentacoes).mockReturnValueOnce(pendente.promessa);
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar de novo as movimentações" }),
    );
    rerender(<Tela aba="pessoas" />);
    await act(async () => {
      pendente.resolver({ itens: [], pagina: 1, tamanhoPagina: 100, total: 0 });
    });
    const atualizar = screen.getByRole("button", { name: "Atualizar" });
    act(() => atualizar.focus());
    rerender(<Tela aba="movimentacao" />);
    await assentar();
    expect(atualizar).toHaveFocus();
  });

  it("totais de pessoas falham: alerta e nova tentativa no lugar; a série continua; sucesso leva o foco ao Resumo", async () => {
    servidorDosContadores.mockRejectedValueOnce(new Error("rede"));
    render(<Tela />);
    await lido();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os totais de pessoas.",
    );
    expect(indicador("Colaboradores ativos")).not.toHaveTextContent(/\d/);
    expect(
      within(bloco("Pessoas ativas por tipo de vínculo")).queryByRole("link"),
    ).toBeNull();
    expect(within(bloco("Pessoas hoje")).queryByRole("link")).toBeNull();
    expect(bloco(SERIE).querySelector(".dashboard__totais")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo os totais de pessoas",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Resumo" }),
      ).toHaveFocus(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(indicador("Colaboradores ativos")).toHaveTextContent("12 pessoas");
    expect(screen.getByRole("status")).toHaveTextContent(
      /Totais de pessoas lidos em/,
    );
  });

  it("série falha: alerta e nova tentativa; o resumo não mostra admissões nem desligamentos; sucesso leva o foco à série", async () => {
    vi.mocked(listarMovimentacoes).mockRejectedValueOnce(new Error("rede"));
    render(<Tela />);
    await lido();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as movimentações de 2026.",
    );
    expect(within(bloco("Resumo")).queryByText(/^Hoje há/)).toBeNull();
    expect(bloco(SERIE).querySelector(".dashboard__totais")).toBeNull();
    servidorDeMovimentacoes(MOVIMENTACOES_PADRAO());
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo as movimentações",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: SERIE }),
      ).toHaveFocus(),
    );
    expect(
      within(bloco(SERIE)).getByRole("group", { name: /por mês/ }),
    ).toBeVisible();
  });

  it("as três leituras falham: três alertas, nenhum número, nada anunciado como lido", async () => {
    servidorDosContadores.mockRejectedValueOnce(new Error("rede"));
    servidorDosAtivos.mockRejectedValueOnce(new Error("rede"));
    vi.mocked(listarMovimentacoes).mockRejectedValue(new Error("rede"));
    render(<Tela />);
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(3));
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(screen.queryByText(/^Hoje há/)).toBeNull();
  });
});

describe("T205 — período, atualização, atrasos (E-1, E-5)", () => {
  it("ano anterior, seletor e próximo ano: o shell recebe o ano; no limite, o botão não faz nada (sem perder o foco)", async () => {
    const onTrocarAno = vi.fn();
    const { rerender } = render(<Tela onTrocarAno={onTrocarAno} />);
    await lido();
    const proximo = screen.getByRole("button", { name: "Próximo ano" });
    expect(proximo).toHaveAttribute("aria-disabled", "true");
    expect(proximo).not.toBeDisabled();
    proximo.focus();
    fireEvent.click(proximo);
    expect(onTrocarAno).not.toHaveBeenCalled();
    expect(proximo).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(onTrocarAno).toHaveBeenLastCalledWith(2025);
    fireEvent.change(screen.getByRole("combobox", { name: "Ano" }), {
      target: { value: "2021" },
    });
    expect(onTrocarAno).toHaveBeenLastCalledWith(2021);
    const opcoes = within(screen.getByRole("combobox", { name: "Ano" }))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opcoes[0]).toBe("2026 (até hoje)");
    expect(opcoes.at(-1)).toBe("2000");

    rerender(<Tela ano={2000} onTrocarAno={onTrocarAno} />);
    onTrocarAno.mockClear();
    const anterior = screen.getByRole("button", { name: "Ano anterior" });
    expect(anterior).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(anterior);
    expect(onTrocarAno).not.toHaveBeenCalled();
    await assentar();
  });

  it("'Atualizar' relê tudo, ignora clique repetido durante a leitura e anuncia uma vez por leitura", async () => {
    render(<Tela />);
    await lido();
    const status = screen.getByRole("status");
    const visto = textosDoStatus(status);
    const leitura = adiada<ListagemColaboradoresApi>();
    servidorDosContadores.mockReturnValueOnce(leitura.promessa);
    const atualizar = screen.getByRole("button", { name: "Atualizar" });
    fireEvent.click(atualizar);
    const emCurso = screen.getByRole("button", { name: "Atualizando…" });
    expect(emCurso).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(emCurso);
    expect(servidorDosContadores).toHaveBeenCalledTimes(2);
    expect(servidorDosAtivos).toHaveBeenCalledTimes(2);
    // A série do mesmo ano fica na tela durante a releitura.
    expect(
      within(bloco(SERIE)).getByRole("group", { name: /por mês/ }),
    ).toBeVisible();
    await act(async () => {
      leitura.resolver(listagem(contadores({ ativos: 13 })));
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Atualizar" })).toBeVisible(),
    );
    visto.parar();
    expect(visto.textos.filter((t) => /lido em/.test(t))).toHaveLength(1);
    expect(indicador("Colaboradores ativos")).toHaveTextContent("13 pessoas");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(status);
  });

  it("outro ano com a leitura anterior pendente: a resposta atrasada é descartada", async () => {
    const atrasada = adiada<ResultadoPaginado<MovimentacaoApi>>();
    vi.mocked(listarMovimentacoes).mockReturnValueOnce(atrasada.promessa);
    const { rerender } = render(<Tela ano={2026} vistas={EM_TABELA} />);
    rerender(<Tela ano={2025} vistas={EM_TABELA} />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /Dashboard de 2025 lido em/,
      ),
    );
    await act(async () => {
      atrasada.resolver({
        itens: Array.from({ length: 5 }, () => mov("admissao", "2026-01-05")),
        pagina: 1,
        tamanhoPagina: 100,
        total: 5,
      });
    });
    const tabela = screen.getByRole("table", { name: /em 2025$/ });
    // Os números são os de 2025: doze meses, 1 admissão (30/12) e nenhum
    // desligamento — não os de 2026 que chegaram atrasados.
    const corpo = within(tabela).getAllByRole("rowgroup")[1]!;
    expect(within(corpo).getAllByRole("row")).toHaveLength(12);
    expect(within(tabela).getAllByRole("row").at(-1)).toHaveTextContent(
      `Total${SEM_FONTE}10${SEM_FONTE}`,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/2025/);
  });

  it("B3 — ao trocar de ano, nenhum desenho mostra os números do ano anterior com o rótulo do ano novo", async () => {
    const { rerender } = render(<Tela ano={2026} />);
    await lido();
    // A leitura de 2025 fica pendente: só o que a tela desenha ao receber
    // o ano novo importa.
    vi.mocked(listarMovimentacoes).mockReturnValue(new Promise(() => {}));
    const tela = document.querySelector<HTMLElement>(".dashboard")!;
    const observador = new MutationObserver(() => {});
    observador.observe(tela, {
      characterData: true,
      characterDataOldValue: true,
      childList: true,
      subtree: true,
    });
    rerender(<Tela ano={2025} />);
    const registros = observador.takeRecords();
    observador.disconnect();
    // Texto existente reescrito para 2025 (legenda, frase, notas dos
    // cartões) = os dados de 2026 com o rótulo de 2025.
    const reescritos = registros
      .filter((r) => r.type === "characterData")
      .map((r) => (r.target as Text).data)
      .filter((texto) => /2025/.test(texto));
    expect(reescritos).toEqual([]);
    // E, enquanto 2025 não chega, nada de vínculos na tela.
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/houve/)).toBeNull();
    expect(bloco(SERIE).querySelector(".dashboard__totais")).toBeNull();
    expect(bloco(SERIE)).toHaveTextContent("Carregando…");
    await assentar();
  });

  it("B3 — falha de um ano não aparece rotulada com outro ano", async () => {
    vi.mocked(listarMovimentacoes).mockRejectedValue(new Error("rede"));
    const { rerender } = render(<Tela ano={2026} />);
    await screen.findByText(
      "Não foi possível carregar as movimentações de 2026.",
    );
    vi.mocked(listarMovimentacoes).mockReturnValue(new Promise(() => {}));
    const tela = document.querySelector<HTMLElement>(".dashboard")!;
    const observador = new MutationObserver(() => {});
    observador.observe(tela, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    rerender(<Tela ano={2025} />);
    const registros = observador.takeRecords();
    observador.disconnect();
    // A falha de 2026 não é redesenhada como "… de 2025" em momento algum.
    const reescritos = registros
      .filter((r) => r.type === "characterData")
      .map((r) => (r.target as Text).data)
      .filter((texto) => /2025/.test(texto));
    expect(reescritos).toEqual([]);
    expect(
      screen.queryByText(/Não foi possível carregar as movimentações/),
    ).toBeNull();
    await assentar();
  });

  it("leitura antiga que termina antes da nova não encerra o 'Atualizando…' da nova", async () => {
    const antiga = adiada<ListagemColaboradoresApi>();
    const nova = adiada<ListagemColaboradoresApi>();
    servidorDosContadores
      .mockReturnValueOnce(antiga.promessa)
      .mockReturnValueOnce(nova.promessa);
    const { rerender } = render(<Tela ano={2026} />);
    rerender(<Tela ano={2025} />);
    await act(async () => {
      antiga.resolver(listagem(contadores()));
    });
    expect(
      screen.getByRole("button", { name: /^Atualizando/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent(/lido em/);
    await act(async () => {
      nova.resolver(listagem(contadores()));
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /Dashboard de 2025 lido em/,
    );
  });

  it("outro ano no meio da paginação: a série antiga não pede a página seguinte", async () => {
    const primeira = adiada<ResultadoPaginado<MovimentacaoApi>>();
    vi.mocked(listarMovimentacoes).mockReturnValueOnce(primeira.promessa);
    const { rerender } = render(<Tela ano={2026} />);
    rerender(<Tela ano={2025} />);
    await lido();
    const antes = vi.mocked(listarMovimentacoes).mock.calls.length;
    await act(async () => {
      primeira.resolver({
        itens: Array.from({ length: 100 }, () => mov("admissao", "2026-06-01")),
        pagina: 1,
        tamanhoPagina: 100,
        total: 300,
      });
    });
    expect(vi.mocked(listarMovimentacoes).mock.calls.length).toBe(antes);
  });

  it("desmontagem no meio da paginação: nenhuma página a mais é pedida", async () => {
    const primeira = adiada<ResultadoPaginado<MovimentacaoApi>>();
    vi.mocked(listarMovimentacoes).mockReturnValueOnce(primeira.promessa);
    const { unmount } = render(<Tela />);
    // T207 — quatro séries (uma por tipo de movimentação), a primeira página
    // de cada.
    await waitFor(() => expect(listarMovimentacoes).toHaveBeenCalledTimes(4));
    unmount();
    await act(async () => {
      primeira.resolver({
        itens: Array.from({ length: 100 }, () => mov("admissao", "2026-06-01")),
        pagina: 1,
        tamanhoPagina: 100,
        total: 300,
      });
    });
    expect(listarMovimentacoes).toHaveBeenCalledTimes(4);
  });

  it("desmontagem com a leitura pendente: nada é atualizado depois", async () => {
    const leitura = adiada<ListagemColaboradoresApi>();
    servidorDosContadores.mockReturnValueOnce(leitura.promessa);
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<Tela />);
    unmount();
    await act(async () => {
      leitura.resolver(listagem(contadores()));
    });
    expect(erros).not.toHaveBeenCalled();
    erros.mockRestore();
  });
});

describe("T205 — foco, anúncio e 375 px", () => {
  it("ao abrir sem foco em lugar nenhum, o foco vai ao título; o anúncio da carga vem do único nó de status", async () => {
    render(<Tela />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando o Dashboard de 2026…",
    );
    await lido();
    expect(screen.getByRole("status")).toHaveTextContent(
      /^Dashboard de 2026 lido em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}\.$/,
    );
    expect(screen.getByText(/^Dados lidos em /)).toBeVisible();
  });

  it("CSS: colunas que encolhem, tabela rolando no próprio quadro, alvos de 44 px", () => {
    const css = readFileSync(
      "src/screens/dashboard/DashboardScreen.css",
      "utf8",
    );
    const regra = (seletor: string) => {
      const inicio = css.indexOf(`${seletor} {`);
      expect(inicio).toBeGreaterThanOrEqual(0);
      return css.slice(inicio, css.indexOf("}", inicio));
    };
    expect(regra(".dashboard")).toContain(
      "grid-template-columns: minmax(0, 1fr)",
    );
    expect(regra(".dashboard__indicadores")).toContain(
      "minmax(min(14rem, 100%), 1fr)",
    );
    expect(regra(".dashboard__quadro")).toContain("overflow-x: auto");
    // T207 — as abas rolam dentro da própria faixa, com alvos de 44 px.
    expect(regra(".dashboard__abas")).toContain("overflow-x: auto");
    for (const seletor of [
      ".dashboard__aba",
      ".dashboard__link",
      ".dashboard__situacao",
      ".dashboard__como-botao",
    ]) {
      expect(regra(seletor)).toContain("min-height: var(--touch-target)");
    }
    expect(regra(".dashboard__tipo")).toContain(
      "min-height: var(--touch-target)",
    );
    expect(regra(".dashboard__ano select")).toContain(
      "min-height: var(--touch-target)",
    );
  });
});

describe("T207 — limite da série escrito", () => {
  it("o texto do limite é o próprio limite", () => {
    expect(LIMITE_DA_SERIE).toBe(2000);
    expect(LIMITE_DA_SERIE_TEXTO).toBe("2.000");
  });
});

describe("T207 — abas do Dashboard (V-3)", () => {
  const abas = () =>
    within(
      screen.getByRole("tablist", { name: "Seções do Dashboard" }),
    ).getAllByRole("tab");

  it("cinco abas, na ordem da rota; a aberta é selecionada e é a única na tabulação", async () => {
    render(<Tela aba="movimentacao" />);
    await lido();
    expect(abas().map((a) => a.textContent)).toEqual([
      "Visão Geral",
      "Pessoas",
      "Movimentação",
      "Remuneração",
      "Clima e saúde",
    ]);
    const selecionadas = abas().filter(
      (a) => a.getAttribute("aria-selected") === "true",
    );
    expect(selecionadas.map((a) => a.textContent)).toEqual(["Movimentação"]);
    expect(abas().map((a) => a.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
    const painel = screen.getByRole("tabpanel");
    expect(painel).toHaveAccessibleName("Movimentação");
    expect(abas()[2]).toHaveAttribute("aria-controls", painel.id);
  });

  it("clique (Enter e Espaço, no botão) pede a aba ao shell; a aberta não pede nada", async () => {
    const onTrocarAba = vi.fn();
    render(<Tela onTrocarAba={onTrocarAba} />);
    await lido();
    fireEvent.click(abas()[0]!);
    expect(onTrocarAba).not.toHaveBeenCalled();
    fireEvent.click(abas()[3]!);
    expect(onTrocarAba).toHaveBeenLastCalledWith("remuneracao");
  });

  it("setas, Home e End movem o foco entre as abas (com volta), sem trocar de aba", async () => {
    const onTrocarAba = vi.fn();
    render(<Tela onTrocarAba={onTrocarAba} />);
    await lido();
    const [visao, pessoas, , , clima] = abas();
    visao!.focus();
    fireEvent.keyDown(visao!, { key: "ArrowRight" });
    expect(pessoas).toHaveFocus();
    fireEvent.keyDown(pessoas!, { key: "End" });
    expect(clima).toHaveFocus();
    fireEvent.keyDown(clima!, { key: "ArrowRight" });
    expect(visao).toHaveFocus();
    fireEvent.keyDown(visao!, { key: "ArrowLeft" });
    expect(clima).toHaveFocus();
    fireEvent.keyDown(clima!, { key: "Home" });
    expect(visao).toHaveFocus();
    expect(onTrocarAba).not.toHaveBeenCalled();
  });

  it("trocar de aba não remonta as abas: o foco continua na aba acionada", async () => {
    const { rerender } = render(<Tela aba="visao-geral" />);
    await lido();
    const pessoas = abas()[1]!;
    pessoas.focus();
    rerender(<Tela aba="pessoas" />);
    expect(abas()[1]).toBe(pessoas);
    expect(pessoas).toHaveFocus();
    expect(pessoas).toHaveAttribute("aria-selected", "true");
  });
});

describe("T207 — Visão Geral: cards honestos (V-2) e Como calculamos (V-5)", () => {
  it.each([
    ["Turnover no ano", "Requer definição"],
    ["Absenteísmo", "Indisponível no Evolli"],
    ["Custo por pessoa", "Indisponível no Evolli"],
  ])(
    "%s: traço oculto do leitor, selo em texto, explicação, e nenhum número, porcentagem ou ação",
    async (rotulo, selo) => {
      render(<Tela />);
      await lido();
      const card = indicador(rotulo);
      expect(within(card).getByText("—")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(within(card).getByText(selo)).toBeVisible();
      expect(card.textContent).not.toMatch(/\d/);
      expect(card.textContent).not.toMatch(/%/);
      expect(within(card).queryByRole("link")).toBeNull();
      expect(within(card).queryByRole("button")).toBeNull();
      expect(card.querySelector("svg, canvas, img")).toBeNull();
    },
  );

  it("os cards sem dado ficam no mesmo nível dos reais (mesma lista de indicadores)", async () => {
    render(<Tela />);
    await lido();
    const lista = bloco("Indicadores").querySelector("ul")!;
    expect(
      within(lista)
        .getAllByRole("article")
        .map((a) => a.querySelector("h3")?.textContent),
    ).toEqual([
      "Colaboradores ativos",
      "Turnover no ano",
      "Absenteísmo",
      "Custo por pessoa",
    ]);
  });

  it("Como calculamos abre e fecha, com o assunto no nome, só nos indicadores reais", async () => {
    render(<Tela />);
    await lido();
    const botao = within(indicador("Colaboradores ativos")).getByRole(
      "button",
      { name: /^Como calculamos\s*:\s*colaboradores ativos$/ },
    );
    const painel = document.getElementById(
      botao.getAttribute("aria-controls")!,
    )!;
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(painel).not.toBeVisible();
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(painel).toBeVisible();
    expect(painel).toHaveTextContent("vínculo principal ativo hoje");
    fireEvent.click(botao);
    expect(painel).not.toBeVisible();
    const nomes = screen
      .getAllByRole("button", { name: /^Como calculamos/ })
      .map((b) => b.textContent);
    expect(nomes).toEqual([
      "Como calculamos: colaboradores ativos",
      // T207 — no quadro, o botão de informação ao lado do título.
      "iComo calculamos: quadro de colaboradores",
      "Como calculamos: distribuição do time",
      "Como calculamos: tempo de casa",
      "Como calculamos: pessoas hoje",
    ]);
  });

  it("o quadro diz que ativos no fim e turnover não têm fonte, e que entradas e saídas são movimentações", async () => {
    render(<Tela />);
    await lido();
    expect(bloco(SERIE)).toHaveTextContent(
      "Ativos no fim e turnover ainda não têm fonte no Evolli e aparecem como “—”. Entradas e saídas são movimentações efetivadas, contadas em vínculos.",
    );
  });
});

describe("T207 — abas Pessoas e Movimentação", () => {
  it("Pessoas: só a distribuição por tipo de vínculo, com tabela equivalente", async () => {
    render(<Tela aba="pessoas" />);
    await lido();
    const painel = screen.getByRole("tabpanel");
    const tabela = within(painel).getByRole("table", {
      name: "Pessoas ativas hoje por tipo de vínculo",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent));
    expect(linhas[1]).toEqual(["CLT", "9", "75%"]);
    expect(linhas[2]).toEqual(["Estágio", "3", "25%"]);
    expect(linhas.at(-1)).toEqual(["Total", "12", "100%"]);
    // Nada além do tipo de vínculo nesta fatia.
    expect(within(painel).queryByText("Turnover")).toBeNull();
    expect(within(painel).queryByText(/admiss/i)).toBeNull();
  });

  it("Movimentação: os quatro tipos efetivados por mês, com totais e tabela", async () => {
    servidorDeMovimentacoes([
      ...MOVIMENTACOES_PADRAO(),
      mov("transferencia_organizacional", "2026-02-15"),
      mov("transferencia_organizacional", "2026-02-20"),
      mov("mudanca_cargo", "2026-05-02"),
    ]);
    render(<Tela aba="movimentacao" />);
    await lido();
    const painel = screen.getByRole("tabpanel");
    const totais = [...painel.querySelectorAll(".dashboard__total")].map(
      (t) => t.textContent,
    );
    expect(totais).toEqual([
      "Admissões4",
      "Desligamentos1",
      "Transferências2",
      "Mudanças de cargo1",
    ]);
    const tabela = within(painel).getByRole("table", {
      name: "Admissões, desligamentos, transferências e mudanças de cargo de vínculos efetivados por mês, em 2026, até hoje",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent));
    expect(linhas[0]).toEqual([
      "Mês",
      "Admissões",
      "Desligamentos",
      "Transferências",
      "Mudanças de cargo",
      "Diferença",
    ]);
    expect(linhas[2]).toEqual(["Fevereiro", "0", "0", "2", "0", "0"]);
    expect(linhas.at(-1)).toEqual(["Total", "4", "1", "2", "1", "+3"]);
    const tipos = vi
      .mocked(listarMovimentacoes)
      .mock.calls.map(([q]) => q?.tipo);
    expect(new Set(tipos)).toEqual(
      new Set([
        "admissao",
        "desligamento",
        "mudanca_cargo",
        "transferencia_organizacional",
      ]),
    );
  });

  it("Movimentação: um tipo acima do teto esconde só o quadro, com o nome dele no aviso", async () => {
    vi.mocked(listarMovimentacoes).mockImplementation(async (q = {}) =>
      q.tipo === "mudanca_cargo"
        ? {
            itens: Array.from({ length: 100 }, () =>
              mov("mudanca_cargo", "2026-06-01"),
            ),
            pagina: q.pagina ?? 1,
            tamanhoPagina: 100,
            total: 9999,
          }
        : { itens: [], pagina: 1, tamanhoPagina: 100, total: 0 },
    );
    render(<Tela aba="movimentacao" />);
    await lido();
    const painel = screen.getByRole("tabpanel");
    expect(painel).toHaveTextContent(
      "Mudanças de cargo: mais de 2.000 vínculos",
    );
    expect(within(painel).queryByRole("table")).toBeNull();
  });
});

describe("T207 — Remuneração e Clima e saúde: sem dado no Evolli", () => {
  it.each([
    ["remuneracao", "Remuneração", /folha, salários nem benefícios/],
    ["clima-e-saude", "Clima e saúde", /pesquisas de clima nem dados de saúde/],
  ] as const)(
    "%s: rota real, estado próprio, nenhum número e nenhuma consulta",
    async (aba, titulo, texto) => {
      render(<Tela aba={aba} />);
      const painel = screen.getByRole("tabpanel");
      expect(
        within(painel).getByRole("heading", { level: 2, name: titulo }),
      ).toBeVisible();
      expect(within(painel).getByText("Indisponível no Evolli")).toBeVisible();
      expect(painel).toHaveTextContent(texto);
      expect(painel.textContent).not.toMatch(/\d/);
      expect(within(painel).queryByRole("link")).toBeNull();
      expect(within(painel).queryByRole("button")).toBeNull();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(listarColaboradores).not.toHaveBeenCalled();
      expect(listarMovimentacoes).not.toHaveBeenCalled();
      // Sem leitura, sem Atualizar nem anúncio de carga.
      expect(screen.queryByRole("button", { name: /Atualiz/ })).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent("");
    },
  );

  it("de uma aba sem dado para uma com dado: a leitura começa", async () => {
    const { rerender } = render(<Tela aba="remuneracao" />);
    expect(listarColaboradores).not.toHaveBeenCalled();
    rerender(<Tela aba="pessoas" />);
    await lido();
    expect(servidorDosContadores).toHaveBeenCalledTimes(1);
  });

  it("sair para uma aba sem dado no meio da leitura: a resposta atrasada não anuncia nada", async () => {
    const leitura = adiada<ListagemColaboradoresApi>();
    servidorDosContadores.mockReturnValueOnce(leitura.promessa);
    const { rerender } = render(<Tela aba="visao-geral" />);
    rerender(<Tela aba="clima-e-saude" />);
    await act(async () => {
      leitura.resolver(listagem(contadores()));
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});

describe("T207 — Visão Geral ampliada: ordem e quadro mensal", () => {
  it("blocos na ordem: resumo, indicadores, movimentação, time, eNPS, quem é o time, tempo de casa, pessoas", async () => {
    render(<Tela />);
    await lido();
    const painel = screen.getByRole("tabpanel");
    expect(
      within(painel)
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent),
    ).toEqual([
      "Resumo",
      "Indicadores",
      SERIE,
      "Distribuição do time",
      "eNPS",
      "Quem é o time",
      "Tempo de casa",
      "Pessoas hoje",
      "Pessoas ativas por tipo de vínculo",
    ]);
  });

  it("quadro mensal: pessoas ativas hoje, totais do ano e nota discreta — sem série de ativos por mês", async () => {
    render(<Tela />);
    await lido();
    const serie = bloco(SERIE);
    expect(serie.querySelector(".dashboard__destaque")).toHaveTextContent(
      "12 pessoas ativas hoje",
    );
    expect(serie).toHaveTextContent("ainda não têm fonte no Evolli");
    // Nenhum número de ativos por mês, em nenhuma vista.
    expect(serie.textContent).not.toMatch(/ativos no fim\s*\d/i);
  });

  it("uma pessoa ativa: singular no destaque", async () => {
    servidorDosContadores.mockResolvedValue(
      listagem(contadores({ ativos: 1 })),
    );
    render(<Tela />);
    await lido();
    expect(
      bloco(SERIE).querySelector(".dashboard__destaque"),
    ).toHaveTextContent("1 pessoa ativa hoje");
  });
});

describe("T207 — posição do painel do mês (nunca sobre a coluna, nunca além da borda)", () => {
  it("em todo ano de 1 a 12 meses e todo mês: o lado com mais espaço, a largura limitada a ele", () => {
    for (let meses = 1; meses <= 12; meses += 1) {
      for (let i = 0; i < meses; i += 1) {
        const p = posicaoDoPainel(i, meses);
        if (meses === 1) {
          expect(p).toEqual({ lado: "abaixo", espaco: 1 });
          continue;
        }
        const direita = meses - i - 1;
        const esquerda = i;
        if (p.lado === "depois") {
          expect(p.espaco).toBe(direita);
          expect(direita).toBeGreaterThanOrEqual(esquerda);
          // Começa depois da coluna e termina até a borda direita.
          expect((i + 1 + p.espaco) / meses).toBeLessThanOrEqual(1);
        } else {
          expect(p.lado).toBe("antes");
          expect(p.espaco).toBe(esquerda);
          expect(esquerda).toBeGreaterThan(direita);
          // Termina antes da coluna e começa a partir da borda esquerda.
          expect((i - p.espaco) / meses).toBeGreaterThanOrEqual(0);
        }
        expect(p.espaco).toBeGreaterThan(0);
      }
    }
  });

  it("janeiro do ano corrente (um mês só): o painel abre abaixo das barras, dentro do quadro", async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12));
    servidorDeMovimentacoes([mov("admissao", "2026-01-10")]);
    render(<Tela />);
    await lido();
    const janeiro = within(bloco(SERIE)).getByRole("button", {
      name: "Janeiro de 2026",
    });
    fireEvent.mouseEnter(janeiro);
    const dica = screen.getByRole("tooltip");
    expect(dica).toHaveClass("dashboard__dica-mes--abaixo");
    expect(dica.style.getPropertyValue("--espaco")).toBe("1");
  });

  it("junho num ano de 11 meses: à direita, com o espaço que sobra (5 colunas), sem passar da borda", async () => {
    render(<Tela />);
    await lido();
    fireEvent.mouseEnter(
      within(bloco(SERIE)).getByRole("button", { name: "Junho de 2026" }),
    );
    const dica = screen.getByRole("tooltip");
    expect(dica).toHaveClass("dashboard__dica-mes--depois");
    expect(dica.style.getPropertyValue("--coluna")).toBe("5");
    expect(dica.style.getPropertyValue("--espaco")).toBe("5");
    expect(dica.style.getPropertyValue("--colunas")).toBe("11");
  });
});

describe("T207 — gráfico mensal interativo", () => {
  const grupoDosMeses = () =>
    within(bloco(SERIE)).getByRole("group", {
      name: "Entradas e saídas por mês — use as setas para percorrer os meses",
    });
  const mes = (nome: string) =>
    within(grupoDosMeses()).getByRole("button", { name: nome });
  const dica = () => screen.queryByRole("tooltip");

  it("um botão por mês com nome e ano; uma parada de Tab só (o mês mais recente)", async () => {
    render(<Tela />);
    await lido();
    const botoes = within(grupoDosMeses()).getAllByRole("button");
    expect(botoes.map((b) => b.textContent)).toContain("JanJaneiro de 2026");
    expect(botoes.filter((b) => b.tabIndex === 0)).toEqual([
      mes("Novembro de 2026"),
    ]);
    expect(dica()).toBeNull();
  });

  it("foco abre o painel do mês com os números reais, ligado por aria-describedby", async () => {
    render(<Tela />);
    await lido();
    const janeiro = mes("Janeiro de 2026");
    act(() => janeiro.focus());
    const painel = dica()!;
    expect(painel).toHaveTextContent(
      "Janeiro de 2026Entradas2Saídas0Saldo+2Ativos no fimindisponívelTurnoverindisponível",
    );
    expect(janeiro).toHaveAttribute("aria-describedby", painel.id);
    expect(janeiro).toHaveAccessibleDescription(
      /Janeiro de 2026.*Entradas.*2.*Saídas.*0.*Saldo.*\+2.*Ativos no fim.*indisponível.*Turnover.*indisponível/,
    );
    // Primeira metade do ano: o painel fica à direita da coluna.
    expect(painel).toHaveClass("dashboard__dica-mes--depois");
    // Nenhuma região viva: só o mês focado é descrito.
    expect(painel).not.toHaveAttribute("aria-live");
    expect(painel.closest("[aria-live]")).toBeNull();
  });

  it("setas, Home e End percorrem os meses sem dar a volta; o painel acompanha; a parada de Tab vai junto", async () => {
    render(<Tela />);
    await lido();
    const status = screen.getByRole("status");
    const anunciado = status.textContent;
    const janeiro = mes("Janeiro de 2026");
    act(() => janeiro.focus());
    fireEvent.keyDown(janeiro, { key: "ArrowLeft" });
    expect(janeiro).toHaveFocus();
    fireEvent.keyDown(janeiro, { key: "ArrowRight" });
    const fevereiro = mes("Fevereiro de 2026");
    expect(fevereiro).toHaveFocus();
    expect(dica()).toHaveTextContent("Fevereiro de 2026");
    expect(janeiro).not.toHaveAttribute("aria-describedby");
    expect(fevereiro.tabIndex).toBe(0);
    expect(janeiro.tabIndex).toBe(-1);
    fireEvent.keyDown(fevereiro, { key: "End" });
    const novembro = mes("Novembro de 2026");
    expect(novembro).toHaveFocus();
    expect(dica()).toHaveTextContent("Novembro de 2026Entradas1");
    // Segunda metade: à esquerda da coluna, dentro do quadro.
    expect(dica()).toHaveClass("dashboard__dica-mes--antes");
    fireEvent.keyDown(novembro, { key: "ArrowRight" });
    expect(novembro).toHaveFocus();
    fireEvent.keyDown(novembro, { key: "Home" });
    expect(janeiro).toHaveFocus();
    // Percorrer meses não mexe no anúncio da página.
    expect(status.textContent).toBe(anunciado);
  });

  it("Escape fecha o painel e o foco fica no mês; Escape de novo não faz nada", async () => {
    render(<Tela />);
    await lido();
    const marco = mes("Março de 2026");
    act(() => marco.focus());
    expect(dica()).not.toBeNull();
    fireEvent.keyDown(marco, { key: "Escape" });
    expect(dica()).toBeNull();
    expect(marco).toHaveFocus();
    expect(marco).not.toHaveAttribute("aria-describedby");
    fireEvent.keyDown(marco, { key: "Escape" });
    expect(dica()).toBeNull();
    expect(marco).toHaveFocus();
  });

  it("ponteiro: entrar abre o mês; sair do gráfico fecha — ou volta ao mês focado", async () => {
    render(<Tela />);
    await lido();
    const grafico = bloco(SERIE).querySelector<HTMLElement>(
      ".dashboard__grafico",
    )!;
    fireEvent.mouseEnter(mes("Abril de 2026"));
    expect(dica()).toHaveTextContent("Abril de 2026");
    fireEvent.mouseLeave(grafico);
    expect(dica()).toBeNull();

    act(() => mes("Março de 2026").focus());
    fireEvent.mouseEnter(mes("Junho de 2026"));
    expect(dica()).toHaveTextContent("Junho de 2026");
    fireEvent.mouseLeave(grafico);
    expect(dica()).toHaveTextContent("Março de 2026");
  });

  it("aberto pelo ponteiro, com o foco em outro lugar: Escape fecha o painel do mês (1.4.13) e o foco não sai", async () => {
    render(<Tela />);
    await lido();
    const resumo = screen.getByRole("heading", { level: 2, name: "Resumo" });
    act(() => resumo.focus());
    fireEvent.mouseEnter(mes("Abril de 2026"));
    expect(dica()).not.toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(dica()).toBeNull();
    expect(resumo).toHaveFocus();
  });

  it("foco sai do gráfico: o painel fecha", async () => {
    render(<Tela />);
    await lido();
    act(() => mes("Março de 2026").focus());
    expect(dica()).not.toBeNull();
    act(() =>
      screen.getByRole("heading", { level: 2, name: "Resumo" }).focus(),
    );
    expect(dica()).toBeNull();
  });

  it("na aba Movimentação, os quatro tipos no painel e a diferença, como na tabela", async () => {
    render(<Tela aba="movimentacao" />);
    await lido();
    const painel = screen.getByRole("tabpanel");
    const botao = within(painel).getByRole("button", {
      name: "Janeiro de 2026",
    });
    act(() => botao.focus());
    const d = dica()!;
    expect(d).toHaveTextContent("Admissões2");
    expect(d).toHaveTextContent("Mudanças de cargo0");
    expect(d).toHaveTextContent("Diferença+2");
  });
});

describe("T207 — Distribuição do time e Tempo de casa", () => {
  it.each(["pessoas", "movimentacao"] as const)(
    "%s: as pessoas ativas não são lidas (só a Visão Geral as usa), nem em Atualizar",
    async (aba) => {
      render(<Tela aba={aba} />);
      await lido();
      fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
      await lido();
      await assentar();
      expect(servidorDosAtivos).not.toHaveBeenCalled();
    },
  );

  it("chegar à Visão Geral por outra aba lê as pessoas ativas uma vez; voltar não lê de novo", async () => {
    const { rerender } = render(<Tela aba="pessoas" />);
    await lido();
    expect(servidorDosAtivos).not.toHaveBeenCalled();
    rerender(<Tela aba="visao-geral" />);
    await waitFor(() =>
      expect(bloco("Distribuição do time")).toHaveTextContent(
        "10 pessoas ativas",
      ),
    );
    expect(servidorDosAtivos).toHaveBeenCalledTimes(1);
    rerender(<Tela aba="movimentacao" />);
    rerender(<Tela aba="visao-geral" />);
    await assentar();
    expect(servidorDosAtivos).toHaveBeenCalledTimes(1);
    expect(bloco("Distribuição do time")).toHaveTextContent(
      "10 pessoas ativas",
    );
  });

  it("sair da Visão Geral no meio da leitura do time: a leitura volta ao retornar, sem misturar", async () => {
    const pendente = adiada<ListagemColaboradoresApi>();
    servidorDosAtivos.mockReturnValueOnce(pendente.promessa);
    const { rerender } = render(<Tela aba="visao-geral" />);
    await waitFor(() => expect(servidorDosAtivos).toHaveBeenCalledTimes(1));
    rerender(<Tela aba="pessoas" />);
    await act(async () => {
      pendente.resolver({
        itens: Array.from({ length: 4 }, (_, i) =>
          ativo(`velho-${i}`, "2020-01-01", "Antigo"),
        ),
        pagina: 1,
        tamanhoPagina: 100,
        total: 4,
        contadores: contadores(),
      });
    });
    rerender(<Tela aba="visao-geral" />);
    await waitFor(() =>
      expect(bloco("Distribuição do time")).toHaveTextContent(
        "10 pessoas ativas",
      ),
    );
    expect(servidorDosAtivos).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Antigo")).toBeNull();
  });

  it("distribuição: só departamento, maior grupo primeiro; pequenos, sem departamento e (se o neutro ficaria com 1 ou 2) o menor departamento juntos e sem nome", async () => {
    render(<Tela />);
    await lido();
    const b = bloco("Distribuição do time");
    expect(b.querySelector(".dashboard__destaque")).toHaveTextContent(
      "10 pessoas ativas",
    );
    // Jurídico (1) e a pessoa sem departamento dariam um neutro de 2: Vendas
    // (o menor departamento exibido) entra nele.
    expect(
      within(b)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Operações5 pessoas · 50%",
      `${GRUPO_NEUTRO_DO_TESTE}5 pessoas · 50%`,
    ]);
    expect(screen.queryByText(/Jurídico/)).toBeNull();
    expect(within(b).queryByText(/Vendas/)).toBeNull();
    // A quantidade de departamentos não aparece (deduziria os pequenos).
    expect(b).not.toHaveTextContent(/\d+ departamentos?/);
    expect(b).toHaveTextContent(
      "Departamentos com menos de 3 pessoas e quem não tem departamento vigente ficam num grupo sem nome; se esse grupo ficaria com 1 ou 2 pessoas, o menor departamento entra nele.",
    );
    // Nenhum nome de pessoa aparece no Dashboard.
    expect(screen.queryByText(/Pessoa sintética/)).toBeNull();
  });

  it("tempo de casa: mediana e faixas; faixa pequena junta à vizinha (nada deduzível pela diferença)", async () => {
    render(<Tela />);
    await lido();
    const b = bloco("Tempo de casa");
    expect(b.querySelector(".dashboard__destaque")).toHaveTextContent(
      "1 ano e 6 meses na mediana",
    );
    // Sem junção haveria "10 anos ou mais: 1" — a pessoa mais antiga.
    expect(
      within(b)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Menos de 1 ano4 pessoas", "1 ano ou mais6 pessoas"]);
    expect(b).not.toHaveTextContent(/menos de 3$/);
    expect(b).toHaveTextContent(
      "Faixa com menos de 3 pessoas se junta à faixa vizinha",
    );
  });

  it("tempo de casa usa o dia de hoje do navegador", async () => {
    vi.setSystemTime(new Date(2027, 4, 9, 12));
    render(<Tela ano={2027} />);
    await lido();
    expect(
      bloco("Tempo de casa").querySelector(".dashboard__destaque"),
    ).toHaveTextContent("2 anos na mediana");
  });

  it("dois departamentos com o mesmo nome: duas linhas, chave pelo id (sem aviso de chave repetida)", async () => {
    const comDepartamento = (id: string, depId: string) => {
      const a = ativo(id, "2025-05-09", "Operações");
      return {
        ...a,
        vinculos: [
          {
            ...a.vinculos[0]!,
            lotacaoVigente: {
              cargo: null,
              departamento: { id: depId, codigo: depId, nome: "Operações" },
            },
          },
        ],
      };
    };
    servidorDeAtivos([
      ...["a1", "a2", "a3"].map((id) => comDepartamento(id, "d-op-norte")),
      ...["b1", "b2", "b3"].map((id) => comDepartamento(id, "d-op-sul")),
    ]);
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<Tela />);
      await lido();
      expect(
        within(bloco("Distribuição do time"))
          .getAllByRole("listitem")
          .map((li) => li.textContent),
      ).toEqual(["Operações3 pessoas · 50%", "Operações3 pessoas · 50%"]);
      escolher("Distribuição do time", "Ver como tabela");
      expect(
        within(bloco("Distribuição do time")).getAllByRole("row"),
      ).toHaveLength(1 + 2 + 1);
      expect(erros.mock.calls.some((c) => /same key/i.test(String(c[0])))).toBe(
        false,
      );
    } finally {
      erros.mockRestore();
    }
  });

  it("menos de 3 pessoas ativas: os dois blocos não exibem nada, por privacidade", async () => {
    servidorDeAtivos(TIME_PADRAO().slice(0, 2));
    render(<Tela />);
    await lido();
    for (const nome of ["Distribuição do time", "Tempo de casa"]) {
      const b = bloco(nome);
      expect(within(b).getByText("Não exibido por privacidade")).toBeVisible();
      expect(within(b).queryByRole("list")).toBeNull();
      expect(within(b).queryByRole("button")).toBeNull();
      expect(b).not.toHaveTextContent("Operações");
    }
  });

  it("mais de 2.000 pessoas ativas: aviso do limite, nenhum número parcial", async () => {
    let pedido = 0;
    servidorDosAtivos.mockImplementation(async () => {
      pedido += 1;
      return {
        itens: Array.from({ length: 100 }, (_, i) =>
          ativo(`x-${pedido}-${i}`, "2025-01-01", "Operações"),
        ),
        pagina: pedido,
        tamanhoPagina: 100,
        total: 5000,
        contadores: contadores(),
      };
    });
    render(<Tela />);
    await lido();
    expect(servidorDosAtivos).toHaveBeenCalledTimes(20);
    for (const nome of ["Distribuição do time", "Tempo de casa"]) {
      const b = bloco(nome);
      expect(b).toHaveTextContent(
        "Mais de 2.000 pessoas ativas: o limite desta visão.",
      );
      expect(within(b).queryByRole("list")).toBeNull();
      expect(b.querySelector(".dashboard__destaque")).toBeNull();
    }
  });

  it("enquanto lê: 'Carregando…' visível, escondido do leitor (o status anuncia)", async () => {
    servidorDosAtivos.mockReturnValue(new Promise(() => {}));
    render(<Tela />);
    const textos = within(bloco("Distribuição do time")).getByText(
      "Carregando…",
    );
    expect(textos).toHaveAttribute("aria-hidden", "true");
    // As outras leituras chegam; a do time continua pendente e o bloco segue
    // em "Carregando…".
    await waitFor(() =>
      expect(bloco(SERIE).querySelector(".dashboard__totais")).not.toBeNull(),
    );
    expect(
      within(bloco("Distribuição do time")).getByText("Carregando…"),
    ).toBeVisible();
  });

  it("leitura falha: um único alerta e uma única nova tentativa; sucesso leva o foco à Distribuição e anuncia", async () => {
    servidorDosAtivos.mockRejectedValueOnce(new Error("rede"));
    render(<Tela />);
    await lido();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as pessoas ativas de hoje.",
    );
    expect(
      screen.getAllByRole("button", { name: /Tentar de novo/ }),
    ).toHaveLength(1);
    expect(
      within(bloco("Distribuição do time")).getByRole("alert"),
    ).toBeVisible();
    // Tempo de casa diz que depende da mesma leitura, sem repetir o alerta.
    expect(bloco("Tempo de casa")).toHaveTextContent(
      "Depende da leitura das pessoas ativas de hoje",
    );
    expect(
      bloco("Tempo de casa").querySelector(".dashboard__faixas"),
    ).toBeNull();
    // O resto do Dashboard segue com os seus números.
    expect(indicador("Colaboradores ativos")).toHaveTextContent("12 pessoas");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo as pessoas ativas de hoje",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Distribuição do time" }),
      ).toHaveFocus(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Distribuição e tempo de casa lidos em/,
    );
    expect(bloco("Tempo de casa")).toHaveTextContent("na mediana");
  });

  it("clique repetido na nova tentativa durante a leitura não pede de novo", async () => {
    servidorDosAtivos.mockRejectedValueOnce(new Error("rede"));
    render(<Tela />);
    await lido();
    const pendente = adiada<ListagemColaboradoresApi>();
    servidorDosAtivos.mockReturnValueOnce(pendente.promessa);
    const tentar = screen.getByRole("button", {
      name: "Tentar de novo as pessoas ativas de hoje",
    });
    fireEvent.click(tentar);
    fireEvent.click(tentar);
    expect(servidorDosAtivos).toHaveBeenCalledTimes(2);
    expect(tentar).toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      pendente.resolver({
        itens: TIME_PADRAO(),
        pagina: 1,
        tamanhoPagina: 100,
        total: 10,
        contadores: contadores(),
      });
    });
    expect(bloco("Distribuição do time")).toHaveTextContent("10 pessoas");
  });

  it("resposta atrasada de uma leitura anterior do time é descartada", async () => {
    const antiga = adiada<ListagemColaboradoresApi>();
    servidorDosAtivos.mockReturnValueOnce(antiga.promessa);
    const { rerender } = render(<Tela ano={2026} />);
    rerender(<Tela ano={2025} />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /Dashboard de 2025 lido em/,
      ),
    );
    expect(bloco("Distribuição do time")).toHaveTextContent(
      "10 pessoas ativas",
    );
    await act(async () => {
      antiga.resolver({
        itens: Array.from({ length: 4 }, (_, i) =>
          ativo(`velho-${i}`, "2020-01-01", "Antigo"),
        ),
        pagina: 1,
        tamanhoPagina: 100,
        total: 4,
        contadores: contadores(),
      });
    });
    expect(bloco("Distribuição do time")).toHaveTextContent(
      "10 pessoas ativas",
    );
    expect(screen.queryByText("Antigo")).toBeNull();
  });

  it("desmontagem no meio da leitura do time: nenhuma página a mais, nada atualizado", async () => {
    const primeira = adiada<ListagemColaboradoresApi>();
    servidorDosAtivos.mockReturnValueOnce(primeira.promessa);
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<Tela />);
    await waitFor(() => expect(servidorDosAtivos).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      primeira.resolver({
        itens: Array.from({ length: 100 }, (_, i) =>
          ativo(`p-${i}`, "2025-01-01", "Operações"),
        ),
        pagina: 1,
        tamanhoPagina: 100,
        total: 300,
        contadores: contadores(),
      });
    });
    expect(servidorDosAtivos).toHaveBeenCalledTimes(1);
    expect(erros).not.toHaveBeenCalled();
    erros.mockRestore();
  });
});

describe("T207 — eNPS e Quem é o time: indisponíveis", () => {
  it.each([
    ["eNPS", /não tem pesquisas internas/],
    ["Quem é o time", /dados pessoais restritos/],
  ])(
    "%s: selo em texto, explicação, nenhum número, gráfico ou ação",
    async (titulo, texto) => {
      render(<Tela />);
      await lido();
      const b = bloco(titulo);
      expect(within(b).getByText("Indisponível no Evolli")).toBeVisible();
      expect(b).toHaveTextContent(texto);
      expect(b.textContent).not.toMatch(/\d/);
      expect(b.textContent).not.toMatch(/%/);
      expect(within(b).queryByRole("button")).toBeNull();
      expect(within(b).queryByRole("link")).toBeNull();
      expect(b.querySelector("svg, canvas, img, ul, table")).toBeNull();
    },
  );
});

describe("T207 — Visão Geral em 375 px (CSS)", () => {
  const css = () =>
    readFileSync("src/screens/dashboard/DashboardScreen.css", "utf8");
  /** Todas as declarações de um seletor exato, somadas. */
  const regra = (seletor: string) => {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [
      ...css().matchAll(new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`, "g")),
    ]
      .map((m) => m[2])
      .join("\n");
  };

  it("painel do mês: dentro do quadro (absoluto, não fixo), camada baixa, largura limitada ao espaço do lado escolhido", () => {
    const dica = regra(".dashboard__dica-mes");
    expect(dica).toMatch(/position:\s*absolute/);
    expect(dica).not.toMatch(/position:\s*fixed/);
    expect(dica).toMatch(/z-index:\s*2;/);
    expect(dica).toMatch(
      /max-width:\s*min\(\s*16rem,\s*calc\(var\(--espaco\) \/ var\(--colunas\) \* 100% - var\(--space-xxs\)\)\s*\)/,
    );
    // Um mês só: no fluxo, abaixo das colunas (sem cobrir a coluna).
    const abaixo = regra(".dashboard__dica-mes--abaixo");
    expect(abaixo).toMatch(/position:\s*static/);
    expect(abaixo).toMatch(/max-width:\s*100%/);
    expect(dica).toMatch(/pointer-events:\s*none/);
    expect(regra(".dashboard__area-grafico")).toMatch(/position:\s*relative/);
    // Depois da coluna: começa na borda direita dela (coluna + 1).
    expect(regra(".dashboard__dica-mes--depois")).toMatch(
      /left:\s*calc\(\(var\(--coluna\) \+ 1\) \/ var\(--colunas\) \* 100%\)/,
    );
    // Antes da coluna: termina na borda esquerda dela.
    expect(regra(".dashboard__dica-mes--antes")).toMatch(
      /right:\s*calc\(\(var\(--colunas\) - var\(--coluna\)\) \/ var\(--colunas\) \* 100%\)/,
    );
  });

  it("grade e quadro em uma coluna que encolhe; faixas quebram em duas linhas no celular", () => {
    expect(regra(".dashboard__grade")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(regra(".dashboard__quadro-topo")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(css()).toMatch(
      /@media \(max-width: 40rem\)\s*\{\s*\.dashboard__faixa\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;/,
    );
    expect(regra(".dashboard__grupo-nome")).toMatch(
      /overflow-wrap:\s*anywhere/,
    );
  });
});

// ---------------------------------------------------------------------------
// T207 — refino: título e informação do quadro, menu de ações, vistas,
// CSV e PDF reais, e os mesmos números em todas as formas.
// ---------------------------------------------------------------------------

const acoesDo = (nome: string) =>
  screen.getByRole("button", { name: `Ações: ${nome}` });

function escolher(nomeDoBloco: string, acao: string) {
  fireEvent.click(acoesDo(nomeDoBloco));
  fireEvent.click(screen.getByRole("menuitem", { name: acao }));
}

/** Captura o arquivo baixado: conteúdo (com o BOM), nome e tipo. */
async function capturarDownload(acao: () => void) {
  const original = {
    criar: URL.createObjectURL,
    revogar: URL.revokeObjectURL,
  };
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return "blob:sintetico";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  const nomes: string[] = [];
  const clique = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      nomes.push(this.download);
    });
  try {
    acao();
  } finally {
    clique.mockRestore();
  }
  const blob = blobs[0]!;
  const bytes = await new Promise<ArrayBuffer>((ok) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result as ArrayBuffer);
    leitor.readAsArrayBuffer(blob);
  });
  URL.createObjectURL = original.criar;
  URL.revokeObjectURL = original.revogar;
  return {
    texto: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
    nome: nomes[0],
    tipo: blob.type,
    downloads: nomes.length,
  };
}

const linhasDoCsv = (texto: string) =>
  texto
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((l) => l.length > 0)
    .map((l) => l.split(";"));

describe("T207 — Quadro de colaboradores: título, subtítulo e informação", () => {
  const info = () =>
    screen.getByRole("button", {
      name: "Como calculamos: quadro de colaboradores",
    });
  const painelDaInfo = () =>
    document.getElementById(info().getAttribute("aria-controls")!)!;

  it("título e subtítulo do quadro; informação fechada, ligada ao painel", async () => {
    render(<Tela />);
    await lido();
    const quadro = bloco(SERIE);
    expect(
      within(quadro).getByRole("heading", { level: 2, name: SERIE }),
    ).toBeVisible();
    expect(quadro).toHaveTextContent(
      "Pessoas ativas no fim de cada mês e quem entrou e saiu",
    );
    expect(info()).toHaveAttribute("aria-expanded", "false");
    expect(painelDaInfo()).not.toBeVisible();
  });

  it("foco abre, Escape fecha e o foco fica no botão; foco fora fecha", async () => {
    render(<Tela />);
    await lido();
    act(() => info().focus());
    expect(info()).toHaveAttribute("aria-expanded", "true");
    expect(painelDaInfo()).toBeVisible();
    fireEvent.keyDown(info(), { key: "Escape" });
    expect(info()).toHaveAttribute("aria-expanded", "false");
    expect(painelDaInfo()).not.toBeVisible();
    expect(info()).toHaveFocus();

    act(() => {
      info().blur();
      info().focus();
    });
    expect(painelDaInfo()).toBeVisible();
    act(() =>
      screen.getByRole("heading", { level: 2, name: "Resumo" }).focus(),
    );
    expect(painelDaInfo()).not.toBeVisible();
  });

  it("aberto pelo ponteiro, com o foco em outro lugar: Escape fecha (1.4.13) e o foco não sai de onde estava", async () => {
    render(<Tela />);
    await lido();
    const resumo = screen.getByRole("heading", { level: 2, name: "Resumo" });
    act(() => resumo.focus());
    fireEvent.mouseEnter(info().parentElement!);
    expect(painelDaInfo()).toBeVisible();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(painelDaInfo()).not.toBeVisible();
    expect(resumo).toHaveFocus();
    // Fixado pelo clique, também fecha.
    fireEvent.click(info());
    act(() => resumo.focus());
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(painelDaInfo()).not.toBeVisible();
    expect(resumo).toHaveFocus();
  });

  it("pressionar o botão e soltar fora (sem clique) não impede o foco pelo teclado de abrir depois", async () => {
    render(<Tela />);
    await lido();
    fireEvent.pointerDown(info());
    fireEvent.mouseDown(info());
    act(() =>
      screen.getByRole("heading", { level: 2, name: "Resumo" }).focus(),
    );
    act(() => info().focus());
    expect(info()).toHaveAttribute("aria-expanded", "true");
    expect(painelDaInfo()).toBeVisible();
  });

  it("foco e clique pelo teclado: o primeiro Enter fixa, o segundo fecha", async () => {
    render(<Tela />);
    await lido();
    act(() => info().focus());
    fireEvent.click(info());
    expect(painelDaInfo()).toBeVisible();
    fireEvent.click(info());
    expect(painelDaInfo()).not.toBeVisible();
    expect(info()).toHaveFocus();
  });

  it("ponteiro: passar abre e sair fecha; clique fixa; clique de novo ou clique fora fecham", async () => {
    render(<Tela />);
    await lido();
    const raiz = info().parentElement!;
    fireEvent.mouseEnter(raiz);
    expect(painelDaInfo()).toBeVisible();
    fireEvent.mouseLeave(raiz);
    expect(painelDaInfo()).not.toBeVisible();

    fireEvent.mouseEnter(raiz);
    fireEvent.mouseDown(info());
    fireEvent.click(info());
    fireEvent.mouseLeave(raiz);
    expect(painelDaInfo()).toBeVisible();
    fireEvent.click(info());
    expect(painelDaInfo()).not.toBeVisible();

    fireEvent.mouseDown(info());
    fireEvent.click(info());
    expect(painelDaInfo()).toBeVisible();
    fireEvent.mouseDown(document.body);
    expect(painelDaInfo()).not.toBeVisible();
  });

  it("o painel explica só o que existe: entradas e saídas reais; ativos no fim e turnover aguardam fonte — sem região viva nem anúncio", async () => {
    render(<Tela />);
    await lido();
    const status = screen.getByRole("status");
    const antes = status.textContent;
    act(() => info().focus());
    const painel = painelDaInfo();
    expect(painel).toHaveTextContent("Como calculamos");
    expect(painel).toHaveTextContent(
      "Entradas: admissões efetivadas com vigência no mês",
    );
    expect(painel).toHaveTextContent("Saídas: desligamentos efetivados");
    expect(painel).toHaveTextContent(
      "Ativos no fim e turnover aguardam fonte e definição",
    );
    expect(painel).toHaveTextContent("nunca como zero");
    expect(painel.textContent).not.toMatch(/%|÷|média de ativos/);
    expect(painel).not.toHaveAttribute("aria-live");
    expect(painel.closest("[aria-live]")).toBeNull();
    expect(painel).not.toHaveAttribute("role");
    expect(status.textContent).toBe(antes);
  });
});

describe("T207 — menu de ações do quadro", () => {
  it("botão de menu com nome e estado; abrir leva o foco à primeira ação, com descrição", async () => {
    render(<Tela />);
    await lido();
    const botao = acoesDo(SERIE);
    expect(botao).toHaveAttribute("aria-haspopup", "menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: `Ações: ${SERIE}` });
    const itens = within(menu).getAllByRole("menuitem");
    expect(
      itens.map(
        (i) =>
          document.getElementById(i.getAttribute("aria-labelledby")!)!
            .textContent,
      ),
    ).toEqual(["Ver como tabela", "Baixar CSV", "Exportar PDF"]);
    expect(itens[0]).toHaveFocus();
    expect(itens[2]).toHaveAccessibleDescription(
      "Abre a impressão do navegador; no destino, escolha Salvar como PDF",
    );
    expect(itens.every((i) => i.tabIndex === -1)).toBe(true);
  });

  it("setas (com volta), Home e End; Escape fecha e devolve o foco ao botão", async () => {
    render(<Tela />);
    await lido();
    fireEvent.click(acoesDo(SERIE));
    const [tabela, csv, pdf] = screen.getAllByRole("menuitem");
    fireEvent.keyDown(tabela!, { key: "ArrowDown" });
    expect(csv).toHaveFocus();
    fireEvent.keyDown(csv!, { key: "End" });
    expect(pdf).toHaveFocus();
    fireEvent.keyDown(pdf!, { key: "ArrowDown" });
    expect(tabela).toHaveFocus();
    fireEvent.keyDown(tabela!, { key: "ArrowUp" });
    expect(pdf).toHaveFocus();
    fireEvent.keyDown(pdf!, { key: "Home" });
    expect(tabela).toHaveFocus();
    fireEvent.keyDown(tabela!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(acoesDo(SERIE)).toHaveFocus();
    expect(acoesDo(SERIE)).toHaveAttribute("aria-expanded", "false");
  });

  it("seta para baixo no botão abre na primeira ação; seta para cima, na última", async () => {
    render(<Tela />);
    await lido();
    fireEvent.keyDown(acoesDo(SERIE), { key: "ArrowUp" });
    expect(
      screen.getByRole("menuitem", { name: "Exportar PDF" }),
    ).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Exportar PDF" }), {
      key: "Escape",
    });
    fireEvent.keyDown(acoesDo(SERIE), { key: "ArrowDown" });
    expect(
      screen.getByRole("menuitem", { name: "Ver como tabela" }),
    ).toHaveFocus();
  });

  it("clique fora, Tab e foco fora fecham o menu", async () => {
    render(<Tela />);
    await lido();
    fireEvent.click(acoesDo(SERIE));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(acoesDo(SERIE));
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0]!, { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(acoesDo(SERIE));
    act(() =>
      screen.getByRole("heading", { level: 2, name: "Resumo" }).focus(),
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ao abrir, o menu nunca fica atrás do cabeçalho fixo, mesmo quando ele é mais alto que o normal (barra quebrada no celular)", async () => {
    const cabecalho = document.createElement("header");
    cabecalho.className = "app-shell__topbar";
    document.body.prepend(cabecalho);
    const retangulo = (topo: number, base: number) =>
      ({
        top: topo,
        bottom: base,
        left: 0,
        right: 0,
        width: 0,
        height: base - topo,
        x: 0,
        y: topo,
        toJSON: () => ({}),
      }) as DOMRect;
    const medir = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this === cabecalho) return retangulo(0, 180);
        if (this.getAttribute("role") === "menu") return retangulo(128, 330);
        if (this.classList.contains("dashboard__botao-acoes")) {
          return retangulo(100, 144);
        }
        return retangulo(0, 0);
      });
    const rolar = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    try {
      render(<Tela />);
      await lido();
      fireEvent.click(acoesDo(SERIE));
      // O botão (100) e o menu ficam abaixo de 180 + 8: a página sobe 88.
      expect(rolar).toHaveBeenCalledWith({ top: -88 });
    } finally {
      medir.mockRestore();
      rolar.mockRestore();
      cabecalho.remove();
    }
  });

  it("menu sem caixa desenhada (sem layout): a página não rola", async () => {
    const rolar = vi.spyOn(window, "scrollBy");
    try {
      render(<Tela />);
      await lido();
      fireEvent.click(acoesDo(SERIE));
      expect(screen.getByRole("menu")).toBeVisible();
      expect(rolar).not.toHaveBeenCalled();
    } finally {
      rolar.mockRestore();
    }
  });

  it("menu já visível abaixo do cabeçalho: a página não rola", async () => {
    const rolar = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const medir = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({
            top: 300,
            bottom: 450,
            left: 0,
            right: 0,
            width: 0,
            height: 150,
            x: 0,
            y: 300,
            toJSON: () => ({}),
          }) as DOMRect,
      );
    try {
      render(<Tela />);
      await lido();
      fireEvent.click(acoesDo(SERIE));
      expect(rolar).not.toHaveBeenCalled();
    } finally {
      medir.mockRestore();
      rolar.mockRestore();
    }
  });

  it("clicar no botão com o menu aberto fecha o menu", async () => {
    render(<Tela />);
    await lido();
    fireEvent.click(acoesDo(SERIE));
    fireEvent.click(acoesDo(SERIE));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Ver como tabela e Ver como gráfico: mesma ação, rótulo pela vista; foco volta ao botão; anúncio curto", async () => {
    render(<Tela />);
    await lido();
    escolher(SERIE, "Ver como tabela");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(acoesDo(SERIE)).toHaveFocus();
    expect(within(bloco(SERIE)).getByRole("table")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Quadro de colaboradores em tabela.",
    );
    fireEvent.click(acoesDo(SERIE));
    expect(
      screen.getByRole("menuitem", { name: "Ver como gráfico" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Ver como tabela" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver como gráfico" }));
    expect(within(bloco(SERIE)).queryByRole("table")).toBeNull();
    expect(
      within(bloco(SERIE)).getByRole("group", { name: /por mês/ }),
    ).toBeVisible();
  });

  it("vista controlada por quem monta: avisa a troca e mostra o que recebe", async () => {
    const onTrocarVista = vi.fn();
    const { rerender } = render(
      <Tela onTrocarVista={onTrocarVista} vistas={{}} />,
    );
    await lido();
    escolher(SERIE, "Ver como tabela");
    expect(onTrocarVista).toHaveBeenCalledWith("quadro", "tabela");
    // Quem monta ainda não trocou: continua gráfico.
    expect(within(bloco(SERIE)).queryByRole("table")).toBeNull();
    rerender(<Tela onTrocarVista={onTrocarVista} vistas={EM_TABELA} />);
    expect(within(bloco(SERIE)).getByRole("table")).toBeVisible();
  });

  it("a vista escolhida segue ao trocar de ano (a leitura nova é desenhada nela)", async () => {
    const { rerender } = render(<Tela ano={2026} />);
    await lido();
    escolher(SERIE, "Ver como tabela");
    rerender(<Tela ano={2025} />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /Dashboard de 2025 lido em/,
      ),
    );
    expect(
      screen.getByRole("table", {
        name: "Quadro de colaboradores por mês, em 2025",
      }),
    ).toBeVisible();
  });

  it("só blocos com dado real têm menu: quadro, distribuição e tempo de casa — nunca cards nem blocos indisponíveis", async () => {
    render(<Tela />);
    await lido();
    expect(
      screen
        .getAllByRole("button", { name: /^Ações: / })
        .map((b) => b.textContent),
    ).toEqual([
      "Ações: Quadro de colaboradores",
      "Ações: Distribuição do time",
      "Ações: Tempo de casa",
    ]);
    for (const nome of ["eNPS", "Quem é o time"]) {
      expect(within(bloco(nome)).queryByRole("button")).toBeNull();
    }
    expect(
      within(bloco("Indicadores")).queryByRole("button", { name: /^Ações/ }),
    ).toBeNull();
  });

  it("carregando ou com falha: sem menu no quadro", async () => {
    vi.mocked(listarMovimentacoes).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<Tela />);
    expect(
      within(bloco(SERIE)).queryByRole("button", { name: /^Ações/ }),
    ).toBeNull();
    unmount();
    vi.mocked(listarMovimentacoes).mockRejectedValue(new Error("rede"));
    render(<Tela />);
    await waitFor(() =>
      expect(
        within(bloco(SERIE)).getByText(
          "Não foi possível carregar as movimentações de 2026.",
        ),
      ).toBeVisible(),
    );
    expect(
      within(bloco(SERIE)).queryByRole("button", { name: /^Ações/ }),
    ).toBeNull();
  });
});

describe("T207 — os mesmos números no gráfico, no painel, na tabela e no CSV", () => {
  it("cada mês: painel do gráfico = linha da tabela = linha do CSV; nenhuma linha a mais", async () => {
    render(<Tela />);
    await lido();
    // Gráfico: o painel de cada mês.
    const doGrafico: string[][] = [];
    const grupo = within(bloco(SERIE)).getByRole("group", { name: /por mês/ });
    for (const botao of within(grupo).getAllByRole("button")) {
      act(() => botao.focus());
      const dl = screen.getByRole("tooltip").querySelector("dl")!;
      const valor = (rotulo: string) =>
        [...dl.querySelectorAll("div")]
          .find((d) => d.querySelector("dt")?.textContent === rotulo)!
          .querySelector("dd")!.textContent!;
      doGrafico.push([
        valor("Ativos no fim"),
        valor("Entradas"),
        valor("Saídas"),
        valor("Turnover"),
      ]);
    }
    act(() => (document.activeElement as HTMLElement).blur());

    // Tabela.
    escolher(SERIE, "Ver como tabela");
    const corpo = within(within(bloco(SERIE)).getByRole("table")).getAllByRole(
      "rowgroup",
    )[1]!;
    const daTabela = within(corpo)
      .getAllByRole("row")
      .map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent!));

    // CSV.
    const { texto } = await capturarDownload(() =>
      escolher(SERIE, "Baixar CSV"),
    );
    const doCsv = linhasDoCsv(texto).slice(1);

    expect(doGrafico).toHaveLength(11);
    expect(daTabela).toHaveLength(11);
    expect(doCsv).toHaveLength(11);
    const comoNumero = (v: string) => (/indispon|—/.test(v) ? "sem fonte" : v);
    for (let i = 0; i < 11; i += 1) {
      const g = doGrafico[i]!.map(comoNumero);
      expect(daTabela[i]!.map(comoNumero)).toEqual(g);
      expect(doCsv[i]!.slice(1).map(comoNumero)).toEqual(g);
    }
    // Os números reais da série: janeiro 2/0, março 1/1, novembro 1/0.
    expect(doGrafico[0]).toEqual(["indisponível", "2", "0", "indisponível"]);
    expect(doGrafico[2]!.slice(1, 3)).toEqual(["1", "1"]);
    expect(doGrafico[10]!.slice(1, 3)).toEqual(["1", "0"]);
  });
});

describe("T207 — CSV real do quadro", () => {
  it("arquivo com BOM, ponto e vírgula, cabeçalho claro, um mês por linha até hoje, empresa e ano no nome", async () => {
    render(<Tela />);
    await lido();
    const { texto, nome, tipo, downloads } = await capturarDownload(() =>
      escolher(SERIE, "Baixar CSV"),
    );
    expect(downloads).toBe(1);
    expect(nome).toBe(
      "quadro-de-colaboradores-empresa-sintetica-alfa-2026.csv",
    );
    expect(tipo).toBe("text/csv;charset=utf-8");
    expect(texto.startsWith("\uFEFF")).toBe(true);
    expect(texto.endsWith("\r\n")).toBe(true);
    const linhas = linhasDoCsv(texto);
    expect(linhas[0]).toEqual([
      "Mês",
      "Ativos no fim",
      "Entradas",
      "Saídas",
      "Turnover",
    ]);
    expect(linhas.slice(1).map((l) => l[0])).toEqual([
      "Janeiro de 2026",
      "Fevereiro de 2026",
      "Março de 2026",
      "Abril de 2026",
      "Maio de 2026",
      "Junho de 2026",
      "Julho de 2026",
      "Agosto de 2026",
      "Setembro de 2026",
      "Outubro de 2026",
      "Novembro de 2026",
    ]);
    expect(linhas[1]).toEqual(["Janeiro de 2026", "—", "2", "0", "—"]);
    // Nada inventado: sem total, sem dezembro (ainda não chegou), sem 0% como
    // ausência de dado e sem dado pessoal.
    expect(linhas).toHaveLength(12);
    expect(texto).not.toMatch(/Total|Dezembro|%/);
    expect(texto).not.toMatch(/Pessoa sintética/);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Arquivo quadro-de-colaboradores-empresa-sintetica-alfa-2026.csv baixado.",
    );
  });

  it("ano passado: os doze meses do ano e o ano no nome; na vista de tabela, o mesmo CSV", async () => {
    servidorDeMovimentacoes([
      mov("admissao", "2025-12-31"),
      mov("desligamento", "2025-02-01"),
    ]);
    render(<Tela ano={2025} vistas={EM_TABELA} />);
    await lido();
    const { texto, nome } = await capturarDownload(() =>
      escolher(SERIE, "Baixar CSV"),
    );
    expect(nome).toBe(
      "quadro-de-colaboradores-empresa-sintetica-alfa-2025.csv",
    );
    const linhas = linhasDoCsv(texto);
    expect(linhas).toHaveLength(13);
    expect(linhas[2]).toEqual(["Fevereiro de 2025", "—", "0", "1", "—"]);
    expect(linhas[12]).toEqual(["Dezembro de 2025", "—", "1", "0", "—"]);
  });

  it("outra empresa: o nome dela no arquivo", async () => {
    render(<Tela empresaAtiva={{ nome: "Empresa Sintética Beta" }} />);
    await lido();
    const { nome } = await capturarDownload(() =>
      escolher(SERIE, "Baixar CSV"),
    );
    expect(nome).toBe(
      "quadro-de-colaboradores-empresa-sintetica-beta-2026.csv",
    );
  });
});

describe("T207 — Exportar PDF (impressão do navegador)", () => {
  it("imprime só o quadro, na vista escolhida, e desfaz tudo depois da impressão", async () => {
    render(<Tela vistas={EM_TABELA} />);
    await lido();
    const quadro = bloco(SERIE);
    let naHora: {
      classe: boolean;
      bloco: boolean;
      foraResumo: boolean;
      foraDistribuicao: boolean;
      tabela: boolean;
      cabecalho: string | null;
    } | null = null;
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {
      naHora = {
        classe: document.documentElement.classList.contains(
          "evolli-imprimindo-bloco",
        ),
        bloco: quadro.hasAttribute("data-bloco-impresso"),
        foraResumo: bloco("Resumo").hasAttribute("data-fora-da-impressao"),
        foraDistribuicao: bloco("Distribuição do time")
          .closest(".dashboard__grade")!
          .hasAttribute("data-fora-da-impressao"),
        tabela: within(quadro).queryByRole("table") !== null,
        cabecalho:
          quadro.querySelector(".dashboard__so-impressao")?.textContent ?? null,
      };
    });
    escolher(SERIE, "Exportar PDF");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Impressão aberta só com o Quadro de colaboradores. No destino, escolha Salvar como PDF.",
    );
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    expect(naHora).toEqual({
      classe: true,
      bloco: true,
      foraResumo: true,
      foraDistribuicao: true,
      tabela: true,
      cabecalho:
        "Empresa Sintética Alfa · Quadro de colaboradores · Janeiro a Novembro de 2026",
    });
    // O próprio quadro e o caminho até ele ficam na impressão.
    let no: HTMLElement | null = quadro;
    while (no) {
      expect(no).not.toHaveAttribute("data-fora-da-impressao");
      no = no.parentElement;
    }

    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(document.querySelector("[data-fora-da-impressao]")).toBeNull();
    expect(document.querySelector("[data-bloco-impresso]")).toBeNull();
    expect(
      document.documentElement.classList.contains("evolli-imprimindo-bloco"),
    ).toBe(false);
    imprimir.mockRestore();
  });

  it("navegador sem 'afterprint': desmontar a tela remove as marcações da impressão", async () => {
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    const { unmount } = render(<Tela />);
    await lido();
    escolher(SERIE, "Exportar PDF");
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    expect(document.querySelector("[data-fora-da-impressao]")).not.toBeNull();
    unmount();
    expect(document.querySelector("[data-fora-da-impressao]")).toBeNull();
    expect(document.querySelector("[data-bloco-impresso]")).toBeNull();
    expect(
      document.documentElement.classList.contains("evolli-imprimindo-bloco"),
    ).toBe(false);
    imprimir.mockRestore();
  });

  it("navegador sem 'afterprint': trocar de aba remove as marcações (o Ctrl+P seguinte imprime a página)", async () => {
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    const { rerender } = render(<Tela aba="visao-geral" />);
    await lido();
    escolher(SERIE, "Exportar PDF");
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    rerender(<Tela aba="pessoas" />);
    expect(document.querySelector("[data-fora-da-impressao]")).toBeNull();
    expect(
      document.documentElement.classList.contains("evolli-imprimindo-bloco"),
    ).toBe(false);
    imprimir.mockRestore();
  });

  it("em janeiro do ano corrente, o cabeçalho da impressão diz só o mês (sem 'Janeiro a Janeiro')", async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12));
    servidorDeMovimentacoes([mov("admissao", "2026-01-10")]);
    let cabecalho: string | null = null;
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {
      cabecalho =
        document.querySelector("[data-bloco-impresso] .dashboard__so-impressao")
          ?.textContent ?? null;
    });
    render(<Tela />);
    await lido();
    escolher(SERIE, "Exportar PDF");
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    expect(cabecalho).toBe(
      "Empresa Sintética Alfa · Quadro de colaboradores · Janeiro de 2026",
    );
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    imprimir.mockRestore();
  });

  it("tela desmontada antes de a impressão abrir: nada é impresso nem marcado", async () => {
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    const { unmount } = render(<Tela />);
    await lido();
    escolher(SERIE, "Exportar PDF");
    unmount();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(imprimir).not.toHaveBeenCalled();
    expect(document.querySelector("[data-fora-da-impressao]")).toBeNull();
    imprimir.mockRestore();
  });
});

describe("T207 — Distribuição e Tempo de casa: gráfico, tabela e exportações", () => {
  it("distribuição em tabela: os mesmos grupos do gráfico, com o grupo neutro e sem nome de grupo pequeno", async () => {
    render(<Tela />);
    await lido();
    const doGrafico = within(bloco("Distribuição do time"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    escolher("Distribuição do time", "Ver como tabela");
    const tabela = within(bloco("Distribuição do time")).getByRole("table", {
      name: "Pessoas ativas hoje por departamento",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent));
    expect(linhas).toEqual([
      ["Grupo", "Pessoas", "Percentual"],
      ["Operações", "5", "50%"],
      [GRUPO_NEUTRO_DO_TESTE, "5", "50%"],
      ["Total", "10", "100%"],
    ]);
    expect(doGrafico).toEqual([
      "Operações5 pessoas · 50%",
      `${GRUPO_NEUTRO_DO_TESTE}5 pessoas · 50%`,
    ]);
    expect(
      within(bloco("Distribuição do time")).queryByRole("list"),
    ).toBeNull();
    expect(screen.queryByText(/Jurídico/)).toBeNull();
  });

  it("distribuição em CSV: os mesmos grupos, sem nome de pessoa nem de grupo pequeno", async () => {
    render(<Tela />);
    await lido();
    const { texto, nome } = await capturarDownload(() =>
      escolher("Distribuição do time", "Baixar CSV"),
    );
    expect(nome).toBe("distribuicao-do-time-empresa-sintetica-alfa-hoje.csv");
    expect(linhasDoCsv(texto)).toEqual([
      ["Grupo", "Pessoas", "Percentual"],
      ["Operações", "5", "50%"],
      [GRUPO_NEUTRO_DO_TESTE, "5", "50%"],
    ]);
    expect(texto).not.toMatch(/Jurídico|Pessoa sintética/);
  });

  it("tempo de casa em tabela e em CSV: as mesmas faixas agrupadas do gráfico", async () => {
    render(<Tela />);
    await lido();
    escolher("Tempo de casa", "Ver como tabela");
    const tabela = within(bloco("Tempo de casa")).getByRole("table", {
      name: "Pessoas ativas hoje por tempo de casa",
    });
    expect(
      within(tabela)
        .getAllByRole("row")
        .map((r) =>
          [...r.querySelectorAll("th, td")].map((c) => c.textContent),
        ),
    ).toEqual([
      ["Faixa de tempo de casa", "Pessoas", "Percentual"],
      ["Menos de 1 ano", "4", "40%"],
      ["1 ano ou mais", "6", "60%"],
      ["Total", "10", "100%"],
    ]);
    expect(bloco("Tempo de casa")).toHaveTextContent(
      "1 ano e 6 meses na mediana",
    );
    const { texto } = await capturarDownload(() =>
      escolher("Tempo de casa", "Baixar CSV"),
    );
    expect(linhasDoCsv(texto)).toEqual([
      ["Faixa de tempo de casa", "Pessoas", "Percentual"],
      ["Menos de 1 ano", "4", "40%"],
      ["1 ano ou mais", "6", "60%"],
    ]);
  });

  it("imprimir a distribuição: só ela vai para a impressão", async () => {
    render(<Tela />);
    await lido();
    const alvo = bloco("Distribuição do time");
    let soEla = false;
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {
      soEla =
        alvo.hasAttribute("data-bloco-impresso") &&
        bloco("eNPS").hasAttribute("data-fora-da-impressao") &&
        bloco(SERIE).hasAttribute("data-fora-da-impressao");
    });
    escolher("Distribuição do time", "Exportar PDF");
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    expect(soEla).toBe(true);
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(document.querySelector("[data-fora-da-impressao]")).toBeNull();
    imprimir.mockRestore();
  });

  it("menos de 3 pessoas, teto ou falha: sem menu nos blocos do time", async () => {
    servidorDeAtivos(TIME_PADRAO().slice(0, 2));
    render(<Tela />);
    await lido();
    for (const nome of ["Distribuição do time", "Tempo de casa"]) {
      expect(
        within(bloco(nome)).queryByRole("button", { name: /^Ações/ }),
      ).toBeNull();
    }
  });
});

describe("T207 — refino em 375 px (CSS)", () => {
  const css = () =>
    readFileSync("src/screens/dashboard/DashboardScreen.css", "utf8");
  const regra = (seletor: string) => {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [
      ...css().matchAll(new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`, "g")),
    ]
      .map((m) => m[2])
      .join("\n");
  };

  it("menu: dentro do bloco, abaixo do cabeçalho fixo (camada baixa), largura limitada à tela, alvos de 44 px", () => {
    const menu = regra(".dashboard__menu");
    expect(menu).toMatch(/position:\s*absolute/);
    expect(menu).toMatch(/right:\s*0/);
    expect(menu).toMatch(/z-index:\s*5;/);
    expect(menu).toMatch(/max-width:\s*min\(20rem,\s*calc\(100vw/);
    expect(menu).toMatch(/scroll-margin-top:\s*calc\(var\(--topbar-altura/);
    expect(regra(".dashboard__menu-item")).toMatch(
      /min-height:\s*var\(--touch-target\)/,
    );
    expect(regra(".dashboard__botao-acoes")).toMatch(
      /min-width:\s*var\(--touch-target\)/,
    );
  });

  it("painel de informação: preso ao cabeçalho do bloco, à esquerda, nunca mais largo que o bloco", () => {
    expect(regra(".dashboard__bloco-cabeca")).toMatch(/position:\s*relative/);
    const painel = regra(".dashboard__info-painel");
    expect(painel).toMatch(/position:\s*absolute/);
    expect(painel).toMatch(/left:\s*0/);
    expect(painel).toMatch(/max-width:\s*min\(28rem,\s*100%\)/);
    expect(painel).toMatch(/z-index:\s*4;/);
  });

  it("título da tela fora da vista onde a barra do shell mostra o nome (acima de 640 px); visível abaixo", () => {
    const bloco = css().match(
      /@media \(min-width: 641px\) \{\s*\.dashboard__titulo \{([^}]*)\}/,
    );
    expect(bloco).not.toBeNull();
    expect(bloco![1]).toMatch(/position:\s*absolute/);
    expect(bloco![1]).toMatch(/clip:\s*rect\(0 0 0 0\)/);
    expect(bloco![1]).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    // O mesmo corte do shell: a barra esconde o nome em até 640 px.
    expect(readFileSync("src/app/app-shell.css", "utf8")).toMatch(
      /@media \(max-width: 640px\) \{[^@]*\.app-shell__tela-atual \{\s*display: none;/,
    );
  });

  it("tabela do quadro rola no próprio quadro; impressão esconde menu e informação", () => {
    expect(regra(".dashboard__quadro")).toMatch(/overflow-x:\s*auto/);
    expect(css()).toMatch(
      /\[data-bloco-impresso\] \.dashboard__sem-impressao,[\s\S]*display:\s*none !important/,
    );
    expect(css()).toMatch(
      /\.evolli-imprimindo-bloco \[data-fora-da-impressao\]\s*\{\s*display:\s*none !important;/,
    );
  });
});

describe("T207 — hora da leitura: uma vez só em cada aba", () => {
  /** Os nós visíveis cujo texto próprio fala da leitura. */
  const horasVisiveis = () =>
    [...document.querySelectorAll<HTMLElement>(".dashboard *")]
      .filter((no) => !no.closest(".dashboard__so-leitor"))
      .filter((no) =>
        [...no.childNodes].some(
          (filho) =>
            filho.nodeType === Node.TEXT_NODE &&
            /lidos? em|ainda não lido/i.test(filho.textContent ?? ""),
        ),
      );

  it("Visão Geral: no card do Resumo, com a marca verde-água; nada ao lado de Atualizar", async () => {
    render(<Tela />);
    await lido();
    const horas = horasVisiveis();
    expect(horas.map((no) => no.textContent)).toEqual([
      expect.stringMatching(
        /^Dados lidos em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/,
      ),
    ]);
    expect(bloco("Resumo")).toContainElement(horas[0]!);
    expect(horas[0]).toHaveClass("dashboard__selo--leitura");
    const barra = document.querySelector<HTMLElement>(".dashboard__leitura")!;
    expect(
      within(barra).getByRole("button", { name: "Atualizar" }),
    ).toBeVisible();
    expect(barra.textContent).not.toMatch(/lido/i);
  });

  it("antes da primeira leitura, o card diz que ainda não leu", () => {
    vi.mocked(listarMovimentacoes).mockReturnValue(new Promise(() => {}));
    servidorDosContadores.mockReturnValue(new Promise(() => {}));
    servidorDosAtivos.mockReturnValue(new Promise(() => {}));
    render(<Tela />);
    expect(horasVisiveis().map((no) => no.textContent)).toEqual([
      "Ainda não lido",
    ]);
  });

  it.each(["pessoas", "movimentacao"] as const)(
    "%s (sem Resumo): a hora fica ao lado de Atualizar, uma vez só",
    async (aba) => {
      render(<Tela aba={aba} />);
      await lido();
      const horas = horasVisiveis();
      expect(horas.map((no) => no.textContent)).toEqual([
        expect.stringMatching(/^Lido em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/),
      ]);
      expect(document.querySelector(".dashboard__leitura")!).toContainElement(
        horas[0]!,
      );
    },
  );

  it("CSS: a marca verde-água é decorativa (antes do texto), e o texto não é verde-água", () => {
    const css = readFileSync(
      "src/screens/dashboard/DashboardScreen.css",
      "utf8",
    );
    const antes = css.match(/\n\.dashboard__selo--leitura::before \{([^}]*)\}/);
    expect(antes![1]).toMatch(/content:\s*""/);
    expect(antes![1]).toMatch(/background:\s*var\(--evolli-verde-agua\)/);
    const selo = css.match(/\n\.dashboard__selo--leitura \{([^}]*)\}/);
    expect(selo![1]).not.toMatch(/color:\s*var\(--evolli-verde-agua/);
    // Logo depois do título do card, à esquerda (não empurrado para a borda).
    const topo = css.match(/\n\.dashboard__resumo-topo \{([^}]*)\}/);
    expect(topo![1]).toMatch(/justify-content:\s*flex-start/);
  });
});
