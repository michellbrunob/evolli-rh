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
import { ApiError } from "../../../../api/horariosClient";
import type { TabelaHorarioApi } from "../../../../api/horariosClient";
import type { VinculoHorarioApi } from "../../../../api/vinculoHorarioClient";
import { AbaEscala, type ServicoDeEscala } from "./AbaEscala";

const HOJE = "2026-11-24";
const COLAB = "c0000000-0000-4000-8000-000000000001";

const GRADE_44 = ["segunda", "terca", "quarta", "quinta", "sexta"].flatMap(
  (dia) => [
    { dia, inicio: "08:00", fim: "12:00" },
    { dia, inicio: "13:00", fim: "17:48" },
  ],
);
const GRADE_30 = ["segunda", "terca", "quarta", "quinta", "sexta"].map(
  (dia) => ({ dia, inicio: "09:00", fim: "15:00" }),
);

function jornada(
  id: string,
  nome: string,
  codigo: string,
  periodos = GRADE_44,
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

const COMERCIAL = jornada("j1", "Comercial", "COM44");
const MEIO = jornada("j2", "Meio período", "MEIO30", GRADE_30);

function vinculo(
  id: string,
  j: TabelaHorarioApi,
  inicio: string,
  fim: string | null,
  ativo = true,
): VinculoHorarioApi {
  return {
    id,
    colaboradorId: COLAB,
    empresaId: "e1",
    tabelaHorarioId: j.id,
    tabela: {
      id: j.id,
      codigo: j.codigo,
      nome: j.nome,
      ativo,
      periodos: j.periodos,
    },
    vigenciaInicio: inicio,
    vigenciaFim: fim,
    criadoPorUserId: "u1",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
  };
}

function servicoCom(historico: VinculoHorarioApi[]): ServicoDeEscala & {
  historico: ReturnType<typeof vi.fn>;
  jornadas: ReturnType<typeof vi.fn>;
  atribuir: ReturnType<typeof vi.fn>;
  encerrar: ReturnType<typeof vi.fn>;
} {
  return {
    historico: vi.fn().mockResolvedValue(historico),
    jornadas: vi.fn().mockResolvedValue([COMERCIAL, MEIO]),
    atribuir: vi.fn().mockResolvedValue(historico[0] ?? null),
    encerrar: vi.fn().mockResolvedValue(historico[0] ?? null),
  };
}

function montar(
  servico: ServicoDeEscala,
  extra: Partial<Parameters<typeof AbaEscala>[0]> = {},
) {
  return render(
    <AbaEscala
      colaboradorId={COLAB}
      doNome="da Ana"
      dataAdmissao="2026-01-05"
      podeOperar
      hoje={HOJE}
      servico={servico}
      {...extra}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("T215 — aba Escala da ficha", () => {
  it("carregando: esqueleto acessível; depois, o conteúdo", async () => {
    let soltar: (v: VinculoHorarioApi[]) => void = () => undefined;
    const servico = servicoCom([]);
    servico.historico.mockReturnValue(
      new Promise<VinculoHorarioApi[]>((r) => {
        soltar = r;
      }),
    );
    montar(servico);
    expect(await screen.findByText("Carregando escala…")).toBeInTheDocument();
    await act(async () => soltar([]));
    expect(
      await screen.findByRole("heading", { name: "Escala ainda não definida" }),
    ).toBeInTheDocument();
  });

  it("sem escala, quem opera: definir e ir a Jornadas de trabalho", async () => {
    const onAbrirJornadas = vi.fn();
    montar(servicoCom([]), { onAbrirJornadas });
    await screen.findByRole("heading", { name: "Escala ainda não definida" });
    expect(screen.getByText(/Defina a jornada da Ana/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver jornadas de trabalho" }),
    );
    expect(onAbrirJornadas).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Definir escala" }),
    ).toBeInTheDocument();
  });

  it("sem escala, só consulta (master, gestor e demais): nenhum controle de escrita", async () => {
    const servico = servicoCom([vinculo("v1", COMERCIAL, "2026-02-02", null)]);
    montar(servico, { podeOperar: false });
    await screen.findByRole("heading", { name: "Escala atual" });
    expect(
      screen.queryByRole("button", { name: /Definir|Alterar|Encerrar/ }),
    ).toBeNull();
    expect(
      screen.getByText(/Somente consulta: RH e DP definem/),
    ).toBeInTheDocument();
    // Quem não opera não lê o catálogo de jornadas.
    expect(servico.jornadas).not.toHaveBeenCalled();
  });

  it("vigente: jornada, carga semanal, dias, horário, intervalo, vigência e a semana com folgas", async () => {
    montar(servicoCom([vinculo("v1", COMERCIAL, "2026-02-02", null)]));
    const atual = await screen.findByRole("region", { name: "Escala atual" });
    expect(atual).toHaveTextContent("COM44 — Comercial");
    expect(atual).toHaveTextContent("Vigente");
    expect(atual).toHaveTextContent("44 h");
    expect(atual).toHaveTextContent("Segunda a sexta");
    expect(atual).toHaveTextContent("08:00–17:48");
    expect(atual).toHaveTextContent("1 h por dia");
    expect(atual).toHaveTextContent("02/02/2026");
    const semana = screen.getByRole("list", { name: "Semana de trabalho" });
    const dias = within(semana).getAllByRole("listitem");
    expect(dias).toHaveLength(7);
    expect(dias[0]).toHaveTextContent("Seg");
    expect(dias[0]).toHaveTextContent("08:00–12:00");
    expect(dias[0]).toHaveTextContent("13:00–17:48");
    expect(dias[6]).toHaveTextContent("Folga");
  });

  it("programada e encerrada: situações no histórico, do mais novo ao mais antigo", async () => {
    montar(
      servicoCom([
        vinculo("v3", MEIO, "2026-12-01", null),
        vinculo("v2", COMERCIAL, "2026-03-01", "2026-12-01"),
        vinculo("v1", MEIO, "2026-01-05", "2026-03-01", false),
      ]),
    );
    const historico = await screen.findByRole("list", {
      name: "Histórico de escalas",
    });
    const linhas = within(historico).getAllByRole("listitem");
    expect(linhas.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Programada"),
      expect.stringContaining("Vigente"),
      expect.stringContaining("Encerrada"),
    ]);
    expect(linhas[2]).toHaveTextContent("Jornada inativa");
    expect(linhas[1]).toHaveTextContent("01/03/2026 a 30/11/2026");
    expect(screen.getByText(/A partir de 01\/12\/2026/)).toBeInTheDocument();
  });

  it("só encerradas: diz que não há escala vigente hoje", async () => {
    montar(servicoCom([vinculo("v1", COMERCIAL, "2026-02-02", "2026-06-01")]));
    expect(
      await screen.findByText(/Sem escala vigente hoje/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Definir escala" }),
    ).toBeInTheDocument();
  });

  it("falha ao carregar: alerta e tentar de novo", async () => {
    const servico = servicoCom([]);
    servico.historico.mockRejectedValueOnce(new ApiError(500, "x"));
    montar(servico);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a escala.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("heading", { name: "Escala ainda não definida" });
    expect(servico.historico).toHaveBeenCalledTimes(2);
  });

  describe("definir e alterar", () => {
    async function abrirGaveta(nome: "Definir escala" | "Alterar escala") {
      const botao = await screen.findByRole("button", { name: nome });
      botao.focus();
      fireEvent.click(botao);
      return screen.findByRole("dialog", { name: nome });
    }

    it("valida no cliente, foca o primeiro erro e não envia", async () => {
      const servico = servicoCom([]);
      montar(servico);
      const gaveta = await abrirGaveta("Definir escala");
      const data = within(gaveta).getByLabelText("Vale a partir de");
      // Padrão: hoje (depois da admissão).
      expect(data).toHaveValue(HOJE);
      fireEvent.change(data, { target: { value: "2025-12-31" } });
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Salvar escala" }),
      );
      const select = within(gaveta).getByLabelText("Jornada");
      expect(select).toHaveAttribute("aria-invalid", "true");
      expect(select).toHaveFocus();
      expect(gaveta).toHaveTextContent("Escolha a jornada.");
      expect(gaveta).toHaveTextContent(
        "A escala não pode começar antes da admissão (05/01/2026).",
      );
      expect(servico.atribuir).not.toHaveBeenCalled();
    });

    it("mostra o que muda e grava; avisa e relê o histórico", async () => {
      const servico = servicoCom([]);
      montar(servico);
      const gaveta = await abrirGaveta("Definir escala");
      fireEvent.change(within(gaveta).getByLabelText("Jornada"), {
        target: { value: "j2" },
      });
      const muda = within(gaveta).getByRole("region", { name: "O que muda" });
      expect(muda).toHaveTextContent("Carga semanal");
      expect(muda).toHaveTextContent("30 h");
      expect(muda).toHaveTextContent("09:00–15:00");
      servico.historico.mockResolvedValueOnce([
        vinculo("v9", MEIO, HOJE, null),
      ]);
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Salvar escala" }),
      );
      await waitFor(() =>
        expect(servico.atribuir).toHaveBeenCalledWith({
          colaboradorId: COLAB,
          tabelaHorarioId: "j2",
          vigenciaInicio: HOJE,
        }),
      );
      expect(
        await screen.findByText("Escala definida a partir de 24/11/2026."),
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(servico.historico).toHaveBeenCalledTimes(2);
    });

    it("alterar: a nova jornada é outra, começa depois da atual, e o antes → depois aparece", async () => {
      const servico = servicoCom([vinculo("v1", COMERCIAL, HOJE, null)]);
      montar(servico);
      const gaveta = await abrirGaveta("Alterar escala");
      const select = within(gaveta).getByLabelText("Nova jornada");
      // A jornada atual não é oferecida.
      expect(
        within(select).queryByRole("option", { name: /Comercial/ }),
      ).toBeNull();
      fireEvent.change(select, { target: { value: "j2" } });
      const muda = within(gaveta).getByRole("region", { name: "O que muda" });
      expect(muda).toHaveTextContent("44 h");
      expect(muda).toHaveTextContent("30 h");
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Salvar escala" }),
      );
      expect(gaveta).toHaveTextContent(
        "A nova escala precisa começar depois de 24/11/2026, início da atual.",
      );
      expect(within(gaveta).getByLabelText("Vale a partir de")).toHaveFocus();
      expect(servico.atribuir).not.toHaveBeenCalled();
    });

    it("recusas do servidor: sobreposição e antes da admissão no campo da data", async () => {
      const servico = servicoCom([]);
      servico.atribuir.mockRejectedValueOnce(
        new ApiError(409, "x", {
          erros: [{ campo: "vigenciaInicio", motivo: "sobreposta" }],
        }),
      );
      montar(servico);
      const gaveta = await abrirGaveta("Definir escala");
      fireEvent.change(within(gaveta).getByLabelText("Jornada"), {
        target: { value: "j1" },
      });
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Salvar escala" }),
      );
      expect(
        await within(gaveta).findByText(
          "Este período cruza outra vigência do colaborador. Escolha outra data.",
        ),
      ).toBeInTheDocument();
      servico.atribuir.mockRejectedValueOnce(
        new ApiError(422, "x", {
          erros: [{ campo: "vigenciaInicio", motivo: "antes_da_admissao" }],
        }),
      );
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Salvar escala" }),
      );
      expect(
        await within(gaveta).findByText(
          "A escala não pode começar antes da admissão.",
        ),
      ).toBeInTheDocument();
      // O digitado fica.
      expect(within(gaveta).getByLabelText("Jornada")).toHaveValue("j1");
    });

    it("alterar com só a jornada atual ativa: diz que não há outra", async () => {
      const servico = servicoCom([
        vinculo("v1", COMERCIAL, "2026-02-02", null),
      ]);
      servico.jornadas.mockResolvedValue([COMERCIAL]);
      montar(servico);
      const gaveta = await abrirGaveta("Alterar escala");
      expect(gaveta).toHaveTextContent(
        "Nenhuma outra jornada ativa na empresa.",
      );
    });

    it("com escala encerrada no futuro: a nova começa no primeiro dia livre (sem sobrepor)", async () => {
      const servico = servicoCom([
        vinculo("v1", COMERCIAL, "2026-02-02", "2027-01-01"),
      ]);
      montar(servico);
      const gaveta = await abrirGaveta("Definir escala");
      const data = within(gaveta).getByLabelText("Vale a partir de");
      expect(data).toHaveValue("2027-01-01");
      fireEvent.change(within(gaveta).getByLabelText("Jornada"), {
        target: { value: "j2" },
      });
      fireEvent.change(data, { target: { value: "2026-12-15" } });
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Salvar escala" }),
      );
      expect(gaveta).toHaveTextContent(
        "Já existe escala até 31/12/2026. A nova precisa começar a partir de 01/01/2027.",
      );
      expect(data).toHaveFocus();
      expect(servico.atribuir).not.toHaveBeenCalled();
    });

    it("sem jornada ativa: aponta Jornadas de trabalho", async () => {
      const servico = servicoCom([]);
      servico.jornadas.mockResolvedValue([]);
      const onAbrirJornadas = vi.fn();
      montar(servico, { onAbrirJornadas });
      const gaveta = await abrirGaveta("Definir escala");
      expect(
        await within(gaveta).findByText("Nenhuma jornada ativa na empresa."),
      ).toBeInTheDocument();
      fireEvent.click(
        within(gaveta).getByRole("button", {
          name: "Criar ou ajustar jornada",
        }),
      );
      expect(onAbrirJornadas).toHaveBeenCalledTimes(1);
    });

    it("Escape fecha a gaveta limpa e o foco volta ao botão que a abriu", async () => {
      montar(servicoCom([]));
      const gaveta = await abrirGaveta("Definir escala");
      fireEvent.keyDown(gaveta, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Definir escala" }),
        ).toHaveFocus(),
      );
    });
  });

  describe("encerrar", () => {
    it("pergunta o último dia, valida e envia o dia seguinte", async () => {
      const servico = servicoCom([
        vinculo("v1", COMERCIAL, "2026-02-02", null),
      ]);
      montar(servico);
      fireEvent.click(
        await screen.findByRole("button", { name: "Encerrar escala" }),
      );
      const gaveta = await screen.findByRole("dialog", {
        name: "Encerrar escala",
      });
      const ultimo = within(gaveta).getByLabelText("Último dia na escala");
      fireEvent.change(ultimo, { target: { value: "2026-02-01" } });
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Encerrar escala" }),
      );
      expect(gaveta).toHaveTextContent(
        "O último dia não pode ser antes de 02/02/2026, início da escala.",
      );
      expect(ultimo).toHaveFocus();
      fireEvent.change(ultimo, { target: { value: "2026-12-31" } });
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Encerrar escala" }),
      );
      await waitFor(() =>
        expect(servico.encerrar).toHaveBeenCalledWith("v1", {
          vigenciaFim: "2027-01-01",
        }),
      );
      expect(
        await screen.findByText(
          "Escala encerrada. O último dia nela é 31/12/2026.",
        ),
      ).toBeInTheDocument();
      // O botão que abriu a gaveta pode sumir: o foco vai ao título.
      await waitFor(() =>
        expect(
          screen.getByRole("heading", { name: "Escala atual" }),
        ).toHaveFocus(),
      );
    });
  });

  it("CSS: começa numa coluna (375 px), sem largura fixa, e só abre colunas com espaço", () => {
    const css = readFileSync(resolve(__dirname, "AbaEscala.css"), "utf8");
    expect(css).toMatch(
      /\.escala-ficha__semana\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(css).toMatch(/@container \(min-width: \d+rem\)/);
    expect(css).not.toMatch(/\bwidth:\s*\d{3,}px/);
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
