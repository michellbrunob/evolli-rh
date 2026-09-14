import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JustificativasScreen } from "./JustificativasScreen";

describe("JustificativasScreen (T097 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<JustificativasScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Justificativas",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<JustificativasScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, envio, anexo, validação, aprovação, recusa, abono, ajuste, fechamento ou Folha", () => {
    render(<JustificativasScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, envio, anexo, validação, aprovação, recusa, abono, ajuste, fechamento ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que referência não é justificativa efetivada e não altera marcação original, ponto, vínculo, jornada, Banco de Horas, remuneração, benefícios, documentos, permissões ou acessos", () => {
    render(<JustificativasScreen />);

    expect(
      screen.getByText("Referência não é justificativa efetivada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não alteram marcação original, ponto, vínculo, jornada, banco de horas, remuneração, benefícios, documentos, permissões ou acessos/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal, validações aplicáveis e controles adicionais de privacidade/saúde ocupacional", () => {
    render(<JustificativasScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /dados de saúde exigem controles adicionais de privacidade e saúde ocupacional/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não há cálculo de horas, faltas, saldo, abono, pagamento, desconto, compensação ou evento de Folha", () => {
    render(<JustificativasScreen />);

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
        /não há cálculo de horas, faltas, saldo, abono, pagamento, desconto, compensação ou evento de folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, categoria, período, visibilidade, escopo, situação, encaminhamento e trilha", () => {
    render(<JustificativasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Justificativas (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("JUS-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Categoria de referência C-03 (exemplo)"),
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
      dentroDaLinha.getByText("Encaminhado a RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por categoria, situação e escopo técnico", () => {
    render(<JustificativasScreen />);

    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "Categoria de referência C-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Justificativas (exemplo)",
    });
    expect(within(tabela).getByText("JUS-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("JUS-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("JUS-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("JUS-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("JUS-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("JUS-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("JUS-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("JUS-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("JUS-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("JUS-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("JUS-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("JUS-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<JustificativasScreen />);

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
    render(<JustificativasScreen />);

    const linha = screen.getByText("JUS-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — JUS-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Categoria de referência C-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("RH da unidade (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Encaminhado a RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de justificativa \(exemplo ilustrativo, sem envio, anexo ou validação real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, envia, anexa, recebe, valida, aprova, recusa, abona, ajusta, fecha, reabre, salva, importa, exporta nem integra justificativas reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<JustificativasScreen />);

    const linha = screen.getByText("JUS-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<JustificativasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Justificativas (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de justificativa cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<JustificativasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de justificativas",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-017115/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Justificativas (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa envio, aprovação ou ação mutante (criar, editar, enviar, anexar, receber, validar, aprovar, recusar, abonar, ajustar, reabrir, salvar, importar, exportar, integrar)", () => {
    render(<JustificativasScreen />);

    const linha = screen.getByText("JUS-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      // "fechar" fica de fora da lista: é o rótulo legítimo e obrigatório do
      // único botão do painel de detalhe (fecha a demonstração, não a
      // justificativa real).
      expect(rotulo).not.toMatch(
        /criar|enviar|anexar|receber|validar|aprovar|recusar|abonar|ajustar|reabrir|salvar|importar|exportar|editar|integrar/,
      );
    }
  });

  it("não contém nome de pessoa, CPF, data real, dado clínico, CID, atestado, laudo, documento ou dado pessoal real", () => {
    render(<JustificativasScreen />);

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
    // Verifica "CID" isolado, sem falso positivo com "privacidade" (exigido
    // no aviso de dados reais bloqueados / saúde ocupacional).
    expect(texto).not.toMatch(/\bcid\b/);
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial", () => {
    render(<JustificativasScreen />);

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
