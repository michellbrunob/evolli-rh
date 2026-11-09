/**
 * T205 — tela do Dashboard (D-1 a D-12): o que se prova aqui é a tela —
 * leituras, números, unidades, frase, atalhos, série, teto, estados, foco e
 * anúncios. Rota, histórico, aterrissagem e papéis no shell estão em
 * `App.dashboard.test.tsx` e `AutenticacaoApp.test.tsx`.
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
} from "../../api/movimentacaoClient";
import {
  ESTADO_INICIAL_DA_LISTAGEM,
  rotaDaListagem,
} from "../../app/rotasDoShell";
import { DashboardScreen } from "./DashboardScreen";

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
function mov(
  tipo: "admissao" | "desligamento",
  vigenciaInicio: string,
): MovimentacaoApi {
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
    const resumo = bloco("Resumo");
    const cartao = (rotulo: string) =>
      within(resumo).getByText(rotulo).closest("a, div") as HTMLElement;
    expect(cartao("Pessoas ativas hoje")).toHaveTextContent("12");
    expect(cartao("Pessoas em admissão hoje")).toHaveTextContent("2");
    expect(cartao("Admissões efetivadas")).toHaveTextContent(
      /^Admissões efetivadas4Vínculos, em 2026, até hoje$/,
    );
    expect(cartao("Desligamentos efetivados")).toHaveTextContent(
      /^Desligamentos efetivados1Vínculos, em 2026, até hoje$/,
    );
    expect(cartao("Diferença")).toHaveTextContent("+3");
    expect(
      within(resumo).getByText(
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
    const resumo = bloco("Resumo");
    expect(
      within(resumo).getByText("Pessoas ativas hoje").closest("a"),
    ).toHaveTextContent("0");
    expect(
      within(resumo).getByText("Diferença").closest("div"),
    ).toHaveTextContent("0");
    expect(
      within(bloco("Pessoas ativas por tipo de vínculo")).getByText(
        "Nenhuma pessoa ativa hoje.",
      ),
    ).toBeVisible();
    const serie = bloco("Admissões e desligamentos efetivados por mês");
    expect(
      within(serie).getByText(
        "Nenhuma admissão ou desligamento efetivado em 2026, até hoje.",
      ),
    ).toBeVisible();
    expect(within(serie).queryByRole("table")).toBeNull();
  });
});

describe("T205 — atalhos (D-5)", () => {
  it("ativos, em admissão e cada tipo abrem a listagem filtrada; admissões e desligamentos não são links", async () => {
    const onAbrirListagem = vi.fn();
    render(<Tela onAbrirListagem={onAbrirListagem} />);
    await lido();
    const ativos = screen.getByRole("link", { name: /Pessoas ativas hoje/ });
    const ativosEstado = { ...ESTADO_INICIAL_DA_LISTAGEM, aba: "ativos" };
    expect(ativos).toHaveAttribute(
      "href",
      rotaDaListagem(ativosEstado as never),
    );
    fireEvent.click(ativos);
    expect(onAbrirListagem).toHaveBeenLastCalledWith(ativosEstado);

    fireEvent.click(
      screen.getByRole("link", { name: /Pessoas em admissão hoje/ }),
    );
    expect(onAbrirListagem).toHaveBeenLastCalledWith({
      ...ESTADO_INICIAL_DA_LISTAGEM,
      aba: "em-admissao",
    });

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

    const resumo = bloco("Resumo");
    for (const rotulo of [
      "Admissões efetivadas",
      "Desligamentos efetivados",
      "Diferença",
    ]) {
      expect(within(resumo).getByText(rotulo).closest("a")).toBeNull();
    }
    expect(
      within(bloco("Admissões e desligamentos efetivados por mês")).queryByRole(
        "link",
      ),
    ).toBeNull();
  });

  it("clique com modificador (nova aba) não é interceptado", async () => {
    const onAbrirListagem = vi.fn();
    render(<Tela onAbrirListagem={onAbrirListagem} />);
    await lido();
    fireEvent.click(screen.getByRole("link", { name: /Pessoas ativas hoje/ }), {
      ctrlKey: true,
    });
    expect(onAbrirListagem).not.toHaveBeenCalled();
  });
});

describe("T205 — série mensal (E-4)", () => {
  it("tabela equivalente às barras: meses do ano até o atual, diferença e total; barras ocultas ao leitor", async () => {
    render(<Tela />);
    await lido();
    const serie = bloco("Admissões e desligamentos efetivados por mês");
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
    expect(
      within(bloco("Resumo")).getAllByText("Vínculos, em 2025"),
    ).toHaveLength(2);
  });

  it("teto excedido: nenhum número de admissões ou desligamentos, aviso claro e anúncio", async () => {
    vi.mocked(listarMovimentacoes).mockImplementation(async (q = {}) => ({
      itens: Array.from({ length: 100 }, () =>
        mov(q.tipo as "admissao", "2026-06-01"),
      ),
      pagina: q.pagina ?? 1,
      tamanhoPagina: 100,
      total: 9999,
    }));
    render(<Tela />);
    await lido();
    expect(screen.getByRole("status")).toHaveTextContent(
      "passam do limite desta visão",
    );
    const resumo = bloco("Resumo");
    expect(within(resumo).queryByText("Admissões efetivadas")).toBeNull();
    expect(within(resumo).queryByText("Desligamentos efetivados")).toBeNull();
    expect(within(resumo).queryByText("Diferença")).toBeNull();
    expect(within(resumo).queryByText(/^Hoje há/)).toBeNull();
    const serie = bloco("Admissões e desligamentos efetivados por mês");
    expect(serie).toHaveTextContent(
      "passam de 2.000 vínculos, o limite desta visão. Os números não são exibidos para não mostrar um total incompleto.",
    );
    expect(within(serie).queryByRole("table")).toBeNull();
    // Os totais de pessoas (outra fonte) continuam.
    expect(
      screen.getByRole("link", { name: /Pessoas ativas hoje/ }),
    ).toBeVisible();
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
    expect(
      screen.queryByRole("link", { name: /Pessoas ativas hoje/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", {
        name: "Pessoas ativas por tipo de vínculo",
      }),
    ).toBeNull();
    expect(
      within(bloco("Resumo")).getByText("Admissões efetivadas"),
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
    expect(
      screen.getByRole("link", { name: /Pessoas ativas hoje/ }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Totais de pessoas lidos em/,
    );
  });

  it("série falha: alerta e nova tentativa; o resumo não mostra admissões nem desligamentos; sucesso leva o foco à série", async () => {
    vi.mocked(listarMovimentacoes).mockRejectedValueOnce(new Error("rede"));
    render(<Tela />);
    await lido();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as admissões e os desligamentos de 2026.",
    );
    expect(
      within(bloco("Resumo")).queryByText("Admissões efetivadas"),
    ).toBeNull();
    servidorDeMovimentacoes(MOVIMENTACOES_PADRAO());
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo as admissões e os desligamentos",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Admissões e desligamentos efetivados por mês",
        }),
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
    expect(
      screen.getByRole("link", { name: /Pessoas ativas hoje/ }),
    ).toHaveTextContent("13");
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
    await waitFor(() => expect(listarMovimentacoes).toHaveBeenCalledTimes(2));
    unmount();
    await act(async () => {
      primeira.resolver({
        itens: Array.from({ length: 100 }, () => mov("admissao", "2026-06-01")),
        pagina: 1,
        tamanhoPagina: 100,
        total: 300,
      });
    });
    expect(listarMovimentacoes).toHaveBeenCalledTimes(2);
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
    expect(regra(".dashboard__cartoes")).toContain(
      "minmax(min(11rem, 100%), 1fr)",
    );
    expect(regra(".dashboard__quadro")).toContain("overflow-x: auto");
    expect(regra(".dashboard__cartao")).toContain(
      "min-height: var(--touch-target)",
    );
    expect(regra(".dashboard__tipo")).toContain(
      "min-height: var(--touch-target)",
    );
    expect(regra(".dashboard__ano select")).toContain(
      "min-height: var(--touch-target)",
    );
  });
});
