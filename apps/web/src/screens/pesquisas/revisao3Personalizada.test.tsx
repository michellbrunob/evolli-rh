/**
 * T216 — 3ª revisão, assistente da personalizada e página de entrada:
 * lista de tipos acima do rodapé fixo, rascunho que retoma onde parou,
 * prazo passado avisado no campo sem travar o rascunho, mini-escala com
 * borda, cartões com quem responde e a gaveta "Ver perguntas" sem título
 * extra. Dados sintéticos.
 */
import { readFileSync } from "node:fs";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PesquisaDetalhe,
  PesquisaEntrada,
} from "../../api/pesquisasClient";
import { AssistenteDePesquisa } from "./AssistenteDePesquisa";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import { DETALHE, servicoFalso } from "./dadosDeTeste";
import { posicaoDaLista } from "./EditorDePerguntas";
import { EntradaPersonalizada } from "./EntradaPersonalizada";
import { entradaDoRascunho, estadoDoDetalhe } from "./estadoDaPesquisa";
import { PerguntasPorGrupo } from "./GaleriaDeModelos";
import { lembrarRascunho, memoriaDoRascunho } from "./rascunhosLocais";

const HOJE = "2026-11-27";

/**
 * O prazo como a API recebe: dia e hora de Brasília, sem fuso no texto
 * (contrato da T216); montado aqui para não virar literal de instante.
 */
const prazoDaApi = (dia: string, hora: string) => `${dia}T${hora}`;

const ultimaEntrada = (fn: {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}): PesquisaEntrada => {
  const chamada = fn.mock.calls.at(-1)!;
  return (chamada.length === 1 ? chamada[0] : chamada[1]) as PesquisaEntrada;
};

/** Um rascunho personalizado e identificado (5 etapas). */
const RASCUNHO: PesquisaDetalhe = {
  ...DETALHE,
  id: "p-rascunho",
  nome: "Pesquisa em andamento",
  modelo: "personalizada",
  identificacao: "identificada",
  status: "rascunho",
  publicadaEm: null,
  temRespostas: false,
  link: null,
};

function montar(base?: PesquisaDetalhe) {
  const servico = servicoFalso();
  render(
    <AssistenteDePesquisa
      servico={servico}
      modelo="personalizada"
      {...(base ? { base } : {})}
      hoje={HOJE}
      onSair={vi.fn()}
      onVerResultados={vi.fn()}
    />,
  );
  return servico;
}

const estadoDaEtapa = (n: number) => {
  const itens = document.querySelectorAll(".cadastro-etapas__etapa-item");
  return itens[n - 1]!.className.replace(/.*cadastro-etapas__etapa-item--/, "");
};

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("R3-A-14 — a lista de tipos nunca fica atrás do rodapé fixo", () => {
  it("abre para baixo quando cabe; para cima quando o rodapé cobriria", () => {
    expect(posicaoDaLista({ top: 100, bottom: 130 }, 900, 400)).toEqual({
      acima: false,
      alturaMaxima: 448,
    });
    expect(posicaoDaLista({ top: 500, bottom: 530 }, 700, 400)).toEqual({
      acima: true,
      alturaMaxima: 448,
    });
    // Pouco espaço dos dois lados: fica no maior, com a altura que cabe.
    expect(posicaoDaLista({ top: 150, bottom: 180 }, 400, 600)).toEqual({
      acima: false,
      alturaMaxima: 212,
    });
    expect(posicaoDaLista({ top: 300, bottom: 330 }, 420, 600)).toEqual({
      acima: true,
      alturaMaxima: 292,
    });
  });

  it("no assistente, mede até o rodapé fixo e abre para cima", async () => {
    lembrarRascunho(RASCUNHO.id, {
      etapa: 2,
      totalDeEtapas: 5,
      salvoEm: "2026-11-27T12:00:00Z",
    });
    montar(RASCUNHO);
    await screen.findByRole("heading", { name: /Etapa 2 de 5/ });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("cadastro-etapas__rodape"))
          return { top: 640, bottom: 720 } as DOMRect;
        if (this.classList.contains("pesquisas__nova-pergunta"))
          return { top: 560, bottom: 600 } as DOMRect;
        return { top: 0, bottom: 0 } as DOMRect;
      },
    );
    // A lista inteira (os 13 tipos) é mais alta que o espaço até o rodapé.
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(500);
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar pergunta na seção 1" }),
    );
    const lista = screen.getByRole("group", { name: "Tipo da nova pergunta" });
    expect(lista).toHaveClass("pesquisas__tipos--acima");
    expect(lista.style.maxHeight).toBe("448px");
  });
});

describe("R3-A-15 — rascunho retomado volta à etapa em que parou", () => {
  it("abre na etapa lembrada, diz onde parou e não marca etapas nunca vistas", async () => {
    lembrarRascunho(RASCUNHO.id, {
      etapa: 3,
      totalDeEtapas: 5,
      salvoEm: "2026-11-27T13:42:00Z",
    });
    montar(RASCUNHO);
    expect(
      await screen.findByRole("heading", { name: /Etapa 3 de 5/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Parou na etapa 3 de 5 · salvo em 27\/11\/2026 às/),
    ).toBeInTheDocument();
    expect([1, 2, 3, 4, 5].map(estadoDaEtapa)).toEqual([
      "concluida",
      "concluida",
      "atual",
      "pendente",
      "pendente",
    ]);
  });

  it("sem lembrança, começa na etapa 1 e não dá nada por concluído", async () => {
    montar(RASCUNHO);
    await screen.findByRole("heading", { name: /Etapa 1 de 5/ });
    expect([1, 2, 3, 4, 5].map(estadoDaEtapa)).toEqual([
      "atual",
      "pendente",
      "pendente",
      "pendente",
      "pendente",
    ]);
    expect(screen.queryByText(/^Parou na etapa/)).not.toBeInTheDocument();
  });

  it("publicada em edição continua com todas as etapas abertas", async () => {
    lembrarRascunho("p-1", {
      etapa: 3,
      totalDeEtapas: 5,
      salvoEm: "2026-11-27T13:42:00Z",
    });
    montar({ ...RASCUNHO, id: "p-1", status: "ativa" });
    await screen.findByRole("heading", { name: /Etapa 1 de 5/ });
    expect([2, 3, 4, 5].map(estadoDaEtapa)).toEqual([
      "concluida",
      "concluida",
      "concluida",
      "visitada",
    ]);
  });

  it("lembra a etapa para onde a pessoa vai e a etapa em que salvou", async () => {
    const servico = montar();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Pesquisa nova" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Próximo: / }));
    await screen.findByRole("heading", { name: /Etapa 2 de 5/ });
    expect(memoriaDoRascunho("p-novo")).toMatchObject({
      etapa: 2,
      totalDeEtapas: 5,
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByText("Rascunho salvo.");
    expect(servico.alterarPesquisa).toHaveBeenCalled();
    expect(memoriaDoRascunho("p-novo")?.etapa).toBe(2);
  });
});

describe("R3-A-16 — prazo passado avisa no campo e não trava o rascunho", () => {
  it("entradaDoRascunho troca só o prazo ou o mínimo inválidos pelo gravado", () => {
    const estado = estadoDoDetalhe(RASCUNHO);
    const gravado = {
      encerraEm: "2026-12-10T23:59:00-03:00",
      minimoPorGrupo: 5,
    };
    const valido = { ...estado, encerraEm: "2026-12-01", encerraHora: "18:00" };
    expect(entradaDoRascunho(valido, HOJE, gravado).encerraEm).toBe(
      prazoDaApi("2026-12-01", "18:00"),
    );
    const passado = { ...estado, encerraEm: "2026-11-01", nome: "Novo nome" };
    const corpo = entradaDoRascunho(passado, HOJE, gravado);
    expect(corpo.encerraEm).toBe(prazoDaApi("2026-12-10", "23:59"));
    expect(corpo.nome).toBe("Novo nome");
    expect(entradaDoRascunho(passado, HOJE, null).encerraEm).toBeNull();
    const minimo = entradaDoRascunho(
      { ...estado, minimoPorGrupo: 42 },
      HOJE,
      gravado,
    );
    expect(minimo.minimoPorGrupo).toBe(5);
    expect(
      entradaDoRascunho({ ...estado, minimoPorGrupo: Number.NaN }, HOJE, null)
        .minimoPorGrupo,
    ).toBe(3);
  });

  it("personalizada: o erro aparece ao digitar e o rascunho salva o resto", async () => {
    lembrarRascunho(RASCUNHO.id, {
      etapa: 4,
      totalDeEtapas: 5,
      salvoEm: "2026-11-27T13:42:00Z",
    });
    const servico = montar({
      ...RASCUNHO,
      encerraEm: "2026-12-10T23:59:00-03:00",
    });
    await screen.findByRole("heading", { name: /Etapa 4 de 5/ });
    const data = screen.getByLabelText("Data de encerramento");
    fireEvent.change(data, { target: { value: "2026-11-01" } });
    const erro = screen.getByText(
      "A data de encerramento não pode ser anterior a hoje.",
    );
    expect(data).toHaveAttribute("aria-invalid", "true");
    expect(data.getAttribute("aria-describedby")).toBe(erro.id);
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(
      await screen.findByText(
        "Rascunho salvo, menos o prazo: corrija na etapa Envio e prazo.",
      ),
    ).toBeInTheDocument();
    const enviada = ultimaEntrada(servico.alterarPesquisa);
    expect(enviada.encerraEm).toBe(prazoDaApi("2026-12-10", "23:59"));
    expect(enviada.nome).toBe("Pesquisa em andamento");
    // Publicar continua barrado pelo prazo.
    fireEvent.click(screen.getByRole("button", { name: /^Próximo: / }));
    expect(
      await screen.findByText("Falta corrigir 1 ponto nesta etapa."),
    ).toBeInTheDocument();
  });

  it("modelo pronto: a gravação automática continua com o prazo inválido", async () => {
    const servico = servicoFalso();
    render(
      <AssistenteDoModelo
        servico={servico}
        modeloId="pulso"
        hoje={HOJE}
        agora={() => new Date(2026, 10, 27, 9, 5)}
        atrasoDoRascunho={0}
        onCancelar={vi.fn()}
        onConcluir={vi.fn()}
        onVerResultados={vi.fn()}
        onEditarGerada={vi.fn()}
      />,
    );
    await screen.findByText("Rascunho salvo às 09:05");
    fireEvent.click(screen.getByRole("button", { name: /Próximo: Colab/ }));
    await screen.findByText("2 pessoas vão receber a pesquisa");
    fireEvent.click(screen.getByRole("button", { name: /Próximo: Enviar/ }));
    fireEvent.click(
      await screen.findByRole("switch", { name: "Encerrar automaticamente" }),
    );
    await waitFor(() =>
      expect(ultimaEntrada(servico.alterarPesquisa).encerraEm).not.toBeNull(),
    );
    const nome = ultimaEntrada(servico.alterarPesquisa).nome;
    const antes = servico.alterarPesquisa.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Data de encerramento"), {
      target: { value: "2026-11-01" },
    });
    expect(
      screen.getByText("A data de encerramento não pode ser anterior a hoje."),
    ).toBeInTheDocument();
    // A troca da data é uma mudança: a gravação vai, sem o prazo inválido.
    await waitFor(() =>
      expect(servico.alterarPesquisa.mock.calls.length).toBeGreaterThan(antes),
    );
    const enviada = ultimaEntrada(servico.alterarPesquisa);
    expect(enviada.nome).toBe(nome);
    expect(enviada.encerraEm).toBeNull();
    expect(
      screen.queryByText(/Não foi possível salvar o rascunho/),
    ).not.toBeInTheDocument();
  });
});

describe("R3-A-32 — cartões da personalizada dizem quem responde", () => {
  it("Experiência · 90 dias e Avaliação 180° com o formato próprio", async () => {
    render(
      <EntradaPersonalizada
        servico={servicoFalso()}
        onVoltar={vi.fn()}
        onComecar={vi.fn()}
      />,
    );
    const cartao = (nome: string) =>
      screen.getByRole("article", { name: nome });
    expect(cartao("Experiência · 90 dias")).toHaveTextContent(
      "Gestor avalia o time",
    );
    expect(cartao("Avaliação 180°")).toHaveTextContent(
      "Gestor e autoavaliação",
    );
    expect(cartao("Avaliação 180°")).not.toHaveTextContent("(180°)");
    expect(cartao("Satisfação com benefícios")).toHaveTextContent(
      "Cada pessoa responde",
    );
    expect(cartao("Experiência · 90 dias")).not.toHaveTextContent(
      "Cada pessoa responde",
    );
  });
});

describe("R3-A-33 — gaveta Ver perguntas começa direto na lista", () => {
  const PERGUNTAS = [
    { id: "a", texto: "Primeira" },
    { id: "b", texto: "Segunda" },
  ];

  it("primeiro grupo sem nome: sem o título 'Perguntas · N'", () => {
    render(
      <PerguntasPorGrupo
        grupos={[
          { titulo: null, cor: undefined, perguntas: PERGUNTAS, quantidade: 2 },
          {
            titulo: "Comentário final (opcional)",
            cor: undefined,
            perguntas: [{ id: "c", texto: "Algo mais?" }],
            quantidade: 1,
          },
        ]}
      />,
    );
    expect(screen.queryByText(/^Perguntas/)).not.toBeInTheDocument();
    expect(screen.getByText("Comentário final (opcional)")).toBeInTheDocument();
    expect(
      within(screen.getAllByRole("list")[0]!).getAllByRole("listitem"),
    ).toHaveLength(2);
  });

  it("grupo sem nome depois de outro continua identificado", () => {
    render(
      <PerguntasPorGrupo
        grupos={[
          {
            titulo: "Entregas",
            cor: undefined,
            perguntas: PERGUNTAS,
            quantidade: 2,
          },
          {
            titulo: null,
            cor: undefined,
            perguntas: [{ id: "c", texto: "Algo mais?" }],
            quantidade: 1,
          },
        ]}
      />,
    );
    expect(screen.getByText("Entregas")).toBeInTheDocument();
    expect(screen.getByText("Perguntas")).toBeInTheDocument();
  });
});

describe("R3-A-22 — mini-escala do assistente com borda visível", () => {
  it("cada quadradinho tem borda forte e fundo próprio sobre a faixa cinza", () => {
    const css = readFileSync("src/screens/pesquisas/Pesquisas.css", "utf8");
    const regra = css.match(
      /\.pesquisas__previa-escala--mini span\s*\{([^}]*)\}/,
    );
    expect(regra).not.toBeNull();
    expect(regra![1]).toMatch(/border-color:\s*var\(--divisor-cor-forte\)/);
    expect(regra![1]).toMatch(/background:\s*var\(--surface-canvas\)/);
  });
});
