import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DadosContratuaisScreen } from "./DadosContratuaisScreen";

describe("DadosContratuaisScreen (T089 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<DadosContratuaisScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Dados contratuais",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<DadosContratuaisScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, alteração contratual, admissão, desligamento ou Folha", () => {
    render(<DadosContratuaisScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, alteração contratual, admissão, desligamento ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que referência não é contrato e não cria/modifica/confirma vínculo, função, cargo, remuneração, benefício, jornada, ponto, Banco de Horas, documentos, permissões ou acessos", () => {
    render(<DadosContratuaisScreen />);

    expect(screen.getByText("Referência não é contrato")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não criam, modificam ou confirmam vínculo, função, cargo, remuneração, benefício, jornada, ponto, banco de horas, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<DadosContratuaisScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há cálculo financeiro, pagamento, desconto ou evento de Folha", () => {
    render(<DadosContratuaisScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Vínculos de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 vínculo(s) de referência (exemplo)"),
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
        /não criam, alteram, reconhecem, aprovam ou encerram vínculo; não há cálculo financeiro, pagamento, desconto ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, vínculo, modalidade, referência organizacional, período, situação, responsável e trilha", () => {
    render(<DadosContratuaisScreen />);

    const tabela = screen.getByRole("table", {
      name: "Dados contratuais (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("DC-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Vínculo V-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Modalidade de estágio (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Período P-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Contratual-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por modalidade de referência, situação e escopo/unidade técnica", () => {
    render(<DadosContratuaisScreen />);

    fireEvent.change(screen.getByLabelText("Modalidade de referência"), {
      target: { value: "Modalidade direta (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Dados contratuais (exemplo)",
    });
    expect(within(tabela).getByText("DC-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("DC-2026-0005")).toBeInTheDocument();
    expect(within(tabela).getByText("DC-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("DC-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("DC-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("DC-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("DC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("DC-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo/unidade técnica"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("DC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("DC-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("DC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("DC-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<DadosContratuaisScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Escopo/unidade técnica"), {
      target: { value: "Escopo E-02 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<DadosContratuaisScreen />);

    const linha = screen.getByText("DC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — DC-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Vínculo V-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Modalidade direta (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de vínculo contratual e escopo organizacional \(exemplo ilustrativo, sem criação ou alteração real de contrato, remuneração ou jornada\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, admite, desliga, altera contrato, remuneração, jornada, ponto, folha, documentos, permissões, acessos, importa, exporta nem integra dados reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<DadosContratuaisScreen />);

    const linha = screen.getByText("DC-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<DadosContratuaisScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Dados contratuais (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de dados contratuais cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<DadosContratuaisScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de dados contratuais",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-009021/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Dados contratuais (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa admissão, desligamento ou ação mutante/financeira (criar, admitir, desligar, salvar, importar, exportar, aprovar, editar)", () => {
    render(<DadosContratuaisScreen />);

    const linha = screen.getByText("DC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|admitir|transferir|promover|desligar|salvar|importar|exportar|aprovar|excluir|editar/,
      );
    }
  });

  it("não contém nomes, empresa real, CPF, e-mail, telefone, IP, matrícula, salário, valor ou dado pessoal real", () => {
    render(<DadosContratuaisScreen />);

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
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<DadosContratuaisScreen />);

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
