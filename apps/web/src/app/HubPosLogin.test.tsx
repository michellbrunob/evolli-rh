/**
 * Hub pós-login (T162) e contexto empresarial ativo (T163).
 *
 * O que estes testes prendem, em uma frase cada:
 *
 * - **Capacidade** — o Hub oferece exatamente os produtos que o `rbac.evaluator`
 *   concede ao papel, e nenhum a mais. A tabela de referência aqui é escrita à
 *   mão de propósito: se alguém editar `CAPACIDADE_FUNCIONAL_POR_PAPEL` sem
 *   decisão, o teste reprova em vez de concordar com a edição.
 * - **Quem troca, e quem não troca** (T163) — o seletor só existe quando o
 *   SERVIDOR diz que o papel seleciona, e a lista de empresas nunca é pedida
 *   por quem não seleciona.
 * - **O navegador não é autoridade** (T163) — nada de `localStorage`,
 *   `sessionStorage`, query string ou cookie para escolher empresa. Há teste
 *   que varre o módulo atrás disso.
 * - **A troca não é otimista** — a tela só muda depois de o servidor
 *   confirmar, e quem avisa a troca é o componente de cima, que remonta tudo.
 * - **Fail-closed** — falha ao carregar ou ao trocar não esconde o problema e
 *   não monta nada funcional.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HubPosLogin } from "./HubPosLogin";
import {
  capacidadeFuncionalDe,
  DESTINOS,
  DESTINOS_DEMONSTRATIVOS,
  destinoInicialPara,
  DESTINO_SEM_CAPACIDADE,
} from "./mapaNavegacao";
import { readFileSync } from "node:fs";
import {
  listarEmpresasDoContexto,
  trocarEmpresaDoContexto,
} from "../api/contextoEmpresarialClient";

vi.mock("../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/contextoEmpresarialClient")
  >("../api/contextoEmpresarialClient");
  return {
    ...actual,
    listarEmpresasDoContexto: vi.fn(),
    trocarEmpresaDoContexto: vi.fn(),
  };
});

const EMAIL_SINTETICO = "pessoa.teste@example.test";

/** Duas empresas sintéticas distintas, como no E2E. */
const EMPRESA_B = {
  id: "22222222-2222-4222-8222-222222222222",
  codigo: "EMPB",
  nome: "Empresa B",
};
const EMPRESA_D = {
  id: "44444444-4444-4444-8444-444444444444",
  codigo: "EMPD",
  nome: "Empresa D",
};

interface Opcoes {
  readonly papel: string;
  readonly empresaAtiva?: { id: string; codigo: string; nome: string } | null;
  readonly podeTrocarEmpresa?: boolean;
  readonly onAbrirDestino?: (id: string) => void;
  readonly onEmpresaTrocada?: () => void;
  readonly onLogout?: () => void;
}

function montar({
  papel,
  empresaAtiva = EMPRESA_B,
  podeTrocarEmpresa = papel === "rh" || papel === "master_tecnico",
  onAbrirDestino = () => undefined,
  onEmpresaTrocada = () => undefined,
  onLogout = () => undefined,
}: Opcoes) {
  return render(
    <HubPosLogin
      papelDoAtor={papel}
      empresaAtiva={empresaAtiva}
      podeTrocarEmpresa={podeTrocarEmpresa}
      emailDoAtor={EMAIL_SINTETICO}
      onAbrirDestino={onAbrirDestino}
      onEmpresaTrocada={onEmpresaTrocada}
      onLogout={onLogout}
    />,
  );
}

/** Rótulos dos cartões de produto hoje na tela, na ordem em que aparecem. */
function cartoesVisiveis(): string[] {
  return screen
    .getAllByRole("button")
    .filter((b) => b.classList.contains("hub__cartao"))
    .map((b) => b.querySelector(".hub__cartao-titulo")?.textContent ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([EMPRESA_B, EMPRESA_D]);
  vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(EMPRESA_D);
});

describe("T162 — o Hub oferece só o que o servidor autoriza", () => {
  /**
   * Tabela de referência INDEPENDENTE da implementação — conferida em
   * `rbac.evaluator.ts`, recurso por recurso, contra a aba padrão de cada
   * destino. Ver o bloco de `capacidadeFuncionalDe`.
   */
  const ESPERADO: ReadonlyArray<readonly [string, readonly string[]]> = [
    [
      "rh",
      [
        "Colaboradores",
        "Nova admissão",
        "Estrutura organizacional",
        "Jornadas de trabalho",
        "Jornada",
        "Minha equipe",
        "Administração da liderança",
        "Contas de acesso",
      ],
    ],
    // T182 — o DP consulta as jornadas e, sem a aba Horários, a aba padrão
    // de Estrutura passou a ser a organizacional, que ele lê.
    [
      "dp",
      [
        "Colaboradores",
        "Nova admissão",
        "Estrutura organizacional",
        "Jornadas de trabalho",
        "Jornada",
        "Contas de acesso",
      ],
    ],
    [
      "master_tecnico",
      [
        "Colaboradores",
        "Estrutura organizacional",
        "Jornadas de trabalho",
        "Jornada",
        "Contas de acesso",
      ],
    ],
    ["gestor", ["Minha equipe"]],
    ["financeiro", []],
    ["colaborador", []],
    ["auditor", []],
    ["dpo", []],
    ["admin_tecnico", []],
  ];

  it.each(ESPERADO)(
    "%s vê exatamente os produtos que o RBAC concede",
    async (papel, esperado) => {
      montar({ papel });
      await waitFor(() => expect(cartoesVisiveis()).toEqual([...esperado]));
    },
  );

  it("papel sem capacidade funcional vê o aviso, e nenhum cartão", async () => {
    montar({ papel: "colaborador", podeTrocarEmpresa: false });
    expect(
      await screen.findByText(
        /Nenhum produto está liberado para o seu perfil/i,
      ),
    ).toBeInTheDocument();
    expect(cartoesVisiveis()).toEqual([]);
  });

  it("nenhum papel recebe cartão de destino demonstrativo", () => {
    const rotulosDemo = DESTINOS_DEMONSTRATIVOS.map((d) => d.label);
    for (const [papel] of ESPERADO) {
      const { unmount } = montar({ papel });
      for (const rotulo of cartoesVisiveis()) {
        expect(rotulosDemo).not.toContain(rotulo);
      }
      unmount();
    }
  });

  it("todo id da tabela de capacidade existe no mapa e é funcional", () => {
    for (const [papel] of ESPERADO) {
      for (const destino of capacidadeFuncionalDe(papel)) {
        expect(DESTINOS).toContain(destino);
        expect(destino.estado).toBe("funcional");
      }
    }
  });

  it("o destino inicial de cada papel está na capacidade dele, ou não chama nada", () => {
    // Guarda de coerência entre as duas tabelas: `destinoInicialPara` escolhe
    // onde o shell monta; `capacidadeFuncionalDe` escolhe o que o Hub oferece.
    // Divergir significaria aterrissar onde o Hub não oferece — ou, pior, num
    // destino que o papel não abre.
    for (const [papel] of ESPERADO) {
      const inicial = destinoInicialPara(papel);
      if (inicial === DESTINO_SEM_CAPACIDADE) continue;
      expect(capacidadeFuncionalDe(papel).map((d) => d.id)).toContain(inicial);
    }
  });

  it("o cartão abre o destino correspondente", async () => {
    const abrir = vi.fn();
    montar({ papel: "gestor", onAbrirDestino: abrir });
    fireEvent.click(screen.getByRole("button", { name: /Minha equipe/ }));
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith("equipe");
  });

  it("o bloco de Demonstração é nomeado como tal e não promete produto", async () => {
    montar({ papel: "rh" });
    expect(
      screen.getByRole("heading", { name: "Demonstração", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/não são produtos entregues/i)).toBeInTheDocument();
    // Nada de "em breve", "disponível em" ou promessa equivalente.
    expect(document.body.textContent ?? "").not.toMatch(
      /em breve|próximamente|proximamente/i,
    );
  });
});

describe("T163 — quem troca de empresa, e quem não troca", () => {
  it("rh vê o seletor, rotulado como Empresa, com as autorizadas", async () => {
    montar({ papel: "rh" });
    const seletor = await screen.findByLabelText("Empresa");
    expect(seletor.tagName).toBe("SELECT");
    await waitFor(() =>
      expect(
        [...(seletor as HTMLSelectElement).options].map((o) => o.textContent),
      ).toEqual(["Empresa B (EMPB)", "Empresa D (EMPD)"]),
    );
    expect((seletor as HTMLSelectElement).value).toBe(EMPRESA_B.id);
  });

  it.each(["dp", "gestor", "colaborador", "financeiro"])(
    "%s NÃO vê seletor e NÃO pede a lista de empresas",
    async (papel) => {
      montar({ papel, podeTrocarEmpresa: false });
      await screen.findByText(/Empresa B/);
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
    },
  );

  it("quem não troca vê a empresa como TEXTO, não como controle", async () => {
    montar({ papel: "dp", podeTrocarEmpresa: false });
    const valor = await screen.findByText(/Empresa B/);
    expect(valor.closest("button")).toBeNull();
    expect(valor.closest("select")).toBeNull();
    expect(valor.closest("a")).toBeNull();
  });

  it("sem empresa ativa e sem poder de troca, diz indisponível — não inventa nome", async () => {
    montar({ papel: "gestor", empresaAtiva: null, podeTrocarEmpresa: false });
    expect(
      await screen.findByText(/Não disponível para o seu perfil/i),
    ).toBeInTheDocument();
    expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
  });

  it("master_tecnico sem seleção mostra o escopo global como opção neutra", async () => {
    montar({ papel: "master_tecnico", empresaAtiva: null });
    const seletor = await screen.findByLabelText("Empresa");
    expect((seletor as HTMLSelectElement).value).toBe("");
    await waitFor(() =>
      expect(
        [...(seletor as HTMLSelectElement).options][0]!.textContent,
      ).toMatch(/Acesso global/i),
    );
  });
});

describe("T163 — a troca passa pelo servidor, e nada nela é otimista", () => {
  it("escolher outra empresa chama o servidor com o id certo", async () => {
    montar({ papel: "rh" });
    const seletor = await screen.findByLabelText("Empresa");
    await waitFor(() =>
      expect((seletor as HTMLSelectElement).options.length).toBe(2),
    );

    fireEvent.change(seletor, { target: { value: EMPRESA_D.id } });

    await waitFor(() =>
      expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(EMPRESA_D.id),
    );
  });

  it("só avisa a troca DEPOIS de o servidor confirmar", async () => {
    let confirmar!: (e: typeof EMPRESA_D) => void;
    vi.mocked(trocarEmpresaDoContexto).mockReturnValue(
      new Promise((r) => {
        confirmar = r;
      }),
    );
    const avisou = vi.fn();
    montar({ papel: "rh", onEmpresaTrocada: avisou });
    const seletor = await screen.findByLabelText("Empresa");
    await waitFor(() =>
      expect((seletor as HTMLSelectElement).options.length).toBe(2),
    );

    fireEvent.change(seletor, { target: { value: EMPRESA_D.id } });
    // Servidor ainda pensando: ninguém foi avisado, e o controle está inerte.
    await screen.findByText(/Trocando/i);
    expect(avisou).not.toHaveBeenCalled();
    expect(seletor).toBeDisabled();

    confirmar(EMPRESA_D);
    await waitFor(() => expect(avisou).toHaveBeenCalledTimes(1));
  });

  it("escolher a empresa que já está ativa não chama o servidor", async () => {
    montar({ papel: "rh" });
    const seletor = await screen.findByLabelText("Empresa");
    await waitFor(() =>
      expect((seletor as HTMLSelectElement).options.length).toBe(2),
    );
    fireEvent.change(seletor, { target: { value: EMPRESA_B.id } });
    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
  });

  it("troca recusada pelo servidor avisa, e NÃO finge que trocou", async () => {
    vi.mocked(trocarEmpresaDoContexto).mockRejectedValue(
      new Error("404 — empresa não autorizada"),
    );
    const avisou = vi.fn();
    montar({ papel: "rh", onEmpresaTrocada: avisou });
    const seletor = await screen.findByLabelText("Empresa");
    await waitFor(() =>
      expect((seletor as HTMLSelectElement).options.length).toBe(2),
    );

    fireEvent.change(seletor, { target: { value: EMPRESA_D.id } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível trocar de empresa/i,
    );
    expect(avisou).not.toHaveBeenCalled();
    // O corpo do erro do servidor nunca chega à tela.
    expect(document.body.textContent ?? "").not.toMatch(/404|autorizada/);
  });

  it("falha ao CARREGAR as opções oferece retry, e os produtos continuam", async () => {
    vi.mocked(listarEmpresasDoContexto).mockRejectedValueOnce(
      new Error("rede"),
    );
    montar({ papel: "rh" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível carregar as empresas/i,
    );
    expect(cartoesVisiveis().length).toBeGreaterThan(0);

    vi.mocked(listarEmpresasDoContexto).mockResolvedValue([
      EMPRESA_B,
      EMPRESA_D,
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByLabelText("Empresa")).toBeInTheDocument();
  });
});

describe("T163 — o navegador não é autoridade sobre a empresa", () => {
  /**
   * Varredura do PRÓPRIO módulo, não do comportamento em tempo de execução.
   *
   * Um teste de comportamento diria "não gravou em localStorage nesta
   * sequência de cliques"; este diz "o código não tem como gravar". É a
   * diferença entre não ter acontecido e não ser possível — e o requisito é
   * o segundo.
   */
  const FONTE = readFileSync("src/app/HubPosLogin.tsx", "utf8");
  const semComentarios = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
    /^\s*\/\/.*$/gm,
    "",
  );

  it.each([
    ["localStorage", /\blocalStorage\b/],
    ["sessionStorage", /\bsessionStorage\b/],
    ["document.cookie", /document\s*\.\s*cookie/],
    ["URLSearchParams", /\bURLSearchParams\b/],
    ["window.location", /\bwindow\s*\.\s*location\b/],
    ["history", /\bhistory\s*\.\s*(push|replace)State\b/],
  ])("o Hub não usa %s para escolher empresa", (_nome, padrao) => {
    expect(semComentarios).not.toMatch(padrao);
  });

  it("o Hub não lê mais `/v1/empresas` — a ressalva R-2 da T162", () => {
    // A leitura por montagem gerava um registro de auditoria por visita.
    // O nome da empresa ativa agora chega dentro de `/users/me`.
    expect(semComentarios).not.toMatch(/organizacaoClient/);
    expect(semComentarios).not.toMatch(/\blistarEmpresas\b/);
  });

  it("nenhum nome de empresa é escrito no código do Hub", () => {
    // A tela só exibe o que o servidor devolveu; empresa fictícia não existe.
    expect(semComentarios).not.toMatch(/Empresa\s+[A-Z]\b/);
  });
});

describe("T162 — acessibilidade e estrutura", () => {
  it("há exatamente um h1", async () => {
    montar({ papel: "rh" });
    await screen.findByLabelText("Empresa");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("cada cartão tem nome acessível com o rótulo do produto", async () => {
    montar({ papel: "rh" });
    await waitFor(() => expect(cartoesVisiveis().length).toBe(8));
    for (const destino of capacidadeFuncionalDe("rh")) {
      // T182 — "Jornada" também casa com "Jornadas de trabalho".
      expect(
        screen.getAllByRole("button", { name: new RegExp(destino.label) })
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it("T176 — o cartão Nova admissão diz o que faz, sem prometer dado novo", async () => {
    for (const papel of ["rh", "dp"]) {
      const { unmount } = montar({ papel });
      await waitFor(() => expect(cartoesVisiveis()).toContain("Nova admissão"));
      const cartao = screen
        .getAllByRole("button")
        .find(
          (b) =>
            b.querySelector(".hub__cartao-titulo")?.textContent ===
            "Nova admissão",
        )!;
      const descricao = cartao.querySelector(".hub__cartao-descricao");
      expect(descricao).not.toBeNull();
      expect(descricao).toHaveTextContent(
        "Admissão em página própria: cria o colaborador, o vínculo previsto e o ato de admissão na empresa ativa.",
      );
      unmount();
    }
  });

  it("o estado de carregamento das opções é anunciado", () => {
    vi.mocked(listarEmpresasDoContexto).mockReturnValue(
      new Promise(() => undefined),
    );
    montar({ papel: "rh" });
    expect(screen.getByRole("status")).toHaveTextContent(/Carregando/i);
  });

  it("o seletor é alcançável por teclado e tem nome acessível", async () => {
    montar({ papel: "rh" });
    const seletor = await screen.findByLabelText("Empresa");
    // `<select>` nativo: foco, teclado e leitor de tela vêm do navegador.
    expect(seletor).not.toHaveAttribute("tabindex", "-1");
    expect(seletor).toBeEnabled();
    (seletor as HTMLSelectElement).focus();
    expect(document.activeElement).toBe(seletor);
  });

  it("Sair chama o encerramento da sessão", async () => {
    const sair = vi.fn();
    montar({ papel: "rh", onLogout: sair });
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(sair).toHaveBeenCalledTimes(1);
  });
});
