import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BancoHorasScreen } from "./BancoHorasScreen";

describe("BancoHorasScreen (T069 — tela visual estática)", () => {
  it("tem um único h1 e o aviso de que o saldo é derivado e RH decide ações futuras", () => {
    render(<BancoHorasScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Banco de Horas" }),
    ).toHaveLength(1);
    expect(
      screen.getByText((_, elemento) =>
        (elemento?.textContent ?? "").startsWith(
          "O saldo é apenas derivado dos movimentos abaixo",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /o RH decide qualquer ação futura de compensação ou quitação/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há pagamento, Folha, aprovação, ordem de consumo, validade\/expiração, ajuste manual, persistência ou integração/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra crédito e débito separados no resumo, nunca um valor 'líquido'", () => {
    render(<BancoHorasScreen />);

    expect(screen.getByText("145 min")).toBeInTheDocument();
    expect(screen.getByText("505 min")).toBeInTheDocument();
    expect(screen.getByText("-360 min")).toBeInTheDocument();
    expect(
      screen.getByText(/o crédito nunca compensa o débito automaticamente/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nunca um evento "líquido"/i)).toBeInTheDocument();
  });

  it("mostra os dois alertas informativos de saldo alto e negativo, sem bloquear nada", () => {
    render(<BancoHorasScreen />);

    expect(screen.getByText("Saldo alto")).toBeInTheDocument();
    expect(screen.getByText("Saldo negativo")).toBeInTheDocument();

    const textos = screen.getAllByText(
      /apenas informativo, não bloqueia nem calcula nada/i,
    );
    expect(textos).toHaveLength(2);
  });

  it("lista o extrato cronológico com referência, data, natureza, origem e minutos", () => {
    render(<BancoHorasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Extrato do Banco de Horas",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("AP-2026-08-11-V001-C").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("11/08/2026")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Crédito")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Crédito de hora extra (apuração)"),
    ).toBeInTheDocument();
    expect(dentroDaLinha.getByText("90 min")).toBeInTheDocument();
  });

  it("nunca mistura natureza — cada movimento é só crédito ou só débito", () => {
    render(<BancoHorasScreen />);

    const tabela = screen.getByRole("table", {
      name: "Extrato do Banco de Horas",
    });
    // "Compensação" e "quitação" não aparecem como ação real, só como rótulo
    // técnico de origem já existente no núcleo (T052).
    expect(within(tabela).queryByText(/quitação/i)).not.toBeInTheDocument();
  });

  it("alterna o estado de demonstração para 'Vazio' e 'Erro'", () => {
    render(<BancoHorasScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));
    expect(
      screen.getByRole("heading", { name: "Nenhum movimento neste período" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));
    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar o extrato do Banco de Horas",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", { name: "Extrato do Banco de Horas" }),
    ).toBeInTheDocument();
  });

  it("não referencia CPF, nome, empresa real, arquivo ou valor financeiro", () => {
    render(<BancoHorasScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "login",
      "senha",
      "sessão",
      "mfa",
      "salário",
      "salario",
      "assinatura",
      ".pdf",
      "localstorage",
      "r$",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
