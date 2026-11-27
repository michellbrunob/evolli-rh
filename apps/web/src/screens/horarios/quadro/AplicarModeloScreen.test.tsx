import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  CHAVES_DOS_AVISOS,
  consultarQuadro,
  consultarRegras,
  definirEscala,
  gravarDias,
  type DiaGravadoApi,
  type PessoaDoQuadroApi,
  type RegrasDaEscalaApi,
} from "../../../api/escalaClient";
import { listarTabelasHorario } from "../../../api/horariosClient";
import { AplicarModeloScreen } from "./AplicarModeloScreen";
import {
  esquecerPedidoDoModelo,
  lerAvisoDoQuadro,
  pedirModelo,
} from "./aplicarModelo";
import { pessoa, tabelaHorario } from "./fixturasDoQuadro";

vi.mock("../../../api/escalaClient", async (original) => ({
  ...(await original<typeof import("../../../api/escalaClient")>()),
  consultarQuadro: vi.fn(),
  consultarRegras: vi.fn(),
  definirEscala: vi.fn(),
  gravarDias: vi.fn(),
}));
vi.mock("../../../api/horariosClient");

const HOJE = "2026-11-25";
const COMERCIAL = tabelaHorario("Comercial", {
  periodos: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"].map(
    (dia) => ({ dia, inicio: "09:00", fim: "18:00" }),
  ),
});

function regras(): RegrasDaEscalaApi {
  return {
    personalizadas: false,
    inicioTransicao: "2026-12-16",
    semanaComeca: 1,
    convencao: {
      "6x1_autorizada": false,
      jornada_ampliada: false,
      "12x36_acordo": true,
      revezamento_8h: false,
      intervalo_30min: false,
      comercio: false,
      feriado_convencao: false,
      portaria_1316: false,
    },
    avisos: Object.fromEntries(
      CHAVES_DOS_AVISOS.map((k) => [k, k !== "noturno"]),
    ) as RegrasDaEscalaApi["avisos"],
    antecedenciaDias: 7,
    avisarPadrao: true,
    feriados: [],
  };
}

const ANA = pessoa("Ana Lima", {
  colaboradorId: "c-ana",
  departamento: { id: "d1", nome: "Loja" },
});
const BRUNO = pessoa("Bruno Reis", {
  colaboradorId: "c-bruno",
  departamento: { id: "d2", nome: "Estoque" },
});
let pessoas: PessoaDoQuadroApi[] = [];

beforeEach(() => {
  esquecerPedidoDoModelo();
  lerAvisoDoQuadro();
  pessoas = [ANA, BRUNO];
  vi.mocked(consultarRegras).mockReset().mockResolvedValue(regras());
  vi.mocked(consultarQuadro)
    .mockReset()
    .mockImplementation(async (inicio, fim) => ({
      empresaId: "e",
      inicio,
      fim,
      regras: regras(),
      pessoas,
    }));
  vi.mocked(listarTabelasHorario).mockResolvedValue({
    itens: [COMERCIAL],
  } as never);
  vi.mocked(definirEscala)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(gravarDias).mockReset().mockResolvedValue([]);
});

const proxima = () =>
  fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));

async function montar(onVoltar = vi.fn()) {
  render(<AplicarModeloScreen onVoltar={onVoltar} hojeFixo={HOJE} />);
  await screen.findByRole("heading", { name: /Quem recebe o modelo/ });
  return onVoltar;
}

describe("T215 — Aplicar modelo de escala", () => {
  it("vindo do quadro: o filtro e a seleção chegam; sem ninguém, não avança", async () => {
    pedirModelo({ doFiltro: ["c-ana", "c-bruno"], selecionadas: ["c-ana"] });
    await montar();
    expect(
      screen.getByRole("radio", { name: /Escolher pessoas/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: /Todo o time do filtro atual/ }),
    ).toHaveTextContent("As pessoas do filtro do quadro · 2 pessoas");
    expect(
      screen.getByRole("checkbox", { name: "Marcar Ana Lima" }),
    ).toBeChecked();
    expect(screen.getByText("1 pessoa selecionada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Marcar Ana Lima" }));
    proxima();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escolha ao menos uma pessoa.",
    );
    // O filtro da lista (departamento) vale para "todo o time".
    fireEvent.click(screen.getByRole("radio", { name: /Todo o time/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Departamento" }), {
      target: { value: "d2" },
    });
    expect(screen.getByText("1 pessoa selecionada")).toBeInTheDocument();
    expect(screen.queryByText("Ana Lima")).toBeNull();
  });

  it("6x1 distribuída, sem data de fim: troca o padrão e põe 8 semanas no rascunho", async () => {
    const onVoltar = await montar();
    fireEvent.click(screen.getByRole("radio", { name: /Todo o time/ }));
    proxima();
    await screen.findByRole("heading", { name: /Qual escala/ });
    const seis = screen.getByRole("radio", { name: /^6x1/ });
    expect(seis).toHaveTextContent("Convenção a partir de 16/12");
    expect(screen.getByRole("radio", { name: /^5x2/ })).toHaveTextContent(
      "Padrão da EC 141",
    );
    fireEvent.click(seis);
    proxima();
    await screen.findByRole("heading", { name: /Turnos e folgas/ });
    expect(screen.getByLabelText("Turno dos dias de trabalho")).toHaveValue(
      COMERCIAL.id,
    );
    expect(screen.getByText("48 h")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("radio", { name: /Distribuir entre as pessoas/ }),
    );
    const previa = screen.getByRole("region", {
      name: "Prévia das duas primeiras semanas",
    });
    const linhas = within(previa).getAllByRole("row");
    // Ana folga no domingo; Bruno, na segunda.
    expect(linhas[1]).toHaveTextContent("Ana LimaCCCCCCDCCCCCCD");
    expect(linhas[2]).toHaveTextContent("Bruno ReisDCCCCCCDCCCCCC");
    proxima();
    await screen.findByRole("heading", { name: /Período/ });
    expect(screen.getByLabelText("Começa em")).toHaveValue("2026-11-30");
    expect(
      screen.getByRole("radio", { name: /Sem data de fim/ }),
    ).toHaveTextContent(
      "O padrão de escala de cada pessoa passa a ser 6x1 a partir de 30/11 e o quadro segue sozinho. A escala do contrato não muda.",
    );
    await screen.findByText(/Nenhuma célula do período está preenchida/);
    proxima();
    await screen.findByRole("heading", { name: /Prévia/ });
    expect(
      screen.getByText(/o padrão de cada pessoa passa a ser 6x1 · Comercial/),
    ).toBeInTheDocument();
    expect(screen.getByText("112")).toBeInTheDocument();
    expect(
      screen.getAllByText(/6x1 sem convenção depois da transição/).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: /Aplicar ao rascunho/ }),
    );
    await waitFor(() => expect(onVoltar).toHaveBeenCalled());
    expect(vi.mocked(definirEscala).mock.calls).toEqual([
      [
        "c-ana",
        {
          modelo: "6x1",
          tabelaHorarioId: COMERCIAL.id,
          vigenciaInicio: "2026-11-30",
          folgaSemanal: 7,
        },
      ],
      [
        "c-bruno",
        {
          modelo: "6x1",
          tabelaHorarioId: COMERCIAL.id,
          vigenciaInicio: "2026-11-30",
          folgaSemanal: 1,
        },
      ],
    ]);
    // Em envios de até cem dias (tudo ou nada no rascunho).
    expect(
      vi.mocked(gravarDias).mock.calls.map(([dias]) => dias.length),
    ).toEqual([100, 12]);
    expect(lerAvisoDoQuadro()).toBe(
      "Modelo aplicado: 112 células no rascunho para 2 pessoas.",
    );
  });

  it("um turno diferente por dia: sem data de fim é recusado (o padrão guarda um turno só)", async () => {
    const TARDE = tabelaHorario("Tarde", {
      periodos: ["segunda", "terca", "quarta", "quinta", "sexta"].map(
        (dia) => ({ dia, inicio: "13:00", fim: "22:00" }),
      ),
    });
    vi.mocked(listarTabelasHorario).mockResolvedValue({
      itens: [COMERCIAL, TARDE],
    } as never);
    await montar();
    fireEvent.click(screen.getByRole("radio", { name: /Todo o time/ }));
    proxima();
    await screen.findByRole("heading", { name: /Qual escala/ });
    fireEvent.click(screen.getByRole("radio", { name: /^5x2/ }));
    proxima();
    await screen.findByRole("heading", { name: /Turnos e folgas/ });
    fireEvent.click(screen.getByRole("radio", { name: "Um turno por dia" }));
    const selects = screen
      .getAllByRole("combobox")
      .filter((s) => s.closest(".modelo__por-dia"));
    expect(selects).toHaveLength(5);
    selects.forEach((s, i) =>
      fireEvent.change(s, {
        target: { value: i === 0 ? TARDE.id : COMERCIAL.id },
      }),
    );
    proxima();
    await screen.findByRole("heading", { name: /Período/ });
    const semFim = screen.getByRole("radio", { name: /Sem data de fim/ });
    expect(semFim).toHaveTextContent(
      "Com um turno diferente em cada dia, informe a data de fim: o padrão de escala da pessoa guarda um turno só.",
    );
    proxima();
    // Continua no Período, com o motivo; nada foi gravado.
    expect(
      screen.getByRole("heading", { name: /Período/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /informe a data de fim: o padrão de escala da pessoa guarda um turno só/,
      ).length,
    ).toBeGreaterThan(1);
    expect(definirEscala).not.toHaveBeenCalled();
  });

  it("até uma data, sem Substituir: só os dias vazios; tudo preenchido não aplica", async () => {
    const cheio: DiaGravadoApi[] = Array.from({ length: 28 }, (_, i) => ({
      dia: `2026-${i < 1 ? "11-30" : `12-${String(i).padStart(2, "0")}`}`,
      camada: "publicado",
      tipo: "folga",
      turno: null,
      periodos: [],
      intervaloMinutos: 0,
      sobreaviso: [],
      unidade: null,
      observacao: null,
    }));
    pessoas = [{ ...ANA, dias: cheio }];
    pedirModelo({ doFiltro: null, selecionadas: ["c-ana"] });
    await montar();
    proxima();
    fireEvent.click(await screen.findByRole("radio", { name: /^5x2/ }));
    proxima();
    await screen.findByRole("heading", { name: /Turnos e folgas/ });
    proxima();
    await screen.findByRole("heading", { name: /Período/ });
    fireEvent.click(screen.getByRole("radio", { name: /Até uma data/ }));
    expect(screen.getByLabelText("Termina em")).toHaveValue("2026-12-27");
    await screen.findByText(/as 28 células já preenchidas/);
    proxima();
    await screen.findByRole("heading", { name: /Prévia/ });
    expect(
      screen.getByText(/Até 27\/12\/2026: só o rascunho muda/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Aplicar ao rascunho/ }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nada para aplicar: o período já está todo escalado.",
    );
    expect(gravarDias).not.toHaveBeenCalled();
    expect(definirEscala).not.toHaveBeenCalled();
  });

  it("o padrão igual ao vigente não é falha; outra recusa aparece no aviso", async () => {
    vi.mocked(definirEscala)
      .mockRejectedValueOnce(
        new ApiError(422, "x", {
          erros: [{ campo: "modelo", motivo: "igual_a_vigente" }],
        }),
      )
      .mockRejectedValueOnce(new ApiError(422, "x", {}));
    // Bruno entra depois do início: o padrão dele começa na admissão.
    pessoas = [ANA, { ...BRUNO, dataAdmissao: "2026-12-02" }];
    const onVoltar = await montar();
    fireEvent.click(screen.getByRole("radio", { name: /Todo o time/ }));
    proxima();
    fireEvent.click(await screen.findByRole("radio", { name: /^5x2/ }));
    proxima();
    await screen.findByRole("heading", { name: /Turnos e folgas/ });
    proxima();
    await screen.findByText(/Nenhuma célula do período está preenchida/);
    proxima();
    await screen.findByRole("heading", { name: /Prévia/ });
    fireEvent.click(
      screen.getByRole("button", { name: /Aplicar ao rascunho/ }),
    );
    await waitFor(() => expect(onVoltar).toHaveBeenCalled());
    expect(lerAvisoDoQuadro()).toBe(
      "Modelo aplicado: 110 células no rascunho para 2 pessoas. Sem trocar o padrão: Bruno Reis.",
    );
    expect(
      vi.mocked(definirEscala).mock.calls.map((c) => c[1].vigenciaInicio),
    ).toEqual(["2026-11-30", "2026-12-02"]);
  });
});
