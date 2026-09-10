import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TiposDocumentoScreen } from "./TiposDocumentoScreen";

describe("TiposDocumentoScreen (T084 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<TiposDocumentoScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Tipos de documento",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o catálogo é consultado somente no escopo da própria empresa e unidades autorizadas", () => {
    render(<TiposDocumentoScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o catálogo é consultado somente no escopo da própria empresa e das unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, upload, download, assinatura, geração, importação, exportação ou alteração documental", () => {
    render(<TiposDocumentoScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, upload, download, assinatura, geração, importação, exportação ou alteração documental real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que o catálogo não é documento e não cria documento, solicitação, permissão, assinatura, validade, retenção, publicação ou encaminhamento à Folha", () => {
    render(<TiposDocumentoScreen />);

    expect(screen.getByText("Catálogo não é documento")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o tipo de documento é apenas uma referência; não cria documento, solicitação, permissão, assinatura, validade, retenção, publicação ao colaborador ou encaminhamento à folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados e documentos reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações de RH/Jurídico/saúde ocupacional/Folha-DP/TI", () => {
    render(<TiposDocumentoScreen />);

    expect(
      screen.getByText("Dados e documentos reais bloqueados"),
    ).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade, saúde ocupacional, folha\/dp e ti/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não aceitam arquivo/exibem documento/etc.", () => {
    render(<TiposDocumentoScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(dentroDoResumo.getByText("Tipos documentais")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "7 tipo(s) documental(is) de referência (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Categorias")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 categoria(s) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Retenção a definir")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 item(ns) com retenção a definir (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Visibilidade a definir"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "3 item(ns) com visibilidade a definir (exemplo)",
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
        /não aceitam arquivo, não exibem documento, não calculam validade, não controlam retenção, não concedem acesso e não geram assinatura, pagamento, desconto, folha ou integração/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, tipo documental, categoria, escopo, visibilidade, situação, responsável e trilha", () => {
    render(<TiposDocumentoScreen />);

    const tabela = screen.getByRole("table", {
      name: "Tipos de documento (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("TD-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Tipo documental de referência D (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Categoria C-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Unidade U-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Restrita ao RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-TiposDocumento-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por categoria de referência, situação e escopo organizacional técnico", () => {
    render(<TiposDocumentoScreen />);

    fireEvent.change(screen.getByLabelText("Categoria de referência"), {
      target: { value: "Categoria C-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Tipos de documento (exemplo)",
    });
    expect(within(tabela).getByText("TD-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("TD-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("TD-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("TD-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("TD-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("TD-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("TD-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("TD-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo organizacional técnico"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });
    expect(screen.getByText("TD-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("TD-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("TD-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("TD-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<TiposDocumentoScreen />);

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
    render(<TiposDocumentoScreen />);

    const linha = screen.getByText("TD-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — TD-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Tipo documental de referência A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Categoria C-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Retenção a definir (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de catálogo de tipo documental \(exemplo ilustrativo, sem documento ou arquivo real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, ativa, aprova, salva, anexa, recebe, exibe, assina, publica, solicita, importa, exporta nem altera documentos reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<TiposDocumentoScreen />);

    const linha = screen.getByText("TD-2025-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<TiposDocumentoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Tipos de documento (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de tipo de documento cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<TiposDocumentoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de tipo de documento",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-004014/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Tipos de documento (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa upload, assinatura, publicação ou ação mutante (criar, ativar, aprovar, salvar, anexar, receber, assinar, publicar, solicitar, importar, exportar)", () => {
    render(<TiposDocumentoScreen />);

    const linha = screen.getByText("TD-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|ativar|aprovar|salvar|anexar|receber|assinar|publicar|solicitar|importar|exportar|upload|excluir|editar/,
      );
    }
  });

  it("não contém CPF, e-mail, IP, arquivo, documento, atestado, dado médico, dado bancário ou dado pessoal real", () => {
    render(<TiposDocumentoScreen />);

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
      "atestado",
      "diagnóstico",
      "conta bancária",
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
    render(<TiposDocumentoScreen />);

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
