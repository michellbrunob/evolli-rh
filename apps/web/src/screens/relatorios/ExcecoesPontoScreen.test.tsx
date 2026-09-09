import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExcecoesPontoScreen } from "./ExcecoesPontoScreen";

describe("ExcecoesPontoScreen (T075 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<ExcecoesPontoScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o RH revisa somente a própria empresa e que ajuste/fechamento/compensação/Folha seguem em fluxos separados", () => {
    render(<ExcecoesPontoScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(/somente exceções de Ponto da própria empresa/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Ajuste manual, fechamento, compensação, quitação e integração com a Folha permanecem em fluxos separados/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de demonstração visual sem login/API/persistência/cálculo financeiro/PDF/assinatura", () => {
    render(<ExcecoesPontoScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /demonstração visual, sem login real, API, persistência, cálculo financeiro, arquivo, PDF, assinatura ou operação trabalhista/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que dado real segue bloqueado por MFA, DS-OPS-01, auditoria e retenção/base legal", () => {
    render(<ExcecoesPontoScreen />);

    expect(screen.getByText("Dado real bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("explica que alertas de Banco de Horas são apenas informativos, sem cálculo, bloqueio ou fechamento automático", () => {
    render(<ExcecoesPontoScreen />);

    expect(screen.getByText(/Alertas de Banco de Horas/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /não calculam dinheiro, não bloqueiam automaticamente e não fecham o período sozinhos/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista exceções cobrindo os cinco tipos de pendência, com referência, período, vínculo, prioridade, situação e encaminhamento", () => {
    render(<ExcecoesPontoScreen />);

    const tabela = screen.getByRole("table", {
      name: "Exceções de Ponto para priorização e revisão do RH",
    });
    const dentro = within(tabela);

    // "Marcação ausente" aparece em duas linhas de propósito (para exercitar
    // o filtro por situação em outro teste), por isso usamos getAllByText.
    for (const tipo of [
      "Jornada incompleta",
      "Marcação fora do horário",
      "Compensação pendente",
      "Dado de importação não associado",
    ]) {
      expect(dentro.getByText(tipo)).toBeInTheDocument();
    }
    expect(dentro.getAllByText("Marcação ausente").length).toBe(2);

    const linha = dentro.getByText("EXC-2026-0001").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("11/08/2026")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Vínculo V-001")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Alta")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Aberta")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando revisão do RH (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por tipo, situação e prioridade", () => {
    render(<ExcecoesPontoScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "resolvida" },
    });

    const tabela = screen.getByRole("table", {
      name: "Exceções de Ponto para priorização e revisão do RH",
    });
    expect(within(tabela).getByText("EXC-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("EXC-2026-0006")).toBeInTheDocument();
    expect(within(tabela).queryByText("EXC-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("EXC-2026-0001")).toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma exceção", () => {
    render(<ExcecoesPontoScreen />);

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "marcacao_ausente" },
    });
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "em_analise_rh" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma exceção corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<ExcecoesPontoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Exceções de Ponto para priorização e revisão do RH",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma exceção de Ponto nesta empresa",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<ExcecoesPontoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as exceções de Ponto",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-001145/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Exceções de Ponto para priorização e revisão do RH",
      }),
    ).toBeInTheDocument();
  });

  it("não contém CPF, nome real, empresa real, e-mail, IP, arquivo ou valor financeiro", () => {
    render(<ExcecoesPontoScreen />);

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "r$",
      ".pdf",
      "localstorage",
      "@",
      "http://",
      "https://",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
