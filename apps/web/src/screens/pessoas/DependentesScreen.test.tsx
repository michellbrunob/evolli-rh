import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DependentesScreen } from "./DependentesScreen";

describe("DependentesScreen (T093 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<DependentesScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Dependentes",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<DependentesScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, cadastro, vínculo, validação, documentos, benefício, pagamento, desconto ou Folha", () => {
    render(<DependentesScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, cadastro, vínculo, validação, documentos, benefício, pagamento, desconto ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que referência não é dependente vinculado e não altera colaborador, vínculo, remuneração, elegibilidade, ponto, Banco de Horas, benefícios, documentos, permissões ou acessos", () => {
    render(<DependentesScreen />);

    expect(
      screen.getByText("Referência não é dependente vinculado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram colaborador, vínculo, remuneração, elegibilidade, ponto, banco de horas, benefícios, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<DependentesScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há pessoa identificável, elegibilidade, valor, pagamento, desconto, reembolso ou evento de Folha", () => {
    render(<DependentesScreen />);

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
        /não há pessoa identificável, elegibilidade, valor, pagamento, desconto, reembolso ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, categoria, vínculo, escopo, situação, responsável, gate pendente e trilha", () => {
    render(<DependentesScreen />);

    const tabela = screen.getByRole("table", {
      name: "Dependentes (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("DEP-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Categoria de referência D-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Vínculo ilustrativo V-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Dependentes-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aprovação de referência pendente (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por categoria, situação e escopo técnico", () => {
    render(<DependentesScreen />);

    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "Categoria de referência D-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Dependentes (exemplo)",
    });
    expect(within(tabela).getByText("DEP-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("DEP-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("DEP-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("DEP-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("DEP-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("DEP-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("DEP-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("DEP-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("DEP-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("DEP-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("DEP-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("DEP-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<DependentesScreen />);

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
    render(<DependentesScreen />);

    const linha = screen.getByText("DEP-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — DEP-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Categoria de referência D-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Vínculo ilustrativo V-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de categoria de dependência \(exemplo ilustrativo, sem identificação, vínculo ou validação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, identifica, vincula, valida, comprova, concede, aprova, salva, calcula, desconta, paga, reembolsa, importa, exporta nem integra dependentes reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<DependentesScreen />);

    const linha = screen.getByText("DEP-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<DependentesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Dependentes (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de dependente cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<DependentesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de dependentes",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-013071/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Dependentes (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa identificação, vínculo, validação ou ação mutante (criar, identificar, vincular, validar, comprovar, conceder, aprovar, salvar, calcular, descontar, pagar, reembolsar, importar, exportar, editar)", () => {
    render(<DependentesScreen />);

    const linha = screen.getByText("DEP-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|identificar|vincular|validar|comprovar|conceder|aprovar|salvar|calcular|descontar|pagar|reembolsar|importar|exportar|editar/,
      );
    }
  });

  it("não contém nome de pessoa, data de nascimento, CPF, documento, endereço, e-mail, telefone, valor ou dado pessoal real", () => {
    render(<DependentesScreen />);

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
      "endereço",
      "nascimento",
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
    render(<DependentesScreen />);

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
