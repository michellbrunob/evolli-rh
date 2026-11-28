import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listarDocumentosDoColaborador,
  obterArquivoDoDocumento,
  removerDocumentoDoColaborador,
  verDocumentoDoColaborador,
  verificarDocumentoDeNovo,
  type DocumentoColaboradorApi,
} from "../../../api/colaboradoresClient";
import { baixarArquivo } from "../../dashboard/exportacao";
import { TabelaDeDocumentosDaFicha } from "./TabelaDeDocumentosDaFicha";

/**
 * T217 — a aba Documentos da ficha: a tabela do que foi enviado (tipo, nome
 * original, quem enviou, data e hora), com Ver, Baixar e Remover na linha; o
 * envio fica na edição. Arquivos sintéticos; a API é simulada.
 */
vi.mock("../../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/colaboradoresClient")
  >("../../../api/colaboradoresClient");
  return {
    ...actual,
    listarDocumentosDoColaborador: vi.fn(),
    obterArquivoDoDocumento: vi.fn(),
    removerDocumentoDoColaborador: vi.fn(),
    verDocumentoDoColaborador: vi.fn(),
    verificarDocumentoDeNovo: vi.fn(),
  };
});
vi.mock("../../dashboard/exportacao", () => ({ baixarArquivo: vi.fn() }));

const COLABORADOR = "11111111-1111-1111-1111-111111111111";

const doc = (
  id: string,
  extra: Partial<DocumentoColaboradorApi> = {},
): DocumentoColaboradorApi => ({
  id,
  categoria: "rg",
  nome: null,
  nomeArquivo: `${id}.pdf`,
  enviadoPor: { nome: "Ana Souza", papel: "rh" },
  estado: "aprovado",
  formato: "pdf",
  tamanhoBytes: 2048,
  versao: 1,
  enviadoEm: "2026-11-20T12:00:00.000Z",
  verificadoEm: "2026-11-20T12:00:01.000Z",
  ...extra,
});

const LISTA: DocumentoColaboradorApi[] = [
  doc("rg-frente", { enviadoEm: "2026-11-20T12:00:00.000Z" }),
  doc("contrato", {
    categoria: "outros",
    nome: "Contrato de experiência",
    nomeArquivo: "contrato.docx",
    formato: "docx",
    enviadoPor: { nome: null, papel: "dp" },
    enviadoEm: "2026-11-28T14:05:00.000Z",
  }),
  doc("cpf", {
    categoria: "cpf",
    nomeArquivo: "cpf.png",
    formato: "png",
    enviadoEm: "2026-11-25T09:30:00.000Z",
  }),
];

const abrirMenu = (botao: HTMLElement) =>
  fireEvent.pointerDown(botao, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });

const linhas = () =>
  within(screen.getByRole("table", { name: "Documentos enviados" }))
    .getAllByRole("row")
    .slice(1);

const linhaDe = (rotulo: string) =>
  screen.getByText(rotulo, { selector: "strong" }).closest("tr")!;

function montar(
  props: Partial<Parameters<typeof TabelaDeDocumentosDaFicha>[0]> = {},
) {
  const onEnviar = vi.fn();
  const onContagem = vi.fn();
  const utils = render(
    <TabelaDeDocumentosDaFicha
      colaboradorId={COLABORADOR}
      podeOperar
      onEnviar={onEnviar}
      onContagem={onContagem}
      {...props}
    />,
  );
  return { ...utils, onEnviar, onContagem };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarDocumentosDoColaborador).mockResolvedValue(LISTA);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TabelaDeDocumentosDaFicha (T217) — a tabela do que foi enviado", () => {
  it("cabeçalho com título, resumo e Enviar documento; colunas na ordem", async () => {
    const { onEnviar } = montar();
    await screen.findByText("rg-frente.pdf");
    expect(
      screen.getByRole("heading", { name: "Documentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3 arquivos · último envio em 28/11/2026"),
    ).toBeInTheDocument();
    const cabecalhos = within(
      screen.getByRole("table", { name: "Documentos enviados" }),
    ).getAllByRole("columnheader");
    expect(cabecalhos.map((c) => c.textContent)).toEqual([
      "Documento",
      "Enviado por",
      "Data de envio",
      "Ações",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Enviar documento" }));
    expect(onEnviar).toHaveBeenCalledTimes(1);
  });

  it("do envio mais recente para o mais antigo, com rótulo, nome original, autor e data e hora", async () => {
    montar();
    await screen.findByText("rg-frente.pdf");
    const [primeira, segunda, terceira] = linhas();
    expect(primeira).toHaveTextContent("Contrato de experiência");
    expect(primeira).toHaveTextContent("contrato.docx");
    expect(primeira).toHaveTextContent("DP");
    expect(primeira).toHaveTextContent("28/11/2026 às 11:05");
    expect(segunda).toHaveTextContent("CPF");
    expect(segunda).toHaveTextContent("cpf.png");
    expect(segunda).toHaveTextContent("Ana Souza (RH)");
    expect(segunda).toHaveTextContent("25/11/2026 às 06:30");
    expect(terceira).toHaveTextContent("RG");
    expect(terceira).toHaveTextContent("20/11/2026 às 09:00");
  });

  it("sem nome original (envio anterior ou master técnico): formato e tamanho no lugar", async () => {
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValue([
      doc("antigo", { nomeArquivo: null, tamanhoBytes: 2048 }),
    ]);
    montar();
    expect(await screen.findByText("PDF · 2 KB")).toBeInTheDocument();
  });

  it("informa a quantidade a quem mostra o contador da aba, a cada carga", async () => {
    const { onContagem } = montar();
    await screen.findByText("rg-frente.pdf");
    expect(onContagem).toHaveBeenLastCalledWith(3);
  });

  it("Ver e Baixar na linha com o nome do tipo; DOC e DOCX só baixam", async () => {
    montar();
    await screen.findByText("rg-frente.pdf");
    const rg = linhaDe("RG");
    expect(
      within(rg).getByRole("button", { name: "Ver RG" }),
    ).toBeInTheDocument();
    expect(
      within(rg).getByRole("button", { name: "Baixar RG" }),
    ).toBeInTheDocument();
    const contrato = linhaDe("Contrato de experiência");
    expect(
      within(contrato).queryByRole("button", {
        name: "Ver Contrato de experiência",
      }),
    ).toBeNull();
    expect(
      within(contrato).getByRole("button", {
        name: "Baixar Contrato de experiência",
      }),
    ).toBeInTheDocument();
    expect(
      within(contrato).getByRole("button", {
        name: "Mais ações: Contrato de experiência",
      }),
    ).toBeInTheDocument();
  });

  it("Ver abre pela rota autenticada; Baixar salva com o nome original", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    vi.mocked(obterArquivoDoDocumento).mockResolvedValue({
      blob,
      nome: "rg-2026-11-20.pdf",
    });
    vi.mocked(verDocumentoDoColaborador).mockResolvedValue();
    montar();
    await screen.findByText("rg-frente.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Ver RG" }));
    await waitFor(() =>
      expect(verDocumentoDoColaborador).toHaveBeenCalledWith(
        COLABORADOR,
        "rg-frente",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Baixar RG" }));
    await waitFor(() =>
      expect(baixarArquivo).toHaveBeenCalledWith(
        blob,
        "rg-frente.pdf",
        "application/pdf",
      ),
    );
  });

  it("Baixar sem nome original: usa o nome neutro do servidor", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValue([
      doc("antigo", { nomeArquivo: null, formato: "png" }),
    ]);
    vi.mocked(obterArquivoDoDocumento).mockResolvedValue({
      blob,
      nome: "rg-2026-11-20.png",
    });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Baixar RG" }));
    await waitFor(() =>
      expect(baixarArquivo).toHaveBeenCalledWith(
        blob,
        "rg-2026-11-20.png",
        "image/png",
      ),
    );
  });

  it("falha ao baixar: aviso de erro, sem sair da tela", async () => {
    vi.mocked(obterArquivoDoDocumento).mockRejectedValue(new Error("rede"));
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Baixar RG" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível baixar o arquivo agora.",
    );
    expect(baixarArquivo).not.toHaveBeenCalled();
  });
});

describe("TabelaDeDocumentosDaFicha (T217) — remover", () => {
  it("o menu ⋯ tem só Remover; a confirmação cita o tipo e o arquivo e diz que ele fica guardado", async () => {
    montar();
    await screen.findByText("rg-frente.pdf");
    abrirMenu(screen.getByRole("button", { name: "Mais ações: RG" }));
    const itens = await screen.findAllByRole("menuitem");
    expect(itens.map((i) => i.textContent)).toEqual(["Remover"]);
    expect(itens[0]).toHaveClass("documentos__item-perigo");
    fireEvent.click(itens[0]!);
    const janela = await screen.findByRole("dialog");
    expect(
      within(janela).getByText("Remover este arquivo da ficha?"),
    ).toBeInTheDocument();
    expect(janela).toHaveTextContent(
      "RG (rg-frente.pdf) deixa de aparecer na lista, mas continua guardado com segurança.",
    );
    const botoes = within(janela)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(botoes.indexOf("Cancelar")).toBeLessThan(botoes.indexOf("Remover"));
  });

  it("Cancelar fecha sem remover", async () => {
    montar();
    await screen.findByText("rg-frente.pdf");
    abrirMenu(screen.getByRole("button", { name: "Mais ações: RG" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remover" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(removerDocumentoDoColaborador).not.toHaveBeenCalled();
  });

  it("confirmar remove, recarrega, avisa no canto e atualiza resumo e contador", async () => {
    vi.mocked(removerDocumentoDoColaborador).mockResolvedValue();
    const { onContagem } = montar();
    await screen.findByText("rg-frente.pdf");
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValue(
      LISTA.filter((d) => d.id !== "rg-frente"),
    );
    abrirMenu(screen.getByRole("button", { name: "Mais ações: RG" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remover" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Remover",
      }),
    );
    await waitFor(() =>
      expect(removerDocumentoDoColaborador).toHaveBeenCalledWith(
        COLABORADOR,
        "rg-frente",
      ),
    );
    expect(await screen.findByText("Arquivo removido da ficha.")).toBeVisible();
    await waitFor(() => expect(screen.queryByText("rg-frente.pdf")).toBeNull());
    expect(
      screen.getByText("2 arquivos · último envio em 28/11/2026"),
    ).toBeInTheDocument();
    expect(onContagem).toHaveBeenLastCalledWith(2);
  });

  it("falha ao remover: aviso de erro e a linha continua", async () => {
    vi.mocked(removerDocumentoDoColaborador).mockRejectedValue(
      new Error("rede"),
    );
    montar();
    await screen.findByText("rg-frente.pdf");
    abrirMenu(screen.getByRole("button", { name: "Mais ações: RG" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remover" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Remover",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível remover o arquivo agora.",
    );
    expect(screen.getByText("rg-frente.pdf")).toBeInTheDocument();
  });
});

describe("TabelaDeDocumentosDaFicha (T217) — estados", () => {
  it("vazio: ilustração, texto próprio e Enviar documento, com o cabeçalho da tabela", async () => {
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValue([]);
    const { onEnviar, onContagem } = montar();
    expect(
      await screen.findByRole("heading", { name: "Ainda não há arquivos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nada enviado ainda")).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((c) => c.textContent),
    ).toEqual(["Documento", "Enviado por", "Data de envio", "Ações"]);
    const botoes = screen.getAllByRole("button", { name: "Enviar documento" });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[1]!);
    expect(onEnviar).toHaveBeenCalledTimes(1);
    expect(onContagem).toHaveBeenLastCalledWith(0);
  });

  it("carregando: esqueleto na tabela e o resumo diz que está carregando", async () => {
    let soltar: (v: DocumentoColaboradorApi[]) => void = () => undefined;
    vi.mocked(listarDocumentosDoColaborador).mockReturnValue(
      new Promise((r) => {
        soltar = r;
      }),
    );
    montar();
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Carregando documentos" }),
    ).toHaveAttribute("aria-busy", "true");
    await act(async () => soltar(LISTA));
    expect(await screen.findByText("rg-frente.pdf")).toBeInTheDocument();
  });

  it("falha na lista: mensagem e Tentar de novo, que recarrega", async () => {
    vi.mocked(listarDocumentosDoColaborador)
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce(LISTA);
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os documentos agora.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("rg-frente.pdf")).toBeInTheDocument();
    expect(listarDocumentosDoColaborador).toHaveBeenCalledTimes(2);
  });

  it("em verificação e reprovado: selo na linha, sem Ver nem Baixar; em verificação oferece Verificar de novo", async () => {
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValue([
      doc("v", { estado: "em_verificacao", verificadoEm: null }),
      doc("r", { categoria: "cpf", estado: "reprovado" }),
    ]);
    vi.mocked(verificarDocumentoDeNovo).mockResolvedValue(doc("v"));
    montar();
    await screen.findByText("v.pdf");
    const rg = linhaDe("RG");
    expect(rg).toHaveTextContent("Em verificação");
    expect(within(rg).queryByRole("button", { name: "Ver RG" })).toBeNull();
    expect(within(rg).queryByRole("button", { name: "Baixar RG" })).toBeNull();
    const cpf = linhaDe("CPF");
    expect(cpf).toHaveTextContent("Reprovado");
    expect(
      within(cpf).queryByRole("button", { name: "Baixar CPF" }),
    ).toBeNull();
    abrirMenu(within(rg).getByRole("button", { name: "Mais ações: RG" }));
    const itens = await screen.findAllByRole("menuitem");
    expect(itens.map((i) => i.textContent)).toEqual([
      "Verificar de novo",
      "Remover",
    ]);
    fireEvent.click(itens[0]!);
    await waitFor(() =>
      expect(verificarDocumentoDeNovo).toHaveBeenCalledWith(COLABORADOR, "v"),
    );
  });

  it("só leitura (master técnico): vê a tabela e quem enviou, sem enviar, ver, baixar nem remover", async () => {
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValue([
      doc("x", { nomeArquivo: null }),
    ]);
    montar({ podeOperar: false });
    await screen.findByText("Ana Souza (RH)");
    expect(
      screen.queryByRole("button", { name: "Enviar documento" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver RG" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Baixar RG" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mais ações: RG" })).toBeNull();
  });

  it("vazio em só leitura: sem o botão de enviar", async () => {
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValue([]);
    montar({ podeOperar: false });
    await screen.findByRole("heading", { name: "Ainda não há arquivos" });
    expect(
      screen.queryByRole("button", { name: "Enviar documento" }),
    ).toBeNull();
  });
});
