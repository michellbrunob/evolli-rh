import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CentrosCustoScreen } from "./CentrosCustoScreen";

describe("CentrosCustoScreen (T083 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<CentrosCustoScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Centros de custo",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o RH consulta somente referências da própria empresa e unidades autorizadas", () => {
    render(<CentrosCustoScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o rh consulta somente referências de centro de custo da própria empresa e das unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, importação, exportação, cálculo, integração, lançamento ou alteração cadastral", () => {
    render(<CentrosCustoScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, importação, exportação, cálculo, integração, lançamento ou alteração cadastral real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que centro de custo é referência organizacional e não cria rateio, orçamento, pagamento, desconto, lançamento contábil, regra de Folha ou permissão", () => {
    render(<CentrosCustoScreen />);

    expect(
      screen.getByText("Referência não é regra financeira"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /centro de custo é referência organizacional e não cria rateio, orçamento, pagamento, desconto, lançamento contábil, regra de folha ou permissão de acesso/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações de RH/Jurídico/Folha-DP/Contabilidade/TI", () => {
    render(<CentrosCustoScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade, folha\/dp, contabilidade e ti/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não calculam valores/orçamento/rateio/etc.", () => {
    render(<CentrosCustoScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(dentroDoResumo.getByText("Centros de custo")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 centro(s) de custo de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Unidades relacionadas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "3 unidade(s) técnica(s) relacionada(s) (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Em revisão")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "3 referência(s) organizacional(is) em revisão (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Exigem decisão formal"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "2 item(ns) aguardando decisão formal (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Itens históricos")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "2 item(ns) histórico(s) ilustrativo(s) (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        /não calculam valores, orçamento, rateio, pagamento, desconto, jornada, banco de horas, folha, contabilidade, permissões ou acesso/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, código técnico, centro de custo, unidade, estrutura, situação, responsável e trilha", () => {
    render(<CentrosCustoScreen />);

    const tabela = screen.getByRole("table", {
      name: "Centros de custo (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("CC-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("CTEC-004 (exemplo)")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Centro de custo de referência D (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Unidade U-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Departamento técnico D-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-CentroCusto-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por situação, empresa/unidade técnica e estrutura/departamento técnico", () => {
    render(<CentrosCustoScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });

    const tabela = screen.getByRole("table", {
      name: "Centros de custo (exemplo)",
    });
    expect(within(tabela).getByText("CC-2025-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("CC-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("CC-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("CC-2026-0001")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });
    expect(screen.getByText("CC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("CC-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("CC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("CC-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Estrutura/departamento técnico"), {
      target: { value: "Departamento técnico D-01 (exemplo)" },
    });
    expect(screen.getByText("CC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("CC-2026-0004")).toBeInTheDocument();
    expect(screen.queryByText("CC-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<CentrosCustoScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "Unidade U-02 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<CentrosCustoScreen />);

    const linha = screen.getByText("CC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — CC-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Centro de custo de referência A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Matriz de acesso (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica para centro de custo \(exemplo ilustrativo, sem rateio ou orçamento real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, vincula, ativa, aprova, salva, importa, exporta, integra, calcula valor, gera rateio nem altera qualquer registro real/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<CentrosCustoScreen />);

    const linha = screen.getByText("CC-2026-0005").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<CentrosCustoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Centros de custo (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de centro de custo cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<CentrosCustoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de centro de custo",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-003014/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Centros de custo (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa ação mutante, financeira ou de integração (criar, vincular, ativar, aprovar, salvar, importar, exportar, integrar, calcular ou ratear)", () => {
    render(<CentrosCustoScreen />);

    const linha = screen.getByText("CC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|vincular|ativar|aprovar|salvar|importar|exportar|integrar|calcular|ratear|excluir|editar/,
      );
    }
  });

  it("não contém CPF, e-mail, IP, conta bancária, valor, orçamento ou dado pessoal real", () => {
    render(<CentrosCustoScreen />);

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
      "conta bancária",
      "orçamento real",
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
    render(<CentrosCustoScreen />);

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
