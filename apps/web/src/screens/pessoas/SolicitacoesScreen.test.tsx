import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SolicitacoesScreen } from "./SolicitacoesScreen";

describe("SolicitacoesScreen (T091 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<SolicitacoesScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Solicitações",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<SolicitacoesScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, abertura, aprovação, recusa, cancelamento ou encaminhamento real", () => {
    render(<SolicitacoesScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, abertura, aprovação, recusa, cancelamento ou encaminhamento real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que acompanhamento não é decisão e não concede direito, não aprova/recusa e não altera vínculo, ponto, Banco de Horas, Folha, documentos, permissões ou acessos", () => {
    render(<SolicitacoesScreen />);

    expect(
      screen.getByText("Acompanhamento não é decisão"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não concedem direito, não aprovam nem recusam solicitação e não alteram vínculo, ponto, banco de horas, folha, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<SolicitacoesScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há SLA operacional, cálculo, pagamento, desconto, quitação ou evento de Folha", () => {
    render(<SolicitacoesScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Tipos de solicitação"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 tipo(s) de solicitação (exemplo)"),
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
        /não representam sla operacional, cálculo, pagamento, desconto, quitação ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, tipo, período, escopo, situação, encaminhamento, responsável e trilha", () => {
    render(<SolicitacoesScreen />);

    const tabela = screen.getByRole("table", {
      name: "Solicitações (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("SOL-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Tipo de referência R-03 (exemplo)"),
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
      dentroDaLinha.getByText("Aguardando retorno da unidade (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Solicitacoes-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por tipo de referência, situação e escopo técnico", () => {
    render(<SolicitacoesScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de referência"), {
      target: { value: "Tipo de referência R-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Solicitações (exemplo)",
    });
    expect(within(tabela).getByText("SOL-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("SOL-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("SOL-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("SOL-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("SOL-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("SOL-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("SOL-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("SOL-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("SOL-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("SOL-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("SOL-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("SOL-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<SolicitacoesScreen />);

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
    render(<SolicitacoesScreen />);

    const linha = screen.getByText("SOL-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — SOL-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Tipo de referência R-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Em validação técnica (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de acompanhamento de solicitação \(exemplo ilustrativo, sem abertura, aprovação ou recusa real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, envia, aprova, recusa, devolve, cancela, efetiva, assina, anexa, notifica, importa, exporta nem integra solicitações reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<SolicitacoesScreen />);

    const linha = screen.getByText("SOL-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<SolicitacoesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Solicitações (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de solicitação cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<SolicitacoesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de solicitações",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-011048/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Solicitações (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa abertura, aprovação, recusa ou ação mutante (criar, enviar, aprovar, recusar, devolver, cancelar, efetivar, assinar, anexar, notificar, importar, exportar, editar)", () => {
    render(<SolicitacoesScreen />);

    const linha = screen.getByText("SOL-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|enviar|aprovar|recusar|devolver|cancelar|efetivar|assinar|anexar|notificar|importar|exportar|editar/,
      );
    }
  });

  it("não contém nomes, empresa real, CPF, e-mail, telefone, IP, matrícula, salário, valor ou dado pessoal real", () => {
    render(<SolicitacoesScreen />);

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
    render(<SolicitacoesScreen />);

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
