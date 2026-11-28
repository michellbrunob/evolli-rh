/**
 * T216 — Perfil comportamental (DISC): as telas — assistente, resposta pelo
 * link (prévia com o resultado da pessoa), resultados (visão geral,
 * análises, respostas), perfil individual e "Sobre o modelo".
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PesquisaEntrada } from "../../../../api/pesquisasClient";
import {
  ResponderPesquisa,
  montarPreviaPublica,
} from "../../../publico/ResponderPesquisa";
import { DETALHE, servicoFalso } from "../../dadosDeTeste";
import { secoesDoModelo } from "../../modelosDePesquisa";
import { BLOCOS_DISC } from "./blocos";
import { MODELO_DISC } from "./definicao";
import { ResultadoIndividualDisc } from "./ResultadoIndividualDisc";
import { ResultadosDisc } from "./ResultadosDisc";
import { resultadoDeTeste } from "./resultadoDeTeste";
import { SobreODisc } from "./SobreODisc";

// O catálogo com o DISC (a galeria liga o modelo no registro comum).
vi.mock("../../modelosDePesquisa", async (importar) => {
  const real = await importar<typeof import("../../modelosDePesquisa")>();
  const { MODELO_DISC: disc } = await import("./definicao");
  return {
    ...real,
    modeloDaGaleria: (id: string) =>
      id === "disc" ? disc : real.modeloDaGaleria(id),
  };
});

const { AssistenteDoModelo } = await import("../../AssistenteDoModelo");

const DETALHE_DISC = { ...DETALHE, modelo: "disc" as const };

describe("T216 — DISC: assistente", () => {
  it("blocos não editáveis, subtítulo com tempo e o resumo do envio", async () => {
    const servico = servicoFalso();
    render(
      <AssistenteDoModelo
        servico={servico}
        modeloId="disc"
        hoje="2026-11-27"
        agora={() => new Date(2026, 10, 27, 9, 5)}
        atrasoDoRascunho={0}
        onCancelar={vi.fn()}
        onConcluir={vi.fn()}
        onVerResultados={vi.fn()}
        onEditarGerada={vi.fn()}
      />,
    );
    expect(
      screen.getByText("28 blocos · cerca de 8 minutos para responder."),
    ).toBeInTheDocument();
    const cartao = screen.getByRole("region", { name: "Blocos de frases" });
    expect(
      screen.queryByRole("button", { name: /Adicionar pergunta/ }),
    ).not.toBeInTheDocument();
    // O 1º bloco aberto com as 4 frases; 4 visíveis de início.
    expect(
      within(cartao).getAllByRole("button", { name: /^Bloco \d+ · 4 frases/ }),
    ).toHaveLength(4);
    expect(within(cartao).getByText(BLOCOS_DISC[0]!.frases[0])).toBeVisible();
    expect(
      within(cartao).queryByText(BLOCOS_DISC[1]!.frases[0]),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(cartao).getByRole("button", { name: /Bloco 2 · 4 frases/ }),
    );
    expect(within(cartao).getByText(BLOCOS_DISC[1]!.frases[3])).toBeVisible();
    expect(
      within(cartao).queryByRole("button", { name: /Bloco 5 ·/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(cartao).getByRole("button", { name: "Ver os outros 24 blocos" }),
    );
    expect(
      within(cartao).getByRole("button", { name: /Bloco 28 · 4 frases/ }),
    ).toBeInTheDocument();

    await waitFor(() => expect(servico.criarPesquisa).toHaveBeenCalled());
    const entrada = servico.criarPesquisa.mock.calls[0]![0] as PesquisaEntrada;
    expect(entrada.modelo).toBe("disc");
    const perguntas = entrada.secoes.flatMap((s) => s.perguntas);
    expect(perguntas).toHaveLength(28);
    expect(perguntas.every((p) => p.tipo === "escolha_forcada")).toBe(true);

    // Anônima: direto ao Enviar, com o resumo dos blocos.
    fireEvent.click(screen.getByRole("radio", { name: /Anônima/ }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo: Enviar/ }));
    expect(screen.getByText("28 blocos de frases do DISC")).toBeInTheDocument();
  });
});

describe("T216 — DISC: resposta pelo link (prévia)", () => {
  it("frases como opções, uma por bloco, e o resultado da pessoa no fim", () => {
    const espiao = vi.spyOn(globalThis, "fetch");
    render(
      <ResponderPesquisa
        previa={montarPreviaPublica({
          empresa: "Empresa Sintética",
          nome: "DISC · novembro",
          boasVindas: null,
          identificacao: "anonima",
          modelo: "disc",
          secoes: secoesDoModelo(MODELO_DISC),
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Começar a pré-visualização" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    // 17 I, 6 D, 3 S e 2 C.
    const fatores = `${"I".repeat(17)}${"D".repeat(6)}SSSCC`;
    [...fatores].forEach((f, i) => {
      expect(screen.getByText(`Pergunta ${i + 1} de 28`)).toBeInTheDocument();
      const grupo = screen.getByRole("radiogroup");
      expect(within(grupo).getAllByRole("radio")).toHaveLength(4);
      const frase = BLOCOS_DISC[i]!.frases["DISC".indexOf(f)]!;
      fireEvent.click(within(grupo).getByRole("radio", { name: frase }));
      fireEvent.click(
        screen.getByRole("button", {
          name: i === 27 ? /Enviar respostas/ : /Próximo/,
        }),
      );
    });
    expect(
      screen.getByRole("heading", { name: "Respostas enviadas!" }),
    ).toBeInTheDocument();
    const cartoes = screen.getByRole("list", {
      name: "Seu resultado por fator",
    });
    const itens = within(cartoes).getAllByRole("listitem");
    expect(itens.map((li) => li.textContent)).toEqual([
      "D21%Dominância",
      "PredominanteI61%Influência",
      "S11%Estabilidade",
      "C7%Conformidade",
    ]);
    expect(
      screen.getByText("Perfil predominante: Influência"),
    ).toBeInTheDocument();
    expect(espiao).not.toHaveBeenCalled();
  });

  it("a ordem das frases muda entre blocos", () => {
    render(
      <ResponderPesquisa
        previa={montarPreviaPublica({
          empresa: "E",
          nome: "DISC",
          boasVindas: null,
          identificacao: "anonima",
          modelo: "disc",
          secoes: secoesDoModelo(MODELO_DISC),
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Começar a pré-visualização" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    const ordens = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const radios = within(screen.getByRole("radiogroup")).getAllByRole(
        "radio",
      );
      const posicao = radios.map((r) =>
        BLOCOS_DISC[i]!.frases.indexOf(
          (r.closest("label")?.textContent ?? "") as never,
        ),
      );
      expect([...posicao].sort()).toEqual([0, 1, 2, 3]);
      ordens.add(posicao.join(""));
      fireEvent.click(radios[0]!);
      fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    }
    expect(ordens.size).toBeGreaterThan(1);
  });
});

describe("T216 — DISC: resultados", () => {
  const carregar = (r = resultadoDeTeste()) => vi.fn(() => Promise.resolve(r));

  it("visão geral: perfil do time, pessoas por fator, mapa e diversidade", async () => {
    const ir = vi.fn();
    render(
      <ResultadosDisc
        detalhe={DETALHE_DISC}
        aba="geral"
        carregar={carregar()}
        onIrParaAnalises={ir}
      />,
    );
    const time = await screen.findByRole("region", { name: "Perfil do time" });
    expect(within(time).getByRole("heading", { level: 3 })).toHaveTextContent(
      "Perfil equilibrado D/C/S",
    );
    expect(
      within(time).getByRole("img", { name: /Composição do time/ }),
    ).toHaveAccessibleName(
      "Composição do time: Dominância 27%, Influência 20%, Estabilidade 25%, Conformidade 27%",
    );
    expect(
      within(time).getByText(/respostas de 3 pessoas/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(time).getByRole("button", { name: "Ver análises do time ›" }),
    );
    expect(ir).toHaveBeenCalled();

    const porPerfil = screen.getByRole("list", {
      name: "Pessoas por fator predominante",
    });
    expect(
      within(porPerfil)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "DDominância1pessoa · 33%",
      "IInfluência1pessoa · 33%",
      "SEstabilidade1pessoa · 33%",
      "CConformidade0pessoas · 0%",
    ]);
    expect(
      screen.getByRole("img", { name: /Mapa de talentos/ }),
    ).toHaveAccessibleName(
      "Mapa de talentos. Catalisador: 1, Mentor: 1, Analista: 1",
    );
    const mapa = screen.getByRole("region", {
      name: "Mapa de talentos do time",
    });
    expect(
      within(mapa).getByText("Centro do time").nextSibling,
    ).toHaveTextContent("Realizador");
    const div = screen.getByRole("region", {
      name: "Diversidade comportamental",
    });
    expect(within(div).getByText("79")).toBeInTheDocument();
    expect(within(div).getByText("Equilibrado")).toBeInTheDocument();
    expect(within(div).getByText("Fator ausente no time")).toBeInTheDocument();
    expect(within(div).getByText(/^Conformidade: /)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Como o time funciona" }),
    ).toHaveTextContent("Dominância");
  });

  it("análises: compatibilidade, intensidades e lacunas", async () => {
    render(
      <ResultadosDisc
        detalhe={DETALHE_DISC}
        aba="analises"
        carregar={carregar()}
      />,
    );
    const comp = await screen.findByRole("region", {
      name: "Compatibilidade no time",
    });
    expect(
      within(comp).getByText(
        "Maior ponto de atenção: Dominância × Estabilidade",
      ),
    ).toBeInTheDocument();
    expect(
      within(comp).getByRole("img", { name: /Pares de pessoas por tipo/ }),
    ).toHaveAccessibleName(
      "Pares de pessoas por tipo: Mesma linguagem 0%, Complementar 67%, Pede atenção 33%",
    );
    const intens = screen.getByRole("list", { name: "Intensidade" });
    expect(
      within(intens)
        .getAllByRole("listitem")
        .map((li) => li.querySelector(".disc__cartao-numero")?.textContent),
    ).toEqual(["2", "1", "0", "0"]);
    expect(screen.getByText("Reforçar Conformidade")).toBeInTheDocument();
  });

  it("sem par de pessoas: a compatibilidade espera 2 pessoas", async () => {
    const r = resultadoDeTeste();
    render(
      <ResultadosDisc
        detalhe={DETALHE_DISC}
        aba="analises"
        carregar={carregar({
          ...r,
          compatibilidade: {
            ...r.compatibilidade,
            totalDePares: 0,
            maiorAtencao: null,
          },
          lacunas: [],
        })}
      />,
    );
    expect(
      await screen.findByText(
        "A compatibilidade aparece a partir de 2 pessoas.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nenhum fator abaixo de 20%/)).toBeInTheDocument();
  });

  it("respostas: anônimas numeradas, da mais recente; abrir uma", async () => {
    const abrir = vi.fn();
    render(
      <ResultadosDisc
        detalhe={{ ...DETALHE_DISC, identificacao: "anonima" }}
        aba="respostas"
        carregar={carregar()}
        onAbrirResposta={abrir}
      />,
    );
    const linhas = (await screen.findAllByRole("row")).slice(1);
    expect(
      linhas.map((l) => within(l).getAllByRole("cell")[0]!.textContent),
    ).toEqual([
      "Resposta anônima #3",
      "Resposta anônima #2",
      "Resposta anônima #1",
    ]);
    expect(within(linhas[2]!).getByText("Influência pura")).toBeInTheDocument();
    expect(within(linhas[0]!).getByText("Estrategista")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Resposta anônima #2" }),
    );
    expect(abrir).toHaveBeenCalledWith("r2");
  });

  it("confidencial: sem respostas individuais", async () => {
    render(
      <ResultadosDisc
        detalhe={{ ...DETALHE_DISC, identificacao: "confidencial" }}
        aba="respostas"
        carregar={carregar({ ...resultadoDeTeste(), pessoas: [] })}
      />,
    );
    expect(
      await screen.findByText(
        /Pesquisa confidencial: o perfil aparece só agrupado/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("recorte oculto não mostra número e repede com o grupo", async () => {
    const base = resultadoDeTeste({
      recortes: ["departamento"],
      grupos: {
        departamento: [
          {
            id: "d-1",
            nome: "Comercial",
            respostas: 2,
            visivel: false,
            oculto: "minimo",
          },
        ],
      },
    });
    const fn = vi.fn((_id: string, recorte?: unknown) =>
      Promise.resolve(
        recorte
          ? {
              ...base,
              perfil: null,
              totalDePessoas: 0,
              filtro: {
                campo: "departamento" as const,
                grupoId: "d-1",
                respostas: 2,
                visivel: false,
              },
            }
          : base,
      ),
    );
    render(<ResultadosDisc detalhe={DETALHE_DISC} aba="geral" carregar={fn} />);
    const filtro = await screen.findByLabelText("Recorte");
    fireEvent.change(filtro, { target: { value: "departamento:d-1" } });
    expect(
      await screen.findByText("Poucas respostas para mostrar"),
    ).toBeInTheDocument();
    expect(fn).toHaveBeenLastCalledWith(DETALHE_DISC.id, {
      campo: "departamento",
      grupoId: "d-1",
    });
    expect(screen.queryByRole("region", { name: "Perfil do time" })).toBeNull();
  });

  it("falha ao carregar: aviso", async () => {
    render(
      <ResultadosDisc
        detalhe={DETALHE_DISC}
        aba="geral"
        carregar={vi.fn(() => Promise.reject(new Error("x")))}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o perfil comportamental.",
    );
  });
});

describe("T216 — DISC: perfil individual", () => {
  it("perfil completo, posição e navegação na ordem da lista", async () => {
    const ir = vi.fn();
    render(
      <ResultadoIndividualDisc
        pesquisa={DETALHE_DISC}
        respostaId="r2"
        carregar={vi.fn(() => Promise.resolve(resultadoDeTeste()))}
        onVoltar={vi.fn()}
        onIr={ir}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Resposta anônima #2",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Estabilidade pura/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Área de talento: Mentor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resposta anterior" }));
    expect(ir).toHaveBeenCalledWith("r3");
    fireEvent.click(screen.getByRole("button", { name: "Próxima resposta" }));
    expect(ir).toHaveBeenLastCalledWith("r1");
  });

  it("resposta sem perfil: aviso", async () => {
    render(
      <ResultadoIndividualDisc
        pesquisa={DETALHE_DISC}
        respostaId="outra"
        carregar={vi.fn(() => Promise.resolve(resultadoDeTeste()))}
        onVoltar={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta resposta não tem perfil para mostrar.",
    );
  });
});

describe("T216 — DISC: sobre o modelo", () => {
  it("os 4 fatores, a ficha e a gaveta com os 28 blocos", () => {
    const usar = vi.fn();
    render(<SobreODisc onVoltar={vi.fn()} onUsar={usar} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Perfil comportamental (DISC)28 blocos",
    );
    const fatores = screen.getByRole("region", {
      name: "Os 4 fatores do DISC",
    });
    for (const nome of [
      "Dominância",
      "Influência",
      "Estabilidade",
      "Conformidade",
    ])
      expect(within(fatores).getByText(nome)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar pesquisa →" }));
    expect(usar).toHaveBeenCalledWith("disc");
    fireEvent.click(screen.getByRole("button", { name: "Ver os 28 blocos" }));
    const gaveta = screen.getByRole("dialog");
    expect(within(gaveta).getByText("Bloco 28")).toBeInTheDocument();
    expect(
      within(gaveta).getByText(BLOCOS_DISC[27]!.frases[2]),
    ).toBeInTheDocument();
  });
});
