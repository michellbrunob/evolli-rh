import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enviarDocumentoDoColaborador,
  listarDocumentosDoColaborador,
  obterArquivoDoDocumento,
  removerDocumentoDoColaborador,
  trocarDocumentoDoColaborador,
  verDocumentoDoColaborador,
  verificarDocumentoDeNovo,
  type DocumentoColaboradorApi,
} from "../../../api/colaboradoresClient";
import { ArquivosDoColaborador } from "./ArquivosDoColaborador";

/**
 * T213 — documentos do colaborador na ficha: lista e estado para quem lê;
 * enviar, ver, baixar, trocar, verificar de novo e remover só para RH e DP.
 * Arquivos sintéticos; a API é simulada.
 */
vi.mock("../../../api/colaboradoresClient");

const COLABORADOR = "11111111-1111-1111-1111-111111111111";

const doc = (
  id: string,
  categoria: DocumentoColaboradorApi["categoria"],
  estado: DocumentoColaboradorApi["estado"],
  nome: string | null = null,
): DocumentoColaboradorApi => ({
  id,
  categoria,
  nome,
  estado,
  formato: "pdf",
  tamanhoBytes: 2048,
  versao: 1,
  enviadoEm: "2026-11-19T12:00:00.000Z",
  verificadoEm: estado === "em_verificacao" ? null : "2026-11-19T12:00:01.000Z",
});

const LISTA = [
  doc("d-rg", "rg", "aprovado"),
  doc("d-cpf", "cpf", "em_verificacao"),
  doc("d-cert", "certidoes", "reprovado"),
  doc("d-outro", "outros", "aprovado", "Contrato sintético"),
];

const abrirMenu = (botao: HTMLElement) =>
  fireEvent.pointerDown(botao, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });

/**
 * O jsdom não tem endereços temporários de Blob: um par falso, devolvido ao
 * original só depois de o endereço ser revogado.
 */
function urlTemporaria() {
  const original = {
    criar: URL.createObjectURL,
    revogar: URL.revokeObjectURL,
  };
  const criar = vi.fn(() => "blob:sintetico");
  const revogar = vi.fn();
  URL.createObjectURL = criar as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revogar;
  return {
    criar,
    revogar,
    restaurar: () => {
      URL.createObjectURL = original.criar;
      URL.revokeObjectURL = original.revogar;
    },
  };
}

const linhaDe = (nome: string) =>
  screen.getByText(nome, { selector: ".documentos__nome" }).closest("li")!;

function montar(podeOperar = true) {
  return render(
    <ArquivosDoColaborador
      colaboradorId={COLABORADOR}
      podeOperar={podeOperar}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarDocumentosDoColaborador).mockResolvedValue(LISTA);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ArquivosDoColaborador (T215) — textos da referência", () => {
  it("Documentos obrigatórios com a contagem; Outros com a explicação", async () => {
    const onDocumentos = vi.fn();
    render(
      <ArquivosDoColaborador
        colaboradorId={COLABORADOR}
        podeOperar
        onDocumentos={onDocumentos}
      />,
    );
    await screen.findByText("Contrato sintético");
    expect(
      screen.getByRole("heading", { name: "Documentos obrigatórios" }),
    ).toBeInTheDocument();
    // RG e CPF contam; a certidão reprovada não.
    expect(screen.getByText("2 de 5 enviados.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Outros documentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Contratos, laudos, atestados e demais arquivos."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dê um nome e envie o arquivo."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Novo documento")).toHaveAttribute(
      "placeholder",
      "Ex.: Atestado médico",
    );
    expect(screen.queryByText("Arquivos do colaborador")).toBeNull();
    expect(onDocumentos).toHaveBeenLastCalledWith(LISTA);
  });
});

describe("ArquivosDoColaborador (T213) — lista e estados", () => {
  it("cada estado aparece com texto e ícone; categorias sem arquivo ficam Pendente", async () => {
    montar();
    await screen.findByText("Contrato sintético");
    const estados: [string, string][] = [
      ["RG", "Aprovado"],
      ["CPF", "Em verificação"],
      ["Certidões", "Reprovado"],
      ["Comprovante de endereço", "Pendente"],
      ["Carteira de Trabalho", "Pendente"],
    ];
    for (const [nome, estado] of estados) {
      const selo = within(linhaDe(nome)).getByText(estado);
      expect(selo.querySelector("svg")).not.toBeNull();
      expect(selo.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("o arquivo aparece como formato, data e tamanho — nunca um nome original", async () => {
    montar();
    await screen.findByText("Contrato sintético");
    expect(linhaDe("RG")).toHaveTextContent("PDF · 19/11/2026");
    expect(linhaDe("RG")).toHaveTextContent("2 KB");
  });

  it("falha ao carregar: mensagem e Tentar de novo", async () => {
    vi.mocked(listarDocumentosDoColaborador)
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce(LISTA);
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível carregar os documentos/,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Contrato sintético")).toBeInTheDocument();
  });
});

describe("ArquivosDoColaborador (T213) — permissões", () => {
  it("sem permissão de operar (master técnico): só a lista e o estado, nenhuma ação", async () => {
    montar(false);
    await screen.findByText("Contrato sintético");
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryByLabelText("Arquivo do documento")).toBeNull();
    expect(screen.queryByLabelText("Novo documento")).toBeNull();
    expect(linhaDe("RG")).toHaveTextContent("Aprovado");
  });

  it("RH/DP: Ver e Baixar só no aprovado; Verificar de novo só em verificação; reprovado nunca baixa", async () => {
    montar();
    await screen.findByText("Contrato sintético");
    expect(
      within(linhaDe("RG")).getByRole("button", {
        name: "Ver o arquivo de RG",
      }),
    ).toBeInTheDocument();
    expect(
      within(linhaDe("CPF")).queryByRole("button", { name: /Ver o arquivo/ }),
    ).toBeNull();
    expect(
      within(linhaDe("Certidões")).queryByRole("button", {
        name: /Ver o arquivo/,
      }),
    ).toBeNull();

    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    let itens = (await screen.findAllByRole("menuitem")).map(
      (i) => i.textContent,
    );
    expect(itens).toEqual(["Baixar", "Trocar arquivo", "Remover"]);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    abrirMenu(
      within(linhaDe("CPF")).getByRole("button", { name: "Mais ações: CPF" }),
    );
    itens = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
    expect(itens).toEqual(["Trocar arquivo", "Verificar de novo", "Remover"]);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    abrirMenu(
      within(linhaDe("Certidões")).getByRole("button", {
        name: "Mais ações: Certidões",
      }),
    );
    itens = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
    expect(itens).toEqual(["Trocar arquivo", "Remover"]);
  });
});

describe("ArquivosDoColaborador (T213) — ações", () => {
  it("Ver e Baixar usam a rota autenticada da API", async () => {
    vi.mocked(obterArquivoDoDocumento).mockResolvedValue({
      blob: new Blob(["%PDF"], { type: "application/pdf" }),
      nome: "rg-2026-11-19.pdf",
    });
    const url = urlTemporaria();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    montar();
    await screen.findByText("Contrato sintético");
    fireEvent.click(
      within(linhaDe("RG")).getByRole("button", {
        name: "Ver o arquivo de RG",
      }),
    );
    await waitFor(() =>
      expect(verDocumentoDoColaborador).toHaveBeenCalledWith(
        COLABORADOR,
        "d-rg",
      ),
    );
    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Baixar" }));
    await waitFor(() =>
      expect(obterArquivoDoDocumento).toHaveBeenCalledWith(COLABORADOR, "d-rg"),
    );
    await waitFor(() => expect(url.revogar).toHaveBeenCalled());
    url.restaurar();
  });

  it("Baixar: o link temporário entra no documento, leva o nome neutro e o endereço só é revogado depois do clique", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    vi.mocked(obterArquivoDoDocumento).mockResolvedValue({
      blob,
      nome: "rg-2026-11-19.pdf",
    });
    const { criar, revogar, restaurar } = urlTemporaria();
    const cliques: { conectado: boolean; nome: string; revogado: boolean }[] =
      [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      cliques.push({
        conectado: this.isConnected,
        nome: this.download,
        revogado: revogar.mock.calls.length > 0,
      });
    });
    montar();
    await screen.findByText("Contrato sintético");
    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Baixar" }));
    await waitFor(() => expect(cliques).toHaveLength(1));
    // No clique, o link está no documento (Firefox e Safari exigem) e o
    // endereço ainda vale.
    expect(cliques[0]).toEqual({
      conectado: true,
      nome: "rg-2026-11-19.pdf",
      revogado: false,
    });
    expect(criar).toHaveBeenCalledWith(expect.any(Blob));
    // Depois, o link sai do documento e o endereço é revogado.
    await waitFor(() => expect(revogar).toHaveBeenCalledWith("blob:sintetico"));
    expect(
      document.querySelector('a[download="rg-2026-11-19.pdf"]'),
    ).toBeNull();
    restaurar();
  });

  it("enviar numa categoria pendente: sobe com a categoria e uma chave nova, e recarrega", async () => {
    vi.mocked(enviarDocumentoDoColaborador).mockResolvedValue(
      doc("d-ctps", "carteira_trabalho", "aprovado"),
    );
    montar();
    await screen.findByText("Contrato sintético");
    fireEvent.click(
      within(linhaDe("Carteira de Trabalho")).getByRole("button", {
        name: "Enviar arquivo de Carteira de Trabalho",
      }),
    );
    const arquivo = new File(["%PDF-1.4 %%EOF"], "ctps.pdf", {
      type: "application/pdf",
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo do documento"), {
        target: { files: [arquivo] },
      });
    });
    await waitFor(() =>
      expect(enviarDocumentoDoColaborador).toHaveBeenCalledWith(COLABORADOR, {
        categoria: "carteira_trabalho",
        arquivo,
        chaveIdempotencia: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    );
    expect(listarDocumentosDoColaborador).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText("Carteira de Trabalho: arquivo recebido."),
    ).toHaveAttribute("role", "status");
  });

  it("arquivo inválido no navegador: recusado na linha, nada sobe", async () => {
    montar();
    await screen.findByText("Contrato sintético");
    fireEvent.click(
      within(linhaDe("Carteira de Trabalho")).getByRole("button", {
        name: "Enviar arquivo de Carteira de Trabalho",
      }),
    );
    fireEvent.change(screen.getByLabelText("Arquivo do documento"), {
      target: { files: [new File(["x"], "ctps.heic", { type: "image/heic" })] },
    });
    expect(
      within(linhaDe("Carteira de Trabalho")).getByRole("alert"),
    ).toHaveTextContent("Use um arquivo PDF, JPG ou PNG.");
    expect(enviarDocumentoDoColaborador).not.toHaveBeenCalled();
  });

  it("recusa do servidor no envio: mensagem acionável na linha", async () => {
    vi.mocked(enviarDocumentoDoColaborador).mockRejectedValue(
      Object.assign(new Error("recusado"), {
        status: 422,
        codigo: "documento_arquivo_malformado",
      }),
    );
    montar();
    await screen.findByText("Contrato sintético");
    fireEvent.click(
      within(linhaDe("Carteira de Trabalho")).getByRole("button", {
        name: "Enviar arquivo de Carteira de Trabalho",
      }),
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo do documento"), {
        target: {
          files: [new File(["%PDF"], "ctps.pdf", { type: "application/pdf" })],
        },
      });
    });
    expect(
      await within(linhaDe("Carteira de Trabalho")).findByRole("alert"),
    ).toHaveTextContent(/corrompido ou incompleto/);
  });

  it("trocar arquivo: cria versão nova pela API", async () => {
    vi.mocked(trocarDocumentoDoColaborador).mockResolvedValue(
      doc("d-rg", "rg", "aprovado"),
    );
    montar();
    await screen.findByText("Contrato sintético");
    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Trocar arquivo" }),
    );
    const arquivo = new File(["%PDF-1.4 %%EOF"], "rg2.pdf", {
      type: "application/pdf",
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo do documento"), {
        target: { files: [arquivo] },
      });
    });
    await waitFor(() =>
      expect(trocarDocumentoDoColaborador).toHaveBeenCalledWith(
        COLABORADOR,
        "d-rg",
        arquivo,
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      ),
    );
  });

  it("verificar de novo: chama a API para o documento em verificação", async () => {
    vi.mocked(verificarDocumentoDeNovo).mockResolvedValue(
      doc("d-cpf", "cpf", "aprovado"),
    );
    montar();
    await screen.findByText("Contrato sintético");
    abrirMenu(
      within(linhaDe("CPF")).getByRole("button", { name: "Mais ações: CPF" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Verificar de novo" }),
    );
    await waitFor(() =>
      expect(verificarDocumentoDeNovo).toHaveBeenCalledWith(
        COLABORADOR,
        "d-cpf",
      ),
    );
  });

  it("remover pede confirmação; Cancelar não remove; Remover remove", async () => {
    vi.mocked(removerDocumentoDoColaborador).mockResolvedValue(undefined);
    montar();
    await screen.findByText("Contrato sintético");
    const pedirRemocao = async () => {
      abrirMenu(
        within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
      );
      fireEvent.click(await screen.findByRole("menuitem", { name: "Remover" }));
      return screen.findByRole("dialog", { name: "Remover documento?" });
    };
    let dialogo = await pedirRemocao();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(removerDocumentoDoColaborador).not.toHaveBeenCalled();

    dialogo = await pedirRemocao();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Remover" }));
    await waitFor(() =>
      expect(removerDocumentoDoColaborador).toHaveBeenCalledWith(
        COLABORADOR,
        "d-rg",
      ),
    );
  });

  it("Outros documentos: nome obrigatório e sem repetir, antes de escolher o arquivo", async () => {
    montar();
    await screen.findByText("Contrato sintético");
    const campo = screen.getByLabelText("Novo documento");
    const adicionar = screen.getByRole("button", { name: "Adicionar" });
    expect(adicionar).toBeDisabled();
    fireEvent.change(campo, { target: { value: "contrato sintético" } });
    fireEvent.click(adicionar);
    expect(screen.getByRole("alert")).toHaveTextContent("Já existe");
  });
});

describe("ArquivosDoColaborador (T213) — foco depois de cada ação (teclado)", () => {
  const PDF = () =>
    new File(["%PDF-1.4 %%EOF"], "sintetico.pdf", { type: "application/pdf" });
  const escolher = async (arquivo: File) =>
    act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo do documento"), {
        target: { files: [arquivo] },
      });
    });

  it("enviar numa categoria pendente: o foco vai ao Ver do arquivo recebido", async () => {
    const novo = doc("d-ctps", "carteira_trabalho", "aprovado");
    vi.mocked(enviarDocumentoDoColaborador).mockResolvedValue(novo);
    vi.mocked(listarDocumentosDoColaborador)
      .mockResolvedValueOnce(LISTA)
      .mockResolvedValueOnce([...LISTA, novo]);
    montar();
    await screen.findByText("Contrato sintético");
    within(linhaDe("Carteira de Trabalho"))
      .getByRole("button", { name: "Enviar arquivo de Carteira de Trabalho" })
      .focus();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Enviar arquivo de Carteira de Trabalho",
      }),
    );
    await escolher(PDF());
    await waitFor(() =>
      expect(
        within(linhaDe("Carteira de Trabalho")).getByRole("button", {
          name: "Ver o arquivo de Carteira de Trabalho",
        }),
      ).toHaveFocus(),
    );
  });

  it("antivírus indisponível: mensagem de que nada foi enviado e o foco volta ao Enviar arquivo", async () => {
    vi.mocked(enviarDocumentoDoColaborador).mockRejectedValue(
      Object.assign(new Error("indisponível"), {
        status: 503,
        codigo: "documento_verificacao_indisponivel",
      }),
    );
    montar();
    await screen.findByText("Contrato sintético");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Enviar arquivo de Carteira de Trabalho",
      }),
    );
    await escolher(PDF());
    expect(
      await within(linhaDe("Carteira de Trabalho")).findByRole("alert"),
    ).toHaveTextContent(
      "A verificação antivírus está indisponível agora e o arquivo não foi enviado.",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Enviar arquivo de Carteira de Trabalho",
        }),
      ).toHaveFocus(),
    );
  });

  it("trocar arquivo: o foco vai ao Ver do mesmo documento", async () => {
    vi.mocked(trocarDocumentoDoColaborador).mockResolvedValue(
      doc("d-rg", "rg", "aprovado"),
    );
    montar();
    await screen.findByText("Contrato sintético");
    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Trocar arquivo" }),
    );
    await escolher(PDF());
    await waitFor(() =>
      expect(
        within(linhaDe("RG")).getByRole("button", {
          name: "Ver o arquivo de RG",
        }),
      ).toHaveFocus(),
    );
  });

  it("remover um principal: o foco vai ao Enviar arquivo da categoria, que volta a Pendente", async () => {
    vi.mocked(removerDocumentoDoColaborador).mockResolvedValue(undefined);
    vi.mocked(listarDocumentosDoColaborador)
      .mockResolvedValueOnce(LISTA)
      .mockResolvedValueOnce(LISTA.filter((d) => d.id !== "d-rg"));
    montar();
    await screen.findByText("Contrato sintético");
    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remover" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Remover documento?",
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Remover" }));
    await waitFor(() =>
      expect(
        within(linhaDe("RG")).getByRole("button", {
          name: "Enviar arquivo de RG",
        }),
      ).toHaveFocus(),
    );
  });

  it("remover um Outro: a linha sai e o foco vai ao campo Novo documento", async () => {
    vi.mocked(removerDocumentoDoColaborador).mockResolvedValue(undefined);
    vi.mocked(listarDocumentosDoColaborador)
      .mockResolvedValueOnce(LISTA)
      .mockResolvedValueOnce(LISTA.filter((d) => d.id !== "d-outro"));
    montar();
    await screen.findByText("Contrato sintético");
    abrirMenu(
      within(linhaDe("Contrato sintético")).getByRole("button", {
        name: "Mais ações: Contrato sintético",
      }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remover" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Remover documento?",
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Remover" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Novo documento")).toHaveFocus(),
    );
  });
});

describe("ArquivosDoColaborador (T213) — CSS (375 px e movimento)", () => {
  const css = readFileSync(
    "src/screens/pessoas/documentos/documentos.css",
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("só tokens, sem largura fixa em px; colunas fluidas", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(css).not.toMatch(/(^|[^-])width:\s*\d+px/m);
    expect(css).toMatch(/minmax\(0,/);
  });

  it("até 640 px a linha empilha; animação só sem movimento reduzido", () => {
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*documentos__linha/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)[\s\S]*documentos-entra/,
    );
  });

  it("o topo da lista tem o mesmo respiro das seções das outras etapas", () => {
    expect(css).toMatch(/\.documentos \{[^}]*padding-top: var\(--space-lg\)/);
  });
});
