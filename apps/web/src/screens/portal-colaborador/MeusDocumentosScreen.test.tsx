import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeusDocumentosScreen } from "./MeusDocumentosScreen";

describe("MeusDocumentosScreen (T067 — tela visual estática)", () => {
  it("tem um único h1 e o aviso de que upload/download/anexo ainda não estão disponíveis", () => {
    render(<MeusDocumentosScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Meus documentos" }),
    ).toHaveLength(1);
    expect(screen.getByText("Ainda não disponível")).toBeInTheDocument();
    expect(
      screen.getByText(
        /upload, download, anexo, imagem, pdf e armazenamento de documentos/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista os metadados sintéticos dos documentos", () => {
    render(<MeusDocumentosScreen />);

    const tabela = screen.getByRole("table", { name: "Meus documentos" });
    const dentro = within(tabela);

    expect(dentro.getByText("Contracheque")).toBeInTheDocument();
    expect(dentro.getAllByText("Disponível")).toHaveLength(2);
    expect(dentro.getByText("Informe de rendimentos")).toBeInTheDocument();
    expect(dentro.getByText("Pendente")).toBeInTheDocument();
    expect(dentro.getByText("DOC-DEMO-0001")).toBeInTheDocument();
  });

  it("não referencia arquivo, imagem, PDF ou upload/download reais", () => {
    render(<MeusDocumentosScreen />);
    const texto = document.body.innerHTML.toLowerCase();
    // A única menção a esses termos deve ser dentro do aviso de indisponibilidade.
    const aviso = screen
      .getByText(/ainda não estão disponíveis nesta demonstração/i)
      .textContent?.toLowerCase();
    for (const termo of ["upload", "download", "anexo", "imagem", "pdf"]) {
      expect(texto).toContain(termo);
      expect(aviso).toContain(termo);
    }
  });
});
