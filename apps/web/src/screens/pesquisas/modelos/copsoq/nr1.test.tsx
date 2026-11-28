/**
 * T216 — Riscos psicossociais (NR-1), 3ª revisão: navegação da Visão geral,
 * sigilo dos comportamentos ofensivos, cores e barras, Por grupo (ranking,
 * onde está o risco, mapa de calor, exigências × recursos), biblioteca de
 * medidas sugeridas, PDF e pacote da conformidade, arquivos de evidência,
 * escala de saúde 5 a 1 e a página "Sobre o modelo".
 */
import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AcompanhamentoNr1,
  DimensaoNr1Resultado,
  GrupoDoModelo,
  NivelNr1,
  ResultadoNr1,
  ServicoDosModelos,
} from "../../../../api/modelosDePesquisaClient";
import type {
  PesquisaDetalhe,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { CampoDaPergunta } from "../../../publico/CampoDaPergunta";
import { DETALHE, RESULTADOS, servicoFalso } from "../../dadosDeTeste";
import { modeloDaGaleria, secoesDoModelo } from "../../modelosDePesquisa";
import { ResultadosDaPesquisa } from "../../ResultadosDaPesquisa";
import { abasDoModelo } from "../exportacao";
import { JanelaDeExemplo } from "../PaginaDoModelo";
import { PainelDoModelo, VisaoGeralNr1DoRegistro } from "../registro";
import { mensagemDoEnvio } from "./AcompanhamentoNr1";
import { RISCOS_PSICOSSOCIAIS } from "./catalogo";
import {
  DIMENSOES_NR1,
  TIPOS_DE_OFENSA,
  dimensoesDoDominio,
} from "./definicao";
import {
  blocosDaConformidade,
  blocosDoPlano,
  montarPacote,
  nomeNoPacote,
  pdfDoPlano,
  quebrarLinhas,
} from "./documentosNr1";
import {
  MEDIDAS_SUGERIDAS,
  dimensaoCombina,
  medidaDaSugestao,
  prazoPeloNivel,
  somarDias,
  sugestoesDa,
} from "./medidasSugeridas";
import { NIVEL } from "./textos";
import {
  frequenciasDoTipo,
  ondeEstaORisco,
  quadranteDe,
  rankingDosGrupos,
  riscoPorDominio,
} from "./VisaoGeralNr1";

configure({ asyncUtilTimeout: 4000 });

const NIVEIS_DE_TESTE: Record<string, NivelNr1> = {
  exigencias_quantitativas: "critico",
  ritmo_trabalho: "alto",
  apoio_social_colegas: "alto",
  burnout: "medio",
};

function dimensao(id: string): DimensaoNr1Resultado {
  const d = DIMENSOES_NR1.find((x) => x.id === id)!;
  const nivel = NIVEIS_DE_TESTE[id] ?? "baixo";
  const risco = nivel === "critico" ? 3 : nivel === "alto" ? 2 : 0;
  return {
    id,
    dominio: d.dominio,
    tipo: d.tipo,
    pessoas: 4,
    escore: nivel === "critico" ? 4.25 : 3,
    tercil: nivel === "critico" ? 3 : 2,
    faixa: risco ? "risco" : "intermediario",
    distribuicao: { risco, intermediario: 4 - risco, favoravel: 0 },
    percentuais: {
      risco: risco * 25,
      intermediario: (4 - risco) * 25,
      favoravel: 0,
    },
    severidade: nivel === "critico" ? 4 : 3,
    prevalencia: nivel === "critico" ? 4 : nivel === "alto" ? 3 : 1,
    nivel,
    regraDeProtecao: false,
  };
}

const DIMENSOES = DIMENSOES_NR1.map((d) => dimensao(d.id));
const PRIORIDADES = [
  "exigencias_quantitativas",
  "apoio_social_colegas",
  "ritmo_trabalho",
  "burnout",
  ...DIMENSOES_NR1.map((d) => d.id).filter((id) => !(id in NIVEIS_DE_TESTE)),
];

const MODELO: ResultadoNr1 = {
  modelo: "copsoq",
  respostas: 4,
  dimensoes: DIMENSOES,
  prioridades: PRIORIDADES,
  niveis: { critico: 1, alto: 2, medio: 1, baixo: 25 },
  precisamDeAcao: 3,
  matriz: [
    [[], [], [], ["exigencias_quantitativas"]],
    [[], [], ["apoio_social_colegas", "ritmo_trabalho"], []],
    [[], [], [], []],
    [
      [
        "burnout",
        "previsibilidade",
        "reconhecimento",
        "autoeficacia",
        "stress",
      ],
      [],
      [],
      [],
    ],
  ],
  dominios: [],
  saude: [
    {
      id: "burnout",
      pessoasEmRisco: 1,
      pessoas: 4,
      percentualEmRisco: 25,
      nivel: "medio",
    },
  ],
  ofensivos: {
    pessoas: 8,
    relataram: 5,
    percentual: 62.5,
    tipos: [
      // Assédio: total visível, uma frequência oculta e outra visível.
      {
        id: "Q73",
        raramente: null,
        asVezes: null,
        frequentementeOuSempre: 3,
        relataram: 5,
      },
      // Conduta sexual: total oculto (menos de 3) — nunca "0 pessoas".
      {
        id: "Q74",
        raramente: null,
        asVezes: 0,
        frequentementeOuSempre: 0,
        relataram: null,
      },
      {
        id: "Q75",
        raramente: 0,
        asVezes: 0,
        frequentementeOuSempre: 0,
        relataram: 0,
      },
      {
        id: "Q76",
        raramente: 0,
        asVezes: 0,
        frequentementeOuSempre: 0,
        relataram: 0,
      },
    ],
  },
  pressao: 3.31,
  recursos: 2.9,
};

const etapa = (
  id: AcompanhamentoNr1["etapas"][number]["id"],
  itens: number,
  extra: Partial<AcompanhamentoNr1["etapas"][number]> = {},
) => ({
  id,
  itens: Array.from({ length: itens }, () => false),
  evidencias: null,
  concluidaEm: null,
  concluida: false,
  automatica: id === "mapear" || id === "plano",
  arquivos: [],
  ...extra,
});

const ACOMPANHAMENTO: AcompanhamentoNr1 = {
  etapas: [
    etapa("mapear", 0, { concluida: true }),
    etapa("plano", 0),
    etapa("comunicar", 3),
    etapa("validar", 3),
    etapa("treinar", 3),
    etapa("implementar", 3),
    etapa("revisar", 2),
  ],
  plano: [],
  profissionalSst: { nome: null, registro: null },
  atualizadoEm: null,
  concluidas: 1,
  proxima: "plano",
  revisarEm: "2027-11",
};

const GERAL: ResultadosPesquisa = {
  ...RESULTADOS,
  respostas: 4,
  recortes: ["departamento"],
  grupos: {
    departamento: [
      {
        id: "g1",
        nome: "Comercial",
        respostas: 3,
        visivel: true,
        oculto: null,
      },
      {
        id: "g2",
        nome: "Financeiro",
        respostas: 4,
        visivel: true,
        oculto: null,
      },
      {
        id: "g3",
        nome: "Jurídico",
        respostas: 1,
        visivel: false,
        oculto: "minimo",
      },
    ],
  },
  modelo: MODELO,
};

let numero = 0;
/** Cada teste com a sua pesquisa (o acompanhamento lembrado não vaza). */
function nr1(): PesquisaDetalhe {
  numero += 1;
  return {
    ...DETALHE,
    id: `p-nr1-${numero}`,
    nome: "NR-1 · Teste",
    modelo: "copsoq",
    identificacao: "anonima",
    separarPor: ["departamento"],
    respostas: 4,
  };
}

/** O conteúdo de um Blob (o do jsdom não tem `arrayBuffer`). */
function lerBlob(blob: Blob): Promise<Uint8Array> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(new Uint8Array(leitor.result as ArrayBuffer));
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsArrayBuffer(blob);
  });
}

function servicoDosModelos(
  extra: Partial<ServicoDosModelos> = {},
): ServicoDosModelos {
  return {
    acompanhamentoNr1: vi.fn(() => Promise.resolve(ACOMPANHAMENTO)),
    gravarAcompanhamentoNr1: vi.fn((_id, e) =>
      Promise.resolve({
        ...ACOMPANHAMENTO,
        plano: e.plano,
        concluidas: e.plano.length ? 2 : 1,
      }),
    ),
    ...extra,
  };
}

describe("Visão geral: atalhos e navegação", () => {
  it("os cartões levam ao plano e à conformidade; o nível tem explicação", async () => {
    const onTrocarAba = vi.fn();
    render(
      <VisaoGeralNr1DoRegistro
        detalhe={nr1()}
        geral={GERAL}
        servicoDosModelos={servicoDosModelos()}
        onTrocarAba={onTrocarAba}
      />,
    );
    await screen.findByText("1 de 7 etapas");
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir o plano de ação" }),
    );
    expect(onTrocarAba).toHaveBeenLastCalledWith("plano");
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir a conformidade" }),
    );
    expect(onTrocarAba).toHaveBeenLastCalledWith("conformidade");
    expect(screen.getByText("Como o nível é definido")).toBeInTheDocument();
    expect(
      screen.getByText(/Prevalência/, { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("'Ver todas' abre o nível inteiro; chips e +N da matriz são clicáveis", () => {
    render(
      <VisaoGeralNr1DoRegistro
        detalhe={nr1()}
        geral={GERAL}
        servicoDosModelos={servicoDosModelos()}
        onTrocarAba={vi.fn()}
      />,
    );
    const baixo = screen.getByLabelText("Nível Baixo");
    expect(within(baixo).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(
      within(baixo).getByRole("button", { name: "Ver todas as 25 ›" }),
    );
    expect(within(baixo).getAllByRole("listitem")).toHaveLength(25);
    fireEvent.click(within(baixo).getByRole("button", { name: "Ver menos" }));
    expect(within(baixo).getAllByRole("listitem")).toHaveLength(3);

    const matriz = screen.getByRole("table", { name: /Matriz de risco/ });
    const mais = within(matriz).getByRole("button", { name: "+2 dimensões" });
    fireEvent.click(mais);
    fireEvent.click(within(matriz).getByRole("button", { name: "Stress" }));
    expect(screen.getByText("Dimensão escolhida")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stress" })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Voltar às de risco alto ou crítico",
      }),
    );
    expect(
      screen.getByText("1 de 3 em risco alto ou crítico"),
    ).toBeInTheDocument();
    // Chip de uma dimensão em ação: vai para ela no carrossel.
    fireEvent.click(
      within(matriz).getByRole("button", { name: "Ritmo de Trabalho" }),
    );
    expect(
      screen.getByText("3 de 3 em risco alto ou crítico"),
    ).toBeInTheDocument();
  });

  it("ranking: linhas clicáveis, 'Ver todas as 29' e pessoas em risco", () => {
    render(
      <VisaoGeralNr1DoRegistro
        detalhe={nr1()}
        geral={GERAL}
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    const ranking = screen.getByRole("region", {
      name: "Ranking de prioridades",
    });
    expect(within(ranking).getByText("3 pessoas em risco")).toBeInTheDocument();
    fireEvent.click(
      within(ranking).getByRole("button", {
        name: "Ver todas as 29 dimensões",
      }),
    );
    expect(within(ranking).getAllByRole("row")).toHaveLength(30);
    expect(
      within(ranking).getAllByText("0 pessoas em risco").length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      within(ranking).getByRole("button", { name: "Autoeficácia" }),
    );
    expect(
      screen.getByRole("heading", { name: "Autoeficácia" }),
    ).toBeInTheDocument();
  });

  it("'Ver o plano de ação desta dimensão' abre o plano nela", async () => {
    const d = nr1();
    const onTrocarAba = vi.fn();
    const sm = servicoDosModelos();
    const { unmount } = render(
      <VisaoGeralNr1DoRegistro
        detalhe={d}
        geral={GERAL}
        servicoDosModelos={sm}
        onTrocarAba={onTrocarAba}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Próxima dimensão" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver o plano de ação desta dimensão",
      }),
    );
    expect(onTrocarAba).toHaveBeenCalledWith("plano");
    unmount();
    render(
      <PainelDoModelo
        detalhe={d}
        geral={GERAL}
        servico={servicoFalso()}
        aba="plano"
        podeEditar
        servicoDosModelos={sm}
      />,
    );
    expect(
      await screen.findByRole("region", {
        name: "Medidas de Apoio Social de Colegas",
      }),
    ).toBeInTheDocument();
  });

  it("as abas mostram os contadores do plano e da conformidade", async () => {
    const d = nr1();
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() => Promise.resolve(d)),
          resultadosDaPesquisa: vi.fn(() => Promise.resolve(GERAL)),
        })}
        servicoDosModelos={servicoDosModelos()}
        pesquisaId={d.id}
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    // A Visão geral leva à conformidade; o acompanhamento carregado
    // aparece nos contadores das abas.
    fireEvent.click(
      await screen.findByRole("button", { name: "Abrir a conformidade" }),
    );
    expect(
      await screen.findByRole("img", { name: "1 de 7 etapas concluídas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Conformidade NR-1 1/7" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Plano de ação 0" }),
    ).toBeInTheDocument();
  }, 20_000);
});

describe("comportamentos ofensivos, saúde e cores", () => {
  it("sigilo: 'menos de 3 pessoas', barra só com as frequências visíveis e a ordem dos tipos", () => {
    render(
      <VisaoGeralNr1DoRegistro
        detalhe={nr1()}
        geral={GERAL}
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    const secao = screen.getByRole("region", {
      name: "Comportamentos ofensivos",
    });
    const cartoes = within(secao).getAllByRole("listitem");
    expect(cartoes.map((c) => c.querySelector("strong")!.textContent)).toEqual([
      "Assédio moral",
      "Ameaça de violência",
      "Conduta sexual indesejada",
      "Violência física",
    ]);
    expect(
      within(cartoes[2]!).getByText("menos de 3 pessoas"),
    ).toBeInTheDocument();
    expect(within(cartoes[2]!).queryByText("0 pessoas")).toBeNull();
    expect(within(cartoes[2]!).queryByRole("img")).toBeNull();
    const barra = within(cartoes[0]!).getByRole("img", {
      name: /Assédio moral por frequência/,
    });
    expect(barra.getAttribute("aria-label")).toContain(
      "Frequentemente ou sempre: 100%",
    );
    expect(barra.getAttribute("aria-label")).not.toContain("Raramente");
    expect(
      within(cartoes[0]!).getByText(
        "Oculto para proteger quem respondeu: Raramente, Às vezes.",
      ),
    ).toBeInTheDocument();
    expect(within(cartoes[1]!).getByText("0 pessoas")).toBeInTheDocument();
  });

  it("frequências do tipo separam visíveis e ocultas", () => {
    expect(
      frequenciasDoTipo({
        raramente: 3,
        asVezes: null,
        frequentementeOuSempre: 0,
      }),
    ).toEqual({
      visiveis: [
        { rotulo: "Raramente", valor: 3, cor: expect.any(String) },
        {
          rotulo: "Frequentemente ou sempre",
          valor: 0,
          cor: expect.any(String),
        },
      ],
      ocultas: ["Às vezes"],
    });
    expect(TIPOS_DE_OFENSA.map((t) => t.id)).toEqual([
      "Q73",
      "Q75",
      "Q74",
      "Q76",
    ]);
  });

  it("saúde com barra de 3 faixas; médio âmbar e alto laranja", () => {
    render(
      <VisaoGeralNr1DoRegistro
        detalhe={nr1()}
        geral={GERAL}
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    const saude = screen.getByRole("region", { name: "Saúde e bem-estar" });
    const barra = within(saude).getByRole("img", {
      name: /Burnout: distribuição/,
    });
    expect(barra.getAttribute("aria-label")).toContain("Risco: 0%");
    expect(barra.getAttribute("aria-label")).toContain("Intermediário: 100%");
    expect(
      within(saude).getByText("1 de 4 pessoas em risco"),
    ).toBeInTheDocument();
    const medio = within(saude).getByText("Médio").closest(".evolli-badge")!;
    expect(medio.className).toContain("evolli-badge--warning");
    const alto = screen.getAllByText("Alto")[0]!.closest(".evolli-badge")!;
    expect(alto.className).toContain("nr1__selo-alto");
    const critico = screen
      .getAllByText("Crítico")[0]!
      .closest(".evolli-badge")!;
    expect(critico.className).toContain("evolli-badge--danger");
  });

  it("planilha: contagem oculta não vira zero", () => {
    const abas = abasDoModelo(GERAL, "Empresa Sintética", "NR-1", {
      minimoPorGrupo: 3,
    });
    const destaques = abas.find((a) => a.nome === "Destaques")!.linhas;
    expect(destaques).toContainEqual([
      "Assédio moral",
      "Oculto",
      "Oculto",
      3,
      5,
    ]);
    expect(destaques).toContainEqual([
      "Conduta sexual indesejada",
      "Oculto",
      0,
      0,
      "Menos de 3",
    ]);
    expect(destaques).toContainEqual(["Ameaça de violência", 0, 0, 0, 0]);
  });
});

/** Um grupo visível com níveis e % em risco dados. */
function grupo(
  id: string,
  nome: string,
  pressao: number | null,
  recursos: number | null,
  risco: Record<string, number>,
  precisamDeAcao = 0,
): GrupoDoModelo {
  return {
    id,
    nome,
    respostas: 3,
    visivel: true,
    oculto: null,
    nr1: {
      pressao,
      recursos,
      destaque: false,
      niveis: {
        critico: 0,
        alto: precisamDeAcao,
        medio: 0,
        baixo: 29 - precisamDeAcao,
      },
      precisamDeAcao,
      dimensoes: DIMENSOES_NR1.map((d) => ({
        id: d.id,
        escore: 3,
        percentualEmRisco: risco[d.id] ?? 0,
        nivel: (risco[d.id] ?? 0) >= 50 ? "alto" : "baixo",
      })),
    },
    isfb: null,
  };
}

describe("Por grupo", () => {
  it("quadrantes pelo meio da escala", () => {
    expect(quadranteDe(3.6, 2.5)).toBe("alta_tensao");
    expect(quadranteDe(3.6, 3)).toBe("trabalho_ativo");
    expect(quadranteDe(3, 2.9)).toBe("passivo");
    expect(quadranteDe(2, 4)).toBe("baixa_tensao");
    expect(quadranteDe(null, 4)).toBeNull();
  });

  it("onde está o risco, risco por domínio e a ordem dos grupos", () => {
    const g = grupo(
      "g1",
      "Comercial",
      3.5,
      2.5,
      {
        ritmo_trabalho: 100,
        burnout: 75,
        stress: 50,
      },
      3,
    );
    const linhas = ondeEstaORisco(g.nr1!, MODELO);
    expect(linhas).toHaveLength(6);
    expect(linhas[0]).toEqual({
      id: "ritmo_trabalho",
      grupo: 100,
      empresa: 50,
      diferenca: 50,
      nivel: "alto",
    });
    expect(linhas[1]!.id).toBe("burnout");
    const dom = riscoPorDominio(g.nr1!.dimensoes);
    expect(dom.exigencias_laborais).toBe(25);
    expect(dom.saude_bem_estar).toBe(25);
    expect(dom.personalidade).toBe(0);
    const outro = grupo("g2", "Financeiro", 2.5, 3.5, {}, 0);
    const empatado = grupo("g0", "Administrativo", 2.5, 3.5, {}, 0);
    expect(rankingDosGrupos([outro, g, empatado]).map((x) => x.nome)).toEqual([
      "Comercial",
      "Administrativo",
      "Financeiro",
    ]);
  });

  it("ranking clicável, onde está o risco, mapa de calor, quadrantes e falha do grupo", async () => {
    const porGrupo: Record<string, ResultadosPesquisa | Error> = {
      g1: {
        ...GERAL,
        respostas: 3,
        modelo: {
          ...MODELO,
          pressao: 3.6,
          recursos: 2.5,
          precisamDeAcao: 2,
          dimensoes: MODELO.dimensoes.map((d): DimensaoNr1Resultado =>
            d.id === "burnout"
              ? {
                  ...d,
                  nivel: "alto",
                  percentuais: { ...d.percentuais, risco: 100 },
                }
              : d,
          ),
        },
      },
      g2: new Error("500"),
    };
    const resultadosDaPesquisa = vi.fn(
      (_id: string, f?: { grupoId: string } | null) => {
        const r = porGrupo[f?.grupoId ?? ""];
        return r instanceof Error
          ? Promise.reject(r)
          : Promise.resolve(r ?? GERAL);
      },
    );
    render(
      <PainelDoModelo
        detalhe={nr1()}
        geral={GERAL}
        servico={servicoFalso({
          resultadosDaPesquisa: resultadosDaPesquisa as never,
        })}
        aba="analises"
        podeEditar
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    expect(
      await screen.findByText("Não foi possível carregar este grupo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar 1 grupo.",
    );
    expect(
      screen.getByText("Oculto · menos de 3 respostas"),
    ).toBeInTheDocument();
    const ranking = screen.getByRole("region", {
      name: "Ranking por departamento",
    });
    fireEvent.click(within(ranking).getByRole("button", { name: /Comercial/ }));
    const onde = screen.getByRole("region", {
      name: "Comercial · onde está o risco",
    });
    const primeira = within(onde).getAllByRole("row")[1]!;
    expect(primeira).toHaveTextContent("Burnout (Esgotamento)");
    expect(primeira).toHaveTextContent("+100 p.p.");
    const calor = screen.getByRole("region", {
      name: "Mapa de calor por domínio",
    });
    expect(within(calor).getAllByRole("row")).toHaveLength(3);
    const quadrantes = screen.getByRole("region", {
      name: "Exigências × recursos",
    });
    expect(
      within(quadrantes).getByRole("img").getAttribute("aria-label"),
    ).toContain("Comercial, Alta tensão");
    expect(
      within(quadrantes).getAllByText("Alta tensão").length,
    ).toBeGreaterThan(1);
  });
});

describe("biblioteca de medidas sugeridas", () => {
  it("três medidas próprias por dimensão, dentro dos limites do plano", () => {
    expect(MEDIDAS_SUGERIDAS).toHaveLength(87);
    expect(new Set(MEDIDAS_SUGERIDAS.map((m) => m.id)).size).toBe(87);
    for (const d of DIMENSOES_NR1) expect(sugestoesDa(d.id)).toHaveLength(3);
    for (const m of MEDIDAS_SUGERIDAS) {
      const medida = medidaDaSugestao(m, "x", "2026-11-28", "alto");
      expect(medida.titulo.length).toBeGreaterThan(5);
      expect(medida.titulo.length).toBeLessThanOrEqual(200);
      expect(medida.descricao!.length).toBeLessThanOrEqual(1000);
      expect(medida.indicador!.length).toBeLessThanOrEqual(300);
      expect(
        [m.opcaoA, m.opcaoB, m.referencia].every((t) => t.length > 5),
      ).toBe(true);
    }
    // Ordem de controles: eliminação antes de proteção.
    const ordem = sugestoesDa("comportamentos_ofensivos").map(
      (m) => m.controle,
    );
    expect(ordem[0]).toBe("eliminacao");
  });

  it("prazo pelo nível e a busca sem acento pelo nome ou pela medida", () => {
    const m = sugestoesDa("burnout").find((x) => x.prazoDias === 60)!;
    expect(prazoPeloNivel(m, "critico")).toBe(30);
    expect(prazoPeloNivel(m, "alto")).toBe(60);
    expect(prazoPeloNivel(m, "medio")).toBe(90);
    expect(somarDias("2026-12-20", 30)).toBe("2027-01-19");
    expect(medidaDaSugestao(m, "id1", "2026-12-20", "critico")).toMatchObject({
      id: "id1",
      dimensaoId: "burnout",
      prazo: "2027-01-19",
      situacao: "planejada",
      responsavel: null,
    });
    expect(
      dimensaoCombina(
        "comportamentos_ofensivos",
        "Comportamentos Ofensivos",
        "assedio",
      ),
    ).toBe(true);
    expect(
      dimensaoCombina("burnout", "Burnout (Esgotamento)", "ESGOTAMENTO"),
    ).toBe(true);
    expect(dimensaoCombina("autoeficacia", "Autoeficácia", "assédio")).toBe(
      false,
    );
  });

  it("no plano: sugestões da dimensão, adicionar ao plano, busca e PDF", async () => {
    const sm = servicoDosModelos();
    const d = nr1();
    render(
      <PainelDoModelo
        detalhe={d}
        geral={GERAL}
        servico={servicoFalso()}
        aba="plano"
        podeEditar
        servicoDosModelos={sm}
      />,
    );
    const cartao = await screen.findByRole("region", {
      name: "Medidas de Exigências Quantitativas",
    });
    const lista = within(cartao).getByRole("list", {
      name: "Medidas sugeridas para Exigências Quantitativas",
    });
    expect(
      within(lista)
        .getAllByRole("listitem")
        .filter((li) => li.className === "nr1__sugestao"),
    ).toHaveLength(3);
    const primeira = within(lista).getAllByRole("button", {
      name: "Adicionar ao plano",
    })[0]!;
    fireEvent.click(primeira);
    expect(
      within(lista).getByRole("button", { name: "No plano" }),
    ).toBeDisabled();
    expect(within(cartao).getByLabelText("O que fazer")).toHaveValue(
      "Rever o volume de demandas por pessoa",
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar plano" }));
    await waitFor(() =>
      expect(sm.gravarAcompanhamentoNr1).toHaveBeenCalledTimes(1),
    );
    const [, entrada] = vi.mocked(sm.gravarAcompanhamentoNr1).mock.calls[0]!;
    expect(entrada.plano[0]).toMatchObject({
      dimensaoId: "exigencias_quantitativas",
      controle: "eliminacao",
      indicador: "Horas extras por pessoa no mês e tarefas atrasadas por área.",
    });
    expect(entrada.plano[0]!.descricao).toContain("Opção A:");

    fireEvent.change(screen.getByLabelText("Buscar dimensão ou medida"), {
      target: { value: "assedio" },
    });
    const nav = screen.getByRole("navigation", { name: "Dimensões do plano" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([expect.stringContaining("Comportamentos Ofensivos")]);
    fireEvent.change(screen.getByLabelText("Buscar dimensão ou medida"), {
      target: { value: "xyzxyz" },
    });
    expect(within(nav).getByRole("status")).toHaveTextContent(
      "Nenhuma dimensão ou medida encontrada.",
    );
    // "Baixar PDF": o PDF do plano, gerado no navegador.
    const criar = vi.fn((_b: Blob) => "blob:plano");
    const antes = { criar: URL.createObjectURL, revogar: URL.revokeObjectURL };
    URL.createObjectURL = criar as never;
    URL.revokeObjectURL = vi.fn() as never;
    try {
      fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));
      await waitFor(() => expect(criar).toHaveBeenCalled());
      const blob = criar.mock.calls[0]![0];
      expect(blob.type).toBe("application/pdf");
    } finally {
      URL.createObjectURL = antes.criar;
      URL.revokeObjectURL = antes.revogar;
    }
  });
});

describe("PDF do plano, conformidade e pacote .zip", () => {
  const CTX = {
    empresa: "Empresa Sintética",
    pesquisa: "NR-1 · Teste",
    hoje: "2026-11-28",
  };

  it("o plano lista as medidas da empresa e as sugestões de crítico, alto e médio", () => {
    const blocos = blocosDoPlano(
      MODELO,
      [
        {
          id: "m1",
          dimensaoId: "burnout",
          titulo: "Pausas programadas",
          descricao: null,
          controle: "administrativo",
          responsavel: "RH",
          prazo: "2027-01-31",
          indicador: "Pausas cumpridas",
          situacao: "em_andamento",
        },
      ],
      CTX,
    );
    const textos = blocos.map((b) => ("texto" in b ? b.texto : ""));
    expect(textos).toContain("• Pausas programadas");
    expect(textos).toContain(
      "Controles administrativos · Responsável: RH · Prazo: 31/01/2027 · Em andamento",
    );
    expect(textos).toContain(
      "Exigências Quantitativas · Crítico · Ação imediata",
    );
    expect(textos).toContain("Burnout (Esgotamento) · Médio · Monitorar");
    // Dimensão baixa não recebe sugestão no documento.
    expect(textos.some((t) => t.startsWith("Autoeficácia ·"))).toBe(false);
    expect(textos.filter((t) => t.startsWith("Opção A:"))).toHaveLength(4 * 3);
    // Sem resultado (confidencial com poucas respostas): só as medidas.
    const semResultado = blocosDoPlano(null, [], CTX).map((b) =>
      "texto" in b ? b.texto : "",
    );
    expect(semResultado).toContain("Nenhuma medida registrada ainda.");
    expect(semResultado).toContain(
      "Nenhuma dimensão em nível crítico, alto ou médio.",
    );
  });

  it("a conformidade traz etapas, itens, evidências, arquivos e assinaturas", () => {
    const a: AcompanhamentoNr1 = {
      ...ACOMPANHAMENTO,
      etapas: ACOMPANHAMENTO.etapas.map((e) =>
        e.id === "comunicar"
          ? {
              ...e,
              itens: [true, false, false],
              evidencias: "Ata na pasta do RH",
              arquivos: [
                {
                  id: "a1",
                  nome: "ata.pdf",
                  formato: "pdf",
                  tamanhoBytes: 10,
                  enviadoEm: "2026-11-28T12:00:00Z",
                },
              ],
            }
          : e,
      ),
      profissionalSst: { nome: "Profissional Sintético", registro: "REG 123" },
    };
    const blocos = blocosDaConformidade(a, CTX);
    const textos = blocos.map((b) => ("texto" in b ? b.texto : ""));
    expect(textos).toContain(
      "3. Comunicar os resultados às pessoas · Pendente",
    );
    expect(textos).toContain(
      "[x] Marcar uma reunião com o time ou com cada área",
    );
    expect(textos).toContain("Evidências: Ata na pasta do RH");
    expect(textos).toContain("Arquivos anexados: ata.pdf");
    expect(textos).toContain(
      "Profissional de SST: Profissional Sintético · REG 123",
    );
    expect(blocos.at(-1)).toMatchObject({ tipo: "assinatura" });
  });

  it("o PDF é válido e quebra linhas longas; o pacote nomeia e numera os arquivos", () => {
    const bytes = pdfDoPlano(MODELO, [], CTX);
    const texto = new TextDecoder("latin1").decode(bytes);
    expect(texto.startsWith("%PDF-1.4")).toBe(true);
    expect(texto.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(Number(/\/Count (\d+)/.exec(texto)![1])).toBeGreaterThan(1);
    expect(
      quebrarLinhas("palavra ".repeat(80), 200, 10).length,
    ).toBeGreaterThan(3);
    expect(nomeNoPacote("../Ata da reunião?.pdf")).toBe("Ata-da-reuniao-.pdf");
    const pacote = montarPacote({
      plano: new Uint8Array([1]),
      conformidade: new Uint8Array([2]),
      planilha: new Uint8Array([3]),
      evidencias: [
        { etapa: "comunicar", nome: "ata.pdf", bytes: new Uint8Array([4]) },
        { etapa: "comunicar", nome: "ata.pdf", bytes: new Uint8Array([5]) },
        {
          etapa: "revisar",
          nome: "novo plano.pptx",
          bytes: new Uint8Array([6]),
        },
      ],
    });
    expect(pacote.arquivos).toEqual([
      "01-plano-de-acao.pdf",
      "02-conformidade.pdf",
      "03-respostas.xlsx",
      "evidencias/03-comunicar/ata.pdf",
      "evidencias/03-comunicar/ata-2.pdf",
      "evidencias/07-revisar/novo-plano.pptx",
    ]);
    const zip = new TextDecoder("latin1").decode(pacote.bytes);
    expect(zip.startsWith("PK")).toBe(true);
    expect(zip).toContain("evidencias/03-comunicar/ata-2.pdf");
    expect(
      montarPacote({
        plano: new Uint8Array(),
        conformidade: new Uint8Array(),
        planilha: null,
        evidencias: [],
      }).arquivos,
    ).toEqual(["01-plano-de-acao.pdf", "02-conformidade.pdf"]);
  });
});

describe("conformidade: arquivos de evidência e o pacote", () => {
  const ARQ = {
    id: "a1",
    nome: "Ata da reunião.pdf",
    formato: "pdf" as const,
    tamanhoBytes: 1_258_291,
    enviadoEm: "2026-11-28T12:00:00Z",
  };
  const comArquivo = (a: AcompanhamentoNr1): AcompanhamentoNr1 => ({
    ...a,
    etapas: a.etapas.map((e) =>
      e.id === "comunicar" ? { ...e, arquivos: [ARQ] } : e,
    ),
  });

  it("envia, lista, remove; concluir habilita só com arquivo", async () => {
    const enviarEvidenciaNr1 = vi.fn(() =>
      Promise.resolve(comArquivo(ACOMPANHAMENTO)),
    );
    const removerEvidenciaNr1 = vi.fn(() => Promise.resolve(ACOMPANHAMENTO));
    const baixarEvidenciaNr1 = vi.fn(() => Promise.resolve(new Blob(["x"])));
    const sm = servicoDosModelos({
      enviarEvidenciaNr1,
      removerEvidenciaNr1,
      baixarEvidenciaNr1,
    });
    const d = nr1();
    render(
      <PainelDoModelo
        detalhe={d}
        geral={GERAL}
        servico={servicoFalso()}
        aba="conformidade"
        podeEditar
        servicoDosModelos={sm}
      />,
    );
    await screen.findByRole("img", { name: "1 de 7 etapas concluídas" });
    const comunicar = screen
      .getByText("Comunicar os resultados às pessoas")
      .closest("li")!;
    const concluir = within(comunicar).getByRole("button", {
      name: "Concluir etapa",
    });
    expect(concluir).toBeDisabled();
    const arquivo = new File(["%PDF-1.4"], "Ata da reunião.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(
      within(comunicar).getByLabelText("Escolher arquivos de evidência"),
      {
        target: { files: [arquivo] },
      },
    );
    await waitFor(() =>
      expect(enviarEvidenciaNr1).toHaveBeenCalledWith(
        d.id,
        "comunicar",
        arquivo,
      ),
    );
    expect(
      await within(comunicar).findByText("Ata da reunião.pdf"),
    ).toBeInTheDocument();
    expect(within(comunicar).getByText(/1,2 MB/)).toBeInTheDocument();
    expect(concluir).toBeEnabled();
    fireEvent.click(
      within(comunicar).getByRole("button", {
        name: "Baixar Ata da reunião.pdf",
      }),
    );
    await waitFor(() =>
      expect(baixarEvidenciaNr1).toHaveBeenCalledWith(d.id, "comunicar", "a1"),
    );
    fireEvent.click(
      within(comunicar).getByRole("button", {
        name: "Remover Ata da reunião.pdf",
      }),
    );
    await waitFor(() =>
      expect(removerEvidenciaNr1).toHaveBeenCalledWith(d.id, "comunicar", "a1"),
    );
    await waitFor(() =>
      expect(within(comunicar).queryByText("Ata da reunião.pdf")).toBeNull(),
    );
    expect(concluir).toBeDisabled();
  });

  it("arquivo grande demais nem é enviado; recusas da API viram mensagem", async () => {
    const enviarEvidenciaNr1 = vi.fn(() =>
      Promise.reject(
        Object.assign(new Error("x"), {
          status: 422,
          codigo: "evidencia_formato_invalido",
        }),
      ),
    );
    render(
      <PainelDoModelo
        detalhe={nr1()}
        geral={GERAL}
        servico={servicoFalso()}
        aba="conformidade"
        podeEditar
        servicoDosModelos={servicoDosModelos({ enviarEvidenciaNr1 })}
      />,
    );
    await screen.findByRole("img", { name: "1 de 7 etapas concluídas" });
    const validar = screen
      .getByText("Validar com o profissional de SST e levar ao PGR")
      .closest("li")!;
    const grande = new File(["x"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: 21 * 1024 * 1024 });
    fireEvent.change(
      within(validar).getByLabelText("Escolher arquivos de evidência"),
      {
        target: { files: [grande] },
      },
    );
    expect(await within(validar).findByRole("alert")).toHaveTextContent(
      "grande.pdf: o arquivo passa de 20 MB.",
    );
    expect(enviarEvidenciaNr1).not.toHaveBeenCalled();
    const doc = new File(["x"], "planilha.xlsx", {
      type: "application/vnd.ms-excel",
    });
    fireEvent.change(
      within(validar).getByLabelText("Escolher arquivos de evidência"),
      {
        target: { files: [doc] },
      },
    );
    expect(
      await within(validar).findByText(/planilha\.xlsx: Envie PDF, imagem/),
    ).toBeInTheDocument();
    expect(mensagemDoEnvio({ status: 503 })).toContain("indisponível");
    expect(
      mensagemDoEnvio({ status: 422, erros: [{ motivo: "limite" }] }),
    ).toBe("Cada etapa aceita até 10 arquivos.");
    expect(
      mensagemDoEnvio({ status: 422, codigo: "evidencia_reprovada_antivirus" }),
    ).toBe("O antivírus recusou o arquivo.");
  });

  it("sem permissão: lista os arquivos, sem enviar nem remover", async () => {
    render(
      <PainelDoModelo
        detalhe={nr1()}
        geral={GERAL}
        servico={servicoFalso()}
        aba="conformidade"
        podeEditar={false}
        servicoDosModelos={servicoDosModelos({
          acompanhamentoNr1: vi.fn(() =>
            Promise.resolve(comArquivo(ACOMPANHAMENTO)),
          ),
          enviarEvidenciaNr1: vi.fn(),
          baixarEvidenciaNr1: vi.fn(),
          removerEvidenciaNr1: vi.fn(),
        })}
      />,
    );
    expect(await screen.findByText("Ata da reunião.pdf")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Escolher arquivos de evidência"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Remover/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Baixar Ata da reunião.pdf" }),
    ).toBeInTheDocument();
  });

  it("'Baixar tudo (.zip)' junta plano, conformidade, planilha e arquivos", async () => {
    const baixarEvidenciaNr1 = vi.fn(() =>
      Promise.resolve(new Blob(["conteudo"])),
    );
    const criar = vi.fn((_b: Blob) => "blob:pacote");
    const revogar = vi.fn();
    const antes = { criar: URL.createObjectURL, revogar: URL.revokeObjectURL };
    URL.createObjectURL = criar as never;
    URL.revokeObjectURL = revogar as never;
    try {
      render(
        <PainelDoModelo
          detalhe={nr1()}
          geral={GERAL}
          servico={servicoFalso({
            obterPesquisa: vi.fn(() => Promise.resolve(nr1())),
          })}
          aba="conformidade"
          podeEditar
          servicoDosModelos={servicoDosModelos({
            acompanhamentoNr1: vi.fn(() =>
              Promise.resolve(comArquivo(ACOMPANHAMENTO)),
            ),
            baixarEvidenciaNr1,
          })}
        />,
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Baixar tudo (.zip)" }),
      );
      await waitFor(() => expect(criar).toHaveBeenCalled());
      expect(baixarEvidenciaNr1).toHaveBeenCalledTimes(1);
      const blob = criar.mock.calls[0]![0];
      expect(blob.type).toBe("application/zip");
      const conteudo = new TextDecoder("latin1").decode(await lerBlob(blob));
      expect(conteudo).toContain("01-plano-de-acao.pdf");
      expect(conteudo).toContain("02-conformidade.pdf");
      expect(conteudo).toContain("evidencias/03-comunicar/Ata-da-reuniao.pdf");
    } finally {
      URL.createObjectURL = antes.criar;
      URL.revokeObjectURL = antes.revogar;
    }
  });
});

describe("escala de saúde (5 = Excelente) e rótulos das pontas", () => {
  const perguntas = secoesDoModelo(modeloDaGaleria("copsoq")).flatMap(
    (s) => s.perguntas,
  );

  it("Q64 grava 5 = Excelente e aparece de 5 a 1, com as pontas acima", () => {
    const q64 = perguntas.find((p) => p.chave === "Q64")!;
    expect(q64.config.rotulos).toEqual([
      "Fraca",
      "Regular",
      "Boa",
      "Muito boa",
      "Excelente",
    ]);
    expect(q64.config.decrescente).toBe(true);
    const aoMudar = vi.fn();
    const { container } = render(
      <CampoDaPergunta
        pergunta={q64}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.closest("label")!.textContent)).toEqual([
      "5Excelente",
      "4Muito boa",
      "3Boa",
      "2Regular",
      "1Fraca",
    ]);
    fireEvent.click(radios[0]!);
    expect(aoMudar).toHaveBeenCalledWith(5);
    const pontas = container.querySelector(".pesquisa-extremos")!;
    expect(
      [...pontas.querySelectorAll("span")].map((s) => s.textContent),
    ).toEqual(["Excelente", "Fraca"]);
  });

  it("as demais escalas da NR-1 também mostram as pontas acima, na ordem", () => {
    const q1 = perguntas.find((p) => p.chave === "Q1")!;
    const { container } = render(
      <CampoDaPergunta
        pergunta={q1}
        valor={undefined}
        erro={null}
        aoMudar={vi.fn()}
      />,
    );
    expect(q1.config.decrescente).toBeUndefined();
    const pontas = container.querySelector(".pesquisa-extremos")!;
    expect(
      [...pontas.querySelectorAll("span")].map((s) => s.textContent),
    ).toEqual(["Nunca / Quase nunca", "Sempre"]);
    expect(screen.getAllByRole("radio")[0]!.closest("label")!.textContent).toBe(
      "1Nunca / Quase nunca",
    );
  });
});

describe("página 'Sobre o modelo'", () => {
  it("o exemplo traz 29 quadradinhos e a mini matriz 4 × 4", () => {
    const { container } = render(
      <JanelaDeExemplo e={RISCOS_PSICOSSOCIAIS.pagina!.recebe!.exemplo} />,
    );
    expect(
      container.querySelectorAll(".sobre__quadradinhos > span"),
    ).toHaveLength(29);
    expect(
      container.querySelectorAll(".sobre__mini-matriz-grade > span"),
    ).toHaveLength(16);
    expect(
      screen.getByRole("img", { name: "Severidade × prevalência" }),
    ).toBeInTheDocument();
  });

  it("os nomes das dimensões e dos níveis são os mesmos dos resultados", () => {
    const pagina = RISCOS_PSICOSSOCIAIS.pagina!;
    const grupos = pagina.conteudo.find((b) => b.tipo === "grupos")!;
    if (grupos.tipo !== "grupos") throw new Error("sem grupos");
    expect(grupos.itens[6]!.chips!.map((c) => c.texto)).toEqual(
      dimensoesDoDominio("saude_bem_estar").map((d) => d.rotulo),
    );
    expect(
      grupos.itens.reduce((t, i) => t + Number(i.quantidade!.split(" ")[0]), 0),
    ).toBe(76);
    expect(pagina.regua!.faixas.map((f) => f.intervalo)).toEqual([
      NIVEL.critico.acao,
      NIVEL.alto.acao,
      NIVEL.medio.acao,
      NIVEL.baixo.acao,
    ]);
  });
});
