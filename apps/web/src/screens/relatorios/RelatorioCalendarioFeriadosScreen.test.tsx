import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatorioCalendarioFeriadosScreen } from "./RelatorioCalendarioFeriadosScreen";

describe("RelatorioCalendarioFeriadosScreen (T102 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Calendário de Feriados",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, criação, importação, edição, ativação, aplicação, cálculo, exportação ou Folha", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, criação, importação, edição, ativação, aplicação, cálculo, exportação ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que o calendário não é regra aplicada e não altera unidade, escala, jornada, ponto, marcação original, Banco de Horas, remuneração, benefícios, documentos, permissões ou acessos", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    expect(
      screen.getByText("Calendário não é regra aplicada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram unidade, escala, jornada, ponto, marcação original, banco de horas, remuneração, benefícios, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há cálculo de jornada, escala, horas, extras, faltas, saldo, pagamento, desconto, compensação ou evento de Folha", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Categorias de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 categoria(s) de referência (exemplo)"),
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
        /não há cálculo de jornada, escala, horas, extras, faltas, saldo, pagamento, desconto, compensação ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, período, categoria, escopo, abrangência, situação, responsável e trilha", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Calendário de Feriados (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("CFR-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Período P-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Categoria de referência C-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Abrangência ilustrativa A-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Calendario-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por escopo de referência, situação e período ilustrativo", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    fireEvent.change(screen.getByLabelText("Escopo de referência"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Calendário de Feriados (exemplo)",
    });
    expect(within(tabela).getByText("CFR-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("CFR-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("CFR-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("CFR-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("CFR-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("CFR-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("CFR-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("CFR-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Período ilustrativo"), {
      target: { value: "Período P-01 (exemplo)" },
    });
    expect(screen.getByText("CFR-2026-0001")).toBeInTheDocument();
    expect(screen.queryByText("CFR-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Escopo de referência"), {
      target: { value: "Escopo E-02 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    const linha = screen.getByText("CFR-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — CFR-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Categoria de referência C-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Abrangência ilustrativa A-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("RT-Calendario-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de calendário \(exemplo ilustrativo, sem criação, importação ou ativação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, importa, ativa, desativa, aplica, atribui, recalcula, marca, ajusta, compensa, fecha, salva, gera, exporta nem integra calendários reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    const linha = screen.getByText("CFR-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Calendário de Feriados (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de calendário cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de calendário",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-022678/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Calendário de Feriados (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa criação, importação ou ação mutante (criar, editar, importar, ativar, desativar, aplicar, atribuir, recalcular, marcar, ajustar, compensar, salvar, gerar, exportar, integrar)", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

    const linha = screen.getByText("CFR-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      // "fechar" fica de fora da lista: é o rótulo legítimo e obrigatório do
      // único botão do painel de detalhe (fecha a demonstração, não o
      // calendário real).
      expect(rotulo).not.toMatch(
        /criar|editar|importar|ativar|desativar|aplicar|atribuir|recalcular|marcar|ajustar|compensar|salvar|gerar|exportar|integrar/,
      );
    }
  });

  it("não contém nome oficial de feriado, data real, localidade real, PII ou marca de terceiros", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

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
      "natal",
      "páscoa",
      "carnaval",
      "tiradentes",
      "independência",
      "r$",
      "localstorage",
      "@",
      "http://",
      "https://",
      ".pdf",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
    // Sem data real (dd/mm/aaaa) em nenhum campo.
    expect(document.body.innerHTML).not.toMatch(
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
    );
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<RelatorioCalendarioFeriadosScreen />);

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
