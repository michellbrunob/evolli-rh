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
  gravarDias,
  limparDia,
  limparDias,
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
import {
  avisarNoQuadro,
  esquecerPedidoDoModelo,
  lerPedidoDoModelo,
} from "./aplicarModelo";

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
  vi.mocked(gravarDias).mockReset();
  vi.mocked(limparDias).mockReset();
  vi.mocked(gravarDias).mockImplementation(async (dias) =>
    dias.map((d) => ({
      ...gravado(d.dia, { tipo: d.tipo }),
      colaboradorId: d.colaboradorId,
    })),
  );
  vi.mocked(limparDias).mockImplementation(async (dias) => dias.length);
  pessoas = [ana()];
  // Como a API: só os dias gravados do período.
  vi.mocked(consultarQuadro).mockImplementation(async (inicio, fim) => ({
    empresaId: "emp",
    inicio,
    fim,
    pessoas: pessoas.map((p) => ({
      ...p,
      dias: (p.dias ?? []).filter((d) => d.dia >= inicio && d.dia <= fim),
    })),
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

describe("T215 — ações em massa", () => {
  async function abrirMaisAcoes() {
    fireEvent.keyDown(screen.getByRole("button", { name: "Mais ações" }), {
      key: "Enter",
    });
    return screen.findByRole("menu");
  }

  it("seleção: pessoa, grupo e página; a barra conta e Esc limpa", async () => {
    pessoas = [
      ana(),
      pessoa("Bruno Reis", {
        colaboradorId: "c-bruno",
        departamento: { id: "d", nome: "TI" },
        escalas: [escala()],
      }),
    ];
    await montar();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar Ana Lima" }),
    );
    const barra = screen.getByRole("toolbar", {
      name: "Ações para as pessoas selecionadas",
    });
    expect(barra).toHaveTextContent("1 pessoa selecionada");
    const pagina = screen.getByRole("checkbox", {
      name: "Selecionar as pessoas desta página",
    }) as HTMLInputElement;
    expect(pagina.indeterminate).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar TI" }));
    expect(barra).toHaveTextContent("2 pessoas selecionadas");
    expect(pagina).toBeChecked();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("Dar folga: dia de hoje por padrão, grava no rascunho e Desfazer limpa", async () => {
    await montar();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar Ana Lima" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Dar folga" }));
    const dialogo = screen.getByRole("dialog", {
      name: "Dar folga para 1 pessoa",
    });
    expect(within(dialogo).getByLabelText("Dia")).toHaveValue("2026-11-25");
    fireEvent.change(within(dialogo).getByRole("combobox", { name: "Tipo" }), {
      target: { value: "dsr" },
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Dar folga no rascunho" }),
    );
    const aviso = await screen.findByRole("status", {
      name: "DSR em 25/11 para 1 pessoa no rascunho",
    });
    expect(gravarDias).toHaveBeenCalledWith([
      {
        colaboradorId: "c-ana",
        dia: "2026-11-25",
        tipo: "dsr",
        observacao: null,
      },
    ]);
    fireEvent.click(within(aviso).getByRole("button", { name: "Desfazer" }));
    await screen.findByRole("status", { name: "Ação desfeita" });
    expect(limparDias).toHaveBeenCalledWith([
      { colaboradorId: "c-ana", dia: "2026-11-25" },
    ]);
  });

  it("Trocar turno: período da semana e dias úteis por padrão; o que muda por pessoa; aplica ao rascunho", async () => {
    await montar();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar Ana Lima" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Trocar turno" }));
    const dialogo = screen.getByRole("dialog", {
      name: "Trocar turno de 1 pessoa",
    });
    expect(within(dialogo).getByLabelText("De")).toHaveValue("2026-11-23");
    expect(within(dialogo).getByLabelText("Até")).toHaveValue("2026-11-29");
    expect(
      within(dialogo)
        .getAllByRole("button", { pressed: true })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]);
    // Comercial já é o turno: sem mudança.
    expect(
      await within(dialogo).findByText("sem mudança (já é Comercial)"),
    ).toBeInTheDocument();
    fireEvent.change(
      within(dialogo).getByRole("combobox", { name: "Novo turno" }),
      {
        target: { value: ESTAGIO.id },
      },
    );
    expect(within(dialogo).getByText("5 dias com Estágio")).toBeInTheDocument();
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Aplicar ao rascunho" }),
    );
    await screen.findByRole("status", {
      name: "Estágio em 5 dias no rascunho",
    });
    const enviados = vi.mocked(gravarDias).mock.calls[0]![0];
    expect(enviados.map((d) => d.dia)).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
    ]);
    expect(enviados[0]).toMatchObject({
      tipo: "trabalho",
      tabelaHorarioId: ESTAGIO.id,
      periodos: [{ inicio: "09:00", fim: "15:00" }],
      intervaloMinutos: 15,
    });
  });

  it("menu ⋯: Copiar semana anterior (pessoas do filtro) grava o gravado da semana anterior e avisa", async () => {
    pessoas = [ana([gravado("2026-11-17", { tipo: "dsr" })])];
    await montar();
    const menu = await abrirMaisAcoes();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual([
      "Copiar semana anteriorPara as pessoas do filtro",
      "Repetir esta semana até…",
      "Limpar o rascunho do períodoSó o que ainda não foi publicado",
    ]);
    // Sem rascunho no período, Limpar fica indisponível.
    expect(
      within(menu).getByRole("menuitem", { name: /Limpar o rascunho/ }),
    ).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Copiar semana anterior/ }),
    );
    await screen.findByRole("status", {
      name: "Semana anterior copiada para 1 pessoa",
    });
    expect(consultarQuadro).toHaveBeenCalledWith("2026-11-16", "2026-11-22");
    expect(gravarDias).toHaveBeenCalledWith([
      {
        colaboradorId: "c-ana",
        dia: "2026-11-24",
        tipo: "dsr",
        observacao: null,
      },
    ]);
    // O padrão da origem não limpa nada que não tem rascunho.
    expect(limparDias).not.toHaveBeenCalled();
  });

  it("menu ⋯: Repetir esta semana até a data copia para as semanas seguintes", async () => {
    pessoas = [ana([gravado("2026-11-24", { tipo: "dsr" })])];
    await montar();
    const menu = await abrirMaisAcoes();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Repetir esta semana/ }),
    );
    const dialogo = screen.getByRole("dialog", { name: "Repetir esta semana" });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Repetir no rascunho" }),
    );
    expect(within(dialogo).getByRole("alert")).toHaveTextContent(
      "Escolha uma data depois desta semana, até um ano.",
    );
    fireEvent.change(within(dialogo).getByLabelText("Repetir até"), {
      target: { value: "2026-12-08" },
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Repetir no rascunho" }),
    );
    await screen.findByRole("status", { name: "Semana repetida até 8/12" });
    expect(vi.mocked(gravarDias).mock.calls[0]![0]).toEqual([
      {
        colaboradorId: "c-ana",
        dia: "2026-12-01",
        tipo: "dsr",
        observacao: null,
      },
      {
        colaboradorId: "c-ana",
        dia: "2026-12-08",
        tipo: "dsr",
        observacao: null,
      },
    ]);
  });

  it("menu ⋯: Limpar o rascunho do período conta, confirma e limpa", async () => {
    pessoas = [
      ana([gravado("2026-11-24"), gravado("2026-11-25", { tipo: "dsr" })]),
    ];
    await montar();
    const menu = await abrirMaisAcoes();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Limpar o rascunho/ }),
    );
    const dialogo = screen.getByRole("dialog", {
      name: "Limpar o rascunho do período",
    });
    expect(dialogo).toHaveTextContent(
      "Desfaz as mudanças não publicadas de 23 a 29 de novembro de 2026 para as pessoas do filtro. O que já foi publicado continua igual.",
    );
    expect(dialogo).toHaveTextContent("2 mudanças serão desfeitas.");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Limpar rascunho" }),
    );
    await screen.findByRole("status", { name: "2 mudanças desfeitas" });
    expect(limparDias).toHaveBeenCalledWith([
      { colaboradorId: "c-ana", dia: "2026-11-24" },
      { colaboradorId: "c-ana", dia: "2026-11-25" },
    ]);
  });

  it("seleção ⋯: avisos, mês e Limpar o rascunho só das pessoas selecionadas", async () => {
    pessoas = [
      ana([gravado("2026-11-24")]),
      pessoa("Bruno Reis", {
        colaboradorId: "c-bruno",
        escalas: [escala()],
        dias: [gravado("2026-11-25")],
      }),
    ];
    await montar();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar Ana Lima" }),
    );
    const barra = screen.getByRole("toolbar", {
      name: "Ações para as pessoas selecionadas",
    });
    expect(within(barra).getByText("Esc")).toBeInTheDocument();
    const gatilho = within(barra).getByRole("button", {
      name: "Mais ações para as pessoas selecionadas",
    });
    fireEvent.keyDown(gatilho, { key: "Enter" });
    let menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual([
      "Ver avisos dessas pessoasAbre o painel de avisos filtrado",
      "Abrir no mêsMesmo filtro, visão mensal",
      "Limpar o rascunho do períodoSó o que ainda não foi publicado",
    ]);
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Limpar o rascunho/ }),
    );
    const dialogo = screen.getByRole("dialog", {
      name: "Limpar o rascunho do período",
    });
    expect(dialogo).toHaveTextContent("para as pessoas selecionadas.");
    expect(dialogo).toHaveTextContent("1 mudança será desfeita.");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Limpar rascunho" }),
    );
    await screen.findByRole("status", { name: "1 mudança desfeita" });
    expect(limparDias).toHaveBeenCalledWith([
      { colaboradorId: "c-ana", dia: "2026-11-24" },
    ]);
    // Ver avisos: o painel só das selecionadas.
    fireEvent.keyDown(gatilho, { key: "Enter" });
    menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Ver avisos dessas pessoas/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Avisos de 1 pessoa" }),
    ).toBeInTheDocument();
  });

  it("seleção ⋯: Abrir no mês troca a visão e mantém a seleção", async () => {
    await montar();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar Ana Lima" }),
    );
    fireEvent.keyDown(
      screen.getByRole("button", {
        name: "Mais ações para as pessoas selecionadas",
      }),
      { key: "Enter" },
    );
    const menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /Abrir no mês/ }),
    );
    await screen.findByRole("region", { name: "Quadro de escala do mês" });
    expect(
      screen.getByRole("toolbar", {
        name: "Ações para as pessoas selecionadas",
      }),
    ).toHaveTextContent("1 pessoa selecionada");
  });

  it("Aplicar modelo: no topo leva o filtro; na barra, também a seleção; na volta, o aviso", async () => {
    esquecerPedidoDoModelo();
    pessoas = [
      ana(),
      pessoa("Bruno Reis", {
        colaboradorId: "c-bruno",
        departamento: { id: "d", nome: "TI" },
        escalas: [escala()],
      }),
    ];
    avisarNoQuadro("Modelo aplicado: 5 células no rascunho para 1 pessoa.");
    const onAbrirModelo = vi.fn();
    render(
      <QuadroDaEscalaScreen
        hoje={HOJE}
        podeOperar
        onAbrirModelo={onAbrirModelo}
      />,
    );
    await screen.findByRole("table");
    expect(
      await screen.findByRole("status", {
        name: "Modelo aplicado: 5 células no rascunho para 1 pessoa.",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar modelo" }));
    expect(onAbrirModelo).toHaveBeenCalledTimes(1);
    expect(lerPedidoDoModelo()).toEqual({ doFiltro: null, selecionadas: [] });
    // Com busca: o filtro; com seleção: as selecionadas.
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar colaborador" }),
      {
        target: { value: "Ana" },
      },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar Ana Lima" }),
    );
    const barra = screen.getByRole("toolbar", {
      name: "Ações para as pessoas selecionadas",
    });
    fireEvent.click(
      within(barra).getByRole("button", { name: "Aplicar modelo" }),
    );
    expect(onAbrirModelo).toHaveBeenCalledTimes(2);
    expect(lerPedidoDoModelo()).toEqual({
      doFiltro: ["c-ana"],
      selecionadas: ["c-ana"],
    });
  });

  it("sem permissão: sem seleção nem menu ⋯", async () => {
    await montar(false);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mais ações" })).toBeNull();
  });
});
