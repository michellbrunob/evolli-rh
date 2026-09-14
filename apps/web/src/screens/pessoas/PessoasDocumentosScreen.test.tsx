import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PessoasDocumentosScreen } from "./PessoasDocumentosScreen";

describe("PessoasDocumentosScreen (T090 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<PessoasDocumentosScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Documentos",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que a consulta é limitada à própria empresa e unidades autorizadas", () => {
    render(<PessoasDocumentosScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a consulta é limitada à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, upload, download, visualização, assinatura, retenção ou integração", () => {
    render(<PessoasDocumentosScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, upload, download, visualização, assinatura, retenção ou integração real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que referência não é documento e não recebe/abre/exibe/assina/aprova/publica/retém nenhum documento real", () => {
    render(<PessoasDocumentosScreen />);

    expect(screen.getByText("Referência não é documento")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não recebem, abrem, exibem, assinam, aprovam, publicam, retêm ou substituem nenhum documento real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados/documentos reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações aplicáveis", () => {
    render(<PessoasDocumentosScreen />);

    expect(
      screen.getByText("Dados/documentos reais bloqueados"),
    ).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não recebe/exibe/valida/assina/publica/retém documentos", () => {
    render(<PessoasDocumentosScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Referências técnicas"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 referência(s) técnica(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Categorias documentais"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 categoria(s) documental(is) (exemplo)"),
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
        /não recebem, exibem, validam, assinam, publicam ou retêm documentos; não representam arquivo, upload ou download real/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, categoria, finalidade, visibilidade, escopo, situação, responsável e trilha", () => {
    render(<PessoasDocumentosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Documentos (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("DOC-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Categoria documental C-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Finalidade F-04 (exemplo)"),
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
      dentroDaLinha.getByText("RT-Documentos-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por categoria de referência, situação e escopo técnico", () => {
    render(<PessoasDocumentosScreen />);

    fireEvent.change(screen.getByLabelText("Categoria de referência"), {
      target: { value: "Categoria documental C-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Documentos (exemplo)",
    });
    expect(within(tabela).getByText("DOC-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("DOC-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("DOC-2025-0001")).toBeInTheDocument();
    expect(within(tabela).queryByText("DOC-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("DOC-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("DOC-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("DOC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("DOC-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo técnico"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });
    expect(screen.getByText("DOC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("DOC-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("DOC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("DOC-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<PessoasDocumentosScreen />);

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
    render(<PessoasDocumentosScreen />);

    const linha = screen.getByText("DOC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — DOC-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Categoria documental C-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Finalidade F-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de evidência documental \(exemplo ilustrativo, sem arquivo, upload, download ou visualização real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, envia, anexa, recebe, abre, baixa, exibe, assina, aprova, publica, retém, exclui, compartilha, importa, exporta nem integra documentos reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<PessoasDocumentosScreen />);

    const linha = screen.getByText("DOC-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<PessoasDocumentosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Documentos (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de documento cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<PessoasDocumentosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de documentos",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-010037/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Documentos (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa envio, abertura, download, assinatura ou ação mutante (criar, enviar, anexar, receber, abrir, baixar, assinar, aprovar, publicar, reter, excluir, compartilhar, importar, exportar, editar)", () => {
    render(<PessoasDocumentosScreen />);

    const linha = screen.getByText("DOC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|enviar|anexar|receber|abrir|baixar|assinar|aprovar|publicar|reter|excluir|compartilhar|importar|exportar|editar/,
      );
    }
  });

  it("não contém nomes, empresa real, CPF, e-mail, telefone, IP, matrícula, salário, valor ou dado pessoal real", () => {
    render(<PessoasDocumentosScreen />);

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
      ".pdf",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não declara conformidade com CLT, CCT/ACT, Portaria 671, LGPD ou eSocial e não menciona SLA", () => {
    render(<PessoasDocumentosScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "clt",
      "cct",
      "act",
      "portaria 671",
      "lgpd",
      "esocial",
      "sla",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
