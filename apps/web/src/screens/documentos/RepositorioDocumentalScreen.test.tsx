import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepositorioDocumentalScreen } from "./RepositorioDocumentalScreen";

describe("RepositorioDocumentalScreen (T070 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<RepositorioDocumentalScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Repositório documental",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de demonstração visual sem repositório real, com upload/anexo/download/imagem/PDF/armazenamento indisponíveis", () => {
    render(<RepositorioDocumentalScreen />);

    expect(screen.getByText("Somente demonstração visual")).toBeInTheDocument();
    expect(
      screen.getByText(/não existe repositório real por/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Upload, anexo, download, visualização de imagem ou PDF e/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/seguem indisponíveis/i)).toBeInTheDocument();
  });

  it("exibe o aviso de que a ativação futura depende de retenção, base legal, minimização, auditoria, MFA, DS-OPS-01 e validação RH + Jurídico", () => {
    render(<RepositorioDocumentalScreen />);

    expect(screen.getByText("Ativação futura")).toBeInTheDocument();
    expect(screen.getByText(/decisão de retenção/i)).toBeInTheDocument();
    expect(screen.getByText(/base legal/i)).toBeInTheDocument();
    expect(screen.getByText(/minimização de dados/i)).toBeInTheDocument();
    expect(screen.getByText(/auditoria/i)).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/validação\s*conjunta do RH e do Jurídico/i),
    ).toBeInTheDocument();
  });

  it("lista o catálogo de tipos documentais", () => {
    render(<RepositorioDocumentalScreen />);

    const tabela = screen.getByRole("table", {
      name: "Catálogo de tipos documentais do repositório",
    });
    const dentro = within(tabela);

    expect(dentro.getByText("ENDERECO")).toBeInTheDocument();
    expect(
      dentro.getByText("Comprovante de Endereço (exemplo)"),
    ).toBeInTheDocument();
    expect(dentro.getByText("CONTRATUAL")).toBeInTheDocument();
  });

  it("mostra o resumo por situação", () => {
    render(<RepositorioDocumentalScreen />);

    expect(screen.getByText("2 vigente(s)")).toBeInTheDocument();
    expect(screen.getByText("1 a vencer")).toBeInTheDocument();
    expect(screen.getByText("1 vencido(s)")).toBeInTheDocument();
    expect(
      screen.getByText("1 pendente(s) de verificação"),
    ).toBeInTheDocument();
  });

  it("lista registros com referência técnica, tipo, situação, validade, responsável técnico e pendência", () => {
    render(<RepositorioDocumentalScreen />);

    const tabela = screen.getByRole("table", {
      name: "Registros do repositório documental",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("REP-2026-0001").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Comprovante de Endereço (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Vigente")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("10/11/2026")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Documentos-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Nenhuma pendência")).toBeInTheDocument();
  });

  it("filtra localmente por tipo documental e por situação", () => {
    render(<RepositorioDocumentalScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "vencido" },
    });

    const tabela = screen.getByRole("table", {
      name: "Registros do repositório documental",
    });
    expect(within(tabela).getByText("REP-2026-0003")).toBeInTheDocument();
    expect(within(tabela).queryByText("REP-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("REP-2026-0001")).toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhum registro", () => {
    render(<RepositorioDocumentalScreen />);

    fireEvent.change(screen.getByLabelText("Tipo documental"), {
      target: { value: "Comprovante de Endereço (exemplo)" },
    });
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "vencido" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhum registro corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<RepositorioDocumentalScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Registros do repositório documental",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhum registro no repositório",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<RepositorioDocumentalScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar o repositório documental",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-000789/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Registros do repositório documental",
      }),
    ).toBeInTheDocument();
  });

  it("não contém upload, download, anexo, imagem, PDF, URL, storage ou qualquer ação real de conteúdo", () => {
    render(<RepositorioDocumentalScreen />);

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);

    const avisosDeNegacao = [
      "upload, anexo, download, visualização de imagem ou pdf e",
      "qualquer ativação futura de upload, anexo, download ou armazenamento",
    ];
    let texto = document.body.innerHTML.toLowerCase();
    for (const aviso of avisosDeNegacao) {
      expect(texto).toContain(aviso);
      texto = texto.replace(aviso, "");
    }

    for (const termoProibido of [
      "visualizar arquivo",
      "abrir arquivo",
      "baixar arquivo",
      "anexar arquivo",
      "http://",
      "https://",
      "<a href",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não referencia CPF, nome real, empresa real ou dado real", () => {
    render(<RepositorioDocumentalScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "atestado",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
