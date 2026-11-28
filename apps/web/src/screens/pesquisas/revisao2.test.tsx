/**
 * T216 — 2ª revisão: grupo oculto para proteger um menor (telas e
 * exportações), grupo da resposta anônima no Excel, números ocultos abaixo
 * do mínimo, publicar sem ninguém identificável, duplicar anônima, contagem
 * do recorte, concordância, faixa de uma nota, Excel sem colunas repetidas,
 * PDF sem evolução vazia e ajustes de menu, filtro e lista. Servidor
 * simulado; dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/colaboradoresClient";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import { GavetaDeDuplicar } from "./acoesDaPesquisa";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import { textoDosNaoIdentificaveis } from "./AvisoNaoIdentificaveis";
import {
  ANALISES,
  DETALHE,
  RESPOSTA_DETALHE,
  RESULTADOS,
  RESUMO,
  lista,
  servicoFalso,
} from "./dadosDeTeste";
import { montarRelatorio } from "./dadosDoRelatorio";
import { planilhaDosResultados } from "./exportarResultados";
import { PesquisasModulo } from "./PesquisasModulo";
import { DocumentoDoRelatorio } from "./RelatorioImprimivel";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";
import { textoDoOculto } from "./textosDasPesquisas";

const ANONIMA: PesquisaDetalhe = {
  ...DETALHE,
  identificacao: "anonima",
  participantes: null,
  separarPor: ["departamento"],
};

describe("A1 — grupo oculto para proteger um grupo menor", () => {
  it("o texto diz o motivo", () => {
    expect(textoDoOculto("protege_grupo_menor", 3)).toBe(
      "Oculto · protege um grupo menor",
    );
    expect(textoDoOculto("minimo", 3)).toBe("Oculto · menos de 3 respostas");
    expect(textoDoOculto(undefined, 1)).toBe("Oculto · menos de 1 resposta");
  });

  it("no mapa e no PDF, o vizinho oculto não mostra números nem a contagem", async () => {
    const analises = {
      ...ANALISES,
      linhas: ANALISES.linhas.map((l) =>
        l.grupoId === "d-1"
          ? {
              ...l,
              visivel: false,
              oculto: "protege_grupo_menor" as const,
              media: null,
              medias: [null],
            }
          : l.grupoId === "d-2"
            ? { ...l, oculto: "minimo" as const }
            : l,
      ),
    };
    render(
      <ResultadosDaPesquisa
        servico={servicoFalso({
          obterPesquisa: vi.fn(() => Promise.resolve(ANONIMA)),
          analisesDaPesquisa: vi.fn(() => Promise.resolve(analises)),
        })}
        pesquisaId="p-1"
        podeEditar
        abaInicial="analises"
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    const mapa = await screen.findByRole("table", {
      name: /Médias por/,
    });
    const operacoes = within(mapa).getAllByRole("row")[2]!;
    expect(operacoes).toHaveTextContent("Oculto · protege um grupo menor");
    expect(operacoes).not.toHaveTextContent("6 respostas");
    expect(operacoes).not.toHaveTextContent("6,1");
    const rel = montarRelatorio({
      detalhe: ANONIMA,
      geral: RESULTADOS,
      empresa: "Empresa Alfa",
      hoje: "2026-11-27",
      analises,
    });
    // Grupo oculto nunca vira alerta.
    expect(rel.alertas).toEqual([]);
    render(<DocumentoDoRelatorio rel={rel} />);
    expect(
      screen.getAllByText("Oculto · protege um grupo menor").length,
    ).toBeGreaterThan(0);
  });

  it("recorte oculto para proteger um menor explica o motivo; a contagem vem do recorte (C1)", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(ANONIMA)),
      resultadosDaPesquisa: vi.fn((_id: string, recorte?: unknown) =>
        Promise.resolve(
          recorte === "d-1"
            ? ({
                ...RESULTADOS,
                filtro: { departamentoId: "d-1", visivel: false },
                perguntas: [],
              } as ResultadosPesquisa)
            : recorte
              ? ({
                  ...RESULTADOS,
                  filtro: {
                    departamentoId: "d-2",
                    visivel: true,
                    respostas: 3,
                  },
                } as ResultadosPesquisa)
              : ({
                  ...RESULTADOS,
                  // O motivo do oculto vem nos grupos do resultado geral.
                  departamentos: [
                    {
                      id: "d-1",
                      nome: "Operações",
                      respostas: 6,
                      visivel: false,
                      oculto: "protege_grupo_menor",
                    },
                    {
                      id: "d-2",
                      nome: "Financeiro",
                      respostas: 2,
                      visivel: true,
                      oculto: null,
                    },
                  ],
                } as ResultadosPesquisa),
        ),
      ),
    });
    render(
      <ResultadosDaPesquisa
        servico={servico}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    await screen.findByRole("region", { name: "Indicadores" });
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    // B20: a opção sem recorte é "Todos".
    expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Financeiro" }));
    expect(
      await screen.findByText(/Mostrando 3 respostas de 8/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Departamento" }));
    fireEvent.click(screen.getByRole("option", { name: "Operações" }));
    expect(
      await screen.findByText("Oculto para proteger um grupo menor"),
    ).toBeInTheDocument();
  });
});

describe("A2, A3, C5 e C6 — exportações", () => {
  const anonimas: RespostaDetalhe[] = [
    {
      ...RESPOSTA_DETALHE,
      nome: null,
      departamento: null,
      grupos: [{ campo: "departamento", grupo: "Financeiro", oculto: null }],
    },
    {
      ...RESPOSTA_DETALHE,
      id: "r-2",
      numero: 2,
      nome: null,
      departamento: null,
      grupos: [
        { campo: "departamento", grupo: null, oculto: "protege_grupo_menor" },
      ],
    },
    {
      ...RESPOSTA_DETALHE,
      id: "r-3",
      numero: 3,
      nome: null,
      departamento: null,
    },
  ];

  it("A2: na anônima, o grupo escolhido ou 'Oculto'; C5: sem a coluna de comentário repetida", async () => {
    const geral = {
      ...RESULTADOS,
      departamentos: RESULTADOS.departamentos.map((d) => ({
        ...d,
        visivel: true,
      })),
    };
    const rel = montarRelatorio({
      detalhe: ANONIMA,
      geral,
      empresa: "Empresa Alfa",
      hoje: "2026-11-27",
    });
    const abas = await lerAbasXlsx(
      planilhaDosResultados(rel, ANONIMA, geral, anonimas),
    );
    const linhas = abas["Participantes"]!;
    // A ordem é embaralhada (anônima): confere o conjunto.
    expect(
      linhas
        .slice(4)
        .map((l) => l[1])
        .sort(),
    ).toEqual(["Financeiro", "Oculto", "—"]);
    expect(linhas[3]!.filter((c) => /coment/i.test(c))).toEqual([
      "5. Comentários",
    ]);
  });

  it("A3: confidencial abaixo do mínimo diz que os números estão ocultos (e conta as respostas)", async () => {
    const oculto = {
      ...RESULTADOS,
      respostas: 0,
      filtro: { departamentoId: null, visivel: false },
      perguntas: [],
    };
    const detalhe = { ...DETALHE, respostas: 2 };
    const rel = montarRelatorio({
      detalhe,
      geral: oculto,
      empresa: "Empresa Alfa",
      hoje: "2026-11-27",
    });
    expect(rel.numerosOcultos).toBe(true);
    const abas = await lerAbasXlsx(
      planilhaDosResultados(rel, detalhe, oculto, null),
    );
    const resumo = JSON.stringify(abas["Resumo"]);
    expect(resumo).toContain("Números ocultos");
    expect(resumo).not.toContain("Sem perguntas de escala");
    expect(abas["Resumo"]!.find((l) => l[0] === "Respostas")![1]).toBe("2");
    expect(JSON.stringify(abas["eNPS"])).toContain("Números ocultos");
    expect(JSON.stringify(abas["eNPS"])).not.toContain("não tem a pergunta");
    render(<DocumentoDoRelatorio rel={rel} />);
    expect(screen.getByRole("note", { name: "" })).toHaveTextContent(
      "Números ocultos",
    );
  });

  it("C6: a evolução só tem aplicações com respostas", () => {
    const rel = montarRelatorio({
      detalhe: ANONIMA,
      geral: RESULTADOS,
      empresa: "",
      hoje: "2026-11-27",
      analises: {
        ...ANALISES,
        evolucao: [
          {
            pesquisaId: "p-0",
            nome: "Antes",
            publicadaEm: "2026-10-01T12:00:00Z",
            mediaGeral: 7.1,
          },
          {
            pesquisaId: "p-x",
            nome: "Sem respostas",
            publicadaEm: "2026-10-15T12:00:00Z",
            mediaGeral: null,
          },
          {
            pesquisaId: "p-1",
            nome: "Agora",
            publicadaEm: "2026-11-03T12:00:00Z",
            mediaGeral: 8.5,
          },
        ],
      },
    });
    expect(rel.evolucao.map((e) => e.nome)).toEqual(["Antes", "Agora"]);
  });
});

describe("A4 — publicar sem ninguém identificável", () => {
  it("pede confirmação e reenvia com a confirmação; desistir não publica", async () => {
    const recusa = new ApiError(422, "Erro na requisição.", {
      erros: [{ campo: "participantes", motivo: "ninguem_identificavel" }],
    });
    const base = servicoFalso();
    const publicar = vi
      .fn()
      .mockRejectedValueOnce(recusa)
      .mockImplementation((id: string) => base.publicarPesquisa(id));
    const servico = servicoFalso({ publicarPesquisa: publicar });
    render(
      <AssistenteDoModelo
        servico={servico}
        modeloId="pulso"
        hoje="2026-11-27"
        atrasoDoRascunho={0}
        onCancelar={vi.fn()}
        onConcluir={vi.fn()}
        onVerResultados={vi.fn()}
        onEditarGerada={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Próximo: Colaboradores/ }),
    );
    await screen.findByText("2 pessoas vão receber a pesquisa");
    fireEvent.click(screen.getByRole("button", { name: /Próximo: Enviar/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Gerar pesquisa/ }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Ninguém consegue se identificar",
    });
    fireEvent.click(
      within(janela).getByRole("button", { name: "Publicar mesmo assim" }),
    );
    await waitFor(() =>
      expect(publicar).toHaveBeenLastCalledWith("p-novo", {
        confirmarSemIdentificaveis: true,
      }),
    );
    expect(
      await screen.findByRole("region", { name: "Pesquisa criada e ativa" }),
    ).toBeInTheDocument();
  });
});

describe("A5, B2, B23 e C3", () => {
  it("A5: duplicar anônima não fala em participantes", async () => {
    render(
      <GavetaDeDuplicar
        pesquisa={{ id: "p-1", nome: "Pulso", identificacao: "anonima" }}
        servico={servicoFalso()}
        onFechar={vi.fn()}
        onDuplicada={vi.fn()}
      />,
    );
    const gaveta = await screen.findByRole("dialog", {
      name: "Duplicar pesquisa",
    });
    expect(gaveta).not.toHaveTextContent("participantes");
    expect(gaveta).toHaveTextContent("link aberto novo");
  });

  it("B2: o filtro Tipo fecha com Esc e com clique fora", async () => {
    render(
      <PesquisasModulo
        servico={servicoFalso({
          listarPesquisas: vi.fn(() => Promise.resolve(lista([RESUMO]))),
        })}
        podeEditar
      />,
    );
    await screen.findByRole("table", { name: "Pesquisas" });
    const tipo = screen.getByRole("button", { name: /^Tipo/ });
    fireEvent.click(tipo);
    expect(screen.getByRole("group", { name: "Modelos" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Modelos" })).toBeNull();
    fireEvent.click(tipo);
    fireEvent.pointerDown(screen.getByRole("table", { name: "Pesquisas" }));
    expect(screen.queryByRole("group", { name: "Modelos" })).toBeNull();
    // B23: o "·" fica junto da identificação (não sobra sozinho na quebra).
    const junto = document.querySelector(".pesquisas__sem-quebra")!;
    expect(junto.textContent).toBe(" · Confidencial");
  });

  it("C3: concordância no singular", () => {
    expect(textoDosNaoIdentificaveis(1, true)).toBe(
      "1 pessoa não tem CPF ou data de nascimento na ficha e não consegue confirmar quem é no link. Complete o cadastro para que ela consiga responder.",
    );
  });
});
