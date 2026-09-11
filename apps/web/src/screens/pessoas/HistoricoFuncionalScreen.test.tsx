import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoricoFuncionalScreen } from "./HistoricoFuncionalScreen";

describe("HistoricoFuncionalScreen (T088 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<HistoricoFuncionalScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Histórico funcional",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<HistoricoFuncionalScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, alteração cadastral, admissão, transferência, promoção, desligamento ou integração real", () => {
    render(<HistoricoFuncionalScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, alteração cadastral, admissão, transferência, promoção, desligamento ou integração real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que histórico não é alteração e não altera colaborador, cargo, função, salário, jornada, ponto, documentos, Banco de Horas, Folha, permissão ou acesso", () => {
    render(<HistoricoFuncionalScreen />);

    expect(screen.getByText("Histórico não é alteração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /referências de vínculo e movimentação não alteram colaborador, cargo, função, salário, jornada, ponto, documentos, banco de horas, folha, permissão ou acesso/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações de RH/Jurídico/Folha-DP/TI", () => {
    render(<HistoricoFuncionalScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade, folha\/dp e ti/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não criam/alteram/reconhecem vínculo/etc.", () => {
    render(<HistoricoFuncionalScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Vínculos de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 vínculo(s) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Movimentos ilustrativos"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "7 movimento(s) funcional(is) ilustrativo(s) (exemplo)",
      ),
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
        /não criam, alteram, reconhecem, aprovam ou encerram vínculo; não calculam remuneração, pagamento, desconto, jornada, banco de horas, folha ou integração/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, vínculo, tipo de evento, referência organizacional, período, situação, responsável e trilha", () => {
    render(<HistoricoFuncionalScreen />);

    const tabela = screen.getByRole("table", {
      name: "Histórico funcional (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("HF-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Vínculo V-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Afastamento ilustrativo (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Org O-03 (exemplo)")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Período P-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Historico-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por tipo de evento, situação e referência organizacional", () => {
    render(<HistoricoFuncionalScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de evento"), {
      target: { value: "Admissão ilustrativa (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Histórico funcional (exemplo)",
    });
    expect(within(tabela).getByText("HF-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("HF-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("HF-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("HF-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("HF-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("HF-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("HF-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Referência organizacional"), {
      target: { value: "Org O-01 (exemplo)" },
    });
    expect(screen.getByText("HF-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("HF-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("HF-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("HF-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<HistoricoFuncionalScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Referência organizacional"), {
      target: { value: "Org O-02 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<HistoricoFuncionalScreen />);

    const linha = screen.getByText("HF-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — HF-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Vínculo V-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Admissão ilustrativa (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de vínculo e movimentação funcional \(exemplo ilustrativo, sem alteração real de cargo, salário ou vínculo\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, admite, transfere, promove, altera salário, altera jornada, desliga, bloqueia acesso, salva, importa, exporta, aprova nem integra dados reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<HistoricoFuncionalScreen />);

    const linha = screen.getByText("HF-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<HistoricoFuncionalScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Histórico funcional (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de histórico funcional cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<HistoricoFuncionalScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de histórico funcional",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-008014/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Histórico funcional (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa admissão, transferência, promoção, desligamento ou ação mutante/financeira (criar, admitir, transferir, promover, desligar, salvar, importar, exportar, aprovar)", () => {
    render(<HistoricoFuncionalScreen />);

    const linha = screen.getByText("HF-2026-0001").closest("tr")!;
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
    render(<HistoricoFuncionalScreen />);

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

  it("não declara conformidade com CLT, CCT, Portaria 671, LGPD ou eSocial", () => {
    render(<HistoricoFuncionalScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "clt",
      "cct",
      "portaria 671",
      "lgpd",
      "esocial",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
