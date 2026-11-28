/**
 * T216 — a API devolve `null` nos campos de configuração sem valor
 * (`maximo` da múltipla escolha, `minimo`/`maximo` do número). `null` não é
 * limite: a validação do assistente, a resposta pública e o texto de ajuda
 * tratam `null` e ausente do mesmo jeito. E, quando uma pergunta de modelo
 * fixo tem erro, o assistente avisa em vez de só não avançar.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PesquisaDetalhe,
  Pergunta as PerguntaDaApi,
} from "../../api/pesquisasClient";
import type { Pergunta as PerguntaPublica } from "../../api/pesquisaPublicaClient";
import { CampoDaPergunta } from "../publico/CampoDaPergunta";
import { erroDaPergunta } from "../publico/regrasDaPesquisa";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import { DETALHE, servicoFalso } from "./dadosDeTeste";
import {
  entradaDoEstado,
  errosDaPergunta,
  estadoDoModelo,
  perguntasEmOrdem,
  validarPerguntas,
} from "./estadoDaPesquisa";

const OPCOES = [
  { id: "a", texto: "A" },
  { id: "b", texto: "B" },
  { id: "c", texto: "C" },
];

const pergunta = (extra: Partial<PerguntaDaApi>): PerguntaDaApi => ({
  id: "q",
  tipo: "multipla_escolha",
  texto: "Quais?",
  descricao: null,
  obrigatoria: false,
  config: { opcoes: OPCOES, outro: false, maximo: null },
  condicao: null,
  ...extra,
});

/** As seções como a API devolve: nulos onde não há limite. */
function comoAApiDevolve(
  secoes: readonly PesquisaDetalhe["secoes"][number][],
): PesquisaDetalhe["secoes"] {
  return secoes.map((s) => ({
    ...s,
    perguntas: s.perguntas.map((p) =>
      p.tipo === "multipla_escolha"
        ? { ...p, config: { ...p.config, maximo: null } }
        : p,
    ),
  }));
}

describe("configuração com null — assistente", () => {
  it("múltipla escolha com máximo null não tem erro", () => {
    expect(errosDaPergunta(pergunta({}), [])).toEqual([]);
  });

  it("número com mínimo e máximo null não tem erro", () => {
    const numero = pergunta({
      tipo: "numero",
      config: { minimo: null, maximo: null, inteiro: false },
    });
    expect(errosDaPergunta(numero, [])).toEqual([]);
  });

  it("um limite de verdade continua conferido", () => {
    expect(
      errosDaPergunta(
        pergunta({ config: { opcoes: OPCOES, outro: false, maximo: 0 } }),
        [],
      ),
    ).toEqual(["O máximo de marcações vai de 1 a 3."]);
    expect(
      errosDaPergunta(
        pergunta({ config: { opcoes: OPCOES, outro: false, maximo: 4 } }),
        [],
      ),
    ).toEqual(["O máximo de marcações vai de 1 a 3."]);
    expect(
      errosDaPergunta(
        pergunta({ tipo: "numero", config: { minimo: 5, maximo: 2 } }),
        [],
      ),
    ).toEqual(["O mínimo não pode ser maior que o máximo."]);
  });

  it("a saúde financeira gravada (Q13 com máximo null) passa na validação", () => {
    const e = estadoDoModelo("isfb");
    expect(
      validarPerguntas({ ...e, secoes: comoAApiDevolve(e.secoes) }),
    ).toEqual({});
  });

  it("na saúde financeira a Q13 (produtos) é obrigatória", () => {
    const q13 = perguntasEmOrdem(estadoDoModelo("isfb").secoes).find(
      (p) => p.chave === "Q13",
    )!;
    expect(q13.tipo).toBe("multipla_escolha");
    expect(q13.obrigatoria).toBe(true);
  });
});

describe("configuração com null — resposta pública", () => {
  const publica = (extra: Partial<PerguntaPublica> = {}): PerguntaPublica => ({
    id: "q",
    tipo: "multipla_escolha",
    texto: "Quais?",
    descricao: null,
    obrigatoria: true,
    config: { opcoes: OPCOES, outro: false, maximo: null },
    condicao: null,
    ...extra,
  });

  it("máximo null: marcar todas é válido", () => {
    expect(
      erroDaPergunta(publica(), { opcoes: ["a", "b", "c"], outro: null }),
    ).toBeNull();
  });

  it("máximo de verdade continua barrando", () => {
    expect(
      erroDaPergunta(publica({ config: { opcoes: OPCOES, maximo: 2 } }), {
        opcoes: ["a", "b", "c"],
        outro: null,
      }),
    ).toBe("Escolha até 2 opções.");
  });

  it("número com mínimo e máximo null aceita qualquer número", () => {
    const numero = publica({
      tipo: "numero",
      config: { minimo: null, maximo: null },
    });
    expect(erroDaPergunta(numero, "-12")).toBeNull();
    expect(erroDaPergunta(numero, "99999")).toBeNull();
    const comTeto = publica({
      tipo: "numero",
      config: { minimo: null, maximo: 10 },
    });
    expect(erroDaPergunta(comTeto, "11")).toBe("Informe um número até 10.");
  });

  it("a ajuda não diz 'até null' e as caixas marcam", () => {
    const aoMudar = vi.fn();
    render(
      <CampoDaPergunta
        pergunta={publica()}
        valor={{ opcoes: [], outro: null }}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.getByText("Escolha quantas opções quiser.")).toBeVisible();
    const caixa = screen.getByRole("checkbox", { name: "A" });
    expect(caixa).toBeEnabled();
    fireEvent.click(caixa);
    expect(aoMudar).toHaveBeenCalledWith({ opcoes: ["a"], outro: null });
  });

  it("número com limites null: nenhuma ajuda de faixa", () => {
    render(
      <CampoDaPergunta
        pergunta={publica({
          tipo: "numero",
          config: { minimo: null, maximo: null, inteiro: true },
        })}
        valor=""
        erro={null}
        aoMudar={() => undefined}
      />,
    );
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.getByText("Número inteiro.")).toBeInTheDocument();
  });
});

describe("configuração com null — assistente do modelo fixo", () => {
  function rascunhoIsfb(
    mexer: (s: PesquisaDetalhe["secoes"]) => PesquisaDetalhe["secoes"],
  ): PesquisaDetalhe {
    const entrada = entradaDoEstado(estadoDoModelo("isfb", "2026-11-27"));
    return {
      ...DETALHE,
      nome: entrada.nome,
      boasVindas: entrada.boasVindas,
      identificacao: entrada.identificacao,
      minimoPorGrupo: entrada.minimoPorGrupo,
      id: "p-isfb",
      modelo: "isfb",
      status: "rascunho",
      link: null,
      temRespostas: false,
      todos: true,
      participantesLista: [],
      encerraEm: null,
      separarPor: [],
      secoes: mexer(entrada.secoes),
    };
  }

  const montar = (base: PesquisaDetalhe) =>
    render(
      <AssistenteDoModelo
        servico={servicoFalso()}
        base={base}
        hoje="2026-11-27"
        agora={() => new Date(2026, 10, 27, 9, 5)}
        atrasoDoRascunho={0}
        onCancelar={vi.fn()}
        onConcluir={vi.fn()}
        onVerResultados={vi.fn()}
        onEditarGerada={vi.fn()}
      />,
    );

  it("retomado da API (com nulos), avança para a próxima etapa", async () => {
    montar(rascunhoIsfb(comoAApiDevolve));
    fireEvent.click(screen.getByRole("button", { name: /^Próximo:/ }));
    expect(
      await screen.findByRole("radiogroup", { name: "Quem vai responder" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uma pergunta com erro mostra o aviso geral em vez de travar calado", async () => {
    const quebrada = (secoes: PesquisaDetalhe["secoes"]) =>
      secoes.map((s) => ({
        ...s,
        perguntas: s.perguntas.map((p) =>
          p.chave === "Q13" ? { ...p, config: { ...p.config, maximo: 0 } } : p,
        ),
      }));
    montar(rascunhoIsfb(quebrada));
    fireEvent.click(screen.getByRole("button", { name: /^Próximo:/ }));
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(/perguntas deste modelo/i);
    expect(aviso).toHaveTextContent("O máximo de marcações vai de 1 a 14.");
    expect(
      screen.queryByRole("radiogroup", { name: "Quem vai responder" }),
    ).toBeNull();
  });
});
