import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TabelaHorarioApi } from "../../../api/horariosClient";
import { TurnosScreen, type ServicoDeTurnos } from "./TurnosScreen";
import { resumoPorDia, siglaDoNome, trabalhoNoDia } from "./turnos";

const UTEIS = ["segunda", "terca", "quarta", "quinta", "sexta"];

function turno(extra: Partial<TabelaHorarioApi> = {}): TabelaHorarioApi {
  return {
    id: "t1",
    empresaId: "e1",
    codigo: "COMERCIAL",
    nome: "Comercial",
    ativo: true,
    criadoPorUserId: "u1",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    periodos: UTEIS.map((dia) => ({ dia, inicio: "09:00", fim: "18:00" })),
    cor: "cinza",
    sigla: "C",
    unidadeOrganizacionalId: null,
    modo: "por_dia",
    intervaloMinutos: 60,
    toleranciaMinutos: 5,
    minimoPorDia: null,
    emUso: 2,
    ...extra,
  };
}

const COMERCIAL = turno();
const ESTAGIO = turno({
  id: "t2",
  nome: "Estágio",
  sigla: "E",
  cor: "verde",
  periodos: UTEIS.flatMap((dia) => [
    { dia, inicio: "09:00", fim: "12:00" },
    { dia, inicio: "12:15", fim: "15:00" },
  ]),
  intervaloMinutos: 0,
  emUso: 0,
  unidadeOrganizacionalId: "u-centro",
});
const ARQUIVADO = turno({
  id: "t3",
  nome: "Turno Teste",
  sigla: "TT",
  cor: "laranja",
  ativo: false,
  emUso: 0,
  modo: "mesmo_horario",
  periodos: [{ dia: "segunda", inicio: "08:00", fim: "17:00" }],
});

type Duble = ServicoDeTurnos &
  Record<keyof ServicoDeTurnos, ReturnType<typeof vi.fn>>;

function servico(lista = [COMERCIAL, ESTAGIO, ARQUIVADO]): Duble {
  return {
    listar: vi.fn().mockResolvedValue(lista),
    unidades: vi.fn().mockResolvedValue([
      {
        id: "u-centro",
        codigo: "CENTRO",
        nome: "Loja Centro",
        empresaId: "e1",
        status: "ativo",
        criadoEm: "",
      },
    ]),
    criar: vi.fn().mockResolvedValue(COMERCIAL),
    editar: vi.fn().mockResolvedValue(COMERCIAL),
    arquivar: vi.fn().mockResolvedValue(COMERCIAL),
    reativar: vi.fn().mockResolvedValue(ARQUIVADO),
  } as unknown as Duble;
}

beforeEach(() => vi.clearAllMocks());

describe("T215 — Turnos (regras)", () => {
  it("sigla, trabalho no dia e resumo", () => {
    expect(siglaDoNome("Turno Teste")).toBe("TT");
    expect(siglaDoNome("Comercial")).toBe("C");
    expect(trabalhoNoDia([{ inicio: "09:00", fim: "18:00" }], 60)).toBe(480);
    expect(
      trabalhoNoDia(
        [
          { inicio: "09:00", fim: "12:00" },
          { inicio: "12:15", fim: "15:00" },
        ],
        60,
      ),
    ).toBe(345);
    const dias = new Map(
      [
        "segunda",
        "terca",
        "quarta",
        "quinta",
        "sexta",
        "sabado",
        "domingo",
      ].map((d, i) => [d, i < 5 ? [{ inicio: "08:00", fim: "17:00" }] : []]),
    );
    expect(resumoPorDia(dias)).toBe("Seg a sex 08:00–17:00 · sáb e dom folga");
  });
});

describe("T215 — Turnos (tela)", () => {
  it("lista: colunas, sigla, intervalo, trabalho no dia, unidade, em uso e contagem", async () => {
    render(<TurnosScreen podeOperar servico={servico()} />);
    const tabela = await screen.findByRole("table", { name: "Turnos ativos" });
    expect(
      within(tabela)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual([
      "Turno",
      "Horário",
      "Intervalo",
      "Trabalho no dia",
      "Unidade",
      "Em uso",
      "Ações",
    ]);
    const [comercial, estagio] = within(tabela).getAllByRole("row").slice(1);
    expect(comercial).toHaveTextContent(
      "CComercial09:00–18:001 h8 hTodas2 pessoas",
    );
    expect(estagio).toHaveTextContent(
      "EEstágio09:00–15:0015 min5 h 45Loja CentroSem uso",
    );
    expect(
      screen.getByText("2 turnos ativos · 1 arquivado"),
    ).toBeInTheDocument();
  });

  it("filtro por unidade mantém os turnos de todas as unidades", async () => {
    render(<TurnosScreen podeOperar servico={servico()} />);
    await screen.findByRole("table", { name: "Turnos ativos" });
    fireEvent.change(screen.getByRole("combobox", { name: "Unidade" }), {
      target: { value: "u-centro" },
    });
    expect(
      screen.getByText("2 turnos ativos · 1 arquivado"),
    ).toBeInTheDocument();
  });

  it("arquivados ficam à parte e podem ser reativados", async () => {
    const s = servico();
    render(<TurnosScreen podeOperar servico={s} />);
    const botao = await screen.findByRole("button", { name: /^Arquivados/ });
    expect(botao).toHaveTextContent("Turno Teste · 08:00–17:00");
    expect(botao).toHaveTextContent("Fica no histórico das escalas antigas");
    fireEvent.click(botao);
    const tabela = screen.getByRole("table", { name: "Turnos arquivados" });
    fireEvent.keyDown(
      within(tabela).getByRole("button", {
        name: "Ações do turno Turno Teste",
      }),
      { key: "Enter" },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Reativar/ }));
    await waitFor(() => expect(s.reativar).toHaveBeenCalledWith("t3"));
    expect(
      await screen.findByText("Turno Teste voltou para o menu do quadro."),
    ).toBeInTheDocument();
  });

  it("arquivar avisa que sai do menu e o histórico continua", async () => {
    const s = servico();
    render(<TurnosScreen podeOperar servico={s} />);
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "Ações do turno Estágio" }),
      { key: "Enter" },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Arquivar/ }));
    await waitFor(() => expect(s.arquivar).toHaveBeenCalledWith("t2"));
    expect(
      await screen.findByText(
        "Estágio foi arquivado. Saiu do menu do quadro; o histórico continua.",
      ),
    ).toBeInTheDocument();
  });

  it("só consulta: sem Novo turno nem ações", async () => {
    render(<TurnosScreen servico={servico()} />);
    await screen.findByRole("table", { name: "Turnos ativos" });
    expect(screen.getByText("Somente consulta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo turno" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Ações do turno/ }),
    ).toBeNull();
  });

  describe("Novo turno", () => {
    async function abrir(s = servico()) {
      render(<TurnosScreen podeOperar servico={s} />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Novo turno" }),
      );
      await screen.findByRole("heading", { name: "Novo turno" });
      return s;
    }

    it("valida nome e foca o campo; sigla sai das iniciais", async () => {
      const s = await abrir();
      fireEvent.click(screen.getByRole("button", { name: "Criar turno" }));
      const nome = screen.getByRole("textbox", { name: /^Nome do turno/ });
      expect(nome).toHaveAttribute("aria-invalid", "true");
      expect(nome).toHaveFocus();
      expect(screen.getByText("Dê um nome ao turno.")).toBeInTheDocument();
      expect(s.criar).not.toHaveBeenCalled();
      fireEvent.change(nome, { target: { value: "Plantão Noite" } });
      expect(screen.getByRole("textbox", { name: "Sigla no mês" })).toHaveValue(
        "PN",
      );
      expect(
        within(
          screen.getByRole("complementary", { name: "No quadro" }),
        ).getAllByText("Plantão Noite").length,
      ).toBe(1);
    });

    it("cores: as usadas dizem de quem são", async () => {
      await abrir();
      expect(
        screen.getByRole("radio", { name: "Cinza, usada por Comercial" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "Verde, usada por Estágio" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    });

    it("mesmo horário todo dia: envia os períodos de segunda e o intervalo", async () => {
      const s = await abrir();
      fireEvent.change(
        screen.getByRole("textbox", { name: /^Nome do turno/ }),
        {
          target: { value: "Manhã" },
        },
      );
      expect(
        screen.getByText(
          (_, el) =>
            el?.textContent ===
            "Resumo: Todo dia de trabalho, 08:00–17:00 com 1 h de intervalo · 8h00 por dia",
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Criar turno" }));
      await waitFor(() =>
        expect(s.criar).toHaveBeenCalledWith({
          nome: "Manhã",
          periodos: [{ dia: "segunda", inicio: "08:00", fim: "17:00" }],
          modo: "mesmo_horario",
          intervaloMinutos: 60,
          cor: "azul",
          sigla: "M",
          unidadeOrganizacionalId: null,
          toleranciaMinutos: 5,
          minimoPorDia: null,
        }),
      );
      expect(
        await screen.findByText(
          "Turno Manhã criado. Já aparece no menu das células do quadro.",
        ),
      ).toBeInTheDocument();
    });

    it("turno que passa da meia-noite: recusado com o caminho (o quadro, dia a dia), sem prometer turno da noite", async () => {
      const s = await abrir();
      expect(
        screen.getByRole("textbox", { name: /^Nome do turno/ }),
      ).toHaveAttribute("placeholder", "Ex.: Manhã, Comercial");
      fireEvent.change(
        screen.getByRole("textbox", { name: /^Nome do turno/ }),
        { target: { value: "Noturno" } },
      );
      fireEvent.change(
        screen.getByLabelText("Todo dia de trabalho, 1º período: início"),
        { target: { value: "19:00" } },
      );
      fireEvent.change(
        screen.getByLabelText("Todo dia de trabalho, 1º período: fim"),
        { target: { value: "07:00" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Criar turno" }));
      expect(
        await screen.findByText(
          "O fim de cada período precisa ser depois do início, no mesmo dia. Horário que passa da meia-noite vai no quadro da escala, dia a dia.",
        ),
      ).toBeInTheDocument();
      expect(s.criar).not.toHaveBeenCalled();
    });

    it("horário por dia: liga e desliga dias, até 3 períodos, e envia cada dia", async () => {
      const s = await abrir();
      fireEvent.change(
        screen.getByRole("textbox", { name: /^Nome do turno/ }),
        {
          target: { value: "Semana" },
        },
      );
      fireEvent.click(
        screen.getByRole("tab", { name: "Horário por dia da semana" }),
      );
      fireEvent.click(screen.getByRole("checkbox", { name: "Sábado: folga" }));
      const sabado = screen.getByRole("group", { name: "Sábado" });
      fireEvent.click(
        within(sabado).getByRole("button", { name: "+ Período" }),
      );
      fireEvent.click(
        within(sabado).getByRole("button", { name: "+ Período" }),
      );
      expect(
        within(sabado).queryByRole("button", { name: "+ Período" }),
      ).toBeNull();
      fireEvent.click(
        within(sabado).getByRole("button", {
          name: "Remover o 3º período de Sábado",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Criar turno" }));
      await waitFor(() => expect(s.criar).toHaveBeenCalledTimes(1));
      const dto = s.criar.mock.calls[0]![0];
      expect(dto.modo).toBe("por_dia");
      expect(
        dto.periodos.filter((p: { dia: string }) => p.dia === "sabado"),
      ).toHaveLength(2);
      expect(
        dto.periodos.filter((p: { dia: string }) => p.dia === "domingo"),
      ).toHaveLength(0);
    });

    it("duplicar abre o Novo turno preenchido com (cópia)", async () => {
      render(<TurnosScreen podeOperar servico={servico()} />);
      fireEvent.keyDown(
        await screen.findByRole("button", { name: "Ações do turno Comercial" }),
        { key: "Enter" },
      );
      fireEvent.click(
        await screen.findByRole("menuitem", { name: /^Duplicar/ }),
      );
      expect(
        await screen.findByRole("textbox", { name: /^Nome do turno/ }),
      ).toHaveValue("Comercial (cópia)");
    });
  });

  it("editar: salva identificação e marcação sem reenviar horários iguais", async () => {
    const s = servico();
    render(<TurnosScreen podeOperar servico={s} />);
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "Ações do turno Comercial" }),
      { key: "Enter" },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    await screen.findByRole("heading", { name: "Editar turno" });
    expect(
      screen.getByText("Comercial · usado por 2 pessoas"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Mudar o horário vale para o rascunho a partir de hoje. O que já foi publicado não muda.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Laranja" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Mínimo de pessoas por dia" }),
      { target: { value: "2" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(s.editar).toHaveBeenCalledWith("t1", {
        nome: "Comercial",
        cor: "laranja",
        sigla: "C",
        unidadeOrganizacionalId: null,
        toleranciaMinutos: 5,
        minimoPorDia: 2,
      }),
    );
  });

  it("editar horário: envia os períodos, o modo e o intervalo novos", async () => {
    const s = servico();
    render(<TurnosScreen podeOperar servico={s} />);
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "Ações do turno Comercial" }),
      { key: "Enter" },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    await screen.findByRole("heading", { name: "Editar turno" });
    fireEvent.click(
      screen.getByRole("tab", { name: "Mesmo horário todo dia" }),
    );
    fireEvent.change(
      screen.getByLabelText("Todo dia de trabalho, 1º período: fim"),
      { target: { value: "17:00" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(s.editar).toHaveBeenCalledTimes(1));
    expect(s.editar.mock.calls[0]![1]).toMatchObject({
      modo: "mesmo_horario",
      intervaloMinutos: 60,
      periodos: [{ dia: "segunda", inicio: "09:00", fim: "17:00" }],
    });
  });

  it("CSS: tabela vira cartões em 375 px; só tokens", () => {
    const css = readFileSync(resolve(__dirname, "TurnosScreen.css"), "utf8");
    expect(css).toMatch(/@container \(min-width: \d+rem\)/);
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(css).not.toMatch(/\bwidth:\s*\d{3,}px/);
  });
});
