import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AfastamentosScreen } from "./AfastamentosScreen";

describe("AfastamentosScreen (T094 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<AfastamentosScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Afastamentos",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é restrita à própria empresa e unidades autorizadas", () => {
    render(<AfastamentosScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é restrita à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, registro, aprovação, validação, documento, pagamento, desconto ou Folha", () => {
    render(<AfastamentosScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, registro, aprovação, validação, documento, pagamento, desconto ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que referência não é afastamento efetivado e não altera colaborador, vínculo, jornada, ponto, Banco de Horas, benefícios, remuneração, documentos, permissões ou acessos", () => {
    render(<AfastamentosScreen />);

    expect(
      screen.getByText("Referência não é afastamento efetivado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram colaborador, vínculo, jornada, ponto, banco de horas, benefícios, remuneração, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais e saúde ocupacional bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal, controles de acesso e validações de RH/Jurídico/saúde ocupacional", () => {
    render(<AfastamentosScreen />);

    expect(
      screen.getByText("Dados reais e saúde ocupacional bloqueados"),
    ).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade e saúde ocupacional/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há dado clínico, cálculo, pagamento, desconto, benefício, retorno ao trabalho ou evento de Folha", () => {
    render(<AfastamentosScreen />);

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
        /não há dado clínico, cálculo, pagamento, desconto, benefício, retorno ao trabalho ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, categoria, período, visibilidade, escopo, situação, responsável e trilha", () => {
    render(<AfastamentosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Afastamentos (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("AFA-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Categoria de referência A-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Período P-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RH da unidade (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Afastamentos-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por categoria, situação e escopo técnico", () => {
    render(<AfastamentosScreen />);

    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "Categoria de referência A-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Afastamentos (exemplo)",
    });
    expect(within(tabela).getByText("AFA-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("AFA-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("AFA-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("AFA-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("AFA-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("AFA-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("AFA-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("AFA-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("AFA-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("AFA-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("AFA-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("AFA-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<AfastamentosScreen />);

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
    render(<AfastamentosScreen />);

    const linha = screen.getByText("AFA-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — AFA-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Categoria de referência A-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("RH da unidade (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de acompanhamento \(exemplo ilustrativo, sem identificação, registro ou validação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, identifica, registra, valida, diagnostica, aprova, concede, retorna, salva, anexa, exibe, compartilha, calcula, paga, desconta, importa, exporta nem integra afastamentos reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<AfastamentosScreen />);

    const linha = screen.getByText("AFA-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<AfastamentosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Afastamentos (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de afastamento cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<AfastamentosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de afastamentos",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-014082/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Afastamentos (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa registro, aprovação, retorno ao trabalho ou ação mutante (criar, registrar, validar, diagnosticar, aprovar, conceder, retornar, salvar, anexar, compartilhar, calcular, pagar, descontar, importar, exportar, editar)", () => {
    render(<AfastamentosScreen />);

    const linha = screen.getByText("AFA-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|registrar|validar|diagnosticar|aprovar|conceder|retornar|salvar|anexar|compartilhar|calcular|pagar|descontar|importar|exportar|editar/,
      );
    }
  });

  it("não contém nome de pessoa, CPF, data real, diagnóstico, CID, atestado, laudo, documento clínico ou dado pessoal real", () => {
    render(<AfastamentosScreen />);

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
      "diagnóstico",
      "diagnostico",
      "atestado",
      "laudo",
      "r$",
      "localstorage",
      "@",
      "http://",
      "https://",
      ".pdf",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
    // Verifica "CID" (ex.: CID-10) isolado, sem falso positivo com
    // "privacidade" (exigido no aviso de dados/saúde ocupacional bloqueados).
    expect(texto).not.toMatch(/\bcid\b/);
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<AfastamentosScreen />);

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
