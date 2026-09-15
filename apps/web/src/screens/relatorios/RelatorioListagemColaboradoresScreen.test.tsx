import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatorioListagemColaboradoresScreen } from "./RelatorioListagemColaboradoresScreen";

describe("RelatorioListagemColaboradoresScreen (T103 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Listagem de Colaboradores",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, geração, exportação, admissão, edição, desligamento, alteração de vínculo ou Folha", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, geração, exportação, admissão, edição, desligamento, alteração de vínculo ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que a listagem não é cadastro e não altera colaborador, vínculo, função, cargo, jornada, ponto, Banco de Horas, remuneração, benefícios, documentos, permissões ou acessos", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    expect(screen.getByText("Listagem não é cadastro")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram colaborador, vínculo, função, cargo, jornada, ponto, banco de horas, remuneração, benefícios, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há PII, cálculo, pagamento, desconto, elegibilidade, evento de Folha ou decisão operacional", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Categorias de vínculo"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 categoria(s) de vínculo (exemplo)"),
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
        /não há pii, cálculo, pagamento, desconto, elegibilidade, evento de folha ou decisão operacional/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, vínculo, categoria, escopo, situação, função, responsável e trilha", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    const tabela = screen.getByRole("table", {
      name: "Listagem de Colaboradores (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("LCO-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Vínculo técnico ilustrativo V-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Categoria de vínculo C-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Função de referência F-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Colaboradores-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por situação de referência, escopo técnico e categoria de vínculo", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    fireEvent.change(screen.getByLabelText("Situação de referência"), {
      target: { value: "historico_ilustrativo" },
    });

    const tabela = screen.getByRole("table", {
      name: "Listagem de Colaboradores (exemplo)",
    });
    expect(within(tabela).getByText("LCO-2025-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("LCO-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("LCO-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("LCO-2026-0001")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("LCO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("LCO-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("LCO-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("LCO-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Categoria de vínculo"), {
      target: { value: "Categoria de vínculo C-01 (exemplo)" },
    });
    expect(screen.getByText("LCO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("LCO-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("LCO-2025-0001")).toBeInTheDocument();
    expect(screen.queryByText("LCO-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    fireEvent.change(screen.getByLabelText("Situação de referência"), {
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
    render(<RelatorioListagemColaboradoresScreen />);

    const linha = screen.getByText("LCO-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — LCO-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Categoria de vínculo C-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Função de referência F-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("RT-Colaboradores-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de vínculo \(exemplo ilustrativo, sem identificação, admissão ou vinculação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, identifica, admite, desliga, vincula, atribui, aprova, salva, calcula, paga, desconta, gera, exporta, importa nem integra colaboradores reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    const linha = screen.getByText("LCO-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Listagem de Colaboradores (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de vínculo cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de colaboradores",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-023789/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Listagem de Colaboradores (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa identificação, admissão ou ação mutante (criar, editar, identificar, admitir, desligar, vincular, atribuir, aprovar, salvar, calcular, pagar, descontar, gerar, exportar, importar, integrar)", () => {
    render(<RelatorioListagemColaboradoresScreen />);

    const linha = screen.getByText("LCO-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|editar|identificar|admitir|desligar|vincular|atribuir|aprovar|salvar|calcular|pagar|descontar|gerar|exportar|importar|integrar/,
      );
    }
  });

  it("não contém nomes, CPF, matrícula real, e-mail, telefone, endereço, data de nascimento, documento ou dado pessoal real", () => {
    render(<RelatorioListagemColaboradoresScreen />);

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
      "e-mail",
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
    // Sem data real (dd/mm/aaaa) em nenhum campo.
    expect(document.body.innerHTML).not.toMatch(
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
    );
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<RelatorioListagemColaboradoresScreen />);

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
