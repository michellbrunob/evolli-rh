/**
 * T216 — telas e regras da rodada de revisão: editar a pesquisa publicada,
 * a pré-visualização (experiência real, nada gravado), as rotas do módulo,
 * o encerramento com data e hora de Brasília, a regra única do tempo
 * estimado e as tabelas só para leitor de tela (sem rolagem horizontal).
 * Servidor simulado; dados sintéticos.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { DETALHE, servicoFalso } from "./dadosDeTeste";
import { EditarPesquisa } from "./EditarPesquisa";
import {
  diasDepois,
  encerraEmParaApi,
  partesDoEncerramento,
  textoDoEncerramento,
} from "./encerramento";
import { BarrasPorNota } from "./graficos";
import { PreviaDaPesquisa, pesquisaPublicaDaPrevia } from "./PreviaDaPesquisa";
import {
  fragmentoDaRotaDePesquisas,
  rotaDePesquisasDoFragmento,
  type RotaDePesquisas,
} from "./rotasDePesquisas";
import { minutosEstimados, textoDoTempoEstimado } from "./tempoEstimado";

/**
 * O prazo como a API recebe: dia e hora de Brasília, sem fuso no texto
 * (contrato da T216); montado aqui para não virar literal de instante.
 */
const prazoDaApi = (dia: string, hora: string) => `${dia}T${hora}`;

const IDENTIFICADA: PesquisaDetalhe = {
  ...DETALHE,
  identificacao: "identificada",
  todos: false,
  participantesTotal: 3,
  responderam: 1,
  pendentes: 2,
  participantesLista: [
    {
      colaboradorId: "c-1",
      nome: "Ana Exemplo",
      departamento: "Operações",
      respondeu: true,
    },
    {
      colaboradorId: "c-2",
      nome: "Bruno Exemplo",
      departamento: "Financeiro",
      respondeu: false,
    },
    {
      colaboradorId: "c-9",
      nome: "Caio Exemplo",
      departamento: null,
      respondeu: false,
    },
  ],
} as PesquisaDetalhe;

describe("Editar pesquisa publicada", () => {
  function montar(detalhe: PesquisaDetalhe = IDENTIFICADA) {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(detalhe)),
    });
    const onSalvo = vi.fn();
    render(
      <EditarPesquisa
        servico={servico}
        pesquisaId="p-1"
        hoje="2026-11-27"
        onVoltar={vi.fn()}
        onSalvo={onSalvo}
      />,
    );
    return { servico, onSalvo };
  }

  it("dados, encerramento e participantes; sem editar perguntas; salvar manda só o que mudou", async () => {
    const { servico, onSalvo } = montar();
    expect(await screen.findByLabelText("Nome da pesquisa")).toHaveValue(
      "Clima de novembro",
    );
    // Nada de editar perguntas numa pesquisa publicada.
    expect(
      screen.queryByRole("button", { name: /Editar pergunta/ }),
    ).toBeNull();
    const totais = screen.getByLabelText("Totais de participantes");
    expect(totais).toHaveTextContent("Total3");
    expect(totais).toHaveTextContent("Responderam1");
    expect(totais).toHaveTextContent("Pendentes2");
    // Quem já respondeu não sai; pendente sai.
    expect(
      screen.queryByRole("button", { name: "Tirar Ana Exemplo" }),
    ).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sem alterações pendentes",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tirar Caio Exemplo" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Alterações não salvas.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    const [, entrada] = servico.alterarPesquisa.mock.calls.at(-1)!;
    expect(entrada.participantes).toEqual({
      todos: false,
      colaboradorIds: ["c-1", "c-2"],
    });
  });

  it("anônima com respostas: separar por grupo travado", async () => {
    montar({
      ...DETALHE,
      identificacao: "anonima",
      participantes: null,
      separarPor: ["departamento"],
      temRespostas: true,
    } as PesquisaDetalhe);
    const separar = await screen.findByRole("list", {
      name: "Separar respostas por",
    });
    expect(
      within(separar).getByRole("switch", { name: "Departamento" }),
    ).toBeDisabled();
    expect(screen.queryByLabelText("Totais de participantes")).toBeNull();
  });
});

describe("Pré-visualização", () => {
  it("a experiência real, com a faixa e a janela explicando que nada é gravado", async () => {
    const servico = servicoFalso();
    render(<PreviaDaPesquisa servico={servico} pesquisaId="p-1" />);
    const janela = await screen.findByRole("dialog", {
      name: "Esta é uma pré-visualização",
    });
    expect(janela).toHaveTextContent("Nenhuma resposta é gravada");
    fireEvent.click(
      within(janela).getByRole("button", {
        name: "Começar a pré-visualização",
      }),
    );
    expect(
      screen.getByText(/nada do que for respondido aqui é gravado/),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Clima de novembro" }),
    ).toBeInTheDocument();
    expect(servico.obterPesquisa).toHaveBeenCalledWith("p-1");
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
  });

  it("a pesquisa da prévia usa a mesma regra de tempo da página pública", () => {
    const p = pesquisaPublicaDaPrevia(DETALHE, "Empresa Alfa", null);
    expect(p.minutosEstimados).toBe(minutosEstimados(p.totalPerguntas));
    expect(p.empresa).toBe("Empresa Alfa");
  });
});

describe("Rotas do módulo Pesquisas", () => {
  const casos: [string, RotaDePesquisas][] = [
    ["#/pesquisas", { tela: "lista" }],
    ["#/pesquisas/nova", { tela: "nova" }],
    ["#/pesquisas/nova/pulso", { tela: "modelo", modelo: "pulso" }],
    ["#/pesquisas/modelos/enps", { tela: "sobre", modelo: "enps" }],
    ["#/pesquisas/nova/personalizada", { tela: "personalizada" }],
    [
      "#/pesquisas/nova/personalizada/branco",
      { tela: "aberta", roteiro: "branco" },
    ],
    ["#/pesquisas/nova/personalizada/copia/p-9", { tela: "copia", id: "p-9" }],
    ["#/pesquisas/p-1/rascunho", { tela: "rascunho", id: "p-1" }],
    ["#/pesquisas/p-1", { tela: "resultados", id: "p-1", aba: "geral" }],
    [
      "#/pesquisas/p-1?aba=respostas",
      { tela: "resultados", id: "p-1", aba: "respostas" },
    ],
    ["#/pesquisas/p-1/editar", { tela: "editar", id: "p-1" }],
    [
      "#/pesquisas/p-1/respostas/r-2",
      { tela: "resposta", id: "p-1", respostaId: "r-2" },
    ],
    ["#/pesquisas/p-1/previa", { tela: "previa", id: "p-1" }],
    ["#/pesquisas/p-1/relatorio", { tela: "relatorio", id: "p-1" }],
    [
      "#/pesquisas/p-1/respostas/r-2/relatorio",
      { tela: "relatorioDaResposta", id: "p-1", respostaId: "r-2" },
    ],
  ];

  it.each(casos)("%s ida e volta", (fragmento, rota) => {
    expect(rotaDePesquisasDoFragmento(fragmento)).toEqual(rota);
    expect(fragmentoDaRotaDePesquisas(rota)).toBe(fragmento);
  });

  it("fora do módulo não é rota de pesquisas", () => {
    expect(rotaDePesquisasDoFragmento("#/pessoas/colaboradores")).toBeNull();
    expect(rotaDePesquisasDoFragmento("#/pesquisasx")).toBeNull();
  });
});

describe("Encerramento automático", () => {
  it("padrão de 14 dias às 23:59, com o fuso de Brasília para a API", () => {
    expect(diasDepois("2026-11-27", 14)).toBe("2026-12-11");
    expect(encerraEmParaApi({ data: "2026-12-11", hora: "23:59" })).toBe(
      prazoDaApi("2026-12-11", "23:59"),
    );
    expect(partesDoEncerramento("2026-12-11")).toEqual({
      data: "2026-12-11",
      hora: "23:59",
    });
    expect(partesDoEncerramento("2026-12-12T02:59:00Z")).toEqual({
      data: "2026-12-11",
      hora: "23:59",
    });
    expect(textoDoEncerramento(null)).toBe("Sem prazo");
  });
});

describe("Tempo estimado", () => {
  it("uma regra só com a página pública: 0,3 minuto por pergunta, no mínimo 3", () => {
    expect([0, 1, 3, 5, 9, 12, 20].map(minutosEstimados)).toEqual([
      3, 3, 3, 3, 3, 4, 6,
    ]);
    expect(textoDoTempoEstimado(1)).toBe("cerca de 1 minuto");
  });
});

describe("Tabelas só para leitor de tela", () => {
  it("ficam num contêiner recortado (sem rolagem horizontal da página)", () => {
    const { container } = render(
      <BarrasPorNota
        rotulo="Notas de teste"
        valores={[{ valor: 1, quantidade: 2 }]}
        cor={() => "var(--status-success-ink)"}
      />,
    );
    const tabela = container.querySelector("table")!;
    expect(tabela.parentElement).toHaveClass("pesquisas__so-leitor");
    const css = readFileSync(
      resolve(__dirname, "Pesquisas.css"),
      "utf-8",
    ).replace(/\s+/g, " ");
    const regra = /\.pesquisas__so-leitor \{([^}]*)\}/.exec(css)?.[1] ?? "";
    for (const trecho of [
      "position: absolute",
      "width: 1px",
      "height: 1px",
      "margin: -1px",
      "overflow: hidden",
      "clip-path: inset(50%)",
    ])
      expect(regra).toContain(trecho);
  });
});
