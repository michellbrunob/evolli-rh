import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EscalasJornadasScreen } from "./EscalasJornadasScreen";

describe("EscalasJornadasScreen (T095 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<EscalasJornadasScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Escalas e jornadas",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<EscalasJornadasScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, criação, atribuição, ativação, cálculo, marcação, compensação, fechamento ou Folha", () => {
    render(<EscalasJornadasScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, criação, atribuição, ativação, cálculo, marcação, compensação, fechamento ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que referência não é jornada aplicada e não altera colaborador, vínculo, ponto, marcação original, Banco de Horas, benefícios, remuneração, documentos, permissões ou acessos", () => {
    render(<EscalasJornadasScreen />);

    expect(
      screen.getByText("Referência não é jornada aplicada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram colaborador, vínculo, ponto, marcação original, banco de horas, benefícios, remuneração, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<EscalasJornadasScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há cálculo de horas, extras, faltas, DSR, pagamento, desconto, compensação, saldo ou evento de Folha", () => {
    render(<EscalasJornadasScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Jornadas ilustrativas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 jornada(s) ilustrativa(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Em revisão")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 item(ns) em revisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Pendentes de decisão"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("2 item(ns) pendente(s) de decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Itens históricos")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("2 item(ns) histórico(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        /não há cálculo de horas, extras, faltas, dsr, pagamento, desconto, compensação, saldo ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, jornada, tipo, período, escopo, situação, responsável e trilha", () => {
    render(<EscalasJornadasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Escalas e jornadas (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("ESJ-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Jornada ilustrativa J-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Tipo de referência T-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Período P-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Escalas-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por tipo de jornada, situação e escopo técnico", () => {
    render(<EscalasJornadasScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de jornada"), {
      target: { value: "Tipo de referência T-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Escalas e jornadas (exemplo)",
    });
    expect(within(tabela).getByText("ESJ-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("ESJ-2026-0005")).toBeInTheDocument();
    expect(within(tabela).queryByText("ESJ-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("ESJ-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("ESJ-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("ESJ-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("ESJ-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("ESJ-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("ESJ-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("ESJ-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("ESJ-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<EscalasJornadasScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-02 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<EscalasJornadasScreen />);

    const linha = screen.getByText("ESJ-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — ESJ-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Jornada ilustrativa J-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Tipo de referência T-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de escala e jornada \(exemplo ilustrativo, sem criação, atribuição ou ativação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, atribui, ativa, desativa, calcula, marca, ajusta, compensa, fecha, reabre, salva, importa, exporta nem integra escalas e jornadas reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<EscalasJornadasScreen />);

    const linha = screen.getByText("ESJ-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<EscalasJornadasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Escalas e jornadas (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de escala ou jornada cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<EscalasJornadasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de escalas e jornadas",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-015093/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Escalas e jornadas (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa criação, atribuição, ativação ou ação mutante (criar, atribuir, ativar, desativar, calcular, marcar, ajustar, compensar, fechar, reabrir, salvar, importar, exportar, editar)", () => {
    render(<EscalasJornadasScreen />);

    const linha = screen.getByText("ESJ-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      // "fechar" fica de fora da lista: é o rótulo legítimo e obrigatório do
      // único botão do painel de detalhe (fecha a demonstração, não a
      // referência de escala/jornada).
      expect(rotulo).not.toMatch(
        /criar|atribuir|ativar|desativar|calcular|marcar|ajustar|compensar|reabrir|salvar|importar|exportar|editar/,
      );
    }
  });

  it("não contém nomes, empresa real, CPF, e-mail, telefone, horário real de pessoa, valor ou dado pessoal real", () => {
    render(<EscalasJornadasScreen />);

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(document.querySelectorAll("form")).toHaveLength(0);

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
      "telefone",
      "matrícula",
      "matricula",
      "salário",
      "salario",
      "r$",
      "localstorage",
      "@",
      "http://",
      "https://",
      ".pdf",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<EscalasJornadasScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "clt",
      "cct",
      "act",
      "portaria 671",
      "lgpd",
      "esocial",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
