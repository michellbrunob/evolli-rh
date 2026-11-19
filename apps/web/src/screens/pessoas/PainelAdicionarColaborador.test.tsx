import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PainelAdicionarColaborador,
  ROTULO_INICIAR_CADASTRO,
  TITULO_PAINEL_ADICIONAR,
} from "./PainelAdicionarColaborador";

/**
 * T194 — painel "Adicionar colaborador": só escolhe a forma de entrada. Uma
 * disponível (cadastro individual, já marcada), duas indisponíveis com o
 * motivo e o rádio desabilitado. Nunca chama API.
 */

const EMPRESA = { nome: "Empresa Sintética (teste)", codigo: "SINT01" };

function montar(
  props: Partial<Parameters<typeof PainelAdicionarColaborador>[0]> = {},
) {
  const onFechar = vi.fn();
  const onCadastroIndividual = vi.fn();
  const utils = render(
    <PainelAdicionarColaborador
      aberto
      empresaAtiva={EMPRESA}
      onFechar={onFechar}
      onCadastroIndividual={onCadastroIndividual}
      {...props}
    />,
  );
  return { ...utils, onFechar, onCadastroIndividual };
}

function painel() {
  return screen.getByRole("dialog", { name: TITULO_PAINEL_ADICIONAR });
}

function grupo() {
  return within(painel()).getByRole("group", {
    name: "Como você quer adicionar",
  });
}

function radio(nome: string) {
  return within(grupo()).getByRole("radio", { name: new RegExp(`^${nome}`) });
}

describe("PainelAdicionarColaborador (T194)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fechado, não renderiza nada", () => {
    montar({ aberto: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("é uma janela modal lateral, nomeada pelo título, com ícone decorativo e a empresa ativa", () => {
    montar();
    const dialogo = painel();
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    // T209 — o Sheet da camada `src/ui` (painel lateral, Radix).
    expect(dialogo).toHaveAttribute("data-lado", "direita");
    expect(dialogo).toHaveAccessibleDescription(
      "Escolha o caminho mais prático para trazer alguém para a equipe.",
    );
    // O ícone ao lado do título é só ilustração.
    const icone = dialogo.querySelector("header svg")?.parentElement;
    expect(icone).toHaveAttribute("aria-hidden", "true");
    expect(
      within(dialogo).getByText(/Você está adicionando em/),
    ).toHaveTextContent(
      "Você está adicionando em Empresa Sintética (teste) (SINT01).",
    );
  });

  it("ao abrir, o foco vai ao título do painel", () => {
    montar();
    expect(document.activeElement).toBe(
      within(painel()).getByRole("heading", {
        level: 2,
        name: TITULO_PAINEL_ADICIONAR,
      }),
    );
  });

  it("três formas num grupo de escolha única, na ordem, com o cadastro individual já marcado", () => {
    montar();
    const radios = within(grupo()).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radio("Cadastro individual")).toBeChecked();
    expect(radio("Cadastro individual")).toBeEnabled();
    expect(radio("Cadastro individual")).toHaveAccessibleDescription(
      /confere tudo antes de salvar/,
    );
    // Todos no mesmo grupo de nome: escolher um desmarca os outros.
    expect(new Set(radios.map((r) => r.getAttribute("name"))).size).toBe(1);
    expect(grupo()).toHaveTextContent("Leva poucos minutos");
  });

  it("importar planilha e admissão digital: rádio desabilitado, motivo anunciado, nenhum outro controle", () => {
    montar();
    for (const [nome, motivo] of [
      ["Importar planilha", /Ainda estamos preparando a importação/],
      [
        "Admissão digital",
        /segurança, de proteção de dados \(LGPD\) e do convite/,
      ],
    ] as const) {
      const r = radio(nome);
      expect(r).toBeDisabled();
      expect(r).not.toBeChecked();
      expect(r).toHaveAccessibleDescription(motivo);
      const cartao = r.closest("label") as HTMLElement;
      expect(cartao).toHaveTextContent("Indisponível · em preparação");
      expect(cartao.querySelectorAll("button, a, [tabindex]")).toHaveLength(0);
      expect(cartao).toHaveClass("painel-adicionar__forma--indisponivel");
    }
  });

  it("clicar nas formas indisponíveis não muda a escolha nem chama ação ou rede", () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);
    const { onCadastroIndividual, onFechar } = montar();
    for (const nome of ["Importar planilha", "Admissão digital"]) {
      fireEvent.click(radio(nome).closest("label") as HTMLElement);
      fireEvent.click(radio(nome));
    }
    expect(radio("Cadastro individual")).toBeChecked();
    expect(fetchEspiao).not.toHaveBeenCalled();
    expect(onCadastroIndividual).not.toHaveBeenCalled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(painel()).toBeInTheDocument();
  });

  it("'Iniciar cadastro' inicia a forma escolhida: o cadastro individual", () => {
    const { onCadastroIndividual, onFechar } = montar();
    fireEvent.click(
      within(painel()).getByRole("button", { name: ROTULO_INICIAR_CADASTRO }),
    );
    expect(onCadastroIndividual).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
  });

  it("Fechar, Cancelar e Escape fecham o painel", () => {
    const { onFechar } = montar();
    fireEvent.click(within(painel()).getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    fireEvent.click(within(painel()).getByRole("button", { name: "Cancelar" }));
    expect(onFechar).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(3);
  });

  it("o foco fica preso no painel e passa só pelos controles habilitados", () => {
    montar();
    const focaveis = [
      ...painel().querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled])",
      ),
    ];
    expect(
      focaveis.map((e) =>
        e instanceof HTMLInputElement
          ? `radio:${e.value}`
          : // O "Fechar" é botão de ícone: o nome vem do rótulo.
            (e.getAttribute("aria-label") ?? e.textContent),
      ),
    ).toEqual(["Fechar", "radio:individual", "Cancelar", "Iniciar cadastro"]);
    const ultimo = focaveis[focaveis.length - 1]!;
    ultimo.focus();
    // O foco preso do Radix responde ao Tab dentro da janela.
    fireEvent.keyDown(ultimo, { key: "Tab" });
    expect(document.activeElement).toBe(focaveis[0]);
  });

  describe("T209 (Bloco C) — importar planilha disponível", () => {
    it("com onImportarPlanilha, a forma fica habilitada, sem motivo de indisponível", () => {
      montar({ onImportarPlanilha: vi.fn() });
      const r = radio("Importar planilha");
      expect(r).toBeEnabled();
      const cartao = r.closest("label") as HTMLElement;
      expect(cartao).toHaveClass("painel-adicionar__forma--disponivel");
      expect(cartao).not.toHaveTextContent("Indisponível");
      // T212 — o modelo é .xlsx; o CSV continua aceito.
      expect(cartao).toHaveTextContent(
        "Até 200 pessoas por arquivo .xlsx ou .csv",
      );
      // A admissão digital segue indisponível.
      expect(radio("Admissão digital")).toBeDisabled();
    });

    it("escolher a planilha troca o botão para 'Iniciar importação', que a inicia", () => {
      const onImportarPlanilha = vi.fn();
      const { onCadastroIndividual } = montar({ onImportarPlanilha });
      fireEvent.click(radio("Importar planilha"));
      expect(radio("Importar planilha")).toBeChecked();
      expect(
        within(painel()).queryByRole("button", {
          name: ROTULO_INICIAR_CADASTRO,
        }),
      ).toBeNull();
      fireEvent.click(
        within(painel()).getByRole("button", { name: "Iniciar importação" }),
      );
      expect(onImportarPlanilha).toHaveBeenCalledTimes(1);
      expect(onCadastroIndividual).not.toHaveBeenCalled();
    });

    it("voltar ao cadastro individual volta o botão e a ação", () => {
      const onImportarPlanilha = vi.fn();
      const { onCadastroIndividual } = montar({ onImportarPlanilha });
      fireEvent.click(radio("Importar planilha"));
      fireEvent.click(radio("Cadastro individual"));
      fireEvent.click(
        within(painel()).getByRole("button", { name: ROTULO_INICIAR_CADASTRO }),
      );
      expect(onCadastroIndividual).toHaveBeenCalledTimes(1);
      expect(onImportarPlanilha).not.toHaveBeenCalled();
    });
  });

  it("sem empresa ativa informada, não mostra a linha da empresa", () => {
    montar({ empresaAtiva: null });
    expect(within(painel()).queryByText(/Você está adicionando em/)).toBeNull();
  });

  it("375 px e estados visuais: tela inteira, cartões que quebram linha, escolhida e indisponível distintas", () => {
    // T209 — painel lateral do Sheet (`src/ui`): preso à direita, na altura
    // toda; largura total até 30rem (no celular, a tela inteira).
    const sheet = readFileSync("src/ui/Dialog.tsx", "utf8");
    expect(sheet).toContain(
      "ev:inset-y-0 ev:right-0 ev:h-dvh ev:w-full ev:max-w-[30rem]",
    );
    const css = readFileSync(
      "src/screens/pessoas/PainelAdicionarColaborador.css",
      "utf8",
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma \{[^}]*overflow-wrap: anywhere/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma \{[^}]*grid-template-columns: auto minmax\(0, 1fr\) auto/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma--marcada \{[^}]*border-color: var\(--color-action\)/,
    );
    expect(css).toMatch(
      /\.painel-adicionar__forma--indisponivel \{[^}]*cursor: default/,
    );
  });
});

describe("T212 — importação em três passos no painel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function comPlanilha(props: Parameters<typeof montar>[0] = {}) {
    const onImportarPlanilha = vi.fn();
    const onImportarArquivo = vi.fn();
    const utils = montar({ onImportarPlanilha, onImportarArquivo, ...props });
    fireEvent.click(radio("Importar planilha"));
    return { ...utils, onImportarPlanilha, onImportarArquivo };
  }

  const comoImportar = () =>
    within(painel()).getByRole("region", { name: "Como importar" });
  const campoArquivo = () =>
    within(comoImportar()).getByLabelText(
      "Arquivo da planilha (.xlsx ou .csv)",
    ) as HTMLInputElement;
  const iniciar = () =>
    within(painel()).getByRole("button", { name: "Iniciar importação" });
  const escolher = (arquivo: File) =>
    fireEvent.change(campoArquivo(), { target: { files: [arquivo] } });

  it("escolhida a planilha, o próprio cartão se abre nos três passos, em ordem", () => {
    comPlanilha();
    // Os passos ficam dentro do bloco do cartão da planilha (mesma moldura).
    const bloco = radio("Importar planilha").closest(
      ".painel-adicionar__bloco",
    );
    expect(bloco).toHaveClass("painel-adicionar__bloco--expandido");
    expect(bloco).toContainElement(comoImportar());
    const passos = comoImportar().querySelector("ol")!;
    expect(
      Array.from(passos.children).map(
        (item) =>
          item.querySelector(".painel-adicionar__passo-titulo")?.textContent,
      ),
    ).toEqual([
      "Baixe o modelo",
      "Preencha no Excel ou no Google Planilhas",
      "Escolha o arquivo preenchido",
    ]);
  });

  it("com o cadastro individual escolhido, os passos não aparecem", () => {
    montar({ onImportarPlanilha: vi.fn(), onImportarArquivo: vi.fn() });
    expect(
      within(painel()).queryByRole("region", { name: "Como importar" }),
    ).toBeNull();
    expect(
      painel().querySelector(".painel-adicionar__bloco--expandido"),
    ).toBeNull();
  });

  it("passo 1: 'Baixar modelo (.xlsx)' gera o modelo no navegador", () => {
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:modelo";
      }),
      revokeObjectURL: vi.fn(),
    });
    const nomes: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nomes.push(this.download);
    });
    comPlanilha();
    fireEvent.click(
      within(comoImportar()).getByRole("button", {
        name: "Baixar modelo (.xlsx)",
      }),
    );
    expect(nomes).toEqual(["modelo-importacao-colaboradores.xlsx"]);
    expect(blobs[0]!.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("passo 2: orienta o preenchimento e lista os dados obrigatórios em etiquetas", () => {
    comPlanilha();
    expect(comoImportar()).toHaveTextContent(/códigos ativos/);
    expect(comoImportar()).toHaveTextContent(/linha de exemplo/);
    const obrigatorios = within(comoImportar()).getByRole("list", {
      name: "Dados obrigatórios",
    });
    expect(
      within(obrigatorios)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Nome*",
      "Tipo de vínculo*",
      "Data de admissão*",
      "Data de nascimento*",
      "Departamento*",
      "Cargo*",
    ]);
    // O asterisco é só visual; o texto já diz que são obrigatórios.
    for (const marca of obrigatorios.querySelectorAll(
      ".painel-adicionar__obrigatorio-marca",
    )) {
      expect(marca).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("passo 3: área de arquivo com formatos e limite; o botão abre o campo nativo", () => {
    comPlanilha();
    const campo = campoArquivo();
    expect(campo.type).toBe("file");
    expect(campo.accept).toMatch(/\.xlsx/);
    expect(campo.accept).toMatch(/\.csv/);
    const abrir = vi.spyOn(campo, "click").mockImplementation(() => undefined);
    const botao = within(comoImportar()).getByRole("button", {
      name: "Escolher arquivo",
    });
    expect(botao).toHaveAccessibleDescription(
      ".xlsx ou .csv em UTF-8 · até 200 linhas e 1 MB",
    );
    fireEvent.click(botao);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(comoImportar()).toHaveTextContent(/ou solte o arquivo nesta área/);
  });

  it("sem arquivo, 'Iniciar importação' fica desabilitado e o rodapé diz por quê", () => {
    const { onImportarArquivo, onImportarPlanilha } = comPlanilha();
    expect(iniciar()).toBeDisabled();
    expect(iniciar()).toHaveAccessibleDescription(
      "Escolha o arquivo no passo 3 para seguir",
    );
    fireEvent.click(iniciar());
    expect(onImportarArquivo).not.toHaveBeenCalled();
    expect(onImportarPlanilha).not.toHaveBeenCalled();
  });

  it("escolhido o arquivo: o nome aparece, o botão habilita e entrega o arquivo ao shell", () => {
    const { onImportarArquivo } = comPlanilha();
    const arquivo = new File(["x"], "pessoas.xlsx");
    escolher(arquivo);
    expect(onImportarArquivo).not.toHaveBeenCalled();
    expect(within(comoImportar()).getByRole("status")).toHaveTextContent(
      "Arquivo escolhido: pessoas.xlsx",
    );
    expect(
      within(comoImportar()).getByRole("button", { name: "Trocar arquivo" }),
    ).toBeInTheDocument();
    expect(iniciar()).toBeEnabled();
    expect(
      within(painel()).queryByText("Escolha o arquivo no passo 3 para seguir"),
    ).toBeNull();
    fireEvent.click(iniciar());
    expect(onImportarArquivo).toHaveBeenCalledWith(arquivo);
  });

  it("soltar um .csv na área também o escolhe", () => {
    const { onImportarArquivo } = comPlanilha();
    const area = comoImportar().querySelector(".painel-adicionar__soltar")!;
    const arquivo = new File(["x"], "pessoas.csv", { type: "text/csv" });
    fireEvent.dragOver(area, { dataTransfer: { files: [arquivo] } });
    expect(area).toHaveClass("painel-adicionar__soltar--arrastando");
    fireEvent.drop(area, { dataTransfer: { files: [arquivo] } });
    expect(area).not.toHaveClass("painel-adicionar__soltar--arrastando");
    fireEvent.click(iniciar());
    expect(onImportarArquivo).toHaveBeenCalledWith(arquivo);
  });

  it("arquivo que não é .xlsx nem .csv é recusado ali mesmo, sem habilitar o botão", () => {
    const { onImportarArquivo } = comPlanilha();
    escolher(new File(["x"], "pessoas.pdf"));
    expect(within(comoImportar()).getByRole("alert")).toHaveTextContent(
      '"pessoas.pdf" não é .xlsx nem .csv.',
    );
    expect(iniciar()).toBeDisabled();
    fireEvent.click(iniciar());
    expect(onImportarArquivo).not.toHaveBeenCalled();
  });

  it("fechar o painel esquece o arquivo escolhido", () => {
    const props = {
      onImportarPlanilha: vi.fn(),
      onImportarArquivo: vi.fn(),
    };
    const { rerender, onFechar, onCadastroIndividual } = montar(props);
    fireEvent.click(radio("Importar planilha"));
    escolher(new File(["x"], "pessoas.xlsx"));
    expect(iniciar()).toBeEnabled();
    const comAberto = (aberto: boolean) => (
      <PainelAdicionarColaborador
        aberto={aberto}
        empresaAtiva={EMPRESA}
        onFechar={onFechar}
        onCadastroIndividual={onCadastroIndividual}
        {...props}
      />
    );
    rerender(comAberto(false));
    rerender(comAberto(true));
    fireEvent.click(radio("Importar planilha"));
    expect(iniciar()).toBeDisabled();
  });

  it("teclado: só controles nativos; o campo de arquivo oculto não é parada extra", () => {
    comPlanilha();
    for (const nome of ["Baixar modelo (.xlsx)", "Escolher arquivo"]) {
      const botao = within(comoImportar()).getByRole("button", { name: nome });
      expect(botao.tagName).toBe("BUTTON");
      expect(botao).toBeEnabled();
    }
    expect(campoArquivo()).toHaveAttribute("hidden");
  });

  it("CSS dos passos: só tokens, sem largura fixa (375 px) e animação só sem movimento reduzido", () => {
    const css = readFileSync(
      "src/screens/pessoas/PainelAdicionarColaborador.css",
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    const bloco = css.slice(css.indexOf(".painel-adicionar__bloco"));
    expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    // Anel de foco: só pelo teclado e dentro da caixa (não é cortado nem
    // para na divisória); aberto, contorna o bloco inteiro.
    expect(css).not.toMatch(/painel-adicionar__forma:focus-within/);
    expect(css).toMatch(
      /\.painel-adicionar__bloco--expandido:has\(\s*\.painel-adicionar__radio:focus-visible\s*\)\s*\{[^}]*outline-offset: -1px/,
    );
    // Só traços de 1px; nenhuma largura fixa de layout.
    expect(bloco).not.toMatch(/(^|[^-])width:\s*(?!1px)\d+px/m);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)[\s\S]*painel-adicionar__importacao/,
    );
    // A divisória dos passos fica dentro do cartão, recuada dos dois lados —
    // não atravessa o painel inteiro.
    expect(css).toMatch(
      /\.painel-adicionar__importacao \{[^}]*margin: 0 var\(--space-md\)/,
    );
  });
});
