import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarioFeriadosScreen } from "./CalendarioFeriadosScreen";

describe("CalendarioFeriadosScreen (T076 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<CalendarioFeriadosScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Calendário de feriados",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o RH administra somente referências da própria empresa e unidades autorizadas", () => {
    render(<CalendarioFeriadosScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /somente referências de feriados da própria empresa e das unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que não existe calendário operacional, importação oficial, integração externa ou persistência", () => {
    render(<CalendarioFeriadosScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não existe calendário operacional, importação oficial, integração externa ou persistência/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que a ativação futura exige escopo, vigência, responsável, auditoria e validação, sem recalcular período fechado", () => {
    render(<CalendarioFeriadosScreen />);

    expect(screen.getByText("Ativação futura")).toBeInTheDocument();
    expect(
      screen.getByText(
        /só poderão ser ativados com escopo, vigência, responsável, auditoria e validação aplicável/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não podem recalcular nem modificar períodos já fechados/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que dado real segue bloqueado por MFA, DS-OPS-01, auditoria e retenção/base legal", () => {
    render(<CalendarioFeriadosScreen />);

    expect(screen.getByText("Dado real bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(/auditoria, retenção\/base legal/i),
    ).toBeInTheDocument();
  });

  it("mostra o resumo por escopo com nota de que contadores não calculam jornada/escala/pagamento/Banco de Horas/Folha", () => {
    render(<CalendarioFeriadosScreen />);

    expect(screen.getByText("2 nacional(is)")).toBeInTheDocument();
    expect(screen.getByText("2 estadual(is)")).toBeInTheDocument();
    expect(screen.getByText("2 municipal(is)")).toBeInTheDocument();
    expect(
      screen.getByText("1 data(s) móvel(is) da empresa"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não calculam jornada, escala, pagamento, Banco de Horas ou Folha/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista feriados cobrindo os quatro escopos, com referência, data, descrição, abrangência, situação e responsável", () => {
    render(<CalendarioFeriadosScreen />);

    const tabela = screen.getByRole("table", {
      name: "Calendário de feriados (exemplo)",
    });
    const dentro = within(tabela);

    // "Nacional"/"Estadual"/"Municipal" aparecem em duas linhas cada (para
    // exercitar o filtro por ano em outro teste), por isso usamos
    // getAllByText; "Data móvel da empresa" é única.
    expect(dentro.getAllByText("Nacional").length).toBe(2);
    expect(dentro.getAllByText("Estadual").length).toBe(2);
    expect(dentro.getAllByText("Municipal").length).toBe(2);
    expect(dentro.getByText("Data móvel da empresa")).toBeInTheDocument();

    const linha = dentro.getByText("FER-2026-0001").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("18/02/2026")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Feriado nacional (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Abrangência nacional (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Ativa")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Feriados-01 (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por ano ilustrativo, escopo e situação", () => {
    render(<CalendarioFeriadosScreen />);

    fireEvent.change(screen.getByLabelText("Ano ilustrativo"), {
      target: { value: "2025" },
    });

    const tabela = screen.getByRole("table", {
      name: "Calendário de feriados (exemplo)",
    });
    expect(within(tabela).getByText("FER-2025-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("FER-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("FER-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("FER-2026-0001")).toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhum feriado", () => {
    render(<CalendarioFeriadosScreen />);

    fireEvent.change(screen.getByLabelText("Escopo"), {
      target: { value: "nacional" },
    });
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "pendente_validacao" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhum feriado corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<CalendarioFeriadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Calendário de feriados (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de feriado cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<CalendarioFeriadosScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar o calendário de feriados",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-001267/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Calendário de feriados (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("não contém CPF, CNPJ, nome de empresa/pessoa/cidade/estado, e-mail, IP, arquivo ou valor financeiro", () => {
    render(<CalendarioFeriadosScreen />);

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

  it("não declara nem sugere feriado oficial real ou cálculo de dias úteis/jornada", () => {
    render(<CalendarioFeriadosScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "confraternização universal",
      "tiradentes",
      "independência",
      "aparecida",
      "finados",
      "proclamação da república",
      "natal",
      "carnaval",
      "corpus christi",
      "dias úteis",
      "calendário oficial",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
