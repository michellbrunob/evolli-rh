import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/colaboradoresClient";
import type { TabelaHorarioApi } from "../../../../api/horariosClient";
import type {
  EscalaApi,
  EscalasDoColaboradorApi,
} from "../../../../api/escalaClient";
import { AbaEscala, type ServicoDeEscala } from "./AbaEscala";

const HOJE = "2026-11-24";
const COLAB = "c0000000-0000-4000-8000-000000000001";
const UTEIS = ["segunda", "terca", "quarta", "quinta", "sexta"];
const GRADE_COMERCIAL = UTEIS.flatMap((dia) => [
  { dia, inicio: "09:00", fim: "12:00" },
  { dia, inicio: "13:00", fim: "18:00" },
]);
const GRADE_ESTAGIO = UTEIS.flatMap((dia) => [
  { dia, inicio: "09:00", fim: "12:00" },
  { dia, inicio: "12:15", fim: "15:00" },
]);

function turno(
  id: string,
  nome: string,
  codigo: string,
  periodos = GRADE_COMERCIAL,
): TabelaHorarioApi {
  return {
    id,
    empresaId: "e1",
    codigo,
    nome,
    ativo: true,
    criadoPorUserId: "u1",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    periodos,
  };
}

const COMERCIAL = turno("t1", "Comercial", "COM");
const ESTAGIO = turno("t2", "Estágio", "EST", GRADE_ESTAGIO);

function escala(
  id: string,
  modelo: string,
  inicio: string,
  fim: string | null,
  extra: Partial<EscalaApi> = {},
): EscalaApi {
  return {
    id,
    modelo,
    turno: {
      id: COMERCIAL.id,
      codigo: COMERCIAL.codigo,
      nome: COMERCIAL.nome,
      ativo: true,
      periodos: GRADE_COMERCIAL,
    },
    turnoNoite: null,
    folgaSemanal: modelo === "6x1" ? 7 : null,
    diasTrabalho: [],
    inicioCiclo: null,
    vigenciaInicio: inicio,
    vigenciaFim: fim,
    definidaEm: `${inicio}T12:00:00.000Z`,
    definidaPor: "Rita RH",
    ...extra,
  };
}

function resposta(
  escalas: EscalaApi[],
  escalaDoCadastro: string | null = null,
): EscalasDoColaboradorApi {
  return {
    colaboradorId: COLAB,
    empresaId: "e1",
    vinculo: { dataAdmissao: "2026-01-05", situacao: "ativo" },
    escalaDoCadastro,
    escalas,
  };
}

type Duble = ServicoDeEscala & {
  consultar: ReturnType<typeof vi.fn>;
  turnos: ReturnType<typeof vi.fn>;
  definir: ReturnType<typeof vi.fn>;
  encerrar: ReturnType<typeof vi.fn>;
};

function servicoCom(
  escalas: EscalaApi[],
  escalaDoCadastro: string | null = null,
): Duble {
  const r = resposta(escalas, escalaDoCadastro);
  return {
    consultar: vi.fn().mockResolvedValue(r),
    turnos: vi.fn().mockResolvedValue([COMERCIAL, ESTAGIO]),
    definir: vi.fn().mockResolvedValue(r),
    encerrar: vi.fn().mockResolvedValue(r),
  };
}

function montar(
  servico: ServicoDeEscala,
  extra: Partial<Parameters<typeof AbaEscala>[0]> = {},
) {
  return render(
    <AbaEscala
      colaboradorId={COLAB}
      nome="Ana Souza"
      primeiroNome="Ana"
      detalhe="Analista · CLT"
      podeOperar
      hoje={HOJE}
      servico={servico}
      {...extra}
    />,
  );
}

async function abrirGaveta(botao: "Definir escala" | "Alterar padrão") {
  const b = await screen.findByRole("button", { name: botao });
  b.focus();
  fireEvent.click(b);
  return screen.findByRole("dialog", {
    name:
      botao === "Definir escala"
        ? "Definir padrão de escala"
        : "Alterar padrão de escala",
  });
}

/** Abre o seletor rico pelo teclado e escolhe a opção. */
async function escolher(raiz: HTMLElement, campo: string, opcao: RegExp) {
  const gatilho = within(raiz).getByRole("button", { name: campo });
  fireEvent.keyDown(gatilho, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitemradio", { name: opcao }));
  await waitFor(() =>
    expect(screen.queryByRole("menuitemradio", { name: opcao })).toBeNull(),
  );
}

const gatilho = (g: HTMLElement, campo: string) =>
  within(g).getByRole("button", { name: campo });
const muda = (g: HTMLElement) =>
  within(g).getByRole("region", { name: "O que muda" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("T215 — aba Escala (desenho da referência)", () => {
  it("carregando e o estado vazio: Abrir o quadro e Definir escala", async () => {
    let soltar: (v: EscalasDoColaboradorApi) => void = () => undefined;
    const servico = servicoCom([]);
    servico.consultar.mockReturnValue(
      new Promise((r) => {
        soltar = r;
      }),
    );
    const onAbrirQuadro = vi.fn();
    montar(servico, { onAbrirQuadro });
    expect(await screen.findByText("Carregando escala…")).toBeInTheDocument();
    await act(async () => soltar(resposta([])));
    expect(
      await screen.findByRole("heading", { name: "Ana ainda não tem escala" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sem escala, os benefícios pagos por dia usam os dias úteis do mês. Defina a escala aqui ou aplique um modelo para várias pessoas no quadro.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir o quadro" }));
    expect(onAbrirQuadro).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Definir escala" }),
    ).toBeEnabled();
  });

  it("sem padrão, com a escala do cadastro: diz que ela vale hoje", async () => {
    montar(servicoCom([], "6x1"));
    expect(
      await screen.findByText(/Hoje vale a escala do cadastro \(6x1\)/),
    ).toBeInTheDocument();
  });

  it("só consulta (master): nenhum controle de escrita e o catálogo não é lido", async () => {
    const servico = servicoCom([escala("e1", "5x2", "2026-02-02", null)]);
    montar(servico, { podeOperar: false });
    await screen.findByRole("heading", { name: "Escala atual" });
    expect(
      screen.queryByRole("button", { name: /Definir|Alterar|Encerrar/ }),
    ).toBeNull();
    expect(
      screen.getByText(/Somente consulta: RH e DP definem/),
    ).toBeInTheDocument();
    expect(servico.turnos).not.toHaveBeenCalled();
  });

  it("Escala atual: modelo, turno, desde quando, quem definiu e os indicadores", async () => {
    montar(servicoCom([escala("e1", "5x2", "2026-02-02", null)]));
    const atual = await screen.findByRole("region", { name: "Escala atual" });
    expect(atual).toHaveTextContent(
      "Definida na ficha em 02/02/2026 · Rita RH",
    );
    expect(atual).toHaveTextContent("5x2");
    expect(atual).toHaveTextContent("Comercial");
    expect(atual).toHaveTextContent(
      "09:00–18:00 · 1 h de intervalo · desde 02/02/2026",
    );
    // T215 — sem jornada no contrato, vale o limite legal da data (44 h).
    expect(atual).toHaveTextContent("44 h");
    expect(atual).toHaveTextContent("por semana");
    expect(atual).toHaveTextContent("19 dias");
    expect(atual).toHaveTextContent("de benefício em nov.");
  });

  it("Próximos 7 dias: hoje, amanhã, os dias da semana, folga e DSR, não publicado", async () => {
    montar(servicoCom([escala("e1", "5x2", "2026-02-02", null)]));
    const dias = within(
      await screen.findByRole("list", { name: "Próximos 7 dias" }),
    ).getAllByRole("listitem");
    expect(dias).toHaveLength(7);
    expect(dias[0]).toHaveTextContent("Hoje");
    expect(dias[0]).toHaveTextContent("Comercial");
    expect(dias[1]).toHaveTextContent("Amanhã");
    expect(dias[2]).toHaveTextContent("Qui, 26/11");
    expect(dias[4]).toHaveTextContent(/^Sáb, 28\/11Folga/);
    expect(dias[5]).toHaveTextContent("Folga · DSR");
    expect(dias[0]).toHaveTextContent("Não publicado");
  });

  it("calendário do mês: totais, feriados e navegação", async () => {
    montar(servicoCom([escala("e1", "5x2", "2026-02-02", null)]));
    const mes = await screen.findByRole("region", { name: "Novembro de 2026" });
    expect(mes).toHaveTextContent(
      "21 dias de trabalho · 168 h previstas · ainda não publicada",
    );
    const dias = within(
      within(mes).getByRole("list", { name: "Dias de Novembro de 2026" }),
    ).getAllByRole("listitem");
    expect(dias.find((d) => d.textContent?.startsWith("2"))).toHaveTextContent(
      "Finados",
    );
    expect(
      dias.find((d) => d.getAttribute("aria-current") === "date"),
    ).toHaveTextContent("24");
    fireEvent.click(within(mes).getByRole("button", { name: "Próximo mês" }));
    expect(
      screen.getByRole("region", { name: "Dezembro de 2026" }),
    ).toBeInTheDocument();
  });

  it("histórico: período, origem, quem e quando; particularidades de 6x1, outra e 12x36", async () => {
    montar(
      servicoCom([
        escala("e3", "12x36", "2026-11-01", null, {
          inicioCiclo: "2026-11-01",
          turnoNoite: {
            id: ESTAGIO.id,
            codigo: ESTAGIO.codigo,
            nome: ESTAGIO.nome,
            ativo: true,
            periodos: GRADE_ESTAGIO,
          },
        }),
        escala("e2", "outra", "2026-06-01", "2026-11-01", {
          diasTrabalho: [1, 3, 5],
        }),
        escala("e1", "6x1", "2026-02-02", "2026-06-01", { folgaSemanal: 3 }),
      ]),
    );
    const atual = await screen.findByRole("region", { name: "Escala atual" });
    expect(atual).toHaveTextContent("turno da noite");
    expect(atual).toHaveTextContent("Estágio");
    expect(atual).toHaveTextContent("início do ciclo");
    const linhas = within(
      screen.getByRole("list", { name: "Histórico da escala" }),
    ).getAllByRole("listitem");
    expect(linhas[0]).toHaveTextContent("Vigente");
    expect(linhas[0]).toHaveTextContent(
      "01/11/2026 até atual · Ficha do colaborador · Rita RH em 01/11/2026",
    );
    expect(linhas[1]).toHaveTextContent("Encerrada");
    expect(linhas[1]).toHaveTextContent("01/06/2026 até 31/10/2026");
    expect(linhas[1]).toHaveTextContent("segunda, quarta e sexta");
    expect(linhas[2]).toHaveTextContent("Folga semanal: quarta");
  });

  it("falha ao carregar: alerta e tentar de novo", async () => {
    const servico = servicoCom([]);
    servico.consultar.mockRejectedValueOnce(new ApiError(500, "x"));
    montar(servico);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a escala.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("heading", { name: "Ana ainda não tem escala" });
  });

  describe("gaveta Definir/Alterar padrão de escala", () => {
    it("cabeçalho da pessoa; vem com 5x2, o primeiro turno e hoje; O que muda", async () => {
      montar(servicoCom([]));
      const g = await abrirGaveta("Definir escala");
      expect(g).toHaveTextContent("Ana Souza · Analista · CLT");
      expect(gatilho(g, "Escala")).toHaveTextContent(
        "5x2Segunda a sexta, folga sábado e domingo",
      );
      expect(gatilho(g, "Turno")).toHaveTextContent(
        "Comercial09:00–18:00 · 1 h de intervalo",
      );
      expect(within(g).getByLabelText("Vale a partir de")).toHaveValue(HOJE);
      expect(g).toHaveTextContent(
        "Dias já publicados não mudam. O quadro usa o padrão novo a partir dessa data.",
      );
      const m = muda(g);
      expect(m).toHaveTextContent("Escala");
      expect(m).toHaveTextContent("Horas por semana");
      expect(m).toHaveTextContent("40 h");
      expect(m).toHaveTextContent("Benefício em nov.");
      expect(m).toHaveTextContent("19 dias");
    });

    it("com a escala do cadastro: ela vem escolhida e sai do O que muda", async () => {
      montar(servicoCom([], "6x1"));
      const g = await abrirGaveta("Definir escala");
      expect(gatilho(g, "Escala")).toHaveTextContent("6x1");
      expect(
        within(muda(g))
          .getAllByRole("term")
          .map((t) => t.textContent),
      ).toEqual(["Turno", "Horas por semana", "Benefício em nov."]);
    });

    it("lista de escalas agrupada, com descrição e ✓ na escolhida", async () => {
      montar(servicoCom([]));
      const g = await abrirGaveta("Definir escala");
      fireEvent.keyDown(gatilho(g, "Escala"), { key: "Enter" });
      const menu = await screen.findByRole("menu");
      expect(menu).toHaveTextContent("Dias fixos na semana");
      expect(menu).toHaveTextContent("Plantão em horas");
      expect(
        within(menu).getByRole("menuitemradio", { name: /^5x2/ }),
      ).toHaveAttribute("aria-checked", "true");
      expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(25);
      fireEvent.keyDown(menu, { key: "Escape" });
    });

    it("cada modelo mostra só os campos dele", async () => {
      montar(servicoCom([]));
      const g = await abrirGaveta("Definir escala");
      await escolher(g, "Escala", /^6x1/);
      const dsr = within(g).getByRole("radiogroup", {
        name: "Folga semanal (DSR)",
      });
      expect(within(dsr).getByRole("radio", { name: "domingo" })).toBeChecked();
      expect(g).toHaveTextContent("Lei 10.101/2000");
      expect(within(g).queryByLabelText("Início do ciclo")).toBeNull();
      await escolher(g, "Escala", /^Outra/);
      const dias = within(g).getByRole("group", { name: "Dias de trabalho" });
      expect(
        within(dias)
          .getAllByRole("checkbox")
          .map((c) => (c as HTMLInputElement).checked),
      ).toEqual([true, true, true, true, true, false, false]);
      await escolher(g, "Escala", /^4x2/);
      expect(within(g).getByLabelText("Início do ciclo")).toHaveValue(HOJE);
      expect(
        within(g).queryByRole("button", { name: "Turno da noite" }),
      ).toBeNull();
      await escolher(g, "Escala", /^12x36/);
      expect(gatilho(g, "Turno da noite")).toHaveTextContent(
        "Mesmo turno em todos os plantões",
      );
      expect(g).toHaveTextContent("Um mês de dia, o seguinte de noite");
      expect(muda(g)).toHaveTextContent("28 h");
      await escolher(g, "Turno da noite", /^Estágio/);
      expect(muda(g)).toHaveTextContent("22 h 23");
      await escolher(g, "Turno", /^Sem turno fixo/);
      expect(muda(g)).toHaveTextContent("Sem turno");
      expect(muda(g)).toHaveTextContent("14 h 23");
    });

    it("grava só os campos do modelo e avisa", async () => {
      const servico = servicoCom([]);
      montar(servico);
      const g = await abrirGaveta("Definir escala");
      await escolher(g, "Escala", /^6x1/);
      fireEvent.click(within(g).getByRole("radio", { name: "quarta" }));
      fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
      await waitFor(() =>
        expect(servico.definir).toHaveBeenCalledWith(COLAB, {
          modelo: "6x1",
          tabelaHorarioId: "t1",
          folgaSemanal: 3,
          vigenciaInicio: HOJE,
        }),
      );
      expect(
        await screen.findByRole("status", {
          name: "Padrão de escala definido",
        }),
      ).toHaveTextContent("Vale a partir de 24/11/2026.");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("12x36: envia turno da noite e início do ciclo", async () => {
      const servico = servicoCom([]);
      montar(servico);
      const g = await abrirGaveta("Definir escala");
      await escolher(g, "Escala", /^12x36/);
      await escolher(g, "Turno da noite", /^Estágio/);
      fireEvent.change(within(g).getByLabelText("Início do ciclo"), {
        target: { value: "2026-11-25" },
      });
      fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
      await waitFor(() =>
        expect(servico.definir).toHaveBeenCalledWith(COLAB, {
          modelo: "12x36",
          tabelaHorarioId: "t1",
          turnoNoiteId: "t2",
          inicioCiclo: "2026-11-25",
          vigenciaInicio: HOJE,
        }),
      );
    });

    it("valida no cliente e foca o primeiro erro: dias vazios, data antes da admissão", async () => {
      const servico = servicoCom([]);
      montar(servico);
      const g = await abrirGaveta("Definir escala");
      await escolher(g, "Escala", /^Outra/);
      const dias = within(g).getByRole("group", { name: "Dias de trabalho" });
      for (const c of within(dias).getAllByRole("checkbox")) {
        if ((c as HTMLInputElement).checked) fireEvent.click(c);
      }
      fireEvent.change(within(g).getByLabelText("Vale a partir de"), {
        target: { value: "2025-12-31" },
      });
      fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
      expect(g).toHaveTextContent("Escolha ao menos um dia de trabalho.");
      expect(g).toHaveTextContent(
        "A escala não pode começar antes da admissão (05/01/2026).",
      );
      expect(within(dias).getAllByRole("checkbox")[0]).toHaveFocus();
      expect(servico.definir).not.toHaveBeenCalled();
    });

    it("alterar: título, antes › depois, e não começa antes da atual", async () => {
      const servico = servicoCom([escala("e1", "5x2", HOJE, null)]);
      montar(servico);
      const g = await abrirGaveta("Alterar padrão");
      expect(within(g).getByLabelText("Vale a partir de")).toHaveValue(HOJE);
      await escolher(g, "Escala", /^4x3/);
      const m = muda(g);
      expect(m).toHaveTextContent("5x2");
      expect(m).toHaveTextContent("4x3");
      expect(m).toHaveTextContent("40 h");
      expect(m).toHaveTextContent("32 h");
      fireEvent.change(within(g).getByLabelText("Vale a partir de"), {
        target: { value: "2026-11-20" },
      });
      fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
      expect(g).toHaveTextContent(
        "A nova escala não pode começar antes de 24/11/2026, início da atual.",
      );
      expect(within(g).getByLabelText("Vale a partir de")).toHaveFocus();
      expect(servico.definir).not.toHaveBeenCalled();
    });

    it("recusas do servidor: sobreposição e turno indisponível", async () => {
      const servico = servicoCom([]);
      servico.definir
        .mockRejectedValueOnce(
          new ApiError(409, "x", {
            erros: [{ campo: "vigenciaInicio", motivo: "sobreposta" }],
          }),
        )
        .mockRejectedValueOnce(
          new ApiError(422, "x", {
            erros: [{ campo: "tabelaHorarioId", motivo: "indisponivel" }],
          }),
        );
      montar(servico);
      const g = await abrirGaveta("Definir escala");
      fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
      expect(
        await within(g).findByText(
          "Este período cruza outra escala. Escolha outra data.",
        ),
      ).toBeInTheDocument();
      fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
      expect(
        await within(g).findByText(
          "Este turno não está disponível. Escolha um turno ativo.",
        ),
      ).toBeInTheDocument();
      expect(gatilho(g, "Escala")).toHaveTextContent("5x2");
    });

    it("sem turno ativo: Sem turno fixo e o aviso", async () => {
      const servico = servicoCom([]);
      servico.turnos.mockResolvedValue([]);
      montar(servico);
      const g = await abrirGaveta("Definir escala");
      expect(gatilho(g, "Turno")).toHaveTextContent("Sem turno fixo");
      expect(g).toHaveTextContent("Nenhum turno ativo na empresa.");
    });

    it("Escape fecha a gaveta limpa e o foco volta ao botão", async () => {
      montar(servicoCom([]));
      const g = await abrirGaveta("Definir escala");
      fireEvent.keyDown(g, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Definir escala" }),
        ).toHaveFocus(),
      );
    });
  });

  it("encerrar pela gaveta de alteração: último dia, validação, dia seguinte e foco no título", async () => {
    const servico = servicoCom([escala("e1", "5x2", "2026-02-02", null)]);
    montar(servico);
    const alterar = await abrirGaveta("Alterar padrão");
    fireEvent.click(
      within(alterar).getByRole("button", { name: "Encerrar escala" }),
    );
    const g = await screen.findByRole("dialog", { name: "Encerrar escala" });
    const ultimo = within(g).getByLabelText("Último dia na escala");
    fireEvent.change(ultimo, { target: { value: "2026-02-01" } });
    fireEvent.click(within(g).getByRole("button", { name: "Encerrar escala" }));
    expect(g).toHaveTextContent(
      "O último dia não pode ser antes de 02/02/2026, início da escala.",
    );
    expect(ultimo).toHaveFocus();
    fireEvent.change(ultimo, { target: { value: "2026-12-31" } });
    fireEvent.click(within(g).getByRole("button", { name: "Encerrar escala" }));
    await waitFor(() =>
      expect(servico.encerrar).toHaveBeenCalledWith(COLAB, "e1", "2027-01-01"),
    );
    expect(
      await screen.findByRole("status", { name: "Escala encerrada" }),
    ).toHaveTextContent("O último dia nela é 31/12/2026.");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Escala atual" }),
      ).toHaveFocus(),
    );
  });

  it("CSS: uma coluna em 375 px, sem largura fixa nem cor literal", () => {
    const css = readFileSync(resolve(__dirname, "AbaEscala.css"), "utf8");
    expect(css).toMatch(/@container \(min-width: \d+rem\)/);
    expect(css).not.toMatch(/\bwidth:\s*\d{3,}px/);
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    // A lista do seletor fica ACIMA da gaveta (camada 100): por trás dela,
    // o clique não chega nas opções e não dá para trocar o padrão.
    const camada = /\.seletor-rico__lista\s*\{[^}]*z-index:\s*(\d+)/.exec(css);
    expect(Number(camada?.[1])).toBeGreaterThan(100);
  });
});

describe("T215 — Escala atual e gaveta como na referência (regras e explicações)", () => {
  const indicador = (valor: string) =>
    screen
      .getByText(valor, { selector: "dd" })
      .closest(".escala-ficha__indicador") as HTMLElement;

  it("por semana: o menor entre a jornada do contrato e o limite da data (EC 141/2026), com a explicação", async () => {
    montar(servicoCom([escala("e1", "6x1", "2026-02-02", null)]), {
      jornadaContratoHoras: 44,
      local: "Matriz Sintética",
    });
    await screen.findByRole("region", { name: "Escala atual" });
    // 6 dias de 8 h dariam 48 h; vale o limite: 44 h.
    expect(indicador("44 h")).toHaveAccessibleDescription(
      "Jornada por semana Pela jornada do contrato e pela data (EC 141/2026): vale o menor limite.",
    );
    expect(indicador("26 dias")).toHaveAccessibleDescription(
      "26 dias de benefício em novembro Pelo catálogo (6x1).",
    );
    expect(indicador("Matriz Sintética")).toHaveTextContent("local");
  });

  it("5x2: benefício pelos dias úteis; sem contrato vale o limite legal da data", async () => {
    montar(servicoCom([escala("e1", "5x2", "2026-02-02", null)]));
    await screen.findByRole("region", { name: "Escala atual" });
    expect(indicador("19 dias")).toHaveAccessibleDescription(
      "19 dias de benefício em novembro Pelos dias úteis do mês (sem escala no catálogo).",
    );
    // O card não soma o turno (5 × 8 h): sem contrato, vale o limite da data.
    expect(indicador("44 h")).toHaveTextContent("por semana");
    expect(screen.queryByText("local")).toBeNull();
  });

  it.each([
    ["2026-12-20", 44, "42 h"],
    ["2027-12-20", 44, "40 h"],
    ["2026-11-24", 36, "36 h"],
  ])("em %s, com contrato de %i h: %s", async (hoje, contrato, esperado) => {
    montar(servicoCom([escala("e1", "6x1", "2026-02-02", null)]), {
      hoje,
      jornadaContratoHoras: contrato,
    });
    await screen.findByRole("region", { name: "Escala atual" });
    expect(indicador(esperado)).toHaveTextContent("por semana");
  });

  it("intervalo do turno: um período corrido com 1 h de intervalo conta 8 h por dia na gaveta", async () => {
    const corrido = UTEIS.map((dia) => ({
      dia,
      inicio: "08:00",
      fim: "17:00",
    }));
    montar(
      servicoCom([
        escala("e1", "5x2", "2026-02-02", null, {
          turno: {
            id: "t9",
            codigo: "COR",
            nome: "Corrido",
            ativo: true,
            periodos: corrido,
            intervaloMinutos: 60,
          },
        }),
      ]),
    );
    const atual = await screen.findByRole("region", { name: "Escala atual" });
    expect(atual).toHaveTextContent("08:00–17:00 · 1 h de intervalo");
    const g = await abrirGaveta("Alterar padrão");
    expect(g.textContent).toMatch(/Horas por semana40 h/);
  });

  it("salvar: aviso flutuante verde com título e a data, que some ao fechar", async () => {
    const servico = servicoCom([escala("e1", "5x2", "2026-02-02", null)]);
    montar(servico);
    const g = await abrirGaveta("Alterar padrão");
    await escolher(g, "Escala", /^6x1/);
    fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
    const aviso = await screen.findByRole("status", {
      name: "Padrão de escala alterado",
    });
    expect(aviso).toHaveClass("aviso-flutuante");
    expect(aviso).toHaveTextContent("Vale a partir de 24/11/2026.");
    fireEvent.click(
      within(aviso).getByRole("button", { name: "Fechar aviso" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: "Padrão de escala alterado" }),
      ).toBeNull(),
    );
  });
});

describe("T215 — aviso de legislação na gaveta", () => {
  it("6x1 com turno de 8 h: avisa na gaveta que passa do limite semanal, sem impedir salvar", async () => {
    const servico = servicoCom([escala("e1", "5x2", "2026-02-02", null)]);
    montar(servico, { jornadaContratoHoras: 44 });
    const g = await abrirGaveta("Alterar padrão");
    expect(
      within(g).queryByRole("note", { name: "Atenção à legislação" }),
    ).toBeNull();
    await escolher(g, "Escala", /^6x1/);
    const nota = within(g).getByRole("note", { name: "Atenção à legislação" });
    expect(nota).toHaveTextContent(
      "Este padrão soma 48 h por semana, acima do limite de 44 h",
    );
    fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
    await waitFor(() => expect(servico.definir).toHaveBeenCalled());
  });
});

describe("T215 — calendário do mês como o da referência", () => {
  it("semanas completas: as células depois do último dia ficam vazias", async () => {
    montar(servicoCom([escala("e1", "6x1", "2026-02-02", null)]));
    const grade = await screen.findByRole("list", {
      name: "Dias de Novembro de 2026",
    });
    const celulas = grade.querySelectorAll("li");
    expect(celulas.length % 7).toBe(0);
    // Novembro de 2026 começa no domingo e tem 30 dias: 5 vazias no fim.
    const vazias = grade.querySelectorAll("li.escala-ficha__celula--vazia");
    expect(vazias).toHaveLength(5);
    expect(celulas[celulas.length - 1]).toHaveClass(
      "escala-ficha__celula--vazia",
    );
  });

  it("CSS: sigla quadrada, horário apagado e o sublinhado só na tela estreita", () => {
    const css = readFileSync(resolve(__dirname, "AbaEscala.css"), "utf8");
    const regra = (seletor: string) => {
      const inicio = css.indexOf(`${seletor} {`);
      return inicio < 0 ? "" : css.slice(inicio, css.indexOf("}", inicio));
    };
    expect(regra(".escala-ficha__sigla")).not.toMatch(/radius-sm|radius-pill/);
    expect(regra(".escala-ficha__celula-turno")).toMatch(/color-ink-muted/);
    expect(regra(".escala-ficha__celula--vazia")).toMatch(/background/);
    // O sublinhado do número só existe dentro de @container (max-width).
    const sublinhado = css.indexOf("text-decoration: underline");
    expect(sublinhado).toBeGreaterThan(0);
    const consulta = css.lastIndexOf("@container", sublinhado);
    expect(
      css.slice(consulta, sublinhado).startsWith("@container (max-width:"),
    ).toBe(true);
  });
});

describe("T215 — legenda dos feriados no plural certo", () => {
  it("conta os feriados do mês: 3 feriados em novembro, 1 feriado em dezembro", async () => {
    montar(servicoCom([escala("e1", "5x2", "2026-02-02", null)]));
    const legenda = () =>
      document.querySelector(".escala-ficha__legenda") as HTMLElement;
    await waitFor(() => expect(legenda()).toHaveTextContent("3 feriados"));
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await waitFor(() => expect(legenda()).toHaveTextContent("1 feriado"));
    expect(legenda()).not.toHaveTextContent("1 feriados");
  });

  it('um só dia de trabalho no mês: "1 dia de trabalho"', async () => {
    montar(servicoCom([escala("e1", "5x2", "2026-11-30", null)]));
    expect(
      await screen.findByText(/^1 dia de trabalho · /),
    ).toBeInTheDocument();
  });
});
