import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExtratoBancoHorasScreen } from "./ExtratoBancoHorasScreen";

describe("ExtratoBancoHorasScreen (T098 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<ExtratoBancoHorasScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Extrato de Banco de Horas",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<ExtratoBancoHorasScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, cálculo, movimentação, compensação, quitação, fechamento, geração, exportação ou Folha", () => {
    render(<ExtratoBancoHorasScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, cálculo, movimentação, compensação, quitação, fechamento, geração, exportação ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que extrato não é saldo operacional e não altera crédito, débito, saldo derivado, ponto, vínculo, jornada, remuneração, benefícios, documentos, permissões ou acessos", () => {
    render(<ExtratoBancoHorasScreen />);

    expect(
      screen.getByText("Extrato não é saldo operacional"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram crédito, débito, saldo derivado, ponto, vínculo, jornada, remuneração, benefícios, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<ExtratoBancoHorasScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há cálculo de saldo, compensação, quitação, pagamento, desconto, DSR ou evento de Folha", () => {
    render(<ExtratoBancoHorasScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Créditos ilustrativos"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 referência(s) de crédito (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Débitos ilustrativos"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 referência(s) de débito (exemplo)"),
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
        /não há cálculo de saldo, compensação, quitação, pagamento, desconto, dsr ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, período, tipo, crédito, débito, saldo, situação e trilha", () => {
    render(<ExtratoBancoHorasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Extrato de Banco de Horas (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("EXT-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Período P-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Ajuste ilustrativo (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Sem crédito ilustrativo (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Sem débito ilustrativo (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Referência neutra (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("não usa números nem valores monetários para crédito, débito ou saldo (textos ilustrativos)", () => {
    render(<ExtratoBancoHorasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Extrato de Banco de Horas (exemplo)",
    });
    const dentro = within(tabela);

    for (const texto of [
      "Crédito ilustrativo presente (exemplo)",
      "Sem crédito ilustrativo (exemplo)",
      "Débito ilustrativo presente (exemplo)",
      "Sem débito ilustrativo (exemplo)",
      "Referência positiva (exemplo)",
      "Referência negativa (exemplo)",
      "Referência neutra (exemplo)",
    ]) {
      expect(dentro.getAllByText(texto).length).toBeGreaterThan(0);
    }

    expect(document.body.innerHTML).not.toMatch(/\d+\s*(min|h|hora)/i);
    expect(document.body.innerHTML.toLowerCase()).not.toContain("r$");
  });

  it("filtra localmente por período ilustrativo, tipo de referência e situação", () => {
    render(<ExtratoBancoHorasScreen />);

    fireEvent.change(screen.getByLabelText("Período ilustrativo"), {
      target: { value: "Período P-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Extrato de Banco de Horas (exemplo)",
    });
    expect(within(tabela).getByText("EXT-2026-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("EXT-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("EXT-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tipo de movimento de referência"), {
      target: { value: "credito_ilustrativo_exemplo" },
    });
    expect(screen.getByText("EXT-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("EXT-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("EXT-2025-0001")).toBeInTheDocument();
    expect(screen.queryByText("EXT-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("EXT-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("EXT-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("EXT-2026-0001")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<ExtratoBancoHorasScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de movimento de referência"), {
      target: { value: "ajuste_ilustrativo_exemplo" },
    });
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<ExtratoBancoHorasScreen />);

    const linha = screen.getByText("EXT-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — EXT-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Crédito ilustrativo (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Crédito ilustrativo presente (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Sem débito ilustrativo (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Referência positiva (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de extrato \(exemplo ilustrativo, sem cálculo, movimentação ou compensação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, calcula, movimenta, compensa, quita, fecha, reabre, paga, desconta, salva, gera, exporta, importa nem integra extratos reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<ExtratoBancoHorasScreen />);

    const linha = screen.getByText("EXT-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<ExtratoBancoHorasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Extrato de Banco de Horas (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de extrato cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<ExtratoBancoHorasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de extrato",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-018230/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Extrato de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa cálculo, movimentação ou ação mutante (criar, editar, calcular, movimentar, compensar, quitar, reabrir, pagar, descontar, salvar, gerar, exportar, importar, integrar)", () => {
    render(<ExtratoBancoHorasScreen />);

    const linha = screen.getByText("EXT-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      // "fechar" fica de fora da lista: é o rótulo legítimo e obrigatório do
      // único botão do painel de detalhe (fecha a demonstração, não o
      // extrato real).
      expect(rotulo).not.toMatch(
        /criar|calcular|movimentar|compensar|quitar|reabrir|pagar|descontar|salvar|gerar|exportar|importar|editar|integrar/,
      );
    }
  });

  it("não contém dados reais, PII, horário real, valor monetário, URL, PDF ou marca de terceiros", () => {
    render(<ExtratoBancoHorasScreen />);

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
      "r$",
      "localstorage",
      "@",
      "http://",
      "https://",
      ".pdf",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
    // "pagamento" fica de fora da lista: só aparece como negação obrigatória
    // na nota do resumo ("não há ... pagamento ... nestes indicadores"),
    // mesmo tratamento já usado para "SLA" em SolicitacoesScreen (T091).
    expect(texto).toMatch(/não há cálculo[^.]*\bpagamento\b/);
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<ExtratoBancoHorasScreen />);

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
