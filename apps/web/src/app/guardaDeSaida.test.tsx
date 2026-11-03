/**
 * T200 — a guarda de saída do shell, sozinha: o diálogo único, o teclado, o
 * foco, as áreas, o salvamento em andamento, o aviso nativo do navegador e o
 * isolamento entre abas.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  AREAS_DE_EDICAO,
  AreaDeEdicao,
  ProvedorDeEdicoes,
  RegistroDeEdicoes,
  useEdicaoEmAndamento,
} from "./edicoesPendentes";
import {
  type PedidoDeSaida,
  ProvedorDeGuarda,
  useGuardaDeSaida,
} from "./guardaDeSaida";

/** Uma tela que declara edição, como as do produto. */
function Edicao({
  rotulo,
  pendente = true,
  salvando = false,
  aviso,
}: {
  rotulo: string;
  pendente?: boolean;
  salvando?: boolean;
  aviso?: string;
}) {
  useEdicaoEmAndamento(rotulo, {
    pendente,
    salvando,
    ...(aviso ? { aviso } : {}),
  });
  return null;
}

/** Um botão que pede a saída, como o menu do shell. */
function Saida({
  rotulo = "Ir para Ponto",
  pedido,
}: {
  rotulo?: string;
  pedido: Omit<PedidoDeSaida, "executar"> & { executar: () => void };
}) {
  const guarda = useGuardaDeSaida();
  return (
    <button type="button" onClick={() => guarda.solicitarSaida(pedido)}>
      {rotulo}
    </button>
  );
}

function montar(
  conteudo: React.ReactNode,
  { suspensa = false }: { suspensa?: boolean } = {},
) {
  const registro = new RegistroDeEdicoes();
  const arvore = (s: boolean) => (
    <ProvedorDeEdicoes registro={registro}>
      <ProvedorDeGuarda suspensa={s}>
        <main id="conteudo-principal" tabIndex={-1}>
          {conteudo}
        </main>
      </ProvedorDeGuarda>
    </ProvedorDeEdicoes>
  );
  const resultado = render(arvore(suspensa));
  return {
    registro,
    suspender: () => resultado.rerender(arvore(true)),
  };
}

const dialogo = () =>
  screen.getByRole("alertdialog", { name: "Sair sem salvar?" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("T200 — guarda de saída: o diálogo único", () => {
  it("sem edição pendente, a saída acontece na hora, sem diálogo", () => {
    const executar = vi.fn();
    montar(<Saida pedido={{ executar }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    expect(executar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("com edição pendente: pergunta, lista todas as telas e foca 'Continuar editando'", () => {
    const executar = vi.fn();
    montar(
      <>
        <Edicao rotulo="Ficha do colaborador" />
        <Edicao rotulo="Horário de trabalho" />
        <Edicao rotulo="Sem alteração" pendente={false} />
        <Saida pedido={{ executar }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    expect(executar).not.toHaveBeenCalled();
    const caixa = dialogo();
    expect(caixa).toHaveAttribute("aria-modal", "true");
    expect(
      within(caixa)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Ficha do colaborador", "Horário de trabalho"]);
    expect(caixa).toHaveAccessibleDescription(
      "Há alterações não salvas em: Ficha do colaborador Horário de trabalho Saindo agora, elas serão descartadas.",
    );
    expect(
      within(caixa).getByRole("button", { name: "Continuar editando" }),
    ).toHaveFocus();
  });

  it("'Continuar editando' e Escape: nada sai, nada se perde, o foco volta a quem pediu", () => {
    const executar = vi.fn();
    montar(
      <>
        <Edicao rotulo="Nova admissão" />
        <Saida pedido={{ executar }} />
      </>,
    );
    const botao = screen.getByRole("button", { name: "Ir para Ponto" });
    botao.focus();
    fireEvent.click(botao);
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(botao).toHaveFocus();

    fireEvent.click(botao);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(botao).toHaveFocus();
    expect(executar).not.toHaveBeenCalled();
  });

  it("Tab e Shift+Tab ficam no diálogo; enquanto ele está aberto, a árvore é inerte", () => {
    montar(
      <>
        <Edicao rotulo="Documentos" />
        <Saida pedido={{ executar: vi.fn() }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    const caixa = dialogo();
    const continuar = within(caixa).getByRole("button", {
      name: "Continuar editando",
    });
    const sair = within(caixa).getByRole("button", { name: "Sair sem salvar" });
    fireEvent.keyDown(window, { key: "Tab" });
    expect(sair).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(continuar).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(sair).toHaveFocus();
    expect(document.querySelector(".guarda-saida__arvore")).toHaveAttribute(
      "inert",
    );
  });

  it("'Sair sem salvar' só sai com o clique explícito, e uma vez", () => {
    const executar = vi.fn();
    montar(
      <>
        <Edicao rotulo="Solicitações" />
        <Saida pedido={{ executar }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(executar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.querySelector(".guarda-saida__arvore")).not.toHaveAttribute(
      "inert",
    );
  });

  it("depois de sair, se quem pediu sumiu, o foco vai à região principal — nunca ao body", () => {
    function Tela() {
      const [aberta, setAberta] = useState(true);
      return aberta ? (
        <>
          <Edicao rotulo="Ficha do colaborador" />
          <Saida
            rotulo="Colaboradores"
            pedido={{ executar: () => setAberta(false) }}
          />
        </>
      ) : (
        <p>Listagem</p>
      );
    }
    montar(<Tela />);
    const botao = screen.getByRole("button", { name: "Colaboradores" });
    botao.focus();
    fireEvent.click(botao);
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(screen.getByText("Listagem")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.getElementById("conteudo-principal")).toHaveFocus();
  });

  it("sem a região principal do shell (no Hub), o foco vai à área do Hub; sem ela, ao <main>", () => {
    function Shell({ destino }: { destino: "hub" | "main" }) {
      const [saiu, setSaiu] = useState(false);
      if (saiu) {
        return destino === "hub" ? (
          <main id="hub-conteudo" tabIndex={-1}>
            Seu acesso
          </main>
        ) : (
          <main tabIndex={-1}>Outra página</main>
        );
      }
      return (
        <>
          <Edicao rotulo="Nova admissão" />
          <Saida rotulo="Hub" pedido={{ executar: () => setSaiu(true) }} />
        </>
      );
    }
    for (const destino of ["hub", "main"] as const) {
      const registro = new RegistroDeEdicoes();
      const { unmount } = render(
        <ProvedorDeEdicoes registro={registro}>
          <ProvedorDeGuarda>
            <Shell destino={destino} />
          </ProvedorDeGuarda>
        </ProvedorDeEdicoes>,
      );
      const hub = screen.getByRole("button", { name: "Hub" });
      hub.focus();
      fireEvent.click(hub);
      fireEvent.click(
        within(dialogo()).getByRole("button", { name: "Sair sem salvar" }),
      );
      expect(document.activeElement).not.toBe(document.body);
      expect(screen.getByRole("main")).toHaveFocus();
      unmount();
    }
  });

  it("saída adiada (o navegador a conclui depois): o foco não volta a quem pediu — quem conclui decide", () => {
    const executar = vi.fn();
    montar(
      <>
        <Edicao rotulo="Ficha do colaborador" />
        <Saida rotulo="Voltar" pedido={{ executar, adiada: true }} />
      </>,
    );
    const botao = screen.getByRole("button", { name: "Voltar" });
    botao.focus();
    fireEvent.click(botao);
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(executar).toHaveBeenCalledTimes(1);
    expect(botao).not.toHaveFocus();

    // "Continuar editando" numa saída adiada devolve o foco normalmente.
    botao.focus();
    fireEvent.click(botao);
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Continuar editando" }),
    );
    expect(botao).toHaveFocus();
  });

  it("clique no fundo: o foco fica no diálogo, que continua aberto, e nada sai", () => {
    const executar = vi.fn();
    montar(
      <>
        <Edicao rotulo="Solicitações" />
        <Saida pedido={{ executar }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    const continuar = within(dialogo()).getByRole("button", {
      name: "Continuar editando",
    });
    expect(continuar).toHaveFocus();
    const fundo = document.querySelector<HTMLElement>(".guarda-saida__fundo")!;
    // `false`: o padrão do mousedown foi impedido — o navegador não leva o
    // foco para fora do diálogo (no navegador real, iria ao body).
    expect(fireEvent.mouseDown(fundo)).toBe(false);
    fireEvent.mouseUp(fundo);
    fireEvent.click(fundo);
    expect(continuar).toHaveFocus();
    expect(dialogo()).toBeInTheDocument();
    expect(executar).not.toHaveBeenCalled();
    // Tab e Escape continuam valendo.
    fireEvent.keyDown(continuar, { key: "Tab" });
    expect(
      within(dialogo()).getByRole("button", { name: "Sair sem salvar" }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(executar).not.toHaveBeenCalled();
  });

  it("um pedido aninhado durante a saída aceita passa direto (uma pergunta só por saída)", () => {
    const final = vi.fn();
    function Dupla() {
      const guarda = useGuardaDeSaida();
      return (
        <button
          type="button"
          onClick={() =>
            guarda.solicitarSaida({
              executar: () => guarda.solicitarSaida({ executar: final }),
            })
          }
        >
          Cancelar
        </button>
      );
    }
    montar(
      <>
        <Edicao rotulo="Nova admissão" />
        <Dupla />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(final).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("a frase que a tela declara (aviso) aparece no diálogo", () => {
    montar(
      <>
        <Edicao
          rotulo="Nova admissão"
          aviso="Um envio anterior da Nova admissão pode ter sido registrado: confira em Colaboradores."
        />
        <Saida pedido={{ executar: vi.fn() }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    expect(dialogo()).toHaveAccessibleDescription(
      /Saindo agora, elas serão descartadas\. Um envio anterior da Nova admissão pode ter sido registrado: confira em Colaboradores\.$/,
    );
  });
});

describe("T200 — guarda de saída: salvamento em andamento", () => {
  it("bloqueia: diz o motivo, não oferece descarte e não sai sozinha quando o salvamento termina", () => {
    const executar = vi.fn();
    function Gravando() {
      const [salvando, setSalvando] = useState(true);
      return (
        <>
          <Edicao rotulo="Ficha do colaborador" salvando={salvando} />
          <button type="button" onClick={() => setSalvando(false)}>
            Concluir gravação
          </button>
        </>
      );
    }
    montar(
      <>
        <Gravando />
        <Saida pedido={{ executar }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    const aguarde = screen.getByRole("alertdialog", {
      name: "Aguarde o salvamento terminar",
    });
    expect(aguarde).toHaveAccessibleDescription(
      /Há um salvamento em andamento em: Ficha do colaborador Não é possível sair enquanto ele não terminar\./,
    );
    expect(
      within(aguarde).queryByRole("button", { name: "Sair sem salvar" }),
    ).toBeNull();
    const entendi = within(aguarde).getByRole("button", { name: "Entendi" });
    expect(entendi).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(executar).not.toHaveBeenCalled();

    // O salvamento termina: ninguém navega sozinho.
    fireEvent.click(screen.getByRole("button", { name: "Concluir gravação" }));
    expect(executar).not.toHaveBeenCalled();
    // A próxima saída pergunta pelo que ainda não foi salvo (a edição segue
    // pendente), sem o bloqueio.
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    expect(dialogo()).toBeInTheDocument();
  });
});

describe("T200 — guarda de saída: áreas", () => {
  it("uma saída que desmonta só a ficha pergunta só pela ficha", () => {
    const executar = vi.fn();
    montar(
      <>
        <AreaDeEdicao id={AREAS_DE_EDICAO.jornadaDoDashboard}>
          <Edicao rotulo="Horário de trabalho" />
        </AreaDeEdicao>
        <AreaDeEdicao id={AREAS_DE_EDICAO.ficha}>
          <Edicao rotulo="Ficha do colaborador" />
        </AreaDeEdicao>
        <Saida
          rotulo="Colaboradores"
          pedido={{ area: AREAS_DE_EDICAO.ficha, executar }}
        />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Colaboradores" }));
    expect(
      within(dialogo())
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Ficha do colaborador"]);
  });

  it("sem edição dentro da área, sai direto mesmo com edição fora dela", () => {
    const executar = vi.fn();
    montar(
      <>
        <AreaDeEdicao id={AREAS_DE_EDICAO.painelPessoas}>
          <Edicao rotulo="Documentos" />
        </AreaDeEdicao>
        <Saida
          rotulo="Aba Desligados"
          pedido={{ area: AREAS_DE_EDICAO.jornadaDoDashboard, executar }}
        />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aba Desligados" }));
    expect(executar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("uma saída que desmonta duas áreas pergunta pelas duas — e só por elas", () => {
    const executar = vi.fn();
    montar(
      <>
        <AreaDeEdicao id={AREAS_DE_EDICAO.painelPessoas}>
          <Edicao rotulo="Documentos" />
          <AreaDeEdicao id={AREAS_DE_EDICAO.jornadaDoDashboard}>
            <Edicao rotulo="Horário de trabalho" />
          </AreaDeEdicao>
        </AreaDeEdicao>
        <AreaDeEdicao id={AREAS_DE_EDICAO.ficha}>
          <Edicao rotulo="Ficha do colaborador" pendente={false} />
        </AreaDeEdicao>
        <Saida
          rotulo="Ativos"
          pedido={{
            area: [AREAS_DE_EDICAO.ficha, AREAS_DE_EDICAO.jornadaDoDashboard],
            executar,
          }}
        />
        <Saida
          rotulo="Outra ficha"
          pedido={{
            area: [AREAS_DE_EDICAO.ficha, AREAS_DE_EDICAO.painelCadastros],
            executar,
          }}
        />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ativos" }));
    expect(
      within(dialogo())
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Horário de trabalho"]);
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Continuar editando" }),
    );
    // Nada pendente nas áreas pedidas: sai direto.
    fireEvent.click(screen.getByRole("button", { name: "Outra ficha" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it("áreas aninhadas: a edição de dentro conta para a de fora", () => {
    const executar = vi.fn();
    montar(
      <>
        <AreaDeEdicao id={AREAS_DE_EDICAO.painelPessoas}>
          <AreaDeEdicao id={AREAS_DE_EDICAO.jornadaDoDashboard}>
            <Edicao rotulo="Horário de trabalho" />
          </AreaDeEdicao>
        </AreaDeEdicao>
        <Saida
          rotulo="Aba Documentos"
          pedido={{ area: AREAS_DE_EDICAO.painelPessoas, executar }}
        />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aba Documentos" }));
    expect(dialogo()).toBeInTheDocument();
  });
});

describe("T200 — guarda de saída: outro aviso do shell", () => {
  it("suspensa (empresa trocada em outra aba): a pergunta aberta some sem sair, e nenhuma nova abre", () => {
    const executar = vi.fn();
    const { suspender } = montar(
      <>
        <Edicao rotulo="Ficha do colaborador" />
        <Saida pedido={{ executar }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    expect(dialogo()).toBeInTheDocument();
    suspender();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(executar).not.toHaveBeenCalled();
  });
});

describe("T200 — recarregar e fechar a aba: o aviso nativo, só com o que perder", () => {
  function disparar(): boolean {
    const evento = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(evento);
    return evento.defaultPrevented;
  }

  it("sem edição, nenhum aviso; com edição ou salvamento, avisa; ao salvar ou descartar, para", () => {
    function Controle() {
      const [estado, setEstado] = useState<"nada" | "pendente" | "salvando">(
        "nada",
      );
      return (
        <>
          <Edicao
            rotulo="Ficha do colaborador"
            pendente={estado === "pendente"}
            salvando={estado === "salvando"}
          />
          {(["nada", "pendente", "salvando"] as const).map((e) => (
            <button key={e} type="button" onClick={() => setEstado(e)}>
              {e}
            </button>
          ))}
        </>
      );
    }
    montar(<Controle />);
    expect(disparar()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "pendente" }));
    expect(disparar()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "salvando" }));
    expect(disparar()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "nada" }));
    expect(disparar()).toBe(false);
  });

  it("ao desmontar a tela (sessão encerrada, Hub, Sair), o aviso nativo sai junto", () => {
    function Alternar() {
      const [montada, setMontada] = useState(true);
      return (
        <>
          {montada ? <Edicao rotulo="Nova admissão" /> : null}
          <button type="button" onClick={() => setMontada(false)}>
            Desmontar
          </button>
        </>
      );
    }
    montar(<Alternar />);
    expect(disparar()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Desmontar" }));
    expect(disparar()).toBe(false);
  });
});

describe("T200 — duas abas: a edição fica nesta aba", () => {
  it("declarar edição e perguntar na guarda nunca usa o BroadcastChannel", () => {
    const criados: string[] = [];
    const enviados: unknown[] = [];
    class CanalEspiao {
      constructor(nome: string) {
        criados.push(nome);
      }
      postMessage(dado: unknown) {
        enviados.push(dado);
      }
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
    vi.stubGlobal("BroadcastChannel", CanalEspiao);
    montar(
      <>
        <Edicao rotulo="Ficha do colaborador" />
        <Saida pedido={{ executar: vi.fn() }} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ir para Ponto" }));
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(criados).toEqual([]);
    expect(enviados).toEqual([]);
  });
});

describe("T200 — contrato de CSS do diálogo (375 px)", () => {
  const css = readFileSync("src/app/guardaDeSaida.css", "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("só tokens: nenhuma cor literal", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });

  it("caixa que não alarga a página e ações em coluna no celular", () => {
    expect(css).toMatch(
      /\.guarda-saida__caixa \{[^}]*width: 100%;[^}]*max-width: 34rem;[^}]*min-width: 0;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 640px\) \{[\s\S]*\.guarda-saida__acoes \.evolli-button \{[^}]*width: 100%;/,
    );
    expect(css).toMatch(
      /\.guarda-saida__texto p \{[^}]*overflow-wrap: anywhere;/,
    );
  });
});
