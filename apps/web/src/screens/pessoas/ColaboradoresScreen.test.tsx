import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColaboradoresScreen } from "./ColaboradoresScreen";

describe("ColaboradoresScreen (T072 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<ColaboradoresScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que somente RH administra e nenhuma alteração é persistida", () => {
    render(<ColaboradoresScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma alteração feita aqui é persistida/i),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que CPF, documentos, admissão real, Folha, eSocial e upload ainda não estão disponíveis", () => {
    render(<ColaboradoresScreen />);

    expect(screen.getByText("Ainda indisponível")).toBeInTheDocument();
    expect(screen.getByText(/CPF/)).toBeInTheDocument();
    expect(screen.getByText(/documentos/)).toBeInTheDocument();
    expect(screen.getByText(/admissão real/)).toBeInTheDocument();
    expect(screen.getByText(/Folha/)).toBeInTheDocument();
    expect(screen.getByText(/eSocial/)).toBeInTheDocument();
    expect(screen.getByText(/upload de arquivos/)).toBeInTheDocument();
  });

  it("lista colaboradores com referência técnica, situação, tipo de vínculo, unidade e vigência", () => {
    render(<ColaboradoresScreen />);

    const tabela = screen.getByRole("table", {
      name: "Colaboradores desta empresa",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("COL-2026-0001").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("Ativo")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("CLT")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Operações (exemplo)")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText(/10\/03\/2025.*vigente/),
    ).toBeInTheDocument();
  });

  it("filtra localmente por situação e por tipo de vínculo", () => {
    render(<ColaboradoresScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "desligado" },
    });

    const tabela = screen.getByRole("table", {
      name: "Colaboradores desta empresa",
    });
    expect(within(tabela).getByText("COL-2026-0004")).toBeInTheDocument();
    expect(within(tabela).queryByText("COL-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("COL-2026-0001")).toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhum colaborador", () => {
    render(<ColaboradoresScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "desligado" },
    });
    fireEvent.change(screen.getByLabelText("Tipo de vínculo"), {
      target: { value: "clt" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhum colaborador corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<ColaboradoresScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", { name: "Colaboradores desta empresa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhum colaborador cadastrado",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<ColaboradoresScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar os colaboradores",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-000912/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", { name: "Colaboradores desta empresa" }),
    ).toBeInTheDocument();
  });

  it("abre o formulário 'Novo colaborador' e confirmar não cria, salva nem altera nada", () => {
    render(<ColaboradoresScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));

    const formulario = screen.getByRole("form", {
      name: "Formulário de novo colaborador",
    });
    expect(formulario).toBeInTheDocument();
    expect(
      screen.getByText(/nada é criado, salvo ou realmente alterado/i),
    ).toBeInTheDocument();

    fireEvent.click(
      within(formulario).getByRole("button", {
        name: "Confirmar (demonstração)",
      }),
    );

    expect(
      screen.getByText(
        "Ação apenas demonstrativa: nenhum colaborador foi realmente criado, salvo ou alterado.",
      ),
    ).toBeInTheDocument();

    // A listagem não é alterada pela submissão do formulário demonstrativo.
    expect(
      screen.getByRole("table", { name: "Colaboradores desta empresa" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(formulario).getByRole("button", { name: "Cancelar" }),
    );
    expect(
      screen.queryByRole("form", { name: "Formulário de novo colaborador" }),
    ).not.toBeInTheDocument();
  });

  it("o formulário demonstra um campo com erro de validação, comunicado por texto e semântica", () => {
    render(<ColaboradoresScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));

    const erro = screen.getByText("Informe uma data no formato AAAA-MM-DD.");
    expect(erro.closest('[role="alert"]')).toBeInTheDocument();

    const campoInvalido = screen.getByDisplayValue("31/02/2026");
    expect(campoInvalido).toHaveAttribute("aria-invalid", "true");
  });

  it("não contém CPF, nome real, empresa real, documento, valor financeiro ou dado sensível", () => {
    render(<ColaboradoresScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Novo colaborador" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "r$",
      ".pdf",
      "localstorage",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
