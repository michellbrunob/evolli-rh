import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotivosAusenciaJustificativasScreen } from "./MotivosAusenciaJustificativasScreen";

describe("MotivosAusenciaJustificativasScreen (T081 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Motivos de ausência e justificativas",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o RH consulta somente referências da própria empresa e unidades autorizadas", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o rh consulta somente referências de motivo e justificativa da própria empresa e das unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, importação, exportação, cálculo, integração ou lançamento", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, importação, exportação, cálculo, integração, alteração de ponto ou lançamento real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que motivo/justificativa/documento são referências distintas e não concedem abono nem aprovam ausência", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    expect(screen.getByText("Referência não é decisão")).toBeInTheDocument();
    expect(
      screen.getByText(
        /motivo, justificativa e documento são referências distintas; sua existência não concede abono, não aprova ausência e não altera marcação, jornada, saldo, banco de horas ou folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de saúde/privacidade: sem dado médico ou documento sensível, dado real exige MFA/DS-OPS-01/auditoria/RH+Jurídico+saúde ocupacional", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    expect(screen.getByText("Saúde e privacidade")).toBeInTheDocument();
    expect(
      screen.getByText(
        /dados médicos e documentos sensíveis não são exibidos nesta tela/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade e saúde ocupacional/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não reconhecem ausência nem geram pagamento/Folha/etc.", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Motivos de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 motivo(s) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Justificativas de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("4 justificativa(s) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Exigem decisão formal"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 item(ns) exigindo decisão formal (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Evidência pendente")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "3 referência(s) com evidência pendente (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Itens históricos")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "2 item(ns) histórico(s) demonstrativo(s) (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        /não reconhecem ausência, não concedem abono, não aprovam documento, não ajustam ponto e não geram pagamento, desconto, dsr, compensação, banco de horas ou lançamento na folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, tipo, motivo/justificativa, escopo, evidência, responsável e trilha", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Motivos de ausência e justificativas (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("MAJ-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Justificativa (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Justificativa de referência B (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Unidade U-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Evidência ilustrativa pendente (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Justificativas-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por tipo de referência, situação e escopo organizacional técnico", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de referência"), {
      target: { value: "justificativa" },
    });

    const tabela = screen.getByRole("table", {
      name: "Motivos de ausência e justificativas (exemplo)",
    });
    expect(within(tabela).getByText("MAJ-2026-0002")).toBeInTheDocument();
    expect(within(tabela).getByText("MAJ-2026-0004")).toBeInTheDocument();
    expect(within(tabela).getByText("MAJ-2026-0006")).toBeInTheDocument();
    expect(within(tabela).getByText("MAJ-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("MAJ-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("MAJ-2026-0001")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("MAJ-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("MAJ-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("MAJ-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Escopo organizacional técnico"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });
    expect(screen.getByText("MAJ-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("MAJ-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("MAJ-2026-0006")).toBeInTheDocument();
    expect(screen.queryByText("MAJ-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Escopo organizacional técnico"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    const linha = screen.getByText("MAJ-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — MAJ-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Motivo de referência A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Reconhecimento formal (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro técnico pendente \(exemplo, sem documento ou dado médico\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, aprova, recusa, reconhece, abona, salva, importa, exporta, envia, anexa documento nem altera registros reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    const linha = screen.getByText("MAJ-2026-0005").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Motivos de ausência e justificativas (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de motivo ou justificativa cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de motivo e justificativa",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-002014/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Motivos de ausência e justificativas (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa criar, aprovar, recusar, reconhecer, abonar, salvar, importar, exportar, enviar ou anexar documento", () => {
    render(<MotivosAusenciaJustificativasScreen />);

    const linha = screen.getByText("MAJ-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|aprovar|recusar|reconhecer|abonar|salvar|importar|exportar|enviar|anexar/,
      );
    }
  });

  it("não contém CPF, e-mail, IP, biometria, diagnóstico, atestado ou documento real", () => {
    render(<MotivosAusenciaJustificativasScreen />);

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
      "biometria",
      "diagnóstico",
      "atestado",
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
    render(<MotivosAusenciaJustificativasScreen />);

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
