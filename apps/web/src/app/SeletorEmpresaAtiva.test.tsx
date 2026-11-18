/**
 * T189 — `SeletorEmpresaAtiva`: o componente único de empresa ativa, do menu
 * lateral e do Hub. Dados 100% sintéticos.
 */
import { readFileSync } from "node:fs";
import {
  act,
  fireEvent,
  within,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContextoApiError,
  listarEmpresasDoContexto,
  trocarEmpresaDoContexto,
} from "../api/contextoEmpresarialClient";
import {
  ProvedorDeEdicoes,
  RegistroDeEdicoes,
  useEdicaoEmAndamento,
} from "./edicoesPendentes";
import {
  ProvedorDeEmpresasDoContexto,
  SeletorEmpresaAtiva,
  type SeletorEmpresaAtivaProps,
} from "./SeletorEmpresaAtiva";

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

const ALFA = {
  id: "empresa-sintetica-alfa",
  codigo: "ALFA",
  nome: "Empresa Alfa",
};
const BETA = {
  id: "empresa-sintetica-beta",
  codigo: "BETA",
  nome: "Empresa Beta",
};
const GAMA = {
  id: "empresa-sintetica-gama",
  codigo: "GAMA",
  nome: "Empresa Sintetica Gama com Nome Muito Longo Para Quebrar Linha",
};

function adiado<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

function EdicaoDeTeste({
  rotulo = "Formulário de teste",
  pendente = false,
  salvando = false,
}: {
  rotulo?: string;
  pendente?: boolean;
  salvando?: boolean;
}) {
  useEdicaoEmAndamento(rotulo, { pendente, salvando });
  return null;
}

interface Montagem extends Partial<SeletorEmpresaAtivaProps> {
  readonly edicao?: { pendente?: boolean; salvando?: boolean };
}

function montar({ edicao, ...props }: Montagem = {}) {
  const registro = new RegistroDeEdicoes();
  const onEmpresaTrocada = props.onEmpresaTrocada ?? vi.fn();
  const arvore = (e: Montagem["edicao"]) => (
    <ProvedorDeEdicoes registro={registro}>
      {e ? <EdicaoDeTeste {...e} /> : null}
      <SeletorEmpresaAtiva
        id="teste-empresa"
        variante="menu"
        empresaAtiva={ALFA}
        podeTrocarEmpresa
        papelDoAtor="rh"
        {...props}
        onEmpresaTrocada={onEmpresaTrocada}
      />
    </ProvedorDeEdicoes>
  );
  const resultado = render(arvore(edicao));
  return {
    ...resultado,
    onEmpresaTrocada,
    reeditar: (e: Montagem["edicao"]) => resultado.rerender(arvore(e)),
  };
}

const botaoDaEmpresa = () =>
  screen.getByRole("button", { name: /Empresa ativa/ });
const opcao = (nome: string) =>
  screen.getByRole("button", { name: new RegExp(`^${nome}`) });

async function abrirLista() {
  const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
  fireEvent.click(botao);
  await screen.findByRole("list", { name: "Empresas da conta" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA, BETA]);
  vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(BETA);
});

describe("T189 — o que o seletor mostra", () => {
  it("fechado: nome e código interno da empresa ativa, com indicador de expansão", async () => {
    montar();
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveTextContent("Empresa Alfa");
    expect(botao).toHaveTextContent("Código ALFA");
    expect(botao.querySelector("svg.seletor-empresa__seta")).not.toBeNull();
    // Sem CNPJ nem identificador fiscal: só o que o contrato traz.
    expect(document.body.textContent).not.toMatch(/CNPJ|CPF/);
  });

  it.each([
    "dp",
    "gestor",
    "colaborador",
    "financeiro",
    "auditor",
    "dpo",
    "admin_tecnico",
  ])("%s vê a empresa só para leitura e não pede a lista", (papel) => {
    montar({ podeTrocarEmpresa: false, papelDoAtor: papel });
    expect(screen.getByText("Empresa Alfa")).toBeInTheDocument();
    expect(screen.getByText("Código ALFA")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
  });

  it("sem empresa e sem poder de troca, diz indisponível — não inventa nome", () => {
    montar({
      podeTrocarEmpresa: false,
      empresaAtiva: null,
      papelDoAtor: "admin_tecnico",
    });
    expect(
      screen.getByText("Não disponível para o seu perfil"),
    ).toBeInTheDocument();
    expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
  });

  it("master_tecnico sem empresa ativa: “Acesso global — todas as empresas”, e nenhuma marcada como atual", async () => {
    montar({ empresaAtiva: null, papelDoAtor: "master_tecnico" });
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    expect(botao).toHaveTextContent("Acesso global — todas as empresas");
    await abrirLista();
    expect(
      screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-current") === "true"),
    ).toHaveLength(0);
  });

  it("master_tecnico com empresa ativa é avisado de que o global volta com novo login", async () => {
    montar({ papelDoAtor: "master_tecnico" });
    await abrirLista();
    expect(
      screen.getByText(
        /acesso global a todas as empresas volta com um novo login/,
      ),
    ).toBeInTheDocument();
  });

  it("empresa única: só leitura, sem seta e sem lista — uma única leitura", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA]);
    const { container } = montar();
    await waitFor(() =>
      expect(screen.queryByText("Carregando empresas…")).toBeNull(),
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector(".seletor-empresa__seta")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(listarEmpresasDoContexto).toHaveBeenCalledTimes(1);
  });

  it("carregando: anuncia, e ainda não oferece seta (não se sabe se há para onde ir)", () => {
    vi.mocked(listarEmpresasDoContexto).mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando empresas…",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Empresa Alfa")).toBeInTheDocument();
  });

  it("falha ao carregar: alerta e “Tentar novamente” relê a lista", async () => {
    vi.mocked(listarEmpresasDoContexto)
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce([ALFA, BETA]);
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as empresas.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByRole("button", { name: /Empresa ativa/ }),
    ).toBeInTheDocument();
    expect(listarEmpresasDoContexto).toHaveBeenCalledTimes(2);
  });

  it("com provedor, Hub e menu compartilham UMA leitura da lista", async () => {
    render(
      <ProvedorDeEmpresasDoContexto podeTrocarEmpresa>
        <SeletorEmpresaAtiva
          id="a"
          variante="hub"
          empresaAtiva={ALFA}
          podeTrocarEmpresa
          papelDoAtor="rh"
          onEmpresaTrocada={() => undefined}
        />
        <SeletorEmpresaAtiva
          id="b"
          variante="menu"
          empresaAtiva={ALFA}
          podeTrocarEmpresa
          papelDoAtor="rh"
          onEmpresaTrocada={() => undefined}
        />
      </ProvedorDeEmpresasDoContexto>,
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Empresa ativa/ }),
      ).toHaveLength(2),
    );
    expect(listarEmpresasDoContexto).toHaveBeenCalledTimes(1);
  });
});

describe("T189 — aberto: lista, atual marcada, teclado", () => {
  it("abre com a empresa atual marcada por texto e por aria-current, e o foco nela", async () => {
    montar();
    await abrirLista();
    expect(botaoDaEmpresa()).toHaveAttribute("aria-expanded", "true");
    const atual = opcao("Empresa Alfa");
    expect(atual).toHaveAttribute("aria-current", "true");
    expect(atual).toHaveTextContent("Atual");
    expect(opcao("Empresa Beta")).not.toHaveAttribute("aria-current");
    expect(document.activeElement).toBe(atual);
    expect(
      document.getElementById(botaoDaEmpresa().getAttribute("aria-controls")!),
    ).not.toHaveAttribute("hidden");
  });

  it("Esc fecha e devolve o foco ao botão", async () => {
    montar();
    await abrirLista();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(botaoDaEmpresa()).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(botaoDaEmpresa());
  });

  it("o Esc do painel não chega à gaveta do shell (que ouve no document)", async () => {
    const gaveta = vi.fn();
    document.addEventListener("keydown", gaveta, true);
    try {
      montar();
      await abrirLista();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(gaveta).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", gaveta, true);
    }
  });

  it("seta para baixo no botão abre; setas, Home e End percorrem as opções", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA, BETA, GAMA]);
    montar();
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    botao.focus();
    fireEvent.keyDown(botao, { key: "ArrowDown" });
    await screen.findByRole("list", { name: "Empresas da conta" });
    expect(document.activeElement).toBe(opcao("Empresa Alfa"));
    const lista = screen.getByRole("list", { name: "Empresas da conta" });
    fireEvent.keyDown(lista, { key: "ArrowDown" });
    expect(document.activeElement).toBe(opcao("Empresa Beta"));
    fireEvent.keyDown(lista, { key: "End" });
    expect(document.activeElement).toBe(opcao(GAMA.nome));
    fireEvent.keyDown(lista, { key: "ArrowDown" });
    expect(document.activeElement).toBe(opcao("Empresa Alfa"));
    fireEvent.keyDown(lista, { key: "ArrowUp" });
    expect(document.activeElement).toBe(opcao(GAMA.nome));
    fireEvent.keyDown(lista, { key: "Home" });
    expect(document.activeElement).toBe(opcao("Empresa Alfa"));
  });

  it("clique fora fecha sem roubar o foco", async () => {
    montar();
    await abrirLista();
    fireEvent.pointerDown(document.body);
    expect(botaoDaEmpresa()).toHaveAttribute("aria-expanded", "false");
  });

  it("escolher a empresa que já está ativa não chama o servidor", async () => {
    montar();
    await abrirLista();
    fireEvent.click(opcao("Empresa Alfa"));
    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
    expect(botaoDaEmpresa()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("T189 — a troca passa pelo servidor, e nada nela é otimista", () => {
  it("troca em andamento: anuncia, trava as opções e só avisa depois da confirmação", async () => {
    const d = adiado<typeof BETA>();
    vi.mocked(trocarEmpresaDoContexto).mockReturnValue(d.promessa);
    const { onEmpresaTrocada } = montar();
    await abrirLista();
    fireEvent.click(opcao("Empresa Beta"));

    expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(BETA.id);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Trocando para Empresa Beta…",
    );
    expect(opcao("Empresa Beta")).toBeDisabled();
    // A tela ainda diz a empresa de antes: o servidor não confirmou.
    expect(botaoDaEmpresa()).toHaveTextContent("Empresa Alfa");
    expect(onEmpresaTrocada).not.toHaveBeenCalled();

    await act(async () => d.resolver(BETA));
    expect(onEmpresaTrocada).toHaveBeenCalledWith(BETA);
  });

  it("troca recusada: alerta, continua na empresa atual e não avisa ninguém", async () => {
    vi.mocked(trocarEmpresaDoContexto).mockRejectedValue(
      new ContextoApiError(500, "falha"),
    );
    const { onEmpresaTrocada } = montar();
    await abrirLista();
    fireEvent.click(opcao("Empresa Beta"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível trocar de empresa",
    );
    expect(botaoDaEmpresa()).toHaveTextContent("Empresa Alfa");
    expect(onEmpresaTrocada).not.toHaveBeenCalled();
  });

  it("empresa indisponível (404): avisa e relê a lista", async () => {
    vi.mocked(trocarEmpresaDoContexto).mockRejectedValue(
      new ContextoApiError(404, "não encontrada"),
    );
    vi.mocked(listarEmpresasDoContexto)
      .mockResolvedValueOnce([ALFA, BETA])
      .mockResolvedValueOnce([ALFA]);
    const { onEmpresaTrocada } = montar();
    await abrirLista();
    fireEvent.click(opcao("Empresa Beta"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "não está mais disponível para a sua conta",
    );
    await waitFor(() =>
      expect(listarEmpresasDoContexto).toHaveBeenCalledTimes(2),
    );
    // Sobrou só a atual: volta a ser só leitura, e o aviso continua à vista.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Empresa ativa/ }),
      ).toBeNull(),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onEmpresaTrocada).not.toHaveBeenCalled();
  });
});

describe("T189 — edição pendente e salvamento em andamento", () => {
  it("com edição pendente, pede confirmação; cancelar não troca e devolve o foco", async () => {
    const { onEmpresaTrocada } = montar({ edicao: { pendente: true } });
    await abrirLista();
    fireEvent.click(opcao("Empresa Beta"));

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent(
      "Há edição em andamento em: Formulário de teste.",
    );
    expect(alerta).toHaveTextContent(
      "Trocar para Empresa Beta descarta o que não foi salvo.",
    );
    // O foco vai para a escolha que NÃO descarta nada.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Continuar editando" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
    expect(onEmpresaTrocada).not.toHaveBeenCalled();
    expect(botaoDaEmpresa()).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(botaoDaEmpresa());
  });

  it("confirmar troca de verdade", async () => {
    const { onEmpresaTrocada } = montar({ edicao: { pendente: true } });
    await abrirLista();
    fireEvent.click(opcao("Empresa Beta"));
    fireEvent.click(screen.getByRole("button", { name: "Trocar e descartar" }));
    await waitFor(() => expect(onEmpresaTrocada).toHaveBeenCalledWith(BETA));
    expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(BETA.id);
  });

  it("sem edição pendente, troca direto, sem confirmação", async () => {
    const { onEmpresaTrocada } = montar({ edicao: { pendente: false } });
    await abrirLista();
    fireEvent.click(opcao("Empresa Beta"));
    expect(
      screen.queryByRole("button", { name: "Trocar e descartar" }),
    ).toBeNull();
    await waitFor(() => expect(onEmpresaTrocada).toHaveBeenCalledWith(BETA));
  });

  it("salvamento em andamento bloqueia a troca até terminar", async () => {
    const { reeditar } = montar({ edicao: { salvando: true } });
    await abrirLista();
    expect(opcao("Empresa Beta")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "há um salvamento em andamento (Formulário de teste)",
    );
    fireEvent.click(opcao("Empresa Beta"));
    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();

    reeditar({ salvando: false });
    expect(opcao("Empresa Beta")).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("a edição que desmonta sai do registro", () => {
    const registro = new RegistroDeEdicoes();
    const { unmount } = render(
      <ProvedorDeEdicoes registro={registro}>
        <EdicaoDeTeste rotulo="A" pendente />
        <EdicaoDeTeste rotulo="A" pendente />
        <EdicaoDeTeste rotulo="B" salvando />
      </ProvedorDeEdicoes>,
    );
    expect(registro.obter()).toEqual({ pendentes: ["A"], salvando: ["B"] });
    unmount();
    expect(registro.obter()).toEqual({ pendentes: [], salvando: [] });
  });
});

describe("T189 — o navegador não é autoridade, e o visual é do Evolli", () => {
  const semComentarios = (caminho: string) =>
    readFileSync(caminho, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it.each([
    "src/app/SeletorEmpresaAtiva.tsx",
    "src/app/edicoesPendentes.tsx",
    "src/app/sincronizacaoDeContexto.ts",
    "src/app/AvisoContextoAlterado.tsx",
    "src/app/AutenticacaoApp.tsx",
  ])("%s não usa storage, cookie nem URL para a empresa", (caminho) => {
    const fonte = semComentarios(caminho);
    expect(fonte).not.toMatch(/\blocalStorage\b/);
    expect(fonte).not.toMatch(/\bsessionStorage\b/);
    expect(fonte).not.toMatch(/document\s*\.\s*cookie/);
    expect(fonte).not.toMatch(/\bURLSearchParams\b/);
  });

  it("nenhum nome de empresa nem dado de pessoa escrito no componente", () => {
    const fonte = semComentarios("src/app/SeletorEmpresaAtiva.tsx");
    expect(fonte).not.toMatch(/Empresa\s+[A-Z]\b/);
    // T209 — o CNPJ da empresa passou a ser exibido (decisão de 2026-11-17).
    expect(fonte).not.toMatch(/CPF/);
  });

  it("CSS: só tokens, alvo de 44 px, nomes quebram linha, nada empurra a página", () => {
    const css = readFileSync("src/app/SeletorEmpresaAtiva.css", "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const bloco = (seletor: string) => {
      const m = new RegExp(
        `${seletor.replace(/[.[\]"=]/g, "\\$&")} \\{([^}]*)\\}`,
      ).exec(css);
      return m?.[1] ?? "";
    };
    expect(bloco(".seletor-empresa__cartao")).toMatch(
      /min-height: var\(--touch-target\)/,
    );
    expect(bloco(".seletor-empresa__cartao")).toMatch(/position: relative/);
    expect(bloco(".seletor-empresa__cartao")).toMatch(/min-width: 0/);
    expect(bloco(".seletor-empresa__opcao")).toMatch(
      /min-height: var\(--touch-target\)/,
    );
    expect(bloco(".seletor-empresa__nome")).toMatch(/overflow-wrap: anywhere/);
    expect(bloco(".seletor-empresa__opcao-nome")).toMatch(
      /overflow-wrap: anywhere/,
    );
    // T209 — o painel base abre no fluxo (Hub e gaveta do celular); só no
    // menu do desktop ele flutua (ver o teste da T209 abaixo).
    expect(bloco(".seletor-empresa__painel")).not.toMatch(
      /position: (absolute|fixed)/,
    );
  });

  it("T209 — no menu do desktop o painel flutua junto ao cartão, fora do recorte da lateral", () => {
    const css = readFileSync("src/app/SeletorEmpresaAtiva.css", "utf8");
    const desktop = /@media \(min-width: 641px\) \{([\s\S]*?)\n\}/.exec(
      css,
    )?.[1];
    expect(desktop).toBeDefined();
    const regra =
      /\.seletor-empresa--menu \.seletor-empresa__painel \{([^}]*)\}/.exec(
        desktop!,
      )?.[1];
    expect(regra).toMatch(/position: fixed/);
    expect(regra).toMatch(/top: var\(--seletor-empresa-topo\)/);
    expect(regra).toMatch(/left: var\(--seletor-empresa-esquerda\)/);
    expect(regra).toMatch(/width: min\(20\.75rem, calc\(100vw - 2rem\)\)/);
  });
});

describe("T207 — lista Empresas da conta e busca (E-1, E-3)", () => {
  /** `n` empresas sintéticas, com a ALFA (a ativa) entre elas. */
  function empresas(n: number) {
    return [
      ALFA,
      ...Array.from({ length: n - 1 }, (_, i) => ({
        id: `empresa-sintetica-${i + 2}`,
        codigo: `E${String(i + 2).padStart(2, "0")}`,
        nome: `Empresa Sintetica ${String(i + 2).padStart(2, "0")}`,
      })),
    ];
  }

  it("cada empresa com iniciais (decorativas), nome e código; a atual marcada por texto e aria-current", async () => {
    montar();
    await abrirLista();
    const lista = screen.getByRole("list", { name: "Empresas da conta" });
    const itens = within(lista).getAllByRole("button");
    expect(itens).toHaveLength(2);
    const monograma = itens[0]!.querySelector(".seletor-empresa__monograma")!;
    expect(monograma).toHaveAttribute("aria-hidden", "true");
    expect(monograma).toHaveTextContent("EA");
    expect(opcao("Empresa Alfa")).toHaveAttribute("aria-current", "true");
    expect(opcao("Empresa Alfa")).toHaveTextContent("Atual");
    expect(opcao("Empresa Beta")).not.toHaveAttribute("aria-current");
  });

  it("até 8 empresas: sem busca, e o foco vai à empresa atual", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue(empresas(8));
    montar();
    await abrirLista();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(opcao("Empresa Alfa")).toHaveFocus();
  });

  it("mais de 8: busca rotulada recebe o foco, filtra nome e código, anuncia a contagem", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue(empresas(9));
    montar();
    await abrirLista();
    const busca = screen.getByRole("searchbox", {
      name: "Buscar empresa por nome ou código",
    });
    expect(busca).toHaveFocus();
    const lista = screen.getByRole("list", { name: "Empresas da conta" });
    expect(within(lista).getAllByRole("button")).toHaveLength(9);

    fireEvent.change(busca, { target: { value: "sintetica 0" } });
    expect(within(lista).getAllByRole("button")).toHaveLength(8);
    expect(screen.getByText("8 empresas encontradas.")).toBeInTheDocument();

    fireEvent.change(busca, { target: { value: "e05" } });
    expect(
      within(lista)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["ESEmpresa Sintetica 05Código E05"]);
    expect(screen.getByText("1 empresa encontrada.")).toBeInTheDocument();

    fireEvent.change(busca, { target: { value: "nada disso" } });
    expect(within(lista).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("Nenhuma empresa encontrada.")).toBeInTheDocument();
  });

  it("da busca, seta para baixo vai à lista; Esc fecha, limpa a busca e devolve o foco ao botão", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue(empresas(10));
    montar();
    await abrirLista();
    const busca = screen.getByRole("searchbox");
    fireEvent.change(busca, { target: { value: "sintetica" } });
    fireEvent.keyDown(busca, { key: "ArrowDown" });
    expect(opcao("Empresa Sintetica 02")).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(botaoDaEmpresa()).toHaveFocus();
    expect(botaoDaEmpresa()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(botaoDaEmpresa());
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("sem as ações do shell, nenhum 'Adicionar' nem 'Gerenciar' aparece (T209: só com tela e permissão)", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue(empresas(10));
    montar({ papelDoAtor: "master_tecnico" });
    await abrirLista();
    expect(
      screen.queryByRole("button", {
        name: /adicionar|gerenciar|nova empresa/i,
      }),
    ).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.queryByText(/adicionar empresa|gerenciar empresas/i),
    ).toBeNull();
  });

  it("CSS: busca e opções com alvo de 44 px, foco visível e a paleta Evolli no monograma", () => {
    const css = readFileSync("src/app/SeletorEmpresaAtiva.css", "utf8");
    /** Todas as regras com exatamente este seletor, juntas. */
    const regra = (seletor: string) => {
      const blocos: string[] = [];
      let inicio = css.indexOf(`\n${seletor} {`);
      while (inicio >= 0) {
        blocos.push(css.slice(inicio, css.indexOf("}", inicio)));
        inicio = css.indexOf(`\n${seletor} {`, inicio + 1);
      }
      expect(blocos.length).toBeGreaterThan(0);
      return blocos.join("\n");
    };
    expect(regra(".seletor-empresa__busca-campo")).toContain(
      "min-height: var(--touch-target)",
    );
    expect(regra(".seletor-empresa__opcao")).toContain(
      "min-height: var(--touch-target)",
    );
    // T209 — monograma em superfície azul suave com letras azuis.
    expect(regra(".seletor-empresa__monograma")).toContain(
      "background: var(--evolli-azul-suave)",
    );
    expect(css).toMatch(
      /\.seletor-empresa__opcao:focus-visible[\s\S]*?outline: var\(--focus-width\) solid var\(--evolli-azul\)/,
    );
  });

  it("T209 — a atual tem o círculo com visto à direita (texto 'Atual' só para leitor de tela); o nome só quebra entre palavras", () => {
    const css = readFileSync("src/app/SeletorEmpresaAtiva.css", "utf8");
    const regra = (seletor: string) => {
      const blocos: string[] = [];
      let inicio = css.indexOf(`\n${seletor} {`);
      while (inicio >= 0) {
        blocos.push(css.slice(inicio, css.indexOf("}", inicio)));
        inicio = css.indexOf(`\n${seletor} {`, inicio + 1);
      }
      expect(blocos.length, seletor).toBeGreaterThan(0);
      return blocos.join("\n");
    };
    // Três colunas: monograma, textos e o visto à direita.
    expect(regra(".seletor-empresa__opcao")).toMatch(
      /grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/,
    );
    expect(regra(".seletor-empresa__atual")).toMatch(/grid-column:\s*3;/);
    expect(regra(".seletor-empresa__atual")).toMatch(/border-radius: 50%/);
    // A regra que vale é a última do arquivo para o nome: só entre palavras.
    const ultima = [
      ...css.matchAll(/\n\.seletor-empresa__opcao-nome \{([^}]*)\}/g),
    ].at(-1)![1]!;
    expect(ultima).toMatch(/overflow-wrap:\s*break-word/);
    expect(ultima).not.toMatch(/word-break:\s*break-all/);
  });

  it("no DOM, o selo 'Atual' vem depois do nome e do código, dentro da opção atual", async () => {
    montar();
    await abrirLista();
    const marcada = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-current") === "true")!;
    const textos = marcada.querySelector(".seletor-empresa__opcao-textos")!;
    const selo = marcada.querySelector(".seletor-empresa__atual")!;
    expect(selo).toHaveTextContent("Atual");
    expect(
      textos.compareDocumentPosition(selo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("T209 — cartão e lista como no novo desenho", () => {
  it("o rótulo 'Empresa ativa' fica só no nome acessível; à vista, nome e código", async () => {
    montar();
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    expect(botao.querySelector(".seletor-empresa__rotulo")).toHaveClass(
      "seletor-empresa__oculto",
    );
  });

  it("a seta é a dupla (abre para cima e para baixo) e não gira", async () => {
    montar();
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    expect(botao.querySelector(".seletor-empresa__seta path")).toHaveAttribute(
      "d",
      "M5 6.5l3-3 3 3M5 9.5l3 3 3-3",
    );
    const css = readFileSync("src/app/SeletorEmpresaAtiva.css", "utf8");
    expect(css).not.toMatch(/rotate\(180deg\)/);
  });

  it("aberto no menu, o painel recebe a posição do cartão", async () => {
    montar();
    await abrirLista();
    const painel = document.querySelector<HTMLElement>(
      ".seletor-empresa__painel",
    )!;
    expect(painel.style.getPropertyValue("--seletor-empresa-topo")).toMatch(
      /^\d+(\.\d+)?px$/,
    );
    expect(painel.style.getPropertyValue("--seletor-empresa-esquerda")).toMatch(
      /^\d+(\.\d+)?px$/,
    );
  });

  it("o selo da atual: visto num círculo, com 'Atual' oculto", async () => {
    montar();
    await abrirLista();
    const marcada = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-current") === "true")!;
    const selo = marcada.querySelector(".seletor-empresa__atual")!;
    expect(selo.querySelector("svg")).not.toBeNull();
    expect(selo.querySelector(".seletor-empresa__oculto")).toHaveTextContent(
      "Atual",
    );
  });
});

describe("T209 — CNPJ e as ações de empresa no seletor", () => {
  it("com CNPJ, ele aparece com máscara abaixo do nome (no cartão e na lista); sem CNPJ, o código", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue([
      { ...ALFA, cnpj: "11222333000181" },
      BETA,
    ]);
    montar({ empresaAtiva: { ...ALFA, cnpj: "11222333000181" } });
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    expect(botao).toHaveTextContent("11.222.333/0001-81");
    expect(botao).not.toHaveTextContent("Código ALFA");
    await abrirLista();
    expect(opcao("Empresa Alfa")).toHaveTextContent("11.222.333/0001-81");
    expect(opcao("Empresa Beta")).toHaveTextContent("Código BETA");
  });

  it("'Adicionar empresa' e 'Gerenciar empresas' depois da lista; cada um fecha o painel e chama o shell", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA, BETA]);
    const onAdicionarEmpresa = vi.fn();
    const onGerenciarEmpresas = vi.fn();
    montar({ onAdicionarEmpresa, onGerenciarEmpresas });
    await abrirLista();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar empresa" }));
    expect(onAdicionarEmpresa).toHaveBeenCalledTimes(1);
    expect(botaoDaEmpresa()).toHaveAttribute("aria-expanded", "false");
    await abrirLista();
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar empresas" }));
    expect(onGerenciarEmpresas).toHaveBeenCalledTimes(1);
  });

  it("empresa única com as ações: o cartão abre (para adicionar ou gerenciar)", async () => {
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA]);
    const onAdicionarEmpresa = vi.fn();
    montar({ onAdicionarEmpresa });
    await abrirLista();
    expect(
      screen.getByRole("button", { name: "Adicionar empresa" }),
    ).toBeInTheDocument();
  });
});
