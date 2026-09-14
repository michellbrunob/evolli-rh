import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EspelhoPontoScreen } from "./EspelhoPontoScreen";

describe("EspelhoPontoScreen (T099 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<EspelhoPontoScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Espelho de Ponto",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<EspelhoPontoScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, geração, assinatura, exportação, ajuste, contestação, fechamento ou Folha", () => {
    render(<EspelhoPontoScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, geração, assinatura, exportação, ajuste, contestação, fechamento ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que a visualização não é espelho oficial e não altera marcação original, ponto, vínculo, jornada, Banco de Horas, remuneração, benefícios, documentos, permissões ou acessos", () => {
    render(<EspelhoPontoScreen />);

    expect(
      screen.getByText("Visualização não é espelho oficial"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram marcação original, ponto, vínculo, jornada, banco de horas, remuneração, benefícios, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<EspelhoPontoScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há cálculo de horas, extras, faltas, DSR, saldo, pagamento, desconto, compensação ou evento de Folha", () => {
    render(<EspelhoPontoScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Tipos de evidência")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 tipo(s) de evidência (exemplo)"),
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
        /não há cálculo de horas, extras, faltas, dsr, saldo, pagamento, desconto, compensação ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, período, tipo de evidência, situação, visibilidade, escopo, responsável e trilha", () => {
    render(<EspelhoPontoScreen />);

    const tabela = screen.getByRole("table", {
      name: "Espelho de Ponto (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("ESP-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Período P-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Evidência ilustrativa V-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RH da unidade (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Espelho-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por período ilustrativo, situação e escopo técnico", () => {
    render(<EspelhoPontoScreen />);

    fireEvent.change(screen.getByLabelText("Período ilustrativo"), {
      target: { value: "Período P-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Espelho de Ponto (exemplo)",
    });
    expect(within(tabela).getByText("ESP-2026-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("ESP-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("ESP-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("ESP-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("ESP-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("ESP-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("ESP-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("ESP-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("ESP-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("ESP-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<EspelhoPontoScreen />);

    fireEvent.change(screen.getByLabelText("Período ilustrativo"), {
      target: { value: "Período P-01 (exemplo)" },
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
    render(<EspelhoPontoScreen />);

    const linha = screen.getByText("ESP-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — ESP-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Evidência ilustrativa V-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("RH da unidade (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("RT-Espelho-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de visualização de espelho \(exemplo ilustrativo, sem geração, assinatura ou exportação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, marca, ajusta, contesta, aprova, recusa, fecha, reabre, assina, gera, exporta, salva, importa nem integra espelhos reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<EspelhoPontoScreen />);

    const linha = screen.getByText("ESP-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<EspelhoPontoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Espelho de Ponto (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de espelho cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<EspelhoPontoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de espelho",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-019341/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Espelho de Ponto (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa geração, assinatura ou ação mutante (criar, editar, marcar, ajustar, contestar, aprovar, recusar, reabrir, assinar, gerar, exportar, salvar, importar, integrar)", () => {
    render(<EspelhoPontoScreen />);

    const linha = screen.getByText("ESP-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      // "fechar" fica de fora da lista: é o rótulo legítimo e obrigatório do
      // único botão do painel de detalhe (fecha a demonstração, não o
      // espelho real).
      expect(rotulo).not.toMatch(
        /criar|marcar|ajustar|contestar|aprovar|recusar|reabrir|assinar|gerar|exportar|salvar|importar|editar|integrar/,
      );
    }
  });

  it("não contém nomes, horários reais, datas reais, marcações reais, documentos ou dado pessoal real", () => {
    render(<EspelhoPontoScreen />);

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
    // Sem data real (dd/mm/aaaa) nem horário real (HH:MM) em nenhum campo.
    expect(document.body.innerHTML).not.toMatch(
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
    );
    expect(document.body.innerHTML).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<EspelhoPontoScreen />);

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
