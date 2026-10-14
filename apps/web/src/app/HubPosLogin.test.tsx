/**
 * Hub pós-login (T162).
 *
 * O que estes testes prendem, em uma frase cada:
 *
 * - **Capacidade** — o Hub oferece exatamente os produtos que o `rbac.evaluator`
 *   concede ao papel, e nenhum a mais. A tabela de referência aqui é escrita à
 *   mão de propósito: se alguém editar `CAPACIDADE_FUNCIONAL_POR_PAPEL` sem
 *   decisão, o teste reprova em vez de concordar com a edição.
 * - **Escopo** — nenhum nome de empresa fora da sessão chega à tela, e nenhuma
 *   requisição de empresa sai para quem o servidor recusaria.
 * - **Ausência de seletor** — não existe contrato de troca de empresa, então
 *   não pode existir controle que a prometa.
 * - **Fail-closed** — falha na leitura do contexto não esconde o problema nem
 *   monta nada funcional.
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
import { listarEmpresas } from "../api/organizacaoClient";

vi.mock("../api/organizacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/organizacaoClient")
  >("../api/organizacaoClient");
  return { ...actual, listarEmpresas: vi.fn() };
});

const EMPRESA_DA_SESSAO = "11111111-1111-4111-8111-111111111111";
const OUTRA_EMPRESA = "22222222-2222-4222-8222-222222222222";
const EMAIL_SINTETICO = "pessoa.teste@example.test";

function paginaCom(id: string, nome: string, codigo: string) {
  return {
    itens: [{ id, nome, codigo, status: "ativa" }],
    pagina: 1,
    tamanhoPagina: 1,
    total: 1,
  };
}

interface Opcoes {
  readonly papel: string;
  readonly empresa?: string | null;
  readonly onAbrirDestino?: (id: string) => void;
  readonly onLogout?: () => void;
}

function montar({
  papel,
  empresa = EMPRESA_DA_SESSAO,
  onAbrirDestino = () => undefined,
  onLogout = () => undefined,
}: Opcoes) {
  return render(
    <HubPosLogin
      papelDoAtor={papel}
      empresaDoAtor={empresa}
      emailDoAtor={EMAIL_SINTETICO}
      onAbrirDestino={onAbrirDestino}
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
  vi.mocked(listarEmpresas).mockResolvedValue(
    paginaCom(EMPRESA_DA_SESSAO, "Empresa Sintética", "EMP-001") as never,
  );
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
        "Pessoas",
        "Estrutura",
        "Jornada",
        "Minha equipe",
        "Administração da liderança",
        "Contas de acesso",
      ],
    ],
    ["dp", ["Pessoas", "Jornada", "Contas de acesso"]],
    ["master_tecnico", ["Pessoas", "Estrutura", "Jornada", "Contas de acesso"]],
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
    montar({ papel: "colaborador", empresa: EMPRESA_DA_SESSAO });
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

describe("T162 — empresa é contexto, nunca seletor", () => {
  it("rh vê o nome da própria empresa, lido do servidor", async () => {
    montar({ papel: "rh" });
    expect(await screen.findByText(/Empresa Sintética/)).toBeInTheDocument();
    expect(screen.getByText("(EMP-001)")).toBeInTheDocument();
  });

  it("dp também lê a empresa — o RBAC concede `empresa:read` a ele", async () => {
    montar({ papel: "dp" });
    expect(await screen.findByText(/Empresa Sintética/)).toBeInTheDocument();
  });

  it("master_tecnico não tem empresa: diz escopo global e NÃO consulta /empresas", async () => {
    montar({ papel: "master_tecnico", empresa: null });
    expect(await screen.findByText(/Acesso global/i)).toBeInTheDocument();
    expect(listarEmpresas).not.toHaveBeenCalled();
  });

  it("gestor não tem `empresa:read`: nenhuma requisição sai, e nenhum nome é inventado", async () => {
    montar({ papel: "gestor" });
    expect(
      await screen.findByText(/Não disponível para o seu perfil/i),
    ).toBeInTheDocument();
    expect(listarEmpresas).not.toHaveBeenCalled();
  });

  it("financeiro não tem `empresa:read`: nenhuma requisição sai", async () => {
    montar({ papel: "financeiro" });
    await screen.findByText(/Não disponível para o seu perfil/i);
    expect(listarEmpresas).not.toHaveBeenCalled();
  });

  it("empresa devolvida fora da sessão NÃO é exibida", async () => {
    // O servidor já restringe o escopo (`filtroDeEscopo`). Esta é a segunda
    // tranca: se algo fora do escopo chegasse, some em vez de aparecer.
    vi.mocked(listarEmpresas).mockResolvedValue(
      paginaCom(OUTRA_EMPRESA, "Empresa De Terceiro", "EMP-999") as never,
    );
    montar({ papel: "rh" });
    await screen.findByText(/Não disponível para o seu perfil/i);
    expect(screen.queryByText(/Empresa De Terceiro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/EMP-999/)).not.toBeInTheDocument();
  });

  it("não existe seletor, menu ou qualquer controle de troca de empresa", async () => {
    montar({ papel: "rh" });
    await screen.findByText(/Empresa Sintética/);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    for (const botao of screen.getAllByRole("button")) {
      expect(botao.textContent ?? "").not.toMatch(
        /trocar|alternar|mudar empresa/i,
      );
    }
    // A empresa é texto dentro de uma `<dd>`, não um controle.
    const valor = screen.getByText(/Empresa Sintética/);
    expect(valor.closest("button")).toBeNull();
    expect(valor.closest("a")).toBeNull();
  });

  it("falha na leitura: diz que não carregou, oferece retry e não mostra nome nenhum", async () => {
    vi.mocked(listarEmpresas).mockRejectedValueOnce(new Error("rede"));
    montar({ papel: "rh" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível carregar/i,
    );
    expect(screen.queryByText(/Empresa Sintética/)).not.toBeInTheDocument();
    // Os produtos continuam listados: eles dependem do papel, não desta leitura.
    expect(cartoesVisiveis().length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText(/Empresa Sintética/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o corpo interno do erro nunca chega à tela", async () => {
    vi.mocked(listarEmpresas).mockRejectedValueOnce(
      new Error("PrismaClientKnownRequestError: P2002 em empresa.codigo"),
    );
    montar({ papel: "rh" });
    await screen.findByRole("alert");
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/Prisma|P2002|codigo/i);
  });
});

describe("T162 — acessibilidade e estrutura", () => {
  it("há exatamente um h1", async () => {
    montar({ papel: "rh" });
    await screen.findByText(/Empresa Sintética/);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("cada cartão tem nome acessível com o rótulo do produto", async () => {
    montar({ papel: "rh" });
    await waitFor(() => expect(cartoesVisiveis().length).toBe(6));
    for (const destino of capacidadeFuncionalDe("rh")) {
      expect(
        screen.getByRole("button", { name: new RegExp(destino.label) }),
      ).toBeInTheDocument();
    }
  });

  it("o estado de carregamento do contexto é anunciado", () => {
    vi.mocked(listarEmpresas).mockReturnValue(
      new Promise(() => undefined) as never,
    );
    montar({ papel: "rh" });
    expect(screen.getByRole("status")).toHaveTextContent(/Carregando/i);
  });

  it("Sair chama o encerramento da sessão", async () => {
    const sair = vi.fn();
    montar({ papel: "rh", onLogout: sair });
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(sair).toHaveBeenCalledTimes(1);
  });
});
