import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificarFolhasScreen } from "./VerificarFolhasScreen";

describe("VerificarFolhasScreen (T045 — tela visual estática)", () => {
  it("tem um único h1 e explica que a fila só sinaliza pendências", () => {
    render(<VerificarFolhasScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Verificar folhas" }),
    ).toHaveLength(1);
    expect(
      screen.getByText(/aponta situações do ponto que precisam de atenção/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nunca ajusta, aprova, fecha ou calcula/i),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que somente RH trata pendências e nada é automático", () => {
    render(<VerificarFolhasScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Nenhuma correção, aprovação, desconto ou fechamento é automático/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo visual de pendências por severidade", () => {
    render(<VerificarFolhasScreen />);

    expect(
      screen.getByRole("heading", { name: "Resumo de pendências" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 crítica(s)")).toBeInTheDocument();
    expect(screen.getByText("2 de atenção")).toBeInTheDocument();
    expect(screen.getByText("1 informativa(s)")).toBeInTheDocument();
  });

  it("lista os cinco tipos de pendência exigidos, com severidade e estado", () => {
    render(<VerificarFolhasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Pendências da fila de verificação",
    });
    const dentroDaTabela = within(tabela);

    for (const tipo of [
      "Batida ausente",
      "Batida fora do horário",
      "Jornada incompleta",
      "Compensação pendente",
      "Dado de importação não associado",
    ]) {
      expect(dentroDaTabela.getAllByText(tipo).length).toBeGreaterThan(0);
    }

    expect(dentroDaTabela.getByText("Vínculo V-001")).toBeInTheDocument();
  });

  it("filtra a lista localmente por tipo, sem alterar os dados de origem", () => {
    render(<VerificarFolhasScreen />);

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "jornada_incompleta" },
    });

    const tabela = screen.getByRole("table", {
      name: "Pendências da fila de verificação",
    });
    expect(within(tabela).getByText("Jornada incompleta")).toBeInTheDocument();
    expect(within(tabela).queryAllByText("Batida ausente")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(
      within(
        screen.getByRole("table", {
          name: "Pendências da fila de verificação",
        }),
      ).getAllByText("Batida ausente").length,
    ).toBeGreaterThan(0);
  });

  it("mostra estado vazio quando o filtro não corresponde a nenhuma pendência", () => {
    render(<VerificarFolhasScreen />);

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "jornada_incompleta" },
    });
    fireEvent.change(screen.getByLabelText("Severidade"), {
      target: { value: "critica" },
    });

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma pendência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: "Pendências da fila de verificação",
      }),
    ).not.toBeInTheDocument();
  });

  it("alterna para o estado vazio de demonstração (fila sem pendências)", () => {
    render(<VerificarFolhasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma pendência aberta",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", {
        name: "Pendências da fila de verificação",
      }),
    ).not.toBeInTheDocument();
  });

  it("alterna para o estado de erro de demonstração com referência ilustrativa", () => {
    render(<VerificarFolhasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar a fila de pendências",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-000456/)).toBeInTheDocument();
    expect(screen.getByText(/ilustrativa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", { name: "Pendências da fila de verificação" }),
    ).toBeInTheDocument();
  });

  it("abre o detalhe demonstrativo e deixa explícito que nenhuma ação real ocorre", () => {
    render(<VerificarFolhasScreen />);

    const botoesDetalhe = screen.getAllByRole("button", {
      name: /^Ver detalhe/,
    });
    fireEvent.click(botoesDetalhe[0]!);

    expect(
      screen.getByRole("heading", { name: /Detalhe da pendência/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ação apenas demonstrativa/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /não altera, ajusta, aprova, calcula nem fecha nenhuma pendência real/,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("heading", { name: /Detalhe da pendência/ }),
    ).not.toBeInTheDocument();
  });

  it("não referencia CPF, associação, cálculo, aprovação, fechamento ou dado real", () => {
    render(<VerificarFolhasScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
      "banco de horas",
      "dsr",
      "aprovar",
      "fechar competência",
      "assinatura",
      "senha",
      "sessão",
      "mfa",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
