import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAVES_DOS_AVISOS,
  consultarQuadro,
  consultarRegras,
  alterarFeriadoLocal,
  arquivarFeriadoLocal,
  criarFeriadoLocal,
  definirEscala,
  salvarRegras,
  type PessoaDoQuadroApi,
  type RegrasDaEscalaApi,
} from "../../../api/escalaClient";
import {
  criarTabelaHorario,
  listarTabelasHorario,
  type TabelaHorarioApi,
} from "../../../api/horariosClient";
import { listarUnidades } from "../../../api/organizacaoClient";
import { RegrasDaEscalaScreen } from "./RegrasDaEscalaScreen";
import {
  PlanejarTransicaoScreen,
  periodosCom8h24,
} from "./PlanejarTransicaoScreen";
import { QuadroDaEscalaScreen } from "./QuadroDaEscalaScreen";
import { escala, pessoa, turno } from "./fixturasDoQuadro";
import { lerSecaoDasRegras, pedirSecaoDasRegras } from "./secaoDasRegras";

vi.mock("../../../api/escalaClient", async (original) => ({
  ...(await original<typeof import("../../../api/escalaClient")>()),
  consultarQuadro: vi.fn(),
  consultarRegras: vi.fn(),
  salvarRegras: vi.fn(),
  criarFeriadoLocal: vi.fn(),
  alterarFeriadoLocal: vi.fn(),
  arquivarFeriadoLocal: vi.fn(),
  definirEscala: vi.fn(),
  publicarEscala: vi.fn(),
}));
vi.mock("../../../api/horariosClient");
vi.mock("../../../api/organizacaoClient");

function regras(extra: Partial<RegrasDaEscalaApi> = {}): RegrasDaEscalaApi {
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
    ...extra,
  };
}

const COMERCIAL: TabelaHorarioApi = {
  id: "t-Comercial",
  empresaId: "e",
  codigo: null,
  nome: "Comercial",
  ativo: true,
  criadoPorUserId: "u",
  criadoEm: "",
  atualizadoEm: "",
  periodos: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"].map(
    (dia) => ({
      dia,
      inicio: "09:00",
      fim: "18:00",
    }),
  ),
  intervaloMinutos: 60,
  cor: "azul",
};

const seisPorUm = (): PessoaDoQuadroApi =>
  pessoa("Teste Seis", {
    colaboradorId: "c-6",
    unidade: { id: "u1", nome: "Matriz" },
    escalas: [
      escala({
        modelo: "6x1",
        folgaSemanal: 7,
        turno: turno("Comercial", {
          periodos: COMERCIAL.periodos,
        }),
      }),
    ],
  });

beforeEach(() => {
  vi.mocked(consultarRegras).mockReset().mockResolvedValue(regras());
  vi.mocked(salvarRegras)
    .mockReset()
    .mockImplementation(async (dto) =>
      regras({
        personalizadas: true,
        inicioTransicao: dto.inicioTransicao ?? "2026-12-16",
        convencao: dto.convencao,
        avisos: dto.avisos,
        antecedenciaDias: dto.antecedenciaDias,
        avisarPadrao: dto.avisarPadrao,
        semanaComeca: dto.semanaComeca,
      }),
    );
  vi.mocked(consultarQuadro)
    .mockReset()
    .mockImplementation(async (inicio, fim) => ({
      empresaId: "e",
      inicio,
      fim,
      regras: regras(),
      pessoas: [seisPorUm()],
    }));
  vi.mocked(listarTabelasHorario).mockResolvedValue({
    itens: [COMERCIAL],
  } as never);
  vi.mocked(criarTabelaHorario).mockReset();
  vi.mocked(definirEscala).mockReset();
  vi.mocked(listarUnidades).mockResolvedValue({
    itens: [
      {
        id: "u1",
        codigo: "M",
        nome: "Matriz",
        empresaId: "e",
        status: "ativo",
        criadoEm: "",
        atualizadoEm: "",
      },
    ],
  } as never);
});

describe("T215 — Regras da escala", () => {
  it("mostra a transição, o que a convenção permite, os avisos e a publicação; salva só o que mudou", async () => {
    render(
      <RegrasDaEscalaScreen
        podeOperar
        onVoltar={() => {}}
        onAbrirTransicao={() => {}}
      />,
    );
    expect(
      await screen.findByText("Ainda sem alterações: valem as regras padrão."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Início da transição")).toHaveValue(
      "2026-12-16",
    );
    expect(
      screen.getByLabelText("Início da transição"),
    ).toHaveAccessibleDescription(/Dois meses depois da publicação/);
    expect(screen.getByText("42 h por semana")).toBeInTheDocument();
    // Quem está em 6x1 na transição.
    expect(
      await screen.findByText(
        /1 pessoa está em 6x1\. A partir de 16\/12\/2026 ela precisa de 2 descansos/,
      ),
    ).toBeInTheDocument();
    const chave = screen.getByRole("switch", {
      name: "A empresa é do comércio",
    });
    expect(chave).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: "Turno noturno (22h às 5h)" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("switch")).toHaveLength(8 + 21 + 1);
    // Publicação: "Avisar as pessoas" é o interruptor ligado por padrão.
    expect(
      screen.getByRole("switch", {
        name: "Marcado por padrão no diálogo de publicar",
      }),
    ).toHaveAttribute("aria-checked", "true");
    // O menu lateral marca a seção atual.
    expect(
      screen.getByRole("link", { name: "Jornada e transição" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Salvar regras" }),
    ).toBeDisabled();
    fireEvent.click(chave);
    expect(screen.getByText("Alterações não salvas.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Antecedência mínima"), {
      target: { value: "14" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar regras" }));
    await screen.findByText(
      "Regras salvas. Valem para o quadro a partir de agora.",
    );
    expect(salvarRegras).toHaveBeenCalledWith(
      expect.objectContaining({
        inicioTransicao: "2026-12-16",
        antecedenciaDias: 14,
        convencao: expect.objectContaining({ comercio: true }),
      }),
    );
  });

  it("Descartar volta ao que estava; quem só consulta não muda nada", async () => {
    const { unmount } = render(
      <RegrasDaEscalaScreen podeOperar onVoltar={() => {}} />,
    );
    const chave = await screen.findByRole("switch", {
      name: "Mais de 10 h no dia",
    });
    fireEvent.click(chave);
    expect(chave).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(chave).toHaveAttribute("aria-checked", "true");
    unmount();
    render(<RegrasDaEscalaScreen podeOperar={false} onVoltar={() => {}} />);
    expect(
      await screen.findByRole("switch", { name: "Mais de 10 h no dia" }),
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar regras" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Adicionar feriado" }),
    ).toBeNull();
  });

  it("feriados locais: adiciona (pílulas Todas/Só algumas), edita e arquiva pelo menu da linha, com aviso flutuante", async () => {
    const aniversario = {
      id: "f1",
      data: "2027-03-04",
      nome: "Aniversário",
      tipo: "municipal" as const,
      unidadeIds: ["u1"],
    };
    vi.mocked(criarFeriadoLocal).mockResolvedValue(
      regras({ feriados: [aniversario] }),
    );
    vi.mocked(alterarFeriadoLocal).mockResolvedValue(
      regras({
        feriados: [
          {
            ...aniversario,
            nome: "Aniversário da cidade",
            tipo: "ponto_facultativo",
            unidadeIds: [],
          },
        ],
      }),
    );
    vi.mocked(arquivarFeriadoLocal).mockResolvedValue(regras());
    render(<RegrasDaEscalaScreen podeOperar onVoltar={() => {}} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Adicionar feriado" }),
    );
    const d = screen.getByRole("dialog", { name: "Adicionar feriado" });
    fireEvent.click(
      within(d).getByRole("button", { name: "Adicionar feriado" }),
    );
    expect(within(d).getByRole("alert")).toHaveTextContent(
      "Informe a data e o nome do feriado.",
    );
    fireEvent.change(within(d).getByLabelText("Data"), {
      target: { value: "2027-03-04" },
    });
    fireEvent.change(within(d).getByLabelText("Nome"), {
      target: { value: " Aniversário " },
    });
    const todas = within(d).getByRole("button", { name: "Todas as unidades" });
    expect(todas).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(d).getByRole("button", { name: "Só algumas" }));
    expect(todas).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(
      within(d).getByRole("button", { name: "Adicionar feriado" }),
    );
    expect(within(d).getByRole("alert")).toHaveTextContent(
      "Escolha ao menos uma unidade.",
    );
    fireEvent.click(within(d).getByRole("checkbox", { name: "Matriz" }));
    fireEvent.click(
      within(d).getByRole("button", { name: "Adicionar feriado" }),
    );
    await waitFor(() =>
      expect(criarFeriadoLocal).toHaveBeenCalledWith({
        data: "2027-03-04",
        nome: "Aniversário",
        tipo: "municipal",
        unidadeIds: ["u1"],
      }),
    );
    expect(await screen.findByText("Feriado adicionado.")).toBeInTheDocument();
    expect(
      screen.getByText("Já aparece no quadro e entra nos avisos."),
    ).toBeInTheDocument();
    const linha = (
      await screen.findByRole("cell", { name: "Aniversário" })
    ).closest("tr")!;
    expect(linha).toHaveTextContent("04/03/2027AniversárioMunicipalMatriz");

    // Editar: o diálogo vem preenchido; salva pela API de edição.
    fireEvent.keyDown(
      within(linha).getByRole("button", { name: "Ações de Aniversário" }),
      { key: "Enter" },
    );
    fireEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Editar",
      }),
    );
    const e = screen.getByRole("dialog", { name: "Editar feriado" });
    expect(within(e).getByLabelText("Data")).toHaveValue("2027-03-04");
    expect(within(e).getByLabelText("Nome")).toHaveValue("Aniversário");
    expect(within(e).getByRole("checkbox", { name: "Matriz" })).toBeChecked();
    fireEvent.change(within(e).getByLabelText("Nome"), {
      target: { value: "Aniversário da cidade" },
    });
    fireEvent.click(
      within(e).getByRole("button", { name: "Ponto facultativo" }),
    );
    fireEvent.click(
      within(e).getByRole("button", { name: "Todas as unidades" }),
    );
    fireEvent.click(within(e).getByRole("button", { name: "Salvar feriado" }));
    await waitFor(() =>
      expect(alterarFeriadoLocal).toHaveBeenCalledWith("f1", {
        data: "2027-03-04",
        nome: "Aniversário da cidade",
        tipo: "ponto_facultativo",
        unidadeIds: [],
      }),
    );
    expect(await screen.findByText("Feriado salvo.")).toBeInTheDocument();
    const editada = (
      await screen.findByRole("cell", { name: "Aniversário da cidade" })
    ).closest("tr")!;
    expect(editada).toHaveTextContent("Ponto facultativoTodas");

    // Arquivar: sai da lista; o aviso diz que saiu do quadro e dos avisos.
    fireEvent.keyDown(
      within(editada).getByRole("button", {
        name: "Ações de Aniversário da cidade",
      }),
      { key: "Enter" },
    );
    const arquivar = within(await screen.findByRole("menu")).getByRole(
      "menuitem",
      { name: /Arquivar/ },
    );
    expect(arquivar).toHaveTextContent(
      "Sai do quadro e dos avisos; o registro fica",
    );
    fireEvent.click(arquivar);
    await waitFor(() =>
      expect(arquivarFeriadoLocal).toHaveBeenCalledWith("f1"),
    );
    expect(await screen.findByText("Feriado arquivado.")).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "Aniversário da cidade" }),
    ).toBeNull();
  });
});

describe("T215 — Regras abertas numa seção", () => {
  it("o pedido de seção abre a página nela (rola e marca no menu) e é esquecido ao sair", async () => {
    vi.mocked(consultarRegras).mockResolvedValue(regras());
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    pedirSecaoDasRegras("feriados");
    const { unmount } = render(
      <RegrasDaEscalaScreen podeOperar onVoltar={() => {}} />,
    );
    const menu = await screen.findByRole("navigation", {
      name: "Seções das regras",
    });
    await waitFor(() =>
      expect(
        within(menu).getByRole("link", { name: "Feriados locais" }),
      ).toHaveAttribute("aria-current", "true"),
    );
    expect(rolar).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(rolar.mock.contexts[0]).toBe(
      document.getElementById("regras-feriados"),
    );
    expect(document.activeElement).toBe(
      document.getElementById("regras-feriados-titulo"),
    );
    unmount();
    expect(lerSecaoDasRegras()).toBeNull();
  });
});

describe("T215 — Planejar a transição", () => {
  it("lista quem está em 6x1, passa para 5x2 com turno de 8h24 (novo) e define o padrão na data da transição", async () => {
    vi.mocked(criarTabelaHorario).mockResolvedValue({
      ...COMERCIAL,
      id: "t-novo",
      nome: "Comercial 8h24",
    });
    vi.mocked(definirEscala).mockResolvedValue({} as never);
    render(<PlanejarTransicaoScreen onVoltar={() => {}} />);
    expect(
      await screen.findByText("EC 141/2026 · vale a partir de 16/12/2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Marcar Teste Seis" }),
    ).toBeChecked();
    expect(
      screen.getByText("Comercial 09:00–18:00 · 1 pessoa"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Comercial 8h24 09:00–18:24 (novo turno)"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar a 1 pessoa" }));
    expect(
      await screen.findByText(
        /1 pessoa passa para 5x2 a partir de 16\/12\/2026\./,
      ),
    ).toBeInTheDocument();
    expect(criarTabelaHorario).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Comercial 8h24",
        modo: "por_dia",
        intervaloMinutos: 60,
      }),
    );
    expect(definirEscala).toHaveBeenCalledWith("c-6", {
      modelo: "5x2",
      tabelaHorarioId: "t-novo",
      vigenciaInicio: "2026-12-16",
    });
  });

  it("8 h por dia mantém o turno; manter 6x1 marca a convenção nas Regras", async () => {
    vi.mocked(definirEscala).mockResolvedValue({} as never);
    const { unmount } = render(<PlanejarTransicaoScreen onVoltar={() => {}} />);
    fireEvent.click(
      await screen.findByRole("radio", { name: /8 h por dia \(40 h\)/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar a 1 pessoa" }));
    await waitFor(() =>
      expect(definirEscala).toHaveBeenCalledWith(
        "c-6",
        expect.objectContaining({ tabelaHorarioId: "t-Comercial" }),
      ),
    );
    expect(criarTabelaHorario).not.toHaveBeenCalled();
    unmount();
    render(<PlanejarTransicaoScreen onVoltar={() => {}} />);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Manter 6x1 com convenção/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar convenção nas Regras" }),
    );
    await waitFor(() =>
      expect(salvarRegras).toHaveBeenCalledWith(
        expect.objectContaining({
          convencao: expect.objectContaining({ "6x1_autorizada": true }),
        }),
      ),
    );
  });

  it("períodos de 8h24: segunda a sexta, 24 min a mais no fim do dia", () => {
    expect(periodosCom8h24(COMERCIAL)).toEqual(
      ["segunda", "terca", "quarta", "quinta", "sexta"].map((dia) => ({
        dia,
        inicio: "09:00",
        fim: "18:24",
      })),
    );
  });
});

describe("T215 — avisos no quadro", () => {
  it("faixa da EC 141, botão Avisos, painel com abas e Já temos convenção", async () => {
    render(
      <QuadroDaEscalaScreen
        hoje="2027-03-03"
        podeOperar
        onAbrirTransicao={() => {}}
        onAbrirRegras={() => {}}
      />,
    );
    expect(
      await screen.findByText(
        "A partir de 16/12, a 6x1 só vale com convenção coletiva",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 pessoa está em 6x1 nesta semana\. A EC 141\/2026 pede 2 descansos/,
      ),
    ).toBeInTheDocument();
    const botao = screen.getByRole("button", { name: /^Avisos/ });
    expect(botao).toHaveTextContent("Avisos3");
    fireEvent.click(botao);
    const painel = screen.getByRole("dialog", { name: "Avisos da semana" });
    expect(
      within(painel).getByRole("tab", { name: /Atenção/ }),
    ).toHaveTextContent("Atenção2");
    expect(
      within(painel).getByRole("tab", { name: /Conferir/ }),
    ).toHaveTextContent("Conferir1");
    expect(painel).toHaveTextContent("6x1 sem convenção depois da transição");
    fireEvent.click(within(painel).getByRole("tab", { name: /Conferir/ }));
    expect(painel).toHaveTextContent("48 h na semana");
    const fechar = within(painel).getAllByRole("button", { name: "Fechar" });
    fireEvent.click(fechar[fechar.length - 1]!);
    // A célula diz o aviso.
    expect(
      screen.getByRole("button", {
        name: /Comercial, 09:00–18:00, 1 aviso: 6x1 sem convenção depois da transição/,
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Já temos convenção" }));
    await waitFor(() =>
      expect(salvarRegras).toHaveBeenCalledWith(
        expect.objectContaining({
          convencao: expect.objectContaining({ "6x1_autorizada": true }),
        }),
      ),
    );
    expect(
      await screen.findByRole("status", {
        name: "6x1 autorizada por convenção nas Regras",
      }),
    ).toBeInTheDocument();
  });
});
