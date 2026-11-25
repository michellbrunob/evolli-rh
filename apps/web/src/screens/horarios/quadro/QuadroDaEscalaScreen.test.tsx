import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  CHAVES_DOS_AVISOS,
  type RegrasDaEscalaApi,
  consultarQuadro,
  consultarVisoes,
  criarVisao,
} from "../../../api/escalaClient";
import { FILTROS_DO_QUADRO_VAZIOS } from "./filtrosDoQuadro";
import { QuadroDaEscalaScreen } from "./QuadroDaEscalaScreen";
import { escala, pessoa, turno } from "./fixturasDoQuadro";

vi.mock("../../../api/escalaClient");

const HOJE = "2026-11-25";
const TI = { id: "d-ti", nome: "Tecnologia" };
const RH = { id: "d-rh", nome: "Recursos Humanos" };
const MATRIZ = { id: "u-1", nome: "Matriz" };

const michell = pessoa("Michell Bruno", {
  colaboradorId: "c-michell",
  departamento: TI,
  unidade: MATRIZ,
  jornadaSemanalHoras: 44,
  escalas: [escala()],
});
const julia = pessoa("Julia Costa", {
  colaboradorId: "c-julia",
  tipoVinculo: "estagio",
  departamento: RH,
  unidade: MATRIZ,
  jornadaSemanalHoras: 30,
});
const teste = pessoa("teste", {
  colaboradorId: "c-teste",
  escalas: [
    escala({
      modelo: "6x1",
      folgaSemanal: 7,
      turno: turno("Loja", { cor: "verde", sigla: "LJ" }),
      vigenciaInicio: "2026-11-24",
    }),
  ],
});

function quadroCom(
  pessoas = [michell, julia, teste],
  regras?: RegrasDaEscalaApi,
) {
  vi.mocked(consultarQuadro).mockImplementation(async (inicio, fim) => ({
    empresaId: "emp",
    inicio,
    fim,
    pessoas,
    ...(regras ? { regras } : {}),
  }));
}

function regrasCom(feriados: RegrasDaEscalaApi["feriados"]): RegrasDaEscalaApi {
  return {
    personalizadas: true,
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
    feriados,
  };
}

function montar(
  props: Partial<Parameters<typeof QuadroDaEscalaScreen>[0]> = {},
) {
  return render(<QuadroDaEscalaScreen hoje={HOJE} {...props} />);
}

const tabela = () => screen.getByRole("table");
const linhaDe = (nome: string) =>
  within(tabela())
    .getByRole("rowheader", { name: new RegExp(nome) })
    .closest("tr")!;

describe("T215 — quadro da escala: semana", () => {
  beforeEach(() => {
    vi.mocked(consultarQuadro).mockReset();
    vi.mocked(consultarVisoes).mockReset();
    quadroCom();
  });

  it("título, período da semana de hoje e a consulta de segunda a domingo", async () => {
    montar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Escala de trabalho" }),
    ).toHaveFocus();
    expect(screen.getByText("23 a 29 de novembro de 2026")).toBeInTheDocument();
    await screen.findByRole("table");
    expect(consultarQuadro).toHaveBeenCalledWith("2026-11-23", "2026-11-29");
    expect(screen.getByRole("button", { name: "Hoje" })).toBeDisabled();
  });

  it("células: turno com cor, nome e horário; folga; DSR; sem escala; e o 'Hoje' na coluna do dia", async () => {
    montar();
    await screen.findByRole("table");
    const m = linhaDe("Michell Bruno");
    const celulas = within(m).getAllByRole("cell");
    expect(celulas[0]).toHaveTextContent("Comercial09:00–18:00");
    expect(celulas[5]).toHaveTextContent("Folga");
    expect(celulas[6]).toHaveTextContent("DSRDescanso");
    // 5 dias × 8 h líquidas (1 h de intervalo).
    expect(celulas[7]).toHaveTextContent("40 h");
    expect(within(m).getByRole("rowheader")).toHaveTextContent(
      "Michell Bruno5x2 · Comercial",
    );

    const j = linhaDe("Julia Costa");
    expect(within(j).getByRole("rowheader")).toHaveTextContent(
      "Julia CostaEstágioSem escala fixa",
    );
    expect(within(j).getAllByRole("cell")[0]).toHaveTextContent("Sem escala");

    // 6x1 a partir de terça: segunda sem escala, domingo DSR.
    const t = linhaDe("teste");
    const ct = within(t).getAllByRole("cell");
    expect(ct[0]).toHaveTextContent("Sem escala");
    expect(ct[1]).toHaveTextContent("Loja09:00–18:00");
    expect(ct[6]).toHaveTextContent("DSR");
    expect(ct[7]).toHaveTextContent("40 h");

    const hoje = within(tabela()).getByRole("columnheader", {
      name: /quarta 25\/11/,
    });
    expect(hoje).toHaveTextContent("Hoje");
  });

  it("feriado local: nome sob o dia no cabeçalho e a coluna em âmbar só para quem é da unidade; escalado continua escalado", async () => {
    quadroCom(
      [michell, julia, teste],
      regrasCom([
        {
          id: "f1",
          data: "2026-11-26",
          nome: "Aniversário da cidade",
          tipo: "municipal",
          unidadeIds: [MATRIZ.id],
        },
        {
          id: "f2",
          data: "2026-11-26",
          nome: "Ponto da prefeitura",
          tipo: "ponto_facultativo",
          unidadeIds: [MATRIZ.id],
        },
        {
          id: "f3",
          data: "2026-11-25",
          nome: "Feriado de hoje",
          tipo: "municipal",
          unidadeIds: [],
        },
      ]),
    );
    montar();
    await screen.findByRole("table");
    const cab = within(tabela()).getByRole("columnheader", {
      name: /quinta 26\/11/,
    });
    expect(cab.className).toContain("quadro__dia--feriado");
    const nome = cab.querySelector(".quadro__feriado")!;
    // Dois no mesmo dia: os dois nomes.
    const nomes = "Aniversário da cidade · Ponto da prefeitura";
    expect(nome).toHaveTextContent(nomes);
    expect(nome).toHaveAttribute("title", nomes);
    expect(cab).toHaveTextContent(`, feriado: ${nomes}`);
    // Hoje e feriado: os dois; a coluna fica em âmbar (todas as unidades).
    const quarta = within(tabela()).getByRole("columnheader", {
      name: /quarta 25\/11/,
    });
    expect(quarta).toHaveTextContent("Hoje");
    expect(quarta.querySelector(".quadro__feriado")).toHaveTextContent(
      "Feriado de hoje",
    );
    const terca = within(tabela()).getByRole("columnheader", {
      name: /terça 24\/11/,
    });
    expect(terca.querySelector(".quadro__feriado")).toBeNull();
    // Michell (Matriz): a quinta em âmbar e continua escalado.
    const cm = within(linhaDe("Michell Bruno")).getAllByRole("cell");
    expect(cm[3]!.className).toContain("quadro__celula--feriado");
    expect(cm[3]).toHaveTextContent("Comercial09:00–18:00");
    expect(cm[1]!.className).not.toContain("quadro__celula--feriado");
    expect(cm[2]!.className).toContain("quadro__celula--feriado");
    // teste (sem unidade): o feriado não é dela.
    const ct = within(linhaDe("teste")).getAllByRole("cell");
    expect(ct[3]!.className).not.toContain("quadro__celula--feriado");
    expect(ct[2]!.className).toContain("quadro__celula--feriado");
  });

  it("'Escalados no dia' conta quem trabalha em cada dia, com o total de horas", async () => {
    montar();
    await screen.findByRole("table");
    const linha = within(tabela())
      .getByRole("rowheader", { name: "Escalados no dia" })
      .closest("tr")!;
    const cs = within(linha).getAllByRole("cell");
    expect(cs.map((c) => c.textContent)).toEqual([
      "1 de 3",
      "2 de 3",
      "2 de 3",
      "2 de 3",
      "2 de 3",
      "1 de 3",
      "0 de 3",
      "80 h",
    ]);
  });

  it("agrupa por departamento (Não informado por último), com pessoas, unidade comum e horas do grupo; recolhe e abre", async () => {
    montar();
    await screen.findByRole("table");
    expect(screen.getByText("3 pessoas · 3 departamentos")).toBeInTheDocument();
    const grupos = within(tabela()).getAllByRole("button", {
      expanded: true,
    });
    expect(grupos.map((g) => g.textContent)).toEqual([
      "Recursos Humanos",
      "Tecnologia",
      "Não informado",
    ]);
    const ti = grupos[1]!.closest("tr")!;
    expect(ti).toHaveTextContent("1 pessoa · Matriz");
    expect(ti).toHaveTextContent("40 h na semana");

    fireEvent.click(grupos[1]!);
    expect(grupos[1]).toHaveAttribute("aria-expanded", "false");
    expect(
      within(tabela()).queryByRole("rowheader", { name: /Michell/ }),
    ).toBeNull();
    fireEvent.click(grupos[1]!);
    // O quadro ao fundo continua com as 3 pessoas (ainda é rascunho).
    expect(screen.getAllByText("Julia Costa").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("combobox", { name: "Agrupar por:" }), {
      target: { value: "nenhum" },
    });
    expect(screen.getByText("3 pessoas")).toBeInTheDocument();
    expect(
      within(tabela()).queryByRole("button", { expanded: true }),
    ).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Agrupar por:" }), {
      target: { value: "turno" },
    });
    expect(
      within(tabela())
        .getAllByRole("button", { expanded: true })
        .map((g) => g.textContent),
    ).toEqual(["Comercial", "Loja", "Não informado"]);
  });

  it("busca sem acento e ordem pelo nome; contagem 'N de M pessoas'", async () => {
    montar();
    await screen.findByRole("table");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar colaborador" }),
      { target: { value: "JULIA" } },
    );
    expect(screen.getByText("1 de 3 pessoas")).toBeInTheDocument();
    expect(
      within(tabela()).getAllByRole("rowheader", { name: /Costa|Bruno|teste/ }),
    ).toHaveLength(1);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar colaborador" }),
      { target: { value: "ninguém" } },
    );
    expect(
      screen.getByText(
        "Nenhuma pessoa encontrada. Confira a busca ou o filtro.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar colaborador" }),
      { target: { value: "" } },
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Agrupar por:" }), {
      target: { value: "nenhum" },
    });
    const nomes = () =>
      within(tabela())
        .getAllByRole("rowheader")
        .map((r) => r.querySelector(".quadro__pessoa-nome")?.textContent)
        .filter(Boolean);
    expect(nomes()).toEqual(["Julia Costa", "Michell Bruno", "teste"]);
    fireEvent.click(screen.getByRole("button", { name: /^Colaborador/ }));
    expect(nomes()).toEqual(["teste", "Michell Bruno", "Julia Costa"]);
  });

  it("navega entre semanas e volta a hoje; título entre meses", async () => {
    montar();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }));
    expect(
      screen.getByText("30 de novembro a 6 de dezembro de 2026"),
    ).toBeInTheDocument();
    await screen.findByRole("table");
    expect(consultarQuadro).toHaveBeenLastCalledWith(
      "2026-11-30",
      "2026-12-06",
    );
    fireEvent.click(screen.getByRole("button", { name: "Período anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Período anterior" }));
    await screen.findByRole("table");
    expect(consultarQuadro).toHaveBeenLastCalledWith(
      "2026-11-16",
      "2026-11-22",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    await screen.findByRole("table");
    expect(consultarQuadro).toHaveBeenLastCalledWith(
      "2026-11-23",
      "2026-11-29",
    );
  });

  it("pagina 10, 50 ou 100 pessoas", async () => {
    const muitas = Array.from({ length: 12 }, (_, i) =>
      pessoa(`Pessoa ${String(i + 1).padStart(2, "0")}`),
    );
    quadroCom(muitas);
    montar();
    await screen.findByRole("table");
    expect(
      screen.getByText("Mostrando 1–10 de 12 pessoas"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(
      screen.getByText("Mostrando 11–12 de 12 pessoas"),
    ).toBeInTheDocument();
    expect(
      within(tabela()).getByRole("rowheader", { name: /Pessoa 12/ }),
    ).toBeInTheDocument();
    // O grupo diz o total dele, não só o da página.
    expect(screen.getByText("12 pessoas")).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Pessoas por página" }),
      { target: { value: "50" } },
    );
    expect(
      screen.getByText("Mostrando 1–12 de 12 pessoas"),
    ).toBeInTheDocument();
  });

  it("aberto pela ficha: já filtra o departamento da pessoa, com como limpar", async () => {
    montar({ colaboradorEmFoco: "c-michell" });
    await screen.findByRole("table");
    expect(screen.getByText("1 de 3 pessoas")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Filtrar.*1 filtro ligado/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("3 pessoas · 3 departamentos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });

  it("Filtros: rascunho até 'Ver N pessoas', várias opções em todos os grupos, contagem facetada, pílulas aplicadas e descartar", async () => {
    quadroCom([
      { ...michell, gestor: { id: "c-julia", nome: "Julia Costa" } },
      julia,
      { ...teste, gestor: { id: "g-x", nome: "Gestor X" } },
    ]);
    montar();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    const gaveta = () => screen.getByRole("dialog", { name: "Filtros" });
    const contagem = () => within(gaveta()).getByRole("status");
    expect(contagem()).toHaveTextContent("3 de 3 pessoas no quadro");

    // Atalho: só Julia não tem padrão; o quadro só muda ao aplicar.
    const sem = within(gaveta()).getByRole("button", { name: /^Sem escala/ });
    expect(sem).toHaveTextContent("Sem escala1");
    fireEvent.click(sem);
    expect(sem).toHaveAttribute("aria-pressed", "true");
    expect(contagem()).toHaveTextContent("1 de 3 pessoas no quadro");
    // O quadro ao fundo continua com as 3 pessoas (ainda é rascunho).
    expect(screen.getByText("3 pessoas · 3 departamentos")).toBeInTheDocument();
    fireEvent.click(sem);

    // O nome do grupo ganha o número de marcados ("Gestor 2, 2 marcados").
    const grupo = (nome: string) =>
      within(gaveta()).getByRole("group", {
        name: new RegExp(`^${nome}(\\s|$)`),
      });
    expect(
      within(grupo("Departamento"))
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Não informado1", "Recursos Humanos1", "Tecnologia1"]);
    // Tipo de contrato e Turno: pílulas com contagem.
    expect(
      within(grupo("Tipo de contrato"))
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["CLT2", "Estágio1"]);
    expect(
      within(grupo("Turno"))
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Sem turno1", "Comercial1", "Loja1"]);

    // Gestor: linha fechada que abre uma lista de caixas (várias opções).
    const linha = within(gaveta()).getByRole("button", {
      name: /^Gestor\s*Todos/,
    });
    expect(linha).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(linha);
    expect(
      within(grupo("Gestor"))
        .getAllByRole("checkbox")
        .map((c) => c.getAttribute("id") !== null),
    ).toHaveLength(3);
    // O gestor que também está no quadro mostra o departamento ao lado.
    expect(
      within(grupo("Gestor")).getByText("Recursos Humanos"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(grupo("Gestor")).getByRole("checkbox", { name: /Julia Costa/ }),
    );
    fireEvent.click(
      within(grupo("Gestor")).getByRole("checkbox", { name: /Gestor X/ }),
    );
    expect(contagem()).toHaveTextContent("2 de 3 pessoas no quadro");
    // Contagem facetada: com os gestores marcados, Estágio (Julia) vai a 0.
    expect(
      within(grupo("Tipo de contrato")).getByRole("button", {
        name: /^Estágio/,
      }),
    ).toHaveTextContent("Estágio0");
    fireEvent.click(
      within(gaveta()).getByRole("button", { name: "Fechar", expanded: true }),
    );
    expect(
      within(gaveta()).getByRole("button", { name: /^Gestor/ }),
    ).toHaveTextContent("Gestor X, Julia Costa");

    fireEvent.click(
      within(gaveta()).getByRole("button", { name: "Ver 2 pessoas" }),
    );
    expect(screen.queryByRole("dialog", { name: "Filtros" })).toBeNull();
    expect(screen.getByText("2 de 3 pessoas")).toBeInTheDocument();
    expect(
      within(tabela()).queryByRole("rowheader", { name: /Julia/ }),
    ).toBeNull();
    const aplicados = screen.getByRole("group", { name: "Filtros aplicados" });
    expect(
      within(aplicados)
        .getAllByRole("button", { name: /^Remover o filtro/ })
        .map((b) => b.textContent),
    ).toEqual(["Gestor: Julia Costa", "Gestor: Gestor X"]);
    fireEvent.click(
      within(aplicados).getByRole("button", {
        name: "Remover o filtro Gestor: Julia Costa",
      }),
    );
    expect(screen.getByText("1 de 3 pessoas")).toBeInTheDocument();

    // Fechar sem aplicar descarta o rascunho.
    fireEvent.click(screen.getByRole("button", { name: /^Filtrar/ }));
    fireEvent.click(
      within(grupo("Tipo de contrato")).getByRole("button", { name: /^CLT/ }),
    );
    fireEvent.click(
      within(gaveta()).getAllByRole("button", { name: "Fechar" }).at(-1)!,
    );
    expect(screen.getByText("1 de 3 pessoas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Filtrar/ }));
    expect(
      within(grupo("Tipo de contrato")).getByRole("button", { name: /^CLT/ }),
    ).toHaveAttribute("aria-pressed", "false");
    // "Limpar tudo" no cabeçalho volta o rascunho a todos.
    fireEvent.click(
      within(gaveta()).getByRole("button", { name: "Limpar tudo" }),
    );
    expect(contagem()).toHaveTextContent("3 de 3 pessoas no quadro");
  });

  it("visões salvas: aparecem na gaveta, carregam o rascunho e aplicam; salvar pela linha dos filtros aplicados", async () => {
    const semEscala = { ...FILTROS_DO_QUADRO_VAZIOS, semEscala: true };
    vi.mocked(consultarVisoes).mockResolvedValue({
      visoes: [{ id: "v1", nome: "Sem escala", filtros: semEscala }],
    });
    montar();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    const gaveta = () => screen.getByRole("dialog", { name: "Filtros" });
    const chip = await within(gaveta()).findByRole("button", {
      name: "Sem escala",
      pressed: false,
    });
    expect(
      within(gaveta()).getByRole("button", { name: "Gerenciar" }),
    ).toBeInTheDocument();
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(within(gaveta()).getByRole("status")).toHaveTextContent(
      "1 de 3 pessoas no quadro",
    );
    fireEvent.click(
      within(gaveta()).getByRole("button", { name: "Ver 1 pessoa" }),
    );
    expect(screen.getByText("1 de 3 pessoas")).toBeInTheDocument();

    // "Salvar como visão" na linha dos filtros aplicados.
    vi.mocked(criarVisao).mockResolvedValue({
      visoes: [
        { id: "v2", nome: "Outra", filtros: semEscala },
        { id: "v1", nome: "Sem escala", filtros: semEscala },
      ],
    });
    const aplicados = screen.getByRole("group", { name: "Filtros aplicados" });
    fireEvent.click(
      within(aplicados).getByRole("button", { name: "Salvar como visão" }),
    );
    const janela = screen.getByRole("dialog", { name: "Salvar como visão" });
    fireEvent.change(within(janela).getByRole("textbox", { name: "Nome" }), {
      target: { value: "Outra" },
    });
    fireEvent.click(
      within(janela).getByRole("button", { name: "Salvar visão" }),
    );
    expect(await screen.findByText("Visão salva")).toBeInTheDocument();
    expect(criarVisao).toHaveBeenCalledWith({
      nome: "Outra",
      filtros: semEscala,
    });
    expect(
      screen.queryByRole("dialog", { name: "Salvar como visão" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Filtrar/ }));
    expect(
      within(gaveta())
        .getAllByRole("button", { name: /^(Outra|Sem escala)$/ })
        .map((b) => b.textContent),
    ).toEqual(["Outra", "Sem escala"]);
  });

  it("ausência aprovada vence o turno: caixa na semana, sigla e resumo no mês, atalho De férias ou afastados", async () => {
    quadroCom([
      {
        ...michell,
        ausencias: [
          {
            id: "a1",
            tipo: "falta_justificada",
            motivoAfastamento: null,
            inicio: "2026-11-26",
            fim: "2026-11-26",
          },
        ],
      },
      julia,
      teste,
    ]);
    montar();
    await screen.findByRole("table");
    const cm = within(linhaDe("Michell Bruno")).getAllByRole("cell");
    expect(cm[3]).toHaveTextContent("Falta justificadaAprovada");
    expect(cm[3]).toHaveTextContent(
      "Falta justificada de 26/11 a 26/11, aprovada",
    );
    // O dia não conta: 4 dias × 8 h.
    expect(cm[7]).toHaveTextContent("32 h");

    // Atalho: 1 pessoa ausente no período.
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    const gaveta = screen.getByRole("dialog", { name: "Filtros" });
    const atalho = within(gaveta).getByRole("button", {
      name: /^De férias ou afastados/,
    });
    expect(atalho).toHaveTextContent("De férias ou afastados1");
    fireEvent.click(atalho);
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Ver 1 pessoa" }),
    );
    expect(screen.getByText("1 de 3 pessoas")).toBeInTheDocument();

    // Mês: a sigla com a dica e o resumo na coluna de horas.
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    await screen.findByRole("table");
    const linha = linhaDe("Michell Bruno");
    const sigla = linha.querySelector(".quadro__sigla--ausencia")!;
    expect(sigla).toHaveTextContent("F");
    expect(linha.querySelector(".quadro__mes-dias")).toHaveTextContent(
      "Falta justificada até 26/11",
    );
  });

  it("legenda com os turnos da página; ações de voltar e Turnos", async () => {
    const onVoltar = vi.fn();
    const onAbrirTurnos = vi.fn();
    montar({ onVoltar, onAbrirTurnos });
    await screen.findByRole("table");
    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(
      within(legenda)
        .getAllByRole("listitem")
        .map((i) => i.textContent),
    ).toEqual(["Comercial", "Loja"]);
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Turnos" }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
    expect(onAbrirTurnos).toHaveBeenCalledTimes(1);
  });

  it("falha: tenta de novo; sem empresa ativa (403) explica e não oferece tentar", async () => {
    vi.mocked(consultarQuadro).mockRejectedValueOnce(new Error("rede"));
    montar();
    expect(
      await screen.findByText("Não foi possível carregar o quadro de escala."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("table");

    vi.mocked(consultarQuadro).mockRejectedValueOnce(
      new ApiError(403, "Proibido", {}),
    );
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }));
    expect(
      await screen.findByText(
        "Escolha uma empresa para ver o quadro de escala.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });

  it("sem ninguém no período", async () => {
    quadroCom([]);
    montar();
    expect(
      await screen.findByText("Nenhuma pessoa com vínculo neste período."),
    ).toBeInTheDocument();
  });
});

describe("T215 — quadro da escala: mês", () => {
  beforeEach(() => {
    vi.mocked(consultarQuadro).mockReset();
    vi.mocked(consultarVisoes).mockReset();
    quadroCom();
  });

  it("mês inteiro: dias com a letra da semana, feriado marcado, siglas, D no DSR e horas sobre a meta", async () => {
    montar();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect(screen.getAllByText("Novembro de 2026").length).toBeGreaterThan(0);
    await screen.findByRole("table");
    expect(consultarQuadro).toHaveBeenLastCalledWith(
      "2026-11-01",
      "2026-11-30",
    );
    const cab = within(
      tabela().querySelector("thead tr") as HTMLElement,
    ).getAllByRole("columnheader");
    // Colaborador + 30 dias + Horas no mês.
    expect(cab).toHaveLength(32);
    expect(cab[1]).toHaveTextContent("1D");
    const feriado = cab[15]!;
    expect(feriado).toHaveTextContent(
      "domingo 15/11, feriado: Proclamação da República",
    );
    expect(feriado.className).toContain("quadro__dia--feriado");
    expect(cab[14]!.className).not.toContain("quadro__dia--feriado");

    const m = linhaDe("Michell Bruno");
    const cs = within(m).getAllByRole("cell");
    expect(cs[0]).toHaveTextContent("D"); // domingo 1
    expect(cs[0]).toHaveTextContent("DSR, descanso semanal remunerado");
    expect(cs[1]).toHaveTextContent("CComercial, 09:00–18:00"); // segunda 2
    expect(cs[6]).toHaveTextContent("Folga"); // sábado 7, sem sigla
    expect(cs[6]!.querySelector(".quadro__sigla")).toBeNull();
    // 21 dias úteis × 8 h = 168 h; meta 44 h × 30 ÷ 7 ≈ 189 h.
    expect(cs[cs.length - 1]).toHaveTextContent("168/189 h");
    expect(cs[cs.length - 1]).toHaveTextContent("21 dias");

    // Estágio de 30 h: meta 30 × 30 ÷ 7 ≈ 129 h.
    const j = linhaDe("Julia Costa");
    const cj = within(j).getAllByRole("cell");
    expect(cj[cj.length - 1]).toHaveTextContent("0/129 h");
    expect(cj[cj.length - 1]).toHaveTextContent("0 dias");

    expect(screen.getByText("Shift + rolar para os lados")).toBeInTheDocument();
    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(
      within(legenda)
        .getAllByRole("listitem")
        .map((i) => i.textContent),
    ).toEqual(["CComercial", "LJLoja", "DDSR", "Ausência"]);
  });

  it("próximo mês e virada de ano", async () => {
    montar();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }));
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }));
    await screen.findByRole("table");
    expect(consultarQuadro).toHaveBeenLastCalledWith(
      "2027-01-01",
      "2027-01-31",
    );
    expect(screen.getAllByText("Janeiro de 2027").length).toBeGreaterThan(0);
  });
});
