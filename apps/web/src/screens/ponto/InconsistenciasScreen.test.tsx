import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InconsistenciasScreen } from "./InconsistenciasScreen";

describe("InconsistenciasScreen (T096 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<InconsistenciasScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Inconsistências",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<InconsistenciasScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, correção, ajuste, aprovação, bloqueio, fechamento ou Folha", () => {
    render(<InconsistenciasScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, correção, ajuste, aprovação, bloqueio, fechamento ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que o indicador não é decisão e não altera marcação original, ponto, vínculo, Banco de Horas, remuneração, benefícios, documentos, permissões ou acessos", () => {
    render(<InconsistenciasScreen />);

    expect(screen.getByText("Indicador não é decisão")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não altera marcação original, ponto, vínculo, banco de horas, remuneração, benefícios, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<InconsistenciasScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há cálculo de horas, extras, faltas, DSR, saldo, pagamento, desconto, compensação ou evento de Folha", () => {
    render(<InconsistenciasScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Prioridade alta")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("2 referência(s) de prioridade alta (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Aguardando análise")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 item(ns) aguardando análise (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Em verificação")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("2 item(ns) em verificação (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Itens históricos")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("2 item(ns) histórico(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        /não há cálculo de horas, extras, faltas, dsr, saldo, pagamento, desconto, compensação ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, tipo, período, escopo, prioridade, situação, encaminhamento e trilha", () => {
    render(<InconsistenciasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Inconsistências de ponto (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("INC-2026-0003").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Marcação fora de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Período P-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Prioridade alta (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando análise (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Sem encaminhamento definido (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("1 evento registrado (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por tipo de inconsistência, prioridade e situação", () => {
    render(<InconsistenciasScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de inconsistência"), {
      target: { value: "marcacao_ausente_exemplo" },
    });

    const tabela = screen.getByRole("table", {
      name: "Inconsistências de ponto (exemplo)",
    });
    expect(within(tabela).getByText("INC-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("INC-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("INC-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("INC-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prioridade"), {
      target: { value: "alta_exemplo" },
    });
    expect(screen.getByText("INC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("INC-2026-0003")).toBeInTheDocument();
    expect(screen.queryByText("INC-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("INC-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("INC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("INC-2026-0001")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<InconsistenciasScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de inconsistência"), {
      target: { value: "dado_importacao_nao_associado_exemplo" },
    });
    fireEvent.change(screen.getByLabelText("Prioridade"), {
      target: { value: "alta_exemplo" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<InconsistenciasScreen />);

    const linha = screen.getByText("INC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — INC-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Marcação ausente (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Prioridade alta (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Encaminhado a RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Análise RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de inconsistência de ponto \(exemplo ilustrativo, sem correção, ajuste ou aprovação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, corrige, ajusta, aprova, recusa, bloqueia, fecha, reabre, calcula, compensa, salva, importa, exporta nem integra inconsistências reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<InconsistenciasScreen />);

    const linha = screen.getByText("INC-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<InconsistenciasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Inconsistências de ponto (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma inconsistência cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<InconsistenciasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de inconsistências",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-016104/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Inconsistências de ponto (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa criação, correção ou ação mutante (criar, editar, corrigir, ajustar, aprovar, recusar, bloquear, reabrir, calcular, compensar, salvar, importar, exportar, integrar)", () => {
    render(<InconsistenciasScreen />);

    const linha = screen.getByText("INC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      // "fechar" fica de fora da lista: é o rótulo legítimo e obrigatório do
      // único botão do painel de detalhe (fecha a demonstração, não a
      // inconsistência real).
      expect(rotulo).not.toMatch(
        /criar|corrigir|ajustar|aprovar|recusar|bloquear|reabrir|calcular|compensar|salvar|importar|exportar|editar|integrar/,
      );
    }
  });

  it("não contém nomes, empresa real, CPF, e-mail, telefone, horário real de pessoa, valor ou dado pessoal real", () => {
    render(<InconsistenciasScreen />);

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
      "sla",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<InconsistenciasScreen />);

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
