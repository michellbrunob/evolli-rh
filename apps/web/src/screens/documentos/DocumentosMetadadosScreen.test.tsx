import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentosMetadadosScreen } from "./DocumentosMetadadosScreen";

describe("DocumentosMetadadosScreen (T047 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<DocumentosMetadadosScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Metadados de documentos",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que esta versão trabalha somente com metadados", () => {
    render(<DocumentosMetadadosScreen />);

    expect(screen.getByText("Somente metadados")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Não há upload, anexo, visualização, download ou armazenamento de/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que somente RH opera o módulo, restrito à empresa", () => {
    render(<DocumentosMetadadosScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(/sempre restrito à sua empresa/i),
    ).toBeInTheDocument();
  });

  it("lista o catálogo de tipos documentais", () => {
    render(<DocumentosMetadadosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Catálogo de tipos documentais",
    });
    const dentro = within(tabela);

    expect(dentro.getByText("ENDERECO")).toBeInTheDocument();
    expect(
      dentro.getByText("Comprovante de Endereço (exemplo)"),
    ).toBeInTheDocument();
    expect(dentro.getAllByText("Restrito").length).toBeGreaterThan(0);
  });

  it("lista documentos e solicitações com situação, data, validade e referência técnica", () => {
    render(<DocumentosMetadadosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Documentos e solicitações desta empresa",
    });
    const dentro = within(tabela);

    expect(dentro.getByText("Vínculo V-001")).toBeInTheDocument();
    expect(dentro.getByText("Ativo (metadado)")).toBeInTheDocument();
    expect(dentro.getByText("Substituído")).toBeInTheDocument();
    expect(dentro.getAllByText("Pendente").length).toBeGreaterThan(0);
    expect(dentro.getByText("10/01/2026")).toBeInTheDocument();
    expect(dentro.getByText("10/07/2026")).toBeInTheDocument();
    expect(
      dentro.getAllByText("Sem validade definida (exemplo)").length,
    ).toBeGreaterThan(0);
    expect(dentro.getByText("DOC-0001")).toBeInTheDocument();
    expect(dentro.getByText("SOL-0001")).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<DocumentosMetadadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Documentos e solicitações desta empresa",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhum registro de documento nesta empresa",
      }),
    ).toBeInTheDocument();
    // O catálogo de tipos documentais não é afetado pelo alternador.
    expect(
      screen.getByRole("table", { name: "Catálogo de tipos documentais" }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<DocumentosMetadadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar os registros de documentos",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-000234/)).toBeInTheDocument();
    expect(screen.getByText(/ilustrativa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Documentos e solicitações desta empresa",
      }),
    ).toBeInTheDocument();
  });

  it("não contém upload, download, anexo, URL, storage ou qualquer ação de conteúdo", () => {
    render(<DocumentosMetadadosScreen />);

    // O único lugar em que "upload"/"anexo"/"download" aparecem é o aviso
    // explícito de que esta versão NÃO os possui — uma negação, não uma
    // ação. Removemos essa frase antes de checar termos proibidos, para
    // isolar qualquer ocorrência que sugerisse uma ação real de conteúdo.
    const avisoNegacao =
      "não há upload, anexo, visualização, download ou armazenamento de";
    const texto = document.body.innerHTML
      .toLowerCase()
      .replace(avisoNegacao, "");

    expect(document.body.innerHTML.toLowerCase()).toContain(avisoNegacao);

    for (const termoProibido of [
      "visualizar arquivo",
      "abrir arquivo",
      "storage",
      "armazenamento privado",
      "http://",
      "https://",
      "<a href",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }

    // Nenhum elemento de upload de arquivo e nenhum link real na tela.
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("não referencia CPF, nome real, empresa real ou dado real", () => {
    render(<DocumentosMetadadosScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "mfa",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
