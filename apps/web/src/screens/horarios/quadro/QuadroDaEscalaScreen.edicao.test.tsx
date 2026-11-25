import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  consultarQuadro,
  gravarDia,
  limparDia,
  publicarEscala,
  type DiaGravadoApi,
  type GravarDiaDto,
  type PessoaDoQuadroApi,
} from "../../../api/escalaClient";
import {
  listarTabelasHorario,
  type TabelaHorarioApi,
} from "../../../api/horariosClient";
import { listarUnidades } from "../../../api/organizacaoClient";
import { QuadroDaEscalaScreen } from "./QuadroDaEscalaScreen";
import { avisosDoDia } from "./PainelDoDia";
import { escala, pessoa } from "./fixturasDoQuadro";

vi.mock("../../../api/escalaClient");
vi.mock("../../../api/horariosClient");
vi.mock("../../../api/organizacaoClient");

const HOJE = "2026-11-25";

function tabelaHorario(
  nome: string,
  extra: Partial<TabelaHorarioApi> = {},
): TabelaHorarioApi {
  return {
    id: `t-${nome}`,
    empresaId: "emp",
    codigo: null,
    nome,
    ativo: true,
    criadoPorUserId: "u",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    periodos: ["segunda", "terca", "quarta", "quinta", "sexta"].map((dia) => ({
      dia,
      inicio: "09:00",
      fim: "18:00",
    })),
    cor: "azul",
    sigla: nome[0]!,
    intervaloMinutos: 60,
    ...extra,
  };
}

const COMERCIAL = tabelaHorario("Comercial");
const ESTAGIO = tabelaHorario("Estágio", {
  cor: "verde",
  intervaloMinutos: 15,
  periodos: ["segunda", "terca", "quarta", "quinta", "sexta"].map((dia) => ({
    dia,
    inicio: "09:00",
    fim: "15:00",
  })),
});

let pessoas: PessoaDoQuadroApi[];

function ana(dias: DiaGravadoApi[] = []): PessoaDoQuadroApi {
  return pessoa("Ana Lima", {
    colaboradorId: "c-ana",
    departamento: { id: "d", nome: "TI" },
    escalas: [escala()],
    dias,
  });
}

function gravado(
  dia: string,
  extra: Partial<DiaGravadoApi> = {},
): DiaGravadoApi {
  return {
    dia,
    camada: "rascunho",
    tipo: "folga",
    turno: null,
    periodos: [],
    intervaloMinutos: 0,
    sobreaviso: [],
    unidade: null,
    observacao: null,
    ...extra,
  };
}

beforeEach(() => {
  vi.mocked(consultarQuadro).mockReset();
  vi.mocked(gravarDia).mockReset();
  vi.mocked(limparDia).mockReset();
  vi.mocked(publicarEscala).mockReset();
  pessoas = [ana()];
  vi.mocked(consultarQuadro).mockImplementation(async (inicio, fim) => ({
    empresaId: "emp",
    inicio,
    fim,
    pessoas,
  }));
  vi.mocked(listarTabelasHorario).mockResolvedValue({
    itens: [COMERCIAL, ESTAGIO],
    pagina: 1,
    tamanhoPagina: 100,
    total: 2,
  } as never);
  vi.mocked(listarUnidades).mockResolvedValue({
    itens: [
      {
        id: "u-loja",
        codigo: "L",
        nome: "Loja Centro",
        empresaId: "emp",
        status: "ativo",
        criadoEm: "",
        atualizadoEm: "",
      },
    ],
    pagina: 1,
    tamanhoPagina: 100,
    total: 1,
  } as never);
  vi.mocked(gravarDia).mockImplementation(async (dto: GravarDiaDto) =>
    gravado(dto.dia, {
      tipo: dto.tipo,
      turno:
        dto.tabelaHorarioId === COMERCIAL.id
          ? { id: COMERCIAL.id, nome: "Comercial", cor: "azul", sigla: "C" }
          : null,
      periodos: dto.periodos ?? [],
      intervaloMinutos: dto.intervaloMinutos ?? 0,
      sobreaviso: dto.sobreaviso ?? [],
      observacao: dto.observacao ?? null,
    }),
  );
  vi.mocked(limparDia).mockImplementation(async (colaboradorId, dia) => ({
    colaboradorId,
    dia,
    limpo: true,
  }));
});

async function montar(podeOperar = true) {
  render(<QuadroDaEscalaScreen hoje={HOJE} podeOperar={podeOperar} />);
  await screen.findByRole("table");
  if (podeOperar)
    await waitFor(() => expect(listarTabelasHorario).toHaveBeenCalled());
}

describe("T215 — menu da célula", () => {
  it("sem permissão de operar, as células não são botões", async () => {
    await montar(false);
    expect(
      screen.queryByRole("button", { name: /Comercial, 09:00–18:00/ }),
    ).toBeNull();
    expect(listarTabelasHorario).not.toHaveBeenCalled();
  });

  it("abre com os turnos (horário e intervalo), o dia e as ações; o turno atual vem marcado; Limpar só com rascunho", async () => {
    await montar();
    // Quarta 25/11: Comercial pelo padrão.
    const cs = screen.getAllByRole("button", {
      name: /Comercial, 09:00–18:00/,
    });
    fireEvent.click(cs[2]!);
    const menu = screen.getByRole("menu", {
      name: "Dia de Ana Lima, quarta 25/11",
    });
    const itens = [...menu.querySelectorAll("[role^=menuitem]")].map(
      (i) => i.textContent,
    );
    expect(itens).toEqual([
      "Comercial09:00–18:00 · 1 h de intervalo✓",
      "Estágio09:00–15:00 · 15 min de intervalo",
      "Folga",
      "DSRDescanso semanal remunerado",
      "SobreavisoFora do trabalho, esperando chamado · 1/3 da hora",
      "Sobreaviso depois do turno18:00–09:00 · 1/3 da hora",
      "Dois turnos no diaTurno partido, sem sobreposição",
      "Abrir detalhesEnter",
      "Adicionar observação",
    ]);
    expect(
      within(menu).getByRole("menuitemradio", { name: /^Comercial/ }),
    ).toHaveAttribute("aria-checked", "true");
    // O primeiro item recebe o foco; setas andam; Escape fecha e volta à célula.
    expect(
      [...menu.querySelectorAll<HTMLElement>("[role^=menuitem]")][0],
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(
      [...menu.querySelectorAll<HTMLElement>("[role^=menuitem]")][1],
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(
      within(menu).getByRole("menuitem", { name: /Adicionar/ }),
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(cs[2]).toHaveFocus();
  });

  it("Folga grava no rascunho: marca de mudança, selo, aviso com Desfazer — e Desfazer limpa", async () => {
    await montar();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Comercial, 09:00–18:00/ })[2]!,
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Folga" }));
    await screen.findByRole("button", { name: "Folga, mudança não publicada" });
    expect(gravarDia).toHaveBeenCalledWith({
      colaboradorId: "c-ana",
      dia: "2026-11-25",
      tipo: "folga",
      observacao: null,
    });
    expect(
      screen.getByText("Rascunho · 1 mudança não publicada"),
    ).toBeInTheDocument();
    const aviso = screen.getByRole("status", {
      name: "Folga em 25/11 no rascunho",
    });
    // Horas e escalados recalculados: 4 dias × 8 h.
    expect(
      screen.getByRole("rowheader", { name: /Ana Lima/ }).closest("tr"),
    ).toHaveTextContent("32 h");
    fireEvent.click(within(aviso).getByRole("button", { name: "Desfazer" }));
    await screen.findByRole("status", { name: "1 mudança desfeita" });
    expect(limparDia).toHaveBeenCalledWith("c-ana", "2026-11-25");
    expect(screen.queryByText(/Rascunho ·/)).toBeNull();
  });

  it("um turno do menu grava trabalho com os períodos e o intervalo dele no dia", async () => {
    await montar();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Comercial, 09:00–18:00/ })[2]!,
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Estágio/ }));
    await waitFor(() => expect(gravarDia).toHaveBeenCalled());
    expect(gravarDia).toHaveBeenCalledWith({
      colaboradorId: "c-ana",
      dia: "2026-11-25",
      tipo: "trabalho",
      tabelaHorarioId: ESTAGIO.id,
      periodos: [{ inicio: "09:00", fim: "15:00" }],
      intervaloMinutos: 15,
      sobreaviso: [],
      unidadeOrganizacionalId: null,
      observacao: null,
    });
    await screen.findByRole("status", { name: "Estágio em 25/11 no rascunho" });
  });

  it("Sobreaviso depois do turno grava o trabalho do dia com o sobreaviso do fim do turno ao início", async () => {
    await montar();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Comercial, 09:00–18:00/ })[0]!,
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Sobreaviso depois do turno/ }),
    );
    await waitFor(() => expect(gravarDia).toHaveBeenCalled());
    expect(vi.mocked(gravarDia).mock.calls[0]![0]).toMatchObject({
      dia: "2026-11-23",
      tipo: "trabalho",
      tabelaHorarioId: COMERCIAL.id,
      periodos: [{ inicio: "09:00", fim: "18:00" }],
      intervaloMinutos: 60,
      sobreaviso: [{ inicio: "18:00", fim: "09:00" }],
    });
    expect(
      await screen.findByRole("button", {
        name: /Comercial, 09:00–18:00, sobreaviso 18:00–09:00, mudança não publicada/,
      }),
    ).toBeInTheDocument();
  });

  it("Limpar (menu e Delete) desfaz a mudança do dia; não aparece sem rascunho", async () => {
    pessoas = [ana([gravado("2026-11-25", { observacao: "Troca" })])];
    await montar();
    const c = screen.getByRole("button", {
      name: "Folga, observação: Troca, mudança não publicada",
    });
    fireEvent.click(c);
    fireEvent.click(screen.getByRole("menuitem", { name: /Limpar/ }));
    await screen.findByRole("status", { name: "Dia limpo no rascunho" });
    expect(limparDia).toHaveBeenCalledWith("c-ana", "2026-11-25");
    const padrao = screen.getAllByRole("button", {
      name: /^Comercial, 09:00–18:00$/,
    });
    expect(padrao).toHaveLength(5);

    // Delete num dia sem rascunho não faz nada.
    vi.mocked(limparDia).mockClear();
    fireEvent.keyDown(padrao[0]!, { key: "Delete" });
    expect(limparDia).not.toHaveBeenCalled();
  });

  it("Delete limpa o dia com rascunho", async () => {
    pessoas = [ana([gravado("2026-11-24")])];
    await montar();
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Folga, mudança não publicada" }),
      { key: "Delete" },
    );
    await waitFor(() =>
      expect(limparDia).toHaveBeenCalledWith("c-ana", "2026-11-24"),
    );
  });

  it("setas andam entre as células (foco itinerante: uma célula na ordem do Tab)", async () => {
    await montar();
    const botoes = () =>
      within(screen.getByRole("table")).getAllByRole("button", {
        name: /Comercial|Folga|DSR|Sem escala/,
      });
    expect(botoes().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    const primeira = botoes()[0]!;
    act(() => primeira.focus());
    fireEvent.keyDown(primeira, { key: "ArrowRight" });
    expect(botoes()[1]).toHaveFocus();
    fireEvent.keyDown(botoes()[1]!, { key: "End" });
    expect(botoes()[6]).toHaveFocus();
    expect(botoes()[6]).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(botoes()[6]!, { key: "Home" });
    expect(botoes()[0]).toHaveFocus();
  });

  it("falha ao gravar: avisa e não marca o dia", async () => {
    vi.mocked(gravarDia).mockRejectedValueOnce(new Error("rede"));
    await montar();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Comercial, 09:00–18:00/ })[2]!,
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^DSR/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível gravar o dia. Tente de novo.",
    );
    expect(screen.queryByText(/Rascunho ·/)).toBeNull();
  });
});

describe("T215 — painel do dia", () => {
  async function abrirDetalhes(indice = 2) {
    await montar();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Comercial, 09:00–18:00/ })[
        indice
      ]!,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Abrir detalhes/ }));
    return screen.getByRole("dialog", { name: "Ana Lima" });
  }

  it("mostra a pessoa, o dia, a semana pelo padrão, as abas e o trabalho do dia", async () => {
    const painel = await abrirDetalhes();
    expect(painel).toHaveTextContent("TI · CLT · 5x2");
    expect(painel).toHaveTextContent("Quarta, 25 de novembro");
    expect(painel).toHaveTextContent("Semana de 23 a 29/11 · pelo padrão");
    expect(
      within(painel)
        .getAllByRole("tab")
        .map((t) => [t.textContent, t.getAttribute("aria-selected")]),
    ).toEqual([
      ["Trabalho", "true"],
      ["Folga", "false"],
      ["DSR", "false"],
      ["Sobreaviso", "false"],
      ["Ausência", "false"],
    ]);
    expect(
      within(painel).getByRole("tab", { name: "Ausência" }),
    ).toBeDisabled();
    expect(within(painel).getByRole("combobox", { name: "Turno" })).toHaveValue(
      COMERCIAL.id,
    );
    expect(within(painel).getByLabelText("Início")).toHaveValue("09:00");
    expect(within(painel).getByLabelText("Fim")).toHaveValue("18:00");
    expect(
      within(painel).getByRole("combobox", { name: "Intervalo" }),
    ).toHaveValue("60");
    expect(painel).toHaveTextContent("8 h de trabalho · termina no mesmo dia");
    expect(within(painel).getByRole("combobox", { name: /Local/ })).toHaveValue(
      "",
    );
    expect(painel).toHaveTextContent("0/300");
    expect(
      within(painel).queryByRole("button", { name: "Limpar o dia" }),
    ).toBeNull();
  });

  it("salva trabalho com 2º período, local e observação; o aviso leva o nome do turno", async () => {
    const painel = await abrirDetalhes();
    fireEvent.click(
      within(painel).getByRole("button", {
        name: "+ Segundo período (turno partido)",
      }),
    );
    fireEvent.change(within(painel).getAllByLabelText("Fim")[0]!, {
      target: { value: "12:00" },
    });
    const [, fim2] = within(painel).getAllByLabelText("Fim");
    fireEvent.change(within(painel).getByLabelText("Início do 2º período"), {
      target: { value: "13:00" },
    });
    fireEvent.change(fim2!, { target: { value: "17:00" } });
    expect(painel).toHaveTextContent("7 h de trabalho · termina no mesmo dia");
    fireEvent.change(within(painel).getByRole("combobox", { name: /Local/ }), {
      target: { value: "u-loja" },
    });
    fireEvent.change(
      within(painel).getByRole("textbox", { name: /Observação/ }),
      {
        target: { value: "Cobre a abertura" },
      },
    );
    expect(painel).toHaveTextContent("16/300");
    fireEvent.click(
      within(painel).getByRole("button", { name: "Salvar no rascunho" }),
    );
    await waitFor(() => expect(gravarDia).toHaveBeenCalled());
    expect(gravarDia).toHaveBeenCalledWith({
      colaboradorId: "c-ana",
      dia: "2026-11-25",
      tipo: "trabalho",
      tabelaHorarioId: COMERCIAL.id,
      periodos: [
        { inicio: "09:00", fim: "12:00" },
        { inicio: "13:00", fim: "17:00" },
      ],
      intervaloMinutos: 0,
      sobreaviso: [],
      unidadeOrganizacionalId: "u-loja",
      observacao: "Cobre a abertura",
    });
    await screen.findByRole("status", {
      name: "Comercial em 25/11 no rascunho",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("recusa o 2º período sobreposto sem chamar o servidor; mostra a recusa do servidor", async () => {
    const painel = await abrirDetalhes();
    fireEvent.click(
      within(painel).getByRole("button", {
        name: "+ Segundo período (turno partido)",
      }),
    );
    fireEvent.change(within(painel).getByLabelText("Início do 2º período"), {
      target: { value: "17:00" },
    });
    const [, fim2] = within(painel).getAllByLabelText("Fim");
    fireEvent.change(fim2!, { target: { value: "20:00" } });
    fireEvent.click(
      within(painel).getByRole("button", { name: "Salvar no rascunho" }),
    );
    expect(within(painel).getByRole("alert")).toHaveTextContent(
      "O 2º período não pode começar antes do fim do 1º.",
    );
    expect(gravarDia).not.toHaveBeenCalled();

    fireEvent.click(within(painel).getByRole("button", { name: "Remover" }));
    vi.mocked(gravarDia).mockRejectedValueOnce(
      new ApiError(422, "x", {
        erros: [{ campo: "tabelaHorarioId", motivo: "indisponivel" }],
      }),
    );
    fireEvent.click(
      within(painel).getByRole("button", { name: "Salvar no rascunho" }),
    );
    expect(await within(painel).findByRole("alert")).toHaveTextContent(
      "Este turno não está mais disponível.",
    );
  });

  it("avisos da CLT ao vivo: mais de 10 h e intervalo; DSR salva só a observação", async () => {
    const painel = await abrirDetalhes();
    fireEvent.change(within(painel).getAllByLabelText("Fim")[0]!, {
      target: { value: "22:00" },
    });
    const nota = within(painel).getByRole("note", {
      name: "Atenção à legislação",
    });
    expect(nota).toHaveTextContent(
      "12 h no dia: passa de 10 h (8 h normais + 2 h extras, CLT, art. 59).",
    );
    fireEvent.change(
      within(painel).getByRole("combobox", { name: "Intervalo" }),
      {
        target: { value: "30" },
      },
    );
    expect(nota).toHaveTextContent(
      "Turno com mais de 6 h de trabalho precisa de intervalo de 1 h a 2 h (CLT, art. 71).",
    );
    fireEvent.click(within(painel).getByRole("tab", { name: "DSR" }));
    expect(within(painel).queryByLabelText("Início")).toBeNull();
    fireEvent.click(
      within(painel).getByRole("button", { name: "Salvar no rascunho" }),
    );
    await waitFor(() =>
      expect(gravarDia).toHaveBeenCalledWith({
        colaboradorId: "c-ana",
        dia: "2026-11-25",
        tipo: "dsr",
        observacao: null,
      }),
    );
  });

  it("Sobreaviso (menu) abre a aba com os períodos; Adicionar observação abre o painel com o foco na observação", async () => {
    await montar();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Comercial, 09:00–18:00/ })[2]!,
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Sobreaviso/ }));
    const painel = screen.getByRole("dialog", { name: "Ana Lima" });
    expect(
      within(painel).getByRole("tab", { name: "Sobreaviso" }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.change(within(painel).getByLabelText("Início"), {
      target: { value: "18:00" },
    });
    fireEvent.change(within(painel).getByLabelText("Fim"), {
      target: { value: "06:00" },
    });
    expect(painel).toHaveTextContent(
      "12 h de sobreaviso (1/3 da hora na folha) · termina no dia seguinte",
    );
    fireEvent.click(
      within(painel).getByRole("button", { name: "Salvar no rascunho" }),
    );
    await waitFor(() =>
      expect(gravarDia).toHaveBeenCalledWith({
        colaboradorId: "c-ana",
        dia: "2026-11-25",
        tipo: "sobreaviso",
        periodos: [{ inicio: "18:00", fim: "06:00" }],
        unidadeOrganizacionalId: null,
        observacao: null,
      }),
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /Comercial, 09:00–18:00/ })[0]!,
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Adicionar observação" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /Observação/ })).toHaveFocus(),
    );
  });

  it("dia anterior e próximo trocam o dia; com mudança não salva, ficam travados", async () => {
    const painel = await abrirDetalhes();
    fireEvent.click(
      within(painel).getByRole("button", { name: "Próximo dia" }),
    );
    expect(painel).toHaveTextContent("Quinta, 26 de novembro");
    fireEvent.change(
      within(painel).getByRole("textbox", { name: /Observação/ }),
      {
        target: { value: "x" },
      },
    );
    expect(
      within(painel).getByRole("button", { name: "Dia anterior" }),
    ).toBeDisabled();
    expect(painel).toHaveTextContent(
      "Salve ou cancele antes de trocar de dia.",
    );
  });

  it("Limpar o dia aparece com rascunho e limpa", async () => {
    pessoas = [ana([gravado("2026-11-25", { tipo: "dsr" })])];
    await montar();
    fireEvent.click(
      screen.getByRole("button", {
        name: /DSR, descanso semanal remunerado, mudança/,
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Abrir detalhes/ }));
    const painel = screen.getByRole("dialog", { name: "Ana Lima" });
    expect(painel).toHaveTextContent("Semana de 23 a 29/11 · rascunho");
    expect(within(painel).getByRole("tab", { name: "DSR" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(
      within(painel).getByRole("button", { name: "Limpar o dia" }),
    );
    await waitFor(() =>
      expect(limparDia).toHaveBeenCalledWith("c-ana", "2026-11-25"),
    );
  });
});

describe("T215 — avisos do dia (CLT)", () => {
  it("4 h a 6 h sem pausa; sobreaviso acima de 24 h; 12 h com 1 h de intervalo", () => {
    expect(
      avisosDoDia({
        aba: "trabalho",
        periodos: [{ inicio: "09:00", fim: "14:00" }],
        intervalo: 0,
        sobreaviso: [],
      }),
    ).toEqual([
      "Turno de 4 h a 6 h precisa de pausa de 15 min (CLT, art. 71, § 1º).",
    ]);
    expect(
      avisosDoDia({
        aba: "sobreaviso",
        periodos: [
          { inicio: "06:00", fim: "18:00" },
          { inicio: "18:00", fim: "07:00" },
        ],
        intervalo: 0,
        sobreaviso: [
          { inicio: "06:00", fim: "18:00" },
          { inicio: "18:00", fim: "07:00" },
        ],
      }),
    ).toEqual(["Sobreaviso acima de 24 h seguidas (CLT, art. 244, § 2º)."]);
    expect(
      avisosDoDia({
        aba: "trabalho",
        periodos: [{ inicio: "08:00", fim: "17:00" }],
        intervalo: 60,
        sobreaviso: [],
      }),
    ).toEqual([]);
  });
});

describe("T215 — publicar a escala", () => {
  it("sem rascunho no período, Publicar fica indisponível; sem permissão, não aparece", async () => {
    await montar();
    const botao = screen.getByRole("button", { name: /^Publicar/ });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveAccessibleDescription(
      "Nada para publicar neste período.",
    );
    fireEvent.click(botao);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sem permissão de operar, não há Publicar", async () => {
    await montar(false);
    expect(screen.queryByRole("button", { name: /^Publicar/ })).toBeNull();
  });

  it("resume novas, alteradas e pessoas; publica com o aviso pedido e recarrega o quadro", async () => {
    pessoas = [
      ana([
        gravado("2026-11-23", { camada: "publicado", tipo: "dsr" }),
        gravado("2026-11-23"),
        gravado("2026-11-24", { tipo: "dsr" }),
      ]),
    ];
    vi.mocked(publicarEscala).mockResolvedValue({
      id: "pub",
      inicio: "2026-11-23",
      fim: "2026-11-29",
      novas: 1,
      alteradas: 1,
      pessoas: 1,
      avisar: true,
      publicadaEm: "2026-11-25T15:00:00.000Z",
      publicadaPor: "Ana RH",
    });
    await montar();
    expect(
      screen.getByText("Rascunho · 2 mudanças não publicadas"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const dialogo = screen.getByRole("dialog", { name: "Publicar a escala" });
    const linhas = [...dialogo.querySelectorAll("dl > div")].map(
      (d) => d.textContent,
    );
    expect(linhas).toEqual([
      "PeríodoSemana de 23 a 29 de novembro de 2026",
      "Alocações novas1",
      "Alteradas1",
      "Pessoas afetadas1",
    ]);
    const avisar = within(dialogo).getByRole("checkbox", {
      name: "Avisar as pessoas pelo Portal e por e-mail",
    });
    expect(avisar).toBeChecked();
    expect(avisar).toHaveAccessibleDescription(
      /Só quem teve a escala mudada recebe \(1 pessoa\)/,
    );

    const chamadas = vi.mocked(consultarQuadro).mock.calls.length;
    fireEvent.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await screen.findByRole("status", { name: "Escala publicada" });
    expect(publicarEscala).toHaveBeenCalledWith(
      "2026-11-23",
      "2026-11-29",
      true,
    );
    expect(
      screen.getByRole("status", { name: "Escala publicada" }),
    ).toHaveTextContent("1 pessoa com mudança · aviso registrado");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(vi.mocked(consultarQuadro).mock.calls.length).toBe(chamadas + 1),
    );
  });

  it("sem o aviso: publica com avisar=false", async () => {
    pessoas = [ana([gravado("2026-11-24")])];
    vi.mocked(publicarEscala).mockResolvedValue({
      id: "p",
      inicio: "2026-11-23",
      fim: "2026-11-29",
      novas: 1,
      alteradas: 0,
      pessoas: 1,
      avisar: false,
      publicadaEm: "2026-11-25T15:00:00.000Z",
      publicadaPor: null,
    });
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const dialogo = screen.getByRole("dialog", { name: "Publicar a escala" });
    fireEvent.click(within(dialogo).getByRole("checkbox"));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await waitFor(() =>
      expect(publicarEscala).toHaveBeenCalledWith(
        "2026-11-23",
        "2026-11-29",
        false,
      ),
    );
    expect(
      await screen.findByRole("status", { name: "Escala publicada" }),
    ).toHaveTextContent("sem aviso");
  });

  it("já publicada: selo 'Publicada em … por …' e o botão vira Publicar mudanças", async () => {
    pessoas = [ana([gravado("2026-11-24")])];
    vi.mocked(consultarQuadro).mockImplementation(async (inicio, fim) => ({
      empresaId: "emp",
      inicio,
      fim,
      publicacao: {
        id: "p0",
        inicio,
        fim,
        novas: 3,
        alteradas: 0,
        pessoas: 1,
        avisar: false,
        // 23h de 24/11 em São Paulo (02h de 25/11 em UTC).
        publicadaEm: "2026-11-25T02:00:00.000Z",
        publicadaPor: "Ana RH",
      },
      pessoas,
    }));
    await montar();
    expect(
      screen.getByText("Publicada em 24/11 por Ana RH"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publicar mudanças" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("falha: nada para publicar e erro genérico ficam no diálogo", async () => {
    pessoas = [ana([gravado("2026-11-24")])];
    vi.mocked(publicarEscala)
      .mockRejectedValueOnce(
        new ApiError(422, "x", { codigo: "escala_nada_para_publicar" }),
      )
      .mockRejectedValueOnce(new Error("rede"));
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const dialogo = screen.getByRole("dialog", { name: "Publicar a escala" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Nada para publicar neste período.",
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert")).toHaveTextContent(
        "Não foi possível publicar. Tente de novo.",
      ),
    );
  });
});
