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
  type ContadoresColaboradoresApi,
  type ListagemColaboradoresApi,
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
  vi.mocked(listarColaboradores).mockResolvedValue(listagem(contadores()));
  servidorDeMovimentacoes(MOVIMENTACOES_PADRAO());
});

afterEach(() => {
  vi.useRealTimers();
});

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
const SERIE = "Movimentação mensal";

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
    expect(listarColaboradores).toHaveBeenCalledTimes(1);
    expect(listarColaboradores).toHaveBeenCalledWith({ tamanhoPagina: 1 });
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
    expect(total("Admissões efetivadas")).toHaveTextContent("4");
    expect(total("Desligamentos efetivados")).toHaveTextContent("1");
    expect(total("Diferença")).toHaveTextContent("+3");
    expect(
      within(bloco("Resumo")).getByText(
        "Hoje há 12 pessoas ativas e 2 pessoas em admissão. Em 2026, até hoje, houve 4 admissões e 1 desligamento de vínculos efetivados.",
      ),
    ).toBeVisible();
  });

  it("zero é zero; sem pessoas nem movimentações, frases próprias e nada de gráfico", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
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
        .getByText("Diferença")
        .closest("li"),
    ).toHaveTextContent("0");
    expect(
      within(serie).getByText(
        "Nenhuma admissão ou desligamento efetivado em 2026, até hoje.",
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
  it("tabela equivalente às barras: meses do ano até o atual, diferença e total; barras ocultas ao leitor", async () => {
    render(<Tela />);
    await lido();
    const serie = bloco(SERIE);
    const tabela = within(serie).getByRole("table", {
      name: "Admissões e desligamentos de vínculos efetivados por mês, em 2026, até hoje",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent));
    expect(linhas[0]).toEqual([
      "Mês",
      "Admissões",
      "Desligamentos",
      "Diferença",
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
    expect(linhas[1]).toEqual(["Janeiro", "2", "0", "+2"]);
    expect(linhas[3]).toEqual(["Março", "1", "1", "0"]);
    expect(linhas[11]).toEqual(["Novembro", "1", "0", "+1"]);
    expect(linhas.at(-1)).toEqual(["Total", "4", "1", "+3"]);
    const grafico = serie.querySelector(".dashboard__grafico")!;
    expect(grafico).toHaveAttribute("aria-hidden", "true");
    expect(grafico.querySelectorAll(".dashboard__coluna")).toHaveLength(11);
  });

  it("ano passado: os doze meses, sem 'até hoje'", async () => {
    servidorDeMovimentacoes([
      mov("admissao", "2025-12-31"),
      mov("desligamento", "2025-02-01"),
    ]);
    render(<Tela ano={2025} />);
    await lido();
    const tabela = screen.getByRole("table", {
      name: "Admissões e desligamentos de vínculos efetivados por mês, em 2025",
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
    expect(within(serie).queryByText("Admissões efetivadas")).toBeNull();
    expect(within(serie).queryByText("Diferença")).toBeNull();
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
  it("totais de pessoas falham: alerta e nova tentativa no lugar; a série continua; sucesso leva o foco ao Resumo", async () => {
    vi.mocked(listarColaboradores).mockRejectedValueOnce(new Error("rede"));
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
    expect(
      within(bloco(SERIE)).getByText("Admissões efetivadas"),
    ).toBeVisible();

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
    expect(within(bloco(SERIE)).queryByText("Admissões efetivadas")).toBeNull();
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
    expect(screen.getByRole("table")).toBeVisible();
  });

  it("as duas leituras falham: dois alertas, nenhum número, nada anunciado como lido", async () => {
    vi.mocked(listarColaboradores).mockRejectedValueOnce(new Error("rede"));
    vi.mocked(listarMovimentacoes).mockRejectedValue(new Error("rede"));
    render(<Tela />);
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
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
  });

  it("'Atualizar' relê tudo, ignora clique repetido durante a leitura e anuncia uma vez por leitura", async () => {
    render(<Tela />);
    await lido();
    const status = screen.getByRole("status");
    const visto = textosDoStatus(status);
    const leitura = adiada<ListagemColaboradoresApi>();
    vi.mocked(listarColaboradores).mockReturnValueOnce(leitura.promessa);
    const atualizar = screen.getByRole("button", { name: "Atualizar" });
    fireEvent.click(atualizar);
    const emCurso = screen.getByRole("button", { name: "Atualizando…" });
    expect(emCurso).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(emCurso);
    expect(listarColaboradores).toHaveBeenCalledTimes(2);
    // A série do mesmo ano fica na tela durante a releitura.
    expect(screen.getByRole("table")).toBeVisible();
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
    const { rerender } = render(<Tela ano={2026} />);
    rerender(<Tela ano={2025} />);
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
      "Total10+1",
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
    expect(screen.queryByText("Admissões efetivadas")).toBeNull();
    expect(bloco(SERIE)).toHaveTextContent("Carregando…");
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
  });

  it("leitura antiga que termina antes da nova não encerra o 'Atualizando…' da nova", async () => {
    const antiga = adiada<ListagemColaboradoresApi>();
    const nova = adiada<ListagemColaboradoresApi>();
    vi.mocked(listarColaboradores)
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
    vi.mocked(listarColaboradores).mockReturnValueOnce(leitura.promessa);
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
    expect(screen.getByText(/^Lido em /)).toBeVisible();
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
    ["Turnover", "Requer definição"],
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
      "Turnover",
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
      "Como calculamos: pessoas hoje",
      "Como calculamos: movimentação mensal",
    ]);
  });

  it("o quadro mensal diz que são eventos do período, não pessoas ativas por mês", async () => {
    render(<Tela />);
    await lido();
    expect(bloco(SERIE)).toHaveTextContent(
      "São eventos do período, contados em vínculos — não o número de pessoas ativas em cada mês.",
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
    expect(listarColaboradores).toHaveBeenCalledTimes(1);
  });

  it("sair para uma aba sem dado no meio da leitura: a resposta atrasada não anuncia nada", async () => {
    const leitura = adiada<ListagemColaboradoresApi>();
    vi.mocked(listarColaboradores).mockReturnValueOnce(leitura.promessa);
    const { rerender } = render(<Tela aba="visao-geral" />);
    rerender(<Tela aba="clima-e-saude" />);
    await act(async () => {
      leitura.resolver(listagem(contadores()));
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
