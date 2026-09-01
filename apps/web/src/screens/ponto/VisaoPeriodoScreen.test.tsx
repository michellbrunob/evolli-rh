import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VisaoPeriodoScreen } from "./VisaoPeriodoScreen";

describe("VisaoPeriodoScreen (T063 — tela visual estática)", () => {
  it("tem um único h1 e uma descrição que situa o panorama como demonstrativo", () => {
    render(<VisaoPeriodoScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Visão do período" }),
    ).toHaveLength(1);
    expect(
      screen.getByText(/panorama demonstrativo do fluxo de ponto/i),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que somente RH opera e nada é calculado/persistido", () => {
    render(<VisaoPeriodoScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não calcula, corrige, aprova, fecha, assina, paga ou persiste nada/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o período de exemplo, o estado conceitual e a linha do tempo", () => {
    render(<VisaoPeriodoScreen />);

    expect(screen.getByText("26/06/2026 – 25/07/2026")).toBeInTheDocument();
    expect(screen.getByText("Em verificação RH")).toBeInTheDocument();

    const linhaTempo = screen
      .getByRole("heading", {
        name: "Linha do tempo do fluxo (exemplo)",
      })
      .closest("section")!;
    const dentroDaLinhaTempo = within(linhaTempo);
    for (const etapa of [
      "Apuração",
      "Extrato",
      "Verificar folhas",
      "Fechamento",
      "Espelho",
    ]) {
      expect(dentroDaLinhaTempo.getByText(etapa)).toBeInTheDocument();
    }
  });

  it("mostra crédito e débito de Banco de Horas separados e o saldo derivado", () => {
    render(<VisaoPeriodoScreen />);

    expect(screen.getByText("90 min")).toBeInTheDocument();
    expect(screen.getByText("25 min")).toBeInTheDocument();
    expect(screen.getByText("65 min")).toBeInTheDocument();
    expect(
      screen.getByText(/o crédito nunca compensa o débito automaticamente/i),
    ).toBeInTheDocument();
  });

  it("mostra a quantidade de pendências a revisar e o status de fechamento/Espelho", () => {
    render(<VisaoPeriodoScreen />);

    expect(screen.getByText(/pendência\(s\) a revisar/)).toBeInTheDocument();
    expect(screen.getByText("Em verificação RH (exemplo)")).toBeInTheDocument();
    expect(
      screen.getByText("Aguardando emissão (exemplo)"),
    ).toBeInTheDocument();
  });

  it("o botão 'Ver fila completa' só aparece quando onAbrirVerificarFolhas é informado", () => {
    const { rerender } = render(<VisaoPeriodoScreen />);
    expect(
      screen.queryByRole("button", { name: "Ver fila completa" }),
    ).not.toBeInTheDocument();

    const onAbrir = vi.fn();
    rerender(<VisaoPeriodoScreen onAbrirVerificarFolhas={onAbrir} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver fila completa" }));
    expect(onAbrir).toHaveBeenCalledTimes(1);
  });

  it("alterna o estado de demonstração para 'Vazio' e 'Erro'", () => {
    render(<VisaoPeriodoScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));
    expect(
      screen.getByRole("heading", {
        name: "Nenhum dado disponível para este período",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("90 min")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));
    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar a visão do período",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByText("90 min")).toBeInTheDocument();
  });

  it("não referencia autenticação, sessão, CPF, dinheiro, PDF ou dado real", () => {
    render(<VisaoPeriodoScreen />);

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
      "pagamento",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
