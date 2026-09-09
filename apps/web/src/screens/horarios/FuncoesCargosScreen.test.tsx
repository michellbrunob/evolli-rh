import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FuncoesCargosScreen } from "./FuncoesCargosScreen";

describe("FuncoesCargosScreen (T080 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<FuncoesCargosScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Funções e cargos",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o RH consulta somente referências da própria empresa e unidades autorizadas", () => {
    render(<FuncoesCargosScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /somente referências de função e cargo da própria empresa e das unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, importação, exportação, integração ou cálculo", () => {
    render(<FuncoesCargosScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, importação, exportação, integração, cálculo ou alteração cadastral real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que cargo/função/departamento/centro de custo/estrutura são referências distintas e não concedem acesso", () => {
    render(<FuncoesCargosScreen />);

    expect(screen.getByText("Referências organizacionais")).toBeInTheDocument();
    expect(
      screen.getByText(
        /cargo, função, departamento, centro de custo e estrutura são referências distintas e não concedem permissão de acesso/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que dados reais exigem MFA, DS-OPS-01, auditoria, retenção/base legal e validações RH+Jurídico/privacidade+TI", () => {
    render(<FuncoesCargosScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade e ti/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não alteram vínculo/remuneração/jornada/etc.", () => {
    render(<FuncoesCargosScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(
      dentroDoResumo.getByText("Funções de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 função(ões) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Cargos de referência"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 cargo(s) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Vínculos organizacionais"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "8 vínculo(s) organizacional(is) ilustrativo(s) (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Aguardando decisão formal"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "3 item(ns) aguardando decisão formal (exemplo)",
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
        /não alteram vínculo, remuneração, jornada, escala, banco de horas, folha, permissões ou acesso ao sistema/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, função, cargo, unidade, departamento, responsável e trilha", () => {
    render(<FuncoesCargosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Funções e cargos (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("FC-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(
      dentroDaLinha.getByText("Função de referência C (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Cargo de referência A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Unidade U-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Departamento D-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Funcoes-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por situação, empresa/unidade técnica e departamento/estrutura técnica", () => {
    render(<FuncoesCargosScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });

    const tabela = screen.getByRole("table", {
      name: "Funções e cargos (exemplo)",
    });
    expect(within(tabela).getByText("FC-2025-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("FC-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("FC-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("FC-2026-0001")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });
    expect(screen.getByText("FC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("FC-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("FC-2026-0006")).toBeInTheDocument();
    expect(screen.queryByText("FC-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Departamento/estrutura técnica"), {
      target: { value: "Departamento D-02 (exemplo)" },
    });
    expect(screen.getByText("FC-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("FC-2026-0005")).toBeInTheDocument();
    expect(screen.getByText("FC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("FC-2026-0001")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<FuncoesCargosScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Empresa/unidade técnica"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<FuncoesCargosScreen />);

    const linha = screen.getByText("FC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — FC-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Função de referência A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Cargo de referência A (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Vínculo com centro de custo (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Nível hierárquico (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, vincula, ativa, aprova, salva, importa, exporta nem altera registro real/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<FuncoesCargosScreen />);

    const linha = screen.getByText("FC-2026-0005").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<FuncoesCargosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", { name: "Funções e cargos (exemplo)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de função ou cargo cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<FuncoesCargosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de função e cargo",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-001922/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", { name: "Funções e cargos (exemplo)" }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa criar, vincular, ativar, aprovar, salvar, importar ou exportar registro", () => {
    render(<FuncoesCargosScreen />);

    const linha = screen.getByText("FC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|vincular|ativar|aprovar|salvar|importar|exportar/,
      );
    }
  });

  it("não contém CPF, CNPJ, nome de empresa/pessoa real, e-mail, IP, arquivo, biometria ou valor financeiro", () => {
    render(<FuncoesCargosScreen />);

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
    render(<FuncoesCargosScreen />);

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
