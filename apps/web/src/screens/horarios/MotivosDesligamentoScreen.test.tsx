import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotivosDesligamentoScreen } from "./MotivosDesligamentoScreen";

describe("MotivosDesligamentoScreen (T085 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<MotivosDesligamentoScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Motivos de desligamento",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o catálogo é limitado à própria empresa e unidades autorizadas", () => {
    render(<MotivosDesligamentoScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o catálogo é limitado à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, cálculo, integração, alteração cadastral ou desligamento real", () => {
    render(<MotivosDesligamentoScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, cálculo, integração, alteração cadastral ou desligamento real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que a referência não é desligamento e não altera vínculo, acesso, jornada, ponto, documentos, Banco de Horas, pagamento, desconto, Folha ou obrigação", () => {
    render(<MotivosDesligamentoScreen />);

    expect(
      screen.getByText("Referência não é desligamento"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /o motivo é apenas catálogo; não altera vínculo, acesso, jornada, ponto, documentos, banco de horas, pagamento, desconto, evento de folha ou obrigação/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações de RH/Jurídico/Folha-DP/TI", () => {
    render(<MotivosDesligamentoScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade, folha\/dp e ti/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não desligam/bloqueiam acesso/calculam verbas/etc.", () => {
    render(<MotivosDesligamentoScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Motivos de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 motivo(s) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Categorias")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 categoria(s) de referência (exemplo)"),
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
      dentroDoResumo.getByText(
        "2 item(ns) histórico(s) ilustrativo(s) (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        /não desligam colaborador, não bloqueiam acesso, não calculam verbas, não alteram saldo, não enviam à folha nem geram eventos/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, código, motivo, categoria, escopo, situação, responsável e trilha", () => {
    render(<MotivosDesligamentoScreen />);

    const tabela = screen.getByRole("table", {
      name: "Motivos de desligamento (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("MD-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("MDC-004 (exemplo)")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Motivo de referência D (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Categoria C-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Unidade U-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Desligamento-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por categoria de referência, situação e escopo organizacional técnico", () => {
    render(<MotivosDesligamentoScreen />);

    fireEvent.change(screen.getByLabelText("Categoria de referência"), {
      target: { value: "Categoria C-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Motivos de desligamento (exemplo)",
    });
    expect(within(tabela).getByText("MD-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("MD-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("MD-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("MD-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("MD-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("MD-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("MD-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("MD-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo organizacional técnico"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });
    expect(screen.getByText("MD-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("MD-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("MD-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("MD-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<MotivosDesligamentoScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Escopo organizacional técnico"), {
      target: { value: "Unidade U-02 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<MotivosDesligamentoScreen />);

    const linha = screen.getByText("MD-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — MD-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Motivo de referência A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Categoria C-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de motivo de desligamento \(exemplo ilustrativo, sem efeito real sobre vínculo, acesso ou folha\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, ativa, aprova, salva, desliga, bloqueia acesso, calcula verbas, gera evento, envia à folha, importa ou exporta/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<MotivosDesligamentoScreen />);

    const linha = screen.getByText("MD-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<MotivosDesligamentoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Motivos de desligamento (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de motivo de desligamento cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<MotivosDesligamentoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de motivo de desligamento",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-005014/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Motivos de desligamento (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa ação mutante, financeira ou de desligamento real (criar, ativar, aprovar, salvar, desligar, bloquear, calcular, gerar evento, enviar à Folha, importar ou exportar)", () => {
    render(<MotivosDesligamentoScreen />);

    const linha = screen.getByText("MD-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|ativar|aprovar|salvar|desligar|bloquear|calcular|gerar|enviar|importar|exportar|excluir|editar/,
      );
    }
  });

  it("não contém CPF, e-mail, IP, valores, documentos, dados pessoais ou dados reais", () => {
    render(<MotivosDesligamentoScreen />);

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
    render(<MotivosDesligamentoScreen />);

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
