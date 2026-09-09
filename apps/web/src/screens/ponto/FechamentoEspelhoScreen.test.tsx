import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FechamentoEspelhoScreen } from "./FechamentoEspelhoScreen";

describe("FechamentoEspelhoScreen (T079 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<FechamentoEspelhoScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Fechamento e Espelho",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que RH atua só no escopo e gestor não altera marcação nem fecha período", () => {
    render(<FechamentoEspelhoScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /gestor apenas valida, recomenda, devolve ou rejeita itens no fluxo aplicável; não altera marcação nem fecha período/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, cálculo, PDF, assinatura ou integração com Folha", () => {
    render(<FechamentoEspelhoScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, cálculo real, geração de pdf, assinatura, integração com folha nem fechamento operacional/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que fechamento não é automático e depende de decisão formal e gates", () => {
    render(<FechamentoEspelhoScreen />);

    expect(screen.getByText("Fechamento não automático")).toBeInTheDocument();
    expect(
      screen.getByText(
        /alertas, pendências cadastrais ou exceções não fecham o período sozinhos/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /o fechamento real depende de decisão formal e dos gates definidos para o domínio/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de preservação: marcação original nunca é apagada, ajustes são aditivos e auditáveis", () => {
    render(<FechamentoEspelhoScreen />);

    expect(screen.getByText("Preservação")).toBeInTheDocument();
    expect(
      screen.getByText(
        /marcações originais nunca são apagadas ou sobrescritas; ajustes são aditivos, identificados e auditáveis/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que dado real depende de MFA, DS-OPS-01, auditoria, retenção/base legal e validações RH+Jurídico/privacidade+Folha", () => {
    render(<FechamentoEspelhoScreen />);

    expect(screen.getByText("Dado real bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade e folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra a linha do tempo do fechamento com as seis etapas, apenas informativa", () => {
    render(<FechamentoEspelhoScreen />);

    expect(
      screen.getByText("Linha do tempo do fechamento (apenas informativo)"),
    ).toBeInTheDocument();
    for (const etapa of [
      "Período em revisão",
      "Tratamento de pendências",
      "Validação/recomendação do gestor",
      "Revisão final do RH",
      "Fechamento autorizado",
      "Espelho disponibilizado",
    ]) {
      expect(screen.getByText(etapa)).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        /nenhum botão desta tela executa fechamento, reabertura, cálculo, aprovação, assinatura, geração ou envio/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo do período com os cinco indicadores (rótulo curto + contagem) e a nota de que não calculam jornada/saldo/Folha etc.", () => {
    render(<FechamentoEspelhoScreen />);

    const resumo = screen
      .getByText("Resumo do período (exemplo)")
      .closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Pendências bloqueadoras"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 pendência(s) bloqueadora(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Alertas informativos"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("5 alerta(s) informativo(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Ajustes manuais em revisão"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 ajuste(s) manual(is) em revisão (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Validação do gestor")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "5 validação(ões)/recomendação(ões) de gestor (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Situação do espelho")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("2 espelho(s) disponibilizado(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        /não calculam jornada, saldo, compensação, pagamento, desconto, dsr, banco de horas ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista os períodos com referência, período, unidade, pendências, alertas, responsável e trilha", () => {
    render(<FechamentoEspelhoScreen />);

    const tabela = screen.getByRole("table", {
      name: "Fechamento e Espelho — períodos (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("FEC-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("01/05/2026 a 31/05/2026 (ilustrativo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Unidade U-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando validação (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("1 pendência(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("1 alerta(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Fechamento-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por situação e por empresa/unidade técnica", () => {
    render(<FechamentoEspelhoScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "aguardando_validacao_exemplo" },
    });

    const tabela = screen.getByRole("table", {
      name: "Fechamento e Espelho — períodos (exemplo)",
    });
    expect(within(tabela).getByText("FEC-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("FEC-2026-0004")).toBeInTheDocument();
    expect(within(tabela).queryByText("FEC-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("FEC-2026-0001")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });
    expect(screen.getByText("FEC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("FEC-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("FEC-2026-0006")).toBeInTheDocument();
    expect(screen.queryByText("FEC-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhum período", () => {
    render(<FechamentoEspelhoScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhum período corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', com pendências, alertas, validação do gestor e condição do espelho", () => {
    render(<FechamentoEspelhoScreen />);

    const linha = screen.getByText("FEC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe do período — FEC-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Pendência cadastral A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Pendência cadastral B (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Alerta informativo A (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoPainel.getByText("Pendente (exemplo)")).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Não disponibilizado (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("1 evento registrado (exemplo)"),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getByText(
        /este painel não fecha, reabre, aprova, rejeita, calcula, salva, assina, envia nem altera dado real/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /o gestor não edita marcações nem executa fechamento/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /qualquer fechamento real exige fluxo, autorização e gates específicos/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /não recalcula automaticamente períodos históricos nem cria lançamento automático na folha/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhuma pendência'/'nenhum alerta' quando o período de exemplo não tem itens", () => {
    render(<FechamentoEspelhoScreen />);

    const linha = screen.getByText("FEC-2026-0005").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhuma pendência bloqueadora (exemplo)."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum alerta informativo (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<FechamentoEspelhoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Fechamento e Espelho — períodos (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhum período em acompanhamento",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<FechamentoEspelhoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar os períodos de fechamento",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-001854/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Fechamento e Espelho — períodos (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa fechar período, reabrir, aprovar, rejeitar, salvar, calcular, assinar, gerar PDF ou integrar Folha", () => {
    render(<FechamentoEspelhoScreen />);

    const linha = screen.getByText("FEC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /reabrir|aprovar|rejeitar|salvar|calcular|assinar|gerar pdf|enviar|integrar|fechar período/,
      );
    }
  });

  it("não contém CPF, CNPJ, nome de empresa/pessoa real, e-mail, IP, arquivo, biometria ou valor financeiro", () => {
    render(<FechamentoEspelhoScreen />);

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelectorAll("iframe")).toHaveLength(0);

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
      "biometria",
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

  it("não declara conformidade com CLT, CCT, Portaria 671, LGPD ou eSocial", () => {
    render(<FechamentoEspelhoScreen />);

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
