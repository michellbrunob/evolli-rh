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

type Dublê = ServicoDeEscala & {
  consultar: ReturnType<typeof vi.fn>;
  turnos: ReturnType<typeof vi.fn>;
  definir: ReturnType<typeof vi.fn>;
  encerrar: ReturnType<typeof vi.fn>;
};

function servicoCom(
  escalas: EscalaApi[],
  escalaDoCadastro: string | null = null,
): Dublê {
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
      podeOperar
      hoje={HOJE}
      servico={servico}
      {...extra}
    />,
  );
}

async function abrirGaveta(nome: "Definir escala" | "Alterar escala") {
  const botao = await screen.findByRole("button", { name: nome });
  botao.focus();
  fireEvent.click(botao);
  return screen.findByRole("dialog", {
    name:
      nome === "Definir escala"
        ? "Definir padrão de escala"
        : "Alterar padrão de escala",
  });
}

const muda = (g: HTMLElement) =>
  within(g).getByRole("region", { name: "O que muda" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("T215 — aba Escala (padrão de escala)", () => {
  it("carregando e depois o estado vazio, com Definir e Jornadas de trabalho", async () => {
    let soltar: (v: EscalasDoColaboradorApi) => void = () => undefined;
    const servico = servicoCom([]);
    servico.consultar.mockReturnValue(
      new Promise((r) => {
        soltar = r;
      }),
    );
    const onAbrirJornadas = vi.fn();
    montar(servico, { onAbrirJornadas });
    expect(await screen.findByText("Carregando escala…")).toBeInTheDocument();
    await act(async () => soltar(resposta([])));
    expect(
      await screen.findByRole("heading", { name: "Ana ainda não tem escala" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/os benefícios pagos por dia usam os dias úteis do mês/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver jornadas de trabalho" }),
    );
    expect(onAbrirJornadas).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Definir escala" }),
    ).toBeEnabled();
  });

  it("sem padrão, mas com a escala do cadastro: diz que ela vale hoje", async () => {
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

  it("escala atual: modelo, turno, horas por semana, dias no mês, vigência e os próximos dias", async () => {
    montar(servicoCom([escala("e1", "5x2", "2026-02-02", null)]));
    const atual = await screen.findByRole("region", { name: "Escala atual" });
    expect(atual).toHaveTextContent("5x2");
    expect(atual).toHaveTextContent("Segunda a sexta, folga sábado e domingo");
    expect(atual).toHaveTextContent("Vigente");
    expect(atual).toHaveTextContent("COM — Comercial");
    expect(atual).toHaveTextContent("09:00–18:00 · 1 h de intervalo");
    expect(atual).toHaveTextContent("40 h");
    expect(atual).toHaveTextContent("19 dias");
    expect(atual).toHaveTextContent("02/02/2026");
    const dias = within(
      screen.getByRole("list", { name: "Próximos 14 dias" }),
    ).getAllByRole("listitem");
    expect(dias).toHaveLength(14);
    expect(dias[0]).toHaveTextContent("Trabalho");
    expect(dias[4]).toHaveTextContent("Folga"); // sábado 28/11
  });

  it("6x1, outra, 12x36 com turno da noite: as particularidades aparecem no resumo", async () => {
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
    expect(atual).toHaveTextContent("Turno da noite");
    expect(atual).toHaveTextContent("EST — Estágio");
    expect(atual).toHaveTextContent("Início do ciclo");
    expect(atual).toHaveTextContent("01/11/2026");
    const linhas = within(
      screen.getByRole("list", { name: "Histórico de escalas" }),
    ).getAllByRole("listitem");
    expect(linhas.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Vigente"),
      expect.stringContaining("Encerrada"),
      expect.stringContaining("Encerrada"),
    ]);
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

  describe("gaveta Definir padrão de escala", () => {
    it("vem com 5x2, o primeiro turno e hoje; O que muda com horas e benefício do mês", async () => {
      montar(servicoCom([]));
      const g = await abrirGaveta("Definir escala");
      expect(within(g).getByLabelText("Escala")).toHaveValue("5x2");
      expect(within(g).getByLabelText("Turno")).toHaveValue("t1");
      expect(within(g).getByLabelText("Vale a partir de")).toHaveValue(HOJE);
      const m = muda(g);
      expect(m).toHaveTextContent("5x2");
      expect(m).toHaveTextContent("40 h");
      expect(m).toHaveTextContent("Benefício em nov.");
      expect(m).toHaveTextContent("19 dias");
    });

    it("com a escala do cadastro, ela vem escolhida", async () => {
      montar(servicoCom([], "6x1"));
      const g = await abrirGaveta("Definir escala");
      expect(within(g).getByLabelText("Escala")).toHaveValue("6x1");
    });

    it("cada modelo mostra só os campos dele", async () => {
      montar(servicoCom([]));
      const g = await abrirGaveta("Definir escala");
      const escolher = (v: string) =>
        fireEvent.change(within(g).getByLabelText("Escala"), {
          target: { value: v },
        });
      escolher("6x1");
      const dsr = within(g).getByRole("radiogroup", {
        name: "Folga semanal (DSR)",
      });
      expect(within(dsr).getByRole("radio", { name: "domingo" })).toBeChecked();
      expect(g).toHaveTextContent("Lei 10.101/2000");
      expect(within(g).queryByLabelText("Início do ciclo")).toBeNull();
      escolher("outra");
      const dias = within(g).getByRole("group", { name: "Dias de trabalho" });
      expect(
        within(dias)
          .getAllByRole("checkbox")
          .map((c) => (c as HTMLInputElement).checked),
      ).toEqual([true, true, true, true, true, false, false]);
      escolher("4x2");
      expect(within(g).getByLabelText("Início do ciclo")).toHaveValue(HOJE);
      expect(within(g).queryByLabelText("Turno da noite")).toBeNull();
      escolher("12x36");
      expect(within(g).getByLabelText("Turno da noite")).toHaveValue("");
      expect(g).toHaveTextContent("Um mês de dia, o seguinte de noite");
      expect(muda(g)).toHaveTextContent("28 h");
      fireEvent.change(within(g).getByLabelText("Turno da noite"), {
        target: { value: "t2" },
      });
      expect(muda(g)).toHaveTextContent("22 h 23");
      fireEvent.change(within(g).getByLabelText("Turno"), {
        target: { value: "sem" },
      });
      expect(muda(g)).toHaveTextContent("Sem turno");
      expect(muda(g)).toHaveTextContent("14 h 23");
    });

    it("grava só os campos do modelo e avisa; relê a lista", async () => {
      const servico = servicoCom([]);
      montar(servico);
      const g = await abrirGaveta("Definir escala");
      fireEvent.change(within(g).getByLabelText("Escala"), {
        target: { value: "6x1" },
      });
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
        await screen.findByText("Escala definida a partir de 24/11/2026."),
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("12x36: envia turno da noite e início do ciclo", async () => {
      const servico = servicoCom([]);
      montar(servico);
      const g = await abrirGaveta("Definir escala");
      fireEvent.change(within(g).getByLabelText("Escala"), {
        target: { value: "12x36" },
      });
      fireEvent.change(within(g).getByLabelText("Turno da noite"), {
        target: { value: "t2" },
      });
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
      fireEvent.change(within(g).getByLabelText("Escala"), {
        target: { value: "outra" },
      });
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

    it("alterar: começa depois da atual; o antes → depois mostra a escala atual", async () => {
      const servico = servicoCom([escala("e1", "5x2", HOJE, null)]);
      montar(servico);
      const g = await abrirGaveta("Alterar escala");
      // A data vem no dia seguinte ao início da atual.
      expect(within(g).getByLabelText("Vale a partir de")).toHaveValue(
        "2026-11-25",
      );
      fireEvent.change(within(g).getByLabelText("Vale a partir de"), {
        target: { value: HOJE },
      });
      fireEvent.change(within(g).getByLabelText("Escala"), {
        target: { value: "4x3" },
      });
      const m = muda(g);
      expect(m).toHaveTextContent("5x2");
      expect(m).toHaveTextContent("4x3");
      expect(m).toHaveTextContent("40 h");
      expect(m).toHaveTextContent("32 h");
      fireEvent.click(within(g).getByRole("button", { name: "Salvar padrão" }));
      expect(g).toHaveTextContent(
        "A nova escala precisa começar depois de 24/11/2026, início da atual.",
      );
      expect(within(g).getByLabelText("Vale a partir de")).toHaveFocus();
      expect(servico.definir).not.toHaveBeenCalled();
    });

    it("recusas do servidor no campo: sobreposição, igual à vigente, turno indisponível", async () => {
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
      expect(within(g).getByLabelText("Escala")).toHaveValue("5x2");
    });

    it("sem turno ativo: aponta Jornadas de trabalho", async () => {
      const servico = servicoCom([]);
      servico.turnos.mockResolvedValue([]);
      const onAbrirJornadas = vi.fn();
      montar(servico, { onAbrirJornadas });
      const g = await abrirGaveta("Definir escala");
      expect(within(g).getByLabelText("Turno")).toHaveValue("sem");
      expect(g).toHaveTextContent("Nenhum turno ativo na empresa.");
      fireEvent.click(
        within(g).getByRole("button", { name: "Criar ou ajustar turno" }),
      );
      expect(onAbrirJornadas).toHaveBeenCalledTimes(1);
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

  it("encerrar: pede o último dia, valida e envia o dia seguinte; o foco vai ao título", async () => {
    const servico = servicoCom([escala("e1", "5x2", "2026-02-02", null)]);
    montar(servico);
    fireEvent.click(
      await screen.findByRole("button", { name: "Encerrar escala" }),
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
      await screen.findByText(
        "Escala encerrada. O último dia nela é 31/12/2026.",
      ),
    ).toBeInTheDocument();
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
  });
});
