import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PoliticasBancoHorasScreen } from "./PoliticasBancoHorasScreen";

describe("PoliticasBancoHorasScreen (T078 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<PoliticasBancoHorasScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Políticas de Banco de Horas",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o RH administra somente referências da própria empresa e unidades autorizadas", () => {
    render(<PoliticasBancoHorasScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /somente referências de política da própria empresa e das unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem política real, API, persistência, cálculo ou efeito operacional", () => {
    render(<PoliticasBancoHorasScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /sem política real, api, persistência, cálculo ou efeito operacional/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que compensação, quitação e Folha continuam bloqueadas pelos gates existentes", () => {
    render(<PoliticasBancoHorasScreen />);

    expect(
      screen.getByText("Compensação/quitação/Folha bloqueadas"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /compensação, quitação e folha continuam bloqueadas pelas decisões\/gates existentes/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que dado real depende de MFA, DS-OPS-01, auditoria, retenção/base legal e validações RH+Jurídico+Folha", () => {
    render(<PoliticasBancoHorasScreen />);

    expect(screen.getByText("Dado real bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/validações rh, jurídico e folha aplicáveis/i),
    ).toBeInTheDocument();
  });

  it("mostra os princípios informativos obrigatórios", () => {
    render(<PoliticasBancoHorasScreen />);

    expect(
      screen.getByText("Princípios (apenas informativo)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /política futura possui escopo, versão, vigência, responsável e auditoria/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /mudança futura não recalcula, substitui nem altera períodos fechados/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /crédito e débito continuam separados, e saldo é derivado/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/proposta aprovada não cria débito efetivo automático/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /ponto não calcula salário, dsr, pagamento ou desconto/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as versões cobrindo as três situações, com referência, unidade, versão, vigência, responsável e trilha", () => {
    render(<PoliticasBancoHorasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Políticas de Banco de Horas (exemplo)",
    });
    const dentro = within(tabela);

    // "Rascunho"/"Aguardando validação"/"Versão histórica de exemplo" aparecem
    // em duas linhas cada (para exercitar os filtros em outro teste).
    expect(dentro.getAllByText("Rascunho").length).toBe(2);
    expect(dentro.getAllByText("Aguardando validação").length).toBe(2);
    expect(dentro.getAllByText("Versão histórica de exemplo").length).toBe(2);

    const linha = dentro.getByText("POL-BH-2026-0003").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("UN-01 (exemplo)")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("v0.3 (aguardando validação)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("01/04/2026 a 30/09/2026 (ilustrativa)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Politica-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText(
        "Decisão RH + Jurídico + Folha pendente (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por situação e por empresa/unidade técnica", () => {
    render(<PoliticasBancoHorasScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "versao_historica_exemplo" },
    });

    const tabela = screen.getByRole("table", {
      name: "Políticas de Banco de Horas (exemplo)",
    });
    expect(within(tabela).getByText("POL-BH-2025-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("POL-BH-2025-0002")).toBeInTheDocument();
    expect(
      within(tabela).queryByText("POL-BH-2026-0001"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("POL-BH-2026-0001")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "UN-01 (exemplo)" },
    });
    expect(screen.getByText("POL-BH-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("POL-BH-2026-0003")).toBeInTheDocument();
    expect(screen.queryByText("POL-BH-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma política", () => {
    render(<PoliticasBancoHorasScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "rascunho" },
    });
    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "UN-03 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma versão corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', com os sete grupos de parâmetros pendentes de decisão", () => {
    render(<PoliticasBancoHorasScreen />);

    const linha = screen.getByText("POL-BH-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Detalhe da versão — POL-BH-2026-0001",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Grupos de parâmetros (em definição)"),
    ).toBeInTheDocument();

    for (const grupo of [
      "Expiração/validade",
      "Ordem de consumo",
      "Saldo negativo",
      "Alertas",
      "Compensação",
      "Quitação",
      "Folha",
    ]) {
      expect(
        screen.getByText(new RegExp(`^${grupo}: pendente de decisão formal`)),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByText("Em definição").length).toBe(7);

    expect(
      screen.getByText(
        /abrir este detalhe não cria, edita, aprova, ativa, salva nem aplica nenhuma política real/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<PoliticasBancoHorasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Políticas de Banco de Horas (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma versão de política cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<PoliticasBancoHorasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as políticas de Banco de Horas",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-001739/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Políticas de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("não contém CPF, CNPJ, nome de empresa/pessoa real, e-mail, IP, arquivo, AFD ou valor financeiro", () => {
    render(<PoliticasBancoHorasScreen />);

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);

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
      "afd",
      "r$",
      ".pdf",
      "localstorage",
      "@",
      "http://",
      "https://",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não declara número, prazo, limite, fórmula, regra aprovada ou conformidade normativa", () => {
    render(<PoliticasBancoHorasScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "clt",
      "cct",
      "portaria 671",
      "lgpd",
      "esocial",
      "% ao ano",
      "horas por mês",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
