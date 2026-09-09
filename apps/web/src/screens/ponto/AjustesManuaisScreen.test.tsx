import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AjustesManuaisScreen } from "./AjustesManuaisScreen";

describe("AjustesManuaisScreen (T077 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<AjustesManuaisScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Ajustes manuais",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o RH revisa somente solicitações da própria empresa", () => {
    render(<AjustesManuaisScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o rh revisa somente solicitações de ajuste da própria empresa/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login real, API, persistência ou alteração de ponto", () => {
    render(<AjustesManuaisScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login real, api, persistência, alteração de ponto ou dado real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que ajustes não geram saldo/compensação/quitação/pagamento/desconto/Folha/fechamento", () => {
    render(<AjustesManuaisScreen />);

    expect(screen.getByText("Sem impacto financeiro")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não geram saldo, compensação, quitação, pagamento, desconto, folha ou fechamento automaticamente/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que período fechado exige fluxo específico de reabertura autorizada", () => {
    render(<AjustesManuaisScreen />);

    expect(screen.getByText("Período fechado")).toBeInTheDocument();
    expect(
      screen.getByText(
        /períodos fechados exigirão fluxo específico de reabertura autorizada/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que dado real segue bloqueado por MFA, DS-OPS-01, auditoria e retenção/base legal", () => {
    render(<AjustesManuaisScreen />);

    expect(screen.getByText("Dado real bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra a linha do tempo informativa e explica o papel do gestor e da autorização futura", () => {
    render(<AjustesManuaisScreen />);

    expect(
      screen.getByText("Como funciona (fluxo apenas informativo)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Solicitação")).toBeInTheDocument();
    expect(screen.getByText("Revisão do RH")).toBeInTheDocument();
    expect(
      screen.getByText("Validação/recomendação do gestor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Registro aditivo autorizado")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o gestor valida ou recomenda o ajuste, mas não altera a marcação bruta/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /qualquer operação real depende de fluxo autorizado e de regras ainda em validação/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista os ajustes cobrindo os quatro tipos, com referência, período, vínculo, motivo e trilha", () => {
    render(<AjustesManuaisScreen />);

    const tabela = screen.getByRole("table", {
      name: "Ajustes manuais de marcação (exemplo)",
    });
    const dentro = within(tabela);

    // "Marcação ausente"/"Divergência técnica"/"Ajuste de jornada" aparecem em
    // duas linhas cada (para exercitar o filtro por tipo em outro teste), por
    // isso usamos getAllByText; "Justificativa pendente" é única.
    expect(dentro.getAllByText("Marcação ausente").length).toBe(2);
    expect(dentro.getAllByText("Divergência técnica").length).toBe(2);
    expect(dentro.getAllByText("Ajuste de jornada").length).toBe(2);
    expect(dentro.getByText("Justificativa pendente")).toBeInTheDocument();

    const linha = dentro.getByText("AJU-2026-0002").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("06/03/2026")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("V-027")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("DIVERGENCIA_TECNICA_DEMO"),
    ).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Em revisão do RH")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Pendente")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por tipo, situação e validação do gestor", () => {
    render(<AjustesManuaisScreen />);

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "justificativa_pendente" },
    });

    const tabela = screen.getByRole("table", {
      name: "Ajustes manuais de marcação (exemplo)",
    });
    expect(within(tabela).getByText("AJU-2026-0004")).toBeInTheDocument();
    expect(within(tabela).queryByText("AJU-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("AJU-2026-0001")).toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhum ajuste", () => {
    render(<AjustesManuaisScreen />);

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "marcacao_ausente" },
    });
    fireEvent.change(screen.getByLabelText("Validação do gestor"), {
      target: { value: "nao_recomendado" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhum ajuste corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', com marcação original preservada e evento aditivo futuro", () => {
    render(<AjustesManuaisScreen />);

    const linha = screen.getByText("AJU-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Detalhe do ajuste — Marcação ausente",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sem marcação registrada (exemplo)"),
    ).toBeInTheDocument();
    expect(screen.getByText("08:00 (ilustrativo)")).toBeInTheDocument();
    expect(
      screen.getByText("A marcação original não é apagada nem sobrescrita."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /registrado como um evento aditivo e auditável — nunca substitui a marcação original/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /abrir este detalhe não cria, salva, aprova, nega, reabre nem aplica nenhum ajuste real/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<AjustesManuaisScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Ajustes manuais de marcação (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma solicitação de ajuste cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<AjustesManuaisScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar os ajustes manuais",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-001482/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Ajustes manuais de marcação (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("não contém CPF, nome de empresa/pessoa, e-mail, IP, arquivo, AFD ou valor financeiro", () => {
    render(<AjustesManuaisScreen />);

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "cnpj",
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "afd",
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

  it("não declara cálculo de jornada, saldo, Banco de Horas, DSR, Folha ou conformidade normativa", () => {
    render(<AjustesManuaisScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "banco de horas",
      "dsr",
      "clt",
      "cct",
      "portaria 671",
      "lgpd",
      "esocial",
      "cálculo de jornada",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
