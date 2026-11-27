/**
 * T216 — redesenhos das telas de Pesquisas: cartões de indicadores (selo da
 * faixa na linha do valor, ícone no título, maior e menor média com a cor
 * da faixa, régua com as pontas), cartão do eNPS por pergunta (zona, pílula
 * de promotores e detratores, barra empilhada por grupo), comentários (a
 * pergunta embaixo do título) e rodapés dos cartões. Servidor simulado;
 * dados sintéticos.
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
import type {
  CampoGrupo,
  CandidatoPesquisa,
  PesquisaDetalhe,
} from "../../api/pesquisasClient";
import {
  CANDIDATOS,
  DETALHE,
  GRUPOS,
  RESULTADOS,
  listarCandidatosFalso,
  servicoFalso,
} from "./dadosDeTeste";
import { EditarPesquisa } from "./EditarPesquisa";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";
import { CartaoDeEncerramento } from "./CartaoDeEncerramento";
import { SepararRespostasPor } from "./SepararRespostasPor";
import { TelaDeGerada } from "./TelaDeGerada";

function montarResultados(extra: Parameters<typeof servicoFalso>[0] = {}) {
  render(
    <ResultadosDaPesquisa
      servico={servicoFalso(extra)}
      pesquisaId="p-1"
      podeEditar
      onVoltar={vi.fn()}
      onEditar={vi.fn()}
    />,
  );
}

const indicador = async (titulo: string) => {
  const ind = await screen.findByRole("region", { name: "Indicadores" });
  return within(ind)
    .getByRole("heading", { name: titulo })
    .closest(".pesquisas__indicador") as HTMLElement;
};

describe("B6 — cartões de indicadores", () => {
  it("o selo da faixa fica na linha do valor e o título tem ícone", async () => {
    montarResultados();
    const media = await indicador("Média geral");
    const valor = media.querySelector(".pesquisas__indicador-valor")!;
    expect(valor).toHaveTextContent("8,5 /108 ou mais");
    const titulo = within(media).getByRole("heading", { name: "Média geral" });
    expect(
      titulo.parentElement!.querySelector(".pesquisas__indicador-icone svg"),
    ).not.toBeNull();
    const enps = await indicador("eNPS");
    expect(enps.querySelector(".pesquisas__indicador-valor")).toHaveTextContent(
      "50Zona de qualidade",
    );
  });

  it("maior e menor média com a cor da faixa; a régua com as pontas 1 e 10", async () => {
    montarResultados({
      resultadosDaPesquisa: vi.fn(() =>
        Promise.resolve({
          ...RESULTADOS,
          indicadores: {
            mediaGeral: 7.3,
            perguntasDeEscala: 2,
            maiorMedia: { perguntaId: "q-conc", media: 8.7 },
            menorMedia: { perguntaId: "q-conc", media: 6 },
            enps: null,
          },
        }),
      ),
    });
    const maior = await indicador("Maior média");
    const menor = await indicador("Menor média");
    const media = await indicador("Média geral");
    expect(
      maior.querySelector<HTMLElement>(".pesquisas__indicador-numero")!.dataset
        .faixa,
    ).toBe("alta");
    expect(
      menor.querySelector<HTMLElement>(".pesquisas__indicador-numero")!.dataset
        .faixa,
    ).toBe("baixa");
    // A média geral fica neutra: a faixa dela vai no selo.
    expect(
      media.querySelector<HTMLElement>(".pesquisas__indicador-numero")!.dataset
        .faixa,
    ).toBeUndefined();
    for (const cartao of [media, maior, menor]) {
      const pontas = cartao.querySelector(".pesquisas__regua-pontas");
      expect(pontas).toHaveTextContent("110");
      expect(pontas!.children).toHaveLength(2);
    }
  });
});

describe("B7 — cartão do eNPS por pergunta", () => {
  it("zona, pílula de promotores e detratores e a barra empilhada por grupo", async () => {
    montarResultados();
    const cartao = await screen.findByRole("region", {
      name: "1. Quanto você indicaria a empresa?",
    });
    const enps = within(cartao).getByRole("region", { name: "eNPS" });
    expect(enps.querySelector(".pesquisas__zona-texto")).toHaveTextContent(
      "Zona de qualidade",
    );
    expect(enps.querySelector(".pesquisas__pilula-cinza")).toHaveTextContent(
      "63% promotores · 13% detratores",
    );
    expect(
      within(enps).getByRole("img", {
        name: "Grupos do eNPS: Detratores 0–6 13%, Neutros 7–8 25%, Promotores 9–10 63%",
      }),
    ).toBeInTheDocument();
    // A legenda diz as faixas de nota de cada grupo (sem lista de barras).
    expect(enps).toHaveTextContent("Detratores 0–6");
    expect(enps).toHaveTextContent("Neutros 7–8");
    expect(enps).toHaveTextContent("Promotores 9–10");
    expect(enps.querySelector(".pesquisas__linhas")).toBeNull();
  });
});

describe("B8 — comentários e rodapés dos cartões", () => {
  it("a pergunta citada fica embaixo do título; o contador, à parte", async () => {
    montarResultados();
    const cartao = await screen.findByRole("region", {
      name: "5. Comentários",
    });
    const titulo = within(cartao).getByRole("heading", {
      name: "Comentários livres",
    });
    const textos = titulo.parentElement!;
    expect(textos.lastElementChild).toHaveTextContent("“Comentários”");
    expect(textos).not.toHaveTextContent("2 comentários");
    expect(cartao).toHaveTextContent("2 comentários");
  });

  it("o rodapé é a última faixa do cartão (com a divisória), na escala e no eNPS", async () => {
    montarResultados();
    const escala = await screen.findByRole("region", {
      name: "2. Tenho clareza das prioridades.",
    });
    const enps = screen.getByRole("region", {
      name: "1. Quanto você indicaria a empresa?",
    });
    for (const [cartao, texto] of [
      [escala, "Favorável = notas 4 e 5"],
      [enps, "eNPS = % de promotores − % de detratores"],
    ] as const) {
      const rodape = cartao.lastElementChild!;
      expect(rodape.tagName).toBe("FOOTER");
      expect(rodape).toHaveClass("pesquisas__cartao-pergunta-rodape");
      expect(rodape).toHaveTextContent(texto);
    }
    // A coluna da rosca é separada das barras.
    expect(
      escala.querySelector(
        ".pesquisas__cartao-pergunta-corpo > .pesquisas__cartao-pergunta-resumo",
      ),
    ).not.toBeNull();
  });
});

describe("B9 — Separar respostas por", () => {
  function montarSeparar(
    separarPor: CampoGrupo[],
    travado = false,
    grupos = GRUPOS,
  ) {
    const onMudar = vi.fn();
    render(
      <SepararRespostasPor
        servico={servicoFalso({
          listarGrupos: vi.fn(() => Promise.resolve(grupos)),
        })}
        separarPor={separarPor}
        travado={travado}
        motivoDoTravamento="A pesquisa já tem respostas: os campos não mudam mais."
        onMudar={onMudar}
      />,
    );
    return onMudar;
  }

  it("lista vertical: cada campo com as opções resumidas e o interruptor à direita", async () => {
    const onMudar = montarSeparar([], false, {
      ...GRUPOS,
      unidade: [
        { id: "u-1", nome: "Matriz" },
        { id: "u-2", nome: "Filial Sul" },
        { id: "u-3", nome: "Filial Norte" },
        { id: "u-4", nome: "Loja Centro" },
      ],
    });
    const lista = screen.getByRole("list", { name: "Separar respostas por" });
    const itens = within(lista).getAllByRole("listitem");
    expect(itens).toHaveLength(3);
    expect(
      await within(itens[2]!).findByText(
        "4 opções: Matriz, Filial Sul, Filial Norte…",
      ),
    ).toBeInTheDocument();
    const interruptor = within(itens[0]!).getByRole("switch", {
      name: "Departamento",
    });
    expect(interruptor).toHaveAttribute("aria-checked", "false");
    // O interruptor vem depois dos textos (fica à direita).
    expect(
      interruptor.closest(".pesquisas__separar-cabeca")!.lastElementChild,
    ).toBe(interruptor);
    fireEvent.click(interruptor);
    expect(onMudar).toHaveBeenCalledWith(["departamento"]);
    expect(
      screen.getByRole("region", { name: "Separar respostas por" }),
    ).toBeInTheDocument();
  });

  it("ligado: as opções dentro do cartão e o '+ Adicionar' na mesma linha", async () => {
    montarSeparar(["departamento"]);
    const opcoes = await screen.findByRole("list", {
      name: "Opções de departamento",
    });
    const item = opcoes.closest("li")!;
    expect(item).toHaveTextContent("Opções que aparecem para quem responde");
    const adicionar = within(item).getByRole("button", {
      name: "Adicionar departamento",
    });
    expect(adicionar.parentElement).toBe(opcoes.parentElement);
  });

  it("travado na edição: o campo ligado não parece ativo nem oferece adicionar", async () => {
    montarSeparar(["departamento"], true);
    const lista = screen.getByRole("list", { name: "Separar respostas por" });
    const ligado = within(lista).getByRole("switch", { name: "Departamento" });
    expect(ligado).toBeDisabled();
    expect(ligado).toHaveAttribute("aria-checked", "true");
    expect(ligado.closest("li")).toHaveAttribute("data-travado");
    expect(
      await screen.findByRole("list", { name: "Opções de departamento" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adicionar departamento" }),
    ).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(
      "A pesquisa já tem respostas: os campos não mudam mais.",
    );
  });
});

describe("B11 — tela final do assistente", () => {
  function montarFinal(identificacao: "identificada" | "anonima") {
    const onConcluir = vi.fn();
    render(
      <TelaDeGerada
        pesquisa={{
          ...DETALHE,
          identificacao,
          status: "ativa",
          link: "#/p/token",
        }}
        comCabecalhoDaPagina
        onVerResultados={vi.fn()}
        onEditar={vi.fn()}
        onConcluir={onConcluir}
      />,
    );
    return onConcluir;
  }

  it("as próximas ações ficam abaixo do cartão, cada uma com a seta à direita", () => {
    montarFinal("identificada");
    const cartao = screen.getByRole("region", {
      name: "Pesquisa criada e ativa",
    });
    const proximas = screen.getByRole("list", { name: "Próximas ações" });
    expect(cartao).not.toContainElement(proximas);
    expect(cartao.nextElementSibling).toBe(proximas);
    for (const botao of within(proximas).getAllByRole("button")) {
      expect(botao.lastElementChild!.tagName.toLowerCase()).toBe("svg");
      expect(botao.querySelector(".pesquisas__proximas-titulo")).not.toBeNull();
    }
  });

  it("'Concluir' no rodapé fixo, à direita", () => {
    const onConcluir = montarFinal("identificada");
    const concluir = screen.getByRole("button", { name: "Concluir" });
    const rodape = concluir.closest("footer")!;
    expect(rodape).toHaveClass("pesquisas__rodape");
    expect(rodape).toHaveClass("pesquisas__rodape--so-direita");
    fireEvent.click(concluir);
    expect(onConcluir).toHaveBeenCalled();
  });

  it("'Editar pesquisa' não promete editar as perguntas", () => {
    montarFinal("identificada");
    const editar = screen.getByRole("button", { name: /Editar pesquisa/ });
    expect(editar).toHaveTextContent("Nome, prazo e participantes");
    expect(editar.textContent).not.toMatch(/pergunta/i);
  });

  it("na anônima, 'Editar pesquisa' fala de nome, descrição e prazo", () => {
    montarFinal("anonima");
    const editar = screen.getByRole("button", { name: /Editar pesquisa/ });
    expect(editar).toHaveTextContent("Nome, descrição e prazo");
  });
});

describe("B12 — etapa Enviar", () => {
  function montarEncerramento(data: string | null, compacto = false) {
    const onMudar = vi.fn();
    render(
      <CartaoDeEncerramento
        data={data}
        hora="23:59"
        hoje="2026-11-27"
        compacto={compacto}
        onMudar={onMudar}
      />,
    );
    return onMudar;
  }

  it("desligado: ícone no título e a frase 'Sem prazo…' numa caixa cinza com ícone", () => {
    const onMudar = montarEncerramento(null);
    const cartao = screen.getByRole("region", {
      name: "Encerrar automaticamente",
    });
    expect(
      cartao.querySelector(".pesquisas__encerramento-icone svg"),
    ).not.toBeNull();
    const nota = within(cartao).getByRole("note");
    expect(nota).toHaveClass("pesquisas__nota-cinza");
    expect(nota).toHaveTextContent(
      "Sem prazo, a pesquisa fica aberta até você mudar o status para Finalizada.",
    );
    expect(nota.querySelector("svg")).not.toBeNull();
    fireEvent.click(
      within(cartao).getByRole("switch", { name: "Encerrar automaticamente" }),
    );
    expect(onMudar).toHaveBeenCalledWith({
      encerraEm: "2026-12-11",
      encerraHora: "23:59",
    });
  });

  it("ligado: data e hora lado a lado, na largura do cartão, e a frase na caixa cinza", () => {
    montarEncerramento("2026-12-11");
    const cartao = screen.getByRole("region", {
      name: "Encerrar automaticamente",
    });
    expect(cartao).toHaveAttribute("data-ligado");
    const campos = cartao.querySelector(".pesquisas__encerramento-campos")!;
    expect(campos.children).toHaveLength(2);
    for (const rotulo of ["Data de encerramento", "Hora"]) {
      const campo = within(cartao).getByLabelText(rotulo);
      expect(campo).not.toHaveClass("pesquisas__campo--curto");
    }
    expect(within(cartao).getByRole("note")).toHaveTextContent(
      "Depois de 11/12/2026 às 23:59",
    );
  });

  it("compacto (Editar pesquisa): 'Encerramento' com a frase embaixo do título", () => {
    montarEncerramento(null, true);
    const cartao = screen.getByRole("region", { name: "Encerramento" });
    expect(cartao).toHaveTextContent(
      "Sem prazo, a pesquisa fica aberta até você mudar o status para Finalizada.",
    );
    expect(within(cartao).queryByRole("note")).toBeNull();
    expect(
      within(cartao).getByRole("switch", { name: "Encerrar automaticamente" }),
    ).toBeInTheDocument();
  });

  it("o resumo da revisão é uma grade de células com borda", async () => {
    const { AssistenteDoModelo } = await import("./AssistenteDoModelo");
    render(
      <AssistenteDoModelo
        servico={servicoFalso()}
        modeloId="pulso"
        hoje="2026-11-27"
        agora={() => new Date(2026, 10, 27, 9, 5)}
        atrasoDoRascunho={0}
        onCancelar={vi.fn()}
        onConcluir={vi.fn()}
        onVerResultados={vi.fn()}
        onEditarGerada={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Anônima/ }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo: Enviar/ }));
    await screen.findByRole("region", { name: "Revise antes de gerar" });
    const resumo = document.querySelector<HTMLElement>(
      'dl[aria-label="Resumo da pesquisa"]',
    )!;
    expect(resumo).toHaveClass("pesquisas__resumo-celulas");
    const celulas = Array.from(resumo.children);
    expect(celulas.map((c) => c.querySelector("dt")?.textContent)).toEqual([
      "Nome",
      "Identificação",
      "Perguntas",
      "Participantes",
      "Descrição",
    ]);
    expect(celulas.at(-1)).toHaveClass("pesquisas__resumo-largo");
  });
});

describe("B13 — Editar pesquisa em duas colunas", () => {
  const PUBLICADA = {
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
  const DORA: CandidatoPesquisa = {
    colaboradorId: "c-3",
    nome: "Dora Exemplo",
    cargo: "Analista",
    departamento: "Operações",
    centroCusto: "Administrativo",
    unidade: "Matriz",
  };

  function montarEdicao(detalhe: PesquisaDetalhe = PUBLICADA) {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(detalhe)),
      listarCandidatos: vi.fn(listarCandidatosFalso([...CANDIDATOS, DORA])),
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

  it("à esquerda os dados, o encerramento e o formato; à direita o painel de participantes", async () => {
    montarEdicao();
    const painel = await screen.findByRole("region", {
      name: "Participantes",
    });
    const grade = painel.parentElement!;
    expect(grade).toHaveClass("pesquisas__edicao-grade");
    const [esquerda, direita] = Array.from(grade.children);
    expect(direita).toBe(painel);
    expect(esquerda).toHaveTextContent("Dados da pesquisa");
    expect(esquerda).toHaveTextContent("Encerramento");
    expect(esquerda).toHaveTextContent("Formato:Identificada");
    expect(
      within(painel).getByRole("heading", { name: "Participantes (3)" }),
    ).toBeInTheDocument();
  });

  it("atuais: busca e filtros de status e departamento; cada pessoa com o status", async () => {
    montarEdicao();
    const painel = await screen.findByRole("region", {
      name: "Participantes",
    });
    const lista = within(painel).getByRole("list", {
      name: "Participantes atuais",
    });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(3);
    expect(within(lista).getAllByRole("listitem")[0]).toHaveTextContent(
      "Respondeu",
    );
    expect(within(lista).getAllByRole("listitem")[1]).toHaveTextContent(
      "Pendente",
    );
    fireEvent.click(within(painel).getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Pendentes" }));
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(
      within(painel).getByRole("combobox", { name: "Departamento" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Financeiro" }));
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1);
    expect(lista).toHaveTextContent("Bruno Exemplo");
    fireEvent.change(
      within(painel).getByRole("searchbox", {
        name: "Buscar por nome ou departamento",
      }),
      { target: { value: "caio" } },
    );
    expect(within(lista).queryAllByRole("listitem")).toHaveLength(0);
    expect(painel).toHaveTextContent(
      "Nenhum participante encontrado com esses filtros.",
    );
  });

  it("adicionar: candidatos da API; incluir atualiza totais, pendentes e a frase", async () => {
    const { servico, onSalvo } = montarEdicao();
    const painel = await screen.findByRole("region", {
      name: "Participantes",
    });
    fireEvent.click(within(painel).getByRole("button", { name: /Adicionar/ }));
    const candidatos = await within(painel).findByRole("list", {
      name: "Pessoas para adicionar",
    });
    expect(servico.listarCandidatos).toHaveBeenCalled();
    // Quem já está na pesquisa não aparece para adicionar.
    expect(within(candidatos).getAllByRole("listitem")).toHaveLength(1);
    expect(candidatos).toHaveTextContent(
      "Dora ExemploAnalista · Operações · Administrativo · Matriz",
    );
    expect(painel).toHaveTextContent("0 selecionados");
    fireEvent.click(
      within(candidatos).getByRole("checkbox", { name: "Dora Exemplo" }),
    );
    const totais = within(painel).getByLabelText("Totais de participantes");
    expect(totais).toHaveTextContent("Total4");
    expect(totais).toHaveTextContent("Pendentes3");
    expect(totais).toHaveTextContent("A adicionar1");
    expect(painel).toHaveTextContent("1 selecionado");
    expect(
      within(painel).getByRole("heading", { name: "Participantes (4)" }),
    ).toBeInTheDocument();
    expect(painel).toHaveTextContent("3 pessoas ainda não responderam");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    const [, entrada] = servico.alterarPesquisa.mock.calls.at(-1)!;
    expect(entrada.participantes).toEqual({
      todos: false,
      colaboradorIds: ["c-1", "c-2", "c-9", "c-3"],
    });
  });

  it("o aviso flutuante sobe acima do rodapé fixo (não cobre 'Salvar alterações')", () => {
    const css = readFileSync(resolve(__dirname, "Pesquisas.css"), "utf8");
    expect(css).toMatch(
      /:has\(\.pesquisas__rodape\)\s+\.aviso-flutuante\s*\{[^}]*bottom:\s*calc\(var\(--altura-rodape-pagina\)/,
    );
  });
});
